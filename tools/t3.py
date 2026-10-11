# SPDX-License-Identifier: AGPL-3.0-or-later
from common import S, F

# ---------------- 3.1 Archiving Files on the Command Line (12) ----------------
S("3.1", "Which command creates a gzip-compressed archive of the ~/docs directory?",
  ["✔tar -czf docs.tar.gz ~/docs", "tar -xzf docs.tar.gz ~/docs", "tar -cjf docs.tar.gz ~/docs", "gzip -r docs.tar.gz ~/docs"],
  "`-c` creates, `-z` filters through gzip, and `-f` names the archive file. `-x` extracts instead of creating, and `-j` uses bzip2 (normally named .tar.bz2). gzip compresses individual files and cannot build an archive.",
  run="mkdir docs; touch docs/a; tar -czf docs.tar.gz docs && gzip -t docs.tar.gz && tar -tzf docs.tar.gz | head -1", expect="docs/")
F("3.1", "Type a complete command that decompresses notes.txt.bz2, restoring notes.txt.",
  ["bunzip2 notes.txt.bz2", "bzip2 -d notes.txt.bz2", "bzip2 --decompress notes.txt.bz2", "bunzip2 -v notes.txt.bz2"],
  "`bunzip2` (or `bzip2 -d`) decompresses .bz2 files. The matching pairs are gzip/gunzip for .gz, xz/unxz for .xz, and zip/unzip for .zip.",
  run="echo hi > notes.txt; bzip2 notes.txt; {A} 2>/dev/null; cat notes.txt", expect="hi")
S("3.1", "Which command lists the files inside backup.tar without extracting them?",
  ["✔tar -tf backup.tar", "tar -xf backup.tar", "tar -cf backup.tar", "tar -rf backup.tar"],
  "`-t` lists the contents, `-x` extracts, and `-c` creates (here it would overwrite the archive). `-r` appends files. Add `-v` for detail and `-z`, `-j` or `-J` for archives compressed with gzip, bzip2 or xz.",
  run="touch a b; tar -cf backup.tar a b; rm a b; tar -tf backup.tar | tr '\\n' ' '; ls | tr '\\n' ' '", expect="a b backup.tar ")
F("3.1", "Type the complete command that extracts the contents of photos.zip into the current directory.",
  ["unzip photos.zip", "unzip -o photos.zip", "unzip -q photos.zip", "unzip photos.zip -d ."],
  "`unzip` extracts .zip archives and `zip` creates them, for example `zip -r photos.zip Pictures/`. Unlike tar, the zip format archives and compresses in one step, and it is the format Windows users expect.")
S("3.1", "After running `gzip report.txt`, what is left in the directory?",
  ["✔Only report.txt.gz", "report.txt and report.txt.gz", "report.tar.gz", "report.zip"],
  "gzip, bzip2 and xz replace the original file with the compressed one by default. Use `-k` to keep the original, or `gzip -c report.txt > report.txt.gz` to write to standard output. gunzip reverses the process and removes the .gz file.",
  run="echo x > report.txt; gzip report.txt; ls", expect="report.txt.gz")
S("3.1", "Which tar option compresses or decompresses the archive with xz?",
  ["✔-J", "-j", "-z", "-x"],
  "Uppercase `-J` means xz (.tar.xz), lowercase `-j` means bzip2 (.tar.bz2), and `-z` means gzip (.tar.gz or .tgz). `-x` extracts. Compression is usually strongest with xz, then bzip2, then gzip.",
  run="touch f; tar -cJf a.tar.xz f; xz -t a.tar.xz && echo ok", expect="ok")
S("3.1", "Which command extracts backup.tar.gz into the directory /tmp/restore?",
  ["✔tar -xzf backup.tar.gz -C /tmp/restore", "tar -xzf backup.tar.gz /tmp/restore",
   "tar -czf backup.tar.gz -C /tmp/restore", "tar -xzf backup.tar.gz -d /tmp/restore"],
  "`-C dir` changes to that directory before extracting. Without `-C`, tar treats /tmp/restore as the name of a member to extract from the archive. `-c` would create a new archive, overwriting the old one. `-d` compares the archive with the filesystem.",
  run="touch f; tar -czf backup.tar.gz f; rm f; mkdir r; tar -xzf backup.tar.gz -C r; ls r", expect="f")
