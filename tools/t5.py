# SPDX-License-Identifier: GPL-3.0-or-later
from common import S, F

# ---------------- 5.1 Basic Security and Identifying User Types (12) ----------------
S("5.1", "What is the user ID (UID) of the root account?",
  ["✔0", "1", "1000", "65534"],
  "root always has UID 0, and the kernel grants full privileges to UID 0. Regular users usually start at 1000 on modern distributions (500 on older ones), system accounts use lower numbers, and 65534 is commonly the user nobody.",
  run="id -u root", expect="OPT")
F("5.1", "Type the full path of the file that stores users' hashed passwords and password-aging information.",
  ["/etc/shadow"],
  "/etc/shadow is readable only by root (and the shadow group on some systems), which hides the hashes from normal users. /etc/passwd is world-readable and shows `x` in its password field to point to /etc/shadow.",
  run="test -f {A} && stat -c %a {A} | grep -cE '^(640|600|400|0)$'", expect="1")
S("5.1", "Which commands show who is currently logged in to the system?",
  ["✔who", "✔w", "id", "passwd", "su"],
  "`who` lists logged-in users, and `w` adds what each one is running plus uptime and load. `id` shows your UID, GID and groups, `passwd` changes passwords, and `su` switches user. `last` (not listed) shows past logins.")
S("5.1", "How does running `sudo apt-get update` differ from switching with `su -`?",
  ["✔sudo runs one command as root after asking for your own password", "sudo switches to root until logout, using root's password",
   "sudo first updates the sudo program itself, then runs the command as you", "sudo runs the given command as the unprivileged user nobody"],
  "`sudo` runs a single command as another user (root by default) if /etc/sudoers allows it, asks for your own password, and logs the action. `su -` starts a full login shell as root and asks for root's password, which then has to be shared.")
F("5.1", "Type the command that shows your UID, primary GID and every group you belong to.",
  ["id"],
  "`id` prints something like `uid=1000(carol) gid=1000(carol) groups=1000(carol),27(sudo)`. `id tom` shows another user's IDs, and `groups` lists only the group names.",
  run="{A} root | grep -c 'uid=0(root)'", expect="1")
S("5.1", "Which command shows a history of recent logins, logouts and reboots?",
  ["✔last", "who", "w", "id"],
  "`last` reads the binary log /var/log/wtmp and lists past sessions, including `reboot` entries and users still logged in. `lastb` shows failed attempts. `who` and `w` show only current sessions.")
S("5.1", "What typically distinguishes a system account such as www-data from a regular user account?",
  ["✔A UID below 1000 and a non-login shell such as nologin", "A UID of 0 and full administrator privileges",
   "A home directory under /home and /bin/bash as its login shell", "Membership in the sudo or wheel administrators group"],
  "System accounts run services. They get low UIDs (below 1000 on most distributions), usually have no home under /home, and use a shell like /usr/sbin/nologin so nobody can log in interactively. Only root has UID 0.",
  run="getent passwd www-data daemon | head -1 | awk -F: '$3<1000{print \"low\"}'", expect="low")
S("5.1", "What does `su -` do when run by a regular user?",
  ["✔Starts a root login shell after asking for root's password", "Runs a single command as root using your own password",
   "Switches back to the previous user who was logged in on that terminal", "Locks the root account so that nobody can use it"],
  "`su` (substitute user) defaults to root and asks for the target account's password. The dash makes it a login shell with root's environment and home directory. `sudo command` is the alternative that uses your own password.")
S("5.1", "Which files can a regular user read by default?",
  ["✔/etc/passwd", "✔/etc/group", "/etc/shadow", "/etc/sudoers", "/etc/gshadow"],
  "/etc/passwd and /etc/group are world-readable (rw-r--r--) because many programs map UIDs and GIDs to names. /etc/shadow, /etc/gshadow and /etc/sudoers are restricted to root because they hold password hashes or privilege rules.",
  run="for f in /etc/passwd /etc/group /etc/shadow /etc/sudoers /etc/gshadow; do [ -r $f ] && echo $f; done", expect="/etc/passwd\n/etc/group", user=True)
