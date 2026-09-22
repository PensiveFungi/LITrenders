/* =========================================================================
   router.js — hash router mirroring the Compose NavHost in MainActivity.kt

   Bottom-tab routes:  train · battles · progress · profile
   Stacked routes:     sessionSetup?presetId= · session · results ·
                       library · rhyme/{key} · history · settings
   ========================================================================= */

const routes = new Map();
let notFound = null;
let currentCleanup = null;
let currentRoute = null;

export const TOP_LEVEL_ROUTES = ['train', 'battles', 'progress', 'profile'];

export function register(pattern, handler) {
  routes.set(pattern, handler);
}

export function setNotFound(handler) {
  notFound = handler;
}

/** Parses "#/rhyme/ADA?x=1" into { path: 'rhyme/ADA', query: URLSearchParams }. */
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, queryString] = raw.split('?');
  return {
    path: path || 'train',
    query: new URLSearchParams(queryString || ''),
  };
}

/** Matches "rhyme/{key}" style patterns and extracts params. */
function matchRoute(path) {
  if (routes.has(path)) return { handler: routes.get(path), params: {} };

  const segments = path.split('/');
  for (const [pattern, handler] of routes) {
    const patternSegments = pattern.split('/');
    if (patternSegments.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < patternSegments.length; i += 1) {
      const p = patternSegments[i];
      if (p.startsWith('{') && p.endsWith('}')) {
        params[p.slice(1, -1)] = decodeURIComponent(segments[i]);
      } else if (p !== segments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

export function navigate(to, { replace = false } = {}) {
  const target = `#/${String(to).replace(/^#?\/?/, '')}`;
  if (window.location.hash === target) {
    render();
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
    render();
  } else {
    window.location.hash = target;
  }
}

export function back(fallback = 'train') {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

export function getCurrentRoute() {
  return currentRoute;
}

export function render() {
  const { path, query } = parseHash();
  const match = matchRoute(path);

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (err) { console.error('[router] cleanup', err); }
    currentCleanup = null;
  }

  currentRoute = path;

  const handler = match ? match.handler : notFound;
  if (!handler) return;

  const result = handler({ params: match ? match.params : {}, query, path });
  if (typeof result === 'function') currentCleanup = result;

  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

export function start() {
  window.addEventListener('hashchange', render);
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#/train');
  }
  render();
}
