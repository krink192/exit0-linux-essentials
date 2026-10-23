# SPDX-License-Identifier: AGPL-3.0-or-later
"""Targeted set (form J): 40 questions weighted exactly like the exam blueprint, all at the Apply or Analyze level.

Every question stays inside the LPI Linux Essentials 010-160 objectives (version 1.6) and the terms they list.
The aim is depth, not more of the same: scenarios to diagnose, output to read, and type-the-command questions
that the lab shell checks by running them (lab=...), so any command that does the job counts. Objectives that
had the least Analyze-level coverage (1.1, 1.4, 4.1, 4.2, 4.3) get scenario questions here.
Hints and "why that's wrong" notes are inline (hint=, why=). Shell checks (run/expect) run in real Bash via verify.py."""
from common import S, F

J = "J"
HOME = "/home/student"


def lab(setup, check, reject=()):
    return {"setup": setup, "check": check, "reject": list(reject)}


# ------------------------------------------------------------------------------------------ 1.1 (2)
S("1.1", "A vendor ships its tool only as `tool-2.4-1.x86_64.rpm`. On which systems can it be installed with the distribution's own package tools? (Choose TWO.)",
  ["✔CentOS", "✔openSUSE", "Debian", "Ubuntu"],
  "RPM is the package format of the Red Hat family (Red Hat Enterprise Linux, CentOS, Fedora) and also of SUSE (openSUSE, SUSE Linux Enterprise), "
  "even though SUSE isn't part of the Red Hat family. Debian and its derivatives such as Ubuntu use .deb packages with dpkg and apt.",
  hint="Think about the package format, not about which company a distribution comes from.",
  why={"Debian": "Debian uses .deb packages (dpkg, apt), not RPM.",
       "Ubuntu": "Ubuntu is based on Debian and uses .deb packages."}, level=3, form=J)

