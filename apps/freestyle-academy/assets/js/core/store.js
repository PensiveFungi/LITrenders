/* =========================================================================
   store.js — the web's AppViewModel.

   Single source of truth. Mirrors the app's rules exactly:

   • A GUEST banks nothing at all. Not sessions, not minutes, not racha, not
     logros. `accruesProgress` is the rule and it is enforced on both sides:
     nothing is written, and reads return zeros rather than whatever an older
     build may have left behind.
   • XP comes ONLY from the AI assessment of the real recording, and only for
     an ACCOUNT on a plan with XP progression. Gratis accounts keep their
     racha and sessions while earning none.
   • A session is recorded with xpEarned 0; the award is applied afterwards.
   ========================================================================= */

import {
  Leveling, Streaks, ACHIEVEMENTS, evaluateNewlyUnlocked, emptyStats,
  recentDayStarts, dailyTotals, weekdayLetter, difficultyFromName,
} from './domain.js';
import { PlanTier, PlanEntitlements, DataScope, planFromName } from './plans.js';
import { BUNDLED_RHYMES, BUNDLED_VERSION } from '../data/rhymes.js';
import {
  materialize, emptyOverlay, addWord as overlayAdd, removeWord as overlayRemove,
  renameWord as overlayRename, overlayIsEmpty,
} from './rhyme-library.js';
import {
  auth, loadProgressDoc, saveProgressDoc, loadRhymeOverlay, saveRhymeOverlay,
  loadProfileDoc, saveProfileDoc, loadRhymeLibraryManifest, loadRhymeLibraryChunks,
} from './firebase.js';

/* ---------- storage keys (mirroring SharedPreferences) ---------- */

const P = 'freestyle_academy_';
const GLOBAL = {
  DARK_MODE: `${P}dark_mode`,
  ONBOARDED: `${P}onboarding_completed`,
  LEGAL_VERSION: `${P}legal_accepted_version`,
  LEGAL_AT: `${P}legal_accepted_at`,
  MASTER: `${P}rhyme_master_json`,
  MASTER_VERSION: `${P}rhyme_master_version`,
  PLAN: `${P}plan_tier`,
};

/** Scoped keys: a guest and each account keep separate partitions. */
const scopedKey = (scope, name) =>
  `${P}${scope.kind === 'ACCOUNT' ? `acct_${scope.uid}` : 'guest'}_${name}`;

/** The legal documents' current version, from domain/LegalDocuments.kt. */
export const LEGAL_VERSION = 1;

/* ---------- safe localStorage ---------- */

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const readJson = (k, fb) => { const r = read(k); if (r == null) return fb; try { return JSON.parse(r); } catch { return fb; } };
const writeJson = (k, v) => write(k, JSON.stringify(v));
const readInt = (k, fb = 0) => { const n = Number(read(k)); return Number.isFinite(n) ? n : fb; };

/* ---------- emitter ---------- */

