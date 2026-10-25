// SPDX-License-Identifier: AGPL-3.0-or-later
// Run: node tools/test_core.js
const assert = require("assert");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../docs/data/bank.js"));
require(path.join(__dirname, "../docs/data/cards.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const bank = C.indexBank(window.LE_BANK), cards = window.LE_CARDS;
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("bank has 400 questions (ten blueprint sets of 40) and weights sum to 40", () => {
  assert.strictEqual(bank.questions.length, 400); assert.strictEqual(bank.forms.length * 40, bank.questions.length);
  assert.strictEqual(Object.values(bank.objectives).reduce((a, o) => a + o.weight, 0), 40);
});
t("every practice test matches the blueprint exactly", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = C.buildTest(bank, {}, { seed });
    assert.strictEqual(s.qids.length, 40); assert.strictEqual(new Set(s.qids).size, 40);
    const c = {}; s.qids.forEach(id => { const o = bank.byId[id].obj; c[o] = (c[o] || 0) + 1; });
    for (const o in bank.objectives) assert.strictEqual(c[o], bank.objectives[o].weight, o);
  }
});
t("answer keys grade correctly; wrong answers fail; fill-in trims spaces, keeps case", () => {
  for (const q of bank.questions) {
    if (q.type === "fill") { q.accept.forEach(a => assert(C.isCorrect(q, "  " + a + " "), q.id)); assert(!C.isCorrect(q, "zzz")); }
    else {
      assert(C.isCorrect(q, q.answer.slice().reverse()), q.id);
      const wrong = q.options.map((_, i) => i).filter(i => !q.answer.includes(i)).slice(0, q.answer.length);
      assert(!C.isCorrect(q, wrong), q.id);
    }
  }
  assert(!C.isCorrect(bank.byId["2.3-04"], "-r"));
});
t("next test prefers unseen questions", () => {
  const st = C.freshState();
  const s1 = C.buildTest(bank, st.qstats, { seed: 7 });
  C.recordResult(st, bank, s1, C.grade(bank, s1));
  const s2 = C.buildTest(bank, st.qstats, { seed: 8 });
  assert.strictEqual(s1.qids.filter(id => s2.qids.includes(id)).length, 0);
});
t("perfect test scores 100, history and activity recorded", () => {
  const st = C.freshState(); const s = C.buildTest(bank, {}, { seed: 3 });
  s.qids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  const r = C.grade(bank, s); assert.strictEqual(r.pct, 100);
  C.recordResult(st, bank, s, r); assert.strictEqual(st.tests.length, 1);
  assert.strictEqual(st.days[C.dayKey()], 40); assert.strictEqual(C.readiness(st.tests), 100);
});
t("weak drill uses missed questions first", () => {
  const st = C.freshState(); const s = C.buildTest(bank, {}, { seed: 4 });
  C.recordResult(st, bank, s, C.grade(bank, s));           // nothing answered: all missed
  const w = C.buildWeak(bank, st.qstats, 20, { seed: 5 });
  assert.strictEqual(w.qids.length, 20); assert(w.qids.every(id => s.qids.includes(id))); assert(w.study);
  assert(C.weakObjectives(bank, st.qstats).length > 0);
  assert.strictEqual(C.buildWeak(bank, {}, 20), null);
});
t("objective drill stays inside chosen objectives", () => {
  const d = C.buildDrill(bank, {}, ["5.3", "5.4"], 10, { seed: 2 });
  assert.strictEqual(d.qids.length, 10); assert(d.qids.every(id => ["5.3", "5.4"].includes(bank.byId[id].obj)));
});
t("study mode filters by objective, difficulty and source", () => {
  const s = C.buildStudy(bank, {}, { objs: ["3.3"], levels: [3], count: 5 }, { seed: 9 });
  assert.strictEqual(s.qids.length, 5); assert(s.study); assert.strictEqual(s.mode, "study"); assert(!s.deadline);
  assert(s.qids.every(id => bank.byId[id].obj === "3.3" && bank.byId[id].level === 3));
  const all = C.studyPool(bank, {}, {}); assert.strictEqual(all.length, bank.questions.length);
  const qs = { [all[0]]: { seen: 1, right: 0, last: false }, [all[1]]: { seen: 1, right: 1, last: true } };
  assert.deepStrictEqual(C.studyPool(bank, qs, { source: "missed" }), [all[0]]);
  assert.strictEqual(C.studyPool(bank, qs, { source: "unseen" }).length, bank.questions.length - 2);
  assert.strictEqual(C.buildStudy(bank, {}, { source: "missed" }), null);
  const st = C.freshState(); s.hints[s.qids[0]] = 1;
  const rec = C.recordResult(st, bank, s, C.grade(bank, s));
  assert.deepStrictEqual(rec.hints, [s.qids[0]]); assert.strictEqual(C.readiness(st.tests), null);
});
t("every question has a hint that doesn't contain the answer", () => {
  for (const q of bank.questions) {
    assert(q.hint && q.hint.length >= 12, q.id + " has no hint");
    if (q.type === "fill") assert(!q.accept.some(a => a.length > 2 && q.hint.includes(a)), q.id + " hint gives away the answer");
  }
});
t("every wrong option has a 'why not' note, and correct options have none", () => {
  let n = 0;
  for (const q of bank.questions) {
    if (q.type === "fill") { assert(!q.why, q.id + " fill-in has why notes"); continue; }
    assert(Array.isArray(q.why) && q.why.length === q.options.length, q.id + " why array doesn't match options");
    q.options.forEach((_, i) => {
      if (q.answer.includes(i)) assert.strictEqual(q.why[i], null, q.id + " has a note on a correct option");
      else { assert(typeof q.why[i] === "string" && q.why[i].length >= 10, q.id + " option " + i + " has no note"); n++; }
    });
  }
  assert(n > 900, "only " + n + " notes");
});
t("old settings migrate: exam is always timed with answers hidden", () => {
  const st = C.migrate({ settings: { theme: "dark", timed: false, reveal: true } });
  assert.strictEqual(st.settings.theme, "dark"); assert(!("timed" in st.settings)); assert(!("reveal" in st.settings));
  assert.deepStrictEqual(st.settings.study.levels, []); assert.strictEqual(st.settings.study.objMode, "all");
  const st2 = C.migrate({ settings: { study: { objs: ["2.1"], levels: [1, 2], source: "mix", count: 10 } } });
  assert.strictEqual(st2.settings.study.objMode, "pick"); assert.deepStrictEqual(st2.settings.study.levels, []);
  const s = C.buildTest(bank, {}, { seed: 1 }); assert(s.deadline && !s.study); assert.strictEqual(s.label, "Exam");
});
t("daily review: misses return tomorrow, right answers space out", () => {
  const s = {}; const day = 20000;
  C.scheduleQuestion(s, false, day); assert.strictEqual(s.due, day + 1); assert.strictEqual(s.box, 0);
  C.scheduleQuestion(s, true, day + 1); assert.strictEqual(s.box, 1); assert.strictEqual(s.due, day + 2);
  C.scheduleQuestion(s, true, day + 2); assert.strictEqual(s.due, day + 4);
  for (let i = 0; i < 6; i++) C.scheduleQuestion(s, true, day); assert.strictEqual(s.box, 5); assert.strictEqual(s.due, day + 16);
  const st = C.freshState(); const ex = C.buildTest(bank, {}, { seed: 21 });
  const right = ex.qids.slice(0, 30); right.forEach(id => { const q = bank.byId[id]; ex.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  const now = new Date(2026, 9, 10, 12).getTime(), today = C.dayNum(now);
  C.recordResult(st, bank, ex, C.grade(bank, ex, now), now);
  assert.strictEqual(C.dueIds(bank, st.qstats, today).length, 0, "nothing due the same day");
  const f = C.reviewForecast(bank, st.qstats, today); assert.strictEqual(f.tomorrow, 40); assert.strictEqual(f.due, 0);
  const r = C.buildReview(bank, st.qstats, 20, { today: today + 1, seed: 3 });
  assert.strictEqual(r.qids.length, 20); assert.strictEqual(r.mode, "review"); assert(r.study);
  assert(r.qids.every(id => ex.qids.includes(id)));
  assert.strictEqual(C.buildReview(bank, st.qstats, 20, { today }), null);
  const legacy = { "1.1-01": { seen: 1, right: 0, last: false }, "1.1-02": { seen: 1, right: 1, last: true, at: now } };
  assert.deepStrictEqual(C.dueIds(bank, legacy, today), ["1.1-01"]);
});
t("xp, levels, streaks and badges come from saved progress", () => {
  const st = C.freshState();
  assert.strictEqual(C.xpInfo(st).level, 1); assert.strictEqual(C.badgeStatus(st, bank, cards).filter(b => b.done).length, 0);
  const s = C.buildTest(bank, {}, { seed: 31 });
  s.qids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  const now = new Date(2026, 9, 10, 12).getTime();
  C.recordResult(st, bank, s, C.grade(bank, s, s.start + 600000), now);
  const x = C.xpInfo(st); assert.strictEqual(x.xp, 80); assert.strictEqual(x.level, 1); assert.strictEqual(x.next, 100);
  const got = C.awardBadges(st, bank, cards, now).map(b => b.id).sort();
  assert.deepStrictEqual(got, ["first-exam", "obj-1", "perfect", "ready", "speed"]);  // 3.3 (weight 4) all right = mastered
  assert.strictEqual(C.awardBadges(st, bank, cards, now).length, 0, "badges are only awarded once");
  const days = {}; for (let i = 0; i < 5; i++) { const d = new Date(2026, 9, 1 + i); days[C.dayKey(d)] = 30; } days[C.dayKey(new Date(2026, 9, 9))] = 30;
  assert.strictEqual(C.longestStreak(days, 20), 5);
  st.days = days; assert(C.awardBadges(st, bank, cards, now).some(b => b.id === "streak3"));
  assert.deepStrictEqual(C.badgeStatus(st, bank, cards).find(b => b.id === "streak7").progress, [5, 7]);
});
t("finished old labs carry over to their new parts once, without double XP or badges", () => {
  const st = C.freshState(); const t0 = new Date(2026, 9, 1).getTime();
  st.labs = { basics: { done: [0, 1, 2, 3, 4, 5], completedAt: t0 }, files: { done: [0, 1], completedAt: null } };
  const labs = [{ id: "2.1.2-b", from: ["basics"], tasks: [{}, {}, {}] }, { id: "2.4.1-a", from: ["files"], tasks: [{}, {}] }, { id: "x", tasks: [{}] }];
  const xpBefore = C.xpInfo(st).xp;
  assert.strictEqual(C.migrateLabs(st, labs), 1);
  assert.deepStrictEqual(st.labs["2.1.2-b"], { done: [0, 1, 2], completedAt: t0 });
  assert.strictEqual(st.labs["2.4.1-a"], undefined, "unfinished old labs aren't carried over");
  assert.strictEqual(xpBefore, 10, "a finished old lab doesn't count itself; an unfinished one does");
  assert.strictEqual(C.xpInfo(st).xp, 10 + 15, "the new part's tasks count instead");
  assert.strictEqual(C.badgeStatus(st, bank, cards, 3).find(b => b.id === "lab-all").progress[0], 1, "the old lab no longer counts as a lab");
  st.labs["2.1.2-b"] = { done: [] }; assert.strictEqual(C.migrateLabs(st, labs), 0, "a part you restarted isn't credited again");
  global.window = global.window || {}; require(require("path").join(__dirname, "../docs/data/labindex.js"));
  for (const l of window.LE_LABINDEX.parts) for (const id of l.from || []) assert.ok(C.LEGACY_LABS.includes(id), l.id + " lists unknown old lab " + id);
  assert.strictEqual(new Set([].concat(...window.LE_LABINDEX.parts.map(l => l.from || []))).size, C.LEGACY_LABS.length, "every old lab maps to a part");
  const idx = { id: "p", n: 4, from: ["help"] }; const s2 = C.freshState(); s2.labs = { help: { done: [0], completedAt: t0 } };
  C.migrateLabs(s2, [idx]); assert.deepStrictEqual(s2.labs.p.done, [0, 1, 2, 3], "the light lab index (n instead of tasks) works too");
});
t("index.html loads each script and stylesheet by its current content hash (run tools/build.py after editing them)", () => {
  const fs = require("fs"), path = require("path"), crypto = require("crypto"), docs = path.join(__dirname, "../docs");
  const html = fs.readFileSync(path.join(docs, "index.html"), "utf8"); const refs = [...html.matchAll(/(?:src|href)="((?:js|data|css)\/[\w.-]+\.(?:js|css))\?v=(\w+)"/g)];
  assert.ok(refs.length >= 7, "scripts and stylesheet are versioned");
  for (const [, f, v] of refs) assert.strictEqual(v, crypto.createHash("sha256").update(fs.readFileSync(path.join(docs, f))).digest("hex").slice(0, 10), f + " changed: run python3 tools/build.py");
  assert.ok(!/(?:src|href)="(?:js|data|css)\/[\w.-]+\.(?:js|css)"/.test(html), "every local script has a version");
  for (const f in window.LE_LABINDEX.assets) assert.strictEqual(window.LE_LABINDEX.assets[f], crypto.createHash("sha256").update(fs.readFileSync(path.join(docs, f))).digest("hex").slice(0, 10), f + " changed: run python3 tools/build.py");
});
t("question-to-lab links point at real parts of the same objective", () => {
  const X = window.LE_LABINDEX, ids = new Set(X.parts.map(p => p.id));
  assert.ok(Object.keys(X.q).length > 150, "most command questions link to a lab");
  for (const qid in X.q) { const q = bank.byId[qid]; assert.ok(q, "link for unknown question " + qid); assert.ok(X.q[qid].length >= 1 && X.q[qid].length <= 2);
    for (const pid of X.q[qid]) { assert.ok(ids.has(pid), qid + " links to unknown part " + pid); assert.strictEqual(X.parts.find(p => p.id === pid).obj, q.obj); } }
});
t("flashcards: unique ids, both decks, Leitner scheduling", () => {
  assert.strictEqual(new Set(cards.map(c => c.id)).size, cards.length);
  assert(cards.some(c => c.deck === "concepts") && cards.some(c => c.deck === "commands"));
  const cs = {}; const today = 20000;
  const q = C.cardQueue(cards, cs, c => c.deck === "commands", today, 20); assert.strictEqual(q.length, 20);
  C.reviewCard(cs, q[0].id, true, today); assert.strictEqual(cs[q[0].id].box, 1); assert.strictEqual(cs[q[0].id].due, today + 1);
  C.reviewCard(cs, q[1].id, false, today); assert.strictEqual(cs[q[1].id].due, today);
  const q2 = C.cardQueue(cards, cs, c => c.deck === "commands", today, 20);
  assert.strictEqual(q2[0].id, q[1].id, "missed card comes back first");
  assert(!q2.some(c => c.id === q[0].id), "known card not due today");
});
t("streak counts consecutive goal days", () => {
  const days = {}; const now = new Date(2026, 9, 10, 12);
  for (let i = 0; i < 4; i++) { const d = new Date(now); d.setDate(d.getDate() - i); days[C.dayKey(d)] = 25; }
  assert.strictEqual(C.streak(days, 20, now).count, 4);
  delete days[C.dayKey(now)];
  const s = C.streak(days, 20, now); assert.strictEqual(s.count, 3); assert(!s.metToday);
});
t("answers-shown tests are labeled and excluded from readiness", () => {
  const st = C.freshState();
  const s = C.buildTest(bank, {}, { seed: 11, study: true });
  assert(s.study && s.label.includes("answers shown"));
  s.qids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  C.recordResult(st, bank, s, C.grade(bank, s));
  assert.strictEqual(C.readiness(st.tests), null);
  const e = C.buildTest(bank, {}, { seed: 12 }); assert(!e.study);
  C.recordResult(st, bank, e, C.grade(bank, e));
  assert.strictEqual(C.readiness(st.tests), 0);
});
t("v2 history migrates", () => {
  const st = C.migrate(null, { history: [{ mode: "random", label: "Random exam", date: 1, score: 30, total: 40, pct: 75, secs: 100 }], qstats: { "1.1-01": { seen: 1, right: 1, last: true } } });
  assert.strictEqual(st.tests[0].label, "Practice test"); assert.strictEqual(st.qstats["1.1-01"].seen, 1);
});
// ------------------------------------------------------------- pass predictor + exam plan
const answerAll = (frac, acc, seed) => { const q = {}, r = C.rng(seed || 1);
  for (const x of bank.questions) if (r() < frac) { const ok = r() < acc; q[x.id] = { seen: 1, right: ok ? 1 : 0, last: ok }; } return q; };
t("beta-binomial is a probability distribution", () => {
  for (const [n, a, b] of [[1, 1, 1], [3, 2, 5], [7, 10.5, 0.5], [40, 1, 1]]) {
    const d = C.betaBinomial(n, a, b); assert.strictEqual(d.length, n + 1);
    assert(Math.abs(d.reduce((x, y) => x + y, 0) - 1) < 1e-9);
    const mean = d.reduce((m, p, k) => m + k * p, 0); assert(Math.abs(mean - n * a / (a + b)) < 1e-9);
  }
});
t("pass chance needs enough answers, then rises with accuracy", () => {
  const none = C.passPrediction(bank, {}); assert.strictEqual(none.chance, null); assert.strictEqual(none.more, 30);
  let prev = -1;
  for (const acc of [0.5, 0.65, 0.75, 0.85, 0.95]) {
    const p = C.passPrediction(bank, answerAll(0.8, acc));
    assert(p.chance > prev, acc + " should beat the lower accuracy"); prev = p.chance;
    assert(p.low <= p.mean && p.mean <= p.high && p.total === 40 && p.need === 28);
  }
  assert(C.passPrediction(bank, answerAll(0.8, 0.5)).chance < 0.05);
  assert(C.passPrediction(bank, answerAll(0.9, 0.95)).chance > 0.95);
});
t("pass chance stays low when whole topics are unpractised, and points at them", () => {
  const q = {}; bank.questions.filter(x => x.obj < "2").forEach(x => q[x.id] = { seen: 1, right: 1, last: true });
  const p = C.passPrediction(bank, q);
  assert(p.chance < 0.5, "perfect on topic 1 alone gave " + p.chance);
  assert(p.focus.length === 3 && p.focus.every(f => f.obj >= "2" && f.gain > 0));
});
t("the latest answer counts, not the lifetime average", () => {
  const ids = bank.questions.map(x => x.id);
  const fixed = {}, broke = {}; ids.forEach(id => { fixed[id] = { seen: 3, right: 1, last: true }; broke[id] = { seen: 3, right: 2, last: false }; });
  assert(C.passPrediction(bank, fixed).chance > 0.99 && C.passPrediction(bank, broke).chance < 0.01);
});
t("exam plan: countdown, daily target and phases", () => {
  const now = new Date(2026, 9, 10, 12).getTime();
  const st = C.freshState(); assert.strictEqual(C.examPlan(st, bank, now), null);
  st.settings.examDate = "2026-10-32"; assert.strictEqual(C.examPlan(st, bank, now), null);
  st.settings.examDate = "2026-10-22";
  let p = C.examPlan(st, bank, now);
  assert.strictEqual(p.days, 12); assert.strictEqual(p.phase, "learn");
  assert.strictEqual(p.newPerDay, 40); assert.strictEqual(p.target, 40);   // 400 unseen questions over 10 learning days assert.strictEqual(p.milestones.length, 4);
  st.qstats = answerAll(1, 0.9); p = C.examPlan(st, bank, now);
  assert.strictEqual(p.unseen, 0); assert.strictEqual(p.newPerDay, 0); assert(p.milestones.find(m => m.id === "seen").done);
  st.settings.examDate = "2026-10-12"; assert.strictEqual(C.examPlan(st, bank, now).phase, "final");
  st.settings.examDate = "2026-10-10"; assert.strictEqual(C.examPlan(st, bank, now).phase, "today");
  st.settings.examDate = "2026-10-01"; assert.strictEqual(C.examPlan(st, bank, now).phase, "past");
});
t("calendar file is valid iCalendar", () => {
  const now = new Date(2026, 9, 10, 12).getTime();
  const ics = C.examIcs("2026-11-14", { time: "7:30", url: "https://example.org/exit0/", now });
  const lines = ics.split("\r\n"); assert.strictEqual(lines.pop(), "");
  assert.strictEqual(lines[0], "BEGIN:VCALENDAR"); assert.strictEqual(lines[lines.length - 1], "END:VCALENDAR");
  assert(!/[^\r]\n/.test(ics), "bare LF"); assert(lines.every(l => l.length <= 75), "unfolded line");
  for (const k of ["DTSTART;VALUE=DATE:20261114", "DTEND;VALUE=DATE:20261115", "DTSTART:20261010T073000", "RRULE:FREQ=DAILY;UNTIL=20261113T235959"])
    assert(lines.includes(k), "missing " + k);
  assert.strictEqual(lines.filter(l => l === "BEGIN:VEVENT").length, 2);
  assert(lines.some(l => l.startsWith("SUMMARY:LPI Linux Essentials (010-160) exam")));
  const noReminder = C.examIcs("2026-11-14", { time: null, now });
  assert.strictEqual(noReminder.split("BEGIN:VEVENT").length - 1, 1);
  assert.strictEqual(C.examIcs("2026-10-10", { now }).split("BEGIN:VEVENT").length - 1, 1, "no daily reminder on exam day");
  assert.strictEqual(C.examIcs("nope"), null);
});
t("a correct fill answer with an extra leading sudo is flagged, still marked wrong", () => {
  const q = bank.byId["2.4-09"];
  assert(!C.isCorrect(q, "sudo rm -rf old_logs")); assert(C.extraSudo(q, "sudo rm -rf old_logs")); assert(C.extraSudo(q, "  sudo  rm -r old_logs "));
  assert(!C.extraSudo(q, "rm -rf old_logs"), "right answers aren't flagged"); assert(!C.extraSudo(q, "sudo rmdir old_logs"), "wrong commands aren't flagged");
  for (const q2 of bank.questions) if (q2.type === "fill") for (const a of q2.accept) assert(!C.extraSudo(q2, a), q2.id + " accepted answer flagged");
});
console.log(`\n${n} tests passed`);
