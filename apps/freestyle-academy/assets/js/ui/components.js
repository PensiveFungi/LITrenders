/* =========================================================================
   components.js — shared widgets (port of ui/components/ + ui/session/)
   Every helper returns an HTML string unless noted otherwise.
   ========================================================================= */

import { icon } from './icons.js';
import { styleForModeId } from '../data/modes.js';
import { back } from '../core/router.js';

/** Escapes user-supplied text before it reaches innerHTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Mode theming ---------- */

/** Applies a mode's palette to the CSS custom properties driving the screen. */
export function applyModeTheme(modeId) {
  const style = styleForModeId(modeId);
  const root = document.documentElement;
  root.style.setProperty('--mode-primary', style.palette.primary);
  root.style.setProperty('--mode-secondary', style.palette.secondary);
  root.style.setProperty('--mode-highlight', style.palette.highlight);
  if (!root.dataset.theme || root.dataset.theme === 'dark') {
    root.style.setProperty('--mode-bg', style.palette.bg);
  }
  return style;
}

export function resetModeTheme() {
  applyModeTheme('libre');
}

/* ---------- Layout ---------- */

export function appScaffold(title, bodyHtml, { actions = '' } = {}) {
  return `
    <div class="topbar">
      <button class="iconbtn" data-action="back" aria-label="Volver">${icon('back')}</button>
      <h1 class="topbar__title">${esc(title)}</h1>
      ${actions || '<span style="width:48px"></span>'}
    </div>
    ${bodyHtml}
  `;
}

/** Wires every [data-action="back"] button in the current screen. */
export function wireBack(root, fallback = 'train') {
  root.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener('click', () => back(fallback));
  });
}

export function sectionHead(title, trailing = '') {
  return `<div class="section__head"><h2 class="section__title">${esc(title)}</h2>${trailing}</div>`;
}

export function emptyState(title, message) {
  return `
    <div class="empty">
      <p class="empty__title">${esc(title)}</p>
      <p class="empty__msg">${esc(message)}</p>
    </div>`;
}

export function notice(message) {
  return `<p class="notice">${icon('info', { size: 18 })}<span>${message}</span></p>`;
}

/* ---------- Mode widgets ---------- */

export function modeHero(style, { asButton = false, modeId = '' } = {}) {
  const tag = asButton ? 'button' : 'div';
  const attrs = asButton
    ? `type="button" data-mode="${esc(modeId)}" aria-label="Abrir modo ${esc(style.title)}"`
    : '';
  return `
    <${tag} class="hero" ${attrs}>
      <span class="hero__icon">${icon(style.icon, { size: 28 })}</span>
      <span class="grow">
        <span class="hero__title display" style="display:block">${esc(style.title.toUpperCase())}</span>
        <span class="hero__sub" style="display:block">${esc(style.subtitle)}</span>
        <span class="hero__desc" style="display:block">${esc(style.oneLineDescription)}</span>
      </span>
    </${tag}>`;
}

export function modeRow(preset) {
  const style = styleForModeId(preset.id);
  return `
    <button class="mode-row" type="button" data-mode="${esc(preset.id)}"
            aria-label="Abrir modo ${esc(preset.displayName)}">
      <span class="mode-row__icon" style="background:linear-gradient(135deg, ${style.palette.primary}, ${style.palette.highlight})">
        ${icon(style.icon, { size: 22 })}
      </span>
      <span class="mode-row__body">
        <span class="mode-row__title" style="display:block">${esc(preset.displayName)}</span>
        <span class="mode-row__sub" style="display:block">${esc(preset.description)}</span>
      </span>
      <span class="mode-row__arrow">${icon('arrow', { size: 20 })}</span>
    </button>`;
}

export function metaRow(items) {
  return `<div class="meta-row">${items
    .map(
      ([label, value]) => `
      <div class="meta-tile">
        <div class="meta-tile__label">${esc(label)}</div>
        <div class="meta-tile__value">${esc(value)}</div>
      </div>`
    )
    .join('')}</div>`;
}

