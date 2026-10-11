# SPDX-License-Identifier: AGPL-3.0-or-later
"""Harder pack: 120 questions (three more 40-question forms), weighted toward
Apply (level 2) and Analyze (level 3) items: reading output, tracing scripts and
choosing exact syntax."""
from common import S, F

# ---------------- 1.1 Linux Evolution and Popular Operating Systems (6) ----------------
S("1.1", "A company wants an enterprise Linux distribution for its servers with paid vendor support, long maintenance and certified hardware. Which is the best fit?",
  ["✔Red Hat Enterprise Linux", "Linux Mint Debian Edition", "Raspbian", "Arch Linux"],
  "Red Hat Enterprise Linux (and SUSE Linux Enterprise) are sold with support subscriptions, long life cycles and hardware/software certifications. Linux Mint is a desktop distribution, Raspbian targets the Raspberry Pi, and Arch is a community rolling release without vendor support.",
  level=2)
S("1.1", "Which pairing of distribution and native package tooling is correct?",
  ["✔Ubuntu: apt-get and .deb packages", "openSUSE: dpkg and .deb packages", "CentOS: apt-get and .deb packages", "Debian: yum and .rpm packages"],
  "Debian and its descendants (Ubuntu, Mint, Raspbian) use .deb packages with dpkg and apt-get. Red Hat descendants (CentOS, Fedora) use .rpm with rpm and yum/dnf. openSUSE also uses .rpm, managed with zypper and YaST.",
  level=2)
S("1.1", "A production web server should run for years with only security fixes and no major changes. Which kind of Ubuntu release fits best?",
  ["✔The current LTS release", "The newest interim (non-LTS) release", "A daily development build", "The beta of the next release"],
  "LTS releases come out every two years and receive years of security updates, so a server can stay on one release. Interim releases are supported for only about nine months, and development or beta builds are for testing, not production.",
  level=2)
S("1.1", "Which of these devices is most likely running Linux as an embedded system?",
  ["✔A home Wi-Fi router", "An iPhone", "A Windows 11 laptop", "A MacBook running macOS"],
  "Routers, smart TVs, NAS boxes and many other appliances run an embedded Linux built for one job. iPhones run iOS and Macs run macOS, both built on Apple's Darwin rather than Linux. A Windows laptop runs Windows.",
  level=2)
S("1.1", "Which statements about Android are true?",
  ["✔It is built on a modified Linux kernel", "✔Its development is led by Google", "Its apps are normally installed as .deb packages",
   "It is a Debian derivative with a touch interface", "It uses the same GNU userland as desktop distributions"],
  "Android uses the Linux kernel with its own userland (its own C library and the Android Runtime), and Google leads the Android Open Source Project. Apps ship as .apk files, not .deb, and Android is not derived from Debian.",
  level=2)
S("1.1", "A how-to guide uses `apt-get install` and edits /etc/apt/sources.list. On which distributions will it work without changes?",
  ["✔Debian", "✔Linux Mint", "CentOS", "openSUSE", "Red Hat Enterprise Linux"],
  "apt-get and /etc/apt/sources.list belong to the Debian family, which includes Ubuntu and Linux Mint. CentOS and RHEL use rpm with yum/dnf, and openSUSE uses rpm with zypper.",
  level=2)

# ---------------- 1.2 Major Open Source Applications (6) ----------------
S("1.2", "On a CentOS server you downloaded webmin-2.1.noarch.rpm. Which command installs that file directly?",
  ["✔rpm -i webmin-2.1.noarch.rpm", "dpkg -i webmin-2.1.noarch.rpm", "apt-get install webmin-2.1.noarch.rpm", "yum search webmin-2.1.noarch.rpm"],
  "`rpm -i` (often `rpm -ivh`) installs a local .rpm file. dpkg handles .deb files, apt-get belongs to Debian-based systems, and `yum search` only searches repositories. rpm does not fetch missing dependencies; `yum install ./file.rpm` would.",
  level=2)
S("1.2", "On Ubuntu, which command installs NGINX from the configured repositories together with its dependencies?",
  ["✔apt-get install nginx", "dpkg -i nginx", "rpm --install nginx.rpm", "yum install nginx"],
  "apt-get downloads the package and everything it depends on from the repositories (run it with sudo). dpkg -i needs a local .deb file and does not resolve dependencies. rpm and yum are Red Hat tools.",
  level=2)
S("1.2", "Which two applications would you combine to host a dynamic website backed by a relational database?",
  ["✔Apache HTTPD and MariaDB", "Samba and NFS file servers", "GIMP and Thunderbird", "Firefox and Nextcloud"],
  "A web server (Apache HTTPD or NGINX) serves the pages and a database server (MariaDB or MySQL) stores the data, often with PHP in between, as in the LAMP stack. Samba and NFS share files, GIMP and Thunderbird are desktop applications, and Firefox is a browser.",
  level=2)
S("1.2", "A developer wants code that runs inside the visitor's web browser to make a page interactive. Which language is used for this?",
  ["✔JavaScript", "PHP", "Perl CGI scripts", "C"],
  "Browsers run JavaScript. PHP and Perl run on the server and send finished HTML to the browser, and C is compiled into native programs.",
  level=2)
S("1.2", "What does this output tell you?",
  ["✔The nginx package is installed on this Debian-based system", "nginx is available in the repository but not installed",
   "nginx is currently running as a service and listening on port 80", "nginx was installed from an .rpm package"],
  "`dpkg -l` lists packages known to dpkg. The status `ii` means the package is marked for installation and is installed. The output says nothing about whether the service is running, and dpkg only manages .deb packages.",
  code="$ dpkg -l | grep nginx\nii  nginx  1.24.0-2ubuntu7  amd64  small, powerful, scalable web/proxy server", level=3)
S("1.2", "Which command lists every installed package on a CentOS system?",
  ["✔rpm -qa", "dpkg -l", "rpm -i", "yum remove"],
  "`rpm -q` queries the package database and `-a` means all packages. `dpkg -l` is the Debian equivalent, `rpm -i` installs, and `yum remove` uninstalls.",
  level=2)

# ---------------- 1.3 Open Source Software and Licensing (3) ----------------
S("1.3", "A company changes a GPL-licensed program and sells copies of the modified version. What does the GPL require?",
  ["✔Offer the modified source code to recipients under the GPL", "Nothing, because modified code becomes the company's property",
   "Pay the Free Software Foundation a royalty for each copy", "Release the binaries under a Creative Commons license"],
  "The GPL allows selling software, but anyone who distributes a modified version must pass on the same freedoms, including the corresponding source code under the GPL. This is copyleft. No royalties are owed to the FSF.",
  level=3)
S("1.3", "A company wants to include a library in its closed-source product without publishing its own source code. Which license on the library allows this, as long as the copyright notice is kept?",
  ["✔BSD license", "GPL version 2", "GPL version 3", "CC BY-SA"],
  "Permissive licenses such as BSD and MIT allow use in proprietary software as long as the notice is kept. The GPL is copyleft, and CC BY-SA (ShareAlike) also requires adaptations to carry the same license.",
  level=2)
S("1.3", "A photographer lets anyone share and adapt her photos, even commercially, as long as they credit her and release adaptations under the same license. Which license matches?",
  ["✔CC BY-SA", "CC BY-NC-ND", "CC BY-ND", "CC BY-NC"],
  "BY requires credit and SA (ShareAlike) requires adaptations to use the same license. NC forbids commercial use, and ND forbids adaptations, so the other options don't match.",
  level=2)

# ---------------- 1.4 ICT Skills and Working in Linux (6) ----------------
S("1.4", "You want results about the sticky bit only from the LPI website. Which search query works in most web search engines?",
  ["✔\"sticky bit\" site:lpi.org", "sticky bit -lpi.org", "\"sticky bit\" OR site lpi.org", "lpi.org:\"sticky bit\""],
  "`site:` limits results to one domain and quotes match the exact phrase. A leading minus excludes a word, and OR matches either term.",
  level=2)
