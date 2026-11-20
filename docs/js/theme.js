// SPDX-License-Identifier: AGPL-3.0-or-later
// Applies the saved theme and colour scheme before the first paint. A file of its own, because the page's
// Content-Security-Policy allows no inline scripts. Green is the default and sets no data-scheme attribute,
// so the palette in styles.css is unchanged for anyone who never picks another scheme.
var SCHEME_BG = { github: ["#EDEFF1", "#0D1117"], flexoki: ["#E8E6DB", "#100F0F"], catppuccin: ["#E9EBED", "#1E1E2E"], tokyo: ["#E5E5E7", "#1A1B26"], dracula: ["#F5F1E2", "#282A36"] };
var GREEN_CHROME = ["#ECEDEB", "#111413"];
try {
  var saved = JSON.parse(localStorage.getItem("le010.v3")).settings || {};
  var t = saved.theme, scheme = saved.scheme, root = document.documentElement;
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
  if (SCHEME_BG[scheme]) root.setAttribute("data-scheme", scheme);
  var dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var i, media;
  if (!SCHEME_BG[scheme]) {
    for (i = 0; i < metas.length; i++) {
      media = metas[i].getAttribute("media") || "";
      metas[i].setAttribute("content", media.indexOf("dark") >= 0 ? GREEN_CHROME[1] : GREEN_CHROME[0]);
    }
  } else {
    var c = SCHEME_BG[scheme][dark ? 1 : 0];
    for (i = 0; i < metas.length; i++) metas[i].setAttribute("content", c);
  }
} catch (e) { /* nothing saved yet, or storage is blocked */ }
