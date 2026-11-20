// SPDX-License-Identifier: AGPL-3.0-or-later
// Every colour scheme, light and dark, must keep text at 4.5:1 and the boundaries a learner uses to
// see a control (field border, focus ring, and on the added schemes the button border) at 3:1.
// The label on the accent button must clear 4.5:1. It is white when that passes, and near-black when
// the accent is too light for white (GitHub, Catppuccin, Tokyo Night and Dracula in dark).
// Green keeps the borders it already ships with. Those sit under 3:1 on purpose; changing them would
// change the default look for anyone who never opens the picker.
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "docs/css/styles.css"), "utf8");
const TEXT = 4.5, UI = 3;
const IDS = ["github", "flexoki", "catppuccin", "tokyo", "dracula"];
// The lab terminal stays the same dark surface in both modes. Search-hit colours follow the published
// light and dark values, which differ so the hit still clears 4.5:1 against the terminal text.
const TERM = ["--term-bg", "--term-ink", "--term-line", "--term-user", "--term-path", "--term-dim", "--term-field", "--term-field-line"];
const SKIP = {
  light: new Set(["button border", "knob off", "low bar", "terminal field border", "terminal edge"]),
  dark: new Set(["button border", "knob on accent", "low bar", "terminal field border", "terminal edge"]),
};
const SNAP_LIGHT = `--accent #1B7F4B
--accent-2 #14633A
--accent-ink #FFFFFF
--accent-soft #E6F2EA
--accent-text #14633A
--bad #B4352D
--bad-soft #FAE3E1
--bar-low #8A948D
--bg #F6F7F5
--field-line #7F8A83
--flag #8A5200
--flag-soft #FBEEDB
--good #14633A
--good-soft #E6F2EA
--hover #E9EDE8
--ink #17201B
--ink-2 #2F3A34
--knob #FFFFFF
--line #DDE1DC
--line-2 #B9C1BA
--muted #56615A
--om-tint #E6F2EA
--on-solid #FFFFFF
--pipe-bg #12281C
--pipe-dim #A9C2B3
--pipe-done #8FD9AE
--pipe-hover #1B3828
--pipe-ink #FFFFFF
--pipe-next #E6F2EA
--pipe-next-hover #FFFFFF
--pipe-next-ink #0E3B22
--side #EEF1EE
--sunk #F0F2EF
--surface #FFFFFF
--term-bg #0F1412
--term-dim #9FB3AA
--term-field #18201C
--term-field-line #2C3B34
--term-ink #D6E2DC
--term-line #22302A
--term-mark #6B5D1F
--term-mark-on #E0B84A
--term-path #79B8FF
--term-user #5FD7A8
--track #E3E7E2
--warm #96500D
--warm-soft #FCEBDA`;
const SNAP_DARK = `--accent #4CC38A
--accent-2 #6AD3A0
--accent-ink #06200F
--accent-soft #16301F
--accent-text #6AD3A0
--bad #F07D73
--bad-soft #3B1C19
--bar-low #6F7B74
--bg #101412
--field-line #6F7B74
--flag #E8A94C
--flag-soft #382912
--good #6AD3A0
--good-soft #16301F
--hover #262D29
--ink #E7ECE8
--ink-2 #CBD3CE
--line #2C3430
--line-2 #47524C
--muted #A3AEA7
--om-tint #244535
--on-solid #06200F
--pipe-bg #16291E
--pipe-hover #1E3828
--pipe-next #4CC38A
--pipe-next-hover #6AD3A0
--pipe-next-ink #06200F
--side #141917
--sunk #1F2522
--surface #181D1A
--term-bg #040605
--term-field #101613
--term-field-line #3A4840
--term-line #46544C
--track #2A322E
--warm #F0A45C
--warm-soft #3A2716`;

let failed = 0;
const fail = msg => { failed++; console.error("FAIL " + msg); };
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrast(a, b) {
  const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}
