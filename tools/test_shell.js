// SPDX-License-Identifier: AGPL-3.0-or-later
// Differential tests for the lab shell: each case runs in real Bash (in an empty temp directory, as a
// regular user) and in the simulator (in an empty directory under /home/student), and the outputs must match.
// Run: node tools/test_shell.js        (needs bash and GNU coreutils; as root it uses `runuser -u le010user`)
const { execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const S = require(path.join(__dirname, "../docs/js/shell.js"));

const CASES = [
  // quoting and variables
  `name=Linux; echo "\${name}Essentials" '$name' $name`, `echo 'Total: $9.99'; echo "Total: \\$9.99"; echo "Total: $9.99"`,
  `msg="a   b"; echo $msg; echo "$msg"`, `echo -e "a\\tb\\nc"`, `echo -n hi; echo there`, `x=5; bash -c 'echo "x=$x"'; export x; bash -c 'echo "x=$x"'`,
  `echo $(echo one two) "$(echo three)"`, `echo $((2+3*4)) $(( 10 / 3 ))`, `TZ=UTC; unset TZ; echo "[$TZ]"`, `echo ~ | grep -c /`,
  `a=1; b=2; echo $a$b "$a $b" '$a'`, `echo "it's" 'say "hi"'`, `echo one\\ two`, `printf '%s-%s\\n' a b c d`,
  // status, && || ; if for while
  `false; echo $?; echo $?`, `ls /nonexistent 2>/dev/null && echo found || echo missing`, `true && echo yes; false || echo no`,
  `x=Yes; if [ "$x" = "yes" ]; then echo continue; else echo stop; fi`, `n=3; if [ $n -gt 5 ]; then echo big; elif [ $n -gt 2 ]; then echo mid; else echo small; fi`,
  `for n in 1 2 3; do echo -n "$n-"; done; echo`, `i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done`, `for f in *.txt; do echo "found $f"; done`,
  `touch b.txt a.txt; for f in *.txt; do echo "$f"; done`, `[ -d . ] && echo dir; [ -f . ] || echo notfile; test -e nope; echo $?`,
  // files and directories
  `mkdir -p a/b/c && ls -R a`, `mkdir a/b/c; echo $?`, `mkdir d; mkdir d; echo $?`, `touch f; ls; rm f; ls | wc -l`,
  `touch a.txt b.txt; mkdir notes; mv a.txt b.txt notes; ls; ls notes`, `touch report.txt; cp report.txt backup; cp report.txt backup/ 2>/dev/null; echo $?; [ -f backup ] && echo file`,
  `mkdir d; touch d/x; rmdir d; rm d; rm -r d; ls`, `touch .config app.conf notes.txt; rm *; ls -A`,
  `touch data1.csv data2.csv data10.csv Data3.csv data_old.csv; ls data[0-9]*.csv`, `touch log1.txt log2.txt log4.txt log12.txt; ls log[1-3].txt`,
  `touch file1.txt file10.txt File2.txt file.txt; ls file?.txt`, `touch resolv.conf .hidden.conf conf.bak nginx.conf.bak my.conf; echo *.conf`,
  `mkdir src; echo hi > src/a; cp src dst; cp -r src dst; cat dst/a`, `echo x > a; mv a b; ls; mv nope x`, `cp nope x; rm nope`,
  `mkdir -p p/q; touch p/q/f; ls p/q; cd p/q; pwd | sed 's|.*/p/q|P/Q|'; cd ../..; ls`, `mkdir m; cd m; cd ..; cd -; echo back`,
  `touch .h v; ls -A`, `touch .h v; ls -a | head -2`, `mkdir x; ls -d x; ls -ld x | cut -c1-10`,
  `echo hello > f; cat f nope; echo $?`, `cat < nope`, `echo a > f; echo b >> f; cat f; wc -l f`,
  // links
  `echo x > report.txt; ln report.txt copy.txt; echo y >> copy.txt; cat report.txt; rm report.txt; cat copy.txt`,
  `mkdir notes t; echo hi > notes/todo.txt; ln -s notes/todo.txt todo; mv todo t/; cat t/todo 2>/dev/null || echo broken`,
  `touch f; ln -s f s; ls -l s | cut -c1-10; readlink s; ln -s f s; echo $?`, `mkdir d; ln d e; echo $?`,
  // permissions (stat -c %A avoids owner names)
  `touch f; chmod 750 f; chmod g+w,o+r f; stat -c %A f`, `touch f; chmod 777 f; chmod go-w f; stat -c %A f`, `touch f; chmod 644 f; chmod u+x f; stat -c %A f`,
  `touch f; chmod a=r f; stat -c %A f`, `mkdir d; chmod 777 d; chmod +t d; stat -c %A d`, `touch f; chmod +x f; stat -c %A f; chmod 999 f; echo $?`,
  `touch f; chmod 4755 f; stat -c %A f`, `touch f; chmod 600 f; chmod +w f; stat -c '%a %A' f`, `touch f; chmod u=rwx,g=rx,o= f; stat -c %a f`,
  `mkdir d; touch d/x; chmod 000 d; ls d; cat d/x; chmod 755 d; ls d`, `echo s > f; chmod 000 f; cat f; echo hi > f; chmod 644 f`,
  // archives and compression
  `mkdir docs; touch docs/a; tar -czf docs.tar.gz docs && tar -tzf docs.tar.gz`, `touch a b; tar -cf backup.tar a b; rm a b; tar -tf backup.tar; ls`,
  `echo hi > notes.txt; bzip2 notes.txt; ls; bunzip2 notes.txt.bz2; cat notes.txt`, `echo x > report.txt; gzip report.txt; ls; gzip -d report.txt.gz; ls`,
  `echo hello > notes.txt; gzip notes.txt; zcat notes.txt.gz; gunzip -c notes.txt.gz; ls`, `touch f; tar -cJf a.tar.xz f; rm f; tar -xJf a.tar.xz; ls`,
  `mkdir logs; echo a > logs/x; gzip -r logs; ls logs; gzip logs`, `mkdir www; echo hi > www/i; tar -cvzf site.tar.gz www/ > /dev/null; rm -r www; tar -xzf site.tar.gz; cat www/i`,
  `touch f; tar -czf a.tgz f; tar -xJf a.tgz; echo $?`, `echo hi > big.log; xz big.log; ls; xz -d big.log.xz; ls`, `gzip nope; tar -xf nope`,
  // text processing
  `printf 'root:x:0:0:root:/root:/bin/bash\\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\\n' | cut -d: -f1,7`,
  `printf 'Error a\\nok\\nerror b\\nERROR\\n' > s; grep -ic error s; grep -v ok s; grep -n b s`, `printf '42\\n007\\n4 2\\n42a\\n\\n' | grep -E '^[0-9]+$'`,
  `printf 'cat\\ndogs\\ncats\\ncatdog\\ndogss\\n' | grep -E '^(cat|dog)s?$'`, `printf 'cat\\ncot\\nct\\ncoat\\ncart\\n' | grep 'c.t'`,
  `printf 'Bank account\\nbook review\\nbrick wall\\na bulk order\\nBlack box\\n' | grep '^[Bb]..k'`, `printf 'color\\ncolour\\ncolr\\n' | grep -E 'colou?r'`,
  `seq 1 20 > n; head -n 5 n | tail -n 1; head -3 n; tail -2 n; tail -n +19 n`, `printf 'a:x:100:\\nb:x:9:\\nc:x:20:\\n' > p; sort -t: -k3 -n p | cut -d: -f1`,
  `printf '10\\n9\\n100\\n' > nums; sort nums; sort -n nums; sort -rn nums`, `printf 'b\\na\\nb\\nc\\na\\n' | sort | uniq -c`, `printf 'b\\na\\nb\\n' | sort -u`,
  `echo hello > f; wc f; wc -l f; cat f | wc; cat f | wc -l; printf 'a\\nb\\n' > g; wc f g`, `printf 'one two\\nthree\\n' | wc -w`,
  `echo Hello | tr a-z A-Z; echo hello | tr -d l`, `grep x nope; echo $?; head nope; wc nope`, `printf 'a\\nb\\n' > f; grep -c z f; echo $?`,
  `touch f; ls f nofile 2>&1 >out.txt | grep -c nofile; cat out.txt`, `ls nofile > o 2>&1; cat o`, `ls nofile 2> err; cat err; ls nofile &> both; cat both`,
  `echo a | cat - ; echo b | cat -n`, `printf 'x\\ny\\n' | head -1`,
  // scripts
  `printf '#!/bin/bash\\necho "$#"\\n' > c.sh; chmod +x c.sh; ./c.sh "a b" c`, `printf '#!/bin/bash\\necho "Script: $0"\\necho "First: $1"\\necho "All: $@"\\n' > i.sh; chmod +x i.sh; ./i.sh red green`,
  `printf 'echo hi\\n' > s.sh; ./s.sh; echo $?; bash s.sh; sh s.sh`, `printf '#!/bin/bash\\nif [ $# -eq 0 ]; then\\n  echo usage\\n  exit 1\\nfi\\necho ok\\n' > u.sh; bash u.sh; echo $?; bash u.sh x`,
  `printf '#!/bin/bash\\nfor x in "$@"; do\\n  echo "[$x]"\\ndone\\n' > l.sh; bash l.sh a b c`, `printf '#!/bin/bash\\nx=2\\ny=3\\necho $x+$y\\n' > a.sh; bash a.sh`,
  `printf '#!/bin/bash\\necho "$2 $1"\\n' > w.sh; bash w.sh red blue`, `printf 'cd /\\npwd\\n' > c.sh; bash c.sh; pwd | grep -c /`,
  // misc builtins
  `type cd; type ls 2>/dev/null | grep -c ls; type nosuch; echo $?`, `GREETING=hi; export GREETING; bash -c 'echo $GREETING'`, `export A=1; unset A; echo "[$A]"`,
];

function both(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "le010sh_"));
  const asUser = process.getuid && process.getuid() === 0;
  if (asUser) execFileSync("chown", ["le010user:le010user", dir]);
  const wrapped = "exec 2>&1; " + script;
  const cmd = asUser ? ["runuser", ["-u", "le010user", "--", "bash", "-c", wrapped]] : ["bash", ["-c", wrapped]];
  let out;
  try { out = execFileSync(cmd[0], cmd[1], { cwd: dir, env: { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", HOME: dir, LANG: "C.UTF-8", LC_ALL: "C.UTF-8", USER: "le010user" }, encoding: "utf8", timeout: 10000 }); }
  catch (e) { out = (e.stdout || "").toString(); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return out.split(dir).join("/home/student/work").replace(/^bash: line \d+: /gm, "bash: ").replace(/^\/bin\/bash: line \d+: /gm, "bash: ").replace(/^(\S+\.sh): line \d+: /gm, "$1: ");
}
function sim(script) {
  const sh = S.createMachine({ setup: { files: [{ path: "~/work", dir: true }], cwd: "~/work" } });
  const r = sh.exec(script, { tty: false });
  return r.out.replace(/^bash: line \d+: /gm, "bash: ");
}
let pass = 0, fail = 0;
for (const c of CASES) {
  const want = both(c), got = sim(c);
  if (want === got) pass++;
  else { fail++; console.log("FAIL: " + c + "\n--- real ---\n" + want + "--- sim ---\n" + got); }
}
console.log(`\nshell: ${pass} passed, ${fail} failed`);

// ---- unit checks for things real Bash can't safely test here (users, sudo, permissions as another user)
const assert = require("assert");
let units = 0; const u = (name, fn) => { fn(); units++; };
u("useradd needs root; sudo works; account files update", () => {
  const sh = S.createMachine();
  assert.match(sh.exec("useradd dave").out, /useradd: Permission denied\./);
  sh.exec("sudo groupadd -g 2000 developers"); sh.exec("sudo useradd -m -s /bin/bash -G developers -c 'Dave Lee' dave");
  const d = sh.user("dave"); assert.strictEqual(d.shell, "/bin/bash"); assert.deepStrictEqual(d.groups, ["developers"]); assert.strictEqual(d.password, "locked");
  assert.strictEqual(sh.stat("/home/dave").owner, "dave"); assert.strictEqual(sh.stat("/home/dave/.bashrc").owner, "dave");
  assert.match(sh.exec("grep dave /etc/passwd").out, /^dave:x:1001:1001:Dave Lee:\/home\/dave:\/bin\/bash$/m);
  assert.match(sh.exec("cat /etc/shadow").out, /Permission denied/); assert.match(sh.exec("sudo cat /etc/shadow").out, /^dave:!:/m);
  sh.exec("sudo passwd dave"); assert.strictEqual(sh.user("dave").password, "set");
  sh.exec("sudo usermod -aG adm dave"); assert.deepStrictEqual(sh.user("dave").groups.sort(), ["adm", "developers"]);
  sh.exec("sudo usermod -G adm dave"); assert.deepStrictEqual(sh.user("dave").groups, ["adm"]);
  sh.exec("sudo passwd -l dave"); assert.strictEqual(sh.user("dave").password, "locked-set");
  sh.exec("sudo userdel -r dave"); assert.strictEqual(sh.user("dave"), null); assert.strictEqual(sh.stat("/home/dave"), null);
  assert.strictEqual(sh.check({ type: "nouser", name: "dave" }), true);
});
u("sudo -i and su switch users; exit returns", () => {
  const sh = S.createMachine();
  sh.exec("sudo -i"); assert.strictEqual(sh.whoami(), "root"); assert.strictEqual(sh.prompt().sym, "#"); assert.strictEqual(sh.cwd(), "/root");
  sh.exec("exit"); assert.strictEqual(sh.whoami(), "student");
  assert.match(sh.exec("su -").out, /Authentication failure/);
});
u("sticky bit: others can't delete your files in /tmp; chown needs root", () => {
  const sh = S.createMachine({ setup: { users: [{ name: "tom" }], files: [{ path: "/tmp/toms.txt", owner: "tom", data: "x" }] } });
  assert.match(sh.exec("rm /tmp/toms.txt").out, /Operation not permitted/);
  sh.exec("touch /tmp/mine; rm /tmp/mine"); assert.strictEqual(sh.stat("/tmp/mine"), null);
  assert.match(sh.exec("chown tom ~/.bashrc").out, /Operation not permitted/);
  sh.exec("sudo chown tom:tom ~/.bashrc"); assert.strictEqual(sh.stat("/home/student/.bashrc").owner, "tom");
});
u("group permissions apply; owner bits take precedence", () => {
  const sh = S.createMachine({ setup: { groups: [{ name: "team", gid: 3000, members: ["student"] }], users: [{ name: "carol" }],
    files: [{ path: "/srv/shared", dir: true, owner: "carol", group: "team", mode: 0o770 }, { path: "/srv/ro", dir: true, owner: "carol", group: "team", mode: 0o750 }, { path: "~/f", data: "x", mode: 0o077 }] } });
  sh.exec("touch /srv/shared/ok"); assert.ok(sh.stat("/srv/shared/ok"));
  assert.match(sh.exec("touch /srv/ro/no").out, /Permission denied/);
  assert.match(sh.exec("cat ~/f").out, /Permission denied/);
});
u("history expansion and tee", () => {
  const sh = S.createMachine();
  sh.exec("echo one"); assert.strictEqual(sh.exec("!!").out, "echo one\none\n");
  sh.exec("ls /"); assert.strictEqual(sh.exec("!echo").out, "echo one\none\n");
  assert.match(sh.exec("!nope").out, /event not found/);
  assert.match(sh.exec("echo '10.0.0.20 files' >> /etc/hosts").out, /Permission denied/);
  sh.exec("echo '10.0.0.20 files' | sudo tee -a /etc/hosts > /dev/null"); assert.match(sh.stat("/etc/hosts").data, /10\.0\.0\.20 files/);
  assert.match(sh.exec("ping -c 1 files").out, /10\.0\.0\.20/);
});
u("editor saves through permissions; checks", () => {
  const sh = S.createMachine();
  assert.deepStrictEqual(sh.exec("nano hello.sh").edit, { path: "/home/student/hello.sh", editor: "nano" });
  assert.ok(sh.writeFile("/home/student/hello.sh", "#!/bin/bash\necho \"Hello, $1\"\n").ok);
  assert.ok(!sh.writeFile("/etc/hosts", "x").ok);
  assert.match(sh.exec("./hello.sh Ada").out, /Permission denied/);
  sh.exec("chmod u+x hello.sh");
  assert.strictEqual(sh.check({ type: "script", path: "./hello.sh", args: "Ada", output: "Hello, Ada\n" }), true);
  assert.strictEqual(sh.check({ type: "perms", path: "hello.sh", perms: "-rwxr--r--" }), true);
});
console.log(`units: ${units} passed`);

// ---- every lab: tasks start incomplete, and each solution completes its task
global.window = global.window || {};
require(path.join(__dirname, "../docs/data/labs.js"));
let labTasks = 0;
for (const lab of window.LE_LABS) {
  const sh = S.createMachine({ setup: lab.setup });
  lab.tasks.forEach((t, i) => assert.strictEqual(sh.check(t.check), false, `${lab.id} task ${i + 1} is already complete before starting`));
  lab.tasks.forEach((t, i) => {
    let out = ""; for (const line of t.solution.split("\n")) out += sh.exec(line).out;
    assert.strictEqual(sh.check(t.check), true, `${lab.id} task ${i + 1} not complete after its solution. Output:\n${out}`);
    labTasks++;
  });
}
console.log(`labs: ${window.LE_LABS.length} labs, ${labTasks} tasks verified`);
process.exit(fail ? 1 : 0);
