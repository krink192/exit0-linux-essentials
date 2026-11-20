# SPDX-License-Identifier: AGPL-3.0-or-later
"""Variants: differently worded questions on facts the bank already asks about.

A variant names the question it rewords with variant_of=. It tests the same fact from another direction: a typed
answer where the original is multiple choice, a scenario where the original is a definition, the reverse question.
Variants belong to no fixed practice exam (A-J stay 40 questions each, so their scores stay comparable); the app
draws on them for random exams, study sets and the daily review, where a due question can come back in another
wording. A variant and its original never appear in the same set (build.py puts them in one conflict set), and
core.js treats the family as one fact for cold evidence and the review schedule.

About half are typed. Hints and "why that's wrong" notes are inline. Shell checks (run/expect) run in real Bash
via verify.py; lab= answers run on the simulated system in tools/test_questions.js."""
from common import S, F, lab, HOME


# ------------------------------------------------------------------------------------------ 1.1
F("1.1-21", "Ubuntu builds its releases from the packages of an older, community-run distribution. Type that distribution's name.",
  ["Debian", "debian", "Debian GNU/Linux"],
  "Ubuntu is derived from Debian: it takes Debian's packages, uses the same .deb format and the same dpkg and APT tools. "
  "Linux Mint is in turn built on Ubuntu, so all three belong to the Debian family.",
  hint="Its package format is .deb, and the format is named after it.", level=1, variant_of="1.1-01")

S("1.1-22", "Android phones and tablets run Google's own apps and interface. Which kernel is underneath?",
  ["✔Linux", "XNU (Darwin)", "Windows NT", "QNX"],
  "Android is built on a modified Linux kernel with its own userspace on top, which makes it the most widely used Linux-based system. "
  "XNU is the kernel of iOS and macOS, Windows NT is Microsoft's, and QNX was used by BlackBerry 10.",
  hint="It is the kernel this exam is named after.",
  why={"XNU (Darwin)": "XNU is Apple's kernel, used by iOS and macOS.",
       "Windows NT": "Windows NT is the kernel of Microsoft Windows.",
       "QNX": "QNX is a separate Unix-like system; BlackBerry 10 was built on it."}, level=1, variant_of="1.1-02")

S("1.1-23", "Ubuntu 22.04 was a Long Term Support (LTS) release. Which version was the next LTS?",
  ["✔24.04", "22.10", "23.04", "27.04"],
  "Ubuntu publishes a release every six months, numbered by year and month, and every second April release is an LTS. "
  "LTS releases are therefore two years apart: 20.04, 22.04, 24.04. The versions in between are supported for only nine months.",
  hint="How many years lie between two LTS releases?",
  why={"22.10": "22.10 came six months later and was a regular release, not an LTS.",
       "23.04": "23.04 was a regular release; LTS releases come every two years, not every year.",
       "27.04": "That would be five years later. Five years is how long an LTS is supported, not the gap between them."},
  level=2, variant_of="1.1-11")

# ------------------------------------------------------------------------------------------ 1.2
F("1.2-21", "Type the name of the database server that began as a community-developed fork of MySQL.",
  ["MariaDB", "mariadb", "Mariadb"],
  "MariaDB was forked from MySQL by MySQL's original developers after Oracle acquired it. It stays largely compatible, "
  "and many distributions install it where MySQL used to be. PostgreSQL is a separate, unrelated database.",
  hint="It is named after a daughter of MySQL's founder, and ends in DB.", level=1, variant_of="1.2-08")

S("1.2-22", "A volunteer needs to crop and colour-correct scanned photographs for a newsletter, using open source software. Which application is made for that?",
  ["✔GIMP", "Audacity", "LibreOffice Calc", "Thunderbird"],
  "GIMP (GNU Image Manipulation Program) edits raster images such as scanned photos, much like Photoshop. "
  "Audacity edits audio, Calc is the LibreOffice spreadsheet, and Thunderbird is an email client.",
  hint="Its name is an acronym that contains the words Image Manipulation.",
  why={"Audacity": "Audacity records and edits sound, not pictures.",
       "LibreOffice Calc": "Calc is a spreadsheet, the counterpart of Excel.",
       "Thunderbird": "Thunderbird is an email client."}, level=2, variant_of="1.2-12")

F("1.2-23", "In a LAMP stack, L is Linux, A is Apache and M is MySQL or MariaDB. Type the scripting language the P most often stands for.",
  ["PHP", "php"],
  "LAMP is Linux, Apache, MySQL (or MariaDB) and PHP: the classic open source stack for dynamic websites. "
  "The P is sometimes read as Perl or Python, but PHP is the usual meaning.",
  hint="The language behind WordPress and many other classic web applications.", level=1, variant_of="1.2-10")

