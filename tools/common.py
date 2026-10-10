# SPDX-License-Identifier: GPL-3.0-or-later
"""Authoring helpers for the Linux Essentials 010-160 question bank.

Correct options are marked with a leading check mark (U+2714). A choice
question with more than one marked option becomes a "choose N" question.

run/expect: optional shell check used by verify.py.
  - run is a bash script executed in an empty temp directory.
  - expect == "OPT"  -> stdout must equal the single correct option text.
  - expect is a str  -> stdout must equal it.
  - for fill questions, "{A}" in run is replaced by every accepted answer in turn.
"""
BANK = []
MARK = "✔"


def S(o, q, opts, ex, code=None, run=None, expect=None, user=False, level=None):
    BANK.append(dict(o=o, kind="choice", q=q, opts=opts, ex=ex, code=code,
                     run=run, expect=expect, user=user, level=level))


def F(o, q, acc, ex, code=None, run=None, expect=None, user=False, level=None):
    BANK.append(dict(o=o, kind="fill", q=q, acc=acc, ex=ex, code=code,
                     run=run, expect=expect, user=user, level=level))
