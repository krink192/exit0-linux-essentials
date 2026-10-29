# Developing exit 0

## Project layout
```
docs/                 The web app (published by GitHub Pages)
  index.html, css/, js/core.js (logic), js/app.js (interface)
  js/shell.js         the simulated Linux system used by the labs
  js/man.js           its manual pages (man, info, whatis, apropos, --help)
  js/sync.js          optional sync with an exit0-sync server (merge rules are in core.js)
  data/bank.js, data/cards.js   generated, do not edit by hand
  data/labindex.js    generated: lab titles/progress info and question-to-lab links (loaded with every page)
  data/labs.js        generated: the full labs, loaded with js/shell.js and js/man.js only when Labs opens
  data/drills.js      generated: command practice drills and the sandbox, loaded when Commands or Sandbox opens
desktop/              Windows wrapper (pywebview), Linux launcher + .deb/.rpm config (desktop/linux), app icon
.github/workflows/    tests.yml (every push), release.yml (desktop builds), pages.yml (website + package repo),
                      docker.yml (container image)
Dockerfile, docker/   App-only container image (nginx serving docs/). exit0-sync builds on it; point users to exit0-sync
bank.json             The question bank
tools/                Questions t1.py–t7.py, hints.py, whys.py, cards.py, sheets.py, labs.py, trouble_labs.py, drills.py,
                      build.py, verify.py, test_core.js, test_shell.js, test_sync.js, test_questions.js, test_drills.js,
                      test_man.js
```

## How the content is checked

- Questions and flashcards are written from LPI's 010-160 objectives (v1.6) and the free lessons at learning.lpi.org.
  Every item on each objective's "terms and utilities" list is covered.
- **Command-based questions are run on a real Linux system** (`tools/verify.py`), including every accepted
  fill-in answer. The output must match the answer key.
- The build checks blueprint counts, duplicates, that every question has a hint and every wrong option has a note,
  and whether the correct answer tends to be the longest option (target: well below the 25% expected by chance).
- `node tools/test_shell.js` runs command sequences in both the lab terminal and real Bash and requires identical
  output, types every lab solution line by line to prove each task can be completed, checks that each coaching tip
  fires on its example mistake, and checks that every command a lesson lists is used.
- `node tools/test_drills.js` builds every drill with every value combination: the check must fail before, pass
  after the solution and fail after each listed wrong command. It also tests drill scheduling, the per-command
  mastery map and how sync merges drill progress.
- `node tools/test_man.js` checks that the lab's own help is enough: every command a lab or drill uses has a man
  page (or `help` text for builtins and keywords), every option a solution uses is documented on that page, every
  command page has examples, and each example runs in the lab shell without a usage error.
- `node tools/test_core.js` tests the exam and study logic, including 200 randomly generated exams checked against
  the blueprint, and checks that no hint gives away a typed answer.
- Every release installs the `.deb` on Ubuntu and the `.rpm` on Fedora before publishing, checks the `.rpm`
  signature, then installs both again from the live signed repositories.

## Releasing
```bash
gh release create v1.2.0 --title "exit 0 v1.2.0" --notes "What changed"
```
`release.yml` runs the tests, builds `Exit0.exe`, `exit0.deb` and `exit0.rpm`, signs the `.rpm`, installs both
Linux packages on Ubuntu and Fedora, and attaches all three to the release. When it finishes, `pages.yml`
republishes the website and the signed dnf/apt repository, then installs from that repository to make sure it works.
`docker.yml` builds the container image, runs it and checks that it serves the app, then publishes it to
`ghcr.io/krink192/exit0` for amd64 and arm64. That app-only image is what exit0-sync copies the app from, so after
an app release, rebuild or release exit0-sync to ship the new version to self-hosters.

To try the image locally: `docker build -t exit0 . && docker run --rm -p 8080:8080 exit0`.

## One-time setup: website and package signing
1. **Pages:** Settings → Pages → Source: **GitHub Actions**, or run
   `gh api -X PUT repos/krink192/exit0-linux-essentials/pages -f build_type=workflow`.
2. **Signing key:** create a key used only for packages, and store it as a repository secret:
   ```bash
   gpg --batch --pinentry-mode loopback --passphrase '' \
       --quick-gen-key "exit 0 packages <krink192@users.noreply.github.com>" rsa4096 sign never
   gpg --armor --export-secret-keys "exit 0 packages" | gh secret set PACKAGE_SIGNING_KEY
   ```
   Keep an offline backup (`gpg --armor --export-secret-keys "exit 0 packages" > exit0-signing-key.asc`).
   Without the secret, releases still build, but the `.rpm` stays unsigned and only the website is published.

## Install details and troubleshooting

**Single-package installs (no repository):**
`sudo dnf install https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.rpm`, or download
[exit0.deb](https://github.com/krink192/exit0-linux-essentials/releases/latest/download/exit0.deb) and run
`sudo apt install ./exit0.deb`.

**Uninstall:** `sudo dnf remove exit0` and delete `/etc/yum.repos.d/exit0.repo`; or `sudo apt remove exit0` and
delete `/etc/apt/keyrings/exit0.asc` and `/etc/apt/sources.list.d/exit0.sources`.

**Windows:** uses the Microsoft Edge WebView2 runtime that ships with Windows 10 and 11.

**Where progress is saved:** in the browser for the web version and self-hosted server, `~/.local/share/exit0` on
Linux, and `%APPDATA%\Exit0` on Windows. Move it between devices with **Settings → Sync**, or an export code under
**Settings → Your data**.

**Linux window opens and closes right away?** Update to the latest version. If it still happens, run
`GDK_BACKEND=x11 exit0` and [open an issue](https://github.com/krink192/exit0-linux-essentials/issues/new?template=bug.yml)
with the terminal output.

**Self-host:** see the [exit0-sync README](https://github.com/krink192/exit0-sync#readme) for setup, HTTPS, backups
and updates.

## AGPL source link
If you run a modified exit 0 for others over a network, point the app's **Source code** link (`REPO` in
`docs/js/app.js`) at your own published source.