F("5.1", "Type the full path of the main configuration file that controls who may use sudo.",
  ["/etc/sudoers"],
  "/etc/sudoers (plus drop-in files in /etc/sudoers.d/) defines who can run what with sudo. It should be edited with `visudo`, which checks the syntax so a typo can't lock you out of sudo.")
S("5.1", "The password field in /etc/shadow begins with `$6$`. What does that indicate?",
  ["✔The password is stored as a SHA-512 hash", "The account is locked and can no longer log in",
   "The password is stored as an MD5 hash", "The account has no password at all"],
  "The `$id$` prefix names the hash method: $1$ is MD5 (insecure), $5$ is SHA-256, $6$ is SHA-512, and $y$ is yescrypt on newer distributions. A leading `!` means the account is locked, and an empty field means no password.")
S("5.1", "Besides listing who is logged in, what extra information does `w` show?",
  ["✔Uptime, load averages and each user's current command", "Each user's password age and expiry date",
   "Each user's UID and full list of groups", "A list of all the failed login attempts since the last boot"],
  "`w` prints a header with the time, uptime, user count and 1-, 5- and 15-minute load averages, then each session's TTY, login time, idle time and the command it is running (WHAT). Use `id` for groups, `chage -l` for password aging, and `lastb` for failures.")

# ---------------- 5.2 Creating Users and Groups (12) ----------------
S("5.2", "An administrator runs `useradd -m dave`. The files in which directory are copied into /home/dave?",
  ["✔/etc/skel/", "/etc/default/", "/home/template/", "/root/"],
  "/etc/skel/ (skeleton) holds default files such as .bashrc and .profile that are copied into each new home directory, and adding files there customizes all future users. /etc/default/useradd holds useradd's default settings, not files to copy.",
  run="echo hi > /etc/skel/.le010_probe; useradd -m le010dave; cat /home/le010dave/.le010_probe; userdel -r le010dave 2>/dev/null; rm -f /etc/skel/.le010_probe", expect="hi")
S("5.2", "In this /etc/passwd entry, what does the last field specify?",
  ["✔Carol's login shell", "Carol's home directory", "Carol's primary group", "Carol's password hash"],
  "The seven fields are username, password placeholder (x), UID, primary GID, comment (GECOS), home directory and login shell. The `x` means the hash lives in /etc/shadow.",
  code="carol:x:1001:1001:Carol Smith:/home/carol:/bin/bash")
F("5.2", "Type the command that sets or changes a user's password.",
  ["passwd"],
  "`passwd` changes your own password, and root can run `passwd username` for any account. A new account created with `useradd` has no password, so it is locked until one is set this way.")
S("5.2", "Given this line from /etc/group, which statement is true?",
  ["✔The developers group has GID 1005, and carol and tom are members", "The user carol has UID 1005 and is the administrator of developers",
   "tom is the only member of the developers group", "The group's password is the letter x"],
  "The four fields are group name, password placeholder, GID and a comma-separated list of members. The `x` means any group password is kept in /etc/gshadow. GIDs and UIDs are separate numbering spaces.",
  code="developers:x:1005:carol,tom")
F("5.2", "Type the command (name only) that creates a new group.",
  ["groupadd"],
  "`groupadd developers` creates a group, and `-g` chooses a specific GID. `groupdel` removes a group. Users are added to groups with `useradd -G` when they are created, or with `usermod -aG` afterwards.",
  run="{A} le010grp && getent group le010grp | cut -d: -f1; groupdel le010grp", expect="le010grp")
S("5.2", "Which command creates the user jsmith with a home directory and /bin/bash as the login shell?",
  ["✔useradd -m -s /bin/bash jsmith", "useradd -M -s /bin/bash jsmith", "useradd -m -g /bin/bash jsmith", "useradd -d -s /bin/bash jsmith"],
  "`-m` creates the home directory (copying /etc/skel) and `-s` sets the shell. `-M` explicitly skips creating a home directory, `-g` sets the primary group (not a shell), and `-d` needs a directory path argument.",
  run="useradd -m -s /bin/bash le010js; getent passwd le010js | cut -d: -f7; test -d /home/le010js && echo home; userdel -r le010js 2>/dev/null", expect="/bin/bash\nhome")
