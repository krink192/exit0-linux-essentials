# SPDX-License-Identifier: AGPL-3.0-or-later
"""Build bank.json from the topic source files and lint it."""
import json, sys, os, collections, re
sys.path.insert(0, os.path.dirname(__file__))
from common import BANK, MARK
import t1, t2, t3, t4, t5, t6, t7  # noqa: F401  (populate BANK; t6 = harder pack; t7 = targeted set, form J)
from hints import HINTS
from whys import WHY

TOPICS = {
    "1": "The Linux Community and a Career in Open Source",
    "2": "Finding Your Way on a Linux System",
    "3": "The Power of the Command Line",
    "4": "The Linux Operating System",
    "5": "Security and File Permissions",
}
OBJ = {
    "1.1": ["Linux Evolution and Popular Operating Systems", 2],
    "1.2": ["Major Open Source Applications", 2],
    "1.3": ["Open Source Software and Licensing", 1],
    "1.4": ["ICT Skills and Working in Linux", 2],
    "2.1": ["Command Line Basics", 3],
    "2.2": ["Using the Command Line to Get Help", 2],
    "2.3": ["Using Directories and Listing Files", 2],
    "2.4": ["Creating, Moving and Deleting Files", 2],
    "3.1": ["Archiving Files on the Command Line", 2],
    "3.2": ["Searching and Extracting Data from Files", 3],
    "3.3": ["Turning Commands into a Script", 4],
    "4.1": ["Choosing an Operating System", 1],
    "4.2": ["Understanding Computer Hardware", 2],
    "4.3": ["Where Data is Stored", 3],
    "4.4": ["Your Computer on the Network", 2],
    "5.1": ["Basic Security and Identifying User Types", 2],
    "5.2": ["Creating Users and Groups", 2],
    "5.3": ["Managing File Permissions and Ownership", 2],
    "5.4": ["Special Directories and Files", 1],
}
FORMS = "ABCDEFGHI"   # the original nine 40-question sets, balanced by assign_forms()
FIXED = "J"           # added sets whose questions are pinned in the source (t7.py: analyze, scenario and lab-checked questions)
ALL_FORMS = FORMS + FIXED
WORDS = {2: "TWO", 3: "THREE"}


def lesson(o):
    t = o.split(".")[0]
    return f"https://learning.lpi.org/en/learning-materials/010-160/{t}/{o}/{o}_01/"


ANALYZE_CUES = ("what does this", "what is the output", "which lines", "what happens", "what are its permissions",
                "where do you end up", "which files does", "which statement is true?", "match", "print when run")


def difficulty(q):
    """1 = recall a fact, 2 = apply (choose or produce the right command/setting),
    3 = analyze (trace code, output, permissions or patterns to a result)."""
    text = q["q"].lower()
    if q.get("code") and any(c in text for c in ANALYZE_CUES):
        return 3
    if q["type"] == "fill" and "complete command" in text:
        return 3
    if any(c in text for c in ("which files does", "which of these complete lines", "which words match", "same network")):
        return 3
    if q["type"] in ("fill", "multi") or q.get("code") or text.startswith("which command") or "type the" in text:
        return 2
    return 1


