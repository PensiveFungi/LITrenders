/* home.js — port of ui/screens/HomeScreen.kt (route: train) */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { TRAINING_MODES, modeById, styleForModeId } from '../data/modes.js';
import {
  icon, esc, modeHero, modeRow, sectionHead, applyModeTheme,
} from '../ui/components.js';

export function renderHome(root) {
  applyModeTheme('con_estimulos');

  const featured = modeById('tematicas') || TRAINING_MODES[0];
  const featuredStyle = styleForModeId(featured.id);
  const progress = store.progress;

  root.innerHTML = `
    <div class="home-head">
      <div class="grow">
        <h1 class="display">¡Qué onda, ${esc(store.alias === 'Freestyler' ? 'MC' : store.alias)}!</h1>
        <p>¿Listo para soltar barras?</p>
      </div>
      <button class="iconbtn iconbtn--bordered" type="button" data-action="notifications"
              aria-label="Abrir notificaciones">${icon('bell')}</button>
    </div>

    <span class="pill">${icon('flame', { size: 16 })} Racha ${progress.practiceStreakDays} días</span>

    <div class="section">
      <p class="eyebrow">Modo recomendado</p>
      ${modeHero(featuredStyle, { asButton: true, modeId: featured.id })}
      <button class="btn btn--primary" type="button" data-mode="${esc(featured.id)}">
        Jugar ahora ${icon('arrow', { size: 18 })}
      </button>
    </div>

    <div class="section">
      ${sectionHead('Modos de entrenamiento')}
      <div class="list">
        ${TRAINING_MODES.map(modeRow).join('')}
      </div>
    </div>

    <div class="section">
      ${sectionHead('Tus herramientas')}
      <div class="tool-grid">
        <button class="tool-card" type="button" data-go="library">
          ${icon('library')}
          <span class="tool-card__title">Librería</span>
          <span class="dim">Explora tus rimas</span>
        </button>
        <button class="tool-card" type="button" data-go="history">
          ${icon('history')}
          <span class="tool-card__title">Historial</span>
          <span class="dim">Revisa tus cambios</span>
        </button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      navigate(`sessionSetup?presetId=${encodeURIComponent(el.dataset.mode)}`);
    });
  });

  root.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => navigate(el.dataset.go));
  });

  root.querySelector('[data-action="notifications"]')?.addEventListener('click', async () => {
    const { toast } = await import('../ui/components.js');
    toast('No tienes notificaciones nuevas');
  });

  // Keep the streak pill and greeting fresh if progress changes while mounted.
  const offProgress = store.on('progress', () => {
    const pill = root.querySelector('.pill');
    if (pill) {
      pill.innerHTML = `${icon('flame', { size: 16 })} Racha ${store.progress.practiceStreakDays} días`;
    }
  });

  return () => offProgress();
}
