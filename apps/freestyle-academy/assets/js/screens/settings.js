/* =========================================================================
   settings.js — port of ui/screens/SettingsScreen.kt and ReportBugScreen.kt

   Cuenta, apariencia, datos, legal y ayuda.

   "Borrar todos los datos" resets this browser to a fresh install: the scoped
   partitions, the cached master library, the kept recordings and the
   onboarding flag all go, and the app returns to the intro tour. It clears
   THIS browser — an account's cloud documents are not touched, so signing
   back in restores what was synced, exactly as the app behaves.
   ========================================================================= */

import { store, LEGAL_VERSION } from '../core/store.js';
import { navigate } from '../core/router.js';
import { auth, signOut, submitBugReport } from '../core/firebase.js';
import { planDisplayName } from '../core/plans.js';
import { APP_VERSION, LEGAL_DOCUMENTS, isFirebaseConfigured } from '../core/config.js';
import { eraseRecordings } from '../core/recordings.js';
import { formatDateTime } from '../core/domain.js';
import {
  esc, icon, appScaffold, wireBack, sectionHead, resetAccent,
  confirmDialog, toast,
} from '../ui/components.js';

export function renderSettings(root) {
  resetAccent();

  function toggleRow(label, hint, checked, action) {
    return `
      <button class="row-card" type="button" data-action="${action}" role="switch"
              aria-checked="${checked}">
        <span class="grow">
          <span class="row-card__title" style="display:block">${esc(label)}</span>
          <span class="row-card__sub" style="display:block">${esc(hint)}</span>
        </span>
        <span class="switch" data-on="${checked}"><i></i></span>
      </button>`;
  }

  function linkRow(label, hint, iconName, action, { danger = false } = {}) {
    return `
      <button class="row-card ${danger ? 'row-card--danger' : ''}" type="button" data-action="${action}">
        <span class="row-card__icon">${icon(iconName, { size: 22 })}</span>
        <span class="grow">
          <span class="row-card__title" style="display:block">${esc(label)}</span>
          ${hint ? `<span class="row-card__sub" style="display:block">${esc(hint)}</span>` : ''}
        </span>
        <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
      </button>`;
  }

  function view() {
    const signedIn = store.isAccount;
    return `
      <div class="screen">
        ${appScaffold('Ajustes', `
          <div class="section">
            ${sectionHead('Cuenta')}
            <div class="list">
              <div class="row-card" style="cursor:default">
                <span class="row-card__icon">${icon('person', { size: 22 })}</span>
                <span class="grow">
                  <span class="row-card__title" style="display:block">
                    ${esc(signedIn ? (auth.user?.email || store.displayAlias) : 'Invitado')}
                  </span>
                  <span class="row-card__sub" style="display:block">
                    Plan ${esc(planDisplayName(store.planTier))}
                  </span>
                </span>
              </div>
              ${linkRow('Planes', 'Qué incluye cada plan', 'spark', 'plans')}
              ${signedIn
                ? linkRow('Cerrar sesión', 'Vuelves al modo invitado', 'logout', 'signout')
                : linkRow('Iniciar sesión', 'Guarda tu progreso en la nube', 'mail', 'login')}
            </div>
          </div>

          <div class="section">
            ${sectionHead('Apariencia')}
            <div class="list">
              ${toggleRow('Tema oscuro', 'El modo en que la app fue diseñada.',
                          store.darkMode, 'toggle-theme')}
            </div>
          </div>

          <div class="section">
            ${sectionHead('Datos')}
            <div class="list">
              ${linkRow('Librería de rimas',
                        `${Object.keys(store.rhymes).length} grupos en este navegador`,
                        'library', 'library')}
              ${linkRow('Historial de sesiones', 'Tus grabaciones guardadas', 'history', 'sessionHistory')}
              ${linkRow('Borrar todos los datos',
                        'Deja este navegador como recién instalado', 'trash', 'erase',
                        { danger: true })}
            </div>
          </div>

          <div class="section">
            ${sectionHead('Legal')}
            <div class="list">
              ${LEGAL_DOCUMENTS.map((d) => `
                <a class="row-card" href="#/legal/${esc(d.id)}">
                  <span class="row-card__icon">${icon('doc', { size: 22 })}</span>
                  <span class="grow"><span class="row-card__title">${esc(d.title)}</span></span>
                  <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
                </a>`).join('')}
            </div>
            <p class="dim" style="margin:0">
              Versión aceptada: ${store.legalAcceptedVersion || '—'} de ${LEGAL_VERSION}
              ${store.legalAcceptedAt ? ` · ${esc(formatDateTime(store.legalAcceptedAt))}` : ''}
            </p>
          </div>

          <div class="section">
            ${sectionHead('Ayuda')}
            <div class="list">
              ${linkRow('Reportar un error', 'Nos llega directo, con o sin cuenta', 'bug', 'report')}
              ${linkRow('Ver la introducción otra vez', '', 'info', 'onboarding')}
            </div>
          </div>

          <p class="dim center" style="margin:0">
            Freestyle Academy ${esc(APP_VERSION)}${isFirebaseConfigured() ? '' : ' · sin conexión con la cuenta'}
          </p>
        `)}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wireBack(root, 'profile');

    const go = (sel, route) => root.querySelector(`[data-action="${sel}"]`)
      ?.addEventListener('click', () => navigate(route));

    go('plans', 'plans');
    go('login', 'login');
    go('library', 'library');
    go('sessionHistory', 'sessionHistory');
    go('report', 'reportBug');
    go('onboarding', 'onboarding');

    root.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => {
      store.setDarkMode(!store.darkMode);
      paint();
    });

    root.querySelector('[data-action="signout"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '¿Cerrar sesión?',
        message: 'Vuelves al modo invitado en este navegador. Tu progreso sigue guardado en tu cuenta.',
        confirmText: 'Cerrar sesión',
      });
      if (!ok) return;
      await signOut();
      navigate('train');
    });

    root.querySelector('[data-action="erase"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '¿Borrar todos los datos?',
        message: 'Este navegador vuelve al estado inicial. No se puede deshacer.',
        bullets: [
          'Tu progreso, racha y logros guardados aquí.',
          'Los cambios que hiciste en tu librería de rimas.',
          'Las grabaciones de tus sesiones.',
        ],
        confirmText: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      await eraseRecordings(store.scope);
      store.eraseAllData();
      toast('Datos borrados');
      navigate('onboarding');
    });
  }

  paint();
  const off = [store.on('scope', paint), store.on('plan', paint), store.on('theme', paint)];
  return () => off.forEach((f) => f());
}

/* ========================= Reportar un error ========================= */

export function renderReportBug(root) {
  resetAccent();

  let sending = false;
  let sent = false;
  let error = '';

  function view() {
    if (sent) {
      return `
        <div class="stack" style="align-items:center;text-align:center;gap:14px;margin-top:24px">
          <span class="achv__badge" style="width:64px;height:64px">${icon('check', { size: 30 })}</span>
          <h2 style="margin:0">Gracias</h2>
          <p class="muted" style="margin:0">Tu reporte llegó. Lo revisamos.</p>
          <button class="btn btn--primary btn--compact" type="button" data-action="back-home">
            Volver
          </button>
        </div>`;
    }

    return `
      <p class="muted" style="margin:0">
        Cuéntanos qué pasó. Va directo al equipo, tengas cuenta o no.
      </p>

      <div class="field">
        <label class="field__label" for="bug-summary">Resumen</label>
        <input class="input" id="bug-summary" type="text" maxlength="90"
               placeholder="Qué falló, en una línea">
      </div>

      <div class="field">
        <label class="field__label" for="bug-detail">Qué pasó</label>
        <textarea class="input input--area" id="bug-detail" rows="6" maxlength="1200"
                  placeholder="Qué estabas haciendo, qué esperabas y qué ocurrió"></textarea>
      </div>

      ${error ? `<p class="notice notice--error">${icon('info', { size: 17 })}<span>${esc(error)}</span></p>` : ''}

      <button class="btn btn--primary" type="button" data-action="send" ${sending ? 'disabled' : ''}>
        ${sending ? 'ENVIANDO…' : 'ENVIAR REPORTE'}
      </button>

      <p class="dim" style="margin:0">
        Enviamos también tu plan, la ruta en la que estabas y la versión de la app.
      </p>`;
  }

  function paint() {
    root.innerHTML = `<div class="screen">${appScaffold('Reportar un error', view())}</div>`;
    wireBack(root, 'settings');

    root.querySelector('[data-action="back-home"]')?.addEventListener('click', () => navigate('settings'));

    root.querySelector('[data-action="send"]')?.addEventListener('click', async () => {
      const summary = root.querySelector('#bug-summary').value.trim();
      const description = root.querySelector('#bug-detail').value.trim();
      if (!summary || !description) {
        error = 'Completa el resumen y la descripción.';
        paint();
        return;
      }
      sending = true; error = ''; paint();
      try {
        await submitBugReport({
          summary,
          description,
          context: {
            platform: 'web',
            version: APP_VERSION,
            plan: store.planTier,
            signedIn: store.isAccount,
            userAgent: navigator.userAgent,
            route: window.location.hash,
          },
        });
        sent = true;
      } catch (err) {
        console.warn('[bug]', err);
        error = 'No se pudo enviar. Revisa tu conexión e inténtalo otra vez.';
      }
      sending = false;
      paint();
    });
  }

  paint();
  return () => {};
}
