/* =========================================================================
   battles.js — port of ui/screens/BattlesScreen.kt (the "Liga" tab)

   Freestyle League's ranking tables plus the parked "Batalla Online" entry.
   Rows are numbered with dense positions: equal points share a place and the
   next distinct score takes the next number, so a row's position is NOT its
   index. Ties are ordered by who reached those points first.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { loadLeague, auth } from '../core/firebase.js';
import { PlanEntitlements, ONLINE_BATTLES_LAUNCHED, planDisplayName } from '../core/plans.js';
import { Leveling } from '../core/domain.js';
import {
  esc, icon, sectionHead, emptyState, resetAccent, avatar, rowCard,
} from '../ui/components.js';

/**
 * Dense positions: 100, 70, 70, 50 → 1, 2, 2, 3.
 * A shared position still has an order — tied MCs are listed by who reached
 * those points first (pointsAt), an unknown moment sorting last.
 */
export function densePositions(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const at = (r) => (Number(r.pointsAt) > 0 ? Number(r.pointsAt) : Number.MAX_SAFE_INTEGER);
    if (at(a) !== at(b)) return at(a) - at(b);
    return String(a.uid).localeCompare(String(b.uid));
  });
  let position = 0;
  let lastPoints = null;
  return sorted.map((row) => {
    if (row.points !== lastPoints) { position += 1; lastPoints = row.points; }
    return { ...row, position };
  });
}

export function renderBattles(root) {
  resetAccent();

  let tab = 'global';
  let rows = [];
  let loading = false;
  let loaded = false;

  function selfRow() {
    if (!store.isAccount) return null;
    return {
      uid: auth.user?.uid,
      alias: store.displayAlias,
      crew: store.profile.crew || '',
      plan: store.planTier,
      points: store.progress.totalXp,
      pointsAt: store.progress.pointsReachedAtMillis,
      isSelf: true,
    };
  }

  function tableHtml() {
    if (!store.isAccount) {
      return `
        <div class="upsell">
          <p class="upsell__title">${icon('trophy', { size: 17 })} La Liga es para cuentas</p>
          <p class="muted" style="margin:0">
            La tabla se arma con las cuentas de la Freestyle League. Entra con la
            tuya para aparecer en ella.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="login">
            Iniciar sesión
          </button>
        </div>`;
    }

    if (loading) {
      return `<div class="card row" style="gap:14px">
        <span class="spinner"></span><span class="muted">Cargando la tabla…</span>
      </div>`;
    }

    const mine = selfRow();
    const merged = rows.some((r) => r.uid === mine?.uid) || !mine ? rows : [...rows, mine];
    if (merged.length === 0) {
      return emptyState(
        loaded ? 'La tabla está vacía' : 'Sin conexión con la Liga',
        loaded
          ? 'Todavía no hay MCs con puntos publicados. Entrena para ser el primero.'
          : 'No se pudo leer la tabla. Revisa tu conexión y vuelve a intentarlo.'
      );
    }

    const placed = densePositions(merged);
    const filtered = tab === 'crew'
      ? placed.filter((r) => r.crew && r.crew === store.profile.crew)
      : placed;

    if (filtered.length === 0) {
      return emptyState('Sin crew todavía',
        'Añade tu crew en tu perfil para ver aquí a quienes comparten sus siglas.');
    }

    return `<div class="list">${filtered.slice(0, 50).map((r) => {
      const level = Leveling.levelFromTotalXp(r.points || 0).level;
      const isSelf = r.uid === mine?.uid;
      return `
        <button class="rank-row" type="button" data-uid="${esc(r.uid)}" data-self="${isSelf}">
          <span class="rank-row__pos">${r.position}</span>
          ${avatar(r.alias || 'MC', { size: 'sm' })}
          <span class="grow">
            <span class="rank-row__name" style="display:block">${esc(r.alias || 'MC')}</span>
            <span class="rank-row__meta" style="display:block">
              Nivel ${level}${r.crew ? ` · ${esc(r.crew)}` : ''}
            </span>
          </span>
          <span class="rank-row__pts">${r.points || 0}</span>
        </button>`;
    }).join('')}</div>`;
  }

  function view() {
    return `
      <div class="home-head">
        <div class="grow">
          <h1>Liga</h1>
          <p>Freestyle League · ${esc(planDisplayName(store.planTier))}</p>
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button role="tab" aria-selected="${tab === 'global'}" data-tab="global">Global</button>
        <button role="tab" aria-selected="${tab === 'ligas'}" data-tab="ligas">Ligas</button>
        <button role="tab" aria-selected="${tab === 'crew'}" data-tab="crew">Tu Crew</button>
      </div>

      <div data-slot="table">${tableHtml()}</div>

      <div class="section">
        ${sectionHead('Batallas')}
        <div class="list">
          ${rowCard({
            title: 'Master Serie',
            subtitle: 'Disciplina · Métrica · Competencia — batalla en este dispositivo.',
            iconName: 'scoreboard',
            action: 'battle',
            value: 'master_serie',
          })}
          ${rowCard({
            title: 'Gallos',
            subtitle: 'Energía · Escenario · Legado — batalla en este dispositivo.',
            iconName: 'bolt',
            action: 'battle',
            value: 'gallos',
          })}
          <div class="row-card" data-locked="true" style="cursor:default">
            <span class="row-card__icon" style="background:var(--surface-high)">
              ${icon('users', { size: 22 })}
            </span>
            <span class="grow">
              <span class="row-card__title" style="display:block">Batalla Online</span>
              <span class="row-card__sub" style="display:block">Contra MCs de toda la liga.</span>
            </span>
            <span class="lock">
              ${!PlanEntitlements.canAccessOnlineBattles(store.planTier)
                && store.planTier === 'FREE' ? icon('lock', { size: 13 }) : ''}
              Próximamente
            </span>
          </div>
        </div>
        ${!ONLINE_BATTLES_LAUNCHED ? `
          <p class="dim" style="margin:0">
            Las batallas online todavía no existen para ningún plan. Las de este
            dispositivo sí funcionan.
          </p>` : ''}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wire();
  }

  function wire() {
    root.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => { tab = b.dataset.tab; paint(); }));

    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    root.querySelectorAll('[data-action="battle"]').forEach((el) =>
      el.addEventListener('click', () =>
        navigate(`battleRoom?presetId=${encodeURIComponent(el.dataset.value)}`)));

    root.querySelectorAll('[data-uid]').forEach((el) =>
      el.addEventListener('click', () =>
        navigate(`mc/${encodeURIComponent(el.dataset.uid)}`)));
  }

  async function refresh() {
    if (!store.isAccount) { paint(); return; }
    loading = true; paint();
    rows = await loadLeague({ limit: 100 });
    loading = false; loaded = true;
    paint();
  }

  paint();
  refresh();

  const off = [store.on('scope', refresh), store.on('progress', paint)];
  return () => off.forEach((f) => f());
}
