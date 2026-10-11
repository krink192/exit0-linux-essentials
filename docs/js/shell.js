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
  class ExitSignal { constructor(code) { this.code = code; } }

  function createMachine(opts) {
    opts = opts || {};
    const m = {
      inodes: new Map(), nextIno: 1000, rootIno: 0,
      users: [], groups: [], passwords: {},
      uid: 1000, stack: [], env: {}, exported: new Set(), aliases: {}, history: [],
      cwd: "/", last: 0, args: [], scriptName: "bash", now: opts.now || Date.now(), hostname: opts.hostname || "lab",
      sudoers: new Set(["sudo"]), editRequest: null,
    };
    m.rootIno = mkInode(m, "dir", 0o755, 0, 0);
    const base = [
      ["d", "/bin"], ["d", "/boot"], ["d", "/dev"], ["d", "/etc"], ["d", "/etc/skel"], ["d", "/etc/ssh"], ["d", "/home"],
      ["d", "/opt"], ["d", "/proc"], ["d", "/root", 0o700], ["d", "/srv"], ["d", "/sys"], ["d", "/tmp", 0o1777], ["d", "/usr"],
      ["d", "/usr/bin"], ["d", "/usr/share"], ["d", "/usr/share/doc"], ["d", "/usr/share/doc/bash"], ["d", "/var"], ["d", "/var/log"],
      ["d", "/var/tmp", 0o1777], ["d", "/var/www"],
      ["f", "/etc/hostname", 0o644, m.hostname + "\n"],
      ["f", "/etc/hosts", 0o644, "127.0.0.1\tlocalhost\n127.0.1.1\t" + m.hostname + "\n10.0.0.5\tintranet.example.com intranet\n"],
      ["f", "/etc/resolv.conf", 0o644, "nameserver 1.1.1.1\nnameserver 9.9.9.9\n"],
      ["f", "/etc/os-release", 0o644, 'NAME="exit 0 lab"\nID=lab\nPRETTY_NAME="exit 0 lab system (simulated)"\n'],
      ["f", "/etc/fstab", 0o644, "# <file system> <mount point> <type> <options> <dump> <pass>\n/dev/sda2  /          ext4  defaults  0 1\n/dev/sda1  /boot/efi  vfat  umask=0077  0 1\n"],
      ["f", "/etc/sudoers", 0o440, "root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL\n"],
      ["f", "/etc/passwd", 0o644, ""], ["f", "/etc/group", 0o644, ""], ["f", "/etc/shadow", 0o640, "", 0, 42],
      ["f", "/etc/skel/.bashrc", 0o644, "# ~/.bashrc: executed by bash for interactive shells\nalias ll='ls -l'\n"],
      ["f", "/etc/skel/.profile", 0o644, "# ~/.profile: executed by login shells\n"],
      ["f", "/etc/ssh/sshd_config", 0o644, "Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n"],
      ["f", "/usr/share/doc/bash/README", 0o644, "This is GNU Bash. Documentation for the lab shell lives in the exit 0 app.\n"],
      ["f", "/var/log/syslog", 0o640, "Oct 10 09:00:01 lab systemd[1]: Started Daily apt download activities.\nOct 10 09:12:44 lab kernel: usb 1-1: new high-speed USB device number 3\nOct 10 09:12:45 lab kernel: sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks\n", 0, 4],
      ["f", "/var/log/auth.log", 0o640, "Oct 10 09:12:01 lab sshd[2210]: Failed password for root from 203.0.113.7 port 51234 ssh2\nOct 10 09:15:22 lab sudo: student : TTY=pts/0 ; PWD=/home/student ; USER=root ; COMMAND=/usr/bin/apt update\n", 0, 4],
      ["f", "/boot/vmlinuz", 0o644, "\u0000(kernel image)"],
      ["f", "/boot/initrd.img", 0o644, "\u0000(initial ram disk)"],
    ];
    for (const [t, p, mode, data, uid, gid] of base) {
      if (t === "d") mkdirP(m, p, mode || 0o755, 0, 0);
      else writeNew(m, p, data, mode, uid || 0, gid || 0);
    }
    const nul = mkInode(m, "char", 0o666, 0, 0); linkInto(m, m.rootIno, "/dev", "null", nul);
    m.groups = [g("root", 0), g("daemon", 1), g("adm", 4, ["student"]), g("shadow", 42), g("sudo", 27, ["student"]), g("www-data", 33), g("users", 100), g("student", 1000)];
    m.users = [u("root", 0, 0, "root", "/root", "/bin/bash"), u("daemon", 1, 1, "daemon", "/usr/sbin", "/usr/sbin/nologin"),
               u("www-data", 33, 33, "www-data", "/var/www", "/usr/sbin/nologin"), u("student", 1000, 1000, "Lab Student,,,", "/home/student", "/bin/bash")];
    m.passwords = { root: "locked", daemon: "none", "www-data": "none", student: "set" };
    mkdirP(m, "/home/student", 0o755, 1000, 1000);
    writeNew(m, "/home/student/.bashrc", "# ~/.bashrc\nalias ll='ls -l'\n", 0o644, 1000, 1000);
    writeNew(m, "/home/student/.profile", "# ~/.profile\n", 0o644, 1000, 1000);
    m.aliases = { ll: "ls -l" };
    m.env = { HOME: "/home/student", USER: "student", LOGNAME: "student", SHELL: "/bin/bash", PATH: "/usr/local/bin:/usr/bin:/bin",
              PWD: "/home/student", LANG: "C.UTF-8", TERM: "xterm-256color", HOSTNAME: m.hostname };
    ["HOME", "USER", "LOGNAME", "SHELL", "PATH", "PWD", "LANG", "TERM"].forEach(k => m.exported.add(k));
    m.cwd = "/home/student";
    if (opts.setup) applySetup(m, opts.setup);
    return api(m);
  }
  function g(name, gid, members) { return { name, gid, members: members || [] }; }
  function u(name, uid, gid, comment, home, shell) { return { name, uid, gid, comment, home, shell }; }

  function mkInode(m, type, mode, uid, gid) {
    const ino = m.nextIno++;
    m.inodes.set(ino, { ino, type, mode, uid, gid, mtime: m.now, nlink: type === "dir" ? 2 : 1, data: "", entries: type === "dir" ? new Map() : null, target: null, blob: null });
    return ino;
  }
  const node = (m, ino) => m.inodes.get(ino);

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
      else writeNew(m, path, f.data == null ? "" : f.data, f.mode == null ? 0o644 : f.mode, owner.uid, grp.gid, !path.startsWith("/etc") && !path.startsWith("/var/log"));
    }
    if (s.cwd) m.cwd = normPath(m, s.cwd.replace(/^~/, "/home/" + us.name));
    if (us.uid !== 1000) switchUser(m, us, false);
    if (s.cwd) m.env.PWD = m.cwd;
  }
  function nextUid(m) { let n = 1001; while (m.users.some(x => x.uid === n) || m.groups.some(x => x.gid === n)) n++; return n; }
  function switchUser(m, us, push) {
    if (push) m.stack.push({ uid: m.uid, cwd: m.cwd, env: Object.assign({}, m.env) });
    m.uid = us.uid; Object.assign(m.env, { HOME: us.home, USER: us.name, LOGNAME: us.name, SHELL: us.shell });
  }

  // ================================================================ lexer
  // Produces tokens: {t:"w", parts:[{s, q:"n"|"s"|"d"}]} words, {t:"op", v} operators, {t:"nl"} newlines.
  function lex(src) {
    const toks = []; let i = 0; let word = null;
    const flush = () => { if (word) { toks.push(word); word = null; } };
    const add = (s, qk) => { word = word || { t: "w", parts: [] }; const last = word.parts[word.parts.length - 1]; if (last && last.q === qk) last.s += s; else word.parts.push({ s, q: qk }); };
    while (i < src.length) {
      const c = src[i];
      if (c === "\\" && i + 1 < src.length) { if (src[i + 1] === "\n") { i += 2; continue; } add(src[i + 1], "s"); i += 2; continue; }
      if (c === "'") { const j = src.indexOf("'", i + 1); if (j < 0) throw new ShellError("unexpected EOF while looking for matching `''", 2); add(src.slice(i + 1, j), "s"); i = j + 1; continue; }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < src.length && src[j] !== '"') {
          if (src[j] === "\\" && j + 1 < src.length && '$`"\\\n'.includes(src[j + 1])) { s += src[j + 1] === "$" ? "\u0001" : src[j + 1]; j += 2; continue; }
          if (src[j] === "$" && src[j + 1] === "(") { const k = matchParen(src, j + 1); s += src.slice(j, k + 1); j = k + 1; continue; }
          s += src[j++];
        }
        if (j >= src.length) throw new ShellError("unexpected EOF while looking for matching `\"'", 2);
        add(s, "d"); if (!word.parts.length) add("", "d"); i = j + 1; continue;
      }
      if (c === "$" && src[i + 1] === "(") { const k = matchParen(src, i + 1); add(src.slice(i, k + 1), "n"); i = k + 1; continue; }
      if (c === "#" && !word) { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "\n") { flush(); toks.push({ t: "nl" }); i++; continue; }
      if (c === " " || c === "\t") { flush(); i++; continue; }
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
    return toks;
  }
  function matchParen(src, start) {
    let depth = 0;
    for (let k = start; k < src.length; k++) { if (src[k] === "(") depth++; else if (src[k] === ")") { depth--; if (!depth) return k; } }
    throw new ShellError("unexpected EOF while looking for matching `)'", 2);
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
      if (!t) throw new ShellError("syntax error: unexpected end of file", 2);
      if (isKw(t, "if")) { i++; const clauses = []; let cond = list(["then"]); expect("then"); let body = list(["elif", "else", "fi"]); clauses.push([cond, body]);
        while (isKw(peek(), "elif")) { i++; cond = list(["then"]); expect("then"); body = list(["elif", "else", "fi"]); clauses.push([cond, body]); }
        let otherwise = null; if (isKw(peek(), "else")) { i++; otherwise = list(["fi"]); } expect("fi"); return withRedirs({ type: "if", clauses, otherwise }); }
      if (isKw(t, "for")) { i++; const v = toks[i++]; if (!v || v.t !== "w") throw new ShellError("syntax error near `for'", 2); let words = null;
        skipNl(); if (isKw(peek(), "in")) { i++; words = []; while (peek() && peek().t === "w") words.push(toks[i++]); }
        skipSep(); expect("do"); const body = list(["done"]); expect("done"); return withRedirs({ type: "for", name: wordText(v), words, body }); }
      if (isKw(t, "while") || isKw(t, "until")) { const until = isKw(t, "until"); i++; const cond = list(["do"]); expect("do"); const body = list(["done"]); expect("done"); return withRedirs({ type: "while", cond, body, until }); }
      if (t.t === "op" && t.v !== "<" && t.v !== ">" && t.v !== ">>" && t.v !== "2>" && t.v !== "2>>" && t.v !== "&>" && t.v !== "&>>" && t.v !== "2>&1") throw new ShellError("syntax error near unexpected token `" + t.v + "'", 2);
      if (t.t === "w" && KEYWORDS.has(wordText(t)) && t.parts[0].q === "n" && !["in"].includes(wordText(t))) throw new ShellError("syntax error near unexpected token `" + wordText(t) + "'", 2);
      const words = [], redirs = [], assigns = [];
      while (peek() && (peek().t === "w" || (peek().t === "op" && /^(<|>|>>|2>|2>>|&>|&>>|2>&1)$/.test(peek().v)))) {
        const k = toks[i++];
        if (k.t === "op") { if (k.v === "2>&1") { redirs.push({ op: "2>&1" }); continue; } const target = toks[i++]; if (!target || target.t !== "w") throw new ShellError("syntax error near unexpected token `newline'", 2); redirs.push({ op: k.v, target }); continue; }
        if (!words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(wordText(k)) && k.parts[0].q === "n") { assigns.push(k); continue; }
        words.push(k);
      }
      return { type: "simple", words, redirs, assigns };
    }
    function withRedirs(c) { c.redirs = []; while (peek() && peek().t === "op" && /^(<|>|>>|2>|2>>|&>|&>>|2>&1)$/.test(peek().v)) { const k = toks[i++]; if (k.v === "2>&1") c.redirs.push({ op: "2>&1" }); else c.redirs.push({ op: k.v, target: toks[i++] }); } return c; }
    function skipNl() { while (peek() && peek().t === "nl") i++; }
    function expect(k) { skipSep(); if (!isKw(peek(), k)) throw new ShellError("syntax error: expected `" + k + "'", 2); i++; }
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
      if (name === "$") return "4242";
      if (name === "0") return m.scriptName;
      if (/^[0-9]+$/.test(name)) return m.args[+name - 1] || "";
      if (name.includes(":-")) { const [n, d] = name.split(":-"); return m.env[n] || d; }
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
        if (!opts.noHistory) {
          const hx = historyExpand(m, line);
          if (hx.error) { m.last = 1; m.lastOutput = "bash: " + hx.error + ": event not found\n"; return { out: m.lastOutput, code: 1, edit: null }; }
          if (hx.changed) { line = hx.line; ctx.out += line + "\n"; }
          if (line.trim()) m.history.push(line);
        }
        try {
          const tree = parse(lex(line));
          m.last = runList(m, tree, ctx, { stdin: "" });
        } catch (e) {
          if (e instanceof ExitSignal) { ctx.exit = true; m.last = e.code; }
          else if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; m.last = e.code; }
          else throw e;
        }
        if (ctx.exit) { const back = m.stack.pop(); if (back) { m.uid = back.uid; m.cwd = back.cwd; m.env = back.env; ctx.out += "logout\n"; } else ctx.out += "logout\n(lab: this is the main lab shell, so it stays open)\n"; ctx.exit = false; }
        m.lastOutput = ctx.out;
        const edit = m.editRequest; m.editRequest = null;
        return { out: ctx.out, code: m.last, edit };
      },
      prompt() { const us = userById(m, m.uid); const home = m.env.HOME; let p = m.cwd; if (p === home) p = "~"; else if (home !== "/" && p.startsWith(home + "/")) p = "~" + p.slice(home.length);
        return { user: us.name, host: m.hostname, path: p, sym: m.uid === 0 ? "#" : "$" }; },
      complete(line) { return complete(m, line); },
      writeFile(path, data) { return editorSave(m, path, data); },
      readFileForEdit(path) { const r = tryResolve(m, path); if (r.ino == null) return ""; const n = node(m, r.ino); return n.type === "file" ? n.data : ""; },
      check(c) { return c.type === "script" ? evalCheck(m, c) : asRoot(m, () => evalCheck(m, c)); },
      // helpers for tests and checks
      stat(path, follow) { const r = asRoot(m, () => tryResolve(m, path, { follow: follow !== false })); if (r.ino == null) return null; const n = node(m, r.ino);
        return { type: n.type, mode: n.mode, perms: modeString(n), owner: (userById(m, n.uid) || {}).name || String(n.uid), group: (groupById(m, n.gid) || {}).name || String(n.gid), ino: n.ino, nlink: n.nlink, data: n.data, target: n.target, blob: n.blob, size: sizeOf(n) }; },
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
      const us = userById(m, m.uid);
      const ino = mkInode(m, "file", 0o644 & ~0o022, us.uid, us.gid); d.entries.set(r.name, ino);
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
    try { for (const w of c.words) argv.push(...expandWord(m, w, ctx)); }
    catch (e) { if (e instanceof ShellError) { ctx.out += "bash: " + e.message + "\n"; return e.code; } throw e; }
    const assigns = c.assigns.map(a => { const t = wordText({ parts: [a.parts[0]] }); const eq = t.indexOf("="); const name = t.slice(0, eq);
      const rest = { parts: [{ s: t.slice(eq + 1), q: "n" }].concat(a.parts.slice(1)) }; return [name, expandWord(m, rest, ctx, true).join(" ")]; });
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
      const items = c.words ? [].concat(...c.words.map(w => expandWord(m, w, ctx))) : m.args.slice();
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
    return contentOf(m, n, normPath(m, path));
  }
  function contentOf(m, n, path) {
    if (path === "/etc/passwd") return m.users.map(x => [x.name, "x", x.uid, x.gid, x.comment, x.home, x.shell].join(":")).join("\n") + "\n";
    if (path === "/etc/group") return m.groups.map(x => [x.name, "x", x.gid, x.members.join(",")].join(":")).join("\n") + "\n";
    if (path === "/etc/shadow") return m.users.map(x => { const p = m.passwords[x.name]; const h = p === "set" ? "$6$lab$Zm9vYmFy" : p === "locked-set" ? "!$6$lab$Zm9vYmFy" : p === "locked" ? "!" : "*"; return [x.name, h, "20000", "0", "99999", "7", "", "", ""].join(":"); }).join("\n") + "\n";
    if (n.blob) return binaryText(n.blob);
    return n.data;
  }
  function binaryText(b) { return b.kind === "gzip" ? "\u001f\u008b\b\u0000(gzip-compressed data)\n" : b.kind === "bzip2" ? "BZh91AY&SY(bzip2-compressed data)\n" : b.kind === "xz" ? "ý7zXZ\u0000(xz-compressed data)\n" : b.kind === "zip" ? "PK\u0003\u0004(zip archive)\n" : "(tar archive)\n"; }
  function sizeOf(n) {
    if (n.type === "dir") return 4096;
    if (n.type === "link") return n.target.length;
    if (n.blob) return 120 + JSON.stringify(n.blob).length % 900;
    return bytes(n.data);
  }
  function modeString(n) {
    const t = { dir: "d", link: "l", char: "c", file: "-" }[n.type] || "-";
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
  function dispatch(m, argv, io, ctx) {
    let name = argv[0];
    if (m.aliases[name] && ctx.interactive !== false) { const ex = lex(m.aliases[name]).filter(t => t.t === "w").map(wordText); argv = ex.concat(argv.slice(1)); name = argv[0]; }
    if (name.includes("/")) return runScript(m, name, argv.slice(1), io, true);
    const fn = CMDS[name];
    if (!fn) {
      if (name === "vi" || name === "vim" || name === "nano") return openEditor(m, argv, io);
      io.err("bash: " + name + ": command not found\n"); return 127;
    }
    if (argv[1] === "--help" && HELP[name]) { io.out(HELP[name] + "\n"); return 0; }
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
      if (stop || a === "-" || !a.startsWith("-") || /^-\d/.test(a) && !spec.num) { rest.push(a); continue; }
      if (a === "--") { stop = true; continue; }
      if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); const map = (spec.long || {})[k]; if (!map) throw new ShellError(spec.name + ": unrecognized option '" + a + "'\nTry '" + spec.name + " --help' for more information.", spec.badCode || 1);
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
    let fmt = args[0].replace(/\\n/g, "\n").replace(/\\t/g, "\t"); let rest = args.slice(1), out = "";
    do { let k = 0; out += fmt.replace(/%([sd%])/g, (_, t) => t === "%" ? "%" : t === "d" ? String(parseInt(rest[k++], 10) || 0) : (rest[k++] || "")); rest = rest.slice((fmt.match(/%[sd]/g) || []).length); } while (rest.length && /%[sd]/.test(fmt));
    io.out(out);
  };
  CMDS.export = (m, args) => { for (const a of args) { if (a === "-p") continue; const eq = a.indexOf("="); if (eq > 0) { m.env[a.slice(0, eq)] = a.slice(eq + 1); m.exported.add(a.slice(0, eq)); } else m.exported.add(a); } };
  CMDS.unset = (m, args) => { args.forEach(a => { delete m.env[a]; m.exported.delete(a); }); };
  CMDS.env = (m, args, io) => { if (args.length) return dispatch(m, args, io, {}); io.out(Object.keys(m.env).filter(k => m.exported.has(k)).sort().map(k => k + "=" + m.env[k]).join("\n") + "\n"); };
  CMDS.printenv = (m, args, io) => { if (args.length) { const v = m.exported.has(args[0]) ? m.env[args[0]] : undefined; if (v == null) return 1; io.out(v + "\n"); return 0; } return CMDS.env(m, [], io); };
  CMDS.history = (m, args, io) => { const h = m.history; const n = args[0] ? +args[0] : h.length; h.slice(-n).forEach((l, i) => io.out(pad(h.length - Math.min(n, h.length) + i + 1, 5) + "  " + l + "\n")); };
  CMDS.alias = (m, args, io) => { if (!args.length) { Object.keys(m.aliases).sort().forEach(k => io.out("alias " + k + "='" + m.aliases[k] + "'\n")); return; } for (const a of args) { const eq = a.indexOf("="); if (eq > 0) m.aliases[a.slice(0, eq)] = a.slice(eq + 1); else if (m.aliases[a]) io.out("alias " + a + "='" + m.aliases[a] + "'\n"); else { io.err("bash: alias: " + a + ": not found\n"); return 1; } } };
  CMDS.unalias = (m, args) => { args.forEach(a => delete m.aliases[a]); };
  const BUILTINS = new Set(["cd", "pwd", "echo", "printf", "export", "unset", "history", "alias", "unalias", "type", "exit", "logout", "test", "[", "true", "false", "source", ".", "help", "read"]);
  CMDS.type = (m, args, io) => {
    let code = 0;
    for (const a of args) {
      if (m.aliases[a]) io.out(a + " is aliased to `" + m.aliases[a] + "'\n");
      else if (KEYWORDS.has(a)) io.out(a + " is a shell keyword\n");
      else if (BUILTINS.has(a)) io.out(a + " is a shell builtin\n");
      else if (CMDS[a] || ["vi", "vim", "nano"].includes(a)) io.out(a + " is /usr/bin/" + a + "\n");
      else { io.err("bash: type: " + a + ": not found\n"); code = 1; }
    }
    return code;
  };
  CMDS.which = (m, args, io) => { let code = 0; for (const a of args) { if (CMDS[a] && !BUILTINS.has(a) || ["vi", "vim", "nano"].includes(a)) io.out("/usr/bin/" + a + "\n"); else code = 1; } return code; };
  CMDS.true = () => 0; CMDS.false = () => 1;
  CMDS.exit = (m, args) => { throw new ExitSignal(args[0] != null ? (+args[0] & 255) : m.last); };
  CMDS.logout = CMDS.exit;
  CMDS.clear = (m, args, io) => { io.out("\u001bc"); };
  CMDS.read = (m, args, io) => { const ln = lines(io.stdin)[0]; if (ln == null) return 1; const names = args.filter(a => !a.startsWith("-")); const parts = ln.split(/\s+/); names.forEach((n, i) => { m.env[n] = i === names.length - 1 ? parts.slice(i).join(" ") : parts[i] || ""; }); return 0; };
  CMDS.help = (m, args, io) => { io.out("exit 0 lab shell (simulated Bash). Builtins: " + [...BUILTINS].sort().join(" ") + "\nCommands: " + Object.keys(CMDS).filter(k => !BUILTINS.has(k)).sort().join(" ") + "\nEditors: nano, vi (open an editor panel)\n"); };
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
        case "-s": return !!n && sizeOf(n) > 0;
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
  CMDS.bash = (m, args, io) => { if (!args.length) { io.err("bash: interactive sub-shells aren't simulated in the lab; run a script with 'bash script.sh'\n"); return 1; } if (args[0] === "-c") { const sub = { out: "", interactive: false }; const saved = { env: Object.assign({}, m.env), cwd: m.cwd };
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
    m.editRequest = { path: normPath(m, file), editor: argv[0] };
    return 0;
  }

  // ---------------------------------------------------------------- files and directories
  function lsTime(t) { const d = new Date(t); return MONTHS[d.getMonth()] + " " + pad(d.getDate(), 2) + " " + pad(d.getHours(), 2).replace(" ", "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function human(n) { if (n < 1024) return String(n); const u = ["K", "M", "G", "T"]; let v = n, i = -1; do { v /= 1024; i++; } while (v >= 1024 && i < 3); return (v < 10 ? Math.ceil(v * 10) / 10 : Math.ceil(v)) + u[i]; }
  CMDS.ls = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "ls", flags: "laAhdRtSr1iF", badCode: 2, long: { all: "a", "almost-all": "A", "human-readable": "h", directory: "d", recursive: "R", reverse: "r" } });
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
      if (f.t) arr.sort((a, b) => b[1].mtime - a[1].mtime || cmpC(a[0], b[0]));
      else if (f.S) arr.sort((a, b) => sizeOf(b[1]) - sizeOf(a[1]) || cmpC(a[0], b[0]));
      else arr.sort((a, b) => cmpC(a[0], b[0]));
      if (f.r) arr.reverse(); return arr;
    };
    const fmt = (entries, showTotal) => {
      if (!entries.length) return showTotal && f.l ? "total 0\n" : "";
      if (f.l) {
        const rows = entries.map(([name, n]) => {
          const size = sizeOf(n);
          return [f.i ? String(n.ino) : null, modeString(n), String(n.nlink), (userById(m, n.uid) || {}).name || String(n.uid), (groupById(m, n.gid) || {}).name || String(n.gid),
                  n.type === "char" ? "1, 3" : f.h ? human(size) : String(size), lsTime(n.mtime), name + (n.type === "link" ? " -> " + n.target : "")];
        });
        const w = [0, 1, 2, 3, 4, 5].map(k => Math.max(...rows.map(r => (r[k] || "").length)));
        const total = entries.reduce((s, [, n]) => s + (n.type === "dir" ? 4 : n.type === "file" && sizeOf(n) ? Math.ceil(sizeOf(n) / 4096) * 4 : 0), 0);
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
            if (next == null) { if (!can(m, d, 3)) throw new ShellError("mkdir: cannot create directory " + cq(curPath.replace(/^\//, p.startsWith("/") ? "/" : "")) + ": Permission denied"); next = mkInode(m, "dir", 0o755, us.uid, us.gid); d.entries.set(part, next); d.nlink++; if (f.v) io.out("mkdir: created directory " + q(curPath) + "\n"); }
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
      const ino = mkInode(m, "dir", f.m ? parseInt(f.m, 8) : 0o755, us.uid, us.gid); d.entries.set(r.name, ino); d.nlink++;
      if (f.v) io.out("mkdir: created directory " + q(p) + "\n");
    }
    return code;
  };
  CMDS.rmdir = (m, args, io) => {
    const { rest } = parseOpts(args, { name: "rmdir", flags: "pv", long: {} });
    if (!rest.length) throw new ShellError("rmdir: missing operand\nTry 'rmdir --help' for more information.", 1);
    let code = 0;
    for (const p of rest) {
      const r = tryResolve(m, p, { follow: false });
      if (r.ino == null) { io.err("rmdir: failed to remove " + q(p) + ": No such file or directory\n"); code = 1; continue; }
      const n = node(m, r.ino);
      if (n.type !== "dir") { io.err("rmdir: failed to remove " + q(p) + ": Not a directory\n"); code = 1; continue; }
      if (n.entries.size) { io.err("rmdir: failed to remove " + q(p) + ": Directory not empty\n"); code = 1; continue; }
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
      const ino = mkInode(m, "file", 0o644, us.uid, us.gid); d.entries.set(r.name, ino);
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
    const { flags: f, rest } = parseOpts(args, { name: "cp", flags: "rRiavfpn", long: { recursive: "r", interactive: "i", archive: "a", verbose: "v", force: "f" } });
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
        if (tn.type === "file" && sn.type === "file") { if (!can(m, tn, 2)) { io.err("cp: cannot create regular file " + q(target) + ": Permission denied\n"); code = 1; continue; } tn.data = sn.data; tn.blob = sn.blob ? JSON.parse(JSON.stringify(sn.blob)) : null; tn.mtime = m.now; if (f.v) io.out(q(s) + " -> " + q(target) + "\n"); continue; }
        if (tn.type === "dir" && sn.type === "dir") { for (const [k, child] of sn.entries) { const res = CMDS.cp(m, ["-r" + (f.a ? "a" : ""), (s.replace(/\/$/, "")) + "/" + k, target], io); if (res) code = res; } continue; }
      }
      if (!can(m, pd, 3)) { io.err("cp: cannot create " + (sn.type === "dir" ? "directory " : "regular file ") + q(target) + ": Permission denied\n"); code = 1; continue; }
      const c = cloneTree(m, sr.ino, !!(f.a || f.p)); pd.entries.set(tr.name, c); if (node(m, c).type === "dir") pd.nlink++;
      if (f.v) io.out(q(s) + " -> " + q(target) + "\n");
    }
    return code;
  };
  CMDS.mv = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "mv", flags: "ifvn", long: { interactive: "i", force: "f", verbose: "v" } });
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
  CMDS.readlink = (m, args, io) => { const p = args.filter(a => !a.startsWith("-"))[0]; const r = tryResolve(m, p, { follow: false }); if (r.ino == null || node(m, r.ino).type !== "link") return 1; io.out(node(m, r.ino).target + "\n"); };
  CMDS.stat = (m, args, io) => {
    const { flags: f, rest } = parseOpts(args, { name: "stat", flags: "c:L", long: { format: "c" } });
    let code = 0;
    for (const p of rest) {
      const r = tryResolve(m, p, { follow: !!f.L });
      if (r.ino == null) { io.err("stat: cannot statx " + q(p) + ": No such file or directory\n"); code = 1; continue; }
      const n = node(m, r.ino); const ms = modeString(n); const oct = (n.mode & 0o7777).toString(8);
      const un = (userById(m, n.uid) || {}).name, gn = (groupById(m, n.gid) || {}).name;
      if (f.c) { io.out(f.c.replace(/%([aAUGsnFhi])/g, (_, k) => ({ a: oct, A: ms, U: un, G: gn, s: String(sizeOf(n)), n: p, F: { dir: "directory", file: sizeOf(n) ? "regular file" : "regular empty file", link: "symbolic link", char: "character special file" }[n.type], h: String(n.nlink), i: String(n.ino) }[k])) + "\n"); continue; }
      io.out("  File: " + p + (n.type === "link" ? " -> " + n.target : "") + "\n  Size: " + sizeOf(n) + "\tInode: " + n.ino + "\tLinks: " + n.nlink + "\nAccess: (" + oct.padStart(4, "0") + "/" + ms + ")  Uid: (" + pad(n.uid, 5) + "/" + pad(un, 8) + ")   Gid: (" + pad(n.gid, 5) + "/" + pad(gn, 8) + ")\n");
    }
    return code;
  };
  CMDS.file = (m, args, io) => {
    for (const p of args) {
      const r = tryResolve(m, p, { follow: false });
      if (r.ino == null) { io.out(p + ": cannot open `" + p + "' (No such file or directory)\n"); continue; }
      const n = node(m, r.ino); let t;
      if (n.type === "dir") t = "directory"; else if (n.type === "link") t = "symbolic link to " + n.target; else if (n.type === "char") t = "character special (1/3)";
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
    if (!rest.length) { io.out(joinLines(lines(io.stdin).slice(0, n))); return 0; }
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
    const del = args[0] === "-d"; const sets = args.filter(a => a !== "-d");
    const expand = s => s.replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:digit:\]/g, "0-9").replace(/\\n/g, "\n").replace(/(.)-(.)/g, (_, a, b) => { let o = ""; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) o += String.fromCharCode(c); return o; });
    const a = expand(sets[0] || ""), b = expand(sets[1] || "");
    io.out([...io.stdin].map(c => { const i = a.indexOf(c); if (i < 0) return c; if (del) return ""; return b[Math.min(i, b.length - 1)] || ""; }).join(""));
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
  CMDS.sed = (m, args, io) => {
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
    let all = []; const code = inputs(m, rest, io, "sed", s2 => { all = all.concat(lines(s2)); });
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
    const { flags: f, rest } = parseOpts(args, { name: "grep", flags: "ivcnlrREwoqhe:", badCode: 2, long: { "ignore-case": "i", "invert-match": "v", count: "c", recursive: "r", "extended-regexp": "E" } });
    const pat = f.e != null ? f.e : rest.shift();
    if (pat == null) throw new ShellError("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2);
    const re = toRegex(pat, f.E, f.i, f.w); let files = rest; let any = false, code = 0;
    if ((f.r || f.R) && !files.length) files = ["."];
    if (f.r || f.R) { const out = []; files.forEach(p => { const r = tryResolve(m, p); if (r.ino == null) return; const walk = (path, ino) => { const n = node(m, ino); if (n.type === "dir") [...n.entries.keys()].sort(cmpC).forEach(k => walk(path.replace(/\/$/, "") + "/" + k, n.entries.get(k))); else if (n.type === "file") out.push(path); }; walk(p, r.ino); }); files = out; }
    const multi = files.length > 1 || f.r || f.R;
    const handle = (s, name) => {
      let n = 0;
      lines(s).forEach((l, idx) => { const hit = re.test(l) !== !!f.v; if (!hit) return; n++; any = true;
        if (f.c || f.l || f.q) return;
        const prefix = (multi && !f.h ? name + ":" : "") + (f.n ? (idx + 1) + ":" : "");
        if (f.o && !f.v) { const g2 = new RegExp(re.source, re.flags + "g"); (l.match(g2) || []).forEach(x => io.out(prefix + x + "\n")); } else io.out(prefix + l + "\n"); });
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
    const { flags: f, rest } = parseOpts(args, { name: "useradd", flags: "mMs:G:g:c:d:u:", badCode: 2, long: { "create-home": "m", shell: "s", groups: "G", gid: "g", comment: "c", home: "d", uid: "u" } });
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
    m.users.push(u(name, uid, primary.gid, f.c || "", home, f.s || "/bin/sh"));
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
    const { flags: f, rest } = parseOpts(args, { name: "passwd", flags: "lus", long: { lock: "l", unlock: "u", status: "S" } });
    const me = userById(m, m.uid); const name = rest[0] || me.name; const us = userByName(m, name);
    if (!us) throw new ShellError("passwd: user '" + name + "' does not exist", 1);
    if (us !== me && m.uid !== 0) throw new ShellError("passwd: You may not view or modify password information for " + name + ".", 1);
    if (f.l || f.u) { if (m.uid !== 0) throw new ShellError("passwd: Permission denied.", 1);
      if (f.l) m.passwords[name] = m.passwords[name] === "set" ? "locked-set" : "locked"; else if (m.passwords[name] === "locked-set") m.passwords[name] = "set";
      io.out("passwd: password changed.\n"); return 0; }
    m.passwords[name] = "set";
    io.out("New password: \nRetype new password: \npasswd: password updated successfully\n(lab: the password is set without typing it)\n"); return 0;
  };
  CMDS.chage = (m, args, io) => { const name = args[args.length - 1]; if (!userByName(m, name)) throw new ShellError("chage: user '" + name + "' does not exist in /etc/passwd", 1);
    if (m.uid !== 0 && userById(m, m.uid).name !== name) throw new ShellError("chage: Permission denied.", 1);
    io.out("Last password change\t\t\t\t\t: Oct 10, 2026\nPassword expires\t\t\t\t\t: never\nPassword inactive\t\t\t\t\t: never\nAccount expires\t\t\t\t\t\t: never\nMinimum number of days between password change\t\t: 0\nMaximum number of days between password change\t\t: 99999\nNumber of days of warning before password expires\t: 7\n"); };
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
  CMDS.w = (m, args, io) => { io.out(" 09:30:00 up 2 days,  3:12,  2 users,  load average: 0.08, 0.05, 0.01\nUSER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT\nstudent  tty2     -                08:01    1:29m  0.10s  0.05s -bash\nstudent  pts/0    192.168.1.20     09:15    0.00s  0.02s  0.00s w\n"); };
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
    const { flags: f, rest } = parseOpts(args, { name: "tar", flags: "cxtvf:zjJC:pr", badCode: 2, long: { create: "c", extract: "x", list: "t", verbose: "v", file: "f", gzip: "z", bzip2: "j", xz: "J", directory: "C" } });
    const modes = ["c", "x", "t", "r"].filter(k => f[k]);
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
        let rel = p.replace(/\/+$/, ""); if (rel.startsWith("/")) { rel = rel.replace(/^\/+/, ""); stripped = true; }
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
    if (r.ino == null) throw new ShellError("tar: " + file + ": Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now", 2);
    const an = node(m, r.ino);
    if (!can(m, an, 4)) throw new ShellError("tar: " + file + ": Cannot open: Permission denied\ntar: Error is not recoverable: exiting now", 2);
    const { layers, blob } = unwrap(an.blob);
    if (comp && layers[0] !== comp) throw new ShellError((comp === "gzip" ? "gzip: stdin: not in gzip format" : comp === "bzip2" ? "bzip2: (stdin) is not a bzip2 file." : "xz: (stdin): File format not recognized") + "\ntar: Child returned status 1\ntar: Error is not recoverable: exiting now", 2);
    if (!blob || blob.kind !== "tar") throw new ShellError("tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors", 2);
    if (f.t) { blob.entries.forEach(e => io.out(f.v ? modeString({ type: e.type, mode: e.mode }) + " student/student " + pad(e.type === "dir" ? 0 : bytes(e.data || ""), 6) + " 2026-10-10 09:00 " + e.path + "\n" : e.path + "\n")); return 0; }
    const base = f.C ? normPath(m, f.C) : m.cwd;
    const br = tryResolve(m, base); if (br.ino == null) throw new ShellError("tar: " + f.C + ": Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now", 2);
    const want = rest.map(p => p.replace(/\/+$/, ""));
    const us = userById(m, m.uid);
    for (const e of blob.entries) {
      const path = e.path.replace(/\/$/, "");
      if (want.length && !want.some(w => path === w || path.startsWith(w + "/"))) continue;
      if (f.v) io.out(e.path + "\n");
      const full = (base === "/" ? "" : base) + "/" + path;
      if (e.type === "dir") { const ino = mkdirPerm(m, full, io); if (ino) node(m, ino).mode = e.mode; continue; }
      mkdirPerm(m, dirname(full), io);
      const res = editorSave(m, full, e.data || ""); if (!res.ok) { io.err("tar: " + path + ": Cannot open: Permission denied\n"); continue; }
      const nn = node(m, resolve(m, full).ino); nn.mode = e.mode; nn.blob = e.blob || null; if (e.type === "link") { nn.type = "link"; nn.target = e.target; }
      nn.uid = us.uid; nn.gid = us.gid;
    }
    for (const w of want) if (!blob.entries.some(e => e.path.replace(/\/$/, "") === w || e.path.startsWith(w + "/"))) { io.err("tar: " + w + ": Not found in archive\ntar: Exiting with failure status due to previous errors\n"); return 2; }
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
      const { flags: f, rest } = parseOpts(args, { name: prog, flags: "dkcfvqr123456789zt", num: false, long: { decompress: "d", keep: "k", stdout: "c", force: "f", recursive: "r" } });
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
    const { flags: f, rest } = parseOpts(args, { name: "zip", flags: "rq9", long: { recurse: "r", quiet: "q" } });
    if (rest.length < 2) throw new ShellError("zip error: Nothing to do! (" + (rest[0] || "") + ")", 12);
    let file = rest[0]; if (!/\.zip$/.test(file)) file += ".zip";
    const entries = [];
    for (const p of rest.slice(1)) {
      const r = tryResolve(m, p); if (r.ino == null) { io.err("\tzip warning: name not matched: " + p + "\n"); continue; }
      const add = (path, ino) => { const n = node(m, ino); entries.push({ path: path + (n.type === "dir" ? "/" : ""), type: n.type, mode: n.mode, data: n.data, blob: n.blob });
        if (!f.q) io.out("  adding: " + path + (n.type === "dir" ? "/ (stored 0%)" : n.data ? " (deflated 32%)" : " (stored 0%)") + "\n");
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
  CMDS.date = (m, args, io) => { const d = new Date(m.now); if (args[0] === "+%F") { io.out(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "\n"); return; }
    io.out(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + MONTHS[d.getMonth()] + " " + pad(d.getDate(), 2) + " " + d.toTimeString().slice(0, 8) + " " + (m.env.TZ || "UTC") + " " + d.getFullYear() + "\n"); };
  CMDS.uname = (m, args, io) => { const a = args.join(""); const parts = { s: "Linux", n: m.hostname, r: "6.8.0-45-generic", m: "x86_64", o: "GNU/Linux" };
    if (!a) return io.out("Linux\n"); if (a.includes("a")) return io.out("Linux " + m.hostname + " 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\n");
    io.out([..."snrmo"].filter(k => a.includes(k)).map(k => parts[k]).join(" ") + "\n"); };
  CMDS.hostname = (m, args, io) => { io.out(m.hostname + "\n"); };
  CMDS.uptime = (m, args, io) => { io.out(" 09:30:00 up 2 days,  3:12,  2 users,  load average: 0.08, 0.05, 0.01\n"); };
  CMDS.free = (m, args, io) => { const h = args.includes("-h");
    io.out(h ? "               total        used        free      shared  buff/cache   available\nMem:           7.7Gi       2.1Gi       3.0Gi       180Mi       2.9Gi       5.6Gi\nSwap:          2.0Gi          0B       2.0Gi\n"
             : "               total        used        free      shared  buff/cache   available\nMem:         8048424     2201848     3145728      184320     3040848     5846576\nSwap:        2097148           0     2097148\n"); };
  CMDS.ps = (m, args, io) => { const me = userById(m, m.uid).name;
    if (args.length && /a|e/.test(args.join(""))) io.out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot           1  0.0  0.1 168500 12000 ?        Ss   Oct08   0:02 /sbin/init\nroot         612  0.0  0.1  15420  9100 ?        Ss   Oct08   0:00 sshd: /usr/sbin/sshd -D\nwww-data     780  0.0  0.2 125000 18000 ?        S    Oct08   0:01 nginx: worker process\nstudent     2301  0.0  0.0   8600  5200 pts/0    Ss   09:15   0:00 -bash\n" + pad(me, 7, true) + "     2399  0.0  0.0  10100  3300 pts/0    R+   09:30   0:00 ps " + args.join(" ") + "\n");
    else io.out("    PID TTY          TIME CMD\n   2301 pts/0    00:00:00 bash\n   2399 pts/0    00:00:00 ps\n"); };
  CMDS.top = (m, args, io) => { io.out("top - 09:30:00 up 2 days,  3:12,  2 users,  load average: 0.08, 0.05, 0.01\nTasks: 112 total,   1 running, 111 sleeping\n%Cpu(s):  1.2 us,  0.5 sy, 97.9 id\nMiB Mem :   7859.8 total,   3072.0 free,   2150.2 used,   2969.6 buff/cache\n\n    PID USER      PR  NI    VIRT    RES  %CPU  %MEM     TIME+ COMMAND\n      1 root      20   0  168500  12000   0.0   0.1   0:02.10 systemd\n    780 www-data  20   0  125000  18000   0.3   0.2   0:01.02 nginx\n(lab: top is interactive on a real system; press q to quit there)\n"); };
  CMDS.lsblk = (m, args, io) => { io.out("NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda      8:0    0 476.9G  0 disk\n├─sda1   8:1    0     1G  0 part /boot/efi\n└─sda2   8:2    0 475.9G  0 part /\nsr0     11:0    1  1024M  0 rom\n"); };
  CMDS.df = (m, args, io) => { io.out("Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda2       468G   61G  384G  14% /\n/dev/sda1       1.1G  6.1M  1.1G   1% /boot/efi\ntmpfs           3.9G     0  3.9G   0% /tmp\n"); };
  CMDS.dmesg = (m, args, io) => { if (m.uid !== 0) { io.err("dmesg: read kernel buffer failed: Operation not permitted\n"); return 1; } io.out("[    0.000000] Linux version 6.8.0-45-generic (buildd@lab)\n[    2.104511] e1000: eth0 NIC Link is Up 1000 Mbps Full Duplex\n[ 8723.551210] usb 1-1: new high-speed USB device number 3 using xhci_hcd\n[ 8724.602011] sd 2:0:0:0: [sdb] 31266816 512-byte logical blocks: (16.0 GB/14.9 GiB)\n[ 8724.610132]  sdb: sdb1\n"); };
  CMDS.ip = (m, args, io) => { const sub = (args[0] || "").replace(/^-\w+$/, "");
    if (/^a/.test(sub)) io.out("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n    inet6 ::1/128 scope host\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n    inet 192.168.1.42/24 brd 192.168.1.255 scope global dynamic eth0\n    inet6 fe80::5054:ff:fe12:3456/64 scope link\n");
    else if (/^r/.test(sub)) io.out("default via 192.168.1.1 dev eth0 proto dhcp metric 100\n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.42\n");
    else if (/^l/.test(sub)) io.out("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n");
    else { io.err("Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\nwhere  OBJECT := { address | link | route | ... }\n"); return 1; } };
  function lookup(m, name) { const hr = asRoot(m, () => tryResolve(m, "/etc/hosts")); const hosts = hr.ino != null ? node(m, hr.ino).data : ""; for (const l of lines(hosts)) { const p = l.split(/\s+/); if (p.slice(1).includes(name)) return p[0]; } return { "example.com": "93.184.215.14", "lpi.org": "65.39.134.165", "learning.lpi.org": "65.39.134.168", "github.com": "140.82.112.4" }[name]; }
  CMDS.ping = (m, args, io) => { const host = args.filter(a => !a.startsWith("-") && !/^\d+$/.test(a))[0]; if (!host) { io.err("ping: usage error: Destination address required\n"); return 1; }
    const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : lookup(m, host); if (!ip) { io.err("ping: " + host + ": Name or service not known\n"); return 2; }
    const n = +(args[args.indexOf("-c") + 1]) || 4; io.out("PING " + host + " (" + ip + ") 56(84) bytes of data.\n"); for (let i = 1; i <= n; i++) io.out("64 bytes from " + ip + ": icmp_seq=" + i + " ttl=56 time=1" + i + ".2 ms\n");
    io.out("\n--- " + host + " ping statistics ---\n" + n + " packets transmitted, " + n + " received, 0% packet loss, time " + (n - 1) * 1001 + "ms\n"); };
  CMDS.host = (m, args, io) => { const name = args[0]; if (!name) { io.err("Usage: host [-aCdilrTvVw] hostname [server]\n"); return 1; }
    const ip = ["example.com", "lpi.org", "learning.lpi.org", "github.com"].includes(name) ? lookup(m, name) : null; if (!ip) { io.out("Host " + name + " not found: 3(NXDOMAIN)\n"); return 1; } io.out(name + " has address " + ip + "\n"); };
  CMDS.ss = (m, args, io) => { io.out("State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process\nLISTEN 0      128          0.0.0.0:22        0.0.0.0:*" + (m.uid === 0 && args.join("").includes("p") ? "     users:((\"sshd\",pid=612,fd=3))" : "") + "\nLISTEN 0      511          0.0.0.0:80        0.0.0.0:*" + (m.uid === 0 && args.join("").includes("p") ? "     users:((\"nginx\",pid=780,fd=6))" : "") + "\n"); };
  CMDS.netstat = (m, args, io) => { io.out("Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN\ntcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN\n"); };
  const MAN = {
    ls: "ls - list directory contents", cd: "cd - change the shell working directory (a Bash builtin; see help cd)", cp: "cp - copy files and directories", mv: "mv - move (rename) files",
    rm: "rm - remove files or directories", mkdir: "mkdir - make directories", chmod: "chmod - change file mode bits", chown: "chown - change file owner and group", tar: "tar - an archiving utility",
    grep: "grep - print lines that match patterns", passwd: "passwd - change user password", useradd: "useradd - create a new user or update default new user information", ln: "ln - make links between files",
  };
  CMDS.man = (m, args, io) => { const page = args.filter(a => !/^\d$/.test(a) && !a.startsWith("-"))[0]; if (!page) { io.err("What manual page do you want?\nFor example, try 'man man'.\n"); return 1; }
    if (args.includes("-k")) return CMDS.apropos(m, [page], io);
    io.out((MAN[page] ? MAN[page] + "\n\n" : "") + "(lab: full manual pages aren't installed in this simulated system. Try '" + page + " --help', or read the LPI lesson linked in the lab.)\n"); };
  CMDS.whatis = (m, args, io) => { let code = 0; for (const a of args) { if (MAN[a]) io.out(MAN[a].replace(" - ", " (1)               - ") + "\n"); else { io.out(a + ": nothing appropriate.\n"); code = 16; } } return code; };
  CMDS.apropos = (m, args, io) => { const k = (args[0] || "").toLowerCase(); const hits = Object.values(MAN).filter(v => v.toLowerCase().includes(k)); if (!hits.length) { io.out(k + ": nothing appropriate.\n"); return 16; } hits.forEach(v => io.out(v.replace(" - ", " (1)               - ") + "\n")); };
  CMDS.info = CMDS.man;
  CMDS.locate = (m, args, io) => { const ic = args.includes("-i"); const pat = args.filter(a => !a.startsWith("-"))[0]; if (!pat) { io.err("locate: no pattern to search for specified\n"); return 1; }
    const out = []; const walk = (path, ino) => { const n = node(m, ino); if ((ic ? path.toLowerCase().includes(pat.toLowerCase()) : path.includes(pat)) && path !== "") out.push(path); if (n.type === "dir") for (const [k, c] of n.entries) walk((path === "/" ? "" : path) + "/" + k, c); };
    walk("/", m.rootIno); io.out(joinLines(out.filter(p => p !== "/"))); return out.length ? 0 : 1; };
  CMDS.updatedb = (m, args, io) => { if (m.uid !== 0) { io.err("updatedb: can not open a temporary file for `/var/lib/plocate/plocate.db'\n"); return 1; } };
  CMDS.systemctl = (m, args, io) => { const unit = args[1] || "ssh"; if (args[0] === "status") { io.out("● " + unit + ".service\n     Loaded: loaded (/lib/systemd/system/" + unit + ".service; enabled)\n     Active: active (running) since Thu 2026-10-08 06:18:22 UTC; 2 days ago\n"); return 0; } if (m.uid !== 0) { io.err("Failed to " + args[0] + " " + unit + ".service: Access denied\nSee system logs and 'systemctl status " + unit + ".service' for details.\n"); return 1; } };
  CMDS.journalctl = (m, args, io) => { io.out("Oct 10 09:12:01 lab sshd[2210]: Failed password for root from 203.0.113.7 port 51234 ssh2\nOct 10 09:15:22 lab sshd[2301]: Accepted publickey for student from 192.168.1.20 port 50112 ssh2\n"); };
  HELP.ls = "Usage: ls [OPTION]... [FILE]...\n  -a  show all, including . and ..     -A  almost all (no . and ..)\n  -l  long listing                      -h  human-readable sizes (with -l)\n  -d  list directories themselves       -R  recursive\n  -t  sort by time                      -S  sort by size\n  -r  reverse order                     -i  show inode numbers";
  HELP.cp = "Usage: cp [OPTION]... SOURCE... DEST\n  -r  copy directories recursively      -i  ask before overwriting\n  -a  archive (keep modes and owners)   -v  verbose";
  HELP.rm = "Usage: rm [OPTION]... FILE...\n  -r  remove directories and their contents   -f  never prompt, ignore missing files\n  -i  prompt before every removal              -v  verbose";
  HELP.tar = "Usage: tar [OPTION...] [FILE]...\n  -c create   -x extract   -t list   -v verbose   -f FILE archive name\n  -z gzip     -j bzip2     -J xz     -C DIR change to DIR first";
  HELP.chmod = "Usage: chmod [OPTION]... MODE[,MODE]... FILE...\n  or:  chmod [OPTION]... OCTAL-MODE FILE...\nEach MODE is [ugoa]*([-+=]([rwxXst]*))+ .  -R  change files and directories recursively";
  HELP.grep = "Usage: grep [OPTION]... PATTERNS [FILE]...\n  -i ignore case   -v invert   -c count   -n line numbers   -r recursive   -E extended regex   -w whole words   -l files with matches";

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
      case "contains": { const n = st(c.path); if (!n || n.type !== "file") return false; const text = contentOf(m, n, normPath(m, c.path)); return c.regex ? new RegExp(c.regex, c.flags || "").test(text) : text.includes(c.text); }
      case "equals": { const n = st(c.path); return !!n && n.type === "file" && n.data === c.text; }
      case "lines": { const n = st(c.path); return !!n && n.type === "file" && lines(n.data).length === c.count; }
      case "link": { const r = tryResolve(m, c.path, { follow: false }); if (r.ino == null) return false; const n = node(m, r.ino); return n.type === "link" && (!c.target || n.target === c.target); }
      case "hardlink": { const a = st(c.path), b = st(c.other); return !!a && !!b && a === b; }
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
      case "var": return c.value == null ? m.env[c.name] != null : m.env[c.name] === c.value;
      case "whoami": return userById(m, m.uid).name === c.name;
      case "history": { const re = new RegExp(c.regex); return m.history.some(h => re.test(h)); }
      case "last": return c.regex ? new RegExp(c.regex).test(m.lastOutput || "") : true;
      case "script": { const r = tryResolve(m, c.path); if (r.ino == null) return false; const copy = structuredClone(m); if (m.realUid != null) copy.uid = m.realUid; const out = api(copy).exec(c.path + (c.args ? " " + c.args : ""), { noHistory: true }).out; return c.output != null ? out === c.output : new RegExp(c.regex).test(out); }
      case "all": return c.checks.every(x => evalCheck(m, x));
      case "any": return c.checks.some(x => evalCheck(m, x));
      default: return false;
    }
  }

  return { createMachine, ShellError, version: "1.0" };
});
