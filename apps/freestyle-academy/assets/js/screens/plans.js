/* =========================================================================
   plans.js — port of ui/screens/PlansScreen.kt, PlusWelcomeScreen.kt and
   ProfessionalWelcomeScreen.kt

   What each tier includes is not written out here — it is read from
   PlanEntitlements, the same object every gate in the app consults, so this
   screen cannot promise something a gate would refuse.

   There is no payment processing behind "Suscribirse", in the app or here: it
   sets the entitlement state, which is the testing hook the app ships with.
   The prices are left out rather than invented; they belong to whatever
   checkout ends up in front of this screen.

   A plan is account-only, so a guest tapping Suscribirse lands on Login with
   this screen still underneath — Back returns here, still as a guest.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { PlanTier, PlanEntitlements, planDisplayName } from '../core/plans.js';
import {
  esc, icon, appScaffold, wireBack, resetAccent, toast,
} from '../ui/components.js';

/** Every line is a live read of the entitlement rules for that tier. */
function featuresFor(tier) {
  const E = PlanEntitlements;
  return [
    ['XP, niveles y evaluación con IA', E.hasXpProgression(tier)],
    ['Grabación de tus sesiones', E.canRecordSessions(tier)],
    ['Librería de rimas e historial', E.hasLibraryAndHistory(tier)],
    ['Todos los logros', tier !== PlanTier.FREE],
    ['Todos los avatares', tier !== PlanTier.FREE],
    ['Sin publicidad', E.removesAds(tier)],
    ['Créditos de batalla ilimitados', E.hasUnlimitedCredits(tier)],
    ['Studio: escuchar tus creaciones', E.canBrowseStudio(tier)],
    ['Studio: crear temas e instrumentales', E.canAccessStudio(tier)],
    ['Transcripción de tus grabaciones', E.hasTranscripts(tier)],
  ];
}

const TAGLINE = {
  [PlanTier.FREE]: 'Entrena sin límite. Tu racha, tus sesiones y tus primeros logros se guardan.',
  [PlanTier.PLUS]: 'La academia completa: la IA evalúa cada sesión y tu progreso empieza a contar.',
  [PlanTier.PROFESSIONAL]: 'Todo lo de Plus, más el Studio y la transcripción de lo que rapeaste.',
};

export function renderPlans(root) {
  resetAccent();

  function planCard(tier) {
    const current = store.planTier === tier;
    const features = featuresFor(tier);
    return `
      <div class="plan-card" data-featured="${tier === PlanTier.PLUS}" data-current="${current}">
        <div class="row row--between">
          <span class="plan-card__name">${esc(planDisplayName(tier))}</span>
          ${current ? '<span class="pill pill--gold">Tu plan</span>' : ''}
        </div>
        <p class="muted" style="margin:0">${esc(TAGLINE[tier])}</p>
        <ul class="plan-features">
          ${features.map(([label, on]) => `
            <li data-on="${on}">
              ${icon(on ? 'check' : 'close', { size: 16 })}
              <span>${esc(label)}</span>
            </li>`).join('')}
        </ul>
        ${current
          ? '<button class="btn btn--outline btn--compact" type="button" disabled>Plan actual</button>'
          : (tier === PlanTier.FREE
              ? `<button class="btn btn--ghost btn--compact" type="button" data-pick="${tier}">
                   Volver a Gratis</button>`
              : `<button class="btn btn--primary btn--compact" type="button" data-pick="${tier}">
                   Suscribirse a ${esc(planDisplayName(tier))}</button>`)}
      </div>`;
  }

  function paint() {
    root.innerHTML = `
      <div class="screen">
        ${appScaffold('Planes', `
          <p class="muted" style="margin:0">
            Estás en ${esc(planDisplayName(store.planTier))}.
            ${store.isAccount ? '' : 'Los planes son para cuentas: entra con la tuya para activarlos.'}
          </p>

          <div class="plan-list">
            ${planCard(PlanTier.FREE)}
            ${planCard(PlanTier.PLUS)}
            ${planCard(PlanTier.PROFESSIONAL)}
          </div>

          <p class="dim" style="margin:0">
            El XP no depende del plan por capricho: lo otorga la evaluación con
            IA de tu grabación, y grabar y evaluar es lo que Plus incluye.
          </p>
        `)}
      </div>`;

    wireBack(root, 'profile');

    root.querySelectorAll('[data-pick]').forEach((el) =>
      el.addEventListener('click', () => {
        const tier = el.dataset.pick;
        if (!store.isAccount) { navigate('login'); return; }
        store.setPlanTier(tier);
        if (tier === PlanTier.PLUS) { navigate('plusWelcome'); return; }
        if (tier === PlanTier.PROFESSIONAL) { navigate('professionalWelcome'); return; }
        toast('Vuelves al plan Gratis');
        paint();
      }));
  }

  paint();
  const off = [store.on('plan', paint), store.on('scope', paint)];
  return () => off.forEach((f) => f());
}

/* ========================= Post-subscribe tours ========================= */

function welcomeScreen(root, { title, lead, perks, accentIcon }) {
  resetAccent();
  root.innerHTML = `
    <div class="screen" style="justify-content:center">
      <div class="stack" style="gap:18px;align-items:center;text-align:center">
        <span class="achv__badge" style="width:74px;height:74px">${icon(accentIcon, { size: 34 })}</span>
        <h1 style="font-size:28px;margin:0">${esc(title)}</h1>
        <p class="muted" style="margin:0">${esc(lead)}</p>
      </div>

      <div class="list">
        ${perks.map((p) => `
          <div class="row-card" style="cursor:default">
            <span class="row-card__icon">${icon(p.icon, { size: 22 })}</span>
            <span class="grow">
              <span class="row-card__title" style="display:block">${esc(p.title)}</span>
              <span class="row-card__sub" style="display:block">${esc(p.body)}</span>
            </span>
          </div>`).join('')}
      </div>

      <div class="btn-row">
        <button class="btn btn--ghost" type="button" data-action="finish">SALTAR</button>
        <button class="btn btn--primary" type="button" data-action="finish">CONTINUAR</button>
      </div>
    </div>`;

  root.querySelectorAll('[data-action="finish"]').forEach((el) =>
    el.addEventListener('click', () => navigate('train', { replace: true })));

  return () => {};
}

export function renderPlusWelcome(root) {
  return welcomeScreen(root, {
    title: 'Bienvenido a Plus',
    lead: 'Desde ahora cada sesión se graba, se evalúa y suma.',
    accentIcon: 'spark',
    perks: [
      { icon: 'mic', title: 'Tus sesiones se graban', body: 'Y puedes volver a escucharlas desde tu historial.' },
      { icon: 'sparkles', title: 'La IA te evalúa', body: 'Flow, densidad de rima y el XP que te ganaste.' },
      { icon: 'library', title: 'Tu librería es tuya', body: 'Añade, renombra y quita palabras de cada grupo.' },
      { icon: 'medal', title: 'Todos los logros', body: 'Los diez, no solo los tres del plan Gratis.' },
    ],
  });
}

export function renderProfessionalWelcome(root) {
  return welcomeScreen(root, {
    title: 'Bienvenido a Pro',
    lead: 'Todo lo de Plus, y el Studio abierto.',
    accentIcon: 'crown',
    perks: [
      { icon: 'music', title: 'Studio', body: 'Convierte tus sesiones en temas e instrumentales.' },
      { icon: 'text', title: 'Transcripción', body: 'Lee exactamente lo que rapeaste en cada turno.' },
      { icon: 'sparkles', title: 'Todo lo de Plus', body: 'Evaluación con IA, XP, librería e historial.' },
    ],
  });
}
