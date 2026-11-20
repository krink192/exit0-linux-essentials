# SPDX-License-Identifier: AGPL-3.0-or-later
"""Challenge labs: three formats beside the per-lesson labs and the troubleshooting track.

  chain     "The vault": ten levels in a fixed order. Each level hides a key somewhere on its machine; find it with
            ordinary commands and hand it in with `unlock KEY` (a lab-only command, see shell.js). A level opens
            when the one before it is cleared.
  oneliner  One task, one command line. Checked by what the line prints or leaves behind, so any command that does
            the job counts. After success the lab shows other ways to do it (`ways`).
  scenario  A named situation with one goal and no step list. It suggests a time (`minutes`); the clock only
            advises, nothing fails when it runs out.

Every challenge is one lesson with one part and one task, so progress, hints, undo and the tests work exactly as
for the other labs. Tasks are checked by end state (files, modes, accounts, the key handed in, the last output),
never by the exact command typed. Each task carries a `goal`: the "Checked when..." line shown above it.
Everything stays inside the LPI Linux Essentials 010-160 objectives (version 1.6). The tasks are original.

tools/test_shell.js runs every solution like any lab's, and additionally every entry in `ways`.
Imported by labs.py, which appends these lessons after the troubleshooting labs."""
from labs import T, LAST, EX, AB, ALL, ANY, HAS, EQ, PERMS, MODE, F, D, HOME, BASE

CHAIN, ONELINER, SCENARIO = "chain", "oneliner", "scenario"
UNLOCKED = {"type": "unlocked"}


def G(text, hints, solution, check, explain, goal, ways=None, mistakes=None):
    t = T(text, hints, solution, check, explain, mistakes)
    t["goal"] = goal
    if ways:
        t["ways"] = [{"cmd": c, "note": n} for c, n in ways]
    return t


def game(code, track, obj, lesson_num, title, blurb, kind, level, commands, intro, task, setup, minutes=None):
    topic = obj.split(".")[0]
    L = {"lesson": code, "obj": obj, "num": int(code[1:]), "title": title, "covers": commands, "track": track,
         "blurb": blurb, "kind": kind, "level": level,
         "url": BASE + "%s/%s/%s_%02d/" % (topic, obj, obj, lesson_num),
         "parts": [{"id": code + "-a", "title": title, "intro": intro, "setup": setup, "commands": commands, "tasks": [task]}]}
    if minutes:
        L["minutes"] = minutes
    return L


def level(n, obj, lesson_num, title, blurb, difficulty, commands, intro, where, hints, solution, explain, key, setup, mistakes=None):
    setup = dict(setup, key=key)
    return game("V%d" % n, CHAIN, obj, lesson_num, title, blurb, "find", difficulty, commands, intro,
                G("Find the key %s, then hand it in with `unlock KEY`." % where, hints, solution + "\nunlock " + key, UNLOCKED, explain,
                  "you have handed in this level's key with `unlock`.", mistakes=mistakes), setup)


# One-line descriptions for the troubleshooting labs (tools/trouble_labs.py), shown in the catalogue rows.
BLURBS = {
    "T1": "The front desk has no internet, yet the printer works. Find where the connection stops.",
    "T2": "A web page answers with Forbidden. Find the permission that blocks it.",
    "T3": "Users can't delete their own files in a shared temporary directory.",
    "T4": "A backup script refuses to start. Find out why, then make it run.",
    "T5": "A new colleague can't save into the team's shared folder.",
    "T6": "The server crawls. Find the process that is eating it and stop it.",
}

LEDGER = "".join("entry %04d: %s\n" % (i, "%08x" % ((i * 2654435761) % 4294967296)) if i != 271 else "vault key: quiet-lynx-58\n" for i in range(1, 401))
CODES = "".join("%s-%03d\n" % (["birch", "cedar", "delta", "ember", "flint", "grove", "haven"][(i * 5) % 7], (i * 37) % 1000) for i in range(1, 101))
CODE42 = CODES.split("\n")[41]
ACCOUNTS = ("root:x:0:0:root:/root:/bin/bash\n"
            "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n"
            "ana:x:1001:1001:Ana Lima:/home/ana:/bin/bash\n"
            "vaultkeeper:x:1002:1002:not-this-one:/home/vaultkeeper:/bin/bash\n"
            "vault:x:1003:1003:mossy-crane-64:/srv/vault:/usr/sbin/nologin\n"
            "bo:x:1004:1004:Bo Chen:/home/bo:/bin/bash\n")
