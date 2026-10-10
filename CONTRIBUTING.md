# Contributing

Corrections and new questions are welcome. Please open an issue or a pull request.

## Fixing or adding a question

Questions live in `tools/t1.py` … `tools/t5.py`, one file per exam topic, grouped by objective.

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
- Each objective must have **6 × its LPI weight** questions, so add questions in groups that keep that true,
  or replace existing ones.
- Write the wrong options so they are plausible, and keep them about as long as the correct one.

## Flashcards

Cards live in `tools/cards.py`. `C(...)` adds a card to the Concepts deck and `K(...)` to the Commands & files deck.
Keep definitions short, accurate to LPI's lessons, and tied to the right objective.

## Difficulty tags

`build.py` tags each question as 1 (Recall), 2 (Apply) or 3 (Analyze) automatically. Override a tag by adding
`level=3` (for example) to the question in `t1.py`–`t5.py`.

## Build and check

```bash
cd tools
python3 build.py          # writes ../bank.json and ../docs/data/*.js and checks blueprint counts
sudo python3 verify.py    # runs every shell check (creates test users, so use a throwaway VM or container)
cd .. && node tools/test_core.js
```

By contributing, you agree that your contributions are licensed under GPL-3.0-or-later.
