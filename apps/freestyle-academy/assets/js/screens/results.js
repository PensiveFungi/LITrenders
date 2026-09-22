/* results.js — port of ui/screens/ResultsScreen.kt (route: results)
   Adds the AI feedback panel: transcript + FMS-dimension scoring from the
   Groq pipeline behind the Cloud Function. */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatSeconds } from '../core/domain.js';
import { styleForModeId } from '../data/modes.js';
import {
  analyzeRound, isFeedbackEnabled, FEEDBACK_DIMENSIONS, FeedbackUnavailable,
} from '../core/feedback.js';
import {
  esc, icon, progressBar, summaryRows, achievementRow, applyModeTheme, toast, emptyState,
} from '../ui/components.js';

export function renderResults(root) {
  const result = store.lastResult;

  if (!result) {
    root.innerHTML = `
      <div class="screen" style="justify-content:center">
        ${emptyState('Sin resultados que mostrar',
          'Completa una sesión de entrenamiento para ver tu resumen aquí.')}
        <button class="btn btn--primary" type="button" data-go="train">Volver al inicio</button>
      </div>`;
    root.querySelector('[data-go]').addEventListener('click', () => navigate('train'));
    return;
  }

  const { record } = result;
  const style = styleForModeId(record.modeId);
  applyModeTheme(record.modeId);

  const recordings = result.recordings || [];
  const canAnalyze = isFeedbackEnabled() && recordings.length > 0;

  root.innerHTML = `
    <div class="screen">
      <span class="result-crown">${icon('crown', { size: 54 })}</span>

      <h1 class="result-title display">
        ${record.completedFully ? '¡Sesión completada!' : 'Sesión guardada'}
      </h1>
      <p class="result-xp display">+${record.xpEarned} XP</p>

      <div class="card stack">
        <h2 style="font-size:18px;font-weight:700">Resumen de la sesión</h2>
        ${summaryRows([
          ['Modo', record.modeName],
          ['Dificultad', record.difficultyLabel],
          ['Rondas completadas', `${record.roundsCompleted} / ${record.roundsPlanned}`],
          ['Estímulos trabajados', String(record.promptsCompleted)],
          ['Tiempo de práctica', formatSeconds(record.practiceSeconds)],
          ['Rimas', record.rhymeKeys.map((k) => `-${k}`).join(' · ')],
        ])}
      </div>

      <div class="card stack">
        <div class="row row--between" style="align-items:flex-end">
          <span>
            <span class="dim" style="display:block">Nivel</span>
            <span class="display" style="font-size:28px">Nivel ${result.level}</span>
          </span>
          <span style="color:var(--mode-primary);font-weight:700">
            ${result.xpIntoLevel} / ${result.xpForNextLevel} XP
          </span>
        </div>
        ${progressBar(result.xpForNextLevel ? result.xpIntoLevel / result.xpForNextLevel : 0)}
        <p class="dim" style="margin:0">${result.totalXp} XP acumulados en total</p>
      </div>

      ${result.newlyUnlockedAchievements.length > 0 ? `
        <div class="section">
          <h2 class="section__title">Logros desbloqueados</h2>
          <div class="list">${result.newlyUnlockedAchievements.map(achievementRow).join('')}</div>
        </div>` : ''}

      <div class="section" data-slot="feedback"></div>

      <div class="btn-row">
        <button class="btn btn--outline" type="button" data-action="retry">
          ${icon('refresh', { size: 18 })} Reintentar
        </button>
        <button class="btn btn--primary" type="button" data-go="train">Continuar</button>
      </div>

      <button class="btn btn--outline" type="button" data-action="share">
        ${icon('share', { size: 18 })} Compartir resultado
      </button>
    </div>`;

  /* ---------- AI feedback ---------- */

  const feedbackHost = root.querySelector('[data-slot="feedback"]');

  function feedbackIdle() {
    if (!isFeedbackEnabled()) {
      feedbackHost.innerHTML = '';
      return;
    }
    if (recordings.length === 0) {
      feedbackHost.innerHTML = `
        <h2 class="section__title">Análisis con IA</h2>
        <div class="card">
          <p class="muted" style="margin:0">
            No se grabó audio en esta sesión, así que no hay nada que analizar.
            Activa el micrófono al empezar la ronda para recibir feedback.
          </p>
        </div>`;
      return;
    }
    feedbackHost.innerHTML = `
      <h2 class="section__title">Análisis con IA</h2>
      <div class="card stack">
        <p class="muted" style="margin:0">
          Transcribimos tu ronda y la puntuamos sobre las dimensiones de FMS:
          rima, flow, técnica, puesta en escena y respuestas.
        </p>
        <button class="btn btn--primary" type="button" data-action="analyze">
          ${icon('waveform', { size: 18 })} Analizar mi ronda
        </button>
      </div>`;
    feedbackHost.querySelector('[data-action="analyze"]').addEventListener('click', runAnalysis);
  }

  function feedbackLoading() {
    feedbackHost.innerHTML = `
      <h2 class="section__title">Análisis con IA</h2>
      <div class="card row" style="gap:14px">
        <span class="spinner"></span>
        <span class="muted">Transcribiendo y evaluando tu ronda…</span>
      </div>`;
  }

  function feedbackError(message, canRetry) {
    feedbackHost.innerHTML = `
      <h2 class="section__title">Análisis con IA</h2>
      <div class="card stack">
        <p class="muted" style="margin:0">${esc(message)}</p>
        ${canRetry
          ? `<button class="btn btn--outline" type="button" data-action="analyze">Reintentar</button>`
          : ''}
      </div>`;
    feedbackHost.querySelector('[data-action="analyze"]')?.addEventListener('click', runAnalysis);
  }

  function feedbackResult(data) {
    feedbackHost.innerHTML = `
      <h2 class="section__title">Análisis con IA</h2>
      <div class="card feedback-card">
        <div class="feedback-score">
          <b class="display">${data.total.toFixed(1)}</b>
          <span class="muted">/ 10 · puntuación media</span>
        </div>

        ${FEEDBACK_DIMENSIONS.map(({ key, label }) => `
          <div class="feedback-dim">
            <div class="feedback-dim__head">
              <span style="font-weight:600">${esc(label)}</span>
              <span class="muted">${data.scores[key].toFixed(1)}</span>
            </div>
            ${progressBar(data.scores[key] / 10, { thin: true })}
          </div>`).join('')}

        <div class="row" style="gap:20px;flex-wrap:wrap">
          <span><span class="dim" style="display:block">Palabras</span><b>${data.wordCount}</b></span>
          <span><span class="dim" style="display:block">Palabras/min</span><b>${Math.round(data.wordsPerMinute)}</b></span>
        </div>

        ${data.strengths.length ? `
          <div class="stack" style="gap:6px">
            <p class="eyebrow" style="margin:0">Lo que funcionó</p>
            <ul class="muted" style="margin:0;padding-left:18px">
              ${data.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${data.improvements.length ? `
          <div class="stack" style="gap:6px">
            <p class="eyebrow" style="margin:0">A trabajar</p>
            <ul class="muted" style="margin:0;padding-left:18px">
              ${data.improvements.map((s) => `<li>${esc(s)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${data.transcript ? `
          <div class="stack" style="gap:6px">
            <p class="eyebrow" style="margin:0">Transcripción</p>
            <div class="transcript">${esc(data.transcript)}</div>
          </div>` : ''}
      </div>`;
  }

  async function runAnalysis() {
    feedbackLoading();
    try {
      const data = await analyzeRound(recordings[0], {
        modeName: record.modeName,
        difficultyLabel: record.difficultyLabel,
        rhymeKey: record.rhymeKeys[0] || '',
        stimulusWords: [],
        durationSeconds: record.practiceSeconds,
      });
      feedbackResult(data);
    } catch (err) {
      const isKnown = err instanceof FeedbackUnavailable;
      const retryable = !isKnown || !['disabled', 'no-audio', 'too-large'].includes(err.reason);
      feedbackError(
        isKnown ? err.message : 'No se pudo analizar la ronda.',
        retryable
      );
    }
  }

  if (canAnalyze || isFeedbackEnabled()) feedbackIdle();

  /* ---------- actions ---------- */

  root.querySelectorAll('[data-go]').forEach((el) =>
    el.addEventListener('click', () => navigate(el.dataset.go)));

  root.querySelector('[data-action="retry"]').addEventListener('click', () =>
    navigate(`sessionSetup?presetId=${encodeURIComponent(record.modeId)}`));

  root.querySelector('[data-action="share"]').addEventListener('click', async () => {
    const text = `Acabo de completar una sesión de ${record.modeName} en Freestyle Academy: `
      + `+${record.xpEarned} XP en ${record.roundsCompleted} ronda(s).`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Freestyle Academy', text });
        return;
      } catch { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Resultado copiado al portapapeles');
    } catch {
      toast('No se pudo compartir en este navegador');
    }
  });
}
