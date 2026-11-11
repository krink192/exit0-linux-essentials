// SPDX-License-Identifier: AGPL-3.0-or-later
// Applies the saved theme before the first paint. A file of its own, because the page's Content-Security-Policy
// allows no inline scripts.
try {
  var t = JSON.parse(localStorage.getItem("le010.v3")).settings.theme;
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) { /* nothing saved yet, or storage is blocked */ }
