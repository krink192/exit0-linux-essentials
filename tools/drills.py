# SPDX-License-Identifier: AGPL-3.0-or-later
"""Command practice: short, randomized drills for the lab shell. build.py writes docs/data/drills.js.

A **skill** is one thing to do with one command (find files by name, chmod in octal, tar -czf...). It has one or more
templates. Each template's {{placeholders}} are filled from `cases` (values that belong together, computed here so the
expected output is always right) and `vars` (independent picks), so every run uses different names and data and the
answer can't be memorised. Checks are the same declarative checks the labs use: any command that gets the machine into
the right state, or prints the right output, counts.

  text      the task, with `code`
  solution  one way to do it (shown after "Show answer"); several lines run in order
  check     what must be true afterwards
  hints     from vague to nearly the answer
  explain   shown once it's done
  wrong     plausible wrong commands: tools/test_drills.js proves every one of them is rejected

tools/test_drills.js runs every case of every template: the check must fail on the fresh machine, pass after the
solution and fail after each wrong command. Everything stays on the 010-160 (Linux Essentials 1.6) objectives."""
import itertools
import random
import re

from labs import H, LAST, CWD, EX, AB, ALL, ANY, NOT, HAS, EQ, PERMS, MODE, VAR, F, D, HOME

SKILLS = []


def rx(s):
    """Escape text for a JavaScript regex. {{placeholders}} stay as they are; their values are inserted unescaped."""
    return re.sub(r"\\\{\\\{(\w+)\\\}\\\}", r"{{\1}}", re.sub(r"([.^$*+?()\[\]{}|\\/])", r"\\\1", s))


def out_is(text):
    """The last command printed exactly this (text ends with a newline)."""
    return LAST("^" + rx(text) + "$")


def skill(sid, cmd, obj, label, templates):
    assert re.match(r"^[a-z0-9-]+$", sid), sid
    SKILLS.append({"id": sid, "cmd": cmd, "obj": obj, "label": label, "templates": templates})


def tpl(text, solution, check, hints, explain, wrong, setup=None, cases=None, vars=None):
    t = {"text": text, "solution": solution, "check": check, "hints": hints if isinstance(hints, list) else [hints],
         "explain": explain, "wrong": wrong, "setup": setup or {}}
    if cases: t["cases"] = cases
    if vars: t["vars"] = vars
    return t


def owner(path, user=None, group=None):
    c = {"type": "owner", "path": path}
    if user: c["user"] = user
    if group: c["group"] = group
    return c
def link(path, target=None):     return dict({"type": "link", "path": path}, **({"target": target} if target else {}))
def hardlink(path, other):       return {"type": "hardlink", "path": path, "other": other}
def archive(path, compression=None, fmt="tar", has=()):
    return {"type": "archive", "path": path, "compression": compression, "format": fmt, "has": list(has)}
def compressed(path, kind):      return {"type": "compressed", "path": path, "kind": kind}
def user(name, **kw):            return dict({"type": "user", "name": name}, **kw)
def nouser(name):                return {"type": "nouser", "name": name}
def group(name, **kw):           return dict({"type": "group", "name": name}, **kw)
def nogroup(name):               return {"type": "nogroup", "name": name}
def env(name, value=None):       return dict({"type": "env", "name": name}, **({"value": value} if value is not None else {}))
def alias(name, value):          return {"type": "alias", "name": name, "value": value}
def novar(name):                 return {"type": "novar", "name": name}
def script(path, output):        return {"type": "script", "path": path, "output": output}
def noproc(cmd):                 return {"type": "noproc", "cmd": cmd}
def located(path):               return {"type": "located", "path": path}


FILES = ["report.txt", "notes.txt", "todo.txt", "budget.csv", "draft.md", "plan.txt", "summary.txt", "agenda.txt"]
DIRS = ["projects", "backup", "archive", "work", "docs", "photos", "scratch", "clients"]
USERS = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi", "ivan", "judy"]
GROUPS = ["devs", "ops", "sales", "web", "audit", "support"]
WORDS = ["apple", "banana", "cherry", "grape", "lemon", "mango", "melon", "peach", "pear", "plum", "kiwi", "lime"]


def cases(n, seed, make):
    """n cases from make(rng, i), deterministic so the built file doesn't change between builds."""
    r = random.Random(seed)
    return [make(r, i) for i in range(n)]


def two(r, pool):
    a, b = r.sample(pool, 2)
    return a, b


# =====================================================================================================================
# 2.1 Command line basics
# =====================================================================================================================
VARS = [("COLOR", "teal"), ("CITY", "Fresno"), ("EDITOR", "nano"), ("BACKUP_DIR", "/srv/backup"), ("TEAM", "ops"), ("LEVEL", "debug")]

skill("echo-var", "echo", "2.1", "Print a variable's value", [
  tpl("Print the value of the variable `{{v}}`.", "echo ${{v}}", out_is("{{val}}\n"),
      ["`echo` prints its arguments. Put a `$` in front of a variable's name to get its value."],
      "`$NAME` (or `${NAME}`) is replaced by the variable's value before the command runs.",
      ["echo {{v}}", "echo '${{v}}'"],
      setup={"env": {"{{v}}": "{{val}}"}}, cases=[{"v": v, "val": val} for v, val in VARS]),
])
skill("var-set", "variables", "2.1", "Set a shell variable", [
  tpl("Set a shell variable `{{v}}` to `{{val}}`.", "{{v}}={{val}}", VAR("{{v}}", "{{val}}"),
      ["NAME=value, with no spaces around the `=`."],
      "With spaces (`{{v}} = {{val}}`) bash would try to run a command called `{{v}}`. The variable exists only in this shell until you `export` it.",
      ["{{v}} = {{val}}", "echo {{v}}={{val}}", "${{v}}={{val}}"],
      cases=[{"v": v, "val": val} for v, val in VARS]),
])
skill("export", "export", "2.1", "Export a variable to programs you start", [
  tpl("Create the variable `{{v}}` with the value `{{val}}` so that programs started from this shell can see it too.",
      "export {{v}}={{val}}", env("{{v}}", "{{val}}"),
      ["A plain NAME=value stays inside this shell.", "`export NAME=value` sets it and passes it on to child processes."],
      "Exported variables are copied into the environment of every program the shell starts. `env` lists them.",
      ["{{v}}={{val}}", "echo {{v}}={{val}}"],
      cases=[{"v": v, "val": val} for v, val in VARS]),
])
skill("unset", "unset", "2.1", "Remove a variable", [
  tpl("Remove the variable `{{v}}` completely.", "unset {{v}}", novar("{{v}}"),
      ["There's a builtin whose name means the opposite of 'set'."],
      "`unset NAME` deletes the variable. Setting it to nothing (`{{v}}=`) keeps it around with an empty value.",
      ["{{v}}=", "unset ${{v}}"],
      setup={"env": {"{{v}}": "{{val}}"}}, cases=[{"v": v, "val": val} for v, val in VARS]),
])
skill("quoting", "echo", "2.1", "Quote special characters", [
  tpl("Print exactly `{{text}}`, dollar sign included.", "echo '{{text}}'", LAST("^{{trx}}\n$"),
      ["Inside double quotes `$` still starts a variable.", "Single quotes keep every character literally."],
      "In single quotes nothing is special, so `$` is printed as is. A backslash works too: `echo {{esc}}`.",
      ['echo "{{text}}"', "echo {{text}}"],
      cases=[{"text": t, "esc": t.replace("$", "\\$"), "trx": rx(t)} for t in ["Price: $5", "Total $9 due", "Cost is $7", "Pay $3 now"]]),
  tpl("Print the sentence `Logged in as student` using the `USER` variable for the name.", 'echo "Logged in as $USER"',
      ALL(out_is("Logged in as student\n"), H(r"\$\{?USER\b")),
      ["Variables start with `$`. Double quotes keep the sentence together and still expand variables."],
      "Double quotes keep spaces as typed but still replace `$USER`. Single quotes would print `$USER` literally.",
      ["echo 'Logged in as $USER'", "echo Logged in as USER"]),
])
skill("type", "type", "2.1", "Builtin or program?", [
  tpl("Find out whether `{{c}}` is a shell builtin or a program on disk.", "type {{c}}", LAST(r"^{{c}} is (a shell builtin|/usr/bin/{{c}})\n$"),
      ["Ask the shell itself, not the manual.", "`type NAME` says how bash would run NAME."],
      "Builtins (cd, echo, export, pwd...) run inside the shell; others are files found through `$PATH`. `which` only knows about files.",
      ["which {{c}}", "man {{c}}"],
      cases=[{"c": c} for c in ["cd", "echo", "pwd", "export", "ls", "cat", "mv", "grep"]]),
])
skill("which", "which", "2.1", "Find a program's path", [
  tpl("Print the full path of the program that runs when you type `{{c}}`.", "which {{c}}", out_is("/usr/bin/{{c}}\n"),
      ["One command searches the directories in `$PATH` and prints the first match."],
      "`which` walks `$PATH` from left to right. `type -p {{c}}` gives the same path.",
      ["type -t {{c}}", "whatis {{c}}"],
      cases=[{"c": c} for c in ["ls", "cat", "tar", "grep", "find", "chmod"]]),
])
skill("brace", "brace expansion", "2.1", "Brace expansion", [
  tpl("Create the empty files `{{p}}1.txt` to `{{p}}{{n}}.txt` with one short `touch` command, using brace expansion.",
      "touch {{p}}{1..{{n}}}.txt", ALL(EX(HOME + "/{{p}}1.txt"), EX(HOME + "/{{p}}{{n}}.txt"), NOT(EX(HOME + "/{{p}}{{n1}}.txt")), H(r"\{1\.\.{{n}}\}")),
      ["Bash can expand `{1..5}` into `1 2 3 4 5` before the command runs."],
      "`{1..{{n}}}` is expanded by the shell, so `touch` simply receives {{n}} names. `echo {a,b,c}` lists alternatives the same way.",
      ["touch {{p}}{{n}}.txt", "touch {{p}}[1-{{n}}].txt", "touch {{p}}{1..{{n1}}}.txt"],
      cases=[{"p": p, "n": n, "n1": n + 1} for p, n in [("log", 3), ("day", 4), ("part", 5), ("ch", 3), ("img", 6), ("test", 4)]]),
])
skill("alias", "alias", "2.3", "Create an alias", [
  tpl("Create an alias `{{a}}` that runs `{{cmd}}`.", "alias {{a}}='{{cmd}}'", alias("{{a}}", "{{cmd}}"),
      ["alias NAME='command'", "Quote the command: it contains a space."],
      "Aliases are shortcuts inside the shell. Without quotes, `alias {{a}}={{cmd}}` would only take the first word. Put it in `~/.bashrc` to keep it.",
      ["alias {{a}}={{cmd}}", "{{a}}='{{cmd}}'"],
      cases=[{"a": a, "cmd": c} for a, c in [("la", "ls -a"), ("lt", "ls -lt"), ("lh", "ls -lh"), ("dfh", "df -h"), ("psx", "ps aux"), ("gi", "grep -i")]]),
])

