# SPDX-License-Identifier: AGPL-3.0-or-later
"""Hands-on questions: matching and ordering.

The real 010-160 exam is multiple choice and fill-in only, so these never appear in Exam mode and are not part of
the 400-question bank. They live in Study > Hands-on, as another way to practise the same objectives, and they are
the first content for the interactive question engine that later packs (CompTIA-style exams) need inside exams.

Every item is original and stays inside the Linux Essentials 1.6 objectives and their listed terms.

  M(id, question, [(left, right), ...], explanation, extra=[more right-hand choices that match nothing])
      Match each left item to one right item. Several left items may share a right item.
  O(id, question, [items in the correct order], explanation)
      Put the items in order. They are shown shuffled.

IDs are permanent ("ix-<objective>-<number>"), like question IDs: progress is saved under them.
Text may use `code` and **bold** like the question bank.
"""

ITEMS = []


def M(id, q, pairs, ex, extra=()):
    ITEMS.append(dict(id=id, type="match", q=q, pairs=list(pairs), extra=list(extra), ex=ex))


def O(id, q, items, ex):
    ITEMS.append(dict(id=id, type="order", q=q, items=list(items), ex=ex))


# ----------------------------------------------------------------- Topic 1: the Linux community and open source
M("ix-1.1-01", "Match each distribution to the package tools it uses.",
  [("Ubuntu", "`apt` with .deb packages"), ("CentOS", "`yum` with .rpm packages"),
   ("Red Hat Enterprise Linux", "`yum` with .rpm packages"), ("Linux Mint", "`apt` with .deb packages"), ("Debian", "`apt` with .deb packages")],
  "Debian uses .deb packages with `apt`, and so do the distributions built on it, Ubuntu and Linux Mint. Red Hat "
  "Enterprise Linux and CentOS, which is built from it, use .rpm packages with `yum`.", extra=["Source code only, compiled on install"])

M("ix-1.2-01", "Match each program to what it is used for.",
  [("LibreOffice Writer", "Word processing"), ("GIMP", "Editing photos and images"), ("Thunderbird", "Reading and sending email"),
   ("Apache HTTPD", "Serving web pages"), ("MySQL", "Storing data in a relational database"), ("Firefox", "Browsing the web")],
  "Writer, GIMP, Thunderbird and Firefox are desktop applications. Apache HTTPD and MySQL are server programs: one "
  "answers web requests, the other stores data that applications query.", extra=["Playing audio and video"])

M("ix-1.3-01", "Match each licence to what it allows or requires.",
  [("GNU GPL", "Copyleft: changed versions you distribute must stay under the same licence"),
   ("BSD licence", "Permissive: the code may be reused in closed-source products"),
   ("Creative Commons", "Written for text, images and other creative works, not for software")],
  "The GPL is a copyleft licence: anyone who distributes a changed version must pass on the same freedoms. The BSD "
  "licences are permissive and allow closed-source reuse. Creative Commons licences cover works such as "
  "documentation, music and pictures.", extra=["Proprietary: the source code may not be shared at all"])

M("ix-1.3-02", "Match each organisation to what it stands for.",
  [("Free Software Foundation (FSF)", "Free software as a matter of users' freedom; publishes the GPL"),
   ("Open Source Initiative (OSI)", "Approves licences that meet the Open Source Definition")],
  "The FSF, founded by Richard Stallman, argues for software freedom and publishes the GNU licences. The OSI keeps the "
  "Open Source Definition and a list of licences that meet it. Most free software is also open source, and the other "
  "way round.", extra=["Develops and releases the Linux kernel", "Sells support subscriptions for a distribution"])

