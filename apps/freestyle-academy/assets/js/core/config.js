/* =========================================================================
   config.js — the only file you need to edit to take the web app live.

   With an empty config the app runs as a guest on this browser: every round
   plays, nothing is banked, and no AI scoring runs. That is exactly the
   app's own guest behaviour, so nothing here is a stub.
   ========================================================================= */

/**
 * Firebase Web config for the SAME project the app uses: academy-79fd1940.
 *
 * Firebase Console → Project settings → General → Your apps → **Add app → Web**
 * (the Android app's google-services.json will not work here: `appId` is
 * per-platform). Paste the generated object below.
 *
 * Then, under Authentication → Settings → Authorized domains, add
 * `litrenders.com` — Google sign-in is rejected from unlisted domains.
 *
 * These values are public by design; firestore.rules is what protects data.
 */
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: 'academy-79fd1940.firebaseapp.com',
  projectId: 'academy-79fd1940',
  storageBucket: 'academy-79fd1940.firebasestorage.app',
  messagingSenderId: '',
  appId: '',
};

/** The region the Cloud Functions are deployed to (functions/src/index.ts). */
export const FUNCTIONS_REGION = 'us-central1';

/**
 * Backing beats.
 *
 * The six MP3s in the APK are unlicensed free "type beats" and a release
 * blocker (docs/release-legal-checklist.md), so this build ships the beat
 * transport wired but the files absent. Drop licensed tracks into
 * assets/beats/ and list their file names here to turn it on — the selector,
 * the playlist and the transport all work the moment this array is non-empty.
 */
export const BEAT_FILES = [];

/** Where beat files are served from, relative to this page. */
export const BEATS_BASE = 'assets/beats/';

/**
 * Where the bundled avatar artwork is served from.
 *
 * The app ships 27 PNGs in its Android res/ folder. Copy them to
 * assets/img/avatars/ as `<avatar_id>.png` and set this to that folder to use
 * them; left empty, the web draws a distinct mark per avatar id instead (see
 * ui/avatars.js). The ids and their order are the same either way.
 */
export const AVATAR_ART_BASE = '';

/**
 * The legal documents the consent gate covers.
 *
 * The app reads these from the APK so the consent links work offline; on the
 * web they are pages on litrenders.com. The ids match the app's route
 * (`legal/{docId}`), and the URLs are relative to this app folder — point them
 * at wherever the published documents live. Bumping LEGAL_VERSION in
 * core/store.js is what asks everyone to accept a revision.
 */
export const LEGAL_DOCUMENTS = [
  { id: 'terms', title: 'Términos de uso', url: 'terms.html' },
  { id: 'privacy', title: 'Política de privacidad', url: 'privacy.html' },
];

export const legalDocumentById = (id) =>
  LEGAL_DOCUMENTS.find((d) => d.id === id) || null;

export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

export const APP_VERSION = '2.0.0';
