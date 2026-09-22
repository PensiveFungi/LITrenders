/* setup.js — port of ui/screens/SessionSetupScreen.kt
   Route: sessionSetup?presetId={presetId} */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { DIFFICULTIES, Difficulty, difficultyFromLabel, shuffled } from '../core/domain.js';
import { TRAINING_MODES, modeById, styleForModeId, roundsOf } from '../data/modes.js';
import { sortedRhymeKeys } from '../data/rhymes.js';
import {
  esc, appScaffold, wireBack, modeHero, metaRow, optionCard,
  applyModeTheme, toast,
} from '../ui/components.js';

export function renderSetup(root, { query }) {
  const rhymeKeys = sortedRhymeKeys(store.rhymes);

  // --- state, mirroring the composable's remember{} values ---
  const state = {
    selectedPresetId: null,
    difficulty: Difficulty.MEDIUM,
    rounds: 1,
    useRandomStimuli: false,
    allowStimulusChanges: false,
    timerSeconds: 45,
    sectionDurations: [45],
    selectedRhymes: Array.from({ length: 4 }, (_, i) => rhymeKeys[i] || rhymeKeys[0] || ''),
  };

  function applyPreset(preset) {
    state.selectedPresetId = preset.id;
    state.difficulty = preset.difficulty;
    state.rounds = roundsOf(preset);
    state.useRandomStimuli = preset.useRandomStimuli;
    state.allowStimulusChanges = preset.allowStimulusChanges;
    state.sectionDurations = preset.roundDurationsSeconds.slice();
    state.timerSeconds = preset.roundDurationsSeconds[0] ?? 45;
  }

  const initialPreset = modeById(query.get('presetId'));
  if (initialPreset) applyPreset(initialPreset);

  function body() {
    const style = styleForModeId(state.selectedPresetId);
    applyModeTheme(state.selectedPresetId || 'libre');

    const durationsLabel = state.sectionDurations.map((d) => `${d}s`).join(' → ');
    const mixedProfile = new Set(state.sectionDurations).size > 1;

    return `
      <div class="screen">
        ${appScaffold('Configurar sesión', `
          ${modeHero(style)}
          ${metaRow([
            ['Dificultad', state.difficulty.label],
            ['Rondas', String(state.rounds)],
            ['Duración', durationsLabel],
          ])}

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Modo de entrenamiento</h2>
            <div class="list" role="radiogroup" aria-label="Modo de entrenamiento" data-group="preset">
              ${TRAINING_MODES.map((p) => optionCard(p.displayName, {
                subtitle: p.description,
                selected: p.id === state.selectedPresetId,
                value: p.id,
                role: 'checked',
              })).join('')}
            </div>
          </div>

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Dificultad</h2>
            <div class="option-grid" role="radiogroup" aria-label="Dificultad" data-group="difficulty">
              ${DIFFICULTIES.map((d) => optionCard(d.label, {
                selected: d.label === state.difficulty.label,
                value: d.label,
                role: 'checked',
              })).join('')}
            </div>
          </div>

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Duración por ronda</h2>
            <label class="field__label" for="duration">
              Refrescar estímulos cada <b data-duration-label>${state.timerSeconds}</b>s
            </label>
            <input class="slider" id="duration" type="range" min="15" max="90" step="5"
                   value="${state.timerSeconds}" data-input="duration">
            ${mixedProfile
              ? `<p class="dim" style="margin:0">Perfil del modo: ${esc(state.sectionDurations.map((d) => `${d}s`).join(' · '))}</p>`
              : ''}
          </div>

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Número de rondas</h2>
            <div class="option-grid" role="radiogroup" aria-label="Número de rondas" data-group="rounds">
              ${[1, 2, 3, 4].map((n) => optionCard(String(n), {
                selected: n === state.rounds,
                value: String(n),
                role: 'checked',
              })).join('')}
            </div>
          </div>

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Selección de rimas</h2>
            ${optionCard('Rimas aleatorias al iniciar', {
              subtitle: state.useRandomStimuli
                ? 'Cada ronda empieza con una rima distinta elegida al azar.'
                : 'Eliges manualmente la rima de cada ronda.',
              selected: state.useRandomStimuli,
              value: 'random',
            })}
          </div>

          <div class="section">
            <h2 class="section__title" style="font-size:16px">Cambios de estímulo</h2>
            ${optionCard('Cambiar estímulos durante la sesión', {
              subtitle: state.allowStimulusChanges
                ? 'La rima de cada ronda cambiará sola cuando se agote el tiempo.'
                : 'La rima de cada ronda se mantiene fija durante toda la sesión.',
              selected: state.allowStimulusChanges,
              value: 'changes',
            })}
          </div>

          ${state.useRandomStimuli ? '' : `
            <div class="section">
              <h2 class="section__title" style="font-size:16px">Rimas por ronda</h2>
              ${Array.from({ length: state.rounds }, (_, i) => {
                const alreadyPicked = new Set(
                  state.selectedRhymes.filter((_, idx) => idx !== i).slice(0, state.rounds - 1)
                );
                const options = rhymeKeys.filter((k) => !alreadyPicked.has(k) || k === state.selectedRhymes[i]);
                return `
                  <div class="field">
                    <label class="field__label" for="rhyme-${i}">Rima ${i + 1}</label>
                    <select class="select" id="rhyme-${i}" data-rhyme-index="${i}">
                      ${options.map((k) => `
                        <option value="${esc(k)}" ${k === state.selectedRhymes[i] ? 'selected' : ''}>
                          -${esc(k)}
                        </option>`).join('')}
                    </select>
                  </div>`;
              }).join('')}
            </div>`}

          <button class="btn btn--primary" type="button" data-action="start"
            ${rhymeKeys.length === 0 ? 'disabled' : ''}>Iniciar sesión</button>
        `)}
      </div>`;
  }

  function paint() {
    root.innerHTML = body();
    wire();
  }

  function wire() {
    wireBack(root, 'train');

    root.querySelector('[data-group="preset"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      const preset = modeById(btn.dataset.value);
      if (preset) { applyPreset(preset); paint(); }
    });

    root.querySelector('[data-group="difficulty"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      state.difficulty = difficultyFromLabel(btn.dataset.value);
      paint();
    });

    root.querySelector('[data-group="rounds"]')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.option');
      if (!btn) return;
      state.rounds = Number(btn.dataset.value);
      state.sectionDurations = new Array(state.rounds).fill(state.timerSeconds);
      paint();
    });

    const slider = root.querySelector('[data-input="duration"]');
    slider?.addEventListener('input', () => {
      state.timerSeconds = Number(slider.value);
      state.sectionDurations = new Array(state.rounds).fill(state.timerSeconds);
      const label = root.querySelector('[data-duration-label]');
      if (label) label.textContent = String(state.timerSeconds);
      // Keep the metadata row live without a full repaint.
      const tiles = root.querySelectorAll('.meta-tile__value');
      if (tiles[2]) tiles[2].textContent = state.sectionDurations.map((d) => `${d}s`).join(' → ');
    });

    root.querySelectorAll('.option[data-value="random"]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.useRandomStimuli = !state.useRandomStimuli;
        paint();
      }));

    root.querySelectorAll('.option[data-value="changes"]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.allowStimulusChanges = !state.allowStimulusChanges;
        paint();
      }));

    root.querySelectorAll('[data-rhyme-index]').forEach((sel) =>
      sel.addEventListener('change', () => {
        state.selectedRhymes[Number(sel.dataset.rhymeIndex)] = sel.value;
      }));

    root.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (rhymeKeys.length === 0) {
        toast('No hay rimas disponibles.');
        return;
      }
      const finalRhymes = state.useRandomStimuli
        ? shuffled(rhymeKeys).slice(0, state.rounds)
        : state.selectedRhymes.slice(0, state.rounds).map((key, index) =>
            (rhymeKeys.includes(key) ? key : rhymeKeys[index % rhymeKeys.length]));

      const preset = modeById(state.selectedPresetId);
      store.startSession({
        sectionCount: state.rounds,
        rhymeKeys: finalRhymes,
        sectionDurationsSeconds: state.sectionDurations,
        modeId: preset?.id ?? 'libre',
        modeName: preset?.displayName ?? 'Libre',
        difficulty: state.difficulty,
        allowStimulusChanges: state.allowStimulusChanges,
      });
      navigate('session');
    });
  }

  paint();
}