S("1.1", "Why can't you install the usual 64-bit PC (x86-64) edition of a distribution on a Raspberry Pi?",
  ["✔The Pi has an ARM processor, so it needs an ARM build such as Raspbian",
   "The Pi has no USB ports, so it can't boot from any installer media",
   "Linux can't run on a computer that has no internal hard disk",
   "Raspbian is proprietary, so other distributions aren't allowed on the Pi"],
  "Programs are compiled for a processor architecture. A PC edition is built for x86-64; the Raspberry Pi uses an ARM CPU, so it runs "
  "ARM builds such as Raspbian (now Raspberry Pi OS, based on Debian), usually from an SD card.",
  hint="What kind of processor does a Raspberry Pi have?",
  why={"The Pi has no USB ports, so it can't boot from any installer media": "Raspberry Pis have USB ports; the problem is the processor architecture.",
       "Linux can't run on a computer that has no internal hard disk": "Linux runs fine from an SD card, which is how a Pi normally boots.",
       "Raspbian is proprietary, so other distributions aren't allowed on the Pi": "Raspbian is a free Debian-based distribution, and other ARM distributions run on the Pi too."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 1.2 (2)
S("1.2", "On Ubuntu, `sudo dpkg -i app.deb` stops with \"dependency problems\". What's the usual fix?",
  ["✔Run `sudo apt-get install -f` so apt fetches the missing packages",
   "Install the same file again with `sudo rpm -i app.deb` instead",
   "Run `sudo yum install app.deb` to resolve the dependencies",
   "Delete the /var/lib/dpkg directory and then run dpkg -i once more"],
  "dpkg installs a single package file but doesn't download anything. apt works with the repositories: `apt-get install -f` (fix broken) "
  "installs the missing dependencies and finishes the setup. Installing the file with `sudo apt install ./app.deb` avoids the problem in the first place.",
  hint="dpkg is the low-level tool. Which tool knows about repositories?",
  why={"Install the same file again with `sudo rpm -i app.deb` instead": "rpm handles .rpm packages on Red Hat-family systems, not .deb files.",
       "Run `sudo yum install app.deb` to resolve the dependencies": "yum is the Red Hat-family package manager and isn't used on Ubuntu.",
       "Delete the /var/lib/dpkg directory and then run dpkg -i once more": "That deletes the database of installed packages and would break the system."},
  level=3, form=J)

S("1.2", "A designer needs to retouch photos and a clerk needs an email client with a calendar, both with open source software on Linux. Which pair fits?",
  ["✔GIMP and Thunderbird", "LibreOffice Impress and Firefox", "Apache HTTPD and MariaDB", "Nextcloud and Samba"],
  "GIMP is the open source raster image editor. Thunderbird is Mozilla's email client, with a built-in calendar.",
  hint="One image editor, one mail program.",
  why={"LibreOffice Impress and Firefox": "Impress makes presentations and Firefox is a web browser; neither retouches photos or handles mail.",
       "Apache HTTPD and MariaDB": "These are server programs: a web server and a database.",
       "Nextcloud and Samba": "These share files over a network; they aren't a photo editor and a mail client."},
  level=2, form=J)

# ------------------------------------------------------------------------------------------ 1.3 (1)
S("1.3", "A photographer wants others to share and adapt her photos as long as they credit her and don't use them commercially. "
  "She doesn't mind how adaptations are licensed. Which license fits best?",
  ["✔CC BY-NC (Attribution-NonCommercial)", "CC BY-SA (Attribution-ShareAlike)", "CC0 (Creative Commons public domain dedication)", "GNU GPL version 3"],
  "Creative Commons licenses combine conditions: BY requires attribution, NC forbids commercial use, SA requires adaptations to use the same "
  "license, and ND forbids adaptations. Credit plus no commercial use, with nothing else required, is CC BY-NC.",
  hint="Pick the license elements: credit (BY) and no commercial use (NC).",
  why={"CC BY-SA (Attribution-ShareAlike)": "BY-SA allows commercial use and requires adaptations to use the same license.",
       "CC0 (Creative Commons public domain dedication)": "CC0 gives up all rights, including the right to be credited.",
       "GNU GPL version 3": "The GPL is a software license and allows commercial use."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 1.4 (2)
S("1.4", "A user's old laptop with 2 GB of RAM feels slow in the GNOME desktop. They still want a full graphical desktop. What's the best change?",
  ["✔Switch to a lightweight desktop environment such as Xfce",
   "Remove the X Window System to free memory",
   "Switch to KDE Plasma, since it always uses less memory than GNOME",
   "Work only in a text console from now on"],
  "Desktop environments differ in how many resources they use. Xfce (or LXQt) is designed to be light, while GNOME and KDE Plasma are more "
  "feature-rich and heavier. You can install another desktop environment and pick it at the login screen.",
  hint="The user wants to keep a graphical desktop, just a lighter one.",
  why={"Remove the X Window System to free memory": "Without a display server there's no graphical desktop at all.",
       "Switch to KDE Plasma, since it always uses less memory than GNOME": "KDE Plasma is also a full-featured desktop; it isn't the lightweight choice.",
       "Work only in a text console from now on": "That gives up the graphical desktop the user wants to keep."},
  level=3, form=J)

S("1.4", "A small business wants web-based email, calendars and office documents. It doesn't want to install, run or update any of the software itself. Which cloud service model is this?",
  ["✔Software as a Service (SaaS)", "Infrastructure as a Service (IaaS)", "Platform as a Service (PaaS)", "Virtualization on its own server"],
  "In SaaS the provider runs the whole application and users just use it, usually in a browser. With IaaS you rent virtual machines and manage "
  "their operating systems; with PaaS you deploy your own code and the provider runs the platform underneath.",
  hint="Who installs and maintains the application itself?",
  why={"Infrastructure as a Service (IaaS)": "With IaaS the customer still installs and maintains the operating system and applications.",
       "Platform as a Service (PaaS)": "PaaS is for running code you write; the business wants finished applications.",
       "Virtualization on its own server": "Running its own virtual machines means installing and updating everything itself."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 2.1 (3)
S("2.1", "What does `ls` show after these commands, run in an empty directory?",
  ["✔Two files: `my` and `notes.txt`", "One file: `my notes.txt`", "One file: `$file`", "Nothing, because touch fails without quotes"],
  "Without quotes, the shell splits the variable's value at the space, so touch gets two arguments and creates two files. "
  "`touch \"$file\"` keeps the value together as one name.",
  code='file="my notes.txt"\ntouch $file\nls',
  run='file="my notes.txt"\ntouch $file\nls', expect="my\nnotes.txt",
  hint="What does the shell do with an unquoted variable whose value contains a space?",
  why={"One file: `my notes.txt`": "That's what `touch \"$file\"` would do. Unquoted, the value is split into two words.",
       "One file: `$file`": "The variable is expanded; single quotes would be needed to keep `$file` literally.",
       "Nothing, because touch fails without quotes": "touch works, it just receives two names instead of one."},
  level=3, form=J)

S("2.1", "What does the `bash -c` command print?",
  ["✔`[]`, because city wasn't exported to the child shell", "`[Paris]`, because shell variables are visible to every program",
   "`[$city]`, because the variable isn't expanded inside quotes", "An error, because city is only defined in the parent"],
  "A variable set without `export` is a shell variable: only the current shell has it. A program or child shell started from it gets only the "
  "environment (exported variables). After `export city`, the child would print `[Paris]`.",
  code="$ city=Paris\n$ bash -c 'echo \"[$city]\"'",
  run="city=Paris\nbash -c 'echo \"[$city]\"'", expect="[]",
  hint="What's the difference between a shell variable and an environment variable?",
  why={"`[Paris]`, because shell variables are visible to every program": "Only exported (environment) variables are passed to child processes.",
       "`[$city]`, because the variable isn't expanded inside quotes": "The child shell does expand it, but the variable is empty there, so `[]` is printed.",
       "An error, because city is only defined in the parent": "An undefined variable expands to nothing; it isn't an error."},
  level=3, form=J)

F("2.1", "Type a command that adds the directory /opt/tools/bin to the END of your search path, keeping every directory already in it.",
  ["PATH=$PATH:/opt/tools/bin", "export PATH=$PATH:/opt/tools/bin", 'PATH="$PATH:/opt/tools/bin"', 'export PATH="$PATH:/opt/tools/bin"'],
  "`$PATH` expands to the current list, and a colon separates directories. PATH is already exported, so plain `PATH=...` changes the "
  "environment of programs you start too. Putting the new directory first instead (`/opt/tools/bin:$PATH`) would let it override system commands.",
  hint="Build the new value from the old one: the old value, a colon, then the new directory.",
  lab=lab({}, {"type": "all", "checks": [{"type": "var", "name": "PATH", "regex": r":/opt/tools/bin/?$"}, {"type": "var", "name": "PATH", "regex": r"(^|:)/usr/bin(:|$)"}]},
          ["PATH=/opt/tools/bin", "PATH=/opt/tools/bin:$PATH", "PATH=$PATH;/opt/tools/bin", "echo $PATH:/opt/tools/bin"]),
  level=2, form=J)

# ------------------------------------------------------------------------------------------ 2.2 (2)
S("2.2", "Based on this excerpt from the tar man page, which commands extract backup.tar into /srv? (Choose TWO.)",
  ["✔`tar -xf backup.tar -C /srv`", "✔`tar -xf backup.tar --directory=/srv`", "`tar -xf backup.tar /srv`", "`tar -xf backup.tar -directory /srv`"],
  "The OPTIONS section lists a short form and a long form for the same option. `-C DIR` and `--directory=DIR` are equivalent. "
  "A plain path after the archive name means \"extract only this member\", and long options need two dashes.",
  code="OPTIONS\n   -C, --directory=DIR\n          Change to DIR before performing any operations.\n   -x, --extract, --get\n          Extract files from an archive.",
  hint="Many options have a short form (one dash, one letter) and a long form (two dashes, a word).",
  why={"`tar -xf backup.tar /srv`": "Names after the archive are members to extract, so tar looks for a member called /srv.",
       "`tar -xf backup.tar -directory /srv`": "Long options take two dashes; one dash would be read as the short options -d -i -r ..."},
  level=3, form=J)

S("2.2", "You're reading `man ls`, which opens in the pager less. How do you find each place where the word `sort` appears?",
  ["✔Type `/sort`, press Enter, then `n` for each next match", "Press `Ctrl+F`, type `sort` and press Enter to search",
   "Type `:find sort` and press Enter to jump to each match", "Quit and run `man ls sort`"],
  "In less (and so in man), `/pattern` searches forward, `?pattern` searches backward, `n` repeats the search and `N` goes the other way. "
  "`q` quits.",
  hint="less uses the same search key as vi.",
  why={"Press `Ctrl+F`, type `sort` and press Enter to search": "In less, Ctrl+F scrolls forward one screen; it doesn't search.",
       "Type `:find sort` and press Enter to jump to each match": "less has no :find command; searching starts with a slash.",
       "Quit and run `man ls sort`": "That would open the man page for ls and then one for a command called sort."},
  level=2, form=J)

# ------------------------------------------------------------------------------------------ 2.3 (2)
S("2.3", "A directory contains the hidden file `.bashrc`, the file `notes.txt` and the subdirectory `old`. What does `ls -a` list?",
  ["✔`.  ..  .bashrc  notes.txt  old`", "`.bashrc  notes.txt  old`", "`notes.txt  old`", "`.  ..  notes.txt  old`"],
  "`-a` (all) shows hidden entries, whose names start with a dot, including `.` (this directory) and `..` (the parent). "
  "`-A` (almost all) shows hidden files but leaves out `.` and `..`, and plain `ls` shows neither.",
  run="touch .bashrc notes.txt\nmkdir old\nls -a", expect=".\n..\n.bashrc\nnotes.txt\nold",
  hint="Every directory contains two special entries. Does -a show them?",
  why={"`.bashrc  notes.txt  old`": "That's `ls -A`, which leaves out `.` and `..`.",
       "`notes.txt  old`": "That's plain `ls`, which hides every name starting with a dot.",
       "`.  ..  notes.txt  old`": "-a shows all hidden files, so .bashrc is listed too."},
  level=3, form=J)

S("2.3", "`ls -l docs` prints only `total 0`. What does that tell you?",
  ["✔docs is an empty directory; ls -l lists what's inside it", "docs is a regular file that's empty (0 bytes long)",
   "You don't have permission to read the contents of docs", "docs doesn't exist, so ls has nothing to show"],
  "Given a directory, ls lists its contents; `total` is the space used by them, and an empty directory has none. "
  "To see the directory itself (its permissions, owner and date), use `ls -ld docs`.",
  run="mkdir docs\nls -l docs", expect="total 0",
  hint="What does ls print when it's given a directory, and what if the directory is empty?",
  why={"docs is a regular file that's empty (0 bytes long)": "For a file, ls -l prints a line for the file itself, not a total.",
       "You don't have permission to read the contents of docs": "That gives an error such as \"Permission denied\".",
       "docs doesn't exist, so ls has nothing to show": "That gives \"No such file or directory\"."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 2.4 (2)
F("2.4", "Using a single command, copy every file whose name ends in `.conf` from /etc/app into the existing directory backup in your home directory. Type the full command.",
  ["cp /etc/app/*.conf ~/backup/", "cp /etc/app/*.conf ~/backup", "cp /etc/app/*.conf /home/student/backup/", "cp /etc/app/*.conf /home/student/backup"],
  "The shell expands `*.conf` to every matching name before cp runs. With more than one source, cp's last argument must be a directory, "
  "and the copies go inside it.",
  hint="Use a wildcard for the file names, and make the backup directory the last argument.",
  lab=lab({"files": [{"path": "/etc/app/main.conf", "data": "port=80\n", "owner": "root"}, {"path": "/etc/app/db.conf", "data": "host=db\n", "owner": "root"},
                     {"path": "/etc/app/readme.txt", "data": "notes\n", "owner": "root"}, {"path": "~/backup", "dir": True}]},
          {"type": "all", "checks": [{"type": "exists", "path": HOME + "/backup/main.conf"}, {"type": "exists", "path": HOME + "/backup/db.conf"},
                                     {"type": "absent", "path": HOME + "/backup/readme.txt"}]},
          ["cp /etc/app/* ~/backup/", "cp /etc/app/.conf ~/backup/", "cp /etc/app/main.conf ~/backup/"]),
  level=2, form=J)

S("2.4", "In a directory holding only the files a.txt, b.txt and c.txt, what happens when you run `mv a.txt b.txt c.txt`?",
  ["✔An error, since the last argument must be a directory; nothing moves",
   "a.txt and b.txt are joined together into a single file named c.txt",
   "b.txt replaces c.txt and a.txt stays where it is, so two files remain",
   "A directory named c.txt is created, and the two files are moved into it"],
  "With two arguments, mv renames (or moves) one file. With more, the last one must be an existing directory. Since c.txt is a file, mv "
  "reports that the target is not a directory and changes nothing.",
  run="touch a.txt b.txt c.txt\nmv a.txt b.txt c.txt 2>/dev/null\nls", expect="a.txt\nb.txt\nc.txt",
  hint="With more than two arguments, what does mv expect the last one to be?",
  why={"a.txt and b.txt are joined together into a single file named c.txt": "mv never combines file contents; that's what cat with redirection does.",
       "b.txt replaces c.txt and a.txt stays where it is, so two files remain": "With three arguments mv doesn't rename; it refuses because c.txt isn't a directory.",
       "A directory named c.txt is created, and the two files are moved into it": "mv doesn't create directories, and c.txt already exists as a file."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 3.1 (2)
F("3.1", "Create a bzip2-compressed tar archive named logs.tar.bz2 that contains the directory logs. Type the full command.",
  ["tar -cjf logs.tar.bz2 logs", "tar cjf logs.tar.bz2 logs", "tar -cjvf logs.tar.bz2 logs", "tar -cjf logs.tar.bz2 logs/"],
  "`-c` creates, `-j` compresses with bzip2 and `-f` names the archive file, so `f` comes right before the name. "
  "`-z` would use gzip and `-J` xz.",
  hint="Create, bzip2, file: three short options for tar.",
  lab=lab({"files": [{"path": "~/logs/app.log", "data": "started\n"}, {"path": "~/logs/error.log", "data": "none\n"}]},
          {"type": "archive", "path": HOME + "/logs.tar.bz2", "format": "tar", "compression": "bzip2", "has": ["logs/app.log"]},
          ["tar -czf logs.tar.bz2 logs", "tar -cf logs.tar.bz2 logs", "bzip2 logs"]),
  level=2, form=J)

S("3.1", "After `tar -cf docs.tar docs`, ls shows that docs.tar is slightly larger than all the files in docs added together. Why?",
  ["✔tar adds headers to bundle files and only compresses with -z, -j or -J",
   "tar always stores two copies of each file in case one is damaged",
   "The archive is corrupt, so it has to be deleted and created again",
   "tar compresses text files well, but it makes binary files a lot bigger"],
  "A tar archive holds each file's data plus a header with its name, owner, mode and date, padded to fixed-size blocks, so it's a little "
  "larger than the files themselves. Compression is a separate step: gzip, bzip2 or xz, either on its own or through tar's -z, -j or -J options.",
  hint="Did that tar command include a compression option?",
  why={"tar always stores two copies of each file in case one is damaged": "tar stores each file once.",
       "The archive is corrupt, so it has to be deleted and created again": "Being slightly larger than the input is normal for an uncompressed tar file.",
       "tar compresses text files well, but it makes binary files a lot bigger": "Without -z, -j or -J, tar doesn't compress anything."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 3.2 (3)
S("3.2", "users.csv contains the four lines shown. What does the command print?",
  ["✔dev", "ops", "dept", "adam"],
  "`tail -n +2` prints from line 2 on, skipping the header. `cut -d, -f2` keeps the second comma-separated field (dept), `sort` puts "
  "dev, dev, ops in order, and `head -n 1` keeps the first line: dev.",
  code="$ cat users.csv\nname,dept\nzoe,ops\nadam,dev\nmia,dev\n$ tail -n +2 users.csv | cut -d, -f2 | sort | head -n 1",
  run="printf 'name,dept\\nzoe,ops\\nadam,dev\\nmia,dev\\n' > users.csv\ntail -n +2 users.csv | cut -d, -f2 | sort | head -n 1", expect="OPT",
  hint="Follow the data through each command in the pipe, one at a time.",
  why={"ops": "After sorting, dev comes before ops, and head keeps only the first line.",
       "dept": "`tail -n +2` starts at line 2, so the header line is skipped.",
       "adam": "cut keeps field 2, the department, not the name."},
  level=3, form=J)

F("3.2", "Save every line of /var/log/app.log that contains ERROR into the file errors.txt in your current directory, replacing any old errors.txt. Type the full command.",
  ["grep ERROR /var/log/app.log > errors.txt", "grep 'ERROR' /var/log/app.log > errors.txt", 'grep "ERROR" /var/log/app.log > errors.txt'],
  "grep prints the matching lines and `>` redirects standard output into a file, creating it or replacing its contents. "
  "`>>` would append instead, and `cat file | grep ERROR > errors.txt` works too, with one extra process.",
  hint="grep finds the lines; a redirection operator saves them.",
  lab=lab({"files": [{"path": "/var/log/app.log", "data": "09:00 INFO start\n09:01 ERROR disk full\n09:02 INFO retry\n09:03 ERROR disk full\n", "owner": "root"}]},
          {"type": "equals", "path": HOME + "/errors.txt", "text": "09:01 ERROR disk full\n09:03 ERROR disk full\n"},
          ["grep ERROR /var/log/app.log", "grep -v ERROR /var/log/app.log > errors.txt", "grep ERROR > errors.txt /var/log/app.log | head -1 > errors.txt",
           "grep -c ERROR /var/log/app.log > errors.txt"]),
  level=2, form=J)

S("3.2", "notes.txt has two lines. What is the difference between the two outputs?",
  ["✔The second shows just the number: wc reads stdin and never sees the name",
   "The second counts the words in the file instead of the lines",
   "The second shows 0, because wc can't read anything from a redirection",
   "There's no difference: both commands print `2 notes.txt` exactly the same way"],
  "Given a file name, wc prints the count and the name. With `<`, the shell opens the file and connects it to wc's standard input, so wc "
  "only sees data and prints just the number, which is handy in scripts.",
  code="$ wc -l notes.txt\n2 notes.txt\n$ wc -l < notes.txt\n?",
  run="printf 'a\\nb\\n' > notes.txt\nwc -l < notes.txt", expect="2",
  hint="With `<`, who opens the file: wc or the shell?",
  why={"The second counts the words in the file instead of the lines": "-l still counts lines; only the input method changed.",
       "The second shows 0, because wc can't read anything from a redirection": "wc reads standard input when it has no file arguments.",
       "There's no difference: both commands print `2 notes.txt` exactly the same way": "wc can't print a file name it was never given."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 3.3 (4)
S("3.3", "check.sh contains the lines shown. What does `./check.sh /no/such/file; echo $?` print?",
  ["✔2", "0", "1", "ok, then 0"],
  "`[ -f \"$1\" ]` fails because the file doesn't exist, so the command after `||` runs: `exit 2` ends the script with status 2. "
  "`echo $?` prints the status of the last command, the script.",
  code='#!/bin/bash\n[ -f "$1" ] || exit 2\necho "ok"',
  run="printf '#!/bin/bash\\n[ -f \"$1\" ] || exit 2\\necho \"ok\"\\n' > check.sh\nchmod +x check.sh\n./check.sh /no/such/file\necho $?", expect="2",
  hint="`a || b` runs b only when a fails. What does exit do with its number?",
  why={"0": "0 would mean success, but the script exits early with status 2.",
       "1": "The test itself fails with 1, but `exit 2` sets the script's status.",
       "ok, then 0": "`exit 2` stops the script before the echo line."},
  level=3, form=J)

S("3.3", "What does this script print?",
  ["✔found, then 0", "found, then 1", "missing, then 1", "found, and nothing else"],
  "`grep -q` prints nothing but exits 0 when it finds a match; root is always in /etc/passwd, so `then` runs. The exit status of an if "
  "statement is that of the last command it ran (`echo found`, which succeeds), so `$?` is 0.",
  code="#!/bin/bash\nif grep -q root /etc/passwd; then\n  echo found\nelse\n  echo missing\nfi\necho $?",
  run="printf '#!/bin/bash\\nif grep -q root /etc/passwd; then\\n  echo found\\nelse\\n  echo missing\\nfi\\necho $?\\n' > s.sh\nbash s.sh", expect="found\n0",
  hint="if tests a command's exit status. What's the status after the if statement finishes?",
  why={"found, then 1": "The last command run inside the if was `echo found`, which succeeded.",
       "missing, then 1": "root is always listed in /etc/passwd, so grep succeeds.",
       "found, and nothing else": "The last line echoes $? after the if statement."},
  level=3, form=J)

F("3.3", "Make the script deploy.sh in the current directory executable for its owner only, without changing any other permission. Type the full command.",
  ["chmod u+x deploy.sh", "chmod 744 deploy.sh"],
  "`u+x` adds execute for the user (owner) and leaves group and other alone, so `rw-r--r--` becomes `rwxr--r--` (744). "
  "`chmod +x` would add execute for everyone.",
  hint="chmod with a symbolic mode: who, +, what.",
  lab=lab({"files": [{"path": "~/deploy.sh", "data": "#!/bin/bash\necho deploying\n", "mode": 0o644}]},
          {"type": "perms", "path": HOME + "/deploy.sh", "perms": "-rwxr--r--"},
          ["chmod +x deploy.sh", "chmod 755 deploy.sh", "chmod a+x deploy.sh", "chmod 700 deploy.sh"]),
  level=2, form=J)

S("3.3", "greet.sh contains the lines shown. How many lines does `./greet.sh Ana \"Bo Li\"` print?",
  ["✔2", "3", "1", "0"],
  "`\"$@\"` expands to every argument as a separate word, keeping each one exactly as given. \"Bo Li\" was quoted on the command line, so it "
  "is one argument: the loop runs twice and prints `Hello Ana` and `Hello Bo Li`. An unquoted `$@` would split it into Bo and Li.",
  code='#!/bin/bash\nfor name in "$@"; do\n  echo "Hello $name"\ndone',
  run="printf '#!/bin/bash\\nfor name in \"$@\"; do\\n  echo \"Hello $name\"\\ndone\\n' > greet.sh\nbash greet.sh Ana \"Bo Li\" | wc -l", expect="2",
  hint="How many arguments does the script receive?",
  why={"3": "\"Bo Li\" is one quoted argument, and \"$@\" keeps it whole.",
       "1": "The for loop runs once per argument, not once in total.",
       "0": "\"$@\" holds the two arguments, so the loop runs."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 4.1 (1)
S("4.1", "A company's desktops must get security fixes for years without surprise feature changes, and its accounting software is certified only for specific distribution versions. Which kind of release fits?",
  ["✔An enterprise or long-term support (LTS) release", "A rolling release that always ships the newest versions",
   "The current beta, so fixes arrive sooner", "Any release, as long as updates are switched off"],
  "LTS and enterprise releases keep the same versions for years and only receive fixes, which is what vendors certify against. "
  "Rolling releases change constantly, betas are for testing, and switching updates off leaves security holes open.",
  hint="Which release type promises years of fixes with as few changes as possible?",
  why={"A rolling release that always ships the newest versions": "Rolling releases change continuously, the opposite of what's needed.",
       "The current beta, so fixes arrive sooner": "Betas are unfinished test versions and aren't meant for production.",
       "Any release, as long as updates are switched off": "Without updates the desktops would stop getting security fixes."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 4.2 (2)
S("4.2", "A USB stick is plugged in. The kernel names the disk sdb and finds one partition on it. Which device file is the partition you would mount?",
  ["✔/dev/sdb1", "/dev/sdb", "/dev/usb1", "/sys/block/sdb"],
  "Disks appear as /dev/sda, /dev/sdb, ... and their partitions add a number: /dev/sdb1 is the first partition on the second disk. "
  "/dev/sdb is the whole disk, and /sys holds information about devices rather than device files to mount.",
  hint="Whole disks are letters; partitions add a number.",
  why={"/dev/sdb": "That's the whole disk, including its partition table, not the partition.",
       "/dev/usb1": "USB disks use the same sd naming as other disks.",
       "/sys/block/sdb": "/sys shows device information from the kernel; you mount the device file in /dev."},
  level=2, form=J)

S("4.2", "A network card works in Windows but doesn't show up after installing Linux on the same computer. The hardware is fine. What is most likely missing?",
  ["✔A Linux driver (kernel module) for that card", "A swap partition big enough for the card's buffers", "The X Window System, which detects network hardware", "A newer version of the bash shell"],
  "Hardware works only when the kernel has a driver for it. Most drivers ship with the kernel as modules, but very new or unusual hardware may "
  "need a newer kernel or a driver package (sometimes firmware) from the distribution or the vendor.",
  hint="Which part of the system talks to the hardware?",
  why={"A swap partition big enough for the card's buffers": "Swap is disk space used as extra memory; it doesn't make devices work.",
       "The X Window System, which detects network hardware": "X is the graphical display system and has nothing to do with network cards.",
       "A newer version of the bash shell": "bash is a shell; hardware support comes from the kernel."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 4.3 (3)
S("4.3", "What can you conclude from these kernel messages, which appeared right after a USB drive was plugged in?",
  ["✔A 32 GB USB disk was detected as /dev/sdc, with two partitions",
   "The drive was mounted automatically on /media/sdc by the kernel",
   "The drive failed its checks and the kernel disconnected it again",
   "This is the fourth USB disk, so it's named /dev/sd4"],
  "dmesg shows the kernel ring buffer: the USB device was found, recognised as mass storage, named sdc with its size, and the partition "
  "table lists sdc1 and sdc2. Mounting is a separate step and doesn't show up here.",
  code="$ sudo dmesg | tail -4\n[ 9120.44] usb 2-1: new high-speed USB device number 4 using xhci_hcd\n[ 9120.61] usb-storage 2-1:1.0: USB Mass Storage device detected\n"
       "[ 9121.65] sd 3:0:0:0: [sdc] 62914560 512-byte logical blocks: (32.2 GB/30.0 GiB)\n[ 9121.68]  sdc: sdc1 sdc2",
  hint="Look for the device name and the partition list.",
  why={"The drive was mounted automatically on /media/sdc by the kernel": "Nothing in these lines mentions mounting; that happens later, if at all.",
       "The drive failed its checks and the kernel disconnected it again": "The messages show a normal detection with no errors.",
       "This is the fourth USB disk, so it's named /dev/sd4": "\"device number 4\" is the USB bus number; the disk is named sdc."},
  level=3, form=J)

S("4.3", "An administrator wants to change the SSH server's settings, and then find out why it failed to start yesterday. Where should they look?",
  ["✔/etc for the settings, then /var/log for the logs", "/var/log for the settings, then /etc for the logs",
   "/proc for the settings, then /boot for the logs", "/usr/bin for the settings, then /dev for the logs"],
  "System-wide configuration lives in /etc (for SSH, /etc/ssh/sshd_config). Logs are written under /var/log (such as /var/log/auth.log or "
  "/var/log/syslog), or kept in the systemd journal.",
  hint="One directory holds configuration files; another holds data that changes, such as logs.",
  why={"/var/log for the settings, then /etc for the logs": "That's the wrong way round.",
       "/proc for the settings, then /boot for the logs": "/proc is generated by the kernel at runtime, and /boot holds the kernel and boot loader files.",
       "/usr/bin for the settings, then /dev for the logs": "/usr/bin holds programs and /dev holds device files."},
  level=2, form=J)

S("4.3", "Which statements about this output are true? (Choose TWO.)",
  ["✔ana is logged in remotely from 192.168.1.20", "✔root's session ended because the system went down without a clean shutdown",
   "ana is logged in at the physical console", "root is still logged in on tty1"],
  "last reads the login records in /var/log/wtmp. A host address in the third column means a remote (network) login, and `pts/0` is a "
  "pseudo-terminal, as used by SSH. `- crash` means the session was still open when the system went down without logging it out; the reboot line follows.",
  code="$ last -n 3\nana      pts/0        192.168.1.20     Fri Oct  9 08:58   still logged in\n"
       "reboot   system boot  6.8.0-45-generic Fri Oct  9 08:55   still running\nroot     tty1                          Thu Oct  8 23:41 - crash  (00:02)",
  hint="Look at the terminal names and the end of each line.",
  why={"ana is logged in at the physical console": "pts/0 and a remote address mean a network login; the console would be tty1.",
       "root is still logged in on tty1": "root's line ends in \"crash\", so that session is over."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 4.4 (2)
S("4.4", "`ping 8.8.8.8` gets replies, but `ping example.com` says \"Temporary failure in name resolution\". Which file do you check first?",
  ["✔/etc/resolv.conf", "/etc/hostname", "/etc/passwd", "/etc/network/interfaces"],
  "Reaching an address proves the network and the gateway work; failing on a name points at DNS. /etc/resolv.conf lists the name servers "
  "(`nameserver` lines) the resolver asks. /etc/hosts is the other place names are looked up.",
  hint="Addresses work and names don't. Which file tells the system where to ask about names?",
  why={"/etc/hostname": "That file holds this computer's own name, not where to look up other names.",
       "/etc/passwd": "That's the user account database.",
       "/etc/network/interfaces": "That configures network interfaces, and the network already works: 8.8.8.8 answers."},
  level=3, form=J)

S("4.4", "SSH and the website on this server work from other computers, but a remote client can't reach the database on port 3306. Based on the output, why?",
  ["✔The database listens only on 127.0.0.1, so only local clients can connect",
   "Nothing on this server is listening on TCP port 3306 at the moment",
   "The database uses UDP, and ss -tln never shows UDP sockets at all",
   "Port 3306 is reserved for root, so remote users can never connect to it"],
  "`ss -tln` lists listening TCP sockets with numeric ports. 0.0.0.0 or * means all addresses; 127.0.0.1 is the loopback address, reachable "
  "only from the machine itself. Databases often listen only on localhost for safety.",
  code="$ ss -tln\nState   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port\nLISTEN  0       128           0.0.0.0:22         0.0.0.0:*\n"
       "LISTEN  0       80          127.0.0.1:3306       0.0.0.0:*\nLISTEN  0       511                 *:80               *:*",
  hint="Compare the local address of the database socket with the other two.",
  why={"Nothing on this server is listening on TCP port 3306 at the moment": "The second line shows a socket listening on port 3306.",
       "The database uses UDP, and ss -tln never shows UDP sockets at all": "-t shows TCP, and the database is listed there.",
       "Port 3306 is reserved for root, so remote users can never connect to it": "Only ports below 1024 need root to listen on, and that wouldn't stop remote clients anyway."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 5.1 (2)
S("5.1", "Which accounts in this part of /etc/passwd belong to people rather than to services? (Choose TWO.)",
  ["✔ana", "✔bob", "root", "www-data"],
  "On most distributions regular users get UIDs from 1000 up and a real login shell. root (UID 0) is the administrator account, and system "
  "accounts such as www-data and sshd have low UIDs and a shell like /usr/sbin/nologin, so nobody can log in as them.",
  code="root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nsshd:x:110:65534::/run/sshd:/usr/sbin/nologin\n"
       "ana:x:1000:1000:Ana Silva:/home/ana:/bin/bash\nbob:x:1001:1001:Bob Lee:/home/bob:/bin/bash",
  hint="Look at the third field (UID) and the last field (shell).",
  why={"root": "root is the superuser, an administrative account, not a regular person's account.",
       "www-data": "UID 33 and the nologin shell mark a system account used by the web server."},
  level=3, form=J)

S("5.1", "On an Ubuntu system, which statements follow from this output? (Choose TWO.)",
  ["✔ana may run commands as root with sudo", "✔ana can read many log files in /var/log through the adm group",
   "ana is the root user", "ana's primary group is sudo"],
  "id shows the user, the primary group (gid) and all groups. On Debian and Ubuntu, members of the sudo group may use sudo, and the adm "
  "group may read most system logs. The UID is 1000, not 0, and the primary group is ana.",
  code="$ id\nuid=1000(ana) gid=1000(ana) groups=1000(ana),4(adm),27(sudo)",
  hint="Read uid, gid and groups separately.",
  why={"ana is the root user": "root has UID 0; ana's UID is 1000.",
       "ana's primary group is sudo": "The primary group is shown after gid=, and it's ana."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 5.2 (2)
F("5.2", "Create the group auditors and then add the existing user kim to it, keeping her current groups. Do both in one line, running the second command only if the first succeeds.",
  ["sudo groupadd auditors && sudo usermod -aG auditors kim", "sudo groupadd auditors && sudo usermod -a -G auditors kim"],
  "`&&` runs the second command only if the first one exits with status 0. usermod's `-aG` appends a supplementary group; `-G` alone would "
  "replace all of kim's groups. `sudo gpasswd -a kim auditors` adds her too.",
  hint="groupadd creates the group; usermod with two options adds a user to it without removing others.",
  lab=lab({"groups": [{"name": "staff", "gid": 2050}], "users": [{"name": "kim", "groups": ["staff"]}]},
          {"type": "all", "checks": [{"type": "group", "name": "auditors", "members": ["kim"]}, {"type": "user", "name": "kim", "groups": ["auditors", "staff"]}]},
          ["sudo groupadd auditors && sudo usermod -G auditors kim", "groupadd auditors && usermod -aG auditors kim", "sudo groupadd auditors"]),
  level=3, form=J)

S("5.2", "An employee has left, and an administrator ran `sudo userdel sam`. What is left on the system?",
  ["✔sam's home directory and its files, because userdel doesn't delete them without -r",
   "Nothing: userdel always removes the account, the home directory and every file sam owned",
   "Only sam's entry in /etc/passwd",
   "The account, which is now locked but can be unlocked with passwd"],
  "userdel removes the account from /etc/passwd, /etc/shadow and /etc/group. Without `-r` it leaves /home/sam alone; files elsewhere still "
  "belong to sam's old UID number and show it in ls -l, until they're removed or given to someone else.",
  hint="Which userdel option also removes the home directory?",
  why={"Nothing: userdel always removes the account, the home directory and every file sam owned": "Without -r the home directory stays, and userdel never searches for files elsewhere.",
       "Only sam's entry in /etc/passwd": "userdel removes the passwd entry, along with the shadow and group entries.",
       "The account, which is now locked but can be unlocked with passwd": "The account is deleted, not locked; `passwd -l` would lock it."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 5.3 (2)
F("5.3", "Give the directory site and everything inside it to the user www-data and the group www-data, using one command. You have sudo.",
  ["sudo chown -R www-data:www-data site", "sudo chown -R www-data:www-data site/", "sudo chown --recursive www-data:www-data site"],
  "chown sets the owner and, after a colon, the group; `-R` applies it to the directory and everything below it.",
  hint="chown takes OWNER:GROUP, and one option makes it recursive.",
  lab=lab({"files": [{"path": "~/site/index.html", "data": "<h1>Hi</h1>\n"}, {"path": "~/site/css/style.css", "data": "body{}\n"}]},
          {"type": "all", "checks": [{"type": "owner", "path": HOME + "/site", "user": "www-data", "group": "www-data"},
                                     {"type": "owner", "path": HOME + "/site/css/style.css", "user": "www-data", "group": "www-data"}]},
          ["sudo chown www-data:www-data site", "sudo chown -R www-data site", "chown -R www-data:www-data site"]),
  level=2, form=J)

S("5.3", "bob doesn't own the directory shared and isn't in the group staff. The file info.txt inside shared has mode 644. What can bob do?",
  ["✔Read info.txt by its path, but not list shared", "List the names in shared, but not read info.txt",
   "Nothing at all, because others have no r on shared", "Delete info.txt, since the file is readable by others"],
  "For others the directory has only `x`: bob may pass through it and open a file whose name he knows, but without `r` he can't list the "
  "names, and without `w` he can't create or delete files. The file's own mode (644) lets everyone read it.",
  code="$ ls -ld shared\ndrwxr-x--x 2 root staff 4096 Oct 10 09:00 shared",
  hint="On a directory, r lets you list names, w lets you create and delete entries, and x lets you go through it.",
  why={"List the names in shared, but not read info.txt": "Listing needs r on the directory, which others don't have.",
       "Nothing at all, because others have no r on shared": "x on the directory still lets bob open files whose names he knows.",
       "Delete info.txt, since the file is readable by others": "Deleting needs w on the directory."},
  level=3, form=J)

# ------------------------------------------------------------------------------------------ 5.4 (1)
F("5.4", "In the current directory, create a hard link named copy.txt for the file data.txt. Type the full command.",
  ["ln data.txt copy.txt"],
  "Without -s, ln makes a hard link: a second name for the same inode, so both names show the same data and `ls -li` shows the same inode "
  "number and a link count of 2. `ln -s` would make a symbolic link instead.",
  hint="ln TARGET LINKNAME, without the option for symbolic links.",
  lab=lab({"files": [{"path": "~/data.txt", "data": "42\n"}]},
          {"type": "hardlink", "path": HOME + "/copy.txt", "other": HOME + "/data.txt"},
          ["ln -s data.txt copy.txt", "cp data.txt copy.txt", "ln copy.txt data.txt"]),
  level=2, form=J)