def build():
    out, errors = [], []
    seen = collections.Counter()
    ids = set()
    for raw in BANK:
        o = raw["o"]
        seen[o] += 1
        n = seen[o]
        # IDs are written in the question files and never change (see tools/common.py), so progress saved by ID
        # still points at the same question after questions are added, moved or removed.
        if not re.fullmatch(r"\d\.\d-\d\d", raw["id"]):
            errors.append(f"{raw['id']}: a question ID looks like 3.2-07")
        if raw["id"] in ids:
            errors.append(f"{raw['id']}: used by two questions")
        ids.add(raw["id"])
        q = {
            "id": raw["id"],
            "obj": o,
            "form": raw.get("form") or FORMS[(n - 1) % len(FORMS)],
            "q": raw["q"].strip(),
            "code": raw.get("code"),
            "explanation": raw["ex"].strip(),
        }
        if raw.get("form") and raw["form"] not in FIXED:
            errors.append(f"{q['id']}: pinned to unknown form {raw['form']}")
        if raw["kind"] == "fill":
            q["type"] = "fill"
            q["accept"] = raw["acc"]
            if raw.get("lab"):
                q["lab"] = raw["lab"]
                if not raw["lab"].get("check"):
                    errors.append(f"{q['id']}: lab question without a check")
            if not raw["acc"]:
                errors.append(f"{q['id']}: no accepted answers")
        else:
            opts, ans = [], []
            for i, t in enumerate(raw["opts"]):
                if t.startswith(MARK):
                    ans.append(i)
                    t = t[len(MARK):]
                opts.append(t)
            if not ans:
                errors.append(f"{q['id']}: no correct option")
            if len(opts) < 4:
                errors.append(f"{q['id']}: fewer than 4 options")
            if len(set(opts)) != len(opts):
                errors.append(f"{q['id']}: duplicate options")
            q["options"], q["answer"] = opts, ans
            if len(ans) > 1:
                q["type"] = "multi"
                q["q"] += f" (Choose {WORDS[len(ans)]}.)"
            else:
                q["type"] = "single"
        q["level"] = raw.get("level") or difficulty(q)
        if raw.get("hint") and q["id"] in HINTS:
            errors.append(f"{q['id']}: hint both inline and in hints.py")
        q["hint"] = raw.get("hint") or HINTS.get(q["id"])
        if not q["hint"]:
            errors.append(f"{q['id']}: no hint in tools/hints.py")
        if q.get("options"):
            if raw.get("why") and q["id"] in WHY:
                errors.append(f"{q['id']}: why-notes both inline and in whys.py")
            notes = raw.get("why") or WHY.get(q["id"], {})
            for k in sorted(set(notes) - set(q["options"])):
                errors.append(f"{q['id']}: whys.py note for unknown option {k!r}")
            q["why"] = []
            for i, t in enumerate(q["options"]):
                if i in q["answer"]:
                    if t in notes:
                        errors.append(f"{q['id']}: whys.py has a note for the correct option {t!r}")
                    q["why"].append(None)
                else:
                    if not notes.get(t):
                        errors.append(f"{q['id']}: no whys.py note for wrong option {t!r}")
                    q["why"].append(notes.get(t))
        elif q["id"] in WHY or raw.get("why"):
            errors.append(f"{q['id']}: whys.py note on a fill-in question")
        q["_run"], q["_expect"], q["_user"] = raw.get("run"), raw.get("expect"), raw.get("user")
        out.append(q)

    for hid in sorted(set(HINTS) - {q["id"] for q in out}):
        errors.append(f"hints.py: {hid} is not a question ID")
    for wid in sorted(set(WHY) - {q["id"] for q in out}):
        errors.append(f"whys.py: {wid} is not a question ID")
    _, viol = assign_forms(out)
    for grp in viol:
        print("WARN conflict set shares a form:", grp)
    # Mark each conflict set on its questions, so the app never puts two of them in the same exam or study set.
    by_id = {q["id"]: q for q in out}
    for n, grp in enumerate(CONFLICTS, 1):
        if len({i.rsplit("-", 1)[0] for i in grp}) != 1:
            errors.append(f"CONFLICTS: {grp} spans more than one objective")
        for i in grp:
            if i not in by_id:
                errors.append(f"CONFLICTS: {i} is not a question ID")
            elif "conflict" in by_id[i]:
                errors.append(f"CONFLICTS: {i} is in two sets")
            else:
                by_id[i]["conflict"] = n

    # blueprint checks
    for o, (_, w) in OBJ.items():
        if seen[o] != len(ALL_FORMS) * w:
            errors.append(f"objective {o}: {seen[o]} questions, need {len(ALL_FORMS)*w}")
    for f in ALL_FORMS:
        fq = [q for q in out if q["form"] == f]
        if len(fq) != 40:
            errors.append(f"form {f}: {len(fq)} questions")
        c = collections.Counter(q["obj"] for q in fq)
        for o, (_, w) in OBJ.items():
            if c[o] != w:
                errors.append(f"form {f} objective {o}: {c[o]} != {w}")
    ids = [q["q"] for q in out]
    dup = [k for k, v in collections.Counter(ids).items() if v > 1 and not k.startswith("What does this")]
    for d in dup:
        errors.append("duplicate question text: " + d[:60])
    return out, errors