# ------------------------------------------------------------------------------------------ 1.3
S("1.3-11", "A license is described as \"OSI-approved\". What does that mean?",
  ["✔The Open Source Initiative reviewed it and found that it meets the Open Source Definition",
   "The Free Software Foundation has certified that it is a copyleft license",
   "The Linux Foundation allows it to be used for kernel modules",
   "Software under it may be used, but its source code may not be modified"],
  "The Open Source Initiative (OSI) maintains the Open Source Definition and approves licenses that comply with it. "
  "The Free Software Foundation is a different organization: it defines free software by the four freedoms and publishes the GPL.",
  hint="Expand the abbreviation OSI.",
  why={"The Free Software Foundation has certified that it is a copyleft license": "The FSF is a separate organization, and OSI-approved licenses include permissive ones such as BSD and MIT.",
       "The Linux Foundation allows it to be used for kernel modules": "The Linux Foundation doesn't approve licenses; OSI does.",
       "Software under it may be used, but its source code may not be modified": "The Open Source Definition requires that modifications and derived works are allowed."},
  level=2, variant_of="1.3-02")

F("1.3-12", "Type the one-word term for licenses, such as the GPL, that require modified versions to be distributed under the same terms.",
  ["copyleft", "Copyleft"],
  "Copyleft licenses use copyright to keep software free: anyone who distributes the program or a modified version must pass on "
  "the same freedoms and the source code. The GPL is the best-known copyleft license. Permissive licenses such as BSD and MIT don't require this.",
  hint="A play on the word copyright.", level=1, variant_of="1.3-01")

# ------------------------------------------------------------------------------------------ 1.4
F("1.4-21", "Type the name of the protocol, shown at the start of a web address, that encrypts the connection between the browser and the web server.",
  ["HTTPS", "https", "https://"],
  "HTTPS is HTTP carried over TLS. It encrypts what is sent in both directions and lets the browser verify the site's identity "
  "through its certificate. Plain HTTP sends everything, including passwords, as readable text.",
  hint="It is HTTP with one more letter, for secure.", level=1, variant_of="1.4-10")

S("1.4-22", "Which cloud service model leaves the customer in charge of installing and patching the operating system?",
  ["✔Infrastructure as a Service (IaaS)", "Platform as a Service (PaaS)", "Software as a Service (SaaS)",
   "None of them: the provider always manages the operating system"],
  "With IaaS you rent virtual machines, storage and networks, and everything from the operating system upwards is yours to manage. "
  "With PaaS the provider runs the operating system and runtime and you supply the application; with SaaS you only use a finished application.",
  hint="Which model rents you bare virtual machines?",
  why={"Platform as a Service (PaaS)": "With PaaS the provider maintains the operating system; you deploy only your application.",
       "Software as a Service (SaaS)": "With SaaS you use a finished application and never see the operating system.",
       "None of them: the provider always manages the operating system": "On IaaS virtual machines, the operating system is the customer's job."},
  level=2, variant_of="1.4-08")

S("1.4-23", "A user has the same password on every website. What is the main risk?",
  ["✔If one site leaks it, attackers can try it on the user's other accounts",
   "Websites reject passwords that are already in use on another site",
   "A password becomes weaker each time it is typed into a browser",
   "Browsers cannot save a password that is used on more than one site"],
  "Leaked username and password pairs are tried automatically on other services (credential stuffing), so one breach opens every "
  "account that shares the password. A password manager makes it practical to use a different, strong password everywhere.",
  hint="Think about what happens after a single website is breached.",
  why={"Websites reject passwords that are already in use on another site": "A site can't know which passwords you use elsewhere.",
       "A password becomes weaker each time it is typed into a browser": "Typing a password doesn't change its strength; reuse across sites is the problem.",
       "Browsers cannot save a password that is used on more than one site": "Browsers save passwords per site, repeated or not."},
  level=2, variant_of="1.4-01")

# ------------------------------------------------------------------------------------------ 2.1
F("2.1-31", "Type the Bash builtin (name only) that tells you whether a command is an alias, a builtin, a function or a file on disk.",
  ["type"],
  "`type ls` might print `ls is aliased to 'ls --color=auto'`, and `type cd` prints `cd is a shell builtin`. "
  "`which` only searches the directories in PATH, so it can't see builtins or aliases.",
  hint="Four letters. You ask what kind of thing a command is.", run="type cd", expect="cd is a shell builtin", level=1, variant_of="2.1-03")

S("2.1-32", "You open a terminal as a regular user. Which character normally ends the Bash prompt?",
  ["✔$", "#", ">", "%"],
  "By default Bash ends the prompt with `$` for regular users and `#` for root, which is why documentation shows commands that "
  "need root after a `#`. The `>` prompt appears when Bash is waiting for the rest of an unfinished command.",
  hint="The other one of the pair is # and belongs to root.",
  why={"#": "`#` marks a root shell.",
       ">": "`>` is the continuation prompt (PS2), shown when a command isn't finished yet.",
       "%": "`%` is the traditional prompt of csh and zsh, not Bash."}, level=1, variant_of="2.1-07")

