/* =========================================================================
   profile.js — port of ui/screens/ProfileScreen.kt and EditProfileScreen.kt

   The identity card plus the shortcuts into Librería, Historial de Sesiones,
   Planes and Ajustes.

   Editing your identity is account-only. A guest AKA lives on this browser
   alone, can't be claimed in the league and is lost with the data, so a guest
   tapping "Editar" (or the avatar — both arrive here) lands on Login, where
   the editor becomes reachable the moment they sign in.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate, back } from '../core/router.js';
import { auth, signOut } from '../core/firebase.js';
import { PlanEntitlements, planDisplayName } from '../core/plans.js';
import { AVATARS, featuredAvatars, avatarById, avatarImage } from '../ui/avatars.js';
import {
  esc, icon, rowCard, sectionHead, resetAccent, appScaffold, wireBack,
  confirmDialog, toast,
} from '../ui/components.js';

/* ========================= Perfil ========================= */

export function renderProfile(root) {
  resetAccent();

  function view() {
    const p = store.progress;
    const profile = store.profile;
    const signedIn = store.isAccount;
    const tier = store.planTier;
    const locked = !PlanEntitlements.hasLibraryAndHistory(tier);

    return `
      <div class="home-head">
        <div class="grow">
          <h1>Perfil</h1>
          <p>Tu identidad en la academia</p>
        </div>
        <button class="iconbtn iconbtn--bordered" type="button" data-go="settings"
                aria-label="Ajustes">${icon('settings')}</button>
      </div>

      <div class="profile-card">
        <button class="profile-card__avatar" type="button" data-action="edit"
                aria-label="Editar perfil">
          ${avatarImage(profile.avatarId, { size: 'lg' })}
        </button>
        <div class="grow">
          <p class="profile-card__alias">${esc(store.displayAlias)}</p>
          <p class="profile-card__meta">
            ${signedIn ? `Nivel ${p.currentLevel}` : 'Invitado'}
            ${profile.crew ? ` · ${esc(profile.crew)}` : ''}
          </p>
          ${profile.punchline
            ? `<p class="profile-card__punch">“${esc(profile.punchline)}”</p>` : ''}
        </div>
        <button class="btn btn--outline btn--compact" type="button" data-action="edit">
          Editar
        </button>
      </div>

      <div class="row row--wrap" style="gap:8px">
        <span class="pill pill--muted">${esc(planDisplayName(tier))}</span>
        <span class="pill">${icon('flame', { size: 15 })} Racha ${p.practiceStreakDays}</span>
        ${signedIn && auth.user?.email
          ? `<span class="pill pill--muted">${esc(auth.user.email)}</span>` : ''}
      </div>

      <div class="section">
        ${sectionHead('Tus cosas')}
        <div class="list">
          ${rowCard({
            title: 'Librería de rimas',
            subtitle: 'Tus grupos de rima y las palabras que añadiste.',
            iconName: 'library',
            locked,
            action: locked ? 'plans' : 'library',
          })}
          ${rowCard({
            title: 'Historial de sesiones',
            subtitle: 'Cada sesión guardada, con su grabación y su transcripción.',
            iconName: 'history',
            locked,
            action: locked ? 'plans' : 'sessionHistory',
          })}
          ${rowCard({
            title: 'Planes',
            subtitle: `Estás en ${planDisplayName(tier)}. Mira qué incluye cada plan.`,
            iconName: 'spark',
            action: 'plans',
          })}
          ${rowCard({
            title: 'Ajustes',
            subtitle: 'Cuenta, datos, documentos legales y reporte de errores.',
            iconName: 'settings',
            action: 'settings',
          })}
        </div>
      </div>

      <div class="section">
        ${sectionHead('Cuenta')}
        ${signedIn
          ? `<button class="btn btn--outline" type="button" data-action="signout">
               ${icon('logout', { size: 18 })} Cerrar sesión
             </button>`
          : `<button class="btn btn--primary" type="button" data-go="login">
               Crear cuenta o iniciar sesión
             </button>`}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();

    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelectorAll('[data-action="library"]').forEach((el) =>
      el.addEventListener('click', () => navigate('library')));
    root.querySelectorAll('[data-action="sessionHistory"]').forEach((el) =>
      el.addEventListener('click', () => navigate('sessionHistory')));
    root.querySelectorAll('[data-action="plans"]').forEach((el) =>
      el.addEventListener('click', () => navigate('plans')));
    root.querySelectorAll('[data-action="settings"]').forEach((el) =>
      el.addEventListener('click', () => navigate('settings')));

    root.querySelectorAll('[data-action="edit"]').forEach((el) =>
      el.addEventListener('click', () => navigate(store.isAccount ? 'editProfile' : 'login')));

    root.querySelector('[data-action="signout"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '¿Cerrar sesión?',
        message: 'Vuelves a la experiencia de invitado en este navegador. Tu progreso queda guardado en tu cuenta.',
        confirmText: 'Cerrar sesión',
      });
      if (!ok) return;
      await signOut();
      toast('Sesión cerrada');
    });
  }

  paint();
  const off = [
    store.on('profile', paint),
    store.on('progress', paint),
    store.on('scope', paint),
    store.on('plan', paint),
  ];
  return () => off.forEach((f) => f());
}

/* ========================= Editar perfil ========================= */

export function renderEditProfile(root) {
  resetAccent();

  let draft = { ...store.profile };
  let showAll = false;

  function avatarGrid() {
    const list = showAll ? AVATARS : featuredAvatars();
    return `
      <div class="avatar-grid" data-group="avatars">
        ${list.map((a) => {
          const allowed = PlanEntitlements.canUseAvatar(store.planTier, a.id);
          return `
            <button class="avatar-pick" type="button" data-value="${esc(a.id)}"
                    aria-pressed="${draft.avatarId === a.id}" data-locked="${!allowed}"
                    aria-label="${esc(a.label)}">
              ${avatarImage(a.id, { size: 'md' })}
              <span class="avatar-pick__label">${esc(a.label)}</span>
              ${!allowed ? `<span class="avatar-pick__lock">${icon('lock', { size: 12 })}</span>` : ''}
            </button>`;
        }).join('')}
      </div>
      ${!showAll ? `
        <button class="btn btn--ghost btn--compact" type="button" data-action="all-avatars">
          Ver todos (${AVATARS.length})
        </button>` : ''}`;
  }

  function view() {
    return `
      <div class="screen">
        ${appScaffold('Editar perfil', `
          <div class="stack" style="align-items:center;gap:10px">
            ${avatarImage(draft.avatarId, { size: 'lg' })}
            <p class="dim" style="margin:0">${esc(avatarById(draft.avatarId).label)}</p>
          </div>

          <div class="field">
            <label class="field__label" for="f-alias">AKA</label>
            <input class="input" id="f-alias" type="text" maxlength="24" autocomplete="off"
                   placeholder="Tu nombre en la batalla" value="${esc(draft.alias)}">
            <p class="field__hint">Así te ven en la Liga y en los resultados.</p>
          </div>

          <div class="field">
            <label class="field__label" for="f-crew">Crew</label>
            <input class="input" id="f-crew" type="text" maxlength="24" autocomplete="off"
                   placeholder="Opcional" value="${esc(draft.crew)}">
            <p class="field__hint">Las siglas con las que apareces en la tabla de tu crew.</p>
          </div>

          <div class="field">
            <label class="field__label" for="f-punch">Punchline</label>
            <input class="input" id="f-punch" type="text" maxlength="80" autocomplete="off"
                   placeholder="Una línea tuya" value="${esc(draft.punchline)}">
          </div>

          <div class="section">
            ${sectionHead('Avatar')}
            ${avatarGrid()}
          </div>

          <button class="btn btn--primary" type="button" data-action="save">GUARDAR</button>
        `)}
      </div>`;
  }

  function readFields() {
    draft.alias = root.querySelector('#f-alias')?.value ?? draft.alias;
    draft.crew = root.querySelector('#f-crew')?.value ?? draft.crew;
    draft.punchline = root.querySelector('#f-punch')?.value ?? draft.punchline;
  }

  function paint() {
    root.innerHTML = view();
    wireBack(root, 'profile');

    root.querySelector('[data-action="all-avatars"]')?.addEventListener('click', () => {
      readFields(); showAll = true; paint();
    });

    root.querySelector('[data-group="avatars"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.avatar-pick');
      if (!btn) return;
      if (btn.dataset.locked === 'true') {
        toast('Ese avatar es de Plus');
        navigate('plans');
        return;
      }
      readFields();
      draft.avatarId = btn.dataset.value;
      paint();
    });

    root.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      readFields();
      store.setProfile({
        alias: draft.alias.trim(),
        crew: draft.crew.trim(),
        punchline: draft.punchline.trim(),
        avatarId: draft.avatarId,
      });
      toast('Perfil guardado');
      back('profile');
    });
  }

  paint();
  return () => {};
}
