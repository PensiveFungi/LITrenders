/* history.js — port of HistoryScreen.kt (route: history)
   The timestamped add/remove log for the rhyme dictionary. */

import { store } from '../core/store.js';
import { formatDateTime } from '../core/domain.js';
import { esc, appScaffold, wireBack, emptyState, applyModeTheme } from '../ui/components.js';

export function renderHistory(root) {
  applyModeTheme('libre');

  function body() {
    const entries = store.history.slice().reverse();
    if (entries.length === 0) {
      return emptyState('Sin cambios', 'No hay cambios registrados aún en tu librería de rimas.');
    }
    return `<div class="list">${entries.map((e) => {
      const added = e.type === 'ADDED';
      return `
        <div class="card card--tight row row--between">
          <span class="grow">
            <span style="display:block;font-weight:700">${esc(e.word)}</span>
            <span class="dim" style="display:block">-${esc(e.rhymeKey)} · ${esc(formatDateTime(e.timestamp))}</span>
          </span>
          <span class="chip" style="${added
            ? 'color:var(--fa-cyan);border-color:color-mix(in srgb, var(--fa-cyan) 40%, transparent);background:color-mix(in srgb, var(--fa-cyan) 12%, transparent)'
            : 'color:#FF7A9B;border-color:rgba(255,59,114,.4);background:rgba(255,59,114,.12)'}">
            ${added ? 'AGREGADA' : 'ELIMINADA'}
          </span>
        </div>`;
    }).join('')}</div>`;
  }

  function paint() {
    root.innerHTML = `<div class="screen">${appScaffold('Historial de Cambios', body())}</div>`;
    wireBack(root, 'train');
  }

  paint();
  const off = store.on('history', paint);
  return () => off();
}