S("1.4", "A developer uploads application code, and the provider runs it, patches the operating system and adds servers automatically. The developer never logs in to a server. Which cloud service model is this?",
  ["✔Platform as a Service (PaaS)", "Infrastructure as a Service (IaaS)", "Software as a Service (SaaS)", "On-premises hosting"],
  "With PaaS you bring the code and the provider manages the OS and runtime. With IaaS you get virtual machines and manage the OS yourself. SaaS is a finished application, such as webmail, that you just use.",
  level=2)
S("1.4", "An admin wants to test Windows Server on a Linux workstation without buying another computer. What should they use?",
  ["✔A hypervisor such as KVM or VirtualBox to run a virtual machine", "A second terminal emulator window",
   "A Samba share mounted from a Windows PC", "A text-mode virtual console"],
  "A hypervisor lets one physical machine run several guest operating systems, each in its own virtual machine with virtual hardware. Terminals and consoles only give access to the host's own shell, and Samba only shares files.",
  level=2)
S("1.4", "What does a private (incognito) browser window NOT hide?",
  ["✔The sites you visit from your ISP or your employer's network", "Your history from other people who use the same computer",
   "Cookies that would otherwise stay after you close the window", "Form entries that the browser would otherwise remember"],
  "Private mode only stops the browser from keeping history, cookies and form data on your computer. Your traffic still goes through your network, so your ISP, employer and the websites themselves can still see it.",
  level=2)
S("1.4", "Which of these adds a second authentication factor to an account login?",
  ["✔A one-time code from an authenticator app, in addition to the password", "A longer password with symbols",
   "A security question about your first pet", "Letting the browser remember the password"],
  "Multi-factor authentication combines something you know (the password) with something you have, such as a phone generating codes. A longer password and a security question are both still things you know.",
  level=2)
S("1.4", "You must email a confidential file to a coworker. Which approach keeps the file's contents private even if the email is intercepted or stored on a mail server?",
  ["✔Encrypt the file, for example with GnuPG, before attaching it", "Use webmail over HTTPS, which hides the file from the mail servers",
   "Put a password reminder in the subject line", "Compress the file with gzip before attaching it"],
  "HTTPS only protects the connection to the webmail server, and the file is stored readable on the servers. Encrypting the file itself (end-to-end) protects it wherever it travels or is stored. gzip compresses data but doesn't protect it.",
  level=2)

# ---------------- 2.1 Command Line Basics (9) ----------------
S("2.1", "What does this command print?",
  ["✔LinuxEssentials $name Linux", "LinuxEssentials Linux Linux", "Essentials $name Linux", "${name}Essentials $name Linux"],
  "Braces mark where a variable name ends, so `${name}Essentials` expands to LinuxEssentials. Single quotes stop expansion, so `'$name'` prints literally. The unquoted `$name` expands normally. Without braces, `$nameEssentials` would be an empty, undefined variable.",
  code="$ name=Linux\n$ echo \"${name}Essentials\" '$name' $name",
  run="name=Linux; echo \"${name}Essentials\" '$name' $name", expect="OPT", level=3)
S("2.1", "What does this output tell you?",
  ["✔Typing ls runs ls with --color=auto added automatically", "ls is a Bash builtin, not a program on disk",
   "ls is not installed, so Bash substitutes a function", "ls --color=auto must be typed in full every time"],
  "`type` reports how Bash will interpret a name. An alias is a shortcut that Bash expands before running the command, so `ls` becomes `ls --color=auto`. Run `alias` to list all aliases and `\\ls` to bypass one.",
  code="$ type ls\nls is aliased to `ls --color=auto'", level=3)
S("2.1", "Which commands print exactly `Total: $9.99`?",
  ["✔echo 'Total: $9.99'", "✔echo \"Total: \\$9.99\"", "echo \"Total: $9.99\"", "echo Total: $9.99", "echo \"Total: ${9}.99\""],
  "Inside double quotes and unquoted, `$9` is the ninth positional parameter, which is empty, so those print `Total: .99`. Single quotes print everything literally, and a backslash escapes the `$` inside double quotes.",
  run="echo 'Total: $9.99'; echo \"Total: \\$9.99\"; echo \"Total: $9.99\"; echo Total: $9.99; echo \"Total: ${9}.99\"",
  expect="Total: $9.99\nTotal: $9.99\nTotal: .99\nTotal: .99\nTotal: .99", level=3)
S("2.1", "Both /usr/local/bin/backup and /usr/bin/backup exist and are executable. Which one runs when the user types `backup`?",
  ["✔/usr/local/bin/backup", "/usr/bin/backup", "Both, one after the other", "Neither, because you must type ./backup"],
  "The shell searches the PATH directories from left to right and runs the first match. /usr/local/bin comes first here, which is how locally installed programs override the distribution's versions.",
  code="$ echo $PATH\n/usr/local/bin:/usr/bin:/bin",
  run="mkdir l b; printf '#!/bin/sh\\necho local\\n' > l/backup; printf '#!/bin/sh\\necho usr\\n' > b/backup; chmod +x l/backup b/backup; PATH=\"$PWD/l:$PWD/b:$PATH\"; backup",
  expect="local", level=3)
S("2.1", "Which history expansion reruns the most recent command that started with `ssh`?",
  ["✔!ssh", "!!ssh", "history ssh", "!-ssh"],
  "`!string` reruns the most recent command beginning with that string, and `!!` reruns the last command. `!!ssh` would append ssh to the last command. `history` takes a count, not a search term.",
  level=2)
S("2.1", "Which command reruns `cd /var/log`?",
  ["✔!101", "!!", "!-1", "history 101"],
  "`!n` reruns history entry number n. `!!` and `!-1` both rerun the most recent command, which here is the history command itself. `history 101` lists the last 101 entries.",
  code="$ history | tail -3\n  101  cd /var/log\n  102  ls -l\n  103  history | tail -3", level=3)
F("2.1", "Type a single command that sets the variable GREETING to hello and makes it available to programs started from this shell.",
  ["export GREETING=hello", "export GREETING=\"hello\"", "export GREETING='hello'"],
  "`export NAME=value` assigns the variable and marks it for export in one step. Without export, the variable exists only in the current shell, and child processes such as scripts don't see it.",
  run="{A}; bash -c 'echo $GREETING'", expect="hello", level=2)
S("2.1", "What does this command output?",
  ["✔Two lines: a and b separated by a tab, then c", "One line: a\\tb\\nc exactly as typed", "Three lines: a, then b, then c (the tab becomes a newline)", "One line: a b c"],
  "`echo -e` interprets backslash escapes, so `\\t` becomes a tab and `\\n` a newline. Without -e, Bash's echo prints the backslashes literally. `echo -n` suppresses the final newline.",
  code="$ echo -e \"a\\tb\\nc\"", run="echo -e \"a\\tb\\nc\" | cat -A", expect="a^Ib$\nc$", level=3)
S("2.1", "What do the two echo commands print? Look closely at the quoting.",
  ["✔`a b` first (spaces squeezed), then `a   b` (spaces kept)", "`a   b` on both lines", "`a b` on both lines", "`a   b` first (spaces kept), then `a b` (spaces squeezed)"],
  "Unquoted, the variable's value is split into words, and echo joins its arguments with single spaces. Double quotes keep the value as one argument with its spacing intact. This is why scripts quote variables, especially file names.",
  code="$ msg=\"a   b\"\n$ echo $msg\n$ echo \"$msg\"", run="msg=\"a   b\"; echo $msg; echo \"$msg\"", expect="a b\na   b", level=3)

# ---------------- 2.2 Using the Command Line to Get Help (6) ----------------
S("2.2", "Which command shows the documentation for the format of the crontab file?",
  ["✔man 5 crontab", "man crontab", "man 1 crontab", "whatis crontab"],
  "The output shows two pages named crontab. Section 1 covers the command and section 5 covers file formats. `man crontab` opens the first match (section 1). `whatis` prints only the one-line descriptions.",
  code="$ man -k crontab\ncrontab (1)          - maintain crontab files for individual users\ncrontab (5)          - tables for driving cron", level=3)
