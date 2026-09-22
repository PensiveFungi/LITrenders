/* profile.js — port of ui/screens/ProfileScreen.kt (route: profile)
   Adds the web-only account block: Google sign-in and sync status. */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { formatPracticeTime } from '../core/domain.js';
import { auth, signInWithGoogle, signOut } from '../core/firebase.js';
import {
  esc, icon, progressBar, statTile, achievementRow, applyModeTheme, toast, prompt,
} from '../ui/components.js';

function initials(alias) {
  return alias
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FA';
}

function accountBlock() {
  if (!auth.available) {
    return `
      <div class="card stack">
        <h2 style="font-size:18px;font-weight:700">Cuenta</h2>
        <p class="muted" style="margin:0">
          Tu progreso se guarda en este navegador. Para sincronizarlo entre
          dispositivos hay que configurar Firebase en <code>assets/js/core/config.js</code>.
        </p>
      </div>`;
  }

  if (auth.user) {
    const photo = auth.user.photoURL
      ? `<img src="${esc(auth.user.photoURL)}" alt="" referrerpolicy="no-referrer">`
      : initials(auth.user.displayName);
    return `
      <div class="card stack">
        <h2 style="font-size:18px;font-weight:700">Cuenta</h2>
        <div class="row">
          <span class="avatar" style="width:52px;height:52px;font-size:19px;margin:0">${photo}</span>
          <span class="grow">
            <span style="display:block;font-weight:700">${esc(auth.user.displayName)}</span>
            <span class="dim" style="display:block">${esc(auth.user.email)}</span>
          </span>
        </div>
        <p class="dim" style="margin:0">
          Sincronizando · plan ${esc(auth.entitlement.tier)}
        </p>
        <button class="btn btn--outline" type="button" data-action="signout">
          ${icon('logout', { size: 18 })} Cerrar sesión
        </button>
      </div>`;
  }

  return `
    <div class="card stack">
      <h2 style="font-size:18px;font-weight:700">Cuenta</h2>
      <p class="muted" style="margin:0">
        Inicia sesión para sincronizar tu progreso, tus rimas y tu suscripción
        entre la web y la app.
      </p>
      <button class="btn btn--primary" type="button" data-action="signin">
        ${icon('google', { size: 18 })} Entrar con Google
      </button>
    </div>`;
}

function view() {
  const p = store.progress;
  return `
    <div class="card stack" style="background:var(--surface-variant);align-items:center;text-align:center">
      <span class="avatar">${initials(store.alias)}</span>
      <h1 class="display" style="font-size:32px">${esc(store.alias)}</h1>
      <div class="btn-row" style="width:100%">
        <button class="btn btn--outline" type="button" data-action="rename">
          Editar alias
        </button>
        <button class="btn btn--outline" type="button" data-go="settings">
          ${icon('settings', { size: 18 })} Ajustes
        </button>
      </div>
    </div>

    <div class="card stack">
      <div class="row row--between" style="align-items:flex-end">
        <span>
          <span class="dim" style="display:block">Nivel actual</span>
          <span class="display" style="font-size:28px">Nivel ${p.currentLevel}</span>
        </span>
        <span style="color:var(--mode-primary);font-weight:700">
          ${p.currentXp} / ${p.nextLevelXp} XP
        </span>
      </div>
      ${progressBar(p.xpProgress)}
    </div>

    <div class="stat-grid stat-grid--3">
      ${statTile('Racha', `${p.practiceStreakDays} días`, 'flame', 'var(--fa-gold)')}
      ${statTile('Sesiones', String(p.totalSessions), 'dumbbell', 'var(--fa-cyan)')}
      ${statTile('Práctica', formatPracticeTime(p.totalPracticeMinutes), 'clock', 'var(--fa-purple-soft)')}
    </div>

    ${accountBlock()}

    <div class="section">
      <h2 class="section__title">Herramientas</h2>
      <div class="tool-grid">
        <button class="tool-card" type="button" data-go="library">
          ${icon('library')}
          <span class="tool-card__title">Librería</span>
          <span class="dim">Edita rimas</span>
        </button>
        <button class="tool-card" type="button" data-go="history">
          ${icon('history')}
          <span class="tool-card__title">Historial</span>
          <span class="dim">Cambios recientes</span>
        </button>
      </div>
    </div>

    <div class="section">
      <h2 class="section__title">Logros</h2>
      <div class="list">
        ${p.allAchievements.map(achievementRow).join('')}
      </div>
    </div>
  `;
}

export function renderProfile(root) {
  applyModeTheme('libre');

  const paint = () => {
    root.innerHTML = view();
    wire();
  };

  function wire() {
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelector('[data-action="rename"]')?.addEventListener('click', async () => {
      const next = await prompt({
        title: 'Tu alias',
        label: 'Nombre de MC',
        placeholder: 'MC Verso',
        initial: store.alias,
      });
      if (next != null) {
        store.setAlias(next);
        paint();
        toast('Alias actualizado');
      }
    });

    root.querySelector('[data-action="signin"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await signInWithGoogle();
      } catch (err) {
        console.warn(err);
        toast('No se pudo iniciar sesión.');
      } finally {
        btn.disabled = false;
      }
    });

    root.querySelector('[data-action="signout"]')?.addEventListener('click', async () => {
      await signOut();
      toast('Sesión cerrada');
    });
  }

  paint();

  const offProgress = store.on('progress', paint);
  const offProfile = store.on('profile', paint);
  const offAuth = auth.onChange(paint);

  return () => { offProgress(); offProfile(); offAuth(); };
}
