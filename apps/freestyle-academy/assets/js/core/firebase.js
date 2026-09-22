/* =========================================================================
   firebase.js — Auth, Firestore and the app's existing Cloud Functions.

   This talks to the SAME backend the Android app does (project
   academy-79fd1940): the callables in functions/src/, the `users/{uid}`
   documents, the public `clubGlobal` league rows and the read-only
   `rhymeLibrary` master.

   Nothing new is deployed for the web. `scoreFreestyle` already holds the
   Groq key in Secret Manager and already requires a signed-in caller.

   Loaded lazily: with an empty config the module resolves to "not available"
   and the app runs as a guest, which is a real supported state, not a stub.
   ========================================================================= */

import { FIREBASE_CONFIG, FUNCTIONS_REGION, isFirebaseConfigured } from './config.js';

const SDK = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${SDK}`;

let app = null;
let authSdk = null;
let dbSdk = null;
let fnSdk = null;
let firebaseAuth = null;
let db = null;
let functions = null;

export const auth = {
  available: false,
  user: null,
  _listeners: new Set(),
  onChange(fn) {
    this._listeners.add(fn);
    fn(this.user);
    return () => this._listeners.delete(fn);
  },
  _emit() {
    this._listeners.forEach((fn) => {
      try { fn(this.user); } catch (err) { console.error('[auth]', err); }
    });
  },
};

/** True once a signed-in user exists — the app's own `CloudBackend.isAvailable`. */
export const backendAvailable = () => auth.available && auth.user != null;

export async function initFirebase() {
  if (!isFirebaseConfigured()) return false;
  try {
    const [appMod, authMod, storeMod, fnMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
      import(`${CDN}/firebase-functions.js`),
    ]);
    authSdk = authMod;
    dbSdk = storeMod;
    fnSdk = fnMod;

    app = appMod.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = authMod.getAuth(app);
    db = storeMod.getFirestore(app);
    functions = fnMod.getFunctions(app, FUNCTIONS_REGION);
    auth.available = true;

    authMod.onAuthStateChanged(firebaseAuth, (user) => {
      auth.user = user
        ? {
            uid: user.uid,
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            emailVerified: user.emailVerified,
          }
        : null;
      auth._emit();
    });
    return true;
  } catch (err) {
    console.warn('[firebase] unavailable; running as guest', err);
    auth.available = false;
    return false;
  }
}

/* ---------- Auth ---------- */

export async function signInWithGoogle() {
  if (!auth.available) throw new Error('Firebase no está configurado.');
  const provider = new authSdk.GoogleAuthProvider();
  try {
    await authSdk.signInWithPopup(firebaseAuth, provider);
  } catch (err) {
    if (err && /popup/i.test(err.code || '')) {
      await authSdk.signInWithRedirect(firebaseAuth, provider);
      return;
    }
    throw err;
  }
}

export async function signInWithEmail(email, password) {
  if (!auth.available) throw new Error('Firebase no está configurado.');
  await authSdk.signInWithEmailAndPassword(firebaseAuth, email, password);
}

export async function signUpWithEmail(email, password) {
  if (!auth.available) throw new Error('Firebase no está configurado.');
  const cred = await authSdk.createUserWithEmailAndPassword(firebaseAuth, email, password);
  try { await authSdk.sendEmailVerification(cred.user); } catch { /* non-fatal */ }
  return cred.user.email;
}

export async function resendVerificationEmail() {
  if (!firebaseAuth?.currentUser) return;
  await authSdk.sendEmailVerification(firebaseAuth.currentUser);
}

export async function sendPasswordResetEmail(email) {
  if (!auth.available) throw new Error('Firebase no está configurado.');
  await authSdk.sendPasswordResetEmail(firebaseAuth, email);
}

export async function signOut() {
  if (!auth.available) return;
  await authSdk.signOut(firebaseAuth);
}

/** Spanish message for a Firebase auth error code. */
export function authErrorMessage(err) {
  const code = String(err?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (code.includes('user-not-found')) return 'No existe una cuenta con ese correo.';
  if (code.includes('email-already-in-use')) return 'Ese correo ya tiene una cuenta.';
  if (code.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (code.includes('invalid-email')) return 'Ese correo no es válido.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Prueba de nuevo en unos minutos.';
  if (code.includes('network')) return 'Sin conexión. Revisa tu internet.';
  if (code.includes('popup-closed')) return 'Se cerró la ventana de Google.';
  if (code.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase.';
  return 'No se pudo completar la operación.';
}

/* ---------- Callables (functions/src/) ---------- */

async function callFunction(name, payload) {
  if (!backendAvailable()) throw new Error('unauthenticated');
  const fn = fnSdk.httpsCallable(functions, name);
  const res = await fn(payload);
  return res.data || {};
}

/**
 * Transcribes and scores one turn's audio. Mirrors CloudBackend.scoreSegment.
 * Returns { transcript, rawModelOutput }.
 */
export async function scoreFreestyle({ audioBase64, mimeType, roundLabel, durationSeconds, stimuli }) {
  const data = await callFunction('scoreFreestyle', {
    audioBase64,
    mimeType: mimeType || 'audio/webm',
    roundLabel: roundLabel || '',
    durationSeconds: durationSeconds || 0,
    stimuli: stimuli || [],
  });
  return {
    transcript: typeof data.transcript === 'string' ? data.transcript : '',
    rawModelOutput: data.rawModelOutput || null,
  };
}

/** Transcription only. Mirrors CloudBackend.transcribeSegment. */
export async function groqTranscribe({ audioBase64, mimeType }) {
  const data = await callFunction('groqTranscribe', {
    audioBase64,
    mimeType: mimeType || 'audio/webm',
  });
  return typeof data.transcript === 'string' ? data.transcript : '';
}

/** "Reportar un error" — open to guests too, exactly as the app has it. */
export async function submitBugReport({ summary, description, context }) {
  if (!auth.available) throw new Error('unavailable');
  const fn = fnSdk.httpsCallable(functions, 'submitBugReport');
  await fn({ summary, description, context: context || {} });
}

/* ---------- Firestore: the account's own documents ---------- */

const userDoc = (uid, ...segments) => dbSdk.doc(db, 'users', uid, ...segments);

export async function loadProgressDoc(uid) {
  try {
    const snap = await dbSdk.getDoc(userDoc(uid, 'progress', 'progress'));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('[firestore] progress read failed', err);
    return null;
  }
}

export async function saveProgressDoc(uid, payload) {
  try {
    await dbSdk.setDoc(userDoc(uid, 'progress', 'progress'), payload, { merge: true });
  } catch (err) {
    console.warn('[firestore] progress write failed; local data kept', err);
  }
}

/** The account's rhyme OVERLAY — a few hundred bytes, not the whole library. */
export async function loadRhymeOverlay(uid) {
  try {
    const snap = await dbSdk.getDoc(userDoc(uid, 'rhymes', 'rhymes'));
    if (!snap.exists()) return null;
    const data = snap.data();
    const o = data?.overlay;
    if (!o || typeof o !== 'object') return null;
    return {
      added: o.added || {},
      removed: o.removed || {},
      renamed: o.renamed || {},
    };
  } catch (err) {
    console.warn('[firestore] overlay read failed', err);
    return null;
  }
}

export async function saveRhymeOverlay(uid, overlay) {
  try {
    await dbSdk.setDoc(userDoc(uid, 'rhymes', 'rhymes'), { overlay }, { merge: true });
  } catch (err) {
    console.warn('[firestore] overlay write failed; local data kept', err);
  }
}

/**
 * The account's identity card. The document is shared with the Android app,
 * which names the avatar field `avatarStyleId` (model/Models.kt), so the two
 * are translated here rather than anywhere else — the web keeps `avatarId`
 * internally and the document keeps the app's spelling.
 */
export async function loadProfileDoc(uid) {
  try {
    const snap = await dbSdk.getDoc(userDoc(uid, 'profile', 'profile'));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    return {
      alias: typeof d.alias === 'string' ? d.alias : '',
      crew: typeof d.crew === 'string' ? d.crew : '',
      punchline: typeof d.punchline === 'string' ? d.punchline : '',
      avatarId: d.avatarStyleId || d.avatarId || 'avatar_16',
    };
  } catch {
    return null;
  }
}

export async function saveProfileDoc(uid, payload) {
  try {
    await dbSdk.setDoc(userDoc(uid, 'profile', 'profile'), {
      alias: payload.alias || '',
      crew: payload.crew || '',
      punchline: payload.punchline || '',
      avatarStyleId: payload.avatarId || '',
    }, { merge: true });
  } catch (err) {
    console.warn('[firestore] profile write failed', err);
  }
}

/* ---------- Firestore: the public league ---------- */

/**
 * The league table. `clubGlobal/{uid}` is readable by any signed-in user and
 * written only by the Cloud Function triggers, which is what stops a client
 * publishing its own score.
 */
/**
 * The last table read, kept in memory so an MC profile opened from a ranking
 * renders instantly from what the tab already has — the app builds that
 * screen the same way. A uid that isn't in it renders the screen's
 * unreachable state rather than a fabricated profile.
 */
export const leagueCache = { rows: [], readAt: 0 };

export async function loadLeague({ limit = 100 } = {}) {
  if (!backendAvailable()) return [];
  try {
    const q = dbSdk.query(
      dbSdk.collection(db, 'clubGlobal'),
      dbSdk.orderBy('points', 'desc'),
      dbSdk.limit(limit)
    );
    const snap = await dbSdk.getDocs(q);
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    leagueCache.rows = rows;
    leagueCache.readAt = Date.now();
    return rows;
  } catch (err) {
    console.warn('[firestore] league read failed', err);
    return [];
  }
}

/* ---------- Firestore: the master rhyme library ----------
   Public and read-only. The manifest is a tiny document on purpose: the
   usual launch reads a few numbers, compares the version, and stops. */

export async function loadRhymeLibraryManifest() {
  if (!auth.available) return null;
  try {
    const snap = await dbSdk.getDoc(dbSdk.doc(db, 'rhymeLibrary', 'manifest'));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function loadRhymeLibraryChunks(chunkCount) {
  if (!auth.available) return null;
  try {
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) =>
        dbSdk.getDoc(dbSdk.doc(db, 'rhymeLibrary', `chunk_${i}`)))
    );
    const groups = {};
    chunks.forEach((snap) => {
      if (!snap.exists()) return;
      const data = snap.data()?.groups;
      if (!data || typeof data !== 'object') return;
      Object.keys(data).forEach((key) => {
        const words = data[key];
        if (Array.isArray(words)) {
          groups[key] = words.filter((w) => typeof w === 'string');
        }
      });
    });
    return Object.keys(groups).length > 0 ? groups : null;
  } catch (err) {
    console.warn('[firestore] library chunks failed', err);
    return null;
  }
}

/** Studio's daily credit ledger — readable by its owner, written by nobody. */
export async function loadStudioCredits(uid) {
  if (!backendAvailable()) return null;
  try {
    const snap = await dbSdk.getDoc(dbSdk.doc(db, 'studioCredits', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
