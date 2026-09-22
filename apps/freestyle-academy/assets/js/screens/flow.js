/* =========================================================================
   flow.js — the shared single-device session flow.

   Port of battles/offline/OfflineBattleFlowScreen.kt + OfflineTurnScreen.kt +
   OfflineHandoffScreen.kt + SessionTimerRing.kt.

   Entrenar runs it with solo = true (one "Tú" participant, handoffs skipped).
   Master Serie and Gallos run it with the creator's lineup.

   The clock counts UP and is open-ended. A round ends on "PRÓXIMA RONDA" /
   "TERMINAR BATALLA", or the mic passes within the round on "PRÓXIMA ENTRADA".
   Never on the clock.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatClock, MechanicType, shuffled } from '../core/domain.js';
import {
  OfflineStage, createBattleState, currentSpec, currentWordIndex, currentTurnRole,
  tick, advanceRound, completeEntrada, beginTurn, togglePause, rerollTheme,
  totalRounds, performerCount, currentPerformerName, difficultyForRounds,
} from '../core/battle.js';
import { MicSession, BeatPlayer } from '../core/audio.js';
import { imageStimulusForRound, objectSetForRound } from '../data/stimuli.js';
import { PlanEntitlements } from '../core/plans.js';
import {
  esc, icon, applyAccent, confirmDialog, toast,
} from '../ui/components.js';
import { runScoring, scoring } from '../core/scoring.js';
import { keepRecording } from '../core/recordings.js';

const RING_R = 82;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Mounts the flow.
 *
 * @param {object} opts.config      offlineBattleConfig
 * @param {Array}  opts.participants lineup, in turn order
 * @param {boolean} opts.solo
 * @param {object} opts.accent
 * @param {string} opts.modeId      recorded on the session
 * @param {Function} opts.onExit    leave without finishing
 */
