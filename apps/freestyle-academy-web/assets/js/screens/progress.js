/* progress.js — port of ui/screens/ProgressScreen.kt (route: progress) */

import { store } from '../core/store.js';
import { formatPracticeTime } from '../core/domain.js';
import {
  esc, icon, progressBar, statTile, weeklyChart, applyModeTheme, emptyState,
} from '../ui/components.js';

function card(title, bodyHtml) {
  return `<div class="card stack">
    <h2 style="font-size:18px;font-weight:700">${esc(title)}</h2>
    ${bodyHtml}
  </div>`;
}

function view(p) {
  return `
    <div class="card" style="background:linear-gradient(135deg, var(--mode-primary), var(--mode-highlight));border:none">
      <p style="font-size:14px;font-weight:600;color:rgba(255,255,255,.78);margin:0">Nivel actual</p>
      <p class="display" style="font-size:40px;color:#fff;margin:4px 0">Nivel ${p.currentLevel}</p>
      <p style="font-size:15px;line-height:1.4;color:rgba(255,255,255,.86);margin:0">
        Sigue acumulando XP para desbloquear retos avanzados.
      </p>
    </div>

    ${card('Progreso de XP', `
      <div class="row row--between">
        <span style="font-weight:700">${p.currentXp} XP</span>
        <span class="muted">${p.nextLevelXp} XP</span>
      </div>
      ${progressBar(p.xpProgress)}
    `)}

    <div class="stat-grid">
      ${statTile('Racha', `${p.practiceStreakDays} días`, 'flame', 'var(--fa-gold)')}
      ${statTile('Sesiones', String(p.totalSessions), 'swords', 'var(--mode-secondary)')}
      ${statTile('Tiempo', formatPracticeTime(p.totalPracticeMinutes), 'clock', 'var(--fa-purple-soft)')}
      ${statTile('Nivel', String(p.currentLevel), 'trophy', 'var(--fa-gold)')}
    </div>

    ${card('Rendimiento semanal', weeklyChart(p.weeklyPerformance))}

    ${card('Logros recientes', p.recentAchievements.length
      ? `<ul style="margin:0;padding-left:18px" class="muted">${p.recentAchievements
          .map((a) => `<li>${esc(a.title)}: ${esc(a.description)}</li>`).join('')}</ul>`
      : '<p class="muted" style="margin:0">Todavía no has desbloqueado logros. Completa una sesión para empezar.</p>')}

    ${card('Habilidades', `
      <p class="dim" style="margin:0">Reparto de tu tiempo de práctica por dificultad.</p>
      ${p.skillCategories.map((s) => `
        <div class="stack" style="gap:6px">
          <div class="row row--between">
            <span style="font-weight:600">${esc(s.name)}</span>
            <span class="muted">${Math.round(s.progress * 100)}%</span>
          </div>
          ${progressBar(s.progress, { thin: true })}
        </div>`).join('')}
    `)}

    ${p.sessionHistory.length === 0
      ? emptyState('Sin sesiones todavía', 'Cuando completes tu primera sesión verás aquí tu progreso real.')
      : ''}
  `;
}

export function renderProgress(root) {
  applyModeTheme('incremental');
  root.innerHTML = view(store.progress);

  const off = store.on('progress', (p) => { root.innerHTML = view(p); });
  return () => off();
}
