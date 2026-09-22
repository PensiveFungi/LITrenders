/* =========================================================================
   studio.js — port of ui/screens/StudioScreen.kt (the "Studio" tab)

   Studio is where a session stops being practice and becomes a track.

   Two different gates, as in the app: PlanEntitlements.canBrowseStudio (Plus
   and Pro) opens the tab and its library; canAccessStudio (Pro only) is what
   creating takes. A Gratis account can still tap the tab — the bottom bar
   routes a locked tab to Planes rather than refusing the tap.

   CREDITS are the server's to spend: functions/src/studioCredits.ts charges a
   generation inside a transaction before calling the provider. The balance
   here is read from the account's own ledger document and computed with the
   same rules (domain/StudioCredits.kt) so the screen can show what is left —
   it never decides anything.

   WHAT THIS BUILD DOES NOT DO: generate music. The request body for the
   `kieGenerate` callable is assembled in the app's Studio repository, which
   was not part of the source this port was built from, and guessing at it
   would mean inventing a contract the backend never agreed to. So the
   creation entry points say what they need instead of pretending. Everything
   that does not depend on that contract — the gates, the ledger, the kept
   recordings with their turns and transcripts — is real.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { loadStudioCredits } from '../core/firebase.js';
import { PlanEntitlements, planDisplayName } from '../core/plans.js';
import { formatDateTime, formatDurationSeconds } from '../core/domain.js';
import { listRecordings, hasRecording } from '../core/recordings.js';
import {
  esc, icon, sectionHead, emptyState, upsell, resetAccent, progressBar,
} from '../ui/components.js';

/* ---------- domain/StudioCredits.kt ---------- */

/** Credits every account starts each day with. */
export const DAILY_CREDITS = 100;
/** One generation: a song or an instrumental. */
export const GENERATION_COST = 25;
/** Songs in an álbum, all from the same recording. */
export const ALBUM_TRACKS = 4;
export const ALBUM_COST = GENERATION_COST * ALBUM_TRACKS;