# ----------------------------------------------------------------- Topic 2: finding your way on a Linux system
M("ix-2.1-01", "The variable `HOME` holds `/home/sam`. Match each command to what it prints.",
  [("`echo $HOME`", "`/home/sam`"), ("`echo \"$HOME\"`", "`/home/sam`"),
   ("`echo '$HOME'`", "`$HOME`"), ("`echo \\$HOME`", "`$HOME`")],
  "The shell replaces `$HOME` with its value when it is unquoted or inside double quotes. Single quotes keep every "
  "character literal, and a backslash does the same for the one character after it.", extra=["Nothing"])

M("ix-2.2-01", "Match each way of getting help to what it gives you.",
  [("`man ls`", "The full manual page for a command"), ("`ls --help`", "A short option summary printed by the command itself"),
   ("`info ls`", "The GNU documentation, organised into linked nodes"), ("`man -k copy`", "Manual pages whose description mentions a keyword"),
   ("`/usr/share/doc`", "Documentation files installed by packages"), ("`locate passwd`", "Paths of files whose name matches, from a database")],
  "`man` shows a manual page and `man -k` (the same as `apropos`) searches the page descriptions. Most commands print "
  "a summary with `--help`. `info` reads GNU's longer, linked documentation. Packages put READMEs and examples under "
  "`/usr/share/doc`. `locate` looks file names up in a database that `updatedb` builds.")

M("ix-2.3-01", "Match each path shortcut to what it means.",
  [("`.`", "The current directory"), ("`..`", "The parent of the current directory"),
   ("`~`", "Your home directory"), ("`/`", "The root of the whole file system")],
  "`.` and `..` exist in every directory and are what relative paths like `../docs` are built from. The shell "
  "replaces `~` with your home directory. `/` is the top of the tree, and a path that starts with it is absolute.",
  extra=["The previous directory you were in"])

M("ix-2.3-02", "Match each `ls` option to what it does.",
  [("`-a`", "Also show names that start with a dot"), ("`-l`", "Long format: permissions, owner, size, date"),
   ("`-R`", "List subdirectories too, all the way down"), ("`-h`", "With `-l`, show sizes as K, M, G")],
  "Hidden files are just files whose name starts with a dot, and `-a` shows them. `-l` gives one line per file with "
  "its details. `-R` is recursive. `-h` makes the sizes in a long listing human-readable.", extra=["Sort by file size"])

M("ix-2.4-01", "Match each file command to what it does.",
  [("`mv`", "Rename or move a file"), ("`cp`", "Make a copy of a file"), ("`rm`", "Delete a file"),
   ("`mkdir`", "Create a directory"), ("`rmdir`", "Remove an empty directory"), ("`touch`", "Create an empty file, or update a file's timestamp")],
  "`mv` both renames and moves: it is the same operation. `rmdir` only removes directories that are empty; a "
  "directory with contents needs `rm -r`. `touch` on a name that doesn't exist creates an empty file.")

M("ix-2.4-02", "Match each pattern to the file names it matches.",
  [("`*.txt`", "Any name that ends in .txt"), ("`?.txt`", "Exactly one character, then .txt"),
   ("`[abc]*`", "Names that start with a, b or c"), ("`[!0-9]*`", "Names that do not start with a digit")],
  "`*` matches any number of characters, `?` exactly one, and `[...]` one character from a set. A `!` right after the "
  "opening bracket inverts the set. The shell expands these patterns before the command runs.",
  extra=["Names that contain a space"])

# ----------------------------------------------------------------- Topic 3: the power of the command line
M("ix-3.1-01", "Match each `tar` option to what it does.",
  [("`-c`", "Create a new archive"), ("`-x`", "Extract files from an archive"), ("`-t`", "List the contents of an archive"),
   ("`-f`", "Use the archive file named next"), ("`-z`", "Compress or decompress with gzip"), ("`-j`", "Compress or decompress with bzip2")],
  "Every `tar` command needs one action (`-c`, `-x` or `-t`) and almost always `-f` with the archive's name. `-z` "
  "adds gzip and `-j` adds bzip2, giving the usual `.tar.gz` and `.tar.bz2` files.", extra=["Delete the files after archiving them"])

