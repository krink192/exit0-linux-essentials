# Contributing

Corrections and new questions are welcome. Please open an issue or a pull request. In the app, every question
has a **Report a problem** link that opens an issue with the question ID filled in.

## Fixing or adding a question

Questions live in `tools/t1.py` … `tools/t5.py`, one file per exam topic, grouped by objective. `tools/t6.py` is the
harder pack (mostly Apply and Analyze) covering all five topics. New questions go at the end of an objective so
existing question IDs, and people's saved progress, stay the same.

```python
S("2.4", "Which command copies the directory projects into backup/?",
  ["✔cp -r projects backup/", "cp projects backup/", "mv -r projects backup/", "cp -i projects backup/"],
  "Explain why the answer is right and why each wrong option is wrong.",
  run="mkdir -p projects backup; touch projects/x; cp -r projects backup/; ls backup/projects", expect="x")

F("2.3", "Type the command that prints the current working directory.",
  ["pwd"],
  "Explanation…",
  run="cd /usr; {A}", expect="/usr")
```

- `S(...)` is a choice question. Mark correct options with `✔`, and more than one `✔` makes it "Choose TWO".
- `F(...)` is a fill-in question. List every answer that should be accepted, and remember that case matters.
- `run`/`expect` (optional but encouraged) is a shell check. `expect="OPT"` means the output must equal the
  correct option. In `F` questions, `{A}` is replaced by each accepted answer in turn.
- Each objective must have **9 × its LPI weight** questions (nine 40-question sets), so add questions in groups
  that keep that true, or replace existing ones.
- Write the wrong options so they are plausible, and keep them about as long as the correct one.
- Every question needs a hint in `tools/hints.py`, keyed by its ID (for example `"3.2-07"`). A hint points to the
  right idea without giving the answer away. The build fails without one.

## Labs

Labs live in `tools/labs.py`. Each task has `text`, `hint`, `solution` (one command per line) and a `check` that
looks at the machine's state, such as a file's mode, a user's groups or the working directory, rather than at
what was typed. `node tools/test_shell.js` runs every solution and fails if a task is already complete at the
start or isn't complete afterwards. If a command is missing from the simulated shell (`docs/js/shell.js`), add it
there with a test case in `tools/test_shell.js` that compares it with real Bash.

## Flashcards

Cards live in `tools/cards.py`. `C(...)` adds a card to the Concepts deck and `K(...)` to the Commands & files deck.
Keep definitions short, accurate to LPI's lessons, and tied to the right objective.

## Difficulty tags

`build.py` tags each question as 1 (Recall), 2 (Apply) or 3 (Analyze) automatically. Override a tag by adding
`level=3` (for example) to the question in `t1.py`–`t6.py`.

## Build and check

```bash
cd tools
python3 build.py          # writes ../bank.json and ../docs/data/*.js and checks blueprint counts
sudo python3 verify.py    # runs every shell check (creates test users, so use a throwaway VM or container)
cd .. && node tools/test_core.js
node tools/test_shell.js   # lab terminal vs real Bash, and every lab's solutions
```

## Contributor license grant

exit 0 is free software, and the maintainer may also build paid products on the same code, such as exam packs
for other certifications. To keep that possible, every contribution comes with the following grant. Please read
it before you open a pull request.

By submitting a contribution (code, questions, hints, flashcards, documentation or anything else) to this
repository, you agree that:

1. **You have the right to contribute it.** It is your own work, or you have permission to submit it under these
   terms. It does not copy real exam questions or other material you aren't allowed to share.
2. **Everyone gets it under the AGPL.** Your contribution is licensed to the public under the GNU Affero General Public
   License v3.0 or later, the same as the rest of the project.
3. **The maintainer gets extra rights.** You also grant krink192, the project maintainer, a perpetual, worldwide,
   non-exclusive, royalty-free, irrevocable license to use, copy, modify, distribute, sublicense and relicense
   your contribution under any terms, including in closed-source or commercial versions of exit 0.
4. **You keep your copyright.** This grant doesn't transfer ownership. You can still use your own work however
   you like.

Pull requests include a checkbox to confirm this. A pull request without it can't be merged.