# =====================================================================================================================
# 2.2 Using the command line to get help
# =====================================================================================================================
skill("man", "man", "2.2", "Open a manual page", [
  tpl("Open the manual page of `{{c}}`.", "man {{c}}", H(r"^\s*man\s+(1\s+)?{{c}}\s*$"),
      ["The manual is the classic help system: `man NAME`."],
      "Inside `man`, `/word` searches, `n` jumps to the next hit and `q` quits. Section 1 is user commands.",
      ["help {{c}}", "info"],
      cases=[{"c": c} for c in ["ls", "cp", "grep", "tar", "chmod", "find"]]),
  tpl("Open the manual page that describes the **file format** of `/etc/passwd`, not the command.", "man 5 passwd", H(r"^\s*man\s+(5\s+passwd|passwd\.5|-s\s*5\s+passwd)\s*$"),
      ["The manual has sections: 1 is commands, 5 is file formats.", "Put the section number before the name."],
      "`man passwd` opens section 1 (the `passwd` command). `man 5 passwd` opens the file format. `man -k passwd` lists both.",
      ["man passwd", "man -k passwd"]),
])
skill("whatis", "whatis", "2.2", "One-line description", [
  tpl("Show the one-line description of `{{c}}`.", "whatis {{c}}", LAST(r"^{{c}} \(1\)\s+- "),
      ["There's a command that prints just the NAME line of a manual page."],
      "`whatis` (same as `man -f`) shows the name line. `apropos` searches those lines for a keyword.",
      ["man {{c}}", "type {{c}}"],
      cases=[{"c": c} for c in ["ls", "cp", "tar", "grep", "head", "sort"]]),
])
skill("apropos", "apropos", "2.2", "Search manual descriptions", [
  tpl("You don't know the command's name. Search the manual page descriptions for the keyword `{{k}}`.", "apropos {{k}}", ALL(LAST(r"(^|\n){{c}} \(1\)"), H(r"^\s*(apropos|man\s+-k)\s+{{k}}\s*$")),
      ["`whatis` needs the exact name; another command searches the descriptions.", "`apropos keyword`, or `man -k keyword`."],
      "`apropos {{k}}` finds `{{c}}` and anything else whose description mentions the word.",
      ["whatis {{k}}", "man {{k}}"],
      cases=[{"k": "copy", "c": "cp"}, {"k": "archive", "c": "zip"}, {"k": "compress", "c": "gzip"}, {"k": "sort", "c": "sort"}]),
])
skill("help-builtin", "help", "2.2", "Help for a builtin", [
  tpl("`{{c}}` is a shell builtin. Show its help text from the shell itself.", "help {{c}}", LAST(r"^{{c}}: {{c}}"),
      ["Builtins don't have their own man page; bash has a builtin that documents them."],
      "`help` covers builtins like cd, export and alias. `type NAME` tells you whether something is a builtin.",
      ["{{c}} --help", "whatis {{c}}"],
      cases=[{"c": c} for c in ["cd", "export", "alias", "type", "unset"]]),
])
FIND_CASES = cases(6, 21, lambda r, i: dict(zip(("d", "a", "b"), [r.choice(DIRS)] + r.sample(["2024", "2025", "old", "misc", "team", "q3"], 2)), f=r.choice(FILES)))
skill("find-name", "find", "2.2", "Find files by name", [
  tpl("Find every file named `{{f}}` anywhere under `~/{{d}}` and print their paths.", "find ~/{{d}} -name {{f}}",
      ALL(LAST(r"{{d}}/{{a}}/{{f}}\n"), LAST(r"{{d}}/{{b}}/deep/{{f}}\n"), NOT(LAST(r"other\.txt"))),
      ["`find` takes where to start, then tests.", "`find START -name NAME`"],
      "`find` walks every subdirectory. Quote patterns with wildcards (`find ~ -name '*.txt'`) so the shell doesn't expand them first.",
      ["ls -R ~/{{d}}", "find ~/{{d}}", "find {{f}}"],
      setup={"files": [F("~/{{d}}/{{a}}/{{f}}", "x\n"), F("~/{{d}}/{{b}}/deep/{{f}}", "y\n"), F("~/{{d}}/{{b}}/other.txt", "z\n")]}, cases=FIND_CASES),
  tpl("Find every file ending in `.{{ext}}` under `~/{{d}}`.", "find ~/{{d}} -name '*.{{ext}}'",
      ALL(LAST(r"{{d}}/one\.{{ext}}\n"), LAST(r"{{d}}/sub/two\.{{ext}}\n"), NOT(LAST(r"three\.txt"))),
      ["`-name` accepts wildcards.", "Quote the pattern: `-name '*.{{ext}}'`."],
      "Quoting keeps the shell from expanding `*.{{ext}}` itself; `find` then matches the pattern in every directory.",
      ["ls ~/{{d}}/*.{{ext}}", "find ~/{{d}}"],
      setup={"files": [F("~/{{d}}/one.{{ext}}"), F("~/{{d}}/sub/two.{{ext}}"), F("~/{{d}}/sub/three.txt")]},
      cases=[{"d": d, "ext": e} for d, e in [("projects", "log"), ("backup", "conf"), ("work", "sh"), ("docs", "md"), ("clients", "csv")]]),
])
skill("find-iname", "find", "2.2", "Find, ignoring case", [
  tpl("Find every file called `{{f}}` under `~/{{d}}`, whatever the upper/lower case of its name.", "find ~/{{d}} -iname {{f}}",
      ALL(LAST(r"{{d}}/a/{{f}}\n"), LAST(r"{{d}}/b/{{F}}\n")),
      ["`-name` is case-sensitive. There's an `i` version."],
      "`-iname` matches `{{f}}`, `{{F}}` and any other mix of case.",
      ["find ~/{{d}} -name {{f}}", "find ~/{{d}} -name {{F}}"],
      setup={"files": [F("~/{{d}}/a/{{f}}"), F("~/{{d}}/b/{{F}}")]},
      cases=[{"d": d, "f": f, "F": f.upper()} for d, f in zip(DIRS, FILES)][:6]),
])
skill("find-type", "find", "2.2", "Find only directories", [
  tpl("List only the **directories** under `~/{{d}}` (including `~/{{d}}` itself), not the files.", "find ~/{{d}} -type d",
      ALL(LAST(r"{{d}}/{{a}}\n"), LAST(r"{{d}}/{{a}}/{{b}}\n"), NOT(LAST(r"\.txt"))),
      ["`find` can test what kind of thing each entry is.", "`-type d` for directories, `-type f` for files."],
      "`find ~/{{d}} -type f` would list only the files. Tests can be combined: `-type f -name '*.txt'`.",
      ["find ~/{{d}}", "ls -d ~/{{d}}/*/", "ls -R ~/{{d}}"],
      setup={"files": [F("~/{{d}}/{{a}}/{{b}}/x.txt"), F("~/{{d}}/y.txt")]}, cases=FIND_CASES),
])
skill("locate", "locate", "2.2", "Update the locate database", [
  tpl("Create an empty file `~/{{f}}`, then update the file-name database so that `locate` can find it.", "touch ~/{{f}}\nsudo updatedb",
      located(HOME + "/{{f}}"),
      ["`locate` searches a saved list of file names, so new files aren't in it yet.", "The command that rebuilds that list needs root."],
      "`locate` is fast because it reads a database instead of the disk; `updatedb` refreshes it (usually daily by cron).",
      ["touch ~/{{f}}", "find ~ -name {{f}}"],
      vars={"f": FILES}),
])

# =====================================================================================================================
# 2.3 Using directories and listing files
# =====================================================================================================================
skill("cd-abs", "cd", "2.3", "Change directory (absolute path)", [
  tpl("Go to `{{p}}` using an absolute path.", "cd {{p}}", ALL(CWD("{{p}}"), H(r"^\s*cd\s+/")),
      ["Absolute paths start at the root, `/`."],
      "An absolute path works from anywhere. `pwd` shows where you are.",
      ["cd {{rel}}", "ls {{p}}"],
      setup={"cwd": "/usr/share"}, cases=[{"p": p, "rel": p.lstrip("/")} for p in ["/var/log", "/etc/ssh", "/usr/share/doc", "/tmp", "/var/www/html", "/etc/skel"]]),
])
skill("cd-rel", "cd", "2.3", "Change directory (relative path)", [
  tpl("You're in `~/{{d}}/{{a}}`. Go to `~/{{d}}/{{b}}` using a **relative** path.", "cd ../{{b}}", ALL(CWD(HOME + "/{{d}}/{{b}}"), H(r"^\s*cd\s+\.\./")),
      ["`..` is the parent directory.", "Go up one level, then down into `{{b}}`."],
      "Relative paths start where you are. `..` is the parent and `.` is the current directory.",
      ["cd ~/{{d}}/{{b}}", "cd {{b}}", "cd /{{b}}"],
      setup={"files": [D("~/{{d}}/{{a}}"), D("~/{{d}}/{{b}}")], "cwd": "~/{{d}}/{{a}}"}, cases=FIND_CASES),
])
skill("cd-home", "cd", "2.3", "Go home", [
  tpl("You're in `{{p}}`. Go back to your home directory in the shortest way.", "cd", CWD(HOME),
      ["`cd` with no argument goes somewhere useful."],
      "`cd`, `cd ~` and `cd $HOME` all go home. `cd -` goes back to the previous directory.",
      ["cd /home", "cd /"],
      setup={"cwd": "{{p}}"}, cases=[{"p": p} for p in ["/var/log", "/etc", "/usr/share/doc", "/tmp"]]),
])
skill("mkdir-p", "mkdir", "2.3", "Create nested directories", [
  tpl("Create `~/{{d}}/{{y}}/{{m}}` in one command. None of these directories exist yet.", "mkdir -p ~/{{d}}/{{y}}/{{m}}", EX(HOME + "/{{d}}/{{y}}/{{m}}", "dir"),
      ["Plain `mkdir` fails when the parent directory is missing.", "One option creates the parents too."],
      "`mkdir -p` (parents) creates every missing directory on the way and doesn't complain if they already exist.",
      ["mkdir ~/{{d}}/{{y}}/{{m}}", "mkdir ~/{{d}}"],
      cases=cases(6, 31, lambda r, i: {"d": r.choice(DIRS), "y": str(r.choice([2024, 2025, 2026])), "m": r.choice(["jan", "feb", "mar", "apr", "may", "jun"])})),
])
skill("rmdir", "rmdir", "2.3", "Remove an empty directory", [
  tpl("Remove the empty directory `~/{{d}}` with the command made for empty directories.", "rmdir ~/{{d}}", ALL(AB(HOME + "/{{d}}"), EX(HOME + "/{{e}}/keep.txt")),
      ["There's a command that only removes directories, and only when they are empty."],
      "`rmdir` refuses to delete a directory that still has files in it, which makes it a safe choice. `rm -r` deletes everything.",
      ["rm ~/{{d}}", "rmdir ~/{{e}}"],
      setup={"files": [D("~/{{d}}"), F("~/{{e}}/keep.txt")]}, cases=cases(6, 32, lambda r, i: dict(zip(("d", "e"), two(r, DIRS))))),
])
skill("ls-a", "ls", "2.3", "Show hidden files", [
  tpl("List the files in `~/{{d}}`, including hidden ones.", "ls -a ~/{{d}}", ALL(LAST(r"(^|\s)\.{{h}}(\s|$)"), LAST(r"visible\.txt")),
      ["Names starting with a dot are hidden from a plain `ls`.", "`-a` means all."],
      "`ls -a` also shows `.` and `..`; `ls -A` leaves those two out.",
      ["ls ~/{{d}}", "ls -l ~/{{d}}"],
      setup={"files": [F("~/{{d}}/.{{h}}"), F("~/{{d}}/visible.txt")]},
      cases=[{"d": d, "h": h} for d, h in zip(DIRS, ["env", "secret", "config", "cache", "token", "history"])]),
])
skill("ls-l", "ls", "2.3", "Long listing", [
  tpl("Show the permissions, owner, size and date of `{{f}}`.", "ls -l {{f}}", LAST(r"^-rw-r--r-- 1 student student\s+\d+ .* {{fr}}\n$"),
      ["`ls` has a long format."],
      "`ls -l` columns: type and permissions, link count, owner, group, size, modification time, name.",
      ["ls {{f}}", "cat {{f}}", "file {{f}}"],
      setup={"files": [F("~/{{f}}", "hello\n")]}, cases=[{"f": f, "fr": rx(f)} for f in FILES]),
])
skill("ls-lh", "ls", "2.3", "Human-readable sizes", [
  tpl("List `~/{{d}}` in long format with sizes shown as K, M or G instead of bytes.", "ls -lh ~/{{d}}", LAST(r" 4\.9K .*{{f}}"),
      ["Combine the long format with the option for human-readable sizes.", "`-h`"],
      "`-h` only changes how sizes are shown. `du -h` and `df -h` use the same letter.",
      ["ls -l ~/{{d}}", "ls -h ~/{{d}}"],
      setup={"files": [F("~/{{d}}/{{f}}", "x" * 5000)]}, cases=cases(5, 33, lambda r, i: {"d": r.choice(DIRS), "f": r.choice(["video.mp4", "disk.img", "dump.sql", "photo.jpg", "data.bin"])})),
])
LS_T = [("zeta.txt", "alpha.txt", "mid.txt"), ("b.log", "c.log", "a.log"), ("x.conf", "y.conf", "w.conf"), ("second.md", "third.md", "first.md")]
skill("ls-t", "ls", "2.3", "Sort by time", [
  tpl("List `~/{{d}}` with the most recently changed file first.", "ls -t ~/{{d}}", LAST(r"{{newr}}[\s\S]*{{midr}}[\s\S]*{{oldr}}"),
      ["`ls` sorts by name unless told otherwise.", "`-t` sorts by modification time."],
      "`ls -lt` adds the long format; `ls -ltr` reverses it so the newest is at the bottom, handy in log directories.",
      ["ls ~/{{d}}", "ls -r ~/{{d}}"],
      setup={"files": [F("~/{{d}}/{{new}}", mtime="-1h"), F("~/{{d}}/{{mid}}", mtime="-2d"), F("~/{{d}}/{{old}}", mtime="-30d")]},
      cases=[{"d": d, "new": a, "mid": b, "old": c, "newr": rx(a), "midr": rx(b), "oldr": rx(c)} for d, (a, b, c) in zip(DIRS, LS_T)]),
])
skill("ls-recursive", "ls", "2.3", "List recursively", [
  tpl("List `{{d}}` and the contents of every directory inside it, in one `ls` command.", "ls -R {{d}}", ALL(LAST(r"(^|\n){{d}}/{{a}}:\n"), LAST(r"(^|\n){{d}}/{{a}}/{{b}}:\n")),
      ["One option makes `ls` go into subdirectories.", "It's a capital letter."],
      "`ls -R` (recursive) prints each directory's name followed by its contents. `tree` shows the same as a picture.",
      ["ls {{d}}", "ls -r {{d}}", "ls -d {{d}}"],
      setup={"files": [F("~/{{d}}/{{a}}/{{b}}/x.txt"), F("~/{{d}}/top.txt")]}, cases=FIND_CASES),
])
skill("du", "du", "2.3", "Total size of a directory", [
  tpl("Show the total disk space used by `{{d}}` as a single human-readable line.", "du -sh {{d}}", LAST(r"^[\d.]+[KMG]?\t{{d}}/?\n$"),
      ["`du` lists every subdirectory by default.", "`-s` for a summary, `-h` for human-readable sizes."],
      "`du -sh *` gives one line per item in the current directory: a quick way to find what's filling a disk.",
      ["du {{d}}", "ls -lh {{d}}", "du -h {{d}}"],
      setup={"files": [F("~/{{d}}/a/one", "x" * 3000), F("~/{{d}}/b/two", "y" * 9000)]}, vars={"d": DIRS}),
])

