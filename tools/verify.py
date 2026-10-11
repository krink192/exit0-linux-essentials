# SPDX-License-Identifier: AGPL-3.0-or-later
"""Run every question that has a shell check and compare the real output with the keyed answer."""
import json, os, subprocess, tempfile, pwd, shutil, sys, collections

bank = json.load(open(os.path.join(os.path.dirname(__file__), "bank_full.json")))
TEST_USER = "le010user"
try:
    pwd.getpwnam(TEST_USER)
except KeyError:
    subprocess.run(["useradd", "-m", TEST_USER], check=True)


def run(script, user):
    d = tempfile.mkdtemp(prefix="le010_")
    try:
        if user:
            shutil.chown(d, TEST_USER, TEST_USER)
            cmd = ["runuser", "-u", TEST_USER, "--", "bash", "-c", script]
        else:
            cmd = ["bash", "-c", script]
        p = subprocess.run(cmd, cwd=d, capture_output=True, text=True, timeout=30,
                           env={"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "HOME": d, "LANG": "C.UTF-8"})
        return "\n".join(l.rstrip() for l in p.stdout.strip().splitlines())
    finally:
        shutil.rmtree(d, ignore_errors=True)


passed, failed, skipped = 0, [], 0
by_obj = collections.Counter()
for q in bank:
    script, expect = q.get("_run"), q.get("_expect")
    if not script:
        skipped += 1
        continue
    if expect == "OPT":
        expect = q["options"][q["answer"][0]]
    expect = "\n".join(l.rstrip() for l in expect.strip().splitlines())
    variants = [script.replace("{A}", a) for a in q["accept"]] if q["type"] == "fill" and "{A}" in script else [script]
    ok = True
    for v in variants:
        got = run(v, q.get("_user"))
        if got != expect:
            ok = False
            failed.append((q["id"], v, expect, got))
    if ok:
        passed += 1
        by_obj[q["obj"]] += 1

print(f"shell-verified: {passed} passed, {len(failed)} failing variants, {skipped} without a shell check")
for qid, v, e, g in failed:
    print(f"\nFAIL {qid}\n  script: {v}\n  expect: {e!r}\n  got:    {g!r}")
json.dump({"verified": sorted(q["id"] for q in bank if q.get("_run")) if not failed else []},
          open(os.path.join(os.path.dirname(__file__), "verified.json"), "w"))
sys.exit(1 if failed else 0)