# Questions in the same set test the same narrow fact or give each other away,
# so the optimizer keeps them in different forms, and the app (core.js pickBy) never
# puts two of them in one exam or study set. A set stays inside one objective.
CONFLICTS = [
    ["1.1-05", "1.1-06"], ["1.1-03", "1.1-12", "1.1-08"], ["1.2-05", "1.2-06"], ["1.2-01", "1.2-11"], ["1.2-02", "1.2-04"],
    ["1.4-02", "1.4-05", "1.4-12"], ["1.4-08", "1.4-09"],
    ["2.1-02", "2.1-10", "2.1-11"], ["2.1-03", "2.1-15"], ["2.1-06", "2.1-17"], ["2.1-01", "2.1-04", "2.1-14"],
    ["2.2-04", "2.2-05", "2.2-06"], ["2.2-03", "2.2-09"], ["2.2-07", "2.2-08"],
    ["2.3-05", "2.3-07", "2.3-08"], ["2.3-01", "2.3-04"], ["2.3-03", "2.3-12", "2.3-02"],
    ["2.4-02", "2.4-07", "2.4-08"], ["2.4-01", "2.4-09"], ["2.4-03", "2.4-11"],
    ["3.1-01", "3.1-03", "3.1-06", "3.1-07", "3.1-11"], ["3.1-02", "3.1-05", "3.1-10", "3.1-12"], ["3.1-04", "3.1-09"],
    ["3.2-02", "3.2-05", "3.2-16"], ["3.2-03", "3.2-13", "3.2-14", "3.2-15", "3.2-18"], ["3.2-11", "3.2-12"], ["3.2-07", "3.2-08"], ["3.2-06", "3.2-10"],
    ["3.3-05", "3.3-13", "3.3-14", "3.3-15"], ["3.3-02", "3.3-06", "3.3-12", "3.3-24", "3.3-11"], ["3.3-03", "3.3-08", "3.3-16", "3.3-21"],
    ["3.3-17", "3.3-18"], ["3.3-01", "3.3-22"], ["3.3-09", "3.3-10"],
    ["4.2-01", "4.2-04", "4.2-10", "4.2-11"], ["4.2-06", "4.2-05"],
    ["4.3-03", "4.3-06", "4.3-11", "4.3-12", "4.3-13"], ["4.3-01", "4.3-02", "4.3-15", "4.3-16", "4.3-18"], ["4.3-04", "4.3-05", "4.3-09", "4.3-17"],
    ["4.4-01", "4.4-05"], ["4.4-03", "4.4-06"], ["4.4-02", "4.4-04", "4.4-10", "4.4-11"], ["4.4-08", "4.4-09"],
    ["5.1-03", "5.1-06", "5.1-12"], ["5.1-04", "5.1-08", "5.1-10"], ["5.1-02", "5.1-09", "5.1-11"],
    ["5.2-03", "5.2-09", "5.2-10", "5.2-12"], ["5.2-01", "5.2-06", "5.2-07"], ["5.2-02", "5.2-04"],
    ["5.3-02", "5.3-06", "5.3-12"], ["5.3-01", "5.3-03", "5.3-05", "5.3-10"],
    ["5.4-02", "5.4-05", "5.4-06"], ["5.4-01", "5.4-03"],
]


