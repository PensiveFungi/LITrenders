/* =========================================================================
   domain.js — port of app/src/main/java/com/freestyle/academy/domain/

   Pure functions, no DOM, no storage. Mirrors the Kotlin domain layer
   one-for-one so the two can be checked against the same numbers.

   NOTE: there is no XP formula here, deliberately. XP comes only from the
   AI assessment of the real recording — see core/ai.js.
   ========================================================================= */

/* ---------- Difficulty.kt ----------
   The cadence a session was played at. It shapes how much material a round
   puts on screen and labels the session in history. It does NOT scale XP. */

export const Difficulty = {
  EASY: { name: 'EASY', label: 'Fácil', wordsPerSection: 10 },
  MEDIUM: { name: 'MEDIUM', label: 'Medio', wordsPerSection: 8 },
  HARD: { name: 'HARD', label: 'Difícil', wordsPerSection: 6 },
};

export const DIFFICULTIES = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];

export const difficultyFromLabel = (label) =>
  DIFFICULTIES.find((d) => d.label === label) || Difficulty.MEDIUM;

export const difficultyFromName = (name) => Difficulty[name] || Difficulty.MEDIUM;

/* ---------- Leveling.kt ---------- */

const BASE_LEVEL_COST = 200;
const LEVEL_COST_STEP = 100;

