/* =========================================================================
   store.js — port of viewmodel/AppViewModel.kt + data/*Repository.kt

   Single source of truth for app state. Screens subscribe with store.on().
   Persistence mirrors the Android SharedPreferences keys so the two stay
   conceptually aligned; on the web they live in localStorage and, when a
   user is signed in, sync to Firestore.
   ========================================================================= */

import {
  Difficulty, difficultyFromName, SessionTimer, SessionRewards, Leveling,
  Streaks, StimulusRotation, ACHIEVEMENTS, evaluateNewlyUnlocked,
  computeDifficultyDistribution, computeWeeklyPerformance, shuffled,
} from './domain.js';
import { INITIAL_RHYMES } from '../data/rhymes.js';

const PREFIX = 'freestyle_academy_';
const K = {
  RHYMES: `${PREFIX}rhymes_json`,
  HISTORY: `${PREFIX}history_json`,
  DARK_MODE: `${PREFIX}dark_mode`,
  TOTAL_XP: `${PREFIX}progress_total_xp`,
  TOTAL_SESSIONS: `${PREFIX}progress_total_sessions`,
  TOTAL_PRACTICE_SECONDS: `${PREFIX}progress_total_practice_seconds`,
  TOTAL_ROUNDS: `${PREFIX}progress_total_rounds`,
  CURRENT_STREAK: `${PREFIX}progress_current_streak`,
  LONGEST_STREAK: `${PREFIX}progress_longest_streak`,
  LAST_PRACTICE: `${PREFIX}progress_last_practice_millis`,
  UNLOCKED: `${PREFIX}progress_unlocked_achievements_json`,
  SESSION_HISTORY: `${PREFIX}progress_session_history_json`,
  ALIAS: `${PREFIX}profile_alias`,
};

const MAX_HISTORY_ENTRIES = 50;

/* ---------- localStorage helpers (never throw) ---------- */