# =====================================================================================================================
# 2.4 Creating, moving and deleting files
# =====================================================================================================================
TWO_FILES = cases(6, 41, lambda r, i: dict(zip(("f", "g"), two(r, FILES)), d=r.choice(DIRS)))
skill("cp", "cp", "2.4", "Copy a file into a directory", [
  tpl("Copy `{{f}}` into the directory `{{d}}`. Keep the original where it is.", "cp {{f}} {{d}}/", ALL(EX(HOME + "/{{d}}/{{f}}", "file"), EX(HOME + "/{{f}}")),
      ["`cp SOURCE DESTINATION`"],
      "With a directory as the destination, the copy keeps its name. Add a name to rename it on the way: `cp {{f}} {{d}}/new.txt`.",
      ["mv {{f}} {{d}}/", "cp {{d}} {{f}}"],
      setup={"files": [F("~/{{f}}", "data\n"), D("~/{{d}}")]}, cases=TWO_FILES),
])
skill("cp-r", "cp", "2.4", "Copy a whole directory", [
  tpl("Copy the directory `{{d}}`, with everything in it, to a new directory `{{d}}-copy`.", "cp -r {{d}} {{d}}-copy", ALL(EX(HOME + "/{{d}}-copy/sub/{{f}}"), EX(HOME + "/{{d}}/sub/{{f}}")),
      ["Plain `cp` skips directories.", "`-r` (recursive)."],
      "`cp -r` copies the whole tree. `cp -a` also keeps owners, permissions and times, which is what backups want.",
      ["cp {{d}} {{d}}-copy", "mv {{d}} {{d}}-copy", "mkdir {{d}}-copy"],
      setup={"files": [F("~/{{d}}/sub/{{f}}", "x\n")]}, cases=TWO_FILES),
])
skill("mv-rename", "mv", "2.4", "Rename a file", [
  tpl("Rename `{{f}}` to `{{g}}`.", "mv {{f}} {{g}}", ALL(EX(HOME + "/{{g}}"), AB(HOME + "/{{f}}")),
      ["There's no rename command in the objectives: moving a file to a new name renames it."],
      "`mv` renames within a directory and moves between directories, with one command for both.",
      ["cp {{f}} {{g}}", "mv {{g}} {{f}}"],
      setup={"files": [F("~/{{f}}", "x\n")]}, cases=TWO_FILES),
])
skill("mv-glob", "mv", "2.4", "Move files matching a pattern", [
  tpl("Move all the `.{{ext}}` files in your home directory into `{{d}}` with one command. Leave other files where they are.", "mv *.{{ext}} {{d}}/",
      ALL(EX(HOME + "/{{d}}/a.{{ext}}"), EX(HOME + "/{{d}}/b.{{ext}}"), AB(HOME + "/a.{{ext}}"), EX(HOME + "/keep.txt")),
      ["`*` matches any characters.", "`*.{{ext}}` matches every name ending in `.{{ext}}`."],
      "The shell expands `*.{{ext}}` into the matching names before `mv` runs; the last argument is the destination.",
      ["mv * {{d}}/", "mv a.{{ext}} {{d}}/"],
      setup={"files": [F("~/a.{{ext}}"), F("~/b.{{ext}}"), F("~/keep.txt"), D("~/{{d}}")]},
      cases=[{"ext": e, "d": d} for e, d in [("log", "logs"), ("jpg", "photos"), ("csv", "data"), ("pdf", "docs"), ("sh", "scripts")]]),
])
skill("rm-r", "rm", "2.4", "Delete a directory tree", [
  tpl("Delete the directory `{{d}}` and everything in it.", "rm -r {{d}}", AB(HOME + "/{{d}}"),
      ["`rmdir` only removes empty directories.", "`rm` needs `-r` for directories."],
      "`rm -r` deletes without a trash can. `rm -ri` asks for each file if you want a safety net.",
      ["rmdir {{d}}", "rm {{d}}", "rm {{d}}/*"],
      setup={"files": [F("~/{{d}}/sub/{{f}}"), F("~/{{d}}/{{g}}")]}, cases=TWO_FILES),
])
skill("glob-class", "globbing", "2.4", "Wildcards: [ ] and ?", [
  tpl("Delete `{{p}}1`, `{{p}}2` and `{{p}}3` (but not `{{p}}4`, `{{p}}5` or `{{p}}10`) with a single `rm` using a character class.", "rm {{p}}[1-3]",
      ALL(AB(HOME + "/{{p}}1"), AB(HOME + "/{{p}}3"), EX(HOME + "/{{p}}4"), EX(HOME + "/{{p}}10"), H(r"\[")),
      ["`[abc]` matches one of the listed characters.", "`[1-3]` matches one digit from 1 to 3."],
      "`?` matches exactly one character and `*` any number, so `{{p}}?` would also delete `{{p}}4` and `{{p}}5`.",
      ["rm {{p}}*", "rm {{p}}?", "rm {{p}}[1-3]*"],
      setup={"files": [F("~/{{p}}" + str(n)) for n in (1, 2, 3, 4, 5, 10)]}, vars={"p": ["log", "img", "file", "data", "part"]}),
  tpl("Show (with `ls`) only the files whose names are `{{p}}` plus exactly **one** more character.", "ls {{p}}?",
      ALL(LAST(r"{{p}}a"), LAST(r"{{p}}7"), NOT(LAST(r"{{p}}12")), NOT(LAST(r"{{p}}\n"))),
      ["One wildcard matches exactly one character."],
      "`?` matches one character, `*` any number (even none).",
      ["ls {{p}}*", "ls {{p}}"],
      setup={"files": [F("~/{{p}}a"), F("~/{{p}}7"), F("~/{{p}}12"), F("~/{{p}}")]}, vars={"p": ["log", "img", "file", "data", "part"]}),
])

# =====================================================================================================================
# 3.1 Archiving files on the command line
# =====================================================================================================================
ARC = cases(6, 51, lambda r, i: {"d": r.choice(DIRS), "a": r.choice(["backup", "site", "bundle", "release", "snap"]), "f": r.choice(FILES)})
for sid, letter, ext, comp, label in [("tar-gz", "z", "tar.gz", "gzip", "gzip"), ("tar-bz2", "j", "tar.bz2", "bzip2", "bzip2"), ("tar-xz", "J", "tar.xz", "xz", "xz")]:
    skill(sid, "tar", "3.1", "Create a %s-compressed tar archive" % label, [
      tpl("Create a %s-compressed tar archive `{{a}}.%s` of the directory `{{d}}`." % (label, ext), "tar -c%svf {{a}}.%s {{d}}" % (letter, ext),
          archive(HOME + "/{{a}}.%s" % ext, comp, has=["{{d}}/{{f}}"]),
          ["`tar -c` creates, `-f` names the archive file.", "The compression option for %s is `-%s`." % (label, letter)],
          "`-c` create, `-%s` %s, `-v` list files as they go in, `-f` the archive name (it must come right before it)." % (letter, label),
          ["tar -cvf {{a}}.%s {{d}}" % ext, "tar -x%svf {{a}}.%s {{d}}" % (letter, ext), "%s {{d}}" % label],
          setup={"files": [F("~/{{d}}/{{f}}", "x\n")]}, cases=ARC),
    ])
