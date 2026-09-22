/* =========================================================================
   components.js — shared widgets (ui/components/ + ui/screens/AppScaffold.kt)
   Every helper returns an HTML string unless noted.
   ========================================================================= */

import { icon } from './icons.js';
import { back } from '../core/router.js';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- accent theming ---------- */

/** Applies a mode accent (OfflineAccent) to the CSS custom properties. */
export function applyAccent(accent) {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent?.main || 'var(--purple)');
  root.style.setProperty('--accent-bright', accent?.bright || 'var(--cyan)');
  root.style.setProperty('--on-accent', accent?.onMain || '#FFFFFF');
}

export const DEFAULT_ACCENT = { main: '#7B35FF', bright: '#23D7F2', onMain: '#FFFFFF' };
export const resetAccent = () => applyAccent(DEFAULT_ACCENT);

/* ---------- scaffolding ---------- */

/** The shared top bar for stacked/detail screens (AppScaffold.kt). */
export function appScaffold(title, body, { actions = '', backLabel = 'Volver' } = {}) {
  return `
    <div class="topbar">
      <button class="iconbtn" type="button" data-action="back" aria-label="${esc(backLabel)}">
        ${icon('back')}
      </button>
      <h1 class="topbar__title">${esc(title)}</h1>
      ${actions || '<span class="topbar__spacer"></span>'}
    </div>
    ${body}`;
}

export function wireBack(root, fallback = 'train') {
  root.querySelectorAll('[data-action="back"]').forEach((b) =>
    b.addEventListener('click', () => back(fallback)));
}

export const sectionHead = (title, trailing = '') =>
  `<div class="section__head"><h2 class="section__title">${esc(title)}</h2>${trailing}</div>`;

export const emptyState = (title, message) => `
  <div class="empty">
    <p class="empty__title">${esc(title)}</p>
    <p class="empty__msg">${esc(message)}</p>
  </div>`;

export const notice = (message, { kind = 'info' } = {}) =>
  `<p class="notice ${kind === 'error' ? 'notice--error' : ''}">${icon('info', { size: 17 })}<span>${message}</span></p>`;

/** The "Desbloquea con Plus" card that replaces gated content. */
export const upsell = (title, message, cta = 'Ver planes') => `
  <div class="upsell">
    <p class="upsell__title">${icon('lock', { size: 17 })} ${esc(title)}</p>
    <p class="muted" style="margin:0">${esc(message)}</p>
    <button class="btn btn--primary btn--compact" type="button" data-go="plans">${esc(cta)}</button>
  </div>`;

/* ---------- rows & options ---------- */

export function rowCard({ title, subtitle, iconName = 'mic', locked = false, action = '', value = '' }) {
  return `
    <button class="row-card" type="button" data-action="${esc(action)}" data-value="${esc(value)}"
            data-locked="${locked}" aria-label="${esc(title)}">
      <span class="row-card__icon">${icon(iconName, { size: 22 })}</span>
      <span class="grow">
        <span class="row-card__title" style="display:block">${esc(title)}</span>
        ${subtitle ? `<span class="row-card__sub" style="display:block">${esc(subtitle)}</span>` : ''}
      </span>
      ${locked ? `<span class="lock">${icon('lock', { size: 13 })} Plus</span>`
               : `<span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>`}
    </button>`;
}

export function optionCard(title, {
  subtitle = '', selected = false, value = '', role = 'pressed',
  order = null, draggable = false, disabled = false,
} = {}) {
  const state = role === 'checked'
    ? `role="radio" aria-checked="${selected}"`
    : `aria-pressed="${selected}"`;
  return `
    <button class="option" type="button" data-value="${esc(value || title)}" ${state}
            ${disabled ? 'disabled' : ''}>
      ${draggable ? `<span class="drag-handle" data-drag aria-hidden="true">${icon('drag', { size: 20 })}</span>` : ''}
      ${order != null ? `<span class="option__order">${order}</span>` : ''}
      <span class="grow">
        <span class="option__title" style="display:block">${esc(title)}</span>
        ${subtitle ? `<span class="option__sub" style="display:block">${esc(subtitle)}</span>` : ''}
      </span>
      <span class="option__mark">${icon('checkCircle', { size: 22 })}</span>
    </button>`;
}

/* ---------- progress & stats ---------- */

