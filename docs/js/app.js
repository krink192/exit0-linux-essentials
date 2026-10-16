// SPDX-License-Identifier: AGPL-3.0-or-later
// exit 0 - free practice for LPI Linux Essentials 010-160. User interface. Logic lives in core.js.
(function () {
  "use strict";
  const C = window.LECore;
  const BANK = C.indexBank(window.LE_BANK);
  const CARDS = window.LE_CARDS;
  const OBJ = BANK.objectives, TOP = BANK.topics;
  // Lab titles and progress info load with the page; the full labs, the shell and its man pages load when Labs opens.
  const LABX = window.LE_LABINDEX || { parts: [], lessons: [], q: {} };
  const LABS = LABX.parts, LESSONS = LABX.lessons;
  const QBYPART = {}; for (const qid in LABX.q) for (const pid of LABX.q[qid]) (QBYPART[pid] = QBYPART[pid] || []).push(qid);
  let labsLoading = null;
  function loadLabs() {
    if (window.LEShell && window.LE_LABS) return Promise.resolve();
    const add = src => new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error(src)); document.head.appendChild(el); });
    const v = LABX.assets || {};          // content hashes, so an updated app never runs an old cached copy
    return labsLoading = labsLoading || Promise.all(["data/labs.js", "js/man.js", "js/shell.js"].map(f => add(f + (v[f] ? "?v=" + v[f] : "")))).catch(e => { labsLoading = null; throw e; });
  }
  const KEY = "le010.v3";
  const REPO = "https://github.com/krink192/exit0-linux-essentials";
  // Opens a GitHub issue form with the question ID filled in.
  const reportLink = q => `<a class="muted" href="${REPO}/issues/new?template=question.yml&title=${encodeURIComponent("[" + q.id + "] ")}&qid=${encodeURIComponent(q.id)}" target="_blank" rel="noopener" title="Wrong answer, typo or unclear wording? Tell us on GitHub.">Report a problem (${q.id})</a>`;
  const app = document.getElementById("app");
  // ------------------------------------------------------------------ install on phone / offline (PWA)
  const DESKTOP = () => !!window.pywebview || /exit0-desktop/.test(navigator.userAgent) || location.hostname === "127.0.0.1";
  const STANDALONE = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (!st.current) render(); });
  window.addEventListener("appinstalled", () => { installEvt = null; toast("exit 0 is installed"); render(); });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !DESKTOP()) {
    window.addEventListener("load", () => { try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) { /* not allowed here */ } });
  }
  const canInstall = () => !DESKTOP() && !STANDALONE() && (installEvt || IOS);
  function promptInstall() {
    if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); }
    else go("settings");
  }
  const L = "ABCDEF";

  // ------------------------------------------------------------------ helpers
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rich = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  const fmt = s => { s = Math.max(0, Math.round(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  const fmtDate = ms => new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }) + ", " +
    new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const col = p => p >= 80 ? "var(--good)" : p >= 65 ? "var(--flag)" : "var(--bad)";
  const vclass = p => p >= 80 ? "v-good" : p >= 65 ? "v-mid" : "v-bad";
  const LV = { new: "Not started", learning: "Learning", weak: "Weak", mastered: "Mastered" };
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const lvChip = q => `<span class="chip lvl lvl${q.level || 1}" title="${C.LEVELS[q.level || 1][1]}">${"●".repeat(q.level || 1)}${"○".repeat(3 - (q.level || 1))} ${C.LEVELS[q.level || 1][0]}</span>`;
  function levelBars(byLevel) {
    return `<div class="bars">${[1, 2, 3].map(lv => { const [r, n] = byLevel[lv] || [0, 0]; const p = n ? Math.round(100 * r / n) : 0;
      return `<div class="bar"><div class="lbl"><span><b style="font-weight:700">${C.LEVELS[lv][0]}</b> <span class="muted small">${C.LEVELS[lv][1]}</span></span><b>${n ? r + "/" + n + " · " + p + "%" : "—"}</b></div>
        <div class="track2"><i style="width:${p}%;background:${col(p)}"></i><span class="mark"></span></div></div>`; }).join("")}</div>`;
  }

  const ICON = {
    test: '<path d="M5 3l14 9-14 9V3z"/>',
    progress: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    weak: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    drill: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    cards: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
    guide: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    flame: '<path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.6-2.4-6-4.3-8.2-.4 2.2-1.6 3.6-3 4.3.3-3.4-1.4-6.6-4.3-9.3.3 3.7-3.4 6.6-3.4 11.2C4 19 7.6 22 12 22z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    terminal: '<path d="M4 17l6-6-6-6M12 19h8"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    sheet: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    dot: '<circle cx="12" cy="12" r="7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  };
  const icon = (n, extra) => `<svg class="i${extra ? " " + extra : ""}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  function ring(pct, size, stroke, label, sub, color) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct || 0)) / 100);
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
        style="stroke:${color || "var(--accent)"}" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
      <div class="lbl" style="font-size:${Math.round(size / 4.2)}px">${label}${sub ? `<small>${sub}</small>` : ""}</div></div>`;
  }
  const toastQueue = [];          // one toast at a time, so several at once don't pile up on top of each other
  function toast(msg) {
    toastQueue.push(msg); if (toastQueue.length > 1) return;
    const show = () => { const t = document.createElement("div"); t.className = "toast"; t.textContent = toastQueue[0]; t.setAttribute("role", "status"); document.body.appendChild(t);
      setTimeout(() => { t.remove(); toastQueue.shift(); if (toastQueue.length) setTimeout(show, 150); }, 2200); };
    show();
  }

  // ------------------------------------------------------------------ state
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  let st = (() => {
    const raw = readJSON(KEY);
    return C.migrate(raw, raw ? null : { history: readJSON("le010.v2.history"), qstats: readJSON("le010.v2.qstats") });
  })();
  function save(fromSync) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked: keep working in memory */ }
    if (!fromSync) scheduleSync();
  }

  // ------------------------------------------------------------------ optional sync (exit0-sync server)
  const safeStorage = { getItem: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                        setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } } };
  function deviceName() {
    const ua = navigator.userAgent;
    const os = DESKTOP() ? "Desktop app" : /Android/.test(ua) ? "Android" : IOS ? (/iPad/.test(ua) || navigator.maxTouchPoints > 1 && /Mac/.test(ua) ? "iPad" : "iPhone")
      : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "Device";
    const br = DESKTOP() ? "" : /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    return br ? os + " · " + br : os;
  }
  const SYNC = window.LESync ? window.LESync.createSync({
    core: C, storage: safeStorage, deviceName: deviceName(),
    fetch: (url, o) => fetch(url, o),
    getState: () => st,
    resetProgress: () => { const keep = st.settings; st = C.freshState(); st.settings = keep; save(true); },
    onChange: () => { C.migrateLabs(st, LABS); save(true); C.awardBadges(st, BANK, CARDS, null, LABS.length); save(true); rerenderIfIdle(); },
  }) : null;
  let syncTimer = null;
  function scheduleSync(delay) {
    if (!SYNC || !SYNC.linked) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => SYNC.syncNow().catch(() => {}).then(() => { if ((location.hash || "").slice(1) === "settings") rerenderIfIdle(); }), delay == null ? 3000 : delay);
  }
  // Re-render after remote changes, but never in the middle of a question, lab, flashcard or while typing.
  function rerenderIfIdle() {
    const h = (location.hash || "#test").slice(1), el = document.activeElement;
    if (h === "exam" || h.startsWith("lab/") || (h === "cards" && cs && cs.i < cs.queue.length)) return;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    render();
  }
  if (SYNC) {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(0); });
    window.addEventListener("online", () => scheduleSync(0));
    setInterval(() => { if (document.visibilityState === "visible") scheduleSync(0); }, 60000);
  }
  // When the app is served by an exit0-sync server, offer that server as the sync address.
  let originServer = null;
  if (SYNC && /^https?:$/.test(location.protocol) && !DESKTOP()) {
    SYNC.probe(location.origin).then(h => { originServer = { url: location.origin, signup: h.signup }; if ((location.hash || "").slice(1) === "settings") rerenderIfIdle(); }, () => {});
  }
  st.labs = st.labs || {};
  const labsCarried = C.migrateLabs(st, LABS);     // labs you finished before they were split per lesson count for their new parts
  if (labsCarried) setTimeout(() => toast(`Labs are now one per lesson: ${labsCarried} part${labsCarried > 1 ? "s" : ""} marked complete from labs you'd finished`), 900);
  C.awardBadges(st, BANK, CARDS, null, LABS.length); save();         // credit for progress made before badges existed, without toasts
  function celebrate() {
    const lvBefore = celebrate.lv;
    C.awardBadges(st, BANK, CARDS, null, LABS.length).forEach((b, i) => setTimeout(() => toast("Badge earned: " + b.name), 400 + i * 1600));
    const x = C.xpInfo(st); if (x.level > lvBefore) setTimeout(() => toast(`Level ${x.level}: ${x.name}`), 200);
    celebrate.lv = x.level; save();
  }
  celebrate.lv = C.xpInfo(st).level;

  function applyTheme() {
    const t = st.settings.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme();

  let timerId = null, lastRec = null, reviewFilter = "wrong", showGrid = false, confirming = false;
  let deck = st.settings.deck || "concepts", cardTopic = "all", cardSize = 20, browse = false, query = "";
  let cs = null;            // active flashcard session
  const SP = () => st.settings.study;   // Study builder choices, remembered between visits
  let exportOpen = false, resetOpen = false;

  // ------------------------------------------------------------------ shell
  // Four places to go, plus reference material and settings. Practice and Learn pages share a tab bar.
  const NAV = [["today", "Today", "target"], ["practice", "Practice", "test"], ["labs", "Labs", "terminal"], ["progress", "Progress", "progress"]];
  const NAV2 = [["learn", "Learn", "guide"], ["settings", "Settings", "settings"]];
  const SECTION = { review: "practice", test: "practice", study: "practice", cards: "practice", guide: "learn", sheets: "learn" };
  const TABS = { practice: [["review", "Daily review"], ["test", "Exam"], ["study", "Study"], ["cards", "Flashcards"]], learn: [["guide", "Exam guide"], ["sheets", "Cheat sheets"]] };
  let lastPractice = null;
  const navCount = id => { if (id !== "practice") return 0; return C.reviewForecast(BANK, st.qstats).due + C.deckStats(CARDS, st.cards).due; };
  function sidebarHTML(active) {
    const qdue = C.reviewForecast(BANK, st.qstats).due;
    const due = C.deckStats(CARDS, st.cards).due;
    const sk = C.streak(st.days, st.settings.goal);
    const goalPct = Math.min(100, Math.round(100 * sk.today / st.settings.goal));
    const t = st.settings.theme;
    return `<aside class="side" id="side">
      <div class="brand"><div class="logo">$?</div><div><span class="wordmark">exit 0</span><small>Linux Essentials 010-160</small></div></div>
      ${[NAV, NAV2].map((items, k) => `${k ? `<div class="nav-label">More</div>` : `<div class="nav-label">Study</div>`}<nav class="nav">${items.map(([id, name, ic]) => {
        const n = id === "practice" ? qdue + due : 0;
        return `<a href="#${id}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${name}</span>${n ? `<span class="count">${n}</span>` : ""}</a>`;
      }).join("")}</nav>`).join("")}
      <div class="side-foot">
        <div class="today" title="Daily goal: ${st.settings.goal} questions or cards">
          ${ring(goalPct, 46, 5, `<span style="font-size:11px">${sk.today}</span>`, "", sk.metToday ? "var(--good)" : "var(--accent)")}
          <div><div class="t1">${icon("flame", "flame" + (sk.count ? "" : " cold"))}${sk.count ? plural(sk.count, "day") + " streak" : "No streak yet"}</div>
            <div class="t2">${sk.metToday ? "Today's goal done" : `${Math.max(0, st.settings.goal - sk.today)} to today's goal`}</div></div>
        </div>
        ${canInstall() ? `<button class="ghost small install-btn" id="installSide">${icon("download")}Install app</button>` : ""}
        <div class="theme-row"><span class="small muted">Theme</span>
          <div class="seg" role="group" aria-label="Theme">${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, n]) =>
            `<button data-theme-set="${k}" class="${t === k ? "on" : ""}" title="${n}" aria-label="${n} theme">${icon(k === "system" ? "system" : k === "light" ? "sun" : "moon")}</button>`).join("")}</div></div>
      </div></aside>`;
  }
  function shell(active, body) {
    clearInterval(timerId);
    const sk = C.streak(st.days, st.settings.goal);
    const section = SECTION[active] || active;
    if (section === "practice") lastPractice = active;
    const tabs = TABS[section] ? `<nav class="tabs" aria-label="${section === "practice" ? "Practice" : "Learn"}">${TABS[section].map(([id, name]) => {
      const n = id === "review" ? C.reviewForecast(BANK, st.qstats).due : id === "cards" ? C.deckStats(CARDS, st.cards).due : 0;
      return `<a href="#${id}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}>${name}${n ? ` <span class="count">${n}</span>` : ""}</a>`; }).join("")}</nav>` : "";
    app.innerHTML = `<div class="shell" id="shell">${sidebarHTML(section)}
      <div class="main"><header class="top"><button class="ghost" id="menuBtn" aria-label="Open menu">${icon("menu")}</button>
        <div class="brand"><div class="logo">$?</div><div><span class="wordmark">exit 0</span></div></div>
        <div class="streakmini">${icon("flame", "flame" + (sk.count ? "" : " cold"))}${sk.count}</div></header>
      <main class="page" id="page">${tabs}${body}</main>
      <nav class="bottomnav" aria-label="Main">${NAV.map(([id, name, ic]) => { const n = navCount(id);
        return `<a href="#${id}" class="${section === id ? "on" : ""}">${icon(ic)}<span>${name}</span>${n ? `<i class="dot-count">${n > 99 ? "99+" : n}</i>` : ""}</a>`; }).join("")}</nav></div></div>`;
    $("#menuBtn").onclick = () => $("#shell").classList.toggle("open");
    $("#shell").addEventListener("click", e => { if (e.target.id === "shell") $("#shell").classList.remove("open"); });
    $$("[data-theme-set]").forEach(b => b.onclick = () => { st.settings.theme = b.dataset.themeSet; save(); applyTheme(); render(); });
    if ($("#installSide")) $("#installSide").onclick = promptInstall;
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ router
  function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
  function render() {
    const h = (location.hash || "#today").slice(1);
    if (h === "practice") return go(lastPractice || (C.reviewForecast(BANK, st.qstats).due + C.deckStats(CARDS, st.cards).due ? "review" : "test"));
    if (h === "learn") return go("guide");
    if (h === "exam" && st.current) return renderExam();
    if (h === "exam") return go("test");
    if (h === "results" && lastRec) return renderResults(lastRec);
    if (h === "weak" || h === "drill") return go("study");      // pages merged into Study
    if (h.startsWith("lab/")) return renderLab(h.slice(4));
    const pages = { today: renderToday, labs: renderLabs, sheets: renderSheets, review: renderReview, test: renderTest, study: renderStudy, progress: renderProgress, cards: renderCards,
                    guide: renderGuide, settings: renderSettings };
    (pages[h] || renderToday)();
  }
  window.addEventListener("hashchange", render);

  // ------------------------------------------------------------------ start sessions
  function begin(s) { st.current = s; confirming = false; showGrid = false; save(); go("exam"); }
  function startTest() { begin(C.buildTest(BANK, st.qstats, {})); }
  function startStudy(f) { const s = C.buildStudy(BANK, st.qstats, f); if (s) begin(s); else toast("No questions match those choices"); }
  let reviewSize = 20;
  function startReview() { const s = C.buildReview(BANK, st.qstats, reviewSize); if (s) begin(s); else toast("Nothing is due right now"); }
  function startDueCards() {
    const today = C.dayNum();
    const queue = C.cardQueue(CARDS, st.cards, c => st.cards[c.id] && st.cards[c.id].due <= today, today, 40);
    if (!queue.length) return toast("No flashcards are due");
    cs = { queue, i: 0, flipped: false, knew: 0, done: 0 }; go("cards");
  }
  function startWeakStudy() {
    const weak = C.weakObjectives(BANK, st.qstats, 19);
    startStudy(weak.length ? { objs: weak, count: 20 } : { source: "missed", count: 20 });
  }
  function startObjCards(o) {        // flashcards for one objective: due and new cards first, then the rest
    const pool = CARDS.filter(c => c.obj === o);
    const first = C.cardQueue(CARDS, st.cards, c => c.obj === o, C.dayNum(), 20);
    cs = { queue: first.concat(pool.filter(c => !first.includes(c))).slice(0, 20), i: 0, flipped: false, knew: 0, done: 0 };
    go("cards");
  }
  function wireStarts(root) {
    $$("[data-start=test]", root).forEach(b => b.onclick = startTest);
    $$("[data-start=review]", root).forEach(b => b.onclick = startReview);
    $$("[data-start=duecards]", root).forEach(b => b.onclick = startDueCards);
    $$("[data-start=missed]", root).forEach(b => b.onclick = () => startStudy({ source: "missed", count: 20 }));
    $$("[data-start=weak]", root).forEach(b => b.onclick = startWeakStudy);
    $$("[data-start=unseen]", root).forEach(b => b.onclick = () => startStudy({ source: "unseen", count: 20 }));
    $$("[data-study]", root).forEach(b => b.onclick = () => startStudy({ objs: [b.dataset.study], count: 10 }));
    $$("[data-cards-obj]", root).forEach(b => b.onclick = e => { e.preventDefault(); startObjCards(b.dataset.cardsObj); });
    $$("[data-go]", root).forEach(b => b.onclick = () => go(b.dataset.go));
  }
  function resumeBanner() {
    const cur = st.current; if (!cur) return "";
    return `<div class="card accent banner"><div><b>You have ${cur.mode === "test" ? "an exam" : "a study session"} in progress</b>
        <div class="small muted">${esc(cur.label)} · ${cur.qids.filter(id => C.answered(BANK.byId[id], cur.answers[id])).length} of ${cur.qids.length} answered${cur.deadline ? " · " + fmt((cur.deadline - Date.now()) / 1000) + " left" : ""}</div></div>
        <div class="row"><button class="ghost" id="discard">Discard</button><button class="primary" id="resume">Resume</button></div></div>`;
  }
  function wireResume() {
    if (!$("#resume")) return;
    $("#resume").onclick = () => go("exam");
    $("#discard").onclick = () => { st.current = null; save(); render(); };
  }

  // ================================================================== TODAY: one "do this next", then the other good options
  function nextLabPart() {
    const started = LABS.find(l => !labState(l.id).completedAt && labState(l.id).done.length);
    if (started) return started;
    const lessonGoing = LABS.find(l => !labState(l.id).completedAt && LABS.some(o => o.lesson === l.lesson && labState(o.id).completedAt));
    return lessonGoing || LABS.find(l => !labState(l.id).completedAt);
  }
  const labName = p => `Lab ${p.obj}${LESSONS.filter(x => x.obj === p.obj).length > 1 ? "." + p.lesson.split(".").pop() : ""}, part ${p.part}`;
  function renderToday() {
    const f = C.reviewForecast(BANK, st.qstats), cardsDue = C.deckStats(CARDS, st.cards).due;
    const tests = st.tests.filter(t => t.mode === "test");
    const weak = C.weakObjectives(BANK, st.qstats, 1)[0];
    const lab = nextLabPart();
    const steps = [];
    if (f.due || cardsDue) steps.push({ ic: "repeat", eyebrow: "Daily review", title: [f.due ? plural(f.due, "question") : "", cardsDue ? plural(cardsDue, "flashcard") : ""].filter(Boolean).join(" and ") + " due",
      desc: "Questions and cards come back on a schedule. A few minutes now keeps them from slipping.", btn: f.due ? `<button class="primary" data-start="review">Start review</button>` : `<button class="primary" data-start="duecards">Review flashcards</button>` });
    if (lab) steps.push({ ic: "terminal", eyebrow: labName(lab), title: lab.title, desc: `${esc(lab.lessonTitle)} · ${plural(lab.n, "task")}, checked as you type.`,
      btn: `<a class="btn primary" href="#lab/${lab.id}">${labState(lab.id).done.length ? "Continue lab" : "Start lab"}</a>` });
    if (!tests.length) steps.push({ ic: "test", eyebrow: "Exam", title: "Take a baseline exam", desc: "40 questions in 60 minutes, weighted like the real exam. It shows where to focus.", btn: `<button class="primary" data-start="test">Start exam</button>` });
    else if (weak) steps.push({ ic: "weak", eyebrow: "Weakest objective", title: `Study ${weak} ${OBJ[weak].name}`, desc: `You're at ${C.objectiveStats(BANK, st.qstats)[weak].pct}% there. Ten questions with hints and answers.`, btn: `<button class="primary" data-study="${weak}">Study it</button>` });
    else steps.push({ ic: "test", eyebrow: "Exam", title: "Take a practice exam", desc: "Three exams in a row at 80% or more is the signal to book the real one.", btn: `<button class="primary" data-start="test">Start exam</button>` });
    const [main, ...rest] = steps;
    const sk = C.streak(st.days, st.settings.goal), ready = C.readiness(st.tests), pp = C.passPrediction(BANK, st.qstats), plan = C.examPlan(st, BANK);
    const labsDone = LABS.filter(l => labState(l.id).completedAt).length;
    const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    shell("today", `${resumeBanner()}
      <div class="page-head"><span class="eyebrow">${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span><h1>${hello}</h1>
        <p class="lead">${sk.metToday ? `Today's goal is done${sk.count > 1 ? ` and your streak is ${sk.count} days` : ""}. Anything more is a bonus.` : `${Math.max(0, st.settings.goal - sk.today)} more answers or cards reach today's goal.`}</p></div>
      ${st.current ? "" : `<div class="card next-card"><div class="row" style="gap:14px;align-items:flex-start;flex-wrap:nowrap"><div class="ic">${icon(main.ic)}</div>
        <div class="stack grow" style="gap:6px"><span class="eyebrow">Do this next · ${esc(main.eyebrow)}</span><h2>${esc(main.title)}</h2><p class="muted">${main.desc}</p><div class="row">${main.btn}</div></div></div></div>`}
      ${rest.length ? `<div class="stack" style="gap:8px"><span class="small muted">Also good today</span>${rest.map(x => `<div class="card later row spread"><div class="row" style="gap:12px;flex-wrap:nowrap">${icon(x.ic)}
        <div><span class="eyebrow">${esc(x.eyebrow)}</span><div><b>${esc(x.title)}</b></div></div></div>${x.btn.replace(/class="(btn )?primary"/, 'class="$1"')}</div>`).join("")}</div>` : ""}
      <div class="grid4 todaystats">
        <a class="card stat" href="#progress"><b style="color:${ready == null ? "var(--muted)" : col(ready)}">${ready == null ? "—" : ready + "%"}</b><span>Readiness</span></a>
        <a class="card stat" href="#progress"><b>${pp.chance == null ? "—" : Math.round(pp.chance * 100) + "%"}</b><span>Pass chance</span></a>
        <a class="card stat" href="#labs"><b>${labsDone}<span class="muted" style="font-size:.9rem">/${LABS.length}</span></b><span>Lab parts done</span></a>
        <a class="card stat" href="#progress"><b>${plan && plan.phase !== "past" ? (plan.phase === "today" ? "Today" : plan.days + "d") : "—"}</b><span>${plan && plan.phase !== "past" ? "Until exam day" : "No exam date set"}</span></a></div>`);
    wireResume();
    wireStarts($("#page"));
  }

  // ================================================================== DAILY REVIEW
  function renderReview() {
    const f = C.reviewForecast(BANK, st.qstats), cardsDue = C.deckStats(CARDS, st.cards).due;
    const started = Object.keys(st.qstats).length > 0;
    const caught = started && !f.due && !cardsDue;
    shell("review", `${resumeBanner()}
      <div class="page-head"><span class="eyebrow">Daily review · a few minutes a day</span><h1>Daily review</h1>
        <p class="lead">Every question you answer comes back on a schedule. A miss returns tomorrow, and each right answer pushes the next review further out: 1, 2, 4, 8, then 16 days. Flashcards that are due show up here too.</p></div>
      ${!started ? `<div class="card empty">${icon("repeat")}<b>Nothing to review yet</b>
          <p class="muted small">Take an exam or a study session. Every question you answer gets scheduled here automatically.</p>
          <div class="row" style="justify-content:center"><button class="primary" data-start="test">Start exam</button><button data-go="study">Study</button></div></div>`
        : caught ? `<div class="card celebrate">${icon("trophy")}<h2>All caught up for today</h2><p class="muted">Nothing is due. Come back tomorrow, or keep going with a study session.</p>
          <div class="row" style="justify-content:center"><button class="primary" data-go="study">Study</button><button data-start="test">Take an exam</button></div></div>` : ""}
      ${started ? `<div class="grid2">
        <div class="card stack revcard"><div class="row" style="gap:10px">${icon("repeat")}<span class="eyebrow">Questions</span></div>
          <div class="revn"><b>${f.due}</b> due</div>
          <p class="small muted">${f.due ? `Oldest first, up to ${reviewSize} at a time, with hints and answers as you go.` : "No questions due today."}</p>
          <div class="row spread"><div class="seg" id="rsize">${[10, 20, 40].map(n => `<button data-n="${n}" class="${reviewSize === n ? "on" : ""}">${n}</button>`).join("")}</div>
            <button class="primary" data-start="review" ${f.due ? "" : "disabled"}>Review questions</button></div></div>
        <div class="card stack revcard"><div class="row" style="gap:10px">${icon("cards")}<span class="eyebrow">Flashcards</span></div>
          <div class="revn"><b>${cardsDue}</b> due</div>
          <p class="small muted">${cardsDue ? "Cards from both decks that are scheduled for today." : "No flashcards due today."}</p>
          <div class="row" style="justify-content:flex-end"><button data-start="duecards" ${cardsDue ? "" : "disabled"}>Review flashcards</button></div></div>
      </div>
      <div class="card row spread"><span class="muted">Coming up</span><span><b>${f.tomorrow}</b> ${f.tomorrow === 1 ? "question" : "questions"} tomorrow · <b>${f.week}</b> in the next 7 days</span></div>` : ""}`);
    $$("#rsize button").forEach(b => b.onclick = () => { reviewSize = +b.dataset.n; renderReview(); });
    wireResume();
    wireStarts($("#page"));
  }

  // ================================================================== EXAM MODE (home)
  function renderTest() {
    const tests = st.tests.filter(t => t.mode === "test");
    const last = tests[tests.length - 1];
    const ready = C.readiness(st.tests);
    const weak = C.weakObjectives(BANK, st.qstats, 1)[0];
    const os = C.objectiveStats(BANK, st.qstats);
    let next = "";
    if (last) {
      next = weak ? `<div class="card banner"><div class="grow"><div class="eyebrow" style="margin-bottom:6px">Suggested next step</div>
          <b>Study ${esc(weak)} ${esc(OBJ[weak].name)}</b><div class="small muted">Your accuracy there is ${os[weak].pct}%. Ten questions with hints, answers and the lesson to read.</div></div>
          <button data-study="${weak}">Study it</button></div>`
        : `<div class="card banner"><div class="grow"><div class="eyebrow" style="margin-bottom:6px">Suggested next step</div>
          <b>Review flashcards</b><div class="small muted">No weak objectives right now. Keep definitions fresh with a quick card session.</div></div>
          <button data-go="cards">Open flashcards</button></div>`;
    }
    const stats = last ? `<div class="grid4">
        <div class="card stat"><b style="color:${col(last.pct)}">${last.pct}%</b><span>Last exam</span></div>
        <div class="card stat"><b>${Math.max(...tests.map(t => t.pct))}%</b><span>Best</span></div>
        <div class="card stat"><b style="color:${ready == null ? "var(--muted)" : col(ready)}">${ready == null ? "—" : ready + "%"}</b><span>Readiness</span></div>
        <div class="card stat"><b>${tests.length}</b><span>${tests.length === 1 ? "Exam" : "Exams"} taken</span></div></div>` : "";
    const tips = last ? "" : `<div class="tips">
        <div class="tip"><div class="ic">${icon("test")}</div><div><b>Exam: test-day conditions</b><span>40 questions, 60 minutes, the real blueprint, and answers hidden until you submit. Only exams count toward readiness.</span></div></div>
        <div class="tip"><div class="ic">${icon("bulb")}</div><div><b>Study: learn as you go</b><span>Pick topics, difficulty and how many questions. Get hints, instant answers and the lesson to read.</span></div></div>
        <div class="tip"><div class="ic">${icon("cards")}</div><div><b>Flashcards</b><span>Every term on the objectives, with spaced repetition so the cards you miss come back first.</span></div></div></div>`;
    shell("test", `${resumeBanner()}
      <section class="hero">
        <div class="page-head"><span class="eyebrow">Exam mode · as close to test day as possible</span><h1>Exam</h1>
          <p class="lead">40 questions in 60 minutes, drawn from ${BANK.questions.length} questions with exactly as many per objective as the real exam. No hints, and answers stay hidden until you submit.</p></div>
        <div class="cta"><button class="primary big" data-start="test">${icon("test")}Start exam</button>
          <button class="big" data-go="study">${icon("drill")}Study instead</button></div>
        <div class="rules"><span>${icon("clock")}60:00 timer</span><span>${icon("flag")}Flag and review before you submit</span><span>${icon("trophy")}Counts toward readiness</span></div>
      </section>
      ${stats}${next}${tips}`);
    wireResume();
    wireStarts($("#page"));
  }

  // ================================================================== STUDY MODE
  const LEVEL_TEXT = { 0: "Every kind of question.", 1: "Recall: remember a fact, term or definition.",
    2: "Apply: pick or type the right command, option or setting.", 3: "Analyze: read output, trace a script, work out permissions or globs." };
  function studyObjs(sp, weak) { return sp.objMode === "weak" ? weak : sp.objMode === "pick" ? sp.objs : []; }
  function renderStudy() {
    const sp = SP(), sel = new Set(sp.objs);
    const os = C.objectiveStats(BANK, st.qstats);
    const missed = C.missedIds(BANK, st.qstats).length;
    const unseen = BANK.questions.filter(q => !(st.qstats[q.id] && st.qstats[q.id].seen)).length;
    const weak = C.weakObjectives(BANK, st.qstats, 19);
    if (sp.objMode === "weak" && !weak.length) sp.objMode = "all";
    const objs = studyObjs(sp, weak);
    const pool = sp.objMode === "pick" && !objs.length ? [] : C.studyPool(BANK, st.qstats, Object.assign({}, sp, { objs }));
    const n = sp.count ? Math.min(sp.count, pool.length) : pool.length;
    const lv = sp.levels.length === 1 ? sp.levels[0] : 0;
    const objNote = sp.objMode === "all" ? "Questions from every objective."
      : sp.objMode === "weak" ? `Your weakest: ${esc(weak.join(", "))}.`
      : sel.size ? `${plural(sel.size, "objective")} selected.` : "Tick the objectives you want below.";
    shell("study", `${resumeBanner()}
      <div class="page-head"><span class="eyebrow">Study mode · learn as you go</span><h1>Study</h1>
        <p class="lead">Build your own practice set. Get a hint when you're stuck, check each answer right away, and see exactly what to read next. Study sessions don't change your readiness score.</p></div>
      <div class="quick">
        <button class="qs" data-start="missed" ${missed ? "" : "disabled"}>${icon("weak")}<b>Review my misses</b><span>${missed ? plural(missed, "question") + " you got wrong last time" : "Nothing missed yet"}</span></button>
        <button class="qs" data-start="weak" ${weak.length ? "" : "disabled"}>${icon("progress")}<b>Weak objectives</b><span>${weak.length ? esc(weak.slice(0, 4).join(", ")) + (weak.length > 4 ? "…" : "") + " below 80%" : "None yet. Take an exam to find them."}</span></button>
        <button class="qs" data-start="unseen" ${unseen ? "" : "disabled"}>${icon("bulb")}<b>New questions</b><span>${unseen ? plural(unseen, "question") + " you haven't seen" : "You've seen every question"}</span></button>
      </div>
      <div class="card stack builder"><h2>Build a session</h2>
        <div class="frow"><span class="flabel">Objectives</span><div><div class="seg" id="fobj">${[["all", "All"], ["weak", "Weak"], ["pick", "Choose…"]].map(([k, l]) =>
            `<button data-v="${k}" class="${sp.objMode === k ? "on" : ""}" ${k === "weak" && !weak.length ? 'disabled title="No weak objectives yet"' : ""}>${l}</button>`).join("")}</div>
          <div class="small muted fnote">${objNote}</div></div></div>
        ${sp.objMode === "pick" ? `<div class="picklist">${objList(os, { select: true, sel })}</div>` : ""}
        <div class="frow"><span class="flabel">Difficulty</span><div><div class="seg" id="flv">${[[0, "Any"], [1, "Recall"], [2, "Apply"], [3, "Analyze"]].map(([k, l]) =>
            `<button data-v="${k}" class="${lv === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <div class="small muted fnote">${LEVEL_TEXT[lv]}</div></div></div>
        <div class="frow"><span class="flabel">Questions</span><div class="seg" id="fsrc">${[["mix", "Everything"], ["unseen", "Not seen yet"], ["missed", "Missed last time"]].map(([k, l]) => `<button data-v="${k}" class="${sp.source === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="frow"><span class="flabel">How many</span><div class="seg" id="fcount">${[10, 20, 40, 0].map(v => `<button data-v="${v}" class="${sp.count === v ? "on" : ""}">${v || "All"}</button>`).join("")}</div></div>
      </div>
      <div class="card row spread startbar"><span><b>${n}</b> <span class="muted">${n === 1 ? "question" : "questions"}${pool.length > n ? ` (of ${pool.length} that match)` : ""}</span></span>
        <button class="primary" id="sstart" ${n ? "" : "disabled"}>Start studying</button></div>`);
    const keep = fn => { const y = scrollY; fn(); save(); renderStudy(); scrollTo(0, y); };
    $$("#fobj button").forEach(b => b.onclick = () => keep(() => { sp.objMode = b.dataset.v; }));
    $$("#flv button").forEach(b => b.onclick = () => keep(() => { const v = +b.dataset.v; sp.levels = v ? [v] : []; }));
    $$("#fsrc button").forEach(b => b.onclick = () => keep(() => { sp.source = b.dataset.v; }));
    $$("#fcount button").forEach(b => b.onclick = () => keep(() => { sp.count = +b.dataset.v; }));
    $$("[data-obj]").forEach(i => i.onchange = () => keep(() => { const o = i.dataset.obj;
      sp.objs = i.checked ? [...new Set(sp.objs.concat(o))].sort() : sp.objs.filter(x => x !== o); }));
    $("#sstart").onclick = () => startStudy({ objs, levels: sp.levels, source: sp.source, count: sp.count });
    wireResume();
    wireStarts($("#page"));
  }

  // ================================================================== PROGRESS
  function trendChart(tests) {
    const pts = tests.slice(-15), W = 640, H = 190, pl = 36, pr = 14, pt = 12, pb = 26;
    const x = i => pl + (pts.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (pts.length - 1));
    const y = v => pt + (100 - v) * (H - pt - pb) / 100;
    const line = pts.map((t, i) => `${x(i).toFixed(1)},${y(t.pct).toFixed(1)}`).join(" ");
    const area = `${x(0)},${y(0)} ${line} ${x(pts.length - 1)},${y(0)}`;
    const grid = [0, 50, 100].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/>
        <text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join("");
    const last = pts.length - 1;
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Practice test scores over time">
      ${grid}<line x1="${pl}" x2="${W - pr}" y1="${y(80)}" y2="${y(80)}" style="stroke:var(--good);stroke-dasharray:5 5"/>
      <text x="${W - pr}" y="${y(80) - 6}" text-anchor="end" style="fill:var(--good)">80% target</text>
      <polygon points="${area}" style="fill:var(--accent);opacity:.1"/>
      <polyline points="${line}" style="fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round"/>
      ${pts.map((t, i) => `<circle cx="${x(i)}" cy="${y(t.pct)}" r="${i === last ? 5 : 3}" style="fill:${i === last ? "var(--accent)" : "var(--surface)"};stroke:var(--accent);stroke-width:2"><title>${fmtDate(t.date)}: ${t.pct}%</title></circle>`).join("")}
      <text x="${x(last)}" y="${y(pts[last].pct) - 10}" text-anchor="middle" style="fill:var(--ink);font-weight:700">${pts[last].pct}%</text>
      <text x="${pl}" y="${H - 6}">${fmtDate(pts[0].date).split(",")[0]}</text>
      <text x="${W - pr}" y="${H - 6}" text-anchor="end">${fmtDate(pts[last].date).split(",")[0]}</text></svg></div>`;
  }
  function objList(os, opts) {
    opts = opts || {};
    return `<div class="olist">${Object.keys(TOP).map(t => `<div class="topic">${t}. ${esc(TOP[t])}</div>` +
      Object.keys(OBJ).filter(o => C.topicOf(o) === t).map(o => {
        const s = os[o];
        const pct = s.pct == null ? "—" : s.pct + "%";
        if (opts.select) return `<label class="orow" for="sel${o}"><input type="checkbox" id="sel${o}" data-obj="${o}" ${opts.sel.has(o) ? "checked" : ""}>
            <span class="o">${o}</span><span>${esc(OBJ[o].name)} <span class="small muted">· ${s.total} Qs</span></span><span class="chip lv-${s.level}">${LV[s.level]}</span></label>`;
        return `<div class="orow"><span class="o">${o}</span><span>${esc(OBJ[o].name)}</span>
            <span class="row" style="gap:12px"><span class="chip lv-${s.level} hide-sm">${LV[s.level]}</span><span class="pct" style="color:${s.pct == null ? "var(--muted)" : col(s.pct)}">${pct}</span></span>
            <button class="ghost small" data-study="${o}" style="padding:.4rem .6rem">Study</button></div>`;
      }).join("")).join("")}</div>`;
  }
  function achievementsCard() {
    const x = C.xpInfo(st), bs = C.badgeStatus(st, BANK, CARDS, LABS.length), got = bs.filter(b => b.done).length;
    const pct = x.next ? Math.round(100 * (x.xp - x.floor) / (x.next - x.floor)) : 100;
    return `<div class="card stack"><div class="row spread"><h2>Level and badges</h2><span class="small muted">${got} of ${bs.length} badges</span></div>
      <div class="lvl-row"><div class="lvl-badge">${x.level}</div><div class="grow"><div class="row spread"><b>${esc(x.name)}</b>
        <span class="small muted mono">${x.xp} XP${x.next ? ` · ${x.next - x.xp} to level ${x.level + 1}` : " · max level"}</span></div>
        <div class="track2" style="margin-top:8px"><i style="width:${pct}%;background:var(--accent)"></i></div>
        <div class="small muted" style="margin-top:6px">1 XP for every answer, 1 more when it's right, 1 for every flashcard and 5 for every lab task.</div></div></div>
      <div class="badges">${bs.map(b => `<div class="badge ${b.done ? "got" : ""}" title="${esc(b.desc)}">${icon(b.icon)}<div><b>${esc(b.name)}</b>
          <span>${b.done ? (b.at ? "Earned " + new Date(b.at).toLocaleDateString([], { month: "short", day: "numeric" }) : "Earned") : esc(b.desc) + (b.progress && b.progress[1] > 1 ? ` (${b.progress[0]}/${b.progress[1]})` : "")}</span></div></div>`).join("")}</div></div>`;
  }
  // ================================================================== PASS CHANCE + EXAM PLAN
  const SITE = "https://krink192.github.io/exit0-linux-essentials/";
  let planEdit = false;
  function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  const longDate = str => C.parseDate(str).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  function passCard() {
    const p = C.passPrediction(BANK, st.qstats);
    const pct = p.chance == null ? null : Math.round(p.chance * 100);
    const why = `Estimated from your latest answer to each question, weighted like the real exam. Objectives you haven't practised count as a coin flip.
      LPI doesn't publish the raw pass mark, so this assumes ${p.passPct}% to stay on the safe side. Questions you've seen before get easier, so treat it as a guide, not a promise.`;
    if (pct == null) return `<div class="card stack passcard"><div class="row" style="gap:10px">${icon("target")}<span class="eyebrow">Pass chance</span></div>
      <div class="row" style="gap:20px;align-items:center">${ring(Math.round(100 * p.seen / p.minSeen), 104, 10, "—", "", "var(--line-2)")}
        <div class="stack grow" style="gap:6px"><b>Answer ${plural(p.more, "more question")} to unlock it</b>
        <span class="small muted">${p.seen} of ${p.minSeen} so far. Exams, study sessions and daily review all count.</span></div></div>
      <p class="small muted">${why}</p></div>`;
    const verdict = pct >= 90 ? "Strong. Keep it there and book the exam." : pct >= 70 ? "Good odds, but not safe yet. Work the objectives below."
      : pct >= 40 ? "Coin-flip territory. The objectives below move it most." : "Not yet. Cover every objective, then focus on the ones below.";
    return `<div class="card stack passcard"><div class="row" style="gap:10px">${icon("target")}<span class="eyebrow">Pass chance</span></div>
      <div class="row" style="gap:20px;align-items:center">${ring(pct, 104, 10, pct + "%", "", col(pct >= 90 ? 80 : pct >= 60 ? 65 : 0))}
        <div class="stack grow" style="gap:6px"><b>${verdict}</b>
          <span class="small muted">Expected score on a fresh exam: <b>${Math.round(p.mean)}/${p.total}</b> (${Math.round(100 * p.mean / p.total)}%), most likely between ${p.low} and ${p.high}. Passing here means ${p.need} or more.</span></div></div>
      ${p.focus.length ? `<div class="stack" style="gap:8px"><span class="small muted">Where 3 more right answers help most</span>
        ${p.focus.map(f => `<div class="focusrow"><span><span class="mono muted">${f.obj}</span> ${esc(OBJ[f.obj].name)}</span>
          <span class="small gain">+${Math.max(1, Math.round(f.gain * 100))} pts</span><button class="ghost small" data-study="${f.obj}">Study</button></div>`).join("")}</div>` : ""}
      <details class="small muted"><summary>How is this worked out?</summary><p>${why}</p></details></div>`;
  }

  function planCard() {
    const s = st.settings, plan = C.examPlan(st, BANK);
    if (!plan || planEdit) return `<div class="card stack plancard"><div class="row" style="gap:10px">${icon("calendar")}<span class="eyebrow">Exam day</span></div>
      <p>${plan ? "Change your exam date." : "Booked your exam, or picking a date? Set it here for a countdown, a daily target and calendar reminders."}</p>
      <div class="row" style="gap:10px;flex-wrap:wrap"><input type="date" id="examDate" min="${todayStr()}" value="${esc(s.examDate || "")}" aria-label="Exam date">
        <button class="primary" id="setDate">Save date</button>${plan ? `<button class="ghost" id="cancelDate">Cancel</button>` : ""}</div>
      <p class="small muted">Book the real exam through LPI with Pearson VUE, at a test centre or online.</p></div>`;
    const head = plan.phase === "past" ? `<b>Your exam date has passed.</b> How did it go? Set a new date if you're retaking it.`
      : plan.phase === "today" ? `<b>Exam day. Good luck!</b> Skip new material. A light flashcard review is plenty.`
      : `<span class="countdown"><b>${plan.days}</b> ${plan.days === 1 ? "day" : "days"} to go</span>`;
    const when = `<div class="small muted">${esc(longDate(plan.date))}</div>`;
    const today = plan.phase === "learn" ? `<div class="stack" style="gap:6px"><div class="row spread"><span>Today's target</span><b>${plan.doneToday}/${plan.target}</b></div>
        <div class="track2"><i style="width:${plan.target ? Math.min(100, Math.round(100 * plan.doneToday / plan.target)) : 100}%;background:var(--accent)"></i></div>
        <span class="small muted">${[plan.newPerDay ? plural(plan.newPerDay, "new question") + " a day sees the whole bank by " + (plan.days - 2 === 1 ? "tomorrow" : "two days out") : "You've seen every question",
          plan.due ? plural(plan.due, "review") + " due today" : ""].filter(Boolean).join(", plus ")}.${plan.newPerDay > 60 ? " That's a lot per day: focus on the objectives under Pass chance first." : ""}</span></div>`
      : plan.phase === "final" ? `<p class="small">Final stretch: take a full exam, review flashcards and your misses, and skip new material.</p>` : "";
    return `<div class="card stack plancard"><div class="row spread"><div class="row" style="gap:10px">${icon("calendar")}<span class="eyebrow">Exam day</span></div>
        <button class="ghost small" id="editDate">Change date</button></div>
      <div>${head}${when}</div>${today}
      ${plan.phase === "past" ? "" : `<ul class="milestones">${plan.milestones.map(m => `<li class="${m.done ? "done" : ""}">${icon(m.done ? "check" : "dot")}<span>${esc(m.label)}${m.progress && !m.done ? ` <span class="muted">(${m.progress[0]}/${m.progress[1]})</span>` : ""}</span></li>`).join("")}</ul>
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center"><button id="ics">${icon("download")}Add to calendar</button>
        <label class="small muted row" style="gap:6px">Daily reminder at <input type="time" id="remindAt" value="${esc(s.remindAt || "19:00")}"></label></div>
      <p class="small muted">Downloads an .ics file with the exam day and a daily study reminder until the day before. It opens in Google Calendar, Outlook, Apple Calendar and GNOME Calendar.</p>`}</div>`;
  }

  function wirePlan(rerender) {
    if ($("#setDate")) $("#setDate").onclick = () => {
      const v = $("#examDate").value;
      if (!C.parseDate(v)) return toast("Pick a date first");
      if (v < todayStr()) return toast("Pick today or a later date");
      st.settings.examDate = v; planEdit = false; save(); toast("Exam date saved"); rerender();
    };
    if ($("#cancelDate")) $("#cancelDate").onclick = () => { planEdit = false; rerender(); };
    if ($("#editDate")) $("#editDate").onclick = () => { planEdit = true; rerender(); };
    if ($("#remindAt")) $("#remindAt").onchange = e => { st.settings.remindAt = e.target.value || "19:00"; save(); };
    if ($("#ics")) $("#ics").onclick = () => {
      const url = DESKTOP() || !/^https?:$/.test(location.protocol) ? SITE : location.origin + location.pathname;
      const ics = C.examIcs(st.settings.examDate, { time: st.settings.remindAt, url });
      downloadFile("linux-essentials-exam.ics", ics, "text/calendar");
      toast("Calendar file downloaded. Open it to add the events.");
    };
  }

  function renderProgress() {
    const tests = st.tests.filter(t => t.mode === "test");
    if (!st.tests.length) {
      shell("progress", `<div class="page-head"><h1>Progress</h1><p class="lead">Your scores, readiness and weak sections show up here after your first exam or study session.</p></div>
        <div class="card empty">${icon("progress")}<b>No results yet</b><p class="muted small">Take an exam to see where you stand.</p><button class="primary" data-start="test">Start exam</button></div>
        <div class="grid2">${passCard()}${planCard()}</div>`);
      wirePlan(renderProgress);
      return wireStarts($("#page"));
    }
    const ready = C.readiness(st.tests);
    const os = C.objectiveStats(BANK, st.qstats);
    const seen = Object.keys(st.qstats).filter(id => BANK.byId[id]).length;
    const ds = C.deckStats(CARDS, st.cards);
    const mastered = Object.values(os).filter(s => s.level === "mastered").length;
    const weak = C.weakObjectives(BANK, st.qstats, 5);
    const tAcc = {}; for (const t in TOP) tAcc[t] = [0, 0];
    for (const o in os) { tAcc[C.topicOf(o)][0] += os[o].right; tAcc[C.topicOf(o)][1] += os[o].seen; }
    const status = ready == null ? "Finish an exam to get a readiness score. Study sessions don't count toward it."
      : ready >= 80 ? "You're in the ready range. Keep it there across three exams, then book the real one."
      : ready >= 65 ? "Close. Study your weak sections and aim for 80% three exams in a row."
      : "Keep building. Study your weak sections, review flashcards, then take another exam.";
    shell("progress", `<div class="page-head"><h1>Progress</h1><p class="lead">How you're doing across every exam objective.</p></div>
      <div class="card row" style="gap:28px;align-items:center">
        ${ring(ready || 0, 132, 12, ready == null ? "—" : ready + "%", "Readiness", ready == null ? "var(--line)" : col(ready))}
        <div class="stack grow" style="gap:14px;min-width:240px"><p>${status}</p>
          <div class="grid4" style="gap:10px">
            <div class="stat"><b>${tests.length}</b><span>Exams</span></div>
            <div class="stat"><b>${tests.length ? Math.max(...tests.map(t => t.pct)) + "%" : "—"}</b><span>Best</span></div>
            <div class="stat"><b>${seen}<span class="muted" style="font-size:.9rem">/${BANK.questions.length}</span></b><span>Questions seen</span></div>
            <div class="stat"><b>${mastered}<span class="muted" style="font-size:.9rem">/19</span></b><span>Objectives mastered</span></div></div></div></div>
      <div class="grid2" id="plan">${passCard()}${planCard()}</div>
      ${achievementsCard()}
      ${tests.length >= 2 ? `<div class="card stack"><div class="row spread"><h2>Score trend</h2><span class="small muted">Last ${Math.min(15, tests.length)} exams</span></div>${trendChart(tests)}</div>` : ""}
      <div class="grid2">
        <div class="card stack"><h2>Troubled sections</h2>${weak.length ? `<div class="bars">${weak.map(o => `<div class="bar"><div class="lbl"><span><span class="mono muted">${o}</span> ${esc(OBJ[o].name)}</span><b>${os[o].pct}%</b></div>
            <div class="track2"><i style="width:${os[o].pct}%;background:${col(os[o].pct)}"></i><span class="mark"></span></div></div>`).join("")}</div>
            <button data-start="weak">Study weak areas</button>` : `<p class="muted small">Nothing below 80% with enough answers yet. Nice.</p>`}</div>
        <div class="card stack"><h2>By topic</h2><div class="bars">${Object.keys(TOP).map(t => { const [r, n] = tAcc[t]; const p = n ? Math.round(100 * r / n) : 0;
            return `<div class="bar"><div class="lbl"><span>${t}. ${esc(TOP[t])}</span><b>${n ? p + "%" : "—"}</b></div><div class="track2"><i style="width:${p}%;background:${col(p)}"></i><span class="mark"></span></div></div>`; }).join("")}</div></div>
      </div>
      <div class="card stack"><div class="row spread"><h2>By question difficulty</h2><a href="#guide" class="small">What do these mean?</a></div>${levelBars(C.levelStats(BANK, st.qstats))}
        <p class="small muted">The real exam leans on exact syntax and reading commands. If Apply or Analyze trails Recall, study those levels and use the Commands &amp; files flashcards.</p></div>
      <div class="card stack"><div class="row spread"><h2>Objective mastery</h2><span class="small muted">${ds.mastered}/${ds.total} flashcards mastered</span></div>${objList(os)}</div>
      <div class="stack"><h2>History</h2><div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Session</th><th style="text-align:right">Score</th><th style="text-align:right">Time</th><th></th></tr></thead><tbody>
        ${st.tests.slice().reverse().slice(0, 25).map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.label)}</td>
          <td class="n" style="color:${col(t.pct)}">${t.score}/${t.total} · ${t.pct}%</td><td class="n">${fmt(t.secs)}</td>
          <td style="text-align:right">${t.qids ? `<button class="ghost small" data-review="${t.id}" style="padding:.4rem .6rem">Review</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div></div>
      ${SYNC && !SYNC.linked ? `<p class="small muted">Studying on more than one device? <a href="#settings">Set up sync</a> with your own exit0-sync server to keep this progress in step.</p>` : ""}`);
    wirePlan(renderProgress);
    wireStarts($("#page"));
    $$("[data-review]").forEach(b => b.onclick = () => { lastRec = st.tests.find(t => t.id === b.dataset.review); reviewFilter = "all"; go("results"); });
  }

  // ================================================================== FLASHCARDS
  const deckFilter = () => c => c.deck === deck && (cardTopic === "all" || C.topicOf(c.obj) === cardTopic);
  function renderCards() {
    if (cs) return renderCardSession();
    const decks = [["concepts", "Concepts", "Terms, ideas, hardware and the filesystem layout"], ["commands", "Commands & files", "Commands, options, operators and key files"]];
    const ds = C.deckStats(CARDS, st.cards, deckFilter());
    const pool = CARDS.filter(deckFilter());
    const q = query.trim().toLowerCase();
    const list = q ? pool.filter(c => (c.front + " " + c.back + " " + (c.ex || "")).toLowerCase().includes(q)) : pool;
    const nextN = Math.min(cardSize, ds.due + ds.fresh);
    shell("cards", `<div class="page-head"><h1>Flashcards</h1><p class="lead">Every term in LPI's exam objectives. Cards you know come back less often, and cards you miss come back first.</p></div>
      <div class="deck-tabs">${decks.map(([k, name, desc]) => { const s = C.deckStats(CARDS, st.cards, c => c.deck === k);
        return `<button class="deck ${deck === k ? "on" : ""}" data-deck="${k}"><span class="row spread"><span class="dn">${name}</span><span class="chip lv-${s.due ? "weak" : "new"}">${s.due ? s.due + " due" : s.total + " cards"}</span></span>
          <span class="ds">${desc}</span><span class="stackbar"><i style="width:${100 * s.mastered / s.total}%"></i><i style="width:${100 * s.learning / s.total}%"></i></span>
          <span class="ds">${s.mastered} mastered · ${s.learning} learning · ${s.fresh} new</span></button>`; }).join("")}</div>
      <div class="card row spread">
        <div class="row" style="gap:16px"><select id="ctopic" aria-label="Topic"><option value="all">All topics</option>${Object.keys(TOP).map(t => `<option value="${t}" ${cardTopic === t ? "selected" : ""}>${t}. ${esc(TOP[t])}</option>`).join("")}</select>
          <div class="seg" id="csize">${[10, 20, 40].map(n => `<button data-n="${n}" class="${cardSize === n ? "on" : ""}">${n}</button>`).join("")}</div></div>
        <button class="primary" id="cstart" ${nextN ? "" : "disabled"}>${nextN ? `Study ${nextN} cards` : "All caught up"}</button></div>
      ${nextN ? "" : `<p class="small muted">Every card in this selection is scheduled for later. Come back tomorrow, or browse the list below.</p>`}
      <div class="stack" style="gap:10px"><div class="row spread"><h2>Browse ${pool.length} cards</h2><label class="switch"><input type="checkbox" id="cbrowse" ${browse ? "checked" : ""}> Show list</label></div>
        ${browse ? `<input class="search" id="cq" type="search" placeholder="Search terms and definitions…" value="${esc(query)}" aria-label="Search cards">
        <div class="glossary">${list.map(c => `<div class="gitem ${c.deck === "commands" ? "cmd" : ""}"><div class="gf">${esc(c.front)}</div>
          <div><span class="mono small muted">${c.obj}</span> ${rich(c.back)}${c.ex ? `<pre class="code" style="margin-top:6px">${esc(c.ex)}</pre>` : ""}</div></div>`).join("") || `<p class="muted small" style="padding:12px 4px">No cards match.</p>`}</div>` : ""}</div>`);
    $$("[data-deck]").forEach(b => b.onclick = () => { deck = b.dataset.deck; st.settings.deck = deck; save(); renderCards(); });
    $("#ctopic").onchange = e => { cardTopic = e.target.value; renderCards(); };
    $$("#csize button").forEach(b => b.onclick = () => { cardSize = +b.dataset.n; renderCards(); });
    $("#cbrowse").onchange = e => { browse = e.target.checked; renderCards(); };
    if ($("#cq")) $("#cq").oninput = e => { query = e.target.value; const pos = e.target.selectionStart; renderCards(); const i = $("#cq"); i.focus(); i.setSelectionRange(pos, pos); };
    $("#cstart").onclick = () => {
      const queue = C.cardQueue(CARDS, st.cards, deckFilter(), C.dayNum(), cardSize);
      if (!queue.length) return;
      cs = { queue, i: 0, flipped: false, knew: 0, done: 0 }; renderCards();
    };
  }
  function renderCardSession() {
    if (cs.i >= cs.queue.length) {
      shell("cards", `<div class="card celebrate">${icon("trophy")}<h2>Session complete</h2>
        <p class="muted">You knew ${cs.knew} of ${cs.done} cards. Cards you missed will come back first next time.</p>
        <div class="row" style="justify-content:center"><button class="primary" id="again">Study more</button><button id="back">Back to decks</button></div></div>`);
      $("#again").onclick = () => { cs = null; $("#cstart") || renderCards(); const b = $("#cstart"); if (b && !b.disabled) b.click(); };
      $("#back").onclick = () => { cs = null; renderCards(); };
      return;
    }
    const c = cs.queue[cs.i];
    const isCmd = c.deck === "commands";
    shell("cards", `<div class="row spread"><div><span class="eyebrow">${isCmd ? "Commands & files" : "Concepts"}</span><div class="qnum" style="margin-top:4px"><b>${cs.i + 1}</b> / ${cs.queue.length}</div></div>
        <button class="ghost" id="cend">End session</button></div>
      <div class="progress" style="border-radius:9px"><i style="width:${100 * cs.i / cs.queue.length}%"></i></div>
      <div class="flash-wrap"><div class="flash ${cs.flipped ? "flipped" : ""}" id="flash" tabindex="0" role="button" aria-label="Flip card">
        <div class="face ${isCmd ? "cmd" : ""}"><div class="meta"><span>${c.obj} · ${esc(OBJ[c.obj].name)}</span><span>Term</span></div>
          <div class="front-t">${esc(c.front)}</div><div class="hint">Click or press <span class="kbd">Space</span> to flip</div></div>
        <div class="face back"><div class="meta"><span>${esc(c.front)}</span><span>Definition</span></div>
          <div class="back-t">${rich(c.back)}</div>${c.ex ? `<pre>${esc(c.ex)}</pre>` : ""}<div class="hint">Did you know it?</div></div></div></div>
      ${cs.flipped ? `<div class="grade-row"><button class="again" id="again">Still learning <span class="kbd">1</span></button><button class="knew" id="knew">Got it <span class="kbd">2</span></button></div>`
        : `<button class="primary" id="flipBtn" style="padding:1rem">Show answer <span class="kbd" style="color:inherit;border-color:currentColor">Space</span></button>`}`);
    const flip = () => { cs.flipped = !cs.flipped; renderCardSession(); };
    $("#flash").onclick = flip;
    if ($("#flipBtn")) $("#flipBtn").onclick = flip;
    if ($("#again")) { $("#again").onclick = () => gradeCard(false); $("#knew").onclick = () => gradeCard(true); }
    $("#cend").onclick = () => { cs.queue = cs.queue.slice(0, cs.i); renderCardSession(); };
  }
  function gradeCard(knew) {
    const c = cs.queue[cs.i];
    C.reviewCard(st.cards, c.id, knew, C.dayNum(), Date.now());
    C.addActivity(st, 1); save();
    if (cs.i + 1 >= cs.queue.length) celebrate();
    cs.done++; if (knew) cs.knew++;
    cs.i++; cs.flipped = false; renderCardSession();
  }

  // ================================================================== EXAM GUIDE
  function renderGuide() {
    let bp = "";
    for (const t in TOP) {
      const objs = Object.keys(OBJ).filter(o => C.topicOf(o) === t);
      bp += `<tr class="topic"><td colspan="2">Topic ${t}: ${esc(TOP[t])}</td><td class="n">${objs.reduce((n, o) => n + OBJ[o].weight, 0)}</td><td></td></tr>` +
        objs.map(o => `<tr><td class="mono">${o}</td><td>${esc(OBJ[o].name)}</td><td class="n">${OBJ[o].weight}</td><td><a href="${OBJ[o].lesson}" target="_blank" rel="noopener">Lesson</a></td></tr>`).join("");
    }
    shell("guide", `<div class="page-head"><h1>Exam guide</h1><p class="lead">Everything about LPI Linux Essentials 010-160 in one place, taken from LPI's published information.</p></div>
      <div class="facts">
        <div class="card"><b>40</b><span>questions</span></div><div class="card"><b>60 min</b><span>time limit</span></div>
        <div class="card"><b>500 / 800</b><span>scaled score to pass (range 200 to 800)</span></div><div class="card"><b>Lifetime</b><span>certificate validity</span></div></div>
      <div class="card stack guide"><h2>Format and delivery</h2><ul>
        <li>The exam is delivered by Pearson VUE, at a test center or online through OnVUE.</li>
        <li>OnVUE needs a Windows or Mac computer with a webcam, a quiet private room and a stable internet connection.</li>
        <li>It is available in English, French, German, Japanese, Portuguese (Brazilian) and Spanish.</li>
        <li>You get your result and score report as soon as you finish. Linux Essentials comes as a PDF certificate, with no physical copy.</li>
        <li>The number of correct answers needed varies with the questions you get, because scores are scaled. Treat 80% in this app as your target.</li></ul></div>
      <div class="card stack guide"><h2>Question types</h2><ul>
        <li><b>Single answer:</b> pick the one best option.</li>
        <li><b>Multiple answer:</b> the question tells you how many to pick, as in "Choose TWO".</li>
        <li><b>Fill in the blank:</b> type a command, option or path exactly. Case matters: <code>-R</code> and <code>-r</code> are different options.</li></ul></div>
      <div class="stack"><h2>Exam blueprint</h2><p class="muted small">An objective's weight equals its number of questions. Every exam in this app follows this table.</p>
        <div class="tablewrap"><table class="table"><thead><tr><th>Obj.</th><th>Objective</th><th style="text-align:right">Questions</th><th>Study</th></tr></thead><tbody>${bp}
        <tr class="topic"><td colspan="2">Total</td><td class="n">40</td><td></td></tr></tbody></table></div></div>
      <div class="card stack guide" id="difficulty"><h2>How hard is the real exam?</h2>
        <p>LPI sets the pass mark for a "minimally qualified candidate": someone with basic Linux knowledge who is most likely the end user of a mostly managed system and can work on the command line. LPI doesn't publish difficulty data. Candidates and trainers mostly describe the challenge as breadth plus exact recall: precise command options, permission notation, package tools and directory names.</p>
        <p>Every question in this app is tagged by the kind of thinking it needs:</p>
        <ul>${[1, 2, 3].map(lv => `<li><b>${C.LEVELS[lv][0]}</b>: ${C.LEVELS[lv][1].toLowerCase()}. ${C.levelMix(BANK)[lv]} questions in the bank.</li>`).join("")}</ul>
        <p class="small muted">The tags are a guide, not an official rating. Your Progress page shows your accuracy at each level, and Study mode can filter by level. Strong Apply and Analyze scores are the best sign that you're ready for exact-syntax questions on the real exam.</p></div>
      <div class="grid2">
        <div class="card stack guide"><h2>A study plan that works</h2><ol>
          <li>Take an exam cold to get a baseline.</li><li>Study your weak objectives. Use hints only when stuck, and read the linked lesson for anything you miss.</li>
          <li>Do a short flashcard session every day to keep your streak going.</li><li>Take another exam. Book the real one when your readiness stays at 80% or higher.</li></ol></div>
        <div class="card stack guide"><h2>Test-day tips</h2><ul>
          <li>Answer every question, because a blank can't score.</li><li>Flag hard questions and come back. Don't let one question eat your time.</li>
          <li>For fill-ins, check whether they ask for the command name only or the full command.</li><li>About 90 seconds per question is your pace.</li></ul></div></div>
      <div class="card stack guide"><h2>Official sources</h2><ul>
        <li><a href="https://www.lpi.org/our-certifications/linux-essentials-overview/" target="_blank" rel="noopener">Linux Essentials overview</a></li>
        <li><a href="https://www.lpi.org/our-certifications/exam-010-objectives/" target="_blank" rel="noopener">Exam 010 objectives (v1.6)</a></li>
        <li><a href="https://www.lpi.org/about-lpi/frequently-asked-questions/" target="_blank" rel="noopener">LPI FAQ: scoring, delivery and results</a></li>
        <li><a href="https://learning.lpi.org/en/learning-materials/010-160/" target="_blank" rel="noopener">Free LPI learning materials</a></li></ul></div>`);
  }

  // ================================================================== LABS (simulated terminal)
  // One lab per LPI lesson, split into parts; progress is stored per part (st.labs[partId]).
  const machines = {};          // one live machine per part for this visit; reloading the page starts fresh
  const hintLevel = {};         // partId -> [hints shown per task]
  const coachTip = {};          // partId -> { task, say } from the last command
  const labState = id => (st.labs[id] = st.labs[id] || { done: [] });
  const partsOf = code => LABS.filter(l => l.lesson === code);
  const lessonName = L => L.obj + (partsOf(L.lesson).length && LESSONS.filter(x => x.obj === L.obj).length > 1 ? " · Lesson " + L.num : "");
  function renderLabs() {
    const doneParts = LABS.filter(l => labState(l.id).completedAt).length;
    const doneLessons = LESSONS.filter(L => partsOf(L.lesson).every(p => labState(p.id).completedAt)).length;
    const next = LABS.find(l => !labState(l.id).completedAt);
    const byTopic = {}; LESSONS.forEach(L => (byTopic[C.topicOf(L.obj)] = byTopic[C.topicOf(L.obj)] || []).push(L));
    shell("labs", `<div class="page-head"><span class="eyebrow">Labs · hands-on practice</span><h1>Labs</h1>
        <p class="lead">A lab for every lesson of the LPI Learning Materials, split into short parts so you use every command the lesson teaches. Each task is checked as you type, with hints that get more specific, coaching when a command goes wrong, and an explanation once you've got it. The system is simulated, so nothing you do can break anything.</p></div>
      <div class="card row spread"><span><b>${doneParts}</b> <span class="muted">of ${LABS.length} parts</span> · <b>${doneLessons}</b> <span class="muted">of ${LESSONS.length} lessons complete</span></span>
        ${next ? `<a class="btn primary" href="#lab/${next.id}">${doneParts ? "Continue" : "Start"}: ${esc(next.lesson)} part ${next.part}</a>` : `<span class="chip lv-mastered">All labs complete</span>`}</div>
      ${Object.keys(byTopic).sort().map(t => `<div class="stack" style="gap:10px"><div class="eyebrow">${t}. ${esc(TOP[t])}</div><div class="lessongrid">${byTopic[t].map(L => {
        const parts = partsOf(L.lesson); const total = parts.reduce((a, p) => a + p.n, 0), got = parts.reduce((a, p) => a + labState(p.id).done.length, 0);
        const all = parts.every(p => labState(p.id).completedAt);
        return `<div class="card lessoncard ${all ? "done" : ""}"><div class="row spread"><span class="mono small muted">${esc(lessonName(L))}</span>${all ? `<span class="chip lv-mastered">Complete</span>` : got ? `<span class="chip lv-learning">${got}/${total}</span>` : `<span class="small muted">${parts.length} parts</span>`}</div>
          <b>${esc(L.title)}</b><div class="track2"><i style="width:${total ? 100 * got / total : 0}%;background:${all ? "var(--good)" : "var(--accent)"}"></i></div>
          <ol class="partlist">${parts.map(p => { const ls = labState(p.id);
            return `<li><a href="#lab/${p.id}" class="${ls.completedAt ? "done" : ""}"><span class="pn">${ls.completedAt ? icon("check") : p.part}</span><span class="grow">${esc(p.title)}</span><span class="small muted mono">${ls.done.length}/${p.n}</span></a></li>`; }).join("")}</ol></div>`; }).join("")}</div></div>`).join("")}`);
  }
  // A light "did you mean" for typos, like command-not-found on real systems.
  function closestCommand(sh, word) {
    const cands = sh.complete(""); let best = null, bd = 3;
    const dist = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
    for (const c of cands) { const x = dist(word, c); if (x < bd) { bd = x; best = c; } }
    return best && best !== word ? best : null;
  }
  const focusTask = {};         // partId -> task shown on phones (one task at a time above the terminal)
  function renderLab(id) {
    const meta = LABS.find(l => l.id === id); if (!meta) return go("labs");
    if (!window.LEShell || !window.LE_LABS) {
      shell("labs", `<div class="page-head"><a class="small" href="#labs">← All labs</a><h1>${esc(meta.title)}</h1><p class="lead muted">Starting the lab system…</p></div>`);
      loadLabs().then(() => { if ((location.hash || "").slice(1) === "lab/" + id) renderLab(id); },
        () => { $("#page").insertAdjacentHTML("beforeend", `<div class="card">Couldn't load the lab files. Check your connection and <a href="#lab/${esc(id)}" onclick="location.reload()">try again</a>.</div>`); });
      return;
    }
    const lab = window.LE_LABS.find(l => l.id === id);
    const ls = labState(id); const parts = partsOf(lab.lesson); const next = parts[lab.part] || LABS[LABS.indexOf(meta) + 1];
    const related = (QBYPART[id] || []).filter(q => BANK.byId[q]);
    const sh = machines[id] = machines[id] || window.LEShell.createMachine({ setup: lab.setup });
    if (!sh.log) sh.log = `exit 0 lab: ${lab.title}. A simulated Linux system: type commands below. 'help' lists commands, 'man NAME' explains one.\n`;
    const hl = hintLevel[id] = hintLevel[id] || lab.tasks.map(() => 0);
    const nextIdx = lab.tasks.findIndex((_, i) => !ls.done.includes(i));
    const tip = coachTip[id];
    const fi = typeof focusTask[id] === "number" ? focusTask[id] : (tip ? tip.task : nextIdx < 0 ? lab.tasks.length - 1 : nextIdx);
    shell("labs", `<div class="page-head"><a class="small" href="#labs">← All labs</a><span class="eyebrow" style="margin-top:8px">Lesson ${esc(lab.obj)}${LESSONS.filter(x => x.obj === lab.obj).length > 1 ? "." + lab.lesson.split(".").pop() : ""} · ${esc(lab.lessonTitle)}</span>
        <h1>${esc(lab.title)}</h1><p class="lead">${rich(lab.intro)}</p>
        <nav class="partnav" aria-label="Parts of this lesson">${parts.map(p => `<a href="#lab/${p.id}" class="${p.id === id ? "on" : ""} ${labState(p.id).completedAt ? "done" : ""}">${labState(p.id).completedAt ? icon("check") : ""}Part ${p.part}</a>`).join("")}</nav></div>
      ${ls.completedAt ? `<div class="card banner done-banner"><div class="row" style="gap:10px">${icon("trophy")}<div><b>Part complete.</b> <span class="muted">${related.length ? "Lock it in with the exam questions on what you just practised." : "Keep experimenting, or restart it for another run."}</span></div></div>
        <div class="row">${related.length ? `<button class="primary" id="labQs">${icon("drill")}Answer ${plural(Math.min(10, related.length), "related question")}</button>` : ""}
        ${next ? `<a class="btn ${related.length ? "" : "primary"}" href="#lab/${next.id}">${next.lesson === lab.lesson ? "Next: part " + next.part : "Next lesson: " + esc(next.lesson)} →</a>` : `<a class="btn" href="#labs">All labs</a>`}</div></div>` : ""}
      <div class="labwrap ${focusTask[id] === "all" ? "" : "one"}">
        <div class="stack tasks">
          <div class="taskpager"><button class="ghost small" data-tp="-1" ${fi <= 0 ? "disabled" : ""} aria-label="Previous task">‹</button>
            <span class="small"><b>Task ${fi + 1}</b> <span class="muted">of ${lab.tasks.length} · ${ls.done.length} done</span></span>
            <button class="ghost small" data-tp="1" ${fi >= lab.tasks.length - 1 ? "disabled" : ""} aria-label="Next task">›</button><span class="grow"></span>
            <button class="linkbtn" id="allTasks">${focusTask[id] === "all" ? "One at a time" : "All tasks"}</button></div>
          ${lab.tasks.map((t, i) => { const done = ls.done.includes(i); const shown = hl[i];
          return `<div class="task ${done ? "done" : ""} ${i === nextIdx ? "next" : ""} ${i === fi ? "focus" : ""}"><div class="row" style="gap:10px;align-items:flex-start"><span class="tnum">${done ? icon("check") : i + 1}</span><div class="grow">${rich(t.text)}
            ${done ? `<div class="explain"><b>Why it works.</b> ${rich(t.explain)}</div>` : `
            ${tip && tip.task === i ? `<div class="coach" role="status"><b>Coach:</b> ${rich(tip.say)}</div>` : ""}
            ${t.hints.slice(0, shown).map((h, k) => `<div class="tip-box">${t.hints.length > 1 ? `<b>Hint ${k + 1}.</b> ` : ""}${rich(h)}</div>`).join("")}
            <div class="row small" style="gap:12px;margin-top:6px">${shown < t.hints.length ? `<button class="linkbtn" data-hint="${i}">${icon("bulb")}${shown ? "Another hint" : "Hint"}</button>` : ""}<button class="linkbtn" data-sol="${i}">Show solution</button></div>`}
            <pre class="code sol" id="sol${i}" hidden>${esc(t.solution)}</pre></div></div></div>`; }).join("")}
          <div class="row small hide-one" style="gap:14px"><span class="muted">${ls.done.length} of ${lab.tasks.length} done</span><span class="grow"></span><button class="ghost small" id="labReset">Restart part</button></div></div>
        <div class="term" id="term"><div class="term-out" id="termOut"></div>
          <div class="term-line"><span class="term-prompt" id="termPrompt"></span><input id="termIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Terminal input"></div></div>
      </div>
      <div class="labfoot stack small">
        <div class="cmdrow"><span class="muted">Commands in this part:</span> ${lab.commands.map(c => `<button class="cmdchip" data-man="${esc(c)}" title="Type 'man ${esc(c)}' in the terminal">${esc(c)}</button>`).join("")}</div>
        <div class="row" style="gap:16px;flex-wrap:wrap"><a href="${esc(lab.url)}" target="_blank" rel="noopener">Read LPI lesson ${esc(lab.lesson.replace(/\.(\d+)$/, " (lesson $1)"))} ↗</a>
          ${related.length ? `<span class="muted">${plural(related.length, "exam question")} cover this part</span>` : ""}<span class="grow"></span><button class="ghost small show-one" id="labReset2">Restart part</button></div></div>
      <p class="small muted hide-sm"><span class="kbd">↑</span> <span class="kbd">↓</span> history · <span class="kbd">Tab</span> complete · <span class="kbd">Ctrl</span>+<span class="kbd">L</span> clear · <span class="kbd">Ctrl</span>+<span class="kbd">C</span> cancel the line</p>`);
    const out = $("#termOut"), inp = $("#termIn");
    const promptHTML = () => { if (sh.pending != null) return "&gt; "; const p = sh.prompt(); return `<span class="pu">${esc(p.user)}@${esc(p.host)}</span>:<span class="pp">${esc(p.path)}</span>${p.sym} `; };
    const promptText = () => { if (sh.pending != null) return "> "; const p = sh.prompt(); return `${p.user}@${p.host}:${p.path}${p.sym} `; };
    const paint = () => { out.textContent = sh.log; $("#termPrompt").innerHTML = promptHTML(); out.scrollTop = out.scrollHeight; $("#term").scrollTop = $("#term").scrollHeight; };
    paint();
    let hi = null;
    const evaluate = () => {
      const fresh = [];
      lab.tasks.forEach((t, i) => { if (!ls.done.includes(i) && sh.check(t.check)) { ls.done.push(i); fresh.push(i); } });
      if (!fresh.length) return false;
      ls.done.sort((a, b) => a - b); C.addActivity(st, fresh.length);
      if (coachTip[id] && fresh.includes(coachTip[id].task)) delete coachTip[id];
      if (typeof focusTask[id] === "number") delete focusTask[id];        // follow the next unfinished task
      fresh.forEach((i, k) => setTimeout(() => toast(`Task ${i + 1} complete`), k * 900));
      if (ls.done.length === lab.tasks.length && !ls.completedAt) { ls.completedAt = Date.now(); setTimeout(() => toast(parts.every(p => labState(p.id).completedAt) ? "Lesson complete!" : "Part complete!"), fresh.length * 900); }
      save(); celebrate(); return true;
    };
    // Coaching: the first unfinished task whose known mistakes match what was typed and printed.
    const coach = (line, output, code) => {
      const before = coachTip[id]; delete coachTip[id];
      for (let i = 0; i < lab.tasks.length; i++) { if (ls.done.includes(i)) continue;
        for (const mk of lab.tasks[i].mistakes || []) {
          if ((mk.cmd == null || new RegExp(mk.cmd).test(line)) && (mk.out == null || new RegExp(mk.out).test(output)) && (mk.cmd != null || mk.out != null)) { coachTip[id] = { task: i, say: mk.say }; return true; }
        } }
      // general advice for the current task when a command fails in a common way
      const cur = lab.tasks.findIndex((_, i) => !ls.done.includes(i)), cmd0 = (line.trim().split(/\s+/)[0] || "");
      const general = /are you root|superuser|Permission denied\.$|cannot lock \/etc|RTNETLINK answers: Operation not permitted|must be run as root/m.test(output) && cmd0 !== "sudo" ? "That command changes the system, so it needs root. Run it again with `sudo` in front."
        : /Permission denied|Operation not permitted/.test(output) ? "You don't have the rights for that. `ls -l` shows a file's owner and permissions; system changes need `sudo`."
        : /No such file or directory/.test(output) && !/command not found/.test(output) ? "Check the name and where you are: `pwd` shows your directory, `ls` lists what's here, and Tab completes names."
        : /(invalid|unrecognized) option|missing operand|Usage:|usage:/.test(output) ? "Check the syntax with `" + cmd0 + " --help` or `man " + cmd0 + "`." : null;
      if (general && cur >= 0 && code !== 0) { coachTip[id] = { task: cur, say: general }; return true; }
      return !!before;
    };
    const run = line => {
      sh.log += promptText() + line + "\n";
      const src = sh.pending != null ? sh.pending + "\n" + line : line;
      const r = sh.exec(src);
      if (r.incomplete) { sh.pending = src; hi = null; paint(); return; }       // unfinished (open quote, heredoc, if...fi): keep reading with a "> " prompt
      sh.pending = null;
      let text = r.out; const clr = text.lastIndexOf("\u001bc"); if (clr >= 0) { sh.log = ""; text = text.slice(clr + 2); }
      if (r.code === 127) { const m0 = /^bash: (\S+): command not found$/m.exec(text); const guess = m0 && closestCommand(sh, m0[1]); if (guess) text += `(lab: did you mean '${guess}'?)\n`; }
      sh.log += text; hi = null;
      if (sh.log.length > 60000) sh.log = sh.log.slice(-50000);
      const rerender = () => { const y = scrollY; renderLab(id); scrollTo(0, y); const i = $("#termIn"); if (i) i.focus({ preventScroll: true }); };
      const tipChanged = coach(src, r.out, r.code);
      if (r.edit) openLabEditor(sh, r.edit, () => { if (evaluate()) rerender(); else paint(); });
      if (evaluate() || tipChanged) { rerender(); return; }
      paint();
    };
    inp.onkeydown = e => {
      if (e.key === "Enter") { e.preventDefault(); const line = inp.value; inp.value = ""; run(line); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const h = sh.m.history; if (!h.length) return;
        hi = hi == null ? h.length : hi; hi = Math.max(0, Math.min(h.length, hi + (e.key === "ArrowUp" ? -1 : 1))); inp.value = (h[hi] || "").split("\n")[0]; }
      else if (e.key === "Tab") { e.preventDefault(); const words = inp.value.split(" "); const opts = sh.complete(inp.value);
        if (opts.length === 1) { words[words.length - 1] = opts[0].replace(/ /g, "\\ ") + (opts[0].endsWith("/") ? "" : " "); inp.value = words.join(" "); }
        else if (opts.length > 1) { let pre = opts[0]; opts.forEach(o => { while (!o.startsWith(pre)) pre = pre.slice(0, -1); }); if (pre.length > words[words.length - 1].length) { words[words.length - 1] = pre; inp.value = words.join(" "); }
          else { sh.log += promptText() + inp.value + "\n" + opts.map(o => o.split("/").filter(Boolean).pop() + (o.endsWith("/") ? "/" : "")).join("  ") + "\n"; paint(); } } }
      else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); sh.log = ""; paint(); }
      else if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); sh.log += promptText() + inp.value + "^C\n"; sh.pending = null; inp.value = ""; paint(); }
    };
    $("#term").onclick = () => { if (!getSelection().toString()) inp.focus(); };
    inp.onfocus = () => { if (matchMedia("(max-width: 900px)").matches) setTimeout(() => $("#term") && $("#term").scrollIntoView({ block: "end", behavior: "smooth" }), 250); };   // keep the prompt above the phone keyboard
    $$("[data-hint]").forEach(b => b.onclick = () => { const i = +b.dataset.hint; hl[i] = Math.min(lab.tasks[i].hints.length, hl[i] + 1); const y = scrollY; renderLab(id); scrollTo(0, y); });
    $$("[data-sol]").forEach(b => b.onclick = () => { const el = $("#sol" + b.dataset.sol); el.hidden = !el.hidden; b.textContent = el.hidden ? "Show solution" : "Hide solution"; });
    $$("[data-man]").forEach(b => b.onclick = () => { inp.value = "man " + b.dataset.man; inp.focus(); });
    const reset = () => { delete machines[id]; delete hintLevel[id]; delete coachTip[id]; delete focusTask[id]; st.labs[id] = { done: [] }; save(); renderLab(id); };
    $("#labReset").onclick = reset; $("#labReset2").onclick = reset;
    $$("[data-tp]").forEach(b => b.onclick = () => { focusTask[id] = Math.max(0, Math.min(lab.tasks.length - 1, fi + +b.dataset.tp)); const y = scrollY; renderLab(id); scrollTo(0, y); });
    $("#allTasks").onclick = () => { if (focusTask[id] === "all") delete focusTask[id]; else focusTask[id] = "all"; const y = scrollY; renderLab(id); scrollTo(0, y); };
    if ($("#labQs")) $("#labQs").onclick = () => begin(C.newSession(BANK, "drill", "Lab follow-up · " + lab.title, C.shuffle(related.slice(), C.rng()).slice(0, 10), { study: true }));
    if (matchMedia("(pointer:fine)").matches) inp.focus({ preventScroll: true });
  }
  function openLabEditor(sh, req, after) {
    const wrap = document.createElement("div"); wrap.className = "editor-wrap";
    wrap.innerHTML = `<div class="editor card"><div class="row spread"><b class="mono">${esc(req.editor)}: ${esc(req.path)}</b><span class="small muted">Ctrl+S save · Ctrl+X save and close · Esc cancel</span></div>
      <textarea id="edText" spellcheck="false" autocapitalize="off"></textarea><div class="small" id="edMsg" style="color:var(--bad)"></div>
      <div class="row" style="justify-content:flex-end"><button id="edCancel">Cancel</button><button class="primary" id="edSave">Save and close</button></div></div>`;
    document.body.appendChild(wrap);
    const ta = wrap.querySelector("#edText"); ta.value = sh.readFileForEdit(req.path);
    if (req.editor !== "nano") ta.placeholder = "This panel stands in for vi: type normally, then save. (In real vi: i to insert, Esc, then :wq.)";
    const close = () => { wrap.remove(); after(); const i = $("#termIn"); if (i) i.focus(); };
    const saveIt = andClose => { const r = sh.writeFile(req.path, ta.value); if (!r.ok) { wrap.querySelector("#edMsg").textContent = "Can't save: " + r.error; return false; }
      sh.log += `(saved ${req.path})\n`; if (andClose) close(); else toast("Saved"); return true; };
    wrap.querySelector("#edSave").onclick = () => saveIt(true);
    wrap.querySelector("#edCancel").onclick = close;
    ta.onkeydown = e => { if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveIt(false); }
      else if (e.ctrlKey && e.key.toLowerCase() === "x") { e.preventDefault(); saveIt(true); }
      else if (e.key === "Tab") { e.preventDefault(); const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + "  " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = p + 2; } };
    ta.focus();
  }

  // ================================================================== CHEAT SHEETS
  let sheetTopic = "1";
  function renderSheets() {
    const SHEETS = window.LE_SHEETS || [];
    const shown = sheetTopic === "all" ? SHEETS : SHEETS.filter(x => x.topic === sheetTopic);
    shell("sheets", `<div class="page-head"><h1>Cheat sheets</h1><p class="lead">One page per exam topic with the commands, options, files and facts you need on test day. Print them or save them as PDF.</p></div>
      <div class="card row spread sheet-tools"><div class="seg" id="stopic">${SHEETS.map(x => `<button data-v="${x.topic}" class="${sheetTopic === x.topic ? "on" : ""}" title="${esc(TOP[x.topic])}">Topic ${x.topic}</button>`).join("")}<button data-v="all" class="${sheetTopic === "all" ? "on" : ""}">All</button></div>
        <button class="primary" id="sprint">${icon("print")}Print${sheetTopic === "all" ? " all" : ""}</button></div>
      ${shown.map(x => `<section class="sheet"><div class="sheet-head"><span class="eyebrow">exit 0 · Linux Essentials 010-160 · Topic ${x.topic}</span><h2>${esc(TOP[x.topic])}</h2></div>
        <div class="sheet-grid">${x.sections.map(sec => `<div class="sheet-sec"><h3>${esc(sec.h)}</h3><dl>${sec.rows.map(([k, v]) => `<dt>${rich(k)}</dt><dd>${rich(v)}</dd>`).join("")}</dl></div>`).join("")}</div></section>`).join("")}`);
    $$("#stopic button").forEach(b => b.onclick = () => { sheetTopic = b.dataset.v; renderSheets(); });
    $("#sprint").onclick = () => window.print();
  }

  // ================================================================== SETTINGS
  // ------------------------------------------------------------------ sync card
  let syncDevices = null, syncPwOpen = false, syncBusy = false;
  const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : fmtDate(ms); };
  function syncCardHTML() {
    if (!SYNC) return "";
    const i = SYNC.info, dis = syncBusy ? " disabled" : "";
    const head = `<div><h2>Sync</h2><p class="small muted">Keep progress in step across your computer, phone and the desktop app through your own
      <a href="https://github.com/krink192/exit0-sync" target="_blank" rel="noopener">exit0-sync</a> server. Optional: everything works offline without it.</p></div>`;
    if (SYNC.pending) {
      const copied = SYNC.pending.copied;
      return `<div class="card stack" id="sync">${head}<p><b>This device and your account both have progress.</b></p>
        <p class="small muted">${copied ? "This device's progress looks like a copy of your account's (from an export code, or an earlier sign-in), so using the account's progress avoids counting it twice."
          : "Combining adds this device's history to your account. Using the account's progress replaces what's on this device."}</p>
        <div class="row"><button id="syCloud" class="${copied ? "primary" : ""}"${dis}>Use account progress</button><button id="syMerge" class="${copied ? "" : "primary"}"${dis}>Combine both</button>
          <button id="syOut" class="ghost"${dis}>Cancel</button></div></div>`;
    }
    if (!SYNC.linked) {
      const url = i.url || (originServer && originServer.url) || "";
      const signup = originServer && originServer.url === url && originServer.signup;
      return `<div class="card stack" id="sync">${head}
        ${i.lastError ? `<p class="small" style="color:var(--bad)">${esc(i.lastError)}</p>` : ""}
        <label class="small muted" for="syUrl">Server address</label><input id="syUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://exit0.example.com" value="${esc(url)}">
        <div class="row" style="gap:10px;flex-wrap:wrap"><input id="syUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Username" value="${esc(i.username || "")}" style="flex:1;min-width:140px">
          <input id="syPass" type="password" autocomplete="current-password" placeholder="Password" style="flex:1;min-width:140px"></div>
        <div class="row"><button class="primary" id="syIn"${dis}>${syncBusy ? "Signing in…" : "Sign in"}</button>${signup ? `<button id="syUp"${dis}>Create account</button>` : ""}</div></div>`;
    }
    return `<div class="card stack" id="sync">${head}
      <div class="row spread" style="flex-wrap:wrap;gap:8px"><span>Signed in as <b>${esc(i.username)}</b> on <span class="mono small">${esc(i.url.replace(/^https?:\/\//, ""))}</span></span>
        <span class="small muted">${i.lastSync ? "Synced " + ago(i.lastSync) : "Not synced yet"} · ${plural(i.others, "other device")}</span></div>
      ${i.lastError ? `<p class="small" style="color:var(--bad)">${esc(i.lastError)}</p>` : ""}
      <div class="row" style="flex-wrap:wrap"><button class="primary" id="syNow"${dis}>${syncBusy ? "Syncing…" : "Sync now"}</button>
        <button id="syDev">${syncDevices ? "Hide devices" : "Devices"}</button><button id="syPw">${syncPwOpen ? "Cancel" : "Change password"}</button><button class="ghost" id="syOut">Sign out</button></div>
      ${syncDevices ? `<div class="stack" style="gap:6px">${syncDevices.devices.map(d => `<div class="row spread"><span>${esc(d.name)}${d.id === syncDevices.current ? ` <span class="chip lv-mastered">This device</span>` : ""}
          <span class="small muted"> · last seen ${ago(d.lastSeen)}</span></span>${d.id === syncDevices.current ? "" : `<button class="small" data-sy-rm="${esc(d.id)}">Sign out</button>`}</div>`).join("")}
        <p class="small muted">Signing a device out stops it syncing. The progress it already made stays.</p></div>` : ""}
      ${syncPwOpen ? `<div class="stack" style="gap:8px"><input id="syCur" type="password" autocomplete="current-password" placeholder="Current password">
        <input id="syNew" type="password" autocomplete="new-password" placeholder="New password (10+ characters)">
        <label class="small"><input type="checkbox" id="syOthers" checked> Sign out my other devices</label>
        <div class="row"><button class="primary" id="sySavePw">Change password</button></div></div>` : ""}</div>`;
  }
  async function syncAction(fn, okMsg) {
    syncBusy = true; renderSettings();
    try { const r = await fn(); const m = typeof okMsg === "function" ? okMsg(r) : okMsg; if (m) toast(m); }
    catch (e) { toast(e.message || "Something went wrong"); }
    syncBusy = false; render();
  }
  function bindSyncCard() {
    if (!SYNC) return;
    const signIn = signup => {
      const url = $("#syUrl").value.trim(), user = $("#syUser").value.trim(), pass = $("#syPass").value;
      if (location.protocol === "https:" && /^http:/.test(url)) return toast("This page uses https, so the server address must too.");
      if (!url || !user || !pass) return toast("Enter the server address, username and password.");
      syncAction(() => SYNC.signIn(url, user, pass, { signup }), r => r.needsChoice ? "Signed in. Choose how to combine progress." : "Signed in. Progress synced.");
    };
    if ($("#syIn")) { $("#syIn").onclick = () => signIn(false); $("#syPass").onkeydown = e => { if (e.key === "Enter") signIn(false); }; }
    if ($("#syUp")) $("#syUp").onclick = () => signIn(true);
    if ($("#syCloud")) $("#syCloud").onclick = () => syncAction(() => SYNC.choose("cloud"), "Using your account's progress");
    if ($("#syMerge")) $("#syMerge").onclick = () => syncAction(() => SYNC.choose("merge"), "Progress combined");
    if ($("#syNow")) $("#syNow").onclick = () => syncAction(() => SYNC.syncNow(), () => SYNC.info.lastError ? null : "Synced");
    if ($("#syOut")) $("#syOut").onclick = () => syncAction(async () => { await SYNC.signOut(); syncDevices = null; syncPwOpen = false; }, "Signed out. Progress stays on this device.");
    if ($("#syDev")) $("#syDev").onclick = async () => {
      if (syncDevices) { syncDevices = null; return renderSettings(); }
      try { syncDevices = await SYNC.devices(); } catch (e) { toast(e.message); } renderSettings();
    };
    $$("[data-sy-rm]").forEach(b => b.onclick = () => syncAction(async () => { await SYNC.removeDevice(b.dataset.syRm); syncDevices = await SYNC.devices(); }, "Device signed out"));
    if ($("#syPw")) $("#syPw").onclick = () => { syncPwOpen = !syncPwOpen; renderSettings(); };
    if ($("#sySavePw")) $("#sySavePw").onclick = () => {
      const cur = $("#syCur").value, nw = $("#syNew").value, others = $("#syOthers").checked;
      syncAction(async () => { await SYNC.changePassword(cur, nw, others); syncPwOpen = false; if (syncDevices) syncDevices = await SYNC.devices(); }, "Password changed");
    };
  }

  function renderSettings() {
    const s = st.settings;
    const linked = !!(SYNC && SYNC.linked);
    const data = exportOpen ? JSON.stringify({ app: "le010", v: 3, tests: st.tests, qstats: st.qstats, cards: st.cards, days: st.days, labs: st.labs, badges: st.badges, settings: st.settings }) : "";
    shell("settings", `<div class="page-head"><h1>Settings</h1></div>
      <div class="card stack"><h2>Appearance</h2><div class="row spread"><span>Theme</span>
        <div class="seg" id="theme">${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, n]) => `<button data-v="${k}" class="${s.theme === k ? "on" : ""}">${n}</button>`).join("")}</div></div></div>
      <div class="card stack"><h2>Daily goal</h2>
        <div class="row spread"><div><div>Daily goal</div><div class="small muted">Questions answered plus flashcards reviewed. Meeting it keeps your streak.</div></div>
          <div class="seg" id="goal">${[10, 20, 40, 60].map(n => `<button data-v="${n}" class="${s.goal === n ? "on" : ""}">${n}</button>`).join("")}</div></div></div>
      ${DESKTOP() || STANDALONE() ? "" : `<div class="card stack" id="install"><div><h2>Install on this device</h2>
          <p class="small muted">Add exit 0 to your home screen or app list. It opens in its own window and works offline, with your progress kept on this device${SYNC && SYNC.linked ? " and synced" : " (or synced, if you set up Sync below)"}.</p></div>
        ${installEvt ? `<div class="row"><button class="primary" id="installNow">${icon("download")}Install exit 0</button></div>`
          : IOS ? `<p class="small">In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>`
          : `<p class="small">In Chrome or Edge, open the browser menu and choose <b>Install app</b> (on Android: <b>Add to Home screen</b>). Firefox doesn't support installing web apps on desktop; use the desktop app below instead.</p>`}</div>`}
      ${DESKTOP() ? "" : `<div class="card stack"><div><h2>Desktop app</h2><p class="small muted">The same app in its own window. It works offline, saves progress on your computer and can sync with your server too.</p></div>
        <div class="row"><a class="btn primary" href="${REPO}/releases/latest/download/Exit0.exe" target="_blank" rel="noopener">Windows (.exe)</a>
          <a class="btn" href="${REPO}#fedora" target="_blank" rel="noopener">Fedora (dnf)</a>
          <a class="btn" href="${REPO}#ubuntu--debian" target="_blank" rel="noopener">Ubuntu / Debian (apt)</a></div></div>`}
      ${syncCardHTML()}
      <div class="card stack"><h2>Your data</h2><p class="small muted">${linked ? "Progress is saved in this browser and synced with your server." : "Progress is saved in this browser only. To move it to another device, copy the export code there and paste it under Import, or set up sync above."}</p>
        <div class="row"><button id="exp">${exportOpen ? "Hide export code" : "Show export code"}</button></div>
        ${exportOpen ? `<textarea id="expData" readonly aria-label="Export code">${esc(data)}</textarea><div class="row"><button class="primary" id="copy">Copy</button></div>` : ""}
        ${linked ? `<p class="small muted">To import an export code, sign out of sync first.</p>` : `<label class="small muted" for="impData">Import from another device</label><textarea id="impData" placeholder="Paste an export code here"></textarea>
        <div class="row"><button id="imp">Import</button></div>`}</div>
      <div class="card stack"><h2>Reset</h2><p class="small muted">${linked ? "Deletes tests, question history, flashcard progress and streak on <b>every device</b> signed in to this account. Settings are kept." : "Deletes tests, question history, flashcard progress and streak. Settings are kept."}</p>
        ${resetOpen ? `<div class="row card confirm spread"><span>Delete all progress? This can't be undone.</span><span class="row"><button id="rno">Cancel</button><button class="primary" id="ryes">Delete</button></span></div>`
          : `<div class="row"><button id="reset">Reset all progress</button></div>`}</div>
      <p class="small muted"><b class="wordmark">exit 0</b> · Free practice for LPI Linux Essentials 010-160 · Free and open source under the GNU AGPL v3 · <a href="${REPO}" target="_blank" rel="noopener">Source code</a><br>
        Original practice material based on LPI's published objectives. Not affiliated with or endorsed by the Linux Professional Institute.</p>`);
    $$("#theme button").forEach(b => b.onclick = () => { s.theme = b.dataset.v; save(); applyTheme(); renderSettings(); });
    $$("#goal button").forEach(b => b.onclick = () => { s.goal = +b.dataset.v; save(); renderSettings(); });
    $("#exp").onclick = () => { exportOpen = !exportOpen; renderSettings(); };
    if ($("#installNow")) $("#installNow").onclick = promptInstall;
    if ($("#copy")) $("#copy").onclick = () => {
      const ta = $("#expData");
      const done = () => toast("Copied");
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast("Selected. Press Ctrl+C to copy"); }); }
      catch (e) { ta.select(); toast("Selected. Press Ctrl+C to copy"); }
    };
    bindSyncCard();
    if ($("#imp")) $("#imp").onclick = () => {
      try {
        const d = JSON.parse($("#impData").value);
        if (d.app !== "le010" || !Array.isArray(d.tests)) throw new Error("bad");
        Object.assign(st, { tests: d.tests, qstats: d.qstats || {}, cards: d.cards || {}, days: d.days || {}, labs: d.labs || st.labs || {}, badges: d.badges || st.badges || {} });
        if (d.settings) st.settings = Object.assign(st.settings, d.settings);
        save(); applyTheme(); toast("Progress imported"); renderSettings();
      } catch (e) { toast("That code isn't valid. Copy the whole export code and try again."); }
    };
    if ($("#reset")) $("#reset").onclick = () => { resetOpen = true; renderSettings(); };
    if ($("#rno")) { $("#rno").onclick = () => { resetOpen = false; renderSettings(); };
      $("#ryes").onclick = () => {
        resetOpen = false;
        if (linked) return syncAction(() => SYNC.resetEverywhere(), "Progress reset on every device");
        const keep = st.settings; st = C.freshState(); st.settings = keep; save(); toast("Progress reset"); renderSettings();
      }; }
  }

  // ================================================================== EXAM
  function renderExam() {
    clearInterval(timerId);
    const S = st.current, n = S.qids.length, id = S.qids[S.cur], q = BANK.byId[id], a = S.answers[id];
    const done = S.qids.filter(i => C.answered(BANK.byId[i], S.answers[i])).length;
    const flagged = Object.values(S.flags).filter(Boolean).length;
    const revealed = S.study && S.checked[id];
    const hintOn = S.study && S.hints && S.hints[id] && !revealed;
    const isTest = S.mode === "test";
    let body;
    if (q.type === "fill") {
      body = `<label class="fill ${revealed ? "locked" : ""}" for="fillin"><span class="ps">$</span><input id="fillin" autocomplete="off" autocapitalize="off" spellcheck="false"
        value="${esc(a || "")}" placeholder="type your answer" ${revealed ? "disabled" : ""}></label>
        <p class="small muted">Type the exact text. Case matters. Press <span class="kbd">Enter</span> ${S.study && !revealed ? "to check" : "for the next question"}.</p>`;
    } else {
      const multi = q.type === "multi";
      body = `<div class="opts" role="${multi ? "group" : "radiogroup"}">${S.optOrder[id].map((oi, pos) => {
        const sel = Array.isArray(a) && a.includes(oi);
        let cls = (multi ? "multi" : "single") + (sel ? " sel" : ""), tag = "";
        if (revealed) { const k = q.answer.includes(oi); cls += " locked" + (k ? " k" : sel ? " w" : ""); if (k) cls = cls.replace(" sel", ""); tag = k ? (sel ? "Your answer · correct" : "Correct") : sel ? "Your answer" : ""; }
        return `<label class="opt ${cls}" for="o${pos}"><input type="${multi ? "checkbox" : "radio"}" name="opt" id="o${pos}" data-oi="${oi}" ${sel ? "checked" : ""} ${revealed ? "disabled" : ""}>
          <span class="key">${L[pos]}</span><span class="t">${rich(q.options[oi])}${revealed ? whyNote(q, oi) : ""}</span>${tag ? `<span class="tag">${tag}</span>` : ""}</label>`;
      }).join("")}</div>${multi && !revealed ? `<p class="small muted">Select ${q.answer.length}. ${Array.isArray(a) ? a.length : 0} selected.</p>` : ""}`;
    }
    const ok = revealed && C.isCorrect(q, a);
    const fb = revealed ? `<div class="feedback ${ok ? "ok" : "no"}"><h3>${ok ? "Correct" : C.answered(q, a) ? "Not quite" : "Not answered"}</h3>
        ${q.type === "fill" ? `<div class="mono small">Accepted: ${q.accept.map(x => `<code>${esc(x)}</code>`).join(" · ")}</div>` : ""}
        <div>${rich(q.explanation)}</div>${studyRef(q)}</div>` : "";
    const typeTag = q.type === "fill" ? "Type your answer" : q.type === "multi" ? "Choose " + (q.answer.length === 2 ? "two" : "three") : "Choose one";
    app.innerHTML = `<div class="exam-bar"><div class="in">
        <span class="title">${esc(S.label)}</span><span class="small muted mono hide-sm" id="cnt">${done}/${n} answered</span>
        <span class="grow"></span>
        <span class="timer" id="timer">${S.deadline ? fmt((S.deadline - Date.now()) / 1000) : fmt((Date.now() - S.start) / 1000)}</span>
        <button class="ghost" id="exit" title="Progress is kept. Resume from the ${isTest ? "Exam" : "Study"} page.">Save &amp; exit</button>
        <button class="ghost hide-sm" id="gridBtn" aria-expanded="${showGrid}">${showGrid ? "Hide" : "All"} questions</button>
        <button class="primary" id="submit">${isTest ? "Submit" : "Finish"}</button></div>
      <div class="progress"><i style="width:${100 * done / n}%"></i></div></div>
      <main class="page" style="gap:20px">
        ${confirming ? `<div class="card confirm stack" style="gap:10px"><h3>${isTest ? "Submit your exam?" : "Finish this study session?"}</h3>
          <p>${n - done ? (isTest ? `<b>${n - done}</b> unanswered ${n - done === 1 ? "question counts" : "questions count"} as wrong. ` : `<b>${n - done}</b> unanswered ${n - done === 1 ? "question is" : "questions are"} left out of your score. `) : "All questions answered. "}${flagged ? `<b>${flagged}</b> flagged.` : ""}</p>
          <div class="row"><button id="keep">Keep working</button><button class="primary" id="doSubmit">${isTest ? "Submit and see results" : "Finish and see results"}</button></div></div>` : ""}
        ${showGrid ? `<div class="card"><div class="qgrid">${S.qids.map((qid, i) => { let c = C.answered(BANK.byId[qid], S.answers[qid]) ? "ans" : "";
            if (S.study && S.checked[qid]) c = C.isCorrect(BANK.byId[qid], S.answers[qid]) ? "ok" : "no";
            return `<button data-jump="${i}" class="${c}${S.flags[qid] ? " fl" : ""}${i === S.cur ? " cur" : ""}" aria-label="Question ${i + 1}">${i + 1}</button>`; }).join("")}</div></div>` : ""}
        <div class="qhead"><span class="qnum">Question <b>${S.cur + 1}</b> of ${n}</span><span class="row" style="gap:8px">${S.study ? lvChip(q) : ""}<span class="eyebrow">${typeTag}${S.study ? " · " + q.obj : ""}</span></span></div>
        <p class="qtext">${rich(q.q)}</p>
        ${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ""}
        ${body}${hintOn ? `<div class="hintbox">${icon("bulb")}<div><b>Hint</b> ${rich(q.hint)}</div></div>` : ""}${fb}
        <div class="nav-row"><button id="prev" ${S.cur === 0 ? "disabled" : ""}>Previous</button>
          <span class="row"><button id="flag" class="${S.flags[id] ? "flagged" : "ghost"}" aria-pressed="${!!S.flags[id]}">${icon("flag")}${S.flags[id] ? "Flagged" : "Flag"}</button>
          ${S.study && !revealed && q.hint && !S.hints[id] ? `<button class="ghost" id="hintBtn">${icon("bulb")}Hint</button>` : ""}
          ${S.study && !revealed ? `<button id="check">Check answer</button>` : ""}
          ${S.cur < n - 1 ? `<button class="primary" id="next">Next</button>` : `<button class="primary" id="end">${isTest ? "Review & submit" : "Finish"}</button>`}</span></div>
        <p class="small muted hide-sm"><span class="kbd">←</span> <span class="kbd">→</span> move · <span class="kbd">1</span>–<span class="kbd">5</span> choose · <span class="kbd">F</span> flag${S.study ? ` · <span class="kbd">H</span> hint` : ""}</p>
      </main>`;
    const move = i => { S.cur = Math.max(0, Math.min(n - 1, i)); save(); renderExam(); scrollTo(0, 0); };
    $("#prev").onclick = () => move(S.cur - 1);
    if ($("#next")) $("#next").onclick = () => move(S.cur + 1);
    if ($("#end")) $("#end").onclick = () => { confirming = true; renderExam(); scrollTo(0, 0); };
    if ($("#check")) $("#check").onclick = () => { S.checked[id] = 1; save(); renderExam(); };
    $("#flag").onclick = () => { S.flags[id] = !S.flags[id]; save(); renderExam(); };
    $("#gridBtn").onclick = () => { showGrid = !showGrid; renderExam(); };
    $("#submit").onclick = () => { confirming = true; renderExam(); scrollTo(0, 0); };
    $("#exit").onclick = () => { save(); go(isTest ? "test" : S.mode === "review" ? "review" : "study"); };
    if ($("#hintBtn")) $("#hintBtn").onclick = () => showHint(S, id);
    $$("[data-cards-obj]").forEach(b => b.onclick = e => { e.preventDefault(); save(); startObjCards(b.dataset.cardsObj); });
    $$("[data-labgo]").forEach(b => b.onclick = () => save());
    if (confirming) { $("#keep").onclick = () => { confirming = false; renderExam(); }; $("#doSubmit").onclick = finish; }
    $$("[data-jump]").forEach(b => b.onclick = () => move(+b.dataset.jump));
    if (q.type === "fill" && !revealed) {
      const inp = $("#fillin");
      inp.oninput = () => { S.answers[id] = inp.value; save(); const c = S.qids.filter(i => C.answered(BANK.byId[i], S.answers[i])).length; $("#cnt").textContent = `${c}/${n} answered`; $(".progress i").style.width = (100 * c / n) + "%"; };
      inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); if (S.study && !S.checked[id]) { S.checked[id] = 1; save(); renderExam(); } else if (S.cur < n - 1) move(S.cur + 1); else { confirming = true; renderExam(); } } };
      if (matchMedia("(pointer:fine)").matches) inp.focus({ preventScroll: true });
    } else if (!revealed) {
      $$(".opt input").forEach(inp => inp.onchange = () => {
        const oi = +inp.dataset.oi;
        if (q.type === "single") S.answers[id] = [oi];
        else { let cur = Array.isArray(S.answers[id]) ? S.answers[id].slice() : []; cur = inp.checked ? [...new Set(cur.concat(oi))] : cur.filter(x => x !== oi); S.answers[id] = cur; }
        save(); const y = scrollY; renderExam(); scrollTo(0, y);
      });
    }
    timerId = setInterval(() => {
      const t = $("#timer"); if (!t) return clearInterval(timerId);
      if (S.deadline) { const r = (S.deadline - Date.now()) / 1000; t.textContent = fmt(r); t.classList.toggle("low", r <= 300); if (r <= 0) { clearInterval(timerId); finish(); } }
      else t.textContent = fmt((Date.now() - S.start) / 1000);
    }, 1000);
  }
  function showHint(S, id) {
    if (!S.study || S.checked[id] || !BANK.byId[id].hint) return;
    S.hints = S.hints || {}; S.hints[id] = 1; save(); const y = scrollY; renderExam(); scrollTo(0, y);
  }
  // "Study this" links shown with every answer in Study mode and in result reviews
  // "Why that's wrong": a one-line note under each wrong option once the answer is revealed.
  function whyNote(q, oi) {
    const n = q.why && q.why[oi];
    return n ? `<span class="note"><b>Why not:</b> ${rich(n)}</span>` : "";
  }

  function studyRef(q) {
    const nc = CARDS.filter(c => c.obj === q.obj).length;
    return `<div class="studyref"><span class="eyebrow">Study this</span>
      <a href="${OBJ[q.obj].lesson}" target="_blank" rel="noopener">${icon("guide")}LPI lesson ${q.obj}: ${esc(OBJ[q.obj].name)}</a>
      ${nc ? `<a href="#cards" data-cards-obj="${q.obj}">${icon("cards")}${nc} flashcards for ${q.obj}</a>` : ""}
      ${(LABX.q[q.id] || []).map(pid => { const p = LABS.find(x => x.id === pid); return p ? `<a href="#lab/${p.id}" data-labgo="${p.id}" class="lablink">${icon("terminal")}Practise it: Lab ${esc(p.obj)}${LESSONS.filter(x => x.obj === p.obj).length > 1 ? "." + p.lesson.split(".").pop() : ""}, part ${p.part}: ${esc(p.title)}</a>` : ""; }).join("")}
      <span class="grow"></span>${reportLink(q)}</div>`;
  }
  function pickByNumber(pos) {
    const S = st.current, id = S.qids[S.cur], q = BANK.byId[id];
    if (q.type === "fill" || (S.study && S.checked[id])) return;
    const order = S.optOrder[id]; if (pos >= order.length) return;
    const oi = order[pos];
    if (q.type === "single") S.answers[id] = [oi];
    else { const cur = new Set(S.answers[id] || []); cur.has(oi) ? cur.delete(oi) : cur.add(oi); S.answers[id] = [...cur]; }
    save(); renderExam();
  }
  function finish() {
    clearInterval(timerId);
    const S = st.current;
    if (S.mode !== "test") {          // study sessions are scored on the questions you actually answered
      const done = S.qids.filter(id => C.answered(BANK.byId[id], S.answers[id]));
      if (!done.length) { st.current = null; confirming = false; showGrid = false; save(); toast("Nothing answered, so nothing was saved"); return go("study"); }
      S.qids = done;
    }
    const res = C.grade(BANK, S);
    lastRec = C.recordResult(st, BANK, S, res);
    celebrate();
    st.current = null; confirming = false; showGrid = false; save();
    reviewFilter = res.score < res.total ? "wrong" : "all";
    go("results");
  }

  // ================================================================== RESULTS
  function renderResults(rec) {
    const perQ = {}, byObj = {}, byTopic = {}, byLevel = {};
    for (const id of rec.qids) {
      const q = BANK.byId[id]; if (!q) continue;
      const ok = C.isCorrect(q, rec.answers[id]); perQ[id] = ok;
      const o = q.obj, t = C.topicOf(o), lv = q.level || 1;
      (byLevel[lv] = byLevel[lv] || [0, 0])[1]++; if (ok) byLevel[lv][0]++;
      (byObj[o] = byObj[o] || [0, 0])[1]++; (byTopic[t] = byTopic[t] || [0, 0])[1]++; if (ok) { byObj[o][0]++; byTopic[t][0]++; }
    }
    const flags = new Set(rec.flags || []), hintsUsed = new Set(rec.hints || []);
    const pct = rec.pct, isTest = rec.mode === "test";
    const verdict = pct >= 80 ? "Ready range" : pct >= 65 ? "Close: review your misses" : "Keep practicing";
    const wrongN = rec.qids.filter(id => !perQ[id]).length;
    const list = rec.qids.map((id, i) => ({ id, i })).filter(({ id }) => reviewFilter === "all" || (reviewFilter === "wrong" && !perQ[id]) || (reviewFilter === "flag" && flags.has(id)));
    const item = ({ id, i }) => {
      const q = BANK.byId[id], a = rec.answers[id], ok = perQ[id];
      let body;
      if (q.type === "fill") body = `<div class="mono small">Your answer: <b>${C.answered(q, a) ? esc(C.norm(a)) : "(blank)"}</b></div>
        ${ok ? "" : `<div class="mono small">Accepted: ${q.accept.map(x => `<code>${esc(x)}</code>`).join(" · ")}</div>`}`;
      else body = `<div class="stack" style="gap:4px">${rec.optOrder[id].map((oi, pos) => { const k = q.answer.includes(oi), p = Array.isArray(a) && a.includes(oi);
        return `<div class="ropt ${k ? "correct" : p ? "picked" : ""}"><span class="k2">${L[pos]}</span><span class="rt">${rich(q.options[oi])}${whyNote(q, oi)}</span>${k || p ? `<span class="why">${k && p ? "Your answer ✓" : k ? "Correct" : "Your answer"}</span>` : ""}</div>`; }).join("")}</div>`;
      return `<article class="card rev ${ok ? "right" : "wrong"}"><div class="row spread"><span class="row" style="gap:8px"><span class="small muted">Q${i + 1} · ${q.obj} ${esc(OBJ[q.obj].name)}${flags.has(id) ? " · flagged" : ""}${hintsUsed.has(id) ? " · hint used" : ""}</span>${lvChip(q)}</span>
        <span class="verdict ${ok ? "v-good" : "v-bad"}">${ok ? "Correct" : C.answered(q, a) ? "Wrong" : "Unanswered"}</span></div>
        <p style="font-weight:600">${rich(q.q)}</p>${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ""}${body}
        <div class="ex">${rich(q.explanation)}</div>${ok ? `<div class="small">${reportLink(q)}</div>` : studyRef(q)}</article>`;
    };
    const weakRows = Object.keys(byObj).sort().filter(o => byObj[o][0] < byObj[o][1]);
    shell(null, `<div class="page-head"><span class="eyebrow">${esc(rec.label)} · ${fmtDate(rec.date)}</span><h1>${isTest ? "Exam results" : rec.mode === "review" ? "Review results" : "Study results"}</h1></div>
      <div class="card score">${ring(pct, 128, 12, pct + "%", "", col(pct))}
        <div class="stack grow" style="gap:8px;min-width:220px"><span class="row" style="gap:10px"><span class="verdict ${vclass(pct)}">${verdict}</span><code class="exitcode" style="color:${col(pct)}">$ echo $? → ${pct >= 80 ? 0 : 1}</code></span>
          <p style="font-size:1.1rem"><b>${rec.score} of ${rec.total}</b> correct in <span class="mono">${fmt(rec.secs)}</span></p>
          <p class="small muted">${isTest ? "LPI scores the real exam from 200 to 800, and 500 passes. LPI doesn't publish a percentage, so use 80% here as your target."
            : `Study sessions don't count toward readiness.${hintsUsed.size ? ` You used ${plural(hintsUsed.size, "hint")}.` : ""} Take an exam to measure yourself under test conditions.`}</p></div></div>
      <div class="row">${isTest ? `<button class="primary" data-start="test">Take another exam</button>`
          : rec.mode === "review" ? (C.deckStats(CARDS, st.cards).due ? `<button class="primary" data-start="duecards">Review ${plural(C.deckStats(CARDS, st.cards).due, "due flashcard")}</button>` : `<button class="primary" data-go="review">Back to daily review</button>`)
          : `<button class="primary" data-go="study">Study more</button>`}
        ${C.missedIds(BANK, st.qstats).length ? `<button data-start="missed">Study my misses</button>` : ""}${isTest ? "" : `<button data-start="test">Take an exam</button>`}<button class="ghost" data-go="progress">See progress</button></div>
      <div class="grid2">
        <div class="card stack"><h2>By topic</h2><div class="bars">${Object.keys(TOP).filter(t => byTopic[t]).map(t => { const [r, nn] = byTopic[t]; const p = Math.round(100 * r / nn);
          return `<div class="bar"><div class="lbl"><span>${t}. ${esc(TOP[t])}</span><b>${r}/${nn}</b></div><div class="track2"><i style="width:${p}%;background:${col(p)}"></i><span class="mark"></span></div></div>`; }).join("")}</div></div>
        <div class="card stack"><h2>Where to study next</h2>${weakRows.length ? `<div class="olist">${weakRows.map(o => `<div class="orow" style="grid-template-columns:auto minmax(0,1fr) auto auto"><span class="o">${o}</span>
          <span>${esc(OBJ[o].name)}<br><a class="small" href="${OBJ[o].lesson}" target="_blank" rel="noopener">Read the LPI lesson</a></span>
          <span class="pct" style="color:var(--bad)">${byObj[o][0]}/${byObj[o][1]}</span><button class="ghost small" data-study="${o}" style="padding:.4rem .6rem">Study</button></div>`).join("")}</div>`
          : `<p class="muted small">You got every objective right. ${icon("trophy")}</p>`}</div></div>
      <div class="card stack"><div class="row spread"><h2>By question difficulty</h2><span class="small muted">How you did on each kind of thinking</span></div>${levelBars(byLevel)}</div>
      <div class="stack" id="review"><div class="row spread"><h2>Answers</h2><div class="filters">
        <button data-f="wrong" class="${reviewFilter === "wrong" ? "on" : ""}">Missed (${wrongN})</button>
        <button data-f="all" class="${reviewFilter === "all" ? "on" : ""}">All ${rec.qids.length}</button>
        <button data-f="flag" class="${reviewFilter === "flag" ? "on" : ""}">Flagged (${flags.size})</button></div></div>
        ${list.length ? list.map(item).join("") : `<p class="muted small">Nothing here.</p>`}</div>`);
    wireStarts($("#page"));
    $$("[data-f]").forEach(b => b.onclick = () => { reviewFilter = b.dataset.f; const y = $("#review").offsetTop; renderResults(rec); scrollTo(0, y - 16); });
  }

  // ------------------------------------------------------------------ keyboard
  document.addEventListener("keydown", e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" && e.target.type !== "checkbox" && e.target.type !== "radio" || tag === "textarea" || tag === "select";
    const h = (location.hash || "#today").slice(1);
    if (h === "exam" && st.current && !typing) {
      const S = st.current;
      if (e.key === "ArrowRight" && S.cur < S.qids.length - 1) { S.cur++; save(); renderExam(); }
      else if (e.key === "ArrowLeft" && S.cur > 0) { S.cur--; save(); renderExam(); }
      else if (/^[1-5]$/.test(e.key)) pickByNumber(+e.key - 1);
      else if (e.key.toLowerCase() === "f") { const id = S.qids[S.cur]; S.flags[id] = !S.flags[id]; save(); renderExam(); }
      else if (e.key.toLowerCase() === "h") showHint(S, S.qids[S.cur]);
    } else if (h === "cards" && cs && cs.i < cs.queue.length && !typing) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); cs.flipped = !cs.flipped; renderCardSession(); }
      else if (cs.flipped && e.key === "1") gradeCard(false);
      else if (cs.flipped && e.key === "2") gradeCard(true);
      else if (e.key === "Escape") { cs.queue = cs.queue.slice(0, cs.i); renderCardSession(); }
    }
  });

  render();
  scheduleSync(0);
})();
