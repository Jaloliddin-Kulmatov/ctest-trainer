# C-Test Trainer

Free practice website for German C-tests such as onSET. Static site (HTML, CSS, JavaScript), no build step, no backend. Progress is saved in the visitor's browser (localStorage) and can be exported and imported as a JSON file.

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

Shared code is in `assets/common.js` (storage, navigation, theme, export/import) and `assets/common.css`.

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