export function optionCard(title, { subtitle = '', selected = false, value = '', role = 'pressed' } = {}) {
  const stateAttr = role === 'checked'
    ? `role="radio" aria-checked="${selected}"`
    : `aria-pressed="${selected}"`;
  return `
    <button class="option" type="button" data-value="${esc(value || title)}" ${stateAttr}>
      <span class="grow">
        <span class="option__title" style="display:block">${esc(title)}</span>
        ${subtitle ? `<span class="option__sub" style="display:block">${esc(subtitle)}</span>` : ''}
      </span>
      <span class="option__check">${icon('checkCircle', { size: 22 })}</span>
    </button>`;
}

/* ---------- Session widgets ---------- */

export function sessionHeader(style, currentRound, totalRounds, status) {
  let roundLabel;
  if (style.modeId === 'incremental') roundLabel = `Etapa ${currentRound} de ${totalRounds}`;
  else if (style.modeId === 'libre') roundLabel = 'Sesión libre';
  else roundLabel = `Ronda ${currentRound} de ${totalRounds}`;
  const live = /vivo/i.test(status);
  return `
    <div class="session-head">
      <h1 class="session-head__title display">${esc(style.title.toUpperCase())}</h1>
      <p class="session-head__sub">${esc(style.subtitle)}</p>
      <div class="session-head__meta">
        <span>${esc(roundLabel)}</span>
        <span class="session-head__status" data-live="${live}">${esc(status.toUpperCase())}</span>
      </div>
    </div>`;
}

export function roundProgress(current, total) {
  const cells = Array.from({ length: Math.max(1, total) }, (_, i) =>
    `<span data-done="${i < current}"></span>`
  ).join('');
  return `<div class="round-progress" role="img" aria-label="Ronda ${current} de ${total}">${cells}</div>`;
}

const RING_RADIUS = 82;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** The ring markup, kept in one place so the countdown can swap back to it. */
function timerRingMarkup() {
  return `
    <div class="timer-ring">
      <svg viewBox="0 0 176 176" aria-hidden="true">
        <circle cx="88" cy="88" r="${RING_RADIUS}" fill="none"
          stroke="color-mix(in srgb, var(--mode-primary) 16%, transparent)" stroke-width="13"/>
        <circle data-timer-arc cx="88" cy="88" r="${RING_RADIUS}" fill="none"
          stroke="url(#timerGradient)" stroke-width="13" stroke-linecap="round"
          stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="0"/>
        <defs>
          <linearGradient id="timerGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--mode-primary)"/>
            <stop offset="50%" stop-color="var(--mode-secondary)"/>
            <stop offset="100%" stop-color="var(--mode-highlight)"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="timer-ring__inner">
        <div class="timer-ring__label">TIEMPO</div>
        <div class="timer-ring__value" data-timer-value role="timer" aria-live="off">0:00</div>
      </div>
    </div>`;
}

export function timerCard(style) {
  return `
    <div class="timer-card">
      <span class="timer-card__badge">${esc(style.badgeLabel)}</span>
      <div data-timer-body>${timerRingMarkup()}</div>
      <div class="audio-bars" data-audio-bars aria-hidden="true">
        ${Array.from({ length: 21 }, () => '<span></span>').join('')}
      </div>
      <p class="timer-card__caption">${esc(style.timerLabel)}</p>
    </div>`;
}

/** Updates the timer ring in place — no re-render, so the countdown stays smooth. */
export function updateTimer(root, { seconds, progress, countdown, formatted }) {
  const body = root.querySelector('[data-timer-body]');
  if (!body) return;

  if (countdown != null) {
    if (body.dataset.countdown !== 'true') {
      body.dataset.countdown = 'true';
      body.innerHTML = `<div class="timer-card__countdown display" role="timer"
        aria-live="assertive" aria-label="Empieza en ${countdown}">${countdown}</div>`;
    } else {
      const el = body.firstElementChild;
      el.textContent = String(countdown);
      el.setAttribute('aria-label', `Empieza en ${countdown}`);
    }
    return;
  }

  if (body.dataset.countdown === 'true') {
    delete body.dataset.countdown;
    body.innerHTML = timerRingMarkup();
  }

  const value = body.querySelector('[data-timer-value]');
  const arc = body.querySelector('[data-timer-arc]');
  if (value) {
    value.textContent = formatted;
    value.setAttribute('aria-label', `${seconds} segundos restantes`);
  }
  if (arc) {
    const clamped = Math.min(1, Math.max(0, progress));
    arc.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * (1 - clamped)));
  }
}

