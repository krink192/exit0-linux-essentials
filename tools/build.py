# SPDX-License-Identifier: GPL-3.0-or-later
"""Build bank.json from the topic source files and lint it."""
import json, sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
from common import BANK, MARK
import t1, t2, t3, t4, t5, t6  # noqa: F401  (populate BANK; t6 = harder pack)
from hints import HINTS

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
FORMS = "ABCDEFGHI"   # nine 40-question sets, each matching the blueprint exactly
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
    for raw in BANK:
        o = raw["o"]
        seen[o] += 1
        n = seen[o]
        q = {
            "id": f"{o}-{n:02d}",
            "obj": o,
            "form": FORMS[(n - 1) % len(FORMS)],
            "q": raw["q"].strip(),
            "code": raw.get("code"),
            "explanation": raw["ex"].strip(),
        }
        if raw["kind"] == "fill":
            q["type"] = "fill"
            q["accept"] = raw["acc"]
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
        q["hint"] = HINTS.get(q["id"])
        if not q["hint"]:
            errors.append(f"{q['id']}: no hint in tools/hints.py")
        q["_run"], q["_expect"], q["_user"] = raw.get("run"), raw.get("expect"), raw.get("user")
        out.append(q)

    for hid in sorted(set(HINTS) - {q["id"] for q in out}):
        errors.append(f"hints.py: {hid} is not a question ID")
    _, viol = assign_forms(out)
    for grp in viol:
        print("WARN conflict set shares a form:", grp)

    # blueprint checks
    for o, (_, w) in OBJ.items():
        if seen[o] != len(FORMS) * w:
            errors.append(f"objective {o}: {seen[o]} questions, need {len(FORMS)*w}")
    for f in FORMS:
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
# so the optimizer keeps them in different forms.
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
        byobj[q["obj"]].append(q)
    cset = {}
    for i, grp in enumerate(CONFLICTS):
        for qid in grp:
            cset.setdefault(qid, []).append(i)

    byid = {q["id"]: q for q in out}
    groups = [[byid[i] for i in grp if i in byid] for grp in CONFLICTS]
    totals = collections.Counter(q["type"] for q in out)

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
    for f in FORMS:
        t = collections.Counter(q["type"] for q in out if q["form"] == f)
        print(f"  form {f}: {dict(t)}")
    return [q for q in single if (lambda L, a: L[a] == max(L) and L.count(max(L)) == 1)([len(o) for o in q["options"]], q["answer"][0])]


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
    import labs
    dump("labs.js", "LE_LABS", labs.LABS)
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
            "forms": list(FORMS), "questions": public}
    json.dump(meta, open(os.path.join(os.path.dirname(__file__), "..", "bank.json"), "w"), indent=1, ensure_ascii=False)
    build_web()
    sys.exit(1 if errors else 0)
