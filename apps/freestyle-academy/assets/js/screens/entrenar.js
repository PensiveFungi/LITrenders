/* =========================================================================
   entrenar.js — port of battles/entrenar/EntrenarFlowScreen.kt +
   EntrenarModeSelectionScreen.kt

   Pick and order the rounds, pick the beat, then the shared engine in solo
   mode. With ?recommended=true it skips the picker into the ready-made
   session (the Home hero card).
   ========================================================================= */

import { store } from '../core/store.js';
import { back } from '../core/router.js';
import {
  ENTRENAR_ROUNDS, RECOMMENDED_ROUND_IDS, toRoundSpec,
} from '../data/rounds.js';
import { offlineBattleConfig, participant } from '../core/battle.js';
import { availableBeats, beatDisplayName } from '../core/audio.js';
import { PlanEntitlements } from '../core/plans.js';
import {
  esc, icon, appScaffold, wireBack, optionCard, toast, resetAccent, notice,
} from '../ui/components.js';
import { mountFlow } from './flow.js';

const ACCENT = { main: '#7B35FF', bright: '#23D7F2', onMain: '#FFFFFF' };

export function renderEntrenar(root, { query }) {
  resetAccent();

  let teardown = null;
  /** Selected round ids, in the order they will be played. */
  let selected = [];
  /** Chosen beats: empty = Aleatorio. */
  let beats = [];
  let showBeatPicker = false;

  if (query.get('recommended') === 'true') {
    selected = [...RECOMMENDED_ROUND_IDS];
    startSession();
    return () => teardown?.();
  }

  /* ---------- picker ---------- */

  function beatSummary() {
    if (availableBeats().length === 0) return 'Sin pistas disponibles';
    if (beats.length === 0) return 'Aleatorio';
    if (beats.length === 1) return beatDisplayName(beats[0]);
    return `${beats.length} pistas en orden`;
  }

  function pickerView() {
    const canRecord = PlanEntitlements.canRecordSessions(store.planTier) && store.isAccount;
    return `
      <div class="screen">
        ${appScaffold('Entrenar', `
          <p class="muted" style="margin:0">
            Elige las rondas y el orden en que quieres jugarlas. Cada ronda dura
            60 segundos y termina cuando tú lo decidas.
          </p>

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
            ${showBeatPicker ? beatPickerView() : ''}
          </div>

          <div class="section">
            <div class="section__head">
              <h2 class="section__title">Rondas</h2>
              <span class="dim">${selected.length} elegida${selected.length === 1 ? '' : 's'}</span>
            </div>
            <div class="list" data-group="rounds">
              ${ENTRENAR_ROUNDS.map((r) => {
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
              ? 'Con el plan Gratis la sesión no se graba, así que no se evalúa ni suma XP.'
              : 'Como invitado la sesión no se graba ni suma progreso. Puedes practicar igual.'
          ) : ''}

          <button class="btn btn--primary" type="button" data-action="start"
                  ${selected.length === 0 ? 'disabled' : ''}>
            ${selected.length === 0 ? 'Elige al menos una ronda' : 'EMPEZAR SESIÓN'}
          </button>
        `)}
      </div>`;
  }

  function beatPickerView() {
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
              selected: order >= 0,
              value: f,
              order: order >= 0 ? order + 1 : null,
            });
          }).join('')}
        </div>
        <button class="btn btn--outline btn--compact" type="button" data-action="clear-beats">
          ${icon('shuffle', { size: 17 })} Aleatorio
        </button>
      </div>`;
  }

  function paintPicker() {
    root.innerHTML = pickerView();
    wireBack(root, 'train');

    root.querySelector('[data-action="beats"]')?.addEventListener('click', () => {
      showBeatPicker = !showBeatPicker;
      paintPicker();
    });

    root.querySelector('[data-group="rounds"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      const id = btn.dataset.value;
      const at = selected.indexOf(id);
      if (at >= 0) selected.splice(at, 1);
      else selected.push(id);
      paintPicker();
    });

    root.querySelector('[data-group="beats"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      const f = btn.dataset.value;
      const at = beats.indexOf(f);
      if (at >= 0) beats.splice(at, 1);
      else beats.push(f);
      paintPicker();
    });

    root.querySelector('[data-action="clear-beats"]')?.addEventListener('click', () => {
      beats = [];
      paintPicker();
    });

    root.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (selected.length === 0) { toast('Elige al menos una ronda'); return; }
      startSession();
    });
  }

  /* ---------- session ---------- */

  function startSession() {
    const rounds = selected.map((id) => toRoundSpec(id, { battleRoles: false }));
    const config = offlineBattleConfig({
      modeTitle: 'Entrenar',
      subModeTitle: 'Solo',
      formatLabel: 'PRÁCTICA',
      rounds,
      beatTrackFileNames: beats,
    });
    teardown = mountFlow(root, {
      config,
      participants: [participant(0, 'Tú')],
      solo: true,
      accent: ACCENT,
      modeId: 'entrenar',
      modeName: 'Entrenar',
      onExit: () => back('train'),
    });
  }

  paintPicker();
  return () => teardown?.();
}
