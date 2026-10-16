// SPDX-License-Identifier: AGPL-3.0-or-later
// exit 0 lab shell: a small simulated Linux system for hands-on labs.
// A virtual filesystem with owners, modes, sticky/SUID bits, hard and symbolic links; users and
// groups; and a Bash-like interpreter (quoting, variables, globs, pipes, redirection, &&/||, if/for/while,
// scripts) with the commands Linux Essentials covers. No DOM access: the UI lives in app.js.
// Labs check machine *state* (files, modes, users), so a real Linux backend could replace this later.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LEShell = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (s, n, right) => { s = String(s); return s.length >= n ? s : right ? s + " ".repeat(n - s.length) : " ".repeat(n - s.length) + s; };
  const q = s => "'" + s + "'";            // GNU tools quote names like 'this'
  const cq = s => "‘" + s + "’";  // ...and some use ‘this’
  const bytes = s => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : Buffer.byteLength(s));

  // ================================================================ machine
  class ShellError extends Error { constructor(msg, code) { super(msg); this.code = code == null ? 1 : code; } }
  class Incomplete extends ShellError {}     // the input ends mid-construct (open quote, heredoc, if without fi...): ask for more
  class ExitSignal { constructor(code) { this.code = code; } }
  let manCache = null;           // manual pages come from man.js (window.LEManPages in the browser, require() in Node)
  function manpages() {
    if (manCache) return manCache;
    const g = typeof globalThis !== "undefined" ? globalThis : self;
    if (g.LEManPages) manCache = g.LEManPages;
    else if (typeof require === "function") { try { manCache = require("./man.js"); } catch (e) { manCache = {}; } }
    return manCache || {};
  }

  // Commands that live in /usr/sbin (administration); everything else is in /usr/bin. Builtins also exist as files where real systems have them.
  const SBIN = ["useradd", "usermod", "userdel", "groupadd", "groupdel", "groupmems", "adduser", "updatedb", "chpasswd"];
  const SUID = ["passwd", "sudo", "su", "chsh", "chfn", "mount", "umount"];
  const ZONES = { UTC: [0, "UTC"], GMT: [0, "GMT"], "Etc/UTC": [0, "UTC"], EST: [-300, "EST"], EST5EDT: [-240, "EDT"], "America/New_York": [-240, "EDT"], CST: [-360, "CST"], "America/Chicago": [-300, "CDT"],
    MST: [-420, "MST"], "America/Denver": [-360, "MDT"], PST: [-480, "PST"], PST8PDT: [-420, "PDT"], "America/Los_Angeles": [-420, "PDT"], CET: [120, "CEST"], "Europe/Berlin": [120, "CEST"],
    "Europe/London": [60, "BST"], "Asia/Tokyo": [540, "JST"], JST: [540, "JST"], "Australia/Sydney": [660, "AEDT"], IST: [330, "IST"], "Asia/Kolkata": [330, "IST"] };

  function createMachine(opts) {
    opts = opts || {};
    const m = {
      inodes: new Map(), nextIno: 1000, rootIno: 0,
      users: [], groups: [], passwords: {},
      uid: 1000, stack: [], env: {}, exported: new Set(), aliases: {}, history: [],
      cwd: "/", last: 0, args: [], scriptName: "bash", now: opts.now || Date.now(), hostname: opts.hostname || "lab",
      sudoers: new Set(["sudo", "wheel"]), editRequest: null, distro: (opts.setup && opts.setup.distro) || "ubuntu", pid: 2301, nextPid: 2400, procs: [], locateDb: [], userInfo: {},
      net: { links: [{ name: "lo", flags: "LOOPBACK,UP,LOWER_UP", mtu: 65536, state: "UNKNOWN", mac: "00:00:00:00:00:00", loop: true, addrs: ["127.0.0.1/8", "::1/128"] },
                     { name: "enp0s3", flags: "BROADCAST,MULTICAST,UP,LOWER_UP", mtu: 1500, state: "UP", mac: "52:54:00:12:34:56", addrs: ["192.168.1.42/24", "fe80::5054:ff:fe12:3456/64"], dynamic: "192.168.1.42/24" }],
             routes: [{ dst: "default", via: "192.168.1.1", dev: "enp0s3", extra: "proto dhcp metric 100" }, { dst: "192.168.1.0/24", dev: "enp0s3", extra: "proto kernel scope link src 192.168.1.42" }],
             routes6: [{ dst: "fe80::/64", dev: "enp0s3", extra: "proto kernel metric 256" }] },
    };
    m.rootIno = mkInode(m, "dir", 0o755, 0, 0);
    const base = [
      ["d", "/boot"], ["d", "/dev"], ["d", "/etc"], ["d", "/etc/skel"], ["d", "/etc/ssh"], ["d", "/home"], ["d", "/media"], ["d", "/mnt"],
      ["d", "/opt"], ["d", "/proc"], ["d", "/root", 0o700], ["d", "/run"], ["d", "/run/user"], ["d", "/srv"], ["d", "/sys"], ["d", "/tmp", 0o1777], ["d", "/usr"],
      ["d", "/usr/bin"], ["d", "/usr/sbin"], ["d", "/usr/local"], ["d", "/usr/local/bin"], ["d", "/usr/share"], ["d", "/usr/share/doc"], ["d", "/usr/share/doc/bash"],
      ["d", "/usr/share/doc/bash/examples"], ["d", "/usr/share/doc/tar"], ["d", "/usr/share/man"], ["d", "/var"], ["d", "/var/cache"], ["d", "/var/lib"], ["d", "/var/log"], ["d", "/var/mail"],
      ["d", "/var/spool"], ["d", "/var/tmp", 0o1777], ["d", "/var/www"], ["d", "/var/www/html"],
      ["f", "/etc/hostname", 0o644, m.hostname + "\n"],
      ["f", "/etc/hosts", 0o644, "127.0.0.1\tlocalhost\n127.0.1.1\t" + m.hostname + "\n10.0.0.5\tintranet.example.com intranet\n"],
      ["f", "/etc/resolv.conf", 0o644, "nameserver 1.1.1.1\nnameserver 9.9.9.9\n"],
      ["f", "/etc/os-release", 0o644, m.distro === "fedora" ? 'NAME="Fedora Linux"\nVERSION="41 (Workstation Edition)"\nID=fedora\nVERSION_ID=41\nPRETTY_NAME="Fedora Linux 41 (simulated by exit 0)"\n'
        : 'PRETTY_NAME="Ubuntu 24.04.1 LTS (simulated by exit 0)"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\n'],
      ["f", "/etc/cups/cupsd.conf", 0o644, "# CUPS printing service configuration\nListen localhost:631\n"], ["d", "/var/lib/dpkg"],
      ["f", "/etc/fstab", 0o644, "# <file system> <mount point> <type> <options> <dump> <pass>\n/dev/sda2  /          ext4  defaults  0 1\n/dev/sda1  /boot/efi  vfat  umask=0077  0 1\n"],
      ["f", "/etc/sudoers", 0o440, "root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\n"],
      ["f", "/etc/passwd", 0o644, ""], ["f", "/etc/group", 0o644, ""], ["f", "/etc/shadow", 0o640, "", 0, 42], ["f", "/etc/gshadow", 0o640, "", 0, 42],
      ["f", "/etc/shells", 0o644, "# /etc/shells: valid login shells\n/bin/sh\n/usr/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/dash\n/usr/bin/dash\n"],
      ["f", "/etc/timezone", 0o644, "Etc/UTC\n"],
      ["f", "/etc/udev/udev.conf", 0o644, "# see udev.conf(5) for details\n#udev_log=info\n"], ["d", "/etc/udev/rules.d"],
      ["f", "/etc/systemd/system.conf", 0o644, "[Manager]\n#LogLevel=info\n"], ["d", "/etc/systemd/system"], ["d", "/etc/systemd/user"],
      ["f", "/etc/netplan/01-netcfg.yaml", 0o600, "network:\n  version: 2\n  ethernets:\n    enp0s3:\n      dhcp4: true\n"],
      ["f", "/etc/crontab", 0o644, "# /etc/crontab: system-wide crontab\nSHELL=/bin/sh\n17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n"],
      ["f", "/etc/default/locale", 0o644, "LANG=C.UTF-8\n"],
      ["f", "/usr/share/doc/bash/examples/README", 0o644, "Example scripts for GNU Bash.\n"],
      ["f", "/usr/share/doc/tar/README", 0o644, "GNU tar: an archiver. See 'tar --help' for a short summary.\n"],
      ["f", "/usr/share/doc/tar/NEWS", 0o644, "GNU tar NEWS: user-visible changes.\n"],
      ["f", "/var/log/kern.log", 0o640, "Oct 10 09:12:44 lab kernel: [ 8723.551210] usb 1-1: new high-speed USB device number 3 using xhci_hcd\nOct 10 09:12:45 lab kernel: [ 8724.610132]  sdb: sdb1\n", 0, 4],
      ["f", "/var/log/wtmp", 0o664, "\u0007\u0000\u0000\u0000(binary login records; read with last)", 0, 43],
      ["f", "/var/log/btmp", 0o660, "\u0006\u0000\u0000\u0000(binary failed-login records; read with lastb)", 0, 43],
      ["d", "/var/log/journal"], ["d", "/var/lib/plocate"], ["f", "/var/www/html/index.html", 0o644, "<h1>It works!</h1>\n"],
      ["f", "/etc/skel/.bashrc", 0o644, "# ~/.bashrc: executed by bash for interactive shells\nalias ll='ls -l'\n"],
      ["f", "/etc/skel/.profile", 0o644, "# ~/.profile: executed by login shells\n"],
      ["f", "/etc/ssh/sshd_config", 0o644, "Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n"],
      ["f", "/usr/share/doc/bash/README", 0o644, "This is GNU Bash. Documentation for the lab shell lives in the exit 0 app.\n"],
      ["f", "/var/log/syslog", 0o640, "Oct 10 09:00:01 lab systemd[1]: Started Daily apt download activities.\nOct 10 09:12:44 lab kernel: usb 1-1: new high-speed USB device number 3\nOct 10 09:12:45 lab kernel: sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks\n", 0, 4],
      ["f", "/var/log/auth.log", 0o640, "Oct 10 09:12:01 lab sshd[2210]: Failed password for root from 203.0.113.7 port 51234 ssh2\nOct 10 09:15:22 lab sudo: student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/usr/bin/apt update\n", 0, 4],
      ["f", "/boot/vmlinuz-6.8.0-45-generic", 0o600, "\u0000(kernel image)"],
      ["f", "/boot/initrd.img-6.8.0-45-generic", 0o644, "\u0000(initial ram disk)"],
      ["f", "/boot/config-6.8.0-45-generic", 0o644, "# Linux/x86 6.8.0-45-generic Kernel Configuration\nCONFIG_EXT4_FS=y\n"],
      ["f", "/boot/System.map-6.8.0-45-generic", 0o600, "ffffffff81000000 T _text\n"],
      ["d", "/boot/grub"], ["f", "/boot/grub/grub.cfg", 0o444, "# DO NOT EDIT THIS FILE - generated by grub-mkconfig\nset timeout=5\n"],
    ];
    for (const [t, p, mode, data, uid, gid] of base) {
      if (t === "d") mkdirP(m, p, mode || 0o755, 0, 0);
      else writeNew(m, p, data, mode, uid || 0, gid || 0);
    }
    ["passwd", "group", "shadow", "gshadow"].forEach(f => { node(m, resolve(m, "/etc/" + f).ino).gen = f; });
    // merged /usr: /bin and /sbin are links, as on current Debian, Ubuntu and Fedora
    symlink(m, "/bin", "usr/bin"); symlink(m, "/sbin", "usr/sbin"); symlink(m, "/var/run", "/run");
    symlink(m, "/boot/vmlinuz", "vmlinuz-6.8.0-45-generic"); symlink(m, "/boot/initrd.img", "initrd.img-6.8.0-45-generic");
    m.groups = [g("root", 0), g("daemon", 1), g("adm", 4, ["student"]), g("disk", 6), g("cdrom", 24, ["student"]), g("sudo", 27, ["student"]), g("www-data", 33),
                g("shadow", 42), g("utmp", 43), g("plugdev", 46, ["student"]), g("users", 100), g("student", 1000)];
    if (m.distro === "fedora") { m.groups = m.groups.filter(x => x.name !== "sudo"); m.groups.push(g("wheel", 10, ["student"])); }
    m.pkgs = new Set(Object.keys(PKGS[m.distro === "fedora" ? "fedora" : "debian"]).filter(k => PKGS[m.distro === "fedora" ? "fedora" : "debian"][k].installed));
    // device files: [name, type, major/minor, mode, group]
    for (const [name, type, dev, mode, grp] of [["null", "char", "1, 3", 0o666, 0], ["zero", "char", "1, 5", 0o666, 0], ["random", "char", "1, 8", 0o666, 0], ["urandom", "char", "1, 9", 0o666, 0],
      ["tty", "char", "5, 0", 0o666, 5], ["console", "char", "5, 1", 0o600, 0], ["sda", "block", "8, 0", 0o660, 6], ["sda1", "block", "8, 1", 0o660, 6], ["sda2", "block", "8, 2", 0o660, 6],
      ["sr0", "block", "11, 0", 0o660, 24], ["mmcblk0", "block", "179, 0", 0o660, 6], ["mmcblk0p1", "block", "179, 1", 0o660, 6], ["mmcblk0p2", "block", "179, 2", 0o660, 6]]) { const ino = mkInode(m, type, mode, 0, grp); node(m, ino).dev = dev; linkInto(m, m.rootIno, "/dev", name, ino); }
    mkdirP(m, "/dev/pts", 0o755, 0, 0); mkdirP(m, "/dev/shm", 0o1777, 0, 0);
    m.users = [u("root", 0, 0, "root", "/root", "/bin/bash"), u("daemon", 1, 1, "daemon", "/usr/sbin", "/usr/sbin/nologin"),
               u("www-data", 33, 33, "www-data", "/var/www", "/usr/sbin/nologin"), u("student", 1000, 1000, "Lab Student,,,", "/home/student", "/bin/bash")];
    m.passwords = { root: "locked", daemon: "none", "www-data": "none", student: "set" };
    mkdirP(m, "/home/student", 0o750, 1000, 1000);
    writeNew(m, "/home/student/.bashrc", "# ~/.bashrc\nalias ll='ls -l'\n", 0o644, 1000, 1000);
    writeNew(m, "/home/student/.profile", "# ~/.profile\n", 0o644, 1000, 1000);
    writeNew(m, "/home/student/.bash_logout", "# ~/.bash_logout: executed by bash when a login shell exits\n", 0o644, 1000, 1000);
    m.aliases = { ll: "ls -l" };
    m.env = { HOME: "/home/student", USER: "student", LOGNAME: "student", SHELL: "/bin/bash", PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
              PWD: "/home/student", LANG: "C.UTF-8", TERM: "xterm-256color", HOSTNAME: m.hostname, SHLVL: "1" };
    ["HOME", "USER", "LOGNAME", "SHELL", "PATH", "PWD", "LANG", "TERM", "SHLVL"].forEach(k => m.exported.add(k));
    m.cwd = "/home/student";
    installCommands(m);
    m.procs = [
      proc(1, 0, "root", "?", "Ss", "/sbin/init splash", "systemd", 168500, 12000), proc(2, 0, "root", "?", "S", "[kthreadd]", "kthreadd", 0, 0),
      proc(412, 1, "root", "?", "S<s", "/usr/lib/systemd/systemd-journald", "systemd-journal", 50400, 15800), proc(612, 1, "root", "?", "Ss", "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups", "sshd", 15420, 9100),
      proc(655, 1, "root", "?", "Ss", "/usr/sbin/cron -f -P", "cron", 9500, 2700), proc(701, 1, "root", "?", "Ssl", "/usr/sbin/rsyslogd -n -iNONE", "rsyslogd", 222000, 6100),
      proc(779, 1, "root", "?", "Ss", "nginx: master process /usr/sbin/nginx", "nginx", 55200, 1600), proc(780, 779, "www-data", "?", "S", "nginx: worker process", "nginx", 125000, 18000),
      proc(2290, 612, "root", "?", "Ss", "sshd: student [priv]", "sshd", 17000, 10800), proc(2300, 2290, "student", "?", "S", "sshd: student@pts/0", "sshd", 17200, 7000),
      proc(2301, 2300, "student", "pts/0", "Ss", "-bash", "bash", 8600, 5200)];
    m.procs.forEach(p => procDir(m, p));
    for (const [f, data] of [["meminfo", "MemTotal:        8048424 kB\nMemFree:         3145728 kB\nMemAvailable:    5846576 kB\nBuffers:          120320 kB\nCached:          2920528 kB\nSwapCached:            0 kB\nActive:          2480220 kB\nInactive:        1966312 kB\nShmem:            184320 kB\nSwapTotal:       2097148 kB\nSwapFree:        2097148 kB\n"],
      ["cpuinfo", "processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz\ncpu MHz\t\t: 1600.000\ncpu cores\t: 2\nflags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx lm vmx\n\nprocessor\t: 1\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz\ncpu MHz\t\t: 1600.000\ncpu cores\t: 2\n"],
      ["version", "Linux version 6.8.0-45-generic (buildd@lab) (gcc 13.2.0) #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64\n"], ["uptime", "184320.52 360210.11\n"], ["loadavg", "0.08 0.05 0.01 1/112 2399\n"],
      ["cmdline", "BOOT_IMAGE=/boot/vmlinuz-6.8.0-45-generic root=/dev/sda2 ro quiet splash\n"], ["partitions", "major minor  #blocks  name\n\n   8        0  500107608 sda\n   8        1    1048576 sda1\n   8        2  499057664 sda2\n  11        0    1048575 sr0\n"],
      ["mounts", "/dev/sda2 / ext4 rw,relatime 0 0\n/dev/sda1 /boot/efi vfat rw,relatime,umask=0077 0 0\nproc /proc proc rw,nosuid,nodev,noexec,relatime 0 0\ntmpfs /run tmpfs rw,nosuid,nodev,mode=755 0 0\n"],
      ["filesystems", "nodev\tsysfs\nnodev\tproc\nnodev\ttmpfs\n\text4\n\tvfat\n\txfs\n"]]) writeNew(m, "/proc/" + f, data, 0o444, 0, 0);
    symlink(m, "/proc/self", "2301");
    if (opts.setup) applySetup(m, opts.setup);
    m.locateDb = snapshotPaths(m);
    const a = api(m);
    if (opts.setup && opts.setup.run) { for (const line of [].concat(opts.setup.run)) a.exec(line, { noHistory: true, tty: false }); m.lastOutput = ""; m.last = 0; m.locateDb = snapshotPaths(m); }
    return a;
  }
  function symlink(m, path, target) { const ino = mkInode(m, "link", 0o777, 0, 0); node(m, ino).target = target; node(m, mkdirP(m, dirname(path), 0o755, 0, 0)).entries.set(basename(path), ino); return ino; }
  function proc(pid, ppid, user, tty, stat, cmd, comm, vsz, rss) { return { pid, ppid, user, tty, stat, cmd, comm, vsz, rss, start: pid > 2000 ? "09:15" : "Oct08", time: pid === 1 ? "0:02" : "0:00", cpu: comm === "nginx" && pid === 780 ? 0.3 : 0.0, mem: +(rss / 80484).toFixed(1) }; }
  function procDir(m, p) {
    const us = userByName(m, p.user) || { uid: 0, gid: 0 };
    const d = mkdirP(m, "/proc/" + p.pid, 0o555, us.uid, us.gid); const dn = node(m, d); dn.uid = us.uid; dn.gid = us.gid; dn.mode = 0o555;
    const status = "Name:\t" + p.comm + "\nState:\t" + (p.stat[0] === "R" ? "R (running)" : "S (sleeping)") + "\nPid:\t" + p.pid + "\nPPid:\t" + p.ppid + "\nUid:\t" + us.uid + "\t" + us.uid + "\t" + us.uid + "\t" + us.uid + "\nVmRSS:\t" + pad(p.rss, 8) + " kB\n";
    writeNew(m, "/proc/" + p.pid + "/cmdline", p.cmd.startsWith("[") ? "" : p.cmd.split(" ").join("\u0000") + "\u0000", 0o444, us.uid, us.gid);
    writeNew(m, "/proc/" + p.pid + "/comm", p.comm + "\n", 0o644, us.uid, us.gid);
    writeNew(m, "/proc/" + p.pid + "/status", status, 0o444, us.uid, us.gid);
    writeNew(m, "/proc/" + p.pid + "/environ", "", 0o400, us.uid, us.gid);
    mkdirP(m, "/proc/" + p.pid + "/fd", 0o500, us.uid, us.gid);
    ["cwd", "exe", "root"].forEach(k => { const ino = symlink(m, "/proc/" + p.pid + "/" + k, k === "root" ? "/" : k === "cwd" ? "/" : "/usr/bin/" + p.comm); const n = node(m, ino); n.uid = us.uid; n.gid = us.gid; });
  }
  function removeProcDir(m, pid) { const r = tryResolve(m, "/proc/" + pid, { follow: false }); if (r.ino == null) return; node(m, r.parent).entries.delete(r.name); node(m, r.parent).nlink--; removeTree(m, r.ino); }
  /** Executable stubs in /usr/bin and /usr/sbin for every command, so PATH, which, type, ls and file behave like a real system. */
  function installCommands(m) {
    const deb = m.distro !== "fedora"; const notHere = deb ? ["dnf", "yum", "rpm"] : ["apt", "apt-get", "apt-cache", "dpkg"];
    const fromPkgs = new Set(); for (const P of Object.values(PKGS)) for (const pk of Object.values(P)) (pk.bins || []).forEach(b => fromPkgs.add(b));
    const names = Object.keys(CMDS).filter(k => !["cd", "export", "unset", "history", "alias", "unalias", "type", "exit", "logout", "source", ".", "help", "read", "shift", "exec", "set", "["].includes(k))
      .filter(k => !notHere.includes(k) && !fromPkgs.has(k)).concat(["nano", "vi", "vim", "["]);
    const P = PKGS[deb ? "debian" : "fedora"]; for (const k of Object.keys(P)) if (P[k].installed) (P[k].bins || []).forEach(b => names.push(b));
    for (const name of names) {
      const dir = SBIN.includes(name) ? "/usr/sbin" : "/usr/bin";
      const ino = writeNew(m, dir + "/" + name, "\u007fELF\u0002\u0001\u0001\u0000(compiled program: " + name + ")", SUID.includes(name) ? 0o4755 : 0o755, 0, 0);
      node(m, ino).cmd = name;
    }
    const sh = node(m, resolve(m, "/usr/bin/sh").ino); sh.cmd = "sh";
  }
  function snapshotPaths(m) { const out = []; const walk = (path, ino) => { const n = node(m, ino); if (path !== "/") out.push(path); if (n.type === "dir" && !path.startsWith("/proc") && !path.startsWith("/dev")) for (const [k, c] of n.entries) walk((path === "/" ? "" : path) + "/" + k, c); }; walk("/", m.rootIno); return out.sort(cmpC); }
  function g(name, gid, members) { return { name, gid, members: members || [] }; }
  function u(name, uid, gid, comment, home, shell) { return { name, uid, gid, comment, home, shell }; }

  function mkInode(m, type, mode, uid, gid) {
    const ino = m.nextIno++;
    m.inodes.set(ino, { ino, type, mode, uid, gid, mtime: m.now, nlink: type === "dir" ? 2 : 1, data: "", entries: type === "dir" ? new Map() : null, target: null, blob: null });
    return ino;
  }
  const node = (m, ino) => m.inodes.get(ino);
  /** A new file or directory made by the current user. In a set-group-ID directory it takes the directory's group (and new directories inherit the bit). */
  function newInode(m, type, mode, parent) {
    const us = userById(m, m.uid); const sgid = parent && (parent.mode & 0o2000);
    const ino = mkInode(m, type, (type === "dir" && sgid ? mode | 0o2000 : mode), us.uid, sgid ? parent.gid : us.gid); return ino;
  }

  // ---------------------------------------------------------------- paths
  function normPath(m, p) {
    if (p == null || p === "") return m.cwd;
    const abs = p.startsWith("/") ? p : (m.cwd === "/" ? "" : m.cwd) + "/" + p;
    const out = [];
    for (const part of abs.split("/")) { if (!part || part === ".") continue; if (part === "..") out.pop(); else out.push(part); }
    return "/" + out.join("/");
  }
  const dirname = p => { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); };
  const basename = p => p === "/" ? "/" : p.replace(/\/+$/, "").split("/").pop();

  /** Resolve a path. Returns {ino, parent, name, path} or throws ShellError with an errno-style message. */
  function resolve(m, p, opts) {
    opts = opts || {};
    const follow = opts.follow !== false;
    let path = p.startsWith("/") ? p : (m.cwd === "/" ? "" : m.cwd) + "/" + p;
    const parts = path.split("/").filter(x => x && x !== ".");
    let cur = m.rootIno, curPath = "/", parent = m.rootIno, name = "/", hops = 0;
    const stack = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]; const isLast = i === parts.length - 1;
      const dir = node(m, cur);
      if (dir.type !== "dir") throw new ShellError("Not a directory", 20);
      if (!can(m, dir, 1)) throw new ShellError("Permission denied", 13);
      if (part === "..") { cur = stack.length ? stack.pop() : m.rootIno; curPath = dirname(curPath); parent = stack.length ? stack[stack.length - 1] : m.rootIno; name = basename(curPath); continue; }
      const next = dir.entries.get(part);
      parent = cur; name = part;
      if (next == null) {
        if (isLast) return { ino: null, parent: cur, name: part, path: (curPath === "/" ? "" : curPath) + "/" + part };
        throw new ShellError("No such file or directory", 2);
      }
      const n = node(m, next);
      if (n.type === "link" && (follow || !isLast)) {
        if (++hops > 40) throw new ShellError("Too many levels of symbolic links", 40);
        const tgt = n.target.startsWith("/") ? n.target : (curPath === "/" ? "" : curPath) + "/" + n.target;
        const rest = parts.slice(i + 1).join("/");
        const r = resolve(m, rest ? tgt + "/" + rest : tgt, { follow });
        return Object.assign(r, { viaLink: true });
      }
      stack.push(cur); cur = next; curPath = (curPath === "/" ? "" : curPath) + "/" + part;
    }
    return { ino: cur, parent, name, path: curPath };
  }
  function tryResolve(m, p, opts) { try { return resolve(m, p, opts); } catch (e) { return { ino: null, error: e }; } }

  // ---------------------------------------------------------------- permissions
  function userByName(m, n) { return m.users.find(x => x.name === n); }
  function userById(m, id) { return m.users.find(x => x.uid === id); }
  function groupByName(m, n) { return m.groups.find(x => x.name === n); }
  function groupById(m, id) { return m.groups.find(x => x.gid === id); }
  function gidsOf(m, uid) {
    const us = userById(m, uid); if (!us) return [];
    return [us.gid].concat(m.groups.filter(x => x.members.includes(us.name)).map(x => x.gid));
  }
  /** bit: 4 read, 2 write, 1 execute. Root may do anything except run a file nobody can execute. */
  function can(m, n, bit) {
    if (m.uid === 0) return bit !== 1 || n.type === "dir" || (n.mode & 0o111) !== 0;
    if (n.uid === m.uid) return ((n.mode >> 6) & bit) === bit;
    if (gidsOf(m, m.uid).includes(n.gid)) return ((n.mode >> 3) & bit) === bit;
    return (n.mode & bit) === bit;
  }
  function canDelete(m, dirNode, child) {
    if (!can(m, dirNode, 3)) return false;
    if (dirNode.mode & 0o1000) return m.uid === 0 || child.uid === m.uid || dirNode.uid === m.uid;
    return true;
  }

  // ---------------------------------------------------------------- fs helpers (no permission checks; for setup)
  function linkInto(m, _root, dirPath, name, ino) {
    const d = node(m, resolve(m, dirPath).ino); d.entries.set(name, ino);
    const n = node(m, ino); if (n.type === "dir") d.nlink++;
  }
  function mkdirP(m, p, mode, uid, gid) {
    const parts = normPath(m, p).split("/").filter(Boolean); let cur = m.rootIno;
    for (const part of parts) {
      const d = node(m, cur); let next = d.entries.get(part);
      if (next == null) { next = mkInode(m, "dir", mode, uid, gid); d.entries.set(part, next); d.nlink++; }
      cur = next;
    }
    return cur;
  }
  function writeNew(m, p, data, mode, uid, gid, dirOwner) {
    const path = normPath(m, p); const dir = mkdirP(m, dirname(path), 0o755, dirOwner ? uid || 0 : 0, dirOwner ? gid || 0 : 0);
    const ino = mkInode(m, "file", mode == null ? 0o644 : mode, uid || 0, gid || 0);
    node(m, ino).data = data || ""; node(m, dir).entries.set(basename(path), ino); return ino;
  }

  function applySetup(m, s) {
    const user = s.user || "student";
    const us = userByName(m, user) || userByName(m, "student");
    for (const x of s.groups || []) if (!groupByName(m, x.name)) m.groups.push(g(x.name, x.gid, x.members || []));
    for (const x of s.users || []) {
      if (userByName(m, x.name)) continue;
      const uid = x.uid || nextUid(m);
      if (!groupByName(m, x.name)) m.groups.push(g(x.name, uid));
      m.users.push(u(x.name, uid, groupByName(m, x.name).gid, x.comment || "", x.home || "/home/" + x.name, x.shell || "/bin/bash"));
      (x.groups || []).forEach(gn => { const gg = groupByName(m, gn); if (gg && !gg.members.includes(x.name)) gg.members.push(x.name); });
      m.passwords[x.name] = "set";
      if (x.home !== false) { mkdirP(m, "/home/" + x.name, 0o755, uid, groupByName(m, x.name).gid); }
    }
    for (const f of s.files || []) {
      const owner = userByName(m, f.owner || user) || us; const grp = groupByName(m, f.group || owner.name) || groupById(m, owner.gid);
      const path = normPath(m, f.path.replace(/^~/, "/home/" + us.name));
      if (f.dir) { const ino = mkdirP(m, path, f.mode == null ? 0o755 : f.mode, owner.uid, grp.gid); const n = node(m, ino); n.mode = f.mode == null ? 0o755 : f.mode; n.uid = owner.uid; n.gid = grp.gid; }
      else if (f.link) { const ino = mkInode(m, "link", 0o777, owner.uid, grp.gid); node(m, ino).target = f.link; const dir = mkdirP(m, dirname(path), 0o755, owner.uid, grp.gid); node(m, dir).entries.set(basename(path), ino); }
      else writeNew(m, path, f.data == null ? "" : f.data, f.mode == null ? 0o644 : f.mode, owner.uid, grp.gid, /^\/(home|tmp|srv|var\/tmp|opt)\//.test(path));
      if (f.mtime != null) { const r = resolve(m, path, { follow: false }); node(m, r.ino).mtime = setupTime(m, f.mtime); }
    }
    for (const p of s.procs || []) {
      const pr = proc(p.pid || m.nextPid++, p.ppid || 1, p.user || user, p.tty || "?", p.stat || "S", p.cmd, p.comm || p.cmd.split(" ")[0].split("/").pop(), p.vsz || 9800, p.rss || 2100);
      if (p.cpu != null) pr.cpu = p.cpu; if (p.time) pr.time = p.time; if (p.start) pr.start = p.start; if (p.ignoresTerm) pr.ignoresTerm = true;
      m.procs.push(pr); procDir(m, pr);
    }
    for (const k in s.env || {}) m.env[k] = s.env[k];
    if (s.cwd) m.cwd = normPath(m, s.cwd.replace(/^~/, "/home/" + us.name));
    if (us.uid !== 1000) switchUser(m, us, false);
    if (s.cwd) m.env.PWD = m.cwd;
  }
  /** "-3d", "-2h", "-30m" (relative to the machine's clock) or an ISO date. */
  function setupTime(m, v) { const mm = /^-(\d+)([dhm])$/.exec(String(v)); if (mm) return m.now - (+mm[1]) * { d: 86400000, h: 3600000, m: 60000 }[mm[2]]; return Date.parse(v); }
  function nextUid(m) { let n = 1001; while (m.users.some(x => x.uid === n) || m.groups.some(x => x.gid === n)) n++; return n; }
  function switchUser(m, us, push) {
    if (push) m.stack.push({ uid: m.uid, cwd: m.cwd, env: Object.assign({}, m.env) });
    m.uid = us.uid; Object.assign(m.env, { HOME: us.home, USER: us.name, LOGNAME: us.name, SHELL: us.shell });
  }

  // ================================================================ lexer
  // Produces tokens: {t:"w", parts:[{s, q:"n"|"s"|"d"}]} words, {t:"op", v} operators, {t:"nl"} newlines.
  function lex(src) {
    const toks = []; let i = 0; let word = null; const pendingHere = [];
    const flush = () => { if (word) { toks.push(word); word = null; } };
    const add = (s, qk) => { word = word || { t: "w", parts: [] }; const last = word.parts[word.parts.length - 1]; if (last && last.q === qk) last.s += s; else word.parts.push({ s, q: qk }); };
    const readHereBodies = () => {         // after a newline: each pending heredoc takes lines up to its delimiter
      for (const h of pendingHere) {
        const body = [];
        for (;;) {
          if (i >= src.length) throw new Incomplete("warning: here-document delimited by end-of-file (wanted `" + h.delim + "')", 0);
          let j = src.indexOf("\n", i); if (j < 0) j = src.length;
          let ln = src.slice(i, j); i = j + 1;
          if (h.strip) ln = ln.replace(/^\t+/, "");
          if (ln === h.delim) break;
          body.push(ln);
        }
        h.body = body.length ? body.join("\n") + "\n" : "";
      }
      pendingHere.length = 0;
    };
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") { if (i + 1 >= src.length) throw new Incomplete("unexpected end of file", 2); if (src[i + 1] === "\n") { i += 2; continue; } add(src[i + 1], "s"); i += 2; continue; }
      if (c === "'") { const j = src.indexOf("'", i + 1); if (j < 0) throw new Incomplete("unexpected EOF while looking for matching `''", 2); add(src.slice(i + 1, j), "s"); i = j + 1; continue; }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < src.length && src[j] !== '"') {
          if (src[j] === "\\" && j + 1 < src.length && '$`"\\\n'.includes(src[j + 1])) { s += src[j + 1] === "$" ? "\u0001" : src[j + 1]; j += 2; continue; }
          if (src[j] === "$" && src[j + 1] === "(") { const k = matchParen(src, j + 1); s += src.slice(j, k + 1); j = k + 1; continue; }
          s += src[j++];
        }
        if (j >= src.length) throw new Incomplete("unexpected EOF while looking for matching `\"'", 2);
        add(s, "d"); if (!word.parts.length) add("", "d"); i = j + 1; continue;
      }
      if (c === "$" && src[i + 1] === "(") { const k = matchParen(src, i + 1); add(src.slice(i, k + 1), "n"); i = k + 1; continue; }
      if (c === "#" && !word) { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "\n") { flush(); toks.push({ t: "nl" }); i++; if (pendingHere.length) readHereBodies(); continue; }
      if (c === " " || c === "\t") { flush(); i++; continue; }
      if (src.startsWith("<<", i) && src[i + 2] !== "<") {          // heredoc: <<WORD or <<-WORD (leading tabs stripped); a quoted WORD turns off expansion
        flush(); i += 2; const strip = src[i] === "-"; if (strip) i++;
        while (src[i] === " " || src[i] === "\t") i++;
        let delim = "", quoted = false;
        while (i < src.length && !/[\s;|&<>]/.test(src[i])) { if (src[i] === "'" || src[i] === '"') { quoted = true; i++; continue; } if (src[i] === "\\") { quoted = true; i++; } delim += src[i++]; }
        if (!delim) throw new ShellError("syntax error near unexpected token `newline'", 2);
        const h = { delim, strip, quoted, body: null }; pendingHere.push(h); toks.push({ t: "op", v: "<<", here: h }); continue;
      }
      const three = src.slice(i, i + 4);
      const ops = ["2>&1", "&>>", "2>>", "&>", "2>", ">>", "&&", "||", ";;", ">", "<", "|", ";", "&"];
      const op = ops.find(o => three.startsWith(o));
      if (op) {
        if ((op === "2>" || op === "2>>" || op === "2>&1") && word) { add(c, "n"); i++; continue; }
        flush(); toks.push({ t: "op", v: op }); i += op.length; continue;
      }
      add(c, "n"); i++;
    }
    flush();
    if (pendingHere.length) throw new Incomplete("warning: here-document delimited by end-of-file (wanted `" + pendingHere[0].delim + "')", 0);
    return toks;
  }
  function matchParen(src, start) {
    let depth = 0;
    for (let k = start; k < src.length; k++) { if (src[k] === "(") depth++; else if (src[k] === ")") { depth--; if (!depth) return k; } }
    throw new Incomplete("unexpected EOF while looking for matching `)'", 2);
  }

  // ================================================================ parser
  const KEYWORDS = new Set(["if", "then", "elif", "else", "fi", "for", "in", "do", "done", "while", "until"]);
  const wordText = w => w.parts.map(p => p.s).join("");
  const isKw = (tok, k) => tok && tok.t === "w" && tok.parts.length === 1 && tok.parts[0].q === "n" && tok.parts[0].s === k;
  function parse(toks) {
    let i = 0;
    const peek = () => toks[i];
    const skipSep = () => { while (peek() && (peek().t === "nl" || (peek().t === "op" && peek().v === ";"))) i++; };
    function list(stops) {
      const items = []; skipSep();
      while (peek() && !(stops && stops.some(s => isKw(peek(), s)))) {
        const ao = andOr(); items.push(ao); skipSep();
      }
      return { type: "list", items };
    }
    function andOr() {
      const parts = [pipeline()]; const ops = [];
      while (peek() && peek().t === "op" && (peek().v === "&&" || peek().v === "||")) { ops.push(toks[i++].v); while (peek() && peek().t === "nl") i++; parts.push(pipeline()); }
      if (peek() && peek().t === "op" && peek().v === "&") i++;
      return { type: "andor", parts, ops };
    }
    function pipeline() {
      let neg = false; if (isKw(peek(), "!")) { neg = true; i++; }
      const cmds = [command()];
      while (peek() && peek().t === "op" && peek().v === "|") { i++; while (peek() && peek().t === "nl") i++; cmds.push(command()); }
      return { type: "pipe", cmds, neg };
    }
    function command() {
      const t = peek();
      if (!t) throw new Incomplete("syntax error: unexpected end of file", 2);
      if (isKw(t, "if")) { i++; const clauses = []; let cond = list(["then"]); expect("then"); let body = list(["elif", "else", "fi"]); clauses.push([cond, body]);
        while (isKw(peek(), "elif")) { i++; cond = list(["then"]); expect("then"); body = list(["elif", "else", "fi"]); clauses.push([cond, body]); }
        let otherwise = null; if (isKw(peek(), "else")) { i++; otherwise = list(["fi"]); } expect("fi"); return withRedirs({ type: "if", clauses, otherwise }); }
      if (isKw(t, "for")) { i++; const v = toks[i++]; if (!v || v.t !== "w") throw new ShellError("syntax error near `for'", 2); let words = null;
        skipNl(); if (isKw(peek(), "in")) { i++; words = []; while (peek() && peek().t === "w") words.push(toks[i++]); }
        skipSep(); expect("do"); const body = list(["done"]); expect("done"); return withRedirs({ type: "for", name: wordText(v), words, body }); }
      if (isKw(t, "while") || isKw(t, "until")) { const until = isKw(t, "until"); i++; const cond = list(["do"]); expect("do"); const body = list(["done"]); expect("done"); return withRedirs({ type: "while", cond, body, until }); }
      if (t.t === "op" && t.v !== "<" && t.v !== "<<" && t.v !== ">" && t.v !== ">>" && t.v !== "2>" && t.v !== "2>>" && t.v !== "&>" && t.v !== "&>>" && t.v !== "2>&1") throw new ShellError("syntax error near unexpected token `" + t.v + "'", 2);
      if (t.t === "w" && KEYWORDS.has(wordText(t)) && t.parts[0].q === "n" && !["in"].includes(wordText(t))) throw new ShellError("syntax error near unexpected token `" + wordText(t) + "'", 2);
      const words = [], redirs = [], assigns = [];
      while (peek() && (peek().t === "w" || (peek().t === "op" && /^(<|<<|>|>>|2>|2>>|&>|&>>|2>&1)$/.test(peek().v)))) {
        const k = toks[i++];
        if (k.t === "op") { if (k.v === "2>&1") { redirs.push({ op: "2>&1" }); continue; } if (k.v === "<<") { redirs.push({ op: "<<", here: k.here }); continue; } const target = toks[i++]; if (!target || target.t !== "w") throw new ShellError("syntax error near unexpected token `newline'", 2); redirs.push({ op: k.v, target }); continue; }
        if (!words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(wordText(k)) && k.parts[0].q === "n") { assigns.push(k); continue; }
        words.push(k);
      }
      return { type: "simple", words, redirs, assigns };
    }
    function withRedirs(c) { c.redirs = []; while (peek() && peek().t === "op" && /^(<|<<|>|>>|2>|2>>|&>|&>>|2>&1)$/.test(peek().v)) { const k = toks[i++]; if (k.v === "2>&1") c.redirs.push({ op: "2>&1" }); else if (k.v === "<<") c.redirs.push({ op: "<<", here: k.here }); else c.redirs.push({ op: k.v, target: toks[i++] }); } return c; }
    function skipNl() { while (peek() && peek().t === "nl") i++; }
    function expect(k) { skipSep(); if (!peek()) throw new Incomplete("syntax error: unexpected end of file", 2); if (!isKw(peek(), k)) throw new ShellError("syntax error: expected `" + k + "'", 2); i++; }
    const tree = list(null);
    if (i < toks.length) throw new ShellError("syntax error near unexpected token `" + (toks[i].v || wordText(toks[i])) + "'", 2);
    return tree;
  }

  // ================================================================ expansion
  function expandVars(m, s, ctx) {
    let out = "";
    for (let i = 0; i < s.length;) {
      if (s.startsWith("$((", i)) { const j = s.indexOf("))", i + 3); if (j > 0) { out += String(arith(m, s.slice(i + 3, j))); i = j + 2; continue; } }
      if (s.startsWith("$(", i)) { const j = matchParen(s, i + 1); out += runCapture(m, s.slice(i + 2, j), ctx).replace(/\n+$/, ""); i = j + 1; continue; }
      out += s[i++];
    }
    s = out;
    return s.replace(/\$(\{[^}]+\}|[A-Za-z_][A-Za-z0-9_]*|[0-9#?@*$!])/g, (_, name) => {
      if (name[0] === "{") name = name.slice(1, -1);
      if (name === "?") return String(m.last);
      if (name === "#") return String(m.args.length);
      if (name === "@" || name === "*") return m.args.join(" ");
      if (name === "$") return String(m.pid);
      if (name === "0") return m.scriptName;
      if (/^[0-9]+$/.test(name)) return m.args[+name - 1] || "";
      let mm;
      if ((mm = /^#([A-Za-z_][A-Za-z0-9_]*)$/.exec(name))) return String((m.env[mm[1]] || "").length);
      if ((mm = /^([A-Za-z_][A-Za-z0-9_]*):?([-+=?])(.*)$/.exec(name))) { const v = m.env[mm[1]]; const set = name.includes(":" + mm[2]) ? !!v : v != null;
        if (mm[2] === "-") return set ? v : mm[3]; if (mm[2] === "+") return set ? mm[3] : ""; if (mm[2] === "=") { if (!set) m.env[mm[1]] = mm[3]; return set ? v : mm[3]; } if (mm[2] === "?") { if (!set) throw new ShellError(mm[1] + ": " + (mm[3] || "parameter null or not set"), 1); return v; } }
      return m.env[name] != null ? m.env[name] : "";
    }).replace(/\u0001/g, "$");
  }
  function arith(m, e) {
    const expr = e.replace(/\$?([A-Za-z_][A-Za-z0-9_]*)/g, (_, n) => String(parseInt(m.env[n], 10) || 0));
    if (!/^[\d\s+\-*/%()]*$/.test(expr)) throw new ShellError("syntax error in expression", 1);
    // eslint-disable-next-line no-new-func
    return Math.trunc(Function("return (" + (expr.trim() || "0") + ")")());
  }
  /** Expand one word into zero or more argv strings (variables, $(), ~, word splitting, globs). */
  function expandWord(m, w, ctx, noGlob) {
    if (w.parts.length === 1 && w.parts[0].q === "d" && w.parts[0].s === "$@") return m.args.slice();
    let fields = [""], globbable = [false], quotedAny = false, hadUnquoted = false;
    w.parts.forEach((p, idx) => {
      if (p.q === "s") { quotedAny = true; fields[fields.length - 1] += p.s; return; }
      let s = p.s;
      if (p.q === "n" && idx === 0 && (s === "~" || s.startsWith("~/"))) s = m.env.HOME + s.slice(1);
      else if (p.q === "n" && idx === 0 && /^~[a-z_][a-z0-9_-]*(\/|$)/.test(s)) { const nm = /^~([a-z_][a-z0-9_-]*)/.exec(s)[1]; const us = userByName(m, nm); if (us) s = us.home + s.slice(nm.length + 1); }
      const hasVar = /\$/.test(s);
      const ex = expandVars(m, s, ctx);
      if (p.q === "d") { quotedAny = true; fields[fields.length - 1] += ex; return; }
      hadUnquoted = true;
      if (/[*?[]/.test(p.s)) globbable[fields.length - 1] = true;
      if (hasVar) {
        const pieces = ex.split(/[ \t\n]+/);
        pieces.forEach((pc, k) => { if (k === 0) fields[fields.length - 1] += pc; else { fields.push(pc); globbable.push(false); } });
      } else fields[fields.length - 1] += ex;
    });
    let out = [];
    fields.forEach((f, k) => {
      if (f === "" && !quotedAny) return;
      if (globbable[k] && !noGlob) { const g2 = glob(m, f); if (g2.length) { out = out.concat(g2); return; } }
      out.push(f);
    });
    if (!out.length && quotedAny) out.push("");
    return out;
  }
  /** Brace expansion, done before everything else like Bash: a{b,c}d -> abd acd, {1..5}, {a..e}, {01..10}, {1..10..2}. */
  function braceWords(w) {
    for (let pi = 0; pi < w.parts.length; pi++) {
      const p = w.parts[pi]; if (p.q !== "n") continue; const s = p.s;
      for (let i = 0; i < s.length; i++) {
        if (s[i] !== "{" || (i > 0 && s[i - 1] === "$")) continue;
        let depth = 0, j = i; const commas = [];
        for (; j < s.length; j++) { if (s[j] === "{") depth++; else if (s[j] === "}") { depth--; if (!depth) break; } else if (s[j] === "," && depth === 1) commas.push(j); }
        if (j >= s.length) break;
        const inner = s.slice(i + 1, j); let alts = null;
        if (commas.length) { alts = []; let last = i + 1; for (const c of commas) { alts.push(s.slice(last, c)); last = c + 1; } alts.push(s.slice(last, j)); }
        else {
          let mm = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(inner);
          if (mm) { const a = +mm[1], b = +mm[2], step = Math.abs(+mm[3] || 1) * (a <= b ? 1 : -1); const width = /^-?0\d/.test(mm[1]) || /^-?0\d/.test(mm[2]) ? Math.max(mm[1].length, mm[2].length) : 0;
            alts = []; for (let x = a; a <= b ? x <= b : x >= b; x += step) { alts.push(width ? String(x).padStart(width, "0") : String(x)); if (alts.length > 10000) break; } }
          else if ((mm = /^([a-zA-Z])\.\.([a-zA-Z])$/.exec(inner))) { const a = mm[1].charCodeAt(0), b = mm[2].charCodeAt(0); alts = []; for (let x = a; a <= b ? x <= b : x >= b; x += a <= b ? 1 : -1) alts.push(String.fromCharCode(x)); }
        }
        if (!alts) continue;
        const pre = w.parts.slice(0, pi).concat(s.slice(0, i) ? [{ s: s.slice(0, i), q: "n" }] : []);
        const post = (s.slice(j + 1) ? [{ s: s.slice(j + 1), q: "n" }] : []).concat(w.parts.slice(pi + 1));
        return [].concat(...alts.map(a => braceWords({ t: "w", parts: pre.concat(a ? [{ s: a, q: "n" }] : [], post) })));
      }
    }
    return [w];
  }
  function globToRe(pat) {
    let re = "^";
    for (let i = 0; i < pat.length; i++) {
      const c = pat[i];
      if (c === "*") re += "[^/]*";
      else if (c === "?") re += "[^/]";
      else if (c === "[") { const j = pat.indexOf("]", i + 2); if (j < 0) { re += "\\["; continue; } let cls = pat.slice(i + 1, j); if (cls[0] === "!") cls = "^" + cls.slice(1); re += "[" + cls.replace(/\\/g, "\\\\") + "]"; i = j; }
      else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
    }
    return new RegExp(re + "$");
  }
  function glob(m, pat) {
    const abs = pat.startsWith("/");
    const segs = pat.split("/").filter((s, i) => s || i === 0);
    let bases = [abs ? "/" : ""];
    for (let si = abs ? 1 : 0; si < segs.length; si++) {
      const seg = segs[si]; const next = [];
      for (const b of bases) {
        const dirPath = b === "" ? "." : b;
        if (!/[*?[]/.test(seg)) { const p = b === "" ? seg : (b === "/" ? "/" : b + "/") + seg; if (tryResolve(m, p).ino != null) next.push(p); continue; }
        const r = tryResolve(m, dirPath); if (r.ino == null) continue; const d = node(m, r.ino);
        if (d.type !== "dir" || !can(m, d, 4)) continue;
        const re = globToRe(seg);
        [...d.entries.keys()].filter(n => re.test(n) && (n[0] !== "." || seg[0] === ".")).sort(cmpC)
          .forEach(n => next.push(b === "" ? n : (b === "/" ? "/" : b + "/") + n));
      }
      bases = next;
    }
    if (pat.length > 1 && pat.endsWith("/")) return bases.filter(b => { const r = tryResolve(m, b); return r.ino != null && node(m, r.ino).type === "dir"; }).map(b => b + "/");
    return bases.filter(Boolean);
  }
  const cmpC = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // ================================================================ execution
  function api(m) {
    return {
      m,
      /** Run one line (or a whole script). Returns {out, code, edit} where out mixes stdout and stderr in order. */
      exec(line, opts) {
        opts = opts || {};
        const ctx = { out: "", interactive: true, tty: opts.tty !== false };
        let changed = false;
        if (!opts.noHistory) {
          const hx = historyExpand(m, line);
          if (hx.error) { m.last = 1; m.lastOutput = "bash: " + hx.error + ": event not found\n"; return { out: m.lastOutput, code: 1, edit: null }; }
          if (hx.changed) { line = hx.line; changed = true; }
        }
        let tree = null, perr = null;
        try { tree = parse(lex(line)); }
        catch (e) {
          if (!(e instanceof ShellError)) throw e;
          // an unfinished command (open quote, heredoc, `if` without `fi`, trailing |): the terminal shows "> " and sends more
          if (e instanceof Incomplete && !opts.noIncomplete) return { out: "", code: 0, edit: null, incomplete: true };
          perr = e instanceof Incomplete && e.code !== 0 ? new ShellError("syntax error: unexpected end of file", 2) : e;
        }
        if (changed) ctx.out += line + "\n";
        if (!opts.noHistory && line.trim()) m.history.push(line);
        try {
          if (perr) throw perr;
          m.last = runList(m, tree, ctx, { stdin: "" });
        } catch (e) {
          if (e instanceof ExitSignal) { ctx.exit = true; m.last = e.code; }
          else if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; m.last = e.code; }
          else throw e;
        }
        if (ctx.exit) {
          const back = m.stack.pop();
          if (back) { m.uid = back.uid; m.cwd = back.cwd; m.env = back.env; if (back.exported) m.exported = back.exported; if (back.pid) { m.procs = m.procs.filter(p => p.pid !== m.pid); removeProcDir(m, m.pid); m.pid = back.pid; } ctx.out += back.kind === "sub" ? "exit\n" : "logout\n"; }
          else ctx.out += "logout\n(lab: this is the main lab shell, so it stays open)\n";
          ctx.exit = false;
        }
        m.lastOutput = ctx.out;
        const edit = m.editRequest; m.editRequest = null;
        return { out: ctx.out, code: m.last, edit };
      },
      prompt() { const us = userById(m, m.uid); const home = m.env.HOME; let p = m.cwd; if (p === home) p = "~"; else if (home !== "/" && p.startsWith(home + "/")) p = "~" + p.slice(home.length);
        return { user: us.name, host: m.hostname, path: p, sym: m.uid === 0 ? "#" : "$" }; },
      complete(line) { return complete(m, line); },
      writeFile(path, data) {        // an editor opened under sudo saves as root
        const as = m.editAs && m.editAs.path === normPath(m, path) ? m.editAs.uid : m.uid; const uid = m.uid; m.uid = as;
        try { return editorSave(m, path, data); } finally { m.uid = uid; } },
      readFileForEdit(path) { const r = asRoot(m, () => tryResolve(m, path)); if (r.ino == null) return ""; const n = node(m, r.ino); return n.type === "file" ? contentOf(m, n) : ""; },
      check(c) { m.realUid = m.uid; try { return asRoot(m, () => evalCheck(m, c)); } finally { delete m.realUid; } },
      // helpers for tests and checks
      stat(path, follow) { const r = asRoot(m, () => tryResolve(m, path, { follow: follow !== false })); if (r.ino == null) return null; const n = node(m, r.ino);
        return { type: n.type, mode: n.mode, perms: modeString(n), owner: (userById(m, n.uid) || {}).name || String(n.uid), group: (groupById(m, n.gid) || {}).name || String(n.gid), ino: n.ino, nlink: n.nlink, data: n.data, target: n.target, blob: n.blob, size: sizeOf(n, m) }; },
      user(name) { const x = userByName(m, name); if (!x) return null; return Object.assign({}, x, { groups: m.groups.filter(gg => gg.members.includes(name)).map(gg => gg.name), primary: (groupById(m, x.gid) || {}).name, password: m.passwords[name] || "none" }); },
      group(name) { const x = groupByName(m, name); return x ? Object.assign({}, x) : null; },
      cwd() { return m.cwd; },
      whoami() { return userById(m, m.uid).name; },
    };
  }

  /** Bash history expansion: !! (last), !n (entry n), !-n (n back), !text (last starting with text). */
  function historyExpand(m, line) {
    let out = "", changed = false, inS = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === "'") inS = !inS;
      if (c === "#" && !inS && (i === 0 || /\s/.test(line[i - 1]))) { const nl = line.indexOf("\n", i); if (nl < 0) { out += line.slice(i); break; } out += line.slice(i, nl); i = nl - 1; continue; }   // a word starting with # is a comment: no expansion to the end of the line
      if (c !== "!" || inS || i + 1 >= line.length || /[\s=(]/.test(line[i + 1])) { out += c; continue; }
      const rest = line.slice(i + 1); let mm, ev = null, len = 0;
      if (rest[0] === "!") { ev = m.history[m.history.length - 1]; len = 1; }
      else if ((mm = /^-?\d+/.exec(rest))) { const n = parseInt(mm[0], 10); ev = n < 0 ? m.history[m.history.length + n] : m.history[n - 1]; len = mm[0].length; }
      else if ((mm = /^[A-Za-z0-9_./-]+/.exec(rest))) { for (let k = m.history.length - 1; k >= 0; k--) if (m.history[k].startsWith(mm[0])) { ev = m.history[k]; break; } len = mm[0].length; }
      else { out += c; continue; }
      if (ev == null) return { error: "!" + rest.slice(0, len) };
      out += ev; i += len; changed = true;
    }
    return { line: out, changed };
  }
  function asRoot(m, fn) { const uid = m.uid; m.uid = 0; try { return fn(); } finally { m.uid = uid; } }
  function runCapture(m, src, ctx) {
    const sub = { out: "", interactive: false, capture: true };
    const saved = { cwd: m.cwd, env: Object.assign({}, m.env) };
    try { m.last = runList(m, parse(lex(src)), sub, { stdin: "" }); } catch (e) { if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; } else if (!(e instanceof ExitSignal)) throw e; }
    m.cwd = saved.cwd; m.env = saved.env;
    if (sub.err) ctx.out += sub.err;
    return sub.out;
  }

  function runList(m, list, ctx, io) {
    let code = 0;
    for (const item of list.items) code = runAndOr(m, item, ctx, io);
    return code;
  }
  function runAndOr(m, ao, ctx, io) {
    let code = runPipe(m, ao.parts[0], ctx, io); m.last = code;
    for (let k = 0; k < ao.ops.length; k++) {
      if ((ao.ops[k] === "&&" && code === 0) || (ao.ops[k] === "||" && code !== 0)) { code = runPipe(m, ao.parts[k + 1], ctx, io); m.last = code; }
    }
    return code;
  }
  function runPipe(m, p, ctx, io) {
    let stdin = io.stdin, code = 0;
    if (p.cmds.length === 1) { code = runCommand(m, p.cmds[0], ctx, { stdin, last: true }); return p.neg ? (code ? 0 : 1) : code; }
    for (let k = 0; k < p.cmds.length; k++) {
      const last = k === p.cmds.length - 1;
      const sub = { out: "", interactive: false, capture: !last ? true : ctx.capture, err: "", tty: false };
      code = runCommand(m, p.cmds[k], last ? ctx : sub, { stdin, last });
      if (!last) { stdin = sub.out; if (sub.err) ctx.out += sub.err; }
    }
    return p.neg ? (code ? 0 : 1) : code;
  }

  /** Output sink for one command. Redirections are applied left to right on an fd table, like Bash:
   *  "2>&1 > f" sends errors to the old stdout (terminal or pipe) and output to f. Files open before the command runs. */
  function makeIO(m, ctx, redirs, stdin) {
    const STDOUT = { kind: "stdout" }, STDERR = { kind: "stderr" };
    let fd1 = STDOUT, fd2 = STDERR, inData = stdin;
    const files = {};
    const fileT = (path, append) => { const key = path; if (!files[key]) { files[key] = { kind: "file", path, append, buf: "" }; prepareTarget(m, files[key]); } return files[key]; };
    for (const r of redirs) {
      if (r.op === "2>&1") { fd2 = fd1; continue; }
      if (r.op === "<<") { inData = r.here.quoted ? r.here.body : expandVars(m, r.here.body.replace(/\\\$/g, "\u0001"), ctx); continue; }
      const target = expandWord(m, r.target, ctx, true)[0];
      if (r.op === "<") { inData = readFile(m, target, "bash"); continue; }
      const append = r.op.endsWith(">>");
      if (r.op === ">" || r.op === ">>") fd1 = fileT(target, append);
      else if (r.op === "2>" || r.op === "2>>") fd2 = fileT(target, append);
      else if (r.op === "&>" || r.op === "&>>") { fd1 = fileT(target, append); fd2 = fd1; }
    }
    const write = (t, s) => {
      if (t.kind === "file") t.buf += s;
      else if (t.kind === "stdout") ctx.out += s;
      else if (ctx.capture) ctx.err = (ctx.err || "") + s;   // inside a pipe or $( ): errors still reach the terminal
      else ctx.out += s;
    };
    return {
      stdin: inData, tty: fd1 === STDOUT && !!ctx.tty,
      out(s) { write(fd1, s); }, err(s) { write(fd2, s); },
      flush() { for (const k in files) { flushTarget(m, files[k], files[k].buf); files[k].buf = ""; } },
    };
  }
  function prepareTarget(m, t) {
    if (t.path === "/dev/null") return;
    const r = resolve(m, t.path);
    if (r.ino != null) {
      const n = node(m, r.ino);
      if (n.type === "dir") throw new ShellError(t.path + ": Is a directory", 1);
      if (!can(m, n, 2)) throw new ShellError(t.path + ": Permission denied", 1);
      if (!t.append) { n.data = ""; n.blob = null; n.mtime = m.now; }
    } else {
      const d = node(m, r.parent);
      if (!can(m, d, 3)) throw new ShellError(t.path + ": Permission denied", 1);
      const ino = newInode(m, "file", 0o644, d); d.entries.set(r.name, ino);
    }
  }
  function flushTarget(m, t, data) {
    if (t.path === "/dev/null") return;
    const r = resolve(m, t.path); const n = node(m, r.ino); n.data += data; n.mtime = m.now;
  }

  function runCommand(m, c, ctx, io0) {
    if (c.type !== "simple") return runCompound(m, c, ctx, io0);
    const envBefore = {};
    const argv = [];
    try { for (const w0 of c.words) for (const w of braceWords(w0)) argv.push(...expandWord(m, w, ctx)); }
    catch (e) { if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; return e.code; } throw e; }
    const assigns = c.assigns.map(a => { const t = wordText({ parts: [a.parts[0]] }); const eq = t.indexOf("="); const name = t.slice(0, eq);
      const val0 = t.slice(eq + 1).replace(/(^|:)~(?=\/|:|$)/g, (_, pre) => pre + m.env.HOME);      // Bash expands ~ after = and : in assignments
      const rest = { parts: [{ s: val0, q: "n" }].concat(a.parts.slice(1)) }; return [name, expandWord(m, rest, ctx, true).join(" ")]; });
    if (!argv.length) { assigns.forEach(([k, v]) => { m.env[k] = v; }); return 0; }
    assigns.forEach(([k, v]) => { envBefore[k] = m.env[k]; m.env[k] = v; });
    let io;
    try { io = makeIO(m, ctx, c.redirs, io0.stdin); }
    catch (e) { if (e instanceof ShellError) { ctx.out += (e.message.startsWith("bash") ? "" : "bash: ") + e.message + "\n"; return 1; } throw e; }
    let code;
    try { code = dispatch(m, argv, io, ctx); }
    finally { io.flush(); assigns.forEach(([k]) => { if (envBefore[k] === undefined) delete m.env[k]; else m.env[k] = envBefore[k]; }); }
    return code;
  }
  function runCompound(m, c, ctx, io0) {
    let io;
    try { io = makeIO(m, ctx, c.redirs || [], io0.stdin); } catch (e) { if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; return 1; } throw e; }
    const sub = { out: "", interactive: false, capture: ctx.capture, err: "", tty: io.tty };
    let code = 0, guard = 0;
    const run = l => runList(m, l, sub, { stdin: io.stdin });
    try {
    if (c.type === "if") {
      let done = false;
      for (const [cond, body] of c.clauses) { if (run(cond) === 0) { code = run(body); done = true; break; } }
      if (!done && c.otherwise) code = run(c.otherwise);
    } else if (c.type === "for") {
      const items = c.words ? [].concat(...[].concat(...c.words.map(braceWords)).map(w => expandWord(m, w, ctx))) : m.args.slice();
      for (const it of items) { m.env[c.name] = it; code = run(c.body); }
    } else if (c.type === "while") {
      while ((run(c.cond) === 0) !== c.until) { code = run(c.body); if (++guard > 1000) { sub.out += "bash: loop stopped after 1000 iterations (lab limit)\n"; break; } }
    }
    } finally { io.out(sub.out); if (sub.err) io.err(sub.err); io.flush(); }
    return code;
  }

  // ================================================================ file reading/writing with permissions
  function readFile(m, path, prog) {
    if (path === "/dev/null") return "";
    let r;
    try { r = resolve(m, path); } catch (e) { throw new ShellError(prog + ": " + path + ": " + e.message, 1); }
    if (r.ino == null) throw new ShellError(prog + ": " + path + ": No such file or directory", 1);
    const n = node(m, r.ino);
    if (n.type === "dir") throw new ShellError(prog + ": " + path + ": Is a directory", 1);
    if (r.path === "/etc/shadow" || normPath(m, path) === "/etc/shadow") { if (m.uid !== 0) throw new ShellError(prog + ": " + path + ": Permission denied", 1); }
    if (!can(m, n, 4)) throw new ShellError(prog + ": " + path + ": Permission denied", 1);
    return contentOf(m, n);
  }
  function contentOf(m, n) {
    if (n.gen === "passwd") return m.users.map(x => [x.name, "x", x.uid, x.gid, x.comment, x.home, x.shell].join(":")).join("\n") + "\n";
    if (n.gen === "group") return m.groups.map(x => [x.name, "x", x.gid, x.members.join(",")].join(":")).join("\n") + "\n";
    if (n.gen === "shadow") return m.users.map(x => { const p = m.passwords[x.name]; const inf = m.userInfo[x.name] || {};
      const h = p === "set" ? "$y$j9T$lab$Zm9vYmFyYmF6" : p === "locked-set" ? "!$y$j9T$lab$Zm9vYmFyYmF6" : p === "locked" ? "!" : p === "empty" ? "" : "*";
      return [x.name, h, inf.forceChange ? "0" : String(inf.lastchg || 20371), "0", "99999", "7", inf.inactive != null ? String(inf.inactive) : "", inf.expire != null ? String(inf.expire) : "", ""].join(":"); }).join("\n") + "\n";
    if (n.gen === "gshadow") return m.groups.map(x => [x.name, "!", (x.admins || []).join(","), x.members.join(",")].join(":")).join("\n") + "\n";
    if (n.blob) return binaryText(n.blob);
    return n.data;
  }
  function binaryText(b) { return b.kind === "gzip" ? "\u001f\u008b\b\u0000(gzip-compressed data)\n" : b.kind === "bzip2" ? "BZh91AY&SY(bzip2-compressed data)\n" : b.kind === "xz" ? "ý7zXZ\u0000(xz-compressed data)\n" : b.kind === "zip" ? "PK\u0003\u0004(zip archive)\n" : "(tar archive)\n"; }
  function sizeOf(n, m) {
    if (n.type === "dir") return 4096;
    if (n.type === "char" || n.type === "block") return 0;
    if (n.gen && m) return bytes(contentOf(m, n));
    if (n.cmd) { let h = 7; for (const ch of n.cmd) h = (h * 31 + ch.charCodeAt(0)) % 99991; return 14000 + h * 3; }
    if (n.type === "link") return n.target.length;
    if (n.blob) return 120 + JSON.stringify(n.blob).length % 900;
    return bytes(n.data);
  }
  function modeString(n) {
    const t = { dir: "d", link: "l", char: "c", block: "b", file: "-" }[n.type] || "-";
    const r = (sh, special, ch) => { const v = (n.mode >> sh) & 7; const x = v & 1; let s = (v & 4 ? "r" : "-") + (v & 2 ? "w" : "-");
      s += (n.mode & special) ? (x ? ch : ch.toUpperCase()) : (x ? "x" : "-"); return s; };
    return t + r(6, 0o4000, "s") + r(3, 0o2000, "s") + r(0, 0o1000, "t");
  }
  function editorSave(m, path, data) {
    const ctx = { out: "" };
    try {
      prepareTarget(m, { path, append: false });
      const r = resolve(m, path); const n = node(m, r.ino); n.data = data; n.blob = null; n.mtime = m.now;
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e), out: ctx.out }; }
  }

  // ================================================================ commands
  const CMDS = {};
  const HELP = {};
  /** Search $PATH like Bash: the first executable file named `name`. */
  function findInPath(m, name) {
    for (const dir of (m.env.PATH || "").split(":")) {
      const d = dir === "" ? m.cwd : dir;
      const p = (d === "/" ? "" : d.replace(/\/$/, "")) + "/" + name;
      const r = tryResolve(m, p); if (r.ino == null) continue;
      const n = node(m, r.ino); if (n.type === "file" && (n.mode & 0o111)) return { path: p.replace(/^\/\//, "/"), n };
    }
    return null;
  }
  function dispatch(m, argv, io, ctx) {
    let name = argv[0];
    if (m.aliases[name] && ctx.interactive !== false) { const ex = lex(m.aliases[name]).filter(t => t.t === "w").map(wordText); argv = ex.concat(argv.slice(1)); name = argv[0]; }
    if (name.includes("/")) {
      const r = tryResolve(m, name); const n = r.ino != null ? node(m, r.ino) : null;
      if (n && n.cmd) { if (!can(m, n, 1)) { io.err("bash: " + name + ": Permission denied\n"); return 126; } argv = [n.cmd].concat(argv.slice(1)); name = n.cmd; }
      else return runScript(m, name, argv.slice(1), io, true);
    } else if (!BUILTINS.has(name)) {
      const hit = findInPath(m, name);
      if (!hit) { io.err(m.env.PATH ? "bash: " + name + ": command not found\n" : "bash: " + name + ": No such file or directory\n"); return 127; }
      if (!hit.n.cmd) return runScript(m, hit.path, argv.slice(1), io, true);
      if (!can(m, hit.n, 1)) { io.err("bash: " + hit.path + ": Permission denied\n"); return 126; }
      name = hit.n.cmd; argv = [name].concat(argv.slice(1));
    }
    if (name === "vi" || name === "vim" || name === "nano") return openEditor(m, argv, io);
    const fn = CMDS[name];
    if (!fn) { io.err("bash: " + name + ": command not found\n"); return 127; }
    if (argv[1] === "--help" && !["echo", "["].includes(name)) { const h = HELP[name] || manHelp(name); if (h) { io.out(h + "\n"); return 0; } }
    try { const r = fn(m, argv.slice(1), io, ctx); return r == null ? 0 : r; }
    catch (e) {
      if (e instanceof ShellError) { io.err(e.message + "\n"); return e.code; }
      throw e;
    }
  }
  function parseOpts(args, spec) {
    // spec: string of single-letter flags; letters followed by ":" take a value. Long options map via spec.long.
    const flags = {}, rest = []; let stop = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (stop || a === "-" || !a.startsWith("-") || /^-\d/.test(a) && !spec.num && !spec.digitFlags) { rest.push(a); continue; }
      if (a === "--") { stop = true; continue; }
      if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); const map = (spec.long || {})[k]; if (!map) throw new ShellError(spec.name + ": unrecognized option '" + a + "'\nTry '" + spec.name + " --help' for more information.", spec.badCode || 1);
        if (map.endsWith(":")) { flags[map.slice(0, -1)] = v != null ? v : args[++i]; continue; }
        if (spec.flags.includes(map + ":")) flags[map] = v != null ? v : args[++i]; else flags[map] = true; continue; }
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        if (spec.num && /\d/.test(ch)) { flags.num = a.slice(j); break; }
        const idx = spec.flags.indexOf(ch);
        if (idx < 0) throw new ShellError(spec.name + ": invalid option -- '" + ch + "'\nTry '" + spec.name + " --help' for more information.", spec.badCode || 1);
        if (spec.flags[idx + 1] === ":") { flags[ch] = a.length > j + 1 ? a.slice(j + 1) : args[++i]; break; }
        flags[ch] = true;
      }
    }
    return { flags, rest };
  }
  function inputs(m, files, io, prog, cb) {
    let code = 0;
    if (!files.length) { cb(io.stdin, "-"); return 0; }
    for (const f of files) {
      if (f === "-") { cb(io.stdin, "-"); continue; }
      try { cb(readFile(m, f, prog), f); } catch (e) { if (e instanceof ShellError) { io.err(e.message + "\n"); code = 1; } else throw e; }
    }
    return code;
  }
  const lines = s => { if (!s) return []; const a = s.split("\n"); if (a[a.length - 1] === "") a.pop(); return a; };
  const joinLines = a => a.length ? a.join("\n") + "\n" : "";

  // ---------------------------------------------------------------- shell builtins
  CMDS.cd = (m, args, io) => {
    let target = args[0];
    if (target === undefined || target === "~") target = m.env.HOME;
    else if (target === "-") { target = m.env.OLDPWD || m.cwd; io.out(target + "\n"); }
    let r;
    try { r = resolve(m, target); } catch (e) { throw new ShellError("bash: cd: " + target + ": " + e.message, 1); }
    if (r.ino == null) throw new ShellError("bash: cd: " + target + ": No such file or directory", 1);
    const n = node(m, r.ino);
    if (n.type !== "dir") throw new ShellError("bash: cd: " + target + ": Not a directory", 1);
    if (!can(m, n, 1)) throw new ShellError("bash: cd: " + target + ": Permission denied", 1);
    m.env.OLDPWD = m.cwd; m.cwd = r.viaLink ? normPath(m, target) : r.path; m.env.PWD = m.cwd; return 0;
  };
  CMDS.pwd = (m, args, io) => { io.out(m.cwd + "\n"); };
  CMDS.echo = (m, args, io) => {
    let n = false, e = false; while (args.length && /^-[neE]+$/.test(args[0])) { if (args[0].includes("n")) n = true; if (args[0].includes("e")) e = true; if (args[0].includes("E")) e = false; args = args.slice(1); }
    let s = args.join(" ");
    if (e) s = s.replace(/\\(n|t|\\|a|e|c)/g, (_, c) => ({ n: "\n", t: "\t", "\\": "\\", a: "", e: "\u001b", c: "" }[c]));
    io.out(s + (n ? "" : "\n"));
  };
  CMDS.printf = (m, args, io) => {
    if (!args.length) throw new ShellError("printf: usage: printf [-v var] format [arguments]", 2);
    const fmt = args[0].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\"); let rest = args.slice(1), out = "";
    const spec = /%([-+ 0#]*)(\d+)?(?:\.(\d+))?([sdifxXoc%b])/g; const nconv = (fmt.match(/%[-+ 0#]*\d*(?:\.\d+)?[sdifxXocb]/g) || []).length;
    do { let k = 0;
      out += fmt.replace(spec, (_, fl, w, prec, t) => {
        if (t === "%") return "%"; const a = rest[k++]; let v;
        if (t === "s" || t === "b") { v = a == null ? "" : t === "b" ? a.replace(/\\n/g, "\n").replace(/\\t/g, "\t") : a; if (prec != null) v = v.slice(0, +prec); }
        else if (t === "c") v = (a || "").charAt(0);
        else { const num = a == null || a === "" ? 0 : Number(a); if (isNaN(num)) { io.err("bash: printf: " + a + ": invalid number\n"); v = "0"; }
          else if (t === "f") v = num.toFixed(prec != null ? +prec : 6); else if (t === "x") v = Math.trunc(num).toString(16); else if (t === "X") v = Math.trunc(num).toString(16).toUpperCase(); else if (t === "o") v = Math.trunc(num).toString(8); else v = String(Math.trunc(num));
          if (fl.includes("+") && num >= 0) v = "+" + v; }
        if (w && v.length < +w) v = fl.includes("-") ? v + " ".repeat(+w - v.length) : (fl.includes("0") && t !== "s" ? (v[0] === "-" ? "-" + v.slice(1).padStart(+w - 1, "0") : v.padStart(+w, "0")) : v.padStart(+w, " "));
        return v; });
      rest = rest.slice(nconv);
    } while (rest.length && nconv);
    io.out(out);
  };
  CMDS.export = (m, args) => { for (const a of args) { if (a === "-p") continue; const eq = a.indexOf("="); if (eq > 0) { m.env[a.slice(0, eq)] = a.slice(eq + 1); m.exported.add(a.slice(0, eq)); } else m.exported.add(a); } };
  CMDS.unset = (m, args) => { args.forEach(a => { delete m.env[a]; m.exported.delete(a); }); };
  CMDS.env = (m, args, io) => { if (args.length) return dispatch(m, args, io, {}); io.out(Object.keys(m.env).filter(k => m.exported.has(k)).sort().map(k => k + "=" + m.env[k]).join("\n") + "\n"); };
  CMDS.printenv = (m, args, io) => { if (args.length) { const v = m.exported.has(args[0]) ? m.env[args[0]] : undefined; if (v == null) return 1; io.out(v + "\n"); return 0; } return CMDS.env(m, [], io); };
  CMDS.history = (m, args, io) => { const h = m.history; const n = args[0] ? +args[0] : h.length; h.slice(-n).forEach((l, i) => io.out(pad(h.length - Math.min(n, h.length) + i + 1, 5) + "  " + l + "\n")); };
  CMDS.alias = (m, args, io) => { if (!args.length) { Object.keys(m.aliases).sort().forEach(k => io.out("alias " + k + "='" + m.aliases[k] + "'\n")); return; } for (const a of args) { const eq = a.indexOf("="); if (eq > 0) m.aliases[a.slice(0, eq)] = a.slice(eq + 1); else if (m.aliases[a]) io.out("alias " + a + "='" + m.aliases[a] + "'\n"); else { io.err("bash: alias: " + a + ": not found\n"); return 1; } } };
  CMDS.unalias = (m, args) => { args.forEach(a => delete m.aliases[a]); };
  const BUILTINS = new Set(["cd", "pwd", "echo", "printf", "export", "unset", "history", "alias", "unalias", "type", "exit", "logout", "test", "[", "true", "false", "source", ".", "help", "read",
    "shift", "exec", "kill", "set"]);
  CMDS.type = (m, args, io) => {
    let code = 0; const all = args.includes("-a"); const t = args.includes("-t");
    for (const a of args.filter(x => x !== "-a" && x !== "-t")) {
      const found = [];
      if (m.aliases[a]) found.push(t ? "alias" : a + " is aliased to `" + m.aliases[a] + "'");
      if (KEYWORDS.has(a)) found.push(t ? "keyword" : a + " is a shell keyword");
      if (BUILTINS.has(a)) found.push(t ? "builtin" : a + " is a shell builtin");
      if (all) { for (const dir of (m.env.PATH || "").split(":")) { const r = tryResolve(m, (dir.replace(/\/$/, "") || "") + "/" + a); if (r.ino != null && node(m, r.ino).type === "file" && (node(m, r.ino).mode & 0o111)) found.push(t ? "file" : a + " is " + dir.replace(/\/$/, "") + "/" + a); } }
      else if (!found.length) { const hit = findInPath(m, a); if (hit) found.push(t ? "file" : a + " is " + hit.path); }
      if (!found.length) { if (!t) io.err("bash: type: " + a + ": not found\n"); code = 1; continue; }
      io.out((all ? found : found.slice(0, 1)).join("\n") + "\n");
    }
    return code;
  };
  CMDS.which = (m, args, io) => { let code = 0; for (const a of args.filter(x => !x.startsWith("-"))) { const hit = findInPath(m, a); if (hit) io.out(hit.path + "\n"); else code = 1; } return code; };
  CMDS.shift = (m, args, io) => { const n = args[0] != null ? +args[0] : 1; if (isNaN(n) || n < 0) { io.err("bash: shift: " + args[0] + ": numeric argument required\n"); return 1; } if (n > m.args.length) return 1; m.args = m.args.slice(n); return 0; };
  CMDS.exec = (m, args, io, ctx) => {
    if (!args.length) return 0;
    if (["bash", "sh", "/bin/bash", "/bin/sh", "/usr/bin/bash", "/usr/bin/sh"].includes(args[0]) && args.length === 1) {   // a new shell replaces this one: same PID, unexported variables gone
      m.env = Object.fromEntries(Object.entries(m.env).filter(([k]) => m.exported.has(k))); const p = m.procs.find(x => x.pid === m.pid); if (p) { p.cmd = args[0].split("/").pop(); p.comm = p.cmd; }
      return 0;
    }
    const code = dispatch(m, args, io, ctx); throw new ExitSignal(code);
  };
  CMDS.set = (m, args, io) => { if (!args.length) { Object.keys(m.env).sort(cmpC).forEach(k => io.out(k + "=" + (/[\s$'"]/.test(m.env[k]) ? "'" + m.env[k] + "'" : m.env[k]) + "\n")); return 0; }
    if (args[0] === "--") { m.args = args.slice(1); return 0; } return 0; };
  const SIGNALS = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, TERM: 15, STOP: 19, CONT: 18, USR1: 10, USR2: 12 };
  CMDS.kill = (m, args, io) => {
    if (args[0] === "-l") { io.out(" 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\n10) SIGUSR1\t12) SIGUSR2\t15) SIGTERM\t18) SIGCONT\t19) SIGSTOP\n"); return 0; }
    let sig = 15; const pids = [];
    for (let i = 0; i < args.length; i++) { const a = args[i];
      if (a === "-s" || a === "-n") { const v = args[++i]; sig = /^\d+$/.test(v) ? +v : SIGNALS[v.replace(/^SIG/, "")]; continue; }
      if (/^-\w+$/.test(a)) { const v = a.slice(1); sig = /^\d+$/.test(v) ? +v : SIGNALS[v.replace(/^SIG/, "")]; if (sig == null) { io.err("bash: kill: " + v + ": invalid signal specification\n"); return 1; } continue; }
      pids.push(a); }
    if (!pids.length) { io.err("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n"); return 2; }
    let code = 0; const me = userById(m, m.uid).name;
    for (const a of pids) {
      if (!/^\d+$/.test(a)) { io.err("bash: kill: " + a + ": arguments must be process or job IDs\n"); code = 1; continue; }
      const p = m.procs.find(x => x.pid === +a);
      if (!p) { io.err("bash: kill: (" + a + ") - No such process\n"); code = 1; continue; }
      if (m.uid !== 0 && p.user !== me) { io.err("bash: kill: (" + a + ") - Operation not permitted\n"); code = 1; continue; }
      if (sig === 0) continue;
      if (p.pid === 1) { io.out("(lab: PID 1 is init/systemd; the kernel protects it from signals it doesn't handle)\n"); continue; }
      if (p.pid === m.pid || p.comm === "bash" && p.tty === "pts/0") { io.out(sig === 9 ? "(lab: that would kill your own shell and end the session, so the lab ignores it)\n" : ""); continue; }
      if (sig === 19) { p.stat = "T"; continue; } if (sig === 18) { p.stat = p.stat.replace("T", "S"); continue; }
      if (p.ignoresTerm && sig === 15) continue;
      m.procs = m.procs.filter(x => x !== p); removeProcDir(m, p.pid);
      m.procs.filter(x => x.ppid === p.pid).forEach(c => { c.ppid = 1; });
    }
    return code;
  };
  CMDS.true = () => 0; CMDS.false = () => 1;
  CMDS.exit = (m, args) => { throw new ExitSignal(args[0] != null ? (+args[0] & 255) : m.last); };
  CMDS.logout = CMDS.exit;
  CMDS.clear = (m, args, io) => { io.out("\u001bc"); };
  CMDS.read = (m, args, io) => { const ln = lines(io.stdin)[0]; if (ln == null) return 1; const names = args.filter(a => !a.startsWith("-")); const parts = ln.split(/\s+/); names.forEach((n, i) => { m.env[n] = i === names.length - 1 ? parts.slice(i).join(" ") : parts[i] || ""; }); return 0; };
  const BUILTIN_HELP = { cd: "cd [DIR]\n    Change the current directory to DIR. With no DIR, go to $HOME; cd - goes to the previous directory ($OLDPWD).",
    pwd: "pwd\n    Print the name of the current working directory.", echo: "echo [-neE] [ARG ...]\n    Write arguments to standard output. -n: no trailing newline; -e: interpret backslash escapes.",
    export: "export [NAME[=VALUE] ...]\n    Mark each NAME to be passed to child processes in the environment.", unset: "unset NAME ...\n    Remove each variable.",
    type: "type [-at] NAME ...\n    Tell how each NAME would be interpreted: alias, keyword, builtin or file. -a: every location.",
    alias: "alias [NAME[=VALUE] ...]\n    Define or show aliases.", history: "history [N]\n    Show the command history (last N entries).", exit: "exit [N]\n    Exit the shell with status N.",
    shift: "shift [N]\n    Move the positional parameters left by N (default 1): $2 becomes $1.", exec: "exec [COMMAND [ARGS ...]]\n    Replace the shell with COMMAND. The process ID stays the same.",
    kill: "kill [-s SIGSPEC | -SIGSPEC] PID ...\n    Send a signal (default SIGTERM) to processes.", source: "source FILE [ARGS]\n    Run the commands in FILE in the current shell (also: . FILE).",
    test: "test EXPR, [ EXPR ]\n    Evaluate a condition: -f FILE, -d DIR, -e PATH, -z STR, STR1 = STR2, N1 -eq N2, -ne, -lt, -le, -gt, -ge.", read: "read NAME ...\n    Read a line from standard input into variables.",
    set: "set\n    With no arguments, print every shell variable.", help: "help [BUILTIN]\n    Describe builtin commands." };
  CMDS.help = (m, args, io) => { if (args[0]) { const h = BUILTIN_HELP[args[0]] || (args[0] === "[" ? BUILTIN_HELP.test : null); if (!h) { io.err("bash: help: no help topics match `" + args[0] + "'.  Try `help help' or `man -k " + args[0] + "' or `info " + args[0] + "'.\n"); return 1; } io.out(args[0] + ": " + h + "\n"); return 0; }
    io.out("exit 0 lab shell (simulated Bash). Builtins (help NAME): " + [...BUILTINS].sort().join(" ") + "\nCommands (man NAME): " + Object.keys(CMDS).filter(k => !BUILTINS.has(k)).sort().join(" ") + "\nEditors: nano, vi (open an editor panel)\n"); };
  CMDS.test = (m, args) => testExpr(m, args) ? 0 : 1;
  CMDS["["] = (m, args) => { if (args[args.length - 1] !== "]") throw new ShellError("bash: [: missing `]'", 2); return testExpr(m, args.slice(0, -1)) ? 0 : 1; };
  function testExpr(m, a) {
    if (!a.length) return false;
    if (a[0] === "!") return !testExpr(m, a.slice(1));
    const i = a.indexOf("-a"); if (i > 0) return testExpr(m, a.slice(0, i)) && testExpr(m, a.slice(i + 1));
    const o = a.indexOf("-o"); if (o > 0) return testExpr(m, a.slice(0, o)) || testExpr(m, a.slice(o + 1));
    if (a.length === 1) return a[0] !== "";
    if (a.length === 2) {
      const [op, x] = a; const r = tryResolve(m, x); const n = r.ino != null ? node(m, r.ino) : null;
      switch (op) {
        case "-z": return x === ""; case "-n": return x !== "";
        case "-e": return !!n; case "-f": return !!n && n.type === "file"; case "-d": return !!n && n.type === "dir";
        case "-L": case "-h": { const l = tryResolve(m, x, { follow: false }); return l.ino != null && node(m, l.ino).type === "link"; }
        case "-r": return !!n && can(m, n, 4); case "-w": return !!n && can(m, n, 2); case "-x": return !!n && can(m, n, 1);
        case "-s": return !!n && sizeOf(n, m) > 0;
        default: throw new ShellError("bash: test: " + op + ": unary operator expected", 2);
      }
    }
    const [x, op, y] = a;
    const num = v => { if (!/^-?\d+$/.test(v.trim())) throw new ShellError("bash: [: " + v + ": integer expression expected", 2); return parseInt(v, 10); };
    switch (op) {
      case "=": case "==": return x === y; case "!=": return x !== y;
      case "-eq": return num(x) === num(y); case "-ne": return num(x) !== num(y); case "-lt": return num(x) < num(y);
      case "-le": return num(x) <= num(y); case "-gt": return num(x) > num(y); case "-ge": return num(x) >= num(y);
      default: throw new ShellError("bash: [: " + op + ": binary operator expected", 2);
    }
  }
  CMDS.source = (m, args, io) => runScript(m, args[0], args.slice(1), io, false, true);
  CMDS["."] = CMDS.source;
  CMDS.bash = (m, args, io, ctx) => { if (!args.length || (args.length === 1 && /^-(l|i|-login)$/.test(args[0]))) {   // an interactive child shell: only exported variables come along
      if (ctx && ctx.interactive === false) { io.err("bash: an interactive shell can't run inside a script here\n"); return 1; }
      const pid = m.nextPid++; const us = userById(m, m.uid);
      m.stack.push({ kind: "sub", uid: m.uid, cwd: m.cwd, env: Object.assign({}, m.env), exported: new Set(m.exported), pid: m.pid });
      m.procs.push(proc(pid, m.pid, us.name, "pts/0", "S", "bash", "bash", 8600, 5100)); procDir(m, m.procs[m.procs.length - 1]);
      m.pid = pid; m.env = Object.fromEntries(Object.entries(m.env).filter(([k]) => m.exported.has(k))); m.env.SHLVL = String((+m.env.SHLVL || 1) + 1); return 0; } if (args[0] === "-c") { const sub = { out: "", interactive: false }; const saved = { env: Object.assign({}, m.env), cwd: m.cwd };
      m.env = Object.fromEntries(Object.entries(m.env).filter(([k]) => m.exported.has(k))); try { runList(m, parse(lex(args[1] || "")), sub, { stdin: io.stdin }); } catch (e) { if (!(e instanceof ExitSignal)) throw e; } m.env = saved.env; m.cwd = saved.cwd; io.out(sub.out); return m.last; }
    return runScript(m, args[0], args.slice(1), io, false); };
  CMDS.sh = CMDS.bash;
  function runScript(m, path, args, io, direct, inPlace) {
    let r;
    try { r = resolve(m, path); } catch (e) { io.err("bash: " + path + ": " + e.message + "\n"); return 127; }
    if (r.ino == null) { io.err("bash: " + path + ": No such file or directory\n"); return 127; }
    const n = node(m, r.ino);
    if (n.type === "dir") { io.err("bash: " + path + ": Is a directory\n"); return 126; }
    if (direct && !can(m, n, 1)) { io.err("bash: " + path + ": Permission denied\n"); return 126; }
    if (!can(m, n, 4)) { io.err("bash: " + path + ": Permission denied\n"); return 126; }
    const src = n.data;
    if (direct && /^#!/.test(src)) { const interp = src.split("\n")[0].slice(2).trim().split(/\s+/)[0];
      if (!["/bin/bash", "/usr/bin/bash", "/bin/sh", "/usr/bin/sh", "/usr/bin/env"].includes(interp)) { io.err("bash: " + path + ": " + interp + ": bad interpreter: No such file or directory\n"); return 126; } }
    const saved = { args: m.args, name: m.scriptName, env: Object.assign({}, m.env), cwd: m.cwd };
    if (!inPlace) m.env = Object.fromEntries(Object.entries(m.env).filter(([k]) => m.exported.has(k)));
    m.args = args; m.scriptName = path;
    const sub = { out: "", interactive: false, tty: io.tty };
    let code = 0;
    try { code = runList(m, parse(lex(src)), sub, { stdin: io.stdin }); }
    catch (e) { if (e instanceof ExitSignal) code = e.code; else if (e instanceof ShellError) { sub.out += path + ": " + e.message + "\n"; code = 2; } else throw e; }
    io.out(sub.out);
    m.args = saved.args; m.scriptName = saved.name;
    if (!inPlace) { m.env = saved.env; m.cwd = saved.cwd; }
    return code;
  }
  function openEditor(m, argv, io) {
    const file = argv.slice(1).find(a => !a.startsWith("-") && !a.startsWith("+"));
    if (!file) { io.err(argv[0] + ": give a file name, for example: nano notes.txt\n"); return 1; }
    const r = tryResolve(m, file);
    if (r.ino != null) { const n = node(m, r.ino); if (n.type === "dir") { io.err(argv[0] + ": " + file + " is a directory\n"); return 1; } if (!can(m, n, 4)) { io.err(argv[0] + ": " + file + ": Permission denied\n"); return 1; } }
    m.editRequest = { path: normPath(m, file), editor: argv[0] }; m.editAs = { path: normPath(m, file), uid: m.uid };
    return 0;
  }

  // ---------------------------------------------------------------- files and directories
  function lsTime(t) { const d = new Date(t); return MONTHS[d.getMonth()] + " " + pad(d.getDate(), 2) + " " + pad(d.getHours(), 2).replace(" ", "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function human(n) { if (n < 1024) return String(n); const u = ["K", "M", "G", "T"]; let v = n, i = -1; do { v /= 1024; i++; } while (v >= 1024 && i < 3); return (v < 10 ? Math.ceil(v * 10) / 10 : Math.ceil(v)) + u[i]; }
  CMDS.ls = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "ls", flags: "laAhdRtSr1iFXUn", badCode: 2, long: { all: "a", "almost-all": "A", "human-readable": "h", directory: "d", recursive: "R", reverse: "r", inode: "i", classify: "F", format: "format:", sort: "sort:", "numeric-uid-gid": "n" } });
    if (f.format) { if (/^(long|verbose)$/.test(f.format)) f.l = true; else if (f.format === "single-column") f[1] = true; else if (!/^(across|commas|horizontal|vertical)$/.test(f.format)) throw new ShellError("ls: invalid argument " + cq(f.format) + " for '--format'", 2); }
    if (f.sort) { const k = { size: "S", time: "t", extension: "X", none: "U" }[f.sort]; if (!k) throw new ShellError("ls: invalid argument " + cq(f.sort) + " for '--sort'", 2); f[k] = true; }
    if (f.n) f.l = true;
    const targets = rest.length ? rest : ["."]; let code = 0;
    const files = [], dirs = [];
    for (const t of targets) {
      const r0 = tryResolve(m, t, { follow: false });
      if (r0.ino == null) { io.err("ls: cannot access " + q(t) + ": " + (r0.error ? r0.error.message : "No such file or directory") + "\n"); code = 2; continue; }
      let n = node(m, r0.ino), ino = r0.ino;
      if (n.type === "link" && !((f.l || f.d) && !t.endsWith("/"))) { const r = tryResolve(m, t); if (r.ino != null) { n = node(m, r.ino); ino = r.ino; } }
      if (n.type === "dir" && !f.d) dirs.push([t, n, ino]); else files.push([t, n]);
    }
    const sortEntries = arr => {
      const ext = n => { const i = n.lastIndexOf("."); return i > 0 ? n.slice(i + 1) : ""; };
      if (f.U) return arr;
      if (f.t) arr.sort((a, b) => b[1].mtime - a[1].mtime || cmpC(a[0], b[0]));
      else if (f.S) arr.sort((a, b) => sizeOf(b[1], m) - sizeOf(a[1], m) || cmpC(a[0], b[0]));
      else if (f.X) arr.sort((a, b) => cmpC(ext(a[0]), ext(b[0])) || cmpC(a[0], b[0]));
      else arr.sort((a, b) => cmpC(a[0], b[0]));
      if (f.r) arr.reverse(); return arr;
    };
    const fmt = (entries, showTotal) => {
      if (!entries.length) return showTotal && f.l ? "total 0\n" : "";
      if (f.l) {
        const rows = entries.map(([name, n]) => {
          const size = sizeOf(n, m);
          return [f.i ? String(n.ino) : null, modeString(n), String(n.nlink), f.n ? String(n.uid) : (userById(m, n.uid) || {}).name || String(n.uid), f.n ? String(n.gid) : (groupById(m, n.gid) || {}).name || String(n.gid),
                  n.dev ? n.dev : f.h ? human(size) : String(size), lsTime(n.mtime), name + (n.type === "link" ? " -> " + n.target : "")];
        });
        const w = [0, 1, 2, 3, 4, 5].map(k => Math.max(...rows.map(r => (r[k] || "").length)));
        const total = entries.reduce((s, [, n]) => s + (n.type === "dir" ? 4 : n.type === "file" && sizeOf(n, m) ? Math.ceil(sizeOf(n, m) / 4096) * 4 : 0), 0);
        return (showTotal ? "total " + (f.h ? human(total * 1024) : total) + "\n" : "") + rows.map(r => (r[0] != null ? pad(r[0], w[0]) + " " : "") + r[1] + " " + pad(r[2], w[2]) + " " + pad(r[3], w[3], true) + " " + pad(r[4], w[4], true) + " " + pad(r[5], w[5]) + " " + r[6] + " " + r[7]).join("\n") + "\n";
      }
      const names = entries.map(([name, n]) => (f.i ? n.ino + " " : "") + name + (f.F ? (n.type === "dir" ? "/" : n.type === "link" ? "@" : (n.mode & 0o111) ? "*" : "") : ""));
      return (f[1] || !io.tty ? names.join("\n") + "\n" : columns(names));
    };
    let out = fmt(sortEntries(files), false);
    const listDir = (t, n, label, recurse) => {
      if (!can(m, n, 4)) { io.err("ls: cannot open directory " + q(t) + ": Permission denied\n"); code = 2; return; }
      let entries = [...n.entries.entries()].filter(([k]) => f.a || f.A || k[0] !== ".").map(([k, ino]) => [k, node(m, ino)]);
      if (f.a) { const up = tryResolve(m, (t === "/" ? "" : t.replace(/\/$/, "")) + "/.."); entries = [[".", n], ["..", up.ino != null ? node(m, up.ino) : n]].concat(entries); }
      sortEntries(entries);
      if (label) out += (out ? "\n" : "") + t + ":\n";
      out += fmt(entries, true);
      if (recurse) entries.filter(([k, c]) => c.type === "dir" && k !== "." && k !== "..").forEach(([k, c]) => listDir((t === "/" ? "" : t) + "/" + k, c, true, true));
    };
    sortEntries(dirs).forEach(([t, n]) => listDir(t, n, f.R || dirs.length + files.length > 1, f.R));
    io.out(out); return code;
  };
  function columns(names, width) {           // GNU ls style: fill columns top to bottom within 80 characters
    width = width || 80; if (!names.length) return "";
    for (let cols = Math.min(names.length, Math.floor(width / 3)); cols >= 1; cols--) {
      const rows = Math.ceil(names.length / cols); const w = [];
      for (let c = 0; c < cols; c++) w.push(Math.max(0, ...names.slice(c * rows, c * rows + rows).map(x => x.length)));
      if (w.some((x, c) => !names[c * rows])) continue;
      const total = w.reduce((a, x) => a + x, 0) + 2 * (cols - 1);
      if (total <= width || cols === 1) {
        let out = ""; for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) { const x = names[c * rows + r]; if (x != null) row.push(c < cols - 1 && names[(c + 1) * rows + r] != null ? pad(x, w[c], true) : x); } out += row.join("  ") + "\n"; }
        return out;
      }
    }
    return names.join("\n") + "\n";
  }
  CMDS.dir = CMDS.ls;

  /** -i prompts: the answer is read from standard input (echo y | rm -i f). With nothing to read, the answer is "no", like real tools at end of input. */
  function ask(io, question) {
    if (io.answers == null) io.answers = lines(io.stdin);
    io.err(question); const a = io.answers.shift();
    if (a == null) { if (io.tty) io.err("\n(lab: you can't type an answer to prompts here. Pipe one in instead, for example: echo y | " + question.split(":")[0] + " -i ...)\n"); return false; }
    return /^y/i.test(a.trim());
  }
  function kindName(n, m) { return n.type === "dir" ? "directory" : n.type === "link" ? "symbolic link" : sizeOf(n, m) ? "regular file" : "regular empty file"; }
  function parentFor(m, path, prog, verb) {
    let r;
    try { r = resolve(m, path, { follow: false }); } catch (e) { throw new ShellError(prog + ": " + verb + " " + q(path) + ": " + e.message, 1); }
    return r;
  }
  CMDS.mkdir = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "mkdir", flags: "pvm:", long: { parents: "p", verbose: "v", mode: "m" } });
    if (!rest.length) throw new ShellError("mkdir: missing operand\nTry 'mkdir --help' for more information.", 1);
    let code = 0; const us = userById(m, m.uid);
    for (const p of rest) {
      const path = normPath(m, p);
      if (f.p) {
        const parts = path.split("/").filter(Boolean); let cur = m.rootIno, curPath = "";
        try {
          for (const part of parts) {
            curPath += "/" + part; const d = node(m, cur);
            if (!can(m, d, 1)) throw new ShellError("mkdir: cannot create directory " + cq(p) + ": Permission denied");
            let next = d.entries.get(part);
            if (next == null) { if (!can(m, d, 3)) throw new ShellError("mkdir: cannot create directory " + cq(curPath.replace(/^\//, p.startsWith("/") ? "/" : "")) + ": Permission denied"); next = newInode(m, "dir", 0o755, d); d.entries.set(part, next); d.nlink++; if (f.v) io.out("mkdir: created directory " + q(curPath) + "\n"); }
            else { let nn = node(m, next); if (nn.type === "link") { const rr = tryResolve(m, curPath); if (rr.ino != null) { next = rr.ino; nn = node(m, next); } } if (nn.type !== "dir") throw new ShellError("mkdir: cannot create directory " + cq(p) + ": Not a directory"); }
            cur = next;
          }
        } catch (e) { if (e instanceof ShellError) { io.err(e.message + "\n"); code = 1; continue; } throw e; }
        continue;
      }
      let r;
      try { r = resolve(m, p); } catch (e) { io.err("mkdir: cannot create directory " + cq(p) + ": " + e.message + "\n"); code = 1; continue; }
      if (r.ino != null) { io.err("mkdir: cannot create directory " + cq(p) + ": File exists\n"); code = 1; continue; }
      const d = node(m, r.parent);
      if (!can(m, d, 3)) { io.err("mkdir: cannot create directory " + cq(p) + ": Permission denied\n"); code = 1; continue; }
      const ino = newInode(m, "dir", f.m ? parseInt(f.m, 8) : 0o755, d); d.entries.set(r.name, ino); d.nlink++;
      if (f.v) io.out("mkdir: created directory " + q(p) + "\n");
    }
    return code;
  };
  CMDS.rmdir = (m, args, io) => {
    const { flags: f, rest: rest0 } = parseOpts(args, { name: "rmdir", flags: "pv", long: { parents: "p", verbose: "v" } });
    if (!rest0.length) throw new ShellError("rmdir: missing operand\nTry 'rmdir --help' for more information.", 1);
    let code = 0; const rest = [];
    for (const p0 of rest0) { rest.push(p0); if (f.p) { let x = p0.replace(/\/+$/, ""); while (x.includes("/")) { x = x.slice(0, x.lastIndexOf("/")); if (x) rest.push(x); } } }
    for (const p of rest) {
      if (f.v) io.out("rmdir: removing directory, " + q(p) + "\n");
      const r = tryResolve(m, p, { follow: false });
      if (r.ino == null) { io.err("rmdir: failed to remove " + q(p) + ": No such file or directory\n"); code = 1; continue; }
      const n = node(m, r.ino);
      if (n.type !== "dir") { io.err("rmdir: failed to remove " + q(p) + ": Not a directory\n"); code = 1; continue; }
      if (n.entries.size) { io.err("rmdir: failed to remove " + q(p) + ": Directory not empty\n"); code = 1; if (f.p) break; continue; }
      const d = node(m, r.parent);
      if (!canDelete(m, d, n)) { io.err("rmdir: failed to remove " + q(p) + ": Permission denied\n"); code = 1; continue; }
      d.entries.delete(r.name); d.nlink--; m.inodes.delete(r.ino);
    }
    return code;
  };
  CMDS.touch = (m, args, io) => {
    const { rest } = parseOpts(args, { name: "touch", flags: "acm", long: {} });
    if (!rest.length) throw new ShellError("touch: missing file operand\nTry 'touch --help' for more information.", 1);
    let code = 0; const us = userById(m, m.uid);
    for (const p of rest) {
      let r;
      try { r = resolve(m, p); } catch (e) { io.err("touch: cannot touch " + q(p) + ": " + e.message + "\n"); code = 1; continue; }
      if (r.ino != null) { const n = node(m, r.ino); if (!can(m, n, 2) && n.uid !== m.uid && m.uid !== 0) { io.err("touch: cannot touch " + q(p) + ": Permission denied\n"); code = 1; continue; } n.mtime = m.now; continue; }
      const d = node(m, r.parent);
      if (!can(m, d, 3)) { io.err("touch: cannot touch " + q(p) + ": Permission denied\n"); code = 1; continue; }
      const ino = newInode(m, "file", 0o644, d); d.entries.set(r.name, ino);
    }
    return code;
  };
  function cloneTree(m, ino, keep) {
    const n = node(m, ino); const us = userById(m, m.uid);
    const c = mkInode(m, n.type, keep ? n.mode : n.mode & 0o777, keep ? n.uid : us.uid, keep ? n.gid : us.gid);
    const cn = node(m, c); cn.data = n.data; cn.target = n.target; cn.blob = n.blob ? JSON.parse(JSON.stringify(n.blob)) : null; if (keep) cn.mtime = n.mtime;
    if (n.type === "dir") for (const [k, child] of n.entries) { const cc = cloneTree(m, child, keep); cn.entries.set(k, cc); if (node(m, cc).type === "dir") cn.nlink++; }
    return c;
  }
  function readable(m, ino) { const n = node(m, ino); if (!can(m, n, 4)) return false; if (n.type === "dir") for (const c of n.entries.values()) if (!readable(m, c)) return false; return true; }
  CMDS.cp = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "cp", flags: "rRiavfpnu", long: { recursive: "r", interactive: "i", archive: "a", verbose: "v", force: "f", update: "u", "no-clobber": "n", preserve: "p" } });
    if (rest.length < 2) throw new ShellError(rest.length ? "cp: missing destination file operand after " + q(rest[0]) + "\nTry 'cp --help' for more information." : "cp: missing file operand\nTry 'cp --help' for more information.", 1);
    const rec = f.r || f.R || f.a; const dest = rest[rest.length - 1]; const srcs = rest.slice(0, -1);
    const dr = tryResolve(m, dest); const destIsDir = dr.ino != null && node(m, dr.ino).type === "dir";
    if (srcs.length > 1 && !destIsDir) throw new ShellError("cp: target " + q(dest) + " is not a directory", 1);
    if (dest.endsWith("/") && !destIsDir && dr.ino == null) { /* cp file missing/ */ }
    let code = 0;
    for (const s of srcs) {
      const sr = tryResolve(m, s);
      if (sr.ino == null) { io.err("cp: cannot stat " + q(s) + ": No such file or directory\n"); code = 1; continue; }
      const sn = node(m, sr.ino);
      if (sn.type === "dir" && !rec) { io.err("cp: -r not specified; omitting directory " + q(s) + "\n"); code = 1; continue; }
      if (!readable(m, sr.ino)) { io.err("cp: cannot open " + q(s) + " for reading: Permission denied\n"); code = 1; continue; }
      const target = destIsDir ? (dest.replace(/\/$/, "") || "") + "/" + basename(s) : dest;
      if (!destIsDir && dest.endsWith("/")) { io.err("cp: cannot create regular file " + q(dest) + ": Not a directory\n"); code = 1; continue; }
      let tr;
      try { tr = resolve(m, target); } catch (e) { io.err("cp: cannot create regular file " + q(target) + ": " + e.message + "\n"); code = 1; continue; }
      if (tr.ino != null && tr.ino === sr.ino) { io.err("cp: " + q(s) + " and " + q(target) + " are the same file\n"); code = 1; continue; }
      const pd = node(m, tr.parent);
      if (tr.ino != null) {
        const tn = node(m, tr.ino);
        if (tn.type === "dir" && sn.type !== "dir") { io.err("cp: cannot overwrite directory " + q(target) + " with non-directory\n"); code = 1; continue; }
        if (f.n) continue;
        if (f.u && tn.mtime >= sn.mtime && sn.type !== "dir") continue;
        if (f.i && sn.type !== "dir" && !ask(io, "cp: overwrite " + q(target) + "? ")) continue;
        if (tn.type === "file" && sn.type === "file") { if (!can(m, tn, 2)) { io.err("cp: cannot create regular file " + q(target) + ": Permission denied\n"); code = 1; continue; } tn.data = sn.data; tn.blob = sn.blob ? JSON.parse(JSON.stringify(sn.blob)) : null; tn.mtime = f.p || f.a ? sn.mtime : m.now; if (f.p || f.a) tn.mode = sn.mode; if (f.v) io.out(q(s) + " -> " + q(target) + "\n"); continue; }
        if (tn.type === "dir" && sn.type === "dir") { for (const [k, child] of sn.entries) { const res = CMDS.cp(m, ["-r" + (f.a ? "a" : ""), (s.replace(/\/$/, "")) + "/" + k, target], io); if (res) code = res; } continue; }
      }
      if (!can(m, pd, 3)) { io.err("cp: cannot create " + (sn.type === "dir" ? "directory " : "regular file ") + q(target) + ": Permission denied\n"); code = 1; continue; }
      const c = cloneTree(m, sr.ino, !!(f.a || f.p)); pd.entries.set(tr.name, c); if (node(m, c).type === "dir") pd.nlink++;
      if ((pd.mode & 0o2000) && !(f.a || f.p)) node(m, c).gid = pd.gid;
      if (f.v) io.out(q(s) + " -> " + q(target) + "\n");
    }
    return code;
  };
  CMDS.mv = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "mv", flags: "ifvnu", long: { interactive: "i", force: "f", verbose: "v", "no-clobber": "n", update: "u" } });
    if (rest.length < 2) throw new ShellError(rest.length ? "mv: missing destination file operand after " + q(rest[0]) + "\nTry 'mv --help' for more information." : "mv: missing file operand\nTry 'mv --help' for more information.", 1);
    const dest = rest[rest.length - 1]; const srcs = rest.slice(0, -1);
    const dr = tryResolve(m, dest); const destIsDir = dr.ino != null && node(m, dr.ino).type === "dir";
    if (srcs.length > 1 && !destIsDir) throw new ShellError("mv: target " + q(dest) + " is not a directory", 1);
    let code = 0;
    for (const s of srcs) {
      const sr = tryResolve(m, s, { follow: false });
      if (sr.ino == null) { io.err("mv: cannot stat " + q(s) + ": No such file or directory\n"); code = 1; continue; }
      const sp = node(m, sr.parent); const sn = node(m, sr.ino);
      const target = destIsDir ? dest.replace(/\/$/, "") + "/" + basename(s) : dest;
      let tr; try { tr = resolve(m, target, { follow: false }); } catch (e) { io.err("mv: cannot move " + q(s) + " to " + q(target) + ": " + e.message + "\n"); code = 1; continue; }
      if (tr.ino === sr.ino) continue;
      const tp = node(m, tr.parent);
      if (!canDelete(m, sp, sn) || !can(m, tp, 3)) { io.err("mv: cannot move " + q(s) + " to " + q(target) + ": Permission denied\n"); code = 1; continue; }
      if (sn.type === "dir") { const sAbs = normPath(m, s); if (normPath(m, target).startsWith(sAbs + "/")) { io.err("mv: cannot move " + q(s) + " to a subdirectory of itself, " + q(target) + "\n"); code = 1; continue; } }
      if (tr.ino != null) {
        const tn = node(m, tr.ino);
        if (f.n) continue;
        if (f.i && !ask(io, "mv: overwrite " + q(target) + "? ")) continue;
        if (tn.type === "dir") { if (sn.type !== "dir") { io.err("mv: cannot overwrite directory " + q(target) + " with non-directory\n"); code = 1; continue; } if (tn.entries.size) { io.err("mv: cannot move " + q(s) + " to " + q(target) + ": Directory not empty\n"); code = 1; continue; } }
        tp.entries.delete(tr.name); if (tn.type === "dir") tp.nlink--; else releaseInode(m, tr.ino);
      }
      sp.entries.delete(sr.name); if (sn.type === "dir") sp.nlink--;
      tp.entries.set(tr.name, sr.ino); if (sn.type === "dir") tp.nlink++;
      if (f.v) io.out("renamed " + q(s) + " -> " + q(target) + "\n");
    }
    return code;
  };
  function releaseInode(m, ino) { const n = node(m, ino); if (!n) return; n.nlink--; if (n.nlink <= 0) m.inodes.delete(ino); }
  function removeTree(m, ino) { const n = node(m, ino); if (n.type === "dir") for (const c of n.entries.values()) removeTree(m, c); if (n.type === "dir") m.inodes.delete(ino); else releaseInode(m, ino); }
  CMDS.rm = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "rm", flags: "rRfivd", long: { recursive: "r", force: "f", interactive: "i", verbose: "v", dir: "d" } });
    if (!rest.length) { if (f.f) return 0; throw new ShellError("rm: missing operand\nTry 'rm --help' for more information.", 1); }
    const rec = f.r || f.R; let code = 0;
    for (const p of rest) {
      if (/(^|\/)\.\.?\/?$/.test(p)) { io.err("rm: refusing to remove '.' or '..' directory: skipping " + q(p) + "\n"); code = 1; continue; }
      if (normPath(m, p) === "/") { io.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n"); code = 1; continue; }
      let r; try { r = resolve(m, p, { follow: false }); } catch (e) { if (!f.f) { io.err("rm: cannot remove " + q(p) + ": " + e.message + "\n"); code = 1; } continue; }
      if (r.ino == null) { if (!f.f) { io.err("rm: cannot remove " + q(p) + ": No such file or directory\n"); code = 1; } continue; }
      const n = node(m, r.ino); const d = node(m, r.parent);
      if (n.type === "dir" && !rec && !(f.d && !n.entries.size)) { io.err("rm: cannot remove " + q(p) + ": Is a directory\n"); code = 1; continue; }
      if (!canDelete(m, d, n)) { io.err("rm: cannot remove " + q(p) + ": " + (d.mode & 0o1000 && can(m, d, 3) ? "Operation not permitted" : "Permission denied") + "\n"); code = 1; continue; }
      if (n.type === "dir") { const bad = findUndeletable(m, r.ino); if (bad) { io.err("rm: cannot remove " + q(p + "/" + bad) + ": Permission denied\n"); code = 1; continue; } }
      if (f.i && !f.f) {
        if (n.type === "dir") {      // rm -ri asks about each entry, then the directory itself
          let keepAll = false; const walk = (path, ino) => { const nn = node(m, ino); let keep = false;
            for (const [k, c] of [...nn.entries]) { const cn = node(m, c); if (cn.type === "dir") { if (!ask(io, "rm: descend into directory " + q(path + "/" + k) + "? ")) { keep = true; continue; } if (walk(path + "/" + k, c)) { keep = true; continue; } }
              if (ask(io, "rm: remove " + kindName(cn, m) + " " + q(path + "/" + k) + "? ")) { nn.entries.delete(k); if (cn.type === "dir") nn.nlink--; removeTree(m, c); if (f.v) io.out("removed " + q(path + "/" + k) + "\n"); } else keep = true; }
            return keep; };
          if (!ask(io, "rm: descend into directory " + q(p) + "? ")) continue;
          keepAll = walk(p.replace(/\/$/, ""), r.ino);
          if (keepAll || !ask(io, "rm: remove directory " + q(p) + "? ")) continue;
        } else if (!ask(io, "rm: remove " + kindName(n, m) + " " + q(p) + "? ")) continue;
      }
      d.entries.delete(r.name); if (n.type === "dir") d.nlink--; removeTree(m, r.ino);
      if (f.v) io.out((n.type === "dir" ? "removed directory " : "removed ") + q(p) + "\n");
    }
    return code;
  };
  function findUndeletable(m, ino) { const n = node(m, ino); for (const [k, c] of n.entries) { const cn = node(m, c); if (!canDelete(m, n, cn)) return k; if (cn.type === "dir") { const b = findUndeletable(m, c); if (b) return k + "/" + b; } } return null; }
  CMDS.ln = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "ln", flags: "sfvn", long: { symbolic: "s", force: "f", verbose: "v" } });
    if (!rest.length) throw new ShellError("ln: missing file operand\nTry 'ln --help' for more information.", 1);
    const target = rest[0]; let name = rest[1] || basename(target);
    const dr = rest[1] ? tryResolve(m, rest[1]) : { ino: null };
    if (dr.ino != null && node(m, dr.ino).type === "dir") name = rest[1].replace(/\/$/, "") + "/" + basename(target);
    let r; try { r = resolve(m, name, { follow: false }); } catch (e) { throw new ShellError("ln: failed to create " + (f.s ? "symbolic" : "hard") + " link " + q(name) + ": " + e.message, 1); }
    if (r.ino != null) { if (!f.f) throw new ShellError("ln: failed to create " + (f.s ? "symbolic" : "hard") + " link " + q(name) + ": File exists", 1); const pd0 = node(m, r.parent); pd0.entries.delete(r.name); releaseInode(m, r.ino); }
    const pd = node(m, r.parent);
    if (!can(m, pd, 3)) throw new ShellError("ln: failed to create " + (f.s ? "symbolic" : "hard") + " link " + q(name) + ": Permission denied", 1);
    const us = userById(m, m.uid);
    if (f.s) { const ino = mkInode(m, "link", 0o777, us.uid, us.gid); node(m, ino).target = target; pd.entries.set(r.name, ino); }
    else {
      const t = tryResolve(m, target);
      if (t.ino == null) throw new ShellError("ln: failed to access " + q(target) + ": No such file or directory", 1);
      const tn = node(m, t.ino);
      if (tn.type === "dir") throw new ShellError("ln: " + target + ": hard link not allowed for directory", 1);
      tn.nlink++; pd.entries.set(r.name, t.ino);
    }
    if (f.v) io.out(q(name) + " -> " + q(target) + "\n");
    return 0;
  };
  CMDS.tree = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "tree", flags: "adfFL:i", long: {} });
    if (f.L != null && !(+f.L > 0)) throw new ShellError("tree: Invalid level, must be greater than 0.", 1);
    const roots = rest.length ? rest : ["."]; let dirs = 0, files = 0;
    for (const root of roots) {
      const r = tryResolve(m, root);
      if (r.ino == null || node(m, r.ino).type !== "dir") { io.out(root + "  [error opening dir]\n"); continue; }
      io.out(root + "\n");
      const walk = (path, ino, prefix, depth) => {
        const n = node(m, ino);
        if (!can(m, n, 4)) return;
        const kids = [...n.entries.keys()].filter(k => f.a || k[0] !== ".").filter(k => !f.d || node(m, n.entries.get(k)).type === "dir").sort((x, y) => cmpC(x.toLowerCase().replace(/^\./, ""), y.toLowerCase().replace(/^\./, "")));
        kids.forEach((k, idx) => {
          const c = node(m, n.entries.get(k)); const last = idx === kids.length - 1;
          const shown = (f.f ? path + "/" + k : k) + (f.F ? (c.type === "dir" ? "/" : c.type === "link" ? "@" : (c.mode & 0o111) ? "*" : "") : "") + (c.type === "link" ? " -> " + c.target : "");
          io.out((f.i ? "" : prefix + (last ? "└── " : "├── ")) + shown + "\n");
          if (c.type === "dir") { dirs++; if (f.L == null || depth + 1 < +f.L) walk(path + "/" + k, n.entries.get(k), prefix + (last ? "    " : "│   "), depth + 1); if (!can(m, c, 4)) io.out(prefix + (last ? "    " : "│   ") + "[error opening dir]\n"); }
          else files++;
        });
      };
      walk(root.replace(/\/$/, ""), r.ino, "", 0);
    }
    io.out("\n" + dirs + " director" + (dirs === 1 ? "y" : "ies") + (f.d ? "" : ", " + files + " file" + (files === 1 ? "" : "s")) + "\n");
  };
  CMDS.du = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "du", flags: "ahscd:k", long: { all: "a", "human-readable": "h", summarize: "s", total: "c", "max-depth": "d" } });
    const blocks = n => n.type === "dir" ? 4 : n.type === "file" ? Math.ceil(sizeOf(n, m) / 4096) * 4 : 0;
    const show = (kb, path) => io.out((f.h ? (kb < 1024 ? (kb ? kb + "K" : "0") : human(kb * 1024)) : String(kb)) + "\t" + path + "\n");
    let code = 0, total = 0;
    for (const root of rest.length ? rest : ["."]) {
      const r = tryResolve(m, root); if (r.ino == null) { io.err("du: cannot access " + q(root) + ": No such file or directory\n"); code = 1; continue; }
      const walk = (path, ino, depth) => {
        const n = node(m, ino); let sum = blocks(n);
        if (n.type === "dir") {
          if (!can(m, n, 4) || !can(m, n, 1)) { io.err("du: cannot read directory " + q(path) + ": Permission denied\n"); code = 1; }
          else for (const k of [...n.entries.keys()].sort(cmpC)) { const c = n.entries.get(k); const cn = node(m, c); const sub = cn.type === "dir" ? walk(path.replace(/\/$/, "") + "/" + k, c, depth + 1) : blocks(cn); if (cn.type !== "dir" && f.a && !f.s) show(sub, path.replace(/\/$/, "") + "/" + k); sum += sub; }
        }
        if (!f.s && (n.type === "dir" || depth === 0) && (f.d == null || depth <= +f.d)) show(sum, path);
        return sum;
      };
      const t = walk(root, r.ino, 0); if (f.s) show(t, root); total += t;
    }
    if (f.c) show(total, "total");
    return code;
  };
  CMDS.basename = (m, args, io) => { if (!args.length) throw new ShellError("basename: missing operand\nTry 'basename --help' for more information.", 1);
    let b = args[0] === "/" ? "/" : args[0].replace(/\/+$/, "").split("/").pop(); if (args[1] && b.endsWith(args[1]) && b !== args[1]) b = b.slice(0, -args[1].length); io.out(b + "\n"); };
  CMDS.dirname = (m, args, io) => { if (!args.length) throw new ShellError("dirname: missing operand\nTry 'dirname --help' for more information.", 1);
    for (const a of args) { const t = a.replace(/\/+$/, ""); const i = t.lastIndexOf("/"); io.out((i < 0 ? "." : i === 0 ? "/" : t.slice(0, i).replace(/\/+$/, "")) + "\n"); } };
  CMDS.readlink = (m, args, io) => { const p = args.filter(a => !a.startsWith("-"))[0]; const r = tryResolve(m, p, { follow: false }); if (r.ino == null || node(m, r.ino).type !== "link") return 1; io.out(node(m, r.ino).target + "\n"); };
  CMDS.stat = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "stat", flags: "c:L", long: { format: "c" } });
    let code = 0;
    for (const p of rest) {
      const r = tryResolve(m, p, { follow: !!f.L });
      if (r.ino == null) { io.err("stat: cannot statx " + q(p) + ": No such file or directory\n"); code = 1; continue; }
      const n = node(m, r.ino); const ms = modeString(n); const oct = (n.mode & 0o7777).toString(8);
      const un = (userById(m, n.uid) || {}).name, gn = (groupById(m, n.gid) || {}).name;
      if (f.c) { io.out(f.c.replace(/%([aAUGsnFhi])/g, (_, k) => ({ a: oct, A: ms, U: un, G: gn, s: String(sizeOf(n, m)), n: p, F: { dir: "directory", file: sizeOf(n, m) ? "regular file" : "regular empty file", link: "symbolic link", char: "character special file" }[n.type], h: String(n.nlink), i: String(n.ino) }[k])) + "\n"); continue; }
      io.out("  File: " + p + (n.type === "link" ? " -> " + n.target : "") + "\n  Size: " + sizeOf(n, m) + "\tInode: " + n.ino + "\tLinks: " + n.nlink + "\nAccess: (" + oct.padStart(4, "0") + "/" + ms + ")  Uid: (" + pad(n.uid, 5) + "/" + pad(un, 8) + ")   Gid: (" + pad(n.gid, 5) + "/" + pad(gn, 8) + ")\n");
    }
    return code;
  };
  CMDS.file = (m, args, io) => {
    for (const p of args) {
      const r = tryResolve(m, p, { follow: false });
      if (r.ino == null) { io.out(p + ": cannot open `" + p + "' (No such file or directory)\n"); continue; }
      const n = node(m, r.ino); let t;
      if (n.type === "dir") t = "directory"; else if (n.type === "link") t = "symbolic link to " + n.target; else if (n.type === "char" || n.type === "block") t = (n.type === "char" ? "character" : "block") + " special (" + n.dev.replace(", ", "/") + ")";
      else if (n.blob) t = { gzip: "gzip compressed data", bzip2: "bzip2 compressed data, block size = 900k", xz: "XZ compressed data, checksum CRC64", zip: "Zip archive data, at least v2.0 to extract", tar: "POSIX tar archive (GNU)" }[n.blob.kind];
      else if (!n.data) t = "empty"; else if (/^#!\s*\/bin\/(ba)?sh/.test(n.data)) t = "Bourne-Again shell script, ASCII text executable"; else if (n.data.includes("\u0000")) t = "data"; else t = "ASCII text";
      io.out(p + ": " + t + "\n");
    }
  };
  CMDS.find = (m, args, io) => {
    let i = 0; const starts = []; while (i < args.length && !args[i].startsWith("-") && args[i] !== "!") starts.push(args[i++]);
    if (!starts.length) starts.push(".");
    const tests = [];
    while (i < args.length) {
      const a = args[i++];
      if (a === "-name" || a === "-iname") { const re = globToRe(args[i++]); tests.push((n, name) => a === "-iname" ? new RegExp(re.source, "i").test(name) : re.test(name)); }
      else if (a === "-type") { const t = args[i++]; tests.push(n => ({ f: "file", d: "dir", l: "link" }[t] === n.type)); }
      else if (a === "-user") { const un = args[i++]; tests.push(n => (userById(m, n.uid) || {}).name === un); }
      else if (a === "-perm") { const pm = parseInt(args[i++].replace(/^-/, ""), 8); tests.push(n => (n.mode & 0o7777) === pm); }
      else if (a === "-maxdepth") { tests.maxdepth = +args[i++]; }
      else if (a === "-print") { /* default */ }
      else throw new ShellError("find: unknown predicate `" + a + "'", 1);
    }
    let code = 0;
    const walk = (path, ino, depth) => {
      const n = node(m, ino); const name = depth === 0 ? path : basename(path);
      if (tests.every(t => t(n, name))) io.out(path + "\n");
      if (n.type === "dir" && (tests.maxdepth == null || depth < tests.maxdepth)) {
        if (!can(m, n, 4) || !can(m, n, 1)) { io.err("find: " + q(path) + ": Permission denied\n"); code = 1; return; }
        [...n.entries.keys()].sort(cmpC).forEach(k => walk((path === "/" ? "" : path.replace(/\/$/, "")) + "/" + k, n.entries.get(k), depth + 1));
      }
    };
    for (const s of starts) { const r = tryResolve(m, s, { follow: false }); if (r.ino == null) { io.err("find: " + q(s) + ": No such file or directory\n"); code = 1; continue; } walk(s, r.ino, 0); }
    return code;
  };

  // ---------------------------------------------------------------- text tools
  CMDS.cat = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "cat", flags: "nAE", long: { number: "n" } });
    let n = 0;
    return inputs(m, rest, io, "cat", s => {
      if (f.n) s = joinLines(lines(s).map(l => pad(++n, 6) + "\t" + l)) + (s && !s.endsWith("\n") ? "" : "");
      if (f.A || f.E) s = s.replace(/\t/g, f.A ? "^I" : "\t").replace(/\n/g, "$\n");
      io.out(s);
    });
  };
  CMDS.less = (m, args, io) => CMDS.cat(m, args.filter(a => !a.startsWith("-")), io);
  CMDS.more = CMDS.less;
  CMDS.head = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "head", flags: "n:c:", num: true, long: { lines: "n" } });
    const n = parseInt(f.n || f.num || "10", 10); const multi = rest.length > 1; let first = true;
    let code = 0;
    if (!rest.length) { io.out(f.c ? io.stdin.slice(0, +f.c) : joinLines(lines(io.stdin).slice(0, n))); return 0; }
    for (const file of rest) {
      let s; try { s = readFile(m, file, "head"); } catch (e) { io.err("head: cannot open " + q(file) + " for reading: " + e.message.split(": ").pop() + "\n"); code = 1; continue; }
      if (multi) io.out((first ? "" : "\n") + "==> " + file + " <==\n"); first = false;
      io.out(f.c ? s.slice(0, +f.c) : joinLines(lines(s).slice(0, n)));
    }
    return code;
  };
  CMDS.tail = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "tail", flags: "n:fF", num: true, long: { lines: "n", follow: "f" } });
    const spec = String(f.n || f.num || "10"); const fromStart = spec.startsWith("+"); const n = parseInt(spec, 10);
    const pick = a => fromStart ? a.slice(Math.max(0, n - 1)) : n === 0 ? [] : a.slice(-n);
    let code = 0;
    if (!rest.length) { io.out(joinLines(pick(lines(io.stdin)))); return 0; }
    const multi = rest.length > 1; let first = true;
    for (const file of rest) {
      let s; try { s = readFile(m, file, "tail"); } catch (e) { io.err("tail: cannot open " + q(file) + " for reading: " + e.message.split(": ").pop() + "\n"); code = 1; continue; }
      if (multi) io.out((first ? "" : "\n") + "==> " + file + " <==\n"); first = false;
      io.out(joinLines(pick(lines(s))));
    }
    if (f.f || f.F) io.out("(lab: tail -f would keep printing new lines as they are written)\n");
    return code;
  };
  CMDS.wc = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "wc", flags: "lwcm", long: { lines: "l", words: "w", bytes: "c", chars: "m" } });
    const sel = (f.l || f.w || f.c || f.m) ? ["l", "w", "c"].filter(k => f[k] || (k === "c" && f.m)) : ["l", "w", "c"];
    const rows = []; let code = 0;
    const count = s => ({ l: (s.match(/\n/g) || []).length, w: (s.match(/\S+/g) || []).length, c: f.m ? [...s].length : bytes(s) });
    if (!rest.length) { const c = count(io.stdin); rows.push([c, null]); }
    for (const file of rest) {
      try { const s = readFile(m, file, "wc"); rows.push([count(s), file]); }
      catch (e) { const msg = e.message.replace(/^wc: [^:]+: /, ""); io.err("wc: " + file + ": " + msg + "\n"); code = 1; }
    }
    if (rest.length > 1) { const t = { l: 0, w: 0, c: 0 }; rows.forEach(([c]) => { t.l += c.l; t.w += c.w; t.c += c.c; }); rows.push([t, "total"]); }
    let width;
    if (!rest.length) width = sel.length === 1 ? 0 : 7;
    else if (sel.length === 1 && rows.length === 1) width = 0;
    else width = Math.max(1, ...rows.map(([c]) => String(Math.max(c.l, c.w, c.c)).length));
    rows.forEach(([c, name]) => io.out(sel.map(k => pad(c[k], width)).join(" ") + (name ? " " + name : "") + "\n"));
    return code;
  };
  CMDS.sort = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "sort", flags: "nrut:k:f", long: { "numeric-sort": "n", reverse: "r", unique: "u" } });
    let all = []; const code = inputs(m, rest, io, "sort", s => { all = all.concat(lines(s)); });
    const key = l => {
      if (!f.k) return l;
      const [from, to] = String(f.k).split(","); const a = parseInt(from, 10) - 1; const b = to ? parseInt(to, 10) : null;
      const parts = f.t ? l.split(f.t) : l.trim().split(/\s+/);
      return (b ? parts.slice(a, b) : parts.slice(a)).join(f.t || " ");
    };
    const numv = s => { const x = parseFloat(s); return isNaN(x) ? 0 : x; };
    all.sort((x, y) => { const a = key(x), b = key(y); let c = f.n ? numv(a) - numv(b) : f.f ? cmpC(a.toLowerCase(), b.toLowerCase()) : cmpC(a, b); if (!c && f.k) c = cmpC(x, y); return c; });
    if (f.r) all.reverse();
    if (f.u) all = all.filter((l, i) => i === 0 || key(l) !== key(all[i - 1]));
    io.out(joinLines(all)); return code;
  };
  CMDS.uniq = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "uniq", flags: "cdu", long: { count: "c" } });
    let all = []; inputs(m, rest.slice(0, 1), io, "uniq", s => { all = lines(s); });
    const out = []; for (let i = 0; i < all.length;) { let j = i; while (j < all.length && all[j] === all[i]) j++; const n = j - i;
      if ((!f.d || n > 1) && (!f.u || n === 1)) out.push(f.c ? pad(n, 7) + " " + all[i] : all[i]); i = j; }
    io.out(joinLines(out));
  };
  function fieldList(spec) {
    const set = []; for (const part of spec.split(",")) { const [a, b] = part.split("-"); const from = a ? +a : 1; const to = part.includes("-") ? (b ? +b : 1e6) : from; set.push([from, to]); }
    return i => set.some(([a, b]) => i >= a && i <= b);
  }
  CMDS.cut = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "cut", flags: "d:f:c:", long: { delimiter: "d", fields: "f", characters: "c" } });
    if (!f.f && !f.c) throw new ShellError("cut: you must specify a list of bytes, characters, or fields\nTry 'cut --help' for more information.", 1);
    const d = f.d != null ? f.d : "\t";
    if (d.length !== 1 && f.f) throw new ShellError("cut: the delimiter must be a single character\nTry 'cut --help' for more information.", 1);
    return inputs(m, rest, io, "cut", s => {
      io.out(joinLines(lines(s).map(l => {
        if (f.c) { const pick = fieldList(f.c); return [...l].filter((_, i) => pick(i + 1)).join(""); }
        if (!l.includes(d)) return l;
        const pick = fieldList(f.f); return l.split(d).filter((_, i) => pick(i + 1)).join(d);
      })));
    });
  };
  CMDS.tr = (m, args, io) => {
    let del = false, squeeze = false, comp = false; const sets = [];
    for (const a of args) { if (/^-[dsc]+$/.test(a)) { if (a.includes("d")) del = true; if (a.includes("s")) squeeze = true; if (a.includes("c")) comp = true; } else if (a === "--delete") del = true; else if (a === "--squeeze-repeats") squeeze = true; else sets.push(a); }
    if (!sets.length) throw new ShellError("tr: missing operand\nTry 'tr --help' for more information.", 1);
    if ((del && !squeeze && sets.length > 1) || sets.length > 2) throw new ShellError("tr: extra operand " + q(sets[del && !squeeze ? 1 : 2]) + (del ? "\nOnly one string may be given when deleting without squeezing repeats." : "") + "\nTry 'tr --help' for more information.", 1);
    if (!del && !squeeze && sets.length < 2) throw new ShellError("tr: missing operand after " + q(sets[0]) + "\nTwo strings must be given when translating.\nTry 'tr --help' for more information.", 1);
    const expand = s0 => s0.replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, " \t\n").replace(/\[:alpha:\]/g, "A-Za-z").replace(/\[:punct:\]/g, "!-/:-@[-`{-~").replace(/\\n/g, "\n").replace(/\\t/g, "\t")
      .replace(/(.)-(.)/g, (_, a, b) => { let o = ""; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) o += String.fromCharCode(c); return o; });
    const a = expand(sets[0]), b = expand(sets[1] || "");
    const inA = c => comp ? !a.includes(c) : a.includes(c);
    let out = "";
    if (del) { for (const c of io.stdin) if (!inA(c)) out += c; if (squeeze && sets[1]) { const sq = expand(sets[1]); out = out.replace(/(.)\1+/gs, (mm, c) => sq.includes(c) ? c : mm); } io.out(out); return 0; }
    for (const c of io.stdin) { let x = c; if (sets.length > 1 && inA(c)) x = comp ? b[b.length - 1] : b[Math.min(a.indexOf(c), b.length - 1)] || ""; out += x; }
    if (squeeze) { const sq = sets.length > 1 ? b : a; let res = ""; for (const c of out) { if (res && res[res.length - 1] === c && sq.includes(c)) continue; res += c; } out = res; }
    io.out(out); return 0;
  };
  CMDS.tee = (m, args, io) => {
    const append = args.includes("-a") || args.includes("--append"); const files = args.filter(a => !a.startsWith("-")); let code = 0;
    for (const f of files) {
      if (f === "/dev/null") continue;
      try { const t = { path: f, append }; prepareTarget(m, t); flushTarget(m, t, io.stdin); }
      catch (e) { if (e instanceof ShellError) { io.err("tee: " + e.message + "\n"); code = 1; } else throw e; }
    }
    io.out(io.stdin); return code;
  };
  CMDS.seq = (m, args, io) => {
    const nums = args.map(Number); if (!nums.length || nums.some(isNaN)) throw new ShellError("seq: missing operand\nTry 'seq --help' for more information.", 1);
    const [first, step, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    const out = []; for (let x = first; step > 0 ? x <= last : x >= last; x += step) { out.push(String(x)); if (out.length > 100000) break; }
    io.out(joinLines(out));
  };
  CMDS.sed = (m, args, io, ctx, useStdin) => {
    const { flags: f, rest } = parseOpts(args, { name: "sed", flags: "nEre:i", long: { quiet: "n", "regexp-extended": "E" } });
    const script = f.e != null ? f.e : rest.shift();
    if (script == null) throw new ShellError("Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...", 1);
    const cmds = script.split(/;\s*|\n/).filter(Boolean).map(c => {
      const mm = /^(\d+|\$)?(?:,(\d+|\$))?\s*([spd])(.*)$/.exec(c.trim());
      if (!mm) throw new ShellError("sed: -e expression #1, char " + c.length + ": unknown command: `" + c.trim()[0] + "'", 1);
      const cmd = { from: mm[1], to: mm[2], op: mm[3] };
      if (cmd.op === "s") { const d = mm[4][0]; const parts = mm[4].slice(1).split(d); if (parts.length < 3) throw new ShellError("sed: -e expression #1, char " + c.length + ": unterminated `s' command", 1);
        cmd.re = toRegex(parts[0], f.E || f.r, parts[2].includes("i"), false); cmd.g = parts[2].includes("g"); cmd.rep = parts[1].replace(/\\(\d)/g, "$$$1").replace(/&/g, "$$&"); cmd.p = parts[2].includes("p"); }
      return cmd;
    });
    if (f.i) {             // -i edits each file in place
      let code = 0;
      for (const file of rest) { let txt; try { txt = readFile(m, file, "sed"); } catch (e) { io.err(e.message.replace(/^sed: /, "sed: can't read ") + "\n"); code = 2; continue; }
        const sub = { stdin: txt, buf: "", out(x) { this.buf += x; }, err: io.err }; CMDS.sed(m, args.filter(a => a !== "-i"), sub, null, true);
        const res = editorSave(m, file, sub.buf); if (!res.ok) { io.err("sed: couldn't open temporary file: Permission denied\n"); code = 4; } }
      return code;
    }
    let all = []; const code = inputs(m, useStdin ? [] : rest, io, "sed", s2 => { all = all.concat(lines(s2)); });
    const out = [];
    all.forEach((line, idx) => {
      const n = idx + 1, lastLine = n === all.length; let del = false; let l = line;
      const hit = c => { const at = v => v === "$" ? lastLine : n === +v; if (!c.from) return true; if (!c.to) return at(c.from); const a = c.from === "$" ? all.length : +c.from, b = c.to === "$" ? all.length : +c.to; return n >= a && n <= b; };
      for (const c of cmds) { if (!hit(c)) continue;
        if (c.op === "d") { del = true; break; }
        if (c.op === "p") out.push(l);
        if (c.op === "s") { const re = new RegExp(c.re.source, c.re.flags + (c.g ? "g" : "")); const before = l; l = l.replace(re, c.rep); if (c.p && l !== before) out.push(l); } }
      if (!del && !f.n) out.push(l);
    });
    io.out(joinLines(out)); return code;
  };
  function toRegex(pat, ere, icase, word) {
    let src = "";
    if (ere) src = pat;
    else {
      for (let i = 0; i < pat.length; i++) {
        const c = pat[i];
        if (c === "\\" && i + 1 < pat.length) { const n = pat[++i]; src += "(){}|+?".includes(n) ? n : "\\" + n; continue; }
        if ("(){}|+?".includes(c)) { src += "\\" + c; continue; }
        if (c === "*" && (i === 0 || pat[i - 1] === "^")) { src += "\\*"; continue; }
        src += c;
      }
    }
    if (word) src = "\\b(?:" + src + ")\\b";
    try { return new RegExp(src, icase ? "i" : ""); } catch (e) { throw new ShellError("grep: Unmatched ( or \\(", 2); }
  }
  CMDS.grep = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "grep", flags: "ivcnlrREwoqhHFe:A:B:C:", badCode: 2, long: { "ignore-case": "i", "invert-match": "v", count: "c", recursive: "r", "extended-regexp": "E", "line-number": "n", "files-with-matches": "l", quiet: "q", "fixed-strings": "F", "word-regexp": "w", "only-matching": "o", color: "color:", colour: "color:" } });
    const after = +(f.A || f.C || 0), before = +(f.B || f.C || 0);
    const pat = f.e != null ? f.e : rest.shift();
    if (pat == null) throw new ShellError("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2);
    const re = f.F ? new RegExp((f.w ? "\\b" : "") + pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (f.w ? "\\b" : ""), f.i ? "i" : "") : toRegex(pat, f.E, f.i, f.w); let files = rest; let any = false, code = 0;
    if ((f.r || f.R) && !files.length) files = ["."];
    if (f.r || f.R) { const out = []; files.forEach(p => { const r = tryResolve(m, p); if (r.ino == null) return; const walk = (path, ino) => { const n = node(m, ino); if (n.type === "dir") [...n.entries.keys()].sort(cmpC).forEach(k => walk(path.replace(/\/$/, "") + "/" + k, n.entries.get(k))); else if (n.type === "file") out.push(path); }; walk(p, r.ino); }); files = out; }
    const multi = files.length > 1 || f.r || f.R;
    const handle = (s, name) => {
      let n = 0; const all = lines(s); let lastShown = -1; const shown = new Set();
      const emit = (idx, sep) => { if (shown.has(idx)) return; if ((after || before) && lastShown >= 0 && idx > lastShown + 1) io.out("--\n"); shown.add(idx); lastShown = idx; io.out(((multi || f.H) && !f.h ? name + sep : "") + (f.n ? (idx + 1) + sep : "") + all[idx] + "\n"); };
      all.forEach((l, idx) => { const hit = re.test(l) !== !!f.v; if (!hit) return; n++; any = true;
        if (f.c || f.l || f.q) return;
        if (f.o && !f.v) { const prefix = ((multi || f.H) && !f.h ? name + ":" : "") + (f.n ? (idx + 1) + ":" : ""); const g2 = new RegExp(re.source, re.flags + "g"); (l.match(g2) || []).forEach(x => io.out(prefix + x + "\n")); return; }
        for (let k = Math.max(0, idx - before); k < idx; k++) emit(k, "-");
        emit(idx, ":");
        for (let k = idx + 1; k <= Math.min(all.length - 1, idx + after); k++) { if (re.test(all[k]) !== !!f.v) break; emit(k, "-"); } });
      if (f.c) io.out((multi && !f.h ? name + ":" : "") + n + "\n");
      if (f.l && n) io.out(name + "\n");
    };
    if (!files.length) handle(io.stdin, "(standard input)");
    for (const file of files) { try { handle(readFile(m, file, "grep"), file); } catch (e) { if (e instanceof ShellError) { io.err(e.message + "\n"); code = 2; } else throw e; } }
    return code === 2 && !any ? 2 : any ? 0 : 1;
  };
  CMDS.egrep = (m, args, io) => CMDS.grep(m, ["-E"].concat(args), io);

  // ---------------------------------------------------------------- permissions and ownership
  function parseMode(spec, cur, isDir) {
    if (/^[0-7]{1,4}$/.test(spec)) { const v = parseInt(spec, 8); return spec.length <= 3 ? (cur & (isDir ? 0o6000 : 0)) | v : v; }
    let mode = cur;
    for (const clause of spec.split(",")) {
      const mm = /^([ugoa]*)([+\-=])([rwxXst]*)$/.exec(clause); if (!mm) return null;
      const who = mm[1] || "a", op = mm[2], perms = mm[3];
      let bits = 0;
      const sh = { u: 6, g: 3, o: 0 };
      for (const w of who === "a" ? "ugo" : who) for (const p of perms) {
        if (p === "r") bits |= 4 << sh[w]; if (p === "w") bits |= 2 << sh[w];
        if (p === "x" || (p === "X" && (isDir || (cur & 0o111)))) bits |= 1 << sh[w];
        if (p === "s" && w === "u") bits |= 0o4000; if (p === "s" && w === "g") bits |= 0o2000;
        if (p === "t") bits |= 0o1000;
      }
      if (perms.includes("t") && !who.includes("o") && who !== "a" && mm[1]) bits |= 0o1000;
      if (!mm[1] && op !== "=") bits &= ~0o022;      // no who: the umask (022) applies, as in GNU chmod
      if (op === "+") mode |= bits;
      else if (op === "-") mode &= ~bits;
      else { let mask = 0; for (const w of who === "a" ? "ugo" : who) mask |= 7 << sh[w]; if (who.includes("u") || who === "a") mask |= 0o4000; if (who.includes("g") || who === "a") mask |= 0o2000; if (who.includes("o") || who === "a") mask |= 0o1000; mode = (mode & ~mask) | bits; }
    }
    return mode;
  }
  function eachTarget(m, paths, recursive, io, prog, fn) {
    let code = 0;
    for (const p of paths) {
      const r = tryResolve(m, p);
      if (r.ino == null) { io.err(prog + ": cannot access " + q(p) + ": No such file or directory\n"); code = 1; continue; }
      const visit = (path, ino) => { const res = fn(path, node(m, ino)); if (res) code = res; const n = node(m, ino); if (recursive && n.type === "dir") for (const [k, c] of n.entries) { if (node(m, c).type !== "link") visit(path.replace(/\/$/, "") + "/" + k, c); } };
      visit(p, r.ino);
    }
    return code;
  }
  CMDS.chmod = (m, args, io) => {
    const rec = args.includes("-R") || args.includes("--recursive"); const v = args.includes("-v");
    const rest = args.filter(a => a !== "-R" && a !== "--recursive" && a !== "-v");
    if (rest.length < 2) throw new ShellError(rest.length ? "chmod: missing operand after " + q(rest[0]) + "\nTry 'chmod --help' for more information." : "chmod: missing operand\nTry 'chmod --help' for more information.", 1);
    const spec = rest[0];
    if (/^\d+$/.test(spec) && !/^[0-7]{1,4}$/.test(spec)) throw new ShellError("chmod: invalid mode: " + cq(spec) + "\nTry 'chmod --help' for more information.", 1);
    return eachTarget(m, rest.slice(1), rec, io, "chmod", (path, n) => {
      if (m.uid !== 0 && n.uid !== m.uid) { io.err("chmod: changing permissions of " + q(path) + ": Operation not permitted\n"); return 1; }
      const nm = parseMode(spec, n.mode, n.type === "dir");
      if (nm == null) throw new ShellError("chmod: invalid mode: " + cq(spec) + "\nTry 'chmod --help' for more information.", 1);
      if (v && nm !== n.mode) io.out("mode of " + q(path) + " changed from " + (n.mode & 0o7777).toString(8).padStart(4, "0") + " (" + modeString(n).slice(1) + ") to " + (nm & 0o7777).toString(8).padStart(4, "0") + "\n");
      n.mode = nm; return 0;
    });
  };
  CMDS.chown = (m, args, io) => {
    const rec = args.includes("-R") || args.includes("--recursive"); const rest = args.filter(a => a !== "-R" && a !== "--recursive" && a !== "-v");
    if (rest.length < 2) throw new ShellError(rest.length ? "chown: missing operand after " + q(rest[0]) + "\nTry 'chown --help' for more information." : "chown: missing operand\nTry 'chown --help' for more information.", 1);
    const spec = rest[0]; const [un, gn0] = spec.includes(":") ? spec.split(":") : spec.includes(".") ? spec.split(".") : [spec, undefined];
    const us = un ? userByName(m, un) : null;
    if (un && !us) throw new ShellError("chown: invalid user: " + cq(spec), 1);
    let gr = null;
    if (gn0 != null && gn0 !== "") { gr = groupByName(m, gn0); if (!gr) throw new ShellError("chown: invalid group: " + cq(spec), 1); }
    else if (gn0 === "" && us) gr = groupById(m, us.gid);
    return eachTarget(m, rest.slice(1), rec, io, "chown", (path, n) => {
      if (m.uid !== 0) { io.err("chown: changing ownership of " + q(path) + ": Operation not permitted\n"); return 1; }
      if (us) n.uid = us.uid; if (gr) n.gid = gr.gid; return 0;
    });
  };
  CMDS.chgrp = (m, args, io) => {
    const rec = args.includes("-R"); const rest = args.filter(a => a !== "-R" && a !== "-v");
    if (rest.length < 2) throw new ShellError("chgrp: missing operand\nTry 'chgrp --help' for more information.", 1);
    const gr = groupByName(m, rest[0]); if (!gr) throw new ShellError("chgrp: invalid group: " + cq(rest[0]), 1);
    return eachTarget(m, rest.slice(1), rec, io, "chgrp", (path, n) => {
      if (m.uid !== 0 && (n.uid !== m.uid || !gidsOf(m, m.uid).includes(gr.gid))) { io.err("chgrp: changing group of " + q(path) + ": Operation not permitted\n"); return 1; }
      n.gid = gr.gid; return 0;
    });
  };

  // ---------------------------------------------------------------- users and groups
  CMDS.whoami = (m, args, io) => { io.out(userById(m, m.uid).name + "\n"); };
  CMDS.id = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "id", flags: "ugnG", long: {} });
    const us = rest[0] ? userByName(m, rest[0]) : userById(m, m.uid);
    if (!us) throw new ShellError("id: " + q(rest[0]) + ": no such user", 1);
    const gids = gidsOf(m, us.uid); const gname = id => (groupById(m, id) || {}).name;
    if (f.u) { io.out((f.n ? us.name : us.uid) + "\n"); return; }
    if (f.g && !f.G) { io.out((f.n ? gname(us.gid) : us.gid) + "\n"); return; }
    if (f.G) { io.out(gids.map(x => f.n ? gname(x) : x).join(" ") + "\n"); return; }
    io.out("uid=" + us.uid + "(" + us.name + ") gid=" + us.gid + "(" + gname(us.gid) + ") groups=" + gids.map(x => x + "(" + gname(x) + ")").join(",") + "\n");
  };
  CMDS.groups = (m, args, io) => { const names = args.length ? args : [userById(m, m.uid).name];
    for (const n of names) { const us = userByName(m, n); if (!us) { io.err("groups: " + q(n) + ": no such user\n"); return 1; } const list = gidsOf(m, us.uid).map(x => groupById(m, x).name).join(" "); io.out((args.length ? n + " : " : "") + list + "\n"); } };
  function needRoot(m, prog) {
    if (m.uid !== 0) throw new ShellError(prog + ": Permission denied.\n" + prog + ": cannot lock /etc/" + (prog.startsWith("group") ? "group" : "passwd") + "; try again later.", 1);
  }
  CMDS.useradd = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "useradd", flags: "mMs:G:g:c:d:u:e:f:rD", badCode: 2, long: { "create-home": "m", "no-create-home": "M", shell: "s", groups: "G", gid: "g", comment: "c", home: "d", uid: "u", expiredate: "e", inactive: "f", system: "r" } });
    if (f.D) { io.out("GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\nSHELL=/bin/sh\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=no\n"); return 0; }
    if (f.e != null && f.e !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(f.e)) throw new ShellError("useradd: invalid date '" + f.e + "'", 3);
    if (f.f != null && !/^-?\d+$/.test(f.f)) throw new ShellError("useradd: invalid numeric argument '" + f.f + "'", 3);
    if (!rest.length) throw new ShellError("Usage: useradd [options] LOGIN\n       useradd -D\n       useradd -D [options]", 2);
    needRoot(m, "useradd");
    const name = rest[0];
    if (userByName(m, name)) throw new ShellError("useradd: user '" + name + "' already exists", 9);
    if (!/^[a-z_][a-z0-9_-]*\$?$/.test(name)) throw new ShellError("useradd: invalid user name '" + name + "': use --badname to ignore", 3);
    let primary;
    if (f.g) { primary = groupByName(m, f.g) || groupById(m, +f.g); if (!primary) throw new ShellError("useradd: group '" + f.g + "' does not exist", 6); }
    const supp = f.G ? f.G.split(",") : [];
    for (const gname of supp) if (!groupByName(m, gname)) throw new ShellError("useradd: group '" + gname + "' does not exist", 6);
    const uid = f.u ? +f.u : nextUid(m);
    if (!primary) { if (groupByName(m, name)) throw new ShellError("useradd: group " + name + " exists - if you want to add this user to that group, use -g.", 9); primary = g(name, m.groups.some(x => x.gid === uid) ? nextUid(m) : uid); m.groups.push(primary); }
    const home = f.d || "/home/" + name;
    if (m.users.some(x => x.uid === uid)) throw new ShellError("useradd: UID " + uid + " is not unique", 4);
    m.users.push(u(name, uid, primary.gid, f.c || "", home, f.s || "/bin/sh"));
    m.userInfo[name] = { lastchg: 20377, expire: f.e ? Math.round(Date.parse(f.e) / 86400000) : null, inactive: f.f != null && f.f !== "-1" ? +f.f : null };
    supp.forEach(gn => groupByName(m, gn).members.push(name));
    m.passwords[name] = "locked";
    if (f.m && !f.M) {
      const r = tryResolve(m, home);
      if (r.ino != null) io.err("useradd: warning: the home directory " + home + " already exists.\nuseradd: Not copying any file from skel directory into it.\n");
      else { const hd = mkdirP(m, home, 0o750, uid, primary.gid); const hn = node(m, hd); hn.mode = 0o750; hn.uid = uid; hn.gid = primary.gid;
        const skel = node(m, resolve(m, "/etc/skel").ino); for (const [k, c] of skel.entries) { const cc = cloneTree(m, c, true); const cn = node(m, cc); cn.uid = uid; cn.gid = primary.gid; hn.entries.set(k, cc); } }
    }
    return 0;
  };
  CMDS.adduser = (m, args, io) => { io.err("adduser: this lab uses useradd (the command on the exam). Try: sudo useradd -m " + (args[0] || "NAME") + "\n"); return 1; };
  CMDS.usermod = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "usermod", flags: "aG:g:s:c:d:LUl:", badCode: 2, long: { append: "a", groups: "G", shell: "s", lock: "L", unlock: "U" } });
    if (!rest.length) throw new ShellError("Usage: usermod [options] LOGIN", 2);
    needRoot(m, "usermod");
    const us = userByName(m, rest[0]); if (!us) throw new ShellError("usermod: user '" + rest[0] + "' does not exist", 6);
    if (f.G != null) {
      const list = f.G.split(",").filter(Boolean);
      for (const gn of list) if (!groupByName(m, gn)) throw new ShellError("usermod: group '" + gn + "' does not exist", 6);
      if (!f.a) m.groups.forEach(x => { x.members = x.members.filter(n => n !== us.name); });
      list.forEach(gn => { const x = groupByName(m, gn); if (!x.members.includes(us.name)) x.members.push(us.name); });
    }
    if (f.g) { const x = groupByName(m, f.g); if (!x) throw new ShellError("usermod: group '" + f.g + "' does not exist", 6); us.gid = x.gid; }
    if (f.s) us.shell = f.s; if (f.c != null) us.comment = f.c; if (f.d) us.home = f.d;
    if (f.L) m.passwords[us.name] = m.passwords[us.name] === "set" ? "locked-set" : "locked";
    if (f.U && m.passwords[us.name] === "locked-set") m.passwords[us.name] = "set";
    return 0;
  };
  CMDS.userdel = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "userdel", flags: "rf", badCode: 2, long: { remove: "r", force: "f" } });
    if (!rest.length) throw new ShellError("Usage: userdel [options] LOGIN", 2);
    needRoot(m, "userdel");
    const us = userByName(m, rest[0]); if (!us) throw new ShellError("userdel: user '" + rest[0] + "' does not exist", 6);
    if (us.uid === m.uid || us.name === "student") throw new ShellError("userdel: user " + us.name + " is currently used by process 1234", 8);
    m.users = m.users.filter(x => x !== us); m.groups.forEach(x => { x.members = x.members.filter(n => n !== us.name); });
    const own = groupById(m, us.gid); if (own && own.name === us.name && !m.users.some(x => x.gid === own.gid)) m.groups = m.groups.filter(x => x !== own);
    delete m.passwords[us.name];
    if (f.r) { const r = tryResolve(m, us.home); if (r.ino != null) { const pd = node(m, r.parent); pd.entries.delete(r.name); pd.nlink--; removeTree(m, r.ino); } else io.err("userdel: " + us.home + " home directory (" + us.home + ") not found\n"); }
    return 0;
  };
  CMDS.groupadd = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "groupadd", flags: "g:rf", badCode: 2, long: { gid: "g" } });
    if (!rest.length) throw new ShellError("Usage: groupadd [options] GROUP", 2);
    needRoot(m, "groupadd");
    if (groupByName(m, rest[0])) { if (f.f) return 0; throw new ShellError("groupadd: group '" + rest[0] + "' already exists", 9); }
    const gid = f.g ? +f.g : (() => { let n = 1001; while (m.groups.some(x => x.gid === n) || m.users.some(x => x.uid === n)) n++; return n; })();
    if (m.groups.some(x => x.gid === gid)) throw new ShellError("groupadd: GID '" + gid + "' already exists", 4);
    m.groups.push(g(rest[0], gid)); return 0;
  };
  CMDS.groupdel = (m, args) => { needRoot(m, "groupdel"); const x = groupByName(m, args[0]); if (!x) throw new ShellError("groupdel: group '" + args[0] + "' does not exist", 6); m.groups = m.groups.filter(y => y !== x); };
  CMDS.passwd = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "passwd", flags: "ludeSa", long: { lock: "l", unlock: "u", status: "S", delete: "d", expire: "e", all: "a" } });
    const me = userById(m, m.uid); const name = rest[0] || me.name; const us = userByName(m, name);
    if (!us) throw new ShellError("passwd: user '" + name + "' does not exist", 1);
    if (us !== me && m.uid !== 0) throw new ShellError("passwd: You may not view or modify password information for " + name + ".", 1);
    const inf = m.userInfo[name] = m.userInfo[name] || {};
    if (f.S) {
      if (us !== me && m.uid !== 0) throw new ShellError("passwd: Permission denied.", 1);
      const list = f.a ? m.users : [us];
      list.forEach(x => { const pw = m.passwords[x.name] || "none"; const i2 = m.userInfo[x.name] || {};
        io.out(x.name + " " + ({ set: "P", "locked-set": "L", locked: "L", empty: "NP", none: "L" }[pw]) + " " + (i2.forceChange ? "01/01/1970" : "10/16/2026") + " 0 99999 7 " + (i2.inactive != null ? i2.inactive : -1) + "\n"); });
      return 0;
    }
    if (f.d || f.e) { if (m.uid !== 0) throw new ShellError("passwd: Permission denied.", 1);
      if (f.d) m.passwords[name] = "empty"; if (f.e) inf.forceChange = true;
      io.out("passwd: password changed.\n"); return 0; }
    if (f.l || f.u) { if (m.uid !== 0) throw new ShellError("passwd: Permission denied.", 1);
      if (f.l) m.passwords[name] = m.passwords[name] === "set" ? "locked-set" : "locked"; else if (m.passwords[name] === "locked-set") m.passwords[name] = "set";
      io.out("passwd: password changed.\n"); return 0; }
    m.passwords[name] = "set"; inf.forceChange = false; inf.lastchg = 20377;
    io.out((us === me && m.uid !== 0 ? "Changing password for " + name + ".\nCurrent password: \n" : "") + "New password: \nRetype new password: \npasswd: password updated successfully\n(lab: passwords aren't typed in the lab, so it was set for you)\n"); return 0;
  };
  CMDS.chage = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "chage", flags: "lE:M:m:W:I:d:", long: { list: "l", expiredate: "E", maxdays: "M", mindays: "m", warndays: "W", inactive: "I", lastday: "d" } });
    const name = rest[0]; if (!name || !userByName(m, name)) throw new ShellError("chage: user '" + name + "' does not exist in /etc/passwd", 1);
    const inf = m.userInfo[name] = m.userInfo[name] || {};
    if (!f.l) { if (m.uid !== 0) throw new ShellError("chage: Permission denied.", 1);
      if (f.E != null) inf.expire = f.E === "-1" ? null : Math.round(Date.parse(f.E) / 86400000); if (f.I != null) inf.inactive = f.I === "-1" ? null : +f.I;
      if (f.M != null) inf.max = +f.M; if (f.m != null) inf.min = +f.m; if (f.W != null) inf.warn = +f.W; if (f.d != null) inf.forceChange = f.d === "0"; return 0; }
    if (m.uid !== 0 && userById(m, m.uid).name !== name) throw new ShellError("chage: Permission denied.", 1);
    const day = d => { const x = new Date(d * 86400000); return MONTHS[x.getUTCMonth()] + " " + String(x.getUTCDate()).padStart(2, "0") + ", " + x.getUTCFullYear(); };
    io.out("Last password change\t\t\t\t\t: " + (inf.forceChange ? "password must be changed" : day(inf.lastchg || 20371)) + "\nPassword expires\t\t\t\t\t: never\nPassword inactive\t\t\t\t\t: never\nAccount expires\t\t\t\t\t\t: " + (inf.expire != null ? day(inf.expire) : "never") +
      "\nMinimum number of days between password change\t\t: " + (inf.min || 0) + "\nMaximum number of days between password change\t\t: " + (inf.max != null ? inf.max : 99999) + "\nNumber of days of warning before password expires\t: " + (inf.warn != null ? inf.warn : 7) + "\n"); };
  CMDS.chsh = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "chsh", flags: "s:l", long: { shell: "s", "list-shells": "l" } });
    const shells = lines(asRoot(m, () => readFile(m, "/etc/shells", "chsh"))).filter(l => l && !l.startsWith("#"));
    if (f.l) { io.out(joinLines(shells)); return 0; }
    const me = userById(m, m.uid); const name = rest[0] || me.name; const us = userByName(m, name);
    if (!us) throw new ShellError("chsh: user '" + name + "' does not exist", 1);
    if (us !== me && m.uid !== 0) throw new ShellError("chsh: You may not change the shell for '" + name + "'.", 1);
    if (m.uid !== 0) io.out("Password: \n");
    if (f.s == null) { io.out("Changing the login shell for " + name + "\nEnter the new value, or press ENTER for the default\n\tLogin Shell [" + us.shell + "]: \n(lab: give the new shell with -s, for example: chsh -s /bin/sh)\n"); return 0; }
    if (!f.s.startsWith("/")) throw new ShellError("chsh: " + f.s + " is an invalid shell", 1);
    if (!shells.includes(f.s) && m.uid !== 0) throw new ShellError("chsh: " + f.s + " is an invalid shell", 1);
    us.shell = f.s; return 0;
  };
  CMDS.chfn = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "chfn", flags: "f:r:w:h:o:", long: { "full-name": "f", room: "r", "work-phone": "w", "home-phone": "h" } });
    const me = userById(m, m.uid); const name = rest[0] || me.name; const us = userByName(m, name);
    if (!us) throw new ShellError("chfn: user '" + name + "' does not exist", 1);
    if (us !== me && m.uid !== 0) throw new ShellError("chfn: you may not change the user information for " + name + ".", 1);
    const parts = (us.comment || "").split(","); while (parts.length < 4) parts.push("");
    if (f.f == null && f.r == null && f.w == null && f.h == null) { io.out("Changing the user information for " + name + "\nEnter the new value, or press ENTER for the default\n\tFull Name: " + parts[0] + "\n\tRoom Number [" + parts[1] + "]: \n\tWork Phone [" + parts[2] + "]: \n\tHome Phone [" + parts[3] + "]: \n(lab: pass the fields as options instead, for example: chfn -f 'Ada Lovelace' -r 101)\n"); return 0; }
    if (m.uid !== 0) io.out("Password: \n");
    if (f.f != null) parts[0] = f.f; if (f.r != null) parts[1] = f.r; if (f.w != null) parts[2] = f.w; if (f.h != null) parts[3] = f.h;
    if (parts.some(x => /[,:=]/.test(x))) throw new ShellError("chfn: invalid characters in a field", 1);
    us.comment = parts.join(","); return 0;
  };
  CMDS.groupmems = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "groupmems", flags: "g:a:d:lp", long: { group: "g", add: "a", delete: "d", list: "l", purge: "p" } });
    const me = userById(m, m.uid);
    const gname = f.g || (groupById(m, me.gid) || {}).name; const gr = groupByName(m, gname);
    if (!gr) throw new ShellError("groupmems: group '" + gname + "' does not exist in /etc/group", 6);
    if (m.uid !== 0) throw new ShellError("groupmems: Permission denied.", 1);
    if (f.l) { io.out(gr.members.join(" ") + (gr.members.length ? " " : "") + "\n"); return 0; }
    if (f.a) { if (!userByName(m, f.a)) throw new ShellError("groupmems: user '" + f.a + "' does not exist", 6); if (gr.members.includes(f.a)) throw new ShellError("groupmems: user '" + f.a + "' is already a member of '" + gr.name + "'", 7); gr.members.push(f.a); return 0; }
    if (f.d) { if (!gr.members.includes(f.d)) throw new ShellError("groupmems: user '" + f.d + "' is not a member of '" + gr.name + "'", 8); gr.members = gr.members.filter(x => x !== f.d); return 0; }
    if (f.p) { gr.members = []; return 0; }
    throw new ShellError("Usage: groupmems [options] [action]", 2);
  };
  CMDS.lastb = (m, args, io) => { if (m.uid !== 0) { io.err("lastb: /var/log/btmp: Permission denied\n"); return 1; }
    io.out("root     ssh:notty    203.0.113.7      Sat Oct 10 09:12 - 09:12  (00:00)\nadmin    ssh:notty    203.0.113.7      Sat Oct 10 09:11 - 09:11  (00:00)\nstudent  tty2                          Fri Oct  9 07:58 - 07:58  (00:00)\n\nbtmp begins Mon Oct  5 07:00:00 2026\n"); };
  CMDS.sudo = (m, args, io, ctx) => {
    const me = userById(m, m.uid);
    if (m.uid !== 0 && !gidsOf(m, m.uid).some(x => [...m.sudoers].includes((groupById(m, x) || {}).name))) { io.err(me.name + " is not in the sudoers file.\n"); return 1; }
    if (!args.length) { io.err("usage: sudo -h | -K | -k | -V\nusage: sudo [-u user] command\n"); return 1; }
    if (args[0] === "-l") { io.out("User " + me.name + " may run the following commands on " + m.hostname + ":\n    (ALL : ALL) ALL\n"); return 0; }
    let target = userById(m, 0); let rest = args;
    if (args[0] === "-u") { target = userByName(m, args[1]); rest = args.slice(2); if (!target) { io.err("sudo: unknown user " + args[1] + "\n"); return 1; } }
    if (rest[0] === "-i" || rest[0] === "-s" || rest[0] === "su") { switchUser(m, target, true); if (rest[0] === "-i" || rest[1] === "-") { m.cwd = target.home; m.env.PWD = m.cwd; } return 0; }
    const saved = { uid: m.uid, env: Object.assign({}, m.env) };
    m.uid = target.uid; Object.assign(m.env, { USER: target.name, HOME: target.home, LOGNAME: target.name });
    try { return dispatch(m, rest, io, ctx); } finally { m.uid = saved.uid; m.env = saved.env; }
  };
  CMDS.su = (m, args, io) => {
    const login = args.includes("-") || args.includes("-l") || args.includes("--login");
    const ci = args.indexOf("-c"); const name = args.filter((a, i) => !a.startsWith("-") && i !== ci + 1)[0] || "root";
    const target = userByName(m, name); if (!target) { io.err("su: user " + name + " does not exist or the user entry does not contain all the required fields\n"); return 1; }
    if (m.uid !== 0) {
      if (m.passwords[name] !== "set") { io.err("Password: \nsu: Authentication failure\n(lab: " + name + " has no usable password here; use sudo instead, for example: sudo -i)\n"); return 1; }
      io.out("Password: \n");
    }
    if (target.shell.endsWith("nologin")) { io.out("This account is currently not available.\n"); return 1; }
    if (ci >= 0) { const saved = { uid: m.uid, env: Object.assign({}, m.env) }; m.uid = target.uid; try { const sub = { out: "", interactive: false }; runList(m, parse(lex(args[ci + 1] || "")), sub, { stdin: "" }); io.out(sub.out); return m.last; } finally { m.uid = saved.uid; m.env = saved.env; } }
    switchUser(m, target, true); if (login) { m.cwd = target.home; m.env.PWD = m.cwd; } return 0;
  };
  CMDS.who = (m, args, io) => { io.out("student  tty2         2026-10-10 08:01\n" + (m.stack.length ? "" : "") + "student  pts/0        2026-10-10 09:15 (192.168.1.20)\n"); };
  CMDS.w = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "w", flags: "hisfu", long: { "no-header": "h", ip: "i", short: "s", from: "f" } });
    const rows = [["student", "tty2", "-", "08:01", "1:29m", "0.10s", "0.05s", "-bash"], ["student", "pts/0", f.i ? "192.168.1.20" : "laptop.lan", "09:15", "0.00s", "0.02s", "0.00s", "w" + (args.length ? " " + args.join(" ") : "")]]
      .filter(r => !rest.length || r[0] === rest[0]);
    let out = f.h ? "" : " 09:30:00 up 2 days,  3:12,  2 users,  load average: 0.08, 0.05, 0.01\n" + (f.s ? "USER     TTY      FROM              IDLE WHAT\n" : "USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT\n");
    rows.forEach(r => { out += f.s ? pad(r[0], 9, true) + pad(r[1], 9, true) + pad(r[2], 16, true) + pad(r[4], 6) + " " + r[7] + "\n" : pad(r[0], 9, true) + pad(r[1], 9, true) + pad(r[2], 17, true) + pad(r[3], 9, true) + pad(r[4], 6, true) + " " + pad(r[5], 6, true) + " " + pad(r[6], 6, true) + r[7] + "\n"; });
    io.out(out); };
  CMDS.last = (m, args, io) => { const who = args[0]; const rows = ["student  pts/0        192.168.1.20     Sat Oct 10 09:15   still logged in", "student  tty2         -                Sat Oct 10 08:01   still logged in", "reboot   system boot  6.8.0-45-generic Thu Oct  8 06:18   still running", "student  pts/0        192.168.1.20     Wed Oct  7 17:02 - 18:40  (01:38)"];
    io.out(rows.filter(r => !who || r.startsWith(who + " ")).join("\n") + (rows.some(r => !who || r.startsWith(who + " ")) ? "\n" : "") + "\nwtmp begins Mon Oct  5 07:00:00 2026\n"); };

  // ---------------------------------------------------------------- archives and compression
  function packTree(m, path, ino, out, verbose, io) {
    const n = node(m, ino);
    if (!can(m, n, 4)) { io.err("tar: " + path + ": Cannot open: Permission denied\n"); return; }
    out.push({ path: path + (n.type === "dir" ? "/" : ""), type: n.type, mode: n.mode, data: n.data, target: n.target, blob: n.blob });
    if (verbose) io.out(path + (n.type === "dir" ? "/" : "") + "\n");
    if (n.type === "dir") [...n.entries.keys()].sort(cmpC).forEach(k => packTree(m, path + "/" + k, n.entries.get(k), out, verbose, io));
  }
  function unwrap(blob) { const layers = []; while (blob && blob.kind !== "tar" && blob.kind !== "zip" && blob.inner) { layers.push(blob.kind); blob = blob.inner.blob; } return { layers, blob }; }
  CMDS.tar = (m, args, io) => {
    if (args.length && /^[a-zA-Z]+$/.test(args[0]) && !args[0].startsWith("-")) args = ["-" + args[0]].concat(args.slice(1));
    const wildcards = args.includes("--wildcards"); args = args.filter(a => a !== "--wildcards" && a !== "--no-wildcards");
    const { flags: f, rest } = parseOpts(args, { name: "tar", flags: "cxtvf:zjJC:pruPka", badCode: 2, long: { create: "c", extract: "x", list: "t", verbose: "v", file: "f", gzip: "z", bzip2: "j", xz: "J", directory: "C", append: "r", update: "u", "absolute-names": "P", "keep-old-files": "k", "auto-compress": "a" } });
    if (f.a && f.c && f.f && !f.z && !f.j && !f.J) { if (/\.(tgz|tar\.gz)$/.test(f.f)) f.z = true; else if (/\.(tbz2?|tar\.bz2)$/.test(f.f)) f.j = true; else if (/\.(txz|tar\.xz)$/.test(f.f)) f.J = true; }
    const modes = ["c", "x", "t", "r", "u"].filter(k => f[k]);
    if (modes.length !== 1) throw new ShellError("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.", 2);
    const comp = f.z ? "gzip" : f.j ? "bzip2" : f.J ? "xz" : null;
    const file = f.f;
    if (!file) throw new ShellError("tar: Refusing to read archive contents from terminal (missing -f option?)\ntar: Error is not recoverable: exiting now", 2);
    if (f.c) {
      if (!rest.length) throw new ShellError("tar: Cowardly refusing to create an empty archive\nTry 'tar --help' or 'tar --usage' for more information.", 2);
      const entries = []; let stripped = false;
      for (const p of rest) {
        const r = tryResolve(m, p, { follow: false });
        if (r.ino == null) { io.err("tar: " + p + ": Cannot stat: No such file or directory\n"); continue; }
        let rel = p.replace(/\/+$/, ""); if (rel.startsWith("/") && !f.P) { rel = rel.replace(/^\/+/, ""); stripped = true; }
        packTree(m, rel, r.ino, entries, f.v, io);
      }
      if (stripped) io.err("tar: Removing leading `/' from member names\n");
      let blob = { kind: "tar", entries };
      if (comp) blob = { kind: comp, inner: { data: "", blob } };
      const res = editorSave(m, file, ""); if (!res.ok) throw new ShellError("tar: " + file + ": Cannot open: " + res.error.split(": ").pop() + "\ntar: Error is not recoverable: exiting now", 2);
      node(m, resolve(m, file).ino).blob = blob;
      return entries.length || !rest.length ? 0 : 2;
    }
    let r; try { r = resolve(m, file); } catch (e) { r = { ino: null }; }
    if (r.ino == null && (f.r || f.u)) { f.c = true; return CMDS.tar(m, args.map(a => a === "-r" || a === "-u" ? "-c" : a.replace(/^-([a-zA-Z]*)[ru]([a-zA-Z]*)$/, "-$1c$2")), io); }
    if (r.ino == null) throw new ShellError("tar: " + file + ": Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now", 2);
    const an = node(m, r.ino);
    if (f.r || f.u) {          // append (-r) or update (-u): only works on an uncompressed archive
      if (comp || (an.blob && an.blob.kind !== "tar")) throw new ShellError("tar: Cannot update compressed archives\nTry 'tar --help' or 'tar --usage' for more information.", 2);
      if (!can(m, an, 2)) throw new ShellError("tar: " + file + ": Cannot open: Permission denied\ntar: Error is not recoverable: exiting now", 2);
      const blob = an.blob || { kind: "tar", entries: [] };
      for (const p of rest) { const rr = tryResolve(m, p, { follow: false }); if (rr.ino == null) { io.err("tar: " + p + ": Cannot stat: No such file or directory\n"); continue; }
        const rel = f.P ? p.replace(/\/+$/, "") : p.replace(/\/+$/, "").replace(/^\/+/, ""); const add = []; packTree(m, rel, rr.ino, add, f.v, io);
        if (f.u) { for (const e of add) { const old = blob.entries.filter(x => x.path === e.path); if (old.length && old[old.length - 1].data === e.data && old[old.length - 1].mode === e.mode) continue; blob.entries.push(e); } }
        else blob.entries.push(...add); }
      an.blob = blob; an.mtime = m.now; return 0;
    }
    if (!can(m, an, 4)) throw new ShellError("tar: " + file + ": Cannot open: Permission denied\ntar: Error is not recoverable: exiting now", 2);
    const { layers, blob } = unwrap(an.blob);
    const want = rest.map(p => p.replace(/\/+$/, ""));
    const wmatch = (path, w) => wildcards && /[*?[]/.test(w) ? new RegExp(globToRe(w).source.replace(/\[\^\/\]/g, ".")).test(path) : path === w || path.startsWith(w + "/");
    if (comp && layers[0] !== comp) throw new ShellError((comp === "gzip" ? "gzip: stdin: not in gzip format" : comp === "bzip2" ? "bzip2: (stdin) is not a bzip2 file." : "xz: (stdin): File format not recognized") + "\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now", 2);
    if (!blob || blob.kind !== "tar") throw new ShellError("tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors", 2);
    if (f.t) { blob.entries.filter(e => !want.length || want.some(w => wmatch(e.path.replace(/\/$/, ""), w))).forEach(e => io.out(f.v ? modeString({ type: e.type, mode: e.mode }) + " student/student " + pad(e.type === "dir" ? 0 : bytes(e.data || ""), 6) + " 2026-10-10 09:00 " + e.path + "\n" : e.path + "\n"));
      for (const w of want) if (!blob.entries.some(e => wmatch(e.path.replace(/\/$/, ""), w))) { io.err("tar: " + w + ": Not found in archive" + (/[*?[]/.test(w) && !wildcards ? "\n(lab: tar matches names literally; add --wildcards to use * and ?)" : "") + "\ntar: Exiting with failure status due to previous errors\n"); return 2; }
      return 0; }
    const base = f.C ? normPath(m, f.C) : m.cwd;
    const br = tryResolve(m, base); if (br.ino == null) throw new ShellError("tar: " + f.C + ": Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now", 2);
    const us = userById(m, m.uid);
    for (const e of blob.entries) {
      const path = e.path.replace(/\/$/, "");
      if (want.length && !want.some(w => wmatch(path, w))) continue;
      if (f.v) io.out(e.path + "\n");
      const full = (base === "/" ? "" : base) + "/" + path;
      if (e.type === "dir") { const ino = mkdirPerm(m, full, io); if (ino) node(m, ino).mode = e.mode; continue; }
      mkdirPerm(m, dirname(full), io);
      const res = editorSave(m, full, e.data || ""); if (!res.ok) { io.err("tar: " + path + ": Cannot open: Permission denied\n"); continue; }
      const nn = node(m, resolve(m, full).ino); nn.mode = e.mode; nn.blob = e.blob || null; if (e.type === "link") { nn.type = "link"; nn.target = e.target; }
      nn.uid = us.uid; nn.gid = us.gid;
    }
    for (const w of want) if (!blob.entries.some(e => wmatch(e.path.replace(/\/$/, ""), w))) { io.err("tar: " + w + ": Not found in archive" + (/[*?[]/.test(w) && !wildcards ? "\n(lab: tar matches names literally; add --wildcards to use * and ?)" : "") + "\ntar: Exiting with failure status due to previous errors\n"); return 2; }
    return 0;
  };
  function mkdirPerm(m, full, io) {
    const parts = full.split("/").filter(Boolean); let cur = m.rootIno; const us = userById(m, m.uid);
    for (const part of parts) { const d = node(m, cur); let next = d.entries.get(part);
      if (next == null) { if (!can(m, d, 3)) { io.err("tar: " + full + ": Cannot mkdir: Permission denied\n"); return null; } next = mkInode(m, "dir", 0o755, us.uid, us.gid); d.entries.set(part, next); d.nlink++; }
      cur = next; }
    return cur;
  }
  const EXT = { gzip: ".gz", bzip2: ".bz2", xz: ".xz" };
  function compressor(kind, prog) {
    return (m, args, io) => {
      const { flags: f, rest } = parseOpts(args, { name: prog, digitFlags: true, flags: "dkcfvqr0123456789zt", num: false, long: { decompress: "d", keep: "k", stdout: "c", force: "f", recursive: "r" } });
      const decomp = f.d || /^(gunzip|bunzip2|unxz|zcat|bzcat|xzcat)$/.test(prog);
      const toStdout = f.c || /cat$/.test(prog);
      let code = 0;
      const one = p => {
        let r; try { r = resolve(m, p); } catch (e) { io.err(prog + ": " + p + ": " + e.message + "\n"); return 1; }
        if (r.ino == null) { io.err(prog + ": " + p + ": No such file or directory\n"); return 1; }
        const n = node(m, r.ino);
        if (n.type === "dir") { if (f.r) { let c2 = 0; for (const k of [...n.entries.keys()]) { const res = one(p.replace(/\/$/, "") + "/" + k); if (res) c2 = res; } return c2; } io.err(prog + ": " + p + " is a directory -- ignored\n"); return 2; }
        if (!can(m, n, 4)) { io.err(prog + ": " + p + ": Permission denied\n"); return 1; }
        if (f.t) { if (!n.blob || n.blob.kind !== kind) { io.err(prog + ": " + p + ": not in " + kind + " format\n"); return 1; } return 0; }
        if (decomp) {
          if (!n.blob || n.blob.kind !== kind) { io.err(kind === "gzip" ? prog + ": " + p + ": not in gzip format\n" : kind === "bzip2" ? prog + ": " + p + " is not a bzip2 file.\n" : prog + ": " + p + ": File format not recognized\n"); return 1; }
          const inner = n.blob.inner;
          if (toStdout) { io.out(inner.blob ? binaryText(inner.blob) : inner.data); return 0; }
          if (!p.endsWith(EXT[kind])) { io.err(prog + ": " + p + ": unknown suffix -- ignored\n"); return 2; }
          const outPath = p.slice(0, -EXT[kind].length);
          const res = editorSave(m, outPath, inner.data); if (!res.ok) { io.err(prog + ": " + outPath + ": Permission denied\n"); return 1; }
          const on = node(m, resolve(m, outPath).ino); on.blob = inner.blob || null; on.mode = n.mode;
          if (!f.k) unlinkPath(m, p);
          return 0;
        }
        if (n.blob && n.blob.kind === kind) { io.err(prog + ": " + p + " already has " + EXT[kind] + " suffix -- unchanged\n"); return 2; }
        const blob = { kind, inner: { data: n.data, blob: n.blob } };
        if (toStdout) { io.out(binaryText(blob)); return 0; }
        const outPath = p + EXT[kind];
        if (tryResolve(m, outPath).ino != null && !f.f) { io.err(prog + ": " + outPath + " already exists; not overwritten\n"); return 2; }
        const res = editorSave(m, outPath, ""); if (!res.ok) { io.err(prog + ": " + outPath + ": Permission denied\n"); return 1; }
        const on = node(m, resolve(m, outPath).ino); on.blob = blob; on.mode = n.mode;
        if (!f.k) unlinkPath(m, p);
        return 0;
      };
      if (!rest.length) { if (toStdout && decomp) { io.out(io.stdin); return 0; } io.err(prog + ": compressed data not written to a terminal. Use -f to force compression.\n"); return 1; }
      for (const p of rest) { const res = one(p); if (res) code = Math.max(code, res); }
      return code;
    };
  }
  function unlinkPath(m, p) { const r = tryResolve(m, p, { follow: false }); if (r.ino == null) return; node(m, r.parent).entries.delete(r.name); releaseInode(m, r.ino); }
  [["gzip", "gzip"], ["gunzip", "gzip"], ["zcat", "gzip"], ["bzip2", "bzip2"], ["bunzip2", "bzip2"], ["bzcat", "bzip2"], ["xz", "xz"], ["unxz", "xz"], ["xzcat", "xz"]]
    .forEach(([prog, kind]) => { CMDS[prog] = compressor(kind, prog); });
  CMDS.zip = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "zip", digitFlags: true, flags: "rq0123456789um", long: { recurse: "r", quiet: "q" } });
    if (rest.length < 2) throw new ShellError("zip error: Nothing to do! (" + (rest[0] || "") + ")", 12);
    let file = rest[0]; if (!/\.zip$/.test(file)) file += ".zip";
    const entries = [];
    for (const p of rest.slice(1)) {
      const r = tryResolve(m, p); if (r.ino == null) { io.err("\tzip warning: name not matched: " + p + "\n"); continue; }
      const add = (path, ino) => { const n = node(m, ino); entries.push({ path: path + (n.type === "dir" ? "/" : ""), type: n.type, mode: n.mode, data: n.data, blob: n.blob });
        if (!f.q) io.out("  adding: " + path + (n.type === "dir" ? "/ (stored 0%)" : n.data && !f[0] ? " (deflated " + (f[9] ? 38 : f[1] ? 24 : 32) + "%)" : " (stored 0%)") + "\n");
        if (n.type === "dir" && f.r) [...n.entries.keys()].sort(cmpC).forEach(k => add(path.replace(/\/$/, "") + "/" + k, n.entries.get(k))); };
      add(p.replace(/\/$/, ""), r.ino);
    }
    if (!entries.length) throw new ShellError("\nzip error: Nothing to do! (" + file + ")", 12);
    const res = editorSave(m, file, ""); if (!res.ok) throw new ShellError("zip I/O error: Permission denied\nzip error: Could not create output file (" + file + ")", 15);
    node(m, resolve(m, file).ino).blob = { kind: "zip", entries };
  };
  CMDS.unzip = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "unzip", flags: "lqod:", long: {} });
    const file = rest[0]; if (!file) throw new ShellError("UnZip 6.00 of 20 April 2009. Usage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]", 10);
    const r = tryResolve(m, file); if (r.ino == null) throw new ShellError("unzip:  cannot find or open " + file + ", " + file + ".zip or " + file + ".ZIP.", 9);
    const n = node(m, r.ino); if (!n.blob || n.blob.kind !== "zip") throw new ShellError("  End-of-central-directory signature not found.  Either this file is not\n  a zipfile, or it constitutes one disk of a multi-part archive.", 9);
    if (f.l) { io.out("Archive:  " + file + "\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n"); let total = 0; n.blob.entries.forEach(e => { const len = e.type === "dir" ? 0 : bytes(e.data || ""); total += len; io.out(pad(len, 9) + "  2026-10-10 09:00   " + e.path + "\n"); }); io.out("---------                     -------\n" + pad(total, 9) + "                     " + n.blob.entries.length + " file" + (n.blob.entries.length === 1 ? "" : "s") + "\n"); return 0; }
    if (!f.q) io.out("Archive:  " + file + "\n");
    const base = f.d ? normPath(m, f.d) : m.cwd; const us = userById(m, m.uid);
    for (const e of n.blob.entries) {
      const path = e.path.replace(/\/$/, ""); const full = (base === "/" ? "" : base) + "/" + path;
      if (e.type === "dir") { mkdirPerm(m, full, io); if (!f.q) io.out("   creating: " + (f.d ? f.d.replace(/\/$/, "") + "/" : "") + e.path + "\n"); continue; }
      mkdirPerm(m, dirname(full), io);
      const res = editorSave(m, full, e.data || ""); if (!res.ok) { io.err("error:  cannot create " + path + "\n        Permission denied\n"); continue; }
      const nn = node(m, resolve(m, full).ino); nn.mode = e.mode & 0o777; nn.blob = e.blob || null; nn.uid = us.uid; nn.gid = us.gid;
      if (!f.q) io.out("  inflating: " + (f.d ? f.d.replace(/\/$/, "") + "/" : "") + path + "\n");
    }
  };

  // ---------------------------------------------------------------- system information (canned but consistent)
  CMDS.date = (m, args, io) => {
    let utc = false, fmt = null, i = 0;
    for (; i < args.length; i++) { const a = args[i]; if (a === "-u" || a === "--utc" || a === "--universal") utc = true; else if (a.startsWith("+")) fmt = a.slice(1); else if (a === "-R") fmt = "%a, %d %b %Y %H:%M:%S %z"; else if (a === "-I" || a === "--iso-8601") fmt = "%F"; else if (a === "-d" || a === "--date") { i++; } else { io.err("date: invalid date " + cq(a) + "\n"); return 1; } }
    const tzName = utc ? "UTC" : (m.env.TZ || "UTC"); const z = ZONES[tzName] || (/^[A-Z]{3,4}$/.test(tzName) ? [0, tzName] : [0, "UTC"]);
    const d = new Date(m.now + z[0] * 60000); const two = x => String(x).padStart(2, "0");
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], FULLM = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const off = (z[0] < 0 ? "-" : "+") + two(Math.floor(Math.abs(z[0]) / 60)) + two(Math.abs(z[0]) % 60);
    const map = { Y: d.getUTCFullYear(), m: two(d.getUTCMonth() + 1), d: two(d.getUTCDate()), e: pad(d.getUTCDate(), 2), H: two(d.getUTCHours()), M: two(d.getUTCMinutes()), S: two(d.getUTCSeconds()),
      a: DAYS[d.getUTCDay()].slice(0, 3), A: DAYS[d.getUTCDay()], b: MONTHS[d.getUTCMonth()], B: FULLM[d.getUTCMonth()], Z: z[1], z: off, s: Math.floor(m.now / 1000), j: String(Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1).padStart(3, "0"), "%": "%", n: "\n", t: "\t" };
    map.F = map.Y + "-" + map.m + "-" + map.d; map.T = map.H + ":" + map.M + ":" + map.S; map.D = map.m + "/" + map.d + "/" + String(map.Y).slice(2); map.R = map.H + ":" + map.M;
    const out = (fmt != null ? fmt : "%a %b %e %T %Z %Y").replace(/%([a-zA-Z%])/g, (_, k) => map[k] != null ? String(map[k]) : "%" + k);
    io.out(out + "\n");
  };
  // ---------------------------------------------------------------- packages: apt/dpkg on the Ubuntu lab system, dnf/yum/rpm on the Fedora one
  const PKGS = {
    debian: {
      figlet: { ver: "2.2.5-3", arch: "amd64", desc: "Make large character ASCII banners out of ordinary text", bins: ["figlet"], size: "163 kB" },
      cowsay: { ver: "3.03+dfsg2-8", arch: "all", desc: "configurable talking cow", bins: ["cowsay"], size: "18.6 kB" },
      sl: { ver: "5.02-1", arch: "amd64", desc: "Corrects you if you type sl by mistake", bins: ["sl"], size: "12.7 kB" },
      htop: { ver: "3.3.0-4build1", arch: "amd64", desc: "interactive processes viewer", bins: ["htop"], size: "171 kB" },
      nmap: { ver: "7.94+git20230807.3be01efb1+dfsg-3build2", arch: "amd64", desc: "The Network Mapper", bins: ["nmap"], size: "1,694 kB" },
      blender: { ver: "4.0.2+dfsg-1ubuntu8", arch: "amd64", desc: "Very fast and versatile 3D modeller/renderer", bins: ["blender"], size: "94.2 MB", deps: ["blender-data", "libopenimageio2.4t64", "libopenvdb10.0t64", "python3-numpy"] },
      cups: { ver: "2.4.7-1.2ubuntu7.3", arch: "amd64", desc: "Common UNIX Printing System(tm) - PPD/driver support, web interface", bins: [], conf: "/etc/cups", installed: true, size: "283 kB" },
      tree: { ver: "2.1.1-2ubuntu3", arch: "amd64", desc: "displays an indented directory tree, in color", bins: ["tree"], installed: true },
      "openssh-server": { ver: "1:9.6p1-3ubuntu13.5", arch: "amd64", desc: "secure shell (SSH) server, for secure access from remote machines", bins: [], installed: true },
      nano: { ver: "7.2-2build1", arch: "amd64", desc: "small, friendly text editor inspired by Pico", bins: [], installed: true },
      bash: { ver: "5.2.21-2ubuntu4", arch: "amd64", desc: "GNU Bourne Again SHell", bins: [], installed: true },
      coreutils: { ver: "9.4-3ubuntu6", arch: "amd64", desc: "GNU core utilities", bins: [], installed: true },
    },
    fedora: {
      figlet: { ver: "2.2.5-30.fc41", arch: "x86_64", desc: "A program for making large letters out of ordinary text", bins: ["figlet"], size: "248 k" },
      cowsay: { ver: "3.8.4-1.fc41", arch: "noarch", desc: "Configurable speaking/thinking cow", bins: ["cowsay"], size: "44 k" },
      htop: { ver: "3.3.0-4.fc41", arch: "x86_64", desc: "Interactive process viewer", bins: ["htop"], size: "200 k" },
      nmap: { ver: "4:7.92-3.fc41", arch: "x86_64", desc: "Network exploration tool and security scanner", bins: ["nmap"], size: "5.6 M" },
      cups: { ver: "1:2.4.11-1.fc41", arch: "x86_64", desc: "CUPS printing system", bins: [], conf: "/etc/cups", installed: true, size: "1.5 M" },
      tree: { ver: "2.1.1-6.fc41", arch: "x86_64", desc: "File system tree viewer", bins: ["tree"], installed: true },
      bash: { ver: "5.2.32-1.fc41", arch: "x86_64", desc: "The GNU Bourne Again shell", bins: [], installed: true },
    },
  };
  const pkgDB = m => PKGS[m.distro === "fedora" ? "fedora" : "debian"];
  function pkgInstall(m, name, io) {
    const pk = pkgDB(m)[name]; m.pkgs.add(name);
    for (const b of pk.bins || []) { const ino = writeNew(m, "/usr/bin/" + b, "\u007fELF\u0002\u0001\u0001\u0000(compiled program: " + b + ")", 0o755, 0, 0); node(m, ino).cmd = b; }
    writeNew(m, "/usr/share/doc/" + name + "/copyright", "Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\nUpstream-Name: " + name + "\n", 0o644, 0, 0);
    if (pk.conf && tryResolve(m, pk.conf).ino == null) mkdirP(m, pk.conf, 0o755, 0, 0);
  }
  function pkgRemove(m, name, purge) {
    const pk = pkgDB(m)[name]; m.pkgs.delete(name);
    for (const b of pk.bins || []) unlinkPath(m, "/usr/bin/" + b);
    const doc = tryResolve(m, "/usr/share/doc/" + name); if (doc.ino != null) { node(m, doc.parent).entries.delete(doc.name); node(m, doc.parent).nlink--; removeTree(m, doc.ino); }
    if (purge && pk.conf) { const c = tryResolve(m, pk.conf); if (c.ino != null) { node(m, c.parent).entries.delete(c.name); node(m, c.parent).nlink--; removeTree(m, c.ino); } }
  }
  const searchPkgs = (m, words) => Object.keys(pkgDB(m)).filter(k => words.every(w => (k + " " + pkgDB(m)[k].desc).toLowerCase().includes(w.toLowerCase()))).sort(cmpC);
  function aptLike(prog) { return (m, args, io) => {
    const opts = args.filter(a => a.startsWith("-")); const rest = args.filter(a => !a.startsWith("-")); const sub = rest[0]; const names = rest.slice(1);
    const lock = () => { if (m.uid !== 0) throw new ShellError("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?", 100); };
    const DB = pkgDB(m); const pretty = prog === "apt";
    if (!sub) { io.out(prog + " 2.7.14 (amd64)\nUsage: " + prog + " [options] command\n\nMost used commands:\n  update, search, show, install, remove, purge" + (prog === "apt-cache" ? "" : ", list") + "\n"); return 0; }
    if (prog === "apt-cache" && !["search", "show", "policy"].includes(sub)) { io.err("E: Invalid operation " + sub + "\n"); return 100; }
    if (sub === "update") { lock(); io.out("Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nHit:2 http://security.ubuntu.com/ubuntu noble-security InRelease\nReading package lists... Done\n" + (pretty ? "Building dependency tree... Done\nReading state information... Done\nAll packages are up to date.\n" : "")); return 0; }
    if (sub === "search") { if (!names.length) { io.err("E: You must give at least one search pattern\n"); return 100; }
      const hits = searchPkgs(m, names);
      if (pretty) io.out("Sorting... Done\nFull Text Search... Done\n" + hits.map(k => k + "/noble " + DB[k].ver + " " + DB[k].arch + (m.pkgs.has(k) ? " [installed]" : "") + "\n  " + DB[k].desc + "\n").join("\n"));
      else io.out(hits.map(k => k + " - " + DB[k].desc + "\n").join("")); return 0; }
    if (sub === "show" || sub === "policy") { let code = 0; for (const n of names) { const pk = DB[n]; if (!pk) { io.err((pretty ? "N: Unable to locate package " : "E: No packages found ") + n + "\n"); code = 100; continue; }
      io.out("Package: " + n + "\nVersion: " + pk.ver + "\nArchitecture: " + pk.arch + "\nInstalled: " + (m.pkgs.has(n) ? "yes" : "no") + "\nDescription: " + pk.desc + "\n\n"); } return code; }
    if (sub === "list") { const inst = opts.includes("--installed"); const ks = Object.keys(DB).filter(k => !inst || m.pkgs.has(k)).filter(k => !names.length || names.some(n => k.includes(n.replace(/\*/g, "")))).sort(cmpC);
      io.out("Listing... Done\n" + ks.map(k => k + "/noble " + DB[k].ver + " " + DB[k].arch + (m.pkgs.has(k) ? " [installed]" : "") + "\n").join("")); return 0; }
    if (sub === "install" || sub === "remove" || sub === "purge" || sub === "autoremove") {
      if (sub === "autoremove") { lock(); io.out("Reading package lists... Done\nBuilding dependency tree... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n"); return 0; }
      if (!names.length) { io.err("E: No packages specified\n"); return 100; }
      lock();
      for (const n of names) if (!DB[n]) { io.out("Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n"); io.err("E: Unable to locate package " + n + "\n"); return 100; }
      let out = "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n";
      if (sub === "install") {
        const todo = names.filter(n => !m.pkgs.has(n)); names.filter(n => m.pkgs.has(n)).forEach(n => { out += n + " is already the newest version (" + DB[n].ver + ").\n"; });
        if (todo.length) { const extra = [].concat(...todo.map(n => DB[n].deps || []));
          if (extra.length) out += "The following additional packages will be installed:\n  " + extra.join(" ") + "\n";
          out += "The following NEW packages will be installed:\n  " + extra.concat(todo).join(" ") + "\n0 upgraded, " + (todo.length + extra.length) + " newly installed, 0 to remove and 0 not upgraded.\nNeed to get " + DB[todo[0]].size + " of archives.\n";
          if (extra.length && !opts.some(o => /^-\w*y|^--yes|^--assume-yes/.test(o))) out += "Do you want to continue? [Y/n] Y\n(lab: answered Y for you; -y skips the question)\n";
          todo.forEach(n => { out += "Get:1 http://archive.ubuntu.com/ubuntu noble/universe " + DB[n].arch + " " + n + " " + DB[n].arch + " " + DB[n].ver + "\nUnpacking " + n + " (" + DB[n].ver + ") ...\nSetting up " + n + " (" + DB[n].ver + ") ...\n"; pkgInstall(m, n, io); });
          out += "Processing triggers for man-db (2.12.0-4build2) ...\n"; }
        else out += "0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n";
      } else {
        const todo = names.filter(n => m.pkgs.has(n) || (sub === "purge" && DB[n].conf));
        names.filter(n => !todo.includes(n)).forEach(n => { out += "Package '" + n + "' is not installed, so not removed\n"; });
        if (todo.length) { out += "The following packages will be REMOVED:\n  " + todo.map(n => n + (sub === "purge" ? "*" : "")).join(" ") + "\n0 upgraded, 0 newly installed, " + todo.length + " to remove and 0 not upgraded.\n";
          todo.forEach(n => { out += "Removing " + n + " (" + DB[n].ver + ") ...\n" + (sub === "purge" && DB[n].conf ? "Purging configuration files for " + n + " (" + DB[n].ver + ") ...\n" : ""); pkgRemove(m, n, sub === "purge"); }); }
        else out += "0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n";
      }
      io.out(out); return 0;
    }
    io.err("E: Invalid operation " + sub + "\n"); return 100;
  }; }
  CMDS.apt = aptLike("apt"); CMDS["apt-get"] = aptLike("apt-get"); CMDS["apt-cache"] = aptLike("apt-cache");
  CMDS.dpkg = (m, args, io) => {
    const DB = pkgDB(m); const op = args[0]; const names = args.slice(1);
    if (op === "-l" || op === "--list") { const ks = Object.keys(DB).filter(k => m.pkgs.has(k) || names.length).filter(k => !names.length || names.some(n => new RegExp("^" + n.replace(/\*/g, ".*") + "$").test(k))).sort(cmpC);
      if (names.length && !ks.length) { io.err("dpkg-query: no packages found matching " + names.join(" ") + "\n"); return 1; }
      io.out("Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n||/ Name           Version                   Architecture Description\n+++-==============-=========================-============-=================================\n" +
        ks.map(k => (m.pkgs.has(k) ? "ii  " : DB[k].conf && tryResolve(m, DB[k].conf).ino != null ? "rc  " : "un  ") + pad(k, 14, true) + " " + pad(DB[k].ver, 25, true) + " " + pad(DB[k].arch, 12, true) + " " + DB[k].desc).join("\n") + "\n"); return 0; }
    if (op === "-L" || op === "-s" || op === "--status" || op === "--listfiles") { const n = names[0]; if (!m.pkgs.has(n)) { io.err("dpkg-query: package '" + n + "' is not installed" + (op === "-L" ? "\nUse dpkg --contents (= dpkg-deb --contents) to list archive files contents." : " and no information is available\nUse dpkg --info (= dpkg-deb --info) to examine archive files.") + "\n"); return 1; }
      if (op === "-L" || op === "--listfiles") io.out(["/.", "/usr", "/usr/bin"].concat((DB[n].bins || []).map(b => "/usr/bin/" + b), ["/usr/share/doc/" + n, "/usr/share/doc/" + n + "/copyright"]).join("\n") + "\n");
      else io.out("Package: " + n + "\nStatus: install ok installed\nVersion: " + DB[n].ver + "\nArchitecture: " + DB[n].arch + "\nDescription: " + DB[n].desc + "\n"); return 0; }
    if (op === "-i" || op === "--install" || op === "-r" || op === "--remove" || op === "-P" || op === "--purge") { if (m.uid !== 0) { io.err("dpkg: error: requested operation requires superuser privilege\n"); return 2; }
      if (op === "-i" || op === "--install") { io.err("dpkg: error: cannot access archive '" + (names[0] || "") + "': No such file or directory\n(lab: dpkg -i installs a downloaded .deb file; to install from the repositories use apt)\n"); return 1; }
      for (const n of names) { if (!DB[n]) { io.err("dpkg: warning: ignoring request to remove " + n + " which isn't installed\n"); continue; } io.out("Removing " + n + " (" + DB[n].ver + ") ...\n"); pkgRemove(m, n, op === "-P" || op === "--purge"); } return 0; }
    io.err("dpkg: error: need an action option\n\nType dpkg --help for help about installing and deinstalling packages [*];\nUse 'apt' or 'aptitude' for user-friendly package management;\n"); return 2;
  };
  function dnfLike(prog) { return (m, args, io, ctx) => {
    const DB = pkgDB(m); const opts = args.filter(a => a.startsWith("-")); const rest = args.filter(a => !a.startsWith("-")); const sub = rest[0]; const names = rest.slice(1);
    const yes = opts.some(o => /^-\w*y|^--assumeyes/.test(o));
    if (!sub) { io.out("usage: " + prog + " [options] COMMAND\n\nList of Main Commands:\n  install, remove, search, info, list\n"); return 1; }
    if (sub === "search") { const hits = searchPkgs(m, names); if (!hits.length) { io.out("No matches found.\n"); return 1; }
      io.out("Updating and loading repositories:\nRepositories loaded.\nMatched fields: name, summary\n" + hits.map(k => " " + k + "." + DB[k].arch + "\t" + DB[k].desc + "\n").join("")); return 0; }
    if (sub === "info") { let code = 0; for (const n of names) { const pk = DB[n]; if (!pk) { io.err("No matching packages to list\n"); code = 1; continue; } io.out((m.pkgs.has(n) ? "Installed packages\n" : "Available packages\n") + "Name         : " + n + "\nVersion      : " + pk.ver.replace(/^\d+:/, "").split("-")[0] + "\nRelease      : " + pk.ver.split("-").pop() + "\nArchitecture : " + pk.arch + "\nSummary      : " + pk.desc + "\n\n"); } return code; }
    if (sub === "list") { const inst = opts.includes("--installed") || names[0] === "installed"; io.out((inst ? "Installed packages\n" : "Available packages\n") + Object.keys(DB).filter(k => !inst || m.pkgs.has(k)).sort(cmpC).map(k => pad(k + "." + DB[k].arch, 28, true) + pad(DB[k].ver, 20, true) + (m.pkgs.has(k) ? "@System" : "fedora") + "\n").join("")); return 0; }
    if (sub === "install" || sub === "remove" || sub === "erase") {
      if (m.uid !== 0) { io.err("This command has to be run with superuser privileges (under the root user on most systems).\n"); return 1; }
      if (!names.length) { io.err("Missing positional argument \"packages\" for command \"" + sub + "\"\n"); return 2; }
      for (const n of names) if (!DB[n]) { io.err("Failed to resolve the transaction:\nNo match for argument: " + n + "\n"); return 1; }
      const todo = sub === "install" ? names.filter(n => !m.pkgs.has(n)) : names.filter(n => m.pkgs.has(n));
      if (!todo.length) { io.out(sub === "install" ? "Package " + names[0] + " is already installed.\nNothing to do.\n" : "No packages to remove for argument: " + names[0] + "\nNothing to do.\n"); return 0; }
      io.out("Updating and loading repositories:\nRepositories loaded.\nPackage                Arch      Version              Repository      Size\n" + (sub === "install" ? "Installing:\n" : "Removing:\n") + todo.map(n => " " + pad(n, 22, true) + pad(DB[n].arch, 10, true) + pad(DB[n].ver, 21, true) + pad(sub === "install" ? "fedora" : "@System", 16, true) + (DB[n].size || "") + "\n").join("") +
        "\nTransaction Summary:\n " + (sub === "install" ? "Installing" : "Removing") + ":         " + todo.length + " package" + (todo.length > 1 ? "s" : "") + "\n" + (yes ? "" : "Is this ok [y/N]: y\n(lab: answered y for you; -y skips the question)\n") + "Running transaction\nComplete!\n");
      todo.forEach(n => sub === "install" ? pkgInstall(m, n, io) : pkgRemove(m, n, false)); return 0;
    }
    io.err("Unknown argument \"" + sub + "\" for command \"" + prog + "\".\n"); return 2;
  }; }
  CMDS.dnf = dnfLike("dnf"); CMDS.yum = dnfLike("yum");
  CMDS.rpm = (m, args, io) => {
    const DB = pkgDB(m); const op = args[0] || ""; const n = args[1];
    if (/^-q[a]?$/.test(op) && op === "-qa") { io.out(Object.keys(DB).filter(k => m.pkgs.has(k)).sort(cmpC).map(k => k + "-" + DB[k].ver.replace(/^\d+:/, "") + "." + DB[k].arch).join("\n") + "\n"); return 0; }
    if (/^-q[il]?$/.test(op)) { if (!n) { io.err("rpm: no arguments given for query\n"); return 1; } if (!m.pkgs.has(n)) { io.out("package " + n + " is not installed\n"); return 1; }
      if (op === "-q") io.out(n + "-" + DB[n].ver.replace(/^\d+:/, "") + "." + DB[n].arch + "\n");
      else if (op === "-ql") io.out((DB[n].bins || []).map(b => "/usr/bin/" + b).concat(["/usr/share/doc/" + n + "/copyright"]).join("\n") + "\n");
      else io.out("Name        : " + n + "\nVersion     : " + DB[n].ver.replace(/^\d+:/, "").split("-")[0] + "\nRelease     : " + DB[n].ver.split("-").pop() + "\nArchitecture: " + DB[n].arch + "\nSummary     : " + DB[n].desc + "\n"); return 0; }
    if (/^-(i|U|e)/.test(op)) { if (m.uid !== 0) { io.err("error: can't create transaction lock on /var/lib/rpm/.rpm.lock (Permission denied)\n"); return 1; } io.err("error: open of " + (n || "") + " failed: No such file or directory\n(lab: rpm -i installs a downloaded .rpm file; to install from the repositories use dnf)\n"); return 1; }
    io.err("rpm: no operation specified\n"); return 1;
  };
  // programs that only exist once their package is installed
  const BIG = { A: ["  #  ", " # # ", "#####", "#   #", "#   #"], B: ["#### ", "#   #", "#### ", "#   #", "#### "], C: [" ####", "#    ", "#    ", "#    ", " ####"], D: ["#### ", "#   #", "#   #", "#   #", "#### "],
    E: ["#####", "#    ", "#### ", "#    ", "#####"], F: ["#####", "#    ", "#### ", "#    ", "#    "], G: [" ####", "#    ", "#  ##", "#   #", " ####"], H: ["#   #", "#   #", "#####", "#   #", "#   #"], I: ["###", " # ", " # ", " # ", "###"],
    J: ["  ###", "   # ", "   # ", "#  # ", " ##  "], K: ["#   #", "#  # ", "###  ", "#  # ", "#   #"], L: ["#    ", "#    ", "#    ", "#    ", "#####"], M: ["#   #", "## ##", "# # #", "#   #", "#   #"], N: ["#   #", "##  #", "# # #", "#  ##", "#   #"],
    O: [" ### ", "#   #", "#   #", "#   #", " ### "], P: ["#### ", "#   #", "#### ", "#    ", "#    "], Q: [" ### ", "#   #", "# # #", "#  # ", " ## #"], R: ["#### ", "#   #", "#### ", "#  # ", "#   #"], S: [" ####", "#    ", " ### ", "    #", "#### "],
    T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "], U: ["#   #", "#   #", "#   #", "#   #", " ### "], V: ["#   #", "#   #", "#   #", " # # ", "  #  "], W: ["#   #", "#   #", "# # #", "## ##", "#   #"], X: ["#   #", " # # ", "  #  ", " # # ", "#   #"],
    Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  "], Z: ["#####", "   # ", "  #  ", " #   ", "#####"], "0": [" ### ", "#  ##", "# # #", "##  #", " ### "], "1": [" # ", "## ", " # ", " # ", "###"], "2": ["#### ", "    #", " ### ", "#    ", "#####"],
    "3": ["#### ", "    #", " ### ", "    #", "#### "], "4": ["#   #", "#   #", "#####", "    #", "    #"], "5": ["#####", "#    ", "#### ", "    #", "#### "], "6": [" ### ", "#    ", "#### ", "#   #", " ### "], "7": ["#####", "    #", "   # ", "  #  ", "  #  "],
    "8": [" ### ", "#   #", " ### ", "#   #", " ### "], "9": [" ### ", "#   #", " ####", "    #", " ### "], " ": ["  ", "  ", "  ", "  ", "  "], "!": ["#", "#", "#", " ", "#"], ".": [" ", " ", " ", " ", "#"], "-": ["    ", "    ", "####", "    ", "    "], "?": ["### ", "   #", " ## ", "    ", " #  "] };
  CMDS.figlet = (m, args, io) => { const text = (args.filter(a => !a.startsWith("-")).join(" ") || lines(io.stdin)[0] || "").toUpperCase();
    const rows = ["", "", "", "", ""]; for (const ch of text) { const g0 = BIG[ch] || BIG["?"]; for (let r = 0; r < 5; r++) rows[r] += g0[r] + " "; }
    io.out(rows.map(r => r.replace(/\s+$/, "")).join("\n") + "\n"); };
  CMDS.cowsay = (m, args, io) => { const text = args.join(" ") || lines(io.stdin).join(" ") || "Moo";
    io.out(" " + "_".repeat(text.length + 2) + "\n< " + text + " >\n " + "-".repeat(text.length + 2) + "\n    \\\n     \\   (__)\n         (oo)______\n          \\/       \\\n            ||----||\n            ^^    ^^\n"); };
  CMDS.sl = (m, args, io) => { io.out("      ====        ________\n  _D _|  |_______/        \\__I_I_____\n   |(_)---  |   H\\________/ |   |\n   /     |  |   H  |  |     |   |\n  |      |  |   H  |__-----------------|\n  | ________|___H__/__|_____/[][]~\\____|\n  |/ |   |-----------I_____I [][] []  D  |\n__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___\n |/-=|___|=    ||    ||    ||    |_____/~\\\n  \\_/      \\O=====O=====O=====O_/      \\_/\n(lab: sl is a joke program: it drives a train across your screen when you mistype ls)\n"); };
  CMDS.htop = (m, args, io) => CMDS.top(m, ["-b"], io);
  CMDS.nmap = (m, args, io) => { const t = args.filter(a => !a.startsWith("-"))[0] || "localhost"; io.out("Starting Nmap 7.94 ( https://nmap.org )\nNmap scan report for " + t + "\nHost is up (0.00010s latency).\nPORT   STATE SERVICE\n22/tcp open  ssh\n80/tcp open  http\n\nNmap done: 1 IP address (1 host up) scanned in 0.05 seconds\n(lab: only scan machines you own or have permission to test)\n"); };
  CMDS.blender = (m, args, io) => { io.err("Blender 4.0.2\nUnable to open a display\n(lab: Blender is a graphical program; it needs a desktop, not a text terminal)\n"); return 1; };
  CMDS.lscpu = (m, args, io) => { io.out("Architecture:             x86_64\n  CPU op-mode(s):         32-bit, 64-bit\n  Address sizes:          39 bits physical, 48 bits virtual\n  Byte Order:             Little Endian\nCPU(s):                   2\n  On-line CPU(s) list:    0,1\nVendor ID:                GenuineIntel\n  Model name:             Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz\n    Thread(s) per core:   1\n    Core(s) per socket:   2\n    Socket(s):            1\n    CPU max MHz:          4200.0000\n    Flags:                fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx lm vmx\nVirtualization features:\n  Virtualization:         VT-x\nCaches (sum of all):\n  L1d:                    64 KiB (2 instances)\n  L2:                     512 KiB (2 instances)\n  L3:                     6 MiB (1 instance)\n"); };
  CMDS.uname = (m, args, io) => { const a = args.join(""); const parts = { s: "Linux", n: m.hostname, r: "6.8.0-45-generic", m: "x86_64", o: "GNU/Linux" };
    if (!a) return io.out("Linux\n"); if (a.includes("a")) return io.out("Linux " + m.hostname + " 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\n");
    io.out([..."snrmo"].filter(k => a.includes(k)).map(k => parts[k]).join(" ") + "\n"); };
  CMDS.hostname = (m, args, io) => { io.out(m.hostname + "\n"); };
  CMDS.uptime = (m, args, io) => { io.out(" 09:30:00 up 2 days,  3:12,  2 users,  load average: 0.08, 0.05, 0.01\n"); };
  CMDS.free = (m, args, io) => {
    const kib = { total: 8048424, used: 2201848, free: 3145728, shared: 184320, cache: 3040848, avail: 5846576, stotal: 2097148 };
    const h = args.some(a => /^-\w*h/.test(a) || a === "--human"), unit = args.includes("-b") ? 1 / 1024 : args.includes("-m") ? 1024 : args.includes("-g") ? 1048576 : args.includes("--mega") ? 1000 : 1;
    const fmtv = v => { if (h) { if (v === 0) return "0B"; const g = v / 1048576; return g >= 1 ? g.toFixed(1) + "Gi" : Math.round(v / 1024) + "Mi"; } return String(Math.floor(v / unit)); };
    const row = (label, vals) => pad(label, 7, true) + vals.map(v => pad(fmtv(v), 12)).join("") + "\n";
    io.out("               total        used        free      shared  buff/cache   available\n" + row("Mem:", [kib.total, kib.used, kib.free, kib.shared, kib.cache, kib.avail]) + row("Swap:", [kib.stotal, 0, kib.stotal]) +
      (args.includes("-t") ? row("Total:", [kib.total + kib.stotal, kib.used, kib.free + kib.stotal]) : ""));
  };
  function procList(m, cmdName, args) {     // live processes plus the ps/top process itself
    const me = userById(m, m.uid).name;
    return m.procs.concat([proc(m.nextPid, m.pid, me, "pts/0", "R+", cmdName + (args.length ? " " + args.join(" ") : ""), cmdName, 10100, 3300)]);
  }
  function forest(list) {                     // order children under parents and prefix them like ps f / --forest
    const out = []; const kids = p => list.filter(x => x.ppid === p.pid && x !== p);
    const walk = (p, depth) => { out.push([p, depth]); kids(p).forEach(c => walk(c, depth + 1)); };
    list.filter(p => !list.some(x => x.pid === p.ppid && x !== p)).forEach(p => walk(p, 0));
    return out;
  }
  CMDS.ps = (m, args, io) => {
    const me = userById(m, m.uid).name; const all = procList(m, "ps", args);
    const joined = args.join(" ");
    const bsd = args.length && !args[0].startsWith("-");
    const flags = bsd ? args[0] : args.filter(a => a.startsWith("-")).map(a => a.slice(1)).join("");
    let sel; let fmt = "def"; let tree = /f/.test(bsd ? flags : "") || args.includes("--forest");
    const uIdx = args.indexOf("-u"), pIdx = args.findIndex(a => /^-[A-Za-z]*p$/.test(a)), UArg = uIdx >= 0 ? args[uIdx + 1] : null;
    if (bsd) {
      if (/a/.test(flags) && /x/.test(flags)) sel = all; else if (/x/.test(flags)) sel = all.filter(p => p.user === me); else if (/a/.test(flags)) sel = all.filter(p => p.tty !== "?"); else sel = all.filter(p => p.user === me && p.tty !== "?");
      fmt = /u/.test(flags) ? "u" : "bsd";
    } else {
      if (/[eA]/.test(flags)) sel = all; else if (UArg) sel = all.filter(p => UArg.split(",").includes(p.user)); else if (pIdx >= 0) sel = all.filter(p => args[pIdx + 1].split(",").includes(String(p.pid)));
      else sel = all.filter(p => p.tty === "pts/0" && p.user === me);
      if (/f/.test(flags) && !(uIdx >= 0 && flags === "uf")) fmt = "full";
      if (flags === "uf" || flags === "fu") { fmt = "full"; sel = all.filter(p => p.user === me); }
      if (/H/.test(flags)) tree = true;
    }
    const rows = tree ? forest(sel) : sel.map(p => [p, 0]);
    if (!rows.length) { io.out(fmt === "full" ? "UID          PID    PPID  C STIME TTY          TIME CMD\n" : fmt === "u" ? "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n" : fmt === "bsd" ? "    PID TTY      STAT   TIME COMMAND\n" : "    PID TTY          TIME CMD\n"); return 1; }   // e.g. ps -p with a PID that's gone
    const cmdOf = (p, d, full) => (d ? "  ".repeat(d - 1) + " \\_ " : "") + (full ? p.cmd : p.comm);
    const time8 = p => { const [mm, ss] = String(p.time || "0:00").split(":").map(Number); return [Math.floor(mm / 60), mm % 60, ss || 0].map(x => String(x).padStart(2, "0")).join(":"); };
    if (fmt === "u") { io.out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n" + rows.map(([p, d]) => pad(p.user.length > 8 ? p.user.slice(0, 7) + "+" : p.user, 8, true) + pad(p.pid, 8) + pad(p.cpu.toFixed(1), 5) + pad(p.mem.toFixed(1), 5) + pad(p.vsz, 7) + pad(p.rss, 6) + " " + pad(p.tty, 8, true) + " " + pad(p.stat, 4, true) + " " + pad(p.start, 5, true) + pad(p.time, 7) + " " + cmdOf(p, d, true)).join("\n") + "\n"); return 0; }
    if (fmt === "bsd") { io.out("    PID TTY      STAT   TIME COMMAND\n" + rows.map(([p, d]) => pad(p.pid, 7) + " " + pad(p.tty, 8, true) + " " + pad(p.stat, 6, true) + pad(p.time, 5) + " " + cmdOf(p, d, true)).join("\n") + "\n"); return 0; }
    if (fmt === "full") { io.out("UID          PID    PPID  C STIME TTY          TIME CMD\n" + rows.map(([p, d]) => pad(p.user, 8, true) + pad(p.pid, 8) + pad(p.ppid, 8) + pad(Math.min(99, Math.round(p.cpu)), 3) + " " + pad(p.start, 5, true) + " " + pad(p.tty, 8, true) + " " + time8(p) + " " + cmdOf(p, d, true)).join("\n") + "\n"); return 0; }
    io.out("    PID TTY          TIME CMD\n" + rows.map(([p, d]) => pad(p.pid, 7) + " " + pad(p.tty, 8, true) + " " + time8(p) + " " + cmdOf(p, d, false)).join("\n") + "\n"); return 0;
  };
  CMDS.top = (m, args, io) => {
    const list = procList(m, "top", []).filter(p => p.pid !== 2).sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);
    const run = list.filter(p => p.stat[0] === "R").length; const cpu = list.reduce((t, p) => t + p.cpu, 0);
    io.out("top - 09:30:00 up 2 days,  3:12,  2 users,  load average: " + (cpu > 50 ? "1.02, 0.84, 0.51" : "0.08, 0.05, 0.01") + "\nTasks: " + (108 + list.length) + " total,   " + run + " running, " + (108 + list.length - run) + " sleeping,   0 stopped,   0 zombie\n%Cpu(s): " + pad((cpu / 2 + 1.2).toFixed(1), 4) + " us,  0.5 sy,  0.0 ni, " + (97.9 - cpu / 2).toFixed(1) + " id,  0.0 wa,  0.0 hi,  0.4 si,  0.0 st\n" +
      "MiB Mem :   7859.8 total,   3072.0 free,   2150.2 used,   2969.6 buff/cache\nMiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5709.5 avail Mem\n\n" +
      "    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n" +
      list.slice(0, 12).map(p => pad(p.pid, 7) + " " + pad(p.user.slice(0, 8), 8, true) + "  20   0 " + pad(p.vsz, 7) + " " + pad(p.rss, 6) + " " + pad(Math.round(p.rss / 2), 6) + " " + p.stat[0] + " " + pad(p.cpu.toFixed(1), 5) + " " + pad(p.mem.toFixed(1), 5) + " " + pad(p.time + ".00", 9) + " " + p.comm).join("\n") + "\n" +
      (args.includes("-b") ? "" : "(lab: top keeps refreshing on a real system: press q to quit, k to kill a PID, M to sort by memory, P by CPU. Here it prints once, like top -b -n 1)\n"));
  };
  CMDS.lsblk = (m, args, io) => {
    if (args.some(a => /^-\w*f/.test(a) || a === "--fs")) { io.out("NAME        FSTYPE FSVER LABEL  UUID                                 FSAVAIL FSUSE% MOUNTPOINTS\nsda\n├─sda1      vfat   FAT32        1A2B-3C4D                               1.1G     1% /boot/efi\n└─sda2      ext4   1.0          7f3e2a10-5b8c-4d9e-a1f2-0c3b4d5e6f70  384G    13% /\nsr0\nmmcblk0\n├─mmcblk0p1 vfat   FAT32  bootfs 9E21-4C7A\n└─mmcblk0p2 ext4   1.0    rootfs 3b9c1f02-6a7d-4e1b-9c2d-1e2f3a4b5c6d\n"); return 0; }
    io.out("NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda           8:0    0 476.9G  0 disk\n├─sda1        8:1    0     1G  0 part /boot/efi\n└─sda2        8:2    0 475.9G  0 part /\nsr0          11:0    1  1024M  0 rom\nmmcblk0     179:0    0  29.7G  0 disk\n├─mmcblk0p1 179:1    0   512M  0 part\n└─mmcblk0p2 179:2    0  29.2G  0 part\n"); };
  CMDS.df = (m, args, io) => { io.out("Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda2       468G   61G  384G  14% /\n/dev/sda1       1.1G  6.1M  1.1G   1% /boot/efi\ntmpfs           3.9G     0  3.9G   0% /tmp\n"); };
  const KMSG = [[0.000000, "Linux version 6.8.0-45-generic (buildd@lab) (gcc 13.2.0) #45-Ubuntu SMP PREEMPT_DYNAMIC"], [0.000000, "Command line: BOOT_IMAGE=/boot/vmlinuz-6.8.0-45-generic root=/dev/sda2 ro quiet splash"],
    [1.412233, "sd 0:0:0:0: [sda] 1000215216 512-byte logical blocks: (512 GB/477 GiB)"], [1.420118, " sda: sda1 sda2"], [1.893412, "EXT4-fs (sda2): mounted filesystem with ordered data mode"],
    [2.104511, "e1000 0000:00:03.0 eth0: (PCI:33MHz:32-bit) 52:54:00:12:34:56"], [2.118870, "e1000 0000:00:03.0 enp0s3: renamed from eth0"], [6.200133, "e1000: enp0s3 NIC Link is Up 1000 Mbps Full Duplex, Flow Control: RX"],
    [8723.551210, "usb 1-1: new high-speed USB device number 3 using xhci_hcd"], [8723.712844, "usb-storage 1-1:1.0: USB Mass Storage device detected"],
    [8724.602011, "sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks: (16.0 GB/14.9 GiB)"], [8724.610132, " sdb: sdb1"]];
  CMDS.dmesg = (m, args, io) => { if (m.uid !== 0) { io.err("dmesg: read kernel buffer failed: Operation not permitted\n"); return 1; }
    const human = args.includes("-T") || args.includes("-H");
    io.out(KMSG.map(([t, msg]) => (human ? "[Thu Oct  8 06:" + String(18 + Math.floor(t / 60) % 40).padStart(2, "0") + ":" + String(Math.floor(t) % 60).padStart(2, "0") + " 2026] " : "[" + pad(t.toFixed(6), 12) + "] ") + msg).join("\n") + "\n"); };
  // ---------------------------------------------------------------- networking (state lives in m.net, so ip addr add / ip route add stick)
  function ipShowLinks(m, io, which, addrs, fam, brief) {
    m.net.links.filter(l => !which || l.name === which).forEach((l, idx) => {
      const n = m.net.links.indexOf(l) + 1; const shown = l.addrs.filter(a => !fam || (fam === 4) === !a.includes(":"));
      if (brief) { io.out(pad(l.name, 16, true) + " " + pad(l.state, 13, true) + " " + (addrs ? shown.join(" ") : l.mac + " <" + l.flags + ">") + "\n"); return; }
      io.out(n + ": " + l.name + ": <" + l.flags + "> mtu " + l.mtu + " qdisc " + (l.loop ? "noqueue" : "fq_codel") + " state " + l.state + " group default qlen 1000\n    link/" + (l.loop ? "loopback " : "ether ") + l.mac + " brd " + (l.loop ? "00:00:00:00:00:00" : "ff:ff:ff:ff:ff:ff") + "\n");
      if (addrs) shown.forEach(a => { const v6 = a.includes(":"); const scope = a.startsWith("127.") || a === "::1/128" ? "host" : a.startsWith("fe80") ? "link" : "global";
        io.out("    " + (v6 ? "inet6 " : "inet ") + a + (v6 || scope === "host" ? "" : " brd " + bcast(a)) + " scope " + scope + (a === l.dynamic ? " dynamic noprefixroute " : " ") + (v6 ? "" : l.name) + "\n       valid_lft forever preferred_lft forever\n"); });
    });
  }
  function bcast(cidr) { const [ip, bits] = cidr.split("/"); const n = ip.split(".").reduce((a, x) => a * 256 + +x, 0); const mask = bits == 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0; const b = (n | (~mask >>> 0)) >>> 0; return [24, 16, 8, 0].map(sh => (b >>> sh) & 255).join("."); }
  const validV4 = c => /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(c) && c.split("/")[0].split(".").every(x => +x < 256) && +c.split("/")[1] <= 32;
  const validV6 = c => /^[0-9a-fA-F:]+\/\d{1,3}$/.test(c) && c.includes(":");
  CMDS.ip = (m, args, io) => {
    let fam = null, brief = false; args = args.slice();
    while (args[0] && args[0].startsWith("-")) { const o = args.shift(); if (o === "-4") fam = 4; else if (o === "-6") fam = 6; else if (o === "-br" || o === "-brief") brief = true; else if (o === "-c" || o === "-color") continue; else { io.err("Option \"" + o + "\" is unknown, try \"ip -help\".\n"); return 255; } }
    const obj = args[0] || "", verb = args[1] || "show", rest = args.slice(2);
    const devOf = a => { const i = a.indexOf("dev"); return i >= 0 ? a[i + 1] : null; };
    const need = () => { if (m.uid !== 0) throw new ShellError("RTNETLINK answers: Operation not permitted", 2); };
    const link = name => { const l = m.net.links.find(x => x.name === name); if (!l) throw new ShellError("Cannot find device \"" + name + "\"", 1); return l; };
    if (/^a(d(d(r(e(ss?)?)?)?)?)?$/.test(obj) || obj === "addr") {
      if (/^(s|sh|show|l|list)$/.test(verb)) { const d = devOf(rest) || (rest[0] && rest[0] !== "dev" ? rest[0] : null); if (d) link(d); ipShowLinks(m, io, d, true, fam, brief); return 0; }
      if (verb === "add" || verb === "del" || verb === "delete") {
        const cidr = rest[0], d = devOf(rest); if (!cidr || !d) throw new ShellError("Not enough information: \"dev\" argument is required.", 1);
        need(); const l = link(d);
        if (!validV4(cidr) && !validV6(cidr)) throw new ShellError("Error: any valid prefix is expected rather than \"" + cidr + "\".", 1);
        if (verb === "add") { if (l.addrs.includes(cidr)) throw new ShellError("RTNETLINK answers: File exists", 2); l.addrs.push(cidr); }
        else { if (!l.addrs.includes(cidr)) throw new ShellError("RTNETLINK answers: Cannot assign requested address", 2); l.addrs = l.addrs.filter(x => x !== cidr); }
        return 0;
      }
    }
    if (/^l(i(nk?)?)?$/.test(obj)) {
      if (/^(s|sh|show|l|list)$/.test(verb)) { const d = devOf(rest) || rest[0] || null; if (d) link(d); ipShowLinks(m, io, d, false, null, brief); return 0; }
      if (verb === "set") { need(); const l = link(devOf(rest) || rest[0]); if (rest.includes("down")) { l.state = "DOWN"; l.flags = l.flags.replace(/,?UP|,?LOWER_UP/g, ""); } if (rest.includes("up")) { l.state = l.loop ? "UNKNOWN" : "UP"; if (!/UP/.test(l.flags)) l.flags += ",UP,LOWER_UP"; } return 0; }
    }
    if (/^r(o(u(te?)?)?)?$/.test(obj)) {
      const table = fam === 6 ? m.net.routes6 : m.net.routes;
      if (/^(s|sh|show|l|list)$/.test(verb)) { table.forEach(r => io.out(r.dst + (r.via ? " via " + r.via : "") + " dev " + r.dev + (r.extra ? " " + r.extra : "") + "\n")); return 0; }
      if (verb === "add" || verb === "del" || verb === "delete") {
        need(); const dst = rest[0]; const vi = rest.indexOf("via"); const via = vi >= 0 ? rest[vi + 1] : null; let dev = devOf(rest);
        if (!dst) throw new ShellError("Error: argument is wrong", 1);
        if (verb === "add") {
          if (!dev) { const l = m.net.links.find(x => !x.loop && x.addrs.length); dev = l ? l.name : "enp0s3"; } link(dev);
          if (dst === "default" && table.some(r => r.dst === "default")) throw new ShellError("RTNETLINK answers: File exists", 2);
          table.unshift({ dst, via, dev, extra: fam === 6 ? "metric 1024 pref medium" : "" }); return 0;
        }
        const k = table.findIndex(r => r.dst === dst); if (k < 0) throw new ShellError("RTNETLINK answers: No such process", 2); table.splice(k, 1); return 0;
      }
    }
    io.err("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | ... }\n       OPTIONS := { -4 | -6 | -br[ief] | -c[olor] }\n"); return 1;
  };
  const DNS = { "example.com": { A: "93.184.215.14", AAAA: "2606:2800:21f:cb07:6820:80da:af6b:8b2c", MX: "0 .", TXT: "\"v=spf1 -all\"" }, "www.example.com": { CNAME: "example.com." },
    "lpi.org": { A: "65.39.134.165", MX: "10 mail.lpi.org." }, "learning.lpi.org": { A: "65.39.134.168" }, "github.com": { A: "140.82.112.4", MX: "1 aspmx.l.google.com." }, "mail.lpi.org": { A: "65.39.134.170" } };
  function hostsLookup(m, name) { const hr = asRoot(m, () => tryResolve(m, "/etc/hosts")); const hosts = hr.ino != null ? node(m, hr.ino).data : ""; for (const l of lines(hosts)) { const p = l.trim().split(/\s+/); if (!l.trim().startsWith("#") && p.slice(1).includes(name)) return p[0]; }
    return name === "localhost" ? "127.0.0.1" : null; }
  // Names not in /etc/hosts need a nameserver line in /etc/resolv.conf. (Reaching that server is not modelled, so a missing default
  // route still shows up as "Network is unreachable" when the packets are sent, as the 4.4 lab teaches.)
  function resolverState(m) {
    const r = asRoot(m, () => tryResolve(m, "/etc/resolv.conf")); const txt = r.ino != null ? node(m, r.ino).data || "" : "";
    const ns = lines(txt).map(l => /^\s*nameserver\s+(\S+)/.exec(l)).filter(Boolean).map(x => x[1]);
    return ns.length ? "ok" : "none";
  }
  function lookup(m, name) { const h = hostsLookup(m, name); if (h) return h; if (resolverState(m) !== "ok") return null;
    const rec = DNS[name.replace(/\.$/, "")]; return rec ? rec.A || (rec.CNAME ? lookup(m, rec.CNAME.replace(/\.$/, "")) : null) : null; }
  function pingCmd(v6) { return (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "ping", flags: "c:i:W:w:q46n", long: {} });
    const host = rest[0]; if (!host) { io.err("ping: usage error: Destination address required\n"); return 1; }
    const six = v6 || f[6];
    let ip = six ? (host === "localhost" || host === "::1" ? "::1" : /:/.test(host) ? host : (DNS[host] || {}).AAAA) : /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : lookup(m, host);
    if (!ip && !six && !hostsLookup(m, host) && resolverState(m) !== "ok") { io.err("ping: " + host + ": Temporary failure in name resolution\n"); return 2; }
    if (!ip) { io.err("ping: " + host + ": " + (six ? "Address family for hostname not supported" : "Name or service not known") + "\n"); return 2; }
    const n = f.c != null ? +f.c : 4; if (!(n > 0)) { io.err("ping: invalid argument: '" + f.c + "': out of range: 1 <= value <= 9223372036854775807\n"); return 1; }
    const local = ip.startsWith("127.") || ip === "::1" || m.net.links.some(l => l.addrs.some(a => a.split("/")[0] === ip));
    const lan = /^192\.168\.1\./.test(ip);            // on our own subnet: reached directly, without the gateway
    const reach = local || m.net.routes.some(r => r.dst === "default") || lan;
    if (!reach) { io.err("ping: connect: Network is unreachable\n"); return 2; }
    io.out("PING " + host + (host !== ip ? " (" + ip + ")" : "") + " " + (six ? "56 data bytes" : "56(84) bytes of data.") + "\n");
    if (!f.q) for (let i = 1; i <= n; i++) io.out("64 bytes from " + (host !== ip ? (local ? host : host) + " (" + ip + ")" : ip) + ": icmp_seq=" + i + " ttl=" + (local ? 64 : lan ? 64 : 56) + " time=" + (local ? "0.0" + (3 + i) : lan ? "0." + (3 + i) + "1" : "1" + i + ".2") + " ms\n");
    io.out("\n--- " + host + " ping statistics ---\n" + n + " packets transmitted, " + n + " received, 0% packet loss, time " + (n - 1) * 1001 + "ms\n");
  }; }
  CMDS.ping = pingCmd(false); CMDS.ping6 = pingCmd(true);
  CMDS.host = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "host", flags: "t:a46v", long: {} });
    const name = rest[0]; if (!name) { io.err("Usage: host [-aCdilrTvVw] [-c class] [-N ndots] [-t type] [-W time]\n            [-R number] [-m flag] [-p port] hostname [server]\n"); return 1; }
    if (resolverState(m) !== "ok") { io.out(";; connection timed out; no servers could be reached\n"); return 1; }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) { const hit = Object.keys(DNS).find(k => DNS[k].A === name); if (!hit) { io.out("Host " + name.split(".").reverse().join(".") + ".in-addr.arpa. not found: 3(NXDOMAIN)\n"); return 1; } io.out(name.split(".").reverse().join(".") + ".in-addr.arpa domain name pointer " + hit + ".\n"); return 0; }
    const rec = DNS[name.replace(/\.$/, "")]; if (!rec) { io.out("Host " + name + " not found: 3(NXDOMAIN)\n"); return 1; }
    const t = (f.t || "").toUpperCase();
    if (rec.CNAME && (!t || t === "CNAME")) { io.out(name + " is an alias for " + rec.CNAME + "\n"); if (t) return 0; return CMDS.host(m, [rec.CNAME.replace(/\.$/, "")], io); }
    if ((!t || t === "A") && rec.A) io.out(name + " has address " + rec.A + "\n");
    if ((!t || t === "AAAA") && rec.AAAA) io.out(name + " has IPv6 address " + rec.AAAA + "\n");
    if ((!t || t === "MX") && rec.MX) io.out(name + " mail is handled by " + rec.MX + "\n");
    if (t === "TXT" && rec.TXT) io.out(name + " descriptive text " + rec.TXT + "\n");
    if (t && !rec[t]) io.out(name + " has no " + t + " record\n");
    return 0;
  };
  CMDS.dig = (m, args, io) => {
    const short = args.includes("+short"); const rest = args.filter(a => !a.startsWith("+") && !a.startsWith("@") && a !== "-x");
    const rev = args.includes("-x");
    if (resolverState(m) !== "ok") { io.out("\n; <<>> DiG 9.18.28 <<>> " + args.join(" ") + "\n;; global options: +cmd\n;; no servers could be reached\n"); return 9; }
    let name = rest.find(a => !/^(A|AAAA|MX|TXT|CNAME|NS|PTR|ANY)$/i.test(a)) || "."; const type = (rest.find(a => /^(A|AAAA|MX|TXT|CNAME|NS|PTR|ANY)$/i.test(a)) || (rev ? "PTR" : "A")).toUpperCase();
    let answers = [];
    if (rev) { const hit = Object.keys(DNS).find(k => DNS[k].A === name); name = name.split(".").reverse().join(".") + ".in-addr.arpa"; if (hit) answers.push([name + ".", "PTR", hit + "."]); }
    else { const rec = DNS[name.replace(/\.$/, "")];
      if (rec) { if (rec.CNAME) { answers.push([name + ".", "CNAME", rec.CNAME]); const t2 = DNS[rec.CNAME.replace(/\.$/, "")]; if (t2 && t2[type]) answers.push([rec.CNAME, type, t2[type]]); } else if (type === "ANY") Object.keys(rec).forEach(k => answers.push([name + ".", k, rec[k]])); else if (rec[type]) answers.push([name + ".", type, rec[type]]); } }
    if (short) { io.out(joinLines(answers.map(a => a[2]))); return 0; }
    const status = answers.length || DNS[name.replace(/\.$/, "")] ? "NOERROR" : "NXDOMAIN";
    io.out("\n; <<>> DiG 9.18.28 <<>> " + args.join(" ") + "\n;; global options: +cmd\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: " + status + ", id: 4242\n;; flags: qr rd ra; QUERY: 1, ANSWER: " + answers.length + ", AUTHORITY: 0, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;" + name + ".\t\t\tIN\t" + type + "\n" +
      (answers.length ? "\n;; ANSWER SECTION:\n" + answers.map(a => a[0] + "\t\t3600\tIN\t" + a[1] + "\t" + a[2]).join("\n") + "\n" : "") + "\n;; Query time: 12 msec\n;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n;; WHEN: Sat Oct 10 09:30:00 UTC 2026\n;; MSG SIZE  rcvd: 56\n\n");
    return 0;
  };
  const SOCKETS = [
    { p: "tcp", st: "LISTEN", l: "0.0.0.0:22", r: "0.0.0.0:*", q: [0, 128], proc: 'users:(("sshd",pid=612,fd=3))', v: 4 },
    { p: "tcp", st: "LISTEN", l: "0.0.0.0:80", r: "0.0.0.0:*", q: [0, 511], proc: 'users:(("nginx",pid=779,fd=6))', v: 4 },
    { p: "tcp", st: "LISTEN", l: "127.0.0.53%lo:53", r: "0.0.0.0:*", q: [0, 4096], proc: 'users:(("systemd-resolve",pid=520,fd=15))', v: 4 },
    { p: "tcp", st: "LISTEN", l: "[::]:22", r: "[::]:*", q: [0, 128], proc: 'users:(("sshd",pid=612,fd=4))', v: 6 },
    { p: "tcp", st: "ESTAB", l: "192.168.1.42:22", r: "192.168.1.20:50112", q: [0, 0], proc: 'users:(("sshd",pid=2290,fd=4))', v: 4 },
    { p: "tcp", st: "ESTAB", l: "192.168.1.42:44812", r: "140.82.112.4:443", q: [0, 0], proc: 'users:(("git",pid=2388,fd=3))', v: 4 },
    { p: "udp", st: "UNCONN", l: "127.0.0.53%lo:53", r: "0.0.0.0:*", q: [0, 0], proc: 'users:(("systemd-resolve",pid=520,fd=14))', v: 4 },
    { p: "udp", st: "UNCONN", l: "192.168.1.42%enp0s3:68", r: "0.0.0.0:*", q: [0, 0], proc: 'users:(("NetworkManager",pid=640,fd=27))', v: 4 },
    { p: "udp", st: "ESTAB", l: "192.168.1.42:51820", r: "1.1.1.1:53", q: [0, 0], proc: 'users:(("dig",pid=2391,fd=6))', v: 4 },
    { p: "udp", st: "UNCONN", l: "[::]:5353", r: "[::]:*", q: [0, 0], proc: 'users:(("avahi-daemon",pid=618,fd=13))', v: 6 }];
  CMDS.ss = (m, args, io) => {
    const fl = args.filter(a => a.startsWith("-") && !a.startsWith("--")).map(a => a.slice(1)).join("");
    if (fl.includes("s")) { io.out("Total: 182\nTCP:   6 (estab 2, closed 0, orphaned 0, timewait 0)\n\nTransport Total     IP        IPv6\nRAW\t  1         0         1\nUDP\t  4         3         1\nTCP\t  6         5         1\nINET\t  11        8         3\nFRAG\t  0         0         0\n\n"); return 0; }
    let list = SOCKETS.slice();
    const t = fl.includes("t"), u = fl.includes("u"); if (t || u) list = list.filter(x => (t && x.p === "tcp") || (u && x.p === "udp"));
    if (fl.includes("4")) list = list.filter(x => x.v === 4); if (fl.includes("6")) list = list.filter(x => x.v === 6);
    if (fl.includes("l")) list = list.filter(x => x.st === "LISTEN" || x.st === "UNCONN"); else if (!fl.includes("a")) list = list.filter(x => x.st === "ESTAB");
    const showP = fl.includes("p"); const both = !(t ^ u) || fl.includes("a") && !(t || u);
    io.out((both ? "Netid " : "") + "State  Recv-Q Send-Q   Local Address:Port    Peer Address:Port" + (showP ? " Process" : "") + "\n" +
      list.map(x => (both ? pad(x.p, 5, true) + " " : "") + pad(x.st, 6, true) + " " + pad(x.q[0], 6, true) + " " + pad(x.q[1], 6, true) + " " + pad(x.l, 22) + " " + pad(x.r, 20) + (showP ? " " + (m.uid === 0 || /sshd",pid=2290|git|dig/.test(x.proc) ? x.proc : "") : "")).join("\n") + (list.length ? "\n" : ""));
    if (showP && m.uid !== 0) io.out("(lab: run with sudo to see processes owned by other users)\n");
    return 0;
  };
  CMDS.netstat = (m, args, io) => { io.out("Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN\ntcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN\n"); };
  // ---------------------------------------------------------------- manual pages (text in man.js), info, whatis, apropos
  const SECTIONS = { 1: "User Commands", 5: "File Formats and Conventions", 7: "Miscellaneous Information Manual", 8: "System Manager's Manual" };
  function wrapText(text, width, indent) {
    return text.split("\n").map(par => { if (!par.trim()) return ""; const words = par.split(/\s+/).filter(Boolean); const out = []; let cur = "";
      for (const w of words) { if (cur && (cur + " " + w).length > width) { out.push(indent + cur); cur = w; } else cur = cur ? cur + " " + w : w; }
      if (cur) out.push(indent + cur); return out.join("\n"); }).join("\n");
  }
  function findPage(name, sec) {
    const P = manpages(); if (sec && P[name + "." + sec]) return P[name + "." + sec];
    if (!sec) { for (const s2 of ["1", "8", "5", "7"]) { const pg = P[name + "." + s2] || (P[name] && String(P[name].section) === s2 ? P[name] : null); if (pg) return pg; } }
    return P[name] && (!sec || String(P[name].section) === String(sec)) ? P[name] : null;
  }
  function renderMan(pg) {
    const head = pg.name.toUpperCase() + "(" + pg.section + ")"; const mid = SECTIONS[pg.section] || ""; const gap = Math.max(1, 78 - head.length * 2 - mid.length);
    let out = head + " ".repeat(Math.floor(gap / 2)) + mid + " ".repeat(Math.ceil(gap / 2)) + head + "\n\nNAME\n       " + pg.name + " - " + pg.summary + "\n";
    if (pg.synopsis) out += "\nSYNOPSIS\n" + pg.synopsis.map(x => "       " + x).join("\n") + "\n";
    if (pg.description) out += "\nDESCRIPTION\n" + wrapText(pg.description, 70, "       ") + "\n";
    if (pg.options && pg.options.length) out += "\nOPTIONS\n" + pg.options.map(([fl, txt]) => "       " + fl + "\n" + wrapText(txt, 64, "              ")).join("\n\n") + "\n";
    for (const [title, text] of pg.sections || []) out += "\n" + title + "\n" + (Array.isArray(text) ? text.map(x => "       " + x).join("\n") : wrapText(text, 70, "       ")) + "\n";
    if (pg.examples) out += "\nEXAMPLES\n" + pg.examples.map(([cmd, txt]) => "       " + cmd + "\n" + wrapText(txt, 64, "              ")).join("\n\n") + "\n";
    if (pg.files) out += "\nFILES\n" + pg.files.map(([f, t]) => "       " + f + "\n" + wrapText(t, 64, "              ")).join("\n") + "\n";
    if (pg.see) out += "\nSEE ALSO\n       " + pg.see.join(", ") + "\n";
    out += "\nexit 0 lab" + " ".repeat(28) + "2026" + " ".repeat(Math.max(1, 36 - head.length)) + head + "\n";
    return out;
  }
  function manHelp(name) {
    const pg = findPage(name); if (!pg || !pg.options) return null;
    return "Usage: " + (pg.synopsis || [name]).join("\n  or:  ") + "\n" + pg.summary.charAt(0).toUpperCase() + pg.summary.slice(1) + ".\n\n" +
      pg.options.map(([fl, txt]) => "  " + pad(fl, 24, true) + " " + txt.split(". ")[0].replace(/\.$/, "")).join("\n") + "\n\nFull documentation: man " + name;
  }
  CMDS.man = (m, args, io) => {
    if (args.includes("-k")) return CMDS.apropos(m, args.filter(a => a !== "-k"), io);
    if (args.includes("-f")) return CMDS.whatis(m, args.filter(a => a !== "-f"), io);
    let sec = null; const names = [];
    args.forEach(a => { if (/^[1-9]$/.test(a) && !names.length) sec = a; else if (!a.startsWith("-")) names.push(a); });
    if (!names.length) { io.err("What manual page do you want?\nFor example, try 'man man'.\n"); return 1; }
    let code = 0;
    for (const nm of names) {
      const pg = findPage(nm, sec);
      if (!pg) { io.err(sec ? "No entry for " + nm + " in section " + sec + " of the manual\n" : "No manual entry for " + nm + (BUILTINS.has(nm) ? "\n(lab: " + nm + " is a shell builtin, so it's documented in 'help " + nm + "' and in man bash)" : "") + "\n"); code = 16; continue; }
      io.out(renderMan(pg));
    }
    if (io.tty && !code) io.out("(lab: on a real system man opens in a pager: arrow keys scroll, / searches, q quits)\n");
    return code;
  };
  CMDS.whatis = (m, args, io) => { let code = 0; const P = manpages();
    for (const a of args.filter(x => !x.startsWith("-"))) { const hits = Object.values(P).filter(pg => pg.name === a); if (!hits.length) { io.out(a + ": nothing appropriate.\n"); code = 16; continue; }
      hits.sort((x, y) => String(x.section).localeCompare(String(y.section))).forEach(pg => io.out(pad(pg.name + " (" + pg.section + ")", 21, true) + "- " + pg.summary + "\n")); }
    return code; };
  CMDS.apropos = (m, args, io) => { const ks = args.filter(x => !x.startsWith("-")); if (!ks.length) { io.err("apropos what?\n"); return 1; } const P = manpages();
    const hits = Object.values(P).filter(pg => ks.some(k => (pg.name + " " + pg.summary).toLowerCase().includes(k.toLowerCase()))).sort((x, y) => cmpC(x.name, y.name) || String(x.section).localeCompare(String(y.section)));
    if (!hits.length) { io.out(ks.join(" ") + ": nothing appropriate.\n"); return 16; }
    hits.forEach(pg => io.out(pad(pg.name + " (" + pg.section + ")", 21, true) + "- " + pg.summary + "\n")); return 0; };
  CMDS.info = (m, args, io) => {
    const nm = args.filter(a => !a.startsWith("-"))[0] || "dir"; const P = manpages(); const pg = findPage(nm);
    if (nm === "dir") { io.out("File: dir,\tNode: Top\tThis is the top of the INFO tree\n\n* Menu:\n\nBasics\n* Common options: (coreutils)Common options.\n* Coreutils: (coreutils).       Core GNU (file, text, shell) utilities.\n* Bash: (bash).                 The GNU Bourne-Again SHell.\n* Tar: (tar).                   Making tape (or disk) archives.\n"); return 0; }
    if (!pg) { io.err("info: No menu item '" + nm + "' in node '(dir)Top'\n"); return 1; }
    if (pg.info) { io.out(pg.info + "\n"); }
    else io.out("File: *manpages*,  Node: " + nm + ",  Up: (dir)\n\n(info has no node for " + nm + ", so it shows the manual page instead.)\n\n" + renderMan(pg));
    if (io.tty) io.out("(lab: on a real system info is interactive: Tab moves between menu links, Enter follows one, n/p go to the next/previous node, u goes up, q quits)\n");
    return 0;
  };
  // ---------------------------------------------------------------- locate keeps a database, like plocate: new files appear only after updatedb
  CMDS.locate = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "locate", flags: "il:n:cebAS", long: { "ignore-case": "i", limit: "l", count: "c", existing: "e", basename: "b", all: "A", statistics: "S" } });
    if (f.S) { io.out("Database /var/lib/plocate/plocate.db:\n\t" + m.locateDb.length + " files\n"); return 0; }
    if (!rest.length) { io.err("locate: no pattern to search for specified\n"); return 1; }
    const limit = f.l != null ? +f.l : f.n != null ? +f.n : Infinity;
    const tests = rest.map(pat => { const globby = /[*?[]/.test(pat); const re = globby ? new RegExp(globToRe(pat).source.replace(/\[\^\/\]/g, "."), f.i ? "i" : "") : null;
      return path => { const subj = f.b ? basename(path) : path; return globby ? re.test(subj) : f.i ? subj.toLowerCase().includes(pat.toLowerCase()) : subj.includes(pat); }; });
    const hits = []; for (const p of m.locateDb) { if (hits.length >= limit) break; if (!(f.A ? tests.every(t => t(p)) : tests.some(t => t(p)))) continue; if (f.e && asRoot(m, () => tryResolve(m, p, { follow: false })).ino == null) continue;
      const parent = tryResolve(m, dirname(p)); if (parent.ino == null && m.uid !== 0 && !f.e) { /* unreadable dirs are skipped, like plocate */ } hits.push(p); }
    if (f.c) io.out(hits.length + "\n"); else io.out(joinLines(hits));
    return hits.length ? 0 : 1;
  };
  CMDS.updatedb = (m, args, io) => { if (m.uid !== 0) { io.err("updatedb: can not open a temporary file for `/var/lib/plocate/plocate.db'\n"); return 1; } m.locateDb = snapshotPaths(m); return 0; };
  // ---------------------------------------------------------------- systemd: units and the journal
  const JOURNAL = [
    [-1, "Oct 07 17:01:55", "kernel", "", "Linux version 6.8.0-45-generic (buildd@lab)", true], [-1, "Oct 07 17:02:10", "sshd[1870]", "ssh", "Accepted password for student from 192.168.1.20 port 49822 ssh2"],
    [-1, "Oct 07 18:40:02", "systemd-logind[598]", "systemd-logind", "System is powering down."],
    [0, "Oct 08 06:18:20", "kernel", "", "Linux version 6.8.0-45-generic (buildd@lab) (gcc 13.2.0) #45-Ubuntu SMP PREEMPT_DYNAMIC", true],
    [0, "Oct 08 06:18:20", "kernel", "", "sd 0:0:0:0: [sda] 1000215216 512-byte logical blocks: (512 GB/477 GiB)", true],
    [0, "Oct 08 06:18:21", "kernel", "", "e1000 0000:00:03.0 enp0s3: renamed from eth0", true],
    [0, "Oct 08 06:18:22", "systemd[1]", "ssh", "Started ssh.service - OpenBSD Secure Shell server."], [0, "Oct 08 06:18:22", "sshd[612]", "ssh", "Server listening on 0.0.0.0 port 22."],
    [0, "Oct 08 06:18:22", "systemd[1]", "cron", "Started cron.service - Regular background program processing daemon."],
    [0, "Oct 08 06:18:22", "systemd[1]", "rsyslog", "Started rsyslog.service - System Logging Service."],
    [0, "Oct 08 06:18:23", "systemd[1]", "systemd-networkd", "Started systemd-networkd.service - Network Configuration."], [0, "Oct 08 06:18:24", "systemd-networkd[530]", "systemd-networkd", "enp0s3: Gained carrier"],
    [0, "Oct 08 06:18:25", "systemd[1]", "nginx", "Started nginx.service - A high performance web server and a reverse proxy server."],
    [0, "Oct 10 09:00:01", "CRON[2105]", "cron", "(root) CMD (test -x /usr/sbin/anacron || run-parts --report /etc/cron.daily)"],
    [0, "Oct 10 09:12:01", "sshd[2210]", "ssh", "Failed password for root from 203.0.113.7 port 51234 ssh2"],
    [0, "Oct 10 09:12:44", "kernel", "", "usb 1-1: new high-speed USB device number 3 using xhci_hcd", true], [0, "Oct 10 09:12:45", "kernel", "", " sdb: sdb1", true],
    [0, "Oct 10 09:15:22", "sshd[2290]", "ssh", "Accepted publickey for student from 192.168.1.20 port 50112 ssh2"],
    [0, "Oct 10 09:15:22", "systemd-logind[598]", "systemd-logind", "New session 4 of user student."],
    [0, "Oct 10 09:16:40", "sudo[2333]", "", "student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/usr/bin/apt update"]];
  CMDS.journalctl = (m, args, io) => {
    const me = userById(m, m.uid).name;
    if (m.uid !== 0 && !gidsOf(m, m.uid).some(x => [4, 999].includes(x))) { io.out("Hint: You are currently not seeing messages from other users and the system.\n      Users in groups 'adm', 'systemd-journal' can see all messages.\n      Pass -q to turn off this notice.\n-- No entries --\n"); return 0; }
    if (args.includes("--list-boots")) { io.out("IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY\n -1 5c1d0e7a9b2f4e0c8a6d3b1f2e4c6a8d Wed 2026-10-07 17:01:55 UTC Wed 2026-10-07 18:40:02 UTC\n  0 9f3b7c2e1a0d4f6b8c5e2a7d1b3f9e0c Thu 2026-10-08 06:18:20 UTC Sat 2026-10-10 09:16:40 UTC\n"); return 0; }
    let list = JOURNAL.slice(); let n = null, follow = false, rev = false;
    for (let i = 0; i < args.length; i++) { const a = args[i];
      if (a === "-k" || a === "--dmesg") list = list.filter(e => e[5]).filter(e => e[0] === 0);
      else if (a === "-b" || a === "--boot") { const nx = args[i + 1]; let b = 0; if (nx && /^-?\d+$/.test(nx)) { b = +nx; i++; } list = list.filter(e => e[0] === (b > 0 ? b - 2 : b)); }
      else if (a === "-u" || a === "--unit") { const u0 = (args[++i] || "").replace(/\.service$/, ""); const u1 = u0 === "sshd" ? "ssh" : u0 === "networking" || u0 === "network" ? "systemd-networkd" : u0 === "syslog" ? "rsyslog" : u0;
        list = list.filter(e => e[3] === u1); if (!list.length) { io.out("-- No entries --\n"); return 0; } }
      else if (a.startsWith("-u")) { const u0 = a.slice(2).replace(/\.service$/, ""); list = list.filter(e => e[3] === (u0 === "sshd" ? "ssh" : u0)); }
      else if (a === "-n" || a === "--lines") n = +args[++i]; else if (/^-n\d+$/.test(a)) n = +a.slice(2);
      else if (a === "-f" || a === "--follow") { follow = true; if (n == null) n = 10; }
      else if (a === "-r" || a === "--reverse") rev = true;
      else if (a === "-p" || a === "--priority") { i++; list = list.filter(e => /Failed|powering/.test(e[4])); }
      else if (a === "-e" || a === "--pager-end") { if (n == null) n = 1000; }
      else if (a === "-q" || a === "--no-pager" || a === "-x") continue;
      else { io.err("journalctl: unrecognized option '" + a + "'\n"); return 1; } }
    if (n != null) list = list.slice(-n); if (rev) list = list.reverse();
    io.out(list.map(e => e[1] + " " + m.hostname + " " + e[2] + ": " + e[4]).join("\n") + (list.length ? "\n" : "-- No entries --\n"));
    if (follow) io.out("(lab: journalctl -f keeps waiting for new messages on a real system; press Ctrl+C to stop)\n");
    return 0;
  };
  const UNITS = { ssh: ["OpenBSD Secure Shell server", 612], cron: ["Regular background program processing daemon", 655], rsyslog: ["System Logging Service", 701], nginx: ["A high performance web server and a reverse proxy server", 779], "systemd-networkd": ["Network Configuration", 530], "systemd-journald": ["Journal Service", 412] };
  CMDS.systemctl = (m, args, io) => {
    m.units = m.units || Object.fromEntries(Object.keys(UNITS).map(k => [k, { active: true, enabled: true }]));
    const verb = args.filter(a => !a.startsWith("-"))[0] || "list-units"; const unitArg = args.filter(a => !a.startsWith("-"))[1]; const u0 = (unitArg || "").replace(/\.service$/, ""); const name = u0 === "sshd" ? "ssh" : u0;
    if (verb === "list-units" || verb === "list-unit-files") { io.out("  UNIT                     LOAD   ACTIVE SUB     DESCRIPTION\n" + Object.keys(UNITS).map(k => "  " + pad(k + ".service", 24, true) + " loaded " + pad(m.units[k].active ? "active" : "inactive", 6, true) + " " + pad(m.units[k].active ? "running" : "dead", 7, true) + " " + UNITS[k][0]).join("\n") + "\n"); return 0; }
    if (!UNITS[name]) { io.err(verb === "status" ? "Unit " + (unitArg || "") + (unitArg && !unitArg.includes(".") ? ".service" : "") + " could not be found.\n" : "Failed to " + verb + " " + unitArg + ": Unit " + unitArg + " not found.\n"); return verb === "status" ? 4 : 5; }
    const st = m.units[name];
    if (verb === "status") { io.out((st.active ? "● " : "○ ") + name + ".service - " + UNITS[name][0] + "\n     Loaded: loaded (/usr/lib/systemd/system/" + name + ".service; " + (st.enabled ? "enabled" : "disabled") + "; preset: enabled)\n     Active: " + (st.active ? "active (running) since Thu 2026-10-08 06:18:22 UTC; 2 days ago\n   Main PID: " + UNITS[name][1] + " (" + name + ")" : "inactive (dead)") + "\n\n" +
      JOURNAL.filter(e => e[3] === name).slice(-3).map(e => e[1] + " " + m.hostname + " " + e[2] + ": " + e[4]).join("\n") + "\n"); return st.active ? 0 : 3; }
    if (verb === "is-active") { io.out((st.active ? "active" : "inactive") + "\n"); return st.active ? 0 : 3; }
    if (verb === "is-enabled") { io.out((st.enabled ? "enabled" : "disabled") + "\n"); return st.enabled ? 0 : 1; }
    if (m.uid !== 0) { io.err("Failed to " + verb + " " + name + ".service: Access denied\nSee system logs and 'systemctl status " + name + ".service' for details.\n"); return 1; }
    if (verb === "start" || verb === "restart" || verb === "reload") st.active = true; else if (verb === "stop") st.active = false;
    else if (verb === "enable") { st.enabled = true; io.err("Created symlink /etc/systemd/system/multi-user.target.wants/" + name + ".service → /usr/lib/systemd/system/" + name + ".service.\n"); }
    else if (verb === "disable") { st.enabled = false; io.err("Removed \"/etc/systemd/system/multi-user.target.wants/" + name + ".service\".\n"); }
    else { io.err("Unknown command verb '" + verb + "'.\n"); return 1; }
    return 0;
  };
  // ================================================================ tab completion
  function complete(m, line) {
    const words = line.split(/\s+/); const cur = words[words.length - 1]; const first = words.length === 1;
    if (first && !cur.includes("/")) return Object.keys(CMDS).concat(["nano", "vi"]).filter(c => c.startsWith(cur)).sort();
    const dir = cur.includes("/") ? cur.slice(0, cur.lastIndexOf("/") + 1) : ""; const stem = cur.slice(dir.length);
    const r = tryResolve(m, dir || "."); if (r.ino == null) return [];
    const n = node(m, r.ino); if (n.type !== "dir" || !can(m, n, 4)) return [];
    return [...n.entries.keys()].filter(k => k.startsWith(stem) && (stem.startsWith(".") || k[0] !== ".")).sort(cmpC)
      .map(k => dir + k + (node(m, n.entries.get(k)).type === "dir" ? "/" : ""));
  }

  // ================================================================ lab checks (declarative, so a real Linux backend could run them too)
  function evalCheck(m, c) {
    const st = p => { const r = tryResolve(m, p, { follow: c.follow !== false && c.type !== "link" }); return r.ino == null ? null : node(m, r.ino); };
    switch (c.type) {
      case "exists": { const n = st(c.path); if (!n) return false; return !c.kind || n.type === c.kind; }
      case "absent": return !st(c.path);
      case "mode": { const n = st(c.path); return !!n && (n.mode & 0o7777) === parseInt(c.mode, 8); }
      case "perms": { const n = st(c.path); return !!n && modeString(n) === c.perms; }
      case "owner": { const n = st(c.path); if (!n) return false; return (!c.user || (userById(m, n.uid) || {}).name === c.user) && (!c.group || (groupById(m, n.gid) || {}).name === c.group); }
      case "contains": { const n = st(c.path); if (!n || n.type !== "file") return false; const text = contentOf(m, n); return c.regex ? new RegExp(c.regex, c.flags || "").test(text) : text.includes(c.text); }
      case "equals": { const n = st(c.path); return !!n && n.type === "file" && n.data === c.text; }
      case "lines": { const n = st(c.path); return !!n && n.type === "file" && lines(n.data).length === c.count; }
      case "link": { const r = tryResolve(m, c.path, { follow: false }); if (r.ino == null) return false; const n = node(m, r.ino); return n.type === "link" && (!c.target || n.target === c.target); }
      case "hardlink": { const a = st(c.path), b = st(c.other); const own = tryResolve(m, c.path, { follow: false });   // a symlink to the file isn't a hard link
        return !!a && !!b && a === b && own.ino != null && node(m, own.ino).type !== "link"; }
      case "archive": { const n = st(c.path); if (!n || !n.blob) return false; const { layers, blob } = unwrap(n.blob); if (c.compression && layers[0] !== c.compression) return false; if (c.compression === null && layers.length) return false;
        if (c.format && blob.kind !== c.format) return false; return (c.has || []).every(p => blob.entries.some(e => e.path.replace(/\/$/, "") === p)); }
      case "compressed": { const n = st(c.path); return !!n && !!n.blob && n.blob.kind === c.kind; }
      case "user": { const x = userByName(m, c.name); if (!x) return false; if (c.home && x.home !== c.home) return false; if (c.shell && x.shell !== c.shell) return false;
        if (c.comment && x.comment !== c.comment) return false; if (c.uid != null && x.uid !== c.uid) return false;
        if (c.primary && (groupById(m, x.gid) || {}).name !== c.primary) return false;
        if (c.groups && !c.groups.every(gn => (groupByName(m, gn) || { members: [] }).members.includes(c.name))) return false;
        if (c.password && (m.passwords[c.name] || "none") !== c.password) return false;
        if (c.homeExists) { const r = tryResolve(m, x.home); if (r.ino == null || node(m, r.ino).uid !== x.uid) return false; }
        return true; }
      case "nouser": return !userByName(m, c.name);
      case "group": { const x = groupByName(m, c.name); if (!x) return false; if (c.gid != null && x.gid !== c.gid) return false; return (c.members || []).every(n => x.members.includes(n)); }
      case "cwd": return m.cwd === normPath(m, c.path);
      case "env": return m.exported.has(c.name) === (c.exported !== false) && (c.value == null || m.env[c.name] === c.value);
      case "var": return c.regex ? new RegExp(c.regex).test(m.env[c.name] || "") && m.env[c.name] != null : c.value == null ? m.env[c.name] != null : m.env[c.name] === c.value;
      case "alias": return c.value == null ? m.aliases[c.name] != null : m.aliases[c.name] === c.value;
      case "sametime": { const a = st(c.path), b = st(c.other); return !!a && !!b && a.mtime === b.mtime; }
      case "nogroup": return !groupByName(m, c.name);
      case "whoami": return userById(m, m.realUid != null ? m.realUid : m.uid).name === c.name;
      case "history": { const re = new RegExp(c.regex); return m.history.some(h => re.test(h)); }
      case "last": return c.regex ? new RegExp(c.regex).test(m.lastOutput || "") : true;
      case "script": { const r = tryResolve(m, c.path); if (r.ino == null) return false; const copy = structuredClone(m); if (m.realUid != null) copy.uid = m.realUid; const out = api(copy).exec(c.path + (c.args ? " " + c.args : ""), { noHistory: true }).out; const r2 = api(copy).m.last; if (c.code != null && r2 !== c.code) return false; return c.output != null ? out === c.output : c.regex ? new RegExp(c.regex).test(out) : true; }
      case "proc": return m.procs.some(p => (c.cmd == null || p.cmd === c.cmd || p.comm === c.cmd) && (c.user == null || p.user === c.user) && (c.stat == null || p.stat[0] === c.stat));
      case "noproc": return !m.procs.some(p => p.cmd === c.cmd || p.comm === c.cmd);
      case "addr": { const l = m.net.links.find(x => x.name === c.dev); return !!l && l.addrs.includes(c.addr) === (c.present !== false); }
      case "route": { const t = c.v6 ? m.net.routes6 : m.net.routes; return t.some(r => r.dst === c.dst && (!c.via || r.via === c.via)) === (c.present !== false); }
      case "iface": { const l = m.net.links.find(x => x.name === c.dev); return !!l && (!c.state || l.state === c.state); }
      case "unit": { const u0 = (m.units || {})[c.name] || { active: true, enabled: true }; return (c.active == null || u0.active === c.active) && (c.enabled == null || u0.enabled === c.enabled); }
      case "novar": return m.env[c.name] == null;
      case "shell": return m.stack.length === (c.depth || 0) && (c.user == null || userById(m, m.realUid != null ? m.realUid : m.uid).name === c.user);
      case "located": return m.locateDb.includes(c.path);
      case "all": return c.checks.every(x => evalCheck(m, x));
      case "not": return !evalCheck(m, c.check);
      case "any": return c.checks.some(x => evalCheck(m, x));
      default: return false;
    }
  }

  return { createMachine, ShellError, version: "1.0" };
});
