/* =========================================================================
   domain.js — direct port of app/src/main/java/com/freestyle/academy/domain/
   Pure functions. No DOM, no storage. Keep in sync with the Kotlin source:
   values here are asserted against the same numbers as the JUnit tests.
   ========================================================================= */

/* ---------- Difficulty.kt ---------- */

export const Difficulty = {
  EASY:   { name: 'EASY',   label: 'Fácil',   xpMultiplier: 0.85, wordsPerSection: 10 },
  MEDIUM: { name: 'MEDIUM', label: 'Medio',   xpMultiplier: 1.0,  wordsPerSection: 8 },
  HARD:   { name: 'HARD',   label: 'Difícil', xpMultiplier: 1.25, wordsPerSection: 6 },
};

export const DIFFICULTIES = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];

export function difficultyFromLabel(label) {
  return DIFFICULTIES.find((d) => d.label === label) || Difficulty.MEDIUM;
}

export function difficultyFromName(name) {
  return Difficulty[name] || Difficulty.MEDIUM;
}

/* ---------- SessionTimer.kt ----------
   Absolute-timestamp timer math: storing an end timestamp and deriving the
   remaining seconds avoids drift from repeated decrements. */

export const SessionTimer = {
  endAtMillis(nowMillis, durationSeconds) {
    return nowMillis + durationSeconds * 1000;
  },
  remainingSeconds(endAtMillis, nowMillis) {
    const remainingMillis = endAtMillis - nowMillis;
    if (remainingMillis <= 0) return 0;
    return Math.floor((remainingMillis + 999) / 1000);
  },
};

/* ---------- SessionRewards.kt ---------- */

const XP_PER_MINUTE = 8;
const XP_PER_ROUND_COMPLETED = 15;
const XP_PER_PROMPT_COMPLETED = 3;
const COMPLETION_BONUS = 25;
const STREAK_BONUS_PER_DAY = 2;
const MAX_STREAK_BONUS_DAYS = 30;

