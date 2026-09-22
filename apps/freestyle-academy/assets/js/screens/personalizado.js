/* =========================================================================
   personalizado.js — port of EntrenamientoPersonalizadoScreen.kt

   Pick up to four rhyme groups and an optional auto-refresh cadence, then get
   a live board of rhyming words to practise against.

   It is a plain word tool: no battle engine, no rounds, no handoffs. Ending
   the board records the session like Entrenar does and awards nothing on its
   own — the AI evaluation that then runs on the captured audio is what awards
   the XP, through exactly the same path as every other session.

   With ?immediate=true (the Home hero card) it skips setup into a board of
   four random groups.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate, back } from '../core/router.js';
import { formatClock, shuffled, Difficulty } from '../core/domain.js';
import { sortedRhymeKeys } from '../core/rhyme-library.js';
import { MicSession, BeatPlayer } from '../core/audio.js';
import { PlanEntitlements } from '../core/plans.js';
import { runScoring, scoring } from '../core/scoring.js';
import { keepRecording } from '../core/recordings.js';
import {
  esc, icon, appScaffold, wireBack, optionCard, sectionHead, notice,
  confirmDialog, toast, resetAccent, applyAccent,
} from '../ui/components.js';

const ACCENT = { main: '#7B35FF', bright: '#23D7F2', onMain: '#FFFFFF' };

/** Up to four groups on the board at once — more stops being readable. */
export const MAX_GROUPS = 4;

/** Words shown per group. */
const WORDS_PER_GROUP = 6;

/** The auto-refresh cadences the board offers. */
const CADENCES = [
  { id: 0, label: 'Manual', hint: 'Cambias tú, cuando quieras' },
  { id: 10, label: 'Cada 10s', hint: 'Ritmo cómodo' },
  { id: 15, label: 'Cada 15s', hint: 'Ritmo medio' },
  { id: 20, label: 'Cada 20s', hint: 'Más tiempo por tanda' },
  { id: 30, label: 'Cada 30s', hint: 'Tandas largas' },
];

