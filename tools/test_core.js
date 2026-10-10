// SPDX-License-Identifier: GPL-3.0-or-later
// Run: node tools/test_core.js
const assert = require("assert");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../docs/data/bank.js"));
require(path.join(__dirname, "../docs/data/cards.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const bank = C.indexBank(window.LE_BANK), cards = window.LE_CARDS;
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("bank has 240 questions and weights sum to 40", () => {
  assert.strictEqual(bank.questions.length, 240);
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
console.log(`\n${n} tests passed`);