O("ix-3.1-02", "You want to pack the directory `docs` into a compressed archive, check the archive, remove the original and later bring it back. Put the commands in order.",
  ["`tar -czf docs.tar.gz docs`", "`tar -tzf docs.tar.gz`", "`rm -r docs`", "`tar -xzf docs.tar.gz`"],
  "Create first (`-c`), then list the archive (`-t`) to make sure everything is in it before deleting anything. Only "
  "then remove the directory. `-x` extracts it again.")

M("ix-3.2-01", "Match each operator to what it does.",
  [("`>`", "Write standard output to a file, replacing its contents"), ("`>>`", "Add standard output to the end of a file"),
   ("`2>`", "Write error messages to a file"), ("`<`", "Read standard input from a file"),
   ("`|`", "Send one command's output to the next command's input")],
  "Output redirection with `>` empties the file first, while `>>` appends. File descriptor 2 is standard error, so "
  "`2>` catches error messages. A pipe connects two commands without a file in between.")

M("ix-3.2-02", "Match each regular expression to the lines `grep` would print.",
  [("`^root`", "Lines that begin with root"), ("`bash$`", "Lines that end with bash"),
   ("`r..t`", "Lines containing r, any two characters, then t"), ("`[0-9]`", "Lines containing at least one digit")],
  "`^` anchors a match to the start of the line and `$` to the end. A dot stands for any single character. Square "
  "brackets match one character from the set.", extra=["Lines that contain a literal dot"])

O("ix-3.2-03", "Build one command line that saves the first five user names from `/etc/passwd`, in alphabetical order, to `first.txt`. Put the parts in order.",
  ["`cut -d: -f1 /etc/passwd`", "`| sort`", "`| head -5`", "`> first.txt`"],
  "`cut` takes the first colon-separated field, the user name. The names must be sorted before `head` takes the first "
  "five, or you get the first five lines of the file instead. The redirection to a file comes last.")

O("ix-3.3-01", "Put the lines of this script in order. It reports whether the file named as its first argument exists.",
  ["`#!/bin/bash`", "`if [ -f \"$1\" ]`", "`then`", "`  echo \"$1 exists\"`", "`else`", "`  echo \"$1 is missing\"`", "`fi`"],
  "The shebang must be the first line. An `if` statement runs a test, then the commands after `then` when the test "
  "succeeds, the commands after `else` when it fails, and ends with `fi`.")

M("ix-3.3-02", "A script is started as `./backup.sh docs /mnt/usb`. Match each variable to its value inside the script.",
  [("`$0`", "`./backup.sh`"), ("`$1`", "`docs`"), ("`$2`", "`/mnt/usb`"), ("`$#`", "`2`")],
  "`$0` is the name the script was started with, `$1` and `$2` are the first and second arguments, and `$#` is the "
  "number of arguments.", extra=["`3`", "`backup.sh docs /mnt/usb`"])

O("ix-3.3-03", "Put the lines of this loop in order. It prints the name of every .txt file in the current directory.",
  ["`for f in *.txt`", "`do`", "`  echo \"$f\"`", "`done`"],
  "A `for` loop names a variable and a list, then runs the commands between `do` and `done` once for each item. The "
  "shell expands `*.txt` to the matching file names before the loop starts.")

O("ix-3.3-04", "Put the steps for writing and running your first shell script in order.",
  ["Open `hello.sh` in a text editor and type `#!/bin/bash` as the first line", "Add the commands, save the file and leave the editor",
   "`chmod +x hello.sh`", "`./hello.sh`"],
  "The interpreter line goes first in the file. A new file is not executable, so it needs `chmod +x` before it can "
  "be run by name. The current directory is not in `PATH`, which is why the script is started as `./hello.sh`.")