S("2.2", "While reading a document in the info viewer, which key moves to the next node?",
  ["✔n", "p", "u", "q"],
  "In info, `n` goes to the next node, `p` to the previous node, `u` up a level and `q` quits. Enter follows the link under the cursor.",
  level=1)
S("2.2", "Which command finds files whose names contain readme, matching README, Readme and readme alike?",
  ["✔locate -i readme", "locate readme", "find readme", "whatis -i readme"],
  "locate is case-sensitive by default, and `-i` ignores case. `find readme` looks only for a path named exactly readme in the current directory. whatis searches man page names, not files.",
  level=2)
S("2.2", "What does this SYNOPSIS line from the cp man page tell you?",
  ["✔Options are optional, and you can name several source files followed by a target directory",
   "You must give exactly one option, one source and one directory", "cp accepts at most two arguments in total",
   "The DIRECTORY argument is optional and defaults to the home directory"],
  "In a SYNOPSIS, square brackets mark optional parts and `...` means the item can repeat. Words in capitals are placeholders that you replace with real values.",
  code="SYNOPSIS\n       cp [OPTION]... SOURCE... DIRECTORY", level=3)
S("2.2", "Which command lists the extra documentation, such as README and changelog files, that the openssh-client package installed?",
  ["✔ls /usr/share/doc/openssh-client", "ls /etc/doc/openssh-client", "man -k openssh-client", "ls /usr/local/doc/openssh-client"],
  "Packages put extra documentation in /usr/share/doc/<package>. `man -k` searches man page descriptions, and /etc and /var don't hold package documentation.",
  level=2)
S("2.2", "A man page lists an option as `-r, -R, --recursive`. What does that mean?",
  ["✔All three spellings select the same option", "You must type all three for recursion to work",
   "-r and -R are recursive, but --recursive is not", "--recursive requires a value after it"],
  "Man pages list equivalent short and long forms together. Long options start with two dashes and are easier to read in scripts. A required value would be shown, for example `--file=FILE`.",
  level=2)

# ---------------- 2.3 Using Directories and Listing Files (6) ----------------
S("2.3", "What does the last command print?",
  ["✔/home/carol/docs/notes", "/home/carol/projects/docs/notes", "/home/docs/notes", "/home/carol/projects/web/docs/notes"],
  "Each `..` goes up one level: from /home/carol/projects/web to /home/carol/projects, then to /home/carol. `.` means the current directory and changes nothing, so you end up in /home/carol/docs/notes.",
  code="$ pwd\n/home/carol/projects/web\n$ cd ../../docs/./notes\n$ pwd",
  run="b=$PWD; mkdir -p home/carol/projects/web home/carol/docs/notes; cd home/carol/projects/web; cd ../../docs/./notes; pwd | sed \"s|^$b||\"",
  expect="OPT", level=3)
S("2.3", "Which command lists hidden files in your home directory but leaves out the `.` and `..` entries?",
  ["✔ls -A ~", "ls -a ~", "ls -l ~", "ls -d ~"],
  "`-a` shows every entry, including `.` (this directory) and `..` (the parent). `-A` (almost all) shows hidden files without those two. `-d` lists the directory itself instead of its contents.",
  run="touch .hidden visible; ls -A | tr '\\n' ' '", expect=".hidden visible", level=2)
S("2.3", "In this listing, which entry is a directory, and how can you tell?",
  ["✔archive, because its line starts with d", "notes.txt, because the name has an extension",
   "archive, because its size is 4096", "Both, because both have read permission for others"],
  "The first character of `ls -l` output is the file type: `d` for a directory, `-` for a regular file and `l` for a symbolic link. Directories often show 4096, but that is just the size of the directory's entry table, and a file could be that size too.",
  code="$ ls -l\ntotal 8\ndrwxr-xr-x 2 carol carol 4096 Oct  2 09:14 archive\n-rw-r--r-- 1 carol carol  220 Oct  2 09:15 notes.txt", level=3)
S("2.3", "Which command lists /var/log in long format, largest files first, with sizes such as 4.0K and 12M?",
  ["✔ls -lhS /var/log", "ls -lht /var/log", "ls -lhr /var/log", "ls -lhR /var/log"],
  "`-S` sorts by size, largest first, and `-h` shows human-readable units. `-t` sorts by modification time, `-r` reverses the sort and `-R` recurses into subdirectories.",
  run="head -c 3000 /dev/zero > big; head -c 10 /dev/zero > small; head -c 500 /dev/zero > mid; ls -lhS | awk 'NR>1{print $NF}' | tr '\\n' ' '",
  expect="big mid small", level=2)
S("2.3", "User tom (home /home/tom) is in /home/tom/music. Which paths refer to /home/tom/docs/cv.pdf?",
  ["✔../docs/cv.pdf", "✔~/docs/cv.pdf", "/docs/cv.pdf", "./docs/cv.pdf", "../../docs/cv.pdf"],
  "`..` from /home/tom/music is /home/tom, and `~` is tom's home directory, so both reach /home/tom/docs. `/docs` starts at the root, `./docs` would be inside music, and `../..` goes up to /home.",
  level=3)
S("2.3", "Based on this recursive listing, which statement is true?",
  ["✔app is a directory containing main.py, and README is not a directory", "README and app are both directories",
   "main.py is in the same directory as README", "projects contains three subdirectories"],
  "`ls -R` prints a heading (such as `projects/app:`) for every directory it enters. Only app gets its own section, so README is a regular file, and main.py lives inside app.",
  code="$ ls -R projects\nprojects:\napp  README\n\nprojects/app:\nmain.py",
  run="mkdir -p projects/app; touch projects/README projects/app/main.py; ls -R projects", expect="projects:\nREADME\napp\n\nprojects/app:\nmain.py", level=3)

# ---------------- 2.4 Creating, Moving and Deleting Files (6) ----------------
S("2.4", "notes is an existing directory. What does the final `ls` show?",
  ["✔notes", "b.txt  notes", "a.txt  b.txt  notes", "Nothing, because mv fails with three arguments"],
  "When mv gets several sources, the last argument must be a directory, and all the sources move into it. Both files are now inside notes, so only notes is left here.",
  code="$ ls\na.txt  b.txt  notes\n$ mv a.txt b.txt notes\n$ ls",
  run="touch a.txt b.txt; mkdir notes; mv a.txt b.txt notes; ls", expect="OPT", level=3)
S("2.4", "What happens when these commands run in a directory that contains only report.txt?",
  ["✔The first creates a file named backup, and the second fails because backup is not a directory",
   "Both create a directory named backup and copy the file into it", "The first fails because backup doesn't exist",
   "The second overwrites backup with a directory"],
  "cp to a name that doesn't exist creates a file with that name. A trailing slash says the target must be a directory, so the second cp fails with 'Not a directory'. Create directories first with mkdir.",
  code="$ cp report.txt backup\n$ cp report.txt backup/",
  run="touch report.txt; cp report.txt backup; cp report.txt backup/ 2>/dev/null; echo $?; [ -f backup ] && echo file", expect="1\nfile", level=3)
S("2.4", "A directory contains data1.csv, data2.csv, data10.csv, Data3.csv and data_old.csv. Which files does `ls data[0-9]*.csv` list?",
  ["✔data1.csv, data10.csv and data2.csv", "data1.csv and data2.csv only", "Every file except data_old.csv", "data1.csv, data2.csv, Data3.csv and data10.csv"],
  "`[0-9]` matches exactly one digit right after `data`, and `*` matches anything (including nothing) before `.csv`. data10.csv matches because `*` covers the 0. Data3.csv fails because globs are case-sensitive, and data_old.csv has `_` where a digit is needed.",
  run="touch data1.csv data2.csv data10.csv Data3.csv data_old.csv; ls data[0-9]*.csv | tr '\\n' ' '", expect="data1.csv data10.csv data2.csv", level=3)
S("2.4", "Which command deletes the directory build and everything in it, but asks before removing each item?",
  ["✔rm -ri build", "rm -rf build", "rmdir -i build", "rm -i build"],
  "`-r` recurses and `-i` asks before every removal. `-f` forces the opposite: no questions and no errors for missing files. rmdir removes only empty directories, and rm without -r refuses to delete a directory.",
  level=2)