F("2.1-33", "The variable temp is set in your shell. Type the complete command that removes it.",
  ["unset temp"],
  "`unset temp` removes the variable, so `$temp` expands to nothing afterwards. The name is given without `$`: "
  "`unset $temp` would try to unset a variable named after temp's value.",
  hint="The builtin is the opposite of set, and it takes the name without a dollar sign.",
  lab=lab({"run": ["temp=5"]}, {"type": "novar", "name": "temp"}, ["unset $temp", "echo $temp", "export temp"]),
  level=2, variant_of="2.1-12")

S("2.1-34", "In the command `grep -i error /var/log/syslog`, what is `-i`?",
  ["✔An option", "The command", "A file argument", "A variable"],
  "A command line is the command name followed by options, which change how the command behaves, and arguments, which say what it "
  "works on. Here `grep` is the command, `-i` is an option, and `error` and `/var/log/syslog` are arguments.",
  hint="It starts with a dash and changes how the command behaves.",
  why={"The command": "The command is the first word, `grep`.",
       "A file argument": "The file argument is `/var/log/syslog`.",
       "A variable": "A variable would be written with a `$`, as in `$HOME`."}, level=1, variant_of="2.1-08")

# ------------------------------------------------------------------------------------------ 2.2
F("2.2-21", "`man -k` searches the names and short descriptions of all man pages for a keyword. Type the command that does the same.",
  ["apropos"],
  "`apropos passwd` and `man -k passwd` give the same list of man pages whose name or one-line description contains the keyword. "
  "`whatis` (the same as `man -f`) matches only exact page names.",
  hint="It is a French-sounding word that means 'concerning'.", level=1, variant_of="2.2-03")

S("2.2-22", "`man passwd` shows the page for the passwd command. Which command shows the page that documents the format of the file /etc/passwd?",
  ["✔man 5 passwd", "man 1 passwd", "man 8 passwd", "man -k passwd"],
  "Man pages are grouped in numbered sections: 1 is user commands, 5 is file formats and configuration files, 8 is administration "
  "commands. Giving the section number picks the page when one name exists in several sections.",
  hint="Which section holds file formats?",
  why={"man 1 passwd": "Section 1 is user commands: this is the page `man passwd` already shows.",
       "man 8 passwd": "Section 8 holds system administration commands, not file formats.",
       "man -k passwd": "`-k` searches all page descriptions for the keyword; it doesn't open a page."}, level=2, variant_of="2.2-01")

F("2.2-23", "Type the complete command that prints only the one-line man page description of the tar command.",
  ["whatis tar", "man -f tar"],
  "`whatis tar` prints the name, section and one-line description from tar's man page. `man -f tar` is the same thing. "
  "`apropos tar` would list every page whose description mentions tar.",
  hint="The command asks, in one word, 'what is' it?", level=2, variant_of="2.2-09")

# ------------------------------------------------------------------------------------------ 2.3
F("2.3-21", "Type the complete command that lists the current directory in long format with human-readable sizes such as 4.0K and 12M.",
  ["ls -lh", "ls -hl", "ls -l -h", "ls -h -l", "ls -lh .", "ls -hl .",
   "ls -l --human-readable", "ls --human-readable -l", "ls -l --human-readable .", "ls --human-readable -l ."],
  "`-l` gives the long format and `-h` turns byte counts into units such as K, M and G. Short options can be combined "
  "behind one dash in any order, and `--human-readable` is the long form of `-h`.",
  hint="Two one-letter options: long, and human-readable.", run="head -c 5000 /dev/zero > f; {A} | grep -c '4\\.9K'", expect="1", level=2, variant_of="2.3-09")

S("2.3-22", "You are deep inside /usr/share/doc. Which command takes you to your home directory with the fewest keystrokes?",
  ["✔cd", "cd /", "cd ..", "cd -"],
  "`cd` with no argument changes to your home directory, the same as `cd ~` or `cd $HOME`.",
  hint="You don't need to type any path at all.",
  why={"cd /": "`/` is the root of the filesystem, not your home directory.",
       "cd ..": "`..` moves up one level, to /usr/share.",
       "cd -": "`cd -` returns to the directory you were in before, wherever that was."}, level=1, variant_of="2.3-05")

F("2.3-23", "Your current directory is /var/log. Using a relative path, type the command that changes to /var/tmp.",
  ["cd ../tmp", "cd ../tmp/"],
  "`..` is the parent directory, so from /var/log the path `../tmp` leads up to /var and down into tmp. "
  "A relative path starts from the current directory; an absolute path starts with `/`.",
  hint="Go up one level with two dots, then down again.",
  lab=lab({"run": ["cd /var/log"]}, {"type": "all", "checks": [{"type": "cwd", "path": "/var/tmp"}, {"type": "not", "check": {"type": "history", "regex": r"cd\s+/"}}]},
          ["cd /var/tmp", "cd tmp", "cd ..", "cd /tmp"]),
  level=2, variant_of="2.3-12")