function readRaw(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeRaw(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
}
function readJson(key, fallback) {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
function writeJson(key, value) { writeRaw(key, JSON.stringify(value)); }
function readInt(key, fallback = 0) {
  const raw = readRaw(key);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/* ---------- Tiny event emitter ---------- */

class Emitter {
  constructor() { this.listeners = new Map(); }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { this.listeners.get(event)?.delete(fn); }
  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[store] ${event} listener`, err); }
    });
  }
}

/* ---------- Store ---------- */

class Store extends Emitter {
  constructor() {
    super();

    // Persisted state
    this.rhymes = this.loadRhymes();
    this.history = readJson(K.HISTORY, []);           // rhyme add/remove log
    this.darkMode = readRaw(K.DARK_MODE) !== 'false'; // defaults to true, as on Android
    this.alias = readRaw(K.ALIAS) || 'Freestyler';

    // Live session state
    this.session = null;            // SessionSection[] | null
    this.activeSessionInfo = null;
    this.timerPaused = false;
    this.lastResult = null;

    // Session internals (mirror the private ViewModel fields)
    this.timerHandle = null;
    this.sectionEndAtMillis = [];
    this.sectionDurations = [];
    this.pausedAtMillis = null;
    this.totalPausedMillis = 0;
    this.sessionStartMillis = 0;
    this.promptsCompletedThisSession = 0;
    this.allowStimulusRotation = false;
    this.wordsPerSectionCount = Difficulty.MEDIUM.wordsPerSection;
    this.activeModeId = 'libre';
    this.activeModeName = 'Libre';
    this.activeDifficulty = Difficulty.MEDIUM;

    // Per-round audio captured during a session, consumed by the results screen
    this.roundRecordings = [];

    this.progress = this.deriveProgressState();

    // Remote sync hook, installed by firebase.js once a user signs in
    this.remote = null;
  }

  /* ----- Rhyme dictionary (RhymeRepository) ----- */

  loadRhymes() {
    const stored = readJson(K.RHYMES, null);
    if (!stored || typeof stored !== 'object') {
      writeJson(K.RHYMES, INITIAL_RHYMES);
      return { ...INITIAL_RHYMES };
    }
    // Seed any groups added to the app since this browser last loaded.
    const missing = {};
    Object.keys(INITIAL_RHYMES).forEach((key) => {
      if (!(key in stored)) missing[key] = INITIAL_RHYMES[key];
    });
    if (Object.keys(missing).length > 0) {
      const merged = { ...stored, ...missing };
      writeJson(K.RHYMES, merged);
      return merged;
    }
    return stored;
  }

  saveRhymes() {
    writeJson(K.RHYMES, this.rhymes);
    this.remote?.pushRhymes(this.rhymes);
    this.emit('rhymes', this.rhymes);
  }

  saveHistory() {
    writeJson(K.HISTORY, this.history);
    this.remote?.pushHistory(this.history);
    this.emit('history', this.history);
  }

  addWord(rhymeKey, word) {
    const trimmed = (word || '').trim();
    if (!trimmed) return false;
    const list = this.rhymes[rhymeKey];
    if (!list) return false;
    if (list.some((w) => w.toLowerCase() === trimmed.toLowerCase())) return false;
    this.rhymes = { ...this.rhymes, [rhymeKey]: [...list, trimmed] };
    this.saveRhymes();
    this.history = [
      ...this.history,
      { rhymeKey, word: trimmed, type: 'ADDED', timestamp: Date.now() },
    ];
    this.saveHistory();
    return true;
  }

  removeWord(rhymeKey, word) {
    const list = this.rhymes[rhymeKey];
    if (!list) return false;
    const index = list.indexOf(word);
    if (index === -1) return false;
    const next = list.slice();
    next.splice(index, 1);
    this.rhymes = { ...this.rhymes, [rhymeKey]: next };
    this.saveRhymes();
    this.history = [
      ...this.history,
      { rhymeKey, word, type: 'REMOVED', timestamp: Date.now() },
    ];
    this.saveHistory();
    return true;
  }

  /* ----- Theme & profile ----- */

  setDarkMode(enabled) {
    this.darkMode = enabled;
    writeRaw(K.DARK_MODE, String(enabled));
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    this.emit('theme', enabled);
  }

  setAlias(alias) {
    this.alias = (alias || '').trim() || 'Freestyler';
    writeRaw(K.ALIAS, this.alias);
    this.emit('profile', this.alias);
  }

  /* ----- Progression persistence (ProgressRepository) ----- */

  get totalXp() { return readInt(K.TOTAL_XP); }
  get totalSessions() { return readInt(K.TOTAL_SESSIONS); }
  get totalPracticeSeconds() { return readInt(K.TOTAL_PRACTICE_SECONDS); }
  get totalRoundsCompleted() { return readInt(K.TOTAL_ROUNDS); }
  get currentStreakDays() { return readInt(K.CURRENT_STREAK); }
  get longestStreakDays() { return readInt(K.LONGEST_STREAK); }
  get lastPracticeMillis() { const v = readInt(K.LAST_PRACTICE); return v > 0 ? v : null; }
  get unlockedAchievementIds() { return readJson(K.UNLOCKED, []); }
  get sessionHistory() { return readJson(K.SESSION_HISTORY, []); }

  /** Replaces all progression state — used by the Firestore pull on sign-in. */
  applyProgressSnapshot(snap) {
    if (!snap) return;
    if (snap.rhymes && typeof snap.rhymes === 'object' && Object.keys(snap.rhymes).length) {
      this.rhymes = snap.rhymes;
      writeJson(K.RHYMES, this.rhymes);
      this.emit('rhymes', this.rhymes);
    }
    if (Array.isArray(snap.history)) {
      this.history = snap.history;
      writeJson(K.HISTORY, this.history);
      this.emit('history', this.history);
    }
    const num = (v, cur) => (Number.isFinite(v) ? v : cur);
    writeRaw(K.TOTAL_XP, String(num(snap.totalXp, this.totalXp)));
    writeRaw(K.TOTAL_SESSIONS, String(num(snap.totalSessions, this.totalSessions)));
    writeRaw(K.TOTAL_PRACTICE_SECONDS, String(num(snap.totalPracticeSeconds, this.totalPracticeSeconds)));
    writeRaw(K.TOTAL_ROUNDS, String(num(snap.totalRoundsCompleted, this.totalRoundsCompleted)));
    writeRaw(K.CURRENT_STREAK, String(num(snap.currentStreakDays, this.currentStreakDays)));
    writeRaw(K.LONGEST_STREAK, String(num(snap.longestStreakDays, this.longestStreakDays)));
    if (Number.isFinite(snap.lastPracticeMillis)) {
      writeRaw(K.LAST_PRACTICE, String(snap.lastPracticeMillis));
    }
    if (Array.isArray(snap.unlockedAchievementIds)) writeJson(K.UNLOCKED, snap.unlockedAchievementIds);
    if (Array.isArray(snap.sessionHistory)) writeJson(K.SESSION_HISTORY, snap.sessionHistory);
    if (typeof snap.alias === 'string' && snap.alias.trim()) {
      this.alias = snap.alias.trim();
      writeRaw(K.ALIAS, this.alias);
      this.emit('profile', this.alias);
    }
    this.refreshProgressState();
  }

  /** The full persisted payload, as pushed to Firestore. */
  progressSnapshot() {
    return {
      alias: this.alias,
      rhymes: this.rhymes,
      history: this.history,
      totalXp: this.totalXp,
      totalSessions: this.totalSessions,
      totalPracticeSeconds: this.totalPracticeSeconds,
      totalRoundsCompleted: this.totalRoundsCompleted,
      currentStreakDays: this.currentStreakDays,
      longestStreakDays: this.longestStreakDays,
      lastPracticeMillis: this.lastPracticeMillis,
      unlockedAchievementIds: this.unlockedAchievementIds,
      sessionHistory: this.sessionHistory,
      updatedAt: Date.now(),
    };
  }

  deriveProgressState() {
    const totalXp = this.totalXp;
    const levelInfo = Leveling.levelFromTotalXp(totalXp);
    const history = this.sessionHistory;
    const unlockedIds = new Set(this.unlockedAchievementIds);
    const allAchievements = ACHIEVEMENTS.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      unlocked: unlockedIds.has(def.id),
    }));
    return {
      currentLevel: levelInfo.level,
      currentXp: levelInfo.xpIntoLevel,
      nextLevelXp: levelInfo.xpForNextLevel,
      xpProgress: levelInfo.xpForNextLevel === 0
        ? 0
        : Math.min(1, Math.max(0, levelInfo.xpIntoLevel / levelInfo.xpForNextLevel)),
      practiceStreakDays: this.currentStreakDays,
      totalSessions: this.totalSessions,
      totalPracticeMinutes: Math.floor(this.totalPracticeSeconds / 60),
      weeklyPerformance: computeWeeklyPerformance(history),
      recentAchievements: allAchievements.filter((a) => a.unlocked).slice(-3),
      allAchievements,
      skillCategories: computeDifficultyDistribution(history),
      sessionHistory: history,
    };
  }

  refreshProgressState() {
    this.progress = this.deriveProgressState();
    this.emit('progress', this.progress);
  }

  /* ----- Session lifecycle ----- */

  /**
   * Starts a session. Every section's countdown begins PAUSED — the session
   * screen calls toggleTimerPause() once recording actually starts, so setup
   * and countdown time never count against the round.
   */
  startSession({
    sectionCount, rhymeKeys, sectionDurationsSeconds,
    modeId, modeName, difficulty, allowStimulusChanges,
  }) {
    const count = Math.min(4, Math.max(1, sectionCount));
    const durations = Array.from({ length: count }, (_, i) => {
      if (!sectionDurationsSeconds || sectionDurationsSeconds.length === 0) return 45;
      return sectionDurationsSeconds[i] ?? sectionDurationsSeconds[sectionDurationsSeconds.length - 1];
    });
    const keys = Array.from({ length: count }, (_, i) => rhymeKeys[i] ?? rhymeKeys[0] ?? '');

    this.activeModeId = modeId;
    this.activeModeName = modeName;
    this.activeDifficulty = difficulty;
    this.allowStimulusRotation = allowStimulusChanges;
    this.wordsPerSectionCount = difficulty.wordsPerSection;
    this.activeSessionInfo = {
      modeId, modeName, difficulty, allowStimulusChanges,
      roundDurationsSeconds: durations,
    };

    this.sessionStartMillis = Date.now();
    this.totalPausedMillis = 0;
    this.pausedAtMillis = this.sessionStartMillis;
    this.promptsCompletedThisSession = 0;
    this.sectionDurations = durations.slice();
    this.sectionEndAtMillis = new Array(count).fill(this.sessionStartMillis);
    this.roundRecordings = [];

    this.session = keys.map((key, index) => {
      const pool = this.rhymes[key] || [];
      const duration = durations[index];
      this.sectionEndAtMillis[index] = SessionTimer.endAtMillis(this.sessionStartMillis, duration);
      return {
        rhymeKey: key,
        displayedWords: shuffled(pool).slice(0, this.wordsPerSectionCount),
        remainingSeconds: duration,
        cycleDurationSeconds: duration,
      };
    });

    this.timerPaused = true;
    this.lastResult = null;
    this.startTicker();
    this.emit('session', this.session);
  }

  startTicker() {
    this.stopTicker();
    this.timerHandle = window.setInterval(() => {
      if (this.timerPaused) return;
      const current = this.session;
      if (!current) return;
      const now = Date.now();
      const usedKeys = current.map((s) => s.rhymeKey);
      let changed = false;

      const updated = current.map((section, index) => {
        const endAt = this.sectionEndAtMillis[index];
        if (endAt == null) return section;
        const remaining = SessionTimer.remainingSeconds(endAt, now);
        if (remaining <= 0) {
          this.promptsCompletedThisSession += 1;
          const duration = this.sectionDurations[index] ?? 45;
          this.sectionEndAtMillis[index] = SessionTimer.endAtMillis(now, duration);
          const newKey = this.allowStimulusRotation
            ? StimulusRotation.pickRotationKey(section.rhymeKey, usedKeys, Object.keys(this.rhymes))
            : section.rhymeKey;
          const pool = this.rhymes[newKey] || [];
          changed = true;
          return {
            rhymeKey: newKey,
            displayedWords: StimulusRotation.freshWords(pool, section.displayedWords, this.wordsPerSectionCount),
            remainingSeconds: duration,
            cycleDurationSeconds: duration,
          };
        }
        if (remaining !== section.remainingSeconds) {
          changed = true;
          return { ...section, remainingSeconds: remaining };
        }
        return section;
      });

      if (changed) {
        this.session = updated;
        this.emit('session', this.session);
      }
    }, 250);
  }

  stopTicker() {
    if (this.timerHandle != null) {
      window.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /** Replaces one word with an unused word from the same rhyme pool. */
  swapWord(sectionIndex, wordIndex) {
    const current = this.session;
    if (!current) return;
    const section = current[sectionIndex];
    if (!section) return;
    const pool = this.rhymes[section.rhymeKey] || [];
    const available = pool.filter((w) => !section.displayedWords.includes(w));
    if (available.length === 0) return;
    const newWord = available[Math.floor(Math.random() * available.length)];
    const updatedWords = section.displayedWords.slice();
    updatedWords[wordIndex] = newWord;
    const next = current.slice();
    next[sectionIndex] = { ...section, displayedWords: updatedWords };
    this.session = next;
    this.promptsCompletedThisSession += 1;
    this.emit('session', this.session);
  }

  /** Switches a section to a different rhyme group and resets its words + timer. */
  changeSectionRhyme(sectionIndex, newRhymeKey) {
    const current = this.session;
    if (!current) return;
    const section = current[sectionIndex];
    if (!section) return;
    const pool = this.rhymes[newRhymeKey] || [];
    const duration = this.sectionDurations[sectionIndex] ?? section.cycleDurationSeconds ?? 45;
    if (sectionIndex < this.sectionEndAtMillis.length) {
      this.sectionEndAtMillis[sectionIndex] = SessionTimer.endAtMillis(Date.now(), duration);
    }
    const next = current.slice();
    next[sectionIndex] = {
      rhymeKey: newRhymeKey,
      displayedWords: shuffled(pool).slice(0, this.wordsPerSectionCount),
      remainingSeconds: duration,
      cycleDurationSeconds: duration,
    };
    this.session = next;
    this.promptsCompletedThisSession += 1;
    this.emit('session', this.session);
  }

  /** Fresh sample of words for one section, and resets its timer. */
  resetSection(sectionIndex) {
    const current = this.session;
    if (!current) return;
    const section = current[sectionIndex];
    if (!section) return;
    const pool = this.rhymes[section.rhymeKey] || [];
    const duration = this.sectionDurations[sectionIndex] ?? section.cycleDurationSeconds ?? 45;
    if (sectionIndex < this.sectionEndAtMillis.length) {
      this.sectionEndAtMillis[sectionIndex] = SessionTimer.endAtMillis(Date.now(), duration);
    }
    const next = current.slice();
    next[sectionIndex] = {
      ...section,
      displayedWords: StimulusRotation.freshWords(pool, section.displayedWords, this.wordsPerSectionCount),
      remainingSeconds: duration,
      cycleDurationSeconds: duration,
    };
    this.session = next;
    this.promptsCompletedThisSession += 1;
    this.emit('session', this.session);
  }

  toggleTimerPause() {
    const now = Date.now();
    if (this.pausedAtMillis != null) {
      const pausedDuration = now - this.pausedAtMillis;
      this.totalPausedMillis += pausedDuration;
      this.sectionEndAtMillis = this.sectionEndAtMillis.map((v) => (v == null ? v : v + pausedDuration));
      this.pausedAtMillis = null;
      this.timerPaused = false;
    } else {
      this.pausedAtMillis = now;
      this.timerPaused = true;
    }
    this.emit('timer', this.timerPaused);
  }

  /** Abandons the session without saving progress. */
  endSession() { this.cleanupSession(); }

  cleanupSession() {
    this.stopTicker();
    this.sectionEndAtMillis = [];
    this.sectionDurations = [];
    this.pausedAtMillis = null;
    this.totalPausedMillis = 0;
    this.timerPaused = false;
    this.session = null;
    this.activeSessionInfo = null;
    this.emit('session', null);
  }

  attachRecording(roundIndex, blob) {
    this.roundRecordings[roundIndex] = blob;
  }

  /**
   * Ends the session honestly, persists progression, and returns the result.
   * [roundsCompleted] reflects how many rounds the player actually went
   * through, so an early "Completar" is recorded as a partial session.
   */
  completeSession(roundsCompleted) {
    const sections = this.session;
    if (!sections) return null;

    const planned = sections.length;
    const actualRoundsCompleted = Math.min(planned, Math.max(0, roundsCompleted ?? planned));
    const completedFully = actualRoundsCompleted >= planned;
    const now = Date.now();
    const pausedJustNow = this.pausedAtMillis != null ? now - this.pausedAtMillis : 0;
    const practiceSeconds = Math.max(
      0,
      Math.floor((now - this.sessionStartMillis - this.totalPausedMillis - pausedJustNow) / 1000)
    );

    const newStreak = Streaks.updateStreak(this.currentStreakDays, this.lastPracticeMillis, now);
    const xpEarned = SessionRewards.calculateXp({
      practiceSeconds,
      roundsCompleted: actualRoundsCompleted,
      promptsCompleted: this.promptsCompletedThisSession,
      difficulty: this.activeDifficulty,
      completedFully,
      currentStreakDays: newStreak,
    });

    const record = {
      id: now,
      timestampMillis: now,
      modeId: this.activeModeId,
      modeName: this.activeModeName,
      difficulty: this.activeDifficulty.name,
      difficultyLabel: this.activeDifficulty.label,
      rhymeKeys: sections.map((s) => s.rhymeKey),
      roundsPlanned: planned,
      roundsCompleted: actualRoundsCompleted,
      promptsCompleted: this.promptsCompletedThisSession,
      practiceSeconds,
      xpEarned,
      completedFully,
    };

    const result = this.persistCompletedSession(record, newStreak, now);
    const recordings = this.roundRecordings.slice(0, planned).filter(Boolean);
    this.cleanupSession();
    this.lastResult = { ...result, recordings };
    this.emit('result', this.lastResult);
    return this.lastResult;
  }

  persistCompletedSession(record, newStreak, now) {
    const newTotalXp = this.totalXp + record.xpEarned;
    const newTotalSessions = this.totalSessions + 1;
    const newTotalPracticeSeconds = this.totalPracticeSeconds + record.practiceSeconds;
    const newTotalRounds = this.totalRoundsCompleted + record.roundsCompleted;
    const newLongestStreak = Math.max(this.longestStreakDays, newStreak);
    const newHistory = [...this.sessionHistory, record].slice(-MAX_HISTORY_ENTRIES);

    writeRaw(K.TOTAL_XP, String(newTotalXp));
    writeRaw(K.TOTAL_SESSIONS, String(newTotalSessions));
    writeRaw(K.TOTAL_PRACTICE_SECONDS, String(newTotalPracticeSeconds));
    writeRaw(K.TOTAL_ROUNDS, String(newTotalRounds));
    writeRaw(K.CURRENT_STREAK, String(newStreak));
    writeRaw(K.LONGEST_STREAK, String(newLongestStreak));
    writeRaw(K.LAST_PRACTICE, String(now));
    writeJson(K.SESSION_HISTORY, newHistory);

    const levelInfo = Leveling.levelFromTotalXp(newTotalXp);
    const stats = {
      totalSessions: newTotalSessions,
      totalPracticeMinutes: Math.floor(newTotalPracticeSeconds / 60),
      totalRoundsCompleted: newTotalRounds,
      currentStreakDays: newStreak,
      longestStreakDays: newLongestStreak,
      level: levelInfo.level,
    };
    const alreadyUnlocked = this.unlockedAchievementIds;
    const newlyUnlocked = evaluateNewlyUnlocked(stats, alreadyUnlocked);
    if (newlyUnlocked.length > 0) {
      writeJson(K.UNLOCKED, [...alreadyUnlocked, ...newlyUnlocked.map((a) => a.id)]);
    }

    this.refreshProgressState();
    this.remote?.pushProgress(this.progressSnapshot());

    return {
      record,
      newlyUnlockedAchievements: newlyUnlocked.map((a) => ({
        id: a.id, title: a.title, description: a.description, unlocked: true,
      })),
      totalXp: newTotalXp,
      level: levelInfo.level,
      xpIntoLevel: levelInfo.xpIntoLevel,
      xpForNextLevel: levelInfo.xpForNextLevel,
    };
  }

  /** Wipes every local key. Used by Ajustes → "Borrar datos locales". */
  resetLocalData() {
    Object.values(K).forEach((key) => {
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    });
    this.rhymes = { ...INITIAL_RHYMES };
    writeJson(K.RHYMES, this.rhymes);
    this.history = [];
    this.alias = 'Freestyler';
    this.refreshProgressState();
    this.emit('rhymes', this.rhymes);
    this.emit('history', this.history);
    this.emit('profile', this.alias);
  }
}

export const store = new Store();
export { difficultyFromName };
