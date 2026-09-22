/* settings.js — port of SettingsScreen.kt (route: settings) */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { auth } from '../core/firebase.js';
import { APP_VERSION, isFirebaseConfigured } from '../core/config.js';
import { isFeedbackEnabled } from '../core/feedback.js';
import {
  esc, icon, appScaffold, wireBack, applyModeTheme, toast, confirmDialog,
} from '../ui/components.js';

function toggleRow({ title, subtitle, on, action, iconName }) {
  return `
    <button class="option" type="button" data-action="${action}" aria-pressed="${on}">
      <span class="row grow" style="gap:14px">
        <span style="color:var(--mode-primary)">${icon(iconName, { size: 22 })}</span>
        <span class="grow">
          <span class="option__title" style="display:block">${esc(title)}</span>
          <span class="option__sub" style="display:block">${esc(subtitle)}</span>
        </span>
      </span>
      <span class="option__check">${icon('checkCircle', { size: 22 })}</span>
    </button>`;
}

function infoRow(label, value) {
  return `<div class="summary-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

export function renderSettings(root) {
  applyModeTheme('libre');

  function paint() {
    const dark = store.darkMode;
    root.innerHTML = `
      <div class="screen">
        ${appScaffold('Ajustes', `
          <div class="section">
            <p class="eyebrow">Preferencias</p>
            ${toggleRow({
              title: 'Modo oscuro',
              subtitle: dark ? 'Activado' : 'Desactivado',
              on: dark,
              action: 'toggle-theme',
              iconName: dark ? 'moon' : 'sun',
            })}
          </div>

          <div class="section">
            <p class="eyebrow">Cuenta y datos</p>
            <div class="card stack">
              <dl style="margin:0">
                ${infoRow('Sincronización', auth.available
                  ? (auth.user ? 'Activa' : 'Disponible — inicia sesión')
                  : 'Solo en este navegador')}
                ${infoRow('Análisis con IA', isFeedbackEnabled()
                  ? 'Configurado' : 'Desactivado')}
                ${infoRow('Plan', auth.entitlement.tier)}
              </dl>
              ${!isFirebaseConfigured() ? `
                <p class="dim" style="margin:0">
                  Para activar cuentas y sincronización, completa
                  <code>assets/js/core/config.js</code>.
                </p>` : ''}
              <button class="btn btn--outline" type="button" data-go="profile">
                ${icon('person', { size: 18 })} Ir a mi perfil
              </button>
            </div>
          </div>

          <div class="section">
            <p class="eyebrow">Zona de riesgo</p>
            <div class="card stack">
              <p class="muted" style="margin:0">
                Borra las rimas, el historial y el progreso guardados en este navegador.
                Si tienes la sesión iniciada, los datos en la nube no se tocan.
              </p>
              <button class="btn btn--danger" type="button" data-action="reset">
                ${icon('trash', { size: 18 })} Borrar datos locales
              </button>
            </div>
          </div>

          <div class="section">
            <p class="eyebrow">Acerca de</p>
            <div class="card">
              <dl style="margin:0">
                ${infoRow('Freestyle Academy', `v${APP_VERSION} · web`)}
                ${infoRow('LITrenders', 'litrenders.com')}
              </dl>
            </div>
          </div>
        `)}
      </div>`;
    wire();
  }

  function wire() {
    wireBack(root, 'profile');

    root.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', () => {
      store.setDarkMode(!store.darkMode);
      paint();
    });

    root.querySelector('[data-go]')?.addEventListener('click', () => navigate('profile'));

    root.querySelector('[data-action="reset"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Borrar datos locales',
        message: 'Se borrarán tus rimas, tu historial y tu progreso en este navegador. No se puede deshacer.',
        confirmText: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      store.resetLocalData();
      toast('Datos locales borrados');
      paint();
    });
  }

  paint();
  const offTheme = store.on('theme', paint);
  const offAuth = auth.onChange(paint);
  return () => { offTheme(); offAuth(); };
}
