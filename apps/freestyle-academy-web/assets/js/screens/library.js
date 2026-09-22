/* library.js — port of LibraryScreen.kt + RhymeDetailScreen.kt
   Routes: library · rhyme/{key} */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { sortedRhymeKeys } from '../data/rhymes.js';
import {
  esc, icon, appScaffold, wireBack, emptyState, applyModeTheme,
  toast, prompt, confirmDialog,
} from '../ui/components.js';

/* ---------- Librería de Rimas ---------- */

export function renderLibrary(root) {
  applyModeTheme('libre');
  let search = '';

  function list() {
    const keys = sortedRhymeKeys(store.rhymes)
      .filter((k) => k.toLowerCase().includes(search.toLowerCase()));
    if (keys.length === 0) {
      return emptyState('Sin resultados', 'No hay grupos de rima que coincidan con tu búsqueda.');
    }
    return `<div class="list">${keys.map((key) => `
      <button class="rhyme-row" type="button" data-key="${esc(key)}"
              aria-label="Abrir el grupo de rima ${esc(key)}">
        <span>
          <span class="rhyme-row__key display" style="display:block">-${esc(key)}</span>
          <span class="rhyme-row__count">${store.rhymes[key].length} palabras</span>
        </span>
        ${icon('arrow', { size: 20 })}
      </button>`).join('')}</div>`;
  }

  function paint() {
    root.innerHTML = `
      <div class="screen">
        ${appScaffold('Librería de Rimas', `
          <div class="searchbar">
            <span class="searchbar__icon">${icon('search', { size: 20 })}</span>
            <input class="input" type="search" placeholder="Buscar grupo de rima…"
                   value="${esc(search)}" data-input="search" aria-label="Buscar grupo de rima">
          </div>
          <div data-slot="list">${list()}</div>
        `)}
      </div>`;
    wire();
  }

  function wire() {
    wireBack(root, 'train');
    const input = root.querySelector('[data-input="search"]');
    input?.addEventListener('input', () => {
      search = input.value;
      root.querySelector('[data-slot="list"]').innerHTML = list();
      wireRows();
    });
    wireRows();
  }

  function wireRows() {
    root.querySelectorAll('[data-key]').forEach((btn) =>
      btn.addEventListener('click', () =>
        navigate(`rhyme/${encodeURIComponent(btn.dataset.key)}`)));
  }

  paint();
  const off = store.on('rhymes', paint);
  return () => off();
}

/* ---------- Detalle de un grupo ---------- */

export function renderRhymeDetail(root, { params }) {
  applyModeTheme('palabras');
  const rhymeKey = params.key;
  let search = '';
  let deleteMode = false;

  if (!store.rhymes[rhymeKey]) {
    root.innerHTML = `
      <div class="screen">
        ${appScaffold('Rima', emptyState(
          'Grupo no encontrado',
          'Ese grupo de rima ya no existe en tu librería.'))}
      </div>`;
    wireBack(root, 'library');
    return;
  }

  function words() {
    const all = store.rhymes[rhymeKey] || [];
    const filtered = all.filter((w) => w.toLowerCase().includes(search.toLowerCase()));
    if (filtered.length === 0) {
      return emptyState('Sin palabras', 'No hay palabras que coincidan con tu búsqueda.');
    }
    return `<div class="list">${filtered.map((w) => `
      <div class="word-row">
        <span>${esc(w)}</span>
        ${deleteMode
          ? `<button class="iconbtn" type="button" data-remove="${esc(w)}"
               aria-label="Eliminar ${esc(w)}" style="color:#FF7A9B">${icon('minus', { size: 20 })}</button>`
          : ''}
      </div>`).join('')}</div>`;
  }

  function paint() {
    root.innerHTML = `
      <div class="screen">
        ${appScaffold(`-${rhymeKey}`, `
          <div class="searchbar">
            <span class="searchbar__icon">${icon('search', { size: 20 })}</span>
            <input class="input" type="search" placeholder="Buscar palabra…"
                   value="${esc(search)}" data-input="search" aria-label="Buscar palabra">
          </div>
          <p class="dim" style="margin:0">${store.rhymes[rhymeKey].length} palabras en este grupo</p>
          <div data-slot="words">${words()}</div>
        `, {
          actions: `
            <button class="iconbtn" type="button" data-action="add" aria-label="Agregar palabra">
              ${icon('plus')}
            </button>
            <button class="iconbtn" type="button" data-action="toggle-delete"
                    aria-label="${deleteMode ? 'Salir del modo eliminar' : 'Entrar al modo eliminar'}"
                    style="${deleteMode ? 'color:#FF7A9B' : ''}">${icon('minus')}</button>`,
        })}
      </div>`;
    wire();
  }

  function wire() {
    wireBack(root, 'library');

    const input = root.querySelector('[data-input="search"]');
    input?.addEventListener('input', () => {
      search = input.value;
      root.querySelector('[data-slot="words"]').innerHTML = words();
      wireRemove();
    });

    root.querySelector('[data-action="toggle-delete"]')?.addEventListener('click', () => {
      deleteMode = !deleteMode;
      paint();
    });

    root.querySelector('[data-action="add"]')?.addEventListener('click', async () => {
      const value = await prompt({
        title: `Agregar a -${rhymeKey}`,
        label: 'Nueva palabra',
        placeholder: 'escribe una palabra',
        confirmText: 'Agregar',
      });
      if (value == null) return;
      const added = store.addWord(rhymeKey, value);
      toast(added ? 'Palabra agregada' : 'Esa palabra ya está en el grupo');
    });

    wireRemove();
  }

  function wireRemove() {
    root.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const word = btn.dataset.remove;
        const ok = await confirmDialog({
          title: 'Eliminar palabra',
          message: `¿Quitar "${word}" del grupo -${rhymeKey}?`,
          confirmText: 'Eliminar',
          danger: true,
        });
        if (ok) {
          store.removeWord(rhymeKey, word);
          toast('Palabra eliminada');
        }
      }));
  }

  paint();
  const off = store.on('rhymes', paint);
  return () => off();
}
