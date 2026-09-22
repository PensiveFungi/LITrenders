/* session.js — port of ui/screens/SessionScreen.kt (route: session)

   State machine, identical to the Android SessionUiState:
     Ready → Countdown(3s) → Recording ⇄ Paused → Completed

   The countdown runs before the timer is unpaused, so setup time never counts
   against the round — same contract as AppViewModel.startSession().
*/

import { store } from '../core/store.js';
import { navigate, back } from '../core/router.js';
import { formatSeconds } from '../core/domain.js';
import { modeById, styleForModeId, StimulusType, imageStimulusForRound } from '../data/modes.js';
import { MicrophoneSession } from '../core/audio.js';
import {
  esc, icon, sessionHeader, roundProgress, timerCard, updateTimer, updateAudioBars,
  stimulusPanel, wordPool, micControl, sessionActionBar, imageStimulusScene,
  applyModeTheme, toast, confirmDialog,
} from '../ui/components.js';

const COUNTDOWN_SECONDS = 3;
const UI = { READY: 'Ready', COUNTDOWN: 'Countdown', RECORDING: 'Recording', PAUSED: 'Paused', COMPLETED: 'Completed' };

export function renderSession(root) {
  const sections = store.session;

  if (!sections || sections.length === 0) {
    root.innerHTML = `
      <div class="screen" style="justify-content:center;align-items:center;text-align:center">
        <h1 class="display" style="font-size:24px">No hay sesión activa</h1>
        <button class="btn btn--primary" type="button" data-action="back" style="max-width:240px">Volver</button>
      </div>`;
    root.querySelector('[data-action="back"]').addEventListener('click', () => back('train'));
    return;
  }

  const info = store.activeSessionInfo;
  const style = styleForModeId(info?.modeId);
  applyModeTheme(info?.modeId);

  const preset = modeById(info?.modeId);
  const imageMode = preset?.stimulusType === StimulusType.IMAGES;

  const mic = new MicrophoneSession();
  let currentTurn = 0;
  let uiState = UI.READY;
  let countdownValue = COUNTDOWN_SECONDS;
  let countdownTimer = null;
  let meterTimer = null;
  let disposed = false;

  /* ---------- markup ---------- */

  function shell() {
    const section = sections[Math.min(currentTurn, sections.length - 1)];
    const imageState = imageMode ? imageStimulusForRound(currentTurn) : null;
    const stimulus = imageState
      ? imageState.title
      : (section.displayedWords[0] ?? 'Improvisa');
    const chips = style.modeId === 'incremental'
      ? (info?.roundDurationsSeconds || []).map((d) => `${d}s`)
      : style.chips;

    return `
      <div class="screen">
        <div class="topbar">
          <button class="iconbtn" type="button" data-action="abandon" aria-label="Salir de la sesión">
            ${icon('close')}
          </button>
          <span class="grow"></span>
          <span class="dim">${esc(info?.difficulty?.label || '')}</span>
        </div>

        <div data-slot="header">${sessionHeader(style, currentTurn + 1, sections.length, 'Modo práctica')}</div>
        <div data-slot="rounds">${roundProgress(currentTurn + 1, sections.length)}</div>

        ${timerCard(style)}

        <p class="center" style="font-size:22px;font-weight:800;letter-spacing:.04em">
          ${esc(style.timerLabel.toUpperCase())}
        </p>
        <p class="center muted" style="margin:-12px 0 0">${esc(style.stimulusHint)}</p>

        <div data-slot="stimulus">
          ${stimulusPanel(style, {
            featured: stimulus,
            rhymeKey: imageMode ? null : section.rhymeKey,
            chips,
            sceneSvg: imageState ? imageStimulusScene(imageState) : '',
          })}
        </div>

        <div data-slot="words">${wordPool(section.displayedWords)}</div>

        ${micControl(style)}
        <p class="dim" data-slot="mic-note" hidden></p>

        <div data-slot="actions">
          ${sessionActionBar(
            currentTurn === sections.length - 1 ? 'Completar' : 'Cerrar ronda',
            style.modeId === 'incremental' ? 'Siguiente etapa' : 'Siguiente',
            { secondaryEnabled: currentTurn < sections.length - 1 }
          )}
        </div>
      </div>`;
  }

  /* ---------- live updates (no re-render, so the timer stays smooth) ---------- */

  function paintTimer() {
    const section = sections[Math.min(currentTurn, sections.length - 1)];
    const remaining = section.remainingSeconds ?? 30;
    const total = section.cycleDurationSeconds ?? Math.max(1, remaining);
    updateTimer(root, {
      seconds: remaining,
      progress: Math.min(1, Math.max(0, remaining / Math.max(1, total))),
      countdown: uiState === UI.COUNTDOWN ? countdownValue : null,
      formatted: formatSeconds(remaining),
    });
  }

  function paintStatus() {
    const header = root.querySelector('[data-slot="header"]');
    if (header) {
      header.innerHTML = sessionHeader(
        style, currentTurn + 1, sections.length,
        uiState === UI.RECORDING ? 'En vivo' : 'Modo práctica'
      );
    }
    const rounds = root.querySelector('[data-slot="rounds"]');
    if (rounds) rounds.innerHTML = roundProgress(currentTurn + 1, sections.length);

    const micBtn = root.querySelector('[data-action="mic"]');
    if (micBtn) micBtn.dataset.active = String(uiState === UI.RECORDING);

    const micTitle = root.querySelector('[data-mic-title]');
    if (micTitle) micTitle.textContent = uiState === UI.PAUSED ? 'REANUDAR' : style.micTitle;

    const note = root.querySelector('[data-slot="mic-note"]');
    if (note) {
      if (mic.permission === 'denied') {
        note.hidden = false;
        note.textContent = 'Activa el micrófono para ver tu nivel de voz en vivo y analizar la ronda.';
      } else if (mic.permission === 'unsupported') {
        note.hidden = false;
        note.textContent = 'Este navegador no permite grabar audio; la sesión funciona igual sin micrófono.';
      } else {
        note.hidden = true;
      }
    }
  }

  function paintStimulus() {
    const current = store.session;
    if (!current) return;
    const section = current[Math.min(currentTurn, current.length - 1)];
    if (!section) return;

    const word = root.querySelector('[data-stimulus-word]');
    const imageState = imageMode ? imageStimulusForRound(currentTurn) : null;
    const featured = imageState ? imageState.title : (section.displayedWords[0] ?? 'Improvisa');
    if (word) {
      word.textContent = String(featured).toUpperCase();
      word.dataset.long = String(String(featured).length > 12);
    }
    const key = root.querySelector('.stimulus__key');
    if (key && !imageMode) key.textContent = `-${section.rhymeKey}`;

    const wordsHost = root.querySelector('[data-slot="words"]');
    if (wordsHost) {
      wordsHost.innerHTML = wordPool(section.displayedWords);
      wireWordPool();
    }
  }

  function paintActions() {
    const host = root.querySelector('[data-slot="actions"]');
    if (!host) return;
    host.innerHTML = sessionActionBar(
      currentTurn === sections.length - 1 ? 'Completar' : 'Cerrar ronda',
      style.modeId === 'incremental' ? 'Siguiente etapa' : 'Siguiente',
      { secondaryEnabled: currentTurn < sections.length - 1 }
    );
    wireActions();
  }

  /* ---------- mic lifecycle ---------- */

  function startMeter() {
    stopMeter();
    meterTimer = window.setInterval(() => {
      if (disposed) return;
      updateAudioBars(root, uiState === UI.RECORDING ? mic.sampleAmplitude() : 0);
    }, 100);
  }

  function stopMeter() {
    if (meterTimer != null) { window.clearInterval(meterTimer); meterTimer = null; }
    updateAudioBars(root, 0);
  }

  async function ensureMic() {
    if (mic.permission === 'granted') return true;
    const ok = await mic.start();
    paintStatus();
    return ok;
  }

  /* ---------- state transitions ---------- */

  function beginCountdown() {
    uiState = UI.COUNTDOWN;
    countdownValue = COUNTDOWN_SECONDS;
    paintStatus();
    paintTimer();

    window.clearInterval(countdownTimer);
    countdownTimer = window.setInterval(() => {
      countdownValue -= 1;
      if (countdownValue > 0) {
        paintTimer();
        return;
      }
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      startRecording();
    }, 1000);
  }

  function startRecording() {
    if (store.timerPaused) store.toggleTimerPause();
    uiState = UI.RECORDING;
    if (mic.permission === 'granted' && !mic.isRecording) mic.startRecording();
    startMeter();
    paintStatus();
    paintTimer();
  }

  function pauseRecording() {
    if (!store.timerPaused) store.toggleTimerPause();
    uiState = UI.PAUSED;
    mic.pauseRecording();
    paintStatus();
  }

  function resumeRecording() {
    if (store.timerPaused) store.toggleTimerPause();
    uiState = UI.RECORDING;
    mic.resumeRecording();
    paintStatus();
  }

  async function onMicClick() {
    switch (uiState) {
      case UI.READY: {
        await ensureMic();
        beginCountdown();
        break;
      }
      case UI.COUNTDOWN:
        window.clearInterval(countdownTimer);
        countdownTimer = null;
        startRecording();
        break;
      case UI.RECORDING:
        pauseRecording();
        break;
      case UI.PAUSED:
        resumeRecording();
        break;
      default:
        uiState = UI.READY;
        paintStatus();
    }
  }

  async function captureRound() {
    if (mic.permission !== 'granted') return;
    const blob = await mic.stopRecording();
    if (blob) store.attachRecording(currentTurn, blob);
  }

  /* ---------- wiring ---------- */

  function wireWordPool() {
    root.querySelectorAll('[data-word-index]').forEach((chip) => {
      chip.addEventListener('click', () => {
        store.swapWord(currentTurn, Number(chip.dataset.wordIndex));
      });
    });
  }

  function wireActions() {
    root.querySelector('[data-action="next"]')?.addEventListener('click', async () => {
      if (currentTurn >= sections.length - 1) return;
      if (!store.timerPaused) store.toggleTimerPause();
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      await captureRound();
      stopMeter();
      currentTurn = Math.min(currentTurn + 1, sections.length - 1);
      uiState = UI.READY;
      paintStatus();
      paintStimulus();
      paintActions();
      paintTimer();
    });

    root.querySelector('[data-action="complete"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      uiState = UI.COMPLETED;
      window.clearInterval(countdownTimer);
      countdownTimer = null;
      await captureRound();
      stopMeter();
      await mic.stop();
      store.completeSession(currentTurn + 1);
      navigate('results');
    });
  }

  function wireOnce() {
    root.querySelector('[data-action="mic"]')?.addEventListener('click', onMicClick);

    root.querySelector('[data-action="reset-section"]')?.addEventListener('click', () => {
      const changesAllowed = info?.allowStimulusChanges === true;
      if (!changesAllowed && uiState === UI.RECORDING) {
        toast('Este modo no permite cambiar el estímulo durante la ronda.');
        return;
      }
      store.resetSection(currentTurn);
    });

    root.querySelector('[data-action="abandon"]')?.addEventListener('click', async () => {
      const leave = await confirmDialog({
        title: '¿Salir de la sesión?',
        message: 'Si sales ahora no se guardará el progreso de esta sesión.',
        confirmText: 'Salir',
        danger: true,
      });
      if (!leave) return;
      store.endSession();
      back('train');
    });

    wireWordPool();
    wireActions();
  }

  /* ---------- mount ---------- */

  root.innerHTML = shell();
  wireOnce();
  paintTimer();
  paintStatus();

  const offSession = store.on('session', (next) => {
    if (!next) return;
    sections.length = 0;
    next.forEach((s) => sections.push(s));
    paintTimer();
    paintStimulus();
  });

  return () => {
    disposed = true;
    offSession();
    window.clearInterval(countdownTimer);
    stopMeter();
    mic.stop();
  };
}