skill("tar-t", "tar", "3.1", "List an archive without extracting", [
  tpl("Show what's inside `{{a}}.tar.gz` **without** extracting it.", "tar -tzf {{a}}.tar.gz", ALL(LAST(r"{{d}}/{{f}}"), AB(HOME + "/{{d}}")),
      ["`-t` lists (think: table of contents)."],
      "`tar -tf` lists; modern GNU tar detects the compression itself, so `-z` is optional when reading.",
      ["tar -xzf {{a}}.tar.gz", "cat {{a}}.tar.gz", "gunzip {{a}}.tar.gz"],
      setup={"files": [F("~/{{d}}/{{f}}", "x\n")], "run": ["tar -czf {{a}}.tar.gz {{d}}", "rm -r {{d}}"]}, cases=ARC),
])
skill("tar-x", "tar", "3.1", "Extract an archive", [
  tpl("Extract `{{a}}.tar.gz` into the current directory.", "tar -xzf {{a}}.tar.gz", EX(HOME + "/{{d}}/{{f}}", "file"),
      ["`-x` extracts."],
      "`tar -xzf` extracts a gzip-compressed archive. Add `-C DIR` to extract somewhere else.",
      ["tar -tzf {{a}}.tar.gz", "tar -czf {{a}}.tar.gz", "gunzip {{a}}.tar.gz"],
      setup={"files": [F("~/{{d}}/{{f}}", "x\n")], "run": ["tar -czf {{a}}.tar.gz {{d}}", "rm -r {{d}}"]}, cases=ARC),
  tpl("Extract `{{a}}.tar.gz` into the existing directory `/tmp/{{t}}` (not here).", "tar -xzf {{a}}.tar.gz -C /tmp/{{t}}",
      ALL(EX("/tmp/{{t}}/{{d}}/{{f}}"), AB(HOME + "/{{d}}")),
      ["One tar option changes the directory before extracting.", "`-C DIR`"],
      "`-C` makes tar change into that directory first, so you don't have to `cd` there and back.",
      ["tar -xzf {{a}}.tar.gz", "tar -xzf {{a}}.tar.gz /tmp/{{t}}"],
      setup={"files": [F("~/{{d}}/{{f}}", "x\n"), D("/tmp/{{t}}")], "run": ["tar -czf {{a}}.tar.gz {{d}}", "rm -r {{d}}"]},
      cases=[dict(c, t=t) for c, t in zip(ARC, ["restore", "out", "unpack", "check", "new", "test"])]),
])
for sid, prog, ext, unprog, label in [("gzip", "gzip", "gz", "gunzip", "gzip"), ("bzip2", "bzip2", "bz2", "bunzip2", "bzip2"), ("xz", "xz", "xz", "unxz", "xz")]:
    skill(sid, prog, "3.1", "Compress and decompress with " + label, [
      tpl("Compress `{{f}}` with %s." % label, "%s {{f}}" % prog, ALL(compressed(HOME + "/{{f}}.%s" % ext, prog), AB(HOME + "/{{f}}")),
          ["The command has the same name as the format."],
          "`%s` replaces the file with `{{f}}.%s`. Add `-k` to keep the original too." % (prog, ext),
          ["tar -cf {{f}}.%s {{f}}" % ext, "%s {{f}}" % unprog],
          setup={"files": [F("~/{{f}}", "some text\n" * 20)]}, vars={"f": FILES}),
      tpl("Decompress `{{f}}.%s` back to `{{f}}`." % ext, "%s {{f}}.%s" % (unprog, ext), ALL(EX(HOME + "/{{f}}"), AB(HOME + "/{{f}}.%s" % ext)),
          ["Each compressor has an `un...` partner (or a `-d` option)."],
          "`%s FILE` is the same as `%s -d FILE`." % (unprog, prog),
          ["%s {{f}}.%s" % (prog, ext), "tar -xf {{f}}.%s" % ext],
          setup={"files": [F("~/{{f}}", "some text\n" * 20)], "run": ["%s {{f}}" % prog]}, vars={"f": FILES}),
    ])
skill("zcat", "zcat", "3.1", "Read a compressed file", [
  tpl("Print the text inside `{{f}}.gz` without decompressing the file on disk.", "zcat {{f}}.gz", ALL(out_is("{{w}}\n"), EX(HOME + "/{{f}}.gz")),
      ["There's a `cat` for gzip files."],
      "`zcat`, `bzcat` and `xzcat` print compressed files directly. `zless` pages through them.",
      ["cat {{f}}.gz", "gunzip {{f}}.gz"],
      setup={"files": [F("~/{{f}}", "{{w}}\n")], "run": ["gzip {{f}}"]}, cases=[{"f": f, "w": w} for f, w in zip(FILES, WORDS)]),
])
skill("zip", "zip", "3.1", "Zip and unzip", [
  tpl("Create a zip archive `{{a}}.zip` containing the directory `{{d}}` and everything in it.", "zip -r {{a}}.zip {{d}}", archive(HOME + "/{{a}}.zip", None, fmt="zip", has=["{{d}}/{{f}}"]),
      ["`zip ARCHIVE FILES`", "Directories need `-r`."],
      "Without `-r`, zip stores only the empty directory. Zip files compress each file separately and open everywhere, Windows included.",
      ["zip {{a}}.zip {{d}}", "tar -czf {{a}}.zip {{d}}"],
      setup={"files": [F("~/{{d}}/{{f}}", "x\n")]}, cases=ARC),
  tpl("Extract `{{a}}.zip` here.", "unzip {{a}}.zip", EX(HOME + "/{{d}}/{{f}}", "file"),
      ["The opposite of `zip`."],
      "`unzip -l` lists the contents without extracting.",
      ["unzip -l {{a}}.zip", "gunzip {{a}}.zip"],
      setup={"files": [F("~/{{d}}/{{f}}", "x\n")], "run": ["zip -r {{a}}.zip {{d}}", "rm -r {{d}}"]}, cases=ARC),
])

# =====================================================================================================================
# 3.2 Searching and extracting data from files
# =====================================================================================================================
def text_case(r, n=8):
    words = r.sample(WORDS, 6)
    lines = [r.choice(words) + " " + r.choice(["ok", "late", "done", "new", "sold", "kept"]) for _ in range(n)]
    return words, lines


def grep_case(r, i, flags=""):
    words, lines = text_case(r)
    w = r.choice([x.split()[0] for x in lines])
    f = r.choice(FILES)
    hit = [l for l in lines if re.search(w, l, re.I if "i" in flags else 0)]
    return {"f": f, "w": w, "data": "\n".join(lines) + "\n", "lines": lines, "hit": hit}


GREP = cases(6, 61, lambda r, i: grep_case(r, i))
for c in GREP:
    c["out"] = rx("\n".join(c["hit"]) + "\n")
    c["inv"] = rx("\n".join(l for l in c["lines"] if c["w"] not in l) + "\n")
    c["cnt"] = str(len(c["hit"]))
    c["nlines"] = str(len(c["lines"]))
    c["first"] = c["hit"][0]
for c in GREP:
    del c["lines"], c["hit"]
