/* =========================================================================
   rounds.js — port of battles/entrenar/EntrenarModels.kt,
   battles/masterserie/MasterSerieModels.kt and battles/gallos/GallosModels.kt

   Every mode is an ordered List<BattleRoundSpec>. Entrenar offers the
   mechanics directly; Master Serie and Gallos wrap the same mechanics in
   their own branding and turn the Minuto Libre roles on.
   ========================================================================= */

import { battleRoundSpec, Mechanic, WordRotationIntervals } from '../core/domain.js';

/** Seconds per performer turn — the same across every mode. */
export const TURN_SECONDS = 60;

/** Temática pool: CAMBIAR rerolls from here. Shared by every Temáticas round. */
export const THEMES = [
  'Realidad', 'Escuela', 'Amistad', 'Ciudad', 'Memoria',
  'Rutina', 'Verdad', 'Cambio', 'Noche', 'Origen',
  'Herida', 'Juego', 'Destino', 'Voz', 'Frontera',
];

/* ---------- Entrenar's solo round menu ----------
   Declaration order is the picker's default pool order. */

export const ENTRENAR_ROUNDS = [
  { id: 'EASY_MODE', title: 'EASY MODE', description: 'Practica sin presión' },
  { id: 'HARD_MODE', title: 'HARD MODE', description: 'Desafía tus límites' },
  { id: 'TEMATICAS', title: 'TEMÁTICAS', description: 'Rimas con tema al azar' },
  { id: 'IMAGENES', title: 'IMÁGENES', description: 'Inspírate y improvisa' },
  { id: 'OBJETOS', title: 'OBJETOS', description: 'Tres objetos en tu rima' },
  { id: 'MINUTO_LIBRE', title: 'MINUTO LIBRE', description: 'Freestyle libre, sin estímulo' },
];

/**
 * The rounds played by the "recommended" quick-start session (the Entrenar
 * hero card on Home): a balanced ramp that warms up, adds a theme, then
 * pushes the pace.
 */
export const RECOMMENDED_ROUND_IDS = ['EASY_MODE', 'TEMATICAS', 'HARD_MODE'];

/**
 * Maps one selected round id onto the shared mechanics.
 *
 * `hasTurnRoles` stays false for Entrenar's Minuto Libre: ATAQUE/RESPUESTA
 * only makes sense with a second performer, so solo plays it as plain
 * freeform freestyle.
 */
export function toRoundSpec(roundId, { battleRoles = false } = {}) {
  const meta = ENTRENAR_ROUNDS.find((r) => r.id === roundId)
    || ENTRENAR_ROUNDS[ENTRENAR_ROUNDS.length - 1];
  const base = { id: meta.id, title: meta.title, durationSeconds: TURN_SECONDS };

  switch (roundId) {
    case 'EASY_MODE':
      return battleRoundSpec({ ...base, mechanic: Mechanic.rhymeWords(WordRotationIntervals.EASY_SECONDS) });
    case 'HARD_MODE':
      return battleRoundSpec({ ...base, mechanic: Mechanic.rhymeWords(WordRotationIntervals.HARD_SECONDS) });
    case 'TEMATICAS':
      return battleRoundSpec({ ...base, mechanic: Mechanic.themePrompt(THEMES) });
    case 'IMAGENES':
      return battleRoundSpec({ ...base, mechanic: Mechanic.imageStimulus() });
    case 'OBJETOS':
      return battleRoundSpec({ ...base, mechanic: Mechanic.objectStimulus() });
    case 'MINUTO_LIBRE':
    default:
      return battleRoundSpec({ ...base, mechanic: Mechanic.freeform(), hasTurnRoles: battleRoles });
  }
}

/* ---------- Battle modes ----------
   Master Serie and Gallos each have their OWN sub-mode set and their own
   temática pool (MasterSerieModels.kt / GallosModels.kt): Gallos has no
   Easy/Hard cadence rounds at all, and its themes are a different list.
   Both creators hoist Minuto Libre to the top, pre-selected, so a battle can
   start right away — and in both it is the round with ATAQUE/RESPUESTA roles,
   which only makes sense with a second performer. */

