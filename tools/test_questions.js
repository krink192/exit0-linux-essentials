// SPDX-License-Identifier: AGPL-3.0-or-later
// Type-the-command questions checked by the lab shell (bank.json questions with a `lab` block):
//   - the untouched setup must NOT pass the check (otherwise any answer would count),
//   - every listed accepted answer must pass when it's run on a fresh machine,
//   - every `reject` example (a plausible wrong command) must fail,
// and core.js grading must agree: listed answers and other working commands are correct, wrong ones aren't.
// It also checks the targeted set (form J) still matches the exam blueprint.
// Run: node tools/test_questions.js
const assert = require("assert");
const path = require("path");
const S = require(path.join(__dirname, "../docs/js/shell.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const bank = require(path.join(__dirname, "../bank.json"));

let n = 0, answers = 0, rejects = 0;
const run = (q, line) => { const sh = S.createMachine({ setup: q.lab.setup || {} }); const r = sh.exec(line, { noIncomplete: true, tty: false }); return { ok: sh.check(q.lab.check), out: r.out }; };
for (const q of bank.questions.filter(x => x.lab)) {
  assert.strictEqual(q.type, "fill", q.id + ": only fill-in questions can be lab-checked");
  assert.strictEqual(S.createMachine({ setup: q.lab.setup || {} }).check(q.lab.check), false, q.id + ": the check already passes before any command");
  for (const a of q.accept) {
    const r = run(q, a);
    assert.ok(r.ok, `${q.id}: accepted answer '${a}' doesn't do the job on the simulated system. Output:\n${r.out}`);
    assert.ok(C.isCorrect(q, a), `${q.id}: core.js doesn't accept '${a}'`); answers++;
  }
  assert.ok((q.lab.reject || []).length, q.id + ": add at least one wrong command to lab.reject");
  for (const a of q.lab.reject) {
    const r = run(q, a);
    assert.ok(!r.ok, `${q.id}: the wrong command '${a}' passes the check. Output:\n${r.out}`);
    assert.ok(!C.isCorrect(q, a), `${q.id}: core.js accepts the wrong command '${a}'`); rejects++;
  }
  n++;
}
assert.ok(n >= 8, "expected the lab-checked questions from tools/t7.py");

// a working command that isn't in the accepted list still counts, and output is reported for the review screen
const byId = Object.fromEntries(bank.questions.map(q => [q.id, q]));
const hard = bank.questions.find(q => q.lab && q.lab.check.type === "hardlink");
assert.ok(hard && C.isCorrect(hard, "ln ./data.txt ./copy.txt"), "an unlisted but working hard-link command is graded correct");
assert.ok(!C.isCorrect(hard, "   "), "blank answers are wrong");
const perm = bank.questions.find(q => q.lab && q.lab.check.type === "perms");
const r = C.runLab(perm, "chmod 755 deploy.sh"); assert.ok(r && !r.ok, "runLab reports a wrong command as not ok");
assert.ok(C.isCorrect(perm, "chmod u=rwx,go=r deploy.sh"), "an equivalent symbolic mode counts");

// the targeted set is a full blueprint-weighted exam of its own
const J = bank.questions.filter(q => q.form === "J");
assert.strictEqual(J.length, 40, "form J has 40 questions");
for (const o in bank.objectives) assert.strictEqual(J.filter(q => q.obj === o).length, bank.objectives[o].weight, "form J weight for " + o);
assert.ok(J.every(q => q.level >= 2), "form J has only Apply and Analyze questions");
assert.ok(bank.forms.includes("J") && byId[J[0].id], "form J is listed");
console.log(`questions: ${n} lab-checked questions, ${answers} accepted answers and ${rejects} wrong commands verified; form J matches the blueprint`);