# ------------------------------------------------------------------------------------------ 2.4
F("2.4-21", "None of the directories projects, projects/2026 and projects/2026/reports exists yet. Type the complete command that creates all three in one step.",
  ["mkdir -p projects/2026/reports", "mkdir --parents projects/2026/reports"],
  "`mkdir -p` creates the missing parent directories on the way to the last one, and doesn't complain about ones that already exist. "
  "Without `-p`, mkdir fails because projects/2026 isn't there.",
  hint="mkdir has an option for making parent directories.",
  lab=lab({}, {"type": "exists", "path": HOME + "/projects/2026/reports", "kind": "dir"},
          ["mkdir projects/2026/reports", "mkdir -p projects 2026 reports", "touch projects/2026/reports"]),
  level=2, variant_of="2.4-05")

S("2.4-22", "No file named notes.txt exists in the current directory. What does `touch notes.txt` do?",
  ["✔Creates an empty file named notes.txt", "Fails with \"No such file or directory\"",
   "Creates a directory named notes.txt", "Opens notes.txt in the default text editor"],
  "`touch` updates a file's timestamps, and creates the file, empty, when it doesn't exist yet. That makes it the usual way to create an empty file.",
  hint="touch is often used just to make a file appear.",
  why={"Fails with \"No such file or directory\"": "touch creates a missing file instead of reporting an error.",
       "Creates a directory named notes.txt": "Directories are made with mkdir; touch makes regular files.",
       "Opens notes.txt in the default text editor": "touch never opens an editor."}, run="touch notes.txt; stat -c '%F %s' notes.txt",
  expect="regular empty file 0", level=1, variant_of="2.4-06")

S("2.4-23", "Which command removes the directory projects only when it is empty, and otherwise reports an error and deletes nothing?",
  ["✔rmdir projects", "rm -r projects", "rm -rf projects", "rm -ri projects"],
  "`rmdir` removes empty directories only, which makes it the safe choice: if anything is still inside, it fails with "
  "\"Directory not empty\". `rm -r` deletes a directory together with all of its contents.",
  hint="One command exists only for removing empty directories.",
  why={"rm -r projects": "`rm -r` deletes the directory and everything inside it.",
       "rm -rf projects": "`-f` additionally suppresses prompts and errors; the contents are still deleted.",
       "rm -ri projects": "`-i` asks before each removal, but answering yes still deletes the contents."}, level=2, variant_of="2.4-01")

# ------------------------------------------------------------------------------------------ 3.1
F("3.1-21", "Type the complete command that lists the files inside backup.tar without extracting anything.",
  ["tar -tf backup.tar", "tar tf backup.tar", "tar -tvf backup.tar", "tar tvf backup.tar",
   "tar --list --file backup.tar", "tar --list -f backup.tar"],
  "`-t` lists an archive's table of contents and `-f` names the archive file. Adding `-v` shows permissions, owners and sizes as well. "
  "`-x` would extract the files and `-c` would create a new archive.",
  hint="The tar option for a table of contents, then the one that names the file.",
  lab=lab({"files": [{"path": "~/docs/notes.txt", "data": "one\n"}], "run": ["tar -cf backup.tar docs", "rm -r docs"]},
          {"type": "all", "checks": [{"type": "last", "regex": r"docs/notes\.txt"}, {"type": "absent", "path": HOME + "/docs"}]},
          ["tar -xf backup.tar", "tar -xvf backup.tar", "ls backup.tar"]),
  level=2, variant_of="3.1-03")

S("3.1-22", "A directory holds only report.txt.gz. What is in it after you run `gunzip report.txt.gz`?",
  ["✔Only report.txt", "Both report.txt and report.txt.gz", "Only report.txt.gz, with its contents printed to the terminal",
   "A new directory named report"],
  "`gzip` and `gunzip` replace the file they work on: `gzip report.txt` leaves only report.txt.gz, and gunzip turns it back into report.txt. "
  "Use `-k` to keep the original, or `zcat` to print the contents without changing anything.",
  hint="gunzip undoes gzip, and both replace the file they work on.",
  why={"Both report.txt and report.txt.gz": "The compressed file is removed unless you add `-k` (keep).",
       "Only report.txt.gz, with its contents printed to the terminal": "That describes `zcat` or `gunzip -c`, which leave the file alone.",
       "A new directory named report": "gzip compresses a single file; it has nothing to do with directories."},
  run="echo hi > report.txt; gzip report.txt; gunzip report.txt.gz; ls", expect="report.txt", level=2, variant_of="3.1-05")

S("3.1-23", "Which compression program does tar use when you add the `-j` option?",
  ["✔bzip2", "gzip", "xz", "zip"],
  "`tar` can pass the archive through a compressor: `-z` uses gzip (.tar.gz), `-j` uses bzip2 (.tar.bz2) and `-J` uses xz (.tar.xz).",
  hint="Its archives end in .tar.bz2.",
  why={"gzip": "gzip is selected with `-z`.",
       "xz": "xz is selected with a capital `-J`.",
       "zip": "zip is a separate archive format with its own zip and unzip commands; tar doesn't use it."}, level=1, variant_of="3.1-06")

