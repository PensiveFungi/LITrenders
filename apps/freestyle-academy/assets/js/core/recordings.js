/* =========================================================================
   recordings.js — the kept-session register (model/KeptRecording).

   The app writes turn audio to app-private storage and lists the registers in
   "Historial de Sesiones". The browser equivalent is IndexedDB: same shape,
   same rules —

   • The REGISTER is permanent. Only the attached audio can be deleted, and
     deleting a turn marks its segment `deleted` rather than dropping the row,
     so the turn stays listed as a "Grabación eliminada" marker.
   • `xpEarned` is null, not 0, when no award was ever recorded. Zero would
     assert an AI verdict that never happened.
   • Transcripts are independent of the audio: deleting a turn's recording
     never removes what the model heard.
   • Partitioned by data scope, like progress: a guest's registers and each
     account's are separate stores.

   Guests keep nothing at all, and neither does a plan that cannot record —
   the same gate the flow screen reads before it ever opens the mic.
   ========================================================================= */

const DB_NAME = 'freestyle_academy';
const DB_VERSION = 1;
const STORE = 'recordings';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('scope', 'scopeKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    // Private mode, or storage denied: the app runs, sessions simply aren't kept.
    console.warn('[recordings] unavailable', err);
    dbPromise = null;
    return null;
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
  }).catch((err) => { console.warn('[recordings]', err); return null; });
}

const scopeKeyOf = (scope) => (scope.kind === 'ACCOUNT' ? `acct_${scope.uid}` : 'guest');

/**
 * Saves one finished session's register.
 *
 * @param {object} scope     the data scope it belongs to
 * @param {object} meta      { modeName, durationSeconds, xpEarned }
 * @param {Array}  segments  [{ roundNumber, roundLabel, performerName, blob, durationSeconds, transcript }]
 */
export async function keepRecording(scope, meta, segments) {
  const id = Date.now();
  const record = {
    key: `${scopeKeyOf(scope)}:${id}`,
    scopeKey: scopeKeyOf(scope),
    id,
    modeName: meta.modeName || '',
    timestampMillis: id,
    durationSeconds: meta.durationSeconds || 0,
    // null, never 0 — see the header.
    xpEarned: Number.isFinite(meta.xpEarned) && meta.xpEarned > 0 ? meta.xpEarned : null,
    segments: (segments || []).map((s, i) => ({
      roundNumber: s.roundNumber ?? i + 1,
      roundLabel: s.roundLabel || 'Sesión',
      performerName: s.performerName || null,
      blob: s.blob || null,
      mimeType: s.blob?.type || 'audio/webm',
      durationSeconds: s.durationSeconds || 0,
      deleted: false,
      transcript: s.transcript ?? null,
    })),
  };
  await tx('readwrite', (store) => store.put(record));
  return record;
}

/** Every register for this scope, newest first. */
export async function listRecordings(scope) {
  const key = scopeKeyOf(scope);
  const rows = await tx('readonly', (store) => store.index('scope').getAll(key));
  if (!rows) return [];
  return rows.sort((a, b) => b.timestampMillis - a.timestampMillis);
}

export async function getRecording(scope, id) {
  return tx('readonly', (store) => store.get(`${scopeKeyOf(scope)}:${Number(id)}`));
}

/**
 * Deletes ONE turn's audio. The segment stays listed, flagged deleted, and
 * keeps its transcript — the text is not the recording.
 */
export async function deleteSegmentAudio(scope, id, roundNumber) {
  const record = await getRecording(scope, id);
  if (!record) return null;
  record.segments = record.segments.map((s) =>
    (s.roundNumber === roundNumber ? { ...s, blob: null, deleted: true } : s));
  await tx('readwrite', (store) => store.put(record));
  return record;
}

/** Deletes every turn's audio at once; the register itself remains. */
export async function deleteAllAudio(scope, id) {
  const record = await getRecording(scope, id);
  if (!record) return null;
  record.segments = record.segments.map((s) => ({ ...s, blob: null, deleted: true }));
  await tx('readwrite', (store) => store.put(record));
  return record;
}

/** True while at least one turn still has playable audio. */
export const hasRecording = (record) =>
  Boolean(record?.segments?.some((s) => !s.deleted && s.blob));

/** Wipes this scope's registers — used by "Borrar todos los datos". */
export async function eraseRecordings(scope) {
  const key = scopeKeyOf(scope);
  const rows = await tx('readonly', (store) => store.index('scope').getAll(key));
  if (!rows) return;
  await tx('readwrite', (store) => { rows.forEach((r) => store.delete(r.key)); });
}

/** An object URL for a segment's audio, or null when it was deleted. */
export function segmentUrl(segment) {
  if (!segment || segment.deleted || !segment.blob) return null;
  return URL.createObjectURL(segment.blob);
}