export function updateAudioBars(root, amplitude) {
  const host = root.querySelector('[data-audio-bars]');
  if (!host) return;
  const bars = host.children;
  const mid = (bars.length - 1) / 2;
  for (let i = 0; i < bars.length; i += 1) {
    const falloff = 1 - Math.abs(i - mid) / (mid + 1);
    const jitter = 0.72 + Math.random() * 0.28;
    const height = Math.max(8, Math.min(100, amplitude * 100 * falloff * jitter));
    bars[i].style.height = `${height}%`;
  }
}

export function stimulusPanel(style, { featured, rhymeKey, chips, sceneSvg = '', showAction = true }) {
  const long = String(featured).length > 12;
  return `
    <div class="stimulus">
      <div class="stimulus__bar">
        <span class="stimulus__brand">FREESTYLE ACADEMY</span>
        ${showAction
          ? `<button class="iconbtn" type="button" data-action="reset-section" aria-label="Cambiar estímulo">${icon('refresh', { size: 20 })}</button>`
          : '<span></span>'}
      </div>
      ${sceneSvg ? `<div class="stimulus__scene">${sceneSvg}</div>` : ''}
      <p class="stimulus__label">${esc(style.stimulusLabel)}</p>
      <p class="stimulus__word display" data-long="${long}" data-stimulus-word>${esc(String(featured).toUpperCase())}</p>
      ${rhymeKey ? `<p class="stimulus__key">-${esc(rhymeKey)}</p>` : ''}
      <div class="chip-row">${(chips || []).slice(0, 3).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    </div>`;
}

export function wordPool(words) {
  if (!words || words.length === 0) return '';
  return `
    <div class="word-pool" data-word-pool>
      ${words
        .map((w, i) => `<button class="word-chip" type="button" data-word-index="${i}"
                          aria-label="Cambiar la palabra ${esc(w)}">${esc(w)}</button>`)
        .join('')}
    </div>`;
}

export function micControl(style) {
  return `
    <div class="mic-control">
      <button class="mic-btn" type="button" data-action="mic" data-active="false"
              aria-label="Control de micrófono">${icon('mic', { size: 42 })}</button>
      <div class="grow">
        <div class="mic-control__title" data-mic-title>${esc(style.micTitle)}</div>
        <div class="mic-control__hint">${esc(style.micHint)}</div>
      </div>
    </div>`;
}

export function sessionActionBar(primaryText, secondaryText, { secondaryEnabled = true } = {}) {
  return `
    <div class="btn-row">
      <button class="btn btn--outline" type="button" data-action="next"
        ${secondaryEnabled ? '' : 'disabled'}>${esc(secondaryText)}</button>
      <button class="btn btn--primary" type="button" data-action="complete">${esc(primaryText)}</button>
    </div>`;
}

