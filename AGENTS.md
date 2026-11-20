# Working on exit 0 (for AI coding agents and people)

exit 0 is a free, offline practice app for LPI Linux Essentials 010-160. The app is the static site in `docs/`.
See `DEVELOPING.md` for the full layout, the content checks and releasing.

## Golden rules

- **Logic in `docs/js/core.js`, screens in `docs/js/app.js`, styles in `docs/css/styles.css`.** `core.js` has no DOM
  access and every behaviour in it has a test in `tools/test_core.js`. Add or update a test with every logic change.
- **Never edit generated files** (`docs/data/*.js`). Questions are authored under `tools/` and in `bank.json`;
  `python3 tools/build.py` regenerates the data and stamps `docs/index.html` and `docs/sw.js`. Rebuild after any
  change under `docs/`, or the stamp check in `test_core.js` fails.
- **Works offline, strict CSP.** `script-src 'self'`: no inline scripts or event-handler attributes, no CDN scripts,
  styles or fonts. Fonts are self-hosted in `docs/fonts/`.
- **All content is original** and AGPL-3.0-or-later. Don't copy questions, code or assets from other sites or
  projects. Never add exam dumps.
- **Untrusted input.** Saved progress, export codes and sync data are rebuilt field by field in `core.js`
  (`cleanDoc`). New stored fields must go through it. Escape text with `esc()` before it reaches the page.

## Before you commit

```bash
python3 tools/build.py
node tools/test_core.js && node tools/test_license.js && node tools/test_sync.js
node tools/test_questions.js && node tools/test_drills.js && node tools/test_man.js
node tools/test_shell.js   # needs real Bash and GNU coreutils (Linux); CI runs it on ubuntu-24.04
```

All must pass. Build with the same Python on Linux that CI uses, so the build stamps match.

## Design rules

- Colours come only from the tokens at the top of `styles.css` (light, plus dark twice: the media query and
  `[data-theme="dark"]`). Green is the default scheme; each optional colour scheme overrides the same tokens with one
  accent. Never hard-code a colour in a component, and keep `tools/test_schemes.js` passing (contrast in every scheme,
  light and dark). Lab terminals stay dark in every scheme. Red/orange only where they carry meaning, always with an
  icon or label.
- Figtree for the interface; JetBrains Mono only for real commands and terminal output. Use the `--fs-*` type scale.
- Rows inside one bordered surface rather than grids of separate cards. One filled (primary) button per screen.
- 44px minimum touch targets (`--tap`), visible focus rings, `prefers-reduced-motion` respected, both themes.
- Flat progress bars, no rings. Icons are inline stroke SVGs from `icon()` in `app.js`, not unicode or emoji.
- Right and wrong are shown by icon and label, never by colour alone.
- Check every UI change at 390px and 1440px wide, in light and dark.

## Pull requests

- One change per PR, from its own branch. Squash merge.
- The PR description says what changed, how it was checked, and what was not checked.
- The maintainer approves visual changes from screenshots before they are merged.
