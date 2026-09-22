/* =========================================================================
   ai.js — port of app/src/main/java/com/freestyle/academy/ai/

   This is the XP economy. There is no rule-based award anywhere in the app:
   the only source of XP is the post-session assessment of the real recording,
   produced by the `scoreFreestyle` Cloud Function and parsed here.
   ========================================================================= */

/* ---------- AiScoring.kt ---------- */

/** The server prompt's per-segment performance-XP ceiling. */
export const MAX_SEGMENT_XP = 80;

/** Per-segment ceiling for the stimulus-usage bonus. */
export const MAX_SEGMENT_STIMULUS_XP = 40;

/** Session ceiling for the summed per-segment XP. */
export const MAX_SESSION_XP = 400;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Parses one segment's model output, or null when it isn't usable.
 * Tolerates surrounding text by reading the outermost {...} span; clamps
 * out-of-range values rather than rejecting an otherwise valid assessment.
 */
export function parseAssessment(raw) {
  if (!raw || !String(raw).trim()) return null;
  const text = String(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let json;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (json == null || typeof json !== 'object') return null;
  if (!('baseXp' in json) || !('rationale' in json)) return null;

  const rationale = String(json.rationale ?? '').trim();
  if (!rationale) return null;

  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  return {
    baseXp: clamp(Math.trunc(num(json.baseXp)), 0, MAX_SEGMENT_XP),
    flowScore: clamp(num(json.flowScore), 0, 1),
    rhymeDensity: clamp(num(json.rhymeDensity), 0, 1),
    rationale,
    stimulusXp: clamp(Math.trunc(num(json.stimulusXp)), 0, MAX_SEGMENT_STIMULUS_XP),
  };
}

/** Every segment's performance XP plus its stimulus bonus, capped. */
export function sessionXp(assessments) {
  const total = (assessments || []).reduce((sum, a) => sum + a.baseXp + a.stimulusXp, 0);
  return clamp(total, 0, MAX_SESSION_XP);
}

/** The stimulus-usage bonus alone, for the transparent breakdown. */
export function stimulusXp(assessments) {
  const total = (assessments || []).reduce((sum, a) => sum + a.stimulusXp, 0);
  return clamp(total, 0, MAX_SESSION_XP);
}

/** Duration-weighted mean of a per-segment score. */
export function weightedAverage(assessments, durationsSeconds, score) {
  if (!assessments || assessments.length === 0) return 0;
  const weights = assessments.map((_, i) => Math.max(1, durationsSeconds?.[i] ?? 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const sum = assessments.reduce((acc, a, i) => acc + score(a) * weights[i], 0);
  return sum / total;
}

/* ---------- XpMultipliers.kt ---------- */

/** Racha tiers, in days. */
export function rachaMultiplier(streakDays) {
  if (streakDays >= 30) return 1.5;
  if (streakDays >= 14) return 1.3;
  if (streakDays >= 7) return 1.2;
  if (streakDays >= 3) return 1.1;
  return 1;
}

/**
 * Extended-session tiers over the REAL recorded (mic-on) seconds of the
 * segments being scored — never the planned round durations.
 */
export function sessionMultiplier(recordedSeconds) {
  if (recordedSeconds >= 20 * 60) return 1.25;
  if (recordedSeconds >= 10 * 60) return 1.1;
  return 1;
}

/** Competitive premium for offline battles (owner's own segments only). */
export const BATTLE_MULTIPLIER = 1.15;

/** Ceiling for the stacked multiplier: bonuses can at most double the base. */
export const MAX_COMBINED_MULTIPLIER = 2.0;

/** The full computation, kept together so the UI breakdown can't drift. */
export function computeXp({ baseXp, streakDays, recordedSeconds, isBattle }) {
  const racha = rachaMultiplier(streakDays);
  const session = sessionMultiplier(recordedSeconds);
  const battle = isBattle ? BATTLE_MULTIPLIER : 1;
  const combined = Math.min(MAX_COMBINED_MULTIPLIER, racha * session * battle);
  return {
    baseXp,
    rachaMultiplier: racha,
    sessionMultiplier: session,
    battleMultiplier: battle,
    combinedMultiplier: combined,
    totalXp: clamp(Math.round(baseXp * combined), 0, MAX_SESSION_XP),
  };
}

/* ---------- Scoring UI state ---------- */

export const ScoringState = {
  IDLE: 'idle',
  RUNNING: 'running',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
};