export const Leveling = {
  xpCostForLevel(level) {
    return BASE_LEVEL_COST + (Math.max(1, level) - 1) * LEVEL_COST_STEP;
  },
  levelFromTotalXp(totalXp) {
    let remaining = Math.max(0, totalXp);
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
  isSameDay(a, b) {
    const x = new Date(a);
    const y = new Date(b);
    return (
      x.getFullYear() === y.getFullYear() &&
      x.getMonth() === y.getMonth() &&
      x.getDate() === y.getDate()
    );
  },
  isConsecutiveDay(previousMillis, currentMillis) {
    const next = new Date(previousMillis);
    next.setDate(next.getDate() + 1);
    return Streaks.isSameDay(next.getTime(), currentMillis);
  },
  /** Same day keeps it; the next day extends it; a bigger gap resets to 1. */
  updateStreak(previousStreakDays, lastPracticeMillis, nowMillis) {
    if (lastPracticeMillis == null) return 1;
    if (Streaks.isSameDay(lastPracticeMillis, nowMillis)) {
      return Math.max(1, previousStreakDays);
    }
    if (Streaks.isConsecutiveDay(lastPracticeMillis, nowMillis)) {
      return Math.max(0, previousStreakDays) + 1;
    }
    return 1;
  },
  /**
   * The live streak as of now, for display: the stored value is a snapshot
   * from the last session, so it is re-evaluated against the clock. Practised
   * today or yesterday keeps it alive; any larger gap is a broken streak.
   */
  currentStreak(storedStreakDays, lastPracticeMillis, nowMillis) {
    if (lastPracticeMillis == null) return 0;
    if (Streaks.isSameDay(lastPracticeMillis, nowMillis)) return storedStreakDays;
    if (Streaks.isConsecutiveDay(lastPracticeMillis, nowMillis)) return storedStreakDays;
    return 0;
  },
  /**
   * The racha shown in the UI: consecutive training days BEYOND the first,
   * so a lone first day shows 0 and day two shows 1.
   */
  displayRacha(storedStreakDays, lastPracticeMillis, nowMillis) {
    return Math.max(0, Streaks.currentStreak(storedStreakDays, lastPracticeMillis, nowMillis) - 1);
  },
};

/* ---------- Achievements.kt ---------- */

export const ACHIEVEMENTS = [
  { id: 'first_session', title: 'Primer paso', description: 'Completa tu primera sesión de entrenamiento.', isUnlocked: (s) => s.totalSessions >= 1 },
  { id: 'streak_3', title: 'Racha encendida', description: 'Entrena 3 días seguidos.', isUnlocked: (s) => Math.max(s.currentStreakDays, s.longestStreakDays) >= 3 },
  { id: 'streak_7', title: 'Flow constante', description: 'Completa 7 días seguidos entrenando.', isUnlocked: (s) => Math.max(s.currentStreakDays, s.longestStreakDays) >= 7 },
  { id: 'ten_sessions', title: 'Constancia', description: 'Completa 10 sesiones de entrenamiento.', isUnlocked: (s) => s.totalSessions >= 10 },
  { id: 'rounds_50', title: 'Métrica fina', description: 'Completa 50 rondas de práctica en total.', isUnlocked: (s) => s.totalRoundsCompleted >= 50 },
  { id: 'minutes_120', title: 'Resistencia de barras', description: 'Acumula 120 minutos de práctica.', isUnlocked: (s) => s.totalPracticeMinutes >= 120 },
  { id: 'level_5', title: 'Punchline listo', description: 'Alcanza el nivel 5.', isUnlocked: (s) => s.level >= 5 },
  { id: 'level_10', title: 'Maestro de métricas', description: 'Alcanza el nivel 10.', isUnlocked: (s) => s.level >= 10 },
  { id: 'first_battle', title: 'Al ruedo', description: 'Completa tu primera batalla local.', isUnlocked: (s) => s.totalBattles >= 1 },
  { id: 'battle_wins_3', title: 'Campeón de barrio', description: 'Gana 3 batallas locales.', isUnlocked: (s) => s.totalBattleWins >= 3 },
];

export function evaluateNewlyUnlocked(stats, alreadyUnlockedIds) {
  const already = new Set(alreadyUnlockedIds);
  return ACHIEVEMENTS.filter((a) => !already.has(a.id) && a.isUnlocked(stats));
}

export function emptyStats(overrides = {}) {
  return {
    totalSessions: 0,
    totalPracticeMinutes: 0,
    totalRoundsCompleted: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    level: 1,
    totalBattles: 0,
    totalBattleWins: 0,
    ...overrides,
  };
}

/* ---------- RoundMechanics.kt ---------- */

/** Canonical word-rotation cadences, shared by every mode that rotates words. */
export const WordRotationIntervals = {
  /** Easy: one new word every 10s (6 words across a 60s turn). */
  EASY_SECONDS: 10,
  /** Hard: one new word every 5s (12 words across a 60s turn). */
  HARD_SECONDS: 5,
};

export const MechanicType = {
  RHYME_WORDS: 'RhymeWords',
  THEME_PROMPT: 'ThemePrompt',
  IMAGE_STIMULUS: 'ImageStimulus',
  OBJECT_STIMULUS: 'ObjectStimulus',
  FREEFORM: 'Freeform',
};

export const Mechanic = {
  rhymeWords: (rotationIntervalSeconds = null) =>
    ({ type: MechanicType.RHYME_WORDS, rotationIntervalSeconds }),
  themePrompt: (pool) => ({ type: MechanicType.THEME_PROMPT, pool }),
  imageStimulus: () => ({ type: MechanicType.IMAGE_STIMULUS }),
  objectStimulus: () => ({ type: MechanicType.OBJECT_STIMULUS }),
  freeform: () => ({ type: MechanicType.FREEFORM }),
};

/** One scheduled round: what it's called, how long a turn lasts, its mechanic. */
export function battleRoundSpec({ id, title, durationSeconds, mechanic = Mechanic.freeform(), hasTurnRoles = false }) {
  return { id, title, durationSeconds, mechanic, hasTurnRoles };
}

const randomOf = (arr) => (arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

/**
 * Zero-based index of the rotating word at [elapsedSeconds] into a turn, or
 * null when this mechanic has no timed words. Derived from elapsed time
 * rather than a separate timer, so word swaps are pause- and restore-safe.
 */
export function wordIndexAt(mechanic, elapsedSeconds) {
  if (!mechanic || mechanic.type !== MechanicType.RHYME_WORDS) return null;
  const interval = mechanic.rotationIntervalSeconds;
  if (interval == null || interval <= 0) return null;
  return Math.floor(Math.max(0, elapsedSeconds) / interval);
}

/** Theme shown when a round starts: a random pool entry, or null. */
export function initialTheme(mechanic) {
  if (!mechanic || mechanic.type !== MechanicType.THEME_PROMPT) return null;
  return randomOf(mechanic.pool);
}

/** Reroll: a different entry from the same pool, or [current] unchanged. */
export function rerolledTheme(mechanic, current) {
  if (!mechanic || mechanic.type !== MechanicType.THEME_PROMPT) return current;
  const pool = mechanic.pool || [];
  if (current == null) return randomOf(pool);
  const others = pool.filter((t) => t !== current);
  return others.length === 0 ? current : randomOf(others);
}

/* ---------- RecentDays.kt ---------- */

/** How many calendar days a weekly graph covers, today included. */
export const RECENT_PERFORMANCE_DAYS = 7;

/** Start-of-day timestamps for the last 7 days, oldest first (today last). */
export function recentDayStarts(nowMillis = Date.now()) {
  const today = new Date(nowMillis);
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let offset = RECENT_PERFORMANCE_DAYS - 1; offset >= 0; offset -= 1) {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() - offset);
    out.push(d);
  }
  return out;
}

/**
 * Scores summed into the day buckets. Anything outside the window is ignored
 * rather than piled onto the nearest edge.
 */
export function dailyTotals(dayStarts, scores) {
  const totals = new Array(dayStarts.length).fill(0);
  (scores || []).forEach((sample) => {
    dayStarts.forEach((dayStart, index) => {
      if (Streaks.isSameDay(dayStart.getTime(), sample.timestampMillis)) {
        totals[index] += sample.score;
      }
    });
  });
  return totals;
}

/** Single-letter Spanish weekday label (L M X J V S D). */
export function weekdayLetter(date) {
  return ['D', 'L', 'M', 'X', 'J', 'V', 'S'][date.getDay()];
}

/* ---------- Formatting.kt + shared helpers ---------- */

/** "3m 25s" / "45s" — the app-wide duration label. */
export function formatDurationSeconds(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Clock face for the turn timer: 0:42, 1:07. */
export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "dd/MM/yyyy HH:mm" — the app-wide timestamp format. */
export function formatDateTime(millis) {
  const d = new Date(millis);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatPracticeTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/* ---------- shared list helpers ---------- */

export function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export { randomOf };