def assign_forms(out):
    """Split each objective's 9*w questions into nine forms of w each,
    balancing question types across forms and keeping conflict sets apart."""
    import random
    rnd = random.Random(10160)
    byobj = collections.defaultdict(list)
    for q in out:
        if q["form"] not in FIXED:          # pinned sets keep their questions
            byobj[q["obj"]].append(q)
    cset = {}
    for i, grp in enumerate(CONFLICTS):
        for qid in grp:
            cset.setdefault(qid, []).append(i)

    byid = {q["id"]: q for q in out}
    groups = [[byid[i] for i in grp if i in byid] for grp in CONFLICTS]
    totals = collections.Counter(q["type"] for q in out if q["form"] not in FIXED)

    def score():
        s = 0.0
        c = collections.Counter((q["form"], q["type"]) for q in out)
        for t in ("single", "multi", "fill"):
            m = totals[t] / len(FORMS)
            s += sum((c[(f, t)] - m) ** 2 for f in FORMS)
        for grp in groups:
            fs = collections.Counter(q["form"] for q in grp)
            s += 100 * sum(v - 1 for v in fs.values() if v > 1)
        return s

    best = score()
    objs = list(byobj)
    for _ in range(40000):
        o = rnd.choice(objs)
        a, b = rnd.sample(byobj[o], 2)
        if a["form"] == b["form"]:
            continue
        a["form"], b["form"] = b["form"], a["form"]
        s = score()
        if s <= best:
            best = s
        else:
            a["form"], b["form"] = b["form"], a["form"]
    viol = []
    for grp in CONFLICTS:
        fs = collections.Counter(q["form"] for q in out if q["id"] in grp)
        if any(v > 1 for v in fs.values()):
            viol.append(grp)
    return best, viol


def stats(out):
    single = [q for q in out if q["type"] == "single"]
    longest = 0
    for q in single:
        L = [len(o) for o in q["options"]]
        a = q["answer"][0]
        if L[a] == max(L) and L.count(max(L)) == 1:
            longest += 1
    types = collections.Counter(q["type"] for q in out)
    print(f"questions: {len(out)}  types: {dict(types)}")
    print(f"single-answer items where the correct option is the unique longest: {longest}/{len(single)} ({longest/len(single):.0%}; chance with 4 options = 25%)")
    for f in ALL_FORMS:
        t = collections.Counter(q["type"] for q in out if q["form"] == f)
        print(f"  form {f}: {dict(t)}")
    return [q for q in single if (lambda L, a: L[a] == max(L) and L.count(max(L)) == 1)([len(o) for o in q["options"]], q["answer"][0])]


def asset_version(path):
    import hashlib
    return hashlib.sha256(open(path, "rb").read()).hexdigest()[:10]


def stamp_assets(docs):
    """Add ?v=<content hash> to every script and stylesheet in index.html, so browsers, the desktop apps' web views
    and GitHub Pages' CDN fetch a file again exactly when it changes instead of serving a stale cached copy."""
    import re
    path = os.path.join(docs, "index.html")
    html = open(path, encoding="utf-8").read()
    def sub(m):
        return '%s="%s?v=%s"' % (m.group(1), m.group(2), asset_version(os.path.join(docs, m.group(2))))
    new = re.sub(r'(src|href)="((?:js|data|css)/[\w.-]+\.(?:js|css))(?:\?v=\w+)?"', sub, html)
    if new != html:
        open(path, "w", encoding="utf-8").write(new)


