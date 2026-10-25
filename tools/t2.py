# SPDX-License-Identifier: AGPL-3.0-or-later
from common import S, F

# ---------------- 2.1 Command Line Basics (18) ----------------
S("2.1", "What does this command print?",
  ["✔Home is $HOME", "Home is /home/carol", "Home is", "Home is HOME"],
  "Single quotes are strong quotes: nothing inside them is expanded, so `$HOME` prints literally. With double quotes (\"Home is $HOME\") Bash would substitute the value, such as /home/carol.",
  code="$ echo 'Home is $HOME'",
  run="echo 'Home is $HOME'", expect="OPT")
F("2.1", "Type the Bash builtin that marks a variable so it is passed on to child processes as an environment variable.",
  ["export"],
  "`export VAR` (or `export VAR=value`) puts the variable into the environment of programs started from that shell. Without export it stays a local shell variable, invisible to child processes.",
  run="X=42; {A} X; bash -c 'echo $X'", expect="42")
S("2.1", "Which command reports whether `cd` is a shell builtin, an alias, or an external program?",
  ["✔type cd", "which cd", "whereis cd", "file cd"],
  "`type` is a Bash builtin that identifies builtins, aliases, functions, keywords and files. `which` only searches PATH for executables, so it cannot report builtins. `whereis` locates binary, source and man page files, and `file` identifies a file's content type.",
  run="type cd", expect="cd is a shell builtin")
S("2.1", "What does the second command print?",
  ["✔I use 'Linux'", "I use '$OS'", "I use Linux", "I use $OS"],
  "The outer quotes are double quotes, so `$OS` is expanded. The single quotes inside are just ordinary characters within the double-quoted string, so they print around the value.",
  code="$ OS=Linux\n$ echo \"I use '$OS'\"",
  run="OS=Linux\necho \"I use '$OS'\"", expect="OPT")
F("2.1", "Type the Bash builtin that lists your previously entered commands.",
  ["history"],
  "`history` lists commands from the current session, loaded from ~/.bash_history at startup. `!n` reruns entry number n, `!!` reruns the last command, and Ctrl+R searches the history interactively.",
  run="type -t {A}", expect="builtin")
S("2.1", "Which command adds /opt/tools/bin to the end of the search path without removing the existing directories?",
  ["✔PATH=$PATH:/opt/tools/bin", "PATH=/opt/tools/bin", "PATH=$PATH;/opt/tools/bin", "$PATH=$PATH:/opt/tools/bin"],
  "PATH entries are separated by colons, and `$PATH` expands to the current value. Assigning only /opt/tools/bin replaces the whole list, so commands like `ls` are no longer found. A semicolon ends a command (Windows uses semicolons in its own Path variable), and `$` never goes on the left side of an assignment.",
  run="PATH=/usr/bin:/bin; PATH=$PATH:/opt/tools/bin; echo $PATH", expect="/usr/bin:/bin:/opt/tools/bin")
S("2.1", "A shell prompt ends with `#` instead of `$`. What does that indicate?",
  ["✔You are working as root, the superuser", "The previous command returned an error",
   "You are currently in your home directory", "The shell is waiting for more input"],
  "By convention `$` ends a regular user's prompt and `#` ends root's prompt. A `>` continuation prompt appears when the shell needs more input, and `~` in the prompt shows that you are in your home directory.")
S("2.1", "In the command `ls -l /etc`, what is `/etc`?",
  ["✔An argument", "An option", "The command", "An environment variable"],
  "The general syntax is `command [options] [arguments]`. `ls` is the command, `-l` is an option that changes its behavior, and `/etc` is the argument it acts on. Short options can be combined, as in `ls -la`.")
S("2.1", "Which command creates a single file named `my file.txt` (with a space in the name)?",
  ["✔touch my\\ file.txt", "touch my file.txt", "touch my/file.txt", "touch $my file.txt"],
  "A backslash escapes the next character, so the space becomes part of the name. Quotes work too (`touch \"my file.txt\"`). Without escaping, `touch my file.txt` creates two files, my and file.txt. A `/` is a directory separator and cannot appear in a filename.",
  run="touch my\\ file.txt; ls", expect="my file.txt")
