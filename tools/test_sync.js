// SPDX-License-Identifier: AGPL-3.0-or-later
// Run: node tools/test_sync.js
// Simulates several devices syncing through an in-memory server that follows exit0-sync protocol v1,
// and checks that every device ends up with the same progress and nothing is counted twice.
const assert = require("assert");
const path = require("path");
global.window = {};
require(path.join(__dirname, "../docs/data/bank.js"));
require(path.join(__dirname, "../docs/data/cards.js"));
const C = require(path.join(__dirname, "../docs/js/core.js"));
const { createSync } = require(path.join(__dirname, "../docs/js/sync.js"));
const bank = C.indexBank(window.LE_BANK), cards = window.LE_CARDS;
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// ------------------------------------------------------------- fake server (protocol v1, one user)
function fakeServer() {
  const S = { users: { jacob: "correct horse battery" }, tokens: {}, replicas: {}, seq: 0, epoch: 1, up: true, nextDev: 1 };
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  S.fetch = async (url, { method, headers, body }) => {
    if (!S.up) throw new TypeError("fetch failed");
    const p = new URL(url).pathname + new URL(url).search, b = body ? JSON.parse(body) : {};
    const auth = (headers.Authorization || "").replace("Bearer ", ""), dev = S.tokens[auth];
    let m;
    if (p === "/v1/health") return json(200, { ok: true, app: "exit0-sync", protocol: 1, signup: false });
    if (p === "/v1/login") {
      if (S.users[b.username] !== b.password) return json(401, { error: "Wrong username or password." });
      const id = "d" + S.nextDev++, token = "tok-" + id + "-xxxxxxxxxxxxxxxxxxxx"; S.tokens[token] = id;
      return json(200, { token, user: { id: 1, username: b.username }, device: { id, name: b.device } });
    }
    if (!dev) return json(401, { error: "Sign in again." });
    if (p === "/v1/logout") { delete S.tokens[auth]; return json(200, { ok: true }); }
    if ((m = /^\/v1\/packs\/le010\?since=(\d+)$/.exec(p))) {
      const since = +m[1];
      const reps = Object.entries(S.replicas).filter(([, r]) => r.seq > since).sort((a, c) => a[1].seq - c[1].seq)
        .map(([device, r]) => ({ device, seq: r.seq, updatedAt: 0, doc: JSON.parse(r.doc) }));
      const top = Math.max(0, ...Object.values(S.replicas).map(r => r.seq));
      return json(200, { epoch: S.epoch, seq: Math.max(top, since), replicas: reps });
    }
    if ((m = /^\/v1\/packs\/le010\/replicas\/(\w+)$/.exec(p)) && method === "PUT") {
      if (m[1] !== dev) return json(403, { error: "own only" });
      if (b.epoch !== S.epoch) return json(409, { error: "reset", epoch: S.epoch });
      const have = S.replicas[dev] ? S.replicas[dev].seq : 0;
      if ((b.base || 0) !== have) return json(409, { error: "stale", seq: have });
      S.replicas[dev] = { seq: ++S.seq, doc: JSON.stringify(b.doc) };
      return json(200, { seq: S.seq, epoch: S.epoch });
    }
    if (p === "/v1/packs/le010/reset") { S.replicas = {}; S.epoch++; return json(200, { epoch: S.epoch }); }
    return json(404, { error: "Not found." });
  };
  return S;
}

// ------------------------------------------------------------- a fake device running the app's state + sync
function device(server, name) {
  const mem = {};
  const storage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const d = { st: C.freshState(), changes: 0 };
  d.sync = createSync({ core: C, fetch: server.fetch, storage, deviceName: name,
    getState: () => d.st,
    resetProgress: () => { const keep = d.st.settings; d.st = C.freshState(); d.st.settings = keep; },
    onChange: () => { d.changes++; } });
  d.answer = (ids, ok, at) => {           // finish a study session answering `ids`, all right or all wrong
    const s = C.newSession(bank, "study", "Study", ids, { study: true, now: at });
    ids.forEach(id => { const q = bank.byId[id]; s.answers[id] = q.type === "fill" ? (ok ? q.accept[0] : "zzz") : (ok ? q.answer : [q.options.length - 1 === q.answer[0] ? 0 : q.options.length - 1]); });
    C.recordResult(d.st, bank, s, C.grade(bank, s, at), at);
  };
  d.cardReview = (id, knew, at) => { C.reviewCard(d.st.cards, id, knew, C.dayNum(at), at); C.addActivity(d.st, 1, at); };
  return d;
}
const URL0 = "https://sync.example.test";
const totals = st => ({ seen: Object.values(st.qstats).reduce((a, s) => a + s.seen, 0), right: Object.values(st.qstats).reduce((a, s) => a + s.right, 0),
  tests: st.tests.length, days: Object.values(st.days).reduce((a, x) => a + x, 0), cards: Object.values(st.cards).reduce((a, s) => a + s.seen, 0) });