def handson_items(bank):
    """Matching and ordering questions (tools/handson.py), checked and put in the shape the app reads:
    match: { id, obj, type, q, left: [...], right: [...], key: [index into right for each left], ex }
    order: { id, obj, type, q, items: [... in the right order], ex }"""
    import re
    import handson
    out, seen, bad = [], set(), []
    for it in handson.ITEMS:
        m = re.fullmatch(r"ix-(\d\.\d)-\d\d", it["id"])
        if not m or m.group(1) not in bank["objectives"]:
            bad.append(f"{it['id']}: a hands-on ID looks like ix-3.2-01 and names a real objective")
            continue
        if it["id"] in seen or it["q"] in seen:
            bad.append(f"{it['id']}: the ID or the question text is used twice")
        seen.update((it["id"], it["q"]))
        base = {"id": it["id"], "obj": m.group(1), "type": it["type"], "q": it["q"], "ex": it["ex"]}
        if it["type"] == "match":
            lefts = [l for l, _ in it["pairs"]]
            right = []
            for _, r in it["pairs"]:
                if r not in right:
                    right.append(r)
            if len(lefts) < 2 or len(set(lefts)) != len(lefts):
                bad.append(f"{it['id']}: needs at least two different left items")
            if any(x in right for x in it["extra"]):
                bad.append(f"{it['id']}: an extra choice is also a correct one")
            if len(right) + len(it["extra"]) < 2:
                bad.append(f"{it['id']}: needs at least two choices")
            base.update(left=lefts, right=right + it["extra"], key=[right.index(r) for _, r in it["pairs"]])
        else:
            if len(it["items"]) < 3 or len(set(it["items"])) != len(it["items"]):
                bad.append(f"{it['id']}: needs at least three different items")
            base.update(items=it["items"])
        out.append(base)
    if bad:
        raise SystemExit("hands-on questions:\n  " + "\n  ".join(bad))
    return out


def write_precache(docs, lazy):
    """List every file of this build in sw.js, so the service worker stores the whole app as one snapshot: index.html,
    the scripts and stylesheets it names (with their ?v= hashes), the lazily loaded files, the manifest, fonts and
    icons. The cache name is a hash of all of it, so any change makes a new snapshot."""
    import hashlib, re
    html = open(os.path.join(docs, "index.html"), encoding="utf-8").read()
    files = ["index.html"] + re.findall(r'(?:src|href)="((?:js|data|css)/[\w.-]+\.(?:js|css)\?v=\w+)"', html)
    files += ["%s?v=%s" % (f, v) for f, v in sorted(lazy.items())]
    static = ["manifest.webmanifest"] + sorted("%s/%s" % (d, n) for d in ("fonts", "icons") for n in os.listdir(os.path.join(docs, d))
                                                 if n.endswith((".woff2", ".png")))
    digest = hashlib.sha256()
    for f in files + static:
        digest.update(f.encode())
        if "?v=" not in f:
            digest.update(open(os.path.join(docs, f), "rb").read())
    block = ("// BEGIN GENERATED by tools/build.py (do not edit by hand; run the build after changing any file listed here)\n"
             'const CACHE = "exit0-%s";\nconst PRECACHE = %s;\n// END GENERATED' % (digest.hexdigest()[:10], json.dumps(files + static)))
    path = os.path.join(docs, "sw.js")
    sw = open(path, encoding="utf-8").read()
    new = re.sub(r"// BEGIN GENERATED.*?// END GENERATED", lambda m: block, sw, flags=re.S)
    if "// BEGIN GENERATED" not in sw:
        raise SystemExit("docs/sw.js has no GENERATED block")
    if new != sw:
        open(path, "w", encoding="utf-8").write(new)


