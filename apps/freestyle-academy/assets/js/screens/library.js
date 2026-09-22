/* =========================================================================
   library.js — port of ui/screens/LibraryScreen.kt, RhymeDetailScreen.kt and
   HistoryScreen.kt

   The rhyme library is a published master (Firestore `rhymeLibrary`) plus this
   account's own overlay of additions, removals and renames. Editing never
   touches the master: adding a word the master already has is a no-op, and
   removing a master word writes a tombstone. That is why a group can show
   fewer words than the master holds and still be correct.

   Librería and Historial are a Plus/Pro feature (PlanEntitlements
   .hasLibraryAndHistory) — the rounds still draw their words from the library
   on every plan, you just can't curate it on Gratis.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { sortedRhymeKeys, diff } from '../core/rhyme-library.js';
import { PlanEntitlements } from '../core/plans.js';
import { formatDateTime } from '../core/domain.js';
import {
  esc, icon, appScaffold, wireBack, sectionHead, emptyState, upsell,
  resetAccent, promptDialog, confirmDialog, toast,
} from '../ui/components.js';

const gate = () => PlanEntitlements.hasLibraryAndHistory(store.planTier);

function lockedScreen(root, title, message) {
  root.innerHTML = `
    <div class="screen">
      ${appScaffold(title, `
        ${upsell('Disponible con Plus', message)}
        <p class="dim" style="margin:0">
          Tus rondas siguen usando la librería completa en cualquier plan. Lo que
          Plus añade es poder editarla y conservar el historial.
        </p>
      `)}
    </div>`;
  wireBack(root, 'profile');
  root.querySelectorAll('[data-go]').forEach((el) =>
    el.addEventListener('click', () => navigate(el.dataset.go)));
}

/* ========================= Librería ========================= */

export function renderLibrary(root) {
  resetAccent();

  if (!gate()) {
    lockedScreen(root, 'Librería',
      'Añade, renombra y quita palabras de tus grupos de rima, y conserva el historial de cada cambio.');
    return () => {};
  }

  let search = '';

  function view() {
    const keys = sortedRhymeKeys(store.rhymes);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? keys.filter((k) => k.toLowerCase().includes(q)
          || (store.rhymes[k] || []).some((w) => w.toLowerCase().includes(q)))
      : keys;
    const totalWords = keys.reduce((n, k) => n + (store.rhymes[k] || []).length, 0);

    return `
      <div class="screen">
        ${appScaffold('Librería', `
          <p class="muted" style="margin:0">
            ${keys.length} grupos · ${totalWords} palabras
          </p>

          <div class="searchbar">
            <span class="searchbar__icon">${icon('search', { size: 20 })}</span>
            <input class="input" type="search" placeholder="Buscar grupo o palabra"
                   value="${esc(search)}" aria-label="Buscar en la librería">
          </div>

          ${filtered.length === 0
            ? emptyState('Sin resultados', 'Ninguna terminación ni palabra coincide con tu búsqueda.')
            : `<div class="rhyme-grid">
                ${filtered.map((k) => `
                  <button class="rhyme-tile" type="button" data-key="${esc(k)}">
                    <span class="rhyme-tile__key">-${esc(k)}</span>
                    <span class="rhyme-tile__count">${(store.rhymes[k] || []).length} palabras</span>
                  </button>`).join('')}
              </div>`}

          <button class="row-card" type="button" data-go="history">
            <span class="row-card__icon">${icon('history', { size: 22 })}</span>
            <span class="grow">
              <span class="row-card__title" style="display:block">Historial de cambios</span>
              <span class="row-card__sub" style="display:block">
                ${store.history.length} edición${store.history.length === 1 ? '' : 'es'} en esta cuenta
              </span>
            </span>
            <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
          </button>
        `, { actions: `<button class="iconbtn" type="button" data-action="add-group"
                              aria-label="Añadir palabra">${icon('plus')}</button>` })}
      </div>`;
  }

  function paint({ keepFocus = false } = {}) {
    root.innerHTML = view();
    wireBack(root, 'profile');

    const input = root.querySelector('.searchbar .input');
    input?.addEventListener('input', () => { search = input.value; paint({ keepFocus: true }); });
    if (keepFocus && input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }

    root.querySelectorAll('[data-key]').forEach((el) =>
      el.addEventListener('click', () => navigate(`rhyme/${encodeURIComponent(el.dataset.key)}`)));

    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelector('[data-action="add-group"]')?.addEventListener('click', async () => {
      const key = await promptDialog({
        title: 'Nueva palabra',
        label: 'Terminación (por ejemplo: ADA)',
        placeholder: 'ADA',
        confirmText: 'Continuar',
        maxLength: 12,
      });
      if (!key || !key.trim()) return;
      navigate(`rhyme/${encodeURIComponent(key.trim().toUpperCase())}`);
    });
  }

  paint();
  const off = [store.on('rhymes', () => paint()), store.on('history', () => paint())];
  return () => off.forEach((f) => f());
}

