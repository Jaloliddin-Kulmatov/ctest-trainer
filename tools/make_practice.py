"""Builds practice.html from the exercise data in .practice-source.html.
Run once: python3 tools/make_practice.py   (the generated page is then edited like any other page)"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / ".practice-source.html").read_text(encoding="utf8").split("\n")

def block(start_marker, end_marker_after):
    i = next(k for k, l in enumerate(src) if l.startswith(start_marker))
    j = next(k for k in range(i, len(src)) if src[k].startswith(end_marker_after))
    return "\n".join(src[i:j + 1])

data = "\n".join([block("const P1 = [", "];"), block("const C1 = [", "];"), block("const P2 = [", "];"), block("const C2 = [", "];")])

# make the wording general (the source was written for one learner's exams)
for old, new in [
    ("Your biggest pattern. Type the Präteritum", "The most common mistake type in C-tests. Type the Präteritum"),
    ("1. Past tense: the verbs from Exam 2", "1. Past tense: more verbs"),
    ("You missed 13 past-tense forms in Exam 2. Type the Präteritum (the form the subject needs).", "Stories in C-tests are in the past. Type the Präteritum (the form the subject needs)."),
    (" You missed bekam 4 times in 2 exams!", " One of the most frequent past forms in C-test stories."),
    (" Not 'verbringen' (to spend time): you mixed them up in both exams.", " Don't confuse it with verbringen (to spend time)."),
    ("In Exam 2 you wrote words that look similar but mean something else. Choose the word that makes sense.", "These words look similar but mean something else. Choose the word that makes sense."),
    ("das Flugzeug = plane (not 'Flugzug').", "das Flugzeug = plane."),
    (" (not 'warnt')", ""), (" (not 'hat')", ""), (" (not 'Katten')", ""),
]:
    data = data.replace(old, new)

page = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Practice · C-Test Trainer</title>
<meta name="description" content="Exercises for the most common C-test mistakes: past tense, plurals, articles and case, look-alike words, plus mini C-tests with translations.">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/common.css">
<script src="assets/common.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Schibsted+Grotesk:wght@400;600;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>
/* Layout: exercise sheets in one column, a set switcher at the top */
.sets{display:flex;gap:8px;flex-wrap:wrap}
.sets button.on{background:var(--ink);color:var(--paper);border-color:var(--ink);font-weight:600}
section.text{scroll-margin-top:16px}
.thead{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;justify-content:space-between;margin-bottom:4px}
.thead h2{font-size:20px;text-transform:none;letter-spacing:0;color:var(--ink);margin:0;text-wrap:balance}
.lvl{font-family:var(--mono);font-size:11px;padding:1px 6px;border-radius:4px;background:var(--paper);border:1px solid var(--line);color:var(--muted)}
.redo{border:1px solid var(--line);border-radius:10px;background:var(--card);padding:14px 16px}
.redo ol{margin:0;padding-left:24px;display:flex;flex-direction:column;gap:10px}
.redo li{font-family:var(--text);font-size:16.5px;line-height:1.9}
.redo input{font-family:var(--mono);font-size:15px;border:0;border-bottom:2px solid var(--mark-line);background:var(--mark);color:var(--ink);padding:1px 4px;border-radius:3px 3px 0 0;max-width:100%}
.redo input.ok{background:var(--ok-bg);border-color:var(--ok)}
.redo input.bad{background:var(--bad-bg);border-color:var(--bad)}
.redo .fix{font-family:var(--mono);font-size:13px;color:var(--ok);margin-left:6px}
.redo .src{font-family:var(--ui);font-size:12.5px;color:var(--muted)}
.de{font-family:var(--text);font-size:18px;line-height:1.95}
.after{margin-top:4px;font-family:var(--ui)}
.after .en,.en{font-size:14px;color:var(--muted)}
.why{font-size:13.5px;color:var(--accent);font-family:var(--ui)}
.opts{display:inline-flex;gap:6px;margin-left:6px;vertical-align:middle;flex-wrap:wrap}
.opt{font-family:var(--mono);font-size:14px;padding:3px 10px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
.opt.sel{border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}
.chosen{font-family:var(--mono);font-size:15px;background:var(--mark);border-bottom:2px solid var(--mark-line);padding:0 4px;border-radius:3px 3px 0 0}
.chosen.okc{background:var(--ok-bg);border-color:var(--ok)}
.chosen.badc{background:var(--bad-bg);border-color:var(--bad)}
.g .r{background:var(--ok-bg);color:var(--ok);padding:0 3px;border-radius:3px;font-family:var(--mono);font-size:14px}
.qbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px}
.qbar button{font-family:var(--ui);font-size:14px;cursor:pointer;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 14px}
.qbar button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
.saved{font-size:12px;color:var(--muted)}
#practice{display:flex;flex-direction:column;gap:28px}
</style>
</head>
<body>
<main class="page">
  <div>
    <h1>Practice</h1>
    <p class="lead">Short exercises for the mistakes C-test learners make most: past tense, plurals, articles and case, and words that only look alike. Every exercise shows the translation and the rule after you check. Each set ends with two mini C-tests.</p>
  </div>
  <div class="sets" role="tablist" aria-label="Exercise sets">
    <button class="btn on" data-set="1" role="tab">Set 1 · basics</button>
    <button class="btn" data-set="2" role="tab">Set 2 · more patterns</button>
  </div>
  <div id="practice"></div>
</main>
<script>
(function(){
"use strict";
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fixUmlauts = CTT.fixUmlauts;
function getDb(){ return Promise.resolve(CTT.db); }
__DATA__
let P = P1, C = C1, PX = "";
const norm2 = s => (s||"").normalize("NFC").trim().toLowerCase().replace(/\s+/g," ");
async function savePractice(id, data, el){
  el.textContent = "Saving…";
  try{ const db = await getDb(); await db.collection("practice").doc(id).set(Object.assign({at:new Date().toISOString()}, data)); el.textContent = "Saved"; }
  catch(e){ el.textContent = "Could not save"; }
}
__RENDER__
function showSet(n){
  P = n==="2" ? P2 : P1; C = n==="2" ? C2 : C1; PX = n==="2" ? "s2-" : "s1-";
  document.querySelectorAll("[data-set]").forEach(b=>{ b.classList.toggle("on", b.dataset.set===n); b.setAttribute("aria-selected", b.dataset.set===n); });
  renderPractice();
}
document.querySelectorAll("[data-set]").forEach(b=>b.addEventListener("click",()=>{ try{ history.replaceState(null,"","#set"+b.dataset.set); }catch(e){} showSet(b.dataset.set); }));
showSet((location.hash||"")==="#set2" ? "2" : "1");
})();
</script>
</body>
</html>
'''
render = block("function renderPractice(){", "}")  # placeholder, replaced below
# renderPractice spans until the line that is exactly "}" before renderExam(...)
i = next(k for k, l in enumerate(src) if l.startswith("function renderPractice(){"))
j = next(k for k in range(i, len(src)) if src[k].startswith("renderExam("))
render = "\n".join(src[i:j])
render = render.replace("A new text with your mistake patterns: past tense, plurals, small words, articles. 20 gaps, take 5 minutes.",
                        "A new text with the same patterns: past tense, plurals, small words, articles. 20 gaps, take 5 minutes.")
out = page.replace("__DATA__", data).replace("__RENDER__", render)
(root / "practice.html").write_text(out, encoding="utf8")
print("practice.html written,", len(out), "bytes")
