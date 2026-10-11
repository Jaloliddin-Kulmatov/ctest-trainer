/* C-Test Trainer · shared code for every page
   - progress storage in the browser (localStorage), with a small db-like API
   - navigation bar, footer, theme toggle, exam date, export / import */
(function(){
  "use strict";
  const KEY = "ctt-store-v1";
  // every localStorage key that belongs to this site (used for export / import / reset)
  const OWN_KEYS = [KEY, "onset-trainer-v1", "a2-review-v1", "a2-verbs-wrong", "a2-art-wrong", "vocab-a2b1-v1", "b1draft", "b1last-gap", "b1last-art", "ctt-theme"];

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; } }
  const store = Object.assign({col:{}, days:{}, examDate:""}, load());
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch(e){} }

  function today(){ const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function markActive(){ const t = today(); store.days[t] = (store.days[t]||0) + 1; }

  /* db-like API so page code can call db.collection(name).doc(id).set(data) */
  function collection(name){
    return {
      doc(id){ return { set(data){ (store.col[name] = store.col[name] || {})[id] = data; markActive(); save(); return Promise.resolve(); } }; },
      add(data){ const id = Date.now().toString(36)+Math.random().toString(36).slice(2,6); (store.col[name] = store.col[name] || {})[id] = data; markActive(); save(); return Promise.resolve({id}); }
    };
  }
  const db = { collection };

  function list(name){ return Object.entries(store.col[name]||{}).map(([id,d])=>Object.assign({id}, d)); }

  /* streak: consecutive days with activity, ending today or yesterday */
  function streak(){
    let n = 0; const d = new Date();
    if(!store.days[today()]) d.setDate(d.getDate()-1);
    for(;;){ const k = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); if(store.days[k]){ n++; d.setDate(d.getDate()-1); } else break; }
    return n;
  }

  function getExamDate(){ return store.examDate || ""; }
  function setExamDate(v){ store.examDate = v; save(); }
  function daysLeft(){
    if(!store.examDate) return null;
    const t = new Date(today()+"T00:00:00"), e = new Date(store.examDate+"T00:00:00");
    return Math.round((e-t)/864e5);
  }

  /* export / import / reset of all progress */
  function exportData(){
    const out = {site:"ctest-trainer", version:1, exported:new Date().toISOString(), data:{}};
    OWN_KEYS.forEach(k=>{ try{ const v = localStorage.getItem(k); if(v!==null) out.data[k] = v; }catch(e){} });
    const blob = new Blob([JSON.stringify(out, null, 2)], {type:"application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ctest-trainer-progress-"+today()+".json";
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importData(file){
    return file.text().then(txt=>{
      const obj = JSON.parse(txt);
      if(!obj || obj.site!=="ctest-trainer" || !obj.data) throw new Error("This file is not a C-Test Trainer progress file.");
      Object.entries(obj.data).forEach(([k,v])=>{ if(OWN_KEYS.includes(k)) localStorage.setItem(k, v); });
    });
  }
  function resetData(){ OWN_KEYS.forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); }

  /* theme: system by default, or a saved choice */
  function applyTheme(){ let t = null; try{ t = localStorage.getItem("ctt-theme"); }catch(e){} if(t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  function toggleTheme(){
    const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur==="dark" ? "light" : "dark";
    try{ localStorage.setItem("ctt-theme", next); }catch(e){}
    applyTheme();
  }
  applyTheme();

  /* umlaut helper: a' o' u' → ä ö ü, s' → ß, B after a small letter → ß */
  function fixUmlauts(s){ return s.replace(/([aouAOU])['"`´:]/g,(m,c)=>({a:"ä",o:"ö",u:"ü",A:"Ä",O:"Ö",U:"Ü"}[c])).replace(/([a-zäöü])B/g,"$1ß").replace(/s'/g,"ß"); }

  const PAGES = [["index.html","Dashboard"],["test.html","Tests"],["practice.html","Practice"],["grammar.html","Grammar"],["vocab.html","Vocabulary"],["mistakes.html","My mistakes"]];
  function nav(){
    const here = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/,"") || "index";
    const links = PAGES.map(([href,label])=>{ const on = href.replace(".html","")===here; return `<a href="${href}"${on?' aria-current="page"':""}>${label}</a>`; }).join("");
    const dl = daysLeft();
    const chip = dl===null ? `<a class="ctt-chip" href="index.html#exam">Set exam date</a>` : dl>0 ? `<a class="ctt-chip" href="index.html#exam"><b>${dl}</b> ${dl===1?"day":"days"} left</a>` : dl===0 ? `<a class="ctt-chip" href="index.html#exam"><b>Exam today</b></a>` : `<a class="ctt-chip" href="index.html#exam">Set exam date</a>`;
    document.body.insertAdjacentHTML("afterbegin", `<header class="ctt-nav"><div class="ctt-nav-in">
      <a class="ctt-brand" href="index.html" aria-label="C-Test Trainer home"><span class="ctt-logo" aria-hidden="true">C<i>_</i></span>C-Test Trainer</a>
      <nav class="ctt-links" aria-label="Main">${links}</nav>
      <div class="ctt-tools">${chip}<button class="ctt-theme" type="button" aria-label="Switch light / dark theme" title="Light / dark">◐</button></div>
    </div></header>`);
    document.body.insertAdjacentHTML("beforeend", `<footer class="ctt-foot"><div>Free practice for German C-tests such as onSET. Not affiliated with onSET, the TestDaF-Institut or g.a.s.t.; all texts were written for practice. Your progress is saved only in this browser — use <a href="index.html#data">export</a> to move it to another device.</div></footer>`);
    document.querySelector(".ctt-theme").addEventListener("click", toggleTheme);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", nav); else nav();

  window.CTT = { db, store, save, list, streak, today, markActive, getExamDate, setExamDate, daysLeft, exportData, importData, resetData, fixUmlauts };
})();
