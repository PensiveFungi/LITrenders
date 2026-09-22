/* battles.js — port of ui/screens/BattlesScreen.kt (route: battles)

   The Android screen honestly labels multiplayer as not yet built rather than
   faking data; this port keeps that promise exactly. */

import { navigate } from '../core/router.js';
import { emptyState, sectionHead, applyModeTheme, esc, icon } from '../ui/components.js';
import { styleForModeId } from '../data/modes.js';

const BATTLE_TRAINING = [
  {
    id: 'red_bull',
    title: 'Red Bull',
    subtitle: 'Practica entradas directas, punchlines y respuestas de alto impacto.',
  },
  {
    id: 'fms',
    title: 'FMS',
    subtitle: 'Refuerza estructuras, métricas largas y coherencia por rounds.',
  },
];

export function renderBattles(root) {
  applyModeTheme('god_level');

  root.innerHTML = `
    <div class="battle-hero">
      <h2 class="display">BATALLAS</h2>
      <p>Tu arena competitiva está en camino.</p>
    </div>

    ${emptyState(
      'Las batallas están calentando motores',
      'Pronto podrás crear duelos, simular rondas y medir tu respuesta bajo presión. Mientras tanto, entrena con formatos de batalla para llegar con flow.'
    )}

    <div class="section">
      ${sectionHead('Entrena como en una batalla')}
      <div class="list">
        ${BATTLE_TRAINING.map((b) => {
          const style = styleForModeId(b.id);
          return `
            <button class="mode-row" type="button" data-mode="${esc(b.id)}"
                    aria-label="Entrenar en modo ${esc(b.title)}">
              <span class="mode-row__icon" style="background:linear-gradient(135deg, ${style.palette.primary}, ${style.palette.highlight})">
                ${icon(style.icon, { size: 22 })}
              </span>
              <span class="mode-row__body">
                <span class="mode-row__title" style="display:block">${esc(b.title)}</span>
                <span class="mode-row__sub" style="display:block">${esc(b.subtitle)}</span>
              </span>
              <span class="mode-row__arrow">${icon('arrow', { size: 20 })}</span>
            </button>`;
        }).join('')}
      </div>
    </div>

    <button class="btn btn--primary" type="button" data-go="sessionSetup">
      Configurar entrenamiento
    </button>
  `;

  root.querySelectorAll('[data-mode]').forEach((el) => {
    el.addEventListener('click', () =>
      navigate(`sessionSetup?presetId=${encodeURIComponent(el.dataset.mode)}`));
  });
  root.querySelector('[data-go]')?.addEventListener('click', () => navigate('sessionSetup'));
}
