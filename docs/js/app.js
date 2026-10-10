// SPDX-License-Identifier: GPL-3.0-or-later
// exit 0 - free practice for LPI Linux Essentials 010-160. User interface. Logic lives in core.js.
(function () {
  "use strict";
  const C = window.LECore;
  const BANK = C.indexBank(window.LE_BANK);
  const CARDS = window.LE_CARDS;
  const OBJ = BANK.objectives, TOP = BANK.topics;
  const KEY = "le010.v3";
  const REPO = "https://github.com/krink192/exit0-linux-essentials";
  const app = document.getElementById("app");
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
  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ------------------------------------------------------------------ state
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  let st = (() => {
    const raw = readJSON(KEY);
    return C.migrate(raw, raw ? null : { history: readJSON("le010.v2.history"), qstats: readJSON("le010.v2.qstats") });
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked: keep working in memory */ } }

  function applyTheme() {
    const t = st.settings.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  applyTheme();

  let timerId = null, lastRec = null, reviewFilter = "wrong", showGrid = false, confirming = false;
  let deck = st.settings.deck || "concepts", cardTopic = "all", cardSize = 20, browse = false, query = "";
  let cs = null;            // active flashcard session
  let weakSize = 20, drillCount = 10, drillStudy = true, drillSel = new Set();
  let exportOpen = false, resetOpen = false;

  // ------------------------------------------------------------------ shell
  const NAV = [
    ["Study", [["test", "Practice test", "test"], ["weak", "Weak areas", "weak"], ["drill", "Objective drill", "drill"], ["cards", "Flashcards", "cards"]]],
    ["You", [["progress", "Progress", "progress"], ["guide", "Exam guide", "guide"], ["settings", "Settings", "settings"]]],
  ];
  function sidebarHTML(active) {
    const missed = C.missedIds(BANK, st.qstats).length;
    const due = C.deckStats(CARDS, st.cards).due;
    const sk = C.streak(st.days, st.settings.goal);
    const goalPct = Math.min(100, Math.round(100 * sk.today / st.settings.goal));
    const t = st.settings.theme;
    return `<aside class="side" id="side">
      <div class="brand"><div class="logo">$?</div><div><span class="wordmark">exit 0</span><small>Linux Essentials 010-160</small></div></div>
      ${NAV.map(([label, items]) => `<div class="nav-label">${label}</div><nav class="nav">${items.map(([id, name, ic]) => {
        const badge = id === "weak" && missed ? `<span class="count">${missed}</span>` : id === "cards" && due ? `<span class="count">${due}</span>` : "";
        return `<a href="#${id}" class="${active === id ? "on" : ""}" ${active === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${name}</span>${badge}</a>`;
      }).join("")}</nav>`).join("")}
      <div class="side-foot">
        <div class="today" title="Daily goal: ${st.settings.goal} questions or cards">
          ${ring(goalPct, 46, 5, `<span style="font-size:11px">${sk.today}</span>`, "", sk.metToday ? "var(--good)" : "var(--accent)")}
          <div><div class="t1">${icon("flame", "flame" + (sk.count ? "" : " cold"))}${sk.count ? plural(sk.count, "day") + " streak" : "No streak yet"}</div>
            <div class="t2">${sk.metToday ? "Today's goal done" : `${Math.max(0, st.settings.goal - sk.today)} to today's goal`}</div></div>
        </div>
        <div class="theme-row"><span class="small muted">Theme</span>
          <div class="seg" role="group" aria-label="Theme">${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, n]) =>
            `<button data-theme-set="${k}" class="${t === k ? "on" : ""}" title="${n}" aria-label="${n} theme">${icon(k === "system" ? "system" : k === "light" ? "sun" : "moon")}</button>`).join("")}</div></div>
      </div></aside>`;
  }
  function shell(active, body) {
    clearInterval(timerId);
    const sk = C.streak(st.days, st.settings.goal);
    app.innerHTML = `<div class="shell" id="shell">${sidebarHTML(active)}
      <div class="main"><header class="top"><button class="ghost" id="menuBtn" aria-label="Open menu">${icon("menu")}</button>
        <div class="brand"><div class="logo">$?</div><div><span class="wordmark">exit 0</span></div></div>
        <div class="streakmini">${icon("flame", "flame" + (sk.count ? "" : " cold"))}${sk.count}</div></header>
      <main class="page" id="page">${body}</main></div></div>`;
    $("#menuBtn").onclick = () => $("#shell").classList.toggle("open");
    $("#shell").addEventListener("click", e => { if (e.target.id === "shell") $("#shell").classList.remove("open"); });
    $$("[data-theme-set]").forEach(b => b.onclick = () => { st.settings.theme = b.dataset.themeSet; save(); applyTheme(); render(); });
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ router
  function go(h) { if (location.hash === "#" + h) render(); else location.hash = h; }
  function render() {
    const h = (location.hash || "#test").slice(1);
    if (h === "exam" && st.current) return renderExam();
    if (h === "exam") return go("test");
    if (h === "results" && lastRec) return renderResults(lastRec);
    const pages = { test: renderTest, progress: renderProgress, weak: renderWeak, drill: renderDrill, cards: renderCards,
                    guide: renderGuide, settings: renderSettings };
    (pages[h] || renderTest)();
  }
  window.addEventListener("hashchange", render);

  // ------------------------------------------------------------------ start sessions
  function begin(s) { st.current = s; confirming = false; showGrid = false; save(); go("exam"); }
  function startTest() { begin(C.buildTest(BANK, st.qstats, { timed: st.settings.timed, study: st.settings.reveal })); }
  function startWeak(n) { const s = C.buildWeak(BANK, st.qstats, n || weakSize); if (s) begin(s); }
  function startDrill(objs, n, study) { begin(C.buildDrill(BANK, st.qstats, objs, n, { study })); }
  function wireStarts(root) {
    $$("[data-start=test]", root).forEach(b => b.onclick = startTest);
    $$("[data-start=weak]", root).forEach(b => b.onclick = () => startWeak());
    $$("[data-drill]", root).forEach(b => b.onclick = () => startDrill([b.dataset.drill], 10, true));
    $$("[data-go]", root).forEach(b => b.onclick = () => go(b.dataset.go));
  }

  // ================================================================== PRACTICE TEST (home)
  function renderTest() {
    const tests = st.tests.filter(t => t.mode === "test");
    const last = tests[tests.length - 1];
    const ready = C.readiness(st.tests);
    const weak = C.weakObjectives(BANK, st.qstats, 1)[0];
    const os = C.objectiveStats(BANK, st.qstats);
    const cur = st.current;
    const resume = cur ? `<div class="card accent banner"><div><b>You have ${cur.mode === "test" ? "a practice test" : "a drill"} in progress</b>
        <div class="small muted">${cur.qids.filter(id => C.answered(BANK.byId[id], cur.answers[id])).length} of ${cur.qids.length} answered${cur.deadline ? " · " + fmt((cur.deadline - Date.now()) / 1000) + " left" : ""}</div></div>
        <div class="row"><button class="ghost" id="discard">Discard</button><button class="primary" id="resume">Resume</button></div></div>` : "";
    let next = "";
    if (last) {
      next = weak ? `<div class="card banner"><div class="grow"><div class="eyebrow" style="margin-bottom:6px">Suggested next step</div>
          <b>Drill ${esc(weak)} ${esc(OBJ[weak].name)}</b><div class="small muted">Your accuracy there is ${os[weak].pct}%. Ten focused questions with instant feedback.</div></div>
          <button data-drill="${weak}">Start drill</button></div>`
        : `<div class="card banner"><div class="grow"><div class="eyebrow" style="margin-bottom:6px">Suggested next step</div>
          <b>Review flashcards</b><div class="small muted">No weak objectives right now. Keep definitions fresh with a quick card session.</div></div>
          <button data-go="cards">Open flashcards</button></div>`;
    }
    const stats = last ? `<div class="grid4">
        <div class="card stat"><b style="color:${col(last.pct)}">${last.pct}%</b><span>Last test</span></div>
        <div class="card stat"><b>${Math.max(...tests.map(t => t.pct))}%</b><span>Best</span></div>
        <div class="card stat"><b style="color:${ready == null ? "var(--muted)" : col(ready)}">${ready == null ? "—" : ready + "%"}</b><span>Readiness</span></div>
        <div class="card stat"><b>${tests.length}</b><span>${tests.length === 1 ? "Test" : "Tests"} taken</span></div></div>` : "";
    const tips = last ? "" : `<div class="tips">
        <div class="tip"><div class="ic">${icon("terminal")}</div><div><b>Same format as the real exam</b><span>Single-answer, choose-two and fill-in questions. Type commands exactly, because case matters.</span></div></div>
        <div class="tip"><div class="ic">${icon("check")}</div><div><b>Every answer explained</b><span>After you submit, see why each option is right or wrong, with a link to LPI's free lesson.</span></div></div>
        <div class="tip"><div class="ic">${icon("weak")}</div><div><b>Practice what you miss</b><span>Weak areas, objective drills and flashcards target exactly what you need.</span></div></div></div>`;
    shell("test", `${resume}
      <section class="hero">
        <div class="page-head"><span class="eyebrow">exit 0 · LPI Linux Essentials 010-160</span><h1>Practice test</h1>
          <p class="lead">40 questions in 60 minutes, drawn fresh from ${BANK.questions.length} questions with exactly as many questions per objective as the real exam.</p></div>
        <div class="cta"><button class="primary big" data-start="test">${icon("test")}Run test</button>
          <label class="switch"><input type="checkbox" id="timed" ${st.settings.timed ? "checked" : ""}> Timed (60 min)</label>
          <label class="switch" title="Off matches the real exam: answers stay hidden until you submit."><input type="checkbox" id="reveal" ${st.settings.reveal ? "checked" : ""}> Show answers as I go</label></div>
        ${st.settings.reveal ? `<p class="small muted">Check each answer as you go, with the explanation shown right away. These tests don't count toward your readiness score. Turn this off to practice under exam conditions.</p>` : ""}
      </section>
      ${stats}${next}${tips}`);
    $("#timed").onchange = e => { st.settings.timed = e.target.checked; save(); };
    $("#reveal").onchange = e => { st.settings.reveal = e.target.checked; save(); renderTest(); };
    if (cur) { $("#resume").onclick = () => go("exam"); $("#discard").onclick = () => { st.current = null; save(); render(); }; }
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
        if (opts.select) return `<label class="orow" for="sel${o}"><input type="checkbox" id="sel${o}" data-obj="${o}" ${drillSel.has(o) ? "checked" : ""}>
            <span class="o">${o}</span><span>${esc(OBJ[o].name)} <span class="small muted">· ${s.total} Qs</span></span><span class="chip lv-${s.level}">${LV[s.level]}</span></label>`;
        return `<div class="orow"><span class="o">${o}</span><span>${esc(OBJ[o].name)}</span>
            <span class="row" style="gap:12px"><span class="chip lv-${s.level} hide-sm">${LV[s.level]}</span><span class="pct" style="color:${s.pct == null ? "var(--muted)" : col(s.pct)}">${pct}</span></span>
            <button class="ghost small" data-drill="${o}" style="padding:.4rem .6rem">Drill</button></div>`;
      }).join("")).join("")}</div>`;
  }
  function renderProgress() {
    const tests = st.tests.filter(t => t.mode === "test");
    if (!st.tests.length) {
      shell("progress", `<div class="page-head"><h1>Progress</h1><p class="lead">Your scores, readiness and weak sections show up here after your first test.</p></div>
        <div class="card empty">${icon("progress")}<b>No results yet</b><p class="muted small">Take a practice test to see where you stand.</p><button class="primary" data-start="test">Run test</button></div>`);
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
    const status = ready == null ? "Finish a full practice test to get a readiness score."
      : ready >= 80 ? "You're in the ready range. Keep it there across three tests, then book the exam."
      : ready >= 65 ? "Close. Focus on your weak sections and aim for 80% three tests in a row."
      : "Keep building. Drill your weak sections, review flashcards, then retest.";
    shell("progress", `<div class="page-head"><h1>Progress</h1><p class="lead">How you're doing across every exam objective.</p></div>
      <div class="card row" style="gap:28px;align-items:center">
        ${ring(ready || 0, 132, 12, ready == null ? "—" : ready + "%", "Readiness", ready == null ? "var(--line)" : col(ready))}
        <div class="stack grow" style="gap:14px;min-width:240px"><p>${status}</p>
          <div class="grid4" style="gap:10px">
            <div class="stat"><b>${tests.length}</b><span>Tests</span></div>
            <div class="stat"><b>${tests.length ? Math.max(...tests.map(t => t.pct)) + "%" : "—"}</b><span>Best</span></div>
            <div class="stat"><b>${seen}<span class="muted" style="font-size:.9rem">/${BANK.questions.length}</span></b><span>Questions seen</span></div>
            <div class="stat"><b>${mastered}<span class="muted" style="font-size:.9rem">/19</span></b><span>Objectives mastered</span></div></div></div></div>
      ${tests.length >= 2 ? `<div class="card stack"><div class="row spread"><h2>Score trend</h2><span class="small muted">Last ${Math.min(15, tests.length)} practice tests</span></div>${trendChart(tests)}</div>` : ""}
      <div class="grid2">
        <div class="card stack"><h2>Troubled sections</h2>${weak.length ? `<div class="bars">${weak.map(o => `<div class="bar"><div class="lbl"><span><span class="mono muted">${o}</span> ${esc(OBJ[o].name)}</span><b>${os[o].pct}%</b></div>
            <div class="track2"><i style="width:${os[o].pct}%;background:${col(os[o].pct)}"></i><span class="mark"></span></div></div>`).join("")}</div>
            <button data-start="weak">Practice weak areas</button>` : `<p class="muted small">Nothing below 80% with enough answers yet. Nice.</p>`}</div>
        <div class="card stack"><h2>By topic</h2><div class="bars">${Object.keys(TOP).map(t => { const [r, n] = tAcc[t]; const p = n ? Math.round(100 * r / n) : 0;
            return `<div class="bar"><div class="lbl"><span>${t}. ${esc(TOP[t])}</span><b>${n ? p + "%" : "—"}</b></div><div class="track2"><i style="width:${p}%;background:${col(p)}"></i><span class="mark"></span></div></div>`; }).join("")}</div></div>
      </div>
      <div class="card stack"><div class="row spread"><h2>By question difficulty</h2><a href="#guide" class="small">What do these mean?</a></div>${levelBars(C.levelStats(BANK, st.qstats))}
        <p class="small muted">The real exam leans on exact syntax and reading commands. If Apply or Analyze trails Recall, drill commands and use the Commands &amp; files flashcards.</p></div>
      <div class="card stack"><div class="row spread"><h2>Objective mastery</h2><span class="small muted">${ds.mastered}/${ds.total} flashcards mastered</span></div>${objList(os)}</div>
      <div class="stack"><h2>History</h2><div class="tablewrap"><table class="table"><thead><tr><th>Date</th><th>Session</th><th style="text-align:right">Score</th><th style="text-align:right">Time</th><th></th></tr></thead><tbody>
        ${st.tests.slice().reverse().slice(0, 25).map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.label)}</td>
          <td class="n" style="color:${col(t.pct)}">${t.score}/${t.total} · ${t.pct}%</td><td class="n">${fmt(t.secs)}</td>
          <td style="text-align:right">${t.qids ? `<button class="ghost small" data-review="${t.id}" style="padding:.4rem .6rem">Review</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div></div>`);
    wireStarts($("#page"));
    $$("[data-review]").forEach(b => b.onclick = () => { lastRec = st.tests.find(t => t.id === b.dataset.review); reviewFilter = "all"; go("results"); });
  }

  // ================================================================== WEAK AREAS
  function renderWeak() {
    const missed = C.missedIds(BANK, st.qstats).length;
    const weak = C.weakObjectives(BANK, st.qstats, 6);
    const os = C.objectiveStats(BANK, st.qstats);
    const head = `<div class="page-head"><h1>Weak areas</h1><p class="lead">Replays the questions you got wrong most recently, then fills up with questions from your weakest objectives. You see the answer and explanation after each one.</p></div>`;
    if (!missed && !weak.length) {
      shell("weak", head + `<div class="card empty">${icon("weak")}<b>${Object.keys(st.qstats).length ? "No weak areas right now" : "Nothing to review yet"}</b>
        <p class="muted small">${Object.keys(st.qstats).length ? "You've answered your recent questions correctly. Run a test to find new gaps." : "Take a practice test first, and your misses will appear here."}</p>
        <button class="primary" data-start="test">Run test</button></div>`);
      return wireStarts($("#page"));
    }
    shell("weak", head + `<div class="grid2">
        <div class="card stat"><b style="color:var(--bad)">${missed}</b><span>Questions missed last time you saw them</span></div>
        <div class="card stat"><b>${weak.length}</b><span>Objectives below 80%</span></div></div>
      ${weak.length ? `<div class="card stack"><h2>Weakest objectives</h2><div class="bars">${weak.map(o => `<div class="bar"><div class="lbl"><span><span class="mono muted">${o}</span> ${esc(OBJ[o].name)}</span><b>${os[o].pct}% · ${os[o].seen} answers</b></div>
          <div class="track2"><i style="width:${os[o].pct}%;background:${col(os[o].pct)}"></i><span class="mark"></span></div></div>`).join("")}</div></div>` : ""}
      <div class="card row spread"><div class="row"><span class="muted small">Questions</span><div class="seg" id="wsize">${[10, 20, 30].map(n => `<button data-n="${n}" class="${weakSize === n ? "on" : ""}">${n}</button>`).join("")}</div></div>
        <button class="primary" id="wstart">Start weak-area drill</button></div>`);
    $$("#wsize button").forEach(b => b.onclick = () => { weakSize = +b.dataset.n; renderWeak(); });
    $("#wstart").onclick = () => startWeak(weakSize);
  }

  // ================================================================== OBJECTIVE DRILL
  function renderDrill() {
    const os = C.objectiveStats(BANK, st.qstats);
    const n = drillSel.size;
    const avail = [...drillSel].reduce((a, o) => a + OBJ[o].weight * 6, 0);
    shell("drill", `<div class="page-head"><h1>Objective drill</h1><p class="lead">Pick one or more exam objectives and practice only those. Questions you haven't seen come first.</p></div>
      <div class="card stack" style="gap:6px"><div class="row spread"><b>${n ? plural(n, "objective") + " selected · " + avail + " questions available" : "Select objectives"}</b>
        <div class="row"><button class="ghost small" id="selWeak">Select weak</button><button class="ghost small" id="selAll">All</button><button class="ghost small" id="selNone">Clear</button></div></div>
        ${objList(os, { select: true })}</div>
      <div class="card row spread" style="position:sticky;bottom:12px;box-shadow:var(--shadow)">
        <div class="row" style="gap:18px"><div class="row"><span class="muted small">Questions</span><select id="dcount">${[5, 10, 20, 40, 0].map(v => `<option value="${v}" ${drillCount === v ? "selected" : ""}>${v || "All"}</option>`).join("")}</select></div>
          <label class="switch"><input type="checkbox" id="dstudy" ${drillStudy ? "checked" : ""}> Show answers as I go</label></div>
        <button class="primary" id="dstart" ${n ? "" : "disabled"}>Start drill</button></div>`);
    $$("[data-obj]").forEach(i => i.onchange = () => { i.checked ? drillSel.add(i.dataset.obj) : drillSel.delete(i.dataset.obj); const y = scrollY; renderDrill(); scrollTo(0, y); });
    $("#selAll").onclick = () => { Object.keys(OBJ).forEach(o => drillSel.add(o)); renderDrill(); };
    $("#selNone").onclick = () => { drillSel.clear(); renderDrill(); };
    $("#selWeak").onclick = () => { drillSel = new Set(C.weakObjectives(BANK, st.qstats, 19)); if (!drillSel.size) toast("No weak objectives yet"); renderDrill(); };
    $("#dcount").onchange = e => drillCount = +e.target.value;
    $("#dstudy").onchange = e => drillStudy = e.target.checked;
    $("#dstart").onclick = () => startDrill([...drillSel].sort(), drillCount, drillStudy);
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
    C.reviewCard(st.cards, c.id, knew, C.dayNum());
    C.addActivity(st, 1); save();
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
      <div class="stack"><h2>Exam blueprint</h2><p class="muted small">An objective's weight equals its number of questions. Every practice test in this app follows this table.</p>
        <div class="tablewrap"><table class="table"><thead><tr><th>Obj.</th><th>Objective</th><th style="text-align:right">Questions</th><th>Study</th></tr></thead><tbody>${bp}
        <tr class="topic"><td colspan="2">Total</td><td class="n">40</td><td></td></tr></tbody></table></div></div>
      <div class="card stack guide" id="difficulty"><h2>How hard is the real exam?</h2>
        <p>LPI sets the pass mark for a "minimally qualified candidate": someone with basic Linux knowledge who is most likely the end user of a mostly managed system and can work on the command line. LPI doesn't publish difficulty data. Candidates and trainers mostly describe the challenge as breadth plus exact recall: precise command options, permission notation, package tools and directory names.</p>
        <p>Every question in this app is tagged by the kind of thinking it needs:</p>
        <ul>${[1, 2, 3].map(lv => `<li><b>${C.LEVELS[lv][0]}</b>: ${C.LEVELS[lv][1].toLowerCase()}. ${C.levelMix(BANK)[lv]} questions in the bank.</li>`).join("")}</ul>
        <p class="small muted">The tags are a guide, not an official rating. Your Progress page shows your accuracy at each level. Strong Apply and Analyze scores are the best sign that you're ready for exact-syntax questions on the real exam.</p></div>
      <div class="grid2">
        <div class="card stack guide"><h2>A study plan that works</h2><ol>
          <li>Run a practice test cold to get a baseline.</li><li>Drill your weak areas with answers shown.</li>
          <li>Do a short flashcard session every day to keep your streak going.</li><li>Retest. Book the exam when your readiness stays at 80% or higher.</li></ol></div>
        <div class="card stack guide"><h2>Test-day tips</h2><ul>
          <li>Answer every question, because a blank can't score.</li><li>Flag hard questions and come back. Don't let one question eat your time.</li>
          <li>For fill-ins, check whether they ask for the command name only or the full command.</li><li>About 90 seconds per question is your pace.</li></ul></div></div>
      <div class="card stack guide"><h2>Official sources</h2><ul>
        <li><a href="https://www.lpi.org/our-certifications/linux-essentials-overview/" target="_blank" rel="noopener">Linux Essentials overview</a></li>
        <li><a href="https://www.lpi.org/our-certifications/exam-010-objectives/" target="_blank" rel="noopener">Exam 010 objectives (v1.6)</a></li>
        <li><a href="https://www.lpi.org/about-lpi/frequently-asked-questions/" target="_blank" rel="noopener">LPI FAQ: scoring, delivery and results</a></li>
        <li><a href="https://learning.lpi.org/en/learning-materials/010-160/" target="_blank" rel="noopener">Free LPI learning materials</a></li></ul></div>`);
  }

  // ================================================================== SETTINGS
  function renderSettings() {
    const s = st.settings;
    const data = exportOpen ? JSON.stringify({ app: "le010", v: 3, tests: st.tests, qstats: st.qstats, cards: st.cards, days: st.days, settings: st.settings }) : "";
    shell("settings", `<div class="page-head"><h1>Settings</h1></div>
      <div class="card stack"><h2>Appearance</h2><div class="row spread"><span>Theme</span>
        <div class="seg" id="theme">${[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, n]) => `<button data-v="${k}" class="${s.theme === k ? "on" : ""}">${n}</button>`).join("")}</div></div></div>
      <div class="card stack"><h2>Practice</h2>
        <div class="row spread"><span>Time practice tests (60 minutes)</span><label class="switch"><input type="checkbox" id="stimed" ${s.timed ? "checked" : ""}> <span class="sr">Timed</span></label></div>
        <div class="row spread"><div><div>Show answers as I go</div><div class="small muted">See the correct answer and explanation after each question. Off matches the real exam, with answers hidden until you submit. Tests with answers shown don't count toward readiness.</div></div>
          <label class="switch"><input type="checkbox" id="sreveal" ${s.reveal ? "checked" : ""}> <span class="sr">Show answers</span></label></div>
        <div class="row spread"><div><div>Daily goal</div><div class="small muted">Questions answered plus flashcards reviewed. Meeting it keeps your streak.</div></div>
          <div class="seg" id="goal">${[10, 20, 40, 60].map(n => `<button data-v="${n}" class="${s.goal === n ? "on" : ""}">${n}</button>`).join("")}</div></div></div>
      ${window.pywebview || /exit0-desktop/.test(navigator.userAgent) ? "" : `<div class="card stack"><div><h2>Desktop app</h2><p class="small muted">The same app in its own window. It works offline and saves progress on your computer.</p></div>
        <div class="row"><a class="btn primary" href="${REPO}/releases/latest/download/Exit0.exe" target="_blank" rel="noopener">Windows (.exe)</a>
          <a class="btn" href="${REPO}/releases/latest/download/exit0.rpm" target="_blank" rel="noopener">Fedora (.rpm)</a>
          <a class="btn" href="${REPO}/releases/latest/download/exit0.deb" target="_blank" rel="noopener">Ubuntu / Debian (.deb)</a></div></div>`}
      <div class="card stack"><h2>Your data</h2><p class="small muted">Progress is saved in this browser only. To move it to another device, copy the export code there and paste it under Import.</p>
        <div class="row"><button id="exp">${exportOpen ? "Hide export code" : "Show export code"}</button></div>
        ${exportOpen ? `<textarea id="expData" readonly aria-label="Export code">${esc(data)}</textarea><div class="row"><button class="primary" id="copy">Copy</button></div>` : ""}
        <label class="small muted" for="impData">Import from another device</label><textarea id="impData" placeholder="Paste an export code here"></textarea>
        <div class="row"><button id="imp">Import</button></div></div>
      <div class="card stack"><h2>Reset</h2><p class="small muted">Deletes tests, question history, flashcard progress and streak. Settings are kept.</p>
        ${resetOpen ? `<div class="row card confirm spread"><span>Delete all progress? This can't be undone.</span><span class="row"><button id="rno">Cancel</button><button class="primary" id="ryes">Delete</button></span></div>`
          : `<div class="row"><button id="reset">Reset all progress</button></div>`}</div>
      <p class="small muted"><b class="wordmark">exit 0</b> · Free practice for LPI Linux Essentials 010-160 · Free and open source under the GNU GPL v3 · <a href="${REPO}" target="_blank" rel="noopener">Source code</a><br>
        Original practice material based on LPI's published objectives. Not affiliated with or endorsed by the Linux Professional Institute.</p>`);
    $$("#theme button").forEach(b => b.onclick = () => { s.theme = b.dataset.v; save(); applyTheme(); renderSettings(); });
    $$("#goal button").forEach(b => b.onclick = () => { s.goal = +b.dataset.v; save(); renderSettings(); });
    $("#stimed").onchange = e => { s.timed = e.target.checked; save(); };
    $("#sreveal").onchange = e => { s.reveal = e.target.checked; save(); };
    $("#exp").onclick = () => { exportOpen = !exportOpen; renderSettings(); };
    if ($("#copy")) $("#copy").onclick = () => {
      const ta = $("#expData");
      const done = () => toast("Copied");
      try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); toast("Selected. Press Ctrl+C to copy"); }); }
      catch (e) { ta.select(); toast("Selected. Press Ctrl+C to copy"); }
    };
    $("#imp").onclick = () => {
      try {
        const d = JSON.parse($("#impData").value);
        if (d.app !== "le010" || !Array.isArray(d.tests)) throw new Error("bad");
        Object.assign(st, { tests: d.tests, qstats: d.qstats || {}, cards: d.cards || {}, days: d.days || {} });
        if (d.settings) st.settings = Object.assign(st.settings, d.settings);
        save(); applyTheme(); toast("Progress imported"); renderSettings();
      } catch (e) { toast("That code isn't valid. Copy the whole export code and try again."); }
    };
    if ($("#reset")) $("#reset").onclick = () => { resetOpen = true; renderSettings(); };
    if ($("#rno")) { $("#rno").onclick = () => { resetOpen = false; renderSettings(); };
      $("#ryes").onclick = () => { const keep = st.settings; st = C.freshState(); st.settings = keep; resetOpen = false; save(); toast("Progress reset"); renderSettings(); }; }
  }

  // ================================================================== EXAM
  function renderExam() {
    clearInterval(timerId);
    const S = st.current, n = S.qids.length, id = S.qids[S.cur], q = BANK.byId[id], a = S.answers[id];
    const done = S.qids.filter(i => C.answered(BANK.byId[i], S.answers[i])).length;
    const flagged = Object.values(S.flags).filter(Boolean).length;
    const revealed = S.study && S.checked[id];
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
          <span class="key">${L[pos]}</span><span class="t">${rich(q.options[oi])}</span>${tag ? `<span class="tag">${tag}</span>` : ""}</label>`;
      }).join("")}</div>${multi && !revealed ? `<p class="small muted">Select ${q.answer.length}. ${Array.isArray(a) ? a.length : 0} selected.</p>` : ""}`;
    }
    const ok = revealed && C.isCorrect(q, a);
    const fb = revealed ? `<div class="feedback ${ok ? "ok" : "no"}"><h3>${ok ? "Correct" : C.answered(q, a) ? "Not quite" : "Not answered"}</h3>
        ${q.type === "fill" ? `<div class="mono small">Accepted: ${q.accept.map(x => `<code>${esc(x)}</code>`).join(" · ")}</div>` : ""}
        <div>${rich(q.explanation)}</div><a class="small" href="${OBJ[q.obj].lesson}" target="_blank" rel="noopener">LPI lesson ${q.obj}: ${esc(OBJ[q.obj].name)}</a></div>` : "";
    const typeTag = q.type === "fill" ? "Type your answer" : q.type === "multi" ? "Choose " + (q.answer.length === 2 ? "two" : "three") : "Choose one";
    app.innerHTML = `<div class="exam-bar"><div class="in">
        <span class="title">${esc(S.label)}</span><span class="small muted mono hide-sm" id="cnt">${done}/${n} answered</span>
        <span class="grow"></span>
        <span class="timer" id="timer">${S.deadline ? fmt((S.deadline - Date.now()) / 1000) : fmt((Date.now() - S.start) / 1000)}</span>
        <button class="ghost" id="exit" title="Progress is kept. Resume from the Practice test page.">Save &amp; exit</button>
        <button class="ghost hide-sm" id="gridBtn" aria-expanded="${showGrid}">${showGrid ? "Hide" : "All"} questions</button>
        <button class="primary" id="submit">${isTest ? "Submit" : "Finish"}</button></div>
      <div class="progress"><i style="width:${100 * done / n}%"></i></div></div>
      <main class="page" style="gap:20px">
        ${confirming ? `<div class="card confirm stack" style="gap:10px"><h3>${isTest ? "Submit your test?" : "Finish this drill?"}</h3>
          <p>${n - done ? `<b>${n - done}</b> unanswered ${n - done === 1 ? "question counts" : "questions count"} as wrong. ` : "All questions answered. "}${flagged ? `<b>${flagged}</b> flagged.` : ""}</p>
          <div class="row"><button id="keep">Keep working</button><button class="primary" id="doSubmit">${isTest ? "Submit and see results" : "Finish and see results"}</button></div></div>` : ""}
        ${showGrid ? `<div class="card"><div class="qgrid">${S.qids.map((qid, i) => { let c = C.answered(BANK.byId[qid], S.answers[qid]) ? "ans" : "";
            if (S.study && S.checked[qid]) c = C.isCorrect(BANK.byId[qid], S.answers[qid]) ? "ok" : "no";
            return `<button data-jump="${i}" class="${c}${S.flags[qid] ? " fl" : ""}${i === S.cur ? " cur" : ""}" aria-label="Question ${i + 1}">${i + 1}</button>`; }).join("")}</div></div>` : ""}
        <div class="qhead"><span class="qnum">Question <b>${S.cur + 1}</b> of ${n}</span><span class="row" style="gap:8px">${S.study ? lvChip(q) : ""}<span class="eyebrow">${typeTag}${S.study ? " · " + q.obj : ""}</span></span></div>
        <p class="qtext">${rich(q.q)}</p>
        ${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ""}
        ${body}${fb}
        <div class="nav-row"><button id="prev" ${S.cur === 0 ? "disabled" : ""}>Previous</button>
          <span class="row"><button id="flag" class="${S.flags[id] ? "flagged" : "ghost"}" aria-pressed="${!!S.flags[id]}">${icon("flag")}${S.flags[id] ? "Flagged" : "Flag"}</button>
          ${S.study && !revealed ? `<button id="check">Check answer</button>` : ""}
          ${S.cur < n - 1 ? `<button class="primary" id="next">Next</button>` : `<button class="primary" id="end">${isTest ? "Review & submit" : "Finish"}</button>`}</span></div>
        <p class="small muted hide-sm"><span class="kbd">←</span> <span class="kbd">→</span> move · <span class="kbd">1</span>–<span class="kbd">5</span> choose · <span class="kbd">F</span> flag</p>
      </main>`;
    const move = i => { S.cur = Math.max(0, Math.min(n - 1, i)); save(); renderExam(); scrollTo(0, 0); };
    $("#prev").onclick = () => move(S.cur - 1);
    if ($("#next")) $("#next").onclick = () => move(S.cur + 1);
    if ($("#end")) $("#end").onclick = () => { confirming = true; renderExam(); scrollTo(0, 0); };
    if ($("#check")) $("#check").onclick = () => { S.checked[id] = 1; save(); renderExam(); };
    $("#flag").onclick = () => { S.flags[id] = !S.flags[id]; save(); renderExam(); };
    $("#gridBtn").onclick = () => { showGrid = !showGrid; renderExam(); };
    $("#submit").onclick = () => { confirming = true; renderExam(); scrollTo(0, 0); };
    $("#exit").onclick = () => { save(); go("test"); };
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
    const S = st.current; const res = C.grade(BANK, S);
    lastRec = C.recordResult(st, BANK, S, res);
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
    const flags = new Set(rec.flags || []);
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
        return `<div class="ropt ${k ? "correct" : p ? "picked" : ""}"><span class="k2">${L[pos]}</span><span>${rich(q.options[oi])}</span>${k || p ? `<span class="why">${k && p ? "Your answer ✓" : k ? "Correct" : "Your answer"}</span>` : ""}</div>`; }).join("")}</div>`;
      return `<article class="card rev ${ok ? "right" : "wrong"}"><div class="row spread"><span class="row" style="gap:8px"><span class="small muted">Q${i + 1} · ${q.obj} ${esc(OBJ[q.obj].name)}${flags.has(id) ? " · flagged" : ""}</span>${lvChip(q)}</span>
        <span class="verdict ${ok ? "v-good" : "v-bad"}">${ok ? "Correct" : C.answered(q, a) ? "Wrong" : "Unanswered"}</span></div>
        <p style="font-weight:600">${rich(q.q)}</p>${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ""}${body}
        <div class="ex">${rich(q.explanation)} <a href="${OBJ[q.obj].lesson}" target="_blank" rel="noopener">LPI lesson ${q.obj}</a></div></article>`;
    };
    const weakRows = Object.keys(byObj).sort().filter(o => byObj[o][0] < byObj[o][1]);
    shell(null, `<div class="page-head"><span class="eyebrow">${esc(rec.label)} · ${fmtDate(rec.date)}</span><h1>${isTest ? "Test results" : "Drill results"}</h1></div>
      <div class="card score">${ring(pct, 128, 12, pct + "%", "", col(pct))}
        <div class="stack grow" style="gap:8px;min-width:220px"><span class="row" style="gap:10px"><span class="verdict ${vclass(pct)}">${verdict}</span><code class="exitcode" style="color:${col(pct)}">$ echo $? → ${pct >= 80 ? 0 : 1}</code></span>
          <p style="font-size:1.1rem"><b>${rec.score} of ${rec.total}</b> correct in <span class="mono">${fmt(rec.secs)}</span></p>
          <p class="small muted">LPI scores the real exam from 200 to 800, and 500 passes. LPI doesn't publish a percentage, so use 80% here as your target.</p></div></div>
      <div class="row"><button class="primary" data-start="test">Run another test</button>${C.missedIds(BANK, st.qstats).length ? `<button data-start="weak">Review weak areas</button>` : ""}<button class="ghost" data-go="progress">See progress</button></div>
      <div class="grid2">
        <div class="card stack"><h2>By topic</h2><div class="bars">${Object.keys(TOP).filter(t => byTopic[t]).map(t => { const [r, nn] = byTopic[t]; const p = Math.round(100 * r / nn);
          return `<div class="bar"><div class="lbl"><span>${t}. ${esc(TOP[t])}</span><b>${r}/${nn}</b></div><div class="track2"><i style="width:${p}%;background:${col(p)}"></i><span class="mark"></span></div></div>`; }).join("")}</div></div>
        <div class="card stack"><h2>Objectives to study</h2>${weakRows.length ? `<div class="olist">${weakRows.map(o => `<div class="orow" style="grid-template-columns:auto minmax(0,1fr) auto auto"><span class="o">${o}</span><span>${esc(OBJ[o].name)}</span>
          <span class="pct" style="color:var(--bad)">${byObj[o][0]}/${byObj[o][1]}</span><button class="ghost small" data-drill="${o}" style="padding:.4rem .6rem">Drill</button></div>`).join("")}</div>`
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
    const h = (location.hash || "#test").slice(1);
    if (h === "exam" && st.current && !typing) {
      const S = st.current;
      if (e.key === "ArrowRight" && S.cur < S.qids.length - 1) { S.cur++; save(); renderExam(); }
      else if (e.key === "ArrowLeft" && S.cur > 0) { S.cur--; save(); renderExam(); }
      else if (/^[1-5]$/.test(e.key)) pickByNumber(+e.key - 1);
      else if (e.key.toLowerCase() === "f") { const id = S.qids[S.cur]; S.flags[id] = !S.flags[id]; save(); renderExam(); }
    } else if (h === "cards" && cs && cs.i < cs.queue.length && !typing) {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); cs.flipped = !cs.flipped; renderCardSession(); }
      else if (cs.flipped && e.key === "1") gradeCard(false);
      else if (cs.flipped && e.key === "2") gradeCard(true);
      else if (e.key === "Escape") { cs.queue = cs.queue.slice(0, cs.i); renderCardSession(); }
    }
  });

  render();
})();