const canon = x => Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.keys(x).sort().reduce((o, k) => (o[k] = canon(x[k]), o), {}) : x;
const progressOf = st => JSON.stringify(canon({ q: st.qstats, c: st.cards, d: st.days, t: st.tests.map(x => x.id), b: st.badges, l: st.labs }));
const Q = bank.questions.map(q => q.id);
const T0 = Date.UTC(2026, 9, 1, 18);

(async () => {
  await t("merge: counts add, newest schedule wins, tests union, earliest badge, labs union", () => {
    const a = { qstats: { x: { seen: 2, right: 1, last: false, at: 10, box: 0, due: 5 } }, days: { "2026-10-01": 3 }, tests: [{ id: "t1", date: 1 }],
                badges: { b: 50 }, labs: { l: { done: [0, 1] } }, settings: { goal: 20 }, settingsTs: { goal: 1 } };
    const b = { qstats: { x: { seen: 1, right: 1, last: true, at: 20, box: 1, due: 9 } }, days: { "2026-10-01": 2 }, tests: [{ id: "t2", date: 2 }, { id: "t1", date: 1 }],
                badges: { b: 40 }, labs: { l: { done: [1, 2], completedAt: 99 } }, settings: { goal: 40, theme: "dark" }, settingsTs: { goal: 2 } };
    const m = C.mergeStates([a, b]), m2 = C.mergeStates([b, a]);
    assert.deepStrictEqual(m, m2);
    assert.deepStrictEqual(m.qstats.x, { seen: 3, right: 2, last: true, at: 20, box: 1, due: 9 });
    assert.strictEqual(m.days["2026-10-01"], 5);
    assert.deepStrictEqual(m.tests.map(x => x.id), ["t1", "t2"]);
    assert.strictEqual(m.badges.b, 40);
    assert.deepStrictEqual(m.labs.l, { done: [0, 1, 2], completedAt: 99 });
    assert.strictEqual(m.settings.goal, 40);
    assert.strictEqual(m.settings.theme, undefined);      // theme stays on each device
  });

  await t("ownPart(merge(own, others), others) gives back own's counts", () => {
    const own = { qstats: { x: { seen: 2, right: 1, at: 10 }, y: { seen: 1, right: 0, at: 30 } }, days: { d: 2 }, tests: [{ id: "a", date: 1 }] };
    const oth = { qstats: { x: { seen: 3, right: 3, at: 20 } }, days: { d: 5 }, tests: [{ id: "b", date: 2 }] };
    const view = C.mergeStates([own, oth]); const settings = { goal: 20 };
    const back = C.ownPart(Object.assign(view, { settings }), C.mergeStates([oth]));
    assert.deepStrictEqual([back.qstats.x.seen, back.qstats.x.right, back.qstats.y.seen], [2, 1, 1]);
    assert.strictEqual(back.days.d, 2);
    assert.deepStrictEqual(back.tests.map(x => x.id), ["a"]);
  });

  await t("two devices: progress from both shows up on both, nothing double-counted", async () => {
    const srv = fakeServer(), laptop = device(srv, "Laptop"), phone = device(srv, "Phone");
    laptop.answer(Q.slice(0, 10), true, T0);
    assert.deepStrictEqual(await laptop.sync.signIn(URL0, "jacob", "correct horse battery"), { linked: true });
    assert.deepStrictEqual(await phone.sync.signIn(URL0, "jacob", "correct horse battery"), { linked: true });
    assert.deepStrictEqual(totals(phone.st), totals(laptop.st));
    phone.answer(Q.slice(5, 15), false, T0 + 3600e3);
    phone.cardReview(cards[0].id, true, T0 + 3601e3);
    await phone.sync.syncNow(); await laptop.sync.syncNow();
    for (let i = 0; i < 3; i++) { await phone.sync.syncNow(); await laptop.sync.syncNow(); }   // repeated syncs change nothing
    assert.strictEqual(progressOf(laptop.st), progressOf(phone.st));
    assert.deepStrictEqual(totals(laptop.st), { seen: 20, right: 10, tests: 2, days: 21, cards: 1 });
    assert.strictEqual(laptop.st.qstats[Q[7]].last, false);   // phone answered it later, and wrong
    assert(laptop.changes > 0);
  });

  await t("three devices working offline converge once they reconnect", async () => {
    const srv = fakeServer(), ds = ["A", "B", "C"].map(x => device(srv, x));
    for (const d of ds) await d.sync.signIn(URL0, "jacob", "correct horse battery");
    srv.up = false;
    ds.forEach((d, i) => { d.answer(Q.slice(i * 7, i * 7 + 12), i !== 1, T0 + i * 1000); d.cardReview(cards[i].id, true, T0 + i * 1000 + 1); });
    for (const d of ds) await d.sync.syncNow();             // offline: no error, keeps working
    assert(ds[0].sync.info.lastError);
    srv.up = true;
    for (let round = 0; round < 2; round++) for (const d of ds) await d.sync.syncNow();
    assert.strictEqual(progressOf(ds[0].st), progressOf(ds[1].st));
    assert.strictEqual(progressOf(ds[1].st), progressOf(ds[2].st));
    assert.deepStrictEqual(totals(ds[2].st), { seen: 36, right: 24, tests: 3, days: 39, cards: 3 });
  });

  await t("signing in with progress on both sides asks; 'use account data' doesn't double-count a copy", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    a.answer(Q.slice(0, 8), true, T0);
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    b.st = JSON.parse(JSON.stringify(a.st));                // B got A's progress through an export code
    const r = await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(r, { needsChoice: true, copied: true });
    await b.sync.choose("cloud");
    assert.deepStrictEqual(totals(b.st), totals(a.st));
    assert.strictEqual(totals(b.st).seen, 8);
  });

  await t("'combine' adds a separate device's history", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    a.answer(Q.slice(0, 8), true, T0);
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    b.answer(Q.slice(20, 25), false, T0 + 5000);
    const r = await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(r, { needsChoice: true, copied: false });
    await b.sync.choose("merge"); await a.sync.syncNow();
    assert.deepStrictEqual(totals(a.st), totals(b.st));
    assert.strictEqual(totals(a.st).seen, 13);
  });

  await t("reset on one device resets every device", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    a.answer(Q.slice(0, 5), true, T0); await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(totals(b.st).seen, 5);
    await a.sync.resetEverywhere();
    await b.sync.syncNow();
    assert.strictEqual(totals(a.st).seen, 0); assert.strictEqual(totals(b.st).seen, 0);
    b.answer(Q.slice(0, 2), true, T0 + 1000); await b.sync.syncNow(); await a.sync.syncNow();
    assert.strictEqual(totals(a.st).seen, 2);
  });

  await t("settings sync (except theme); the latest change wins", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    a.st.settings.examDate = "2026-12-01"; a.st.settings.theme = "dark";
    await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(b.st.settings.examDate, "2026-12-01");
    assert.strictEqual(b.st.settings.theme, "system");
    b.st.settings.goal = 40; await b.sync.syncNow(); await a.sync.syncNow();
    assert.strictEqual(a.st.settings.goal, 40);
  });

  await t("the first device's settings become the account's; later devices take them", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    a.st.settings.examDate = "2026-12-15"; a.st.settings.goal = 40;
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.strictEqual(b.st.settings.examDate, "2026-12-15");
    assert.strictEqual(b.st.settings.goal, 40);
    await a.sync.syncNow();
    assert.strictEqual(a.st.settings.examDate, "2026-12-15");
  });

  await t("a session in progress is never touched by sync", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    b.st.current = C.buildTest(bank, {}, { seed: 1 });
    const snap = JSON.stringify(b.st.current);
    a.answer(Q.slice(0, 3), true, T0); await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(JSON.stringify(b.st.current), snap);
  });

  await t("revoked token: sync stops quietly and asks to sign in again", async () => {
    const srv = fakeServer(), a = device(srv, "A");
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    srv.tokens = {};
    await a.sync.syncNow();
    assert.strictEqual(a.sync.linked, false);
    assert.match(a.sync.info.lastError, /Sign in again/);
  });

  await t("wrong password is reported and nothing is linked", async () => {
    const srv = fakeServer(), a = device(srv, "A");
    await assert.rejects(a.sync.signIn(URL0, "jacob", "nope"), /Wrong username or password/);
    assert.strictEqual(a.sync.linked, false);
  });

  console.log(`\n${n} sync tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