/** `yyyy-MM-dd` in the user's own time zone — the ledger's day key. */
export function dayKey(millis = Date.now()) {
  const d = new Date(millis);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** What the ledger has left today. A ledger from an earlier day spent nothing today. */
export function balanceOf(ledger, today = dayKey()) {
  if (!ledger || !ledger.day || ledger.day < today) return DAILY_CREDITS;
  const spent = (ledger.spends || []).reduce((n, s) => n + (Number(s.cost) || 0), 0);
  return Math.max(0, DAILY_CREDITS - spent);
}

/* ---------- the screen ---------- */

const TABS = [
  { id: 'grabaciones', label: 'Grabaciones' },
  { id: 'canciones', label: 'Canciones' },
  { id: 'instrumentales', label: 'Instrumentales' },
];

export function renderStudio(root) {
  resetAccent();

  let tab = 'grabaciones';
  let recordings = null;
  let credits = null;

  const canBrowse = () => PlanEntitlements.canBrowseStudio(store.planTier) && store.isAccount;
  const canCreate = () => PlanEntitlements.canAccessStudio(store.planTier) && store.isAccount;

  function creditsCard() {
    if (!canCreate()) return '';
    const left = balanceOf(credits);
    return `
      <div class="card stack">
        <div class="row row--between" style="align-items:flex-end">
          <span>
            <span class="dim" style="display:block">CRÉDITOS DE HOY</span>
            <span style="font-size:26px;font-weight:800">${left}</span>
          </span>
          <span class="dim">de ${DAILY_CREDITS}</span>
        </div>
        ${progressBar(left / DAILY_CREDITS)}
        <p class="dim" style="margin:0">
          Un tema o un instrumental cuesta ${GENERATION_COST}; un álbum
          (${ALBUM_TRACKS} temas) cuesta ${ALBUM_COST}. Vuelven a ${DAILY_CREDITS}
          cada día y no se acumulan.
        </p>
      </div>`;
  }

  function recordingsTab() {
    if (recordings === null) {
      return `<div class="card row" style="gap:14px">
        <span class="spinner"></span><span class="muted">Cargando…</span>
      </div>`;
    }
    if (recordings.length === 0) {
      return emptyState('Sin material todavía',
        'Cada sesión que termines con el micrófono activo aparece aquí, lista para trabajarla.');
    }
    return `<div class="list">${recordings.map((r) => `
      <button class="row-card" type="button" data-rec="${r.id}">
        <span class="row-card__icon">${icon(hasRecording(r) ? 'waveform' : 'doc', { size: 22 })}</span>
        <span class="grow">
          <span class="row-card__title" style="display:block">${esc(r.modeName)}</span>
          <span class="row-card__sub" style="display:block">
            ${esc(formatDateTime(r.timestampMillis))} · ${esc(formatDurationSeconds(r.durationSeconds))}
            · ${r.segments.length} turno${r.segments.length === 1 ? '' : 's'}
          </span>
        </span>
        <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
      </button>`).join('')}</div>`;
  }

  function creationTab(kind) {
    return `
      ${emptyState(
        kind === 'canciones' ? 'Todavía no hay canciones' : 'Todavía no hay instrumentales',
        'Lo que generes desde la app aparecerá aquí cuando el Studio esté conectado en la web.'
      )}
      <p class="notice">${icon('info', { size: 17 })}<span>
        Crear música todavía se hace desde la app de Android. La web ya tiene el
        Studio abierto, tus créditos y tu material grabado; falta conectar la
        generación.
      </span></p>`;
  }

  function view() {
    if (!store.isAccount) {
      return `
        <div class="home-head"><div class="grow"><h1>Studio</h1><p>Tu material</p></div></div>
        <div class="upsell">
          <p class="upsell__title">${icon('person', { size: 17 })} El Studio es para cuentas</p>
          <p class="muted" style="margin:0">
            Aquí vive lo que grabas. Como invitado no se guarda nada, así que no
            hay material que abrir.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="login">
            Crear cuenta o iniciar sesión
          </button>
        </div>`;
    }

    if (!canBrowse()) {
      return `
        <div class="home-head">
          <div class="grow"><h1>Studio</h1><p>Plan ${esc(planDisplayName(store.planTier))}</p></div>
        </div>
        ${upsell('El Studio llega con Plus',
          'Escucha tus sesiones grabadas y guárdalas. Crear temas e instrumentales es parte de Pro.')}`;
    }

    return `
      <div class="home-head">
        <div class="grow">
          <h1>Studio</h1>
          <p>${canCreate() ? 'Crea con lo que grabaste' : 'Tu material grabado'}</p>
        </div>
      </div>

      ${creditsCard()}

      ${!canCreate() ? upsell('Crear es parte de Pro',
        'Con Plus escuchas y guardas tus sesiones. Convertirlas en temas e instrumentales llega con Pro.') : ''}

      <div class="tabs" role="tablist">
        ${TABS.map((t) => `
          <button role="tab" aria-selected="${tab === t.id}" data-tab="${t.id}">${esc(t.label)}</button>
        `).join('')}
      </div>

      <div class="section">
        ${sectionHead(TABS.find((t) => t.id === tab).label)}
        ${tab === 'grabaciones' ? recordingsTab() : creationTab(tab)}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();

    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => { tab = b.dataset.tab; paint(); }));

    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelectorAll('[data-rec]').forEach((el) =>
      el.addEventListener('click', () => navigate(`sessionRecording/${el.dataset.rec}`)));
  }

  async function load() {
    if (!canBrowse()) return;
    recordings = await listRecordings(store.scope);
    if (canCreate()) credits = await loadStudioCredits(store.scope.uid);
    paint();
  }

  paint();
  load();

  const off = [store.on('scope', () => { recordings = null; paint(); load(); }),
               store.on('plan', () => { paint(); load(); })];
  return () => off.forEach((f) => f());
}