# ------------------------------------------------------------------------------------------ 3.2
F("3.2-31", "Type the grep option (a dash and one letter) that inverts the match, so that only the lines NOT containing the pattern are printed.",
  ["-v"],
  "`grep -v debug config.ini` prints every line that doesn't contain debug. It is often used to drop comment lines: `grep -v '^#' file`.",
  hint="Think of the word invert.", run="printf 'a\\nb\\n' | grep {A} a", expect="b", level=1, variant_of="3.2-11")

S("3.2-32", "nums.txt contains the lines 10, 9 and 100. Which command prints them in the order 9, 10, 100?",
  ["✔sort -n nums.txt", "sort nums.txt", "sort -r nums.txt", "sort -u nums.txt"],
  "Plain sort compares character by character, so 10 and 100 come before 9 because the character 1 sorts before 9. "
  "`-n` compares the lines as numbers.",
  hint="sort needs to be told that the lines are numbers.",
  why={"sort nums.txt": "Without `-n` the lines are compared as text, giving 10, 100, 9.",
       "sort -r nums.txt": "`-r` only reverses the text order: 9, 100, 10.",
       "sort -u nums.txt": "`-u` removes duplicate lines; the order stays alphabetical."},
  run="printf '10\\n9\\n100\\n' > nums.txt; sort -n nums.txt | tr '\\n' ' '", expect="9 10 100", level=2, variant_of="3.2-07")

F("3.2-33", "Type the complete command that prints the last 5 lines of the file app.log in the current directory.",
  ["tail -n 5 app.log", "tail -5 app.log", "tail -n5 app.log", "tail --lines 5 app.log", "tail --lines=5 app.log"],
  "`tail` prints the end of a file, 10 lines unless `-n` says otherwise. head does the same for the beginning.",
  hint="The counterpart of head, with -n and a number.",
  lab=lab({"files": [{"path": "~/app.log", "data": "".join("line %d\n" % i for i in range(1, 10))}]},
          {"type": "last", "regex": r"^line 5\nline 6\nline 7\nline 8\nline 9\n?$"},
          ["head -n 5 app.log", "tail app.log", "tail -n 4 app.log", "cat app.log"]),
  level=2, variant_of="3.2-06")

S("3.2-34", "Which command line makes `grep ssh` read the output of `ps aux`?",
  ["✔ps aux | grep ssh", "ps aux > grep ssh", "ps aux ; grep ssh", "ps aux < grep ssh"],
  "A pipe (`|`) connects the standard output of the command on its left to the standard input of the command on its right.",
  hint="Which character connects two commands into a pipeline?",
  why={"ps aux > grep ssh": "`>` redirects output into a file, here a file named grep.",
       "ps aux ; grep ssh": "`;` only runs the commands one after the other; grep would wait for input from the keyboard.",
       "ps aux < grep ssh": "`<` reads input from a file, here a file named grep."}, level=2, variant_of="3.2-17")

# ------------------------------------------------------------------------------------------ 3.3
F("3.3-41", "Type the first line a script needs so that it is run by /bin/bash when started as `./script.sh`.",
  ["#!/bin/bash", "#! /bin/bash"],
  "The shebang, `#!` followed by the path of an interpreter, must be the very first line. When the script is executed, "
  "the kernel starts that interpreter and hands it the script.",
  hint="Two characters, then the path of the interpreter.", level=2, variant_of="3.3-01")

F("3.3-42", "Type the special variable that holds the number of arguments passed to a script.",
  ["$#"],
  "`$#` is the argument count. `$1`, `$2` and so on are the arguments themselves, `$@` is all of them and `$0` is the script's name.",
  hint="A dollar sign and the symbol often used to mean 'number'.", run="set -- a b c; echo {A}", expect="3", level=1, variant_of="3.3-02")

S("3.3-43", "Which test succeeds when the variable n is less than or equal to 5?",
  ["✔[ $n -le 5 ]", "[ $n -lt 5 ]", "[ $n <= 5 ]", "[ $n -ge 5 ]"],
  "Inside `[ ]`, numbers are compared with `-eq`, `-ne`, `-lt`, `-le`, `-gt` and `-ge`. `-le` means less than or equal.",
  hint="The letters stand for 'less' and 'equal'.",
  why={"[ $n -lt 5 ]": "`-lt` is strictly less than, so it fails when n is 5.",
       "[ $n <= 5 ]": "`<=` isn't a test operator; the shell reads `<` as input redirection.",
       "[ $n -ge 5 ]": "`-ge` means greater than or equal."},
  run="n=5; [ $n -le 5 ] && echo yes; [ $n -lt 5 ] || echo no", expect="yes\nno", level=2, variant_of="3.3-18")

S("3.3-44", "`grep -q root /etc/passwd` finds a matching line. What does `echo $?` print right afterwards?",
  ["✔0", "1", "2", "root"],
  "`$?` holds the exit status of the last command. grep exits with 0 when it found a match, 1 when it found none and 2 on an error. "
  "`-q` only silences the output, so the status is all you get.",
  hint="Finding a match counts as success.",
  why={"1": "1 is grep's status when no line matched.",
       "2": "2 means an error, such as a file that doesn't exist.",
       "root": "`$?` is a number, and `-q` prints no matching lines anyway."},
  run="grep -q root /etc/passwd; echo $?", expect="OPT", level=2, variant_of="3.3-16")

