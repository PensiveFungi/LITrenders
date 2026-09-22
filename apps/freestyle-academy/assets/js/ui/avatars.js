/* =========================================================================
   avatars.js — port of ui/theme/AvatarStyles.kt

   The catalog, its ids and its order are the app's, and the ids are what a
   profile persists, so they must not change. The first five are the
   free-tier set (PlanEntitlements.FREE_TIER_AVATAR_IDS) and lead the grid;
   the first ten are the quick-pick "featured" set.

   ARTWORK: the app ships 27 bundled 512×512 PNGs. Those live in the Android
   res/ folder and were not part of the source copy this port was built from,
   so the web draws each avatar as a deterministic mark instead — the same id
   always produces the same face, and every id is visually distinct. Drop the
   real artwork into assets/img/avatars/<id>.png and set AVATAR_ART_BASE in
   core/config.js; every avatar in the app then uses it, with the drawn mark
   as the fallback for anything missing.
   ========================================================================= */

import { AVATAR_ART_BASE } from '../core/config.js';

export const AVATARS = [
  // Free-tier avatars, shown first for every account.
  { id: 'avatar_16', label: 'Faraón' },
  { id: 'avatar_17', label: 'Cobra' },
  { id: 'avatar_18', label: 'Zafiro' },
  { id: 'avatar_12', label: 'Eclipse' },
  { id: 'avatar_11', label: 'Trueno' },
  // Plus/Pro avatars (locked on Gratis).
  { id: 'avatar_01', label: 'Ritmo' },
  { id: 'avatar_02', label: 'Brisa' },
  { id: 'avatar_03', label: 'Fuego' },
  { id: 'avatar_04', label: 'Neón' },
  { id: 'avatar_05', label: 'Jade' },
  { id: 'avatar_06', label: 'Oro' },
  { id: 'avatar_07', label: 'Luna' },
  { id: 'avatar_08', label: 'Nébula' },
  { id: 'avatar_09', label: 'Pulso' },
  { id: 'avatar_10', label: 'Vértigo' },
  { id: 'avatar_13', label: 'Sombra' },
  { id: 'avatar_14', label: 'Rima' },
  { id: 'avatar_15', label: 'Barrio' },
  { id: 'avatar_19', label: 'Lírica' },
  { id: 'avatar_20', label: 'Muralla' },
  { id: 'avatar_21', label: 'Tinta' },
  { id: 'avatar_22', label: 'Aura' },
  { id: 'avatar_23', label: 'Relámpago' },
  { id: 'avatar_24', label: 'Cripta' },
  { id: 'avatar_25', label: 'Kaos' },
  { id: 'avatar_26', label: 'Ámbar' },
  { id: 'avatar_27', label: 'Vándalo' },
];

export const FEATURED_COUNT = 10;
export const featuredAvatars = () => AVATARS.slice(0, FEATURED_COUNT);
export const DEFAULT_AVATAR = AVATARS[0];

/** Legacy gradient-style ids, mapped as the app maps them. */
const LEGACY = {
  nova: 'avatar_01', hielo: 'avatar_02', fuego: 'avatar_03',
  neon: 'avatar_04', selva: 'avatar_05', oro: 'avatar_06',
};

export function avatarById(id) {
  const stable = LEGACY[id] || id;
  return AVATARS.find((a) => a.id === stable) || DEFAULT_AVATAR;
}

/* ---------- the drawn mark ---------- */

/** Stable hash of an id, so a given avatar always looks the same. */
function hashOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Two hues a short distance apart. The catalog is walked by the golden angle
 * rather than in equal steps: equal steps put neighbours next to each other in
 * hue, so the ten featured avatars would all land in the same quadrant and
 * read as one colour. 137.5° puts every consecutive pair far apart while still
 * covering the wheel evenly.
 */
function paletteFor(id) {
  const index = Math.max(0, AVATARS.findIndex((a) => a.id === id));
  const h = hashOf(id);
  const hue = Math.round((index * 137.508) % 360);
  const hue2 = (hue + 32 + (h % 40)) % 360;
  return [`hsl(${hue} 76% 60%)`, `hsl(${hue2} 80% 42%)`];
}

/**
 * The avatar's artwork as an <img>-ready source: the real PNG when one is
 * configured, otherwise a drawn SVG data URI.
 */
export function avatarSrc(id) {
  const style = avatarById(id);
  if (AVATAR_ART_BASE) return `${AVATAR_ART_BASE}/${style.id}.png`;
  return `data:image/svg+xml,${encodeURIComponent(avatarSvg(style))}`;
}

function avatarSvg(style) {
  const [a, b] = paletteFor(style.id);
  const h = hashOf(style.id);
  // A different geometric motif per avatar, chosen by the hash, over the
  // id's own gradient — enough for 27 marks that never repeat. No letter:
  // this stands in for artwork, and an initial would read as a monogram of
  // the user's name rather than as the avatar's own mark.
  const motifs = [
    '<circle cx="64" cy="52" r="26" fill="#fff" opacity=".16"/><rect x="26" y="84" width="76" height="34" rx="17" fill="#fff" opacity=".16"/>',
    '<path d="M64 20 104 108H24Z" fill="#fff" opacity=".15"/>',
    '<rect x="28" y="28" width="72" height="72" rx="18" fill="#fff" opacity=".14"/><circle cx="64" cy="64" r="20" fill="#fff" opacity=".18"/>',
    '<path d="M64 18 78 50l34 5-25 24 6 34-29-16-29 16 6-34-25-24 34-5Z" fill="#fff" opacity=".16"/>',
    '<circle cx="46" cy="52" r="20" fill="#fff" opacity=".15"/><circle cx="82" cy="72" r="26" fill="#fff" opacity=".13"/>',
    '<path d="M24 92c0-30 18-52 40-52s40 22 40 52" fill="none" stroke="#fff" stroke-width="10" opacity=".18" stroke-linecap="round"/>',
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="128" height="128" rx="30" fill="url(#g)"/>
    ${motifs[h % motifs.length]}
    ${motifs[(h >> 3) % motifs.length]}
  </svg>`;
}

/** A rendered avatar image element, sized by CSS class. */
export function avatarImage(id, { size = 'md', label = '' } = {}) {
  const style = avatarById(id);
  return `<span class="avatar avatar--art avatar--${size}">
    <img src="${avatarSrc(style.id)}" alt="${label ? `Avatar ${style.label}` : ''}"
         loading="lazy" decoding="async">
  </span>`;
}