S("2.1", "A user runs these two commands. What does the second one print?",
  ["✔An empty line", "blue", "$color", "bash: color: not found"],
  "`color=blue` creates a local variable that child processes do not inherit. `bash -c` starts a new shell, and the single quotes make sure that the child shell, which has no `color` variable, expands `$color`. Running `export color` first would make it print blue.",
  code="$ color=blue\n$ bash -c 'echo $color'",
  run="color=blue\nbash -c 'echo \"[$color]\"'", expect="[]")
F("2.1", "Type the command (no arguments) that prints all environment variables.",
  ["env", "printenv"],
  "`env` and `printenv` list exported environment variables. `set` lists all shell variables and functions, including local ones, and `echo $VAR` shows a single variable.",
  run="export ZZTEST=1; {A} | grep -c '^ZZTEST=1$'", expect="1")
S("2.1", "Which command removes the variable `temp` from the current shell?",
  ["✔unset temp", "unset $temp", "rm temp", "export -d temp"],
  "`unset name` deletes a variable, and you pass the name without `$`. `unset $temp` would try to unset a variable named after temp's value. `rm` deletes files, and export has no `-d` option.",
  run="temp=5; unset temp; echo \"[${temp}]\"", expect="[]")
S("2.1", "Which history shortcut reruns the previous command?",
  ["✔!!", "!$", "$!", "#!"],
  "`!!` repeats the last command, which is handy as `sudo !!`. `!$` reuses the last argument of the previous command, `$!` holds the PID of the last background job, and `#!` starts a script's shebang line.")
S("2.1", "What does this command print?",
  ["✔Price: $5", "Price: \\$5", "Price: 5", "Price: "],
  "Inside double quotes `$` still triggers expansion, so `$5` alone would expand to the empty fifth positional parameter. The backslash escapes the `$`, so it prints literally and the backslash is removed.",
  code="$ echo \"Price: \\$5\"",
  run="echo \"Price: \\$5\"", expect="OPT")
S("2.1", "Which commands are shell builtins rather than separate programs on disk?",
  ["✔cd", "✔export", "ls", "cat", "grep"],
  "Builtins such as `cd`, `export`, `type`, `history` and `exit` are part of Bash, and `cd` must be built in because a child process could not change the shell's directory. `ls`, `cat` and `grep` are external programs found through PATH, such as /usr/bin/ls.",
  run="for c in cd export ls cat grep; do printf '%s=%s ' $c $(type -t $c); done", expect="cd=builtin export=builtin ls=file cat=file grep=file")
S("2.1", "What does `TZ=UTC date` do?",
  ["✔Runs date with TZ set to UTC for that command only",
   "Permanently changes the system's time zone to UTC",
   "Sets TZ in the current shell for all later commands",
   "Fails, because a variable cannot precede a command"],
  "An assignment placed before a command sets that variable only in that command's environment. The shell's own TZ is unchanged afterwards. Changing the system time zone requires root and tools such as timedatectl.",
  run="unset TZ; TZ=UTC date >/dev/null; echo \"[${TZ}]\"", expect="[]")
F("2.1", "Type the name of the environment variable that holds the colon-separated list of directories the shell searches for commands.",
  ["PATH", "$PATH"],
  "PATH lists directories such as /usr/local/bin:/usr/bin:/bin. The current directory is normally not included, which is why you run local scripts as `./script.sh`. Names are case-sensitive, so `path` is a different variable.")
S("2.1", "Which expression expands to the same value as `$USER`?",
  ["✔${USER}", "$(USER)", "%USER%", "$[USER]"],
  "Braces are an alternate form of variable expansion, useful for things like `${USER}_backup`. `$(USER)` is command substitution and would try to run a command named USER. `%USER%` is Windows cmd.exe syntax.",
  run="USER=carol; echo ${USER}", expect="carol")