F("3.3-45", "You have finished editing a script in vi and pressed Esc. Type the command, starting with a colon, that writes the file and quits.",
  [":wq", ":x", ":wq!"],
  "In command mode, `:w` writes the file and `:q` quits, and `:wq` does both. `:x` also saves and quits, and so does `ZZ`. "
  "`:q!` quits without saving.",
  hint="Write, then quit: two letters after the colon.", level=1, variant_of="3.3-05")

# ------------------------------------------------------------------------------------------ 4.1
S("4.1-11", "Which statement describes a rolling release distribution?",
  ["✔Packages are updated continuously, so there are no big version upgrades",
   "A new version is published on a fixed date every two years",
   "After installation it receives security fixes only, never new features",
   "Each release is supported for exactly five years"],
  "A rolling release, such as Arch Linux or openSUSE Tumbleweed, delivers new software versions as a steady stream of updates. "
  "You get current software quickly, at the price of more frequent change than on a fixed or LTS release.",
  hint="Think of updates that keep rolling in.",
  why={"A new version is published on a fixed date every two years": "That is a fixed release cycle, like Ubuntu's LTS releases.",
       "After installation it receives security fixes only, never new features": "That describes a stable or enterprise release; a rolling release brings new features all the time.",
       "Each release is supported for exactly five years": "A rolling distribution has no separate releases with their own support periods."},
  level=1, variant_of="4.1-04")

F("4.1-12", "Type the three-letter abbreviation for a distribution release that receives security and maintenance updates for several years.",
  ["LTS", "lts"],
  "LTS stands for Long Term Support. Ubuntu's LTS releases, for example, appear every two years and get five years of standard updates, "
  "which suits servers and other systems that shouldn't change often.",
  hint="Long ... Support.", level=1, variant_of="4.1-01")

# ------------------------------------------------------------------------------------------ 4.2
F("4.2-21", "Type the four-letter abbreviation of the firmware interface that replaced the legacy BIOS on modern PCs.",
  ["UEFI", "uefi"],
  "UEFI (Unified Extensible Firmware Interface) starts the hardware and loads the boot loader, as the BIOS did before it. "
  "It supports large disks with GPT partition tables and Secure Boot.",
  hint="Unified Extensible Firmware ...", level=1, variant_of="4.2-06")

S("4.2-22", "A system has a single SATA disk with four partitions. Which device file is the fourth partition?",
  ["✔/dev/sda4", "/dev/sdd", "/dev/sd4", "/dev/sda/4"],
  "SATA, SCSI and USB disks are named /dev/sda, /dev/sdb and so on, one letter per disk. A partition adds its number to the disk's name: /dev/sda4.",
  hint="The letter picks the disk, and the number picks the partition.",
  why={"/dev/sdd": "/dev/sdd would be a fourth disk, not a partition.",
       "/dev/sd4": "The disk letter is missing: partitions are named after their disk.",
       "/dev/sda/4": "Disk device files aren't directories; the number is appended directly."}, level=2, variant_of="4.2-04")

S("4.2-23", "Which command produced this output?",
  ["✔lsblk", "lscpu", "lsusb", "free -h"],
  "`lsblk` lists block devices as a tree: disks, the partitions on them, their sizes and where they are mounted.",
  code="NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0  100G  0 disk\n├─sda1   8:1    0    1G  0 part /boot\n└─sda2   8:2    0   99G  0 part /",
  hint="The output shows disks and partitions, which are block devices.",
  why={"lscpu": "lscpu describes the processor: architecture, cores, model name.",
       "lsusb": "lsusb lists USB devices, one per line with bus and ID.",
       "free -h": "free shows memory and swap usage."}, level=2, variant_of="4.2-08")

# ------------------------------------------------------------------------------------------ 4.3
F("4.3-31", "Type the directory (full path) where most system log files are kept.",
  ["/var/log", "/var/log/"],
  "/var holds variable data, and /var/log is where the system and its services write their log files, such as syslog or messages, "
  "auth.log and the logs of web servers. On systemd systems the journal is read with journalctl.",
  hint="It is under /var, the directory for data that changes.", level=1, variant_of="4.3-01")

S("4.3-32", "A script should run a command and throw away everything the command writes to standard output. Where should the output be redirected?",
  ["✔/dev/null", "/dev/zero", "/tmp", "/proc"],
  "/dev/null is a special file that discards whatever is written to it, so `command > /dev/null` hides normal output. "
  "Reading from it returns nothing.",
  hint="A device whose name suggests nothing.",
  why={"/dev/zero": "/dev/zero is for reading: it supplies an endless stream of zero bytes.",
       "/tmp": "/tmp is a directory; output must go to a file, and a file there would keep the data.",
       "/proc": "/proc is the kernel's virtual view of processes and system information, not a place to send output."},
  level=2, variant_of="4.3-07")