M("ix-3.3-05", "Match each exit status to what it tells you.",
  [("`0`", "The command succeeded"), ("Any number from 1 to 255", "The command failed")],
  "Every command returns an exit status, kept in `$?`. Zero means success and anything else means failure, with the "
  "number often saying what went wrong. `if` and `&&` act on this value.",
  extra=["The command is still running", "The command printed no output"])

# ----------------------------------------------------------------- Topic 4: the Linux operating system
M("ix-4.1-01", "Match each kind of release to what it means.",
  [("Beta", "A test version published before the final release"), ("Stable", "The finished release, meant for everyday use"),
   ("LTS", "A release that gets updates for several years")],
  "Distributions publish beta versions so that problems are found before release. A stable release is the finished "
  "one. Long Term Support (LTS) releases are kept updated for years, which suits servers and businesses.",
  extra=["A release that only works on one brand of hardware"])

M("ix-4.2-01", "Match each component to its job.",
  [("CPU", "Carries out the instructions of programs"), ("RAM", "Holds running programs and their data until power is lost"),
   ("SSD", "Keeps files without power, using flash memory"), ("Motherboard", "Connects all the other components"),
   ("Power supply", "Converts mains electricity to the voltages the parts need")],
  "The CPU does the computing. RAM is fast but volatile. An SSD is permanent storage with no moving parts, unlike a "
  "hard disk. The motherboard carries the buses and sockets that tie everything together.",
  extra=["Draws the picture shown on the monitor"])

M("ix-4.3-01", "Match each directory to what it holds.",
  [("`/etc`", "System-wide configuration files"), ("`/var/log`", "Log files written by the system and services"),
   ("`/home`", "The personal directories of regular users"), ("`/boot`", "The kernel and boot loader files"),
   ("`/proc`", "A virtual view of processes and kernel information"), ("`/dev`", "Files that stand for devices")],
  "`/proc` and `/dev` do not hold ordinary files on disk: the kernel presents process information and hardware "
  "there. Configuration lives in `/etc`, logs in `/var/log`, users' files in `/home` and what the machine needs to "
  "start in `/boot`.")

M("ix-4.3-02", "Match each command to what it shows.",
  [("`ps`", "The processes running at this moment, as a list"), ("`top`", "Processes and system load, updated continuously"),
   ("`free`", "How much memory and swap is used and available"), ("`dmesg`", "Messages from the kernel, such as hardware detection")],
  "`ps` prints once and exits, while `top` keeps refreshing until you quit with `q`. `free` reports RAM and swap. "
  "`dmesg` prints the kernel's message buffer.", extra=["How much disk space each directory uses"])

M("ix-4.4-01", "Match each file or command to what it tells you.",
  [("`/etc/resolv.conf`", "Which DNS servers this computer asks"), ("`/etc/hosts`", "Names mapped to addresses on this computer only"),
   ("`ip addr show`", "The addresses of the network interfaces"), ("`ip route show`", "The routing table, including the default gateway"),
   ("`ping`", "Whether another host answers"), ("`host`", "The address a DNS name resolves to")],
  "Name resolution uses `/etc/hosts` and the DNS servers in `/etc/resolv.conf`. `ip addr show` and `ip route show` "
  "replace the older `ifconfig` and `route`. `ping` tests reachability and `host` does a DNS lookup.")

# ----------------------------------------------------------------- Topic 5: security and file permissions
O("ix-5.1-01", "A line of `/etc/passwd` reads `alice:x:1001:1001:Alice Li:/home/alice:/bin/bash`. Put the meanings of its seven fields in order.",
  ["User name", "Password placeholder", "User ID (UID)", "Primary group ID (GID)", "Full name or comment", "Home directory", "Login shell"],
  "The fields are separated by colons. The `x` in the second field means the password hash is kept in `/etc/shadow`. "
  "The numbers are the UID and the GID of the primary group.")