class Emitter {
  constructor() { this._l = new Map(); }
  on(event, fn) {
    if (!this._l.has(event)) this._l.set(event, new Set());
    this._l.get(event).add(fn);
    return () => this._l.get(event)?.delete(fn);
  }
  emit(event, payload) {
    this._l.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[store:${event}]`, err); }
    });
  }
}

/* ---------- store ---------- */

class Store extends Emitter {
  constructor() {
    super();
    this.scope = DataScope.guest();
    this.planTier = planFromName(read(GLOBAL.PLAN));
    this.darkMode = read(GLOBAL.DARK_MODE) !== 'false';
    this.onboardingCompleted = read(GLOBAL.ONBOARDED) === 'true';
    this.legalAcceptedVersion = readInt(GLOBAL.LEGAL_VERSION, 0);

    this.master = this.loadMaster();
    this.overlay = emptyOverlay();
    this.rhymes = materialize(this.master, this.overlay);
    this.history = [];
    this.profile = { alias: '', crew: '', punchline: '', avatarId: 'avatar_16' };

    /** Live session, owned by the flow screens. */
    this.battle = null;
    this.lastResult = null;

    this.progress = this.deriveProgress();
    this.loadPartition();
  }

  /* ----- scope ----- */

  get isAccount() { return DataScope.isAccount(this.scope); }
  get legalAccepted() { return this.legalAcceptedVersion >= LEGAL_VERSION; }
  get accruesProgress() { return PlanEntitlements.accruesProgress(this.scope); }
  get accruesXp() { return PlanEntitlements.accruesXp(this.scope, this.planTier); }

  /** Switches partition when the user signs in or out. */
  async setScope(scope) {
    if (this.scope.kind === scope.kind && this.scope.uid === scope.uid) return;
    this.scope = scope;
    this.loadPartition();
    this.emit('scope', scope);
    if (this.isAccount) await this.pullFromCloud();
    this.refreshProgress();
  }

  loadPartition() {
    this.overlay = readJson(scopedKey(this.scope, 'rhymes_overlay_json'), emptyOverlay());
    this.rhymes = materialize(this.master, this.overlay);
    this.history = readJson(scopedKey(this.scope, 'history_json'), []);
    this.profile = readJson(scopedKey(this.scope, 'profile_json'), {
      alias: '', crew: '', punchline: '', avatarId: 'avatar_16',
    });
    this.progress = this.deriveProgress();
    this.emit('rhymes', this.rhymes);
    this.emit('history', this.history);
    this.emit('profile', this.profile);
  }

  /* ----- master rhyme library ----- */

  loadMaster() {
    const cachedVersion = readInt(GLOBAL.MASTER_VERSION, 0);
    const cached = readJson(GLOBAL.MASTER, null);
    // Highest version wins, and a cache that can't be parsed doesn't get to
    // claim a version it cannot serve.
    if (cached && typeof cached === 'object' && Object.keys(cached).length > 0
        && cachedVersion > BUNDLED_VERSION) {
      return cached;
    }
    return BUNDLED_RHYMES;
  }

  /**
   * Checks the published master once per launch, for guests too, and
   * re-materializes only when something actually changed. Every failure
   * leaves the previous complete library in force.
   */
  async refreshMasterLibrary() {
    try {
      const manifest = await loadRhymeLibraryManifest();
      if (!manifest) return;
      const version = Number(manifest.version) || 0;
      const current = Math.max(readInt(GLOBAL.MASTER_VERSION, 0), BUNDLED_VERSION);
      if (version <= current) return;

      const groups = await loadRhymeLibraryChunks(Number(manifest.chunkCount) || 0);
      if (!groups) return;
      // A manifest whose group count disagrees with what arrived is not trusted.
      if (manifest.groupCount && Object.keys(groups).length !== Number(manifest.groupCount)) {
        console.warn('[library] manifest/group-count mismatch; keeping current library');
        return;
      }
      writeJson(GLOBAL.MASTER, groups);
      write(GLOBAL.MASTER_VERSION, String(version));
      this.master = groups;
      this.rhymes = materialize(this.master, this.overlay);
      this.emit('rhymes', this.rhymes);
    } catch (err) {
      console.warn('[library] refresh failed; keeping current library', err);
    }
  }

  /* ----- rhyme edits (overlay only) ----- */

  _commitOverlay(next, entry) {
    if (next == null) return false; // a no-op edit writes no history
    this.overlay = next;
    writeJson(scopedKey(this.scope, 'rhymes_overlay_json'), this.overlay);
    this.rhymes = materialize(this.master, this.overlay);
    if (entry) {
      this.history = [...this.history, entry];
      writeJson(scopedKey(this.scope, 'history_json'), this.history);
      this.emit('history', this.history);
    }
    this.emit('rhymes', this.rhymes);
    if (this.isAccount) saveRhymeOverlay(this.scope.uid, this.overlay);
    return true;
  }

  addWord(key, word) {
    const trimmed = String(word ?? '').trim();
    return this._commitOverlay(
      overlayAdd(this.master, this.overlay, key, trimmed),
      { rhymeKey: key, word: trimmed, type: 'ADDED', timestamp: Date.now() }
    );
  }

  removeWord(key, word) {
    return this._commitOverlay(
      overlayRemove(this.master, this.overlay, key, word),
      { rhymeKey: key, word, type: 'REMOVED', timestamp: Date.now() }
    );
  }

  renameWord(key, oldWord, newWord) {
    const trimmed = String(newWord ?? '').trim();
    return this._commitOverlay(
      overlayRename(this.master, this.overlay, key, oldWord, trimmed),
      { rhymeKey: key, word: `${oldWord} → ${trimmed}`, type: 'ADDED', timestamp: Date.now() }
    );
  }

  /* ----- preferences ----- */

  setDarkMode(enabled) {
    this.darkMode = enabled;
    write(GLOBAL.DARK_MODE, String(enabled));
    document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    this.emit('theme', enabled);
  }

  completeOnboarding() {
    this.onboardingCompleted = true;
    write(GLOBAL.ONBOARDED, 'true');
  }

  acceptLegalDocuments() {
    this.legalAcceptedVersion = LEGAL_VERSION;
    write(GLOBAL.LEGAL_VERSION, String(LEGAL_VERSION));
    write(GLOBAL.LEGAL_AT, String(Date.now()));
    this.emit('legal', true);
  }

  get legalAcceptedAt() { return readInt(GLOBAL.LEGAL_AT, 0) || null; }

  /** Testing hook, exactly as the app has it — no billing behind it. */
  setPlanTier(tier) {
    this.planTier = tier;
    write(GLOBAL.PLAN, tier);
    this.refreshProgress();
    this.emit('plan', tier);
  }

  setProfile(patch) {
    this.profile = { ...this.profile, ...patch };
    writeJson(scopedKey(this.scope, 'profile_json'), this.profile);
    this.emit('profile', this.profile);
    if (this.isAccount) saveProfileDoc(this.scope.uid, this.profile);
  }

  get displayAlias() {
    return this.profile.alias?.trim() || (this.isAccount ? 'MC' : 'Invitado');
  }

  /* ----- progression storage ----- */

  _pk(name) { return scopedKey(this.scope, `progress_${name}`); }

  get totalXp() { return this.accruesProgress ? readInt(this._pk('total_xp')) : 0; }
  get totalSessions() { return this.accruesProgress ? readInt(this._pk('total_sessions')) : 0; }
  get totalPracticeSeconds() { return this.accruesProgress ? readInt(this._pk('total_practice_seconds')) : 0; }
  get totalRounds() { return this.accruesProgress ? readInt(this._pk('total_rounds')) : 0; }
  get storedStreakDays() { return this.accruesProgress ? readInt(this._pk('current_streak')) : 0; }
  get longestStreakDays() { return this.accruesProgress ? readInt(this._pk('longest_streak')) : 0; }
  get lastPracticeMillis() {
    if (!this.accruesProgress) return null;
    const v = readInt(this._pk('last_practice_millis'));
    return v > 0 ? v : null;
  }
  get unlockedAchievementIds() { return this.accruesProgress ? readJson(this._pk('unlocked_json'), []) : []; }
  get sessionHistory() { return this.accruesProgress ? readJson(this._pk('session_history_json'), []) : []; }

  /** The racha shown in the UI — re-derived so a stale streak decays. */
  get displayRacha() {
    return Streaks.displayRacha(this.storedStreakDays, this.lastPracticeMillis, Date.now());
  }

  deriveProgress() {
    const totalXp = this.totalXp;
    const info = Leveling.levelFromTotalXp(totalXp);
    const history = this.sessionHistory;
    const unlocked = new Set(this.unlockedAchievementIds);

    const allAchievements = ACHIEVEMENTS.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      unlocked: unlocked.has(def.id),
      plusOnly: !PlanEntitlements.FREE_TIER_ACHIEVEMENT_IDS.has(def.id)
        && !PlanEntitlements.hasXpProgression(this.planTier),
      accountOnly: !this.isAccount,
    }));

    // Habilidades and the weekly graph render on every plan but stay at zero
    // where XP doesn't accrue, so an award from an older build can't draw a
    // climbing line either.
    const showsXp = this.accruesXp;
    const dayStarts = recentDayStarts();
    const scores = showsXp
      ? history.map((r) => ({ timestampMillis: r.timestampMillis, score: r.xpEarned || 0 }))
      : [];
    const totals = dailyTotals(dayStarts, scores);

    const totalSeconds = history.reduce((s, r) => s + (r.practiceSeconds || 0), 0);
    const byDifficulty = ['EASY', 'MEDIUM', 'HARD'].map((name) => {
      const d = difficultyFromName(name);
      if (!showsXp || totalSeconds === 0) return { name: d.label, progress: 0 };
      const secs = history.filter((r) => r.difficulty === name)
        .reduce((s, r) => s + (r.practiceSeconds || 0), 0);
      return { name: d.label, progress: secs / totalSeconds };
    });

    const lastXpSession = [...history].reverse().find((r) => (r.xpEarned || 0) > 0);

    return {
      currentLevel: info.level,
      currentXp: info.xpIntoLevel,
      nextLevelXp: info.xpForNextLevel,
      xpProgress: info.xpForNextLevel ? Math.min(1, info.xpIntoLevel / info.xpForNextLevel) : 0,
      totalXp,
      practiceStreakDays: this.displayRacha,
      totalSessions: this.totalSessions,
      totalPracticeMinutes: Math.floor(this.totalPracticeSeconds / 60),
      weeklyPerformance: dayStarts.map((d, i) => ({ day: weekdayLetter(d), score: totals[i] })),
      recentAchievements: allAchievements.filter((a) => a.unlocked).slice(-3),
      allAchievements,
      skillCategories: byDifficulty,
      sessionHistory: history,
      pointsReachedAtMillis: lastXpSession?.timestampMillis || 0,
    };
  }

  refreshProgress() {
    this.progress = this.deriveProgress();
    this.emit('progress', this.progress);
  }

  /* ----- completing a session ----- */

  /**
   * Records a finished session. **xpEarned is always 0 here** — the award, if
   * any, is applied afterwards by applyAiXpAward once the evaluation lands.
   *
   * A guest banks nothing: no history, no counters, no streak, no logros.
   */
  completeSession({ modeId, modeName, difficulty, rhymeKeys, roundsPlanned, roundsCompleted, practiceSeconds, isBattle = false }) {
    const now = Date.now();
    const record = {
      id: now,
      timestampMillis: now,
      modeId,
      modeName,
      difficulty: difficulty.name,
      difficultyLabel: difficulty.label,
      rhymeKeys: rhymeKeys || [],
      roundsPlanned,
      roundsCompleted,
      promptsCompleted: 0,
      practiceSeconds,
      xpEarned: 0,
      completedFully: roundsCompleted >= roundsPlanned,
      isBattle,
    };

    if (!this.accruesProgress) {
      // An unbanked result: the finish screen still shows what was played.
      const info = Leveling.levelFromTotalXp(0);
      this.lastResult = {
        record,
        newlyUnlockedAchievements: [],
        totalXp: 0,
        level: info.level,
        xpIntoLevel: info.xpIntoLevel,
        xpForNextLevel: info.xpForNextLevel,
        unbanked: true,
        streakDays: 0,
        streakAdvanced: false,
      };
      this.emit('result', this.lastResult);
      return this.lastResult;
    }

    const previousStreak = this.storedStreakDays;
    const last = this.lastPracticeMillis;
    const newStreak = Streaks.updateStreak(previousStreak, last, now);
    const streakAdvanced = last == null || !Streaks.isSameDay(last, now);

    write(this._pk('total_sessions'), String(this.totalSessions + 1));
    write(this._pk('total_practice_seconds'), String(this.totalPracticeSeconds + practiceSeconds));
    write(this._pk('total_rounds'), String(this.totalRounds + roundsCompleted));
    write(this._pk('current_streak'), String(newStreak));
    write(this._pk('longest_streak'), String(Math.max(this.longestStreakDays, newStreak)));
    write(this._pk('last_practice_millis'), String(now));
    writeJson(this._pk('session_history_json'), [...this.sessionHistory, record].slice(-50));

    if (isBattle) {
      write(this._pk('total_battles'), String(readInt(this._pk('total_battles')) + 1));
    }

    const unlocked = this._evaluateAchievements();
    this.refreshProgress();
    this.pushToCloud();

    const info = Leveling.levelFromTotalXp(this.totalXp);
    this.lastResult = {
      record,
      newlyUnlockedAchievements: unlocked,
      totalXp: this.totalXp,
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpForNextLevel: info.xpForNextLevel,
      unbanked: false,
      streakDays: newStreak,
      streakAdvanced,
    };
    this.emit('result', this.lastResult);
    return this.lastResult;
  }

  _evaluateAchievements() {
    const info = Leveling.levelFromTotalXp(this.totalXp);
    const stats = emptyStats({
      totalSessions: this.totalSessions,
      totalPracticeMinutes: Math.floor(this.totalPracticeSeconds / 60),
      totalRoundsCompleted: this.totalRounds,
      currentStreakDays: this.storedStreakDays,
      longestStreakDays: this.longestStreakDays,
      level: info.level,
      totalBattles: readInt(this._pk('total_battles')),
      totalBattleWins: readInt(this._pk('total_battle_wins')),
    });
    const already = this.unlockedAchievementIds;
    const fresh = evaluateNewlyUnlocked(stats, already)
      .filter((a) => PlanEntitlements.canUnlockAchievement(this.planTier, a.id));
    if (fresh.length) {
      writeJson(this._pk('unlocked_json'), [...already, ...fresh.map((a) => a.id)]);
    }
    return fresh.map((a) => ({
      id: a.id, title: a.title, description: a.description, unlocked: true,
    }));
  }

  /**
   * Applies the AI award to the session just recorded. Refuses whenever the
   * partition may not accrue XP — the same gate every XP-showing screen reads,
   * so no surface can promise an award this would reject.
   */
  applyAiXpAward(totalXp) {
    if (!this.accruesXp) return false;
    const award = Math.max(0, Math.round(totalXp));
    if (award === 0) return false;

    write(this._pk('total_xp'), String(this.totalXp + award));

    const history = this.sessionHistory;
    if (history.length) {
      history[history.length - 1] = { ...history[history.length - 1], xpEarned: award };
      writeJson(this._pk('session_history_json'), history);
    }
    if (this.lastResult) {
      this.lastResult.record = { ...this.lastResult.record, xpEarned: award };
      this.lastResult.totalXp = this.totalXp;
      const info = Leveling.levelFromTotalXp(this.totalXp);
      this.lastResult.level = info.level;
      this.lastResult.xpIntoLevel = info.xpIntoLevel;
      this.lastResult.xpForNextLevel = info.xpForNextLevel;
      const fresh = this._evaluateAchievements();
      if (fresh.length) {
        this.lastResult.newlyUnlockedAchievements = [
          ...this.lastResult.newlyUnlockedAchievements, ...fresh,
        ];
      }
    }
    this.refreshProgress();
    this.pushToCloud();
    this.emit('result', this.lastResult);
    return true;
  }

  /* ----- cloud sync (the account's own documents) ----- */

  progressSnapshot() {
    return {
      totalXp: this.totalXp,
      totalSessions: this.totalSessions,
      totalPracticeSeconds: this.totalPracticeSeconds,
      totalRoundsCompleted: this.totalRounds,
      currentStreakDays: this.storedStreakDays,
      longestStreakDays: this.longestStreakDays,
      lastPracticeMillis: this.lastPracticeMillis,
      unlockedAchievementIds: this.unlockedAchievementIds,
      sessionHistory: this.sessionHistory,
      syncedAt: Date.now(),
    };
  }

  async pullFromCloud() {
    if (!this.isAccount) return;
    const uid = this.scope.uid;
    const [remote, overlay, profile] = await Promise.all([
      loadProgressDoc(uid), loadRhymeOverlay(uid), loadProfileDoc(uid),
    ]);

    if (remote) {
      const localStamp = readInt(this._pk('synced_at'));
      // Whole-document last-write-wins, as the app's sync does.
      if ((remote.syncedAt || 0) >= localStamp) {
        const set = (k, v) => { if (Number.isFinite(v)) write(this._pk(k), String(v)); };
        set('total_xp', remote.totalXp);
        set('total_sessions', remote.totalSessions);
        set('total_practice_seconds', remote.totalPracticeSeconds);
        set('total_rounds', remote.totalRoundsCompleted);
        set('current_streak', remote.currentStreakDays);
        set('longest_streak', remote.longestStreakDays);
        set('last_practice_millis', remote.lastPracticeMillis);
        if (Array.isArray(remote.unlockedAchievementIds)) {
          writeJson(this._pk('unlocked_json'), remote.unlockedAchievementIds);
        }
        if (Array.isArray(remote.sessionHistory)) {
          writeJson(this._pk('session_history_json'), remote.sessionHistory);
        }
        write(this._pk('synced_at'), String(remote.syncedAt || Date.now()));
      }
    }

    if (overlay) {
      this.overlay = overlay;
      writeJson(scopedKey(this.scope, 'rhymes_overlay_json'), overlay);
      this.rhymes = materialize(this.master, this.overlay);
      this.emit('rhymes', this.rhymes);
    }
    if (profile) {
      this.profile = { ...this.profile, ...profile };
      writeJson(scopedKey(this.scope, 'profile_json'), this.profile);
      this.emit('profile', this.profile);
    }

    // A heartbeat on every sign-in, so the league projection backfills this
    // row without anybody opting in.
    this.pushToCloud();
    this.refreshProgress();
  }

  pushToCloud() {
    if (!this.isAccount) return;
    const snapshot = this.progressSnapshot();
    write(this._pk('synced_at'), String(snapshot.syncedAt));
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => saveProgressDoc(this.scope.uid, snapshot), 900);
  }

  /* ----- data reset ----- */

  /** Erasing all data resets this browser to a fresh-install state. */
  eraseAllData() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(P)) keys.push(k);
      }
      keys.forEach(drop);
    } catch { /* ignore */ }

    this.planTier = PlanTier.FREE;
    this.darkMode = true;
    this.onboardingCompleted = false;
    this.legalAcceptedVersion = 0;
    this.master = BUNDLED_RHYMES;
    this.overlay = emptyOverlay();
    this.rhymes = materialize(this.master, this.overlay);
    this.history = [];
    this.profile = { alias: '', crew: '', punchline: '', avatarId: 'avatar_16' };
    this.refreshProgress();
    this.emit('rhymes', this.rhymes);
    this.emit('history', this.history);
    this.emit('profile', this.profile);
  }

  get hasLocalEdits() { return !overlayIsEmpty(this.overlay); }
}

export const store = new Store();

/* Keep the store's partition in step with Firebase Auth. */
auth.onChange((user) => {
  store.setScope(user ? DataScope.account(user.uid) : DataScope.guest());
});