/** Abstract scene for the "Imágenes" mode, drawn from VisualScene values. */
export function imageStimulusScene(stimulus) {
  if (!stimulus) return '';
  const { skyColor, horizonColor, accentColor, moon } = stimulus.scene;
  const buildings = [
    [10, 62, 22, 38], [36, 48, 18, 52], [58, 56, 16, 44], [78, 40, 20, 60],
  ]
    .map(([x, y, w, h]) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${horizonColor}" opacity="0.94"/>`)
    .join('');
  return `
    <svg viewBox="0 0 120 100" preserveAspectRatio="none" style="width:100%;height:100%"
         role="img" aria-label="${esc(stimulus.accessibleDescription)}">
      <defs>
        <linearGradient id="sky-${stimulus.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skyColor}"/>
          <stop offset="100%" stop-color="${horizonColor}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="100" fill="url(#sky-${stimulus.id})"/>
      ${moon ? `<circle cx="94" cy="20" r="9" fill="${accentColor}" opacity="0.85"/>` : ''}
      <circle cx="26" cy="26" r="18" fill="${accentColor}" opacity="0.22"/>
      ${buildings}
      <rect x="0" y="86" width="120" height="14" fill="${accentColor}" opacity="0.32"/>
      <rect x="56" y="86" width="8" height="14" fill="${accentColor}" opacity="0.7"/>
    </svg>`;
}

/* ---------- Progress widgets ---------- */

export function progressBar(value, { thin = false } = {}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `<div class="bar ${thin ? 'bar--thin' : ''}" role="progressbar"
    aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
}

export function statTile(label, value, iconName, accent = 'var(--mode-secondary)') {
  return `
    <div class="stat-tile">
      <span style="color:${accent}">${icon(iconName, { size: 24 })}</span>
      <span class="stat-tile__value">${esc(value)}</span>
      <span class="stat-tile__label">${esc(label)}</span>
    </div>`;
}

export function weeklyChart(weekly) {
  const max = Math.max(1, ...weekly.map((w) => w.score));
  return `
    <div class="week-chart" role="img"
         aria-label="XP por día: ${weekly.map((w) => `${w.day} ${w.score}`).join(', ')}">
      ${weekly
        .map(
          (w) => `
        <div class="week-chart__col">
          <div class="week-chart__bar" style="height:${Math.round((w.score / max) * 100)}%"></div>
          <div class="week-chart__day">${esc(w.day)}</div>
        </div>`
        )
        .join('')}
    </div>`;
}

export function achievementRow(a) {
  return `
    <div class="achv" data-locked="${!a.unlocked}">
      <span class="achv__badge">${icon(a.unlocked ? 'medal' : 'trophy', { size: 22 })}</span>
      <div class="grow">
        <div class="achv__title">${esc(a.title)}</div>
        <div class="achv__desc">${esc(a.description)}</div>
      </div>
      ${a.unlocked ? `<span style="color:var(--fa-gold)">${icon('check', { size: 20 })}</span>` : ''}
    </div>`;
}

export function summaryRows(pairs) {
  return `<dl style="margin:0">${pairs
    .map(([k, v]) => `<div class="summary-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>`;
}

/* ---------- Toast & dialog ---------- */

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
  window.setTimeout(() => el.remove(), duration);
}

/** Promise-based dialog. Resolves with the typed value, or null on cancel. */
export function prompt({ title, label, placeholder = '', confirmText = 'Guardar', initial = '' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="dialog__title">${esc(title)}</h2>
        <div class="field">
          <label class="field__label" for="dlg-input">${esc(label)}</label>
          <input class="input" id="dlg-input" type="text" placeholder="${esc(placeholder)}"
                 value="${esc(initial)}" autocomplete="off">
        </div>
        <div class="btn-row">
          <button class="btn btn--outline" type="button" data-dlg="cancel">Cancelar</button>
          <button class="btn btn--primary" type="button" data-dlg="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#dlg-input');
    const close = (value) => { backdrop.remove(); resolve(value); };

    backdrop.querySelector('[data-dlg="ok"]').addEventListener('click', () => close(input.value));
    backdrop.querySelector('[data-dlg="cancel"]').addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') close(input.value);
    });
    input.focus();
    input.select();
  });
}

export function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="dialog__title">${esc(title)}</h2>
        <p class="muted">${esc(message)}</p>
        <div class="btn-row">
          <button class="btn btn--outline" type="button" data-dlg="cancel">Cancelar</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" type="button" data-dlg="ok">${esc(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const close = (v) => { backdrop.remove(); resolve(v); };
    backdrop.querySelector('[data-dlg="ok"]').addEventListener('click', () => close(true));
    backdrop.querySelector('[data-dlg="cancel"]').addEventListener('click', () => close(false));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
    backdrop.querySelector('[data-dlg="cancel"]').focus();
  });
}

export { icon };
