// SPDX-License-Identifier: GPL-3.0-or-later
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
  function answered(q, a) { return q.type === "fill" ? norm(a) !== "" : Array.isArray(a) && a.length > 0; }
  function isCorrect(q, a) {
    if (q.type === "fill") return a != null && q.accept.some(x => norm(x) === norm(a));
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
    return { mode, label, qids, optOrder, answers: {}, flags: {}, checked: {}, cur: 0, study: !!opts.study,
             timed: !!opts.timed, start: now, deadline: opts.timed ? now + (opts.seconds || EXAM_SECONDS) * 1000 : null };
  }

  /** 40 questions with exactly `weight` questions from every objective. */
  function buildTest(bank, qstats, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    let ids = [];
    for (const o of Object.keys(bank.objectives)) ids = ids.concat(pickBy(bank.byObj[o], qstats || {}, bank.objectives[o].weight, rand));
    return newSession(bank, "test", "Practice test", shuffle(ids, rand), { timed: opts.timed !== false, seed: opts.seed, now: opts.now });
  }

  function buildDrill(bank, qstats, objs, count, opts) {
    opts = opts || {}; const rand = rng(opts.seed);
    const pool = [].concat(...objs.map(o => bank.byObj[o] || []));
    const ids = pickBy(pool, qstats || {}, count || pool.length, rand);
    const label = objs.length === 1 ? "Drill · " + objs[0] + " " + bank.objectives[objs[0]].name
      : "Drill · " + objs.length + " objectives";
    return newSession(bank, "drill", label, shuffle(ids, rand), { study: opts.study !== false, seed: opts.seed });
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
      state.qstats[id] = st;
    }
    const rec = { id: "t" + now, date: now, mode: s.mode, label: s.label, score: res.score, total: res.total, pct: res.pct,
                  secs: res.secs, timed: s.timed, qids: s.qids, answers: s.answers, optOrder: s.optOrder,
                  flags: Object.keys(s.flags).filter(k => s.flags[k]) };
    state.tests.push(rec);
    // keep full detail for the 30 most recent records
    state.tests.forEach((t, i) => { if (i < state.tests.length - 30) { delete t.qids; delete t.answers; delete t.optOrder; delete t.flags; } });
    addActivity(state, res.answered, now);
    return rec;
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

  function readiness(tests) {
    const full = tests.filter(t => t.mode === "test" && t.total === 40).slice(-3);
    return full.length ? Math.round(full.reduce((n, t) => n + t.pct, 0) / full.length) : null;
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
  function reviewCard(cstate, id, knew, today) {
    today = today == null ? dayNum() : today;
    const s = cstate[id] || { box: 0, seen: 0, right: 0 };
    s.seen++; if (knew) s.right++;
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

  // ------------------------------------------------------------- state
  function freshState() {
    return { v: 3, settings: { theme: "system", timed: true, goal: 20 }, tests: [], qstats: {}, cards: {}, days: {}, current: null };
  }
  /** Bring older saved data (v2 web page) forward. */
  function migrate(raw, legacy) {
    const st = Object.assign(freshState(), raw || {});
    st.settings = Object.assign(freshState().settings, (raw && raw.settings) || {});
    if (!raw && legacy) {
      if (legacy.qstats) st.qstats = legacy.qstats;
      if (Array.isArray(legacy.history)) {
        st.tests = legacy.history.map(h => ({ id: "t" + h.date, date: h.date, mode: h.mode === "random" || h.mode === "form" ? "test" : h.mode,
          label: h.mode === "random" || h.mode === "form" ? "Practice test" : h.label, score: h.score, total: h.total, pct: h.pct, secs: h.secs }));
      }
    }
    return st;
  }

  return { LEVELS, levelStats, levelMix, EXAM_SECONDS, TARGET, BOX_DAYS, rng, shuffle, norm, dayKey, dayNum, indexBank, topicOf, answered, isCorrect,
           priority, newSession, buildTest, buildDrill, buildWeak, objectiveStats, weakObjectives, missedIds, grade,
           recordResult, readiness, cardQueue, reviewCard, deckStats, addActivity, streak, freshState, migrate };
});
