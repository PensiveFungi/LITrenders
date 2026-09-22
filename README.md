# litrenders.com

The LITrenders website: a plain static site (HTML + CSS + one small JS file). No build step, no
dependencies, no framework. Edit a file, commit, push — GitHub Pages serves it.

It does two jobs:

1. Presents the studio.
2. Hosts the **privacy policy, terms of use and support page** for every app published to Google Play,
   at permanent URLs a store listing can point at.

---

## 1. Publish it

**Order matters** — add the domain in GitHub *before* pointing DNS at it, otherwise someone else could
claim a site on the domain in the meantime.

1. Create a repo (e.g. `litrenders-site`) and push everything in this folder to the `main` branch,
   with `index.html` at the repository root.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
3. **Settings → Pages → Custom domain**: enter `litrenders.com`, save.
   (The `CNAME` file in this repo already contains `litrenders.com`; GitHub keeps it in sync.)
4. Add the DNS records below at Squarespace.
5. Come back to **Settings → Pages** and tick **Enforce HTTPS** once it becomes available
   (certificate issuance can take up to 24 hours after DNS resolves).

## 2. DNS at Squarespace

Squarespace → **Domains → litrenders.com → DNS → DNS settings → Custom records**.

Delete the existing records that point the root and `www` at Squarespace's own site (the parked-page
`A`/`CNAME` entries). Leave any `MX`, `TXT` (SPF/DKIM/verification) records alone if you use email on
the domain.

**Apex (`litrenders.com`) — four A records:**

| Host | Type | Data |
|---|---|---|
| `@` | A | `185.199.108.153` |
| `@` | A | `185.199.109.153` |
| `@` | A | `185.199.110.153` |
| `@` | A | `185.199.111.153` |

**Optional but recommended — four AAAA records (IPv6):**

| Host | Type | Data |
|---|---|---|
| `@` | AAAA | `2606:50c0:8000::153` |
| `@` | AAAA | `2606:50c0:8001::153` |
| `@` | AAAA | `2606:50c0:8002::153` |
| `@` | AAAA | `2606:50c0:8003::153` |

**`www` — one CNAME:**

| Host | Type | Data |
|---|---|---|
| `www` | CNAME | `YOUR-GITHUB-USERNAME.github.io.` |

That target is your *user* subdomain, **not** the repo (`username.github.io`, never
`username.github.io/repo`). With both sets in place GitHub redirects `www` → apex automatically.

Propagation is usually minutes, occasionally a few hours. Check with:

```bash
dig +short litrenders.com
dig +short www.litrenders.com
```

---

## 3. Before you announce it — fill in the placeholders

Anything shown as `[SOMETHING]` on a grey dashed background is a deliberate blank. Find them all with:

```bash
grep -rn 'class="ph"' --include="*.html" .
```

| Placeholder | Where | What to put |
|---|---|---|
| `[COUNTRY / JURISDICTION]` (×6) | all three `terms.html` | The country whose law governs your terms, e.g. `Uruguay`. |
| `[AI PROVIDER]` + its policy URL | `apps/freestyle-academy/privacy.html` | The company that transcribes and scores a round, and a link to its privacy policy. |
| `[FONT PROVIDER PRIVACY POLICY URLS]` | `apps/freestyle-academy/privacy.html` | Google Fonts and Fontshare — the app's two typefaces are fetched from them on every load. |
| `[… ANDROID BUILD …]` (×2) | `apps/freestyle-academy/privacy.html` | Two reminders to check the policy and the Data safety table against the shipped Android app. |
| `[IF A SUBSCRIPTION SHIPS …]` | `apps/freestyle-academy/terms.html` | Rewrite the Purchases section before anything goes on sale. |
| `[EXCHANGE-RATE PROVIDER]` + its policy URL | `apps/budget-calendar/privacy.html` | The rates API the budget app calls. |

Also worth doing before launch:

- **Name the budget app.** It is called *Budget Calendar* throughout, in the folder `apps/budget-calendar/`.
  If the store name differs, rename the folder and update the links (see §5) — the URL ends up in the
  Play listing, so change it *before* you submit.
- **Re-read every privacy policy against what the app actually ships.** They describe the apps as
  designed today: no ads, no analytics, no crash reporting, no account. The moment you add Firebase,
  Crashlytics, an ad SDK or a login, the policy is wrong and Google's Data safety form will not match it.
- **Status.** Each app page says *In development — not yet on Google Play*. Swap that for a Play badge
  and link when it goes live.
- **Screenshots.** The app tiles are geometric placeholders (inline SVG in each page). Replace them with
  real screenshots when you have them.

> These documents were written to be accurate, readable and to cover what Google Play asks for. They are
> not legal advice — if a lawyer's eyes are worth it for you, this is the moment.

---

## 4. What's in here

```
CNAME                     litrenders.com — do not delete
.nojekyll                 serves files as-is (no Jekyll processing)
index.html                home
404.html                  GitHub Pages uses this automatically
robots.txt  sitemap.xml   keep sitemap.xml in step when adding pages
apps/index.html           app + documentation index
apps/<slug>/index.html    one app
apps/<slug>/privacy.html  ← the URL that goes in the Play listing
apps/<slug>/terms.html
apps/<slug>/support.html  #data-deletion anchor doubles as the deletion URL
legal/privacy.html        privacy notice for the website itself
assets/css/site.css       the whole design system, one file
assets/js/site.js         mobile menu + footer year, nothing else
assets/fonts/             Inter + Archivo Black, self-hosted (SIL OFL, licences included)
assets/img/               logo, inverse logo, favicons
```

No cookies and no analytics anywhere. The site serves its own fonts and images, with two deliberate
exceptions, both inside an app's own web build and neither on a documentation page:

- `apps/budget-calendar/app.html` loads AdSense (see the AdSense section above).
- `apps/freestyle-academy/app.html` loads its two typefaces from Google Fonts and Fontshare, and — once
  `assets/js/core/config.js` is filled in — the Firebase SDK from `gstatic.com`.

If you ever add analytics, update `legal/privacy.html`, which currently promises otherwise.

## 5. Adding a new app

1. `cp -r apps/iondrive apps/new-app-slug` (copy the closest match — `iondrive` for an offline app,
   `freestyle-academy` for one that talks to a cloud service).
2. In the four files, replace the name, slug, description, feature list and tile SVG.
3. Rewrite the privacy policy to match what the app *actually* does. This is the one file that must
   never be copied unread.
4. Add it in three places: the `apps` grid in `index.html`, the grid + table in `apps/index.html`,
   and the footer list (which appears in every page — `grep -rl 'Budget Calendar' --include="*.html" .`
   finds them all).
5. Add the four new URLs to `sitemap.xml`.

## 6. Editing locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

Relative links are used throughout, so the site works from a local folder, a preview URL, or the domain
without changes.