export function renderPersonalizado(root, { query }) {
  resetAccent();

  let selected = [];
  let cadence = 0;
  let teardown = null;

  if (query.get('immediate') === 'true') {
    selected = shuffled(sortedRhymeKeys(store.rhymes)).slice(0, MAX_GROUPS);
    startBoard();
    return () => teardown?.();
  }

  /* ---------- setup ---------- */

  function setupView() {
    const keys = sortedRhymeKeys(store.rhymes);
    const canRecord = PlanEntitlements.canRecordSessions(store.planTier) && store.isAccount;

    return `
      <div class="screen">
        ${appScaffold('Entrenamiento Personalizado', `
          <p class="muted" style="margin:0">
            Elige hasta ${MAX_GROUPS} grupos de rima. El tablero te muestra
            palabras de cada uno y tú improvisas con ellas.
          </p>

          <div class="section">
            <div class="section__head">
              <h2 class="section__title">Grupos</h2>
              <span class="dim">${selected.length} / ${MAX_GROUPS}</span>
            </div>
            <div class="chip-grid" data-group="keys">
              ${keys.map((k) => {
                const at = selected.indexOf(k);
                const full = selected.length >= MAX_GROUPS && at < 0;
                return `
                  <button class="chip" type="button" data-value="${esc(k)}"
                          aria-pressed="${at >= 0}" ${full ? 'disabled' : ''}>
                    ${at >= 0 ? `<span class="chip__order">${at + 1}</span>` : ''}
                    -${esc(k)}
                    <span class="chip__count">${(store.rhymes[k] || []).length}</span>
                  </button>`;
              }).join('')}
            </div>
            <button class="btn btn--ghost btn--compact" type="button" data-action="random">
              ${icon('shuffle', { size: 17 })} Elegir al azar
            </button>
          </div>

          <div class="section">
            ${sectionHead('Cambio de palabras')}
            <div class="list" data-group="cadence">
              ${CADENCES.map((c) => optionCard(c.label, {
                subtitle: c.hint,
                selected: cadence === c.id,
                value: String(c.id),
                role: 'checked',
              })).join('')}
            </div>
          </div>

          ${!canRecord ? notice(
            store.isAccount
              ? 'Con el plan Gratis la sesión no se graba, así que no se evalúa ni suma XP.'
              : 'Como invitado la sesión no se graba ni suma progreso. Puedes practicar igual.'
          ) : ''}

          <button class="btn btn--primary" type="button" data-action="start"
                  ${selected.length === 0 ? 'disabled' : ''}>
            ${selected.length === 0 ? 'Elige al menos un grupo' : 'EMPEZAR'}
          </button>
        `)}
      </div>`;
  }

  function paintSetup() {
    root.innerHTML = setupView();
    wireBack(root, 'train');

    root.querySelector('[data-group="keys"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn || btn.disabled) return;
      const key = btn.dataset.value;
      const at = selected.indexOf(key);
      if (at >= 0) selected.splice(at, 1);
      else if (selected.length < MAX_GROUPS) selected.push(key);
      paintSetup();
    });

    root.querySelector('[data-group="cadence"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      cadence = Number(btn.dataset.value);
      paintSetup();
    });

    root.querySelector('[data-action="random"]')?.addEventListener('click', () => {
      selected = shuffled(sortedRhymeKeys(store.rhymes)).slice(0, MAX_GROUPS);
      paintSetup();
    });

    root.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (selected.length === 0) { toast('Elige al menos un grupo'); return; }
      startBoard();
    });
  }

  /* ---------- the board ---------- */

  function startBoard() {
    applyAccent(ACCENT);

    const mic = new MicSession();
    const beats = new BeatPlayer().setPlaylist([]);
    const canRecord = PlanEntitlements.canRecordSessions(store.planTier) && store.isAccount;

    let elapsed = 0;
    let paused = false;
    let muted = false;
    let clock = null;
    let lastSwap = 0;
    let board = drawBoard();
    let finished = false;

    function drawBoard() {
      return selected.map((key) => ({
        key,
        words: shuffled(store.rhymes[key] || []).slice(0, WORDS_PER_GROUP),
      }));
    }

    function boardHtml() {
      return board.map((g) => `
        <div class="board-group">
          <p class="board-group__key">-${esc(g.key)}</p>
          <div class="word-grid">
            ${g.words.map((w) => `<span class="word-chip">${esc(w)}</span>`).join('')}
          </div>
        </div>`).join('');
    }

    function view() {
      return `
        <div class="screen screen--flow">
          <div class="topbar">
            <button class="iconbtn" type="button" data-action="quit" aria-label="Salir">
              ${icon('close')}
            </button>
            <span class="grow"></span>
            <span class="dim">PERSONALIZADO</span>
          </div>

          <div class="turn-head">
            <p class="turn-head__mode">TABLERO</p>
            <p class="turn-head__round">${board.length} grupo${board.length === 1 ? '' : 's'}</p>
            <div class="turn-head__meta">
              <span>${cadence ? `Cambia cada ${cadence}s` : 'Cambio manual'}</span>
              ${paused ? '<span class="dim">PAUSA</span>' : '<span class="turn-head__live">EN VIVO</span>'}
            </div>
          </div>

          <p class="board-clock" data-clock role="timer" aria-live="off">${formatClock(elapsed)}</p>

          <div data-slot="board">${boardHtml()}</div>

          <div class="transport">
            <span class="transport__track">${beats.available ? esc(beats.currentName) : 'Sin beat'}</span>
            ${canRecord ? `<span class="transport__rec" data-paused="${paused}" title="Grabando"></span>` : ''}
            <button class="transport__btn transport__btn--primary" type="button" data-action="pause"
                    aria-label="${paused ? 'Reanudar' : 'Pausar'}">
              ${icon(paused ? 'play' : 'pause', { size: 19 })}
            </button>
            ${beats.available ? `
              <button class="transport__btn" type="button" data-action="mute"
                      aria-label="${muted ? 'Activar sonido' : 'Silenciar'}">
                ${icon(muted ? 'mute' : 'volume', { size: 19 })}
              </button>` : ''}
          </div>

          <div class="btn-row">
            <button class="btn btn--outline" type="button" data-action="refresh">
              ${icon('refresh', { size: 18 })} NUEVAS PALABRAS
            </button>
            <button class="btn btn--primary" type="button" data-action="finish">TERMINAR</button>
          </div>
        </div>`;
    }

    function paintClock() {
      const el = root.querySelector('[data-clock]');
      if (el) el.textContent = formatClock(elapsed);
    }

    function paintBoard() {
      const host = root.querySelector('[data-slot="board"]');
      if (host) host.innerHTML = boardHtml();
    }

    function refresh() {
      board = drawBoard();
      lastSwap = elapsed;
      paintBoard();
    }

    function tick() {
      if (paused || finished) return;
      elapsed += 1;
      paintClock();
      if (cadence > 0 && elapsed - lastSwap >= cadence) refresh();
    }

    async function finish() {
      if (finished) return;
      finished = true;
      clearInterval(clock);
      beats.stop();
      const blob = await mic.stopSegment();
      await mic.stop();

      const segments = blob ? [{
        blob,
        roundLabel: 'Sesión',
        performerName: null,
        durationSeconds: elapsed,
        stimuli: board.flatMap((g) => g.words),
      }] : [];

      store.completeSession({
        modeId: 'personalizado',
        modeName: 'Entrenamiento Personalizado',
        // The board has no cadence of its own, so the session is filed at the
        // middle one rather than claiming a difficulty it never set.
        difficulty: Difficulty.MEDIUM,
        rhymeKeys: selected.slice(),
        roundsPlanned: 1,
        roundsCompleted: 1,
        practiceSeconds: elapsed,
        isBattle: false,
      });

      const scored = runScoring(segments, {
        recordedSeconds: mic.recordedSeconds,
        isBattle: false,
        streakDays: store.storedStreakDays,
      });

      if (canRecord && segments.length > 0) {
        scored.finally(() => keepRecording(
          store.scope,
          {
            modeName: 'Entrenamiento Personalizado',
            durationSeconds: elapsed,
            xpEarned: store.lastResult?.record?.xpEarned ?? null,
          },
          segments.map((s, i) => ({
            roundNumber: i + 1,
            roundLabel: s.roundLabel,
            performerName: null,
            blob: s.blob,
            durationSeconds: s.durationSeconds,
            transcript: scoring.transcripts[i]?.text || null,
          }))
        ));
      }

      navigate('results');
    }

    async function quit() {
      const wasPaused = paused;
      if (!wasPaused) { paused = true; beats.pause(); mic.pause(); paint(); }
      const leave = await confirmDialog({
        title: '¿Salir del tablero?',
        message: 'Si sales ahora, la sesión no se guarda.',
        bullets: store.accruesXp ? ['El XP de esta sesión (solo se otorga al terminar).'] : [],
        confirmText: 'Salir',
        danger: true,
      });
      if (!leave) {
        if (!wasPaused) { paused = false; beats.play(); mic.resume(); paint(); }
        return;
      }
      finished = true;
      clearInterval(clock);
      beats.stop();
      await mic.stop();
      back('train');
    }

    function paint() {
      root.innerHTML = view();

      root.querySelector('[data-action="quit"]').addEventListener('click', quit);
      root.querySelector('[data-action="refresh"]').addEventListener('click', refresh);
      root.querySelector('[data-action="finish"]').addEventListener('click', finish);

      root.querySelector('[data-action="pause"]').addEventListener('click', () => {
        paused = !paused;
        if (paused) { beats.pause(); mic.pause(); } else { beats.play(); mic.resume(); }
        paint();
      });

      root.querySelector('[data-action="mute"]')?.addEventListener('click', () => {
        muted = !muted; beats.setMuted(muted); paint();
      });
    }

    paint();

    (async () => {
      await mic.start();
      if (canRecord) mic.startSegment();
      beats.play();
      clock = setInterval(tick, 1000);
    })();

    teardown = async () => {
      finished = true;
      clearInterval(clock);
      beats.stop();
      await mic.stop();
    };
  }

  paintSetup();
  return () => teardown?.();
}