export function mountFlow(root, {
  config, participants, solo = false, accent, modeId, modeName, onExit,
}) {
  applyAccent(accent);

  let state = createBattleState({ participants, config, solo });
  const mic = new MicSession();
  const beats = new BeatPlayer().setPlaylist(config.beatTrackFileNames);
  const canRecord = PlanEntitlements.canRecordSessions(store.planTier) && store.isAccount;

  /** Per-turn audio + the stimuli that were on screen, for the AI pass. */
  const segments = [];
  let sessionSeconds = 0;
  let clockTimer = null;
  let meterTimer = null;
  let disposed = false;
  let muted = false;

  /* ---------- stimulus for the active round ---------- */

  function roundStimulus() {
    const spec = currentSpec(state);
    const roundIndex = state.currentRound - 1;
    switch (spec.mechanic.type) {
      case MechanicType.RHYME_WORDS: {
        const keys = Object.keys(store.rhymes).filter((k) => (store.rhymes[k] || []).length > 0);
        if (!keys.length) return { kind: 'words', words: [], key: null };
        const key = roundKeys[roundIndex] ?? keys[0];
        const pool = store.rhymes[key] || [];
        return { kind: 'words', words: roundWords[roundIndex] || pool, key };
      }
      case MechanicType.THEME_PROMPT:
        return { kind: 'theme', theme: state.theme };
      case MechanicType.IMAGE_STIMULUS:
        return { kind: 'image', image: imageStimulusForRound(roundIndex) };
      case MechanicType.OBJECT_STIMULUS:
        return { kind: 'objects', objects: objectSetForRound(roundIndex) };
      default:
        return { kind: 'freeform' };
    }
  }

  // One rhyme group per words-round, drawn up front so a round keeps its group.
  const availableKeys = Object.keys(store.rhymes).filter((k) => (store.rhymes[k] || []).length > 0);
  const roundKeys = config.rounds.map(() => shuffled(availableKeys)[0] ?? null);
  const roundWords = config.rounds.map((_, i) => {
    const key = roundKeys[i];
    return key ? shuffled(store.rhymes[key] || []) : [];
  });

  /** The stimuli actually shown this round — sent to the model so it can
      credit the ones the rapper used. */
  function stimuliLabels() {
    const s = roundStimulus();
    if (s.kind === 'words') {
      const idx = currentWordIndex(state);
      if (idx == null) return s.words.slice(0, 8);
      return s.words.slice(0, idx + 1).slice(-12);
    }
    if (s.kind === 'theme') return s.theme ? [s.theme] : [];
    if (s.kind === 'image') return s.image ? [s.image.fallbackWord] : [];
    if (s.kind === 'objects') return (s.objects || []).map((o) => o.fallbackWord);
    return [];
  }

  /* ---------- rendering ---------- */

  function stimulusHtml() {
    const s = roundStimulus();
    const spec = currentSpec(state);

    if (s.kind === 'words') {
      const idx = currentWordIndex(state);
      if (idx == null) {
        return `<div class="stimulus">
          <p class="stimulus__label">PALABRAS</p>
          <div class="word-grid">${(s.words.slice(0, 8)).map((w) =>
            `<span class="word-chip">${esc(w)}</span>`).join('')}</div>
          ${s.key ? `<p class="stimulus__key">-${esc(s.key)}</p>` : ''}
        </div>`;
      }
      const word = s.words.length ? s.words[idx % s.words.length] : 'Improvisa';
      return `<div class="stimulus">
        <p class="stimulus__label">PALABRA ${idx + 1}</p>
        <p class="word-solo" data-stimulus>${esc(word.toUpperCase())}</p>
        ${s.key ? `<p class="stimulus__key">-${esc(s.key)}</p>` : ''}
        <p class="stimulus__hint">Cambia cada ${spec.mechanic.rotationIntervalSeconds}s</p>
      </div>`;
    }

    if (s.kind === 'theme') {
      return `<div class="stimulus">
        <p class="stimulus__label">TEMÁTICA</p>
        <p class="stimulus__word" data-stimulus>${esc(String(s.theme || '').toUpperCase())}</p>
        <button class="btn btn--outline btn--compact" type="button" data-action="reroll"
                style="max-width:180px">${icon('refresh', { size: 17 })} Cambiar</button>
      </div>`;
    }

    if (s.kind === 'image') {
      const im = s.image;
      return `<div class="stimulus">
        <p class="stimulus__label">IMAGEN</p>
        <div class="stimulus__scene">
          <img src="${esc(im.src)}" alt="${esc(im.description)}" loading="eager" decoding="async">
        </div>
        <p class="stimulus__hint">${esc(im.title)}</p>
      </div>`;
    }

    if (s.kind === 'objects') {
      return `<div class="stimulus">
        <p class="stimulus__label">TRES OBJETOS</p>
        <div class="object-set">
          ${(s.objects || []).map((o) => `
            <figure>
              <span class="object-set__art"><img src="${esc(o.src)}" alt="${esc(o.description)}"></span>
              <figcaption>${esc(o.title)}</figcaption>
            </figure>`).join('')}
        </div>
      </div>`;
    }

    return `<div class="stimulus">
      <p class="stimulus__label">MINUTO LIBRE</p>
      <p class="stimulus__hint">Sin estímulo. Suelta barras.</p>
    </div>`;
  }

  function transportHtml() {
    if (!beats.available) {
      return `<p class="dim center" style="margin:0">Sin beat — añade pistas en assets/beats/</p>`;
    }
    return `
      <div class="transport">
        <span class="transport__track">${esc(beats.currentName)}</span>
        ${canRecord ? `<span class="transport__rec" data-rec data-paused="${state.isPaused}"
                             title="Grabando"></span>` : ''}
        <button class="transport__btn transport__btn--primary" type="button" data-action="toggle-pause"
                aria-label="${state.isPaused ? 'Reanudar' : 'Pausar'}">
          ${icon(state.isPaused ? 'play' : 'pause', { size: 19 })}
        </button>
        <button class="transport__btn" type="button" data-action="next-beat" aria-label="Siguiente beat">
          ${icon('skip', { size: 19 })}
        </button>
        <button class="transport__btn" type="button" data-action="mute" aria-label="${muted ? 'Activar sonido' : 'Silenciar'}">
          ${icon(muted ? 'mute' : 'volume', { size: 19 })}
        </button>
      </div>`;
  }

  function turnHtml() {
    const spec = currentSpec(state);
    const role = currentTurnRole(state);
    const last = state.currentRound >= totalRounds(state.config);
    const many = performerCount(state) > 1;

    return `
      <div class="screen screen--flow">
        <div class="topbar">
          <button class="iconbtn" type="button" data-action="quit" aria-label="Salir de la sesión">
            ${icon('close')}
          </button>
          <span class="grow"></span>
          <span class="dim">${esc(config.formatLabel)}</span>
        </div>

        <div class="turn-head">
          <p class="turn-head__mode">${esc(config.modeTitle.toUpperCase())}</p>
          <p class="turn-head__round">${esc(spec.title)}</p>
          <div class="turn-head__meta">
            <span>Ronda ${state.currentRound} de ${totalRounds(state.config)}</span>
            ${state.stage === OfflineStage.TURN && !state.isPaused
              ? '<span class="turn-head__live">EN VIVO</span>'
              : `<span class="dim">${state.isPaused ? 'PAUSA' : 'LISTO'}</span>`}
          </div>
        </div>

        <div class="round-progress" role="img"
             aria-label="Ronda ${state.currentRound} de ${totalRounds(state.config)}">
          ${config.rounds.map((_, i) =>
            `<span data-done="${i < state.currentRound}"></span>`).join('')}
        </div>

        <div class="timer">
          <div class="timer__glow" data-glow></div>
          <svg viewBox="0 0 176 176" aria-hidden="true">
            <circle cx="88" cy="88" r="${RING_R}" fill="none"
                    stroke="color-mix(in srgb, var(--accent) 15%, transparent)"
                    stroke-width="12"/>
            <circle data-arc cx="88" cy="88" r="${RING_R}" fill="none"
                    stroke="url(#ringGrad)" stroke-width="12" stroke-linecap="round"
                    stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/>
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--accent)"/>
                <stop offset="100%" stop-color="var(--accent-bright)"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="timer__inner">
            <div class="timer__label">${many ? esc(currentPerformerName(state).toUpperCase()) : 'TIEMPO'}</div>
            <div class="timer__value" data-clock role="timer" aria-live="off">0:00</div>
            ${role ? `<div class="timer__role">${esc(role)}</div>` : ''}
          </div>
        </div>

        <div data-slot="stimulus">${stimulusHtml()}</div>

        <div data-slot="transport">${transportHtml()}</div>

        ${mic.permission === 'denied'
          ? `<p class="dim center" style="margin:0">Activa el micrófono para grabar y recibir evaluación.</p>` : ''}

        <div class="btn-row">
          ${many ? `<button class="btn btn--outline" type="button" data-action="next-entrada">
            PRÓXIMA ENTRADA</button>` : ''}
          <button class="btn btn--primary" type="button" data-action="end-round">
            ${last ? (solo ? 'TERMINAR' : 'TERMINAR BATALLA') : 'PRÓXIMA RONDA'}
          </button>
        </div>
      </div>`;
  }

  function handoffHtml() {
    return `
      <div class="screen screen--flow" style="justify-content:center;text-align:center;gap:24px">
        <div class="topbar">
          <button class="iconbtn" type="button" data-action="quit" aria-label="Salir de la sesión">
            ${icon('close')}
          </button>
          <span class="grow"></span>
        </div>
        <div class="stack" style="align-items:center;gap:8px;margin-top:auto">
          <p class="eyebrow">Ronda ${state.currentRound} · ${esc(currentSpec(state).title)}</p>
          <p class="dim">Pasa el micrófono a</p>
          <h1 style="font-size:34px">${esc(currentPerformerName(state))}</h1>
        </div>
        <button class="btn btn--primary" type="button" data-action="begin"
                style="margin-top:auto">EMPEZAR</button>
      </div>`;
  }

  /* ---------- live updates (no re-render, so the clock stays smooth) ---------- */

  function paintClock() {
    const el = root.querySelector('[data-clock]');
    const arc = root.querySelector('[data-arc]');
    if (el) el.textContent = formatClock(state.elapsedSeconds);
    if (arc) {
      const spec = currentSpec(state);
      // Fills toward the nominal duration, then stays a full circle.
      const p = Math.min(1, state.elapsedSeconds / Math.max(1, spec.durationSeconds));
      arc.setAttribute('stroke-dashoffset', String(RING_C * (1 - p)));
    }
  }

  function paintMeter() {
    const glow = root.querySelector('[data-glow]');
    if (!glow) return;
    const live = state.stage === OfflineStage.TURN && !state.isPaused;
    const level = live ? mic.level() : 0;
    glow.style.opacity = String(Math.min(0.9, level * 1.4));
    glow.style.transform = `scale(${1 + level * 0.18})`;
  }

  let lastWordIndex = null;
  function paintStimulusIfChanged() {
    const idx = currentWordIndex(state);
    if (idx === lastWordIndex) return;
    lastWordIndex = idx;
    const host = root.querySelector('[data-slot="stimulus"]');
    if (host) { host.innerHTML = stimulusHtml(); wireStimulus(); }
  }

  function paintTransport() {
    const host = root.querySelector('[data-slot="transport"]');
    if (host) { host.innerHTML = transportHtml(); wireTransport(); }
  }

  /* ---------- wiring ---------- */

  function wireStimulus() {
    root.querySelector('[data-action="reroll"]')?.addEventListener('click', () => {
      state = rerollTheme(state);
      const el = root.querySelector('[data-stimulus]');
      if (el) el.textContent = String(state.theme || '').toUpperCase();
    });
  }

  function wireTransport() {
    root.querySelector('[data-action="toggle-pause"]')?.addEventListener('click', () => {
      state = togglePause(state);
      if (state.isPaused) { beats.pause(); mic.pause(); }
      else { beats.play(); mic.resume(); }
      render();
    });
    root.querySelector('[data-action="next-beat"]')?.addEventListener('click', () => {
      beats.next(); paintTransport();
    });
    root.querySelector('[data-action="mute"]')?.addEventListener('click', () => {
      muted = !muted; beats.setMuted(muted); paintTransport();
    });
  }

  async function captureSegment() {
    if (!canRecord) return;
    const blob = await mic.stopSegment();
    if (blob) {
      segments.push({
        blob,
        roundLabel: currentSpec(state).title,
        performerName: solo ? null : currentPerformerName(state),
        durationSeconds: state.elapsedSeconds,
        stimuli: stimuliLabels(),
      });
    }
  }

  async function startTurnAudio() {
    if (canRecord && mic.permission !== 'granted') await mic.start();
    else if (mic.permission === 'unknown') await mic.start();
    if (canRecord) mic.startSegment();
    beats.play();
  }

  function wireCommon() {
    root.querySelector('[data-action="quit"]')?.addEventListener('click', onQuit);

    root.querySelector('[data-action="begin"]')?.addEventListener('click', async () => {
      state = beginTurn(state);
      await startTurnAudio();
      render();
    });

    root.querySelector('[data-action="next-entrada"]')?.addEventListener('click', async () => {
      sessionSeconds += state.elapsedSeconds;
      await captureSegment();
      state = completeEntrada(state);
      render();
    });

    root.querySelector('[data-action="end-round"]')?.addEventListener('click', async () => {
      sessionSeconds += state.elapsedSeconds;
      await captureSegment();
      const wasLast = state.currentRound >= totalRounds(state.config);
      state = advanceRound(state);
      if (wasLast) await finish();
      else render();
    });

    wireStimulus();
    wireTransport();
  }

  async function onQuit() {
    const losesXp = store.accruesXp && !solo === false;
    const bullets = [];
    if (store.accruesXp) bullets.push('El XP de esta sesión (solo se otorga al terminar).');
    if (canRecord) bullets.push('La grabación en curso.');

    const wasPaused = state.isPaused;
    if (!wasPaused) { state = togglePause(state); beats.pause(); mic.pause(); render(); }

    const leave = await confirmDialog({
      title: '¿Salir de la sesión?',
      message: 'Si sales ahora, la sesión no se guarda.',
      bullets,
      confirmText: 'Salir',
      danger: true,
    });

    if (!leave) {
      if (!wasPaused) { state = togglePause(state); beats.play(); mic.resume(); render(); }
      return;
    }
    await teardown();
    onExit();
  }

  /* ---------- finishing ---------- */

  async function finish() {
    stopClock();
    beats.stop();
    await mic.stop();

    const difficulty = difficultyForRounds(config.rounds);
    const result = store.completeSession({
      modeId,
      modeName,
      difficulty,
      rhymeKeys: roundKeys.filter(Boolean),
      roundsPlanned: totalRounds(config),
      roundsCompleted: totalRounds(config),
      practiceSeconds: sessionSeconds,
      isBattle: !solo,
    });

    // The AI pass starts from the captured audio straight away — it is what
    // awards the XP, so the results screen waits on it rather than on a
    // keep/discard answer.
    const scored = runScoring(segments, {
      recordedSeconds: mic.recordedSeconds,
      isBattle: !solo,
      streakDays: store.storedStreakDays,
    });

    // Keeping the register is what Historial de Sesiones lists. It waits for
    // the evaluation so the transcripts and the award land with it, and a
    // failed evaluation still keeps the audio — the register carries a null
    // XP rather than a zero.
    if (canRecord && segments.length > 0) {
      scored.finally(() => {
        keepRecording(
          store.scope,
          {
            modeName,
            durationSeconds: sessionSeconds,
            xpEarned: store.lastResult?.record?.xpEarned ?? null,
          },
          segments.map((s, i) => ({
            roundNumber: i + 1,
            roundLabel: s.roundLabel,
            performerName: solo ? null : s.performerName || null,
            blob: s.blob,
            durationSeconds: s.durationSeconds,
            transcript: scoring.transcripts[i]?.text || null,
          }))
        );
      });
    }

    navigate('results');
  }

  /* ---------- clock ---------- */

  function startClock() {
    stopClock();
    clockTimer = setInterval(() => {
      if (disposed) return;
      const before = state.elapsedSeconds;
      state = tick(state);
      if (state.elapsedSeconds !== before) { paintClock(); paintStimulusIfChanged(); }
    }, 1000);
    meterTimer = setInterval(() => { if (!disposed) paintMeter(); }, 100);
  }

  function stopClock() {
    clearInterval(clockTimer); clockTimer = null;
    clearInterval(meterTimer); meterTimer = null;
  }

  async function teardown() {
    disposed = true;
    stopClock();
    beats.stop();
    await mic.stop();
  }

  /* ---------- render ---------- */

  function render() {
    if (state.stage === OfflineStage.HANDOFF) {
      // Solo auto-skips the between-round handoffs.
      if (solo) {
        state = beginTurn(state);
        root.innerHTML = turnHtml();
        wireCommon();
        lastWordIndex = currentWordIndex(state);
        paintClock();
        startTurnAudio();
        startClock();
        return;
      }
      root.innerHTML = handoffHtml();
      wireCommon();
      stopClock();
      return;
    }
    root.innerHTML = turnHtml();
    wireCommon();
    lastWordIndex = currentWordIndex(state);
    paintClock();
    startClock();
  }

  render();
  return teardown;
}
