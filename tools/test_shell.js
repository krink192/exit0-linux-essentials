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
  // brace expansion, heredocs, printf, tr, sed -i, basename/dirname, rmdir -p, shift, ls -X, grep context, tar -r
  `touch game{1..5}; ls; rm game?; ls | wc -l`, `echo {a,b}{1,2} pre{x,y}post {01..03} {c..a} {1..10..3} x{,y}`, `echo '{a,b}' "{a,b}" \\{a,b\\} \${HOME:+set}`,
  `x=5; cat <<EOF\nx is $x\nEOF\ncat <<'EOF'\nx is $x\nEOF`, `cat <<-END\n\tindented\n\tEND\nwc -l <<X\na\nb\nX`,
  `printf '%-6s|%4d|%.1f|%05d|%x\\n' ab 7 3.14159 42 255`, `printf 'a  b   c\\n' | tr -s ' '; echo hello | tr -d l; echo hello | tr 'a-y' 'b-z'`,
  `printf 'x\\ny\\n' > f; sed -i 's/x/z/' f; cat f; sed -n '2p' f`, `basename /a/b/c.txt .txt; dirname /a/b/c.txt; dirname c.txt; basename /a/b/; dirname /x`,
  `mkdir -p a/b/c; rmdir -p a/b/c; ls | wc -l`, `printf '#!/bin/bash\\necho $1; shift; echo $1 $#\\nshift 2\\necho "[$*]"\\n' > s.sh; bash s.sh a b c`,
  `touch b.txt a.sh c.txt d; ls -X; ls -r`, `printf 'a\\nb\\nc\\nd\\ne\\n' > f; grep -A1 b f; grep -B1 d f; grep -n -C1 c f`,
  `touch a b; tar -cf t.tar a; tar -rf t.tar b; tar -tf t.tar`, `mkdir x y; touch z; ls -d */`, `type -t cd; type -t if`, `printf abcdef | head -c 3; echo`,
  `echo "a b" > f; cat -n f; cat -A f`, `mkdir d; cd d; cd ..; cd ~; pwd | grep -c work`,
  // misc builtins
  `type cd; type ls 2>/dev/null | grep -c ls; type nosuch; echo $?`, `GREETING=hi; export GREETING; bash -c 'echo $GREETING'`, `export A=1; unset A; echo "[$A]"`,
  // a trailing slash stays on the first heading; later headings must not pick up a second slash
  `mkdir -p work/q3/misc; touch work/top.txt work/q3/misc/x.txt; ls -R work/`,
  `mkdir -p work/q3/misc; touch work/top.txt work/q3/misc/x.txt; ls -R work//`,
  `mkdir -p work/q3/misc; touch work/top.txt work/q3/misc/x.txt; find work/ | sort`,
  `mkdir -p work/q3/misc; echo x > work/q3/misc/x.txt; grep -r x work/`,
  `mkdir -p work/q3/misc; echo x > work/q3/misc/x.txt; tar -cf t.tar work/; tar -tf t.tar | sort`,
  `mkdir -p work/q3/misc; touch work/top.txt work/q3/misc/x.txt; du work/; du -sh work/`,
  `mkdir -p src/sub; echo hi > src/sub/a; mkdir dest; cp -r src/ dest/; ls -R dest`,
  `mkdir -p gone/sub; echo z > gone/sub/a; rm -r gone/; ls`,
  // fd 1 redirects, and integer arithmetic (Bash, not JavaScript)
  `echo hi 1> f; cat f`, `echo a > f; echo b 1>> f; cat f`, `echo x 2> e 1> f; cat f`,
  `echo b >&2`, `echo err 1>&2 | wc -l`, `echo b>&2`, `echo hi1>f; cat f`,
  `echo $(( 1 / 3 * 3 ))`, `echo $(( 10 / 0 )); echo $?`, `echo $(( 0x10 ))`, `echo $(( 7 / 2 ))`,
  `echo $(( (2+3)*4 )) $(( -7 / 2 )) $(( -7 % 2 )) $(( 5 % 2 )) $(( 2 ** 3 )) $(( 2 ** 3 ** 2 ))`,
  `echo $(( 2 < 3 )) $(( 2 > 3 )) $(( 2 <= 2 )) $(( 3 >= 4 )) $(( 2 == 2 )) $(( 2 != 3 ))`,
  `echo $(( 010 )) $(( 0X10 ))`, `echo $(( 5 % 0 )); echo after`, `echo $(( 08 )); echo after`,
  `echo $((2**-1)); echo after`, `echo $((1+2*3**2))`,
  `n=4; echo $((n-1)) $(( $n + 1 ))`, `n=010; echo $((n))`, `n=0x10; echo $((n+1))`,
  `n='1+2'; echo $((n))`, `a=4; n='a+1'; echo $((n))`,
  `n=3; while [ $n -gt 0 ]; do echo -n "$n "; n=$((n-1)); done; echo liftoff`,
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
u("last check without regex fails closed", () => {
  const sh = S.createMachine();
  sh.exec("echo hi");
  assert.strictEqual(sh.check({ type: "last", regex: "^hi\\n$" }), true);
  assert.strictEqual(sh.check({ type: "last" }), false, "a last check with no regex must not pass");
});
u("PATH lookup: a broken PATH breaks ls, scripts in PATH run by name", () => {
  const sh = S.createMachine();
  assert.match(sh.exec("which passwd").out, /^\/usr\/bin\/passwd$/m);
  sh.exec("PATH=~/scripts"); assert.match(sh.exec("ls").out, /ls: command not found/);
  sh.exec("PATH=/usr/bin:/bin:~/scripts"); sh.exec("mkdir ~/scripts; printf '#!/bin/bash\\necho hi from $0\\n' > ~/scripts/hello; chmod +x ~/scripts/hello");
  assert.match(sh.exec("hello").out, /hi from/);
  assert.match(sh.exec("ls -l /usr/bin/passwd").out, /^-rwsr-xr-x/);
});
u("locate uses a database that updatedb refreshes", () => {
  const sh = S.createMachine();
  sh.exec("touch ~/fresh.txt"); assert.strictEqual(sh.exec("locate fresh.txt").out, "");
  assert.match(sh.exec("updatedb").out, /can not open/); sh.exec("sudo updatedb");
  assert.strictEqual(sh.exec("locate fresh.txt").out, "/home/student/fresh.txt\n");
  assert.strictEqual(sh.exec("locate -l 1 README").out.split("\n").length, 2);
});
u("processes: ps, kill permissions, /proc", () => {
  const sh = S.createMachine({ setup: { procs: [{ user: "student", cmd: "yes", cpu: 99.5, stat: "R", tty: "pts/1" }] } });
  const pid = /student\s+(\d+)\s+99\.5/.exec(sh.exec("ps aux").out)[1];
  assert.match(sh.exec("kill 780").out, /Operation not permitted/);
  assert.match(sh.exec("cat /proc/" + pid + "/cmdline").out, /^yes/);
  sh.exec("kill " + pid); assert.doesNotMatch(sh.exec("ps aux").out, /\byes\b/); assert.strictEqual(sh.stat("/proc/" + pid), null);
  assert.strictEqual(sh.check({ type: "noproc", cmd: "yes" }), true);
});
u("child shells only inherit exported variables; exec keeps the PID", () => {
  const sh = S.createMachine();
  sh.exec("a=1; export b=2"); sh.exec("bash");
  assert.strictEqual(sh.exec("echo [$a][$b] $SHLVL").out, "[][2] 2\n");
  assert.notStrictEqual(sh.exec("echo $$").out, "2301\n"); assert.strictEqual(sh.exec("exit").out, "exit\n");
  assert.strictEqual(sh.exec("echo [$a] $$").out, "[1] 2301\n");
  sh.exec("exec bash"); assert.strictEqual(sh.exec("echo [$a] $$").out, "[] 2301\n");
});
u("ip changes stick; ping needs a route", () => {
  const sh = S.createMachine();
  assert.match(sh.exec("ip addr add 10.9.9.9/24 dev enp0s3").out, /Operation not permitted/);
  sh.exec("sudo ip addr add 10.9.9.9/24 dev enp0s3"); assert.match(sh.exec("ip a show enp0s3").out, /inet 10\.9\.9\.9\/24/);
  sh.exec("sudo ip route del default"); assert.match(sh.exec("ping -c 1 example.com").out, /Network is unreachable/);
  sh.exec("sudo ip route add default via 192.168.1.1"); assert.match(sh.exec("ping -c1 example.com").out, /1 packets transmitted/);
});
u("unfinished input asks for more; heredocs; sudo nano saves as root", () => {
  const sh = S.createMachine();
  assert.strictEqual(sh.exec("for x in 1 2").incomplete, true); assert.strictEqual(sh.exec("for x in 1 2\ndo echo $x\ndone").out, "1\n2\n");
  assert.strictEqual(sh.exec("echo 'open").incomplete, true);
  sh.exec("sudo nano /etc/motd"); assert.ok(sh.writeFile("/etc/motd", "hello\n").ok);
  sh.exec("nano /etc/hosts"); assert.ok(!sh.writeFile("/etc/hosts", "x").ok);
});
u("man, whatis, apropos, --help come from man.js", () => {
  const sh = S.createMachine();
  assert.match(sh.exec("man 5 passwd").out, /PASSWD\(5\)/); assert.match(sh.exec("whatis passwd").out, /passwd \(5\)/);
  assert.match(sh.exec("man -k archiv").out, /tar \(1\)/); assert.match(sh.exec("man cd").out, /No manual entry for cd/);
  assert.match(sh.exec("cp --help").out, /--update/); assert.match(sh.exec("info ls").out, /Sorting the output/);
});
u("account details: passwd -S, chage, chsh, /etc/shadow fields", () => {
  const sh = S.createMachine();
  sh.exec("sudo useradd -m -e 2027-01-31 -f 7 -u 1035 carol");
  assert.match(sh.exec("sudo passwd -S carol").out, /^carol L /); sh.exec("sudo passwd carol"); assert.match(sh.exec("sudo passwd -S carol").out, /^carol P /);
  assert.match(sh.exec("sudo grep carol /etc/shadow").out, /:7:20849:$/m);
  sh.exec("chsh -s /bin/sh"); assert.strictEqual(sh.user("student").shell, "/bin/sh");
  assert.match(sh.exec("chsh -s /bin/fish").out, /invalid shell/);
});
u("name lookups need a nameserver in /etc/resolv.conf; /etc/hosts works without DNS", () => {
  const sh = S.createMachine();
  sh.exec("echo '# empty' | sudo tee /etc/resolv.conf");
  assert.match(sh.exec("ping -c1 example.com").out, /Temporary failure in name resolution/);
  assert.match(sh.exec("host example.com").out, /no servers could be reached/); assert.strictEqual(sh.exec("dig example.com").code, 9);
  assert.match(sh.exec("ping -c1 localhost").out, /1 received/); assert.match(sh.exec("ping -c1 intranet").out, /10\.0\.0\.5/);
  sh.exec("echo 'nameserver 192.168.1.1' | sudo tee /etc/resolv.conf"); sh.exec("sudo ip route del default");
  assert.match(sh.exec("host example.com").out, /has address 93\.184\.215\.14/);    // names resolve again...
  assert.match(sh.exec("ping -c1 example.com").out, /Network is unreachable/);       // ...but nothing leaves without a default route
  sh.exec("sudo ip route add default via 192.168.1.1"); assert.match(sh.exec("ping -c1 example.com").out, /1 received/);
});
u("a trailing slash never doubles a path, and a directory link may carry one", () => {
  const sh = S.createMachine();
  sh.exec("mkdir -p work/q3/misc clients/2025/misc docs");
  sh.exec("touch work/top.txt work/q3/misc/x.txt clients/2025/misc/a.txt");
  sh.exec("echo hi > docs/a.txt");
  const ls = sh.exec("ls -R work/", { tty: false }).out;
  assert.ok(ls.startsWith("work/:\n"), ls);
  assert.ok(ls.includes("\nwork/q3:\n"), ls);
  assert.ok(ls.includes("\nwork/q3/misc:\n"), ls);
  assert.ok(!ls.includes("//"), ls);
  const dbl = sh.exec("ls -R work//", { tty: false }).out;
  assert.ok(dbl.startsWith("work//:\n"), dbl);
  assert.ok(dbl.includes("\nwork/q3:\n") && !dbl.includes("work//q3"), dbl);
  const clients = sh.exec("ls -R clients/", { tty: false }).out;
  assert.ok(clients.includes("\nclients/2025/misc:\n") && !clients.includes("//"), clients);
  const found = sh.exec("find clients/", { tty: false }).out;
  assert.ok(found.startsWith("clients/\n") && found.includes("clients/2025/misc\n") && !found.includes("//"), found);
  const grepped = sh.exec("grep -r x docs/", { tty: false }).out;
  assert.strictEqual(grepped, "");
  sh.exec("echo x > docs/a.txt");
  assert.strictEqual(sh.exec("grep -r x docs/", { tty: false }).out, "docs/a.txt:x\n");
  assert.strictEqual(sh.exec("grep -r x docs//", { tty: false }).out, "docs/a.txt:x\n");
  const usage = sh.exec("du work/", { tty: false }).out;
  assert.ok(usage.includes("\twork/q3/misc\n") && usage.endsWith("\twork/\n") && !usage.includes("//"), usage);
  sh.exec("tar -cf t.tar work/");
  const listed = sh.exec("tar -tf t.tar", { tty: false }).out;
  assert.ok(listed.includes("work/q3/misc/x.txt\n") && !listed.includes("//"), listed);
  sh.exec("mkdir dest; cp -r work/ dest/; rm -r work/");
  const copied = sh.exec("ls -R dest", { tty: false }).out;
  assert.ok(copied.includes("dest/work/q3/misc:\n") && !copied.includes("//"), copied);
  assert.strictEqual(sh.stat("/home/student/work"), null);
  sh.exec("printf '%s\\n' '#!/bin/bash' 'for f in \"$1\"/*.txt; do cp \"$f\" \"$f.bak\"; done' > backup.sh; chmod +x backup.sh");
  sh.exec("./backup.sh docs/");
  assert.strictEqual(sh.stat("/home/student/docs/a.txt.bak").data, "x\n");
  sh.exec("ln -s /var/log/ ~/logs");
  assert.strictEqual(sh.check({ type: "link", path: "/home/student/logs", target: "/var/log" }), true);
  sh.exec("echo x > notes.txt; ln -s notes.txt/ bad; ln -s missing/ dang");
  assert.strictEqual(sh.check({ type: "link", path: "/home/student/bad", target: "notes.txt" }), false);
  assert.strictEqual(sh.check({ type: "link", path: "/home/student/dang", target: "missing" }), false);
  sh.exec("ls -ld /etc/");
  assert.strictEqual(sh.check({ type: "history", regex: "^\\s*ls\\s+-ld\\s+/etc\\s*$" }), true);
});
console.log(`units: ${units} passed`);