function round2(n) { return Math.round(n * 100) / 100; }
function tokensOf(block) {
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim();
  return out;
}
function braceAt(at) {
  const a = css.indexOf("{", at), b = css.indexOf("}", a);
  return css.slice(a + 1, b);
}
function blocks(mark) {
  const needle = "/* " + mark + " */";
  const out = [];
  let from = 0;
  while (true) {
    const i = css.indexOf(needle, from);
    if (i < 0) break;
    out.push(tokensOf(braceAt(i)));
    from = css.indexOf("}", i) + 1;
  }
  return out;
}
function hexOf(toks) {
  const o = {};
  for (const k of Object.keys(toks)) if (/^#[0-9A-F]{6}$/i.test(toks[k])) o[k] = toks[k].toUpperCase();
  return o;
}
function dump(o) { return Object.keys(o).sort().map(k => k + " " + o[k]).join("\n"); }
function pairs(t) {
  const text = [
    ["ink on page", "--ink", "--bg"], ["ink on card", "--ink", "--surface"], ["ink on side", "--ink", "--side"],
    ["secondary on page", "--ink-2", "--bg"], ["secondary on card", "--ink-2", "--surface"], ["secondary on side", "--ink-2", "--side"],
    ["muted on page", "--muted", "--bg"], ["muted on card", "--muted", "--surface"], ["muted on side", "--muted", "--side"],
    ["accent text on page", "--accent-text", "--bg"], ["accent text on card", "--accent-text", "--surface"],
    ["accent text on soft", "--accent-text", "--accent-soft"], ["accent text on objective tint", "--accent-text", "--om-tint"],
    ["ink on objective tint", "--ink", "--om-tint"],
    ["pipe text", "--pipe-ink", "--pipe-bg"], ["pipe secondary", "--pipe-dim", "--pipe-bg"],
    ["pipe next label", "--pipe-next-ink", "--pipe-next"], ["pipe next label on hover", "--pipe-next-ink", "--pipe-next-hover"],
    ["pipe done", "--pipe-done", "--pipe-bg"],
    ["right on card", "--good", "--surface"], ["right on soft", "--good", "--good-soft"],
    ["wrong on card", "--bad", "--surface"], ["wrong on soft", "--bad", "--bad-soft"],
    ["flag on card", "--flag", "--surface"], ["flag on soft", "--flag", "--flag-soft"],
    ["streak on card", "--warm", "--surface"], ["streak on soft", "--warm", "--warm-soft"],
    ["terminal text", "--term-ink", "--term-bg"], ["terminal dim", "--term-dim", "--term-bg"],
    ["terminal user", "--term-user", "--term-bg"], ["terminal path", "--term-path", "--term-bg"],
    ["terminal text on field", "--term-ink", "--term-field"],
    ["search hit", "--term-ink", "--term-mark"], ["active search hit", "--term-bg", "--term-mark-on"],
  ];
  const ui = [
    ["field border", "--field-line", "--surface"], ["button border", "--line-2", "--surface"],
    ["focus on page", "--accent", "--bg"], ["focus on card", "--accent", "--surface"], ["focus on side", "--accent", "--side"],
    ["knob on accent", "--knob", "--accent"], ["knob off", "--knob", "--line-2"],
    ["low bar", "--bar-low", "--track"], ["score bar", "--accent", "--track"],
    ["terminal field border", "--term-field-line", "--term-field"], ["terminal edge", "--term-line", "--term-bg"],
  ];
  return { text, ui };
}
function check(name, mode, t, skip) {
  const p = pairs(t);
  for (const [label, a, b] of p.text) {
    if (!t[a] || !t[b]) { fail(`${name} ${mode} ${label} missing`); continue; }
    const r = contrast(t[a], t[b]);
    if (r < TEXT) fail(`${name} ${mode} ${label} ${round2(r)} (${t[a]} on ${t[b]})`);
  }
  for (const [label, a, b] of p.ui) {
    if (skip && skip.has(label)) continue;
    if (!t[a] || !t[b]) { fail(`${name} ${mode} ${label} missing`); continue; }
    const r = contrast(t[a], t[b]);
    if (r < UI) fail(`${name} ${mode} ${label} ${round2(r)} (${t[a]} on ${t[b]})`);
  }
  // A white label has to clear 4.5:1. A near-black label is the published choice on a bright dark-mode
  // accent (GitHub, Catppuccin, Tokyo Night, Dracula); darkening that accent would leave the palette.
  if (t["--accent-ink"] === "#FFFFFF") {
    for (const [label, bg] of [["button label", "--accent"], ["button label on hover", "--accent-2"]]) {
      const r = contrast("#FFFFFF", t[bg]);
      if (r < TEXT) fail(`${name} ${mode} white ${label} ${round2(r)} on ${t[bg]}`);
    }
  }
}

const rootTok = hexOf(tokensOf(braceAt(css.indexOf(":root {"))));
const darkTok = hexOf(tokensOf(braceAt(css.indexOf(':root[data-theme="dark"]'))));
if (dump(rootTok) !== SNAP_LIGHT) fail("Green light tokens changed");
if (dump(darkTok) !== SNAP_DARK) fail("Green dark tokens changed");
if (css.includes('data-scheme="green"')) fail("Green must stay the :root palette, with no scheme override");
const greenLight = rootTok;
const greenDark = Object.assign({}, greenLight, darkTok);
check("green", "light", greenLight, SKIP.light);
check("green", "dark", greenDark, SKIP.dark);
if (greenLight["--term-user"] === greenLight["--term-path"]) fail("Green prompt uses one colour");

for (const id of IDS) {
  const lightBlocks = blocks("@scheme " + id + " light");
  const darkBlocks = blocks("@scheme " + id + " dark");
  const printBlocks = blocks("@scheme " + id + " print");
  if (lightBlocks.length !== 1) fail(id + " light blocks " + lightBlocks.length);
  if (darkBlocks.length !== 2) fail(id + " dark blocks " + darkBlocks.length);
  if (printBlocks.length !== 1) fail(id + " print blocks " + printBlocks.length);
  if (!lightBlocks[0] || !darkBlocks[0]) continue;
  const light = hexOf(lightBlocks[0]), dark = hexOf(darkBlocks[0]), printed = hexOf(printBlocks[0] || {});
  if (dump(dark) !== dump(hexOf(darkBlocks[1] || {}))) fail(id + " dark copies differ");
  for (const k of Object.keys(greenLight)) if (!light[k] || !dark[k]) fail(id + " missing " + k);
  if (dump(printed) !== dump(light)) fail(id + " print does not use the light pack");
  for (const k of TERM) if (light[k] !== dark[k]) fail(id + " " + k + " changes between light and dark");
  if (!light["--term-user"] || light["--term-user"] === light["--term-path"]) fail(id + " prompt is not two colours");
  if (!/^rgba\(/.test(lightBlocks[0]["--hairline"] || "") || !/^rgba\(/.test(darkBlocks[0]["--hairline"] || "")) fail(id + " hairline is not translucent");
  check(id, "light", light);
  check(id, "dark", dark);
  checkDots(id, light, dark);
}
checkDots("green", greenLight, greenDark);

function checkDots(id, light, dark) {
  for (const [cls, key] of [["dot-bg", "--bg"], ["dot-surface", "--surface"], ["dot-ink", "--ink"], ["dot-accent", "--accent"]]) {
    const re = new RegExp(`\\.swatch\\[data-v="${id}"\\] \\.${cls} \\{ background: (#[0-9A-Fa-f]{6}); \\}`, "g");
    const found = [];
    let m;
    while ((m = re.exec(css))) found.push(m[1].toUpperCase());
    if (!found.includes(light[key]) || !found.includes(dark[key])) fail(id + " swatch " + cls + " is not the pack colour");
    const lineRe = new RegExp(`^(.*)\\.swatch\\[data-v="${id}"\\] \\.${cls} \\{ background: (#[0-9A-Fa-f]{6}); \\}$`);
    let inDarkMedia = false;
    for (const line of css.split("\n")) {
      if (/@media\s*\(prefers-color-scheme:\s*dark\)/.test(line)) inDarkMedia = true;
      if (inDarkMedia && line.trim() === "}") inDarkMedia = false;
      const hit = line.match(lineRe);
      if (!hit) continue;
      const colour = hit[2].toUpperCase();
      if (colour === light[key].toUpperCase()) {
        if (inDarkMedia || hit[1].includes("data-theme")) fail(id + " light swatch " + cls + " is inside a dark rule");
      } else if (colour === dark[key].toUpperCase()) {
        const forced = hit[1].includes('[data-theme="dark"]');
        const system = inDarkMedia && hit[1].includes(':not([data-theme="light"])');
        if (!forced && !system) fail(id + " dark swatch " + cls + " is not scoped to dark mode");
      }
    }
  }
}

function schemeMap(src) {
  const m = src.match(/SCHEME_BG = \{([^}]+)\}/);
  if (!m) return null;
  const out = {};
  const re = /(\w+):\s*\["(#[0-9A-Fa-f]{6})",\s*"(#[0-9A-Fa-f]{6})"\]/g;
  let x;
  while ((x = re.exec(m[1]))) out[x[1]] = [x[2].toUpperCase(), x[3].toUpperCase()];
  return out;
}
const themeJs = fs.readFileSync(path.join(root, "docs/js/theme.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "docs/js/app.js"), "utf8");
const coreJs = fs.readFileSync(path.join(root, "docs/js/core.js"), "utf8");
const fromTheme = schemeMap(themeJs), fromApp = schemeMap(appJs);
if (!fromTheme || !fromApp || JSON.stringify(fromTheme) !== JSON.stringify(fromApp)) fail("theme.js and app.js scheme colours differ");
for (const id of IDS) {
  const light = hexOf(blocks("@scheme " + id + " light")[0]);
  const dark = hexOf(blocks("@scheme " + id + " dark")[0]);
  if (!fromTheme[id] || fromTheme[id][0] !== light["--bg"] || fromTheme[id][1] !== dark["--bg"]) fail(id + " chrome colour is not the page");
}
const listed = (coreJs.match(/scheme: oneOf\(\[([^\]]+)\]/) || [,""])[1].match(/"([^"]+)"/g) || [];
const coreIds = listed.map(s => s.slice(1, -1));
if (JSON.stringify(coreIds) !== JSON.stringify(["green"].concat(IDS))) fail("core.js scheme list is " + coreIds.join(","));
const choice = appJs.match(/SCHEME_CHOICES = (\[[\s\S]*?\]);/);
const choiceIds = choice ? (choice[1].match(/"([^"]+)"/g) || []).filter((_, i) => i % 2 === 0).map(s => s.slice(1, -1)) : [];
if (JSON.stringify(choiceIds) !== JSON.stringify(["green"].concat(IDS))) fail("picker ids are " + choiceIds.join(","));
const html = fs.readFileSync(path.join(root, "docs/index.html"), "utf8");
if (!html.includes('content="#F6F7F5"') || !html.includes('content="#111413"')) fail("Green browser chrome changed");
if (!/GREEN_CHROME = \["#F6F7F5", "#111413"\]/.test(themeJs) || !/GREEN_CHROME = \["#F6F7F5", "#111413"\]/.test(appJs)) fail("Green chrome constants changed");

if (failed) { console.error(failed + " scheme check(s) failed"); process.exit(1); }
console.log("schemes ok: green, " + IDS.join(", ") + " (light and dark)");
