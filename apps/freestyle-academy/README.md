# Freestyle Academy — Web

A full web port of the Freestyle Academy Android app, for **litrenders.com**.

No build step, no bundler, no `npm install` for the site itself. Plain ES
modules that any static host will serve — which also means you can edit it on
the 2013 MacBook without a toolchain.

---

## What's here

```
freestyle-academy-web/
├── index.html                  entry point
├── manifest.webmanifest        installable as a PWA
├── firebase.json               Hosting config + /api rewrite to the function
├── firestore.rules             user data + entitlement rules
├── assets/
│   ├── css/styles.css          the Void design system
│   └── js/
│       ├── app.js              nav graph + bottom nav (≙ MainActivity.kt)
│       ├── core/
│       │   ├── config.js       ← THE ONLY FILE YOU MUST EDIT
│       │   ├── domain.js       ≙ domain/ (XP, levels, streaks, timers)
│       │   ├── store.js        ≙ AppViewModel + both repositories
│       │   ├── router.js       ≙ the Compose NavHost
│       │   ├── audio.js        mic metering + per-round recording
│       │   ├── firebase.js     Google sign-in + Firestore sync
│       │   └── feedback.js     AI feedback client
│       ├── data/
│       │   ├── modes.js        ≙ TrainingModes.kt + TrainingModeVisuals.kt
│       │   └── rhymes.js       ≙ RhymeData.kt  (SEED EXTRACT — see below)
│       ├── ui/                 icons + shared components
│       └── screens/            one file per screen
└── functions/
    ├── index.js                Groq STT + LLM scoring proxy
    └── package.json
```

Every route from the Android app is here:

| Route | Screen |
|---|---|
| `#/train` | Home — dashboard, featured mode, all 11 modes |
| `#/battles` | Batallas — honestly labelled "coming soon", as in the app |
| `#/progress` | Progreso — XP, streaks, weekly chart, skill split |
| `#/profile` | Perfil — stats, achievements, **account & sync** |
| `#/sessionSetup?presetId=` | Configure a session |
| `#/session` | Live session — timer, stimuli, mic |
| `#/results` | Results — XP, level, achievements, **AI feedback** |
| `#/library` · `#/rhyme/{key}` | Rhyme library and editor |
| `#/history` | Add/remove log |
| `#/settings` | Theme, sync status, data reset |

---

## Running it locally

```bash
cd freestyle-academy-web
python3 -m http.server 8099
# open http://localhost:8099
```

It must be served over `http://` or `https://`, not opened as a `file://`
path — ES modules and the microphone both require a real origin.

**It works fully out of the box**: local progress, all 11 modes, the rhyme
library. Sign-in and AI feedback stay dormant until you configure them.

---

## Going live — 3 steps

### 1. Firebase config

Fill in `assets/js/core/config.js` from
**Firebase Console → Project settings → General → Your apps → Web app**.

Then in **Authentication → Settings → Authorized domains**, add
`litrenders.com`. Google sign-in is rejected from unlisted domains.

Publish the rules:

```bash
firebase deploy --only firestore:rules
```

### 2. The AI feedback function

```bash
cd functions
npm install
firebase functions:secrets:set GROQ_API_KEY      # paste your Groq key
cd ..
firebase deploy --only functions
```

The key lives in Secret Manager and never reaches the browser. The browser
posts audio to `/api/analyzeRound`; the `firebase.json` rewrite routes that to
the function on the same origin, so **there is no CORS to configure**.

If you host the site somewhere other than Firebase Hosting, set
`AI_FEEDBACK_ENDPOINT` in `config.js` to the function's absolute URL and add
your origin to `ALLOWED_ORIGINS` in `functions/index.js`.

### 3. Deploy the site

```bash
firebase deploy --only hosting
```

Or upload the folder to any static host. Nothing needs compiling.

---

## Regenerating the rhyme dictionary

⚠️ **`assets/js/data/rhymes.js` is a seed extract, not the full Android
dataset.** It holds 28 groups transcribed from `RhymeData.kt`; the Kotlin file
has more.