S("2.4", "What is the result in an empty directory?",
  ["✔It fails because a and a/b don't exist", "It creates a, a/b and a/b/c", "It creates c in the current directory instead", "It creates a only"],
  "Without `-p`, mkdir creates only the last component, and the parent directories must already exist. `mkdir -p a/b/c` creates every missing parent.",
  code="$ mkdir a/b/c", run="mkdir a/b/c 2>/dev/null; echo $?; ls | wc -l", expect="1\n0", level=3)
S("2.4", "A directory contains .config, app.conf and notes.txt. Which files does `rm *` delete?",
  ["✔app.conf and notes.txt", "All three files", "Only notes.txt", "None, because * needs the -r option"],
  "In Bash, `*` doesn't match names that start with a dot, so hidden files survive. That's why `rm *` leaves .config behind and why `ls` needs -a to show it.",
  run="touch .config app.conf notes.txt; rm *; ls -A", expect=".config", level=3)

# ---------------- 3.1 Archiving Files on the Command Line (6) ----------------
S("3.1", "An archive was created with `tar -cvzf site.tar.gz www/`. Which command later restores www/ into the current directory?",
  ["✔tar -xzf site.tar.gz", "tar -czf site.tar.gz www/", "gunzip site.tar.gz www/", "tar -xJf site.tar.gz"],
  "`-x` extracts, `-z` matches the gzip compression used to create it, and `-f` names the archive. Repeating `-c` would overwrite the archive. `-J` expects xz data and fails on a gzip file. gunzip alone leaves an uncompressed .tar.",
  run="mkdir www; echo hi > www/i; tar -cvzf site.tar.gz www/ >/dev/null; rm -r www; tar -xzf site.tar.gz; cat www/i", expect="hi", level=2)
S("3.1", "Which commands create a single compressed archive of the directory logs?",
  ["✔tar -cjf logs.tar.bz2 logs", "✔zip -r logs.zip logs", "gzip -r logs", "tar -tf logs.tar logs", "gzip logs"],
  "tar with `-j` bundles and compresses with bzip2, and `zip -r` archives and compresses in one step. `gzip -r` compresses each file separately inside the directory, plain gzip refuses to compress a directory, and `-t` lists an archive.",
  run="mkdir logs; echo a > logs/x; tar -cjf logs.tar.bz2 logs && bzip2 -t logs.tar.bz2 && echo ok; zip -qr logs.zip logs && unzip -l logs.zip | grep -c logs/x; gzip -r logs; ls logs",
  expect="ok\n1\nx.gz", level=2)
S("3.1", "You run `tar -xzf backup.tar.gz` from /tmp. Where does notes.txt end up?",
  ["✔/tmp/home/carol/notes.txt", "/home/carol/notes.txt", "/tmp/notes.txt", "/tmp/backup/home/carol/notes.txt"],
  "GNU tar strips the leading `/` when it creates an archive, so members are stored as relative paths. They are extracted below the current directory, and `-C` chooses a different target directory.",
  code="$ tar -tzf backup.tar.gz\nhome/carol/notes.txt\nhome/carol/todo.txt",
  run="mkdir -p home/carol; touch home/carol/notes.txt home/carol/todo.txt; tar -czf backup.tar.gz home; rm -r home; mkdir tmp; cd tmp; tar -xzf ../backup.tar.gz; ls home/carol",
  expect="notes.txt\ntodo.txt", level=3)
F("3.1", "Type the complete command that compresses big.log with xz, replacing it with big.log.xz.",
  ["xz big.log", "xz -z big.log", "xz --compress big.log", "xz -v big.log", "xz -9 big.log"],
  "Like gzip and bzip2, xz replaces the original file with a compressed one and adds .xz. `unxz` or `xz -d` reverses it, and `-k` keeps the original.",
  run="echo hi > big.log; {A} 2>/dev/null; ls", expect="big.log.xz", level=2)
S("3.1", "Which command decompresses archive.tar.xz and extracts its files in one step?",
  ["✔tar -xJf archive.tar.xz", "tar -xjf archive.tar.xz", "unxz -x archive.tar.xz", "tar -cJf archive.tar.xz"],
  "Uppercase `-J` selects xz and `-x` extracts. Lowercase `-j` is bzip2, `-c` would create (overwrite) the archive, and unxz has no extract option, since it only decompresses.",
  run="touch f; tar -cJf archive.tar.xz f; rm f; tar -xJf archive.tar.xz; ls f", expect="f", level=2)
S("3.1", "Which command shows the files inside photos.zip without extracting them?",
  ["✔unzip -l photos.zip", "zip -l photos.zip", "tar -tf photos.zip", "unzip -x photos.zip"],
  "`unzip -l` lists the archive's contents. For zip, `-l` converts line endings rather than listing. GNU tar doesn't read zip files, and unzip's `-x` excludes files from extraction.",
  run="touch a.jpg; zip -q photos.zip a.jpg; unzip -l photos.zip | grep -c ' a.jpg$'", expect="1", level=2)

# ---------------- 3.2 Searching and Extracting Data from Files (9) ----------------
S("3.2", "What does the last command output?",
  ["✔root:/bin/bash and daemon:/usr/sbin/nologin, one per line", "root /bin/bash and daemon /usr/sbin/nologin, one per line",
   "root:x and daemon:x, one per line", "0:/root and 1:/usr/sbin, one per line"],
  "`cut -d:` splits each line on colons and `-f1,7` keeps fields 1 and 7 (username and shell). cut joins the kept fields with the same delimiter.",
  code="$ head -2 /etc/passwd\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n$ head -2 /etc/passwd | cut -d: -f1,7",
  run="printf 'root:x:0:0:root:/root:/bin/bash\\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\\n' | cut -d: -f1,7",
  expect="root:/bin/bash\ndaemon:/usr/sbin/nologin", level=3)
S("3.2", "Which command prints how many lines of /var/log/syslog contain error, Error or ERROR?",
  ["✔grep -ic error /var/log/syslog", "grep -i error /var/log/syslog | wc -w", "grep -cv error /var/log/syslog", "wc -l error /var/log/syslog"],
  "`-i` ignores case and `-c` prints the count of matching lines instead of the lines. Counting words would count every word on those lines, `-v` inverts the match, and wc would treat error as a file name.",
  run="printf 'Error a\\nok\\nerror b\\nERROR\\n' > s; grep -ic error s", expect="3", level=2)
S("3.2", "Which lines does `grep -E '^[0-9]+$' data.txt` match?",
  ["✔42", "✔007", "4 2", "42a", "An empty line"],
  "`^` and `$` anchor the start and end of the line, and `[0-9]+` means one or more digits. So the whole line must be digits only. A space or a letter breaks the match, and an empty line has zero digits.",
  run="printf '42\\n007\\n4 2\\n42a\\n\\n' | grep -E '^[0-9]+$'", expect="42\n007", level=3)
S("3.2", "f exists and nofile doesn't. What appears on the terminal?",
  ["✔Only the error message about nofile", "Nothing, because both outputs go to out.txt", "Only the line f", "Both the line f and the error message"],
  "Redirections are processed left to right. `2>&1` points stderr at the terminal (where stdout points at that moment), and then `> out.txt` moves only stdout to the file. To send both to the file, write `> out.txt 2>&1`.",
  code="$ ls f nofile 2>&1 > out.txt",
  run="touch f; ls f nofile 2>&1 >out.txt | grep -c nofile; cat out.txt", expect="1\nf", level=3)
S("3.2", "Which command prints only line 5 of notes.txt?",
  ["✔head -n 5 notes.txt | tail -n 1", "tail -n 5 notes.txt | head -n 1", "head -n 5 notes.txt | head -n 1", "cut -f 5 notes.txt"],
  "head keeps lines 1 to 5, and tail then keeps the last of those. `tail -n 5 | head -n 1` gives the fifth line from the end. cut selects fields within each line, not lines.",
  run="seq 1 20 > notes.txt; head -n 5 notes.txt | tail -n 1", expect="5", level=3)
