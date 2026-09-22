/* =========================================================================
   icons.js — line icons, 1.8px strokes, rounded corners
   (Brand Guidelines v2.0 → "Estilo de iconos")
   ========================================================================= */

const P = (d) => `<path d="${d}"/>`;

const PATHS = {
  // Navigation
  dumbbell: P('M6.5 6.5v11M3 9v6M17.5 6.5v11M21 9v6M6.5 12h11'),
  trophy: P('M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 19h6M12 14v5'),
  chart: P('M4 19V5M4 19h16M8 19v-6M12 19v-9M16 19v-4'),
  person: P('M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6'),

  // Actions
  back: P('M15 19l-7-7 7-7'),
  arrow: P('M9 5l7 7-7 7'),
  close: P('M6 6l12 12M18 6L6 18'),
  refresh: P('M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5'),
  search: P('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4'),
  plus: P('M12 5v14M5 12h14'),
  minus: P('M5 12h14'),
  trash: P('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
  settings: P('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.5 2 2 0 1 1 14 4.5a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7 2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.2.9Z'),
  bell: P('M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M13.7 20a2 2 0 0 1-3.4 0'),
  share: P('M12 3v13M8 7l4-4 4 4M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'),
  check: P('M20 6L9 17l-5-5'),
  checkCircle: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.5l2.5 2.5 4.5-5'),
  logout: P('M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6'),
  google: P('M21 12.2c0-.7-.1-1.3-.2-2H12v3.8h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.2 2.7-7.1ZM12 21.5c2.5 0 4.6-.8 6.2-2.2l-3.1-2.4c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.2-3.8H3.6v2.5A9.4 9.4 0 0 0 12 21.5ZM6.8 14a5.6 5.6 0 0 1 0-3.6V7.9H3.6a9.4 9.4 0 0 0 0 8.4L6.8 14ZM12 6.3c1.4 0 2.6.5 3.5 1.4l2.7-2.7A9.3 9.3 0 0 0 3.6 7.9l3.2 2.5C7.6 8.2 9.6 6.3 12 6.3Z'),

  // Content
  library: P('M4 5v14a1 1 0 0 0 1 1h4V4H5a1 1 0 0 0-1 1ZM9 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9M17.5 5.5l2.4 13.2'),
  history: P('M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3.5 2'),
  flame: P('M12 22c3.9 0 6.5-2.5 6.5-6 0-4.5-4.5-6-4-10.5C12 7 10 8 10 10.5 8.8 9.8 8 8.5 8 7c-1.5 1.5-2.5 3.6-2.5 6 0 3.6 2.6 9 6.5 9Z'),
  clock: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2'),
  mic: P('M12 15a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v5.5A3.5 3.5 0 0 0 12 15ZM19 11.5a7 7 0 0 1-14 0M12 18.5V22M9 22h6'),
  bolt: P('M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z'),
  crown: P('M4 18h16M4 18L3 7l5 4 4-6 4 6 5-4-1 11'),
  spark: P('M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z'),
  leaf: P('M20 4C9.5 4 4 9 4 16v4M20 4c0 8-5 12-12 12'),
  steps: P('M4 20h4v-4h4v-4h4V8h4'),
  topic: P('M4 5h16M4 10h16M4 15h10M4 20h7'),
  text: P('M5 6V4h14v2M12 4v16M9 20h6'),
  image: P('M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6ZM9 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 16l4.5-4 4 3.5L16 12l4 4'),
  scoreboard: P('M4 5h16v11H4zM8 20h8M12 16v4M8 9v4M12 8v5M16 10v3'),
  medal: P('M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM8.5 13L7 21l5-2.5L17 21l-1.5-8'),
  pause: P('M9 5v14M15 5v14'),
  play: P('M7 4.5v15l12-7.5-12-7.5Z'),
  info: P('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01'),
  sun: P('M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'),
  moon: P('M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'),
  swords: P('M4 4h4l10 10M4 20l10-10M16 20h4v-4M4 8V4M14.5 14.5L20 20'),
  waveform: P('M3 12h2M7 8v8M11 5v14M15 8v8M19 11h2'),
};

/**
 * Renders an icon as an inline SVG string.
 * Icons are decorative by default; pass a `title` when the icon carries meaning.
 */
export function icon(name, { size = 24, title = null, className = '' } = {}) {
  const d = PATHS[name] || PATHS.info;
  const a11y = title
    ? `role="img" aria-label="${title}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg ${a11y} class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
