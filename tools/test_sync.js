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
const { createSync, META_KEY } = require(path.join(__dirname, "../docs/js/sync.js"));
const bank = C.indexBank(window.LE_BANK), cards = window.LE_CARDS;
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// ------------------------------------------------------------- fake server (protocol v1, one user)
function fakeServer() {
  const S = { users: { jacob: "correct horse battery" }, tokens: {}, replicas: {}, seq: 0, epoch: 1, up: true, nextDev: 1, next: null };
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
  S.fetch = async (url, { method, headers, body }) => {
    if (!S.up) throw new TypeError("fetch failed");
    const p = new URL(url).pathname + new URL(url).search, b = body ? JSON.parse(body) : {};
    const auth = (headers.Authorization || "").replace("Bearer ", ""), dev = S.tokens[auth];
    // One-shot (or selective) override. Return { status, body } to replace this response, or null to handle it
    // normally and leave S.next in place. A pull test sets it directly; a PUT test arms it from S.during.
    if (S.next) {
      const over = S.next(method, p, b, dev);
      if (over) return json(over.status, over.body);
    }
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
      if (S.during) { const fn = S.during; S.during = null; fn(); }     // something the learner does while the request is in flight
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
  const d = { st: C.freshState(), changes: 0, mem };
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
    a.st.settings.examDate = "2026-12-01"; a.st.settings.theme = "dark"; a.st.settings.scheme = "flexoki";
    await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(b.st.settings.examDate, "2026-12-01");
    assert.strictEqual(b.st.settings.scheme, "flexoki");
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

  await t("progress made while a sync request is in flight is kept and reaches the other devices", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    b.answer(Q.slice(0, 5), true, T0); await b.sync.syncNow();
    a.answer(Q.slice(5, 8), true, T0 + 1000);
    srv.during = () => {                       // A's pull is on the wire: the learner finishes a set, a flashcard and a lab task
      a.answer(Q.slice(8, 12), false, T0 + 2000); a.cardReview(cards[0].id, true, T0 + 2000);
      a.st.labs.part1 = { done: [0, 1] }; a.st.settings.goal = 30;
    };
    await a.sync.syncNow();
    assert.strictEqual(totals(a.st).seen, 12); assert.strictEqual(totals(a.st).tests, 3);
    assert.strictEqual(a.st.cards[cards[0].id].seen, 1); assert.deepStrictEqual(a.st.labs.part1.done, [0, 1]);
    assert.strictEqual(a.st.days[C.dayKey(T0 + 2000)], 5 + 3 + 4 + 1);
    await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(progressOf(a.st), progressOf(b.st));
    assert.deepStrictEqual(totals(b.st), totals(a.st)); assert.strictEqual(b.st.settings.goal, 30);
    // the same during a pull that finds the account was reset on another device
    await b.sync.resetEverywhere();
    srv.during = () => { a.answer(Q.slice(20, 22), true, T0 + 3000); };      // lands before the reset is seen: wiped with the rest
    await a.sync.syncNow();
    assert.strictEqual(totals(a.st).seen, 0);
    a.answer(Q.slice(30, 33), true, T0 + 4000); await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(totals(b.st).seen, 3); assert.strictEqual(progressOf(a.st), progressOf(b.st));
  });

  await t("a remote change to command practice or settings alone is reported to the app", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    await a.sync.syncNow(); await b.sync.syncNow(); const was = a.changes;
    C.recordDrill(b.st, "skill-x", true, T0); b.st.days = {};                // only cmdstats differs
    await b.sync.syncNow(); await a.sync.syncNow();
    assert.strictEqual(a.st.cmdstats["skill-x"].seen, 1); assert.strictEqual(a.changes, was + 1);
    b.st.settings.examDate = "2027-01-20"; await b.sync.syncNow(); await a.sync.syncNow();
    assert.strictEqual(a.st.settings.examDate, "2027-01-20"); assert.strictEqual(a.changes, was + 2);
  });

  await t("merge: the newest evidence (evAt) wins in any order; an unstamped copy never replaces a stamped one", () => {
    const stamped = { seen: 2, right: 2, last: true, at: 20, box: 2, ev: 1, evAt: 20 }, stale = { seen: 2, right: 1, last: true, at: 30, box: 1, ev: 0 };
    for (const docs of [[stamped, stale], [stale, stamped]]) {
      const m = C.mergeStates(docs.map(x => ({ qstats: { x } }))).qstats.x;
      assert.deepStrictEqual([m.ev, m.evAt, m.at, m.seen], [1, 20, 30, 4], "stamped ev, newest schedule, counts add");
    }
    const later = { seen: 1, right: 0, last: false, at: 40, box: 0, ev: 0, evAt: 40 };
    assert.strictEqual(C.mergeStates([{ qstats: { x: stamped } }, { qstats: { x: later } }]).qstats.x.ev, 0, "a later cold miss wins");
    const same = { seen: 1, right: 1, last: true, at: 50, box: 1, ev: 1, evAt: 20 };   // an old app answered later and kept evAt
    assert.strictEqual(C.mergeStates([{ qstats: { x: same } }, { qstats: { x: stamped } }]).qstats.x.at, 50);
    const tieA = { seen: 1, at: 5, box: 1, ev: 1 }, tieB = { seen: 1, at: 5, box: 1, ev: 0 };
    assert.deepStrictEqual(C.mergeStates([{ qstats: { x: tieA } }, { qstats: { x: tieB } }]), C.mergeStates([{ qstats: { x: tieB } }, { qstats: { x: tieA } }]));
  });

  // A learner like Jacob saved by the old 30-day app: all but 8 facts once on day 0 at 70%, fixed exams A-F on days 10-15 at 90%
  // that the old rule called repeats (ev still from day 0, no evAt).
  const jacobOld = () => {
    const st = C.freshState(), day = 86400000;
    const right = q => q.type === "fill" ? q.accept[0] : q.answer, wrong = q => q.type === "fill" ? "zzz" : [q.options.findIndex((_, i) => !q.answer.includes(i))];
    let skip = 8; const leads = bank.questions.filter(q => !q.variantOf && ("ABCDEF".includes(q.form || "-") || skip-- <= 0)).map(q => q.id);
    for (let i = 0; i < leads.length; i += 40) {
      const ids = leads.slice(i, i + 40), at = T0 + i * 60e3, s = C.newSession(bank, "study", "Study", ids, { study: true, now: at });
      ids.forEach(id => { s.answers[id] = leads.indexOf(id) % 10 < 7 ? right(bank.byId[id]) : wrong(bank.byId[id]); });
      C.recordResult(st, bank, s, C.grade(bank, s, at), at);
    }
    const first = {}; for (const id in st.qstats) first[id] = st.qstats[id].ev;
    "ABCDEF".split("").forEach((f, k) => {
      const at = T0 + (10 + k) * day, s = C.buildTest(bank, {}, { form: f, seed: k + 1, now: at - 3000e3 });
      s.qids.forEach((id, j) => { s.answers[id] = j % 10 === 0 ? wrong(bank.byId[id]) : right(bank.byId[id]); });
      C.recordResult(st, bank, s, C.grade(bank, s, at), at);
    });
    for (const id in st.qstats) { st.qstats[id].ev = first[id]; delete st.qstats[id].evAt; }
    return st;
  };
  const mean = st => { const p = C.passPrediction(bank, st.qstats); return Math.round(100 * p.mean / p.total); };
  const evOf = st => JSON.stringify(canon(Object.keys(st.qstats).reduce((o, id) => (o[id] = [st.qstats[id].ev, st.qstats[id].evAt], o), {})));
  // Two linked devices sharing Jacob's old progress; `order` says which one runs the evidence rebuild (updates) first.
  const rebuildRun = async order => {
    const srv = fakeServer(), laptop = device(srv, "Laptop"), phone = device(srv, "Phone");
    laptop.st = jacobOld();
    await laptop.sync.signIn(URL0, "jacob", "correct horse battery"); await phone.sync.signIn(URL0, "jacob", "correct horse battery");
    const before = mean(phone.st);
    for (const d of order === "laptop" ? [laptop, phone] : [phone, laptop]) { C.rebuildEvidence(bank, d.st); await d.sync.syncNow(); }
    for (let i = 0; i < 2; i++) { await laptop.sync.syncNow(); await phone.sync.syncNow(); }
    return { before, laptop, phone };
  };

  await t("evidence rebuild: two devices converge whichever updates first, and the estimate rises on both", async () => {
    const a = await rebuildRun("laptop"), b = await rebuildRun("phone");
    for (const r of [a, b]) {
      assert.strictEqual(progressOf(r.laptop.st), progressOf(r.phone.st));
      assert.strictEqual(evOf(r.laptop.st), evOf(r.phone.st));
      assert(mean(r.phone.st) > r.before + 5, `estimate ${r.before} -> ${mean(r.phone.st)}`);
    }
    assert.strictEqual(evOf(a.laptop.st), evOf(b.laptop.st), "same evidence whichever device went first");
    assert.deepStrictEqual(totals(a.laptop.st), totals(jacobOld()), "nothing double-counted");
  });

  await t("evidence rebuild: an old app can't overwrite rebuilt evidence, and its own first attempts still arrive", async () => {
    const srv = fakeServer(), laptop = device(srv, "Laptop"), phone = device(srv, "Phone");
    laptop.st = jacobOld();
    await laptop.sync.signIn(URL0, "jacob", "correct horse battery"); await phone.sync.signIn(URL0, "jacob", "correct horse battery");
    C.rebuildEvidence(bank, laptop.st); await laptop.sync.syncNow();   // the laptop updates; the phone still runs the old app
    const rebuilt = mean(laptop.st);
    // Offline, the old phone answers an exam question again (a repeat under its 30-day rule: ev untouched, no evAt) and a new one.
    const exam = phone.st.tests.find(x => x.form === "A"), q = exam.qids.find(id => phone.st.qstats[id].ev === 0 && C.isCorrect(bank.byId[id], exam.answers[id]));
    const fresh = Q.find(id => !C.familyOf(bank, id).some(f => phone.st.qstats[f]));
    assert(fresh, "a fact the learner hasn't seen");
    const at = T0 + 20 * 86400000, keep = phone.st.qstats[q].ev;
    phone.answer([q], true, at); phone.st.qstats[q].ev = keep; delete phone.st.qstats[q].evAt;
    phone.answer([fresh], true, at + 1); delete phone.st.qstats[fresh].evAt;
    for (let i = 0; i < 2; i++) { await phone.sync.syncNow(); await laptop.sync.syncNow(); }
    for (const d of [laptop, phone]) {
      assert.strictEqual(d.st.qstats[q].ev, 1, "the rebuilt cold answer from the exam stands");
      assert.strictEqual(d.st.qstats[q].at, at, "while the schedule follows the phone's later answer");
      assert.strictEqual(d.st.qstats[fresh].ev, 1, "the old app's first attempt counts");
    }
    assert.strictEqual(progressOf(laptop.st), progressOf(phone.st));
    assert(mean(phone.st) >= rebuilt, "the old phone sees the rebuilt estimate too");
    // When the phone updates, its rebuild also picks up the answer its old rule called a repeat (10 days after the exam),
    // stamps it, and both devices agree again.
    C.rebuildEvidence(bank, phone.st); await phone.sync.syncNow(); await laptop.sync.syncNow(); await phone.sync.syncNow();
    for (const d of [laptop, phone]) {
      assert.deepStrictEqual([d.st.qstats[q].ev, d.st.qstats[q].evAt], [1, at]);
      assert.deepStrictEqual([d.st.qstats[fresh].ev, d.st.qstats[fresh].evAt], [1, at + 1]);
    }
    assert.strictEqual(evOf(laptop.st), evOf(phone.st)); assert.strictEqual(progressOf(laptop.st), progressOf(phone.st));
  });

  await t("estimate weeks merge by week and the newer stamp wins", async () => {
    const week = { "2026-11-02": { mean: 60, at: 10 }, "2026-11-09": { mean: 70, at: 10 } };
    const other = { "2026-11-09": { mean: 74, at: 20 }, "2026-11-16": { mean: 80, at: 20 } };
    const merged = C.mergeStates([{ estWeeks: week }, { estWeeks: other }]);
    assert.deepStrictEqual(merged.estWeeks, { "2026-11-02": { mean: 60, at: 10 }, "2026-11-09": { mean: 74, at: 20 }, "2026-11-16": { mean: 80, at: 20 } });
    assert.deepStrictEqual(C.mergeStates([{ estWeeks: { "2026-11-02": { mean: 61, at: 5 } } }, { estWeeks: { "2026-11-02": { mean: 60, at: 5 } } }]).estWeeks["2026-11-02"].mean, 61);
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery"); await b.sync.signIn(URL0, "jacob", "correct horse battery");
    await a.sync.syncNow(); await b.sync.syncNow();
    a.st.estWeeks = week; b.st.estWeeks = other;
    await a.sync.syncNow(); await b.sync.syncNow(); await a.sync.syncNow();
    assert.deepStrictEqual(a.st.estWeeks, merged.estWeeks);
    assert.deepStrictEqual(b.st.estWeeks, merged.estWeeks);
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

  const UNEXPECTED = "Unexpected reply from the sync server";
  // Sign in two devices, answer on A only, then let the next pull (or the PUT armed from S.during) misbehave.
  async function linked() {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    await b.sync.signIn(URL0, "jacob", "correct horse battery");
    a.answer(Q.slice(0, 4), true, T0 + 8000);
    return { srv, a, b, before: progressOf(a.st) };
  }
  function kept(a, before, err) {
    assert.strictEqual(totals(a.st).seen, 4, "a bad reply reset local progress");
    assert.strictEqual(progressOf(a.st), before);
    assert.strictEqual(err && err.message, UNEXPECTED);
    assert.strictEqual(a.sync.info.lastError, UNEXPECTED);
  }

  async function badPull(name, body) {
    await t("a pull reply of " + name + " leaves progress in place and reports an unexpected reply", async () => {
      const { srv, a, b, before } = await linked();
      srv.next = () => { srv.next = null; return { status: 200, body }; };
      let err = null;
      try { await a.sync.syncNow(); } catch (e) { err = e; }
      kept(a, before, err);
      await a.sync.syncNow(); await b.sync.syncNow();
      assert.strictEqual(progressOf(a.st), progressOf(b.st));
      assert.strictEqual(totals(b.st).seen, 4);
      assert.strictEqual(a.sync.info.lastError, null);
    });
  }
  await badPull("{}", {});
  await badPull('a string epoch', { epoch: "1", seq: 1, replicas: [] });
  await badPull("no replicas", { epoch: 1, seq: 1 });
  await badPull("no seq", { epoch: 1, replicas: [] });

  async function badPut(name, body) {
    await t("a PUT reply of " + name + " leaves progress in place and is not treated as saved", async () => {
      const { srv, a, b, before } = await linked();
      srv.during = () => {
        srv.next = (method) => {
          if (method !== "PUT") return null;
          srv.next = null;
          return { status: 200, body };
        };
      };
      let err = null;
      try { await a.sync.syncNow(); } catch (e) { err = e; }
      kept(a, before, err);
      srv.next = null;
      await a.sync.syncNow(); await b.sync.syncNow();
      assert.strictEqual(progressOf(a.st), progressOf(b.st));
      assert.strictEqual(totals(b.st).seen, 4);
      assert.strictEqual(a.sync.info.lastError, null);
    });
  }
  await badPut("no seq", {});
  await badPut("a string seq", { epoch: 1, seq: "1" });

  // Another tab of this device writes between the pull and the push: the first PUT is stale.
  function bumpOnPut(srv, times) {
    let hits = 0;
    srv.during = () => {
      srv.next = (method, p, body, dev) => {
        if (method !== "PUT") return null;
        hits++;
        const seq = ++srv.seq;
        srv.replicas[dev] = { seq, doc: srv.replicas[dev].doc };
        if (hits >= times) srv.next = null;
        return { status: 409, body: { error: "stale", seq } };
      };
    };
  }
  await t("one 409 after this device's seq changes is retried once and both devices converge", async () => {
    const srv = fakeServer();
    let puts = 0;
    const inner = srv.fetch;
    srv.fetch = async (url, opts) => { if (opts.method === "PUT") puts++; return inner(url, opts); };
    const a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    await b.sync.signIn(URL0, "jacob", "correct horse battery");
    a.answer(Q.slice(0, 3), true, T0 + 9000);
    puts = 0;
    bumpOnPut(srv, 1);
    await a.sync.syncNow();
    assert.strictEqual(puts, 2, "the stale push is sent once more");
    await b.sync.syncNow();
    assert.strictEqual(progressOf(a.st), progressOf(b.st));
    assert.strictEqual(totals(b.st).seen, 3);
    assert.strictEqual(a.sync.info.lastError, null);
  });

  await t("a second 409 surfaces an error and local progress is kept", async () => {
    const srv = fakeServer();
    let puts = 0;
    const inner = srv.fetch;
    srv.fetch = async (url, opts) => { if (opts.method === "PUT") puts++; return inner(url, opts); };
    const a = device(srv, "A"), b = device(srv, "B");
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    await b.sync.signIn(URL0, "jacob", "correct horse battery");
    a.answer(Q.slice(0, 3), true, T0 + 9000);
    const before = progressOf(a.st);
    puts = 0;
    bumpOnPut(srv, 2);
    let err = null;
    try { await a.sync.syncNow(); } catch (e) { err = e; }
    assert.strictEqual(puts, 2, "a second 409 is not retried");
    assert.strictEqual(err && err.message, "stale");
    assert.strictEqual(a.sync.info.lastError, "stale");
    assert.strictEqual(progressOf(a.st), before);
    assert.strictEqual(totals(a.st).seen, 3);
    srv.next = null;
    await a.sync.syncNow(); await b.sync.syncNow();
    assert.strictEqual(progressOf(a.st), progressOf(b.st));
    assert.strictEqual(totals(b.st).seen, 3);
    assert.strictEqual(a.sync.info.lastError, null);
  });

  // A studied 5, synced, then 3 more while signed out. Signing back into the same account must keep 8
  // on every device and upload only those 3: the old replica stays, and this browser gets a new device id.
  const savedPrev = d => JSON.parse(d.mem[META_KEY]).prev;
  const seenIn = doc => Object.values((doc && doc.qstats) || {}).reduce((a, s) => a + (s.seen || 0), 0);
  async function studyThenLeave(leave) {
    const srv = fakeServer(), A = device(srv, "A"), B = device(srv, "B");
    await A.sync.signIn(URL0, "jacob", "correct horse battery");
    A.answer(Q.slice(0, 5), true, T0); await A.sync.syncNow();
    await B.sync.signIn(URL0, "jacob", "correct horse battery"); await B.sync.syncNow();
    const oldId = A.sync.info.device.id, oldDoc = srv.replicas[oldId].doc;
    await leave(srv, A);
    const prev = savedPrev(A);
    A.answer(Q.slice(5, 8), true, T0 + 86400000);
    A.st.settings.goal = 40;
    return { srv, A, B, oldId, oldDoc, prev };
  }
  async function sameAccountKeepsBoth(label, leave) {
    await t(label, async () => {
      const { srv, A, B, oldId, oldDoc, prev } = await studyThenLeave(leave);
      const before = totals(A.st);
      const r = await A.sync.signIn(URL0, "jacob", "correct horse battery");
      assert.deepStrictEqual(r, { linked: true });
      assert.deepStrictEqual(prev, { url: URL0, username: "jacob" });
      assert.strictEqual(A.sync.pending, null);
      await B.sync.syncNow();
      await A.sync.syncNow(); await B.sync.syncNow();
      assert.deepStrictEqual(totals(A.st), before);
      assert.deepStrictEqual(totals(B.st), before);
      assert.strictEqual(progressOf(A.st), progressOf(B.st));
      assert.strictEqual(A.st.settings.goal, 40);
      assert.strictEqual(B.st.settings.goal, 40);
      assert.notStrictEqual(A.sync.info.device.id, oldId);
      assert.strictEqual(srv.replicas[oldId].doc, oldDoc, "the old replica stays as it was");
      assert.strictEqual(seenIn(JSON.parse(srv.replicas[A.sync.info.device.id].doc)), 3, "only the answers made while signed out are uploaded");
    });
  }
  await sameAccountKeepsBoth("a revoked token: signing back into the same account keeps the answers made while signed out", async (srv, A) => {
    for (const k in srv.tokens) if (srv.tokens[k] === A.sync.info.device.id) delete srv.tokens[k];
    await A.sync.syncNow();
  });
  await sameAccountKeepsBoth("Sign out: signing back into the same account keeps the answers made while signed out", async (srv, A) => {
    await A.sync.signOut();
  });

  await t("a failed sign-in to another server still relinks to the original account", async () => {
    const { A, B } = await studyThenLeave(async (s, d) => { await d.sync.signOut(); });
    await assert.rejects(A.sync.signIn("https://other.example", "jacob", "nope"), /Wrong username or password/);
    const r = await A.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(r, { linked: true });
    await B.sync.syncNow();
    assert.strictEqual(totals(A.st).seen, 8);
    assert.strictEqual(totals(B.st).seen, 8);
  });

  await t("a different account still asks how to combine progress", async () => {
    const { srv, A } = await studyThenLeave(async (s, d) => { await d.sync.signOut(); });
    srv.users.sam = "correct horse battery";
    const other = await A.sync.signIn(URL0, "sam", "correct horse battery");
    assert.deepStrictEqual(other, { needsChoice: true, copied: true });
    assert.strictEqual(totals(A.st).seen, 8, "the choice is still waiting, so nothing was merged or wiped");
  });

  await t("answers another device made while this one was signed out show up on sign-in", async () => {
    const { A, B } = await studyThenLeave(async (s, d) => { await d.sync.signOut(); });
    B.answer(Q.slice(30, 32), false, T0 + 2 * 86400000); await B.sync.syncNow();
    const r = await A.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(r, { linked: true });
    await B.sync.syncNow();
    assert.strictEqual(totals(A.st).seen, 10);
    assert.strictEqual(totals(B.st).seen, 10);
    assert.strictEqual(progressOf(A.st), progressOf(B.st));
  });

  await t("a device that was never linked still asks how to combine progress", async () => {
    const { srv } = await studyThenLeave(async () => {});   // A stays signed in; C has no previous account
    const elsewhere = device(srv, "C");
    elsewhere.answer(Q.slice(20, 24), false, T0 + 5000);
    const fresh = await elsewhere.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(fresh, { needsChoice: true, copied: false });
  });

  // Cancel on the combine-or-replace question is Sign out, but this device never finished linking.
  // Its answers are not derived from the account, so the next sign-in must ask again.
  await t("a device that signs out at the combine-or-replace question still gets the choice next time", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B");
    a.answer(Q.slice(0, 8), true, T0);
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    b.answer(Q.slice(0, 5), true, T0 + 5000);
    const first = await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(first, { needsChoice: true, copied: false });
    const before = totals(b.st);
    await b.sync.signOut();
    const again = await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(again, { needsChoice: true, copied: false });
    assert.deepStrictEqual(totals(b.st), before, "cancelling leaves this device's answers untouched");
  });

  // A finished link is remembered. Opening the choice on another account, then cancelling, must not replace it.
  await t("signing out of another account's combine question keeps the account this device already finished", async () => {
    const srv = fakeServer(), a = device(srv, "A"), b = device(srv, "B"), c = device(srv, "C");
    a.answer(Q.slice(0, 8), true, T0);
    await a.sync.signIn(URL0, "jacob", "correct horse battery");
    await b.sync.signIn(URL0, "jacob", "correct horse battery");
    await b.sync.signOut();
    assert.deepStrictEqual(savedPrev(b), { url: URL0, username: "jacob" });
    srv.users.sam = "correct horse battery";
    c.answer(Q.slice(20, 24), false, T0 + 9000);
    await c.sync.signIn(URL0, "sam", "correct horse battery");
    const choice = await b.sync.signIn(URL0, "sam", "correct horse battery");
    // The fake server keeps every account's replicas in one pack, so this device's old copy is in that pack.
    assert.deepStrictEqual(choice, { needsChoice: true, copied: true });
    const before = totals(b.st);
    await b.sync.signOut();
    assert.deepStrictEqual(savedPrev(b), { url: URL0, username: "jacob" });
    const back = await b.sync.signIn(URL0, "jacob", "correct horse battery");
    assert.deepStrictEqual(back, { linked: true });
    assert.deepStrictEqual(totals(b.st), before);
    assert.strictEqual(totals(b.st).seen, 8);
  });

  console.log(`\n${n} sync tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
