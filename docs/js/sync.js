// SPDX-License-Identifier: GPL-3.0-or-later
// Optional progress sync with an exit0-sync server (self-hosted, or exit 0 Cloud). The app works fully without it.
// No DOM access here, so it runs in the browser (window.LESync) and in Node tests (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LESync = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const META_KEY = "le010.sync";
  const PACK = "le010";

  /**
   * opts: { core, fetch, storage, getState, resetProgress, onChange, now, deviceName }
   *   getState()        the live app state object (mutated in place by sync)
   *   resetProgress()   wipe local progress, keep settings (used for "use account data" and remote resets)
   *   onChange(info)    called after remote changes were merged in, so the app can re-render
   */
  function createSync(opts) {
    const C = opts.core, now = opts.now || Date.now;
    const storage = opts.storage, doFetch = opts.fetch;
    let meta = load();
    let running = null, again = false;

    function load() {
      try { return Object.assign(blank(), JSON.parse(storage.getItem(META_KEY)) || {}); } catch (e) { return blank(); }
    }
    function blank() { return { url: "", username: "", token: null, device: null, epoch: null, cursor: 0, ownSeq: 0, others: {},
                                settingsSnap: null, settingsTs: {}, pushed: null, lastSync: null, lastError: null, pending: null }; }
    function persist() { try { storage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* storage full or blocked */ } }

    const base = () => meta.url.replace(/\/+$/, "");
    async function call(method, path, body, token) {
      const headers = {};
      if (token) headers.Authorization = "Bearer " + token;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      let res;
      try { res = await doFetch(base() + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
      catch (e) { const err = new Error("Can't reach the sync server."); err.offline = true; throw err; }
      let data = null; try { data = await res.json(); } catch (e) { /* empty body */ }
      if (!res.ok) { const err = new Error((data && data.error) || ("Server error " + res.status)); err.status = res.status; err.data = data || {}; throw err; }
      return data;
    }

    function othersView() { return C.mergeStates(Object.values(meta.others)); }
    function freshMeta(keep) { const m = blank(); m.url = keep.url; m.username = keep.username; return m; }

    // ------------------------------------------------------------ sign in / out
    /** Check a server URL. Resolves to its /v1/health info. */
    async function probe(url) {
      const old = meta.url; meta.url = url;
      try { const h = await call("GET", "/v1/health"); if (!h || h.app !== "exit0-sync") throw new Error("That address isn't an exit 0 sync server."); return h; }
      finally { meta.url = old; }
    }
    /**
     * Sign in and link this device. Returns { linked: true } or { needsChoice: true, copied } when both this device
     * and the account already have progress; the app then calls choose("merge" | "cloud").
     */
    async function signIn(url, username, password, { signup } = {}) {
      url = String(url || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(url)) throw new Error("Enter the full address, starting with https://");
      meta = freshMeta({ url, username });
      const r = await call("POST", signup ? "/v1/signup" : "/v1/login", { username, password, device: opts.deviceName || "Device" });
      Object.assign(meta, { token: r.token, device: r.device, username: r.user.username });
      const remote = await call("GET", `/v1/packs/${PACK}?since=0`, undefined, meta.token);
      meta.epoch = remote.epoch;
      const st = opts.getState();
      // Settings already on the account win over this device's on first link (time 0 loses to any real change).
      // The first device on an empty account sets the account's settings.
      meta.settingsSnap = C.syncedSettings(st.settings); meta.settingsTs = {};
      if (!remote.replicas.length) for (const k in meta.settingsSnap) meta.settingsTs[k] = now();
      const remoteView = C.mergeStates(remote.replicas.map(x => x.doc));
      if (remote.replicas.length && C.hasProgress(st)) {
        meta.pending = { copied: C.looksCopied(st, remoteView) };
        persist();
        return { needsChoice: true, copied: meta.pending.copied };
      }
      persist();
      await syncNow();
      return { linked: true };
    }
    /** "merge": add this device's progress to the account. "cloud": replace this device's progress with the account's. */
    async function choose(how) {
      if (!meta.pending) return;
      if (how === "cloud") opts.resetProgress();
      meta.pending = null; meta.others = {}; meta.cursor = 0; meta.ownSeq = 0;
      persist();
      await syncNow();
    }
    async function signOut() {
      const token = meta.token;
      meta = freshMeta(meta); persist();
      if (token) { try { await call("POST", "/v1/logout", undefined, token); } catch (e) { /* signed out locally anyway */ } }
    }

    // ------------------------------------------------------------ sync
    /** Pull other devices' changes, merge, and push this device's share. Safe to call often. */
    function syncNow() {
      if (running) { again = true; return running; }
      running = (async () => {
        try { do { again = false; await once(); } while (again); }
        finally { running = null; }
      })();
      return running;
    }

    async function once() {
      if (!meta.token || meta.pending) return;
      const st = opts.getState();
      const t = now();
      // 1. This device's share, measured against what the other devices had contributed before this pull.
      const stamped = C.stampSettings(st.settings, meta.settingsSnap, meta.settingsTs, t);
      meta.settingsSnap = stamped.snap; meta.settingsTs = stamped.ts;
      let own = C.ownPart(st, othersView(), meta.settingsTs);
      try {
        // 2. Pull.
        let remote = await call("GET", `/v1/packs/${PACK}?since=${meta.cursor}`, undefined, meta.token);
        if (meta.epoch != null && remote.epoch !== meta.epoch) {
          // Progress was reset on another device: start over here too.
          opts.resetProgress();
          meta.others = {}; meta.ownSeq = 0; meta.cursor = 0; meta.pushed = null;
          own = C.ownPart(opts.getState(), C.mergeStates([]), meta.settingsTs);
          remote = await call("GET", `/v1/packs/${PACK}?since=0`, undefined, meta.token);
        }
        meta.epoch = remote.epoch;
        let changed = false;
        for (const r of remote.replicas) {
          if (r.device === meta.device.id) { meta.ownSeq = r.seq; continue; }
          meta.others[r.device] = r.doc; changed = true;
        }
        meta.cursor = remote.seq;
        // 3. Merge everything into the live state.
        const before = changed ? JSON.stringify([st.tests.length, st.qstats, st.cards, st.days, st.labs, st.badges]) : null;
        C.applyMerged(opts.getState(), C.mergeStates([own].concat(Object.values(meta.others))));
        // 4. Push this device's share if it changed since the last push.
        const doc = JSON.stringify(own);
        if (doc !== meta.pushed) {
          let r;
          try { r = await call("PUT", `/v1/packs/${PACK}/replicas/${meta.device.id}`, { epoch: meta.epoch, base: meta.ownSeq, doc: own }, meta.token); }
          catch (e) {
            if (e.status !== 409) throw e;
            if (e.data.epoch != null && e.data.epoch !== meta.epoch) { again = true; persist(); return; }   // reset elsewhere: next round handles it
            meta.ownSeq = e.data.seq || 0;                                                                // another tab of this device wrote first
            r = await call("PUT", `/v1/packs/${PACK}/replicas/${meta.device.id}`, { epoch: meta.epoch, base: meta.ownSeq, doc: own }, meta.token);
          }
          meta.ownSeq = r.seq; meta.pushed = doc;
        }
        meta.lastSync = now(); meta.lastError = null;
        persist();
        const st2 = opts.getState();
        if (changed && before !== JSON.stringify([st2.tests.length, st2.qstats, st2.cards, st2.days, st2.labs, st2.badges]) && opts.onChange) opts.onChange({ remote: true });
      } catch (e) {
        meta.lastError = e.message;
        if (e.status === 401) { meta.token = null; meta.lastError = "Signed out. Sign in again to keep syncing."; }
        persist();
        if (!e.offline && e.status !== 401) throw e;
      }
    }

    /** Wipe progress on every device of this account (the app's "Reset all progress" while signed in). */
    async function resetEverywhere() {
      const r = await call("POST", `/v1/packs/${PACK}/reset`, undefined, meta.token);
      opts.resetProgress();
      Object.assign(meta, { epoch: r.epoch, others: {}, ownSeq: 0, cursor: 0, pushed: null });
      persist();
      await syncNow();
    }
    async function devices() { return call("GET", "/v1/devices", undefined, meta.token); }
    async function removeDevice(id) { return call("DELETE", "/v1/devices/" + encodeURIComponent(id), undefined, meta.token); }
    async function changePassword(current, password, signOutOthers) { return call("POST", "/v1/password", { current, password, signOutOthers }, meta.token); }

    return {
      probe, signIn, choose, signOut, syncNow, resetEverywhere, devices, removeDevice, changePassword,
      get linked() { return !!meta.token; },
      get pending() { return meta.pending; },
      get info() { return { url: meta.url, username: meta.username, device: meta.device, lastSync: meta.lastSync, lastError: meta.lastError, others: Object.keys(meta.others).length }; },
    };
  }

  return { createSync, META_KEY, PACK };
});
