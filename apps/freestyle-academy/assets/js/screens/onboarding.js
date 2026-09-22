/* =========================================================================
   onboarding.js — port of ui/screens/OnboardingScreen.kt

   The first-launch tour. It collects nothing: it ends at Login, where the
   account (and with it the AKA) is settled. Someone already signed in — a new
   sign-up that just onboarded, or an account that erased its data — lands
   straight in the app instead.

   Finishing it ("Comenzar" or "Saltar") records the flag, so it is never
   shown again unless it is opened deliberately from Ajustes.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { esc, icon, resetAccent } from '../ui/components.js';

const SLIDES = [
  {
    icon: 'mic',
    title: 'Entrena tu mente.\nDomina las palabras.',
    body: 'Rondas de un minuto con palabras, temáticas, imágenes y objetos. El '
      + 'reloj cuenta hacia arriba y la ronda termina cuando tú lo decides.',
  },
  {
    icon: 'sparkles',
    title: 'La IA escucha lo que rapeaste',
    body: 'Al terminar, tu grabación se transcribe y se evalúa: flow, densidad '
      + 'de rima y si aprovechaste los estímulos. De ahí sale tu XP, y de '
      + 'ningún otro lado.',
  },
  {
    icon: 'library',
    title: 'Tu librería de rimas',
    body: 'Miles de palabras agrupadas por terminación, y las tuyas encima: '
      + 'añade, renombra y quita lo que quieras sin tocar la de nadie más.',
  },
  {
    icon: 'trophy',
    title: 'La Freestyle League',
    body: 'Tu XP te coloca en la tabla global. Batalla en este dispositivo con '
      + 'Master Serie y Gallos, y compara tu nivel con el de toda la liga.',
  },
];

export function renderOnboarding(root) {
  resetAccent();

  let index = 0;

  function finish() {
    store.completeOnboarding();
    navigate(store.isAccount ? 'train' : 'login', { replace: true });
  }

  function view() {
    const slide = SLIDES[index];
    const last = index === SLIDES.length - 1;
    return `
      <div class="screen screen--onboarding">
        <div class="row row--between">
          <span class="brand-mark">${icon('mic', { size: 22 })}</span>
          <button class="btn btn--ghost btn--compact" type="button" data-action="skip">Saltar</button>
        </div>

        <div class="onboard">
          <span class="onboard__art">${icon(slide.icon, { size: 44 })}</span>
          <h1 class="onboard__title">${esc(slide.title).replace(/\n/g, '<br>')}</h1>
          <p class="onboard__body">${esc(slide.body)}</p>
        </div>

        <div class="dots" role="tablist" aria-label="Paso ${index + 1} de ${SLIDES.length}">
          ${SLIDES.map((_, i) => `<span data-on="${i === index}"></span>`).join('')}
        </div>

        <div class="btn-row">
          ${index > 0
            ? '<button class="btn btn--outline" type="button" data-action="prev">ATRÁS</button>'
            : ''}
          <button class="btn btn--primary" type="button" data-action="next">
            ${last ? 'COMENZAR' : 'SIGUIENTE'}
          </button>
        </div>
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    root.querySelector('[data-action="skip"]').addEventListener('click', finish);
    root.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      index -= 1; paint();
    });
    root.querySelector('[data-action="next"]').addEventListener('click', () => {
      if (index === SLIDES.length - 1) { finish(); return; }
      index += 1; paint();
    });
  }

  paint();
  return () => {};
}
