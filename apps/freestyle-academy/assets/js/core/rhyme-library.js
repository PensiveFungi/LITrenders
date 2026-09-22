/* =========================================================================
   rhyme-library.js — port of domain/RhymeLibrary.kt

       [master library] + [this partition's overlay] = [what the user sees]

   The overlay records the three things the UI can do — add, remove, rename —
   which is what lets an edit survive a master update AS THE EDIT IT WAS:
   a new master word appears, a deleted one stays deleted, a renamed one stays
   renamed.

   `removed` holds TOMBSTONES recorded by the master spelling, not
   subtractions, so a word the master later drops just stops matching.
   `renamed` is keyed by the folded master spelling so the word keeps its
   position, which a delete-plus-append would lose.
   ========================================================================= */

/** Words match case-insensitively, the same duplicate check the Librería uses. */
export const fold = (word) => String(word ?? '').trim().toLowerCase();

export function emptyOverlay() {
  return { added: {}, removed: {}, renamed: {} };
}

function normalizeOverlay(overlay) {
  const o = overlay || {};
  return {
    added: o.added || {},
    removed: o.removed || {},
    renamed: o.renamed || {},
  };
}

/** Returns a copy of `map` with `key` set, or the key dropped when empty. */
function withEntry(map, key, value) {
  const next = { ...map };
  const empty = value == null
    || (Array.isArray(value) && value.length === 0)
    || (!Array.isArray(value) && Object.keys(value).length === 0);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

const withAdded = (overlay, key, words) =>
  ({ ...overlay, added: withEntry(overlay.added, key, words) });

const withRemoved = (overlay, key, words) =>
  ({ ...overlay, removed: withEntry(overlay.removed, key, words) });

function withRename(overlay, key, foldedMaster, display) {
  const group = { ...(overlay.renamed[key] || {}), [foldedMaster]: display };
  return { ...overlay, renamed: withEntry(overlay.renamed, key, group) };
}

function withoutRename(overlay, key, foldedMaster) {
  const group = { ...(overlay.renamed[key] || {}) };
  delete group[foldedMaster];
  return { ...overlay, renamed: withEntry(overlay.renamed, key, group) };
}

/** The folded MASTER spelling behind a currently displayed folded word. */
function masterKeyFor(overlay, key, foldedDisplay) {
  const renames = overlay.renamed[key] || {};
  const hit = Object.keys(renames).find((k) => fold(renames[k]) === foldedDisplay);
  return hit || foldedDisplay;
}

/**
 * Applies `overlay` to `master` and returns the library the user sees.
 *
 * Order is stable and deliberate: master groups in master order, then any
 * group that exists only because the user created it; and within a group, the
 * surviving master words in master order, then the user's additions in the
 * order they were added.
 *
 * A master group all of whose words were removed stays present but empty —
 * it is the master that decides which groups exist.
 */
export function materialize(master, overlay) {
  const o = normalizeOverlay(overlay);
  const keys = [];
  const seenKeys = new Set();
  const pushKey = (k) => { if (!seenKeys.has(k)) { seenKeys.add(k); keys.push(k); } };
  Object.keys(master).forEach(pushKey);
  Object.keys(o.added).forEach(pushKey);

  const result = {};
  keys.forEach((key) => {
    const tombstones = new Set((o.removed[key] || []).map(fold));
    const renames = o.renamed[key] || {};
    const words = [];
    const seen = new Set();

    (master[key] || []).forEach((word) => {
      const folded = fold(word);
      if (tombstones.has(folded)) return;
      const display = renames[folded] ?? word;
      const foldedDisplay = fold(display);
      if (!seen.has(foldedDisplay)) { seen.add(foldedDisplay); words.push(display); }
    });

    (o.added[key] || []).forEach((word) => {
      const folded = fold(word);
      if (!seen.has(folded)) { seen.add(folded); words.push(word); }
    });

    // A group the user invented and then emptied has nothing left to keep it
    // alive; a master group does, even at zero words.
    if (words.length > 0 || key in master) result[key] = words;
  });
  return result;
}

/**
 * Records adding `word` to `key`, or null when the add is a no-op (blank,
 * unknown group, or already present) so the caller writes no history entry.
 *
 * Re-adding a word the user had deleted lifts the tombstone rather than
 * appending a duplicate, so it returns to its place in the master list. If
 * they typed it back differently that becomes a rename.
 */
export function addWord(master, overlay, key, word) {
  const o = normalizeOverlay(overlay);
  const trimmed = String(word ?? '').trim();
  if (!trimmed) return null;
  const group = materialize(master, o)[key];
  if (!group) return null;
  const folded = fold(trimmed);
  if (group.some((w) => fold(w) === folded)) return null;

  const tombstones = o.removed[key] || [];
  if (tombstones.some((w) => fold(w) === folded)) {
    const lifted = withRemoved(o, key, tombstones.filter((w) => fold(w) !== folded));
    const masterWord = (master[key] || []).find((w) => fold(w) === folded);
    return masterWord != null && masterWord !== trimmed
      ? withRename(lifted, key, folded, trimmed)
      : withoutRename(lifted, key, folded);
  }
  return withAdded(o, key, [...(o.added[key] || []), trimmed]);
}

/**
 * Records removing `word` from `key`, or null when there is nothing to
 * remove. One of the user's own additions is dropped outright; a master word
 * is tombstoned under its master spelling, so a rename applied to it goes
 * away with it.
 */
export function removeWord(master, overlay, key, word) {
  const o = normalizeOverlay(overlay);
  const group = materialize(master, o)[key];
  if (!group || !group.includes(word)) return null;

  const folded = fold(word);
  const additions = o.added[key] || [];
  if (additions.some((w) => fold(w) === folded)) {
    return withAdded(o, key, additions.filter((w) => fold(w) !== folded));
  }
  const masterFolded = masterKeyFor(o, key, folded);
  const masterWord = (master[key] || []).find((w) => fold(w) === masterFolded);
  if (masterWord == null) return null;
  return withRemoved(
    withoutRename(o, key, masterFolded),
    key,
    [...(o.removed[key] || []), masterWord]
  );
}

/**
 * Records rewriting `oldWord` as `newWord` in `key`, keeping its position.
 * Null for the no-ops the Librería already rejects: blank or unchanged, a
 * word that is not there, or a collision with another entry.
 *
 * Renaming a master word back to its master spelling drops the override
 * instead of storing an identity rename.
 */
export function renameWord(master, overlay, key, oldWord, newWord) {
  const o = normalizeOverlay(overlay);
  const trimmed = String(newWord ?? '').trim();
  if (!trimmed || trimmed === oldWord) return null;
  const group = materialize(master, o)[key];
  if (!group || !group.includes(oldWord)) return null;
  const foldedNew = fold(trimmed);
  if (group.some((w) => w !== oldWord && fold(w) === foldedNew)) return null;

  const foldedOld = fold(oldWord);
  const additions = o.added[key] || [];
  if (additions.some((w) => fold(w) === foldedOld)) {
    return withAdded(o, key, additions.map((w) => (fold(w) === foldedOld ? trimmed : w)));
  }
  const masterFolded = masterKeyFor(o, key, foldedOld);
  const masterWord = (master[key] || []).find((w) => fold(w) === masterFolded);
  if (masterWord == null) return null;
  return masterWord === trimmed
    ? withoutRename(o, key, masterFolded)
    : withRename(o, key, masterFolded, trimmed);
}

/**
 * Recovers the overlay that turns `master` into `library` — the migration for
 * a browser still holding a whole materialized dictionary from the previous
 * web build.
 *
 * A rename cannot be told apart from a delete plus an add after the fact, so
 * it comes back as that pair; the resulting library is identical except that
 * a renamed word sorts at the end of its group.
 *
 * A master group the stored dictionary never mentions is deliberately NOT
 * read as "every word deleted" — that means the blob predates the group.
 */
export function diff(master, library) {
  const added = {};
  const removed = {};
  Object.keys(library).forEach((key) => {
    const stored = library[key] || [];
    const masterWords = master[key] || [];
    const storedFolded = new Set(stored.map(fold));
    const masterFolded = new Set(masterWords.map(fold));

    const gone = masterWords.filter((w) => !storedFolded.has(fold(w)));
    if (gone.length) removed[key] = gone;

    const extra = stored.filter((w) => !masterFolded.has(fold(w)));
    if (extra.length) added[key] = extra;
  });
  return { added, removed, renamed: {} };
}

/** True when the overlay records no edits at all. */
export function overlayIsEmpty(overlay) {
  const o = normalizeOverlay(overlay);
  return Object.keys(o.added).length === 0
    && Object.keys(o.removed).length === 0
    && Object.keys(o.renamed).length === 0;
}

/** Keys sorted the way LibraryScreen sorts them. */
export function sortedRhymeKeys(rhymes) {
  return Object.keys(rhymes).sort((a, b) => a.localeCompare(b, 'es'));
}
