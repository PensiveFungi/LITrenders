/* =========================================================================
   results.js — port of battles/offline/OfflineResultsScreen.kt (solo variant)

   The one config-driven end screen. Solo shows a practice summary; a battle
   shows a completion summary plus the AI verdict once it lands.

   XP is NOT a bonus panel here — it is the award itself, and the screen waits
   on the evaluation because that is the only thing that produces one.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatDurationSeconds } from '../core/domain.js';
import { ScoringState } from '../core/ai.js';
import { scoring, unavailableMessage } from '../core/scoring.js';
import {
  esc, icon, summaryRows, progressBar, achievementRow, emptyState, upsell,
  resetAccent, toast,
} from '../ui/components.js';

export function renderResults(root) {
  const result = store.lastResult;

  if (!result) {
    resetAccent();
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

  function xpBlock() {
    // Guest / Gratis: no XP at all, and the screen says which it is rather
    // than showing a zero.
    if (result.unbanked) {
      return `
        <p class="result-title">Sesión terminada</p>
        <div class="upsell">
          <p class="upsell__title">${icon('person', { size: 17 })} Nada guardado</p>
          <p class="muted" style="margin:0">
            Como invitado tu progreso no se guarda: ni sesiones, ni racha, ni logros.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="login">
            Crear cuenta
          </button>
        </div>`;
    }

    if (!store.accruesXp) {
      return `
        <p class="result-title">¡Sesión completada!</p>
        ${upsell('Sin XP en el plan Gratis',
          'Tu sesión, tu racha y tus logros del plan Gratis sí quedan guardados. El XP y la evaluación con IA son parte de Plus.')}`;
    }

    switch (scoring.state) {
      case ScoringState.RUNNING:
        return `
          <p class="result-title">¡Sesión completada!</p>
          <div class="card row" style="gap:14px">
            <span class="spinner"></span>
            <span class="muted">Evaluando tu sesión con IA…</span>
          </div>`;

      case ScoringState.READY: {
        const b = scoring.breakdown;
        const hasBonus = b.combinedMultiplier > 1.001;
        return `
          <p class="result-title">¡Sesión completada!</p>
          <p class="result-xp">+${result.record.xpEarned} XP</p>
          <div class="card stack">
            ${summaryRows([
              ['XP base (IA)', `${b.baseXp}`],
              ...(scoring.stimulusBonus > 0 ? [['Del cual, estímulos usados', `${scoring.stimulusBonus}`]] : []),
              ...(b.rachaMultiplier > 1 ? [['Multiplicador racha', `×${b.rachaMultiplier.toFixed(2)}`]] : []),
              ...(b.sessionMultiplier > 1 ? [['Multiplicador sesión larga', `×${b.sessionMultiplier.toFixed(2)}`]] : []),
              ...(b.battleMultiplier > 1 ? [['Multiplicador batalla', `×${b.battleMultiplier.toFixed(2)}`]] : []),
              ...(hasBonus ? [['Total aplicado', `×${b.combinedMultiplier.toFixed(2)}`]] : []),
            ])}
          </div>
          <div class="card stack">
            <h2 style="font-size:16px;font-weight:700">Cómo sonó</h2>
            <div class="stack" style="gap:6px">
              <div class="row row--between"><span class="muted">Flow</span>
                <span style="font-weight:700">${Math.round(scoring.flow * 100)}%</span></div>
              ${progressBar(scoring.flow, { thin: true })}
            </div>
            <div class="stack" style="gap:6px">
              <div class="row row--between"><span class="muted">Densidad de rima</span>
                <span style="font-weight:700">${Math.round(scoring.rhyme * 100)}%</span></div>
              ${progressBar(scoring.rhyme, { thin: true })}
            </div>
            ${scoring.assessments[0]?.rationale
              ? `<p class="muted" style="margin:0">${esc(scoring.assessments[0].rationale)}</p>` : ''}
          </div>`;
      }

      case ScoringState.UNAVAILABLE:
        return `
          <p class="result-title">Sesión guardada</p>
          <div class="card stack">
            <p class="muted" style="margin:0">${esc(unavailableMessage(scoring.reason))}</p>
            ${scoring.reason === 'plan'
              ? '<button class="btn btn--primary btn--compact" type="button" data-go="plans">Ver planes</button>'
              : ''}
          </div>`;

      default:
        return `<p class="result-title">¡Sesión completada!</p>`;
    }
  }

  function transcriptBlock() {
    if (scoring.transcripts.length === 0) return '';
    const hasText = scoring.transcripts.some((t) => t.text.trim());
    if (!hasText) return '';
    return `
      <div class="section">
        <h2 class="section__title">Transcripción</h2>
        ${scoring.transcripts.filter((t) => t.text.trim()).map((t) => `
          <div class="card stack" style="gap:8px">
            <p class="eyebrow" style="margin:0">${esc(t.roundLabel)}</p>
            <div class="transcript">${esc(t.text)}</div>
          </div>`).join('')}
      </div>`;
  }

  function view() {
    return `
      <div class="screen screen--flow">
        <div style="text-align:center;margin-top:8px">
          <span class="achv__badge" style="width:74px;height:74px;margin:0 auto">
            ${icon('crown', { size: 36 })}
          </span>
        </div>

        <div data-slot="xp">${xpBlock()}</div>

        ${result.streakAdvanced && result.streakDays > 0 ? `
          <span class="pill pill--gold" style="align-self:center">
            ${icon('flame', { size: 15 })} Racha de ${result.streakDays} día${result.streakDays === 1 ? '' : 's'}
          </span>` : ''}

        <div class="card stack">
          <h2 style="font-size:16px;font-weight:700">Resumen</h2>
          ${summaryRows([
            ['Modo', record.modeName],
            ['Cadencia', record.difficultyLabel],
            ['Rondas', `${record.roundsCompleted} / ${record.roundsPlanned}`],
            ['Tiempo en el micro', formatDurationSeconds(record.practiceSeconds)],
            ...(record.rhymeKeys.length ? [['Rimas', record.rhymeKeys.map((k) => `-${k}`).join(' · ')]] : []),
          ])}
        </div>

        ${!result.unbanked && store.accruesXp ? `
          <div class="card stack">
            <div class="row row--between" style="align-items:flex-end">
              <span>
                <span class="dim" style="display:block">Nivel</span>
                <span style="font-size:26px;font-weight:800">Nivel ${result.level}</span>
              </span>
              <span style="color:var(--accent-bright);font-weight:700">
                ${result.xpIntoLevel} / ${result.xpForNextLevel} XP
              </span>
            </div>
            ${progressBar(result.xpForNextLevel ? result.xpIntoLevel / result.xpForNextLevel : 0)}
          </div>` : ''}

        ${result.newlyUnlockedAchievements.length ? `
          <div class="section">
            <h2 class="section__title">Logros desbloqueados</h2>
            <div class="list">${result.newlyUnlockedAchievements.map(achievementRow).join('')}</div>
          </div>` : ''}

        <div data-slot="transcript">${transcriptBlock()}</div>

        <div class="btn-row">
          <button class="btn btn--outline" type="button" data-action="again">
            ${record.isBattle ? 'REVANCHA' : 'VOLVER A PRACTICAR'}
          </button>
          <button class="btn btn--primary" type="button" data-action="exit">SALIR</button>
        </div>

        <button class="btn btn--ghost btn--compact" type="button" data-action="share">
          ${icon('share', { size: 17 })} Compartir resultado
        </button>
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wire();
  }

  function wire() {
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelector('[data-action="again"]')?.addEventListener('click', () =>
      navigate(record.isBattle ? `battleRoom?presetId=${encodeURIComponent(record.modeId)}` : 'entrenar'));

    root.querySelector('[data-action="exit"]')?.addEventListener('click', () => navigate('train'));

    root.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
      const xp = record.xpEarned > 0 ? ` · +${record.xpEarned} XP` : '';
      const text = `Acabo de entrenar freestyle en Freestyle Academy: `
        + `${record.roundsCompleted} ronda(s) de ${record.modeName}${xp}.`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Freestyle Academy', text }); return; } catch { /* dismissed */ }
      }
      try {
        await navigator.clipboard.writeText(text);
        toast('Resultado copiado');
      } catch { toast('No se pudo compartir aquí'); }
    });
  }

  resetAccent();
  paint();

  // The evaluation lands after the screen is already up.
  const offScoring = scoring.on(() => {
    const xpHost = root.querySelector('[data-slot="xp"]');
    const trHost = root.querySelector('[data-slot="transcript"]');
    if (xpHost) xpHost.innerHTML = xpBlock();
    if (trHost) trHost.innerHTML = transcriptBlock();
    wire();
  });
  const offResult = store.on('result', paint);

  return () => { offScoring(); offResult(); };
}