def lab_index(bank, labs):
    """Light index of lab parts for the app shell, and question -> lab parts links.
    A question links to the parts of its own objective whose commands appear in the question's code: backtick
    spans, code blocks, typed answers and command-like options. Questions with no command in common (concepts,
    history, licences) get no link rather than a vague one."""
    import re
    parts = [{k: L[k] for k in ("id", "obj", "lesson", "lessonTitle", "title", "part", "parts", "url", "commands")} | {"n": len(L["tasks"]), **({"from": L["from"]} if L.get("from") else {}), **({"track": L["track"]} if L.get("track") else {})}
             for L in labs.LABS]
    by_obj = collections.defaultdict(list)
    for p in parts:
        by_obj[p["obj"]].append(p)
    links = {}
    for q in bank["questions"]:
        cands = by_obj.get(q["obj"])
        if not cands:
            continue
        code = []
        for field in [q.get("q", ""), q.get("explanation", ""), q.get("hint", "")] + [w for w in (q.get("why") or []) if w]:
            code += re.findall(r"`([^`]+)`", field)
        code += [q.get("code", "")] + list(q.get("accept", []))
        code += [o for o in q.get("options", []) if re.match(r"^(sudo )?[a-z][\w.+-]*( |$)", o) and (re.search(r"[-/|<>$]", o) or len(o.split()) <= 3)]
        words = set(re.findall(r"[A-Za-z][\w.+-]*", " ".join(code)))
        prose = (q.get("q", "") + " " + q.get("explanation", "")).lower()
        def score(p):   # commands the question uses, plus a little for words of the part's title (tie-breaker: "symbolic", "permissions")
            title = [w for w in re.findall(r"[a-z]{5,}", p["title"].lower()) if w not in ("files", "their", "about", "using")]
            return sum(1 for c in p["commands"] if c in words) + 0.4 * sum(1 for w in title if w[:-1] in prose)
        scored = sorted(((score(p), i, p["id"]) for i, p in enumerate(cands)), key=lambda x: (-x[0], x[1]))
        hits = [pid for sc, _, pid in scored if sc >= 1][:2]       # at least one command in common; no link beats a vague one
        if hits:
            links[q["id"]] = hits
    return {"parts": parts, "lessons": labs.LESSON_INDEX, "q": links}


def first_command(line):
    """The command a typed line starts with, skipping sudo and VAR=value (same rule as core.js firstCommand)."""
    words = line.strip().split()
    while words and (words[0] == "sudo" or re.match(r"^\w+=", words[0])):
        words.pop(0)
    return words[0].lstrip("./") if words else ""


def command_questions(bank, skills):
    """Command -> questions whose right answer is that command: typed answers, and multiple-choice questions whose
    correct option is a command line. Feeds the per-command mastery map alongside the drills."""
    cmds = {s["cmd"] for s in skills}
    out = collections.defaultdict(list)
    for q in bank["questions"]:
        if q["type"] == "fill":
            lines = q.get("accept", [])[:1]
        else:
            lines = [q["options"][i] for i in q.get("answer", []) if re.match(r"^(sudo )?[a-z][\w.+-]* [-\w~/.'\"|<>$]", q["options"][i])]
        for line in lines:
            c = first_command(line)
            if c in cmds and q["id"] not in out[c]:
                out[c].append(q["id"])
    return dict(sorted(out.items()))


def lab_commands(labs, skills):
    """Command -> {part id: [task indexes]} for lab tasks whose solution uses a command that has drills,
    so the mastery map can show how much of it you've used in labs."""
    cmds = {s["cmd"] for s in skills}
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    for L in labs.LABS:
        for i, t in enumerate(L["tasks"]):
            used = set()
            for line in t["solution"].split("\n"):
                for seg in re.split(r"\|\||&&|[|;]", line):
                    c = first_command(seg)
                    if c: used.add(c)
            for c in used & cmds:
                out[c][L["id"]].append(i)
    return {c: dict(v) for c, v in sorted(out.items())}