S("3.1", "Which statement about archiving and compression is true?",
  ["✔gzip compresses single files, while tar bundles files into one archive",
   "tar always compresses its output, even without any option",
   "gzip can store a whole directory tree in a single .gz file",
   "zip can only bundle files into an archive and has no compression of its own"],
  "Archiving (tar) and compression (gzip, bzip2, xz) are separate steps on Linux, which is why archives are named .tar.gz. zip does both in one format. Plain `tar -cf` produces an uncompressed archive.")
F("3.1", "Type the complete command that creates site.zip containing the directory www and everything inside it.",
  ["zip -r site.zip www", "zip -r site.zip www/", "zip -r site www", "zip -r site www/", "zip -rq site.zip www", "zip -r -q site.zip www"],
  "`zip -r` recurses into directories. Without `-r`, zip adds only an empty directory entry for www. zip adds the .zip extension automatically if you leave it off.",
  run="mkdir -p www/css; touch www/css/s.css; {A} >/dev/null; unzip -l site.zip | grep -c 'www/css/s.css'", expect="1")
S("3.1", "Which gzip option gives the best (but slowest) compression?",
  ["✔-9", "-1", "-c", "-d"],
  "Compression levels run from `-1` (fastest, least compression) to `-9` (slowest, smallest output). The default for gzip is 6. `-c` writes to standard output, and `-d` decompresses.")
S("3.1", "What does the file name backup.tar.bz2 tell you?",
  ["✔It is a tar archive compressed with bzip2", "It is a bzip2 archive that contains tar.exe",
   "It is a zip archive that was renamed by mistake", "It is two separate archives stored side by side"],
  "Each extension records a step: tar bundled the files, then bzip2 compressed the result. Extract it with `tar -xjf backup.tar.bz2`. Linux doesn't rely on extensions, so the `file` command can confirm the real type.")
S("3.1", "Which commands print the contents of a gzip-compressed text file without decompressing it on disk?",
  ["✔zcat notes.txt.gz", "✔gunzip -c notes.txt.gz", "cat notes.txt.gz", "tar -tf notes.txt.gz", "unzip -l notes.txt.gz"],
  "`zcat` and `gunzip -c` (also `gzip -dc`) decompress to standard output and leave the .gz file unchanged. bzcat and xzcat do the same for bzip2 and xz. Plain `cat` would print compressed binary data, and tar and unzip expect other formats.",
  run="echo hello > notes.txt; gzip notes.txt; zcat notes.txt.gz; gunzip -c notes.txt.gz; ls", expect="hello\nhello\nnotes.txt.gz")

# ---------------- 3.2 Searching and Extracting Data from Files (18) ----------------
S("3.2", "What does this command display?",
  ["✔The number of lines in /etc/passwd", "The number of words in /etc/passwd",
   "The contents of /etc/passwd with line numbers", "The size of /etc/passwd in bytes"],
  "The pipe sends cat's output to `wc`, and `-l` counts lines. Each account in /etc/passwd is one line, so this roughly counts accounts. `wc -w` counts words, `wc -c` counts bytes, and `cat -n` numbers lines.",
  code="$ cat /etc/passwd | wc -l")
S("3.2", "Which command saves only the error messages from `find / -name '*.conf'` in errors.log, while normal output still appears on screen?",
  ["✔find / -name '*.conf' 2> errors.log", "find / -name '*.conf' > errors.log",
   "find / -name '*.conf' | errors.log", "find / -name '*.conf' &> errors.log"],
  "File descriptor 2 is standard error, so `2>` redirects only errors. `>` redirects standard output (descriptor 1). `|` sends output to another command, not a file, and `&>` redirects both stdout and stderr.")