F("4.3-33", "Type the complete ps command, in BSD style without a dash, that lists every process of every user together with its owner.",
  ["ps aux", "ps axu"],
  "In `ps aux`, `a` selects the processes of all users, `x` adds those without a terminal and `u` gives the user-oriented format "
  "with owner, CPU and memory columns. `ps -ef` is the equivalent in standard syntax.",
  hint="Three letters after ps: all users, user format, and processes without a terminal.",
  run="{A} | head -n 1 | tr -s ' ' | cut -d' ' -f1,2", expect="USER PID", level=2, variant_of="4.3-11")

S("4.3-34", "On a Linux system that uses systemd, which process ID does systemd itself have?",
  ["✔1", "0", "100", "A different one after every boot"],
  "The kernel starts one first process, the init system, and gives it PID 1. On most current distributions that is systemd. "
  "It starts and supervises every other service.",
  hint="It is the first process the kernel starts.",
  why={"0": "PID 0 belongs to the kernel's own scheduler, not to a normal process.",
       "100": "Nothing ties the init system to that number.",
       "A different one after every boot": "The init process always gets PID 1."}, level=1, variant_of="4.3-10")

# ------------------------------------------------------------------------------------------ 4.4
F("4.4-21", "Type the full path of the file that lists the DNS servers the system's resolver asks.",
  ["/etc/resolv.conf"],
  "/etc/resolv.conf holds `nameserver` lines with the addresses of the DNS servers to ask. /etc/hosts maps names to addresses "
  "locally and is normally checked first.",
  hint="It is in /etc, and its name starts with resolv.", run="test -e {A} && echo ok", expect="ok", level=1, variant_of="4.4-01")

S("4.4-22", "How long is an IPv6 address?",
  ["✔128 bits", "32 bits", "48 bits", "64 bits"],
  "An IPv6 address has 128 bits, written as eight groups of four hexadecimal digits, as in 2001:db8::1. An IPv4 address has 32 bits.",
  hint="Four times the length of an IPv4 address.",
  why={"32 bits": "32 bits is the length of an IPv4 address.",
       "48 bits": "48 bits is the length of a MAC (hardware) address.",
       "64 bits": "64 bits is the usual length of the network prefix, half of the address."}, level=1, variant_of="4.4-10")

S("4.4-23", "A colleague says a server seems to be down. Which command is the quickest check of whether the host answers on the network at all?",
  ["✔ping -c 4 server.example.com", "host server.example.com", "ip addr show", "ss -tln"],
  "`ping` sends ICMP echo requests and reports the replies, so it shows whether the host is reachable and how long answers take. "
  "`-c 4` stops after four requests.",
  hint="The command is named after the sound of sonar.",
  why={"host server.example.com": "host only looks up the name in DNS; it doesn't contact the server itself.",
       "ip addr show": "That shows the addresses of your own interfaces.",
       "ss -tln": "ss lists listening sockets on your own machine."}, level=2, variant_of="4.4-07")

# ------------------------------------------------------------------------------------------ 5.1
F("5.1-21", "Type the user ID (UID) that always belongs to root, the superuser.",
  ["0"],
  "root has UID 0, and the kernel grants superuser rights to that number, not to the name. System accounts get low UIDs, "
  "and regular users usually start at 1000.",
  hint="The lowest number there is.", run="id -u root", expect="0", level=1, variant_of="5.1-01")

S("5.1-22", "An administrator wants to see when the server was last rebooted and who logged in during the past days. Which command shows that history?",
  ["✔last", "who", "w", "id"],
  "`last` reads /var/log/wtmp and lists past logins, logouts and reboots, newest first. who and w only show the users logged in right now.",
  hint="You are asking about the last logins.",
  why={"who": "who lists only the users who are logged in at the moment.",
       "w": "w shows current users and what they are running, not past sessions.",
       "id": "id prints a user's UID, GID and groups."}, level=2, variant_of="5.1-06")

S("5.1-23", "Why can't a regular user read other users' password hashes?",
  ["✔They are kept in /etc/shadow, which only root can read",
   "They are kept in /etc/passwd, which only root can read",
   "They are encrypted with a key stored in /etc/group",
   "They are kept only in memory and never written to disk"],
  "/etc/passwd must be readable by everyone, because programs look up user names in it, so the password hashes were moved to "
  "/etc/shadow, which is readable only by root. The password field in /etc/passwd holds just an `x`.",
  hint="Which file holds the hashes, and who may read it?",
  why={"They are kept in /etc/passwd, which only root can read": "/etc/passwd is world-readable and holds an `x` in place of the hash.",
       "They are encrypted with a key stored in /etc/group": "/etc/group lists groups and their members; it holds no keys.",
       "They are kept only in memory and never written to disk": "The hashes are stored on disk, in /etc/shadow."},
  level=2, variant_of="5.1-02")

