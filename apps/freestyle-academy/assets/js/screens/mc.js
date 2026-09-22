/* =========================================================================
   mc.js — port of ui/screens/McProfileScreen.kt

   One MC's public profile, reached by tapping a name in any Liga table. It is
   built from the table already in memory, so it opens instantly and works on
   whatever was last read — and a uid that isn't in that table renders the
   unreachable state rather than a fabricated profile.

   Only what `clubGlobal/{uid}` publishes is shown. That document is written by
   the Cloud Function triggers and by nothing else, which is what stops a
   client publishing a profile of its own invention.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { loadLeague, leagueCache, auth } from '../core/firebase.js';
import { Leveling, formatPracticeTime } from '../core/domain.js';
import { planDisplayName } from '../core/plans.js';
import { densePositions } from './battles.js';
import { avatarImage } from '../ui/avatars.js';
import {
  esc, icon, appScaffold, wireBack, statTile, emptyState, resetAccent,
} from '../ui/components.js';

export function renderMcProfile(root, { params }) {
  resetAccent();

  const uid = String(params.uid || '');
  let rows = leagueCache.rows;
  let loading = rows.length === 0;

  function profile() {
    const placed = densePositions(rows);
    return placed.find((r) => r.uid === uid) || null;
  }

  function body() {
    if (loading) {
      return `<div class="card row" style="gap:14px">
        <span class="spinner"></span><span class="muted">Cargando…</span>
      </div>`;
    }

    const mc = profile();
    if (!mc) {
      return emptyState('Perfil no disponible',
        'Este MC no aparece en la tabla que se pudo leer. Vuelve a la Liga y prueba otra vez.');
    }

    const info = Leveling.levelFromTotalXp(mc.points || 0);
    const isSelf = mc.uid === auth.user?.uid;

    return `
      <div class="profile-card">
        ${avatarImage(mc.avatarStyleId || 'avatar_16', { size: 'lg' })}
        <div class="grow">
          <p class="profile-card__alias">${esc(mc.alias || 'MC')}</p>
          <p class="profile-card__meta">
            Nivel ${info.level}${mc.crew ? ` · ${esc(mc.crew)}` : ''}
          </p>
          ${mc.punchline ? `<p class="profile-card__punch">“${esc(mc.punchline)}”</p>` : ''}
        </div>
      </div>

      <div class="row row--wrap" style="gap:8px">
        <span class="pill pill--gold">${icon('trophy', { size: 15 })} Puesto ${mc.position}</span>
        ${mc.plan ? `<span class="pill pill--muted">${esc(planDisplayName(mc.plan))}</span>` : ''}
        ${isSelf ? '<span class="pill">Eres tú</span>' : ''}
      </div>

      <div class="stat-grid stat-grid--3">
        ${statTile('XP total', `${mc.points || 0}`, 'spark')}
        ${statTile('Nivel', `${info.level}`, 'crown', 'var(--gold)')}
        ${statTile('Sesiones', mc.totalSessions != null ? `${mc.totalSessions}` : '—', 'mic')}
      </div>

      ${mc.totalPracticeMinutes != null ? `
        <div class="card stack">
          <div class="row row--between">
            <span class="muted">Tiempo en el micro</span>
            <span style="font-weight:700">${esc(formatPracticeTime(mc.totalPracticeMinutes))}</span>
          </div>
        </div>` : ''}

      ${isSelf ? `
        <button class="btn btn--outline" type="button" data-go="profile">
          Editar mi perfil
        </button>` : ''}

      <p class="dim" style="margin:0">
        Esta es la ficha pública de la Liga. Se actualiza sola cuando tu progreso
        se sincroniza.
      </p>`;
  }

  function paint() {
    root.innerHTML = `<div class="screen">${appScaffold(
      profile()?.alias || 'MC', `<div data-slot="body">${body()}</div>`
    )}</div>`;
    wireBack(root, 'battles');
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));
  }

  paint();

  // Self-heals the one case the table can be missing: arriving here directly
  // (a shared link, a reload) with Liga never opened. Same one-shot read.
  if (!store.isAccount) {
    loading = false;
    paint();
  } else {
    loadLeague({ limit: 100 }).then((r) => {
      if (r.length) rows = r;
      loading = false;
      paint();
    });
  }

  return () => {};
}