S("3.2", "Which lines does this command match?",
  ["✔Bank account", "✔book review", "brick wall", "a bulk order", "Black box"],
  "`^` anchors to the start of the line, `[Bb]` matches B or b, each `.` matches any one character, and then a `k` must follow. Bank and book fit. In brick and Black the fourth character is c, not k, and \"a bulk order\" starts with a.",
  code="$ grep '^[Bb]..k' list.txt",
  run="printf 'Bank account\\nbook review\\nbrick wall\\na bulk order\\nBlack box\\n' > list.txt; grep '^[Bb]..k' list.txt", expect="Bank account\nbook review")
S("3.2", "What does this command output?",
  ["✔A list of usernames, one per line", "The first line of /etc/passwd",
   "Every user's login shell", "The number of fields in each line"],
  "`-d:` sets the colon as the field delimiter and `-f1` selects the first field, the username. `head -n 1` would show the first line, and `-f7` would select the login shell.",
  code="$ cut -d: -f1 /etc/passwd",
  run="printf 'root:x:0:0::/root:/bin/bash\\ncarol:x:1000:1000::/home/carol:/bin/bash\\n' > p; cut -d: -f1 p", expect="root\ncarol")
F("3.2", "Type the redirection operator that appends a command's standard output to the end of a file instead of overwriting it.",
  [">>", "1>>"],
  "`>>` appends, while `>` truncates the file first. `2>>` appends standard error, and `&>>` appends both.",
  run="echo a > f; echo b {A} f; cat f", expect="a\nb")
S("3.2", "Which command shows the last 20 lines of /var/log/syslog?",
  ["✔tail -n 20 /var/log/syslog", "head -n 20 /var/log/syslog", "less -20 /var/log/syslog", "sort -n 20 /var/log/syslog"],
  "`tail` shows the end of a file: 10 lines by default, `-n 20` changes the count, and `-f` follows new lines. `head` shows the beginning, `less` is a pager for scrolling, and `sort -n` sorts numerically.",
  run="seq 1 100 > s; tail -n 20 s | head -1", expect="81")
S("3.2", "nums.txt contains the lines 10, 9 and 100. What is the output of `sort nums.txt`?",
  ["✔10, 100, 9", "9, 10, 100", "100, 10, 9", "100, 9, 10"],
  "Without options, sort compares text character by character, so 1 sorts before 9 and 10 and 100 come before 9. `sort -n` compares numbers and gives 9, 10, 100. `sort -nr` gives 100, 10, 9.",
  run="printf '10\\n9\\n100\\n' > nums.txt; sort nums.txt | paste -sd, | sed 's/,/, /g'", expect="OPT")
F("3.2", "Type the sort option (a dash and one letter) that reverses the sort order.",
  ["-r", "--reverse"],
  "`sort -r` reverses the result. Combine it with `-n` for numbers sorted largest first (`sort -nr`). `-f` ignores case, and `-k` chooses which field to sort on.",
  run="printf 'a\\nc\\nb\\n' | sort {A} | head -1", expect="c")
S("3.2", "Which command counts the words in essay.txt?",
  ["✔wc -w essay.txt", "wc -l essay.txt", "wc -c essay.txt", "grep -c essay.txt"],
  "`wc -w` counts words, `-l` counts lines, and `-c` counts bytes. With no option, wc prints all three. `grep -c` counts lines that match a pattern.",
  run="echo 'one two three' > essay.txt; wc -w essay.txt | cut -d' ' -f1", expect="3")
S("3.2", "How many lines does `head file.txt` show by default?",
  ["✔10", "5", "20", "One full screen"],
  "head and tail both default to 10 lines. Use `-n N` (or `-N`) to change the count. A pager like less shows a screen at a time.",
  run="seq 1 50 | head | wc -l", expect="10")
