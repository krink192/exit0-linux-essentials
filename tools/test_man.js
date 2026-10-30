// SPDX-License-Identifier: AGPL-3.0-or-later
// The lab's built-in help is enough to finish every lab: each command a lab or drill uses has a manual page
// (or `help` text for builtins and keywords), every option a solution uses is documented on that page, and
// every command page has examples that really run in the lab shell.
// Run: node tools/test_man.js
const assert = require("assert");
const path = require("path");
global.window = global.window || {};
require(path.join(__dirname, "../docs/data/labs.js"));
require(path.join(__dirname, "../docs/data/drills.js"));
const P = require(path.join(__dirname, "../docs/js/man.js"));
const S = require(path.join(__dirname, "../docs/js/shell.js"));
const LABS = window.LE_LABS, DRILLS = window.LE_DRILLS;

const byName = name => Object.values(P).filter(p => p.name === name);
const pageFor = name => P[name] || byName(name)[0];
const fresh = setup => S.createMachine({ setup: setup || {} });
const typeOf = (m, name) => m.exec("type -t " + name, { tty: false, noHistory: true }).out.trim();
const helpOk = (m, name) => m.exec("help " + name, { tty: false, noHistory: true }).code === 0;
let failures = 0;
const fail = msg => { failures++; console.log("FAIL " + msg); };