# ---------------- 2.2 Using the Command Line to Get Help (12) ----------------
S("2.2", "Which man page section documents file formats and configuration files such as /etc/passwd?",
  ["✔Section 5", "Section 1", "Section 3", "Section 8"],
  "Section 1 is user commands, 2 is system calls, 3 is library functions, 5 is file formats and configuration files, 7 is miscellaneous, and 8 is system administration commands. `man 5 passwd` shows the file format, and `man passwd` shows the command from section 1.")
S("2.2", "Besides man and info pages, where do many packages install extra documentation such as README and changelog files?",
  ["✔/usr/share/doc/", "/etc/doc/", "/var/log/doc/", "/boot/doc/"],
  "Packages place additional documentation in /usr/share/doc/<package>/, typically as a README, changelog and sometimes example configuration files. /etc holds configuration, /var/log holds logs, and /boot holds the kernel and boot loader files.")
S("2.2", "Which command searches the names and short descriptions of all man pages for a keyword?",
  ["✔apropos", "whatis", "info", "locate"],
  "`apropos keyword` (the same as `man -k keyword`) searches man page names and descriptions. `whatis` shows the one-line description for an exact name, `info` opens Info documentation, and `locate` finds files by name.")
F("2.2", "Type the command that quickly finds files by name using a prebuilt database (refreshed by updatedb).",
  ["locate"],
  "`locate` searches a database instead of the live filesystem, so it is fast but can miss files created since the last `updatedb` run. `find` searches the live filesystem each time, so it is slower but always current.")
S("2.2", "A file was created five minutes ago, but `locate` cannot find it. What is the most likely reason?",
  ["✔The locate database has not been updated since then",
   "locate searches only the /usr directory tree",
   "New files stay hidden from locate until the user logs out and back in",
   "locate needs the -r option to see new files"],
  "`locate` reads a database that `updatedb` refreshes periodically, usually daily. Running `sudo updatedb` makes the new file findable. `-r` lets locate use a regular expression and has nothing to do with new files.")
F("2.2", "Type the command that rebuilds the database used by locate.",
  ["updatedb", "sudo updatedb"],
  "`updatedb` scans the filesystem and rewrites the locate database. It runs automatically from a scheduled job, but root can run it manually with `sudo updatedb`.")
S("2.2", "While viewing a man page, which input searches forward for the word recursive?",
  ["✔/recursive", "?recursive", ":recursive", "Ctrl+F recursive"],
  "man displays pages with `less`, where `/text` searches forward, `?text` searches backward, and `n` jumps to the next match. In less, `:` starts a less command and Ctrl+F scrolls forward one screen.")
F("2.2", "Type the key that exits a man page and returns you to the shell prompt.",
  ["q", "Q"],
  "man uses the less pager, and q quits. Space or Page Down scrolls forward, b scrolls back, h shows help, and / searches.")
S("2.2", "Which command prints only the one-line description of the ls man page?",
  ["✔whatis ls", "apropos -a ls", "info --short ls", "man -h ls"],
  "`whatis` prints the NAME line from the matching man pages, such as `ls (1) - list directory contents`. `apropos` searches descriptions for a keyword and usually returns many matches.")
S("2.2", "What is a key difference between info pages and man pages?",
  ["✔Info pages are split into linked nodes you navigate like hypertext",
   "Info pages exist only for the builtin commands of Bash",
   "Info pages are kept as plain text files under /etc/info and read with cat",
   "Info pages can be read only through a graphical web browser"],
  "Info documentation is organized as a tree of nodes connected by menu items and cross-references (marked with `*`), often with more detail than the man page. You read it in the terminal with `info command`. Press `?` for navigation help.")
F("2.2", "Type the long option that makes most GNU commands print a brief usage summary.",
  ["--help"],
  "`ls --help` prints a short summary of options. It is quicker than a man page but less detailed. Not every program supports it, and shell builtins use `help cd` instead.",
  run="ls {A} >/dev/null && echo ok", expect="ok")