`tools/extract-rhymes.py` regenerates the whole file. Point it at your clone
of the app repo:

```bash
cd freestyle-academy-web
python3 tools/extract-rhymes.py ~/path/to/FreestyleAcademy > assets/js/data/rhymes.js
```

It prints a per-group word count to stderr so you can sanity-check the result
before shipping:

```
Parsed 44 groups, 14812 words from .../RhymeData.kt
  -ADA: 213
  -ADO: 287
  ...
```

It parses by matching parentheses rather than by regex, so the last group in
the file isn't silently dropped, and it refuses to write an empty dictionary
rather than quietly blanking your library.

Existing users keep their edits: the store merges any **new** groups into
saved data on load, exactly as `RhymeRepository` does on Android.

---

## How this maps to the Android app

The domain layer is a **line-for-line port**, verified against the same
numbers as the Kotlin JUnit tests:

| Kotlin | Web |
|---|---|
| `SessionRewards.kt` | 8 XP/min · 15/round · 3/prompt · +25 complete · +2/streak day (cap 30) |
| `Leveling.kt` | cost(N) = 200 + (N−1)×100 |
| `Streaks.kt` | same day holds · next day +1 · any gap resets to 1 |
| `SessionTimer.kt` | absolute end-timestamp, drift-free |
| `StimulusRotation.kt` | prefers unused keys / non-repeating words |
| `Achievements.kt` | the same 8 achievements, same thresholds |
| `TrainingModes.kt` | all 11 presets, durations asserted |

Session timing keeps the app's contract: **the countdown runs before the timer
unpauses**, so setup time is never charged to the round.

Storage mirrors `SharedPreferences` under the same key names, in
`localStorage` — so a browser behaves like a device, and clearing site data is
the equivalent of clearing app storage.

---

## Subscriptions (groundwork, not yet wired)

`firestore.rules` already enforces the shape the payment work needs:

- `users/{uid}.entitlement` is **readable by the user but never writable by
  them.** Only the payment webhook, running with Admin SDK privileges in a
  Cloud Function, can set it. That's what stops someone granting themselves
  Pro from the browser console.
- `auth.entitlement` in `firebase.js` already reads that field, and Ajustes
  already displays the tier.

When you pick a Merchant of Record, the remaining work is one webhook function
that writes `entitlement` to the same document. The app then reads the same
field, and one subscription covers both.

---

## Known limitations

- **Battles and Studio are not implemented**, matching `main`. The repo has no
  multiplayer, no Suno integration and no Freestyle Club; this port doesn't
  invent them. `BattlesScreen` shows the same honest "calentando motores"
  message as the app.
- **The "Imágenes" mode uses generated SVG scenes**, not photography — the
  Android repo ships no image assets either (`res/` holds only `themes.xml`).
- **No backing-beat playback.** The app doesn't have it either. If you add it,
  revisit `echoCancellation` in `audio.js`: with a beat playing through the
  speakers it will bleed into the mic and hurt transcription, and turning
  echo cancellation off costs you noise suppression. This is the single
  biggest technical risk in the web version — budget real time for it.
- **`MediaRecorder` is unavailable in a few older browsers.** Sessions still
  work; only the AI analysis is skipped, and the UI says so rather than
  failing silently.
- **Rate limiting in the function is per-instance and in-memory.** It's a
  courtesy guard, not a quota. Move the counter into Firestore before you
  depend on it for cost control.
- **Sync is last-write-wins at document level.** Fine for one person on a
  phone and a laptop; it is not a merge strategy for concurrent edits.

---

## Testing

The domain port was verified against the Kotlin test values (28 assertions),
and the app was driven end-to-end in headless Chromium at 360 px: every route
loads, a full FMS session runs start to finish with correct XP, achievements
unlock, the Incremental mode steps 60→45→30→20, manual rhyme selection is
honoured, partial sessions record correctly, and there is no horizontal
overflow at 320 px.