skill("grep", "grep", "3.2", "Search lines in a file", [
  tpl("Show only the lines of `{{f}}` that contain `{{w}}`.", "grep {{w}} {{f}}", LAST("^{{out}}$"),
      ["`grep PATTERN FILE`"],
      "`grep` prints every line that matches. Its name comes from the ed command g/re/p: globally search a regular expression and print.",
      ["cat {{f}}", "grep -v {{w}} {{f}}", "grep -c {{w}} {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=GREP),
])
skill("grep-v", "grep", "3.2", "Lines that don't match", [
  tpl("Show the lines of `{{f}}` that do **not** contain `{{w}}`.", "grep -v {{w}} {{f}}", LAST("^{{inv}}$"),
      ["One grep option inverts the match."],
      "`grep -v` is often used to filter out noise, like comments: `grep -v '^#' file`.",
      ["grep {{w}} {{f}}", "grep -c {{w}} {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=GREP),
])
skill("grep-c", "grep", "3.2", "Count matching lines", [
  tpl("How many lines of `{{f}}` contain `{{w}}`? Let grep count them.", "grep -c {{w}} {{f}}", out_is("{{cnt}}\n"),
      ["grep can print a count instead of the lines."],
      "`grep -c` counts matching lines, not matches. `grep {{w}} {{f}} | wc -l` gives the same number.",
      ["grep {{w}} {{f}}", "wc -l {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=GREP),
])
skill("grep-i", "grep", "3.2", "Search ignoring case", [
  tpl("Show the lines of `{{f}}` that contain `error`, whether it's written `error`, `Error` or `ERROR`.", "grep -i error {{f}}",
      ALL(LAST(r"Error: {{a}}"), LAST(r"ERROR {{b}}"), LAST(r"error {{c}}"), NOT(LAST(r"info"))),
      ["grep is case-sensitive by default."],
      "`-i` ignores case. `grep -in` adds line numbers, which helps when opening the file in an editor.",
      ["grep error {{f}}", "grep Error {{f}}"],
      setup={"files": [F("~/{{f}}", "info start\nError: {{a}}\ninfo ok\nERROR {{b}}\nerror {{c}}\n")]},
      cases=cases(5, 62, lambda r, i: dict(zip(("a", "b", "c"), r.sample(["disk full", "timeout", "no route", "bad login", "crash", "denied"], 3)), f=r.choice(["app.log", "server.log", "boot.log"])))),
])
skill("grep-n", "grep", "3.2", "Show line numbers", [
  tpl("Show the lines of `{{f}}` that contain `{{w}}`, each with its line number in front.", "grep -n {{w}} {{f}}", ALL(LAST(r"^\d+:{{first}}"), NOT(LAST(r"^[^\d]"))),
      ["One grep option adds line numbers."],
      "`grep -n` prints `NUMBER:line`. `cat -n` numbers every line of a file.",
      ["grep {{w}} {{f}}", "cat -n {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=GREP),
])
skill("grep-r", "grep", "3.2", "Search a whole directory", [
  tpl("Find which files under `~/{{d}}` (and its subdirectories) contain the word `{{w}}`.", "grep -r {{w}} ~/{{d}}",
      ALL(LAST(r"{{d}}/a\.conf:"), LAST(r"{{d}}/sub/b\.conf:"), NOT(LAST(r"c\.conf"))),
      ["grep can search through directories.", "`-r` (recursive)."],
      "`grep -r` prints `FILE:line` for each hit; `grep -rl` prints only the file names.",
      ["grep {{w}} ~/{{d}}", "find ~/{{d}} -name {{w}}"],
      setup={"files": [F("~/{{d}}/a.conf", "port=80\n{{w}}=yes\n"), F("~/{{d}}/sub/b.conf", "{{w}}=no\n"), F("~/{{d}}/sub/c.conf", "other=1\n")]},
      cases=cases(5, 63, lambda r, i: {"d": r.choice(DIRS), "w": r.choice(["timeout", "verbose", "listen", "proxy", "cache"])})),
])
skill("grep-anchor", "grep", "3.2", "Regular expressions: ^ and $", [
  tpl("Show only the lines of `{{f}}` that **start** with `{{w}}`.", "grep '^{{w}}' {{f}}", out_is("{{w}} first\n{{w}} again\n"),
      ["In a regular expression, `^` means the start of the line.", "Quote the pattern."],
      "`^` anchors the start and `$` the end: `grep '^$'` finds empty lines and `grep 'sh$'` lines ending in sh.",
      ["grep {{w}} {{f}}", "grep '{{w}}$' {{f}}"],
      setup={"files": [F("~/{{f}}", "{{w}} first\nnot {{w}}\n{{w}} again\nlast {{w}}\n")]}, cases=[{"f": f, "w": w} for f, w in zip(FILES, WORDS)]),
  tpl("Show only the lines of `{{f}}` that **end** with `{{w}}`.", "grep '{{w}}$' {{f}}", out_is("not {{w}}\nlast {{w}}\n"),
      ["In a regular expression, `$` means the end of the line."],
      "`$` anchors the end of the line. Single quotes stop the shell from treating `$` as a variable.",
      ["grep {{w}} {{f}}", "grep '^{{w}}' {{f}}"],
      setup={"files": [F("~/{{f}}", "{{w}} first\nnot {{w}}\n{{w}} again\nlast {{w}}\n")]}, cases=[{"f": f, "w": w} for f, w in zip(FILES, WORDS)]),
])
skill("grep-ere", "grep", "3.2", "Extended regex: either word", [
  tpl("Show the lines of `{{f}}` that contain either `{{a}}` or `{{b}}`, with one grep.", "grep -E '{{a}}|{{b}}' {{f}}", out_is("{{a}} 1\n{{b}} 2\n{{a}} {{b}}\n"),
      ["Extended regular expressions have `|` for 'or'.", "`grep -E 'one|two'` (or `egrep`)."],
      "In basic regex you'd write `\\|`; `-E` turns on extended syntax where `|`, `+`, `?` and `()` work without backslashes.",
      ["grep {{a}} {{f}}", "grep '{{a}}|{{b}}' {{f}}"],
      setup={"files": [F("~/{{f}}", "{{a}} 1\n{{b}} 2\nnone\n{{a}} {{b}}\n")]}, cases=cases(6, 64, lambda r, i: dict(zip(("a", "b"), two(r, WORDS)), f=r.choice(FILES)))),
])
skill("wc-l", "wc", "3.2", "Count lines", [
  tpl("Count the lines in `{{f}}`.", "wc -l {{f}}", LAST(r"^\s*{{nlines}}( |\n)"),
      ["`wc` counts lines, words and characters.", "`-l` for lines only."],
      "`wc -l < {{f}}` prints just the number, without the file name.",
      ["wc -w {{f}}", "cat -n {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=[dict(c) for c in GREP]),
])
SORTS = cases(6, 65, lambda r, i: {"f": r.choice(["sizes.txt", "scores.txt", "ports.txt", "ids.txt"]), "nums": r.sample([3, 9, 12, 25, 40, 100, 7, 1000, 64], 6)})
for c in SORTS:
    n = c.pop("nums"); c["data"] = "\n".join(map(str, n)) + "\n"
    c["num"] = rx("\n".join(map(str, sorted(n))) + "\n"); c["rnum"] = rx("\n".join(map(str, sorted(n, reverse=True))) + "\n")
    c["alpha"] = rx("\n".join(sorted(map(str, n))) + "\n")
skill("sort-n", "sort", "3.2", "Sort numbers", [
  tpl("Sort the numbers in `{{f}}` from smallest to largest.", "sort -n {{f}}", LAST("^{{num}}$"),
      ["Plain `sort` compares text, so 100 comes before 25.", "`-n` sorts numerically."],
      "Text order puts `1000` before `25` because it compares character by character. `-n` compares the values.",
      ["sort {{f}}", "sort -r {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=SORTS),
  tpl("Sort the numbers in `{{f}}` from largest to smallest.", "sort -rn {{f}}", LAST("^{{rnum}}$"),
      ["Combine numeric sorting with reverse order."],
      "`sort -rn` is half of the classic 'top N' pipeline: `... | sort -rn | head -5`.",
      ["sort -r {{f}}", "sort -n {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=SORTS),
])
UNIQ = cases(5, 66, lambda r, i: {"f": r.choice(["visitors.txt", "hosts.txt", "logins.txt"]), "names": [r.choice(USERS[:4]) for _ in range(9)]})
for c in UNIQ:
    n = c.pop("names"); c["data"] = "\n".join(n) + "\n"
    from collections import Counter
    cnt = Counter(n)
    c["counted"] = "".join(r"\s*%d %s\n" % (cnt[k], k) for k in sorted(cnt))
skill("uniq-c", "uniq", "3.2", "Count repeated lines", [
  tpl("`{{f}}` lists names, with repeats in random order. Show each name once with how many times it appears.", "sort {{f}} | uniq -c", LAST("^{{counted}}$"),
      ["`uniq` only merges **adjacent** repeats, so sort first.", "`uniq -c` adds a count."],
      "`sort | uniq -c | sort -rn` lists the most common lines first, one of the most useful pipelines for logs.",
      ["uniq -c {{f}}", "sort {{f}} | uniq", "sort -u {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=UNIQ),
])
HT = cases(6, 67, lambda r, i: {"f": r.choice(["app.log", "access.log", "events.log"]), "n": r.choice([2, 3, 4, 5])})
for c in HT:
    lines = ["line %02d %s" % (k, r) for k, r in zip(range(1, 13), itertools.cycle(WORDS))]
    c["data"] = "\n".join(lines) + "\n"; c["head"] = rx("\n".join(lines[:c["n"]]) + "\n"); c["tail"] = rx("\n".join(lines[-c["n"]:]) + "\n"); c["n"] = str(c["n"])
skill("head-tail", "head/tail", "3.2", "First or last lines", [
  tpl("Show only the first {{n}} lines of `{{f}}`.", "head -n {{n}} {{f}}", LAST("^{{head}}$"),
      ["`head` shows the start of a file (10 lines by default).", "`-n NUMBER`"],
      "`head -{{n}}` is a short form of `head -n {{n}}`.",
      ["head {{f}}", "tail -n {{n}} {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=HT),
  tpl("Show only the last {{n}} lines of `{{f}}`.", "tail -n {{n}} {{f}}", LAST("^{{tail}}$"),
      ["`tail` shows the end of a file.", "`-n NUMBER`"],
      "`tail -f` keeps the file open and prints new lines as they're written: the standard way to watch a log.",
      ["tail {{f}}", "head -n {{n}} {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=HT),
])
CUT = cases(6, 68, lambda r, i: {"f": r.choice(["staff.csv", "users.csv", "team.csv"]), "rows": [(u, r.choice(GROUPS), str(r.randint(20, 60))) for u in r.sample(USERS, 4)], "k": r.choice([1, 2, 3])})
for c in CUT:
    rows = c.pop("rows"); c["data"] = "".join(",".join(x) + "\n" for x in rows)
    c["out"] = rx("".join(x[c["k"] - 1] + "\n" for x in rows)); c["field"] = ["first", "second", "third"][c["k"] - 1]; c["k"] = str(c["k"])
skill("cut", "cut", "3.2", "Cut a column", [
  tpl("`{{f}}` has comma-separated columns. Print only the {{field}} column.", "cut -d, -f{{k}} {{f}}", LAST("^{{out}}$"),
      ["`cut -d` sets the delimiter and `-f` picks the field number."],
      "`cut -d: -f1 /etc/passwd` prints every user name the same way.",
      ["cut -f{{k}} {{f}}", "cut -d, {{f}}"],
      setup={"files": [F("~/{{f}}", "{{data}}")]}, cases=CUT),
])
skill("tr", "tr", "3.2", "Translate characters", [
  tpl("Print the contents of `{{f}}` in UPPER CASE.", "tr a-z A-Z < {{f}}", out_is("{{W}}\n"),
      ["`tr` reads standard input only, so feed it the file with `<` or a pipe.", "`tr a-z A-Z`"],
      "`tr` swaps characters one for one. `tr -d` deletes them and `tr -s ' '` squeezes repeated spaces.",
      ["tr a-z A-Z {{f}}", "tr A-Z a-z < {{f}}"],
      setup={"files": [F("~/{{f}}", "{{w}}\n")]}, cases=[{"f": f, "w": w + " list", "W": (w + " list").upper()} for f, w in zip(FILES, WORDS)]),
])
skill("sed", "sed", "3.2", "Search and replace with sed", [
  tpl("Print `{{f}}` with every `{{a}}` replaced by `{{b}}` (don't change the file).", "sed 's/{{a}}/{{b}}/g' {{f}}", ALL(out_is("{{b}} and {{b}}\nno change\n"), HAS(HOME + "/{{f}}", "{{a}}")),
      ["`sed 's/OLD/NEW/'` substitutes.", "Add `g` at the end to replace every match on a line, not just the first."],
      "Without `g`, sed replaces only the first match on each line. Without `-i`, the file stays as it was.",
      ["sed 's/{{a}}/{{b}}/' {{f}}", "sed -i 's/{{a}}/{{b}}/g' {{f}}"],
      setup={"files": [F("~/{{f}}", "{{a}} and {{a}}\nno change\n")]}, cases=cases(6, 69, lambda r, i: dict(zip(("a", "b"), two(r, WORDS)), f=r.choice(FILES)))),
  tpl("Change the file `{{f}}` itself so every `{{a}}` becomes `{{b}}`.", "sed -i 's/{{a}}/{{b}}/g' {{f}}", EQ(HOME + "/{{f}}", "{{b}}={{b}}\nkeep\n"),
      ["sed normally prints the result and leaves the file alone.", "`-i` edits in place."],
      "`sed -i` rewrites the file. `sed -i.bak` keeps a backup copy first.",
      ["sed 's/{{a}}/{{b}}/g' {{f}}", "sed -i 's/{{a}}/{{b}}/' {{f}}"],
      setup={"files": [F("~/{{f}}", "{{a}}={{a}}\nkeep\n")]}, cases=cases(6, 70, lambda r, i: dict(zip(("a", "b"), two(r, WORDS)), f=r.choice(FILES)))),
])
skill("redirect-out", "redirection", "3.2", "Save output to a file", [
  tpl("Save the list of files in `{{p}}` into `~/{{f}}` (the file doesn't exist yet).", "ls {{p}} > ~/{{f}}", HAS(HOME + "/{{f}}", "{{item}}\n"),
      ["`>` sends a command's output into a file."],
      "`>` creates the file, or empties it first if it exists. `>>` adds to the end instead.",
      ["ls {{p}}", "echo ls {{p}} > ~/{{f}}", "ls {{p}} < ~/{{f}}"],
      cases=[{"p": p, "item": i, "f": f} for (p, i), f in zip([("/etc", "hostname"), ("/etc/ssh", "sshd_config"), ("/var/log", "syslog"), ("/boot", "grub"), ("/usr/share/doc", "bash")], FILES)]),
])
skill("redirect-append", "redirection", "3.2", "Append to a file", [
  tpl("Add the line `{{w}}` to the end of `{{f}}` without losing what's already in it.", "echo {{w}} >> {{f}}", ALL(HAS(HOME + "/{{f}}", "first line\n"), HAS(HOME + "/{{f}}", "{{w}}\n")),
      ["`>` would empty the file first.", "Two arrows append."],
      "`>>` appends. A mistaken `>` can wipe a file; `set -o noclobber` makes bash refuse to overwrite with `>`.",
      ["echo {{w}} > {{f}}", "echo {{w}} | {{f}}"],
      setup={"files": [F("~/{{f}}", "first line\n")]}, cases=[{"f": f, "w": w} for f, w in zip(FILES, WORDS)]),
])
skill("redirect-err", "redirection", "3.2", "Redirect error messages", [
  tpl("Run `ls ~/{{f}} ~/{{missing}}` and save **only the error message** in `~/err.txt`.", "ls ~/{{f}} ~/{{missing}} 2> ~/err.txt",
      ALL(HAS(HOME + "/err.txt", "No such file or directory"), NOT(HAS(HOME + "/err.txt", "/{{f}}\n"))),
      ["Errors go to standard error, stream number 2.", "`2>` redirects just that stream."],
      "`>` only catches standard output (1); errors (2) still reach the screen. `2>/dev/null` throws them away.",
      ["ls ~/{{f}} ~/{{missing}} > ~/err.txt", "ls ~/{{f}} ~/{{missing}} &> ~/err.txt"],
      setup={"files": [F("~/{{f}}")]}, cases=cases(6, 71, lambda r, i: dict(zip(("f", "missing"), two(r, FILES))))),
  tpl("Run `ls ~/{{f}} ~/{{missing}}` so that **both** the normal output and the error end up in `~/all.txt`.", "ls ~/{{f}} ~/{{missing}} > ~/all.txt 2>&1",
      ALL(HAS(HOME + "/all.txt", "No such file or directory"), HAS(HOME + "/all.txt", "/{{f}}\n")),
      ["Send standard output to the file, then make stream 2 go where stream 1 goes.", "`> file 2>&1` (or `&> file` in bash)."],
      "Order matters: `2>&1 > file` would point errors at the screen before output is moved to the file.",
      ["ls ~/{{f}} ~/{{missing}} > ~/all.txt", "ls ~/{{f}} ~/{{missing}} 2> ~/all.txt"],
      setup={"files": [F("~/{{f}}")]}, cases=cases(6, 72, lambda r, i: dict(zip(("f", "missing"), two(r, FILES))))),
])
skill("pipe", "pipes", "3.2", "Pipes", [
  tpl("Count how many entries `ls /etc` prints, using a pipe.", "ls /etc | wc -l", ALL(LAST(r"^\s*\d+\n$"), H(r"\|")),
      ["`|` sends one command's output into the next command.", "`wc -l` counts lines."],
      "A pipe connects stdout of the left command to stdin of the right one; no temporary file needed.",
      ["ls /etc > wc", "wc -l /etc"]),
])
skill("tee", "tee", "3.2", "Show and save at the same time", [
  tpl("Show the output of `ls {{p}}` on screen **and** save it into `~/{{f}}`, in one command line.", "ls {{p}} | tee ~/{{f}}", ALL(LAST(r"{{item}}"), HAS(HOME + "/{{f}}", "{{item}}\n")),
      ["`>` would hide the output from the screen.", "Pipe into `tee FILE`."],
      "`tee` copies its input to the screen and to files, like a T-junction in a pipe. `tee -a` appends.",
      ["ls {{p}} > ~/{{f}}", "ls {{p}} | ~/{{f}}"],
      cases=[{"p": p, "item": i, "f": f} for (p, i), f in zip([("/etc", "hostname"), ("/etc/ssh", "sshd_config"), ("/var/log", "syslog"), ("/boot", "grub")], FILES)]),
])

# =====================================================================================================================
# 3.3 Turning commands into a script
# =====================================================================================================================
SCRIPTS = [{"s": s, "w": w} for s, w in zip(["hello.sh", "backup.sh", "check.sh", "greet.sh", "report.sh", "start.sh"], WORDS)]
skill("chmod-x-run", "chmod", "3.3", "Make a script executable and run it", [
  tpl("`{{s}}` is a script without execute permission. Make it executable for its owner, then run it from this directory.", "chmod u+x {{s}}\n./{{s}}",
      ALL(MODE(HOME + "/{{s}}", "744"), out_is("{{w}}\n")),
      ["A script needs the `x` permission to run as a program.", "Run a program in the current directory with `./NAME`."],
      "The current directory isn't in `$PATH`, so a bare `{{s}}` isn't found: `./{{s}}` gives the path. `bash {{s}}` runs it without `x`.",
      ["./{{s}}", "chmod u+x {{s}}"],
      setup={"files": [F("~/{{s}}", "#!/bin/bash\necho {{w}}\n", mode=0o644)]}, cases=SCRIPTS),
])
skill("bash-script", "bash", "3.3", "Run a script with bash", [
  tpl("Run `{{s}}` without changing its permissions.", "bash {{s}}", ALL(out_is("{{w}}\n"), MODE(HOME + "/{{s}}", "644")),
      ["You can hand a script to the interpreter yourself."],
      "`bash FILE` only needs read permission, because bash reads the file; `./FILE` needs execute permission.",
      ["./{{s}}", "{{s}}"],
      setup={"files": [F("~/{{s}}", "#!/bin/bash\necho {{w}}\n", mode=0o644)]}, cases=SCRIPTS),
])
skill("shebang", "bash", "3.3", "Write a script with a shebang", [
  tpl("Write an executable script `~/{{s}}` that starts with the bash shebang line and prints `{{w}}`. (One way: `printf` into the file, or `nano`.)",
      "printf '#!/bin/bash\\necho {{w}}\\n' > {{s}}\nchmod +x {{s}}",
      ALL(HAS(HOME + "/{{s}}", regex=r"^#!/(usr/)?bin/(env )?bash\n"), script(HOME + "/{{s}}", "{{w}}\n")),
      ["The first line must be `#!/bin/bash`.", "Then make it executable with `chmod +x`."],
      "The shebang tells the kernel which interpreter to run. `printf` understands `\\n`, so it writes several lines in one go.",
      ["echo 'echo {{w}}' > {{s}}"],
      cases=SCRIPTS),
])
skill("exit-status", "$?", "3.3", "Exit status", [
  tpl("Run `ls ~/{{missing}}` (it fails), then print its exit status.", "ls ~/{{missing}}\necho $?", ALL(out_is("2\n"), H(r"echo\s+\$\?")),
      ["Every command leaves a number behind: 0 means success.", "`$?` holds the exit status of the last command."],
      "`ls` exits with 2 for a missing file. Scripts test this with `if`, `&&` and `||`.",
      ["echo ?", "echo $0"],
      vars={"missing": ["nofile", "ghost.txt", "missing.log", "nothing"]}),
])
skill("test-file", "test", "3.3", "Test whether a file exists", [
  tpl("Using `test` or `[ ]`, print `yes` only if `{{p}}` exists as a regular file.", "[ -f {{p}} ] && echo yes", ALL(out_is("yes\n"), H(r"(\[|test)\s+-[ef]\s+{{p}}")),
      ["`[ -f FILE ]` is true for an existing regular file.", "Join it to `echo yes` with `&&`."],
      "`&&` runs the second command only if the first succeeded. `-d` tests for a directory, `-e` for anything.",
      ["echo yes", "[ -d {{p}} ] && echo yes"],
      cases=[{"p": p} for p in ["/etc/hostname", "/etc/passwd", "/etc/hosts", "/etc/fstab"]]),
])
skill("for-loop", "for", "3.3", "for loops", [
  tpl("Use a `for` loop to create the directories `{{a}}`, `{{b}}` and `{{c}}`.", "for d in {{a}} {{b}} {{c}}; do mkdir $d; done",
      ALL(EX(HOME + "/{{a}}", "dir"), EX(HOME + "/{{c}}", "dir"), H(r"\bfor\b.*\bdo\b.*\bdone\b")),
      ["`for VAR in LIST; do COMMANDS; done`", "Use `$d` inside the loop."],
      "The loop body runs once per word. `mkdir {{a}} {{b}} {{c}}` would also work; loops pay off when each step does more.",
      ["mkdir {{a}} {{b}} {{c}}"],
      cases=cases(5, 81, lambda r, i: dict(zip(("a", "b", "c"), r.sample(["mon", "tue", "wed", "thu", "fri", "jan", "feb", "mar"], 3))))),
])
skill("path-add", "PATH", "3.3", "Add a directory to PATH", [
  tpl("Add `~/{{d}}` to the **end** of your `PATH`, keeping everything already in it.", "PATH=$PATH:~/{{d}}", VAR("PATH", regex=r"^/usr/local/sbin:.*:/usr/bin:.*:/home/student/{{d}}$"),
      ["Build the new value from the old one: `$PATH`.", "Directories in PATH are separated by `:`."],
      "`PATH=~/{{d}}` alone would replace the search path and almost every command would stop working. Put it in `~/.bashrc` to keep it.",
      ["PATH=~/{{d}}", "PATH=$PATH ~/{{d}}", "PATH=$PATH;~/{{d}}"],
      vars={"d": ["bin", "scripts", "tools", "apps"]}),
])

# =====================================================================================================================
# 4.1 - 4.4 The Linux operating system
# =====================================================================================================================
skill("uname", "uname", "4.1", "Kernel and system info", [
  tpl("Print only the release number of the running kernel.", "uname -r", out_is("6.8.0-45-generic\n"),
      ["`uname` prints system information; each part has its own option.", "`-r` is the kernel release."],
      "`uname -a` prints everything at once; `-m` shows the hardware architecture (x86_64).",
      ["uname", "uname -m", "hostname"]),
  tpl("Print only the machine's hardware architecture (like x86_64 or aarch64).", "uname -m", out_is("x86_64\n"),
      ["`uname` again, with the option for the machine hardware name."],
      "x86_64 is 64-bit Intel/AMD; aarch64 is 64-bit ARM, used by Raspberry Pi and many phones.",
      ["uname -r", "uname"]),
])
skill("os-release", "cat", "4.1", "Which distribution is this?", [
  tpl("Show which Linux distribution and version this is by reading its standard release file in `/etc`.", "cat /etc/os-release", LAST(r"PRETTY_NAME="),
      ["Most distributions describe themselves in a file called `os-release`."],
      "`/etc/os-release` is standard on every modern distribution; scripts source it to read `ID` and `VERSION_ID`.",
      ["uname -a", "cat /etc/hostname"]),
])
skill("free", "free", "4.2", "Memory usage", [
  tpl("Show how much memory (RAM) and swap is used and free, in human-readable units.", "free -h", ALL(LAST(r"Mem:.*Gi"), LAST(r"Swap:")),
      ["The command's name is what you want to know: how much is free.", "`-h` for human-readable."],
      "Linux uses spare RAM as disk cache, so look at the `available` column, not `free`.",
      ["free", "top", "df -h"]),
])
skill("lscpu", "lscpu", "4.2", "CPU details", [
  tpl("Show the CPU model and how many cores the processor has.", "lscpu", LAST(r"Model name:"),
      ["`ls` + the thing you want to list."],
      "`lscpu` summarises `/proc/cpuinfo`. `lsblk` lists block devices (disks) the same way.",
      ["uname -m", "cat /proc/meminfo"]),
])
skill("lsblk", "lsblk", "4.2", "List disks and partitions", [
  tpl("List the block devices (disks and their partitions) as a tree.", "lsblk", ALL(LAST(r"sda\s.*\sdisk"), LAST(r"sda1\s.*\spart")),
      ["`ls` + blk (block devices)."],
      "Disks are /dev/sda, /dev/nvme0n1 or /dev/mmcblk0; partitions add a number (sda1).",
      ["ls /dev", "df -h", "lscpu"]),
])
PROCS = cases(5, 91, lambda r, i: {"p": r.choice(["sleep", "backupd", "yes", "watcher", "hog"]), "pid": r.randint(3000, 3999)})
skill("kill", "kill", "4.3", "Stop a process by its PID", [
  tpl("A process called `{{p}}` is running as you. Find its PID and stop it with `kill`.", "ps aux | grep {{p}}\nkill {{pid}}", noproc("{{p}}"),
      ["`ps aux` lists every process with its PID in the second column.", "`kill PID` asks it to stop."],
      "`kill` sends SIGTERM (15) by default; `kill -9 PID` forces it. `pgrep {{p}}` prints the PID directly.",
      ["kill {{p}}", "ps aux | grep {{p}}"],
      setup={"procs": [{"pid": "{{pid}}", "cmd": "{{p}}", "user": "student", "tty": "pts/0", "stat": "S"}]}, cases=PROCS),
])
skill("ps-user", "ps", "4.3", "Processes of one user", [
  tpl("List only the processes that belong to the user `www-data`.", "ps -u www-data", ALL(LAST(r"nginx"), NOT(LAST(r"sshd"))),
      ["`ps` takes `-u USER`."],
      "`ps aux` shows everyone's processes; `ps -u NAME` narrows it to one user. `top -u NAME` does the same live.",
      ["ps", "ps aux", "who"]),
])
skill("dirs-fhs", "ls", "4.3", "Where things live (FHS)", [
  tpl("List the directory where the **{{what}}** are kept.", "ls {{p}}", ALL(LAST(r"{{item}}"), H(r"^\s*ls\b.*\s{{pr}}/?\s*$")),
      ["The Filesystem Hierarchy Standard decides where things go.", "{{hint}}"],
      "{{why}}",
      ["ls /", "ls /tmp"],
      cases=[{"what": "system-wide configuration files", "p": "/etc", "pr": rx("/etc"), "item": "passwd", "hint": "Three letters, right under `/`.", "why": "`/etc` holds configuration: users, network, services."},
             {"what": "log files", "p": "/var/log", "pr": rx("/var/log"), "item": "syslog", "hint": "Variable data lives in `/var`.", "why": "`/var/log` holds logs that grow while the system runs; `/var` is for data that changes."},
             {"what": "kernel and boot loader files", "p": "/boot", "pr": rx("/boot"), "item": "vmlinuz", "hint": "Needed to boot the system.", "why": "`/boot` holds the kernel (vmlinuz), the initial RAM disk and the GRUB configuration."},
             {"what": "device files", "p": "/dev", "pr": rx("/dev"), "item": "sda", "hint": "Short for devices.", "why": "`/dev` holds device files such as /dev/sda (a disk) and /dev/null."}]),
])
skill("tail-log", "tail", "4.3", "Read the end of a log", [
  tpl("Show the last {{n}} lines of the system log `/var/log/syslog`.", "tail -n {{n}} /var/log/syslog", LAST("^{{out}}$"),
      ["Logs grow at the end, so read the tail.", "`tail -n NUMBER FILE`"],
      "Your user is in the `adm` group, which may read most logs. On systemd systems `journalctl -n {{n}}` shows the same from the journal.",
      ["head -n {{n}} /var/log/syslog", "cat /var/log/syslog"],
      cases=[{"n": "1", "out": rx("Oct 10 09:12:45 lab kernel: sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks\n")},
             {"n": "2", "out": rx("Oct 10 09:12:44 lab kernel: usb 1-1: new high-speed USB device number 3\nOct 10 09:12:45 lab kernel: sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks\n")}]),
])
skill("ip-addr", "ip", "4.4", "Show IP addresses", [
  tpl("Show the IP addresses of the network interface `enp0s3`.", "ip addr show enp0s3", ALL(LAST(r"inet 192\.168\.1\.42/24"), NOT(LAST(r"127\.0\.0\.1"))),
      ["The `ip` command has objects: `addr`, `link`, `route`.", "`ip addr show DEVICE`"],
      "`ip a` is short for `ip addr`. The old `ifconfig` isn't installed on many current systems.",
      ["ip addr", "ip route", "hostname"]),
])
skill("ip-route", "ip", "4.4", "Show the default gateway", [
  tpl("Show the routing table, including the default gateway.", "ip route", LAST(r"default via 192\.168\.1\.1"),
      ["`ip` again, with the object for routes."],
      "`default via 192.168.1.1` means anything not on the local network goes to that router. `ip r` is short for `ip route`.",
      ["ip addr", "cat /etc/resolv.conf"]),
])
skill("ping", "ping", "4.4", "Test reachability", [
  tpl("Send exactly {{n}} pings to `{{h}}`, then stop.", "ping -c {{n}} {{h}}", LAST(r"{{n}} packets transmitted, {{n}} received"),
      ["On Linux `ping` runs until you press Ctrl+C.", "`-c COUNT` stops after that many."],
      "`ping` checks that a host answers. `ping6` (or `ping -6`) does the same over IPv6.",
      ["ping {{h}}", "host {{h}}"],
      cases=[{"n": str(n), "h": h} for n, h in [(2, "example.com"), (3, "192.168.1.1"), (5, "example.com"), (1, "192.168.1.1")]]),
])
skill("dns", "host", "4.4", "Look up a name in DNS", [
  tpl("Look up the IP address of `example.com` in DNS.", "host example.com", LAST(r"example\.com has address 93\.184\.215\.14"),
      ["`host NAME` asks the DNS servers."],
      "`dig example.com` shows the full DNS answer. The servers used are listed in `/etc/resolv.conf`.",
      ["ping example.com", "cat /etc/hosts"]),
  tpl("Show which DNS servers this computer is configured to use.", "cat /etc/resolv.conf", LAST(r"nameserver 1\.1\.1\.1"),
      ["The resolver configuration is a file in `/etc`.", "`/etc/resolv.conf`"],
      "Each `nameserver` line is a DNS server. `/etc/hosts` holds fixed names that are checked first.",
      ["cat /etc/hosts", "ip route"]),
])
skill("ss", "ss", "4.4", "Listening ports", [
  tpl("Show the TCP ports this machine is listening on, as numbers.", "ss -tln", ALL(LAST(r"LISTEN.*:22\s"), NOT(LAST(r"ESTAB")), H(r"-\w*l")),
      ["`ss` shows sockets. Options: `-t` TCP, `-l` listening, `-n` numbers instead of names."],
      "Port 22 is SSH and 80 is HTTP. `ss -tlnp` (as root) also shows which program owns each port.",
      ["ss", "ip addr", "ss -t"]),
])

# =====================================================================================================================
# 5.1 - 5.4 Security and file permissions
# =====================================================================================================================
skill("id", "id", "5.1", "Who am I and which groups?", [
  tpl("Show your user ID, group ID and every group you belong to, in one command.", "id", LAST(r"uid=1000\(student\) gid=1000\(student\) groups="),
      ["Two letters."],
      "`id NAME` shows another user; `groups` prints only the group names; `whoami` only the user name.",
      ["whoami", "groups", "who"]),
  tpl("Show which groups the user `{{u}}` belongs to.", "groups {{u}}", LAST(r"\b{{g}}\b"),
      ["`groups NAME` or `id NAME`."],
      "Group membership decides which shared files and directories {{u}} can use.",
      ["groups", "id"],
      setup={"groups": [{"name": "{{g}}", "gid": 2100}], "users": [{"name": "{{u}}", "groups": ["{{g}}"]}]},
      cases=cases(5, 101, lambda r, i: {"u": r.choice(USERS), "g": r.choice(GROUPS)})),
])
skill("useradd", "useradd", "5.2", "Create a user with a home directory", [
  tpl("Create the user `{{u}}` with a home directory.", "sudo useradd -m {{u}}", user("{{u}}", homeExists=True),
      ["Changing users needs root.", "`useradd` creates the home only with `-m`."],
      "On Debian and Ubuntu `useradd` doesn't create the home directory unless you add `-m` (Fedora does by default). The files from `/etc/skel` are copied in.",
      ["useradd -m {{u}}", "sudo useradd {{u}}", "sudo groupadd {{u}}"],
      vars={"u": USERS}),
])
skill("usermod-append", "usermod", "5.2", "Add a user to a group", [
  tpl("Add the existing user `{{u}}` to the group `{{g}}`, keeping the groups `{{u}}` is already in.", "sudo usermod -aG {{g}} {{u}}",
      ALL(group("{{g}}", members=["{{u}}"]), group("{{old}}", members=["{{u}}"])),
      ["`usermod -G` sets the supplementary groups.", "Add `-a` (append), or `-G` replaces the whole list."],
      "`usermod -G {{g}} {{u}}` would remove {{u}} from `{{old}}`. The change applies at {{u}}'s next login.",
      ["sudo usermod -G {{g}} {{u}}", "usermod -aG {{g}} {{u}}", "sudo usermod -g {{g}} {{u}}"],
      setup={"groups": [{"name": "{{g}}", "gid": 2100}, {"name": "{{old}}", "gid": 2101}], "users": [{"name": "{{u}}", "groups": ["{{old}}"]}]},
      cases=cases(6, 102, lambda r, i: dict(zip(("g", "old"), two(r, GROUPS)), u=r.choice(USERS)))),
])
skill("groupadd", "groupadd", "5.2", "Create a group", [
  tpl("Create a new group named `{{g}}`.", "sudo groupadd {{g}}", group("{{g}}"),
      ["`groupadd NAME`, as root."],
      "Groups are listed in `/etc/group`. Add members with `usermod -aG` or `groupmems -a`.",
      ["groupadd {{g}}", "sudo usermod -aG {{g}} student"],
      vars={"g": GROUPS}),
  tpl("Create the group `{{g}}` with the group ID `{{gid}}`.", "sudo groupadd -g {{gid}} {{g}}", group("{{g}}", gid="{{gid}}"),
      ["`groupadd` takes `-g GID`."],
      "Fixed GIDs keep shared files consistent across servers (NFS, backups).",
      ["sudo groupadd {{g}}", "sudo groupadd {{gid}} {{g}}"],
      cases=[{"g": g, "gid": gid} for g, gid in zip(GROUPS, [3001, 3050, 4200, 5000, 3333, 4100])]),
])
skill("userdel", "userdel", "5.2", "Delete a user and their home", [
  tpl("Delete the user `{{u}}` **and** their home directory.", "sudo userdel -r {{u}}", ALL(nouser("{{u}}"), AB("/home/{{u}}")),
      ["`userdel` leaves the home directory behind unless told otherwise.", "`-r` removes it too."],
      "Without `-r`, `/home/{{u}}` stays, owned by a number instead of a name.",
      ["sudo userdel {{u}}", "userdel -r {{u}}", "sudo rm -r /home/{{u}}"],
      setup={"users": [{"name": "{{u}}"}]}, vars={"u": USERS}),
])
skill("passwd", "passwd", "5.2", "Set another user's password", [
  tpl("Set a password for the user `{{u}}`.", "sudo passwd {{u}}", user("{{u}}", password="set"),
      ["`passwd` changes your own password; root can give a user name."],
      "Passwords are stored hashed in `/etc/shadow`, which only root can read. `/etc/passwd` holds an `x` instead.",
      ["passwd", "passwd {{u}}"],
      setup={"users": [{"name": "{{u}}"}], "run": ["sudo passwd -d {{u}}"]}, vars={"u": USERS}),
])
OCTAL = [("640", "-rw-r-----", "owner read/write, group read, others nothing"), ("600", "-rw-------", "owner read/write, nobody else anything"),
         ("644", "-rw-r--r--", "owner read/write, everyone else read"), ("750", "-rwxr-x---", "owner everything, group read and execute, others nothing"),
         ("755", "-rwxr-xr-x", "owner everything, everyone else read and execute"), ("700", "-rwx------", "owner everything, nobody else anything"),
         ("660", "-rw-rw----", "owner and group read/write, others nothing")]
skill("chmod-octal", "chmod", "5.3", "chmod with numbers", [
  tpl("Set the permissions of `{{f}}` to `{{perms}}` ({{words}}) using an octal number.", "chmod {{mode}} {{f}}", ALL(PERMS(HOME + "/{{f}}", "{{perms}}"), H(r"chmod\s+0?[0-7]{3}\s")),
      ["r = 4, w = 2, x = 1. Add them up for owner, group and others.", "{{perms}} is {{mode}}."],
      "Each digit is one class: owner, group, others. `{{mode}}` = {{words}}.",
      ["chmod {{wrong}} {{f}}", "chmod u=rw {{f}}"],
      setup={"files": [F("~/{{f}}", "x\n", mode=0o666)]},
      cases=[{"f": f, "mode": m, "perms": p, "words": w, "wrong": m[::-1] if m[::-1] != m else "777"} for f, (m, p, w) in zip(itertools.cycle(FILES), OCTAL)]),
])
SYM = [("u+x", "-rwxr--r--", "add execute for the owner", "0o644"), ("g+w", "-rw-rw-r--", "add write for the group", "0o644"),
       ("o-r", "-rw-r-----", "take read away from others", "0o644"), ("go-rwx", "-rw-------", "take every permission away from group and others", "0o644"),
       ("a+x", "-rwxr-xr-x", "add execute for everyone", "0o644"), ("u-w", "-r--r--r--", "take write away from the owner", "0o644")]
skill("chmod-sym", "chmod", "5.3", "chmod with letters", [
  tpl("Change `{{f}}` with symbolic notation: {{words}}. Leave the other permissions alone.", "chmod {{spec}} {{f}}", ALL(PERMS(HOME + "/{{f}}", "{{perms}}"), H(r"chmod\s+[ugoa]*[-+=]")),
      ["Who: u, g, o or a. Then + to add, - to remove. Then r, w or x.", "For this task: `{{spec}}`."],
      "Symbolic modes change only what you name. `=` sets exactly: `chmod g=r` gives the group read and nothing else.",
      ["chmod 777 {{f}}", "chmod {{spec}}"],
      setup={"files": [F("~/{{f}}", "x\n", mode=0o644)]},
      cases=[{"f": f, "spec": s, "perms": p, "words": w} for f, (s, p, w, _m) in zip(itertools.cycle(FILES), SYM)]),
])
skill("chmod-recursive", "chmod", "5.3", "chmod a whole tree", [
  tpl("Give the group write permission on `{{d}}` and **everything inside it**.", "chmod -R g+w {{d}}",
      ALL(PERMS(HOME + "/{{d}}/sub/{{f}}", "-rw-rw-r--"), PERMS(HOME + "/{{d}}", "drwxrwxr-x")),
      ["One chmod option goes into subdirectories.", "`-R` (capital R)."],
      "`chmod -R` changes every file and directory below. Careful with `x`: `chmod -R a+X` adds execute only to directories.",
      ["chmod g+w {{d}}", "chmod -r g+w {{d}}"],
      setup={"files": [F("~/{{d}}/sub/{{f}}", "x\n"), F("~/{{d}}/{{g}}", "y\n")]}, cases=TWO_FILES),
])
skill("chown", "chown", "5.3", "Change a file's owner", [
  tpl("Make `{{u}}` the owner of `/srv/{{f}}`.", "sudo chown {{u}} /srv/{{f}}", owner("/srv/{{f}}", user="{{u}}"),
      ["`chown USER FILE`", "Giving a file away needs root."],
      "Only root may change a file's owner, so users can't hand files to others. `chown {{u}}:{{u}}` sets the group too.",
      ["chown {{u}} /srv/{{f}}", "sudo chgrp {{u}} /srv/{{f}}"],
      setup={"users": [{"name": "{{u}}"}], "files": [F("/srv/{{f}}", "x\n", owner="root")]}, cases=cases(6, 111, lambda r, i: {"u": r.choice(USERS), "f": r.choice(FILES)})),
  tpl("Make `{{u}}` the owner **and** `{{g}}` the group of `/srv/{{f}}`, in one command.", "sudo chown {{u}}:{{g}} /srv/{{f}}", owner("/srv/{{f}}", user="{{u}}", group="{{g}}"),
      ["`chown` accepts `USER:GROUP`."],
      "`chown USER:GROUP` sets both; `chown :GROUP` only the group, like `chgrp`.",
      ["sudo chown {{u}} /srv/{{f}}", "sudo chown {{g}}:{{u}} /srv/{{f}}"],
      setup={"groups": [{"name": "{{g}}", "gid": 2100}], "users": [{"name": "{{u}}"}], "files": [F("/srv/{{f}}", "x\n", owner="root")]},
      cases=cases(6, 112, lambda r, i: {"u": r.choice(USERS), "g": r.choice(GROUPS), "f": r.choice(FILES)})),
])
skill("chgrp", "chgrp", "5.3", "Change a file's group", [
  tpl("You're a member of `{{g}}`. Change the group of `{{f}}` to `{{g}}`.", "chgrp {{g}} {{f}}", owner(HOME + "/{{f}}", group="{{g}}"),
      ["There's a command just for changing the group."],
      "An owner may move a file to any group they belong to, no root needed. `ls -l` shows the group in the fourth column.",
      ["chown {{g}} {{f}}", "chgrp {{f}} {{g}}"],
      setup={"groups": [{"name": "{{g}}", "gid": 2100, "members": ["student"]}], "files": [F("~/{{f}}", "x\n")]},
      cases=cases(6, 113, lambda r, i: {"g": r.choice(GROUPS), "f": r.choice(FILES)})),
])
skill("special-bits", "chmod", "5.4", "Sticky bit and SGID", [
  tpl("`/srv/{{d}}` is writable by everyone. Set the **sticky bit** so users can only delete their own files in it.", "sudo chmod +t /srv/{{d}}", PERMS("/srv/{{d}}", "drwxrwxrwt"),
      ["The sticky bit is `t` (or 1 in front of the octal mode)."],
      "`/tmp` has mode 1777 for the same reason: everyone can create files, nobody can delete anyone else's.",
      ["sudo chmod 777 /srv/{{d}}", "sudo chmod g+s /srv/{{d}}", "chmod +t /srv/{{d}}"],
      setup={"files": [D("/srv/{{d}}", owner="root", mode=0o777)]}, vars={"d": ["share", "drop", "upload", "public", "inbox"]}),
  tpl("Make new files created in `/srv/{{d}}` get the directory's group automatically (set the **SGID** bit).", "sudo chmod g+s /srv/{{d}}", PERMS("/srv/{{d}}", "drwxrwsr-x"),
      ["On a directory, the set-group-ID bit makes new files inherit its group.", "`g+s` (or 2 in front of the octal mode)."],
      "SGID on shared team directories keeps every file in the team's group. On a program, SUID/SGID run it with the owner's/group's rights.",
      ["sudo chmod +t /srv/{{d}}", "sudo chmod u+s /srv/{{d}}"],
      setup={"files": [D("/srv/{{d}}", owner="root", mode=0o775)]}, vars={"d": ["team", "shared", "projects", "finance"]}),
])
skill("ln-s", "ln", "5.4", "Symbolic links", [
  tpl("Create a symbolic link `{{l}}` that points to `{{f}}`.", "ln -s {{f}} {{l}}", link(HOME + "/{{l}}", "{{f}}"),
      ["`ln -s TARGET LINKNAME`: the existing thing first."],
      "A symlink stores a path. If `{{f}}` is moved, the link breaks; a hard link would keep working.",
      ["ln {{f}} {{l}}", "ln -s {{l}} {{f}}", "cp {{f}} {{l}}"],
      setup={"files": [F("~/{{f}}", "x\n")]}, cases=cases(6, 121, lambda r, i: {"f": r.choice(FILES), "l": r.choice(["latest", "current", "shortcut", "link", "today"])})),
])
skill("ln-hard", "ln", "5.4", "Hard links", [
  tpl("Create a **hard** link `{{l}}` to `{{f}}`.", "ln {{f}} {{l}}", hardlink(HOME + "/{{l}}", HOME + "/{{f}}"),
      ["`ln` without options makes hard links."],
      "Both names point to the same inode, so deleting one leaves the data reachable through the other. `ls -li` shows the shared inode number.",
      ["ln -s {{f}} {{l}}", "cp {{f}} {{l}}"],
      setup={"files": [F("~/{{f}}", "x\n")]}, cases=cases(6, 122, lambda r, i: {"f": r.choice(FILES), "l": r.choice(["copy", "second", "mirror", "alias", "twin"])})),
])

# =====================================================================================================================
# Sandbox: a free shell with plenty to explore, no tasks
# =====================================================================================================================
SANDBOX = {"users": [{"name": "alice", "groups": ["devs"]}, {"name": "bob", "groups": ["ops"]}],
           "groups": [{"name": "devs", "gid": 2001, "members": ["student"]}, {"name": "ops", "gid": 2002}],
           "files": [F("~/notes.txt", "buy milk\ncall the ISP\nfinish lab 2.1\n"), F("~/todo.txt", "learn find\nlearn tar\nlearn chmod\n"),
                     F("~/fruit.txt", "\n".join(["banana", "apple", "cherry", "apple", "mango", "banana", "apple"]) + "\n"),
                     F("~/scores.csv", "alice,devs,42\nbob,ops,17\ncarol,web,99\ndave,devs,8\n"),
                     F("~/app.log", "".join("2026-10-%02d 09:%02d:00 %s %s\n" % (d, d * 3 % 60, lv, msg) for d, (lv, msg) in enumerate(
                         [("INFO", "started"), ("WARN", "disk 81% full"), ("ERROR", "timeout talking to db"), ("INFO", "user alice logged in"),
                          ("ERROR", "permission denied: /srv/share"), ("INFO", "backup done"), ("WARN", "slow request"), ("INFO", "stopped")], 1))),
                     F("~/.secret", "hidden files start with a dot\n"),
                     F("~/projects/site/index.html", "<h1>Hello</h1>\n"), F("~/projects/site/style.css", "body{margin:0}\n"),
                     F("~/projects/scripts/hello.sh", "#!/bin/bash\necho \"Hello, $1\"\n", mode=0o644),
                     F("~/photos/2025/beach.jpg", "JPG" * 900, mtime="-300d"), F("~/photos/2026/snow.jpg", "JPG" * 1200, mtime="-20d"),
                     F("~/docs/Report.TXT", "Quarterly report\n"), F("~/docs/report.txt", "draft\n"), F("~/docs/old/report.txt", "old draft\n"),
                     D("/srv/share", owner="root", mode=0o777)],
           "procs": [{"pid": 3141, "cmd": "sleep 900", "user": "student", "tty": "pts/0", "stat": "S"}]}


def check_unique():
    ids = [s["id"] for s in SKILLS]
    assert len(ids) == len(set(ids)), "duplicate skill id"
    for s in SKILLS:
        assert s["templates"], s["id"]
        for t in s["templates"]:
            used = set(re.findall(r"\{\{(\w+)\}\}", repr(t)))
            have = set((t.get("cases") or [{}])[0]) | set(t.get("vars") or {})
            assert used <= have, "%s uses %s without a value" % (s["id"], used - have)


check_unique()
DRILLS = {"skills": SKILLS, "sandbox": SANDBOX}
