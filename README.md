# C-Test Trainer : https://ctest-trainer-eight.vercel.app/

Free practice website for German C-tests such as onSET. Static site (HTML, CSS, JavaScript), no build step. Progress is saved in the visitor's browser (localStorage) and can be exported and imported as a JSON file. Optionally, visitors can sign in with Google and keep their progress in their account (Firebase, see below).

Not affiliated with onSET, the TestDaF-Institut or g.a.s.t. All texts were written for practice.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Dashboard: exam date and countdown, daily suggestion, results chart, weak word types, streak, export / import / reset |
| `test.html` | 4 full simulations (8 texts, 160 points, 40 min), 6 short tests (4 texts), A2 exams, mixed-level exams, mock tests, single texts; onSET-style screen and full correction |
| `practice.html` | Exercises for common mistakes (past tense, plurals, articles, look-alike words) and mini C-tests |
| `grammar.html` | 24 A2/B1/B2 grammar topics with examples, translations and self-checks; verb list and drill; der/die/das drill |
| `vocab.html` | 593 A2–B2 words with examples; C-test gaps, meaning, articles, flashcards, B1 / B2 level tests |
| `mistakes.html` | Mistake notebook built from all saved tests, with a practice mode |

Shared code is in `assets/common.js` (storage, navigation, theme, export/import) and `assets/common.css`. Account sync is in `assets/cloud.js`; `privacy.html` explains what is stored.

Deep links: `test.html#F1` … `#F4` start a full simulation, `#O1` … `#O6` a short test.

## Run locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Deploy to Vercel

```bash
npx vercel        # first time: log in and link the project (preview URL)
npx vercel --prod # production URL
```

`vercel.json` turns on clean URLs (`/test` instead of `/test.html`).

## Google sign-in and account sync (optional)

Without setup the site works as before. To let visitors sign in with a Google account and keep their progress across devices:

1. Go to https://console.firebase.google.com and create a project (the free Spark plan is enough).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Pick a support email and save.
3. **Authentication → Settings → Authorized domains → Add domain:** `ctest-trainer-eight.vercel.app` (and your own domain if you add one). `localhost` is already allowed.
4. **Build → Firestore Database → Create database** (production mode, any region close to your users).
5. In Firestore, open **Rules**, paste the content of `firestore.rules` and publish.
6. **Project settings → General → Your apps → Web app (`</>`)**: register an app, copy the config values into `assets/firebase-config.js` (`apiKey`, `authDomain`, `projectId`, `appId`). These values are public identifiers, not secrets; access is enforced by the rules.
7. Commit, push and let Vercel redeploy.

How it works: `assets/cloud.js` adds a *Sign in* button to the navigation bar. After sign-in, the progress in this browser (test results, mistakes, scores, exam date, daily activity) is merged with the copy in the account and saved under `users/{uid}/items` in Firestore. Changes are pushed every few seconds, newer data from another device is pulled on sign-in, when the tab is shown again and on *Sync now*. If the same item changed on two devices, the newer one wins. *Delete all progress* on the dashboard removes the copy in the account too. Signing out can clear the data from the device.

Test locally with `python3 -m http.server 8080` after filling in the config (add `localhost` to the authorized domains if it is not there).