# ------------------------------------------------------------------------------------------ 5.2
F("5.2-21", "Type the complete command, including sudo, that deletes the user tom together with his home directory.",
  ["sudo userdel -r tom", "sudo userdel --remove tom"],
  "`userdel` removes the account from /etc/passwd, /etc/shadow and /etc/group. With `-r` it also removes the home directory and the "
  "mail spool; without it, the files stay behind.",
  hint="userdel has an option to remove the home directory too.",
  lab=lab({"users": [{"name": "tom"}], "files": [{"path": "/home/tom/notes.txt", "data": "todo\n", "owner": "tom"}]},
          {"type": "all", "checks": [{"type": "nouser", "name": "tom"}, {"type": "absent", "path": "/home/tom"}]},
          ["sudo userdel tom", "userdel -r tom", "sudo rm -r /home/tom"]),
  level=2, variant_of="5.2-08")

S("5.2-22", "Where should an administrator put a default .bashrc so that every user created from now on gets a copy in the new home directory?",
  ["✔/etc/skel/", "/etc/default/", "/home/", "/usr/share/doc/"],
  "When useradd creates a home directory (`-m`), it copies the contents of /etc/skel, the skeleton directory, into it.",
  hint="Short for skeleton.",
  why={"/etc/default/": "/etc/default holds default settings for programs, such as useradd's own defaults, not files to copy.",
       "/home/": "/home contains the home directories themselves; nothing there is copied to new users.",
       "/usr/share/doc/": "/usr/share/doc holds package documentation."}, level=2, variant_of="5.2-01")

F("5.2-23", "The user dave has forgotten his password. Type the complete command, including sudo, with which an administrator sets a new one for him.",
  ["sudo passwd dave"],
  "`passwd` without an argument changes your own password. root can name another user, and is then not asked for the old password.",
  hint="The same command you use for your own password, with the user's name.", level=2, variant_of="5.2-03")

# ------------------------------------------------------------------------------------------ 5.3
F("5.3-21", "Type the three-digit octal mode for the permissions rwxr-xr--.",
  ["754"],
  "Each group of three is one digit: r is 4, w is 2 and x is 1. rwx is 7, r-x is 5 and r-- is 4, which gives 754.",
  hint="Add 4 for r, 2 for w and 1 for x in each group of three.", run="touch f; chmod {A} f; stat -c %A f", expect="-rwxr-xr--",
  level=2, variant_of="5.3-01")

F("5.3-22", "Type the complete command (run as root) that changes only the group of report.txt to users, leaving the owner as it is.",
  ["chgrp users report.txt", "chown :users report.txt"],
  "`chgrp` changes the group of a file. chown can do it too when the name is written after a colon: `chown :users report.txt`.",
  hint="There is a command just for changing the group.", run="touch report.txt; {A}; stat -c %G report.txt", expect="users",
  level=2, variant_of="5.3-12")

S("5.3-23", "A user can list the file names in a directory with ls, but `cd` into it fails with \"Permission denied\". Which permission on the directory is missing?",
  ["✔Execute (x)", "Read (r)", "Write (w)", "The sticky bit (t)"],
  "On a directory, read lets you list the names, write lets you create and delete entries, and execute lets you enter it and reach "
  "the files inside.",
  hint="The directory permission that lets you pass through.",
  why={"Read (r)": "Read is present: it is what lets ls show the names.",
       "Write (w)": "Write is needed to create, delete or rename entries, not to enter the directory.",
       "The sticky bit (t)": "The sticky bit limits who may delete files in a shared directory."}, level=2, variant_of="5.3-04")

# ------------------------------------------------------------------------------------------ 5.4
S("5.4-11", "Which standard directory normally has the sticky bit set, so that users can delete only their own files there?",
  ["✔/tmp", "/home", "/etc", "/usr/bin"],
  "/tmp is writable by everyone (mode 1777, shown as drwxrwxrwt). The sticky bit, the final `t`, stops users from deleting or "
  "renaming files that belong to someone else. /var/tmp is set up the same way.",
  hint="A directory where every user may create files.",
  why={"/home": "/home is writable only by root; each user's own directory inside it is private.",
       "/etc": "/etc is writable only by root, so no sticky bit is needed.",
       "/usr/bin": "/usr/bin holds programs and is writable only by root."}, run="stat -c %A /tmp", expect="drwxrwxrwt",
  level=1, variant_of="5.4-01")

F("5.4-12", "Type the complete command that shows the permissions of the directory /etc itself in long format, instead of listing its contents.",
  ["ls -ld /etc", "ls -dl /etc", "ls -ld /etc/", "ls -l -d /etc", "ls -d -l /etc",
   "ls -l --directory /etc", "ls --directory -l /etc", "ls -l --directory /etc/"],
  "`-d` makes ls describe the directory itself instead of listing what is in it, and `-l` gives the long format with permissions, "
  "owner and group. `--directory` is the long form of `-d`.",
  hint="Long format, plus the option that stands for directory.",
  lab=lab({}, {"type": "last", "regex": r"^drwxr-xr-x\s.*\s/etc/?\n?$"}, ["ls -l /etc", "ls -d /etc", "ls -la /etc"]),
  level=2, variant_of="5.4-04")