S("3.2", "Which command sorts the lines of /etc/passwd numerically by UID (the third field)?",
  ["✔sort -t: -k3 -n /etc/passwd", "sort -k3 /etc/passwd", "sort -n /etc/passwd", "cut -d: -f3 /etc/passwd | sort -n"],
  "`-t:` sets the field separator, `-k3` sorts on field 3 and `-n` compares numbers. Without `-t`, fields are separated by blanks. The cut version sorts only the UIDs and loses the rest of each line.",
  run="printf 'a:x:100:\\nb:x:9:\\nc:x:20:\\n' > p; sort -t: -k3 -n p | cut -d: -f1 | tr '\\n' ' '", expect="b c a", level=2)
S("3.2", "Which lines does `grep -E '^(cat|dog)s?$'` match?",
  ["✔cat", "✔dogs", "✔cats", "catdog", "dogss"],
  "In extended regular expressions, `(cat|dog)` matches either word, and `s?` matches zero or one s. The anchors require the whole line to fit, so catdog and dogss fail.",
  run="printf 'cat\\ndogs\\ncats\\ncatdog\\ndogss\\n' | grep -E '^(cat|dog)s?$'", expect="cat\ndogs\ncats", level=3)
S("3.2", "While viewing a long file in less, which key jumps to the end of the file?",
  ["✔G", "g", "q", "/"],
  "In less, `G` goes to the end and `g` to the beginning. `/` searches forward, `?` searches backward, `n` repeats the search and `q` quits.",
  level=1)
S("3.2", "In this output, what does 85 mean?",
  ["✔notes.txt contains 85 words", "notes.txt contains 85 lines", "notes.txt is 85 bytes long", "The longest line has 85 characters"],
  "Without options, wc prints lines, words and bytes, in that order, followed by the file name. Use `-l`, `-w` or `-c` to print just one count.",
  code="$ wc notes.txt\n  12  85 512 notes.txt", level=2)

# ---------------- 3.3 Turning Commands into a Script (12) ----------------
S("3.3", "The script count.sh contains the lines below. What does `./count.sh \"a b\" c` print?",
  ["✔2", "3", "1", "0"],
  "The shell removes the quotes and passes `a b` as one argument and c as another, so `$#` is 2. Without the quotes, the space would split it into three arguments.",
  code="#!/bin/bash\necho \"$#\"",
  run="printf '#!/bin/bash\\necho \"$#\"\\n' > count.sh; chmod +x count.sh; ./count.sh \"a b\" c", expect="2", level=3)
S("3.3", "What does this script print when it is run as `./check.sh /etc`?",
  ["✔dir", "file", "none", "file and dir on two lines"],
  "`-f` is true for regular files and `-d` for directories. /etc is a directory, so the first test fails and the elif branch runs. Only one branch of an if/elif/else ever runs.",
  code="#!/bin/bash\nif [ -f \"$1\" ]; then\n  echo \"file\"\nelif [ -d \"$1\" ]; then\n  echo \"dir\"\nelse\n  echo \"none\"\nfi",
  run="printf '#!/bin/bash\\nif [ -f \"$1\" ]; then\\n  echo file\\nelif [ -d \"$1\" ]; then\\n  echo dir\\nelse\\n  echo none\\nfi\\n' > check.sh; bash check.sh /etc",
  expect="dir", level=3)
S("3.3", "What does this command print?",
  ["✔missing", "found", "found and then missing", "Nothing"],
  "ls fails (non-zero exit status), so the command after `&&` is skipped and the one after `||` runs. `&&` means run if the previous command succeeded, and `||` means run if it failed.",
  code="$ ls /nonexistent 2>/dev/null && echo found || echo missing",
  run="ls /nonexistent 2>/dev/null && echo found || echo missing", expect="OPT", level=3)
S("3.3", "What do the two `echo $?` commands print?",
  ["✔1, then 0", "1, then 1", "0, then 0", "0, then 1"],
  "`false` exits with status 1, so the first `$?` is 1. That echo succeeds, so the second `$?` holds echo's status, 0. Save `$?` in a variable if you need it later.",
  code="$ false\n$ echo $?\n$ echo $?", run="false; echo $?; echo $?", expect="1\n0", level=3)
S("3.3", "What does this script print?",
  ["✔stop", "continue", "Nothing", "An error about the test"],
  "`=` compares strings exactly, and the comparison is case-sensitive. \"Yes\" isn't \"yes\", so the else branch runs. Quoting the variable keeps the test valid even if it's empty.",
  code="#!/bin/bash\nanswer=\"Yes\"\nif [ \"$answer\" = \"yes\" ]; then\n  echo \"continue\"\nelse\n  echo \"stop\"\nfi",
  run="answer=\"Yes\"; if [ \"$answer\" = \"yes\" ]; then echo continue; else echo stop; fi", expect="OPT", level=3)
S("3.3", "In this script, what is stored in count?",
  ["✔The number of entries that ls lists in /etc", "The text ls \"$dir\" | wc -l", "The exit status of wc", "Nothing, because $( ) output is discarded"],
  "`$( )` is command substitution: the shell runs the commands and stores their standard output. The pipe sends ls's list to `wc -l`, which counts the lines.",
  code="#!/bin/bash\ndir=/etc\ncount=$(ls \"$dir\" | wc -l)\necho \"$dir has $count entries\"", level=2)
S("3.3", "Which command makes backup.sh executable for its owner only, leaving other permissions unchanged?",
  ["✔chmod u+x backup.sh", "chmod +x backup.sh", "chmod 777 backup.sh", "chmod o+x backup.sh"],
  "`u+x` adds execute for the user (owner) only. `+x` adds it for everyone (subject to the umask), 777 gives everyone full access, and `o+x` affects others.",
  run="touch backup.sh; chmod 644 backup.sh; chmod u+x backup.sh; stat -c %A backup.sh", expect="-rwxr--r--", level=2)
S("3.3", "What is the third line printed when the script is run as `./info.sh red green`?",
  ["✔All: red green", "All: 2", "All: ./info.sh red green", "All: red"],
  "`$@` expands to all the arguments, but not `$0`, which holds the script name. `$#` would give the count, 2.",
  code="#!/bin/bash\necho \"Script: $0\"\necho \"First: $1\"\necho \"All: $@\"",
  run="printf '#!/bin/bash\\necho \"Script: $0\"\\necho \"First: $1\"\\necho \"All: $@\"\\n' > info.sh; chmod +x info.sh; ./info.sh red green | sed -n 3p",
  expect="OPT", level=3)
S("3.3", "In vi command mode, which command deletes the whole current line?",
  ["✔dd", "x", "D", "yy"],
  "`dd` deletes (cuts) the current line, and `p` pastes it. `x` deletes one character, `D` deletes from the cursor to the end of the line, and `yy` copies (yanks) the line without deleting it.",
  level=1)
S("3.3", "You are typing in vi's insert mode and want to quit without saving your changes. What do you type?",
  ["✔Esc, then :q!", ":q! right away", "Ctrl+X", "Esc, then :wq"],
  "Commands starting with `:` only work in command mode, so press Esc first. Typed in insert mode, `:q!` is just inserted as text. Ctrl+X exits nano, not vi, and `:wq` saves.",
  level=2)
S("3.3", "A script starts with `#!/bin/bash` but is run as `sh script.sh`. Which statement is true?",
  ["✔sh interprets the script and treats the shebang line as a comment", "Bash runs the script because of the shebang line",
   "The command fails with a 'bad interpreter' error", "The script runs twice, once in each shell"],
  "The kernel reads the shebang only when the file is executed directly, as in `./script.sh`. Naming an interpreter overrides it, and `#` lines are comments to the shell. On systems where sh isn't Bash, such as Debian's dash, Bash-only syntax may fail.",
  level=3)
