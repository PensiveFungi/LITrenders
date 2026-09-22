/* =========================================================================
   battle.js — port of battles/offline/OfflineBattleModels.kt

   The shared single-device session engine. Entrenar runs it in solo mode;
   Master Serie and Gallos run it with a full lineup. All state is local.

   The turn clock counts UP from zero and is open-ended: it keeps running past
   the round's nominal duration, because a round ends on a manual round-end or
   "Próxima entrada", NEVER on the clock. The spec's durationSeconds only
   fills the progress ring (which then stays full) and paces rotating words.
   ========================================================================= */

import { initialTheme, rerolledTheme, wordIndexAt } from './domain.js';

export const OfflineStage = {
  HANDOFF: 'HANDOFF',
  TURN: 'TURN',
  VOTING_HANDOFF: 'VOTING_HANDOFF',
  VOTING: 'VOTING',
  RESULTS: 'RESULTS',
};

export const OFFLINE_MIN_PARTICIPANTS = 2;
export const OFFLINE_MAX_PARTICIPANTS = 8;
export const OFFLINE_MIN_RATING = 1;
export const OFFLINE_MAX_RATING = 5;

export const participant = (id, name) => ({ id, name });

/**
 * Per-mode configuration: branding labels plus the ordered round schedule.
 * `beatTrackFileNames` is a per-creation playlist — empty shuffles
 * ("Aleatorio"), one loops that track, several play in order and loop.
 */
export function offlineBattleConfig({
  modeTitle,
  subModeTitle,
  formatLabel,
  rounds,
  beatTrackFileNames = [],
}) {
  if (!rounds || rounds.length === 0) throw new Error('A battle needs at least one round');
  return { modeTitle, subModeTitle, formatLabel, rounds, beatTrackFileNames };
}

/** Spec of `round` (1-based), clamped so a stale index can never crash. */
export function roundSpec(config, round) {
  const i = Math.min(Math.max(round - 1, 0), config.rounds.length - 1);
  return config.rounds[i];
}

export const totalRounds = (config) => config.rounds.length;

export function createBattleState({ participants, config, solo = false }) {
  return {
    participants,
    config,
    solo,
    stage: OfflineStage.HANDOFF,
    currentRound: 1,
    turnIndex: 0,
    elapsedSeconds: 0,
    isPaused: false,
    voterIndex: 0,
    ratings: [],
    theme: initialTheme(roundSpec(config, 1).mechanic),
    entradas: [],
    entradasRound: 1,
  };
}

/* ---------- derived reads ---------- */

export const currentSpec = (s) => roundSpec(s.config, s.currentRound);
export const performerCount = (s) => s.participants.length;
export const performerName = (s, index) => s.participants[index].name;
export const currentPerformerName = (s) => performerName(s, s.turnIndex);

/** Entradas completed by the performer at `index` in the current round. */
export function entradaCount(s, index) {
  return s.entradasRound === s.currentRound ? (s.entradas[index] ?? 0) : 0;
}

/**
 * Zero-based index of the word to show at this point in the turn, or null
 * when the active round's mechanic has no timed words.
 */
export function currentWordIndex(s) {
  return wordIndexAt(currentSpec(s).mechanic, Math.max(0, s.elapsedSeconds));
}

/**
 * Turn role label for rounds with hasTurnRoles (Minuto Libre): ATAQUE on
 * every performer's first turn and RESPUESTA on their second, by flipping the
 * turnIndex parity every other round.
 */
export function currentTurnRole(s) {
  if (!currentSpec(s).hasTurnRoles) return null;
  const roundFlips = s.currentRound % 2 === 0;
  const isAttack = (s.turnIndex % 2 === 0) !== roundFlips;
  return isAttack ? 'ATAQUE' : 'RESPUESTA';
}

/* ---------- transitions (all pure, all return a new state) ---------- */

/** Counts UP one second while a turn is running; no-op otherwise. */
export function tick(s) {
  if (s.stage !== OfflineStage.TURN || s.isPaused) return s;
  return { ...s, elapsedSeconds: s.elapsedSeconds + 1 };
}