S("2.2", "`man cd` reports \"No manual entry for cd\". What is the most likely reason?",
  ["✔cd is a Bash builtin, documented by help cd and man bash",
   "cd is not installed, so its package must be added first",
   "The man page database is corrupted and must be rebuilt with mandb",
   "cd is an alias for chdir, so you must use man chdir"],
  "Builtins live inside the shell, so many have no separate man page. `help cd` shows the builtin's help, and the BUILTIN COMMANDS section of `man bash` documents all of them. You can confirm what kind of command it is with `type cd`.",
  run="help cd >/dev/null && type -t cd", expect="builtin")

# ---------------- 2.3 Using Directories and Listing Files (12) ----------------
F("2.3", "Type the ls option (a dash and one letter) that lists all entries, including hidden files whose names start with a dot.",
  ["-a", "-A", "--all", "--almost-all"],
  "`ls -a` shows all entries, including `.` and `..`. `ls -A` shows hidden files but leaves out `.` and `..`. A hidden file is simply one whose name begins with a dot, such as .bashrc.",
  run="touch .h v; ls {A} | grep -c '^\\.h$'", expect="1")
S("2.3", "Your current directory is /home/carol/Documents. Where do you end up after this command?",
  ["✔/home/tom", "/home/carol/tom", "/tom", "/home/carol/Documents/tom"],
  "Each `..` moves up one level: the first goes to /home/carol, the second to /home, and then `tom` enters /home/tom. This is a relative path because it does not start with /.",
  code="$ cd ../../tom",
  run="mkdir -p r/home/carol/Documents r/home/tom; cd r/home/carol/Documents; cd ../../tom; echo ${PWD#*/r}", expect="OPT")
S("2.3", "Which of these is an absolute path?",
  ["✔/usr/share/doc", "../share/doc", "share/doc", "./doc"],
  "An absolute path starts at the root directory `/`, so it works from any current directory. The others are relative: `..` is the parent, `.` is the current directory, and a bare name is relative to where you are.")
F("2.3", "Type the ls option (a dash and one letter) that lists directories recursively, including the contents of every subdirectory.",
  ["-R", "--recursive"],
  "`ls -R` is recursive. Case matters: lowercase `ls -r` reverses the sort order instead.",
  run="mkdir -p a/b; touch a/b/deep; ls {A} | grep -c '^deep$'", expect="1")
S("2.3", "What does running `cd` with no arguments do?",
  ["✔Changes to your home directory", "Leaves you in the same directory",
   "Changes to the root directory /", "Prints the current directory path"],
  "`cd` alone is the same as `cd ~` and returns you to your home directory, such as /home/carol. Use `cd /` for the root directory and `pwd` to print where you are.",
  run="HOME=/tmp; cd /; cd; pwd", expect="/tmp")
F("2.3", "Type the command that prints the absolute path of the current working directory.",
  ["pwd"],
  "`pwd` (print working directory) prints the full path, such as /home/carol/Documents. Many prompts show a shortened form, with ~ standing for your home directory.",
  run="cd /usr; {A}", expect="/usr")
S("2.3", "For the user tom, whose home directory is /home/tom, what does `~/notes` refer to?",
  ["✔/home/tom/notes", "/notes", "notes in the current directory", "/root/notes"],
  "`~` expands to the current user's home directory, so `~/notes` is /home/tom/notes no matter where you are. `~carol` refers to carol's home directory, and root's home is /root.",
  run="HOME=/home/tom; echo ~/notes", expect="/home/tom/notes")
S("2.3", "What does `cd -` do?",
  ["✔Returns to the previous working directory", "Moves up one level to the parent directory",
   "Changes to the root directory /", "Changes to your home directory"],
  "`cd -` switches back to the directory you were in before the last `cd` (stored in $OLDPWD) and prints its path. `cd ..` goes up one level, `cd /` goes to root, and `cd` or `cd ~` goes home.",
  run="cd /usr; cd /etc; cd - >/dev/null; pwd", expect="/usr")
S("2.3", "When combined with -l, which ls option shows sizes in human-readable units such as K, M and G?",
  ["✔-h", "-H", "-S", "-k"],
  "`ls -lh` prints sizes like 4.0K or 1.2M. Uppercase `-S` sorts by size, `-H` follows symbolic links given on the command line, and `-k` reports sizes in 1 KiB blocks.",
  run="head -c 2048 /dev/zero > f; ls -lh f | awk '{print $5}'", expect="2.0K")
