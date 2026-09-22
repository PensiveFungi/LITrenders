/* =========================================================================
   app.js — entry point. Mirrors MainActivity.kt: theme, nav graph, bottom nav.
   ========================================================================= */

import { store } from './core/store.js';
import { register, setNotFound, start, navigate, render, getCurrentRoute, TOP_LEVEL_ROUTES }
  from './core/router.js';
import { initFirebase } from './core/firebase.js';
import { icon, resetModeTheme } from './ui/components.js';

import { renderHome } from './screens/home.js';
import { renderBattles } from './screens/battles.js';
import { renderProgress } from './screens/progress.js';
import { renderProfile } from './screens/profile.js';
import { renderSetup } from './screens/setup.js';
import { renderSession } from './screens/session.js';
import { renderResults } from './screens/results.js';
import { renderLibrary, renderRhymeDetail } from './screens/library.js';
import { renderHistory } from './screens/history.js';
import { renderSettings } from './screens/settings.js';

const TABS = [
  { route: 'train', label: 'Entrenar', icon: 'dumbbell' },
  { route: 'battles', label: 'Batallas', icon: 'trophy' },
  { route: 'progress', label: 'Progreso', icon: 'chart' },
  { route: 'profile', label: 'Perfil', icon: 'person' },
];

const app = document.getElementById('app');
const view = document.createElement('main');
view.id = 'view';
app.appendChild(view);

/* ---------- Bottom navigation ---------- */

const nav = document.createElement('nav');
nav.className = 'bottom-nav';
nav.setAttribute('aria-label', 'Navegación principal');
nav.innerHTML = TABS.map((t) => `
  <button class="bottom-nav__item" type="button" data-route="${t.route}">
    ${icon(t.icon, { size: 22 })}<span>${t.label}</span>
  </button>`).join('');
app.appendChild(nav);

nav.querySelectorAll('[data-route]').forEach((btn) =>
  btn.addEventListener('click', () => navigate(btn.dataset.route)));

function syncNav() {
  const route = getCurrentRoute();
  const isTopLevel = TOP_LEVEL_ROUTES.includes(route);
  nav.hidden = !isTopLevel;
  nav.style.display = isTopLevel ? 'flex' : 'none';
  nav.querySelectorAll('[data-route]').forEach((btn) => {
    if (btn.dataset.route === route) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
}

/* ---------- Backdrop ---------- */

const backdrop = document.createElement('div');
backdrop.className = 'backdrop';
document.body.insertBefore(backdrop, document.body.firstChild);

/* ---------- Route registration ----------
   Tab screens render directly into a .screen wrapper; stacked screens build
   their own wrapper via appScaffold(), matching AppScaffold.kt. */

function tab(renderFn) {
  return (ctx) => {
    view.innerHTML = '<div class="screen" data-screen></div>';
    const cleanup = renderFn(view.querySelector('[data-screen]'), ctx);
    syncNav();
    return cleanup;
  };
}

function stacked(renderFn) {
  return (ctx) => {
    view.innerHTML = '';
    const cleanup = renderFn(view, ctx);
    syncNav();
    return cleanup;
  };
}

register('train', tab(renderHome));
register('battles', tab(renderBattles));
register('progress', tab(renderProgress));
register('profile', tab(renderProfile));

register('sessionSetup', stacked(renderSetup));
register('session', stacked(renderSession));
register('results', stacked(renderResults));
register('library', stacked(renderLibrary));
register('rhyme/{key}', stacked(renderRhymeDetail));
register('history', stacked(renderHistory));
register('settings', stacked(renderSettings));

setNotFound(() => {
  resetModeTheme();
  view.innerHTML = `
    <div class="screen" style="justify-content:center;align-items:center;text-align:center">
      <h1 class="display" style="font-size:28px">Página no encontrada</h1>
      <p class="muted">Esa ruta no existe en Freestyle Academy.</p>
      <button class="btn btn--primary" type="button" data-go style="max-width:240px">Volver al inicio</button>
    </div>`;
  view.querySelector('[data-go]').addEventListener('click', () => navigate('train'));
  syncNav();
});

/* ---------- Boot ---------- */

document.documentElement.dataset.theme = store.darkMode ? 'dark' : 'light';

// Leaving an active session by navigating away must not leave the ticker running.
window.addEventListener('hashchange', () => {
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (route !== 'session' && store.session) store.endSession();
});

start();
syncNav();

// Firebase is optional: the app is fully usable before this resolves, and
// stays usable if it never does.
initFirebase().then((ready) => {
  if (ready) render();
});

// Warn before closing the tab mid-session, so a round isn't lost by accident.
window.addEventListener('beforeunload', (e) => {
  if (store.session) {
    e.preventDefault();
    e.returnValue = '';
  }
});
