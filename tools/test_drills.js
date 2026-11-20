// SPDX-License-Identifier: AGPL-3.0-or-later
// Command practice drills (tools/drills.py -> docs/data/drills.js). For every value combination of every template:
//   - the check must fail on the fresh machine (otherwise any command would count),
//   - the solution must pass it,
//   - every listed wrong command must fail it,
//   - placeholders must all be filled.
// Then core.js: picking skills, sessions, grading, the mastery map, and the sandbox machine.
// Run: node tools/test_drills.js
const assert = require("assert");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../docs/data/drills.js"));
require(path.join(__dirname, "../docs/data/labindex.js"));
require(path.join(__dirname, "../docs/data/bank.js"));
const S = require(path.join(__dirname, "../docs/js/shell.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const D = window.LE_DRILLS, X = window.LE_LABINDEX, bank = C.indexBank(window.LE_BANK);

/** Every value combination: each case times every value of each var (capped, so huge pools still finish). */
function combos(t) {
  let list = (t.cases && t.cases.length ? t.cases : [{}]).map(c => Object.assign({}, c));
  for (const k of Object.keys(t.vars || {})) list = [].concat(...list.map(c => t.vars[k].map(v => Object.assign({}, c, { [k]: v }))));
  return list.slice(0, 60);
}
function runLines(sh, text) {
  let buf = null, r = { out: "" };
  for (const line of String(text).split("\n")) { const src = buf == null ? line : buf + "\n" + line; r = sh.exec(src, { tty: false }); buf = r.incomplete ? src : null; }
  assert.strictEqual(buf, null, "unfinished command: " + text);
  return r;
}

let instances = 0, wrongs = 0;
const ids = new Set(), failures = [];
const ALL = process.argv.includes("--all");   // report every failing template instead of stopping at the first
const soft = (ok, msg) => { if (ok) return; if (ALL) failures.push(msg); else assert.fail(msg); };
for (const sk of D.skills) {
  assert.ok(!ids.has(sk.id), "duplicate skill " + sk.id); ids.add(sk.id);
  assert.ok(/^\d\.\d$/.test(sk.obj) && bank.objectives[sk.obj], sk.id + ": objective " + sk.obj + " isn't on the 010-160 blueprint");
  sk.templates.forEach((t, ti) => {
    assert.ok(t.hints.length && t.explain && t.text, `${sk.id}#${ti}: needs text, hints and an explanation`);
    assert.ok(t.wrong.length, `${sk.id}#${ti}: list at least one plausible wrong command`);
    for (const vals of combos(t)) {
      const inst = C.instantiateDrill({ id: sk.id, cmd: sk.cmd, templates: [Object.assign({}, t, { cases: [vals], vars: {} })] }, 0, () => 0);
      const where = `${sk.id}#${ti} ${JSON.stringify(vals).slice(0, 120)}`;
      assert.ok(!/\{\{\w+\}\}/.test(JSON.stringify(inst)), where + ": a placeholder was left unfilled");
      const fresh = S.createMachine({ setup: inst.setup });
      soft(fresh.check(inst.check) === false, where + ": the check already passes before any command");
      const sh = S.createMachine({ setup: inst.setup });
      const r = runLines(sh, inst.solution);
      soft(sh.check(inst.check), `${where}: the solution doesn't pass.\n$ ${inst.solution}\n${r.out}`);
      for (const w of inst.wrong) {
        const m = S.createMachine({ setup: inst.setup }); const rw = runLines(m, w);
        soft(!m.check(inst.check), `${where}: the wrong command '${w}' passes.\n${rw.out}`); wrongs++;
      }
      instances++;
    }
  });
}
if (failures.length) { console.log(failures.join("\n----\n")); console.log(failures.length + " failures"); process.exit(1); }
assert.ok(D.skills.length >= 60, "expected at least 60 skills");
const objs = new Set(D.skills.map(s => s.obj));
for (const o of ["2.1", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3", "4.1", "4.2", "4.3", "4.4", "5.1", "5.2", "5.3", "5.4"]) assert.ok(objs.has(o), "no drills for objective " + o);

// the index the app loads with every page matches the full drills
assert.deepStrictEqual(X.skills.map(s => s.id), D.skills.map(s => s.id), "labindex skills match drills.js (run python3 tools/build.py)");
for (const cmd in X.cmdq) for (const q of X.cmdq[cmd]) assert.ok(bank.byId[q], "cmdq links a question that doesn't exist: " + q);

// ---- core: sessions, grading and scheduling
const index = { skills: X.skills, cmdq: X.cmdq };
let st = C.freshState();
const s1 = C.buildCmdSession(D, index, st, { count: 10, seed: 3, mode: "recall" });
assert.strictEqual(s1.tasks.length, 10); assert.strictEqual(s1.mode, "recall");
assert.ok(s1.tasks.every(t => t.text && t.check && !/\{\{/.test(t.text)), "session tasks are instantiated");
// a new learner gets skills in exam order: the first picks come from objective 2.1
assert.ok(s1.tasks.slice(0, 3).every(t => X.skills.find(s => s.id === t.skill).obj === "2.1"), "new learners start at the beginning of the blueprint");
// the same seed gives the same session, a different seed different values
assert.deepStrictEqual(C.buildCmdSession(D, index, st, { count: 10, seed: 3 }).tasks.map(t => t.text), C.buildCmdSession(D, index, st, { count: 10, seed: 3 }).tasks.map(t => t.text));

// Every skill of objectives 2.1-2.4 has at least three differently shaped templates, so a later session can ask
// something new. One session never repeats a skill to fill the count: a command with fewer skills than the set
// gets a shorter session, and each of those skills is asked once.
for (const sk of D.skills.filter(s => s.obj[0] === "2")) assert.ok(sk.templates.length >= 3 || sk.id === "find-iname", sk.id + ": needs at least 3 templates, has " + sk.templates.length);
for (const cmd of ["locate", "which", "du", "rmdir", "export", "alias", "cd"]) {
  const n = D.skills.filter(s => s.cmd === cmd).length;
  assert.ok(n > 0 && n < 10, cmd + ": this check needs a command with fewer skills than the set");
  for (const seed of [1, 2, 3, 4, 5]) {
    const one = C.buildCmdSession(D, index, C.freshState(), { count: 10, cmds: [cmd], seed });
    assert.strictEqual(one.tasks.length, n, cmd + ": fewer matching skills means a shorter set, not repeats");
    assert.strictEqual(new Set(one.tasks.map(t => t.skill)).size, n, cmd + ": a skill is not asked twice while others match");
    assert.strictEqual(new Set(one.tasks.map(t => t.text)).size, one.tasks.length, cmd + ": no task is asked twice in one set");
  }
}

assert.ok(C.cmdTaskOk({ solved: true }) && !C.cmdTaskOk({ solved: true, hint: true }) && !C.cmdTaskOk({ solved: true, revealed: true }) && !C.cmdTaskOk({ solved: true, timeout: true }) && !C.cmdTaskOk({ solved: false }),
  "a drill counts as right only when solved without hints, the answer or running out of time");
const day = C.dayNum(new Date(2026, 9, 20, 12)), at = d => new Date(2026, 9, 20 + d, 12).getTime();
C.recordDrill(st, "find-name", false, at(0));
C.recordDrill(st, "tar-gz", true, at(0));
assert.deepStrictEqual(C.cmdDue(st.cmdstats, day + 1).sort(), ["find-name", "tar-gz"], "a miss and a first right answer both come back tomorrow");
assert.strictEqual(st.days[C.dayKey(at(0))], 2, "drills count toward the daily goal");
C.recordDrill(st, "tar-gz", true, at(1));
assert.deepStrictEqual(C.cmdDue(st.cmdstats, day + 2), ["find-name"], "two right answers push it two days out");
// recommended picks: due first
const due = C.pickSkills(index, st, { count: 3, today: day + 2, seed: 1 });
assert.strictEqual(due[0].id, "find-name", "due skills come first");
const tarN = index.skills.filter(s => s.cmd === "tar").length;
assert.ok(tarN > 0 && tarN < 10, "tar is a filter smaller than the set");
const onlyTar = C.pickSkills(index, st, { count: 10, cmds: ["tar"], seed: 2 });
assert.strictEqual(onlyTar.length, tarN, "picking by command does not repeat skills to fill the set");
assert.strictEqual(new Set(onlyTar.map(s => s.id)).size, tarN, "each tar skill is chosen once");
assert.ok(onlyTar.every(s => s.cmd === "tar"));
assert.strictEqual(C.pickSkills(index, C.freshState(), { source: "due" }).length, 0, "nothing is due for a new learner");
const fresh5 = C.pickSkills(index, st, { source: "new", count: 5, seed: 4 });
assert.ok(fresh5.every(s => !st.cmdstats[s.id]) && fresh5.every((s, i) => !i || s.obj >= fresh5[i - 1].obj), "new skills come in exam order");

// A filter smaller than the set shortens the session. Objective 2.1 is where the same skills were coming back
// (Print a variable's value, Set a shell variable); 2.4 is the six-skill example. Count 20 used to ask some of
// them three times. Recommended with nothing narrowed still fills 10 from the next weakest objectives.
const n21 = index.skills.filter(s => s.obj === "2.1").length, n24 = index.skills.filter(s => s.obj === "2.4").length;
assert.ok(n21 > 0 && n21 < 10 && n24 > 0 && n24 < 10, "these objectives are smaller than a full set");
for (const [obj, n, count] of [["2.1", n21, 10], ["2.1", n21, 20], ["2.4", n24, 10]]) {
  const sess = C.buildCmdSession(D, index, C.freshState(), { count, objs: [obj], seed: 11, mode: "guided" });
  assert.strictEqual(sess.tasks.length, n, obj + " count " + count + ": the run is " + n + " tasks, not padded to " + count);
  assert.strictEqual(new Set(sess.tasks.map(t => t.skill)).size, n, obj + ": no skill twice while another matching skill is unused");
  assert.ok(sess.tasks.every(t => index.skills.find(s => s.id === t.skill).obj === obj));
}
const wide = index.skills.filter(s => s.obj === "2.1" || s.obj === "2.2");
assert.ok(wide.length > 10, "two objectives hold more than one set");
const once = C.pickSkills(index, C.freshState(), { count: 10, objs: ["2.1", "2.2"], seed: 6 });
assert.strictEqual(once.length, 10);
assert.strictEqual(new Set(once.map(s => s.id)).size, 10, "a skill is not repeated while other matching skills are still unused");
const recSt = C.freshState();
C.recordDrill(recSt, "echo-var", false, at(0));
C.recordDrill(recSt, "var-set", false, at(0));
const rec = C.pickSkills(index, recSt, { count: 10, source: "recommended", today: day + 2, seed: 9 });
assert.strictEqual(rec.length, 10, "recommended with no filter stays a full set of 10");
assert.strictEqual(new Set(rec.map(s => s.id)).size, 10, "recommended does not repeat a skill to fill 10");
assert.deepStrictEqual(rec.slice(0, 2).map(s => s.id).sort(), ["echo-var", "var-set"], "due skills still come first");
assert.ok(rec.some(s => s.obj !== "2.1"), "the rest of the set is the next weakest skills in other objectives");

// mastery: drills plus questions; old misses stop counting once fixed
let m = C.commandMastery(index, st, { today: day + 2 });
assert.strictEqual(m.find.wrong, 1); assert.strictEqual(m.tar.right, 1); assert.strictEqual(m.ls.level, "new");
for (let i = 0; i < 3; i++) C.recordDrill(st, "find-name", true, at(3 + i));
m = C.commandMastery(index, st, { today: day + 6 });
assert.strictEqual(m.find.wrong, 0, "the latest result per skill counts");
const tarSkills = X.skills.filter(s => s.cmd === "tar").map(s => s.id);
for (const id of tarSkills) C.recordDrill(st, id, true, at(7));
assert.strictEqual(C.commandMastery(index, st, { today: day + 7 }).tar.level, "mastered", "every skill right last time = mastered");
const qid = X.cmdq.tar[0]; st.qstats[qid] = { seen: 2, right: 0, last: false, at: at(7) };
const mt = C.commandMastery(index, st, { today: day + 7 }).tar;
assert.strictEqual(mt.qWrong, 1, "a missed type-the-command question counts against its command");
const labUse = { chmod: 3 }; assert.strictEqual(C.commandMastery(index, st, { labUse }).chmod.labTasks, 3);
assert.strictEqual(C.firstCommand("sudo FOO=1 ./run.sh -x"), "run.sh");

// sync merges command practice like questions; XP and the badge count drills
const a = C.freshState(), b = C.freshState();
C.recordDrill(a, "cp", true, at(0)); C.recordDrill(b, "cp", false, at(1));
const v = C.mergeStates([a, b]);
assert.strictEqual(v.cmdstats.cp.seen, 2); assert.strictEqual(v.cmdstats.cp.right, 1); assert.strictEqual(v.cmdstats.cp.last, false, "the newest answer sets the schedule");
const own = C.ownPart(v, C.mergeStates([b]), {});
assert.strictEqual(own.cmdstats.cp.seen, 1, "each device uploads only its own drill counts");
assert.ok(C.xpInfo(a).xp >= 2);
assert.ok(C.badgeStatus(a, bank, [], 1).some(x => x.id === "fluent" && x.progress[0] === 1));
assert.ok(C.hasProgress(Object.assign(C.freshState(), { cmdstats: { cp: { seen: 1 } } })), "drill progress counts as progress for the first-sync question");

// daily goal: new installs start at 10, saved progress keeps its goal, custom values are clamped
assert.strictEqual(C.freshState().settings.goal, 10);
assert.strictEqual(C.migrate({ settings: { goal: 20 } }).settings.goal, 20);
assert.strictEqual(C.migrate({ settings: { goal: 0 } }).settings.goal, 1);
assert.strictEqual(C.migrate({ settings: { goal: 999 } }).settings.goal, 200);
assert.strictEqual(C.clampGoal("12.4"), 12); assert.strictEqual(C.clampGoal("abc"), 10);
assert.ok(C.LOCAL_SETTINGS.includes("cmd"), "the practice builder's choices stay per device");

// the sandbox machine builds and has things to explore
const box = S.createMachine({ setup: D.sandbox });
assert.ok(box.stat("/home/student/app.log") && box.stat("/home/student/projects/scripts/hello.sh"), "sandbox files exist");
assert.ok(/ERROR/.test(box.exec("grep ERROR app.log", { tty: false }).out), "sandbox log has errors to find");

console.log(`drills: ${D.skills.length} skills, ${instances} instances solved, ${wrongs} wrong commands rejected; core practice logic ok`);