/* ========================= Un grupo ========================= */

export function renderRhymeDetail(root, { params }) {
  resetAccent();

  if (!gate()) {
    lockedScreen(root, `-${params.key || ''}`,
      'Edita este grupo de rima: añade tus palabras, renombra las que quieras y quita las que no uses.');
    return () => {};
  }

  const key = String(params.key || '').toUpperCase();

  function view() {
    const words = store.rhymes[key] || [];
    const changes = diff(store.master, store.rhymes)[key];

    return `
      <div class="screen">
        ${appScaffold(`-${key}`, `
          <p class="muted" style="margin:0">
            ${words.length} palabra${words.length === 1 ? '' : 's'}
            ${changes ? ` · ${changes.added.length} tuya${changes.added.length === 1 ? '' : 's'}` : ''}
          </p>

          ${words.length === 0
            ? emptyState('Grupo vacío',
                'Añade la primera palabra y este grupo entrará en la rotación de tus rondas.')
            : `<div class="word-list">
                ${words.map((w) => `
                  <div class="word-row">
                    <span class="grow">${esc(w)}</span>
                    <button class="iconbtn iconbtn--sm" type="button" data-rename="${esc(w)}"
                            aria-label="Renombrar ${esc(w)}">${icon('text', { size: 18 })}</button>
                    <button class="iconbtn iconbtn--sm" type="button" data-remove="${esc(w)}"
                            aria-label="Quitar ${esc(w)}">${icon('minus', { size: 18 })}</button>
                  </div>`).join('')}
              </div>`}

          <button class="btn btn--primary" type="button" data-action="add">
            ${icon('plus', { size: 18 })} AÑADIR PALABRA
          </button>

          <p class="dim" style="margin:0">
            Los cambios son tuyos: quedan sobre la librería publicada y viajan con
            tu cuenta, sin tocar la de nadie más.
          </p>
        `)}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wireBack(root, 'library');

    root.querySelector('[data-action="add"]')?.addEventListener('click', async () => {
      const word = await promptDialog({
        title: `Añadir a -${key}`,
        label: 'Palabra',
        placeholder: 'Escribe la palabra',
        confirmText: 'Añadir',
      });
      if (!word || !word.trim()) return;
      // A word the group already holds is a no-op, exactly as in the app —
      // nothing is written and no history entry appears.
      if (!store.addWord(key, word)) toast('Esa palabra ya está en el grupo');
    });

    root.querySelectorAll('[data-rename]').forEach((el) =>
      el.addEventListener('click', async () => {
        const old = el.dataset.rename;
        const next = await promptDialog({
          title: 'Renombrar palabra',
          label: 'Nueva palabra',
          initial: old,
          confirmText: 'Guardar',
        });
        if (!next || !next.trim() || next.trim() === old) return;
        if (!store.renameWord(key, old, next)) toast('No se pudo renombrar');
      }));

    root.querySelectorAll('[data-remove]').forEach((el) =>
      el.addEventListener('click', async () => {
        const word = el.dataset.remove;
        const ok = await confirmDialog({
          title: '¿Quitar la palabra?',
          message: `"${word}" deja de aparecer en tus rondas. Puedes volver a añadirla cuando quieras.`,
          confirmText: 'Quitar',
          danger: true,
        });
        if (ok) store.removeWord(key, word);
      }));
  }

  paint();
  const off = store.on('rhymes', paint);
  return () => off();
}

/* ========================= Historial de cambios ========================= */

export function renderHistory(root) {
  resetAccent();

  if (!gate()) {
    lockedScreen(root, 'Historial',
      'Consulta cada palabra que añadiste, renombraste o quitaste, con su fecha.');
    return () => {};
  }

  function view() {
    const entries = [...store.history].reverse();
    return `
      <div class="screen">
        ${appScaffold('Historial de cambios', `
          ${entries.length === 0
            ? emptyState('Sin cambios todavía',
                'Cuando edites tu librería, cada cambio quedará registrado aquí.')
            : `<div class="list">
                ${entries.map((h) => `
                  <div class="row-card" style="cursor:default">
                    <span class="row-card__icon"
                          style="color:${h.type === 'REMOVED' ? 'var(--danger)' : 'var(--accent-bright)'}">
                      ${icon(h.type === 'REMOVED' ? 'minus' : 'plus', { size: 22 })}
                    </span>
                    <span class="grow">
                      <span class="row-card__title" style="display:block">${esc(h.word)}</span>
                      <span class="row-card__sub" style="display:block">
                        -${esc(h.rhymeKey)} · ${esc(formatDateTime(h.timestamp))}
                      </span>
                    </span>
                  </div>`).join('')}
              </div>`}
        `)}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wireBack(root, 'library');
  }

  paint();
  const off = store.on('history', paint);
  return () => off();
}
