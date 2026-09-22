/* =========================================================================
   app.js — the nav graph, the bottom bar and the two gates.

   Port of MainActivity.kt's AppNavGraph + Scaffold.

   Route names are the app's, verbatim: they are saved-state keys and
   navigate() targets in a dozen places there, and keeping them identical is
   what lets a link, a bug report or a future deep link mean the same thing on
   both platforms — including "battles", whose tab is labelled "Liga".
   ========================================================================= */

import {
  register, setNotFound, setAfterRender, start, navigate, render,
  getCurrentRoute, TOP_LEVEL_ROUTES,
} from './core/router.js';
import { store } from './core/store.js';
import { initFirebase, auth } from './core/firebase.js';
import { PlanEntitlements } from './core/plans.js';
import { icon } from './ui/icons.js';
import { esc, emptyState } from './ui/components.js';
import { isConsentExempt } from './screens/legal.js';

import { renderHome } from './screens/home.js';
import { renderBattles } from './screens/battles.js';
import { renderProgress } from './screens/progress.js';
import { renderProfile, renderEditProfile } from './screens/profile.js';
import { renderStudio } from './screens/studio.js';
import { renderEntrenar } from './screens/entrenar.js';
import { renderPersonalizado } from './screens/personalizado.js';
import { renderBattleRoom } from './screens/battleroom.js';
import { renderResults } from './screens/results.js';
import { renderLibrary, renderRhymeDetail, renderHistory } from './screens/library.js';
import { renderSessionHistory, renderSessionRecording } from './screens/session-history.js';
import { renderPlans, renderPlusWelcome, renderProfessionalWelcome } from './screens/plans.js';
import { renderSettings, renderReportBug } from './screens/settings.js';
import { renderLogin } from './screens/login.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderMcProfile } from './screens/mc.js';
import { renderLegalDocument, renderLegalConsent } from './screens/legal.js';

/* ---------- the shell ---------- */

const app = document.getElementById('app');
app.innerHTML = `
  <main id="view" class="view" tabindex="-1"></main>
  <nav id="nav" class="bottom-nav" aria-label="Secciones"></nav>`;

const view = document.getElementById('view');
const nav = document.getElementById('nav');

/** The five bottom tabs, in MainActivity's order. Studio locks below Plus. */
function tabs() {
  return [
    { route: 'studio', label: 'Studio', icon: 'music',
      locked: !PlanEntitlements.canBrowseStudio(store.planTier) },
    // The route id stays "battles"; only the label is the section's name.
    { route: 'battles', label: 'Liga', icon: 'medal' },
    { route: 'train', label: 'Entrenar', icon: 'dumbbell' },
    { route: 'progress', label: 'Progreso', icon: 'chart' },
    { route: 'profile', label: 'Perfil', icon: 'person' },
  ];
}

function paintNav() {
  const route = getCurrentRoute() || 'train';
  const onTab = TOP_LEVEL_ROUTES.includes(route);
  nav.hidden = !onTab;
  document.body.dataset.tabbed = String(onTab);
  // A tab screen renders its sections straight into the view; a stacked one
  // brings its own `.screen` wrapper, so the view must not add a second.
  view.classList.toggle('view--tab', onTab);
  if (!onTab) { nav.innerHTML = ''; return; }

  nav.innerHTML = tabs().map((t) => `
    <button class="bottom-nav__item" type="button" data-route="${esc(t.route)}"
            aria-current="${t.route === route ? 'page' : 'false'}"
            data-locked="${Boolean(t.locked)}" aria-label="${esc(t.label)}">
      ${icon(t.icon, { size: 21 })}
      ${t.locked ? `<span class="bottom-nav__lock">${icon('lock', { size: 12 })}</span>` : ''}
      <span>${esc(t.label)}</span>
    </button>`).join('');

  nav.querySelectorAll('[data-route]').forEach((b) =>
    b.addEventListener('click', () => {
      // A locked tab stays tappable so the familiar upgrade path takes the
      // user to Planes, exactly as the app routes it.
      navigate(b.dataset.locked === 'true' ? 'plans' : b.dataset.route);
    }));
}

/* ---------- routes ---------- */

const screen = (fn) => (ctx) => fn(view, ctx);

register('onboarding', screen(renderOnboarding));
register('login', screen(renderLogin));

register('train', screen(renderHome));
register('battles', screen(renderBattles));
register('progress', screen(renderProgress));
register('profile', screen(renderProfile));
register('studio', screen(renderStudio));

register('mc/{uid}', screen(renderMcProfile));
register('battleRoom', screen(renderBattleRoom));
register('entrenar', screen(renderEntrenar));
register('personalizado', screen(renderPersonalizado));
register('results', screen(renderResults));

register('editProfile', screen(renderEditProfile));
register('library', screen(renderLibrary));
register('rhyme/{key}', screen(renderRhymeDetail));
register('history', screen(renderHistory));
register('sessionHistory', screen(renderSessionHistory));
register('sessionRecording/{recordingId}', screen(renderSessionRecording));

register('plans', screen(renderPlans));
register('plusWelcome', screen(renderPlusWelcome));
register('professionalWelcome', screen(renderProfessionalWelcome));

register('settings', screen(renderSettings));
register('reportBug', screen(renderReportBug));
register('legalConsent', screen(renderLegalConsent));
register('legal/{docId}', screen(renderLegalDocument));

setNotFound(() => {
  view.innerHTML = `<div class="screen" style="justify-content:center">
    ${emptyState('Esa pantalla no existe', 'Vuelve al entrenamiento y sigue desde ahí.')}
    <button class="btn btn--primary" type="button" id="nf">Ir a Entrenar</button>
  </div>`;
  document.getElementById('nf').addEventListener('click', () => navigate('train'));
});

/* ---------- the two gates ----------
   Onboarding until it is finished, then consent while it is outstanding.
   Login, the tour and the documents themselves are exempt: Login runs its own
   consent checkbox, and bouncing a reader off a document they were sent to
   read would make accepting impossible. */

let guarding = false;

function guard(route) {
  // A gate redirect re-enters render(), and so this function. One level is
  // all a redirect needs, and refusing the second stops any chance of a loop.
  if (guarding) return false;

  if (!store.onboardingCompleted && route !== 'onboarding' && route !== 'login'
      && !route.startsWith('legal/')) {
    guarding = true;
    try { navigate('onboarding', { replace: true }); } finally { guarding = false; }
    return true;
  }

  if (store.onboardingCompleted && !store.legalAccepted && !isConsentExempt(route)) {
    guarding = true;
    try { navigate('legalConsent', { replace: true }); } finally { guarding = false; }
    return true;
  }

  return false;
}

/* ---------- boot ---------- */

document.documentElement.dataset.theme = store.darkMode ? 'dark' : 'light';

store.on('plan', paintNav);
store.on('scope', paintNav);
store.on('theme', (dark) => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
});

// The shell runs after every render — including a replace-navigation, which
// changes the route without firing `hashchange`. Hanging this off the event
// instead would leave the bottom bar a route behind.
setAfterRender((route) => { if (!guard(route)) paintNav(); });
start();

// Firebase is optional: with no config the app runs as a guest on this
// browser, which is a supported state and not a degraded one.
initFirebase().then((ready) => {
  if (!ready) return;
  // The published master library is checked once per launch, for guests too.
  store.refreshMasterLibrary();
});

// A sign-in or sign-out swaps the partition under whatever is on screen, so
// the current route is re-rendered rather than left showing the old one.
auth.onChange(() => { paintNav(); render(); });
