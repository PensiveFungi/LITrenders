/* =========================================================================
   progress.js — port of ui/screens/ProgressScreen.kt (the "Progreso" tab)

   Level, racha, the last seven days, how the practice time splits by cadence,
   and every logro with its state.

   Everything XP-shaped stays at zero where XP does not accrue — a Gratis
   account still banks its sessions and its racha, so those are real numbers,
   but the XP line, the weekly graph and Habilidades are flat, and the header
   says why instead of showing a zero without explanation.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatPracticeTime } from '../core/domain.js';
import { PlanEntitlements, planDisplayName } from '../core/plans.js';
import {
  esc, icon, sectionHead, progressBar, statTile, weekGraph, achievementRow,
  upsell, resetAccent,
} from '../ui/components.js';

export function renderProgress(root) {
  resetAccent();

  function headerCard() {
    const p = store.progress;

    if (!store.isAccount) {
      return `
        <div class="level-card">
          <p class="eyebrow">TU PROGRESO</p>
          <p class="level-card__level">Invitado</p>
          <p class="muted" style="margin:0">
            Nada de lo que juegas como invitado se guarda. Crea una cuenta y
            empieza a acumular sesiones, racha y logros.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="login">
            Crear cuenta o iniciar sesión
          </button>
        </div>`;
    }

    if (!store.accruesXp) {
      return `
        <div class="level-card">
          <p class="eyebrow">TU PROGRESO</p>
          <p class="level-card__level">Plan ${esc(planDisplayName(store.planTier))}</p>
          <p class="muted" style="margin:0">
            Tus sesiones, tu racha y tus logros del plan Gratis se guardan. El XP,
            los niveles y la evaluación con IA llegan con Plus.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="plans">
            Ver planes
          </button>
        </div>`;
    }

    return `
      <div class="level-card">
        <div class="row row--between" style="align-items:flex-end">
          <span>
            <span class="eyebrow">NIVEL ACTUAL</span>
            <span class="level-card__level">Nivel ${p.currentLevel}</span>
          </span>
          <span class="level-card__xp">${p.currentXp} / ${p.nextLevelXp} XP</span>
        </div>
        ${progressBar(p.xpProgress)}
        <p class="dim" style="margin:0">
          ${p.nextLevelXp - p.currentXp} XP para el nivel ${p.currentLevel + 1}
          · ${p.totalXp} XP en total
        </p>
      </div>`;
  }

  function view() {
    const p = store.progress;
    const showsXp = store.accruesXp;
    const graphMax = Math.max(...p.weeklyPerformance.map((w) => w.score), 0);

    return `
      <div class="home-head">
        <div class="grow">
          <h1>Progreso</h1>
          <p>Tu recorrido en la academia</p>
        </div>
      </div>

      ${headerCard()}

      <div class="stat-grid stat-grid--3">
        ${statTile('Racha', `${p.practiceStreakDays}`, 'flame', 'var(--gold)')}
        ${statTile('Sesiones', `${p.totalSessions}`, 'mic')}
        ${statTile('Práctica', formatPracticeTime(p.totalPracticeMinutes), 'clock')}
      </div>

      <div class="section">
        ${sectionHead('Últimos 7 días', `<span class="dim">${showsXp ? `${graphMax} XP máx.` : 'Sin XP'}</span>`)}
        <div class="card">
          ${weekGraph(
            [{ label: 'XP por día', color: 'var(--accent-bright)', points: p.weeklyPerformance.map((w) => w.score) }],
            { labels: p.weeklyPerformance.map((w) => w.day) }
          )}
          ${!showsXp ? `<p class="dim center" style="margin:10px 0 0">
            La gráfica se llena con el XP que otorga la evaluación con IA.</p>` : ''}
        </div>
      </div>

      <div class="section">
        ${sectionHead('Habilidades', '<span class="dim">Por cadencia</span>')}
        <div class="card stack">
          ${p.skillCategories.map((c) => `
            <div class="stack" style="gap:6px">
              <div class="row row--between">
                <span class="muted">${esc(c.name)}</span>
                <span style="font-weight:700">${Math.round(c.progress * 100)}%</span>
              </div>
              ${progressBar(c.progress, { thin: true })}
            </div>`).join('')}
          <p class="dim" style="margin:0">
            El reparto de tu tiempo de práctica entre rondas Fácil, Medio y Difícil.
          </p>
        </div>
      </div>

      <div class="section">
        ${sectionHead('Logros',
          `<span class="dim">${p.allAchievements.filter((a) => a.unlocked).length} / ${p.allAchievements.length}</span>`)}
        <div class="list">
          ${p.allAchievements.map(achievementRow).join('')}
        </div>
        ${!PlanEntitlements.hasXpProgression(store.planTier) && store.isAccount
          ? upsell('Más logros con Plus',
                   'En el plan Gratis puedes desbloquear los tres primeros. El resto llegan con Plus.')
          : ''}
      </div>

      <div class="section">
        ${sectionHead('Sesiones recientes')}
        ${p.sessionHistory.length === 0
          ? `<p class="dim" style="margin:0">Todavía no hay sesiones guardadas.</p>`
          : `<div class="list">${[...p.sessionHistory].reverse().slice(0, 5).map((r) => `
              <div class="row-card" style="cursor:default">
                <span class="row-card__icon">${icon('mic', { size: 22 })}</span>
                <span class="grow">
                  <span class="row-card__title" style="display:block">${esc(r.modeName)}</span>
                  <span class="row-card__sub" style="display:block">
                    ${r.roundsCompleted} ronda${r.roundsCompleted === 1 ? '' : 's'} · ${esc(r.difficultyLabel)}
                  </span>
                </span>
                <span style="font-weight:700;color:var(--accent-bright)">
                  ${r.xpEarned > 0 ? `+${r.xpEarned}` : '—'}
                </span>
              </div>`).join('')}</div>
             <button class="btn btn--ghost btn--compact" type="button" data-go="sessionHistory">
               Ver historial completo
             </button>`}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));
  }

  paint();
  const off = [
    store.on('progress', paint),
    store.on('scope', paint),
    store.on('plan', paint),
  ];
  return () => off.forEach((f) => f());
}
