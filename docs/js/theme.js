// SPDX-License-Identifier: AGPL-3.0-or-later
// Applies the saved theme and colour scheme before the first paint. A file of its own, because the page's
// Content-Security-Policy allows no inline scripts. Green is the default and sets no data-scheme attribute,
// so the palette in styles.css is unchanged for anyone who never picks another scheme.
var SCHEME_BG = { github: ["#F6F8FA", "#0D1117"], flexoki: ["#F2F0E5", "#100F0F"], catppuccin: ["#E6E9EF", "#1E1E2E"], tokyo: ["#E1E2E7", "#1A1B26"], dracula: ["#FFFBEB", "#282A36"] };
var GREEN_CHROME = ["#F6F7F5", "#111413"];
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
