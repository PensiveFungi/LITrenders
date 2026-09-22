# Freestyle Academy — web

The Android app on the web. Same product, same backend, same rules: plain ES
modules, no framework, no bundler, no build step, so what is served is what was
written.

It is a **port of the Kotlin source**, not a reimplementation from the screens.
Every number in here — the level costs, the racha rule, the word-rotation
cadences, the entitlement gates, the ten logros, the XP ceilings and
multipliers — came out of `app/src/main/java/com/freestyle/academy/` and can be
diffed against it.

---

## Running it

Open `app.html`. That is the whole app. `index.html` is the page about it on
litrenders.com, which embeds `app.html` in a frame.

Locally, serve the folder over HTTP (ES modules and the microphone both need an
origin — `file://` will not do):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/apps/freestyle-academy/app.html
```

## Turning it on

Everything below is in `assets/js/core/config.js`.

### 1. Firebase — the accounts and the AI

With an empty config the app runs as a **guest** on this browser: every round
plays, nothing is banked, no AI scoring runs. That is the app's own guest
behaviour, not a degraded mode, so the page is shippable as it stands.

To connect it to the same project the Android app uses (`academy-79fd1940`):

1. Firebase Console → Project settings → General → Your apps → **Add app → Web**.
   The Android app's `google-services.json` will not work: `appId` is
   per-platform.
2. Paste the generated object into `FIREBASE_CONFIG`.
3. Authentication → Settings → **Authorized domains** → add `litrenders.com`.
   Google sign-in is rejected from domains that are not listed.

These values are public by design. `firestore.rules` is what protects the data.

**No new backend was deployed for the web.** It calls the same callables the
Android app calls — `scoreFreestyle`, `groqTranscribe`, `submitBugReport` — which
already hold the Groq key in Secret Manager and already require a signed-in
caller. The league table (`clubGlobal`) is still written by the Cloud Function
triggers and by nothing else.

### 2. Beats

`BEAT_FILES` is deliberately empty. The six MP3s in the APK are unlicensed free
"type beats": shipping them inside an APK is one exposure, serving them as
downloadable files from a public website is a larger one. The transport, the
playlist rules and the selector are all wired — drop licensed tracks into
`assets/beats/` and list their filenames in `BEAT_FILES` and the feature turns
on with no code change.

### 3. Avatar artwork

The app ships 27 bundled 512×512 PNG avatars in its Android `res/` folder. They
were not part of the source copy this port was built from, so the web draws a
distinct mark per avatar id instead — same 27 ids, same order, same free-tier
five first. To use the real artwork, copy the PNGs to `assets/img/avatars/` as
`<avatar_id>.png` and set `AVATAR_ART_BASE` to that folder.

### 4. Legal documents

`LEGAL_DOCUMENTS` points at `terms.html` and `privacy.html` in this folder. The
consent gate links to them and will not let anyone past until they are accepted.
Bumping `LEGAL_VERSION` in `core/store.js` asks everyone to accept again.

---

## What is here

```
app.html                     the app shell
assets/css/styles.css        the design system, on Color.kt + DesignTokens.kt
assets/img/stimuli/          25 scene .webp + 48 object .svg — the app's own art
assets/js/app.js             the nav graph, the bottom bar, the two gates
assets/js/core/              the ported domain + the platform layer
assets/js/data/              the rhyme library, the stimuli, the round catalog
assets/js/screens/           one module per screen
assets/js/ui/                icons, avatars, shared widgets
```

### The domain, ported

| Web | Kotlin |
| --- | --- |
| `core/domain.js` | `domain/Difficulty.kt`, `Leveling.kt`, `Streaks.kt`, `Achievements.kt`, `RoundMechanics.kt`, `RecentDays.kt` |
| `core/ai.js` | `ai/AiScoring.kt`, `ai/XpMultipliers.kt` |
| `core/plans.js` | `data/Plans.kt`, `data/DataScope.kt` |
| `core/rhyme-library.js` | `domain/RhymeLibrary.kt` |
| `core/battle.js` | `battles/offline/OfflineBattleModels.kt` |
| `core/store.js` | `AppViewModel` + the repositories |
| `core/firebase.js` | `ai/CloudBackend.kt` + the Firestore documents |
| `core/recordings.js` | the kept-recording register (`model/KeptRecording`) |
| `data/rounds.js` | `battles/entrenar/`, `masterserie/`, `gallos/` models |

### Three rules worth keeping straight

**XP comes only from the AI.** There is no XP formula anywhere in this codebase,
deliberately — the app removed it. A session is written with `xpEarned: 0` and
the award is applied afterwards, if and only if the evaluation of the real
recording produced one. Every failure mode is honest: no audio, no plan, no
connection, a failed pass — the session earns nothing and the screen says which.

**The clock counts up.** A round ends on "PRÓXIMA RONDA" / "TERMINAR" or the mic
passes on "PRÓXIMA ENTRADA". Never on the clock. The ring fills toward the
round's nominal 60s and then stays full.

**A guest banks nothing.** Not sessions, not minutes, not racha, not logros. It
is enforced on both sides: nothing is written, and reads return zeros rather
than whatever an older build may have left behind. A Gratis *account* is
different — it keeps its racha, sessions and the three free logros, and earns no
XP.

---

## What is not here

- **Studio generation.** The tab, the gates, the daily credit ledger and the
  recordings library are real. Creating a tema or an instrumental is not: the
  request body for the `kieGenerate` callable is assembled in the app's Studio
  repository, which was not in the source this port was built from, and guessing
  at it would mean inventing a contract the backend never agreed to. The screen
  says so rather than pretending.
- **Online battles.** They do not exist for any plan in the app either
  (`ONLINE_BATTLES_LAUNCHED = false`). Both local battle modes work.
- **Ads.** No ad SDK on the web, so `removesAds` is an entitlement with nothing
  behind it yet.

---

## Compatibility with the Android app

One account, two clients. The web reads and writes the same documents:

- `users/{uid}/progress/progress` — whole-document last-write-wins, as the app
  syncs it.
- `users/{uid}/rhymes/rhymes` — the overlay only (a few hundred bytes), never
  the whole library.
- `users/{uid}/profile/profile` — the avatar field is `avatarStyleId` on the
  wire, matching `model/Models.kt`; the web keeps `avatarId` internally and
  translates in `core/firebase.js`.
- `rhymeLibrary/manifest` + `chunk_N` — checked once per launch, for guests too.
  A manifest whose group count disagrees with what arrived is not trusted.

Local storage keys mirror the app's `SharedPreferences` names, partitioned by
data scope (`guest` vs `acct_<uid>`), so a guest's data and each account's stay
separate on the same browser. Kept recordings live in IndexedDB under the same
partitioning.

---

## Verified

Two headless Chromium suites at 360 × 760 (Galaxy A10 width), 63 checks:

- Both gates, the five tabs, and all 22 stacked routes.
- A full solo session: round picker → count-up clock → finish → results.
- A battle: lineup, handoff, ATAQUE role, PRÓXIMA ENTRADA.
- Master Serie's pool vs. Gallos's — Gallos has no cadence rounds, and the two
  theme pools are different lists.
- Rhyme editing through the overlay, including that re-adding a word the group
  already has writes nothing.
- Every Plus/Pro gate closing again when the plan drops to Gratis, and the
  locked Studio tab routing to Planes.
- No horizontal scroll on any main route at 360px.