// ---- every lab: tasks start incomplete, each solution completes its task (typed line by line, like a learner),
// every coaching mistake fires on its example, and every command a part or lesson lists is actually used.
global.window = global.window || {};
require(path.join(__dirname, "../docs/data/labs.js"));
const runLines = (sh, text) => { let out = "", buf = null; for (const line of text.split("\n")) { const src = buf == null ? line : buf + "\n" + line; const r = sh.exec(src); if (r.incomplete) { buf = src; continue; } buf = null; out += r.out; } assert.strictEqual(buf, null, "solution ends mid-command: " + text); return out; };
const mistakeHits = (mk, line, out) => (mk.cmd == null || new RegExp(mk.cmd).test(line)) && (mk.out == null || new RegExp(mk.out).test(out)) && (mk.cmd != null || mk.out != null);
const usesCmd = (sol, cmd) => new RegExp("(^|[\\s;|&(`$]|sudo\\s+)" + cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[\\s;|&)])", "m").test(sol);
let labTasks = 0, mistakes = 0, ways = 0; const ids = new Set();
for (const lab of window.LE_LABS) {
  assert.ok(!ids.has(lab.id), "duplicate lab id " + lab.id); ids.add(lab.id);
  assert.ok(lab.title && lab.intro && lab.lesson && lab.url && Array.isArray(lab.commands) && lab.tasks.length, lab.id + ": missing title/intro/lesson/url/commands/tasks");
  for (const c of lab.commands) assert.ok(lab.tasks.some(t => usesCmd(t.solution, c)), `${lab.id}: lists '${c}' but no solution uses it`);
  const sh = S.createMachine({ setup: lab.setup });
  lab.tasks.forEach((t, i) => {
    assert.ok(Array.isArray(t.hints) && t.hints.length && t.explain, `${lab.id} task ${i + 1}: needs hints and an explanation`);
    assert.strictEqual(sh.check(t.check), false, `${lab.id} task ${i + 1} is already complete before starting`);
  });
  lab.tasks.forEach((t, i) => {
    for (const mk of t.mistakes || []) {        // replay the earlier tasks on a fresh machine, then try the mistake
      const tmp = S.createMachine({ setup: lab.setup }); lab.tasks.slice(0, i).forEach(p => runLines(tmp, p.solution));
      const out = runLines(tmp, mk.try);
      assert.ok(mistakeHits(mk, mk.try, out), `${lab.id} task ${i + 1}: mistake doesn't fire for '${mk.try}'. Output:\n${out}`);
      assert.strictEqual(tmp.check(t.check), false, `${lab.id} task ${i + 1}: the mistake '${mk.try}' completes the task`);
      mistakes++;
    }
    const out = runLines(sh, t.solution);
    assert.strictEqual(sh.check(t.check), true, `${lab.id} task ${i + 1} not complete after its solution. Output:\n${out}`);
    for (const w of t.ways || []) {             // "other ways" shown after success: each must do the job by itself
      const tmp = S.createMachine({ setup: lab.setup }); lab.tasks.slice(0, i).forEach(p => runLines(tmp, p.solution));
      const o2 = runLines(tmp, w.cmd);
      assert.ok(w.note && tmp.check(t.check), `${lab.id} task ${i + 1}: the other way '${w.cmd}' doesn't complete the task. Output:\n${o2}`);
      ways++;
    }
    labTasks++;
  });
}
for (const L of window.LE_LESSONS) {
  const parts = window.LE_LABS.filter(l => l.lesson === L.lesson); assert.ok(parts.length, "lesson " + L.lesson + " has no parts");
  for (const c of L.covers) assert.ok(parts.some(p => p.tasks.some(t => usesCmd(t.solution, c))), `lesson ${L.lesson}: '${c}' is never used`);
}
// ---- "can this task still be finished?" (drives the lab's heads-up + Undo) and undo itself
{
  const lab = window.LE_LABS.find(l => l.id === "2.1.1-d"), t4 = lab.tasks[3];
  const fresh = () => { const sh = S.createMachine({ setup: lab.setup }); lab.tasks.slice(0, 3).forEach(t => runLines(sh, t.solution)); return sh; };
  let sh = fresh(); assert.ok(sh.canComplete(t4.check, t4.solution), "task 4 is doable after tasks 1-3");
  const snap = sh.snapshot(); sh.exec("sudo mv notes.txt /jan");
  assert.ok(!sh.canComplete(t4.check, t4.solution), "moving notes.txt to /jan makes task 4 impossible");
  sh.restore(snap); assert.ok(sh.stat("/home/student/notes.txt") && !sh.stat("/jan"), "undo puts notes.txt back and removes /jan");
  assert.ok(sh.canComplete(t4.check, t4.solution), "doable again after undo");
  sh.exec("mv notes.txt jan/"); assert.ok(sh.check(t4.check) === false && sh.canComplete(t4.check, t4.solution), "half done (no pwd yet) still counts as doable");
  sh = fresh(); sh.exec("cd /tmp"); assert.ok(sh.canComplete(t4.check, t4.solution), "changing directory doesn't count as stuck");
  const t3 = lab.tasks[2], sh3 = S.createMachine({ setup: lab.setup }); lab.tasks.slice(0, 2).forEach(t => runLines(sh3, t.solution));
  sh3.exec("rm game*"); assert.ok(!sh3.canComplete(t3.check, t3.solution), "rm game* deleted games.txt, so task 3 is stuck");
  units++;
}
// Typing every solution in order must never trip the "can't be finished" heads-up (no false alarms on the right path).
for (const lab of window.LE_LABS) {
  const sh = S.createMachine({ setup: lab.setup }), done = new Set();
  for (const t of lab.tasks) { let buf = null;
    for (const line of t.solution.split("\n")) { const src = buf == null ? line : buf + "\n" + line; const snap = sh.snapshot(); const r = sh.exec(src);
      if (r.incomplete) { buf = src; continue; } buf = null;
      lab.tasks.forEach((x, j) => { if (!done.has(j) && sh.check(x.check)) done.add(j); });
      lab.tasks.forEach((x, j) => { if (done.has(j) || sh.canComplete(x.check, x.solution)) return;
        const was = S.createMachine({ setup: lab.setup }); was.restore(snap);
        assert.ok(!was.canComplete(x.check, x.solution), `${lab.id}: the correct line '${src}' wrongly flags task ${j + 1} as impossible`); }); } }
}
console.log(`labs: ${window.LE_LESSONS.length} lessons, ${window.LE_LABS.length} parts, ${labTasks} tasks, ${ways} other ways and ${mistakes} coaching tips verified`);
// A trailing slash, or -l beside -R, still does the job. Following /bin with a slash does not.
{
  const labOf = id => window.LE_LABS.find(l => l.id === id);
  const runUpTo = (lab, i, cmd) => {
    const sh = S.createMachine({ setup: lab.setup });
    lab.tasks.slice(0, i).forEach(p => runLines(sh, p.solution));
    runLines(sh, cmd);
    return sh;
  };
  const rec = labOf("2.2.1-d");
  assert.ok(runUpTo(rec, 2, "ls -R ~/practice/").check(rec.tasks[2].check), "ls -R ~/practice/");
  assert.ok(runUpTo(rec, 2, "ls -lR ~/practice").check(rec.tasks[2].check), "ls -lR ~/practice");
  assert.ok(runUpTo(rec, 2, "ls -lR ~/practice/").check(rec.tasks[2].check), "ls -lR ~/practice/");
  assert.ok(!runUpTo(rec, 2, "ls ~/practice/").check(rec.tasks[2].check), "ls without -R");
  const space = labOf("2.3.2-c");
  assert.ok(runUpTo(space, 1, "du -h ~/pics/").check(space.tasks[1].check), "du -h ~/pics/");
  assert.ok(runUpTo(space, 2, "du -sh ~/pics/").check(space.tasks[2].check), "du -sh ~/pics/");
  assert.ok(runUpTo(space, 3, "ls -lR ~/pics/").check(space.tasks[3].check), "ls -lR ~/pics/");
  assert.ok(!runUpTo(space, 3, "ls ~/pics/").check(space.tasks[3].check), "ls ~/pics/ is not recursive");
  const bin = labOf("4.3.1-a");
  assert.ok(!runUpTo(bin, 3, "ls -ld /bin/").check(bin.tasks[3].check), "ls -ld /bin/ follows the link");
  assert.ok(runUpTo(bin, 3, "ls -ld /bin").check(bin.tasks[3].check), "ls -ld /bin");
  const ln = labOf("5.4.1-c");
  assert.ok(runUpTo(ln, 4, "ln -s /var/log/ ~/logs\nls ~/logs/").check(ln.tasks[4].check), "ln -s /var/log/");
}
// CSP blocks eval, and Node will not, so the shipped scripts are checked directly.
// (Lives here, not in test_core.js, so a parallel job can keep that file.)
{
  const dir = path.join(__dirname, "../docs/js");
  const bad = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(dir, name), "utf8");
    if (/\bFunction\s*\(|\beval\s*\(/.test(src)) bad.push(name);
  }
  if (bad.length) { fail++; console.log("FAIL static: Function( or eval( in " + bad.join(", ")); }
  else console.log("static: no Function( or eval( in docs/js");
}
process.exit(fail ? 1 : 0);