M("ix-5.1-02", "Match each file or command to what it is for.",
  [("`/etc/passwd`", "Account details, readable by every user"), ("`/etc/shadow`", "Password hashes, readable only by root"),
   ("`/etc/group`", "Groups and their members"), ("`sudo`", "Run one command as another user, usually root"),
   ("`id`", "Show a user's UID, GID and groups"), ("`who`", "Show who is logged in now")],
  "`/etc/passwd` has to be readable by everyone so that names can be shown for UIDs, which is why the hashes moved to "
  "`/etc/shadow`. `sudo` runs a single command with other privileges. `id` and `who` report on accounts and sessions.",
  extra=["Show the history of past logins"])

M("ix-5.2-01", "Match each account command to what it does.",
  [("`useradd`", "Create a user account"), ("`passwd`", "Set or change a password"), ("`usermod`", "Change an existing account"),
   ("`userdel`", "Remove a user account"), ("`groupadd`", "Create a group")],
  "`useradd` creates the account and `passwd` gives it a password. `usermod` changes things like the groups a user "
  "belongs to. `userdel` removes the account, and with `-r` its home directory too.",
  extra=["Remove a group"])

M("ix-5.2-02", "Match each item to its role when a new account is created.",
  [("`/etc/skel`", "Files copied into every new home directory"), ("`useradd -m`", "Create the user's home directory"),
   ("`passwd alice`", "Give the new account a password"), ("`usermod -aG staff alice`", "Add the user to another group, keeping the ones they have")],
  "`-m` tells `useradd` to make the home directory, filled from `/etc/skel`. A new account cannot log in with a "
  "password until `passwd` sets one. With `usermod`, `-G` needs `-a`, or the user is removed from every other "
  "supplementary group.")

M("ix-5.3-01", "Match each octal mode to the permissions `ls -l` shows.",
  [("`755`", "`rwxr-xr-x`"), ("`644`", "`rw-r--r--`"), ("`600`", "`rw-------`"), ("`750`", "`rwxr-x---`")],
  "Each digit is one of owner, group and others, adding 4 for read, 2 for write and 1 for execute. 7 is `rwx`, 6 is "
  "`rw-`, 5 is `r-x`, 4 is `r--` and 0 is `---`.", extra=["`rwxrwxrwx`", "`r--r--r--`"])

M("ix-5.3-02", "Match each command to the change it makes to `notes`.",
  [("`chmod u+x notes`", "Adds execute for the owner"), ("`chmod g-w notes`", "Removes write from the group"),
   ("`chmod o=r notes`", "Sets others to read only"), ("`chmod a+r notes`", "Adds read for everyone"),
   ("`chown sam notes`", "Makes sam the owner")],
  "In symbolic mode `u`, `g`, `o` and `a` are the owner, the group, others and all three. `+` adds, `-` removes and "
  "`=` sets exactly. `chown` changes the owner, and needs root.", extra=["Makes sam's group the group owner"])

M("ix-5.4-01", "Match each item to how it behaves.",
  [("Sticky bit on `/tmp`", "Only a file's owner (or root) can delete it, though everyone can write there"),
   ("`/var/tmp`", "Temporary files that are kept across reboots"),
   ("Symbolic link", "Points to a path; breaks if the target is removed"),
   ("Hard link", "A second name for the same file data, on the same file system")],
  "The sticky bit shows as a `t` in `drwxrwxrwt`. Files in `/tmp` may be cleared at boot, while `/var/tmp` is kept. A "
  "symbolic link stores a path and can point anywhere. A hard link is another directory entry for the same inode, so "
  "the data stays until the last name is removed.", extra=["A copy that is updated automatically when the original changes"])

O("ix-5.4-02", "You want a shortcut `latest` in your home directory that points to `/var/log/app/today.log`, and then to check it. Put the steps in order.",
  ["`cd ~`", "`ln -s /var/log/app/today.log latest`", "`ls -l latest`"],
  "`ln -s TARGET NAME` creates the symbolic link in the current directory, so move there first. `ls -l` then shows "
  "`latest -> /var/log/app/today.log`.")