S("3.2", "Which command shows the lines in config.ini that do NOT contain the word debug?",
  ["✔grep -v debug config.ini", "grep -i debug config.ini", "grep -c debug config.ini", "grep -n debug config.ini"],
  "`-v` inverts the match. `-i` ignores case, `-c` counts matching lines, and `-n` shows line numbers. A common use is `grep -v '^#' file` to hide comment lines.",
  run="printf 'debug=1\\nport=80\\n' > config.ini; grep -v debug config.ini", expect="port=80")
F("3.2", "Type the grep option (a dash and one letter) that makes the match case-insensitive.",
  ["-i", "--ignore-case"],
  "`grep -i error` matches error, Error and ERROR. Other common options are `-v` (invert), `-c` (count), `-r` (recursive), `-E` (extended regex) and `-n` (line numbers).",
  run="echo ERROR > f; grep {A} error f", expect="ERROR")
S("3.2", "Which of these complete lines match `grep 'c.t'`?",
  ["✔cat", "✔cot", "ct", "coat", "cart"],
  "In a regular expression `.` matches exactly one character, so `c.t` needs c, any single character, then t. ct has no character in between. coat has two characters between c and t, and cart has two (a and r), so neither fits.",
  run="printf 'cat\\ncot\\nct\\ncoat\\ncart\\n' | grep 'c.t'", expect="cat\ncot")
S("3.2", "In a basic regular expression used with grep, what does `*` mean?",
  ["✔Zero or more of the preceding character", "Any sequence of characters, as in a glob",
   "One or more of the preceding character", "Exactly one character of any kind"],
  "In regex, `*` repeats the item before it zero or more times, so `ab*c` matches ac, abc and abbc. The shell glob `*` means \"any characters\", which in regex is written `.*`. One or more is `+` (with -E), and exactly one character is `.`.",
  run="printf 'ac\\nabc\\nabbc\\nxc\\n' | grep 'ab*c'", expect="ac\nabc\nabbc")
S("3.2", "Which command lists the lines in data.txt that start with a digit?",
  ["✔grep '^[0-9]' data.txt", "grep '[0-9]$' data.txt", "grep '[^0-9]' data.txt", "grep '^0-9' data.txt"],
  "`^` anchors to the start of the line, and `[0-9]` matches one digit. `[0-9]$` matches lines ending in a digit. `[^0-9]` (inside brackets) matches any non-digit character anywhere, and `^0-9` looks for the literal text 0-9.",
  run="printf '7 dwarfs\\nagent 007\\n0-9 range\\n' > data.txt; grep '^[0-9]' data.txt", expect="7 dwarfs\n0-9 range")
S("3.2", "Which command sends both the normal output and the error messages of `make` to build.log?",
  ["✔make > build.log 2>&1", "make 2>&1 > build.log", "make > build.log", "make 2> build.log"],
  "Redirections are processed left to right: `> build.log` points stdout at the file, then `2>&1` points stderr at the same place. In `2>&1 > build.log`, stderr is copied to the terminal before stdout moves, so errors still appear on screen. `&> build.log` is a Bash shortcut that does the same as the correct answer.",
  run="f(){ echo out; echo err >&2; }; f > build.log 2>&1; cat build.log", expect="out\nerr")
S("3.2", "What does the `|` do in `ls -l /etc | less`?",
  ["✔Sends the output of ls as the input of less", "Saves the output of ls into a file named less",
   "Runs ls and less side by side, unconnected", "Sends only the error messages of ls to less"],
  "A pipe connects one command's standard output to the next command's standard input, so you can page through long output. Errors (stderr) still go to the terminal unless redirected with `2>&1`.")
S("3.2", "Which words match the extended regular expression in `grep -E 'colou?r'`?",
  ["✔color", "✔colour", "colouur", "colr", "coulor"],
  "`?` (with -E) makes the preceding character optional, meaning zero or one occurrence. So colou?r matches color and colour only. colouur has two u's, colr is missing the second o, and coulor has the letters in a different order.",
  run="printf 'color\\ncolour\\ncolouur\\ncolr\\ncoulor\\n' | grep -E '^colou?r$'", expect="color\ncolour")

