// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure logic for the Linux Essentials practice app: no DOM access here,
// so it runs in the browser (window.LECore) and in Node tests (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LECore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EXAM_SECONDS = 3600;
  const TARGET = 80;
  const BOX_DAYS = [0, 1, 2, 4, 8, 16];   // Leitner intervals for flashcards

  // ------------------------------------------------------------- utilities
  function rng(seed) {                     // small seeded PRNG (mulberry32)
    if (seed == null) return Math.random;
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    const a = arr.slice(); rand = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const norm = s => String(s == null ? "" : s).trim().replace(/\s+/g, " ");
  function dayKey(d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dayNum(d) {                     // whole local days since epoch
    d = d ? new Date(d) : new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  }

  // ------------------------------------------------------------- bank index
  function indexBank(bank) {
    const byId = {}, byObj = {};
    for (const q of bank.questions) { byId[q.id] = q; (byObj[q.obj] = byObj[q.obj] || []).push(q.id); }
    return Object.assign({}, bank, { byId, byObj });
  }
  const topicOf = o => o.split(".")[0];

  // ------------------------------------------------------------- grading
  /** A wrong fill answer that would be right without a leading `sudo`: shown as "drop sudo", still marked wrong. */
  function extraSudo(q, a) {
    if (!q || q.type !== "fill" || a == null || isCorrect(q, a)) return false;
    const n = norm(a); if (!/^sudo /.test(n)) return false;
    return q.accept.some(x => norm(x) === n.slice(5));
  }
  function answered(q, a) { return q.type === "fill" ? norm(a) !== "" : Array.isArray(a) && a.length > 0; }
  // Type-the-command questions with a `lab` block ({ setup, check }) are also graded by running the answer in the lab
  // shell (shell.js) on a fresh simulated machine: any command that leaves the machine in the checked state counts,
  // not only the spellings in `accept`. Without the shell loaded, grading falls back to the accepted list.
  let shellLib = null;
  function labShell() {
    if (shellLib) return shellLib;
    const g = typeof globalThis !== "undefined" ? globalThis : self;
    if (g.LEShell) return (shellLib = g.LEShell);
    if (typeof require === "function") { try { return (shellLib = require("./shell.js")); } catch (e) { /* not bundled here */ } }
    return null;
  }
  const labCache = new Map();
  /** Run a typed answer for a lab-checked question. Returns { ok, out, code }, or null when the shell isn't available. */
  function runLab(q, a) {
    if (!q || !q.lab || norm(a) === "") return null;
    const key = q.id + "\u0000" + String(a).trim();
    if (labCache.has(key)) return labCache.get(key);
    const S = labShell(); if (!S) return null;
    const sh = S.createMachine({ setup: q.lab.setup || {} });
    let r;
    try { r = sh.exec(String(a).trim(), { noIncomplete: true, tty: false }); } catch (e) { r = { out: "error: " + (e && e.message || e) + "\n", code: 1 }; }
    const res = { ok: !!sh.check(q.lab.check), out: r.out || "", code: r.code };
    if (labCache.size > 500) labCache.clear();
    labCache.set(key, res);
    return res;
  }
  function isCorrect(q, a) {
    if (q.type === "fill") { if (a == null) return false; if (q.accept.some(x => norm(x) === norm(a))) return true; const r = runLab(q, a); return !!(r && r.ok); }
    if (!Array.isArray(a)) return false;
    return a.slice().sort().join() === q.answer.slice().sort().join();
  }

  // ------------------------------------------------------------- selection
  // lower = picked first: unseen, then missed last time, then by accuracy
  function priority(qstats, id) {
    const s = qstats[id];
    if (!s || !s.seen) return 0;
    if (s.last === false) return 1 + s.right / s.seen;
    return 3 + s.right / s.seen;
  }
  function pickBy(ids, qstats, n, rand) {
    const tagged = shuffle(ids, rand).map(id => ({ id, p: Math.floor(priority(qstats, id)) }));
    tagged.sort((x, y) => x.p - y.p);
    return tagged.slice(0, n).map(t => t.id);
  }

  function newSession(bank, mode, label, qids, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    const optOrder = {};
    for (const id of qids) {
      const q = bank.byId[id];
      if (q.type !== "fill") optOrder[id] = shuffle(q.options.map((_, i) => i), rand);
    }
    const now = opts.now || Date.now();
    return { mode, label, qids, optOrder, answers: {}, flags: {}, checked: {}, hints: {}, cur: 0, study: !!opts.study,
             timed: !!opts.timed, start: now, deadline: opts.timed ? now + (opts.seconds || EXAM_SECONDS) * 1000 : null };
  }

  /** Exam mode: 40 questions with exactly `weight` questions from every objective, timed, answers hidden. */
  function buildTest(bank, qstats, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    let ids = [];
    for (const o of Object.keys(bank.objectives)) ids = ids.concat(pickBy(bank.byObj[o], qstats || {}, bank.objectives[o].weight, rand));
    const label = opts.study ? "Practice test · answers shown" : "Exam";
    return newSession(bank, "test", label, shuffle(ids, rand), { timed: opts.timed !== false, study: !!opts.study, seed: opts.seed, now: opts.now });
  }

  function buildDrill(bank, qstats, objs, count, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    const pool = [].concat(...objs.map(o => bank.byObj[o] || []));
    const ids = pickBy(pool, qstats || {}, count || pool.length, rand);
    const label = objs.length === 1 ? "Drill · " + objs[0] + " " + bank.objectives[objs[0]].name
      : "Drill · " + objs.length + " objectives";
    return newSession(bank, "drill", label, shuffle(ids, rand), { study: opts.study !== false, seed: opts.seed });
  }

  /** Study mode filters. objs/levels empty = all. source: "mix" (everything), "unseen" or "missed". */
  function studyPool(bank, qstats, f) {
    f = f || {}; qstats = qstats || {};
    const objs = f.objs && f.objs.length ? f.objs : Object.keys(bank.objectives);
    const levels = f.levels && f.levels.length ? f.levels : [1, 2, 3];
    let ids = [].concat(...objs.map(o => bank.byObj[o] || [])).filter(id => levels.indexOf(bank.byId[id].level || 1) >= 0);
    if (f.ids) { const want = new Set(f.ids); ids = ids.filter(id => want.has(id)); }
    if (f.source === "missed") ids = ids.filter(id => qstats[id] && qstats[id].last === false);
    else if (f.source === "unseen") ids = ids.filter(id => !qstats[id] || !qstats[id].seen);
    return ids;
  }
  /** Study session: answers, hints and explanations as you go. Returns null when nothing matches. */
  function buildStudy(bank, qstats, f, opts) {
    f = f || {}; opts = opts || {}; const rand = rng(opts.seed);
    const pool = studyPool(bank, qstats, f);
    if (!pool.length) return null;
    const ids = pickBy(pool, qstats || {}, f.count || pool.length, rand);
    const all = Object.keys(bank.objectives).length;
    const objs = f.objs && f.objs.length && f.objs.length < all ? f.objs : null;
    const what = !objs ? "All objectives" : objs.length === 1 ? objs[0] + " " + bank.objectives[objs[0]].name : objs.length + " objectives";
    const src = { missed: "Missed last time", unseen: "New questions" }[f.source];
    return newSession(bank, "study", "Study · " + (f.label ? f.label : (src ? src + " · " : "") + what), shuffle(ids, rand), { study: true, seed: opts.seed });
  }

  function objectiveStats(bank, qstats) {
    const out = {};
    for (const o of Object.keys(bank.objectives)) {
      let right = 0, seen = 0, missedNow = 0, touched = 0;
      for (const id of bank.byObj[o]) {
        const s = qstats[id]; if (!s) continue;
        right += s.right; seen += s.seen; touched++;
        if (s.last === false) missedNow++;
      }
      const pct = seen ? Math.round(100 * right / seen) : null;
      let level = "new";
      if (seen) level = pct >= TARGET && touched >= Math.min(4, bank.byObj[o].length) ? "mastered" : pct < 65 && seen >= 2 ? "weak" : "learning";
      out[o] = { right, seen, pct, touched, total: bank.byObj[o].length, missedNow, level };
    }
    return out;
  }

  function weakObjectives(bank, qstats, limit) {
    const st = objectiveStats(bank, qstats);
    return Object.keys(st).filter(o => st[o].seen >= 2 && st[o].pct < TARGET)
      .sort((a, b) => st[a].pct - st[b].pct || st[b].missedNow - st[a].missedNow).slice(0, limit || 5);
  }

  function missedIds(bank, qstats) {
    return Object.keys(qstats).filter(id => bank.byId[id] && qstats[id].last === false);
  }

  function buildWeak(bank, qstats, count, opts) {
    opts = opts || {}; const rand = rng(opts.seed); count = count || 20;
    const missed = shuffle(missedIds(bank, qstats), rand);
    const extraPool = [].concat(...weakObjectives(bank, qstats, 6).map(o => bank.byObj[o])).filter(id => missed.indexOf(id) < 0);
    const extra = pickBy(extraPool, qstats, extraPool.length, rand);
    const ids = missed.concat(extra).slice(0, count);
    if (!ids.length) return null;
    return newSession(bank, "weak", "Weak-area drill", shuffle(ids, rand), { study: true, seed: opts.seed });
  }

  // ------------------------------------------------------------- results
  function grade(bank, s, now) {
    const perQ = {}; const byObj = {}; const byTopic = {}; const byLevel = {}; let score = 0;
    for (const id of s.qids) {
      const q = bank.byId[id]; const ok = isCorrect(q, s.answers[id]); perQ[id] = ok; if (ok) score++;
      const o = q.obj, t = topicOf(o);
      byObj[o] = byObj[o] || [0, 0]; byObj[o][1]++; if (ok) byObj[o][0]++;
      byTopic[t] = byTopic[t] || [0, 0]; byTopic[t][1]++; if (ok) byTopic[t][0]++;
      const lv = q.level || 1; byLevel[lv] = byLevel[lv] || [0, 0]; byLevel[lv][1]++; if (ok) byLevel[lv][0]++;
    }
    const total = s.qids.length; now = now || Date.now();
    const secs = Math.round(Math.min(s.deadline ? EXAM_SECONDS : Infinity, (now - s.start) / 1000));
    const answeredN = s.qids.filter(id => answered(bank.byId[id], s.answers[id])).length;
    return { score, total, pct: total ? Math.round(100 * score / total) : 0, secs, perQ, byObj, byTopic, byLevel, answered: answeredN };
  }

  /** Apply a finished session to the saved state. Returns the stored record. */
  function recordResult(state, bank, s, res, now) {
    now = now || Date.now();
    for (const id of s.qids) {
      if (!answered(bank.byId[id], s.answers[id]) && s.mode !== "test") continue; // drills: skip untouched
      const st = state.qstats[id] || { seen: 0, right: 0, last: null };
      st.seen++; if (res.perQ[id]) st.right++; st.last = res.perQ[id]; st.at = now;
      scheduleQuestion(st, res.perQ[id], dayNum(now));
      state.qstats[id] = st;
    }
    const rec = { id: "t" + now, date: now, mode: s.mode, label: s.label, score: res.score, total: res.total, pct: res.pct,
                  secs: res.secs, timed: s.timed, study: !!s.study, qids: s.qids, answers: s.answers, optOrder: s.optOrder,
                  flags: Object.keys(s.flags).filter(k => s.flags[k]), hints: Object.keys(s.hints || {}).filter(k => s.hints[k]) };
    state.tests.push(rec);
    // keep full detail for the 30 most recent records
    state.tests.forEach((t, i) => { if (i < state.tests.length - 30) { delete t.qids; delete t.answers; delete t.optOrder; delete t.flags; delete t.hints; } });
    addActivity(state, res.answered, now);
    return rec;
  }

  // ------------------------------------------------------------- daily review (spaced repetition for questions)
  // A miss comes back tomorrow. Each right answer pushes the next review further out: 1, 2, 4, 8, then 16 days.
  function scheduleQuestion(s, ok, today) {
    s.box = ok ? Math.min((s.box || 0) + 1, BOX_DAYS.length - 1) : 0;
    s.due = today + (ok ? BOX_DAYS[s.box] : 1);
    return s;
  }
  function questionDue(s) {                 // older saved data has no schedule yet
    if (s.due != null) return s.due;
    if (s.last === false) return 0;
    return (s.at ? dayNum(s.at) : 0) + 2;
  }
  function dueIds(bank, qstats, today) {
    today = today == null ? dayNum() : today;
    return Object.keys(qstats).filter(id => bank.byId[id] && questionDue(qstats[id]) <= today)
      .sort((a, b) => questionDue(qstats[a]) - questionDue(qstats[b]) || (qstats[a].box || 0) - (qstats[b].box || 0));
  }
  function reviewForecast(bank, qstats, today) {
    today = today == null ? dayNum() : today;
    let due = 0, tomorrow = 0, week = 0;
    for (const id in qstats) {
      if (!bank.byId[id]) continue;
      const d = questionDue(qstats[id]);
      if (d <= today) due++; else if (d === today + 1) tomorrow++;
      if (d > today && d <= today + 7) week++;
    }
    return { due, tomorrow, week };
  }
  function buildReview(bank, qstats, count, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    const ids = dueIds(bank, qstats, opts.today).slice(0, count || 20);
    if (!ids.length) return null;
    return newSession(bank, "review", "Daily review", shuffle(ids, rand), { study: true, seed: opts.seed });
  }

  // ------------------------------------------------------------- command practice (drills on the lab shell)
  // A "skill" is one thing to do with one command (find by name, chmod in octal, tar -czf...). Each has a few templates;
  // a template's {{placeholders}} are filled from `cases` (values that belong together) and `vars` (independent picks),
  // so every run has different file names and paths and the answer can't be memorised. Results go in
  // state.cmdstats[skillId] = { seen, right, last, at, box, due }: the same shape and Leitner schedule as questions,
  // so sync merges it the same way. Everything here is pure; the shell runs in the app and in tools/test_drills.js.
  const fill = (x, vals) => typeof x === "string" ? (/^\{\{\w+\}\}$/.test(x) && typeof vals[x.slice(2, -2)] === "number" ? vals[x.slice(2, -2)]   // "{{pid}}" alone keeps its number type
    : x.replace(/\{\{(\w+)\}\}/g, (m, k) => vals[k] != null ? vals[k] : m))
    : Array.isArray(x) ? x.map(y => fill(y, vals)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [fill(k, vals), fill(v, vals)])) : x;
  /** Every combination a template can produce is too many to list, so instances are picked with a seeded PRNG. */
  function drillValues(tpl, rand) {
    rand = rand || Math.random; const vals = {};
    if (tpl.cases && tpl.cases.length) Object.assign(vals, tpl.cases[Math.floor(rand() * tpl.cases.length)]);
    for (const k in tpl.vars || {}) { const pool = tpl.vars[k]; vals[k] = pool[Math.floor(rand() * pool.length)]; }
    return vals;
  }
  /** A ready-to-run task: { skill, text, hints, solution, check, setup, explain, wrong, vals }. */
  function instantiateDrill(skill, tplIndex, rand) {
    const tpl = skill.templates[tplIndex], vals = drillValues(tpl, rand);
    const out = fill({ text: tpl.text, hints: tpl.hints || [], solution: tpl.solution, check: tpl.check, setup: tpl.setup || {}, explain: tpl.explain || "", wrong: tpl.wrong || [] }, vals);
    return Object.assign(out, { skill: skill.id, cmd: skill.cmd, tpl: tplIndex, vals });
  }
  const isDue = (s, today) => s && s.seen && questionDue(s) <= today;
  /** Skills due for review today (only skills that still exist when `skills` is given). */
  function cmdDue(cmdstats, today, skills) {
    today = today == null ? dayNum() : today; const known = skills ? new Set(skills.map(s => s.id)) : null;
    return Object.keys(cmdstats || {}).filter(id => (!known || known.has(id)) && isDue(cmdstats[id], today));
  }
  /** Save one drill result: schedule the skill like a question and count it toward today's goal. */
  function recordDrill(state, skillId, ok, now) {
    now = now || Date.now(); state.cmdstats = state.cmdstats || {};
    const s = state.cmdstats[skillId] || { seen: 0, right: 0, last: null };
    s.seen++; if (ok) s.right++; s.last = !!ok; s.at = now;
    scheduleQuestion(s, !!ok, dayNum(now));
    state.cmdstats[skillId] = s; addActivity(state, 1, now);
    return s;
  }
  /** Which command a typed answer starts with (skipping sudo and VAR=value), for linking questions to commands. */
  function firstCommand(line) {
    const words = String(line || "").trim().split(/\s+/);
    while (words.length && (words[0] === "sudo" || /^\w+=/.test(words[0]))) words.shift();
    return (words[0] || "").replace(/^\.\//, "");
  }
  /**
   * How well each command is known, from three sources: drills for its skills, type-the-command questions whose
   * answer uses it (index.cmdq), and lab tasks (labUse: cmd -> tasks done, coverage only). Accuracy counts the
   * latest result of each skill and question, like the pass predictor, so old misses stop counting once fixed.
   * Levels: new (no results), weak (under 60% after 2+), mastered (80%+ with every skill of the command right last
   * time), learning otherwise.
   */
  function commandMastery(index, state, opts) {
    opts = opts || {}; const today = opts.today == null ? dayNum() : opts.today;
    const cs = state.cmdstats || {}, qs = state.qstats || {}, out = {};
    for (const sk of index.skills || []) {
      const c = out[sk.cmd] = out[sk.cmd] || { cmd: sk.cmd, obj: sk.obj, skills: [], right: 0, wrong: 0, qRight: 0, qWrong: 0, due: 0, practised: 0, labTasks: 0 };
      c.objs = c.objs || {}; c.objs[sk.obj] = (c.objs[sk.obj] || 0) + 1;      // listed under the objective most of its skills belong to
      if (c.objs[sk.obj] > c.objs[c.obj] || !c.objs[c.obj]) c.obj = sk.obj;
      const s = cs[sk.id]; c.skills.push(sk.id);
      if (s && s.seen) { c.practised++; if (s.last) c.right++; else c.wrong++; if (isDue(s, today)) c.due++; }
    }
    for (const cmd in index.cmdq || {}) {
      const c = out[cmd]; if (!c) continue;
      for (const id of index.cmdq[cmd]) { const s = qs[id]; if (!s || !s.seen) continue; const ok = s.last == null ? s.right * 2 >= s.seen : s.last; if (ok) c.qRight++; else c.qWrong++; }
    }
    for (const cmd in opts.labUse || {}) if (out[cmd]) out[cmd].labTasks = opts.labUse[cmd];
    for (const cmd in out) {
      const c = out[cmd], right = c.right + c.qRight, n = right + c.wrong + c.qWrong;
      c.n = n; c.pct = n ? Math.round(100 * right / n) : null;
      c.level = !n ? "new" : c.pct < 60 && n >= 2 ? "weak" : c.pct >= TARGET && c.practised === c.skills.length && !c.wrong ? "mastered" : "learning";
    }
    return out;
  }
  // ------------------------------------------------------------- what else in the app covers a command
  // Commands that are shell features or builtins are matched by keyword; everything else by the command name.
  const CMD_KEYWORDS = { variables: /\bvariables?\b/i, "brace expansion": /brace expansion|\{[^{}\s]*,[^{}\s]*\}/i, globbing: /\bglob(s|bing)?\b|wildcard/i,
    test: /`(test|\[)\s[^`]*`|\btest command|\s-(eq|ne|gt|lt|ge|le)\s/, for: /`for\s[^`]*`|\bfor loops?\b|^for\s+\w+\s+in\s/m,
    redirection: /\bredirect/i, pipes: /\bpipes?\b|\bpipeline/i, "$?": /\$\?|exit status/i, PATH: /\bPATH\b/ };
  const cmdNames = cmd => cmd === "head/tail" ? ["head", "tail"] : [cmd];
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /** Does this text mention the command as a command (in a `code span`, or as a line that starts with it)? */
  function mentionsCmd(cmd, text, opts) {
    if (!text) return false;
    if (CMD_KEYWORDS[cmd]) return CMD_KEYWORDS[cmd].test(text);
    return cmdNames(cmd).some(n => { const w = escRe(n);
      return new RegExp("`(sudo\\s+)?" + w + "(\\s[^`]*)?`").test(text) || (opts && opts.lead && new RegExp("^(sudo\\s+)?" + w + "(\\s+[-./~$'\"\\w]|$)").test(text.trim())); });
  }
  /** Exam questions about a command: the type-the-command ones, plus any that name it in code or offer it as an answer. */
  function relatedQuestions(bank, cmdq, cmd) {
    const out = new Set((cmdq && cmdq[cmd]) || []);
    for (const q of bank.questions) {
      if (out.has(q.id)) continue;
      if (mentionsCmd(cmd, q.q) || mentionsCmd(cmd, q.explanation) || (q.options || []).some(o => mentionsCmd(cmd, o, { lead: true })) ||
          (q.accept || []).some(a => mentionsCmd(cmd, a, { lead: true }))) out.add(q.id);
    }
    return [...out].filter(id => bank.byId[id]);
  }
  /** Flashcards about a command: command cards whose front or example starts with it, plus concept cards for shell features. */
  function relatedCards(cards, cmd) {
    return cards.filter(c => {
      if (CMD_KEYWORDS[cmd]) return CMD_KEYWORDS[cmd].test(c.front) || (c.deck === "commands" && CMD_KEYWORDS[cmd].test(c.back));
      return String(c.front).split(" / ").some(f => mentionsCmd(cmd, f, { lead: true })) || mentionsCmd(cmd, c.front) || (c.deck === "commands" && mentionsCmd(cmd, c.ex || "", { lead: true }));
    }).map(c => c.id);
  }

  /**
   * Choose skills for a practice set. source:
   *   "recommended"  due first, then missed last time, then the weakest commands, then skills not tried yet (in exam order)
   *   "due" | "new" | "all"
   * ids / cmds / objs narrow the pool. When the pool is smaller than count, skills repeat (each run gets new values).
   */
  function pickSkills(index, state, opts) {
    opts = opts || {}; const rand = rng(opts.seed), today = opts.today == null ? dayNum() : opts.today;
    const cs = state.cmdstats || {}, count = opts.count || 10;
    let pool = (index.skills || []).filter(s => (!opts.ids || opts.ids.indexOf(s.id) >= 0) && (!opts.cmds || !opts.cmds.length || opts.cmds.indexOf(s.cmd) >= 0) && (!opts.objs || !opts.objs.length || opts.objs.indexOf(s.obj) >= 0));
    const src = opts.source || "recommended";
    if (src === "due") pool = pool.filter(s => isDue(cs[s.id], today));
    else if (src === "new") pool = pool.filter(s => !(cs[s.id] && cs[s.id].seen));
    if (!pool.length) return [];
    const mastery = commandMastery(index, state, { today });
    const objKey = o => o.split(".").map(n => String(n).padStart(3, "0")).join(".");
    const rank = s => {
      const st = cs[s.id], m = mastery[s.cmd];
      if (src === "new") return [objKey(s.obj), rand()];
      if (src !== "recommended") return [0, rand()];
      if (isDue(st, today)) return [0, questionDue(st), st.box || 0];
      if (st && st.seen && st.last === false) return [1, st.right / st.seen];
      if (m && m.level === "weak") return [2, m.pct, rand()];
      if (!st || !st.seen) return [3, objKey(s.obj), rand()];
      return [4, st.right / st.seen, questionDue(st)];
    };
    const ranked = shuffle(pool, rand).map(s => ({ s, r: rank(s) }))
      .sort((a, b) => { for (let i = 0; i < Math.max(a.r.length, b.r.length); i++) { if (a.r[i] < b.r[i]) return -1; if (a.r[i] > b.r[i]) return 1; } return 0; })
      .map(x => x.s);
    const out = [];
    for (let i = 0; out.length < count; i++) out.push(ranked[i % ranked.length]);
    return out;
  }
  /** A practice session: one fresh machine per task. mode: "guided" (hints), "recall" (no hints), "timed" (recall + a clock). */
  function buildCmdSession(drills, index, state, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    const byId = {}; for (const s of drills.skills) byId[s.id] = s;
    const picks = pickSkills(index, state, Object.assign({}, opts, { seed: opts.seed })).filter(s => byId[s.id]);
    if (!picks.length) return null;
    const used = {};
    const tasks = picks.map(p => { const sk = byId[p.id]; const k = used[sk.id] = (used[sk.id] == null ? Math.floor(rand() * sk.templates.length) : used[sk.id] + 1);
      return instantiateDrill(sk, k % sk.templates.length, rand); });
    const mode = ["guided", "recall", "timed"].indexOf(opts.mode) >= 0 ? opts.mode : "guided";
    return { mode, seconds: mode === "timed" ? (opts.seconds || 90) : null, tasks, i: 0, results: [], label: opts.label || "Command practice", start: opts.now || Date.now() };
  }
  /** Grade one task: right only when it was solved without hints or the answer (and in time, when timed). */
  function cmdTaskOk(r) { return !!(r && r.solved && !r.hint && !r.revealed && !r.timeout); }

  // ------------------------------------------------------------- XP, levels and badges (all derived from saved progress)
  const LEVEL_XP = [0, 100, 250, 500, 1000, 2000, 3500, 5500];
  const LEVEL_NAMES = ["Newcomer", "Shell user", "Pipe fitter", "Script writer", "Power user", "Sysadmin", "Kernel hacker", "root"];
  // The 12 labs before labs were split per lesson (Oct 2026). A completed one is credited to its new parts by
  // migrateLabs, so it no longer counts for XP or badges itself; unfinished ones still count.
  const LEGACY_LABS = ["basics", "help", "navigate", "files", "archives", "text", "scripts", "system", "network", "users", "perms", "special"];
  const countedLab = (state, id) => !(LEGACY_LABS.indexOf(id) >= 0 && state.labs[id].completedAt);
  /** Mark new lab parts complete when every old lab they replace was completed. Parts already started are left alone.
   *  Deterministic, so every device computes the same result. Returns the number of parts credited. */
  function migrateLabs(state, labs) {
    state.labs = state.labs || {}; let n = 0;
    for (const lab of labs || []) {
      if (!lab.from || !lab.from.length || state.labs[lab.id]) continue;
      const olds = lab.from.map(id => state.labs[id]);
      if (!olds.every(o => o && o.completedAt)) continue;
      const tasks = lab.n != null ? lab.n : lab.tasks.length;
      state.labs[lab.id] = { done: Array.from({ length: tasks }, (_, i) => i), completedAt: Math.max.apply(null, olds.map(o => o.completedAt)) }; n++;
    }
    return n;
  }
  function xpInfo(state) {          // 1 XP per answer or command drill, +1 when right, 1 per flashcard review, 5 per lab task
    let total = 0;
    for (const id in state.qstats) total += (state.qstats[id].seen || 0) + (state.qstats[id].right || 0);
    for (const id in state.cmdstats || {}) total += (state.cmdstats[id].seen || 0) + (state.cmdstats[id].right || 0);
    for (const id in state.cards) total += state.cards[id].seen || 0;
    for (const id in state.labs || {}) if (countedLab(state, id)) total += 5 * ((state.labs[id].done || []).length);
    let lv = 0; while (lv + 1 < LEVEL_XP.length && total >= LEVEL_XP[lv + 1]) lv++;
    return { xp: total, level: lv + 1, name: LEVEL_NAMES[lv], floor: LEVEL_XP[lv], next: lv + 1 < LEVEL_XP.length ? LEVEL_XP[lv + 1] : null };
  }
  function longestStreak(days, goal) {
    const nums = Object.keys(days).filter(k => days[k] >= goal).map(k => { const [y, m, d] = k.split("-").map(Number); return dayNum(new Date(y, m - 1, d)); }).sort((a, b) => a - b);
    let best = 0, run = 0;
    nums.forEach((n, i) => { run = i && n === nums[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
    return best;
  }
  const BADGES = [
    ["first-exam", "First exam", "Finish an exam.", "test"],
    ["ready", "Ready range", "Score 80% or higher on an exam.", "check"],
    ["three-ready", "Ready to book", "Score 80% or higher on three exams in a row.", "trophy"],
    ["perfect", "Perfect run", "Score 100% on an exam.", "trophy"],
    ["speed", "Fast and right", "Score 80% or higher on an exam in under 30 minutes.", "clock"],
    ["streak3", "On a roll", "Meet your daily goal 3 days in a row.", "flame"],
    ["streak7", "Week streak", "Meet your daily goal 7 days in a row.", "flame"],
    ["streak30", "Habit formed", "Meet your daily goal 30 days in a row.", "flame"],
    ["review7", "Spaced out", "Finish 7 daily reviews.", "repeat"],
    ["no-hints", "No hints needed", "Score 80% or higher on a study session of 10+ questions without using a hint.", "bulb"],
    ["analyst", "Analyst", "Answer 50 Analyze questions correctly.", "terminal"],
    ["seen-all", "Seen it all", "Answer every question in the bank at least once.", "progress"],
    ["obj-1", "First mastery", "Master an objective.", "weak"],
    ["obj-all", "Full coverage", "Master all 19 objectives.", "weak"],
    ["cards100", "Card shark", "Review 100 flashcards.", "cards"],
    ["cards-all", "Total recall", "Master every flashcard.", "cards"],
    ["lab1", "Hands on", "Complete a lab in the terminal.", "terminal"],
    ["lab-all", "Lab graduate", "Complete every lab.", "terminal"],
    ["fluent", "Fluent", "Get 50 command drills right without a hint.", "terminal"],
  ];
  /** Every badge with done/progress. progress = [current, goal] where that makes sense. */
  function badgeStatus(state, bank, cards, labCount) {
    const exams = state.tests.filter(t => t.mode === "test");
    let run = 0, bestRun = 0; exams.forEach(t => { run = t.pct >= TARGET ? run + 1 : 0; bestRun = Math.max(bestRun, run); });
    const streak = longestStreak(state.days, state.settings.goal);
    const seen = Object.keys(state.qstats).filter(id => bank.byId[id] && state.qstats[id].seen).length;
    let analyze = 0; for (const id in state.qstats) if (bank.byId[id] && bank.byId[id].level === 3) analyze += state.qstats[id].right || 0;
    const os = objectiveStats(bank, state.qstats); const mastered = Object.values(os).filter(o => o.level === "mastered").length;
    const nObj = Object.keys(bank.objectives).length;
    let cardSeen = 0; for (const id in state.cards) cardSeen += state.cards[id].seen || 0;
    const cardsMastered = cards.filter(c => state.cards[c.id] && state.cards[c.id].box >= 4).length;
    const reviews = state.tests.filter(t => t.mode === "review").length;
    const labsDone = Object.keys(state.labs || {}).filter(id => state.labs[id].completedAt && countedLab(state, id)).length;
    let drillsRight = 0; for (const id in state.cmdstats || {}) drillsRight += state.cmdstats[id].right || 0;
    const p = (n, goal) => ({ done: n >= goal, progress: [Math.min(n, goal), goal] });
    const flag = done => ({ done: !!done });
    const res = {
      "first-exam": p(exams.length, 1), "ready": flag(exams.some(t => t.pct >= TARGET)), "three-ready": p(bestRun, 3),
      "perfect": flag(exams.some(t => t.pct === 100)), "speed": flag(exams.some(t => t.pct >= TARGET && t.secs < 1800)),
      "streak3": p(streak, 3), "streak7": p(streak, 7), "streak30": p(streak, 30), "review7": p(reviews, 7),
      "no-hints": flag(state.tests.some(t => t.mode !== "test" && t.total >= 10 && t.pct >= TARGET && Array.isArray(t.hints) && !t.hints.length)),
      "analyst": p(analyze, 50), "seen-all": p(seen, bank.questions.length), "obj-1": p(mastered, 1), "obj-all": p(mastered, nObj),
      "cards100": p(cardSeen, 100), "cards-all": p(cardsMastered, cards.length),
      "lab1": p(labsDone, 1), "lab-all": p(labsDone, labCount || 12), "fluent": p(drillsRight, 50),
    };
    return BADGES.map(([id, name, desc, icon]) => Object.assign({ id, name, desc, icon, at: (state.badges || {})[id] || null }, res[id]));
  }
  /** Record newly earned badges in state.badges and return them. */
  function awardBadges(state, bank, cards, now, labCount) {
    state.badges = state.badges || {}; const fresh = [];
    for (const b of badgeStatus(state, bank, cards, labCount)) if (b.done && !state.badges[b.id]) { state.badges[b.id] = now || Date.now(); fresh.push(b); }
    return fresh;
  }

  const LEVELS = { 1: ["Recall", "Remember a fact, term or definition"],
                   2: ["Apply", "Pick or type the right command, option or setting"],
                   3: ["Analyze", "Trace code, output, globs or permissions to a result"] };
  function levelStats(bank, qstats) {
    const out = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    for (const id in qstats) { const q = bank.byId[id]; if (!q) continue; const lv = q.level || 1; out[lv][0] += qstats[id].right; out[lv][1] += qstats[id].seen; }
    return out;
  }
  function levelMix(bank, ids) {
    const m = { 1: 0, 2: 0, 3: 0 }; for (const id of ids || bank.questions.map(q => q.id)) m[bank.byId[id].level || 1]++; return m;
  }

  /** Average of the last 3 full tests taken under exam conditions (answers hidden until submit). */
  function readiness(tests) {
    const full = tests.filter(t => t.mode === "test" && t.total === 40 && !t.study).slice(-3);
    return full.length ? Math.round(full.reduce((n, t) => n + t.pct, 0) / full.length) : null;
  }

  // ------------------------------------------------------------- pass predictor
  // For each objective, the latest answer to every question you've seen gives a Beta(1 + right, 1 + wrong) posterior for
  // your accuracy there, so an objective you haven't practised counts as a coin flip until you do. The number you'd get right out of that objective's exam
  // questions is then beta-binomial, and convolving the 19 objectives gives the exact score distribution for a fresh
  // 40-question exam. Pass chance = P(score >= PASS_PCT). LPI doesn't publish the raw cutoff (500 on a 200-800 scale),
  // so 70% is a deliberately cautious stand-in.
  const PASS_PCT = 70, PASS_MIN_SEEN = 30;
  function lgamma(x) {                        // Lanczos approximation, |error| < 1e-10 for x > 0
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  const lbeta = (a, b) => lgamma(a) + lgamma(b) - lgamma(a + b);
  function betaBinomial(n, a, b) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + lbeta(k + a, n - k + b) - lbeta(a, b)));
    return out;
  }
  function convolve(p, q) {
    const out = new Array(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) out[i + j] += p[i] * q[j];
    return out;
  }
  /** Per-objective evidence: right/wrong counts from the latest answer to each question seen. */
  function passEvidence(bank, qstats) {
    const ev = {}; let n = 0;
    for (const o of Object.keys(bank.objectives)) {
      ev[o] = { right: 0, wrong: 0 };
      for (const id of bank.byObj[o]) {
        const s = qstats[id]; if (!s || !s.seen) continue;
        const ok = s.last == null ? s.right * 2 >= s.seen : s.last;
        if (ok) ev[o].right++; else ev[o].wrong++;
      }
      n += ev[o].right + ev[o].wrong;
    }
    return { ev, seen: n };
  }
  function scoreDist(bank, ev) {
    let dist = [1];
    for (const o of Object.keys(bank.objectives)) {
      dist = convolve(dist, betaBinomial(bank.objectives[o].weight, 1 + ev[o].right, 1 + ev[o].wrong));
    }
    return dist;
  }
  function distStats(dist) {
    const total = dist.length - 1, need = Math.ceil(total * PASS_PCT / 100);
    let chance = 0, mean = 0, cum = 0, low = null, high = null;
    dist.forEach((p, k) => {
      if (k >= need) chance += p; mean += k * p; cum += p;
      if (low == null && cum >= 0.1) low = k;
      if (high == null && cum >= 0.9) high = k;
    });
    return { chance: Math.max(0, Math.min(1, chance)), mean, low, high, total, need };
  }
  /** Estimated chance of passing a fresh exam. chance is null until PASS_MIN_SEEN questions have been answered. */
  function passPrediction(bank, qstats) {
    const { ev, seen } = passEvidence(bank, qstats);
    const base = { seen, minSeen: PASS_MIN_SEEN, passPct: PASS_PCT };
    if (seen < PASS_MIN_SEEN) return Object.assign(base, { chance: null, more: PASS_MIN_SEEN - seen });
    const d = distStats(scoreDist(bank, ev));
    // Where 3 more right answers would raise the pass chance most.
    const focus = Object.keys(bank.objectives).map(o => {
      const ev2 = Object.assign({}, ev, { [o]: { right: ev[o].right + 3, wrong: ev[o].wrong } });
      return { obj: o, gain: distStats(scoreDist(bank, ev2)).chance - d.chance };
    }).filter(f => f.gain >= 0.005).sort((x, y) => y.gain - x.gain || (x.obj < y.obj ? -1 : 1)).slice(0, 3);
    return Object.assign(base, d, { focus });
  }

  // ------------------------------------------------------------- exam-date plan
  function parseDate(str) {                  // "YYYY-MM-DD" -> local Date, or null
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || ""); if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }
  /** Countdown, daily target and milestones for the exam date in state.settings.examDate. */
  function examPlan(state, bank, now) {
    now = now || Date.now();
    const date = parseDate(state.settings.examDate); if (!date) return null;
    const today = dayNum(now), days = dayNum(date) - today;
    const seen = Object.keys(state.qstats).filter(id => bank.byId[id] && state.qstats[id].seen).length;
    const unseen = bank.questions.length - seen;
    const due = dueIds(bank, state.qstats, today).length;
    const studyDays = days - 2;               // keep the last two days for full exams and review
    const newPerDay = days < 0 || studyDays < 1 ? 0 : Math.ceil(unseen / studyDays);
    const phase = days < 0 ? "past" : days === 0 ? "today" : studyDays < 1 ? "final" : "learn";
    const full = state.tests.filter(t => t.mode === "test" && t.total === 40 && !t.study);
    let run = 0; for (let i = full.length - 1; i >= 0 && full[i].pct >= TARGET; i--) run++;
    const pred = passPrediction(bank, state.qstats);
    return { date: state.settings.examDate, days, phase, seen, unseen, due, newPerDay, target: newPerDay + due,
             doneToday: state.days[dayKey(now)] || 0,
             milestones: [
               { id: "seen", label: "See every question", done: unseen === 0, progress: [seen, bank.questions.length] },
               { id: "ready", label: "Score " + TARGET + "%+ on three exams in a row", done: run >= 3, progress: [Math.min(run, 3), 3] },
               { id: "pass", label: "Pass chance of 90% or more", done: pred.chance != null && pred.chance >= 0.9, progress: null },
               { id: "due", label: "Clear today's reviews", done: due === 0, progress: null }] };
  }
  /** iCalendar file: the exam as an all-day event, plus a daily study reminder until the day before. */
  function examIcs(dateStr, opts) {
    opts = opts || {};
    const date = parseDate(dateStr); if (!date) return null;
    const now = opts.now ? new Date(opts.now) : new Date();
    const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const esc = t => String(t).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const fold = line => { const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); } out.push(line); return out.join("\r\n"); };
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const url = opts.url ? "\n" + opts.url : "";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//exit 0//Linux Essentials 010-160//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:exam-" + ymd(date) + "@exit0", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + ymd(date), "DTEND;VALUE=DATE:" + ymd(next),
      "SUMMARY:" + esc("LPI Linux Essentials (010-160) exam"),
      "DESCRIPTION:" + esc("Bring your ID. Read every question twice, flag the hard ones and come back to them." + url),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("Linux Essentials exam tomorrow"), "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT"];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last = new Date(date); last.setDate(last.getDate() - 1);
    if (opts.time !== null && last >= start) {
      const [hh, mm] = /^\d{1,2}:\d{2}$/.test(opts.time || "") ? opts.time.split(":") : ["19", "00"];
      const hm = String(+hh).padStart(2, "0") + mm + "00";
      L.push("BEGIN:VEVENT", "UID:study-" + ymd(date) + "@exit0", "DTSTAMP:" + stamp, "DTSTART:" + ymd(start) + "T" + hm, "DURATION:PT20M",
        "RRULE:FREQ=DAILY;UNTIL=" + ymd(last) + "T235959", "SUMMARY:" + esc("exit 0: daily study"),
        "DESCRIPTION:" + esc("Clear your daily review, then answer today's new questions." + url),
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc("Time to study for Linux Essentials"), "TRIGGER:PT0M", "END:VALARM", "END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return L.map(fold).join("\r\n") + "\r\n";
  }

  // ------------------------------------------------------------- flashcards (Leitner)
  function cardQueue(cards, cstate, filter, today, limit) {
    today = today == null ? dayNum() : today; limit = limit || 20;
    const pool = cards.filter(filter || (() => true));
    const due = pool.filter(c => cstate[c.id] && cstate[c.id].due <= today)
      .sort((a, b) => cstate[a.id].due - cstate[b.id].due || cstate[a.id].box - cstate[b.id].box);
    const fresh = pool.filter(c => !cstate[c.id]);
    return due.concat(fresh).slice(0, limit);
  }
  function reviewCard(cstate, id, knew, today, now) {
    today = today == null ? dayNum() : today;
    const s = cstate[id] || { box: 0, seen: 0, right: 0 };
    s.seen++; if (knew) s.right++; s.at = now || Date.now();   // `at` lets sync tell which device reviewed it last
    s.box = knew ? Math.min(s.box + 1, BOX_DAYS.length - 1) : 0;
    s.due = today + (knew ? BOX_DAYS[s.box] : 0);
    cstate[id] = s;
    return s;
  }
  function deckStats(cards, cstate, filter, today) {
    today = today == null ? dayNum() : today;
    const pool = cards.filter(filter || (() => true));
    let fresh = 0, learning = 0, mastered = 0, due = 0;
    for (const c of pool) {
      const s = cstate[c.id];
      if (!s) { fresh++; continue; }
      if (s.box >= 4) mastered++; else learning++;
      if (s.due <= today) due++;
    }
    return { total: pool.length, fresh, learning, mastered, due };
  }

  // ------------------------------------------------------------- streak + goal
  function addActivity(state, n, now) {
    if (!n) return;
    const k = dayKey(now); state.days[k] = (state.days[k] || 0) + n;
  }
  function streak(days, goal, now) {
    const d = now ? new Date(now) : new Date();
    let count = 0;
    const metToday = (days[dayKey(d)] || 0) >= goal;
    if (!metToday) d.setDate(d.getDate() - 1);
    while ((days[dayKey(d)] || 0) >= goal) { count++; d.setDate(d.getDate() - 1); }
    return { count, metToday, today: days[dayKey(now)] || 0 };
  }

  // ------------------------------------------------------------- sync (merging progress from several devices)
  // Each device uploads only its own progress (its "replica"). Merging all replicas gives the same result on
  // every device, in any order: counts add up, schedules come from the device that answered last, lists are unions.
  const LOCAL_SETTINGS = ["theme", "study", "cmd"];   // per-device: look and the last Study / command practice choices
  const TEST_DETAIL = ["qids", "answers", "optOrder", "flags", "hints"];
  const KEEP_DETAIL = 30;
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));

  function syncedSettings(settings) {
    const out = {};
    for (const k in settings || {}) if (LOCAL_SETTINGS.indexOf(k) < 0) out[k] = clone(settings[k]);
    return out;
  }
  /** Update per-key change times for synced settings by comparing with the last snapshot. */
  function stampSettings(settings, snap, ts, now) {
    const cur = syncedSettings(settings); ts = Object.assign({}, ts); snap = snap || {};
    for (const k in cur) if (JSON.stringify(cur[k]) !== JSON.stringify(snap[k])) ts[k] = now || Date.now();
    return { snap: cur, ts };
  }
  // Counters (seen, right) add up; the schedule (last, at, box, due) comes from whichever copy is newest.
  function mergeSched(map, id, s) {
    const o = map[id];
    if (!o) { map[id] = Object.assign({}, s); return; }
    const newer = (s.at || 0) > (o.at || 0) || ((s.at || 0) === (o.at || 0) && (s.box || 0) > (o.box || 0));
    const m = newer ? Object.assign({}, o, s) : Object.assign({}, s, o);
    m.seen = (o.seen || 0) + (s.seen || 0); m.right = (o.right || 0) + (s.right || 0);
    map[id] = m;
  }
  /** Merge replica docs into one view: { tests, qstats, cards, days, badges, labs, settings, settingsTs }. */
  function mergeStates(docs) {
    const out = { tests: [], qstats: {}, cards: {}, cmdstats: {}, days: {}, badges: {}, labs: {}, settings: {}, settingsTs: {} };
    const tests = {};
    for (const d of docs || []) {
      if (!d) continue;
      for (const id in d.qstats || {}) mergeSched(out.qstats, id, d.qstats[id]);
      for (const id in d.cards || {}) mergeSched(out.cards, id, d.cards[id]);
      for (const id in d.cmdstats || {}) mergeSched(out.cmdstats, id, d.cmdstats[id]);
      for (const k in d.days || {}) out.days[k] = (out.days[k] || 0) + (d.days[k] || 0);
      for (const id in d.badges || {}) { const t = d.badges[id]; if (t && (!out.badges[id] || t < out.badges[id])) out.badges[id] = t; }
      for (const id in d.labs || {}) {
        const a = d.labs[id] || {}, o = out.labs[id] || (out.labs[id] = { done: [] });
        o.done = Array.from(new Set(o.done.concat(a.done || []))).sort((x, y) => x - y);
        if (a.completedAt && (!o.completedAt || a.completedAt < o.completedAt)) o.completedAt = a.completedAt;
      }
      for (const t of d.tests || []) { const h = tests[t.id]; if (!h || (t.qids && !h.qids)) tests[t.id] = t; }
      const ts = d.settingsTs || {};
      for (const k in d.settings || {}) {
        if (LOCAL_SETTINGS.indexOf(k) >= 0) continue;
        const t = ts[k] || 0, cur = out.settingsTs[k];
        // newer wins; on a tie a real value beats an empty one, then the larger JSON wins so every device agrees
        const win = cur == null || t > cur || (t === cur && (out.settings[k] == null ? d.settings[k] != null
          : d.settings[k] != null && JSON.stringify(d.settings[k]) > JSON.stringify(out.settings[k])));
        if (win) { out.settings[k] = clone(d.settings[k]); out.settingsTs[k] = t; }
      }
    }
    out.tests = Object.values(tests).sort((a, b) => (a.date - b.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((t, i, all) => { if (i >= all.length - KEEP_DETAIL) return t; const c = Object.assign({}, t); TEST_DETAIL.forEach(k => delete c[k]); return c; });
    return out;
  }
  /**
   * This device's own share of the merged view: the view minus what the other devices contributed.
   * `others` is mergeStates(other devices' replicas). Only counters need subtracting; everything else merges
   * idempotently, so entries the other devices already have are simply left out to keep the upload small.
   */
  function ownPart(view, others, settingsTs) {
    others = others || mergeStates([]);
    const own = { v: 3, tests: [], qstats: {}, cards: {}, cmdstats: {}, days: {}, badges: {}, labs: {}, settings: syncedSettings(view.settings), settingsTs: Object.assign({}, settingsTs) };
    for (const key of ["qstats", "cards", "cmdstats"]) {
      for (const id in view[key] || {}) {
        const s = view[key][id], o = (others[key] || {})[id];
        const seen = Math.max(0, (s.seen || 0) - (o ? o.seen || 0 : 0));
        const right = Math.max(0, Math.min(seen, (s.right || 0) - (o ? o.right || 0 : 0)));
        const newer = !o || (s.at || 0) > (o.at || 0) || ((s.at || 0) === (o.at || 0) && JSON.stringify([s.box, s.due, s.last]) !== JSON.stringify([o.box, o.due, o.last]));
        if (seen > 0 || newer) own[key][id] = Object.assign({}, s, { seen, right });
      }
    }
    for (const k in view.days || {}) { const n = (view.days[k] || 0) - (others.days[k] || 0); if (n > 0) own.days[k] = n; }
    const theirs = {}; for (const t of others.tests) theirs[t.id] = t;
    own.tests = (view.tests || []).filter(t => !theirs[t.id] || (t.qids && !theirs[t.id].qids));
    for (const id in view.badges || {}) if (!others.badges[id] || view.badges[id] < others.badges[id]) own.badges[id] = view.badges[id];
    for (const id in view.labs || {}) {
      const l = view.labs[id], o = others.labs[id];
      const extra = (l.done || []).filter(x => !o || o.done.indexOf(x) < 0);
      if (extra.length || (l.completedAt && (!o || !o.completedAt || l.completedAt < o.completedAt))) own.labs[id] = clone(l);
    }
    return own;
  }
  /** Copy a merged view into the app state, keeping this device's local settings and any session in progress. */
  function applyMerged(state, view) {
    state.tests = view.tests; state.qstats = view.qstats; state.cards = view.cards; state.cmdstats = view.cmdstats || {}; state.days = view.days;
    state.badges = view.badges; state.labs = view.labs;
    for (const k in view.settings) if (LOCAL_SETTINGS.indexOf(k) < 0) state.settings[k] = view.settings[k];
    return state;
  }
  const hasProgress = st => !!st && (st.tests.length > 0 || Object.keys(st.qstats).length > 0 || Object.keys(st.cards).length > 0 || Object.keys(st.cmdstats || {}).length > 0 || Object.keys(st.labs || {}).some(id => (st.labs[id].done || []).length));
  /** True when local progress looks like a copy of the account's (export/import, or this browser was linked before). */
  function looksCopied(local, remote) {
    const ids = {}; for (const t of remote.tests) ids[t.id] = 1;
    if (local.tests.some(t => ids[t.id])) return true;
    for (const id in local.qstats) if (remote.qstats[id] && local.qstats[id].at && local.qstats[id].at === remote.qstats[id].at) return true;
    return false;
  }

  // ------------------------------------------------------------- state
  const GOAL_MIN = 1, GOAL_MAX = 200;
  /** Daily goal: a whole number of answers, cards, lab tasks or command drills, 1 to 200. */
  function clampGoal(n) { n = Math.round(Number(n)); return isFinite(n) ? Math.max(GOAL_MIN, Math.min(GOAL_MAX, n)) : 10; }
  function freshState() {
    return { v: 3, settings: { theme: "system", goal: 10, examDate: null, remindAt: "19:00", study: { objMode: "all", objs: [], levels: [], source: "mix", count: 20 },
                              cmd: { source: "recommended", cmds: [], count: 10, mode: "guided" } },
             tests: [], qstats: {}, cards: {}, cmdstats: {}, days: {}, badges: {}, labs: {}, current: null };
  }
  /** Bring older saved data (v2 web page) forward. */
  function migrate(raw, legacy) {
    const st = Object.assign(freshState(), raw || {});
    st.settings = Object.assign(freshState().settings, (raw && raw.settings) || {});
    const had = st.settings.study || {};
    st.settings.study = Object.assign(freshState().settings.study, had);
    st.settings.cmd = Object.assign(freshState().settings.cmd, st.settings.cmd || {});
    st.settings.goal = clampGoal(st.settings.goal);      // saved progress keeps its goal; new installs start at 10
    st.cmdstats = st.cmdstats || {};
    if (!had.objMode) st.settings.study.objMode = had.objs && had.objs.length ? "pick" : "all";
    if (st.settings.study.levels.length !== 1) st.settings.study.levels = [];   // one level, or all
    delete st.settings.timed; delete st.settings.reveal;    // Exam mode is always timed with answers hidden
    if (!raw && legacy) {
      if (legacy.qstats) st.qstats = legacy.qstats;
      if (Array.isArray(legacy.history)) {
        st.tests = legacy.history.map(h => ({ id: "t" + h.date, date: h.date, mode: h.mode === "random" || h.mode === "form" ? "test" : h.mode,
          label: h.mode === "random" || h.mode === "form" ? "Practice test" : h.label, score: h.score, total: h.total, pct: h.pct, secs: h.secs }));
      }
    }
    return st;
  }

  return { LEVELS, levelStats, levelMix, EXAM_SECONDS, TARGET, BOX_DAYS, rng, shuffle, norm, dayKey, dayNum, indexBank, topicOf, answered, isCorrect, runLab, labShell,
           scheduleQuestion, questionDue, dueIds, reviewForecast, buildReview,
           xpInfo, migrateLabs, LEGACY_LABS, longestStreak, badgeStatus, awardBadges, BADGES, LEVEL_XP,
           priority, newSession, buildTest, buildStudy, studyPool, buildDrill, buildWeak, objectiveStats, weakObjectives, missedIds, grade,
           recordResult, readiness, PASS_PCT, passPrediction, betaBinomial, parseDate, examPlan, examIcs, cardQueue, reviewCard, deckStats, addActivity, streak, freshState, migrate,
           extraSudo, relatedQuestions, relatedCards, mentionsCmd, cmdNamesOf: cmdNames, fillDrill: fill, drillValues, instantiateDrill, cmdDue, recordDrill, firstCommand, commandMastery, pickSkills, buildCmdSession, cmdTaskOk,
           clampGoal, GOAL_MIN, GOAL_MAX,
           LOCAL_SETTINGS, syncedSettings, stampSettings, mergeStates, ownPart, applyMerged, hasProgress, looksCopied };
});