MAZE = [D("~/maze/%s/%s" % (a, b)) for a in ("north", "south", "east", "west") for b in ("a", "b", "c")] + \
       [F("~/maze/%s/%s/empty.txt" % (a, b), "Nothing here.\n") for a in ("north", "east", "west") for b in ("a", "c")] + \
       [F("~/maze/south/b/key.txt", "The key is: tidal-wren-33\n")]

GAMES = [
  # ============================================================================================ the vault (level chain)
  level(1, "2.3", 1, "The note on the desk", "The key is in plain sight. Look around, then read.", 1, ["ls", "cat"],
    "Welcome to the vault: ten locked levels. Each one hides a **key** somewhere on this system. Find it with the commands you know, "
    "then type `unlock` followed by the key. This first one is lying in your home directory.",
    "in your home directory",
    ["List what is in your home directory.", "One file there is meant to be read: print it with `cat`."],
    "ls\ncat README", "`ls` shows what is in a directory and `cat` prints a file. Most of finding your way on a system is these two.",
    "amber-otter-17", {"files": [F("~/README", "Welcome to the vault.\nThe key for this level is: amber-otter-17\n")]}),

  level(2, "2.3", 1, "Out of sight", "Plain ls shows nothing useful. Some names are hidden.", 1, ["ls", "cat"],
    "This time a plain `ls` won't show the file that holds the key.",
    "in a hidden file in your home directory",
    ["Names that start with a dot are hidden from a plain `ls`.", "`ls -a` lists all entries, hidden ones included."],
    "ls -a\ncat .vault-key", "A name that starts with a dot is hidden: `ls -a` shows it. Configuration files such as `.bashrc` are kept out of the way like this.",
    "copper-finch-42", {"files": [F("~/.vault-key", "copper-finch-42\n"), F("~/README", "Nothing to see here. Not everything shows up in a plain listing.\n")]}),

  level(3, "2.1", 2, "A name with gaps", "The file name contains spaces, and two decoys use its words.", 1, ["ls", "cat"],
    "The key is in a file whose name contains spaces. The shell splits a command line at spaces, so the name needs protecting.",
    "in the file named `the key is in here.txt`",
    ["Without quotes, the shell hands `cat` five separate names.", "Put the whole name in quotes, or put a backslash before each space. Tab completion does it for you."],
    "ls\ncat \"the key is in here.txt\"", "Quotes make the shell treat the name as one argument. A backslash before each space works too, and so does Tab completion.",
    "silver-heron-09", {"files": [F("~/the key is in here.txt", "silver-heron-09\n"), F("~/the", "Not this one.\n"), F("~/key", "Not this one either.\n")]}),

  level(4, "2.3", 2, "The maze", "Twelve directories, one file worth reading.", 2, ["ls", "cat"],
    "Somewhere under `~/maze` there is a file named `key.txt`. Opening every directory by hand is slow: let `ls` walk the tree.",
    "in the file `key.txt` somewhere under `~/maze`",
    ["`ls` has an option that lists directories recursively.", "`ls -R maze` prints every directory with its contents. Then `cat` the file by its path."],
    "ls -R maze\ncat maze/south/b/key.txt", "`ls -R` lists a whole tree, one directory after the other. A relative path such as `maze/south/b/key.txt` then reaches the file from where you are.",
    "tidal-wren-33", {"files": MAZE},
    [{"cmd": r"\bls\b[^|]*(-\w*R|--recursive)[^|]*\|\s*grep\b", "out": r"key\.txt",
      "say": "`grep` kept the `key.txt` line but dropped the heading above it: the line ending in `:` that names the folder. "
             "That heading is the only place `ls -R` says where the file is. Run `ls -R maze` on its own and read the heading "
             "above `key.txt`, or let `find` print the whole path: `find maze -name key.txt`.",
      "try": "ls -R maze | grep key.txt"}]),

  level(5, "3.2", 1, "One line in four hundred", "A long file and a single line that matters.", 2, ["grep"],
    "`ledger.txt` has 400 lines. Exactly one of them contains the word `key`.",
    "on the one line of `ledger.txt` that contains the word key",
    ["Reading 400 lines works, but one command prints only the lines that match a word.", "`grep key ledger.txt`"],
    "grep key ledger.txt", "`grep` prints only the lines that match a pattern. It is the usual way to find one line in a long log.",
    "quiet-lynx-58", {"files": [F("~/ledger.txt", LEDGER)]}),

  level(6, "3.2", 1, "Line forty-two", "The key is one numbered line of a file. Cut it out with a pipeline.", 2, ["cat", "head", "tail"],
    "`hint.txt` says which line of `codes.txt` is the key. Print just that one line.",
    "on the line of `codes.txt` that `hint.txt` names",
    ["`head -n 42` prints the first 42 lines. Which of those do you want?", "Pipe it on: `head -n 42 codes.txt | tail -n 1` keeps only the last of them."],
    "cat hint.txt\nhead -n 42 codes.txt | tail -n 1", "`head -n N` keeps the first N lines and `tail -n 1` keeps the last of those, so the pipeline prints exactly line N.",
    CODE42, {"files": [F("~/hint.txt", "The key is line 42 of codes.txt.\n"), F("~/codes.txt", CODES)]}),

  level(7, "3.2", 2, "The fifth field", "A passwd-style file. One line, one field.", 2, ["grep", "cut"],
    "`accounts.txt` is laid out like `/etc/passwd`: fields separated by colons. The key is the **fifth field** of the line for the user `vault`. "
    "Careful: another user's name starts the same way.",
    "in the fifth field of the `vault` line in `accounts.txt`",
    ["Pick the line first. `^` anchors a pattern to the start of the line, and the colon ends the name.", "Then cut out a field: `cut -d: -f5`. Join the two with a pipe."],
    "grep '^vault:' accounts.txt | cut -d: -f5", "`grep '^vault:'` matches only the line that starts with exactly that name, and `cut -d: -f5` prints the fifth colon-separated field.",
    "mossy-crane-64", {"files": [F("~/accounts.txt", ACCOUNTS)]}),

  level(8, "3.1", 1, "The delivery", "The key arrived packed in a compressed archive.", 2, ["tar", "cat"],
    "The key is inside `delivery.tar.gz`. Look at what the archive holds, unpack it, then read the key.",
    "in a file inside the archive `delivery.tar.gz`",
    ["`tar -tzf delivery.tar.gz` lists the contents without unpacking.", "`tar -xzf delivery.tar.gz` unpacks it into the current directory."],
    "tar -tzf delivery.tar.gz\ntar -xzf delivery.tar.gz\ncat box/key.txt", "`-t` lists, `-x` extracts, `-z` is gzip and `-f` names the archive. Listing first tells you where the files will land.",
    "paper-swift-71", {"files": [F("~/box/key.txt", "paper-swift-71\n"), F("~/box/packing.txt", "1 key, handle with care\n")],
                       "run": ["tar -czf delivery.tar.gz box", "rm -r box"]}),

  level(9, "5.3", 1, "Locked from yourself", "You own the file, but nobody may read it. Not even you.", 3, ["ls", "chmod", "cat"],
    "The key is in `safe/key.txt`. The file is yours, but its permissions don't let anyone read it.",
    "in `safe/key.txt`, once you are allowed to read it",
    ["`ls -l safe` shows the permissions. What is missing for the owner?", "The owner of a file may change its mode: `chmod u+r safe/key.txt`."],
    "ls -l safe\nchmod u+r safe/key.txt\ncat safe/key.txt", "Permissions apply even to a file's owner, but the owner can always change them with `chmod`. `u+r` adds read for the user who owns the file.",
    "plain-otter-88", {"files": [F("~/safe/key.txt", "plain-otter-88\n", mode=0o000)]}),

  level(10, "3.3", 1, "The key maker", "A script prints the key, if you can run it the way it wants.", 3, ["cat", "chmod"],
    "The last key isn't stored anywhere: the script `getkey.sh` prints it. Read the script before you run it.",
    "that the script `getkey.sh` prints when it is run the right way",
    ["`cat getkey.sh` shows what it expects. `$#` is the number of arguments.", "Make it executable with `chmod +x getkey.sh`, then run it with three arguments: `./getkey.sh a b c`."],
    "cat getkey.sh\nchmod +x getkey.sh\n./getkey.sh a b c", "A script needs the execute permission to be run as `./getkey.sh`, and `$#` holds how many arguments it was given. Reading a script first is a good habit.",
    "cobalt-heron-3", {"files": [F("~/getkey.sh", "#!/bin/bash\n# Prints the key when it is given exactly three arguments.\nif [ $# -ne 3 ]; then\n  echo \"usage: $0 ONE TWO THREE\"\n  exit 1\nfi\na=cobalt\nb=heron\necho \"$a-$b-$#\"\n")]}),

  # ============================================================================================ one-liners
  game("O1", ONELINER, "3.2", 1, "Count the lines", "Print how many lines a log has: just the number.", "find", 1, ["wc"],
    "One task, one command line. Any command that prints the right thing counts.",
    G("Print the number of lines in `access.log`: the number alone, without the file name.",
      ["`wc -l` counts lines, but it prints the file name too when you name the file.", "Give it the file on standard input instead: `wc -l < access.log`."],
      "wc -l < access.log", LAST(r"^7\n$"),
      "When `wc` reads standard input it has no file name to print, so only the count appears.",
      "your last command printed exactly the number of lines in `access.log`.",
      [("cat access.log | wc -l", "A pipe gives `wc` its input just as well."),
       ("grep -c '' access.log", "`grep -c` counts matching lines, and the empty pattern matches every line.")]),
    {"files": [F("~/access.log", "".join("10.0.0.%d - GET /page%d\n" % (i, i) for i in range(1, 8)))]}),

  game("O2", ONELINER, "3.2", 1, "The third line", "Print one line from the middle of a file.", "find", 1, ["head", "tail"],
    "One task, one command line.",
    G("Print only the third line of `notes.txt`.",
      ["`head -n 3` prints the first three lines. You want the last of those.", "`head -n 3 notes.txt | tail -n 1`"],
      "head -n 3 notes.txt | tail -n 1", LAST(r"^gamma\n$"),
      "`head` keeps the top of its input and `tail` the bottom, so chaining them cuts out any line.",
      "your last command printed the third line of `notes.txt` and nothing else.",
      [("tail -n +3 notes.txt | head -n 1", "`tail -n +3` starts at line 3; `head -n 1` keeps the first of what is left.")]),
    {"files": [F("~/notes.txt", "alpha\nbeta\ngamma\ndelta\nepsilon\n")]}),

  game("O3", ONELINER, "2.4", 1, "No ls today", "List the files here while ls is out of order.", "find", 2, ["echo"],
    "On this machine `ls` has been replaced by a joke. Your shell can still tell you what is in the directory.",
    G("Print the names of the files in the current directory without `ls`.",
      ["The shell itself expands `*` to the names in the current directory.", "Any command that prints its arguments will do: `echo *`"],
      "echo *", LAST(r"^a\.txt[ \n]b\.txt[ \n]c\.md\n$"),
      "Globs are expanded by the shell before the command runs, so `echo *` receives the file names as its arguments.",
      "your last command printed the three file names in this directory.",
      [("printf '%s\\n' *", "`printf` prints one name per line, which is safer for names with spaces.")]),
    {"files": [F("~/a.txt", "a\n"), F("~/b.txt", "b\n"), F("~/c.md", "c\n")], "run": ["alias ls='echo ls is taking the day off'"]}),

  game("O4", ONELINER, "3.2", 1, "The top three", "Find the three largest numbers in a file, biggest first.", "find", 2, ["sort", "head"],
    "One task, one command line.",
    G("Print the three largest numbers in `nums.txt`, biggest first, one per line.",
      ["Plain `sort` compares text, so 9 would come after 412. Which option compares numbers?", "`sort -rn` puts the biggest first; `head -n 3` keeps three lines."],
      "sort -rn nums.txt | head -n 3", LAST(r"^980\n412\n77\n$"),
      "`-n` sorts numerically and `-r` reverses the order, so the largest values come out on top.",
      "your last command printed 980, 412 and 77, in that order.",
      [("sort -n nums.txt | tail -n 3 | sort -rn", "Sort upwards, keep the last three, then turn them round.")]),
    {"files": [F("~/nums.txt", "9\n412\n77\n5\n980\n31\n")]}),

  game("O5", ONELINER, "3.2", 2, "How many errors", "Count the lines that mention an error, in any capitalisation.", "find", 2, ["grep"],
    "One task, one command line.",
    G("Print how many lines of `server.log` contain the word error, whether it is written error, Error or ERROR.",
      ["`grep -i` ignores case. Another option counts instead of printing.", "`grep -ic error server.log`"],
      "grep -ic error server.log", LAST(r"^4\n$"),
      "`-i` ignores case and `-c` prints the number of matching lines instead of the lines.",
      "your last command printed the number of lines in `server.log` that mention an error.",
      [("grep -i error server.log | wc -l", "Print the matching lines and let `wc -l` count them.")]),
    {"files": [F("~/server.log", "09:00 INFO start\n09:01 ERROR disk full\n09:02 Error retrying\n09:03 info ok\n09:04 error again\n09:05 WARN slow\n09:06 ERROR disk full\n")]}),

  game("O6", ONELINER, "3.2", 2, "Who uses bash", "From a passwd-style file, print the names of the users whose shell is bash.", "find", 3, ["grep", "cut", "sort"],
    "One task, one command line. `users.txt` is laid out like `/etc/passwd`.",
    G("Print the names of the users in `users.txt` whose login shell is `/bin/bash`, sorted from A to Z, one per line.",
      ["Three steps: keep the right lines, cut out the first field, sort.", "`grep '/bin/bash$' users.txt | cut -d: -f1 | sort`"],
      "grep '/bin/bash$' users.txt | cut -d: -f1 | sort", LAST(r"^ana\nbo\nkim\n$"),
      "`$` anchors the pattern to the end of the line, where the shell field is. `cut -d: -f1` keeps the user name.",
      "your last command printed ana, bo and kim, one per line.",
      [("grep bash users.txt | sort | cut -d: -f1", "Sorting whole lines first gives the same order, because each line starts with the name.")]),
    {"files": [F("~/users.txt", "kim:x:1003:1003::/home/kim:/bin/bash\nwww-data:x:33:33::/var/www:/usr/sbin/nologin\nana:x:1001:1001::/home/ana:/bin/bash\n"
                                "sync:x:4:65534::/bin:/bin/sync\nbo:x:1002:1002::/home/bo:/bin/bash\n")]}),

  game("O7", ONELINER, "2.4", 1, "Sweep the temp files", "Delete every .tmp file and nothing else.", "change", 1, ["rm"],
    "One task, one command line.",
    G("Delete every file in the current directory whose name ends in `.tmp`. Leave the other files alone.",
      ["A glob can stand for all of them at once.", "`rm *.tmp`"],
      "rm *.tmp", ALL(AB(HOME + "/a.tmp"), AB(HOME + "/b.tmp"), AB(HOME + "/cache.tmp"), EX(HOME + "/keep.txt"), EX(HOME + "/notes.tmp.txt")),
      "`*.tmp` matches names that end in .tmp, so `notes.tmp.txt` is safe: it ends in .txt.",
      "no file ending in `.tmp` is left here, and `keep.txt` and `notes.tmp.txt` still exist.",
      [("rm a.tmp b.tmp cache.tmp", "Naming each file works, but the glob still works when there are three hundred of them.")]),
    {"files": [F("~/a.tmp", "x\n"), F("~/b.tmp", "x\n"), F("~/cache.tmp", "x\n"), F("~/keep.txt", "keep\n"), F("~/notes.tmp.txt", "keep too\n")]}),

  game("O8", ONELINER, "3.2", 1, "Keep everything it says", "Send a command's output and its error messages into one file.", "change", 2, ["ls"],
    "One task, one command line. `/nope` doesn't exist, so the command below prints a listing and an error.",
    G("Run `ls /etc /nope` so that both its normal output and its error message end up in the file `out.txt`.",
      ["`>` redirects standard output only. Errors travel on a second stream, number 2.", "`ls /etc /nope > out.txt 2>&1` sends stream 2 to wherever stream 1 goes."],
      "ls /etc /nope > out.txt 2>&1", ALL(HAS(HOME + "/out.txt", "hostname"), HAS(HOME + "/out.txt", "No such file or directory")),
      "`2>&1` means: send standard error to the same place as standard output. It has to come after the `>` that sets that place.",
      "`out.txt` holds both the listing of /etc and the error about /nope.",
      [("ls /etc /nope &> out.txt", "Bash's shorthand for the same thing.")]),
    {}),

  game("O9", ONELINER, "3.1", 1, "Pack the site", "Bundle a directory into one gzip-compressed archive.", "change", 2, ["tar"],
    "One task, one command line.",
    G("Create `site.tar.gz`, a gzip-compressed tar archive that contains the directory `www`.",
      ["tar needs three options: create, gzip, and the archive's file name.", "`tar -czf site.tar.gz www`"],
      "tar -czf site.tar.gz www", {"type": "archive", "path": HOME + "/site.tar.gz", "format": "tar", "compression": "gzip", "has": ["www/index.html"]},
      "`-c` creates, `-z` compresses with gzip and `-f` names the archive, so `f` comes last, right before the name.",
      "`site.tar.gz` exists, is gzip-compressed and contains `www/index.html`.",
      [("tar -cf site.tar www && gzip site.tar", "Two steps: bundle first, then compress. gzip renames the file to site.tar.gz.")]),
    {"files": [F("~/www/index.html", "<h1>Hello</h1>\n"), F("~/www/css/site.css", "body{}\n")]}),

  game("O10", ONELINER, "5.3", 1, "For your eyes only", "Make a file readable and writable by its owner and by nobody else.", "change", 2, ["chmod"],
    "One task, one command line.",
    G("Change `secrets.txt` so that its owner can read and write it and nobody else can do anything with it.",
      ["That is `rw-` for the owner and `---` for group and others. What is it in octal?", "`chmod 600 secrets.txt`"],
      "chmod 600 secrets.txt", PERMS(HOME + "/secrets.txt", "-rw-------"),
      "6 is read plus write (4 + 2) and 0 is nothing, so 600 gives the owner `rw-` and everyone else `---`.",
      "`secrets.txt` has the permissions `-rw-------`.",
      [("chmod u=rw,go= secrets.txt", "The symbolic form says the same thing in letters."),
       ("chmod go-rwx secrets.txt", "Taking everything away from group and others is enough here, because the owner already had rw-.")]),
    {"files": [F("~/secrets.txt", "pin 4471\n", mode=0o644)]}),

  # ============================================================================================ named scenarios
  game("S1", SCENARIO, "5.3", 1, "Birch: nobody can upload", "A team's upload folder refuses their files. One permission is missing.", "fix", 3, ["ls", "chmod"],
    "**The situation.** The web team (the group `web`) uploads files to `/srv/upload`. Since this morning ana, a member of `web`, "
    "gets \"Permission denied\" when she saves there. Nothing else should change: people outside the group must still not be able to write there. "
    "You are `student` and may use `sudo`.",
    G("Make `/srv/upload` writable for the members of the group `web`, and for nobody outside it.",
      ["Look at the directory itself, not its contents: `ls -ld /srv/upload`. Which group owns it, and what may that group do?",
       "The group lacks write permission. Add it for the group only: `sudo chmod g+w /srv/upload`."],
      "ls -ld /srv/upload\nsudo chmod g+w /srv/upload",
      ALL({"type": "owner", "path": "/srv/upload", "group": "web"}, ANY(MODE("/srv/upload", "775"), MODE("/srv/upload", "2775"))),
      "Creating a file needs write permission on the directory. The directory belonged to the right group but was `drwxr-xr-x`; `g+w` makes it `drwxrwxr-x`. "
      "A setgid bit (2775) would also make new files inherit the group.",
      "`/srv/upload` still belongs to the group `web`, the group may write to it, and others may not.",
      [("sudo chmod 775 /srv/upload", "The octal form sets all nine bits at once."),
       ("sudo chmod 2775 /srv/upload", "With the setgid bit, files created there belong to the group web automatically.")]),
    {"groups": [{"name": "web", "gid": 2070}], "users": [{"name": "ana", "groups": ["web"]}],
     "files": [D("/srv/upload", owner="root", group="web", mode=0o755), F("/srv/upload/logo.png", "PNG\n", owner="root", group="web")]}, minutes=5),

  game("S2", SCENARIO, "3.1", 1, "Cedar: the log that ate the disk", "One log file has grown out of hand. Find it and shrink it without losing it.", "fix", 3, ["ls", "gzip"],
    "**The situation.** Monitoring warns that `/var/log/app` is using too much space. The logs must be kept, so deleting is not an option: "
    "find the file that takes the most room and compress it. Leave the other logs as they are. You are `student` and may use `sudo`.",
    G("Compress the largest file in `/var/log/app` with gzip.",
      ["`ls -l` shows sizes, and `-S` sorts by size, largest first: `ls -lS /var/log/app`.",
       "The files belong to root, so compress with sudo: `sudo gzip /var/log/app/debug.log`."],
      "ls -lS /var/log/app\nsudo gzip /var/log/app/debug.log",
      ALL(AB("/var/log/app/debug.log"), {"type": "compressed", "path": "/var/log/app/debug.log.gz", "kind": "gzip"}, EX("/var/log/app/access.log"), EX("/var/log/app/error.log")),
      "gzip replaces a file with a compressed copy ending in .gz. Text logs shrink a lot, and `zcat` or `zless` still read them.",
      "the largest log is now a `.gz` file, the uncompressed copy is gone, and the other logs are untouched.",
      [("sudo gzip -9 /var/log/app/debug.log", "`-9` asks for the best compression, at the cost of time.")]),
    {"files": [F("/var/log/app/access.log", "".join("GET /page%d 200\n" % i for i in range(40)), owner="root"),
               F("/var/log/app/error.log", "09:01 ERROR disk nearly full\n", owner="root"),
               F("/var/log/app/debug.log", "".join("DEBUG tick %05d cache=warm queue=0 worker=idle\n" % i for i in range(900)), owner="root")]}, minutes=5),

  game("S3", SCENARIO, "3.1", 1, "Elm: the config that vanished", "A file was deleted by mistake. Monday's backup still has it.", "fix", 3, ["tar"],
    "**The situation.** Someone deleted `~/site/config.ini`. Monday's backup, `~/backups/site-monday.tar.gz`, still contains it. "
    "The page `~/site/index.html` has been edited since Monday, and that newer version must survive, so unpacking the whole backup over the site is not the answer.",
    G("Bring back `~/site/config.ini` from the backup without replacing the current `~/site/index.html`.",
      ["List the archive first, so you know the exact path of the file inside it: `tar -tzf backups/site-monday.tar.gz`.",
       "tar extracts only the members you name: `tar -xzf backups/site-monday.tar.gz site/config.ini`."],
      "tar -tzf backups/site-monday.tar.gz\ntar -xzf backups/site-monday.tar.gz site/config.ini",
      ALL(EQ(HOME + "/site/config.ini", "port=8080\ntheme=plain\n"), HAS(HOME + "/site/index.html", "new page")),
      "Naming a member after the archive makes tar extract only that file, at the path stored in the archive. From your home directory that is exactly where it belongs.",
      "`~/site/config.ini` has the contents from the backup, and `~/site/index.html` is still the new page.",
      [("tar -xzf backups/site-monday.tar.gz -C /tmp && cp /tmp/site/config.ini site/", "Unpack everything somewhere harmless, then copy the one file you need.")]),
    {"files": [F("~/site/config.ini", "port=8080\ntheme=plain\n"), F("~/site/index.html", "old page\n")],
     "run": ["mkdir backups", "tar -czf backups/site-monday.tar.gz site", "rm site/config.ini", "echo 'new page' > site/index.html"]}, minutes=8),

  game("S4", SCENARIO, "5.2", 1, "Hazel: Maria can't log in", "A password that is certainly right is refused. Look at the account.", "fix", 3, ["passwd"],
    "**The situation.** maria is back from leave and can't log in, although she is sure of her password. Nobody remembers changing anything. "
    "Find out what state her account is in and make it usable again, without giving her a new password. You are `student` and may use `sudo`.",
    G("Let maria log in again with the password she already has.",
      ["`sudo passwd -S maria` prints the account's status. An `L` in the second field means the password is locked.",
       "Unlock it: `sudo passwd -u maria`."],
      "sudo passwd -S maria\nsudo passwd -u maria", {"type": "user", "name": "maria", "password": "set"},
      "`passwd -l` locks an account by putting a `!` in front of the hash in /etc/shadow, and `passwd -u` removes it again. The password itself is unchanged.",
      "maria's account has a usable password again, and it is the one she had before.",
      [("sudo usermod -U maria", "usermod can unlock an account too.")]),
    {"users": [{"name": "maria"}], "run": ["sudo passwd -l maria"]}, minutes=5),
]
