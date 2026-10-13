/* C-Test Trainer · sign in with Google and sync progress to the user's account
   - Firebase Authentication (Google) and Cloud Firestore, loaded from Google's CDN only when assets/firebase-config.js is filled in
   - the site keeps working without an account: progress stays in localStorage
   - each user's data lives under users/{uid}/items (see firestore.rules); items are merged three-way, never silently overwritten */
(function(){
  "use strict";
  const CFG = window.CTT_FIREBASE || {};
  const FACTORY = window.CTT_BACKEND_FACTORY || null;   /* tests can inject a fake backend */
  const configured = !!(FACTORY || (CFG.apiKey && CFG.projectId && CFG.authDomain));
  const isLocal = ["localhost","127.0.0.1","[::1]"].includes(location.hostname);
  const STATE_KEY = "ctt-sync-state";
  const STORE_KEY = "ctt-store-v1";
  const SKIP = new Set([STORE_KEY, "ctt-theme", STATE_KEY]);
  const MAX_JSON = 900000;           /* Firestore documents are limited to 1 MiB */
  const POLL_MS = 4000, PULL_MS = 45000;
  const SDK = "10.14.1";

  const $ = (s, r) => (r||document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
  function readJSON(k, d){ try{ const v = JSON.parse(lsGet(k)); return v==null ? d : v; }catch(e){ return d; } }
  function ownKeys(){ const keys = []; try{ for(let i=0;i<localStorage.length;i++){ keys.push(localStorage.key(i)); } }catch(e){} return keys; }
  const SYNC_KEYS = () => (window.CTT_OWN_KEYS || []).filter(k => !SKIP.has(k));

  /* ---------- local items ---------- */
  function sorted(o){ return Object.keys(o||{}).sort().reduce((a,k)=>(a[k]=o[k],a),{}); }
  function localItems(){
    const m = new Map(); const st = readJSON(STORE_KEY, {});
    if(st.examDate || Object.keys(st.days||{}).length) m.set("s:meta", JSON.stringify({days:sorted(st.days), examDate:st.examDate||""}));
    Object.entries(st.col||{}).forEach(([c,docs])=>Object.entries(docs||{}).forEach(([id,d])=>m.set("c:"+c+":"+id, JSON.stringify(d))));
    SYNC_KEYS().forEach(k=>{ const v = lsGet(k); if(v!==null) m.set("k:"+k, v); });
    return m;
  }
  function hasLocalData(){ return localItems().size > 0; }
  function applyLocal(changes){      /* changes: Map key -> json string */
    const st = readJSON(STORE_KEY, {}); st.col = st.col || {}; st.days = st.days || {};
    changes.forEach((json, key)=>{
      if(key==="s:meta"){ const m = JSON.parse(json); st.days = m.days || {}; st.examDate = m.examDate || ""; }
      else if(key.startsWith("c:")){ const i = key.indexOf(":", 2); const c = key.slice(2,i), id = key.slice(i+1); (st.col[c] = st.col[c] || {})[id] = JSON.parse(json); }
      else if(key.startsWith("k:")){ lsSet(key.slice(2), json); }
    });
    lsSet(STORE_KEY, JSON.stringify(st));
    /* keep the live object of this page in step */
    const live = window.CTT && window.CTT.store;
    if(live){ live.col = st.col; live.days = st.days; live.examDate = st.examDate; }
  }
  function clearLocal(){ SYNC_KEYS().concat([STORE_KEY]).forEach(lsDel); lsDel(STATE_KEY); }
  function tsOf(json){ try{ const o = JSON.parse(json); const t = o && (o.updated || o.at); const n = t ? Date.parse(t) : 0; return isNaN(n) ? 0 : n; }catch(e){ return 0; } }
  function mergeMeta(L, C){
    const a = L ? JSON.parse(L) : {days:{}, examDate:""}, b = C ? JSON.parse(C) : {days:{}, examDate:""};
    const days = Object.assign({}, b.days);
    Object.entries(a.days||{}).forEach(([k,v])=>{ days[k] = Math.max(v, days[k]||0); });
    return JSON.stringify({days:sorted(days), examDate:a.examDate || b.examDate || ""});
  }

  /* ---------- state ---------- */
  let backend = null, user = null, busy = false, firstDone = false, lastSync = 0, lastPull = 0, lastError = "", pendingNote = "";
  const saved = readJSON(STATE_KEY, {});
  let state = { uid: saved.uid || null, base: saved.base || {} };
  function saveState(){ lsSet(STATE_KEY, JSON.stringify(state)); }

  /* ---------- sync engine ---------- */
  const docId = key => encodeURIComponent(key);
  async function pool(tasks, n){ const q = tasks.slice(); await Promise.all(Array.from({length:Math.min(n,q.length)}, async ()=>{ for(let t; (t = q.shift()); ) await t(); })); }
  async function pushKeys(list){      /* list of [key, json] */
    await pool(list.map(([key,json])=>()=>{
      if(json.length > MAX_JSON){ lastError = "One item is too large to sync."; return null; }
      return backend.put(user.uid, docId(key), key, json).then(()=>{ state.base[key] = json; });
    }), 6);
    saveState();
  }
  async function syncNow(opts){
    opts = opts || {};
    if(!backend || !user || busy) return;
    busy = true; lastError = ""; render();
    try{
      const rows = await backend.list(user.uid);
      const cloud = new Map(rows.map(r=>[r.k, r.json]));
      const local = localItems(); const base = state.base;
      const toPush = [], toPull = new Map();
      new Set([...local.keys(), ...cloud.keys()]).forEach(key=>{
        const L = local.get(key), C = cloud.get(key), B = base[key];
        if(key==="s:meta"){
          const merged = mergeMeta(L, C);
          if(merged!==L) toPull.set(key, merged);
          if(merged!==C) toPush.push([key, merged]);
          else base[key] = merged;
          return;
        }
        if(L===C){ base[key] = L; return; }
        if(L===undefined){ toPull.set(key, C); return; }
        if(C===undefined){ toPush.push([key, L]); return; }
        if(B===L){ toPull.set(key, C); return; }
        if(B===C){ toPush.push([key, L]); return; }
        if(tsOf(C) > tsOf(L)) toPull.set(key, C); else toPush.push([key, L]);   /* both changed: newer wins, ties keep this device */
      });
      if(toPull.size){ applyLocal(toPull); toPull.forEach((json,key)=>{ base[key] = json; }); }
      saveState();
      await pushKeys(toPush.filter(([key])=>{ const m = toPull.get(key); return m===undefined || key==="s:meta"; }));
      lastSync = Date.now(); lastPull = lastSync; firstDone = true;
      if(toPull.size){
        const first = !sessionStorage.getItem("ctt-pulled-"+user.uid);
        try{ sessionStorage.setItem("ctt-pulled-"+user.uid, "1"); }catch(e){}
        const recent = Date.now() - (+sessionStorage.getItem("ctt-reload-at") || 0) < 15000;   /* never reload in a loop */
        if(opts.reload!==false && (first || opts.reload) && !recent){ try{ sessionStorage.setItem("ctt-reload-at", String(Date.now())); }catch(e){} location.reload(); return; }
        pendingNote = "Newer progress from your account was loaded. Reload to see it.";
      }
    }catch(e){
      lastError = (e && (e.code || e.message)) ? String(e.code || e.message).slice(0,80) : "unknown error";
    }finally{ busy = false; render(); }
  }
  async function pushChanges(){
    if(!backend || !user || busy || !firstDone) return;
    const local = localItems(); const changed = [];
    local.forEach((json,key)=>{ if(state.base[key]!==json) changed.push([key,json]); });
    if(!changed.length) return;
    busy = true; render();
    try{ await pushKeys(changed); lastSync = Date.now(); lastError = ""; }
    catch(e){ lastError = (e && (e.code||e.message)) ? String(e.code||e.message).slice(0,80) : "offline"; }
    finally{ busy = false; render(); }
  }
  async function wipeAll(){
    if(backend && user){ await backend.delAll(user.uid); }
    clearLocal(); state = {uid: user ? user.uid : null, base:{}}; if(user) saveState();
  }
  async function signOut(keepLocal){
    try{ await pushChanges(); }catch(e){}
    const uid = user && user.uid;
    await backend.signOut();
    if(!keepLocal) clearLocal(); else lsDel(STATE_KEY);
    try{ if(uid) sessionStorage.removeItem("ctt-pulled-"+uid); }catch(e){}
    location.reload();
  }

  /* ---------- Firebase backend ---------- */
  async function firebaseBackend(){
    const base = `https://www.gstatic.com/firebasejs/${SDK}/`;
    const [app, auth, fs] = await Promise.all([import(base+"firebase-app.js"), import(base+"firebase-auth.js"), import(base+"firebase-firestore.js")]);
    const a = app.initializeApp(CFG), au = auth.getAuth(a), db = fs.getFirestore(a);
    const items = uid => fs.collection(db, "users", uid, "items");
    return {
      onAuth(cb){ return auth.onAuthStateChanged(au, u => cb(u ? {uid:u.uid, name:u.displayName||"", email:u.email||"", photo:u.photoURL||""} : null)); },
      async signIn(){
        const p = new auth.GoogleAuthProvider(); p.setCustomParameters({prompt:"select_account"});
        try{ await auth.signInWithPopup(au, p); }
        catch(e){ if(e && (e.code==="auth/popup-blocked")) { await auth.signInWithRedirect(au, p); } else throw e; }
      },
      signOut(){ return auth.signOut(au); },
      async list(uid){ const s = await fs.getDocs(items(uid)); return s.docs.map(d=>d.data()); },
      put(uid, id, k, json){ return fs.setDoc(fs.doc(db, "users", uid, "items", id), {k, json, u:Date.now()}); },
      async delAll(uid){ const s = await fs.getDocs(items(uid)); const ds = s.docs; for(let i=0;i<ds.length;i+=400){ const b = fs.writeBatch(db); ds.slice(i,i+400).forEach(d=>b.delete(d.ref)); await b.commit(); } }
    };
  }

  /* ---------- account UI ---------- */
  const G_ICON = `<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;
  function statusText(){
    if(!user) return "";
    if(lastError) return "Could not sync: " + lastError + ". Will retry.";
    if(busy) return "Syncing…";
    if(pendingNote) return pendingNote;
    if(!lastSync) return "Signed in.";
    const d = new Date(lastSync); return "Saved to your account at " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + ".";
  }
  function avatar(u){ return u.photo ? `<img src="${esc(u.photo)}" alt="" width="24" height="24" referrerpolicy="no-referrer">` : `<span class="cc-init">${esc((u.name||u.email||"?").trim().charAt(0).toUpperCase())}</span>`; }
  function render(){
    const slot = $("#cc-slot"); const box = $("#accountBox");
    if(slot){
      if(!user){ slot.innerHTML = `<button class="cc-btn" type="button" id="cc-in">${G_ICON}<span>Sign in</span></button>`; }
      else { slot.innerHTML = `<button class="cc-btn cc-me" type="button" id="cc-me" aria-expanded="${menuOpen}" aria-haspopup="true" title="${esc(user.email)}">${avatar(user)}<span class="cc-dot${lastError?" err":busy?" busy":""}"></span></button>`; }
      const bi = $("#cc-in"); if(bi) bi.onclick = startSignIn;
      const bm = $("#cc-me"); if(bm) bm.onclick = ()=>{ menuOpen = !menuOpen; render(); };
    }
    let pop = $("#cc-pop");
    if(user && menuOpen){
      if(!pop){ pop = document.createElement("div"); pop.id = "cc-pop"; pop.className = "cc-pop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label","Account"); document.body.appendChild(pop); }
      pop.innerHTML = popHtml();
      wirePop(pop);
    } else if(pop){ pop.remove(); }
    if(box) box.innerHTML = boxHtml();
    const bb = $("#cc-in2"); if(bb) bb.onclick = startSignIn;
    const sn = $("#cc-sync"); if(sn) sn.onclick = ()=>syncNow({reload:true});
    const so = $("#cc-out"); if(so) so.onclick = ()=>{ menuOpen = true; confirmOut = true; render(); window.scrollTo({top:0}); };
  }
  function boxHtml(){
    if(!configured) return "";
    if(!user) return `<div class="cc-box"><div><b>Save your progress to your Google account</b><p class="muted" style="margin:2px 0 0">Sign in to keep results, mistakes and your exam date, and to continue on any device. Without an account everything stays in this browser.</p></div><button class="btn primary" id="cc-in2" type="button">${G_ICON} Sign in with Google</button></div>`;
    return `<div class="cc-box"><div style="display:flex;gap:10px;align-items:center;min-width:0">${avatar(user)}<div style="min-width:0"><b>${esc(user.name||"Signed in")}</b><div class="muted" style="font-size:13px;overflow-wrap:anywhere">${esc(user.email)} · ${esc(statusText())}</div></div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="cc-sync" type="button">Sync now</button><button class="btn" id="cc-out" type="button">Sign out</button></div></div>`;
  }
  let menuOpen = false, confirmOut = false;
  function popHtml(){
    if(confirmOut) return `<p style="margin:0 0 8px"><b>Sign out?</b></p><p class="muted" style="margin:0 0 10px;font-size:13px">Your progress stays in your account. On a shared computer, remove it from this device.</p><button class="btn primary" id="cc-out-clear" type="button" style="width:100%;justify-content:center">Sign out and clear this device</button><button class="btn" id="cc-out-keep" type="button" style="width:100%;justify-content:center;margin-top:6px">Sign out, keep a copy here</button><button class="btn" id="cc-out-no" type="button" style="width:100%;justify-content:center;margin-top:6px">Cancel</button>`;
    return `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">${avatar(user)}<div style="min-width:0"><b>${esc(user.name||"Signed in")}</b><div class="muted" style="font-size:13px;overflow-wrap:anywhere">${esc(user.email)}</div></div></div><p class="muted" style="margin:0 0 10px;font-size:13px">${esc(statusText())}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="cc-sync2" type="button">Sync now</button><button class="btn" id="cc-out2" type="button">Sign out</button></div><p style="margin:10px 0 0;font-size:12.5px"><a href="privacy.html">Privacy</a></p>`;
  }
  function wirePop(pop){
    const g = id => pop.querySelector(id);
    if(g("#cc-sync2")) g("#cc-sync2").onclick = ()=>syncNow({reload:true});
    if(g("#cc-out2")) g("#cc-out2").onclick = ()=>{ confirmOut = true; render(); };
    if(g("#cc-out-no")) g("#cc-out-no").onclick = ()=>{ confirmOut = false; render(); };
    if(g("#cc-out-clear")) g("#cc-out-clear").onclick = ()=>signOut(false);
    if(g("#cc-out-keep")) g("#cc-out-keep").onclick = ()=>signOut(true);
  }
  document.addEventListener("click", e=>{ if(!menuOpen || !e.target.isConnected) return; if(e.target.closest("#cc-pop")||e.target.closest("#cc-me")||e.target.closest("#cc-out")) return; menuOpen = false; confirmOut = false; render(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape" && menuOpen){ menuOpen = false; confirmOut = false; render(); } });

  function toast(html){
    let t = $("#cc-toast"); if(!t){ t = document.createElement("div"); t.id = "cc-toast"; t.className = "cc-toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
    t.innerHTML = html; t.hidden = false;
    const x = t.querySelector("[data-x]"); if(x) x.onclick = ()=>{ t.hidden = true; };
  }
  async function startSignIn(){
    if(!backend) return;
    try{ await backend.signIn(); }
    catch(e){
      const code = e && e.code || "";
      if(code==="auth/popup-closed-by-user" || code==="auth/cancelled-popup-request") return;
      toast(code==="auth/unauthorized-domain" ? `This web address is not allowed for sign-in yet. The site owner must add it in Firebase, under Authentication, Settings, Authorized domains. <button class="btn" data-x type="button">Close</button>` : `Sign-in did not work${code?` (${esc(code)})`:""}. Please try again. <button class="btn" data-x type="button">Close</button>`);
    }
  }

  /* what to do when somebody signs in */
  async function onUser(u){
    user = u; firstDone = false; pendingNote = ""; render();
    if(!u){ return; }
    if(state.uid && state.uid !== u.uid && hasLocalData()){
      /* this browser holds progress that belongs to another account */
      await new Promise(res=>{
        toast(`This browser still has progress from another account. Add it to <b>${esc(u.email)}</b>? <button class="btn primary" data-merge type="button">Add it</button> <button class="btn" data-drop type="button">Remove it</button>`);
        const t = $("#cc-toast");
        t.querySelector("[data-merge]").onclick = ()=>{ state = {uid:u.uid, base:{}}; saveState(); t.hidden = true; res(); };
        t.querySelector("[data-drop]").onclick = ()=>{ clearLocal(); state = {uid:u.uid, base:{}}; saveState(); location.reload(); };
      });
    } else if(state.uid !== u.uid){ state = {uid:u.uid, base:{}}; saveState(); }
    await syncNow({reload:true});
  }

  function mountNav(){
    const tools = $(".ctt-tools"); if(!tools || $("#cc-slot")) { render(); return; }
    if(!configured && !isLocal) return;
    const slot = document.createElement("span"); slot.id = "cc-slot"; tools.insertBefore(slot, tools.firstChild);
    render();
  }
  async function init(){
    window.CTTCloud = { configured, signedIn: ()=>!!user, wipeAll, syncNow, uid: ()=>user && user.uid };
    document.addEventListener("ctt-nav-ready", mountNav);
    if($(".ctt-tools")) mountNav();
    if(!configured){
      if(isLocal){ const slot = $("#cc-slot"); if(slot){ slot.innerHTML = `<a class="cc-btn" href="README.md" title="Fill in assets/firebase-config.js to turn on Google sign-in">Sign-in off</a>`; } }
      return;
    }
    try{ backend = await (FACTORY ? FACTORY() : firebaseBackend()); }
    catch(e){ lastError = "could not load sign-in"; render(); return; }
    backend.onAuth(u=>{ onUser(u).catch(e=>{ lastError = String((e&&(e.code||e.message))||"error").slice(0,80); render(); }); });
    setInterval(()=>{ pushChanges(); }, POLL_MS);
    document.addEventListener("visibilitychange", ()=>{
      if(document.visibilityState==="hidden") pushChanges();
      else if(user && firstDone && Date.now()-lastPull > PULL_MS) syncNow({reload:false});
    });
    window.addEventListener("pagehide", ()=>{ pushChanges(); });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
