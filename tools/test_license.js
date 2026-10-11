// SPDX-License-Identifier: AGPL-3.0-or-later
// Checks that the project stays under one license: LICENSE is the GNU AGPL v3,
// every source file declares AGPL-3.0-or-later, and no file still says plain GPL.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ID = "SPDX-License-Identifier: AGPL-3.0-or-later";
const SOURCE = /\.(js|py|css|html)$/;
const SKIP_DIRS = new Set([".git", "node_modules", "data", "icons", "screenshots"]);
const EXTRA = ["Dockerfile", "desktop/linux/exit0"];

let failures = 0;
const fail = msg => { failures++; console.error("FAIL " + msg); };

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (SOURCE.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

// 1. LICENSE is the AGPL.
const lic = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
if (!/^\s*GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3, 19 November 2007/.test(lic)) fail("LICENSE is not the GNU AGPL v3");
if (!lic.includes("13. Remote Network Interaction")) fail("LICENSE is missing AGPL section 13");

// 2. Every source file carries the AGPL identifier in its first lines.
const files = ["docs", "tools", "desktop"].flatMap(d => walk(path.join(ROOT, d), []))
  .concat(EXTRA.map(f => path.join(ROOT, f)));
for (const f of files) {
  const head = fs.readFileSync(f, "utf8").split("\n").slice(0, 3).join("\n");
  if (!head.includes(ID)) fail(`${path.relative(ROOT, f)} has no "${ID}" header`);
}

// 3. Package metadata and the app footer agree.
const meta = [
  ["desktop/linux/nfpm.yaml", "license: AGPL-3.0-or-later"],
  ["Dockerfile", 'org.opencontainers.image.licenses="AGPL-3.0-or-later"'],
  ["docs/js/app.js", "GNU AGPL v3"],
  ["README.md", "GNU Affero General Public License v3.0 or later"],
  ["CONTRIBUTING.md", "GNU Affero General Public"],
];
for (const [f, needle] of meta) {
  if (!fs.readFileSync(path.join(ROOT, f), "utf8").includes(needle)) fail(`${f} does not contain "${needle}"`);
}

// 4. No leftover plain-GPL identifiers anywhere we checked.
for (const f of files.concat(meta.map(([f]) => path.join(ROOT, f)))) {
  if (/(^|[^A])GPL-3\.0-(or-later|only)/m.test(fs.readFileSync(f, "utf8"))) fail(`${path.relative(ROOT, f)} still says GPL-3.0`);
}

if (failures) { console.error(`${failures} license check(s) failed`); process.exit(1); }
console.log(`License checks passed (${files.length} source files)`);
