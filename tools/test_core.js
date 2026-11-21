// SPDX-License-Identifier: AGPL-3.0-or-later
// Run: node tools/test_core.js
const assert = require("assert");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../docs/data/bank.js"));
require(path.join(__dirname, "../docs/data/cards.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const bank = C.indexBank(window.LE_BANK), cards = window.LE_CARDS;
// the ten fixed sets only: for tests that follow single questions through the review schedule, where a variant would be swapped in
const sets = C.indexBank(Object.assign({}, window.LE_BANK, { questions: window.LE_BANK.questions.filter(q => !q.variantOf) }));
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("bank has 400 questions in ten blueprint sets of 40, plus variants outside the sets, and weights sum to 40", () => {
  const sets = bank.questions.filter(q => q.form), variants = bank.questions.filter(q => q.variantOf);
  assert.strictEqual(sets.length, 400); assert.strictEqual(bank.forms.length * 40, sets.length);
  assert.strictEqual(sets.length + variants.length, bank.questions.length); assert(variants.length >= 50);
  assert(variants.every(q => !q.form), "a variant belongs to no fixed exam");
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
  assert.strictEqual(p.chance, null); assert.strictEqual(p.more, 30); assert.deepStrictEqual(p.focus, []);
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
  bad.qstats[X] = { seen: 1 }; bad.qstats["1.1-01"] = { seen: X, right: -5, last: X, box: 99, due: X, at: X, note: X, conf: X, cw: -1, cdays: [X, 10, "y"], cdrop: ["z", 11, -3] };
  bad.tests[0].conf = { "1.1-01": X, "bad": true, [X]: false };
  bad.qstats["__proto__x"] = X; bad.cards = X; bad.days = { "2026-11-10": X, [X]: 3, "2026-11-09": 4 }; bad.badges = { ready: X, [X]: 1 };
  bad.labs = { "2.1.1-a": { done: [X, 1, 1, -2, 1.5], completedAt: X }, p2: X };
  bad.settings = { theme: X, scheme: X, goal: 0, review: X, examDate: X, remindAt: X, deck: X, study: { objMode: X, objs: X, levels: [X, 9, 2], source: X, count: X }, cmd: { mode: X, cmds: [X, 5], count: X, source: X }, junk: X };
  bad.current = { qids: [X], start: X };
  const m = C.migrate(JSON.parse(JSON.stringify(bad)));
  const t0 = m.tests.find(t => t.label === X.slice(0, 200));     // the label stays text; the app escapes it when shown
  assert(!m.tests.some(t => /[<"]/.test(t.id))); assert.strictEqual(m.tests.filter(t => t.id === "t9").length, 1); assert.strictEqual(m.tests.find(t => t.id === "t9").score, 0);
  for (const t of m.tests) { for (const k of ["score", "total", "pct", "secs", "date"]) assert(Number.isFinite(t[k]), k); assert(/^[a-z]+$/.test(t.mode)); delete t.label; }
  noMarkup(m.tests); noMarkup(m.qstats); noMarkup(m.cards); noMarkup(m.days); noMarkup(m.badges); noMarkup(m.labs); noMarkup(m.settings);
  assert.deepStrictEqual(m.qstats["1.1-01"], { seen: 0, right: 0, last: null, box: 5, cw: 0, cdays: [10], cdrop: [11] });
  assert.deepStrictEqual((m.tests.find(t => t.conf) || { conf: {} }).conf, {});   // non-boolean conf values dropped
  assert.deepStrictEqual(m.days, { "2026-11-09": 4 }); assert.deepStrictEqual(m.badges, {}); assert.deepStrictEqual(m.labs, { "2.1.1-a": { done: [1] } });
  assert.deepStrictEqual(m.cards, {}); assert.strictEqual(m.current, null);
  assert.deepStrictEqual([m.settings.theme, m.settings.scheme, m.settings.goal, m.settings.examDate, m.settings.remindAt, m.settings.deck], ["system", "green", 1, null, "19:00", "concepts"]);
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
// A learner's saved progress, built the way the app builds it, with every stored field filled in.
function usedState() {
  const st = C.freshState(), now = 1.7e12;
  const study = C.buildStudy(bank, {}, { count: 8 }, { seed: 9, now });
  study.qids.forEach((id, n) => {
    const q = bank.byId[id];
    study.answers[id] = q.type === "fill" ? q.accept[0] : n % 2 ? q.answer : [0];
    if (n === 0) study.conf[id] = true;
  });
  study.flags[study.qids[0]] = true; study.hints[study.qids[1]] = 1;
  C.recordResult(st, bank, study, C.grade(bank, study, now), now);
  const exam = C.buildTest(bank, st.qstats, { seed: 2, form: "C", now: now + 864e5 });
  exam.qids = exam.qids.slice(0, 4);
  const order = {};
  exam.qids.forEach(id => {
    if (exam.optOrder[id]) order[id] = exam.optOrder[id];
    const q = bank.byId[id]; exam.answers[id] = q.type === "fill" ? q.accept[0] : q.answer;
  });
  exam.optOrder = order;
  C.recordResult(st, bank, exam, C.grade(bank, exam, now + 864e5), now + 864e5);
  st.tests[1].rung = 2; st.tests[1].dontKnow = [st.tests[1].qids[0]];
  const qid = st.tests[0].qids[0];
  Object.assign(st.qstats[qid], { cw: 1, cdays: [10, 11], cdrop: [9] });
  C.reviewCard(st.cards, cards[0].id, true, C.dayNum(now), now);
  C.recordDrill(st, "echo-var", false, now);
  st.labs["2.1.1-a"] = { done: [0, 2], completedAt: 5 };
  st.lx.split = { done: [1], completedAt: 8 };
  st.badges.ready = now;
  C.setMark(st, qid, { on: true, note: "remember this" }, now);
  Object.assign(st.settings, { examDate: "2027-01-20", goal: 12, theme: "dark", scheme: "flexoki", remindAt: "08:30", deck: "commands",
    review: { on: true, size: 15, fresh: 3 },
    study: { objMode: "pick", objs: ["1.1", "2.1"], levels: [2], source: "missed", count: 10 },
    cmd: { source: "pick", cmds: ["ls"], count: 8, mode: "recall" } });
  C.noteEstimate(st, { chance: 0.42, mean: 28, total: 40 }, now);
  st.current = C.buildStudy(bank, {}, { count: 4 }, { seed: 3, now });
  const cur = st.current.qids[0], cq = bank.byId[cur];
  st.current.answers[cur] = cq.type === "fill" ? cq.accept[0] : [0];
  st.current.checked[cur] = true; st.current.dontKnow[cur] = false;
  return JSON.parse(JSON.stringify(st));
}
const BAD_VALUES = [null, true, 0, -1, 1e308, "", "<img src=x>", [], {}];
function jsonPaths(v, prefix, out) {
  out.push(prefix);
  if (v && typeof v === "object") for (const k of Object.keys(v)) jsonPaths(v[k], prefix.concat(k), out);
  return out;
}
function putPath(base, p, val) {
  if (!p.length) return val;
  const copy = JSON.parse(JSON.stringify(base));
  let cur = copy;
  for (let i = 0; i < p.length - 1; i++) cur = cur[p[i]];
  cur[p[p.length - 1]] = val;
  return copy;
}
const badAt = (p, val) => (p.length ? p.join(".") : "(root)") + " = " + JSON.stringify(val);
function firstDiff(a, b, p) {
  if (a === b) return "";
  if (typeof a !== "object" || typeof b !== "object" || !a || !b || Array.isArray(a) !== Array.isArray(b))
    return p + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b);
  if (Array.isArray(a)) {
    if (a.length !== b.length) return p + " length " + a.length + " !== " + b.length;
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], p + "[" + i + "]"); if (d) return d; }
    return "";
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!Object.prototype.hasOwnProperty.call(a, k)) return p + "." + k + " missing after clean";
    if (!Object.prototype.hasOwnProperty.call(b, k)) return p + "." + k + " extra after clean";
    const d = firstDiff(a[k], b[k], p + "." + k); if (d) return d;
  }
  return "";
}
function assertShape(st, label) {
  assert.ok(st && typeof st === "object" && !Array.isArray(st), label);
  assert.strictEqual(st.v, 3, label);
  assert.ok(Array.isArray(st.tests), label);
  for (const k of ["qstats", "cards", "cmdstats", "days", "badges", "labs", "lx", "marks", "estWeeks"])
    assert.ok(st[k] && typeof st[k] === "object" && !Array.isArray(st[k]), label + " " + k);
  const s = st.settings;
  assert.ok(s && typeof s === "object" && !Array.isArray(s), label);
  assert.ok(s.theme === "system" || s.theme === "light" || s.theme === "dark", label + " theme " + JSON.stringify(s.theme));
  assert.ok(["green", "github", "flexoki", "catppuccin", "tokyo", "dracula"].includes(s.scheme), label + " scheme " + JSON.stringify(s.scheme));
  assert.ok(Number.isInteger(s.goal) && s.goal >= C.GOAL_MIN && s.goal <= C.GOAL_MAX, label + " goal " + JSON.stringify(s.goal));
  assert.strictEqual(typeof s.review.on, "boolean", label + " review " + JSON.stringify(s.review));
  assert.ok(Number.isInteger(s.review.size) && s.review.size >= C.REVIEW_SIZE_MIN && s.review.size <= C.REVIEW_SIZE_MAX, label + " review " + JSON.stringify(s.review));
  assert.ok(Number.isInteger(s.review.fresh) && s.review.fresh >= 0 && s.review.fresh <= s.review.size, label + " review " + JSON.stringify(s.review));
  assert.ok(s.examDate === null || /^\d{4}-\d{2}-\d{2}$/.test(s.examDate), label + " examDate " + JSON.stringify(s.examDate));
  assert.strictEqual(typeof s.remindAt, "string", label + " remindAt " + JSON.stringify(s.remindAt));
  assert.ok(s.deck == null || s.deck === "concepts" || s.deck === "commands", label + " deck " + JSON.stringify(s.deck));
  assert.ok(s.study && (s.study.objMode === "all" || s.study.objMode === "weak" || s.study.objMode === "pick"), label + " study " + JSON.stringify(s.study));
  assert.ok(Array.isArray(s.study.objs) && Array.isArray(s.study.levels), label + " study " + JSON.stringify(s.study));
  assert.ok(s.study.levels.every(n => n === 1 || n === 2 || n === 3), label + " levels " + JSON.stringify(s.study.levels));
  assert.ok(["mix", "unseen", "missed", "marked", "unsure"].includes(s.study.source), label + " source " + JSON.stringify(s.study.source));
  assert.ok(Number.isInteger(s.study.count) && s.study.count >= 0 && s.study.count <= 400, label + " count " + JSON.stringify(s.study.count));
  assert.ok(s.cmd && ["recommended", "due", "new", "pick"].includes(s.cmd.source), label + " cmd " + JSON.stringify(s.cmd));
  assert.ok(["guided", "recall", "timed"].includes(s.cmd.mode), label + " cmd " + JSON.stringify(s.cmd));
  assert.ok(Array.isArray(s.cmd.cmds) && Number.isInteger(s.cmd.count) && s.cmd.count >= 1 && s.cmd.count <= 50, label + " cmd " + JSON.stringify(s.cmd));
  assert.ok(st.current === null || (st.current && Array.isArray(st.current.qids) && st.current.qids.length > 0), label);
}
// What boot does with the state after migrate, without a try/catch around migrate itself.
function bootState(st, label) {
  try {
    st.current = C.repairSession(bank, st.current);
    C.rebuildEvidence(bank, st);
    C.migrateLabs(st, []);
    C.awardBadges(st, bank, cards, 1.7e12, 0);
    C.xpInfo(st);
    C.streak(st.days, st.settings.goal);
  } catch (e) { assert.fail(label + " boot: " + e.message); }
}
function assertStable(r, label) {
  const exp = C.exportDoc(r), diff = firstDiff(C.cleanDoc(exp), exp, "export");
  assert.strictEqual(diff, "", label + " " + diff);
}
function assertMerge(doc, label) {
  let view;
  try { view = C.mergeStates([C.cleanDoc(doc)]); }
  catch (e) { assert.fail(label + " mergeStates: " + e.message); }
  assert.ok(Array.isArray(view.tests), label);
  for (const k of ["qstats", "cards", "cmdstats", "days", "badges", "labs", "lx", "marks", "estWeeks", "settings", "settingsTs"])
    assert.ok(view[k] && typeof view[k] === "object" && !Array.isArray(view[k]), label + " " + k);
  assertStable(view, label + " merge");
}
function assertImport(doc, label) {
  const env = doc && typeof doc === "object" && !Array.isArray(doc) ? Object.assign({ app: "le010", v: 3 }, doc) : doc;
  let r;
  try { r = C.importState(C.freshState(), env); }
  catch (e) { assert.fail(label + " importState: " + e.message); }
  const envelope = !!(env && typeof env === "object" && !Array.isArray(env) && env.app === "le010" && Array.isArray(env.tests));
  if (!envelope) { assert.strictEqual(r, null, label); return; }
  assert.ok(r, label + " importState returned null");
  assertShape(r, label + " import"); assertStable(r, label + " import"); bootState(r, label + " import");
}
t("a null study level still opens and keeps the rest of saved progress", () => {
  const base = usedState();
  const damaged = JSON.parse(JSON.stringify(base));
  damaged.settings.study.levels = null;
  const opened = C.migrate(damaged);
  const kept = C.migrate(JSON.parse(JSON.stringify(base)));
  assert.deepStrictEqual(kept.settings.study.levels, [2], "one saved level stays");
  const expect = JSON.parse(JSON.stringify(kept));
  expect.settings.study.levels = [];
  assert.deepStrictEqual(opened, expect);
  assert.deepStrictEqual(kept, base, "clean progress is unchanged by migrate");
  assertShape(opened, "null levels"); assertStable(opened, "null levels"); bootState(opened, "null levels");
});
t("any damaged field falls back and saved progress still opens", () => {
  const base = usedState();
  const paths = jsonPaths(base, [], []);
  assert.ok(paths.length > 50, "expected a full saved state, got " + paths.length + " paths");
  const legacyGood = { mode: "random", label: "Random exam", date: 1, score: 30, total: 40, pct: 75, secs: 100 };
  let legacy;
  try { legacy = C.migrate(null, { history: [null], qstats: { "1.1-01": { seen: 1, right: 1, last: true } } }); }
  catch (e) { assert.fail("legacy null history: " + e.message); }
  assert.deepStrictEqual(legacy.tests, []); assertShape(legacy, "legacy null"); assertStable(legacy, "legacy null");
  const mixed = C.migrate(null, { history: [null, legacyGood].concat(BAD_VALUES), qstats: { "1.1-01": { seen: 1, right: 1, last: true } } });
  assert.strictEqual(mixed.tests.find(t => t.date === 1).label, "Practice test");
  assert.strictEqual(mixed.qstats["1.1-01"].seen, 1);
  assertShape(mixed, "legacy mixed"); assertStable(mixed, "legacy mixed"); bootState(mixed, "legacy mixed");
  for (const bad of BAD_VALUES) {
    let st;
    try { st = C.migrate(null, { history: bad, qstats: bad }); }
    catch (e) { assert.fail("legacy " + JSON.stringify(bad) + ": " + e.message); }
    assertShape(st, "legacy " + JSON.stringify(bad)); assertStable(st, "legacy " + JSON.stringify(bad));
  }
  for (const p of paths) for (const bad of BAD_VALUES) {
    const doc = putPath(base, p, bad), label = badAt(p, bad);
    let opened;
    try { opened = C.migrate(JSON.parse(JSON.stringify(doc))); }
    catch (e) { assert.fail(label + " migrate: " + e.message); }
    assertShape(opened, label); assertStable(opened, label); bootState(opened, label);
    assertImport(doc, label); assertMerge(doc, label);
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
  s1.qids.forEach(id => { const q = bank.byId[id]; s1.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
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
  // Answer every question wrong (blanks no longer write history — see blank-exam test).
  s.qids.forEach(id => {
    const q = bank.byId[id];
    s.answers[id] = q.type === "fill" ? "nope" : [q.answer[0] === 0 ? 1 : 0];
  });
  C.recordResult(st, bank, s, C.grade(bank, s));
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
  const bank = sets;
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
t("fixed practice exams A-J: always the same 40 questions, a full blueprint each, nothing shared between sets", () => {
  const seen = new Set();
  for (const f of "ABCDEFGHIJ") {
    const a = C.buildTest(bank, {}, { form: f, seed: 1 }), b = C.buildTest(bank, { [a.qids[0]]: { seen: 3, right: 0, last: false } }, { form: f, seed: 2 });
    assert.strictEqual(a.label, "Practice exam " + f); assert.strictEqual(a.form, f); assert.strictEqual(a.mode, "test"); assert(a.deadline);
    assert.deepStrictEqual(a.qids.slice().sort(), b.qids.slice().sort());
    assert.deepStrictEqual(C.objCounts(bank, a.qids), Object.fromEntries(OBJS.map(o => [o, W(o)])));
    a.qids.forEach(id => { assert(!seen.has(id), id + " is in two sets"); seen.add(id); });
  }
  assert.strictEqual(seen.size, 400); assert.strictEqual(C.buildTest(bank, {}, { form: "Z" }), null);
  const st = C.freshState(), s = C.buildTest(bank, {}, { form: "C", seed: 1 });
  const rec = C.recordResult(st, bank, s, C.grade(bank, s)); assert.strictEqual(rec.form, "C");
  assert.strictEqual(C.migrate(JSON.parse(JSON.stringify(st))).tests[0].form, "C");
});
t("quick modes: Quick 10, timed quiz, question of the day", () => {
  const q = C.buildQuick(bank, {}, { seed: 1 }); assert.strictEqual(q.qids.length, 10); assert.strictEqual(q.label, "Quick 10"); assert(q.study && !q.deadline);
  const t5 = C.buildTimed(bank, {}, 5, { seed: 1, now: 1000 }), t10 = C.buildTimed(bank, {}, 10, { seed: 1, now: 1000 });
  assert.strictEqual(t5.deadline, 1000 + 300000); assert.strictEqual(t10.deadline, 1000 + 600000); assert.strictEqual(t5.qids.length, 20); assert.strictEqual(t10.qids.length, 40);
  assert(t5.study && t5.mode === "study");
  const today = C.dayNum(), id = C.questionOfDay(bank, today);
  assert.strictEqual(C.questionOfDay(bank, today), id); assert(bank.byId[id]);
  assert(new Set(Array.from({ length: 60 }, (_, i) => C.questionOfDay(bank, today + i))).size > 50, "a different question most days");
  const st = C.freshState(), s = C.buildQotd(bank, { today }); assert.deepStrictEqual(s.qids, [id]);
  assert.strictEqual(C.qotdDone(st.tests, today), false);
  s.answers[id] = bank.byId[id].type === "fill" ? bank.byId[id].accept[0] : bank.byId[id].answer;
  C.recordResult(st, bank, s, C.grade(bank, s), Date.now());
  assert.strictEqual(C.qotdDone(st.tests, today), true); assert.strictEqual(C.qotdDone(st.tests, today + 1), false);
  assert.strictEqual(C.readiness(st.tests), null, "quick modes never count toward readiness");
});
t("Level Up: 8 of 10 moves up a step, steps get harder, progress comes from the history", () => {
  const st = C.freshState(); const play = right => { const s = C.buildLevelUp(bank, st, { seed: st.tests.length + 1 });
    s.qids.forEach((id, i) => { const q = bank.byId[id]; s.answers[id] = i < right ? (q.type === "fill" ? q.accept[0] : q.answer) : (q.type === "fill" ? "zzz" : [q.options.length - 1 === q.answer[0] ? 0 : q.options.length - 1]); });
    return [s, C.recordResult(st, bank, s, C.grade(bank, s))]; };
  assert.deepStrictEqual([C.ladder(st.tests).done, C.ladder(st.tests).next], [0, 1]);
  let [s, rec] = play(7); assert.strictEqual(rec.rung, 1); assert(s.qids.every(id => bank.byId[id].level === 1)); assert.strictEqual(C.ladder(st.tests).next, 1, "7 of 10 stays");
  [s, rec] = play(8); assert.strictEqual(C.ladder(st.tests).next, 2);
  play(10); [s] = play(9); assert(s.qids.every(id => bank.byId[id].level === 2), "step 3 is apply-level"); assert.strictEqual(C.ladder(st.tests).next, 4);
  for (let i = 0; i < 6; i++) play(10);
  const l = C.ladder(st.tests); assert.strictEqual(l.done, 9); assert(l.finished);
  assert.strictEqual(C.ladder(C.migrate(JSON.parse(JSON.stringify(st))).tests).done, 9, "survives a reload");
});
t("Level Up: results say the outcome in words", () => {
  assert.strictEqual(C.levelUpMessage({ rung: 2, pct: 100, score: 10, total: 10 }), "Step 3 unlocked");
  assert.strictEqual(C.levelUpMessage({ rung: 2, pct: 70, score: 7, total: 10 }), "Need 8 of 10: 7 this time. Try step 2 again.");
  assert.strictEqual(C.levelUpMessage({ rung: 9, pct: 80, score: 8, total: 10 }), "Step 9 complete · all 9 steps climbed");
  assert.strictEqual(C.levelUpMessage({ pct: 100, score: 10, total: 10 }), null, "ordinary study has no Level Up line");
});
t("Level Up: ladder treats passed rungs as a set, so date order cannot freeze progress", () => {
  const pass = (rung, date) => ({ id: "lu-" + rung + "-" + date, date, mode: "study", rung, total: 10, pct: 80, score: 8, answered: 10, secs: 0 });
  assert.strictEqual(C.ladder([pass(2, 200), pass(1, 100)]).done, 2, "rung 2 before rung 1 still counts");
  assert.strictEqual(C.ladder([pass(3, 300), pass(1, 100), pass(2, 50)]).next, 4);
  assert.strictEqual(C.ladder([pass(1, 100), { id: "fail", date: 150, rung: 2, total: 10, pct: 70, score: 7 }]).done, 1, "a failed step does not count");
  // Sync merge sorts by date; clock skew can put a later rung earlier in the array.
  const merged = C.mergeStates([C.cleanDoc({ tests: [pass(1, 200)] }), C.cleanDoc({ tests: [pass(2, 100)] })]);
  assert.ok(merged.tests[0].rung === 2 && merged.tests[1].rung === 1, "merge sorted by date");
  assert.strictEqual(C.ladder(merged.tests).done, 2, "date-sorted merge still unlocks step 3");
  // An import whose tests are not sorted must not freeze Level Up either.
  const imported = C.importState(C.freshState(), { app: "le010", tests: [pass(2, 50), pass(1, 200)] });
  assert.strictEqual(C.ladder(imported.tests).done, 2);
});
t("bookmarks and notes: saved, merged across devices (latest change wins), removal travels too", () => {
  const a = C.freshState(), b = C.freshState();
  C.setMark(a, "1.1-01", { on: true }, 100); C.setMark(a, "1.1-02", { note: "RPM = Red Hat <b>" }, 110); C.setMark(b, "1.1-01", { on: true, note: "from b" }, 120); C.setMark(b, "9.9-99", { on: true }, 130);
  assert.deepStrictEqual(C.markedIds(bank, a), ["1.1-02", "1.1-01"]); assert.strictEqual(C.markOf(a, "3.3-01").on, false);
  const docA = C.ownPart(a, C.mergeStates([]), {}), docB = C.ownPart(b, C.mergeStates([]), {});
  C.applyMerged(a, C.mergeStates([docA, docB])); C.applyMerged(b, C.mergeStates([docB, docA]));
  assert.deepStrictEqual(a.marks, b.marks); assert.strictEqual(a.marks["1.1-01"].note, "from b"); assert.strictEqual(a.marks["1.1-02"].note, "RPM = Red Hat <b>");
  C.setMark(b, "1.1-01", { on: false, note: "" }, 200);
  C.applyMerged(a, C.mergeStates([C.ownPart(a, C.mergeStates([docB]), {}), C.ownPart(b, C.mergeStates([]), {})]));
  assert.strictEqual(a.marks["1.1-01"].on, false); assert(!C.markedIds(bank, a).includes("1.1-01"));
  assert.deepStrictEqual(C.ownPart(a, C.mergeStates([C.ownPart(a, C.mergeStates([]), {})]), {}).marks, {}, "nothing to upload when the others already have it");
  const m = C.migrate({ marks: { "1.1-01": { on: "yes", note: 5, at: "x" }, "<x>": { on: true }, "1.1-02": "str" } });
  assert.deepStrictEqual(m.marks, { "1.1-01": { on: false, note: "", at: 0 } });
  assert.strictEqual(C.importState(C.freshState(), { app: "le010", tests: [], marks: { "2.1-01": { on: true, note: "n", at: 5 } } }).marks["2.1-01"].note, "n");
});
t("export code round-trips through import, including bookmarks and notes", () => {
  const st = C.freshState();
  const s = C.buildStudy(bank, {}, { count: 5 }, { seed: 4 });
  const g = C.grade(bank, s); C.recordResult(st, bank, Object.assign({}, s, g), { now: Date.now() });
  C.setMark(st, s.qids[0], { on: true, note: "keep this" }, 50);
  C.setMark(st, s.qids[1], { note: "note only" }, 60);
  st.badges.first = 1; st.labs["1.2.1-a"] = { done: [0], completedAt: 9 };
  const code = C.exportDoc(st);
  assert.ok(code.marks && code.marks[s.qids[0]].on, "export includes marks");
  assert.deepStrictEqual(Object.keys(code).filter(k => k !== "app" && k !== "v").sort(),
    ["badges", "cards", "cmdstats", "days", "estWeeks", "labs", "lx", "marks", "qstats", "settings", "settingsTs", "tests"].sort(),
    "export lists every cleanDoc field");
  const next = C.importState(C.freshState(), JSON.parse(JSON.stringify(code)));
  assert.deepStrictEqual(next.marks, st.marks);
  assert.deepStrictEqual(next.estWeeks, st.estWeeks);
  assert.deepStrictEqual(next.qstats, st.qstats);
  assert.deepStrictEqual(next.tests.map(t => t.id), st.tests.map(t => t.id));
  assert.deepStrictEqual(next.labs, st.labs);
  assert.strictEqual(next.badges.first, 1);
});
t("search finds questions and flashcards by every word", () => {
  const r = C.search(bank, cards, "chmod octal"); assert(r.questions.length > 0); assert(r.questions.every(id => /chmod/i.test(JSON.stringify(bank.byId[id])) && /octal/i.test(JSON.stringify(bank.byId[id]))));
  assert(C.search(bank, cards, "kernel").cards.length > 0);
  assert.deepStrictEqual(C.search(bank, cards, "  ").questions, []); assert.strictEqual(C.search(bank, cards, "zzzqqqxxx").total, 0);
  assert.deepStrictEqual(C.search(bank, cards, "3.2-07").questions, ["3.2-07"]);
  assert(C.search(bank, cards, "the", 5).questions.length === 5 && C.search(bank, cards, "the", 5).more);
});
t("hands-on questions: well-formed, checked correctly, picked by exam weight", () => {
  require(path.join(__dirname, "../docs/data/handson.js")); const H = window.LE_HANDSON;
  assert(H.length >= 30); assert.strictEqual(new Set(H.map(x => x.id)).size, H.length);
  for (const it of H) {
    assert(bank.objectives[it.obj] && it.id.startsWith("ix-" + it.obj + "-"), it.id); assert(it.q && it.ex, it.id);
    assert(!bank.byId[it.id], it.id + " must not collide with the exam bank");
    if (it.type === "match") {
      assert(it.left.length === it.key.length && it.key.every(k => k >= 0 && k < it.right.length), it.id);
      assert(C.checkHandson(it, it.key).ok, it.id);
      const wrong = it.key.slice(); wrong[0] = (wrong[0] + 1) % it.right.length;
      const r = C.checkHandson(it, wrong); assert(!r.ok && r.right === r.total - 1 && r.rows[0] === false, it.id);
      assert(!C.checkHandson(it, it.left.map(() => -1)).ok && !C.checkHandson(it, null).ok);
      assert.deepStrictEqual(C.layoutHandson(it, C.rng(1)).choices.slice().sort((a, b) => a - b), it.right.map((_, i) => i));
    } else {
      assert.strictEqual(it.type, "order"); const key = it.items.map((_, i) => i);
      assert(C.checkHandson(it, key).ok); assert(!C.checkHandson(it, key.slice().reverse()).ok, it.id);
      for (let seed = 1; seed <= 40; seed++) { const o = C.layoutHandson(it, C.rng(seed)).order; assert(!C.checkHandson(it, o).ok, it.id + " starts out solved"); assert.deepStrictEqual(o.slice().sort((a, b) => a - b), key); }
    }
  }
  for (let seed = 1; seed <= 100; seed++) { const p = C.pickHandson(bank, H, {}, 10, C.rng(seed)); assert.strictEqual(new Set(p.map(x => x.id)).size, 10); }
  const stats = {}; H.forEach((it, i) => { if (i % 3) stats[it.id] = { seen: 1, right: i % 2, last: !!(i % 2) }; });
  const fresh = H.filter(it => !stats[it.id]).map(it => it.id), p = C.pickHandson(bank, H, stats, 10, C.rng(3)).map(x => x.id);
  assert(p.filter(id => fresh.includes(id)).length >= 6, "never-tried items come first");
  assert.strictEqual(C.pickHandson(bank, H, {}, 500, C.rng(1)).length, H.length);
  const st = C.freshState(); C.recordDrill(st, H[0].id, true, 1.7e12);
  assert.strictEqual(C.migrate(JSON.parse(JSON.stringify(st))).cmdstats[H[0].id].seen, 1, "results are saved and survive a reload");
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
t("study builder: Bookmarked and Unsure sources combine with objective and level", () => {
  const qA = bank.questions.find(q => q.level === 2), qB = bank.questions.find(q => q.id !== qA.id && q.obj === qA.obj && q.level === 2);
  const qC = bank.questions.find(q => q.obj !== qA.obj && q.level === 1);
  assert(qA && qB && qC, "need three sample questions");
  const marks = { [qA.id]: { on: true, note: "", at: 2 }, [qC.id]: { on: false, note: "keep", at: 1 }, [qB.id]: { on: false, note: "", at: 3 } };
  const qs = {
    [qA.id]: { seen: 1, right: 0, last: false, conf: 0, cw: 0, at: 10 },
    [qB.id]: { seen: 1, right: 1, last: true, conf: 1, cw: 2, at: 11 },   // Sure + cw must stay out of Unsure
    [qC.id]: { seen: 1, right: 0, last: false, conf: 0, at: 9 }
  };
  assert.deepStrictEqual(C.markedIds(bank, { marks }), [qA.id, qC.id]);
  assert.deepStrictEqual(C.unsureIds(bank, qs), [qA.id, qC.id]);
  assert.deepStrictEqual(C.studyPool(bank, qs, { source: "marked", marks }).slice().sort(), [qA.id, qC.id].sort());
  assert.deepStrictEqual(C.studyPool(bank, qs, { source: "marked", marks, objs: [qA.obj] }), [qA.id]);
  assert.deepStrictEqual(C.studyPool(bank, qs, { source: "unsure", objs: [qA.obj], levels: [2] }), [qA.id]);
  assert(!C.studyPool(bank, qs, { source: "unsure" }).includes(qB.id), "confident-but-wrong with Sure is not Unsure");
  const built = C.buildStudy(bank, qs, { source: "unsure", count: 5, marks }, { seed: 1 });
  assert(built && /Unsure/.test(built.label)); assert(built.qids.every(id => qs[id].conf === 0));
  const marked = C.buildStudy(bank, qs, { source: "marked", count: 5, marks }, { seed: 2 });
  assert(marked && /Bookmarked/.test(marked.label));
  // rating Sure clears Unsure; answering without a new rating leaves it
  qs[qA.id].conf = 1;
  assert.deepStrictEqual(C.studyPool(bank, qs, { source: "unsure" }), [qC.id]);
  assert.strictEqual(C.cleanDoc({ settings: { study: { source: "unsure", count: 10 } } }).settings.study.source, "unsure");
  assert.strictEqual(C.cleanDoc({ settings: { study: { source: "marked" } } }).settings.study.source, "marked");
  assert.strictEqual(C.cleanDoc({ settings: { study: { source: "nope" } } }).settings.study.source, "mix");
});
t("cleanDoc clamps right to seen", () => {
  const q = C.cleanDoc({ qstats: { "1.1-01": { seen: 1, right: 5, last: true } } });
  assert.strictEqual(q.qstats["1.1-01"].seen, 1);
  assert.strictEqual(q.qstats["1.1-01"].right, 1);
  const c = C.cleanDoc({ cards: { "card-1": { seen: 2, right: 9 } }, cmdstats: { ls: { seen: 0, right: 3 } } });
  assert.strictEqual(c.cards["card-1"].right, 2);
  assert.strictEqual(c.cmdstats.ls.seen, 0);
  assert.strictEqual(c.cmdstats.ls.right, 0, "right cannot exceed seen when seen is zero");
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
  assert.strictEqual(st.settings.scheme, "green");
});
t("colour scheme syncs like the daily goal; Light, Dark and System stay on the device", () => {
  const fresh = C.freshState();
  assert.strictEqual(fresh.settings.scheme, "green");
  assert.strictEqual(C.syncedSettings(fresh.settings).scheme, "green");
  assert.strictEqual(C.syncedSettings(fresh.settings).theme, undefined);
  const bad = C.migrate({ settings: { scheme: "<b>", theme: "dark", goal: 12 } });
  assert.strictEqual(bad.settings.scheme, "green"); assert.strictEqual(bad.settings.theme, "dark"); assert.strictEqual(bad.settings.goal, 12);
  const old = C.migrate({ settings: { theme: "light", goal: 8 } });
  assert.strictEqual(old.settings.scheme, "green"); assert.strictEqual(old.settings.goal, 8); assert.strictEqual(old.settings.theme, "light");
  const target = C.freshState();
  C.applyMerged(target, { settings: { scheme: "dracula", theme: "light" }, settingsTs: { scheme: 9, theme: 9 } });
  assert.strictEqual(target.settings.scheme, "dracula"); assert.strictEqual(target.settings.theme, "system");
});
t("daily review: misses return tomorrow, right answers space out", () => {
  const s = {}; const day = 20000;
  C.scheduleQuestion(s, false, day); assert.strictEqual(s.due, day + 1); assert.strictEqual(s.box, 0);
  C.scheduleQuestion(s, true, day + 1); assert.strictEqual(s.box, 1); assert.strictEqual(s.due, day + 2);
  C.scheduleQuestion(s, true, day + 2); assert.strictEqual(s.due, day + 4);
  for (let i = 0; i < 6; i++) C.scheduleQuestion(s, true, day); assert.strictEqual(s.box, 5); assert.strictEqual(s.due, day + 16);
  const st = C.freshState(); const ex = C.buildTest(bank, {}, { seed: 21 });
  // 30 right, 10 wrong (blanks no longer write a schedule entry).
  ex.qids.forEach((id, i) => {
    const q = bank.byId[id];
    ex.answers[id] = i < 30 ? (q.type === "fill" ? q.accept[0] : q.answer)
      : (q.type === "fill" ? "nope" : [q.answer[0] === 0 ? 1 : 0]);
  });
  const now = new Date(2026, 9, 10, 12).getTime(), today = C.dayNum(now);
  C.recordResult(st, bank, ex, C.grade(bank, ex, now), now);
  assert.strictEqual(C.dueIds(bank, st.qstats, today).length, 0, "nothing due the same day");
  const f = C.reviewForecast(bank, st.qstats, today); assert.strictEqual(f.tomorrow, 40); assert.strictEqual(f.due, 0);
  st.settings.review = { on: true, size: 20, fresh: 0 };
  const r = C.buildReview(bank, st, { today: today + 1, seed: 3 });
  assert.strictEqual(r.qids.length, 20); assert.strictEqual(r.mode, "review"); assert(r.study);
  assert(r.qids.every(id => C.familyOf(bank, id).some(f => ex.qids.includes(f))), "only facts from the exam, in any wording");
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
  assert.strictEqual(s1.qids.filter(id => !C.familyOf(bank, id).some(f => st.qstats[f])).length, 5, "five new questions mixed in");
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
  const all = C.newIds(bank, {}, 1000, Math.random); assert.strictEqual(all.length, C.factCount(bank), "one wording per new fact");
  assert.strictEqual(new Set(all.map(id => bank.byId[id].variantOf || id)).size, all.length);
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
  assert.deepStrictEqual(got, ["first-exam", "perfect", "ready", "speed"]);  // mastery needs three separate days, not one sitting
  const d0 = C.dayNum(now);
  bank.byObj["3.3"].forEach(id => { st.qstats[id] = Object.assign({ seen: 1, right: 1, last: true, ev: 1, at: now }, st.qstats[id], { cdays: [d0 - 2, d0 - 1, d0] }); });
  assert.deepStrictEqual(C.awardBadges(st, bank, cards, now).map(b => b.id), ["obj-1"]);
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
t("new flashcards rotate across objectives, weakest first, in a seeded order", () => {
  const today = 20000, seed = 7;
  const deck = [{ id: "s-weak", obj: "2.1" }, { id: "s-strong", obj: "1.1" }];
  for (const obj of ["1.1", "1.2", "2.1"]) for (let i = 0; i < 3; i++) deck.push({ id: obj + "-" + i, obj });
  const cs = { "s-weak": { box: 1, seen: 2, right: 0, due: today + 4 }, "s-strong": { box: 2, seen: 2, right: 2, due: today + 4 } };
  const q = C.cardQueue(deck, cs, null, today, 20, seed);
  assert.deepStrictEqual(q.map(c => c.obj), ["2.1", "1.2", "1.1", "2.1", "1.2", "1.1", "2.1", "1.2", "1.1"]);
  assert.ok(!q.some(c => c.id === "s-weak" || c.id === "s-strong"), "a card that is not due stays out");
  const rand = C.rng(seed), g = {};
  for (const obj of ["1.1", "1.2", "2.1"]) g[obj] = C.shuffle([0, 1, 2].map(i => obj + "-" + i), rand);
  const expect = []; for (let i = 0; i < 3; i++) expect.push(g["2.1"][i], g["1.2"][i], g["1.1"][i]);
  assert.deepStrictEqual(q.map(c => c.id), expect);
  assert.deepStrictEqual(C.cardQueue(deck, cs, null, today, 20, seed).map(c => c.id), expect, "same seed, same order");
  const other = C.cardQueue(deck, cs, null, today, 20, seed + 1);
  assert.notDeepStrictEqual(other.map(c => c.id), expect, "a different seed shuffles within the objective");
  assert.deepStrictEqual(other.map(c => c.obj), q.map(c => c.obj));
  const plain = [];
  for (const obj of ["1.1", "1.2"]) for (let i = 0; i < 3; i++) plain.push({ id: obj + "-" + i, obj });
  const p = C.cardQueue(plain, {}, null, today, 6, 1);
  assert.deepStrictEqual(p.map(c => c.obj), ["1.1", "1.2", "1.1", "1.2", "1.1", "1.2"]);
  assert.notDeepStrictEqual(p.map(c => c.id), plain.map(c => c.id), "not deck order");
});
t("a missed flashcard returns once later in the same session, after five other cards", () => {
  const q = ["a", "b", "c", "d", "e", "f", "g"].map(id => ({ id })), again = {};
  assert.strictEqual(C.requeueMiss(q, 0, again), 1);
  assert.deepStrictEqual(q.map(c => c.id), ["a", "b", "c", "d", "e", "f", "a", "g"]);
  assert.strictEqual(C.requeueMiss(q, 6, again), 7, "the second miss is not queued again");
  assert.strictEqual(q.length, 8);
  const exact = ["a", "b", "c", "d", "e", "f"].map(id => ({ id }));
  assert.strictEqual(C.requeueMiss(exact, 0, {}), 1);
  assert.deepStrictEqual(exact.map(c => c.id), ["a", "b", "c", "d", "e", "f", "a"]);
  const short = ["a", "b", "c", "d", "e"].map(id => ({ id }));
  assert.strictEqual(C.requeueMiss(short, 0, {}), 1);
  assert.deepStrictEqual(short.map(c => c.id), ["a", "b", "c", "d", "e"], "fewer than five cards left, so it waits for the next session");
});
t("at most five cards missed today lead the next session; the rest mix in", () => {
  const today = 20000, seed = 3, deck = [];
  for (let i = 0; i < 8; i++) deck.push({ id: "m" + i, obj: "1.1" });
  for (let i = 0; i < 4; i++) deck.push({ id: "o" + i, obj: "1.1" });
  deck.push({ id: "y", obj: "1.1" });
  for (let i = 0; i < 4; i++) deck.push({ id: "n" + i, obj: "1.2" });
  const cs = { y: { box: 0, seen: 1, right: 0, due: today - 1 } };
  for (let i = 0; i < 8; i++) cs["m" + i] = { box: 0, seen: 1, right: 0, due: today };
  for (let i = 0; i < 4; i++) cs["o" + i] = { box: 2, seen: 2, right: 2, due: today - 1 };
  const ids = C.cardQueue(deck, cs, null, today, 40, seed).map(c => c.id);
  const lead = C.shuffle(deck.filter(c => c.id[0] === "m"), C.rng(seed)).slice(0, 5).map(c => c.id);
  assert.deepStrictEqual(ids.slice(0, 5), lead);
  assert.ok(ids.indexOf("y") > 4, "a miss from yesterday is not one of the five");
  assert.deepStrictEqual(ids.slice(5).map(id => id[0] === "n" ? "n" : id[0] === "m" ? "m" : "d"),
    ["d", "d", "m", "n", "d", "m", "d", "n", "m", "d", "n", "n"]);
  assert.deepStrictEqual(C.cardQueue(deck, cs, null, today, 40, seed).map(c => c.id), ids);
});
t("due and new flashcards alternate about three to one", () => {
  const today = 20000, deck = [];
  for (let i = 0; i < 6; i++) deck.push({ id: "d" + i, obj: "1.1" });
  for (let i = 0; i < 3; i++) deck.push({ id: "n" + i, obj: "1.2" });
  const cs = {};
  for (let i = 0; i < 6; i++) cs["d" + i] = { box: 2, seen: 1, right: 1, due: today };
  assert.deepStrictEqual(C.cardQueue(deck, cs, null, today, 20, 4).map(c => c.id[0]), ["d", "d", "d", "n", "d", "d", "d", "n", "n"]);
  const older = { a: { box: 2, seen: 1, right: 1, due: today }, b: { box: 1, seen: 1, right: 1, due: today - 3 } };
  assert.deepStrictEqual(C.cardQueue([{ id: "a", obj: "1.1" }, { id: "b", obj: "1.1" }], older, null, today, 5, 1).map(c => c.id), ["b", "a"]);
});
t("a top-box flashcard drops on a miss, and a session keeps two that are not due", () => {
  const today = 21000, seed = 11, deck = [];
  for (let i = 0; i < 6; i++) deck.push({ id: "d" + i, obj: "1.1" });
  deck.push({ id: "top-old", obj: "1.2" }, { id: "top-mid", obj: "1.2" }, { id: "top-new", obj: "1.3" }, { id: "box4", obj: "1.3" });
  const cs = {};
  for (let i = 0; i < 6; i++) cs["d" + i] = { box: 1, seen: 1, right: 1, due: today, at: 1000 + i };
  cs["top-old"] = { box: 5, seen: 6, right: 6, due: today + 16, at: 100 };
  cs["top-mid"] = { box: 5, seen: 6, right: 6, due: today + 10, at: 200 };
  cs["top-new"] = { box: 5, seen: 6, right: 6, due: today + 8, at: 900 };
  cs.box4 = { box: 4, seen: 5, right: 5, due: today + 8, at: 50 };
  const dueBefore = cs["top-old"].due;
  const q = C.cardQueue(deck, cs, null, today, 8, seed);
  assert.strictEqual(cs["top-old"].due, dueBefore, "mixing a card in does not make it due");
  assert.deepStrictEqual(Object.keys(q.refresh).sort(), ["top-mid", "top-old"]);
  assert.ok(q.some(c => c.id === "top-old") && q.some(c => c.id === "top-mid"));
  assert.ok(!q.refresh["top-new"], "only the two seen longest ago");
  assert.ok(!q.refresh.box4, "the 8-day box is not the top box");
  assert.strictEqual(q.length, 8);
  assert.deepStrictEqual(C.cardQueue(deck, cs, null, today, 8, seed).map(c => c.id), q.map(c => c.id), "same seed, same order");
  C.reviewCard(cs, "top-old", false, today, 5000);
  assert.strictEqual(cs["top-old"].box, 0, "a miss in the top box drops it to the first box");
  assert.strictEqual(cs["top-old"].due, today);
  const idle = C.cardQueue([{ id: "top-old", obj: "1.1" }], { "top-old": { box: 5, seen: 6, right: 6, due: today + 3, at: 1 } }, null, today, 20, seed);
  assert.strictEqual(idle.length, 0, "nothing due and nothing new: no session of only refreshers");
});
t("streak counts consecutive goal days", () => {
  const days = {}; const now = new Date(2026, 9, 10, 12);
  for (let i = 0; i < 4; i++) { const d = new Date(now); d.setDate(d.getDate() - i); days[C.dayKey(d)] = 25; }
  assert.strictEqual(C.streak(days, 20, now).count, 4);
  delete days[C.dayKey(now)];
  const s = C.streak(days, 20, now); assert.strictEqual(s.count, 3); assert(!s.metToday);
  assert.strictEqual(s.graceUsed, 0);
  assert.strictEqual(typeof C.streak({ "2026-11-01": 1 }, 0, now).count, "number");   // goal 0 must not spin
});
t("one missed day between goal days is a rest day and is not added to the streak", () => {
  const now = new Date(2026, 10, 18, 12);   // Wednesday
  const days = {}, set = (off, n) => { const d = new Date(now); d.setDate(d.getDate() + off); if (n) days[C.dayKey(d)] = n; };
  set(0, 10); set(-2, 10); set(-3, 10); set(-4, 10);   // Tuesday missed
  const s = C.streak(days, 10, now);
  assert.strictEqual(s.count, 4); assert.strictEqual(s.graceUsed, 1); assert.strictEqual(s.metToday, true);
  assert.strictEqual(C.longestStreak(days, 10), 4);
  // Today not finished yet does not confirm yesterday's miss as a rest day.
  const open = {};
  const put = (off, n, into) => { const d = new Date(now); d.setDate(d.getDate() + off); if (n) into[C.dayKey(d)] = n; };
  put(-2, 10, open);
  assert.strictEqual(C.streak(open, 10, now).count, 0);
  open[C.dayKey(now)] = 10;
  const closed = C.streak(open, 10, now);
  assert.strictEqual(closed.count, 2); assert.strictEqual(closed.graceUsed, 1);
});
t("two gaps in one week, two missed days in a row, and a gap at the start do not extend a streak", () => {
  const now = new Date(2026, 10, 18, 12);
  const fill = spec => { const days = {}; spec.forEach((n, i) => { const d = new Date(now); d.setDate(d.getDate() - (spec.length - 1 - i)); if (n) days[C.dayKey(d)] = n; }); return days; };
  const twoGaps = C.streak(fill([10, 0, 10, 0, 10]), 10, now);
  assert.strictEqual(twoGaps.count, 2); assert.strictEqual(twoGaps.graceUsed, 1);
  assert.strictEqual(C.longestStreak(fill([10, 0, 10, 0, 10]), 10), 2);
  const pair = C.streak(fill([10, 10, 0, 0, 10]), 10, now);
  assert.strictEqual(pair.count, 1); assert.strictEqual(pair.graceUsed, 0);
  assert.strictEqual(C.longestStreak(fill([10, 10, 0, 0, 10]), 10), 2);
  const start = C.streak(fill([0, 10, 10, 10]), 10, now);
  assert.strictEqual(start.count, 3); assert.strictEqual(start.graceUsed, 0);
  assert.strictEqual(C.longestStreak(fill([0, 10, 10, 10]), 10), 3);
  // A second rest day is allowed once seven days have passed since the first.
  const spaced = fill([10, 0, 10, 10, 10, 10, 10, 10, 0, 10]);
  assert.strictEqual(C.streak(spaced, 10, now).count, 8);
  assert.strictEqual(C.longestStreak(spaced, 10), 8);
});
t("study days shade by the daily goal and leave out days that have not happened", () => {
  const now = new Date(2026, 10, 18, 12);   // Wednesday 18 Nov 2026
  const on = off => { const d = new Date(now); d.setDate(d.getDate() + off); return C.dayKey(d); };
  const days = { [on(-1)]: 4, [on(-2)]: 10, [on(-3)]: 20 };
  const g = C.studyDays(days, 10, now, 2);
  assert.strictEqual(g.weeks.length, 2);
  const all = []; g.weeks.forEach(w => w.days.forEach(c => all.push(c)));
  const by = {}; all.forEach(c => { by[c.key] = c; });
  assert.strictEqual(by[on(0)].today, true); assert.strictEqual(by[on(0)].level, 0);
  assert.strictEqual(by[on(0)].label, "Wed 18 Nov: nothing studied");
  assert.strictEqual(by[on(-1)].level, 1); assert.strictEqual(by[on(-1)].label, "Tue 17 Nov: 4 done, under the goal");
  assert.strictEqual(by[on(-2)].level, 2); assert.strictEqual(by[on(-2)].label, "Mon 16 Nov: 10 done, goal met");
  assert.strictEqual(by[on(-3)].level, 3); assert.strictEqual(by[on(-3)].label, "Sun 15 Nov: 20 done, goal met");
  assert.strictEqual(all.filter(c => c.future).length, 4);
  assert.strictEqual(g.total, 10); assert.strictEqual(g.studied, 3); assert.strictEqual(g.met, 2);
});
t("score history keeps empty weeks as gaps and does not invent estimate weeks", () => {
  const monday = new Date(2026, 10, 2, 12);   // Monday
  const at = off => { const d = new Date(monday); d.setDate(d.getDate() + off); return d.getTime(); };
  const exam = (off, pct, extra) => Object.assign({ id: "e" + off, date: at(off), mode: "test", total: 40, timed: true, study: false, pct, score: 1 }, extra);
  const now = at(16);   // Wednesday of week 2
  const est = {}; est[C.weekKey(at(7))] = { mean: 74, at: at(7) };
  const h = C.scoreHistory([exam(0, 62), exam(14, 78), exam(14, 70, { timed: false }), exam(3, 90, { mode: "study" })], est, now);
  assert.strictEqual(h.weeks.length, 3);
  assert.strictEqual(h.weeks[1].examMean, null); assert.strictEqual(h.weeks[1].estimate, 74);
  assert.strictEqual(h.examCount, 2); assert.strictEqual(h.latestExam, 78);
  assert.deepStrictEqual(h.segments.map(s => s.length), [1, 1]);   // the empty week breaks the line
  assert.strictEqual(h.estimateNow, null);
  const early = at(-7 * 20);
  const wide = C.scoreHistory([exam(0, 50), { id: "old", date: early, mode: "test", total: 40, timed: true, study: false, pct: 40, score: 1 }], {}, at(0));
  assert.strictEqual(wide.examCount, 2); assert.strictEqual(wide.examPoints.length, 1); assert.strictEqual(wide.weeks.length, 12);
});
t("estimate snapshots store the pass-prediction percent for this week only", () => {
  const st = C.freshState(), now = new Date(2026, 10, 18, 15).getTime();
  assert.strictEqual(C.noteEstimate(st, { chance: null, mean: 10, total: 40 }, now), false);
  assert.deepStrictEqual(st.estWeeks, {});
  assert.strictEqual(C.noteEstimate(st, { chance: 0.5, mean: 29.6, total: 40 }, now), true);
  assert.deepStrictEqual(st.estWeeks[C.weekKey(now)], { mean: 74, at: now });
  assert.strictEqual(C.noteEstimate(st, { chance: 0.5, mean: 29.6, total: 40 }, now + 5000), false);
  assert.strictEqual(C.noteEstimate(st, { chance: 0.6, mean: 30, total: 40 }, now + 5000), true);
  assert.strictEqual(st.estWeeks[C.weekKey(now)].mean, 75);
  const hostile = C.cleanDoc({ estWeeks: { "<img>": { mean: 10, at: 5 }, "2026-11-18": { mean: 200, at: 9 }, "2026-11-17": { mean: 10, at: 4 }, "2026-11-19": { mean: "no", at: 8 }, "nope": { mean: 1, at: 1 } } });
  assert.deepStrictEqual(hostile.estWeeks, { "2026-11-16": { mean: 100, at: 9 } });   // same week, newer stamp, clamped
  for (let i = 0; i < 4 && C.passPrediction(bank, st.qstats).chance == null; i++) {
    const s = C.buildTest(bank, st.qstats, { seed: 10 + i });
    s.qids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; });
    C.recordResult(st, bank, s, C.grade(bank, s, now), now + 10000 + i * 1000);
  }
  const p = C.passPrediction(bank, st.qstats);
  assert.notStrictEqual(p.chance, null, "a few full exams reach an estimate");
  assert.strictEqual(st.estWeeks[C.weekKey(now)].mean, Math.round(100 * p.mean / p.total));
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
  const none = C.passPrediction(bank, {}); assert.strictEqual(none.chance, null); assert.strictEqual(none.more, 40);
  assert.deepStrictEqual(none.thinTopics, ["1", "2", "3", "4", "5"]);
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
  assert.strictEqual(C.passPrediction(bank, q).chance, null, "topic 1 alone is not enough evidence for an estimate");
  for (const tp of ["2", "3", "4", "5"]) bank.questions.filter(x => x.obj[0] === tp).slice(0, 3).forEach(x => q[x.id] = { seen: 1, right: 0, last: false });
  const p = C.passPrediction(bank, q);
  assert(p.chance < 0.5, "perfect on topic 1 alone gave " + p.chance);
  assert(p.focus.length === 3 && p.focus.every(f => f.obj >= "2" && f.gain > 0));
});
t("only cold answers count: repeats of a question you've seen the answer to are left out", () => {
  const ids = bank.questions.map(x => x.id);
  // first attempts all wrong, later repeats all right: the estimate must stay low however often the repeats are drilled
  const drilled = {}; ids.forEach(id => { drilled[id] = { seen: 4, right: 3, last: true, ev: 0 }; });
  const p = C.passPrediction(bank, drilled); assert(p.chance < 0.01, "drilled repeats gave " + p.chance); assert.strictEqual(p.repeats, 0);
  // saved progress from before cold evidence was tracked: seen once, or always right, or always wrong is known; a mix is not
  assert.strictEqual(C.coldOutcome({ seen: 1, right: 1, last: true }), 1);
  assert.strictEqual(C.coldOutcome({ seen: 3, right: 3, last: true }), 1);
  assert.strictEqual(C.coldOutcome({ seen: 2, right: 0, last: false }), 0);
  assert(Math.abs(C.coldOutcome({ seen: 3, right: 1, last: true }) - 1 / 3) < 1e-9, "a mix counts as its share right, not dropped");
  assert.strictEqual(C.coldOutcome({ seen: 3, right: 1, last: true, ev: -1 }), -1);
  // dropping old mixed results would keep only never-missed questions and inflate the estimate
  const mixed = {}; ids.forEach(id => { mixed[id] = { seen: 3, right: 1, last: true }; });
  const m = C.passPrediction(bank, mixed); assert(m.chance < 0.01, "a third right on old progress gave " + m.chance); assert.strictEqual(m.repeats, 0);
  const hinted = {}; ids.forEach(id => { hinted[id] = { seen: 2, right: 2, last: true, ev: -1 }; });
  const h = C.passPrediction(bank, hinted); assert.strictEqual(h.chance, null); assert.strictEqual(h.repeats, C.factCount(bank), "one repeat count per fact, not per wording");
});
t("pass evidence counts one cold result per variant family", () => {
  const v = bank.questions.find(q => q.variantOf), base = bank.byId[v.variantOf];
  const cold = ev => ({ seen: 1, right: ev ? 1 : 0, last: !!ev, ev });
  assert.strictEqual(C.passPrediction(bank, { [base.id]: cold(1), [v.id]: cold(1) }).seen, 1, "two wordings of one fact count once");
  assert.strictEqual(C.passPrediction(bank, { [base.id]: cold(1) }).seen, 1);
  assert.strictEqual(C.passPrediction(bank, { [v.id]: cold(0) }).seen, 1, "a variant alone still counts as the fact");
  assert.strictEqual(C.passPrediction(bank, { [base.id]: cold(0), [v.id]: cold(1) }).seen, 1, "mixed cold results on one fact still count once");
});
t("pass evidence uses the most recent cold result when a fact has two wordings", () => {
  const v = bank.questions.find(q => q.variantOf), base = bank.byId[v.variantOf], o = base.obj;
  const cold = (ev, at) => ({ seen: 1, right: ev ? 1 : 0, last: !!ev, ev, at });
  // cold wrong recently, cold right earlier → counts as wrong
  let e = C.passEvidence(bank, { [base.id]: cold(1, 1000), [v.id]: cold(0, 2000) }).ev[o];
  assert.strictEqual(e.right, 0); assert.strictEqual(e.wrong, 1);
  // reverse: cold right recently, cold wrong earlier → counts as right
  e = C.passEvidence(bank, { [base.id]: cold(0, 1000), [v.id]: cold(1, 2000) }).ev[o];
  assert.strictEqual(e.right, 1); assert.strictEqual(e.wrong, 0);
});
t("recording: first attempts and answers after a long gap are cold evidence; hinted and quick repeats are not", () => {
  const day = 86400000, t0 = new Date(2026, 9, 1, 12).getTime();
  const st = C.freshState(), q = bank.questions.find(x => x.type === "single"), wrong = [q.answer[0] === 0 ? 1 : 0];
  const run = (ans, at, hint) => { const s = C.buildStudy(bank, {}, { ids: [q.id], count: 1 }, { seed: 1 });
    s.answers[q.id] = ans; if (hint) s.hints[q.id] = 1; C.recordResult(st, bank, s, C.grade(bank, s), at); return st.qstats[q.id]; };
  assert.strictEqual(run(wrong, t0).ev, 0, "first attempt, wrong");
  assert.strictEqual(run(q.answer, t0 + day).ev, 0, "a repeat the next day does not overwrite it");
  assert.strictEqual(run(q.answer, t0 + (C.COLD_DAYS + 2) * day).ev, 1, "after a long gap it counts again");
  const st2 = C.freshState(); st.qstats = st2.qstats;
  assert.strictEqual(run(q.answer, t0, true).ev, -1, "a hinted first attempt is not evidence");
  assert.strictEqual(C.coldOutcome(st.qstats[q.id]), -1);
});
// A learner like Jacob, saved under the old 30-day rule: every fact answered once on day 0 at 70%, then fixed exams A-F
// on days 10-15 at 90%. Under the old rule the exams were repeats, so ev still holds the day-0 result and has no evAt.
function jacobOld(t0, native) {
  const day = 86400000, st = C.freshState();
  const right = q => q.type === "fill" ? q.accept[0] : q.answer, wrong = q => q.type === "fill" ? "zzz" : [q.options.findIndex((_, i) => !q.answer.includes(i))];
  const leads = bank.questions.filter(q => !q.variantOf).map(q => q.id);
  for (let i = 0; i < leads.length; i += 40) {
    const ids = leads.slice(i, i + 40), at = t0 + i * 60e3, s = C.newSession(bank, "study", "Study", ids, { study: true, now: at });
    ids.forEach(id => { s.answers[id] = leads.indexOf(id) % 10 < 7 ? right(bank.byId[id]) : wrong(bank.byId[id]); });
    C.recordResult(st, bank, s, C.grade(bank, s, at), at);
  }
  const first = {}; for (const id in st.qstats) first[id] = st.qstats[id].ev;
  "ABCDEF".split("").forEach((f, k) => {
    const at = t0 + (10 + k) * day, s = C.buildTest(bank, {}, { form: f, seed: k + 1, now: at - 3000e3 });
    s.qids.forEach((id, j) => { s.answers[id] = j % 10 === 0 ? wrong(bank.byId[id]) : right(bank.byId[id]); });
    C.recordResult(st, bank, s, C.grade(bank, s, at), at);
  });
  if (!native) for (const id in st.qstats) { st.qstats[id].ev = first[id]; delete st.qstats[id].evAt; }
  return st;
}
const estMean = st => { const p = C.passPrediction(bank, st.qstats); return Math.round(100 * p.mean / p.total); };
t("evidence rebuild: Jacob's exam repeats from 9-4 days ago become cold and the estimate rises; it runs once", () => {
  const day = 86400000, t0 = new Date(2026, 9, 1, 9).getTime(), st = jacobOld(t0);
  const exam = st.tests.filter(x => x.form === "A")[0], id = exam.qids.find((x, j) => C.isCorrect(bank.byId[x], exam.answers[x]) && st.qstats[x].ev === 0);
  assert(id, "an exam question first missed on day 0, right in the exam");
  const before = estMean(st);
  const r = C.rebuildEvidence(bank, st);
  assert(r.ran && r.rebuilt === 400 && r.kept === 0, JSON.stringify(r));
  assert(r.changed > 0);
  assert.strictEqual(st.evRule, C.COLD_DAYS);
  assert.strictEqual(st.qstats[id].ev, 1, "the exam answer, 10 days after the first, is cold"); assert.strictEqual(st.qstats[id].evAt, exam.date);
  const after = estMean(st);
  assert(after > before + 5, `estimate ${before} -> ${after}`);
  // idempotent: once per device, and a forced re-run changes nothing
  const snap = JSON.stringify(st.qstats);
  assert.strictEqual(C.rebuildEvidence(bank, st).ran, false);
  C.rebuildEvidence(bank, st, true); assert.strictEqual(JSON.stringify(st.qstats), snap);
  // the rebuild gives exactly what recording under the 4-day rule gives
  assert.deepStrictEqual(st.qstats, jacobOld(t0, true).qstats);
  // imported progress is rebuilt again
  assert.strictEqual(C.importState(st, C.exportDoc(st)).evRule, undefined);
});
t("evidence rebuild: answers in records without detail can't be replayed and keep their ev", () => {
  const day = 86400000, t0 = new Date(2026, 9, 1, 9).getTime(), st = C.freshState();
  const single = bank.questions.filter(q => q.type === "single" && C.familyOf(bank, q.id).length === 1);
  const [q1, q2, q3] = single, fill = single.slice(3, 33);
  const run = (ids, at, ok) => { const s = C.newSession(bank, "study", "Study", ids, { study: true, now: at });
    ids.forEach(id => { const q = bank.byId[id]; s.answers[id] = ok ? q.answer : [q.answer[0] === 0 ? 1 : 0]; }); C.recordResult(st, bank, s, C.grade(bank, s, at), at); };
  run([q1.id, q2.id, q3.id], t0, false);                       // first attempts, all wrong: soon without detail
  fill.forEach((q, i) => run([q.id], t0 + day + i * 1000, true));   // 30 more records push it out
  run([q1.id], t0 + 3 * day, true);                            // 3 days after the hidden attempt: a repeat
  run([q2.id], t0 + 6 * day, true);                            // 5+ days after the last hidden record: cold
  assert(!st.tests[0].qids && !st.tests[2].qids && st.tests[3].qids, "the three oldest records lost their detail");
  for (const q of [q1, q2, q3]) { st.qstats[q.id].ev = 0; delete st.qstats[q.id].evAt; }
  const r = C.rebuildEvidence(bank, st);
  assert.strictEqual(st.qstats[q1.id].ev, 0, "not 4 days after the newest record without detail: stays a repeat");
  assert.strictEqual(st.qstats[q2.id].ev, 1, "4+ days after any hidden answer could have been: cold");
  assert.strictEqual(st.qstats[q3.id].ev, 0); assert.strictEqual(st.qstats[q3.id].evAt, undefined, "nothing left to replay: kept as it was");
  assert(r.kept >= 2, JSON.stringify(r));   // q1 and q3 (and the first filler, whose only answer lost its detail)
});
t("evidence rebuild: hinted answers and untimed exams are not evidence; Don't know yet is a miss", () => {
  const day = 86400000, t0 = new Date(2026, 9, 1, 9).getTime(), st = C.freshState();
  const [a, b] = bank.questions.filter(q => q.type === "single" && C.familyOf(bank, q.id).length === 1);
  let s = C.newSession(bank, "study", "Study", [a.id, b.id], { study: true, now: t0 });
  s.answers[a.id] = a.answer; s.answers[b.id] = b.answer; s.hints[a.id] = 1; C.recordResult(st, bank, s, C.grade(bank, s, t0), t0);
  s = C.newSession(bank, "placement", "Placement", [a.id, b.id], { now: t0 + 5 * day }); s.dontKnow = { [b.id]: true }; s.answers[a.id] = a.answer;
  C.recordResult(st, bank, s, C.grade(bank, s, t0 + 5 * day), t0 + 5 * day);
  const snap = JSON.stringify(st.qstats);
  C.rebuildEvidence(bank, st, true);
  assert.strictEqual(JSON.stringify(st.qstats), snap, "replay gives what recording gave");
  assert.strictEqual(st.qstats[a.id].ev, 1); assert.strictEqual(st.qstats[b.id].ev, 0);
});
t("cold window is 4 days: day 3 is a repeat, day 4 is cold, and the latest cold result wins", () => {
  assert.strictEqual(C.COLD_DAYS, 4);
  const day = 86400000, t0 = new Date(2026, 9, 1, 12).getTime();
  const st = C.freshState(), q = bank.questions.find(x => x.type === "single" && C.familyOf(bank, x.id).length === 1);
  const wrong = [q.answer[0] === 0 ? 1 : 0];
  const run = (ans, at) => { const s = C.buildStudy(bank, {}, { ids: [q.id], count: 1 }, { seed: 1 });
    s.answers[q.id] = ans; C.recordResult(st, bank, s, C.grade(bank, s), at); return st.qstats[q.id]; };
  const evOf = () => C.passEvidence(bank, st.qstats).ev[q.obj];
  assert.strictEqual(run(wrong, t0).ev, 0, "first attempt, wrong");
  assert.strictEqual(C.isCold(bank, st.qstats, q.id, t0 + 3 * day), false);
  assert.strictEqual(run(q.answer, t0 + 3 * day).ev, 0, "3 days later is a repeat: the miss stands");
  assert.strictEqual(C.passEvidence(bank, st.qstats).repeats, 0);
  assert.deepStrictEqual(evOf(), { right: 0, wrong: 1 });
  // the gap runs from the last attempt (day 3), so day 6 is still a repeat and day 7 is cold
  assert.strictEqual(run(q.answer, t0 + 6 * day).ev, 0, "3 days after the last attempt is still a repeat");
  assert.strictEqual(C.isCold(bank, st.qstats, q.id, t0 + 10 * day), true, "4 days after the last attempt is cold");
  assert.strictEqual(run(q.answer, t0 + 10 * day).ev, 1, "the later cold right replaces the older cold miss");
  assert.deepStrictEqual(evOf(), { right: 1, wrong: 0 });
  assert.strictEqual(run(wrong, t0 + 14 * day).ev, 0, "and a later cold miss replaces that hit");
  assert.deepStrictEqual(evOf(), { right: 0, wrong: 1 });
  // a bare record seen once: 3 days on is a repeat, 4 days on is cold
  const one = { [q.id]: { seen: 1, at: t0 } };
  assert.strictEqual(C.isCold(bank, one, q.id, t0 + 3 * day), false);
  assert.strictEqual(C.isCold(bank, one, q.id, t0 + 4 * day), true);
});
t("an estimate needs every topic covered, not just enough answers", () => {
  const q = {}; bank.questions.filter(x => x.obj >= "2").forEach(x => q[x.id] = { seen: 1, right: 1, last: true, ev: 1 });
  const p = C.passPrediction(bank, q); assert.strictEqual(p.chance, null); assert.deepStrictEqual(p.thinTopics, ["1"]); assert.strictEqual(p.more, 0);
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
t("confidence: sure/unsure is stored, calibration and focus lists are correct", () => {
  const st = C.freshState(), s = C.buildStudy(bank, {}, { count: 4 }, { seed: 11 });
  assert.deepStrictEqual(s.conf, {});
  const ids = s.qids.slice();
  ids.forEach((id, i) => {
    const q = bank.byId[id];
    s.answers[id] = i === 1 ? (q.type === "fill" ? "nope" : [q.answer[0] === 0 ? 1 : 0]) : (q.type === "fill" ? q.accept[0] : q.answer);
    s.conf[id] = i === 0 || i === 1;   // sure, sure (will be wrong), unsure (right), unsure (right)
  });
  s.conf[ids[2]] = false; s.conf[ids[3]] = false;
  const res = C.grade(bank, s), rec = C.recordResult(st, bank, s, res);
  assert.strictEqual(rec.conf[ids[0]], true); assert.strictEqual(rec.conf[ids[1]], true);
  assert.strictEqual(rec.conf[ids[2]], false);
  const cal = C.calibration(rec, bank);
  assert.strictEqual(cal.sureN, 2); assert.strictEqual(cal.sureOk, 1); assert.strictEqual(cal.surePct, 50);
  assert.strictEqual(cal.unsureN, 2); assert.strictEqual(cal.unsureOk, 2); assert.strictEqual(cal.unsurePct, 100);
  assert.deepStrictEqual(cal.cw, [ids[1]]);
  assert(cal.focus.includes(ids[1]) && cal.focus.includes(ids[2]) && cal.focus.includes(ids[3]));
  assert(!cal.focus.includes(ids[0]), "sure and correct is not a focus item");
  assert.strictEqual(st.qstats[ids[1]].conf, 1); assert.strictEqual(st.qstats[ids[1]].cw, 1);
  assert.strictEqual(st.qstats[ids[2]].conf, 0);
  const cleaned = C.cleanDoc({ tests: [rec], qstats: st.qstats });
  assert.strictEqual(cleaned.tests[0].conf[ids[1]], true);
  assert.strictEqual(cleaned.qstats[ids[1]].cw, 1);
});
t("mastery: cold corrects on three different days; same day and hints do not advance it", () => {
  const day = 86400000, t0 = new Date(2026, 9, 1, 12).getTime();
  const obj = "1.1", id = bank.byObj[obj][0], q = bank.byId[id];
  const st = C.freshState();
  const run = (at, hint) => {
    const s = C.buildStudy(bank, {}, { ids: [id], count: 1 }, { seed: 1 });
    s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; if (hint) s.hints[id] = 1;
    // force a cold attempt after the first by answering far enough apart, or first attempt
    C.recordResult(st, bank, s, C.grade(bank, s), at); return C.objectiveStats(bank, st.qstats)[obj];
  };
  assert.strictEqual(C.objectiveStats(bank, {})[obj].level, "new");
  assert.strictEqual(run(t0, true).level, "attempted", "hinted first attempt is not a mastery day");
  assert.strictEqual(run(t0 + day).coldDays, 0, "still no day until a cold correct");
  // clear and rebuild with real cold corrects spaced by COLD_DAYS so each counts
  st.qstats = {};
  const cold = (n) => t0 + n * (C.COLD_DAYS + 1) * day;
  assert.strictEqual(run(cold(0)).level, "familiar");
  assert.strictEqual(run(cold(0) + day).level, "familiar", "same mastery day does not double-count");
  assert.strictEqual(run(cold(1)).level, "proficient");
  assert.strictEqual(run(cold(2)).level, "mastered");
  assert.strictEqual(C.coldDayCredit({ variantOf: "1.1-01" }), 1, "a variant answered cold is worth a full day; isCold decides whether it was cold");
  assert.strictEqual(C.coldDayCredit(q), 1);
});
t("mastery: a miss in a mixed exam drops one cold day for that objective", () => {
  const now = new Date(2026, 9, 10, 12).getTime(), d0 = C.dayNum(now);
  const st = C.freshState(), id = bank.byObj["1.1"][0], q = bank.byId[id];
  // Only this question carries the three mastery days, so sibling corrects in the exam cannot mask the demotion.
  st.qstats[id] = { seen: 3, right: 3, last: true, ev: 1, at: now, cdays: [d0 - 2, d0 - 1, d0], box: 3, due: d0 + 4 };
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].level, "mastered");
  const s = C.buildTest(bank, {}, { seed: 7 });
  // Put the mastered question in the exam and miss it; answer everything else right.
  if (!s.qids.includes(id)) s.qids[0] = id;
  s.qids.forEach(qid => {
    const qq = bank.byId[qid];
    s.answers[qid] = qid === id ? (qq.type === "fill" ? "nope" : [qq.answer[0] === 0 ? 1 : 0])
      : (qq.type === "fill" ? qq.accept[0] : qq.answer);
  });
  C.recordResult(st, bank, s, C.grade(bank, s), now);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].coldDays, 2);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].level, "proficient");
});
t("objectiveMapCounts: objectives per mastery level and the Proficient-or-better count", () => {
  const empty = C.objectiveMapCounts(C.objectiveStats(bank, {}));
  const all = Object.keys(bank.objectives).length;
  assert.strictEqual(empty.total, all);
  assert.deepStrictEqual(empty.byLevel, { new: all, attempted: 0, familiar: 0, proficient: 0, mastered: 0 });
  assert.strictEqual(empty.proficientPlus, 0);
  // One objective per level, built from real cold days so the counts follow objectiveStats.
  const now = new Date(2026, 9, 10, 12).getTime(), d0 = C.dayNum(now), qs = {};
  const give = (obj, days) => { qs[bank.byObj[obj][0]] = { seen: 3, right: days.length ? 3 : 0, last: !!days.length, at: now, cdays: days }; };
  give("1.1", []); give("1.2", [d0]); give("1.3", [d0 - 1, d0]); give("2.1", [d0 - 2, d0 - 1, d0]); give("2.2", [d0 - 4, d0 - 3, d0 - 2, d0]);
  const c = C.objectiveMapCounts(C.objectiveStats(bank, qs));
  assert.strictEqual(c.total, all);
  assert.deepStrictEqual(c.byLevel, { new: all - 5, attempted: 1, familiar: 1, proficient: 1, mastered: 2 });
  assert.strictEqual(c.proficientPlus, 3, "proficient and mastered both count");
  // Missing or odd levels count as new and never add keys; no input gives zeros.
  const odd = C.objectiveMapCounts({ a: { level: "proficient" }, b: { level: "__proto__" }, c: null, d: {} });
  assert.deepStrictEqual(odd, { total: 4, byLevel: { new: 3, attempted: 0, familiar: 0, proficient: 1, mastered: 0 }, proficientPlus: 1 });
  assert.deepStrictEqual(C.objectiveMapCounts(undefined), { total: 0, byLevel: { new: 0, attempted: 0, familiar: 0, proficient: 0, mastered: 0 }, proficientPlus: 0 });
});
t("review gaps are capped by days left before the exam date", () => {
  const today = 20000;
  const s = { box: 0 }; C.scheduleQuestion(s, true, today); assert.strictEqual(s.due, today + 1); assert.strictEqual(s.box, 1);
  C.scheduleQuestion(s, true, today); assert.strictEqual(s.due, today + 2);
  C.scheduleQuestion(s, true, today); assert.strictEqual(s.due, today + 4);
  C.scheduleQuestion(s, true, today); assert.strictEqual(s.due, today + 8);
  C.scheduleQuestion(s, true, today); assert.strictEqual(s.due, today + 16);
  const near = { box: 4 }; C.scheduleQuestion(near, true, today, today + 10);
  assert.strictEqual(near.due, today + 4, "40% of 10 days left caps a 16-day box");
  const past = { box: 3 }; C.scheduleQuestion(past, true, today, today);
  assert.strictEqual(past.due, today + 1, "exam day keeps gaps tight");
  assert.strictEqual(C.reviewGapCap(today, today + 5), 2);
  const cards = {}; C.reviewCard(cards, "c1", true, today, today * 86400000, today + 10);
  assert.strictEqual(cards.c1.due, today + 1);
  C.reviewCard(cards, "c1", true, today, today * 86400000, today + 10);
  assert.strictEqual(cards.c1.due, today + 2);
  C.reviewCard(cards, "c1", true, today, today * 86400000, today + 10);
  assert.ok(cards.c1.due - today <= 4);
});
t("mastery days survive cleanDoc and merge as a union across devices", () => {
  const a = C.freshState(), b = C.freshState();
  a.qstats["1.1-01"] = { seen: 1, right: 1, last: true, at: 100, ev: 1, cdays: [10, 11], box: 1, due: 12 };
  b.qstats["1.1-01"] = { seen: 1, right: 1, last: true, at: 200, ev: 1, cdays: [11, 12], box: 2, due: 14 };
  const view = C.mergeStates([a, b]);
  assert.deepStrictEqual(view.qstats["1.1-01"].cdays, [10, 11, 12]);
  assert.strictEqual(view.qstats["1.1-01"].seen, 2);
  const cleaned = C.cleanDoc({ qstats: { "1.1-01": { seen: 2, right: 2, last: true, at: 200, ev: 1, cdays: [10, 11, 12, "x", -1], box: 2, due: 14 } } });
  assert.deepStrictEqual(cleaned.qstats["1.1-01"].cdays, [10, 11, 12]);
  assert.strictEqual(cleaned.qstats["1.1-01"].ev, 1);
  assert.deepStrictEqual(C.coldDaysOf({ ev: 1, at: new Date(2026, 9, 10, 12).getTime() }), [C.dayNum(new Date(2026, 9, 10, 12).getTime())], "legacy ev seeds one day");
});
t("mastery: demotion drops the objective-wide latest day across questions", () => {
  const now = new Date(2026, 9, 10, 12).getTime(), d0 = C.dayNum(now);
  const st = C.freshState(), obj = "1.1";
  const idA = bank.byObj[obj][0], idB = bank.byObj[obj][1];
  // Pre-seed every question in the objective so the exam cannot mint a new cold day that steals "latest".
  for (const id of bank.byObj[obj]) st.qstats[id] = { seen: 1, right: 0, last: false, at: now, box: 0, due: d0 };
  st.qstats[idA] = { seen: 2, right: 2, last: true, ev: 1, at: now, cdays: [10, 20, 30], box: 2, due: d0 + 2 };
  st.qstats[idB] = { seen: 2, right: 2, last: true, ev: 1, at: now, cdays: [10, 15, 25], box: 2, due: d0 + 2 };
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].coldDays, 5);
  const s = C.buildTest(bank, {}, { seed: 3 });
  if (!s.qids.includes(idA)) s.qids[0] = idA;
  s.qids.forEach(qid => {
    const qq = bank.byId[qid];
    s.answers[qid] = qid === idA ? (qq.type === "fill" ? "nope" : [qq.answer[0] === 0 ? 1 : 0])
      : (qq.type === "fill" ? qq.accept[0] : qq.answer);
  });
  C.recordResult(st, bank, s, C.grade(bank, s), now);
  assert.deepStrictEqual(C.coldDaysOf(st.qstats[idA]), [10, 20]);
  assert.deepStrictEqual(st.qstats[idA].cdrop, [30]);
  assert.deepStrictEqual(C.coldDaysOf(st.qstats[idB]), [10, 15, 25]);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].coldDays, 4);
});
t("mastery: demotion applies to legacy ev/at stats with no cdays yet", () => {
  const now = new Date(2026, 9, 10, 12).getTime(), d0 = C.dayNum(now);
  const st = C.freshState(), obj = "1.1";
  const idA = bank.byObj[obj][0], idB = bank.byObj[obj][1];
  for (const id of bank.byObj[obj]) st.qstats[id] = { seen: 1, right: 0, last: false, at: now, box: 0, due: d0 };
  st.qstats[idA] = { seen: 2, right: 2, last: true, ev: 1, at: now, cdays: [d0 - 2, d0 - 1], box: 2, due: d0 + 2 };
  st.qstats[idB] = { seen: 1, right: 1, last: true, ev: 1, at: now };   // contributes d0 via legacy fallback
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].coldDays, 3);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].level, "mastered");
  const s = C.buildTest(bank, {}, { seed: 5 });
  if (!s.qids.includes(idA)) s.qids[0] = idA;
  s.qids.forEach(qid => {
    const qq = bank.byId[qid];
    s.answers[qid] = qid === idA ? (qq.type === "fill" ? "nope" : [qq.answer[0] === 0 ? 1 : 0])
      : (qq.type === "fill" ? qq.accept[0] : qq.answer);
  });
  C.recordResult(st, bank, s, C.grade(bank, s), now);
  assert.deepStrictEqual(C.coldDaysOf(st.qstats[idB]), []);
  assert.deepStrictEqual(st.qstats[idB].cdays, []);
  assert.deepStrictEqual(st.qstats[idB].cdrop, [d0]);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].coldDays, 2);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[obj].level, "proficient");
});
t("mastery: sync keeps a demotion when a peer still has the old days", () => {
  const a = C.freshState(), b = C.freshState();
  a.qstats["1.1-01"] = { seen: 1, right: 1, last: true, at: 200, ev: 1, cdays: [10, 11], cdrop: [12], box: 2, due: 14, cw: 2 };
  b.qstats["1.1-01"] = { seen: 1, right: 1, last: true, at: 100, ev: 1, cdays: [10, 11, 12], box: 1, due: 12, cw: 3 };
  const view = C.mergeStates([a, b]);
  assert.deepStrictEqual(view.qstats["1.1-01"].cdays, [10, 11, 12]);
  assert.deepStrictEqual(view.qstats["1.1-01"].cdrop, [12]);
  assert.deepStrictEqual(C.coldDaysOf(view.qstats["1.1-01"]), [10, 11], "dropped day stays dropped after merge");
  assert.strictEqual(view.qstats["1.1-01"].cw, 5, "confident-wrong counts add across devices");
  assert.deepStrictEqual(C.coldDaysOf({ cdays: [], ev: 1, at: 1000, cdrop: [C.dayNum(1000)] }), []);
});
t("mastery: a cold miss outside placement drops a mastered objective; a warm, hinted, untimed or placement miss does not", () => {
  const DAY = 86400000, now = new Date(2026, 9, 20, 12).getTime(), today = C.dayNum(now);
  const obj = "1.1";
  const alone = x => { const q = bank.byId[x]; return q.type !== "fill" && !q.variantOf && !bank.questions.some(v => v.variantOf === x); };
  const id = bank.byObj[obj].find(alone);
  assert.ok(id, "a single-wording question to miss");
  const q = bank.byId[id];
  const days3 = [today - 30, today - 20, today - 10];
  const seed = (at, cdays) => {
    const st = C.freshState();
    for (const qid of bank.byObj[obj]) st.qstats[qid] = { seen: 1, right: 1, last: true, at: now, box: 1, due: today + 2, cdays: [] };
    st.qstats[id] = { seen: 3, right: 3, last: true, ev: 1, at, cdays: cdays.slice(), box: 3, due: today + 5 };
    return st;
  };
  const miss = (st, mode, opts) => {
    opts = opts || {};
    const s = C.newSession(bank, mode, mode, [id], { study: mode !== "test" && mode !== "placement", timed: !!opts.timed, seed: 4, now });
    s.answers[id] = [q.answer[0] === 0 ? 1 : 0];
    if (opts.hint) s.hints[id] = true;
    C.recordResult(st, bank, s, C.grade(bank, s), now);
    return C.objectiveStats(bank, st.qstats)[obj];
  };
  // Cold (last answer 10 days ago): Mastered, 3 days, falls to Proficient. The dropped day is remembered.
  const cold = seed(now - 10 * DAY, days3);
  assert.strictEqual(C.objectiveStats(bank, cold.qstats)[obj].level, "mastered");
  assert.strictEqual(miss(cold, "study").level, "proficient");
  assert.strictEqual(C.objectiveStats(bank, cold.qstats)[obj].coldDays, 2);
  assert.deepStrictEqual(cold.qstats[id].cdrop, [today - 10]);
  const peer = C.freshState();
  peer.qstats[id] = { seen: 3, right: 3, last: true, at: now - 10 * DAY, ev: 1, cdays: days3.slice(), box: 3, due: today + 5 };
  const view = C.mergeStates([cold, peer]);
  assert.deepStrictEqual(C.coldDaysOf(view.qstats[id]), [today - 30, today - 20], "a peer that still has the day cannot put it back");
  // Four days: one cold miss removes only the latest, so the objective stays Mastered.
  const extra = seed(now - 10 * DAY, [today - 40, today - 30, today - 20, today - 10]);
  assert.strictEqual(miss(extra, "study").level, "mastered");
  assert.strictEqual(C.objectiveStats(bank, extra.qstats)[obj].coldDays, 3);
  // Not cold yet (answered earlier today): no drop. A hint, an untimed exam and placement do not drop either.
  const warm = seed(now - 60 * 60 * 1000, days3);
  assert.strictEqual(miss(warm, "study").level, "mastered");
  assert.strictEqual(warm.qstats[id].cdrop, undefined);
  const hinted = seed(now - 10 * DAY, days3);
  assert.strictEqual(miss(hinted, "study", { hint: true }).level, "mastered");
  const untimed = seed(now - 10 * DAY, days3);
  assert.strictEqual(miss(untimed, "test").level, "mastered", "an untimed exam is not cold evidence");
  const place = seed(now - 10 * DAY, days3);
  assert.strictEqual(miss(place, "placement").level, "mastered");
  // Proficient does not lose a day on a cold miss. Only Mastered does.
  const prof = seed(now - 10 * DAY, [today - 20, today - 10]);
  assert.strictEqual(C.objectiveStats(bank, prof.qstats)[obj].level, "proficient");
  assert.strictEqual(miss(prof, "study").level, "proficient");
  assert.strictEqual(prof.qstats[id].cdrop, undefined);
  // A mixed exam miss that is also cold drops one day, not two.
  const both = seed(now - 10 * DAY, days3);
  const exam = C.buildTest(bank, {}, { seed: 8 });
  if (!exam.qids.includes(id)) exam.qids[0] = id;
  exam.qids.forEach(qid => {
    const qq = bank.byId[qid];
    exam.answers[qid] = qid === id ? [qq.answer[0] === 0 ? 1 : 0] : (qq.type === "fill" ? qq.accept[0] : qq.answer);
  });
  C.recordResult(both, bank, exam, C.grade(bank, exam), now);
  assert.strictEqual(C.objectiveStats(bank, both.qstats)[obj].coldDays, 2);
  assert.strictEqual(C.objectiveStats(bank, both.qstats)[obj].level, "proficient");
});
t("daily review includes two mastered questions seen longest ago, without making them due", () => {
  const DAY = 86400000, now = new Date(2026, 9, 20, 12).getTime(), today = C.dayNum(now), seed = 42;
  const alone = id => !bank.byId[id].variantOf && !bank.questions.some(q => q.variantOf === id);
  const take = obj => bank.byObj[obj].find(alone);
  const old = take("1.2"), mid = take("1.3"), recent = take("2.2"), due = bank.byObj["2.1"].find(id => bank.byId[id].type !== "fill");
  assert.ok(old && mid && recent && due);
  const st = C.freshState();
  st.settings.review = { on: true, size: 10, fresh: 0 };
  const days = [today - 40, today - 25, today - 12];
  const put = (id, daysAgo) => { st.qstats[id] = { seen: 3, right: 3, last: true, at: now - daysAgo * DAY, ev: 1, cdays: days.slice(), box: 4, due: today + 6 }; };
  put(old, 50); put(mid, 30); put(recent, 8);
  st.qstats[due] = { seen: 1, right: 0, last: false, at: now - 2 * DAY, box: 0, due: today - 1 };
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[bank.byId[old].obj].level, "mastered");
  const dueBefore = st.qstats[old].due;
  const d = C.dailyReview(bank, st, today);
  assert.strictEqual(d.refresh, 2);
  assert.strictEqual(d.left, 10);
  const session = C.buildReview(bank, st, { today, seed });
  assert.strictEqual(st.qstats[old].due, dueBefore, "a refresher is not marked due");
  assert.deepStrictEqual(Object.keys(session.refresh).sort(), [old, mid].sort(), "the two seen longest ago");
  assert.ok(session.qids.includes(old) && session.qids.includes(mid));
  assert.ok(!session.refresh[recent] && !session.refresh[due]);
  const again = C.buildReview(bank, st, { today, seed });
  assert.deepStrictEqual(again.qids, session.qids, "same seed, same review");
  assert.deepStrictEqual(again.refresh, session.refresh);
  const kept = C.cleanSession(session);
  assert.deepStrictEqual(kept.refresh, session.refresh, "the tag survives a reload");
  // Answering one question uses up today's refresher slots. The same pair is not added again.
  const one = session.qids.find(id => id === due) || session.qids[0];
  const qq = bank.byId[one];
  session.answers[one] = qq.type === "fill" ? qq.accept[0] : qq.answer;
  C.recordResult(st, bank, session, C.grade(bank, session), now);
  const d2 = C.dailyReview(bank, st, today);
  assert.strictEqual(d2.done, 1);
  assert.strictEqual(d2.refresh, 0);
  assert.ok(d2.left > 0, "the rest of the day is still there, without a new pair");
});
t("repairSession drops conf (and other maps) for removed question ids", () => {
  const id = bank.questions[0].id, gone = "9.9-99";
  const s = C.buildStudy(bank, {}, { ids: [id], count: 1 }, { seed: 1 });
  s.qids = [id, gone]; s.conf[gone] = true; s.conf[id] = false; s.flags[gone] = 1; s.answers[gone] = "x";
  const fixed = C.repairSession(bank, s);
  assert.deepStrictEqual(fixed.qids, [id]);
  assert.strictEqual(fixed.conf[gone], undefined);
  assert.strictEqual(fixed.conf[id], false);
  assert.strictEqual(fixed.flags[gone], undefined);
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
// ---------------------------------------------------------------- item 7: lab formats (level chain, one-liners, scenarios), catalogue rows, "Checked when"
require(path.join(__dirname, "../docs/data/labs.js"));
require(path.join(__dirname, "../docs/data/labindex.js"));
const LAB_ALL = window.LE_LABS, LAB_LESSONS = window.LE_LESSONS, LABIX = window.LE_LABINDEX;
t("lab formats: ten chain levels, ten one-liners and four scenarios, each one part with one end-state task", () => {
  const of = tr => LAB_ALL.filter(l => l.track === tr);
  assert.strictEqual(of("chain").length, 10); assert.strictEqual(of("oneliner").length, 10); assert.strictEqual(of("scenario").length, 4);
  for (const l of [].concat(of("chain"), of("oneliner"), of("scenario"))) {
    assert.strictEqual(l.tasks.length, 1, l.id); assert.strictEqual(l.parts, 1, l.id);
    const tk = l.tasks[0];
    assert(tk.goal && tk.goal.length > 15, l.id + " says what is checked");
    assert(!/"type":"history"/.test(JSON.stringify(tk.check)), l.id + " is checked by end state or output, never by the exact command typed");
    assert(C.LAB_KINDS[l.kind], l.id + " has a type"); assert([1, 2, 3].includes(l.level), l.id + " has a difficulty");
    assert(bank.objectives[l.obj], l.id + " belongs to an objective");
    const L = LAB_LESSONS.find(x => x.lesson === l.lesson); assert(L && L.blurb && L.blurb.length > 20 && L.track === l.track, l.id + " has a catalogue line");
  }
  for (const l of of("chain")) { assert.deepStrictEqual(l.tasks[0].check, { type: "unlocked" }); assert(l.setup.key && l.tasks[0].solution.endsWith("\nunlock " + l.setup.key), l.id);
    assert(!l.intro.includes(l.setup.key) && !l.tasks[0].text.includes(l.setup.key) && !l.tasks[0].hints.join(" ").includes(l.setup.key), l.id + " doesn't give its key away"); }
  assert.strictEqual(new Set(of("chain").map(l => l.setup.key)).size, 10, "every level has its own key");
  for (const l of of("oneliner")) { assert(l.tasks[0].ways && l.tasks[0].ways.length, l.id + " shows other ways"); assert(l.tasks[0].ways.every(w => w.cmd && w.note && w.cmd !== l.tasks[0].solution));
    assert.strictEqual(l.tasks[0].solution.split("\n").length, 1, l.id + " is solved in one line"); }
  for (const l of of("scenario")) assert(l.minutes >= 3 && l.minutes <= 15, l.id + " suggests a time");
  for (const L of LAB_LESSONS.filter(x => x.track === "troubleshoot")) assert(L.blurb && L.kind === "fix" && L.level === 2, L.lesson);
  // the light index the catalogue is drawn from carries what a row needs
  for (const p of LABIX.parts.filter(x => ["chain", "oneliner", "scenario"].includes(x.track))) assert(p.kind && p.level && p.goal, p.id);
  assert(!Object.values(LABIX.q).some(ps => ps.some(id => /^[VOS]\d/.test(id))), "exam questions link to lessons and troubleshooting, not to challenges");
});
t("lab catalogue: type, difficulty, status and chain locks", () => {
  assert.strictEqual(C.labKind({ kind: "fix" }), "fix"); assert.strictEqual(C.labKind({ kind: "nope" }), "change"); assert.strictEqual(C.labKind(null), "change");
  assert.deepStrictEqual(C.labLevel({ level: 3 }), { n: 3, word: "Hard" }); assert.deepStrictEqual(C.labLevel({}), { n: 1, word: "Easy" });
  assert.deepStrictEqual(C.labLevel({ level: 9 }), { n: 3, word: "Hard" }); assert.deepStrictEqual(C.labLevel({ level: "2" }), { n: 2, word: "Medium" });
  for (const k of ["chain", "oneliner", "scenario", "troubleshoot"]) assert(C.LAB_TRACKS[k][0] && C.LAB_TRACKS[k][1].length > 30, k);
  const parts = [{ id: "a" }, { id: "b" }];
  assert.deepStrictEqual(C.labStatus(parts, {}), { state: "new", done: 0, total: 2, text: "New" });
  assert.deepStrictEqual(C.labStatus(parts, { a: { done: [0] } }), { state: "started", done: 0, total: 2, text: "0 of 2 parts" });
  assert.deepStrictEqual(C.labStatus(parts, { a: { done: [0, 1], completedAt: 5 } }), { state: "started", done: 1, total: 2, text: "1 of 2 parts" });
  assert.deepStrictEqual(C.labStatus(parts, { a: { done: [], completedAt: 5 }, b: { done: [0], completedAt: 6 } }), { state: "done", done: 2, total: 2, text: "Done" });
  assert.strictEqual(C.labStatus([{ id: "a" }], { a: { done: [0] } }).text, "Started"); assert.strictEqual(C.labStatus([], {}).state, "new");
  assert.strictEqual(C.labStatus([{ id: "a" }], { a: { done: [] } }).state, "new", "opening a lab without finishing a task is not a start");
  const ids = ["V1-a", "V2-a", "V3-a", "V4-a"];
  assert.deepStrictEqual(C.chainLocks(ids, {}), { "V1-a": null, "V2-a": "V1-a", "V3-a": "V1-a", "V4-a": "V1-a" }, "only the first level is open");
  assert.deepStrictEqual(C.chainLocks(ids, { "V1-a": { completedAt: 1 }, "V2-a": { done: [] } }), { "V1-a": null, "V2-a": null, "V3-a": "V2-a", "V4-a": "V2-a" });
  assert.deepStrictEqual(C.chainLocks(ids, { "V1-a": { completedAt: 1 }, "V3-a": { completedAt: 1 } }), { "V1-a": null, "V2-a": null, "V3-a": "V2-a", "V4-a": "V2-a" }, "a later level cleared on another device doesn't open the gap");
  assert(Object.values(C.chainLocks(ids, Object.fromEntries(ids.map(i => [i, { completedAt: 1 }])))).every(x => x === null));
  assert.deepStrictEqual(C.chainLocks(null, null), {});
});
t("advisory clock: counts up against the suggested time and never fails anything", () => {
  assert.deepStrictEqual(C.advisoryClock(0, 5), { over: false, text: "00:00 of about 5 min", note: "" });
  assert.deepStrictEqual(C.advisoryClock(192000, 5), { over: false, text: "03:12 of about 5 min", note: "" });
  assert.strictEqual(C.advisoryClock(300000, 5).over, false, "exactly on time is not over");
  const late = C.advisoryClock(301000, 5); assert.strictEqual(late.over, true); assert.strictEqual(late.text, "05:01 of about 5 min"); assert(/Nothing is lost/.test(late.note));
  assert.deepStrictEqual(C.advisoryClock(-5, 5).text, "00:00 of about 5 min"); assert.deepStrictEqual(C.advisoryClock(61000, 0), { over: false, text: "01:01", note: "" });
  assert.strictEqual(C.advisoryClock("x", 5).text, "00:00 of about 5 min");
});
t("hint tiers: the commands a task may need come first, then its written hints", () => {
  const tk = { hints: ["look around", "ls -a"] };
  assert.deepStrictEqual(C.hintTiers(tk, ["ls", "cat"]), [{ type: "cmds", cmds: ["ls", "cat"] }, { type: "text", text: "look around" }, { type: "text", text: "ls -a" }]);
  assert.deepStrictEqual(C.hintTiers(tk, []), [{ type: "text", text: "look around" }, { type: "text", text: "ls -a" }]);
  assert.deepStrictEqual(C.hintTiers(null, null), []);
  for (const l of LAB_ALL) for (const tk of l.tasks) { const tiers = C.hintTiers(tk, l.commands); assert(tiers.length >= 2 && tiers[0].type === "cmds", l.id); }
});
t("Checked when: every lab task says what is checked, from its goal or from the check itself", () => {
  const H = "/home/student";
  assert.strictEqual(C.describeCheck({ type: "exists", path: H + "/projects", kind: "dir" }), "the directory `~/projects` exists");
  assert.strictEqual(C.describeCheck({ type: "absent", path: H + "/a.tmp" }), "`~/a.tmp` no longer exists");
  assert.strictEqual(C.describeCheck({ type: "perms", path: H + "/x", perms: "-rw-------" }), "`~/x` has the permissions `-rw-------`");
  assert.strictEqual(C.describeCheck({ type: "owner", path: "/srv/upload", group: "web" }), "`/srv/upload` belongs to the group web");
  assert.strictEqual(C.describeCheck({ type: "all", checks: [{ type: "absent", path: "/a" }, { type: "exists", path: "/b" }, { type: "cwd", path: "/tmp" }] }), "`/a` no longer exists, `/b` exists and your current directory is `/tmp`");
  assert.strictEqual(C.describeCheck({ type: "any", checks: [{ type: "mode", path: "/d", mode: "775" }, { type: "mode", path: "/d", mode: "2775" }] }), "either `/d` has the mode 775 or `/d` has the mode 2775");
  assert.strictEqual(C.describeCheck({ type: "all", checks: [{ type: "history", regex: "a" }, { type: "history", regex: "b" }] }), "you have run the command the task asks for", "repeats are said once");
  assert.strictEqual(C.describeCheck({ type: "archive", path: H + "/s.tar.gz", format: "tar", compression: "gzip", has: ["www/i"] }), "`~/s.tar.gz` is a gzip-compressed tar archive that contains `www/i`");
  assert.strictEqual(C.describeCheck({ type: "user", name: "maria", password: "set" }), "the user maria exists and has a usable password");
  assert.strictEqual(C.describeCheck({ type: "unlocked" }), "you have handed in this level's key with `unlock`");
  assert.strictEqual(C.describeCheck({ type: "homestudent", path: "/home/students/x" }), "the system is in the state the task describes");
  assert.strictEqual(C.describeCheck({ type: "exists", path: "/home/students/x" }), "`/home/students/x` exists", "only the student's own home is shortened");
  assert.strictEqual(C.describeCheck(null), "the system is in the state the task describes");
  assert.strictEqual(C.checkedWhen({ goal: "the file is gone" }), "the file is gone."); assert.strictEqual(C.checkedWhen({ goal: "It works!" }), "It works!");
  assert.strictEqual(C.checkedWhen({ check: { type: "cwd", path: H } }), "your current directory is `~`.");
  const seen = new Set(); let n = 0;
  const walk = c => { if (!c) return; seen.add(c.type); (c.checks || []).forEach(walk); walk(c.check); };
  for (const l of LAB_ALL) for (const tk of l.tasks) { walk(tk.check); const s = C.checkedWhen(tk); n++;
    assert(s.length > 12 && !/undefined|null|NaN|\[object/.test(s), l.id + ": " + s); }
  for (const ty of seen) assert.notStrictEqual(C.describeCheck({ type: ty, path: "/p", other: "/o", name: "n", cmd: "c", dev: "d", addr: "a", dst: "x", checks: [], check: { type: "cwd", path: "/" } }),
    "the system is in the state the task describes", "check type '" + ty + "' used in a lab has its own wording");
  assert(n > 350);
});
// ---------------------------------------------------------------- item 6: variants, typed answers, navigator, explanations
t("variants: each rewords an original of the same objective, shares its conflict set and has its own wording", () => {
  const variants = bank.questions.filter(q => q.variantOf);
  const texts = new Set(bank.questions.map(q => q.q));
  assert.strictEqual(texts.size + bank.questions.filter(q => /^What does this|^Which command produced this/.test(q.q)).length >= bank.questions.length, true);
  for (const v of variants) {
    const base = bank.byId[v.variantOf];
    assert(base && !base.variantOf, v.id + ": the original exists and is not itself a variant");
    assert.strictEqual(v.obj, base.obj, v.id); assert(v.conflict != null && v.conflict === base.conflict, v.id + ": same conflict set");
    assert.notStrictEqual(v.q, base.q, v.id);
    assert.deepStrictEqual(C.familyOf(bank, v.id), C.familyOf(bank, base.id)); assert(C.familyOf(bank, base.id).includes(v.id));
  }
  for (const o in bank.objectives) assert(variants.filter(v => v.obj === o).length >= 2, o + " has variants");
  assert(variants.filter(v => v.type === "fill").length >= 20, "a good share of the variants are typed");
  assert.deepStrictEqual(C.familyOf(bank, "nope"), ["nope"]);
  assert.strictEqual(C.factCount(bank), 400); assert.strictEqual(C.factsSeen(bank, {}), 0);
  const v = variants[0];
  assert.strictEqual(C.factsSeen(bank, { [v.id]: { seen: 1 }, [v.variantOf]: { seen: 2 } }), 1, "two wordings of one fact count once");
});
t("variants: the fixed practice exams are unchanged, and no exam or study set holds two wordings of one fact", () => {
  for (const f of bank.forms) { const s = C.buildTest(bank, {}, { form: f }); assert.strictEqual(s.qids.length, 40); assert(s.qids.every(id => !bank.byId[id].variantOf), "form " + f); }
  const fam = ids => ids.map(id => bank.byId[id].variantOf || id);
  let used = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ex = C.buildTest(bank, {}, { seed }).qids; assert.strictEqual(new Set(fam(ex)).size, 40, "exam, seed " + seed);
    used += ex.filter(id => bank.byId[id].variantOf).length;
    const st = C.buildStudy(bank, {}, { count: 40 }, { seed }).qids; assert.strictEqual(new Set(fam(st)).size, st.length, "study, seed " + seed);
  }
  assert(used > 200, "random exams draw on the variants");
});
t("exam: a randomly drawn exam holds at least EXAM_TYPED_MIN typed questions and still matches the blueprint", () => {
  assert(C.EXAM_TYPED_MIN >= 5);
  for (const f of bank.forms) assert(bank.questions.filter(q => q.form === f && q.type === "fill").length >= C.EXAM_TYPED_MIN, "form " + f);
  const seenAll = {}; bank.questions.forEach((q, i) => { seenAll[q.id] = q.type === "fill" ? { seen: 3, right: 3, last: true } : { seen: 1, right: 0, last: false }; });   // typed ones are the least needed
  for (const qs of [{}, seenAll]) for (let seed = 1; seed <= 150; seed++) {
    const s = C.buildTest(bank, qs, { seed });
    assert(s.qids.filter(id => bank.byId[id].type === "fill").length >= C.EXAM_TYPED_MIN, "seed " + seed);
    assert.strictEqual(new Set(s.qids).size, 40);
    const c = C.objCounts(bank, s.qids); for (const o in bank.objectives) assert.strictEqual(c[o], bank.objectives[o].weight, o);
    const cs = s.qids.map(id => bank.byId[id].conflict).filter(x => x != null); assert.strictEqual(new Set(cs).size, cs.length, "no conflict set twice, seed " + seed);
  }
});
t("exam: an untimed run has no deadline, is labelled, and stays out of the exam average", () => {
  const s = C.buildTest(bank, {}, { seed: 4, timed: false });
  assert.strictEqual(s.deadline, null); assert.strictEqual(s.timed, false); assert.strictEqual(s.label, "Exam · untimed"); assert.strictEqual(s.qids.length, 40);
  assert.strictEqual(C.buildTest(bank, {}, { seed: 4 }).label, "Exam");
  const full = { mode: "test", total: 40, study: false };
  assert.strictEqual(C.readiness([Object.assign({ pct: 90, timed: true }, full), Object.assign({ pct: 10, timed: false }, full)]), 90);
  assert.strictEqual(C.readiness([Object.assign({ pct: 60 }, full)]), 60, "records saved before the timed field count as timed");
  assert(C.isReadinessExam(Object.assign({ pct: 90, timed: true }, full)));
  assert(!C.isReadinessExam(Object.assign({ pct: 10, timed: false }, full)));
  assert(C.isReadinessExam(Object.assign({ pct: 60 }, full)), "missing timed field still counts");
});
t("exam: blanks score wrong but leave per-question history untouched", () => {
  const st = C.freshState(), s = C.buildTest(bank, {}, { seed: 11 });
  assert.strictEqual(s.qids.length, 40);
  const answered = s.qids.slice(0, 2);
  answered.forEach(id => {
    const q = bank.byId[id];
    s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer;
  });
  const res = C.grade(bank, s);
  assert.strictEqual(res.total, 40);
  assert.strictEqual(res.score, 2, "two right answers");
  assert.strictEqual(res.answered, 2);
  assert.strictEqual(res.pct, 5);
  // 38 blanks count wrong in the score
  s.qids.slice(2).forEach(id => assert.strictEqual(res.perQ[id], false, id));
  C.recordResult(st, bank, s, res);
  const touched = Object.keys(st.qstats);
  assert.strictEqual(touched.length, 2, "only the two answered questions get qstats");
  answered.forEach(id => {
    assert.strictEqual(st.qstats[id].seen, 1);
    assert.strictEqual(st.qstats[id].right, 1);
    assert.strictEqual(st.qstats[id].ev, 1);
  });
  s.qids.slice(2).forEach(id => assert.strictEqual(st.qstats[id], undefined, "blank " + id + " stays unseen"));
  assert.strictEqual(C.missedIds(bank, st.qstats).length, 0, "blanks are not misses");
});
t("exam: blank miss does not demote mastery", () => {
  const now = new Date(2026, 9, 10, 12).getTime(), d0 = C.dayNum(now);
  const st = C.freshState(), id = bank.byObj["1.1"][0], q = bank.byId[id];
  st.qstats[id] = { seen: 3, right: 3, last: true, ev: 1, at: now, cdays: [d0 - 2, d0 - 1, d0], box: 3, due: d0 + 4 };
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].level, "mastered");
  const s = C.buildTest(bank, {}, { seed: 9 });
  if (!s.qids.includes(id)) s.qids[0] = id;
  // Leave the mastered question blank; answer everything else right.
  s.qids.forEach(qid => {
    if (qid === id) return;
    const qq = bank.byId[qid];
    s.answers[qid] = qq.type === "fill" ? qq.accept[0] : qq.answer;
  });
  C.recordResult(st, bank, s, C.grade(bank, s), now);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].coldDays, 3);
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[q.obj].level, "mastered");
  assert.deepStrictEqual(C.coldDaysOf(st.qstats[id]), [d0 - 2, d0 - 1, d0]);
});
t("exam: untimed run updates practice history but not readiness evidence or mastery days", () => {
  const now = new Date(2026, 9, 12, 12).getTime();
  const st = C.freshState();
  // A prior timed exam so readiness and pass chance have a baseline.
  const prior = C.buildTest(bank, {}, { seed: 2 });
  prior.qids.forEach(id => {
    const q = bank.byId[id];
    prior.answers[id] = q.type === "fill" ? q.accept[0] : q.answer;
  });
  C.recordResult(st, bank, prior, C.grade(bank, prior), now - 7 * 864e5);
  const readyBefore = C.readiness(st.tests);
  const passBefore = C.passPrediction(bank, st.qstats);
  const snap = id => {
    const qs = st.qstats[id];
    return qs ? [C.coldDaysOf(qs), qs.ev] : null;
  };
  const priorIds = Object.keys(st.qstats);
  const daysBefore = JSON.stringify(priorIds.sort().map(id => [id, snap(id)]));
  assert.strictEqual(readyBefore, 100);

  const s = C.buildTest(bank, {}, { seed: 5, timed: false });
  assert.strictEqual(s.timed, false);
  // Answer all wrong so any leaked cold evidence would move pass chance and mastery.
  s.qids.forEach(id => {
    const q = bank.byId[id];
    s.answers[id] = q.type === "fill" ? "nope" : [q.answer[0] === 0 ? 1 : 0];
  });
  C.recordResult(st, bank, s, C.grade(bank, s), now);
  assert.strictEqual(C.readiness(st.tests), readyBefore, "untimed stays out of readiness");
  const passAfter = C.passPrediction(bank, st.qstats);
  assert.strictEqual(passAfter.chance, passBefore.chance, "pass chance unchanged");
  assert.strictEqual(passAfter.seen, passBefore.seen, "cold evidence count unchanged");
  const daysAfter = JSON.stringify(priorIds.sort().map(id => [id, snap(id)]));
  assert.strictEqual(daysAfter, daysBefore, "prior ev and mastery days unchanged");
  // New questions touched only by the untimed run carry no cold evidence and no mastery days.
  s.qids.filter(id => !priorIds.includes(id)).forEach(id => {
    assert.strictEqual(st.qstats[id].ev, -1, id);
    assert.deepStrictEqual(C.coldDaysOf(st.qstats[id]), [], id);
  });
  // Practice history and schedule still move for the answered questions.
  s.qids.forEach(id => {
    assert.ok(st.qstats[id].seen >= 1, id);
    assert.strictEqual(st.qstats[id].last, false, id);
    assert.strictEqual(st.qstats[id].box, 0, id);
  });
  assert(!C.isReadinessExam(st.tests[st.tests.length - 1]));
});
t("checkTyped: listed spellings, spacing, blanks and strict case", () => {
  const q = { type: "fill", accept: ["ls -lh", "ls -hl"] };
  let r = C.checkTyped(q, "  ls   -hl ");
  assert.deepStrictEqual(r, { ok: true, answered: true, typed: "ls -hl", how: "listed", near: null, best: "ls -hl" });
  r = C.checkTyped(q, "   "); assert.deepStrictEqual(r, { ok: false, answered: false, typed: "", how: null, near: null, best: "ls -lh" });
  assert.strictEqual(C.checkTyped(q, null).ok, false); assert.strictEqual(C.checkTyped(q, undefined).answered, false);
  assert.deepStrictEqual(C.checkTyped(q, "ls -la"), { ok: false, answered: true, typed: "ls -la", how: null, near: null, best: "ls -lh" });
  assert.strictEqual(C.checkTyped({ accept: [] }, "x").best, ""); assert.strictEqual(C.checkTyped(null, "x").ok, false);
  assert.strictEqual(C.checkTyped({ accept: ["$#"] }, "$#").ok, true); assert.strictEqual(C.checkTyped({ accept: ["0"] }, 0).ok, true, "a number is graded as its text");
});
t("checkTyped: near misses are still wrong, and say what to fix", () => {
  const near = (accept, a) => { const r = C.checkTyped({ type: "fill", accept }, a); assert.strictEqual(r.ok, false, a); return [r.near, r.best]; };
  assert.deepStrictEqual(near(["ls -lh", "ls -hl"], "LS -HL"), ["case", "ls -hl"]);
  assert.deepStrictEqual(near(["FLOSS"], "floss"), ["case", "FLOSS"]);
  assert.deepStrictEqual(near(["-v"], "v"), ["dash", "-v"]);
  assert.deepStrictEqual(near(["--help"], "help"), ["dash", "--help"]);
  assert.deepStrictEqual(near(["pwd"], "$ pwd"), ["prompt", "pwd"]);
  assert.deepStrictEqual(near(["id"], "# id"), ["prompt", "id"]);
  assert.deepStrictEqual(near(["unset temp"], "`unset temp`"), ["quoted", "unset temp"]);
  assert.deepStrictEqual(near(["/etc/shadow"], '"/etc/shadow"'), ["quoted", "/etc/shadow"]);
  assert.deepStrictEqual(near(["ls -l"], "ls-l"), ["space", "ls -l"]);
  assert.deepStrictEqual(near(["chown tom report.txt"], "sudo chown tom report.txt"), ["sudo", "chown tom report.txt"]);
  assert.deepStrictEqual(near(["pwd"], "cd"), [null, "pwd"]);
  assert.deepStrictEqual(near(["$?"], "$ ?"), ["space", "$?"], "a variable is not mistaken for a prompt");
  assert.strictEqual(C.checkTyped({ accept: ["sudo passwd dave"] }, "sudo passwd dave").ok, true, "sudo is right when the listed answer uses it");
  assert.deepStrictEqual(near(["sudo passwd dave"], "passwd dave"), [null, "sudo passwd dave"]);
  for (const k of ["sudo", "prompt", "quoted", "dash", "case", "space"]) assert(C.TYPED_NEAR[k] && C.TYPED_NEAR[k].length > 20, k + " has a note");
  const q = { type: "fill", accept: ["chgrp sales report.txt"] };
  assert.strictEqual(C.extraSudo(q, "sudo " + q.accept[0]), true); assert.strictEqual(C.extraSudo(q, q.accept[0]), false); assert.strictEqual(C.extraSudo(q, null), false);
  assert.strictEqual(C.extraSudo(bank.byId["1.1-01"], "sudo x"), false, "only typed questions");
});
t("checkTyped agrees with isCorrect and answered for every typed question in the bank", () => {
  let n = 0;
  for (const q of bank.questions.filter(x => x.type === "fill" && !x.lab)) {
    for (const a of q.accept) { const r = C.checkTyped(q, a); assert(r.ok && r.how === "listed" && r.best === a, q.id + ": " + a); assert(C.isCorrect(q, " " + a + " ")); n++; }
    assert(!C.isCorrect(q, q.accept[0] + "x")); assert(!C.isCorrect(q, "")); assert(!C.answered(q, " "));
    const up = q.accept[0].toUpperCase();
    if (up !== q.accept[0] && !q.accept.includes(up)) assert.strictEqual(C.checkTyped(q, up).near, "case", q.id);
  }
  assert(n > 100, "checked " + n);
});
t("cold evidence treats a fact's wordings as one: a variant right after its original is a repeat", () => {
  const v = bank.questions.find(q => q.variantOf && q.type !== "fill"), base = bank.byId[v.variantOf];
  const day = 86400000, t0 = new Date(2026, 9, 1, 12).getTime(), st = C.freshState();
  const answer = (id, now, ok) => { const q = bank.byId[id], s = C.newSession(bank, "study", "x", [id], { study: true, now });
    s.answers[id] = ok === false ? (q.type === "fill" ? "zzz" : [q.options.findIndex((_, i) => !q.answer.includes(i))]) : q.type === "fill" ? q.accept[0] : q.answer;
    C.recordResult(st, bank, s, C.grade(bank, s, now), now); };
  assert.strictEqual(C.isCold(bank, st.qstats, v.id, t0), true, "nothing seen yet");
  answer(base.id, t0);
  assert.strictEqual(st.qstats[base.id].ev, 1); assert.deepStrictEqual(C.coldDaysOf(st.qstats[base.id]), [C.dayNum(t0)]);
  assert.strictEqual(C.isCold(bank, st.qstats, v.id, t0 + day), false, "the original was answered yesterday");
  answer(v.id, t0 + day);
  assert.strictEqual(st.qstats[v.id].ev, -1, "no fresh evidence from a reworded repeat"); assert.deepStrictEqual(C.coldDaysOf(st.qstats[v.id]), [], "and no mastery day");
  assert.strictEqual(C.objectiveStats(bank, st.qstats)[v.obj].coldDays, 1);
  assert.strictEqual(C.isCold(bank, st.qstats, base.id, t0 + 2 * day), false, "and the other way round");
  const later = t0 + (C.COLD_DAYS + 2) * day;
  assert.strictEqual(C.isCold(bank, st.qstats, v.id, later), true, "after COLD_DAYS without any wording it counts again");
  answer(v.id, later);
  assert.strictEqual(st.qstats[v.id].ev, 1); assert.strictEqual(C.objectiveStats(bank, st.qstats)[v.obj].coldDays, 2);
  // a variant met first is a real first attempt, and then the original is the repeat
  const st2 = C.freshState(); const keep = st.qstats; st.qstats = st2.qstats;
  answer(v.id, t0); assert.strictEqual(st.qstats[v.id].ev, 1); assert.strictEqual(C.coldDaysOf(st.qstats[v.id]).length, 1);
  answer(base.id, t0 + day, false); assert.strictEqual(st.qstats[base.id].ev, -1, "a miss on the repeat doesn't count against the estimate either");
  st.qstats = keep;
  const other = bank.questions.find(q => !q.variantOf && C.familyOf(bank, q.id).length === 1);
  assert.strictEqual(C.isCold(bank, { [other.id]: { seen: 1, at: t0 } }, other.id, t0 + day), false);
  assert.strictEqual(C.isCold(bank, { [other.id]: { seen: 1, at: t0 } }, other.id, t0 + C.COLD_DAYS * day), true);
});
t("daily review: one schedule per fact, and a due fact comes back in the wording seen longest ago", () => {
  const v = bank.questions.find(q => q.variantOf), base = bank.byId[v.variantOf];
  const day = 86400000, now = new Date(2026, 9, 10, 12).getTime(), today = C.dayNum(now);
  const st = C.freshState(); st.settings.review = { on: true, size: 5, fresh: 0 };
  st.qstats[base.id] = { seen: 3, right: 3, last: true, at: now - 4 * day, box: 3, due: today };
  assert.deepStrictEqual(C.dueIds(bank, st.qstats, today), [base.id]);
  assert.strictEqual(C.familyLead(bank, st.qstats, v.id), base.id); assert.strictEqual(C.rotateVariant(bank, st.qstats, base.id, C.rng(1)), v.id, "the unseen wording");
  const s = C.buildReview(bank, st, { today, seed: 2 });
  assert(s.qids.includes(v.id) && !s.qids.includes(base.id), "the review asks the variant");
  s.answers[v.id] = v.type === "fill" ? v.accept[0] : v.answer;
  C.recordResult(st, bank, s, C.grade(bank, s, now), now);
  assert.strictEqual(st.qstats[v.id].box, 4, "the variant carries on from the original's review step");
  assert.strictEqual(st.qstats[v.id].due, today + 8);
  assert.strictEqual(C.familyLead(bank, st.qstats, base.id), v.id);
  assert.deepStrictEqual(C.dueIds(bank, st.qstats, today), [], "the original is no longer due: the fact was just reviewed");
  assert.strictEqual(C.reviewForecast(bank, st.qstats, today).due, 0); assert.strictEqual(C.reviewForecast(bank, st.qstats, today + 8).due, 1, "counted once, not per wording");
  assert.strictEqual(C.rotateVariant(bank, st.qstats, v.id, C.rng(1)), base.id, "next time it is the original's turn");
  const again = C.buildReview(bank, st, { today: today + 8, seed: 2 }).qids; assert(again.includes(base.id) && !again.includes(v.id));
  const lone = bank.questions.find(q => C.familyOf(bank, q.id).length === 1).id;
  assert.strictEqual(C.rotateVariant(bank, st.qstats, lone, C.rng(1)), lone); assert.strictEqual(C.familyLead(bank, {}, lone), lone);
  assert.strictEqual(C.dailyReview(bank, st, today).unseen, 399, "new questions are counted as facts");
  assert(!C.newIds(bank, st.qstats, 1000, C.rng(3)).some(id => C.familyOf(bank, id).includes(base.id)), "a seen fact isn't offered as new in another wording");
});
t("exam navigator: Answered, Unanswered (seen), Unseen and Flagged, with filters", () => {
  const s = C.buildTest(bank, {}, { seed: 9 }), ans = id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? q.accept[0] : q.answer; };
  let c = C.navCounts(bank, s);
  assert.deepStrictEqual(c, { answered: 0, unanswered: 1, unseen: 39, flagged: 0, open: 40 }, "only the current question has been seen");
  s.seen = { [s.qids[0]]: 1, [s.qids[1]]: 1, [s.qids[2]]: 1 }; ans(s.qids[0]); ans(s.qids[5]); s.flags[s.qids[1]] = true; s.flags[s.qids[5]] = true; s.flags[s.qids[7]] = false; s.cur = 2;
  const typed = s.qids.findIndex(id => bank.byId[id].type === "fill"); s.seen[s.qids[typed]] = 1; s.answers[s.qids[typed]] = "   ";
  const st = C.navStates(bank, s);
  assert.strictEqual(st.length, 40); assert.deepStrictEqual(st[0], { i: 0, id: s.qids[0], flagged: false, state: "answered" });
  assert.strictEqual(st[1].state, "unanswered"); assert.strictEqual(st[1].flagged, true); assert.strictEqual(st[2].state, "unanswered"); assert.strictEqual(st[5].state, "answered");
  assert.strictEqual(st[typed].state, typed === 0 || typed === 5 ? "answered" : "unanswered", "a typed question with only spaces is not answered");
  assert.strictEqual(st[39].state, typed === 39 ? "unanswered" : "unseen");
  c = C.navCounts(bank, s); assert.strictEqual(c.answered + c.unanswered + c.unseen, 40); assert.strictEqual(c.flagged, 2); assert.strictEqual(c.open, 40 - c.answered);
  assert.deepStrictEqual(C.navFilter(bank, s, "flagged"), [1, 5]);
  assert.strictEqual(C.navFilter(bank, s, "open").length, c.open); assert(!C.navFilter(bank, s, "open").includes(0));
  assert.strictEqual(C.navFilter(bank, s, "all").length, 40);
  assert.strictEqual(C.navNext([1, 5], 0), 1); assert.strictEqual(C.navNext([1, 5], 1), 5); assert.strictEqual(C.navNext([1, 5], 5), 1, "wraps round"); assert.strictEqual(C.navNext([], 3), -1);
  // the seen marks and the hidden timer survive a reload; junk does not
  const back = C.cleanSession(JSON.parse(JSON.stringify(Object.assign({}, s, { hideTimer: true, seen: Object.assign({ "<img>": 1, ok: "x" }, s.seen) }))));
  assert.strictEqual(back.hideTimer, true); assert.strictEqual(back.seen[s.qids[1]], 1); assert(!("<img>" in back.seen) && !("ok" in back.seen));
  assert.strictEqual(C.cleanSession(Object.assign({}, s, { hideTimer: "yes" })).hideTimer, false);
});
t("splitExplanation: first sentence, then the rest; short or single-sentence text stays whole", () => {
  const one = "Ubuntu is built from Debian packages.";
  assert.deepStrictEqual(C.splitExplanation(one), { short: one, rest: "" });
  assert.deepStrictEqual(C.splitExplanation(null), { short: "", rest: "" });
  const long = "`-l` gives the long format and `-h` turns byte counts into units such as K, M and G. Short options can be combined behind one dash in any order, e.g. as -lh or -hl. Either works.";
  assert.deepStrictEqual(C.splitExplanation(long), { short: "`-l` gives the long format and `-h` turns byte counts into units such as K, M and G.",
    rest: "Short options can be combined behind one dash in any order, e.g. as -lh or -hl. Either works." });
  const code = "Run `tar -xzf a.tar.gz. Then` nothing special happens because that text is inside a code span and must not be split there at all. `-x` extracts. Done here.";
  assert.strictEqual(C.splitExplanation(code).short, "Run `tar -xzf a.tar.gz. Then` nothing special happens because that text is inside a code span and must not be split there at all.");
  const abbr = "Debian-family systems use .deb packages, e.g. Ubuntu and Mint, with dpkg and apt as the tools that install and manage them on disk. Red Hat uses RPM.";
  assert.strictEqual(C.splitExplanation(abbr).rest, "Red Hat uses RPM.");
  let split = 0;
  for (const q of bank.questions) {
    const { short, rest } = C.splitExplanation(q.explanation);
    assert(short.length >= 20, q.id + ": first part too short: " + short);
    assert.strictEqual((short.match(/`/g) || []).length % 2, 0, q.id + ": split inside code");
    assert.strictEqual(rest ? short + " " + rest : short, q.explanation.trim().replace(/\s+/g, " ") === q.explanation.trim() ? q.explanation.trim() : rest ? short + " " + rest : short);
    if (rest) { split++; assert(/[.?!]$/.test(short), q.id); }
  }
  assert(split > 200, "most explanations have a second tier");
});

t("placement: 2 unseen families per objective + 2 extras on heaviest, Recall + higher when possible, seeded and shuffled", () => {
  const s = C.buildPlacement(bank, {}, { seed: 7 });
  assert(s); assert.strictEqual(s.mode, "placement"); assert.strictEqual(s.label, "Placement test");
  assert.strictEqual(s.study, true); assert.strictEqual(s.timed, false); assert.strictEqual(s.deadline, null);
  assert.strictEqual(s.qids.length, 40);
  const c = C.objCounts(bank, s.qids);
  const heavy = Object.keys(bank.objectives).slice().sort((a, b) =>
    bank.objectives[b].weight - bank.objectives[a].weight || (a < b ? -1 : 1));
  const extraObjs = new Set(heavy.slice(0, 2));
  for (const o of Object.keys(bank.objectives)) {
    assert.strictEqual(c[o], extraObjs.has(o) ? 3 : 2, o + " count");
  }
  assert.strictEqual(heavy[0], "3.3"); assert.strictEqual(heavy[1], "2.1");
  // One family each: no two wordings of the same fact.
  const fam = id => bank.byId[id].variantOf || id;
  assert.strictEqual(new Set(s.qids.map(fam)).size, 40);
  // Prefer Recall + higher when the bank allows (every objective has both tiers).
  for (const o of Object.keys(bank.objectives)) {
    const lv = s.qids.filter(id => bank.byId[id].obj === o).map(id => bank.byId[id].level || 1);
    assert(lv.some(x => x === 1), o + " has Recall");
    assert(lv.some(x => x > 1), o + " has a higher tier");
  }
  // Objective order is shuffled (not 1.1, 1.2, …).
  const firstObjs = [];
  for (const id of s.qids) { const o = bank.byId[id].obj; if (firstObjs[firstObjs.length - 1] !== o) firstObjs.push(o); }
  assert.strictEqual(firstObjs.length, 19);
  assert(firstObjs.join(",") !== Object.keys(bank.objectives).join(","), "objectives are shuffled");
  // Same seed → same picks; opts.rand is used when given.
  assert.deepStrictEqual(C.buildPlacement(bank, {}, { seed: 7 }).qids, s.qids);
  const r1 = C.rng(99), r2 = C.rng(99);
  assert.deepStrictEqual(C.buildPlacement(bank, {}, { rand: r1 }).qids, C.buildPlacement(bank, {}, { rand: r2 }).qids);
  // Seen families are skipped (a second run picks other facts).
  const qs = {};
  for (const id of s.qids) for (const f of C.familyOf(bank, id)) qs[f] = { seen: 1, right: 0, last: false, at: 1 };
  const again = C.buildPlacement(bank, qs, { seed: 7 });
  assert(again); assert.strictEqual(again.qids.length, 40);
  assert(again.qids.every(id => !C.familyOf(bank, id).some(f => qs[f])), "no previously-seen family");
  // One family left in an objective → only one pick there.
  const oneLeft = {};
  const o11 = bank.byObj["1.1"], keep = o11.find(id => !qs[id] && !(bank.byId[id].variantOf && qs[bank.byId[id].variantOf]));
  for (const id of o11) {
    if ((bank.byId[id].variantOf || id) === (bank.byId[keep].variantOf || keep)) continue;
    for (const f of C.familyOf(bank, id)) oneLeft[f] = { seen: 1, right: 0, last: false, at: 1 };
  }
  Object.assign(oneLeft, qs);
  const short = C.buildPlacement(bank, oneLeft, { seed: 7 });
  assert(short); assert.strictEqual((short.qids.filter(id => bank.byId[id].obj === "1.1")).length, 1);
  // Nothing unseen → null.
  const all = {}; bank.questions.forEach(q => { all[q.id] = { seen: 1, right: 0, last: false, at: 1 }; });
  assert.strictEqual(C.buildPlacement(bank, all, { seed: 1 }), null);
});

t("placement: Don't know is a cold miss; blanks stay blanks; exams/ladder/qotd ignore it", () => {
  const st = C.freshState(), s = C.buildPlacement(bank, {}, { seed: 3 });
  const a = s.qids[0], b = s.qids[1], c = s.qids[2], rest = s.qids.slice(3);
  // a: Don't know (no answer), b: blank, c: cold correct, rest: cold wrong picks
  s.dontKnow = { [a]: 1 };
  const qC = bank.byId[c];
  s.answers[c] = qC.type === "fill" ? qC.accept[0] : qC.answer.slice();
  for (const id of rest) {
    const q = bank.byId[id];
    if (q.type === "fill") s.answers[id] = "nope";
    else s.answers[id] = [q.options.map((_, i) => i).find(i => q.answer.indexOf(i) < 0)];
  }
  // Keep a (don't know), drop blank b, keep answered+dk — same filter the app uses on finish.
  s.qids = s.qids.filter(id => id !== b);
  const res = C.grade(bank, s), rec = C.recordResult(st, bank, s, res, 1.7e12);
  assert.strictEqual(rec.mode, "placement");
  assert(rec.dontKnow && rec.dontKnow.indexOf(a) >= 0);
  assert.strictEqual(st.qstats[a].ev, 0, "Don't know is cold evidence of a miss");
  assert.strictEqual(st.qstats[a].seen, 1); assert.strictEqual(st.qstats[a].right, 0); assert.strictEqual(st.qstats[a].last, false);
  assert.strictEqual(st.qstats[b], undefined, "a real blank writes no history");
  assert.strictEqual(st.qstats[c].ev, 1); assert.deepStrictEqual(C.coldDaysOf(st.qstats[c]), [C.dayNum(1.7e12)]);
  const os = C.objectiveStats(bank, st.qstats);
  assert.strictEqual(os[bank.byId[c].obj].level, "familiar", "a cold correct earns Familiar");
  assert.strictEqual(C.isReadinessExam(rec), false);
  assert.strictEqual(C.ladder(st.tests).done, 0);
  assert.strictEqual(C.qotdDone(st.tests), false);
  assert.strictEqual(st.tests.filter(t => t.mode === "test").length, 0, "Exams taken ignores placement");
  // Mixed-exam demotion does not run on placement (mode is not test).
  assert(!Object.keys(st.qstats).some(id => (st.qstats[id].cdrop || []).length));
});

t("placementSummary: outcome words and startWith ranking", () => {
  const objs = Object.keys(bank.objectives);
  const heavy = objs.slice().sort((a, b) => bank.objectives[b].weight - bank.objectives[a].weight || (a < b ? -1 : 1))[0];
  const light = objs.filter(o => o !== heavy).sort((a, b) => bank.objectives[a].weight - bank.objectives[b].weight || (a < b ? -1 : 1))[0];
  const mid = objs.find(o => o !== heavy && o !== light);
  const pick = (o, n) => (bank.byObj[o] || []).slice(0, n);
  const ids = pick(heavy, 3).concat(pick(light, 2), pick(mid, 2));
  const rightAns = id => { const q = bank.byId[id]; return q.type === "fill" ? q.accept[0] : q.answer.slice(); };
  const wrongAns = id => { const q = bank.byId[id]; return q.type === "fill" ? "nope" : [q.options.map((_, i) => i).find(i => q.answer.indexOf(i) < 0)]; };
  const answers = {};
  // heavy: 0 of 3, light: 1 of 2, mid: all right → general outcome words including Knew N of M / Knew all
  answers[ids[0]] = wrongAns(ids[0]); answers[ids[1]] = wrongAns(ids[1]); answers[ids[2]] = wrongAns(ids[2]);
  answers[ids[3]] = rightAns(ids[3]); answers[ids[4]] = wrongAns(ids[4]);
  answers[ids[5]] = rightAns(ids[5]); answers[ids[6]] = rightAns(ids[6]);
  const sum = C.placementSummary(bank, { qids: ids, answers });
  assert.strictEqual(sum.byObj[heavy].right, 0); assert.strictEqual(sum.byObj[heavy].asked, 3); assert.strictEqual(sum.byObj[heavy].outcome, "New to you");
  assert.strictEqual(sum.byObj[light].right, 1); assert.strictEqual(sum.byObj[light].asked, 2); assert.strictEqual(sum.byObj[light].outcome, "Knew 1 of 2");
  assert.strictEqual(sum.byObj[mid].right, 2); assert.strictEqual(sum.byObj[mid].outcome, "Knew all");
  // Fewest right first, then heavier weight, then objective id: heavy (0 right + weight 4) ranks first.
  assert.strictEqual(sum.startWith[0], heavy, "0 right + heavier weight ranks first");
  assert.strictEqual(sum.startWith.length, 3);
  // Knew 2 of 3 when partial on a 3-question objective.
  const partialIds = pick(heavy, 3);
  const partialAns = { [partialIds[0]]: rightAns(partialIds[0]), [partialIds[1]]: rightAns(partialIds[1]), [partialIds[2]]: wrongAns(partialIds[2]) };
  assert.strictEqual(C.placementSummary(bank, { qids: partialIds, answers: partialAns }).byObj[heavy].outcome, "Knew 2 of 3");
  // Don't know counts as asked but not right.
  const dk = C.placementSummary(bank, { qids: pick(heavy, 2), answers: {}, dontKnow: pick(heavy, 2) });
  assert.strictEqual(dk.byObj[heavy].asked, 2); assert.strictEqual(dk.byObj[heavy].right, 0); assert.strictEqual(dk.byObj[heavy].outcome, "New to you");
});
t("Choose TWO/THREE can be checked only with exactly the asked number of picks", () => {
  const two = bank.questions.find(q => q.type === "multi" && q.answer.length === 2);
  const three = bank.questions.find(q => q.type === "multi" && q.answer.length === 3);
  const single = bank.questions.find(q => q.type === "single");
  const fill = bank.questions.find(q => q.type === "fill");
  assert(two && three && single && fill);
  assert.strictEqual(C.multiPick(single, [0]), null);
  assert.strictEqual(C.multiPick(fill, fill.accept[0]), null);
  assert.strictEqual(C.multiStatus(single, [0], true), "");
  assert.deepStrictEqual(C.multiPick(two, [two.answer[0]]), { need: 2, have: 1, ready: false });
  assert.strictEqual(C.multiStatus(two, [two.answer[0]], true), "Pick 1 more to check");
  assert.strictEqual(C.multiStatus(two, [], true), "Pick 2 more to check");
  assert.strictEqual(C.multiStatus(two, undefined, true), "Pick 2 more to check");
  assert.strictEqual(C.multiStatus(two, [two.answer[0]], false), "Select 2. 1 selected.");
  assert.deepStrictEqual(C.multiPick(two, two.answer.slice()), { need: 2, have: 2, ready: true });
  assert.strictEqual(C.multiStatus(two, two.answer.slice(), true), "Select 2. 2 selected.");
  assert.strictEqual(C.multiPick(two, two.answer.slice().reverse()).ready, true);
  const extra = two.options.findIndex((_, i) => two.answer.indexOf(i) < 0);
  assert.strictEqual(C.multiStatus(two, two.answer.concat(extra), true), "Unpick 1 to check");
  assert.strictEqual(C.multiPick(two, two.answer.concat(extra)).ready, false);
  assert.strictEqual(C.multiStatus(three, [three.answer[0]], true), "Pick 2 more to check");
  assert.strictEqual(C.multiStatus(three, three.answer.slice(), true), "Select 3. 3 selected.");
  const ids = [two.id, three.id, single.id, fill.id];
  const s = C.newSession(bank, "test", "Exam", ids, { now: 1 });
  s.answers[two.id] = [two.answer[0]];
  s.answers[three.id] = [three.answer[0]];
  s.answers[single.id] = single.answer.slice();
  assert.deepStrictEqual(C.shortPicks(bank, s), [0, 1], "one of two and one of three are both short; a full single is not");
  s.answers[two.id] = two.answer.slice();
  assert.deepStrictEqual(C.shortPicks(bank, s), [1]);
  s.answers[three.id] = three.options.map((_, i) => i);
  assert.deepStrictEqual(C.shortPicks(bank, s), [], "too many picks is not a short question");
  assert.strictEqual(C.shortPickLine([11, 30]), "2 questions have fewer picks than asked: 12, 31");
  assert.strictEqual(C.shortPickLine([11]), "1 question has fewer picks than asked: 12");
  assert.strictEqual(C.shortPickLine([]), "");
  assert(bank.questions.every(q => (q.options || []).length <= 5), "options stop at E, so A-E does not clash with F for flag");
});

// ---------------------------------------------------------------- lesson exercises: split a command, builtin or external
t("lesson exercises: ten original lines across 2.1-2.4, and the twelve builtin or external names", () => {
  const ex = C.LESSON_EXERCISES;
  assert.strictEqual(ex.length, 2);
  assert.strictEqual(ex[0].id, "split"); assert.strictEqual(ex[0].label, "Guided"); assert.strictEqual(ex[0].kind, "split");
  assert.strictEqual(ex[1].id, "sort"); assert.strictEqual(ex[1].label, "Explorational"); assert.strictEqual(ex[1].kind, "sort");
  assert.strictEqual(ex[0].items.length, 10);
  const objs = {};
  for (const it of ex[0].items) {
    assert(["2.1", "2.2", "2.3", "2.4"].indexOf(it.obj) >= 0, it.obj);
    objs[it.obj] = 1;
    assert(it.tokens.length >= 1);
    assert.strictEqual(it.tokens[0].role, "command", it.tokens.map(t => t.t).join(" "));
    for (const tok of it.tokens) assert(C.LX_ROLES.indexOf(tok.role) >= 0, tok.role);
  }
  assert.deepStrictEqual(Object.keys(objs).sort(), ["2.1", "2.2", "2.3", "2.4"]);
  const cat = ex[0].items.find(it => it.tokens.map(t => t.t).join(" ") === "cat -n /etc/passwd");
  assert(cat, "the worked example is one of the ten");
  assert.deepStrictEqual(cat.tokens.map(t => t.role), ["command", "option", "argument"]);
  assert.deepStrictEqual(ex[1].items.map(i => i.name), ["cd", "echo", "ls", "type", "pwd", "cat", "export", "grep", "alias", "man", "history", "find"]);
  const bin = {}; ex[1].items.forEach(i => { bin[i.name] = i.bin; assert(C.LX_BINS.indexOf(i.bin) >= 0); });
  assert.deepStrictEqual(bin, {
    cd: "builtin", echo: "builtin", ls: "external", type: "builtin", pwd: "builtin", cat: "external",
    export: "builtin", grep: "external", alias: "builtin", man: "external", history: "builtin", find: "external",
  });
  assert(/type/.test(ex[1].explain), "the note says how type tells builtin from external");
});
t("split check: a line is right only when every token has its role", () => {
  const item = C.LESSON_EXERCISES[0].items[0];
  const right = item.tokens.map(t => t.role);
  assert.deepStrictEqual(C.checkSplitLine(item, right), { ok: true, blank: [], wrong: [] });
  const swapped = right.slice(); swapped[1] = "argument";
  assert.deepStrictEqual(C.checkSplitLine(item, swapped), { ok: false, blank: [], wrong: [1] });
  assert.deepStrictEqual(C.checkSplitLine(item, ["command", "", "argument"]), { ok: false, blank: [1], wrong: [] });
  assert.deepStrictEqual(C.checkSplitLine(item, ["command"]).blank, [1, 2]);
  assert.strictEqual(C.checkSplitLine(item, null).ok, false);
  assert.deepStrictEqual(C.checkSplitLine(item, ["command", "flag", "argument"]).wrong, [1], "an unknown role is a mistake, not a blank");
  assert.deepStrictEqual(C.checkSplitLine(item, right.concat("command")).wrong, [3], "an extra token is a mistake");
});
t("split exercise: done lists only the lines that are fully right", () => {
  const items = C.LESSON_EXERCISES[0].items;
  const answers = items.map(it => it.tokens.map(t => t.role));
  const all = C.checkSplitExercise(items, answers);
  assert.strictEqual(all.ok, true);
  assert.deepStrictEqual(all.done, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  answers[3] = answers[3].slice(); answers[3][0] = "argument";
  const miss = C.checkSplitExercise(items, answers);
  assert.strictEqual(miss.ok, false);
  assert.strictEqual(miss.done.indexOf(3), -1);
  assert.strictEqual(miss.results[3].wrong[0], 0);
  assert.strictEqual(C.checkSplitExercise([], []).ok, false);
});
t("sort check: each name is builtin or external, and a blank is unfinished", () => {
  const items = C.LESSON_EXERCISES[1].items;
  const picks = {}; items.forEach(i => { picks[i.name] = i.bin; });
  const ok = C.checkSortExercise(items, picks);
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.done, items.map((_, i) => i));
  picks.ls = "builtin"; delete picks.find; picks.echo = "";
  const bad = C.checkSortExercise(items, picks);
  assert.strictEqual(bad.ok, false);
  assert.deepStrictEqual(bad.wrong, ["ls"]);
  assert.deepStrictEqual(bad.blank.slice().sort(), ["echo", "find"]);
  assert.strictEqual(bad.done.indexOf(items.findIndex(i => i.name === "ls")), -1);
  const again = {}; items.forEach(i => { again[i.name] = i.bin; }); again.sudo = "external";
  assert.strictEqual(C.checkSortExercise(items, again).ok, true, "a name that is not in the exercise does not count");
  assert.strictEqual(C.checkSortExercise(items, null).blank.length, 12);
});
t("lesson exercise progress unions correct items and completes once", () => {
  assert.deepStrictEqual(C.lessonExerciseRecord(null, [0, 2], 10, 50), { done: [0, 2] });
  const more = C.lessonExerciseRecord({ done: [0, 2] }, [2, 1], 10, 60);
  assert.deepStrictEqual(more, { done: [0, 1, 2] });
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const fin = C.lessonExerciseRecord(more, all, 10, 70);
  assert.strictEqual(fin.completedAt, 70); assert.deepStrictEqual(fin.done, all);
  const again = C.lessonExerciseRecord(fin, [0], 10, 80);
  assert.strictEqual(again.completedAt, 70, "the first finish time stays");
  assert.deepStrictEqual(again.done, all);
  assert.deepStrictEqual(C.lessonExerciseRecord(null, [-1, 1.5, 3, 99], 10, 1), { done: [3] });
  assert.deepStrictEqual(C.lessonExerciseStatus(null, 10), { state: "new", done: 0, total: 10, text: "New" });
  assert.deepStrictEqual(C.lessonExerciseStatus({ done: [0, 1] }, 10), { state: "started", done: 2, total: 10, text: "2 of 10" });
  assert.deepStrictEqual(C.lessonExerciseStatus(fin, 10), { state: "done", done: 10, total: 10, text: "Done" });
  assert.strictEqual(C.lessonExerciseStatus({ done: [0], completedAt: 1 }, 10).state, "started", "a finish time without every item is not Done");
});
t("lesson exercise progress is saved like a lab: cleaned, merged, exported", () => {
  const d = C.cleanDoc({ lx: { split: { done: [0, 0, 2, -1, "x"], completedAt: 5, hack: "<b>" }, nope: "no" } });
  assert.deepStrictEqual(d.lx.split, { done: [0, 2], completedAt: 5 });
  assert.strictEqual(d.lx.nope, undefined);
  const m = C.mergeStates([{ lx: { split: { done: [0], completedAt: 9 } } }, { lx: { split: { done: [1], completedAt: 4 } } }]);
  assert.deepStrictEqual(m.lx.split, { done: [0, 1], completedAt: 4 });
  const own = C.ownPart({ lx: m.lx, settings: {} }, C.mergeStates([{ lx: { split: { done: [1], completedAt: 4 } } }]));
  assert.deepStrictEqual(own.lx.split.done, [0, 1]);
  const kept = C.migrate({ lx: { sort: { done: [0, -1], completedAt: 3, hack: "<b>" } } });
  assert.deepStrictEqual(kept.lx.sort, { done: [0], completedAt: 3 });
  const st = C.freshState(); st.lx = { split: { done: [1], completedAt: 8 } };
  assert.strictEqual(C.hasProgress(st), true);
  const back = C.importState(C.freshState(), JSON.parse(JSON.stringify(C.exportDoc(st))));
  assert.deepStrictEqual(back.lx.split, { done: [1], completedAt: 8 });
});

console.log(`\n${n} tests passed`);
