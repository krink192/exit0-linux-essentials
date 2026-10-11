// SPDX-License-Identifier: GPL-3.0-or-later
// exit 0 service worker: lets the installed web app open and work offline.
// Same-origin files are network-first (always fresh when online, cached copy when offline).
// Google Fonts are cache-first. The package repository under /repo/ is never touched.
const CACHE = "exit0-v5";
const SHELL = ["./", "index.html", "css/styles.css", "js/core.js", "js/app.js", "data/bank.js", "data/cards.js", "data/sheets.js", "data/labs.js", "js/shell.js",
               "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes("/repo/")) return;
    e.respondWith(networkFirst(req));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); }); });
}
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") { const page = await cache.match("index.html"); if (page) return page; }
    return Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }
  catch (err) { return Response.error(); }
}