def build_web():
    """Write docs/data/bank.js and docs/data/cards.js for the web app (GitHub Pages).
    Plain <script> data files work from https:// and when index.html is opened from disk."""
    import cards as cardsrc
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    out = os.path.join(root, "docs", "data")
    os.makedirs(out, exist_ok=True)
    bank = json.load(open(os.path.join(root, "bank.json"), encoding="utf-8"))
    seen = collections.Counter()
    deck_cards = []
    for c in cardsrc.CARDS:
        key = (c["deck"], c["obj"])
        seen[key] += 1
        item = {"id": "%s-%s-%02d" % ("c" if c["deck"] == "concepts" else "k", c["obj"], seen[key]),
                "deck": c["deck"], "obj": c["obj"], "front": c["front"], "back": c["back"]}
        if c.get("ex"):
            item["ex"] = c["ex"]
        deck_cards.append(item)
    def dump(name, var, data):
        js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        with open(os.path.join(out, name), "w", encoding="utf-8") as fh:
            fh.write("// Generated by tools/build.py - do not edit by hand.\nwindow.%s = %s;\n" % (var, js))
    dump("bank.js", "LE_BANK", bank)
    dump("cards.js", "LE_CARDS", deck_cards)
    import sheets
    dump("sheets.js", "LE_SHEETS", sheets.SHEETS)
    dump("handson.js", "LE_HANDSON", handson_items(bank))
    import labs
    with open(os.path.join(out, "labs.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/build.py - do not edit by hand.\nwindow.LE_LABS = %s;\nwindow.LE_LESSONS = %s;\n" % (
            json.dumps(labs.LABS, ensure_ascii=False, separators=(",", ":")), json.dumps(labs.LESSON_INDEX, ensure_ascii=False, separators=(",", ":"))))
    import drills
    with open(os.path.join(out, "drills.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/build.py - do not edit by hand.\n// Command practice: randomized drills for the lab shell (tools/drills.py).\nwindow.LE_DRILLS = %s;\n" %
                 json.dumps(drills.DRILLS, ensure_ascii=False, separators=(",", ":")))
    index = lab_index(bank, labs)
    index["skills"] = [{k: s[k] for k in ("id", "cmd", "obj", "label")} for s in drills.SKILLS]
    index["cmdq"] = command_questions(bank, drills.SKILLS)
    index["labcmds"] = lab_commands(labs, drills.SKILLS)
    index["assets"] = {f: asset_version(os.path.join(root, "docs", f)) for f in ("data/labs.js", "data/drills.js", "js/man.js", "js/shell.js")}   # for lazy loading
    with open(os.path.join(out, "labindex.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/build.py - do not edit by hand.\n// Loaded with every page: lab titles and progress info, plus which lab parts practise each question.\n"
                 "// The full labs (data/labs.js), the shell (js/shell.js) and man pages (js/man.js) load when Labs opens.\nwindow.LE_LABINDEX = %s;\n" % json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    linked = len(index["q"])
    print("wrote docs/data/labindex.js (%d of %d questions link to a lab part)" % (linked, len(bank["questions"])))
    stamp_assets(os.path.join(root, "docs"))
    write_precache(os.path.join(root, "docs"), index["assets"])
    print("wrote docs/data/bank.js (%d questions) and docs/data/cards.js (%d cards)" % (len(bank["questions"]), len(deck_cards)))


if __name__ == "__main__":
    out, errors = build()
    for e in errors:
        print("ERROR", e)
    flagged = stats(out)
    if "--longest" in sys.argv:
        for q in flagged:
            print(" ", q["id"], "|", q["options"][q["answer"][0]])
    dest = os.path.join(os.path.dirname(__file__), "bank_full.json")
    json.dump(out, open(dest, "w"), indent=1, ensure_ascii=False)
    public = [{k: v for k, v in q.items() if not k.startswith("_") and v is not None} for q in out]
    meta = {"exam": "LPI Linux Essentials 010-160", "objectives_version": "1.6", "topics": TOPICS,
            "objectives": {o: {"name": n, "weight": w, "lesson": lesson(o)} for o, (n, w) in OBJ.items()},
            "forms": list(ALL_FORMS), "questions": public}
    json.dump(meta, open(os.path.join(os.path.dirname(__file__), "..", "bank.json"), "w"), indent=1, ensure_ascii=False)
    build_web()
    sys.exit(1 if errors else 0)