S("5.2", "Which useradd option sets a new user's supplementary (secondary) groups?",
  ["✔-G", "-g", "-s", "-u"],
  "Uppercase `-G grp1,grp2` sets supplementary groups, while lowercase `-g` sets the primary group. `-s` sets the shell and `-u` sets the UID. The groups must already exist.",
  run="groupadd le010g1; useradd -G le010g1 le010u1; id -nG le010u1 | grep -c le010g1; userdel le010u1; groupdel le010g1 2>/dev/null; groupdel le010u1 2>/dev/null; true", expect="1")
S("5.2", "Which command deletes the user tom together with his home directory?",
  ["✔userdel -r tom", "userdel tom", "groupdel tom", "passwd -d tom"],
  "`userdel -r` removes the account, its home directory and its mail spool. Plain `userdel` leaves /home/tom behind. `groupdel` removes groups, and `passwd -d` only deletes the password.",
  run="useradd -m le010tom; userdel -r le010tom 2>/dev/null; test -d /home/le010tom || echo gone", expect="gone")
S("5.2", "Which command locks the account of user dave so he can no longer log in with a password?",
  ["✔passwd -l dave", "passwd -d dave", "passwd -e dave", "passwd -S dave"],
  "`passwd -l` locks the account by putting `!` in front of the hash in /etc/shadow, and `-u` unlocks it. `-d` deletes the password (which can allow passwordless login), `-e` forces a password change at next login, and `-S` shows the status.",
  run="useradd le010dv; echo 'le010dv:Pass1234!' | chpasswd; passwd -l le010dv >/dev/null; getent shadow le010dv | cut -d: -f2 | cut -c1; userdel le010dv", expect="!")
S("5.2", "After `useradd -m dave`, dave still cannot log in with a password. Why?",
  ["✔No password has been set yet; run passwd dave", "The home directory was not created by -m",
   "useradd gives every new account the shell /bin/false", "He must be added to the sudo group before logging in"],
  "useradd leaves the password field locked (`!` or `!!` in /etc/shadow) until root runs `passwd dave`. `-m` did create /home/dave. Group membership in sudo only matters for running sudo, not for logging in.",
  run="useradd -m le010d2; getent shadow le010d2 | cut -d: -f2 | cut -c1; userdel -r le010d2 2>/dev/null", expect="!")
S("5.2", "By default on most modern distributions, what UID does useradd give the first regular user?",
  ["✔1000", "0", "100", "500"],
  "UID_MIN in /etc/login.defs is 1000 on modern distributions, so regular users start there. Older Red Hat systems started at 500. UID 0 is root, and low numbers are reserved for system accounts.",
  run="grep -E '^UID_MIN' /etc/login.defs | awk '{print $2}'", expect="OPT")
S("5.2", "In /etc/shadow, what does a `!` at the start of the password field mean?",
  ["✔The account is locked for password login", "The account has an empty password",
   "The password never expires and cannot be changed", "The account belongs to root"],
  "A leading `!` (or `!!`) disables password authentication. `passwd -l` adds it and `passwd -u` removes it. An empty field means no password is required, which is dangerous.")

# ---------------- 5.3 Managing File Permissions and Ownership (12) ----------------
S("5.3", "What permissions does `chmod 754 script.sh` set?",
  ["✔rwxr-xr--", "rwxr-xr-x", "rwxrw-r--", "rw-r-xr--"],
  "Read = 4, write = 2 and execute = 1. So 7 = 4+2+1 (rwx) for the owner, 5 = 4+1 (r-x) for the group, and 4 (r--) for others.",
  run="touch script.sh; chmod 754 script.sh; stat -c %A script.sh | cut -c2-", expect="OPT")
F("5.3", "Type the complete command (run as root) that makes the user tom the owner of report.txt.",
  ["chown tom report.txt", "sudo chown tom report.txt"],
  "`chown USER FILE` changes the owner. `chown tom:staff report.txt` changes owner and group together, `chown :staff report.txt` changes only the group, and `chgrp staff report.txt` does the same.")
S("5.3", "A file has permissions -rw-r--r--. What are its permissions after this command?",
  ["✔-rw-rw----", "-rw-rw-r--", "-rw-r-----", "-rwxrw----"],
  "`g+w` adds write for the group (r-- becomes rw-), and `o-r` removes read from others (r-- becomes ---). Symbolic mode changes only the bits you name, so the owner's bits stay the same.",
  code="$ chmod g+w,o-r notes.txt",
  run="touch notes.txt; chmod 644 notes.txt; chmod g+w,o-r notes.txt; stat -c %A notes.txt", expect="OPT")