S("2.3", "Which command lists files in long format with the most recently modified first?",
  ["✔ls -lt", "ls -lS", "ls -lr", "ls -lR"],
  "`-t` sorts by modification time, newest first, and adding `-r` (`ls -ltr`) puts the newest last. `-S` sorts by size, `-r` reverses the sort, and `-R` lists recursively.",
  run="touch -d '2020-01-01' old; touch new; ls -t | head -1", expect="new")
S("2.3", "How do you make a file hidden in Linux?",
  ["✔Start its name with a dot (.)", "Set a hidden attribute with chmod +h",
   "Move it into the /hidden directory", "End its name with a tilde (~)"],
  "Any file or directory whose name begins with a dot is hidden from a plain `ls`, as with ~/.bashrc and ~/.ssh. Linux has no hidden attribute like Windows. `ls -a` reveals hidden files.")
S("2.3", "Your current directory is /var/log. Which command moves you into /var/tmp?",
  ["✔cd ../tmp", "cd /tmp", "cd tmp", "cd ./tmp"],
  "`..` is /var, so `../tmp` is /var/tmp. `cd /tmp` goes to the root-level /tmp, which is a different directory. `cd tmp` and `cd ./tmp` look for a tmp directory inside /var/log.",
  run="cd /var/log; cd ../tmp; pwd", expect="/var/tmp")

# ---------------- 2.4 Creating, Moving and Deleting Files (12) ----------------
S("2.4", "What happens when you run `rmdir projects` and projects still contains files?",
  ["✔The command fails with a \"Directory not empty\" error", "The directory and all of the files inside it are deleted permanently",
   "Only the files inside the directory are deleted", "The directory is moved to the desktop trash"],
  "`rmdir` removes empty directories only. To delete a directory and everything in it, use `rm -r projects`. The command line has no trash, so deletions are immediate.",
  run="mkdir projects; touch projects/a; rmdir projects 2>&1 | grep -o 'Directory not empty'", expect="Directory not empty")
S("2.4", "A directory contains file1.txt, file10.txt, File2.txt and file.txt. Which files does `ls file?.txt` list?",
  ["✔file1.txt only", "file1.txt and file10.txt", "file1.txt and File2.txt", "file1.txt, file10.txt and file.txt"],
  "`?` matches exactly one character. file10.txt has two characters in that spot and file.txt has none. File2.txt starts with a capital F, and Linux file names are case-sensitive.",
  run="touch file1.txt file10.txt File2.txt file.txt; ls file?.txt", expect="file1.txt")
S("2.4", "Which command copies the directory projects and everything inside it into backup/?",
  ["✔cp -r projects backup/", "cp projects backup/", "mv -r projects backup/", "cp -i projects backup/"],
  "`cp` skips directories unless you add `-r` (or `-R`) for a recursive copy. `mv` moves rather than copies and needs no `-r`. `-i` only asks before overwriting files.",
  run="mkdir -p projects backup; touch projects/x; cp -r projects backup/; ls backup/projects", expect="x")
S("2.4", "A directory contains both Report.txt and report.txt. Which statement is true?",
  ["✔They are two separate files because names are case-sensitive", "They are the same file listed twice by ls",
   "The second file silently overwrote the first one when it was created", "Linux does not allow uppercase file names"],
  "Linux filesystems treat upper- and lowercase as different characters, so both files can exist side by side. Windows and macOS treat them as the same name by default, which matters when you copy files between systems.",
  run="echo a > Report.txt; echo b > report.txt; ls | wc -l", expect="2")
S("2.4", "Which command creates projects/2026/reports when none of those directories exist yet?",
  ["✔mkdir -p projects/2026/reports", "mkdir projects/2026/reports", "mkdir -r projects/2026/reports", "touch -d projects/2026/reports"],
  "`-p` (parents) creates every missing directory in the path and does not complain about ones that already exist. Without it, mkdir fails because projects/2026 doesn't exist. mkdir has no `-r` option, and touch creates files, not directories.",
  run="mkdir -p projects/2026/reports && test -d projects/2026/reports && echo ok", expect="ok")
