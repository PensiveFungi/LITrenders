/* =========================================================================
   plans.js — port of data/Plans.kt and data/DataScope.kt

   Single source of truth for what each tier is entitled to. Every gate in the
   app calls these helpers rather than comparing tiers inline.

   Entitlement STATE only — there is no payment processing behind it, exactly
   as in the app.
   ========================================================================= */

export const PlanTier = {
  FREE: 'FREE',
  PLUS: 'PLUS',
  PROFESSIONAL: 'PROFESSIONAL',
};

const DISPLAY_NAMES = {
  [PlanTier.FREE]: 'Gratis',
  [PlanTier.PLUS]: 'Plus',
  [PlanTier.PROFESSIONAL]: 'Pro',
};

export function planDisplayName(tier) {
  return DISPLAY_NAMES[tier] || 'Gratis';
}

/** The value the top tier was persisted as before it was renamed. */
const LEGACY_PROFESSIONAL_NAME = 'PREMIUM';

export function planFromName(name) {
  if (name && Object.prototype.hasOwnProperty.call(PlanTier, name)) return name;
  return name === LEGACY_PROFESSIONAL_NAME ? PlanTier.PROFESSIONAL : PlanTier.FREE;
}

/* ---------- DataScope ----------
   A partition is either a guest on this device, or a signed-in account. */

export const DataScope = {
  guest: () => ({ kind: 'GUEST' }),
  account: (uid) => ({ kind: 'ACCOUNT', uid }),
  isAccount: (scope) => Boolean(scope) && scope.kind === 'ACCOUNT',
};

/* ---------- PlanEntitlements ---------- */

/** Feature launch flags: neither feature exists yet, so no tier can reach it. */
const ONLINE_BATTLES_LAUNCHED = false;
const TOURNAMENTS_LAUNCHED = false;

const paid = (tier) => tier !== PlanTier.FREE;

export const PlanEntitlements = {
  /** Plus and Pro remove all advertising. */
  removesAds: (tier) => paid(tier),

  /** Plus and Pro grant unlimited battle credits. */
  hasUnlimitedCredits: (tier) => paid(tier),

  /** Plus and Pro unlock the rhyme library and session history. */
  hasLibraryAndHistory: (tier) => paid(tier),

  /** Plus and Pro can record their sessions and keep them. */
  canRecordSessions: (tier) => paid(tier),

  /** Plus and Pro have the XP/level progression. */
  hasXpProgression: (tier) => paid(tier),

  /**
   * The one rule for whether a partition may accrue (and be shown) XP:
   * an ACCOUNT scope on a tier with XP progression. Both halves matter.
   */
  accruesXp: (scope, tier) => DataScope.isAccount(scope) && paid(tier),

  /**
   * Whether a partition banks progression at all — sessions, practice
   * minutes, racha, logros. Only an account does. Strictly wider than
   * accruesXp: a Gratis account keeps its racha while earning no XP.
   */
  accruesProgress: (scope) => DataScope.isAccount(scope),

  /** The logros every tier can unlock; the rest are a Plus/Pro perk. */
  FREE_TIER_ACHIEVEMENT_IDS: new Set(['first_session', 'streak_3', 'streak_7']),

  canUnlockAchievement(tier, achievementId) {
    return paid(tier) || PlanEntitlements.FREE_TIER_ACHIEVEMENT_IDS.has(achievementId);
  },

  /** The avatars every tier can equip. Keep in sync with AvatarStyles.all. */
  FREE_TIER_AVATAR_IDS: new Set(['avatar_16', 'avatar_17', 'avatar_18', 'avatar_12', 'avatar_11']),

  canUseAvatar(tier, avatarId) {
    return paid(tier) || PlanEntitlements.FREE_TIER_AVATAR_IDS.has(avatarId);
  },

  /** Studio and its custom-theme tools are exclusive to Pro. */
  canAccessStudio: (tier) => tier === PlanTier.PROFESSIONAL,

  /** Recording transcripts are a Pro-only tool. */
  hasTranscripts: (tier) => tier === PlanTier.PROFESSIONAL,

  /** Plus can browse its recordings in Studio; creation remains Pro-only. */
  canBrowseStudio: (tier) => paid(tier),

  canAccessOnlineBattles: (tier) => ONLINE_BATTLES_LAUNCHED && paid(tier),

  canAccessTournaments: (tier) => TOURNAMENTS_LAUNCHED && tier === PlanTier.PROFESSIONAL,
};

export { ONLINE_BATTLES_LAUNCHED, TOURNAMENTS_LAUNCHED };
