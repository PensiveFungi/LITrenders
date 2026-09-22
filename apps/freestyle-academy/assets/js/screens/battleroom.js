/* =========================================================================
   battleroom.js — port of MasterSerieFlowScreen.kt / GallosFlowScreen.kt and
   the shared OfflineTeamPicker.

   A battle on ONE device: build the lineup, pick and order the rounds, pick
   the beat, then hand the phone around. Both modes are the same screen with
   their own pool, their own temática list and their own accent — a single
   session architecture with the mode-specific theme defined centrally, not a
   second copy of the flow.

   Minuto Libre is pre-selected and first, so a battle can start right away.
   ========================================================================= */

import { store } from '../core/store.js';
import { back, navigate } from '../core/router.js';
import { battleModeById, battleRoundFrom, MAX_TEAM_MEMBERS } from '../data/rounds.js';
import { offlineBattleConfig, participant, OFFLINE_MAX_PARTICIPANTS } from '../core/battle.js';
import { availableBeats, beatDisplayName } from '../core/audio.js';
import { PlanEntitlements } from '../core/plans.js';
import {
  esc, icon, appScaffold, wireBack, optionCard, toast, notice,
  applyAccent, promptDialog,
} from '../ui/components.js';
import { mountFlow } from './flow.js';

export function renderBattleRoom(root, { query }) {
  const mode = battleModeById(query.get('presetId'));
  if (!mode) { navigate('train', { replace: true }); return () => {}; }

  applyAccent(mode.accent);

  let teardown = null;
  let names = [store.displayAlias || 'MC 1', 'MC 2'];
  let selected = ['MINUTO_LIBRE'];
  let beats = [];
  let showBeatPicker = false;

  function beatSummary() {
    if (availableBeats().length === 0) return 'Sin pistas disponibles';
    if (beats.length === 0) return 'Aleatorio';
    if (beats.length === 1) return beatDisplayName(beats[0]);
    return `${beats.length} pistas en orden`;
  }

  function lineupHtml() {
    return `
      <div class="list" data-group="lineup">
        ${names.map((n, i) => `
          <div class="row-card" style="cursor:default">
            <span class="row-card__icon">${icon('person', { size: 22 })}</span>
            <span class="grow">
              <span class="row-card__title" style="display:block">${esc(n)}</span>
              <span class="row-card__sub" style="display:block">Participante ${i + 1}</span>
            </span>
            <button class="iconbtn iconbtn--sm" type="button" data-rename="${i}"
                    aria-label="Cambiar el nombre de ${esc(n)}">${icon('text', { size: 18 })}</button>
            ${names.length > 2 ? `
              <button class="iconbtn iconbtn--sm" type="button" data-drop="${i}"
                      aria-label="Quitar a ${esc(n)}">${icon('close', { size: 18 })}</button>` : ''}
          </div>`).join('')}
      </div>
      ${names.length < OFFLINE_MAX_PARTICIPANTS ? `
        <button class="btn btn--ghost btn--compact" type="button" data-action="add-mc">
          ${icon('plus', { size: 17 })} Añadir participante
        </button>` : ''}`;
  }

  function beatPickerHtml() {
    const all = availableBeats();
    if (all.length === 0) return '';
    return `
      <div class="card stack" style="gap:10px">
        <p class="dim" style="margin:0">
          Sin selección suena en aleatorio. Una pista se repite; varias suenan en
          orden y vuelven a empezar.
        </p>
        <div class="list" data-group="beats">
          ${all.map((f) => {
            const order = beats.indexOf(f);
            return optionCard(beatDisplayName(f), {
              selected: order >= 0, value: f, order: order >= 0 ? order + 1 : null,
            });
          }).join('')}
        </div>
        <button class="btn btn--outline btn--compact" type="button" data-action="clear-beats">
          ${icon('shuffle', { size: 17 })} Aleatorio
        </button>
      </div>`;
  }

  function view() {
    const canRecord = PlanEntitlements.canRecordSessions(store.planTier) && store.isAccount;
    return `
      <div class="screen">
        ${appScaffold(mode.modeTitle, `
          <p class="muted" style="margin:0">${esc(mode.subtitle)}. Se juega en este
            dispositivo: el micro pasa de mano en mano.</p>

          <div class="section">
            <div class="section__head">
              <h2 class="section__title">Participantes</h2>
              <span class="dim">${names.length}</span>
            </div>
            ${lineupHtml()}
          </div>

          <div class="section">
            <div class="section__head">
              <h2 class="section__title">Beat</h2>
              <span class="dim">${esc(beatSummary())}</span>
            </div>
            <button class="row-card" type="button" data-action="beats">
              <span class="row-card__icon">${icon('music', { size: 22 })}</span>
              <span class="grow">
                <span class="row-card__title" style="display:block">${esc(beatSummary())}</span>
                <span class="row-card__sub" style="display:block">
                  ${availableBeats().length === 0
                    ? 'Añade pistas en assets/beats/ para activarlo'
                    : 'Toca para elegir y ordenar las pistas'}
                </span>
              </span>
              <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
            </button>
            ${showBeatPicker ? beatPickerHtml() : ''}
          </div>

          <div class="section">
            <div class="section__head">
              <h2 class="section__title">Rondas</h2>
              <span class="dim">${selected.length} elegida${selected.length === 1 ? '' : 's'}</span>
            </div>
            <div class="list" data-group="rounds">
              ${mode.pool.map((r) => {
                const order = selected.indexOf(r.id);
                return optionCard(r.title, {
                  subtitle: r.description,
                  selected: order >= 0,
                  value: r.id,
                  order: order >= 0 ? order + 1 : null,
                });
              }).join('')}
            </div>
          </div>

          ${!canRecord ? notice(
            store.isAccount
              ? 'Con el plan Gratis la batalla no se graba, así que no se evalúa ni suma XP.'
              : 'Como invitado la batalla no se graba ni suma progreso. Se juega igual.'
          ) : notice(
            'Solo tus turnos suman XP: los demás participantes no tienen cuenta que acreditar.'
          )}

          <button class="btn btn--primary" type="button" data-action="start"
                  ${selected.length === 0 ? 'disabled' : ''}>
            ${selected.length === 0 ? 'Elige al menos una ronda' : 'EMPEZAR BATALLA'}
          </button>
        `)}
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    wireBack(root, 'battles');

    root.querySelector('[data-action="beats"]')?.addEventListener('click', () => {
      showBeatPicker = !showBeatPicker; paint();
    });

    root.querySelector('[data-group="rounds"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      const id = btn.dataset.value;
      const at = selected.indexOf(id);
      if (at >= 0) selected.splice(at, 1);
      else selected.push(id);
      paint();
    });

    root.querySelector('[data-group="beats"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      const f = btn.dataset.value;
      const at = beats.indexOf(f);
      if (at >= 0) beats.splice(at, 1);
      else beats.push(f);
      paint();
    });

    root.querySelector('[data-action="clear-beats"]')?.addEventListener('click', () => {
      beats = []; paint();
    });

    root.querySelector('[data-action="add-mc"]')?.addEventListener('click', async () => {
      const name = await promptDialog({
        title: 'Nuevo participante',
        label: 'Nombre',
        placeholder: `MC ${names.length + 1}`,
        confirmText: 'Añadir',
        maxLength: 24,
      });
      if (name === null) return;
      names.push(name.trim() || `MC ${names.length + 1}`);
      paint();
    });

    root.querySelectorAll('[data-rename]').forEach((el) =>
      el.addEventListener('click', async () => {
        const i = Number(el.dataset.rename);
        const name = await promptDialog({
          title: 'Cambiar el nombre',
          label: 'Nombre',
          initial: names[i],
          confirmText: 'Guardar',
          maxLength: 24,
        });
        if (name === null || !name.trim()) return;
        names[i] = name.trim();
        paint();
      }));

    root.querySelectorAll('[data-drop]').forEach((el) =>
      el.addEventListener('click', () => {
        names.splice(Number(el.dataset.drop), 1);
        paint();
      }));

    root.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (selected.length === 0) { toast('Elige al menos una ronda'); return; }
      start();
    });
  }

  function start() {
    const rounds = selected
      .map((id) => mode.pool.find((r) => r.id === id))
      .filter(Boolean)
      .map(battleRoundFrom);

    const config = offlineBattleConfig({
      modeTitle: mode.modeTitle,
      subModeTitle: mode.subtitle,
      formatLabel: mode.formatLabel,
      rounds,
      beatTrackFileNames: beats,
    });

    teardown = mountFlow(root, {
      config,
      participants: names.map((n, i) => participant(i, n)),
      solo: false,
      accent: mode.accent,
      modeId: mode.id,
      modeName: mode.modeTitle,
      onExit: () => back('battles'),
    });
  }

  paint();
  return () => teardown?.();
}

export { MAX_TEAM_MEMBERS };