S("2.4", "What does `touch report.txt` do if report.txt already exists?",
  ["✔Updates its timestamps but leaves the contents alone", "Empties the file so that its size becomes zero",
   "It fails with a \"File exists\" error and leaves the file unchanged", "Creates a second copy named report.txt.1"],
  "touch creates an empty file if it doesn't exist and otherwise just updates the access and modification times. To empty a file, you could use `> report.txt` or `truncate -s 0 report.txt`.",
  run="echo data > report.txt; touch report.txt; cat report.txt", expect="data")
S("2.4", "A directory contains log1.txt, log2.txt, log4.txt and log12.txt. Which files does `ls log[1-3].txt` match?",
  ["✔log1.txt and log2.txt", "log1.txt, log2.txt and log12.txt", "All four files", "log12.txt only"],
  "`[1-3]` matches exactly one character in the range 1 to 3. log4.txt fails the range, and log12.txt has two characters where the pattern allows one. `[^1-3]` (or `[!1-3]`) would match one character outside the range.",
  run="touch log1.txt log2.txt log4.txt log12.txt; echo log[1-3].txt", expect="log1.txt log2.txt")
S("2.4", "A directory contains resolv.conf, .hidden.conf, conf.bak, nginx.conf.bak and my.conf. Which files does the glob `*.conf` match?",
  ["✔my.conf", "✔resolv.conf", ".hidden.conf", "conf.bak", "nginx.conf.bak"],
  "`*` matches any characters, but by default it does not match a leading dot, so hidden files are skipped. The name must also end in .conf, which rules out conf.bak and nginx.conf.bak.",
  run="touch resolv.conf .hidden.conf conf.bak nginx.conf.bak my.conf; echo *.conf", expect="my.conf resolv.conf")
F("2.4", "Type the complete command that deletes the directory old_logs, in your current directory, and everything inside it.",
  ["rm -r old_logs", "rm -rf old_logs", "rm -R old_logs", "rm -fr old_logs", "rm -r old_logs/", "rm -rf old_logs/", "rm -Rf old_logs", "rm --recursive old_logs"],
  "`rm -r` removes a directory tree recursively, and adding `-f` suppresses prompts and errors, so double-check before using it. `rmdir` only removes empty directories.",
  run="mkdir -p old_logs/sub; touch old_logs/sub/a; {A}; ls | wc -l", expect="0")
S("2.4", "What happens when you run `mv a.txt b.txt` and b.txt already exists?",
  ["✔b.txt is replaced by a.txt without any prompt", "mv refuses because b.txt already exists",
   "Both are kept, and the old b.txt becomes b.txt~", "The contents of a.txt are appended to b.txt"],
  "By default mv silently overwrites the destination. Use `mv -i` to be asked first or `mv -n` to never overwrite. Some distributions alias `mv` to `mv -i` for root, but the command itself overwrites.",
  run="echo A > a.txt; echo B > b.txt; \\mv a.txt b.txt; ls; cat b.txt", expect="b.txt\nA")
S("2.4", "What does `cp a.txt b.txt docs/` do when docs is an existing directory?",
  ["✔Copies both files into docs", "Copies a.txt over b.txt, then copies b.txt into docs",
   "Fails with a \"too many arguments\" error", "Joins both files into a single file in docs"],
  "When the last argument is a directory, cp (and mv) copies every earlier argument into it. With more than two arguments, the last one must be a directory, or cp reports that the target is not a directory.",
  run="mkdir docs; touch a.txt b.txt; cp a.txt b.txt docs/; ls docs | tr '\\n' ' '", expect="a.txt b.txt ")
F("2.4", "Type the short option that makes cp, mv and rm ask for confirmation before overwriting or deleting.",
  ["-i", "--interactive"],
  "`-i` (interactive) prompts before each overwrite or removal. `-v` (verbose) reports each action, `-r` works recursively, and `-f` forces the action without asking.",
  run="touch x y; echo n | cp {A} x y 2>&1 | grep -c overwrite", expect="1")