/**
 * Ends the current round outright: jumps to the next round's first turn —
 * loading that round's own duration, stimulus and theme — or to RESULTS after
 * the last round. Never credits an entrada.
 *
 * The battle goes straight to results after the final round: there is no
 * in-app voting step, because a freestyle battle's winner is decided by the
 * crowd in the room.
 */
export function advanceRound(s) {
  if (s.currentRound < totalRounds(s.config)) {
    const nextSpec = roundSpec(s.config, s.currentRound + 1);
    return {
      ...s,
      stage: OfflineStage.HANDOFF,
      currentRound: s.currentRound + 1,
      turnIndex: 0,
      elapsedSeconds: 0,
      isPaused: false,
      theme: initialTheme(nextSpec.mechanic),
    };
  }
  return { ...s, stage: OfflineStage.RESULTS, isPaused: false };
}

/**
 * "Próxima entrada": credits one completed entrada to the current performer,
 * then hands the device to the next performer WITHIN the same round, wrapping
 * past the last. Never advances the round or ends the battle.
 */
export function completeEntrada(s) {
  const count = performerCount(s);
  return {
    ...s,
    entradas: Array.from({ length: count }, (_, i) => entradaCount(s, i) + (i === s.turnIndex ? 1 : 0)),
    entradasRound: s.currentRound,
    stage: OfflineStage.HANDOFF,
    turnIndex: (s.turnIndex + 1) % count,
    elapsedSeconds: 0,
    isPaused: false,
  };
}

/** Starts the turn after a handoff. */
export function beginTurn(s) {
  return { ...s, stage: OfflineStage.TURN, elapsedSeconds: 0, isPaused: false };
}

export function togglePause(s) {
  if (s.stage !== OfflineStage.TURN) return s;
  return { ...s, isPaused: !s.isPaused };
}

/** Rerolls the temática: a different entry from the active round's pool. */
export function rerollTheme(s) {
  const next = rerolledTheme(currentSpec(s).mechanic, s.theme);
  return next === s.theme ? s : { ...s, theme: next };
}

/** A fresh battle with the same participants and config (revancha). */
export function rematch(s) {
  return createBattleState({ participants: s.participants, config: s.config, solo: s.solo });
}

/* ---------- manual ratings (battle modes only) ---------- */

export function rate(s, targetId, score) {
  const bounded = Math.min(OFFLINE_MAX_RATING, Math.max(OFFLINE_MIN_RATING, score));
  const voterId = s.participants[s.voterIndex].id;
  const others = s.ratings.filter((r) => !(r.voterId === voterId && r.targetId === targetId));
  return { ...s, ratings: [...others, { voterId, targetId, score: bounded }] };
}

export const ratingTargetsFor = (s, voter) =>
  s.participants.filter((p) => p.id !== voter.id).map((p) => p.id);

export const ratingFor = (s, voterId, targetId) =>
  s.ratings.find((r) => r.voterId === voterId && r.targetId === targetId)?.score ?? null;

export function averageScoreFor(s, targetId) {
  const scores = s.ratings.filter((r) => r.targetId === targetId).map((r) => r.score);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function ranking(s) {
  return s.participants
    .map((p) => p.id)
    .sort((a, b) => (averageScoreFor(s, b) ?? 0) - (averageScoreFor(s, a) ?? 0));
}

export function winners(s) {
  const ranked = ranking(s);
  if (ranked.length === 0) return [];
  const top = averageScoreFor(s, ranked[0]) ?? 0;
  return ranked.filter((id) => (averageScoreFor(s, id) ?? 0) === top);
}

/* ---------- difficulty of a finished session ----------
   Derived from which rounds were selected: HARD if any Hard-cadence round,
   EASY only if every round is Easy-cadence, MEDIUM otherwise. */

import { Difficulty, MechanicType, WordRotationIntervals } from './domain.js';

export function difficultyForRounds(rounds) {
  const cadence = (r) =>
    (r.mechanic?.type === MechanicType.RHYME_WORDS ? r.mechanic.rotationIntervalSeconds : null);
  if (rounds.some((r) => cadence(r) === WordRotationIntervals.HARD_SECONDS)) return Difficulty.HARD;
  if (rounds.length > 0 && rounds.every((r) => cadence(r) === WordRotationIntervals.EASY_SECONDS)) {
    return Difficulty.EASY;
  }
  return Difficulty.MEDIUM;
}