// ---- split solutions into simple commands: [command, ...words], quotes removed
function simpleCommands(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const noQuotes = line.replace(/'[^']*'/g, "Q").replace(/"[^"]*"/g, "Q");
    for (const seg of noQuotes.split(/\|\||&&|\||;|\$\(|\)|`|\bthen\b|\bdo\b|\belse\b|\belif\b/)) {
      let w = seg.replace(/\d*[<>]+&?\d*\s*\S*/g, " ").trim().split(/\s+/).filter(Boolean);
      while (w.length && /^\w+=/.test(w[0])) w.shift();                         // VAR=value cmd
      if (w[0] === "sudo") { w.shift(); if (w[0] === "-u") w.splice(0, 2); else if (/^-/.test(w[0] || "")) w.shift(); }
      if (!w.length || !/^[a-z.[][\w.+-]*$/.test(w[0])) continue;
      if (["if", "fi", "for", "while", "until", "done", "elif", "in", "!"].includes(w[0])) { if (w[0] === "if" || w[0] === "while" || w[0] === "until" || w[0] === "elif") { out.push([w[0]]); w.shift(); } else continue; if (!w.length) continue; }
      out.push(w);
    }
  }
  return out;
}
const documented = (pg, opt) => {
  const text = JSON.stringify(pg), has = o => new RegExp("(^|[^\\w-])" + o.replace(/-/g, "\\-") + "(?![\\w-])").test(text);
  if (opt === "--help" || has(opt)) return true;
  const takesValue = o => (pg.options || []).some(([fl]) => fl.split(/,\s*/).some(f => f.startsWith(o + " ")));
  if (/^-[a-zA-Z]./.test(opt) && takesValue(opt.slice(0, 2))) return true;              // value attached: -d: -f3
  if (/^-[a-zA-Z0-9]{2,}$/.test(opt)) return opt.slice(1).split("").every(ch => has("-" + ch));   // bundled short options (-czf)
  return false;
};

// ---- 1 and 2: every command used has help, every option used is documented
const m0 = fresh();
const uses = [];
for (const L of LABS) {
  L.commands.forEach(c => uses.push({ cmd: [c], where: L.id + " (commands list)" }));
  L.tasks.forEach((t, i) => simpleCommands(t.solution).forEach(cmd => uses.push({ cmd, where: L.id + " task " + (i + 1) })));
}
for (const sk of DRILLS.skills || []) for (const tp of sk.templates || [])
  simpleCommands(tp.solution.replace(/\{\{\w+\}\}/g, "x")).forEach(cmd => uses.push({ cmd, where: "drill " + sk.id }));
const checkedCmds = new Set(); let optsChecked = 0;
for (const { cmd, where } of uses) {
  const name = cmd[0], kind = typeOf(m0, name);
  if (kind === "file" && /^\.?\//.test(name)) continue;                     // ./script.sh
  if (!kind) continue;                                                    // a script or function the lab creates, not a command
  const pg = pageFor(name);
  if (kind === "builtin" || kind === "keyword") { if (!helpOk(m0, name) && !pg) fail(`${where}: no 'help ${name}' and no man page`); checkedCmds.add(name); continue; }
  if (!pg) { fail(`${where}: no manual page for ${name}`); continue; }
  checkedCmds.add(name);
  for (const w of cmd.slice(1)) {
    if (!/^--?[A-Za-z]/.test(w) || /^-\d/.test(w)) continue;
    const opt = w.split("=")[0]; optsChecked++;
    if (!documented(pg, opt)) fail(`${where}: '${name} ${opt}' is used but not on man ${name}`);
  }
}

// ---- 3: examples on every page of a command the lab has, and each one runs
const BAD = /command not found|invalid option|unrecognized option|unknown option|syntax error|^Usage:|^usage:/m;
const OTHER_DISTRO = { dnf: "fedora", yum: "fedora", rpm: "fedora" };
const NEEDS_INSTALL = new Set(["figlet", "cowsay"]);          // the 1.2 labs install them first
let examples = 0;
for (const [key, pg] of Object.entries(P)) {
  if ([1, 8].includes(+pg.section) && !(pg.examples || []).length && typeOf(m0, pg.name)) fail(`man ${key} has no EXAMPLES`);
  for (const [cmd] of pg.examples || []) {
    examples++;
    if (pg.section === 5 && !/^(cat|grep|cut|sudo|less|head) /.test(cmd)) continue;              // file-format pages show sample lines
    if (NEEDS_INSTALL.has(pg.name)) continue;
    const m = fresh(OTHER_DISTRO[pg.name] ? { distro: OTHER_DISTRO[pg.name] } : null);
    const r = m.exec(cmd, { tty: false });
    if (BAD.test(r.out)) fail(`man ${key}: example '${cmd}' doesn't run in the lab shell: ${r.out.split("\n")[0]}`);
  }
}

// ---- 4: SEE ALSO never points at a command the lab has but the manual lacks
for (const [key, pg] of Object.entries(P)) for (const ref of pg.see || []) {
  const mm = /^([\w.-]+)\((\d)\)/.exec(ref); if (!mm) continue;
  const [, name, sec] = mm;
  if (P[name + "." + sec] || byName(name).some(p => String(p.section) === sec)) continue;
  if (typeOf(m0, name) === "file") fail(`man ${key}: SEE ALSO ${ref}, but the lab has ${name} and no page for it`);
}

// ---- 5: the concept pages the help pages point to exist
for (const [cmd, re] of [["man bash", /PIPELINES[\s\S]*REDIRECTION[\s\S]*QUOTING[\s\S]*EXPANSION[\s\S]*COMPOUND COMMANDS/], ["man 7 glob", /GLOB\(7\)/], ["man 7 regex", /REGEX\(7\)/], ["man test", /TEST\(1\)/],
  ["man man", /READING A PAGE[\s\S]*FINDING HELP/], ["help if", /^if: if COMMANDS/], ["help for", /^for: /], ["help while", /^while: /], ["zcat --help", /Examples:/], ["apropos compress", /gzip \(1\)/]]) {
  const r = fresh().exec(cmd, { tty: false }); if (!re.test(r.out)) fail(`'${cmd}' output doesn't match ${re}`);
}

if (failures) { console.log(failures + " manual check(s) failed"); process.exit(1); }
console.log(`manual: ${checkedCmds.size} commands used in labs and drills all documented, ${optsChecked} option uses checked, ${examples} examples run`);