export function progressBar(value, { thin = false } = {}) {
  const pct = Math.round(Math.min(1, Math.max(0, value || 0)) * 100);
  return `<div class="bar ${thin ? 'bar--thin' : ''}" role="progressbar"
    aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
}

export const statTile = (label, value, iconName, accent = 'var(--accent-bright)') => `
  <div class="stat-tile">
    <span style="color:${accent}">${icon(iconName, { size: 22 })}</span>
    <span class="stat-tile__value">${esc(value)}</span>
    <span class="stat-tile__label">${esc(label)}</span>
  </div>`;

/**
 * The last-7-days line graph (Progresión, and one MC profile against another).
 * A flat zero line is an honest zero, not a missing series.
 */
export function weekGraph(series, { labels = [], height = 128 } = {}) {
  const W = 300;
  const H = height;
  const pad = 10;
  const all = series.flatMap((s) => s.points);
  const max = Math.max(1, ...all);
  const n = Math.max(1, (series[0]?.points.length || 1) - 1);
  const x = (i) => pad + (i * (W - pad * 2)) / n;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);

  const paths = series.map((s) => {
    const d = s.points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const dots = s.points.map((v, i) =>
      `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${s.color}"/>`).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4"
              stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join('');

  const desc = series.map((s) => `${s.label}: ${s.points.join(', ')}`).join('. ');
  return `
    <svg class="week-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
         role="img" aria-label="${esc(desc)}">${paths}</svg>
    ${labels.length ? `<div class="week-graph__labels">${labels.map((l) => `<span>${esc(l)}</span>`).join('')}</div>` : ''}`;
}

export function achievementRow(a) {
  let state = '';
  if (!a.unlocked) {
    if (a.accountOnly) state = 'Con cuenta';
    else if (a.plusOnly) state = 'Con Plus';
    else state = 'Pendiente';
  }
  return `
    <div class="achv" data-locked="${!a.unlocked}">
      <span class="achv__badge">${icon(a.unlocked ? 'medal' : 'trophy', { size: 21 })}</span>
      <div class="grow">
        <div class="achv__title">${esc(a.title)}</div>
        <div class="achv__desc">${esc(a.description)}</div>
      </div>
      ${a.unlocked
        ? `<span style="color:var(--gold)">${icon('check', { size: 19 })}</span>`
        : `<span class="achv__state">${esc(state)}</span>`}
    </div>`;
}

export const summaryRows = (pairs) =>
  `<dl style="margin:0">${pairs.map(([k, v]) =>
    `<div class="summary-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

export function avatar(alias, { src = '', size = '' } = {}) {
  const initials = String(alias || 'MC').split(/\s+/).map((p) => p[0]).filter(Boolean)
    .slice(0, 2).join('').toUpperCase() || 'MC';
  const inner = src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : esc(initials);
  return `<span class="avatar ${size === 'sm' ? 'avatar--sm' : ''}">${inner}</span>`;
}

/* ---------- toast & dialogs ---------- */

let toastHost = null;

export function toast(message, { duration = 2600 } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function dialogShell(innerHtml, onMount) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = innerHtml;
  document.body.appendChild(backdrop);
  onMount?.(backdrop);
  return backdrop;
}

export function promptDialog({ title, label, placeholder = '', confirmText = 'Guardar', initial = '', maxLength = 60 }) {
  return new Promise((resolve) => {
    const el = dialogShell(`
      <div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="dialog__title">${esc(title)}</h2>
        <div class="field">
          <label class="field__label" for="dlg-input">${esc(label)}</label>
          <input class="input" id="dlg-input" type="text" maxlength="${maxLength}"
                 placeholder="${esc(placeholder)}" value="${esc(initial)}" autocomplete="off">
        </div>
        <div class="btn-row">
          <button class="btn btn--outline btn--compact" type="button" data-dlg="cancel">Cancelar</button>
          <button class="btn btn--primary btn--compact" type="button" data-dlg="ok">${esc(confirmText)}</button>
        </div>
      </div>`);
    const input = el.querySelector('#dlg-input');
    const close = (v) => { el.remove(); resolve(v); };
    el.querySelector('[data-dlg="ok"]').addEventListener('click', () => close(input.value));
    el.querySelector('[data-dlg="cancel"]').addEventListener('click', () => close(null));
    el.addEventListener('click', (e) => { if (e.target === el) close(null); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') close(input.value);
    });
    input.focus(); input.select();
  });
}

export function confirmDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false, bullets = [] }) {
  return new Promise((resolve) => {
    const el = dialogShell(`
      <div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="dialog__title">${esc(title)}</h2>
        <p class="muted" style="margin:0">${esc(message)}</p>
        ${bullets.length ? `<ul class="muted" style="margin:0;padding-left:18px">${
          bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        <div class="btn-row">
          <button class="btn btn--outline btn--compact" type="button" data-dlg="cancel">${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'} btn--compact" type="button" data-dlg="ok">${esc(confirmText)}</button>
        </div>
      </div>`);
    const close = (v) => { el.remove(); resolve(v); };
    el.querySelector('[data-dlg="ok"]').addEventListener('click', () => close(true));
    el.querySelector('[data-dlg="cancel"]').addEventListener('click', () => close(false));
    el.addEventListener('click', (e) => { if (e.target === el) close(false); });
    el.querySelector('[data-dlg="cancel"]').focus();
  });
}

export { icon };