# ---------------- 3.3 Turning Commands into a Script (24) ----------------
S("3.3", "Which line should be the first line of a Bash script so that it runs with Bash?",
  ["✔#!/bin/bash", "#/bin/bash", "!#/bin/bash", "// bash"],
  "The shebang is `#!` followed by the interpreter's absolute path, and it must be the very first line. `#/bin/bash` is just a comment, `!#` is reversed, and `//` is not a comment in Bash, so the script would run under whatever shell launched it.",
  run="printf '#!/bin/bash\\necho $BASH_VERSION | cut -c1' > s; chmod +x s; ./s | grep -c '[0-9]'", expect="1")
S("3.3", "A script is run as `./backup.sh /home /etc /var`. What is the value of `$#` inside the script?",
  ["✔3", "0", "./backup.sh", "/var"],
  "`$#` holds the number of positional arguments, which is three here. `$0` is the script name, `$1` is /home, and `$3` is /var.",
  run="printf '#!/bin/bash\\necho $#' > backup.sh; chmod +x backup.sh; ./backup.sh /home /etc /var", expect="OPT")
F("3.3", "Type the special shell variable that holds the exit status of the most recently executed command.",
  ["$?"],
  "`echo $?` prints the last exit status. 0 means success, and any non-zero value (1 to 255) indicates an error. Check it immediately, because the next command overwrites it.",
  run="false; echo {A}", expect="1")
S("3.3", "What is the output of this loop?",
  ["✔1-2-3-", "1-, 2- and 3- on three separate lines", "123", "n-n-n-"],
  "The loop variable takes each value in the list in turn. `echo -n` suppresses the trailing newline, so all three results print on one line. `$n` expands to the value, so the letter n is never printed.",
  code="for n in 1 2 3; do\n  echo -n \"$n-\"\ndone",
  run="for n in 1 2 3; do echo -n \"$n-\"; done", expect="OPT")
S("3.3", "You are editing a script in vi. After pressing Esc, which command saves the file and quits?",
  ["✔:wq", ":q!", "Ctrl+O", "i"],
  "In vi, `:w` writes and `:q` quits, so `:wq` does both (`:x` and `ZZ` also work). `:q!` quits and discards changes. Ctrl+O is nano's save command, and `i` switches vi into insert mode.")
S("3.3", "What does this script print when run as `./swap.sh red blue`?",
  ["✔blue red", "red blue", "$2 $1", "swap.sh red"],
  "`$1` is the first argument (red) and `$2` is the second (blue). Double quotes let the variables expand, so the output is blue red.",
  code="#!/bin/bash\necho \"$2 $1\"",
  run="printf '#!/bin/bash\\necho \"$2 $1\"\\n' > swap.sh; chmod +x swap.sh; ./swap.sh red blue", expect="OPT")
S("3.3", "Which line correctly assigns the text Carol Smith to the variable name in a Bash script?",
  ["✔name=\"Carol Smith\"", "name = \"Carol Smith\"", "$name=\"Carol Smith\"", "name=Carol Smith"],
  "Bash assignments allow no spaces around `=`, take no `$` on the left, and need quotes when the value contains a space. With spaces, Bash tries to run a command named name. Without quotes, Bash sets name=Carol only for a command named Smith.",
  run="name=\"Carol Smith\"; echo $name", expect="Carol Smith")
F("3.3", "Type the exit status number a command returns when it completes successfully.",
  ["0"],
  "Exit status 0 means success, and any non-zero value signals a failure. For example, grep returns 1 when nothing matches, and the shell returns 127 for \"command not found\". Scripts set their own status with `exit 0` or `exit 1`.",
  run="true; echo $?", expect="0")