/** Temática pool for Master Serie turns. */
export const MASTER_SERIE_THEMES = THEMES;

/** Temática pool for Gallos turns — a different list, deliberately. */
export const GALLOS_THEMES = [
  'Superación', 'Barrio', 'Tiempo', 'Traición', 'Familia',
  'Dinero', 'Libertad', 'Fama', 'Raíces', 'Futuro',
  'Silencio', 'Poder', 'Nostalgia', 'Calle', 'Sueños',
];

const masterSerieRound = (id, title, description, mechanic, hasTurnRoles = false) =>
  ({ id, title, description, mechanic, hasTurnRoles });

/** MasterSerieSubMode, in declaration order (Objetos last). */
export const MASTER_SERIE_ROUNDS = [
  masterSerieRound('EASY_MODE', 'EASY MODE', 'Practica sin presión',
    Mechanic.rhymeWords(WordRotationIntervals.EASY_SECONDS)),
  masterSerieRound('HARD_MODE', 'HARD MODE', 'Desafía tus límites',
    Mechanic.rhymeWords(WordRotationIntervals.HARD_SECONDS)),
  masterSerieRound('TEMATICAS', 'TEMÁTICAS', 'Rimas con tema al azar',
    Mechanic.themePrompt(MASTER_SERIE_THEMES)),
  masterSerieRound('IMAGENES', 'IMÁGENES', 'Inspírate y improvisa', Mechanic.imageStimulus()),
  masterSerieRound('MINUTO_LIBRE', 'MINUTO LIBRE', 'Ataque y respuesta libres',
    Mechanic.freeform(), true),
  masterSerieRound('OBJETOS', 'OBJETOS', 'Tres objetos en tu rima', Mechanic.objectStimulus()),
];

/** GallosSubMode, in declaration order. No cadence rounds. */
export const GALLOS_ROUNDS = [
  masterSerieRound('TEMATICA', 'TEMÁTICA', 'Rima con temas al azar',
    Mechanic.themePrompt(GALLOS_THEMES)),
  masterSerieRound('IMAGENES', 'IMÁGENES', 'Inspírate y improvisa', Mechanic.imageStimulus()),
  masterSerieRound('OBJETOS', 'OBJETOS', 'Tres objetos en tu rima', Mechanic.objectStimulus()),
  masterSerieRound('MINUTO_LIBRE', 'MINUTO LIBRE', '60 segundos de libertad',
    Mechanic.freeform(), true),
];

/** The creator's pool order: Minuto Libre hoisted, the rest as declared. */
function hoistFreeRound(rounds) {
  const free = rounds.find((r) => r.id === 'MINUTO_LIBRE');
  return free ? [free, ...rounds.filter((r) => r !== free)] : rounds.slice();
}

export const BATTLE_MODES = {
  master_serie: {
    id: 'master_serie',
    modeTitle: 'Master Serie',
    subtitle: 'Disciplina · Métrica · Competencia',
    formatLabel: 'BATALLA',
    accent: { main: '#2F6BFF', bright: '#7DA8FF', onMain: '#FFFFFF' },
    pool: hoistFreeRound(MASTER_SERIE_ROUNDS),
  },
  gallos: {
    id: 'gallos',
    modeTitle: 'Gallos',
    subtitle: 'Energía · Escenario · Legado',
    formatLabel: 'BATALLA',
    accent: { main: '#E5233B', bright: '#FFC857', onMain: '#FFFFFF' },
    pool: hoistFreeRound(GALLOS_ROUNDS),
  },
};

export function battleModeById(id) {
  return BATTLE_MODES[id] || null;
}

/** One pool entry as a playable round. */
export function battleRoundFrom(entry) {
  return battleRoundSpec({
    id: entry.id,
    title: entry.title,
    durationSeconds: TURN_SECONDS,
    mechanic: entry.mechanic,
    hasTurnRoles: entry.hasTurnRoles,
  });
}

/** Team-mode limits, from OfflineTeamPicker. */
export const MAX_TEAM_MEMBERS = 3;
