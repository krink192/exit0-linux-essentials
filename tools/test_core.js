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
t("an exam or study set never holds two questions that give each other away (same conflict set)", () => {
  const sets = ids => ids.map(id => bank.byId[id].conflict).filter(x => x != null);
  const clash = ids => sets(ids).length - new Set(sets(ids)).size;
  assert(bank.questions.filter(q => q.conflict != null).length > 100);
  for (const q of bank.questions) if (q.conflict != null) assert(bank.questions.some(p => p !== q && p.conflict === q.conflict && p.obj === q.obj), q.id);
  for (let seed = 1; seed <= 200; seed++) {
    assert.strictEqual(clash(C.buildTest(bank, {}, { seed }).qids), 0, "exam, seed " + seed);
    for (const count of [10, 20, 40]) assert.strictEqual(clash(C.buildStudy(bank, {}, { count }, { seed }).qids), 0, "study " + count + ", seed " + seed);
    assert.strictEqual(clash(C.buildStudy(bank, {}, { objs: ["3.1"], count: 5 }, { seed }).qids), 0, "one objective, seed " + seed);
  }
  // still true when most of the bank has been seen and only a few unseen questions are left to prefer
  const qs = {}; bank.questions.forEach((q, i) => { if (i % 7) qs[q.id] = { seen: 2, right: i % 3 ? 2 : 1, last: !!(i % 3) }; });
  for (let seed = 1; seed <= 100; seed++) assert.strictEqual(clash(C.buildTest(bank, qs, { seed }).qids), 0);
  // when only conflicting questions are left, they are used rather than coming up short
  const pair = bank.questions.filter(q => q.conflict === bank.questions.find(x => x.conflict != null).conflict).map(q => q.id);
  assert.strictEqual(C.buildStudy(bank, {}, { ids: pair, count: pair.length }, { seed: 1 }).qids.length, pair.length);
  assert.strictEqual(C.buildStudy(bank, {}, { objs: ["4.1"], count: 10 }, { seed: 1 }).qids.length, 10);
});
t("pass prediction always lists focus objectives, also before there is enough data (Progress reads it)", () => {
  const st = C.freshState(), s = C.buildStudy(bank, {}, { count: 10 }, { seed: 1 });
  s.qids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  C.recordResult(st, bank, s, C.grade(bank, s));
  const p = C.passPrediction(bank, st.qstats);
  assert.strictEqual(p.chance, null); assert.strictEqual(p.more, 20); assert.deepStrictEqual(p.focus, []);
  assert.deepStrictEqual(C.passPrediction(bank, {}).focus, []);
});
t("a saved session survives a bank update that removed one of its questions", () => {
  const s = C.buildStudy(bank, {}, { count: 5 }, { seed: 1 }), ids = s.qids.slice();
  assert.strictEqual(C.repairSession(bank, s), s); assert.deepStrictEqual(s.qids, ids);
  s.qids[1] = "9.9-99"; s.cur = 3;
  const r = C.repairSession(bank, s);
  assert.deepStrictEqual(r.qids, [ids[0], ids[2], ids[3], ids[4]]); assert.strictEqual(r.qids[r.cur], ids[3]);
  s.qids = ["9.9-98", ids[0]]; s.cur = 0; assert.strictEqual(C.repairSession(bank, s).cur, 0);
  assert.strictEqual(C.repairSession(bank, { qids: ["9.9-99"] }), null);
  assert.strictEqual(C.repairSession(bank, null), null); assert.strictEqual(C.repairSession(bank, { qids: "x" }), null);
});
t("progress from storage, an export code or a sync server is rebuilt with safe types; valid progress is unchanged", () => {
  const X = "<img src=x onerror=alert(1)>", walk = (v, f) => { f(v); if (v && typeof v === "object") for (const k in v) { f(k); walk(v[k], f); } };
  const noMarkup = v => walk(v, x => assert(typeof x !== "string" || !x.includes("<") || x === X.slice(0, 200), "markup survived: " + x));
  // a real, well-used state comes back exactly as it went in
  const st = C.freshState();
  for (let i = 0; i < 3; i++) { const s = i ? C.buildTest(bank, st.qstats, { seed: i }) : C.buildStudy(bank, {}, { count: 10 }, { seed: 9 });
    s.qids.forEach((id, n) => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : n % 3 ? q.answer : [0]; }); s.flags[s.qids[0]] = true; s.hints[s.qids[1]] = 1;
    C.recordResult(st, bank, s, C.grade(bank, s), 1.7e12 + i * 864e5); }
  C.reviewCard(st.cards, cards[0].id, true, C.dayNum(1.7e12), 1.7e12); C.recordDrill(st, "echo-var", false, 1.7e12);
  st.labs["2.1.1-a"] = { done: [0, 2], completedAt: 5 }; st.badges.ready = 1.7e12; st.settings.examDate = "2027-01-20"; st.current = C.buildStudy(bank, {}, { count: 5 }, { seed: 3 });
  const round = JSON.parse(JSON.stringify(st));
  assert.deepStrictEqual(C.migrate(JSON.parse(JSON.stringify(st))), round);
  assert.deepStrictEqual(C.cleanDoc(JSON.parse(JSON.stringify(C.ownPart(st, C.mergeStates([]), {})))), JSON.parse(JSON.stringify(C.ownPart(st, C.mergeStates([]), {}))));
  // hostile values: markup in every text slot, wrong types everywhere, prototype keys
  const bad = JSON.parse(JSON.stringify(st));
  Object.assign(bad.tests[0], { score: X, total: X, pct: X, secs: X, id: 't"><b>', label: X, mode: X, qids: [X, "1.1-01"], flags: X, answers: { "1.1-01": { a: X } } });
  bad.tests.push({ id: "t9", score: X, extra: X, nested: { a: X } }, X, null, 7);
  bad.qstats[X] = { seen: 1 }; bad.qstats["1.1-01"] = { seen: X, right: -5, last: X, box: 99, due: X, at: X, note: X };
  bad.qstats["__proto__x"] = X; bad.cards = X; bad.days = { "2026-11-10": X, [X]: 3, "2026-11-09": 4 }; bad.badges = { ready: X, [X]: 1 };
  bad.labs = { "2.1.1-a": { done: [X, 1, 1, -2, 1.5], completedAt: X }, p2: X };
  bad.settings = { theme: X, goal: 0, review: X, examDate: X, remindAt: X, deck: X, study: { objMode: X, objs: X, levels: [X, 9, 2], source: X, count: X }, cmd: { mode: X, cmds: [X, 5], count: X, source: X }, junk: X };
  bad.current = { qids: [X], start: X };
  const m = C.migrate(JSON.parse(JSON.stringify(bad)));
  const t0 = m.tests.find(t => t.label === X.slice(0, 200));     // the label stays text; the app escapes it when shown
  assert(!m.tests.some(t => /[<"]/.test(t.id))); assert.strictEqual(m.tests.filter(t => t.id === "t9").length, 1); assert.strictEqual(m.tests.find(t => t.id === "t9").score, 0);
  for (const t of m.tests) { for (const k of ["score", "total", "pct", "secs", "date"]) assert(Number.isFinite(t[k]), k); assert(/^[a-z]+$/.test(t.mode)); delete t.label; }
  noMarkup(m.tests); noMarkup(m.qstats); noMarkup(m.cards); noMarkup(m.days); noMarkup(m.badges); noMarkup(m.labs); noMarkup(m.settings);
  assert.deepStrictEqual(m.qstats["1.1-01"], { seen: 0, right: 0, last: null, box: 5 });
  assert.deepStrictEqual(m.days, { "2026-11-09": 4 }); assert.deepStrictEqual(m.badges, {}); assert.deepStrictEqual(m.labs, { "2.1.1-a": { done: [1] } });
  assert.deepStrictEqual(m.cards, {}); assert.strictEqual(m.current, null);
  assert.deepStrictEqual([m.settings.theme, m.settings.goal, m.settings.examDate, m.settings.remindAt, m.settings.deck], ["system", 1, null, "19:00", "concepts"]);
  assert.deepStrictEqual(m.settings.review, { on: false, size: 20, fresh: 5 });
  assert.deepStrictEqual(m.settings.study, { objMode: "all", objs: [], levels: [], source: "mix", count: 0 });
  assert.deepStrictEqual(m.settings.cmd, { source: "recommended", cmds: [X], count: 1, mode: "guided" });   // command names are text, escaped when shown
  assert.strictEqual(typeof C.streak(m.days, m.settings.goal).count, "number");                                            // a goal of 0 used to spin forever
  // the same through an export code and through a sync merge
  const imp = C.importState(C.freshState(), Object.assign({ app: "le010" }, JSON.parse(JSON.stringify(bad))));
  assert.strictEqual(imp.settings.goal, 1); noMarkup(imp.qstats); noMarkup(imp.labs); assert(imp.tests.every(t => Number.isFinite(t.score)));
  assert.strictEqual(C.importState(C.freshState(), { app: "other", tests: [] }), null); assert.strictEqual(C.importState(C.freshState(), X), null);
  const target = C.freshState(); C.applyMerged(target, C.mergeStates([C.cleanDoc(JSON.parse(JSON.stringify(bad)))]));
  assert.strictEqual(target.settings.goal, 1); noMarkup(target.qstats); noMarkup(target.days); assert(target.tests.every(t => Number.isFinite(t.pct)));
  const raw = C.freshState(); C.applyMerged(raw, JSON.parse(JSON.stringify(bad)));                       // even an unclean view is cleaned on the way in
  noMarkup(raw.qstats); noMarkup(raw.labs); assert.strictEqual(raw.settings.goal, 1); assert.deepStrictEqual(raw.cards, {});
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
t("weak objectives are found from missed answers", () => {
  const st = C.freshState(); const s = C.buildTest(bank, {}, { seed: 4 });
  C.recordResult(st, bank, s, C.grade(bank, s));           // nothing answered: all missed
  assert(C.weakObjectives(bank, st.qstats).length > 0);
  assert.strictEqual(C.missedIds(bank, st.qstats).length, 40);
});
// ---- every set that mixes objectives follows the exam's weights (weight = questions on the real exam)
const W = o => bank.objectives[o].weight, OBJS = Object.keys(bank.objectives);
t("study sets that mix objectives follow the exam weights: exact at 40 and 80, within one question otherwise", () => {
  for (const count of [5, 10, 20, 30, 40, 80, 100]) {
    const mean = {};
    for (let seed = 1; seed <= 300; seed++) {
      const s = C.buildStudy(bank, {}, { count }, { seed }), c = C.objCounts(bank, s.qids);
      assert.strictEqual(s.qids.length, count); assert.strictEqual(new Set(s.qids).size, count);
      for (const o of OBJS) {
        const share = count * W(o) / 40, k = c[o] || 0; mean[o] = (mean[o] || 0) + k / 300;
        assert(k >= Math.floor(share) && k <= Math.ceil(share), `${count} questions: ${o} got ${k}, share is ${share}`);
      }
    }
    // short sets can't hold every objective, so the weights hold on average: no objective is favoured or left out
    for (const o of OBJS) assert(Math.abs(mean[o] - count * W(o) / 40) < 0.12, `${count} questions: ${o} averages ${mean[o].toFixed(2)}, share is ${count * W(o) / 40}`);
  }
});
t("the weights apply inside any choice of objectives, difficulty or source", () => {
  const two = C.objCounts(bank, C.buildStudy(bank, {}, { objs: ["3.3", "1.3"], count: 10 }, { seed: 1 }).qids);
  assert.deepStrictEqual(two, { "1.3": 2, "3.3": 8 });                       // weights 1 and 4
  const topic2 = C.objCounts(bank, C.buildStudy(bank, {}, { objs: ["2.1", "2.2", "2.3", "2.4"], count: 18 }, { seed: 2 }).qids);
  assert.deepStrictEqual(topic2, { "2.1": 6, "2.2": 4, "2.3": 4, "2.4": 4 });  // weights 3, 2, 2, 2
  for (let seed = 1; seed <= 50; seed++) {                                   // one difficulty level: fewer questions per objective to draw on
    const s = C.buildStudy(bank, {}, { levels: [3], count: 40 }, { seed });
    assert.strictEqual(s.qids.length, 40); assert(s.qids.every(id => bank.byId[id].level === 3));
    const c = C.objCounts(bank, s.qids);
    for (const o of OBJS) assert(c[o] === bank.byObj[o].filter(id => bank.byId[id].level === 3).length || c[o] >= W(o), o + " is short of its share while it has questions left");
  }
  // missed questions: an objective with too few misses gives all it has and the rest goes to the others by weight
  const qs = {}; const miss = (o, n) => bank.byObj[o].slice(0, n).forEach(id => { qs[id] = { seen: 1, right: 0, last: false }; });
  miss("1.3", 1); miss("3.3", 10); miss("4.3", 10);
  for (let seed = 1; seed <= 50; seed++) {
    const c = C.objCounts(bank, C.buildStudy(bank, qs, { source: "missed", count: 8 }, { seed }).qids);
    assert.strictEqual((c["1.3"] || 0) + c["3.3"] + c["4.3"], 8);
    assert(c["3.3"] >= 4 && c["3.3"] <= 5 && c["4.3"] >= 3 && c["4.3"] <= 4, JSON.stringify(c));   // shares: 1, 4 and 3 out of 8
  }
  assert.strictEqual(C.buildStudy(bank, qs, { source: "missed", count: 40 }, { seed: 1 }).qids.length, 21);   // fewer than asked: all of them
});
t("apportion: totals, caps and leftovers", () => {
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const items = OBJS.map(o => ({ key: o, weight: W(o), cap: bank.byObj[o].length }));
  for (let n = 0; n <= 400; n += 7) for (const seed of [1, 2, 3]) {
    const out = C.apportion(n, items, C.rng(seed));
    assert.strictEqual(sum(out), n); items.forEach(x => assert(out[x.key] >= 0 && out[x.key] <= x.cap));
  }
  assert.deepStrictEqual(C.apportion(40, items, C.rng(1)), Object.fromEntries(OBJS.map(o => [o, W(o)])));
  assert.deepStrictEqual(C.apportion(10, [{ key: "a", weight: 3, cap: 1 }, { key: "b", weight: 1, cap: 50 }], C.rng(1)), { a: 1, b: 9 });
  assert.deepStrictEqual(C.apportion(10, [{ key: "a", weight: 1, cap: 2 }, { key: "b", weight: 1, cap: 3 }], C.rng(1)), { a: 2, b: 3 });   // asks for more than there is
  assert.deepStrictEqual(C.apportion(5, [{ key: "a", weight: 2, cap: 0 }, { key: "b", weight: 1, cap: 9 }], C.rng(1)), { a: 0, b: 5 });
  assert.deepStrictEqual(C.apportion(0, items, C.rng(1)), Object.fromEntries(OBJS.map(o => [o, 0])));
});
t("daily review: when more is due than fits, the due questions are split by exam weight, oldest first inside each objective", () => {
  const today = C.dayNum(), st = C.freshState(); st.settings.review = { on: true, size: 20, fresh: 0 };
  bank.questions.forEach((q, i) => { st.qstats[q.id] = { seen: 1, right: 0, last: false, box: 0, due: today - 1 - (i % 5) }; });   // all 400 due
  const mean = {};
  for (let seed = 1; seed <= 200; seed++) {
    const s = C.buildReview(bank, st, { seed, today }), c = C.objCounts(bank, s.qids);
    assert.strictEqual(s.qids.length, 20);
    for (const o of OBJS) { const share = 20 * W(o) / 40, k = c[o] || 0; mean[o] = (mean[o] || 0) + k / 200; assert(k >= Math.floor(share) && k <= Math.ceil(share), o + " got " + k);
      const mine = s.qids.filter(id => bank.byId[id].obj === o), worst = Math.max(...mine.map(id => st.qstats[id].due), -Infinity);
      assert(bank.byObj[o].filter(id => st.qstats[id].due < worst).every(id => mine.includes(id)), o + ": an older due question was skipped"); }
  }
  for (const o of OBJS) assert(Math.abs(mean[o] - 20 * W(o) / 40) < 0.12, o);
  // fewer due than the batch: all of them, whatever their objective
  const few = C.freshState(); few.settings.review = { on: true, size: 20, fresh: 0 };
  bank.byObj["1.3"].forEach(id => { few.qstats[id] = { seen: 1, right: 0, last: false, box: 0, due: today }; });
  assert.strictEqual(C.buildReview(bank, few, { seed: 1, today }).qids.filter(id => few.qstats[id]).length, 10);
});
t("daily review: new questions cover the bank in step with the exam weights (never more than one question off)", () => {
  const c = {};
  C.newIds(bank, {}, bank.questions.length, C.rng(1)).forEach((id, i) => {
    const o = bank.byId[id].obj; c[o] = (c[o] || 0) + 1;
    for (const x of OBJS) assert(Math.abs((c[x] || 0) - (i + 1) * W(x) / 40) <= 1, `after ${i + 1} new questions ${x} has ${c[x] || 0}`);
  });
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
  st.settings.review = { on: true, size: 20, fresh: 0 };
  const r = C.buildReview(bank, st, { today: today + 1, seed: 3 });
  assert.strictEqual(r.qids.length, 20); assert.strictEqual(r.mode, "review"); assert(r.study);
  assert(r.qids.every(id => ex.qids.includes(id)));
  const legacy = { "1.1-01": { seen: 1, right: 0, last: false }, "1.1-02": { seen: 1, right: 1, last: true, at: now } };
  assert.deepStrictEqual(C.dueIds(bank, legacy, today), ["1.1-01"]);
});
t("daily review is the size the learner picks, not the whole backlog", () => {
  const now = new Date(2026, 9, 10, 12).getTime(), today = C.dayNum(now);
  const st = C.freshState();
  assert.deepStrictEqual(st.settings.review, { on: false, size: 20, fresh: 5 });
  bank.questions.slice(0, 200).forEach(q => { st.qstats[q.id] = { seen: 1, right: 1, last: true, at: 1, box: 1, due: today - 10 }; });
  assert.strictEqual(C.dailyReview(bank, st, today).left, 0, "off by default: nothing scheduled, no counts");
  assert.strictEqual(C.buildReview(bank, st, { today }), null);
  st.settings.examDate = "2026-10-22"; assert(!C.examPlan(st, bank, now).milestones.some(m => m.id === "due"), "no review milestone while off");
  st.settings.review.on = true; assert(C.examPlan(st, bank, now).milestones.some(m => m.id === "due"));
  // 200 questions answered long ago: all overdue
  bank.questions.slice(0, 200).forEach(q => { st.qstats[q.id] = { seen: 1, right: 1, last: true, at: now - 86400000 * 30, box: 1, due: today - 10 }; });
  let d = C.dailyReview(bank, st, today);
  assert.strictEqual(d.backlog, 200); assert.strictEqual(d.left, 20); assert.strictEqual(d.due, 15); assert.strictEqual(d.fresh, 5);
  const s1 = C.buildReview(bank, st, { today, seed: 1 });
  assert.strictEqual(s1.qids.length, 20); assert.strictEqual(new Set(s1.qids).size, 20);
  assert.strictEqual(s1.qids.filter(id => !st.qstats[id]).length, 5, "five new questions mixed in");
  // finish 12 of them: 8 left today, same mix
  const part = Object.assign({}, s1, { answers: {} }); s1.qids.slice(0, 12).forEach(id => { const q = bank.byId[id]; part.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  C.recordResult(st, bank, part, C.grade(bank, part, now), now);
  d = C.dailyReview(bank, st, today);
  assert.strictEqual(d.done, 12); assert.strictEqual(d.left, 8); assert.strictEqual(d.due + d.fresh, 8);
  const rest = C.buildReview(bank, st, { today, seed: 2 }); assert.strictEqual(rest.qids.length, 8);
  rest.qids.forEach(id => { const q = bank.byId[id]; rest.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
  C.recordResult(st, bank, rest, C.grade(bank, rest, now), now);
  d = C.dailyReview(bank, st, today); assert.strictEqual(d.left, 0, "done for today");
  assert.strictEqual(C.buildReview(bank, st, { today }), null);
  assert.strictEqual(C.buildReview(bank, st, { today, count: 10, seed: 4 }).qids.length, 10, "extra on request");
  assert.strictEqual(C.dailyReview(bank, st, today + 1).left, 20, "fresh batch tomorrow");
  // the user's choice is kept and clamped
  st.settings.review = { on: true, size: 10, fresh: 50 }; assert.deepStrictEqual(C.clampReview(st.settings.review), { on: true, size: 10, fresh: 10 });
  assert.deepStrictEqual(C.clampReview({ on: "yes", size: 1, fresh: -3 }), { on: false, size: C.REVIEW_SIZE_MIN, fresh: 0 });
  assert.deepStrictEqual(C.clampReview({ size: "x" }), { on: false, size: 20, fresh: 5 });
  assert.deepStrictEqual(C.migrate({ settings: {} }).settings.review, { on: false, size: 20, fresh: 5 }, "existing users start with it off too");
});
t("daily review always has something new: fills with new questions when little is due", () => {
  const today = 20500, st = C.freshState(); st.settings.review.on = true;
  let d = C.dailyReview(bank, st, today);
  assert.strictEqual(d.left, 20); assert.strictEqual(d.fresh, 20, "first day: all new");
  st.settings.review = { on: true, size: 20, fresh: 0 };
  assert.strictEqual(C.dailyReview(bank, st, today).fresh, 20, "nothing due: new questions fill the day even at 0 new");
  st.settings.review = { on: true, size: 20, fresh: 5 };
  // everything seen, three due: just those three
  bank.questions.forEach((q, i) => { st.qstats[q.id] = { seen: 1, right: 1, last: true, at: 1, box: 2, due: i < 3 ? today : today + 5 }; });
  d = C.dailyReview(bank, st, today); assert.strictEqual(d.left, 3); assert.strictEqual(d.fresh, 0);
});
t("new questions spread across objectives, least-seen first, easier first", () => {
  const ids = C.newIds(bank, {}, 19, C.rng ? C.rng(5) : Math.random);
  assert.strictEqual(new Set(ids.map(id => bank.byId[id].obj)).size, Math.min(19, Object.keys(bank.objectives).length), "one per objective before any repeats");
  const all = C.newIds(bank, {}, 1000, Math.random); assert.strictEqual(all.length, bank.questions.length);
  const qs = {}; bank.byObj["1.1"].forEach(id => qs[id] = { seen: 1, right: 1 });
  assert(!C.newIds(bank, qs, 18, Math.random).some(id => bank.byId[id].obj === "1.1"), "a fully seen objective gives none");
  const first = bank.byId[C.newIds(bank, {}, 1, Math.random)[0]];
  assert.strictEqual(first.level || 1, Math.min(...bank.byObj[first.obj].map(id => bank.byId[id].level || 1)));
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
t("the service worker's offline snapshot lists every file of this build by its current hash, and nothing from other sites", () => {
  const fs = require("fs"), path = require("path"), crypto = require("crypto"), docs = path.join(__dirname, "../docs");
  const hash = f => crypto.createHash("sha256").update(fs.readFileSync(path.join(docs, f))).digest("hex").slice(0, 10);
  const sw = fs.readFileSync(path.join(docs, "sw.js"), "utf8"), html = fs.readFileSync(path.join(docs, "index.html"), "utf8");
  const list = JSON.parse(/const PRECACHE = (\[.*\]);/.exec(sw)[1]), name = /const CACHE = "(exit0-\w{10})";/.exec(sw)[1];
  assert.notStrictEqual(name, "exit0-0000000000", "run python3 tools/build.py");
  const has = f => list.some(u => u.split("?")[0] === f);
  for (const u of list) { const [f, v] = u.split("?v="); assert(fs.existsSync(path.join(docs, f)), f + " is listed but missing"); if (v) assert.strictEqual(v, hash(f), f + " changed: run python3 tools/build.py"); }
  for (const [, f] of html.matchAll(/(?:src|href)="((?:js|data|css)\/[\w.-]+\.(?:js|css))\?v=\w+"/g)) assert(list.includes(f + "?v=" + hash(f)), f + " is loaded by index.html but not in the snapshot");
  for (const f in window.LE_LABINDEX.assets) assert(list.includes(f + "?v=" + hash(f)), f + " is loaded on demand but not in the snapshot");
  for (const f of ["index.html", "manifest.webmanifest"].concat(fs.readdirSync(path.join(docs, "fonts")).filter(n => n.endsWith(".woff2")).map(n => "fonts/" + n),
    fs.readdirSync(path.join(docs, "icons")).map(n => "icons/" + n))) assert(has(f), f + " is not in the snapshot");
  const css = fs.readFileSync(path.join(docs, "css/styles.css"), "utf8");
  for (const [, f] of css.matchAll(/url\(\.\.\/(fonts\/[\w.-]+)\)/g)) assert(has(f), f + " is used by the stylesheet but not in the snapshot");
  // a build that changes any file gets a new cache name (the build hashes the list and the unversioned files into it)
  assert(!/skipWaiting/.test(sw.replace(/\/\/.*$/gm, "")), "a new build must wait for the app to be reopened, not swap files under a running page");
  // nothing is loaded from another site: no font CDN, no inline script, and a policy that says so
  assert(!/https?:\/\/(?!www\.w3\.org)[^"' ]+\.(css|js|woff2?)/.test(html) && !/fonts\.(googleapis|gstatic)/.test(html + css + sw), "a file is loaded from another site");
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), "index.html has an inline script");
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  for (const want of ["default-src 'self'", "script-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'none'"]) assert(csp.split(/;\s*/).includes(want), "policy is missing: " + want);
  assert(!/script-src[^;]*unsafe/.test(csp), "scripts must not allow inline or eval");
  const app = fs.readFileSync(path.join(docs, "js/app.js"), "utf8");
  assert(!/\son\w+\s*=\s*["'\\]/.test(app.replace(/\.on\w+\s*=/g, "")), "app.js builds markup with an inline event handler, which the policy blocks");
  const nginx = fs.readFileSync(path.join(__dirname, "../docker/nginx.conf"), "utf8");
  assert(nginx.includes(csp), "docker/nginx.conf sends a different policy than index.html");
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
t("command panel links: related questions, flashcards and study by question ids", () => {
  global.window.LE_LABINDEX || require(path.join(__dirname, "../docs/data/labindex.js"));
  const L = window.LE_LABINDEX, cmds = [...new Set(L.skills.map(s => s.cmd))];
  const rq = c => C.relatedQuestions(bank, L.cmdq, c);
  assert(rq("grep").includes("3.2-15"), "an answer option that starts with grep counts");
  assert(!rq("free").includes("1.3-01"), "the word 'free' in prose isn't the free command");
  assert(!rq("for").includes("1.1-04"), "the word 'for' in prose isn't a for loop");
  for (const c of cmds) for (const id of L.cmdq[c] || []) assert(rq(c).includes(id), c + " keeps its type-the-command questions");
  for (const c of ["grep", "tar", "chmod", "cd", "PATH", "pipes", "test", "for", "free", "id", "head/tail"]) assert(rq(c).length, c + " links to exam questions");
  const kc = C.relatedCards(cards, "tar"); assert(kc.length && kc.every(id => /tar/.test(cards.find(c => c.id === id).front)), "tar cards are about tar");
  const ids = rq("grep"), s = C.buildStudy(bank, {}, { ids, count: 50, label: "Questions about grep" }, { seed: 3 });
  assert.strictEqual(s.qids.length, ids.length); assert(s.qids.every(id => ids.includes(id))); assert(/grep/.test(s.label));
});
console.log(`\n${n} tests passed`);