S("3.3", "The script hello.sh is in the current directory and is executable. Which command runs it?",
  ["✔./hello.sh", "hello.sh", "run hello.sh", "exec: hello.sh"],
  "The current directory is not in PATH, so you must give a path such as `./hello.sh`. Typing just `hello.sh` makes the shell search PATH and report \"command not found\". `bash hello.sh` also works, even without execute permission.",
  run="printf '#!/bin/bash\\necho hi\\n' > hello.sh; chmod +x hello.sh; ./hello.sh; hello.sh 2>/dev/null || echo notfound", expect="hi\nnotfound")
S("3.3", "Running `./deploy.sh` fails with \"Permission denied\". What is the most likely fix?",
  ["✔Run chmod +x deploy.sh", "Add a .bash extension to the name", "Move the file into /tmp first", "Run cd deploy.sh before running it"],
  "A new file usually lacks execute permission (for example rw-r--r--). `chmod +x deploy.sh` (or `chmod u+x`) adds it. File extensions mean nothing to Linux, and cd only works on directories.",
  run="printf '#!/bin/bash\\necho ran\\n' > deploy.sh; ./deploy.sh 2>&1 | grep -c 'Permission denied'; chmod +x deploy.sh; ./deploy.sh", expect="1\nran", user=True)
F("3.3", "Type the special variable that holds the name of the script as it was invoked.",
  ["$0", "${0}"],
  "`$0` is the command name used to start the script, such as ./backup.sh. `$1` through `$9` hold the first nine arguments, `$#` holds the count, and `$@` holds all of them.",
  run="printf '#!/bin/bash\\necho {A}\\n' > me.sh; chmod +x me.sh; ./me.sh", expect="./me.sh")
S("3.3", "What does this script print when run as `./list.sh a b c`?",
  ["✔[a], [b] and [c] on three separate lines", "[a b c] on one line", "[$@]", "Nothing, because $@ is empty in a for loop"],
  "`\"$@\"` expands to all the arguments as separate words, so the loop runs three times. `$*` is similar, but `\"$*\"` joins the arguments into one word.",
  code="#!/bin/bash\nfor x in \"$@\"; do\n  echo \"[$x]\"\ndone",
  run="printf '#!/bin/bash\\nfor x in \"$@\"; do echo \"[$x]\"; done\\n' > list.sh; chmod +x list.sh; ./list.sh a b c", expect="[a]\n[b]\n[c]")
S("3.3", "In nano, which key combination writes (saves) the file?",
  ["✔Ctrl+O", "Ctrl+X", "Ctrl+W", "Ctrl+K"],
  "nano lists its shortcuts at the bottom of the screen with ^ meaning Ctrl. ^O is Write Out (save), ^X exits (and offers to save), ^W searches (Where Is), and ^K cuts the current line. Unlike vi, nano has no separate modes.")
S("3.3", "You open a file in vi and start typing, but the text doesn't appear. Which key switches to insert mode so you can type?",
  ["✔i", ":", "Esc", "q"],
  "vi starts in normal (command) mode, where keys are commands. `i` enters insert mode, Esc returns to normal mode, and `:` opens the command line for commands such as :w and :q.")
F("3.3", "Type the vi command (starting with a colon) that quits WITHOUT saving your changes.",
  [":q!"],
  "`:q!` discards changes and quits. `:q` refuses to quit if there are unsaved changes, `:w` saves, and `:wq` saves and quits.")
S("3.3", "What exit status does grep return when no lines match?",
  ["✔1", "0", "2", "127"],
  "grep returns 0 when it finds a match, 1 when nothing matches, and 2 on an error such as a missing file. Scripts often use this as `if grep -q pattern file; then ...`. Status 127 means \"command not found\".",
  run="echo a | grep zzz; echo $?", expect="1")
S("3.3", "What does this script print when it is run with no arguments?",
  ["✔usage", "ok", "usage, then ok", "Nothing at all"],
  "With no arguments `$#` is 0, so the test is true. The script prints usage and `exit 1` stops it before `echo ok` runs. With one or more arguments it would print only ok.",
  code="#!/bin/bash\nif [ $# -eq 0 ]; then\n  echo \"usage\"\n  exit 1\nfi\necho \"ok\"",
  run="printf '#!/bin/bash\\nif [ $# -eq 0 ]; then\\n echo \"usage\"\\n exit 1\\nfi\\necho \"ok\"\\n' > t.sh; chmod +x t.sh; ./t.sh", expect="usage")