S("5.3", "Which permission must a user have on a directory to enter it with cd?",
  ["✔Execute (x)", "Read (r)", "Write (w)", "Sticky (t)"],
  "On a directory, x lets you enter it and reach items by name, r lets you list the names, and w (together with x) lets you create, delete and rename entries. Without x, even a readable directory cannot be entered.",
  run="mkdir d; chmod 644 d; cd d 2>/dev/null && echo in || echo denied; chmod 711 d; cd d && echo in", expect="denied\nin", user=True)
F("5.3", "Type the three-digit octal mode for the permissions -rw-r-----.",
  ["640", "0640"],
  "Owner rw- = 4+2 = 6, group r-- = 4, others --- = 0, so the mode is 640. This is common for files a service group must read but others must not, such as /etc/shadow on Debian.",
  run="touch f; chmod {A} f; stat -c %A f", expect="-rw-r-----")
S("5.3", "Which command sets the owner to alice and the group to devs for app.py?",
  ["✔chown alice:devs app.py", "chown devs:alice app.py", "chgrp alice:devs app.py", "chmod alice:devs app.py"],
  "chown takes `user:group`, with the user first. chgrp only accepts a group, and chmod changes permissions, not ownership.",
  run="groupadd le010devs; useradd le010alice; touch app.py; chown le010alice:le010devs app.py; stat -c '%U:%G' app.py; rm app.py; userdel le010alice; groupdel le010devs; groupdel le010alice 2>/dev/null; true", expect="le010alice:le010devs")
F("5.3", "Type the option that makes chmod or chown apply to a directory and everything inside it.",
  ["-R", "--recursive"],
  "`chmod -R` and `chown -R` work recursively. Note the uppercase R, because many commands use `-r` for recursion, but chmod and chown use `-R`. Use it carefully, since a mistaken recursive change can break a whole tree.",
  run="mkdir -p d/e; touch d/e/f; chmod {A} 700 d; stat -c %a d/e/f", expect="700")
S("5.3", "In this listing, which group owns the file?",
  ["✔staff", "carol", "rw-", "1"],
  "The `ls -l` columns are type and permissions, hard link count, owner, group, size, modification time and name. Here carol is the owner, staff is the group, and 1 is the link count.",
  code="-rw-r--r-- 1 carol staff 2048 Oct 10 09:00 notes.txt")
S("5.3", "A user has r-x permission on a directory but not w. What can't they do there?",
  ["✔Create, delete or rename files in the directory", "List the names of the files in the directory",
   "Change into the directory with cd", "Read a file in it whose own permissions allow reading"],
  "Creating, deleting and renaming entries changes the directory itself, so they require w (with x). r allows listing, x allows entering, and reading a file depends on that file's own permissions.",
  run="mkdir d; touch d/a; chmod 555 d; touch d/b 2>/dev/null && echo created || echo blocked; ls d", expect="blocked\na", user=True)
S("5.3", "What permissions result from `chmod a=r file`?",
  ["✔-r--r--r--", "-rw-r--r--", "-rwxr--r--", "-r--------"],
  "`a` means all (user, group and others), and `=` sets the permissions exactly, removing anything not listed. So everyone gets read only.",
  run="touch file; chmod 777 file; chmod a=r file; stat -c %A file", expect="OPT")
S("5.3", "A file shows `----rwxrwx` and is owned by carol, who is not root. Can carol read the file?",
  ["✔No, only the owner's set (---) applies to carol", "Yes, because the group and others sets allow reading",
   "Yes, because a file's owner can always read it", "Only if carol is also a member of the file's group"],
  "Linux checks only one permission set: the owner set if you own the file, otherwise the group set if you're a member, otherwise others. A more permissive group or others set doesn't help the owner. Carol could, however, run chmod to give herself access, because she owns the file.",
  run="touch f; chmod 077 f; cat f 2>/dev/null && echo read || echo denied", expect="denied", user=True)