S("3.3", "The directory contains only notes.md. What does this loop print?",
  ["✔found *.txt", "Nothing", "found notes.md", "An error message from for"],
  "When a glob matches nothing, Bash passes the pattern through unchanged, so the loop runs once with the literal text `*.txt`. Scripts often check `[ -e \"$f\" ]` inside the loop to guard against this.",
  code="$ for f in *.txt; do echo \"found $f\"; done",
  run="touch notes.md; for f in *.txt; do echo \"found $f\"; done", expect="OPT", level=3)

# ---------------- 4.1 Choosing an Operating System (3) ----------------
S("4.1", "A small office needs accounting software that is available only for Windows. Otherwise, staff just browse the web. Which desktop OS is the most practical choice?",
  ["✔Windows, because the required software runs there", "Linux, because it has no license cost",
   "macOS, because it is based on Unix", "A rolling-release Linux distribution for the newest features"],
  "Choose the OS by the applications and support you need. Linux saves license costs, but not if the one critical application won't run on it. macOS doesn't run Windows-only software either.",
  level=2)
S("4.1", "A team wants new features quickly on developer laptops but maximum stability on production servers. Which combination fits?",
  ["✔A frequently updated release on the laptops and an LTS release on the servers", "An LTS release on the laptops and a beta on the servers",
   "Beta releases everywhere so problems show up early", "A rolling release on the servers and an LTS release on the laptops"],
  "Rolling and regular releases get new software quickly, which suits workstations. LTS releases change little and get security fixes for years, which suits servers. Betas don't belong in production.",
  level=3)
S("4.1", "Why do many Linux servers run without a graphical desktop?",
  ["✔It saves RAM and CPU and leaves less software to patch", "Server hardware has no graphics chip, so a desktop can't be displayed",
   "The GPL forbids graphical desktops on servers", "Graphical desktops exist only for Ubuntu"],
  "Servers are usually managed remotely over SSH, so a desktop would just use resources and add more software to update and secure. Linux supports many desktops, such as GNOME and KDE, on any distribution.",
  level=2)

# ---------------- 4.2 Understanding Computer Hardware (6) ----------------
S("4.2", "Based on this lsblk output, which statement is true?",
  ["✔sdb is removable, and its partition is mounted at /run/media/carol/USB", "sda2 is the EFI system partition",
   "sdb1 holds the root filesystem", "sda has three partitions"],
  "RM=1 marks removable media such as USB sticks, and MOUNTPOINTS shows where each partition is mounted. sda has two partitions: sda1 is mounted at /boot/efi and sda2 at /.",
  code="$ lsblk\nNAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0 476.9G  0 disk\n├─sda1   8:1    0     1G  0 part /boot/efi\n└─sda2   8:2    0 475.9G  0 part /\nsdb      8:16   1  14.9G  0 disk\n└─sdb1   8:17   1  14.9G  0 part /run/media/carol/USB",
  level=3)
F("4.2", "A server has three SATA disks. Type the device file (full path) for the second partition on the third disk.",
  ["/dev/sdc2"],
  "Disks are lettered in order (sda, sdb, sdc) and partitions are numbered from 1. So the third disk is sdc, and its second partition is /dev/sdc2.",
  level=2)
S("4.2", "A USB webcam doesn't work after being plugged in. Which command lists USB devices, so you can check whether the system detects it?",
  ["✔lsusb", "lspci", "lsblk", "lscpu"],
  "lsusb lists devices on the USB buses, and lspci lists PCI devices such as graphics and network cards. lsblk shows only block (storage) devices, and lscpu shows the processor.",
  level=2)
S("4.2", "Which statement about RAM compared with disk storage is true?",
  ["✔RAM loses its contents at power-off, while a disk keeps data", "A hard disk is faster than RAM",
   "RAM stores the operating system permanently", "Swap space on a disk is faster than RAM, so the kernel fills it first"],
  "RAM is fast, volatile working memory. Disks and SSDs are slower but persistent, which is why programs and files are loaded from disk into RAM to run. Swap is disk space and much slower than RAM.",
  level=1)
S("4.2", "Which hardware component mostly determines how many programs can stay open at once before the system starts swapping?",
  ["✔The amount of RAM", "The power supply rating", "The optical drive", "The number of USB ports"],
  "Running programs and their data live in RAM. When RAM fills up, the kernel moves memory pages to swap on disk, which slows things down. More CPU cores help programs run faster but don't add memory.",
  level=2)
S("4.2", "A new network card was installed, but `ip link` doesn't list it. What is the most likely cause?",
  ["✔The kernel has no driver (module) loaded for the card", "The card needs a graphical desktop to work",
   "The DNS server in /etc/resolv.conf is wrong", "/etc/hosts doesn't list the card"],
  "The kernel can only create a network interface once a driver for the hardware is loaded. Check with `lspci` and `dmesg`. DNS and /etc/hosts affect name resolution, not whether an interface exists.",
  level=3)

# ---------------- 4.3 Where Data is Stored (9) ----------------
S("4.3", "Based on this ps output, which statement is true?",
  ["✔carol's python3 process uses about 45% of a CPU and was started from a terminal", "PID 1 is owned by carol",
   "The python3 process uses 45% of the RAM", "init is using most of the CPU"],
  "The columns are USER, PID, %CPU, %MEM and so on. python3 shows 45.2 %CPU and 3.1 %MEM, and TTY pts/0 means it runs in a terminal session. PID 1 belongs to root and is the init process.",
  code="$ ps aux | head -3\nUSER   PID %CPU %MEM    VSZ    RSS TTY   STAT START TIME COMMAND\nroot     1  0.0  0.1 168500  12000 ?     Ss   09:00 0:02 /sbin/init\ncarol 2314 45.2  3.1 900112 250000 pts/0 R+   09:30 5:10 python3 train.py",
  level=3)
S("4.3", "About how much memory can new programs use before the system needs to swap?",
  ["✔About 9.6 Gi", "About 1.1 Gi", "About 15 Gi", "About 2.0 Gi"],
  "The `available` column estimates how much memory programs can still get, including cache that the kernel can drop. `free` is memory that is completely unused, so it is misleadingly small. 2.0 Gi is swap, and 15 Gi is the total.",
  code="$ free -h\n               total        used        free      shared  buff/cache   available\nMem:            15Gi       5.2Gi       1.1Gi       300Mi       9.0Gi        9.6Gi\nSwap:          2.0Gi          0B       2.0Gi",
  level=3)
S("4.3", "Which file shows the kernel's detailed view of memory usage, the same data that free reads?",
  ["✔/proc/meminfo", "/etc/meminfo", "/var/log/meminfo", "/boot/meminfo"],
  "/proc is generated by the kernel on demand. /proc/meminfo lists memory totals and /proc/cpuinfo describes the CPUs. /etc holds configuration, /var/log holds logs, and /boot holds the kernel and boot files.",
  run="test -r /proc/meminfo && grep -c MemTotal /proc/meminfo", expect="1", level=2)
S("4.3", "A USB drive was just plugged in, but no icon appears. Which command shows whether the kernel detected it and which device name it got?",
  ["✔dmesg | tail", "cat /etc/fstab", "ls /boot", "free -h"],
  "The kernel logs hardware events to its ring buffer, such as 'sdb: sdb1' when a USB disk appears. /etc/fstab lists filesystems to mount at boot, /boot holds the kernel, and free shows memory.",
  level=2)
S("4.3", "Which file lists the filesystems that are mounted automatically at boot?",
  ["✔/etc/fstab", "/proc/mounts", "/var/log/fstab", "/boot/fstab"],
  "/etc/fstab is the configuration file read at boot. /proc/mounts is the kernel's live list of what is mounted right now, which also includes things mounted by hand.",
  level=1)
S("4.3", "Where would you look for the SSH server's configuration?",
  ["✔/etc/ssh/", "/var/log/ssh/", "/proc/ssh/", "/boot/ssh/"],
  "System-wide configuration lives under /etc, and the SSH server reads /etc/ssh/sshd_config. Logs go under /var/log, /proc is a virtual view of the kernel, and /boot holds boot files.",
  level=2)