const atLeast = (v, min) => (v < min ? min : v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const SessionRewards = {
  calculateXp({
    practiceSeconds,
    roundsCompleted,
    promptsCompleted,
    difficulty,
    completedFully,
    currentStreakDays,
  }) {
    const minutes = Math.floor(atLeast(practiceSeconds, 0) / 60);
    const base =
      minutes * XP_PER_MINUTE +
      atLeast(roundsCompleted, 0) * XP_PER_ROUND_COMPLETED +
      atLeast(promptsCompleted, 0) * XP_PER_PROMPT_COMPLETED;
    const withCompletion = base + (completedFully ? COMPLETION_BONUS : 0);
    // Kotlin's Float.toInt() truncates toward zero.
    const withDifficulty = Math.trunc(withCompletion * difficulty.xpMultiplier);
    const streakBonus =
      clamp(currentStreakDays, 0, MAX_STREAK_BONUS_DAYS) * STREAK_BONUS_PER_DAY;
    return atLeast(withDifficulty + streakBonus, 0);
  },
};

/* ---------- Leveling.kt ---------- */

const BASE_LEVEL_COST = 200;
const LEVEL_COST_STEP = 100;

export const Leveling = {
  xpCostForLevel(level) {
    const safeLevel = atLeast(level, 1);
    return BASE_LEVEL_COST + (safeLevel - 1) * LEVEL_COST_STEP;
  },
  levelFromTotalXp(totalXp) {
    let remaining = atLeast(totalXp, 0);
    let level = 1;
    while (remaining >= Leveling.xpCostForLevel(level)) {
      remaining -= Leveling.xpCostForLevel(level);
      level += 1;
    }
    return {
      level,
      xpIntoLevel: remaining,
      xpForNextLevel: Leveling.xpCostForLevel(level),
    };
  },
};

/* ---------- Streaks.kt ---------- */

export const Streaks = {
  isSameDay(aMillis, bMillis) {
    const a = new Date(aMillis);
    const b = new Date(bMillis);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  },
  isConsecutiveDay(previousMillis, currentMillis) {
    const next = new Date(previousMillis);
    next.setDate(next.getDate() + 1);
    return Streaks.isSameDay(next.getTime(), currentMillis);
  },
  /** Same day keeps the streak; the next day extends it; a bigger gap resets to 1. */
  updateStreak(previousStreakDays, lastPracticeMillis, nowMillis) {
    if (lastPracticeMillis == null) return 1;
    if (Streaks.isSameDay(lastPracticeMillis, nowMillis)) {
      return atLeast(previousStreakDays, 1);
    }
    if (Streaks.isConsecutiveDay(lastPracticeMillis, nowMillis)) {
      return atLeast(previousStreakDays, 0) + 1;
    }
    return 1;
  },
};

/* ---------- StimulusRotation.kt ---------- */

const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const StimulusRotation = {
  /** Prefers a rhyme key not already used elsewhere in the session. */
  pickRotationKey(currentKey, usedKeys, allKeys) {
    const all = Array.from(allKeys);
    const unused = all.filter((k) => k !== currentKey && !usedKeys.includes(k));
    if (unused.length > 0) return randomOf(unused);
    const others = all.filter((k) => k !== currentKey);
    return others.length > 0 ? randomOf(others) : currentKey;
  },
  /** Refreshes [count] words, preferring ones not in [exclude] to avoid repeats. */
  freshWords(pool, exclude, count) {
    if (!pool || pool.length === 0) return [];
    const target = Math.min(count, pool.length);
    const nonOverlapping = pool.filter((w) => !exclude.includes(w));
    const source = nonOverlapping.length >= target ? nonOverlapping : pool;
    return shuffled(source).slice(0, target);
  },
};

export { shuffled, randomOf };

/* ---------- Achievements.kt ---------- */

export const ACHIEVEMENTS = [
  {
    id: 'first_session',
    title: 'Primer paso',
    description: 'Completa tu primera sesión de entrenamiento.',
    isUnlocked: (s) => s.totalSessions >= 1,
  },
  {
    id: 'streak_3',
    title: 'Racha encendida',
    description: 'Entrena 3 días seguidos.',
    isUnlocked: (s) => Math.max(s.currentStreakDays, s.longestStreakDays) >= 3,
  },
  {
    id: 'streak_7',
    title: 'Flow constante',
    description: 'Completa 7 días seguidos entrenando.',
    isUnlocked: (s) => Math.max(s.currentStreakDays, s.longestStreakDays) >= 7,
  },
  {
    id: 'ten_sessions',
    title: 'Constancia',
    description: 'Completa 10 sesiones de entrenamiento.',
    isUnlocked: (s) => s.totalSessions >= 10,
  },
  {
    id: 'rounds_50',
    title: 'Métrica fina',
    description: 'Completa 50 rondas de práctica en total.',
    isUnlocked: (s) => s.totalRoundsCompleted >= 50,
  },
  {
    id: 'minutes_120',
    title: 'Resistencia de barras',
    description: 'Acumula 120 minutos de práctica.',
    isUnlocked: (s) => s.totalPracticeMinutes >= 120,
  },
  {
    id: 'level_5',
    title: 'Punchline listo',
    description: 'Alcanza el nivel 5.',
    isUnlocked: (s) => s.level >= 5,
  },
  {
    id: 'level_10',
    title: 'Maestro de métricas',
    description: 'Alcanza el nivel 10.',
    isUnlocked: (s) => s.level >= 10,
  },
];

export function evaluateNewlyUnlocked(stats, alreadyUnlockedIds) {
  const already = new Set(alreadyUnlockedIds);
  return ACHIEVEMENTS.filter((a) => !already.has(a.id) && a.isUnlocked(stats));
}

/* ---------- Formatting helpers (ported from the screen composables) ---------- */

export function formatSeconds(totalSeconds) {
  const s = atLeast(totalSeconds, 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatPracticeTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDateTime(millis) {
  const d = new Date(millis);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- Derived progress state (ported from AppViewModel) ---------- */

/** Share of total practice time spent at each difficulty. */
export function computeDifficultyDistribution(history) {
  if (!history || history.length === 0) {
    return DIFFICULTIES.map((d) => ({ name: d.label, progress: 0 }));
  }
  const totalSeconds = atLeast(
    history.reduce((sum, r) => sum + r.practiceSeconds, 0),
    1
  );
  return DIFFICULTIES.map((d) => {
    const secondsForDifficulty = history
      .filter((r) => r.difficulty === d.name)
      .reduce((sum, r) => sum + r.practiceSeconds, 0);
    return { name: d.label, progress: secondsForDifficulty / totalSeconds };
  });
}

/** XP earned per weekday of the current week (Monday-first, as on Android). */
export function computeWeeklyPerformance(history) {
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const totalsByDay = new Array(7).fill(0);

  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  while (startOfWeek.getDay() !== 1) {
    startOfWeek.setDate(startOfWeek.getDate() - 1);
  }

  (history || []).forEach((record) => {
    const when = new Date(record.timestampMillis);
    if (when >= startOfWeek) {
      // JS: Sunday=0 … Saturday=6  →  Monday-first index
      const index = (when.getDay() + 6) % 7;
      totalsByDay[index] += record.xpEarned;
    }
  });

  return labels.map((day, i) => ({ day, score: totalsByDay[i] }));
}