S("5.3", "Which command changes only the group of report.txt to sales?",
  ["✔chgrp sales report.txt", "chown sales report.txt", "chmod g=sales report.txt", "chgrp report.txt sales"],
  "`chgrp GROUP FILE` changes the group, and `chown :sales report.txt` is equivalent. `chown sales report.txt` would change the owner instead. The argument order is group first, then file.",
  run="groupadd le010sales; touch report.txt; chgrp le010sales report.txt; stat -c %G report.txt; rm report.txt; groupdel le010sales", expect="le010sales")

# ---------------- 5.4 Special Directories and Files (6) ----------------
S("5.4", "`ls -ld /tmp` shows the output below. What does the final `t` mean?",
  ["✔The sticky bit is set: users can delete only their own files", "The directory is temporary, and its contents are deleted every hour",
   "Only the root user is allowed to write to this directory", "The directory is a symbolic link to another place"],
  "The sticky bit (`t` in the others' execute position, octal 1000) lets everyone create files in a shared directory but stops them deleting or renaming other users' files. Set it with `chmod +t dir` or `chmod 1777 dir`. A symbolic link would start with `l`.",
  code="drwxrwxrwt 18 root root 4096 Oct 10 09:12 /tmp",
  run="stat -c %A /tmp | cut -c10", expect="t")
F("5.4", "Type the complete command that creates a symbolic link named latest in the current directory, pointing to /var/log/app.log.",
  ["ln -s /var/log/app.log latest", "ln -s /var/log/app.log ./latest", "ln --symbolic /var/log/app.log latest", "ln -sv /var/log/app.log latest"],
  "The syntax is `ln -s TARGET LINK_NAME`, with the target first. Without `-s`, ln creates a hard link, which cannot cross filesystems or point to a directory. An absolute target path keeps the link working if the link itself is moved.",
  run="{A} >/dev/null; readlink latest", expect="/var/log/app.log")
S("5.4", "Which directory is meant for temporary files that should survive a reboot?",
  ["✔/var/tmp", "/tmp", "/run", "/dev/shm"],
  "Under the Filesystem Hierarchy Standard, /tmp may be (and often is) cleared at boot, while /var/tmp is preserved between reboots. /run holds runtime data such as PID files and is always cleared at boot. /dev/shm is memory-backed. Both /tmp and /var/tmp have the sticky bit set.",
  run="stat -c %A /var/tmp | cut -c10", expect="t")
S("5.4", "Which command shows the permissions of the directory /etc itself, rather than listing its contents?",
  ["✔ls -ld /etc", "ls -l /etc", "ls -la /etc", "ls -lR /etc"],
  "`-d` makes ls treat a directory as a single entry and show its own attributes. Without it, ls lists what is inside. `-a` adds hidden files, and `-R` recurses into subdirectories.",
  run="ls -ld /etc | wc -l", expect="1")
S("5.4", "You run `ln -s report.txt latest` and then delete report.txt. What happens to latest?",
  ["✔It still exists but is broken, pointing to a missing file", "It is deleted automatically along with report.txt",
   "It keeps showing the old contents of report.txt from its own copy", "It turns into an ordinary empty file"],
  "A symbolic link stores only a path. If the target disappears, the link dangles, and `ls -l` still shows it, but opening it fails with \"No such file or directory\". A hard link would keep the data alive, because it points to the same inode.",
  run="echo x > report.txt; ln -s report.txt latest; rm report.txt; test -L latest && echo exists; cat latest 2>/dev/null || echo broken", expect="exists\nbroken")
S("5.4", "Which statements about hard links are true?",
  ["✔A hard link shares the same inode as the original file", "✔A hard link cannot point to a file on another filesystem",
   "A hard link is shown with an l at the start of ls -l output", "A hard link breaks when the original name is deleted",
   "By default, ln can create hard links to directories"],
  "A hard link is just another name for the same inode, so `ls -li` shows the same inode number and the link count rises. The data stays until the last name is removed. Because inode numbers are per-filesystem, hard links cannot cross filesystems, and ln refuses to hard-link directories. The `l` type marks a symbolic link.",
  run="echo d > a; ln a b; [ $(stat -c %i a) = $(stat -c %i b) ] && echo same; rm a; cat b; ls -l b | cut -c1", expect="same\nd\n-")