S("4.3", "What do these log lines show?",
  ["✔Someone at 203.0.113.7 tried twice to log in as root over SSH and failed", "root logged in successfully over SSH",
   "The SSH service crashed twice while root was connected from 203.0.113.7", "The local root password was changed"],
  "Authentication events go to /var/log/auth.log on Debian and Ubuntu (/var/log/secure on Red Hat). Repeated failures for root from one address usually mean a password-guessing attack, which is why direct root login over SSH is often disabled.",
  code="$ tail -2 /var/log/auth.log\nOct 10 09:12:01 web sshd[2210]: Failed password for root from 203.0.113.7 port 51234 ssh2\nOct 10 09:12:05 web sshd[2210]: Failed password for root from 203.0.113.7 port 51234 ssh2",
  level=3)
S("4.3", "While top is running, which key asks for a PID and sends that process a signal to end it?",
  ["✔k", "q", "M", "P"],
  "`k` kills a process from inside top. `q` quits top, `M` sorts by memory and `P` sorts by CPU.",
  level=1)
S("4.3", "Which command hides the normal output of `make` but still shows its error messages?",
  ["✔make > /dev/null", "make 2> /dev/null", "make &> /dev/null", "make | /dev/null"],
  "`>` redirects only stdout (file descriptor 1), so stderr still reaches the screen. `2>` would hide the errors instead, and `&>` hides both. You can't pipe into a device file, because a pipe needs a command.",
  run="(sh -c 'echo out; echo err >&2' > /dev/null) 2>&1", expect="err", level=2)

# ---------------- 4.4 Your Computer on the Network (6) ----------------
S("4.4", "Based on this interface output, which statement is true?",
  ["✔The IPv4 address is 10.0.2.15 with a 24-bit network prefix", "The MAC address is 10.0.2.255",
   "The interface is down", "The IPv6 address can be reached from the internet"],
  "`inet` shows the IPv4 address and prefix (/24 means 255.255.255.0), and `brd` is the broadcast address. `link/ether` is the MAC address. The state is UP, and fe80:: addresses are link-local, so they only work on the local network.",
  code="$ ip addr show eth0\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0\n    inet6 fe80::5054:ff:fe12:3456/64 scope link",
  level=3)
S("4.4", "Through which gateway does a packet to 8.8.8.8 leave this host?",
  ["✔192.168.1.1", "192.168.1.42", "8.8.8.8 directly, with no gateway", "None, because there is no route"],
  "8.8.8.8 isn't in 192.168.1.0/24, so the default route applies, which sends traffic via the router at 192.168.1.1. 192.168.1.42 is this host's own address (src).",
  code="$ ip route show\ndefault via 192.168.1.1 dev wlan0 proto dhcp metric 600\n192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.42",
  level=3)
S("4.4", "`ping 8.8.8.8` works, but `ping example.com` fails with 'Name or service not known'. What should you check first?",
  ["✔The DNS server settings in /etc/resolv.conf", "The default gateway configured in the routing table", "Whether the network cable is plugged in", "The firewall on 8.8.8.8"],
  "Reaching an IP address proves that the cable, the address and the gateway all work. The failure starts when a name must be resolved, which points to DNS. Check /etc/resolv.conf, then test with `host example.com`.",
  level=3)
S("4.4", "On a system with the usual name lookup order, what happens when you run `ping intranet`?",
  ["✔It pings 10.0.0.5 without asking a DNS server", "It asks the DNS server for intranet first and ignores this file",
   "It pings 127.0.0.1", "It fails because intranet isn't a fully qualified name"],
  "/etc/hosts is checked before DNS by default (`hosts: files dns` in /etc/nsswitch.conf). Every name on a line, including the short alias intranet, maps to that line's address.",
  code="$ cat /etc/hosts\n127.0.0.1   localhost\n10.0.0.5    intranet.example.com intranet",
  level=3)
S("4.4", "Which command shows which program is listening on TCP port 22?",
  ["✔sudo ss -tlnp", "ip route show", "host 22", "ping -p 22 localhost"],
  "ss lists sockets: `-t` TCP, `-l` listening, `-n` numeric ports and `-p` the owning process (root sees all of them). `netstat -tlnp` is the older equivalent. ip route shows routes, and host does DNS lookups.",
  level=2)
S("4.4", "Which of these are valid host addresses on the network 192.168.10.0/24?",
  ["✔192.168.10.1", "✔192.168.10.254", "192.168.10.255", "192.168.10.256", "192.168.11.1"],
  "A /24 network spans 192.168.10.0 to 192.168.10.255. The first address names the network and the last is the broadcast address, so hosts use .1 to .254. 256 isn't a valid octet, and 192.168.11.x is a different network.",
  level=3)

# ---------------- 5.1 Basic Security and Identifying User Types (6) ----------------
S("5.1", "What can you conclude from this /etc/passwd entry?",
  ["✔It is a system account that can't log in interactively", "It is a regular user who logs in with Bash",
   "The account has root privileges because its UID is below 1000", "The password is stored in this line"],
  "A low UID and the shell /usr/sbin/nologin mark a system (service) account, here used by the web server. A UID below 1000 doesn't give root power, since only UID 0 is root. The x means the hash is in /etc/shadow.",
  code="www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin", level=3)
S("5.1", "Based on this id output on Ubuntu, which statement is true?",
  ["✔carol's primary group is carol, and she can probably use sudo", "carol is the root user",
   "carol's primary group is developers", "carol's UID is 27"],
  "`gid=` shows the primary group, and `groups=` lists all of them. On Debian and Ubuntu, members of the sudo group may run commands as root with sudo (on Red Hat the group is wheel). Root would show uid=0.",
  code="$ id carol\nuid=1001(carol) gid=1001(carol) groups=1001(carol),27(sudo),1005(developers)", level=3)
S("5.1", "Based on this who output, which statement is true?",
  ["✔tom is logged in remotely from 203.0.113.20, and carol is at a local console", "Both users are logged in locally",
   "carol is logged in remotely and tom is at the console", "tom has already logged out"],
  "`who` shows current sessions. tty devices are local consoles, pts devices are pseudo-terminals such as SSH sessions or terminal windows, and the address in parentheses is where a remote login came from.",
  code="$ who\ncarol    tty2         2026-10-10 08:01\ntom      pts/0        2026-10-10 09:15 (203.0.113.20)", level=3)
S("5.1", "Which command starts an interactive root login shell using your own password, through sudo?",
  ["✔sudo -i", "sudo -l", "su -c", "sudo !!"],
  "`sudo -i` runs root's login shell after checking the sudoers rules. `sudo -l` lists what you are allowed to run, `su -c` runs one command and needs root's password, and `sudo !!` reruns the previous command with sudo.",
  level=2)
S("5.1", "Which command shows when user tom last logged in and where from, even though he isn't logged in now?",
  ["✔last tom", "who tom", "w -h tom", "id tom"],
  "`last` reads the login history (/var/log/wtmp). who and w only show current sessions, and id shows UIDs and groups.",
  level=2)
S("5.1", "Why should administrators work as a regular user and use sudo instead of logging in as root?",
  ["✔Mistakes and malware have limited rights by default, and sudo logs who ran each admin command",
   "root isn't allowed to run graphical programs", "sudo makes commands run faster than root does",
   "The root account has no home directory"],
  "Least privilege limits the damage from a typo or a malicious program. sudo also asks for confirmation through your password and records each command in the logs, so admin actions can be traced to a person.",
  level=2)

# ---------------- 5.2 Creating Users and Groups (6) ----------------
S("5.2", "Which command adds carol to the docker group without removing her from her other supplementary groups?",
  ["✔usermod -aG docker carol", "usermod -G docker carol", "groupadd docker carol", "useradd -a -G docker carol"],
  "`-G` sets the full list of supplementary groups, and `-a` (append) adds to it instead of replacing it. Plain `-G docker` removes carol from every other supplementary group. useradd only creates new users. Group changes take effect at her next login.",
  run="groupadd -f le6g1; groupadd -f le6g2; userdel -r le6u >/dev/null 2>&1; useradd -M le6u; usermod -aG le6g1 le6u; usermod -aG le6g2 le6u; id -nG le6u; userdel le6u; groupdel le6g1; groupdel le6g2",
  expect="le6u le6g1 le6g2", level=2)
