/* =========================================================================
   config.js — the ONLY file you need to edit to go live.

   Everything below is inert until you fill it in: with empty values the app
   runs fully in local mode (localStorage only, no sign-in, no AI feedback),
   which is exactly how it behaves offline.
   ========================================================================= */

/**
 * Firebase Web config.
 * Firebase Console → Project settings → General → Your apps → Web app → Config.
 * These values are public by design; Firestore security rules are what protect
 * the data (see firestore.rules).
 *
 * Remember to add your domain under Authentication → Settings → Authorized
 * domains, or Google sign-in will be rejected.
 */
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/**
 * Endpoint for the AI feedback Cloud Function (functions/index.js).
 *
 * Leave as the relative path below when the site is served by Firebase Hosting
 * — the rewrite in firebase.json routes it to the function on the same origin,
 * which avoids CORS entirely.
 *
 * If the site is hosted elsewhere (a different host serving litrenders.com),
 * use the deployed function's absolute URL instead, e.g.
 *   'https://us-central1-YOUR-PROJECT.cloudfunctions.net/analyzeRound'
 * and add that origin to ALLOWED_ORIGINS in functions/index.js.
 */
export const AI_FEEDBACK_ENDPOINT = '/api/analyzeRound';

/** Turns the whole AI feedback feature off without touching any other file. */
export const AI_FEEDBACK_ENABLED = true;

/** True once Firebase has real credentials to work with. */
export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

export const APP_VERSION = '1.0.0';
