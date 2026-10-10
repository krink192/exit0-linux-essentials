<p align="center">
  <img src="desktop/icon.png" width="96" alt="exit 0 logo">
</p>

<h1 align="center">exit 0</h1>

<p align="center">
  <b>Free practice for LPI Linux Essentials 010-160.</b><br>
  In Linux, <code>exit 0</code> means success, which is the goal here.
</p>

<p align="center">
  <a href="https://github.com/krink192/exit0-linux-essentials/releases/latest"><img src="https://img.shields.io/github/v/release/krink192/exit0-linux-essentials?label=release&color=0F7B67" alt="Latest release"></a>
  <a href="https://github.com/krink192/exit0-linux-essentials/actions/workflows/release.yml"><img src="https://github.com/krink192/exit0-linux-essentials/actions/workflows/release.yml/badge.svg" alt="Build"></a>
  <a href="https://github.com/krink192/exit0-linux-essentials/actions/workflows/tests.yml"><img src="https://github.com/krink192/exit0-linux-essentials/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License: GPL-3.0"></a>
  <a href="https://github.com/krink192/exit0-linux-essentials/releases"><img src="https://img.shields.io/github/downloads/krink192/exit0-linux-essentials/total?color=555" alt="Downloads"></a>
</p>

<p align="center">
  <a href="https://krink192.github.io/exit0-linux-essentials/"><b>Open in your browser</b></a> ·
  <a href="https://github.com/krink192/exit0-linux-essentials/releases/latest/download/Exit0.exe"><b>Windows</b></a> ·
  <a href="#fedora"><b>Fedora</b></a> ·
  <a href="#ubuntu--debian"><b>Ubuntu / Debian</b></a>
</p>

![exit 0 practice test](docs/screenshots/home.png)

## Get it

| Platform | How | Notes |
|---|---|---|
| **Any browser** | [krink192.github.io/exit0-linux-essentials](https://krink192.github.io/exit0-linux-essentials/) | Nothing to install. Works on phones too. |
| **Windows 10 / 11** | [Download Exit0.exe](https://github.com/krink192/exit0-linux-essentials/releases/latest/download/Exit0.exe) | A single file with no installer. |
| **Fedora** | `sudo dnf install https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.rpm` | Native GTK app. |
| **Ubuntu / Debian / Mint / Pop!_OS** | [Download exit0.deb](https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.deb), then `sudo apt install ./exit0.deb` | Native GTK app. |

All versions are the same app, work offline once installed, and are free.

### Fedora
```bash
sudo dnf install https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.rpm
exit0            # or open "exit 0" from your app menu
```
To update, run the same `dnf install` command after a new release. To remove it, run `sudo dnf remove exit0`.

### Ubuntu / Debian
```bash
wget https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.deb
sudo apt install ./exit0.deb
exit0            # or open "exit 0" from your app menu
```
To update, download the new `.deb` and install it the same way. To remove it, run `sudo apt remove exit0`.

### Windows
Download **[Exit0.exe](https://github.com/krink192/exit0-linux-essentials/releases/latest/download/Exit0.exe)** and run it.
Windows may show *"Windows protected your PC"* because the app isn't code-signed. Click **More info → Run anyway**.
It uses the Microsoft Edge WebView2 runtime that comes with Windows 10 and 11.

**Where progress is saved:** in your browser for the web version, `~/.local/share/exit0` on Linux, and `%APPDATA%\Exit0`
on Windows. To move it between devices, use **Settings → Your data**.

## What's inside

- **Practice tests.** Each test has 40 questions and a 60-minute timer, drawn fresh from 240 questions, with
  **exactly** as many questions per objective as the real exam (LPI: weight = number of questions).
  - **Timed** is on by default. Turn it off to practice at your own pace.
  - **Show answers as I go** is off by default, which matches the real exam. Turn it on to see the correct answer and
    explanation after each question. These tests are labeled and don't count toward your readiness score.
- **Progress.** A readiness score (average of your last three exam-condition tests), score trend, troubled sections,
  mastery of each objective, accuracy by difficulty, and a full history you can review.
- **Weak areas.** Replays the questions you missed, then your weakest objectives, with instant explanations.
- **Objective drill.** Pick any of the 19 objectives and practice only those.
- **Flashcards.** 250 cards in two decks, *Concepts* and *Commands & files*, with spaced repetition, so cards
  you miss come back first. There's also a searchable glossary.
- **Exam guide.** Format, scoring, the blueprint with links to LPI's free lessons, a study plan and test-day tips.
- **Daily goal and streak.** Keeps you studying a little every day.
- **Difficulty tags.** Every question is tagged *Recall*, *Apply* or *Analyze*, so you can see whether you
  know the facts but struggle with exact syntax or reading output.
- **Light and dark themes,** following your system setting or chosen in Settings.

| Progress | Flashcards (dark) | Drill feedback |
|---|---|---|
| ![](docs/screenshots/progress.png) | ![](docs/screenshots/flashcards-dark.png) | ![](docs/screenshots/drill.png) |

## How the content was made and checked

- Questions and flashcards were written from LPI's published 010-160 objectives (v1.6) and the free
  lessons at learning.lpi.org. Every item on each objective's "terms and utilities" list is covered.
- **120 command-based questions were run on a real Linux system** (`tools/verify.py`), including every
  accepted fill-in answer. The output must match the answer key.
- The build checks blueprint counts, duplicates, and whether the correct answer tends to be the longest option.
- `node tools/test_core.js` tests the exam logic, including 200 randomly generated tests that are each
  checked against the blueprint.
- Every release installs the `.deb` on Ubuntu and the `.rpm` on Fedora before publishing them.

These are **original practice questions, not real exam questions**. LPI scores the real exam from
200 to 800, and 500 passes, with no published percentage. Treat 80% here as a readiness signal.

## For developers

### Project layout
```
docs/                 The web app (served by GitHub Pages)
  index.html, css/, js/core.js (logic), js/app.js (interface)
  data/bank.js, data/cards.js   generated, do not edit by hand
desktop/              Windows wrapper (pywebview), Linux launcher + .deb/.rpm config (desktop/linux), app icon
.github/workflows/    Tests on every push; Windows .exe, .deb and .rpm builds on each release
bank.json             The question bank
tools/                Question sources t1.py–t5.py, cards.py, build.py, verify.py, test_core.js
```

### Releasing
```bash
gh release create v1.2.0 --title "exit 0 v1.2.0" --notes "What changed"
```
GitHub Actions (`.github/workflows/release.yml`) runs the tests, builds `Exit0.exe`, `exit0.deb` and `exit0.rpm`,
checks the Linux packages by installing them on Ubuntu and Fedora, and then attaches all three to the release.

### GitHub Pages
In the repository settings, open **Pages**, set Source to *Deploy from a branch*, then choose `main` and `/docs`.

## Contributing
Corrections and new questions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
Copyright (C) 2026 krink192 and contributors. Free software under the **GNU General Public License v3.0
or later**. See [LICENSE](LICENSE). It comes with no warranty.

Linux Essentials and LPI are trademarks of the Linux Professional Institute. This project is not affiliated
with or endorsed by LPI. Linux is a registered trademark of Linus Torvalds.