S("5.2", "In this /etc/shadow entry, what does 99999 mean?",
  ["✔The maximum number of days between password changes, which here means never", "The account's user ID",
   "The number of failed login attempts allowed", "The day the account was created"],
  "The fields are name, hash, last change (in days since 1970), minimum days, maximum days, warning days, inactivity days and expiry date. 99999 days is about 273 years, so the password effectively never has to be changed. `chage -l carol` shows these values in plain words.",
  code="carol:$6$Xa1...:20000:0:99999:7:::", level=2)
S("5.2", "In this /etc/passwd entry, where is tom's password hash stored?",
  ["✔In /etc/shadow, readable only by root", "In this line, where x is the hash", "In /etc/group", "Nowhere, because x means he has no password"],
  "x in the second field means the hash is kept in /etc/shadow, which regular users can't read, unlike /etc/passwd. The other fields are UID, GID, comment, home directory and login shell.",
  code="tom:x:1002:1002:Tom Lee,,,:/home/tom:/bin/bash", level=2)
F("5.2", "Type the complete command that creates the group webadmins with GID 2000.",
  ["groupadd -g 2000 webadmins", "groupadd --gid 2000 webadmins", "groupadd webadmins -g 2000"],
  "`groupadd -g` sets a specific group ID; without it, the next free GID is used. The new group is added to /etc/group.",
  run="groupdel webadmins >/dev/null 2>&1; {A}; getent group webadmins | cut -d: -f3; groupdel webadmins", expect="2000", level=2)
S("5.2", "Which command creates user anna with a home directory, the comment Anna Ruiz and the supplementary group sales?",
  ["✔useradd -m -c \"Anna Ruiz\" -G sales anna", "useradd -m -g \"Anna Ruiz\" -c sales anna",
   "useradd -m -s \"Anna Ruiz\" -G sales anna", "useradd -c \"Anna Ruiz\" -G sales -m"],
  "`-m` creates the home directory, `-c` sets the comment (GECOS) field and `-G` adds supplementary groups. `-g` sets the primary group and `-s` the shell. The username must be the last argument.",
  level=2)
S("5.2", "An administrator adds a custom .bashrc to /etc/skel. Which users get it?",
  ["✔Users created afterwards with a home directory", "All existing users, immediately", "Only root", "Only users created afterwards with the useradd -M option"],
  "/etc/skel is copied only when a home directory is created, for example by `useradd -m`. Existing users' home directories aren't changed, and `-M` skips creating a home directory.",
  level=3)

# ---------------- 5.3 Managing File Permissions and Ownership (6) ----------------
S("5.3", "A file has permissions -rwxr-x---. What are its permissions after `chmod g+w,o+r file`?",
  ["✔-rwxrwxr--", "-rwxr-xr--", "-rwxrwx---", "-rw-rwxr--"],
  "Symbolic chmod changes only what you name: `g+w` adds write for the group (r-x becomes rwx) and `o+r` adds read for others (--- becomes r--). The owner's rwx is untouched.",
  run="touch file; chmod 750 file; chmod g+w,o+r file; stat -c %A file", expect="OPT", level=3)
S("5.3", "Which command gives the owner full access, the group read and execute, and others nothing?",
  ["✔chmod 750 app", "chmod 705 app", "chmod 570 app", "chmod 755 app"],
  "Each digit sums r=4, w=2 and x=1 for owner, group and others in that order. rwx is 7, r-x is 5 and --- is 0. 755 would also give others r-x.",
  run="touch app; chmod 750 app; stat -c %A app", expect="-rwxr-x---", level=2)
S("5.3", "tom is a member of the group team, but isn't carol. Can tom create a file in shared?",
  ["✔No, because the group has r-x on the directory and no w", "Yes, because he is in the team group",
   "Yes, because write permission is ignored on directories", "Only if the new file is empty"],
  "Creating, deleting or renaming entries requires write permission on the directory. tom gets the group's r-x, which lets him list and enter the directory but not change it.",
  code="$ ls -ld shared\ndrwxr-xr-x 2 carol team 4096 Oct 10 09:00 shared", level=3)
S("5.3", "What does the s in this listing mean?",
  ["✔SUID: the program runs with the file owner's (root's) privileges", "Sticky bit: only the file's owner (root) can delete, rename or run it",
   "The file is a symbolic link", "The file is a socket"],
  "An s in the owner's execute position is the set-user-ID bit. That lets regular users run passwd with root's rights so it can update /etc/shadow. SGID shows s in the group position, and the sticky bit shows t for others.",
  code="$ ls -l /usr/bin/passwd\n-rwsr-xr-x 1 root root 59976 Feb  6  2026 /usr/bin/passwd", level=2)
F("5.3", "Type the complete command that makes /srv/data and everything inside it owned by user www-data and group www-data.",
  ["chown -R www-data:www-data /srv/data", "chown --recursive www-data:www-data /srv/data", "chown -R www-data: /srv/data",
   "chown www-data:www-data -R /srv/data"],
  "`user:group` sets both owner and group, and `-R` recurses. `user:` with nothing after the colon uses the user's login group, which is www-data here. Run it as root.",
  level=3)
S("5.3", "report.txt has -rwxrwxrwx. Which command removes write permission for the group and others but changes nothing else?",
  ["✔chmod go-w report.txt", "chmod 644 report.txt", "chmod go=w report.txt", "chmod u-w report.txt"],
  "`go-w` takes away only w for the group and others, giving -rwxr-xr-x. 644 would also remove every execute bit, `go=w` would leave the group and others with write only, and `u-w` affects the owner.",
  run="touch report.txt; chmod 777 report.txt; chmod go-w report.txt; stat -c %A report.txt", expect="-rwxr-xr-x", level=2)

# ---------------- 5.4 Special Directories and Files (3) ----------------
S("5.4", "What is the relationship between these two files?",
  ["✔They are hard links to the same data, so a change made through one name shows in the other",
   "copy.txt is an independent copy made with cp", "copy.txt is a symbolic link to report.txt",
   "Deleting report.txt also deletes the data in copy.txt"],
  "Both names show the same inode number (1311) and a link count of 2, so they are two names for one file. The data stays until the last name is removed. A symbolic link would start with l and show `-> target`.",
  code="$ ls -li\n1311 -rw-r--r-- 2 carol carol 42 Oct 10 09:00 copy.txt\n1311 -rw-r--r-- 2 carol carol 42 Oct 10 09:00 report.txt",
  run="echo x > report.txt; ln report.txt copy.txt; echo y >> copy.txt; cat report.txt; rm report.txt; cat copy.txt", expect="x\ny\nx\ny", level=3)
S("5.4", "Which command sets the sticky bit on the shared directory /srv/drop?",
  ["✔chmod +t /srv/drop", "chmod +s /srv/drop", "chmod u+x /srv/drop", "chown +t /srv/drop"],
  "`+t` sets the sticky bit (octal 1000, as in `chmod 1777`), so users can delete only their own files, like in /tmp. `+s` sets SUID/SGID, and chown changes ownership, not mode bits.",
  run="mkdir drop; chmod 777 drop; chmod +t drop; stat -c %A drop", expect="drwxrwxrwt", level=2)
S("5.4", "What happens when the last command runs?",
  ["✔cat fails, because the relative link now points to /tmp/notes/todo.txt, which doesn't exist",
   "cat prints the contents of /home/carol/notes/todo.txt", "mv converts the link into a regular file",
   "mv refuses to move a symbolic link"],
  "A symbolic link stores only the path text. A relative target is resolved from the link's own directory, so after the move it points into /tmp. Use an absolute target, such as `ln -s /home/carol/notes/todo.txt`, if the link may move.",
  code="$ cd /home/carol\n$ ln -s notes/todo.txt todo\n$ mv todo /tmp/\n$ cat /tmp/todo",
  run="mkdir notes t; echo hi > notes/todo.txt; ln -s notes/todo.txt todo; mv todo t/; cat t/todo 2>/dev/null || echo broken", expect="broken", level=3)
