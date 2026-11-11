# SPDX-License-Identifier: AGPL-3.0-or-later
"""Authoring helpers for the Linux Essentials 010-160 question bank.

Correct options are marked with a leading check mark (U+2714). A choice
question with more than one marked option becomes a "choose N" question.

run/expect: optional shell check used by verify.py.
  - run is a bash script executed in an empty temp directory.
  - expect == "OPT"  -> stdout must equal the single correct option text.
  - expect is a str  -> stdout must equal it.
  - for fill questions, "{A}" in run is replaced by every accepted answer in turn.

The first argument is the question's ID: "<objective>-<number>", for example "3.2-07". IDs are permanent. Saved
progress, hints.py, whys.py and the conflict sets in build.py all refer to questions by ID, so never renumber or
reuse one: a new question takes the next free number of its objective, wherever it sits in the files.

Optional extras (used by the targeted set in t7.py, which is fixed to form J):
  hint / why   the hint and the "why that's wrong" notes inline, instead of in hints.py / whys.py
  lab          fill questions only: {"setup": ..., "check": ..., "reject": [...]} in the lab-shell format
               (tools/labs.py). The app runs a typed answer on a fresh simulated machine and accepts it when
               the check passes, so any working command counts. tools/test_questions.js runs every accepted
               answer (must pass), every reject example (must fail) and the untouched setup (must fail).
  form         pin the question to a form instead of letting build.py assign one
"""
BANK = []
MARK = "✔"


HOME = "/home/student"


def lab(setup, check, reject=()):
    """A lab-shell check for a fill question: the machine to start from, what must be true afterwards, and
    plausible wrong commands that CI proves are rejected."""
    return {"setup": setup, "check": check, "reject": list(reject)}


def S(id, q, opts, ex, code=None, run=None, expect=None, user=False, level=None, hint=None, why=None, form=None):
    BANK.append(dict(id=id, o=id.rsplit("-", 1)[0], kind="choice", q=q, opts=opts, ex=ex, code=code,
                     run=run, expect=expect, user=user, level=level, hint=hint, why=why, form=form))


def F(id, q, acc, ex, code=None, run=None, expect=None, user=False, level=None, hint=None, lab=None, form=None):
    BANK.append(dict(id=id, o=id.rsplit("-", 1)[0], kind="fill", q=q, acc=acc, ex=ex, code=code,
                     run=run, expect=expect, user=user, level=level, hint=hint, lab=lab, form=form))
