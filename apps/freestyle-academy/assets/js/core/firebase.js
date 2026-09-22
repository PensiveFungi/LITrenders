/* =========================================================================
   firebase.js — Auth (Google) + Firestore progress sync

   Loaded lazily: the Firebase SDK is only fetched when config.js has real
   credentials. With empty config the app stays in local-only mode and this
   module resolves to a null session, so nothing here can break the app.

   Firestore document per user:  users/{uid}  ← the store's progressSnapshot()
   That document is also where subscription entitlements will live, so the app
   and the web version read the same tier from one place.
   ========================================================================= */

import { FIREBASE_CONFIG, isFirebaseConfigured } from './config.js';
import { store } from './store.js';

const SDK_VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export const auth = {
  available: false,
  user: null,
  entitlement: { tier: 'free', source: 'local', activeUntil: null },
  _listeners: new Set(),

  onChange(fn) {
    this._listeners.add(fn);
    fn(this.user);
    return () => this._listeners.delete(fn);
  },
  _emit() {
    this._listeners.forEach((fn) => {
      try { fn(this.user); } catch (err) { console.error('[auth] listener', err); }
    });
  },
};

let app = null;
let firebaseAuth = null;
let db = null;
let sdk = null;
let pushTimer = null;

/** Debounced write so rapid edits don't hammer Firestore. */
function schedulePush(payload) {
  if (!db || !auth.user) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(async () => {
    try {
      await sdk.setDoc(sdk.doc(db, 'users', auth.user.uid), payload, { merge: true });
    } catch (err) {
      console.warn('[firebase] push failed; local data is still saved', err);
    }
  }, 1200);
}

function installRemote() {
  store.remote = {
    pushProgress: (snapshot) => schedulePush(snapshot),
    pushRhymes: (rhymes) => schedulePush({ rhymes, updatedAt: Date.now() }),
    pushHistory: (history) => schedulePush({ history, updatedAt: Date.now() }),
  };
}

function clearRemote() {
  store.remote = null;
  window.clearTimeout(pushTimer);
}

async function pullSnapshot(uid) {
  try {
    const snap = await sdk.getDoc(sdk.doc(db, 'users', uid));
    if (!snap.exists()) {
      // First sign-in on this account: seed the cloud doc from local data.
      await sdk.setDoc(sdk.doc(db, 'users', uid), store.progressSnapshot(), { merge: true });
      return;
    }
    const data = snap.data();
    // Last-write-wins on whole-document level, matching how the Android app
    // would sync: newer remote data replaces local, otherwise local is pushed.
    const localUpdatedAt = 0;
    if ((data.updatedAt || 0) >= localUpdatedAt) {
      store.applyProgressSnapshot(data);
    }
    if (data.entitlement) {
      auth.entitlement = {
        tier: data.entitlement.tier || 'free',
        source: data.entitlement.source || 'unknown',
        activeUntil: data.entitlement.activeUntil || null,
      };
    }
  } catch (err) {
    console.warn('[firebase] pull failed; continuing with local data', err);
  }
}

/** Loads the SDK and wires auth. Safe to call when unconfigured. */
export async function initFirebase() {
  if (!isFirebaseConfigured()) return false;

  try {
    const [appMod, authMod, storeMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);

    sdk = { ...authMod, ...storeMod };
    app = appMod.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = authMod.getAuth(app);
    db = storeMod.getFirestore(app);
    auth.available = true;

    authMod.onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        auth.user = {
          uid: user.uid,
          displayName: user.displayName || 'Freestyler',
          email: user.email || '',
          photoURL: user.photoURL || '',
        };
        installRemote();
        await pullSnapshot(user.uid);
      } else {
        auth.user = null;
        auth.entitlement = { tier: 'free', source: 'local', activeUntil: null };
        clearRemote();
      }
      auth._emit();
    });

    return true;
  } catch (err) {
    console.warn('[firebase] SDK unavailable; running in local mode', err);
    auth.available = false;
    return false;
  }
}

export async function signInWithGoogle() {
  if (!auth.available || !sdk) throw new Error('Firebase no está configurado.');
  const provider = new sdk.GoogleAuthProvider();
  try {
    await sdk.signInWithPopup(firebaseAuth, provider);
  } catch (err) {
    // Popups are blocked in many mobile browsers; redirect is the fallback.
    if (err && /popup/i.test(err.code || '')) {
      await sdk.signInWithRedirect(firebaseAuth, provider);
      return;
    }
    throw err;
  }
}

export async function signOut() {
  if (!auth.available || !sdk) return;
  await sdk.signOut(firebaseAuth);
}

/** Bearer token for authenticated calls to the Cloud Function. */
export async function getIdToken() {
  if (!firebaseAuth || !firebaseAuth.currentUser) return null;
  try {
    return await firebaseAuth.currentUser.getIdToken();
  } catch {
    return null;
  }
}
