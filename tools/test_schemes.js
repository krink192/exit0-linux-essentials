// SPDX-License-Identifier: AGPL-3.0-or-later
// Every colour scheme, light and dark, must keep text at 4.5:1 and the boundaries a learner uses to
// see a control (field border, focus ring, and on the added schemes the button border) at 3:1.
// The label on the accent button must clear 4.5:1. It is white when that passes, and near-black when
// the accent is too light for white (GitHub, Catppuccin, Tokyo Night and Dracula in dark).
// Green's button border still sits under 3:1 on purpose. Light mode's ink, page and card are a step
// softer than the old near-black on white; dark mode is unchanged. The plan card in a light scheme
// uses that scheme's dark raised surface, and the done mark is an accent step that clears 4.5:1.
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
--bg #ECEDEB
--field-line #7F8A83
--flag #8A5200
--flag-soft #FBEEDB
--good #14633A
--good-soft #E6F2EA
--hover #DFE3DE
--ink #2D3631
--ink-2 #3A443F
--knob #FFFFFF
--line #E5E7E4
--line-2 #BEC5BF
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
--side #E4E7E4
--sunk #E6E8E5
--surface #F8F8F7
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
--track #D9DDD8
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
  const raw = {};
  for (const k of Object.keys(toks)) raw[k] = String(toks[k]).trim();
  const o = {};
  for (const k of Object.keys(raw)) {
    let v = raw[k];
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    if (ref) v = raw[ref[1]] || "";
    if (/^#[0-9A-F]{6}$/i.test(v)) o[k] = v.toUpperCase();
  }
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
    ["pipe text on hover", "--pipe-ink", "--pipe-hover"], ["pipe secondary on hover", "--pipe-dim", "--pipe-hover"],
    ["pipe next label", "--pipe-next-ink", "--pipe-next"], ["pipe next label on hover", "--pipe-next-ink", "--pipe-next-hover"],
    ["pipe done", "--pipe-done", "--pipe-bg"], ["pipe done on hover", "--pipe-done", "--pipe-hover"],
    ["right on card", "--good", "--surface"], ["right on soft", "--good", "--good-soft"],
    ["wrong on card", "--bad", "--surface"], ["wrong on soft", "--bad", "--bad-soft"],
    ["flag on card", "--flag", "--surface"], ["flag on soft", "--flag", "--flag-soft"],
    ["needs-work on card", "--warm", "--surface"], ["needs-work on soft", "--warm", "--warm-soft"],
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
  if (light["--pipe-bg"] !== dark["--surface"]) fail(id + " light plan card is not the dark raised surface");
  const accentStep = new Set([dark["--accent"], dark["--accent-2"], dark["--accent-text"]]);
  if (!accentStep.has(light["--pipe-done"]) || !accentStep.has(dark["--pipe-done"])) fail(id + " plan done mark is not the accent");
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
if (!html.includes('content="#ECEDEB"') || !html.includes('content="#111413"')) fail("Green browser chrome is not the light page and the unchanged dark chrome");
if (!/GREEN_CHROME = \["#ECEDEB", "#111413"\]/.test(themeJs) || !/GREEN_CHROME = \["#ECEDEB", "#111413"\]/.test(appJs)) fail("Green chrome constants changed");

// Success is the accent. --good is the success token (right answers, the streak, "Got it").
// It has to be var(--accent-text), and --good-soft var(--accent-soft), so a scheme cannot keep a
// green "right" that ignores the palette. A scheme that truly needs red/green meaning (a signal
// the accent cannot carry) is named in DISTINCT_SUCCESS with a reason, and sets --good to a hex.
// None do today.
const DISTINCT_SUCCESS = new Set();
function assertSuccess(name, raw) {
  if (!raw) { fail(name + " success block missing"); return; }
  if (DISTINCT_SUCCESS.has(name.split(" ")[0])) {
    if (!/^#[0-9A-F]{6}$/i.test(raw["--good"] || "")) fail(name + " distinct success is not a hex");
    return;
  }
  if (raw["--good"] !== "var(--accent-text)") fail(name + " --good is " + raw["--good"] + ", not the accent text");
  if (raw["--good-soft"] !== "var(--accent-soft)") fail(name + " --good-soft is " + raw["--good-soft"] + ", not the accent soft");
}
assertSuccess("green light", tokensOf(braceAt(css.indexOf(":root {"))));
assertSuccess("green dark", tokensOf(braceAt(css.indexOf(':root[data-theme="dark"]'))));
assertSuccess("green dark media", tokensOf(braceAt(css.indexOf(':root:not([data-theme="light"])'))));
assertSuccess("green print", tokensOf(braceAt(css.indexOf("Always print with the light tokens"))));
for (const id of IDS) {
  assertSuccess(id + " light", blocks("@scheme " + id + " light")[0]);
  const darks = blocks("@scheme " + id + " dark");
  assertSuccess(id + " dark", darks[0]);
  assertSuccess(id + " dark copy", darks[1]);
  assertSuccess(id + " print", blocks("@scheme " + id + " print")[0]);
}
const doneRules = css.split("\n").filter(l => /\.task\.done \.tnum \{/.test(l));
if (doneRules.length !== 1 || !/^\.task\.done \.tnum \{ background: var\(--accent\); color: var\(--accent-ink\); \}/.test(doneRules[0].trim())) fail("done check is not the accent button pair for every scheme");
if (!/\.flame \{ color: var\(--good\); \}/.test(css)) fail("streak colour is not the success token");

// A literal colour outside a custom-property declaration has to be on this list. Each pattern is one
// reason, and it matches the whole line so a new colour on another line still fails.
// Scheme picker dots paint every palette at once, so they cannot be var(--bg). checkDots requires
// each dot to equal that scheme's token.
// Browser chrome is read before CSS (boot script and the theme-color metas). The checks above require
// those values to match the page, except green's dark chrome, which stays #111413.
// The tab icon is the product mark ($?), not a surface of the theme.
// The manifest is the installed-app fallback before JS. It is asserted to match the light page.
const ALLOW_LINE = [
  /\.swatch\[data-v="[a-z]+"\] \.dot-(?:bg|surface|ink|accent) \{ background: #[0-9A-Fa-f]{6}; \}/,
  /SCHEME_BG = \{/,
  /GREEN_CHROME = \[/,
  /name="theme-color"/,
  /rel="icon"/,
  /"background_color"/,
  /"theme_color"/,
];
const NAMED_OK = new Set(["transparent", "currentcolor"]);
const NAMED = new Set(("black silver gray grey white maroon red purple fuchsia magenta green lime olive yellow navy blue teal aqua cyan orange orangered gold pink brown tan beige ivory azure coral crimson tomato chocolate peru sienna wheat khaki lavender plum violet orchid indigo rebeccapurple chartreuse lawngreen limegreen forestgreen seagreen springgreen aquamarine turquoise skyblue dodgerblue royalblue midnightblue linen snow dimgray darkgray lightgray gainsboro whitesmoke").split(" "));
function lineAt(text, index) { return text.slice(0, index).split("\n").length; }
function allowed(fileLines, lineNo) {
  const line = fileLines[lineNo - 1] || "";
  return ALLOW_LINE.some(re => re.test(line));
}
function reportLiteral(file, text, index, colour) {
  const n = lineAt(text, index);
  if (allowed(text.split("\n"), n)) return;
  fail(file + ":" + n + " literal colour " + colour.trim());
}
function scanValue(file, text, value, abs) {
  const re = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
  let m;
  while ((m = re.exec(value))) reportLiteral(file, text, abs + m.index, m[0]);
  const named = /(?:^|[^A-Za-z-])([A-Za-z]+)(?![A-Za-z-])/g;
  while ((m = named.exec(value))) {
    const word = m[1].toLowerCase();
    if (!NAMED.has(word) || NAMED_OK.has(word)) continue;
    reportLiteral(file, text, abs + m.index + (m[0].length - m[1].length), m[1]);
  }
}
function scanCss(file, src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let j = i + 1, depth = 1, nested = false;
    for (; j < text.length && depth; j++) {
      if (text[j] === "{") { depth++; nested = true; }
      else if (text[j] === "}") depth--;
    }
    if (nested) continue;
    const body = text.slice(i + 1, j - 1);
    const parts = body.split(";");
    let offset = i + 1;
    for (const decl of parts) {
      const colon = decl.indexOf(":");
      if (colon >= 0) {
        const prop = decl.slice(0, colon).trim();
        if (prop && !prop.startsWith("--") && !prop.startsWith("@")) scanValue(file, text, decl.slice(colon + 1), offset + colon + 1);
      }
      offset += decl.length + 1;
    }
  }
}
function stripCodeComments(src) {
  let out = "", i = 0, mode = "code";
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") { out += "  "; i += 2; mode = "line"; continue; }
      if (c === "/" && n === "*") { out += "  "; i += 2; mode = "block"; continue; }
      if (c === "<" && src.slice(i, i + 4) === "<!--") { out += "    "; i += 4; mode = "html"; continue; }
      if (c === '"' || c === "'" || c === "`") { mode = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === "line") { if (c === "\n") { mode = "code"; out += "\n"; } else out += " "; i++; continue; }
    if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (mode === "html") {
      if (src.slice(i, i + 3) === "-->") { mode = "code"; out += "   "; i += 3; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    out += c;
    if (c === "\\") { if (n) out += n; i += n ? 2 : 1; continue; }
    if (c === mode) mode = "code";
    i++;
  }
  return out;
}
function scanText(file, src) {
  const text = stripCodeComments(src);
  const re = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|%23(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/gi;
  let m;
  while ((m = re.exec(text))) reportLiteral(file, text, m.index, m[0]);
  const styleRe = /(?:style|fill|stroke)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  while ((m = styleRe.exec(text))) {
    const value = m[2] != null ? m[2] : m[3];
    const abs = m.index + m[0].indexOf(value);
    scanValue(file, text, value, abs);
  }
}
scanCss("docs/css/styles.css", css);
for (const name of fs.readdirSync(path.join(root, "docs/js"))) {
  if (!name.endsWith(".js")) continue;
  const rel = "docs/js/" + name;
  scanText(rel, fs.readFileSync(path.join(root, rel), "utf8"));
}
scanText("docs/index.html", html);
const manifestPath = path.join(root, "docs/manifest.webmanifest");
const manifestSrc = fs.readFileSync(manifestPath, "utf8");
scanText("docs/manifest.webmanifest", manifestSrc);
const manifest = JSON.parse(manifestSrc);
if (String(manifest.background_color).toUpperCase() !== greenLight["--bg"]) fail("manifest background is not the light page");
if (String(manifest.theme_color).toUpperCase() !== greenLight["--bg"]) fail("manifest theme colour is not the light page");

if (failed) { console.error(failed + " scheme check(s) failed"); process.exit(1); }
console.log("schemes ok: green, " + IDS.join(", ") + " (light and dark)");