S("3.3", "Which test is true when the variable count is greater than 10?",
  ["✔[ $count -gt 10 ]", "[ $count > 10 ]", "[ $count -ge 10 ]", "[ $count -lt 10 ]"],
  "Inside `[ ]`, numbers are compared with -eq, -ne, -gt, -ge, -lt and -le. `>` is treated as output redirection, creating a file named 10. `-ge` also accepts exactly 10, and `-lt` means less than.",
  run="count=11; [ $count -gt 10 ] && echo yes; count=10; [ $count -gt 10 ] || echo no", expect="yes\nno")
S("3.3", "What does `for f in *.txt; do echo \"$f\"; done` do?",
  ["✔Prints the name of each .txt file in the current directory", "Prints the contents of each .txt file",
   "Prints the literal text *.txt once, whether or not any files match", "Loops forever until you press Ctrl+C"],
  "The shell expands the glob `*.txt` into the matching filenames before the loop starts, so the loop runs once per file. You would need `cat \"$f\"` to print contents. Only if nothing matches does the literal pattern *.txt remain.",
  run="touch a.txt b.txt c.log; for f in *.txt; do echo \"$f\"; done", expect="a.txt\nb.txt")
S("3.3", "What does `today=$(date +%F)` store in the variable today?",
  ["✔The output of the date command, such as 2026-10-10", "The literal text date +%F",
   "The numeric exit status returned by the date command when it finishes", "Nothing, because $( ) is not valid Bash syntax"],
  "`$( )` is command substitution: Bash runs the command and substitutes its output. The older form uses backticks, as in today=`date +%F`. `+%F` formats the date as YYYY-MM-DD.",
  run="today=$(date +%F); echo $today | grep -cE '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'", expect="1")
S("3.3", "A script runs `exit 3` partway through. What happens to the lines after it?",
  ["✔They don't run, and the script ends with status 3", "They still run, but $? is set to 3 once the script finishes",
   "They run only if the next command succeeds", "Bash skips 3 lines and then continues"],
  "`exit N` ends the script immediately with that status, which the caller can read in `$?`. Scripts often use different non-zero codes to report different errors.",
  run="printf '#!/bin/bash\\necho before\\nexit 3\\necho after\\n' > e.sh; chmod +x e.sh; ./e.sh; echo $?", expect="before\n3")
S("3.3", "Which statements about the shebang line are true?",
  ["✔It must be the first line of the script", "✔It gives the absolute path of the interpreter",
   "It is required when you run the script as bash script.sh", "It only works if the file name ends in .sh",
   "It sets the execute permission on the script"],
  "The kernel reads `#!` on the first line to choose the interpreter, such as /bin/bash or /usr/bin/python3. When you run `bash script.sh` explicitly, Bash reads the file and treats the shebang as a comment. Extensions are irrelevant, and permissions come from chmod.")
S("3.3", "What does this script print?",
  ["✔2+3", "5", "$x+$y", "23"],
  "Bash variables are strings, so `$x+$y` just joins the text into 2+3. Arithmetic needs `$((x + y))`, which would give 5.",
  code="#!/bin/bash\nx=2\ny=3\necho $x+$y",
  run="x=2; y=3; echo $x+$y", expect="OPT")
F("3.3", "A script is run as `./mail.sh alice bob carol`. Type the variable that holds bob.",
  ["$2", "${2}"],
  "Positional parameters are numbered from 1 in the order given, so `$1`=alice, `$2`=bob and `$3`=carol. `$0` holds the script name.",
  run="printf '#!/bin/bash\\necho {A}\\n' > mail.sh; chmod +x mail.sh; ./mail.sh alice bob carol", expect="bob")
