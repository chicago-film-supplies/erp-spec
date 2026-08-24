/**
 * SPIKE-009 criteria 1–2 — MongoDB change streams as the replacement for Firestore listeners.
 *
 * This probe answers criterion 2 ("resume-token handling specified, including what happens after
 * a disconnect longer than the oplog window") and measures the three server-side semantics that
 * criterion 3 named as the hard parts but could not price from a source read.
 *
 * ## The question behind each probe
 *
 * A Firestore listener has no resume token the application ever sees; the SDK owns reconnection
 * and the app cannot get it wrong. A change stream inverts that — the token is the application's
 * to persist, and every failure mode below is one the manager app has never had to have an
 * opinion about. So each probe asserts a VALUE (a token, an error code, a field's contents),
 * never an absence of throw: a stream that yields nothing passes any "did it error" check.
 *
 * ## Running it
 *
 *   mkdir -p .data/mongo-cs
 *   .data/mongodb-macos-aarch64-8.0.4/bin/mongod --dbpath .data/mongo-cs --port 27079 \
 *     --bind_ip 127.0.0.1 --replSet rs0 --oplogSize 1 --fork --logpath .data/mongod-cs.log
 *   # then initiate once: replSetInitiate {_id:"rs0",members:[{_id:0,host:"127.0.0.1:27079"}]}
 *   deno task change-stream
 *
 * ⚠️ A REPLICA SET, not the standalone SPIKE-002 left behind — change streams read the oplog and
 * a standalone mongod has none. `--oplogSize 1` (1 MB, against the 990 MB default) is what makes
 * the rollover case reachable in seconds instead of days; it is a harness knob, and the
 * production window is `oplogSize / write-rate`, measured below as a ratio rather than a duration.
 *
 * @module
 */

import { type ChangeStream, MongoClient, Timestamp } from "mongodb";
import { emit, type ProbeResult, time } from "./probe-util.ts";

const URI = "mongodb://127.0.0.1:27079/?directConnection=true";
const DB = "spike009";

const client = new MongoClient(URI);
await client.connect();
const db = client.db(DB);

/**
 * Read the next n events with a REAL deadline.
 *
 * ⚠️ `hasNext()` blocks indefinitely on a change stream, so a deadline checked around it can
 * never fire — the probe hangs instead of failing, which is the exact shape this repo warns
 * about. `tryNext()` polls, so the deadline is enforceable and a silent stream FAILS.
 */
const take = async (s: ChangeStream, n: number, ms = 8000): Promise<any[]> => {
  const out: any[] = [];
  const deadline = Date.now() + ms;
  while (out.length < n) {
    const ev = await s.tryNext();
    if (ev) {
      out.push(ev);
      continue;
    }
    if (Date.now() > deadline) {
      throw new Error(`took ${out.length} of ${n} events before the ${ms}ms deadline`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return out;
};

/**
 * Open a change stream AND establish its server-side cursor before returning.
 *
 * ⚠️ `watch()` is LAZY — the cursor is opened on the first read, not at the call. A write
 * issued between `watch()` and the first read lands before the stream's start point and is
 * never delivered. Firestore's `onSnapshot` has no equivalent gap: it delivers an initial
 * snapshot, so "subscribe then write" is safe there and is a race here.
 */
const open = async (c: any, pipeline: any[] = [], opts: any = {}): Promise<ChangeStream> => {
  const s = c.watch(pipeline, opts);
  await s.tryNext(); // forces the aggregate + first getMore, fixing the start point
  return s;
};

const fresh = async (name: string) => {
  await db.collection(name).drop().catch(() => {});
  return db.collection(name);
};

const results: ProbeResult[] = [];
const R = (name: string, fn: () => Promise<string>) =>
  time(name, fn).then((r) => {
    // stderr, so a hang localizes to the probe after the last line printed. stdout stays parseable.
    console.error(`  ${r.ok ? "pass" : "FAIL"} ${r.name} (${r.ms}ms)`);
    results.push(r);
  });

// ── 1. What a resume token actually is ──────────────────────────────────────────────────────────
await R("token_is_opaque_hex", async () => {
  const c = await fresh("t1");
  const s = await open(c);
  await c.insertOne({ n: 1 });
  const [ev] = await take(s, 1);
  await s.close();
  const t = ev._id;
  const keys = Object.keys(t);
  if (keys.length !== 1 || keys[0] !== "_data") {
    throw new Error(`token keys = ${JSON.stringify(keys)}`);
  }
  if (typeof t._data !== "string" || !/^[0-9A-F]+$/i.test(t._data)) {
    throw new Error(`_data is not hex: ${JSON.stringify(t._data)}`);
  }
  return `{_data} only, ${t._data.length} hex chars (${t._data.length / 2} bytes)`;
});

await R("tokens_sort_lexicographically", async () => {
  const c = await fresh("t2");
  const s = await open(c);
  await c.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const evs = await take(s, 3);
  await s.close();
  const d = evs.map((e) => e._id._data as string);
  const sorted = [...d].sort();
  if (JSON.stringify(d) !== JSON.stringify(sorted)) {
    throw new Error(`arrival order != lexicographic order`);
  }
  return `3 tokens, arrival order == lexicographic order (so a token is COMPARABLE, not just opaque)`;
});

// ── 2. resumeAfter is EXCLUSIVE of the token's own event ─────────────────────────────────────────
await R("resume_after_is_exclusive", async () => {
  const c = await fresh("t3");
  const s = await open(c);
  await c.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
  const evs = await take(s, 3);
  await s.close();
  const s2 = c.watch([], { resumeAfter: evs[0]._id });
  const got = await take(s2, 2);
  await s2.close();
  const ns = got.map((e) => e.fullDocument.n);
  if (JSON.stringify(ns) !== "[2,3]") {
    throw new Error(`resumed stream delivered n = ${JSON.stringify(ns)}`);
  }
  return `token of n=1 replays [2,3] — EXCLUSIVE, so persisting the delivered token cannot double-deliver`;
});

// ── 3. ⭐ The post-batch resume token — does an idle FILTERED stream keep its place? ─────────────
await R("pbrt_advances_while_filtered", async () => {
  const c = await fresh("t4");
  // A pipeline nothing below will match: the stream stays live and delivers zero events.
  const s = await open(c, [{ $match: { "fullDocument.kind": "never" } }]);
  // tryNext() is the non-blocking read. hasNext() would never return here, which is the point:
  // an idle filtered stream has no event to hang the token off, only the post-batch resume token.
  const before = s.resumeToken as { _data: string } | undefined;
  for (let i = 0; i < 200; i++) await c.insertOne({ kind: "noise", i });
  let after = before;
  for (let i = 0; i < 40; i++) {
    await s.tryNext();
    after = s.resumeToken as { _data: string } | undefined;
    if (after?._data && before?._data && after._data > before._data) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await s.close();
  if (!before?._data || !after?._data) {
    throw new Error(`resumeToken missing: before=${!!before?._data} after=${!!after?._data}`);
  }
  if (after._data <= before._data) {
    throw new Error(`PBRT did NOT advance across 200 non-matching writes`);
  }
  return `advanced across 200 non-matching writes with 0 events delivered — a filtered idle stream does NOT rot at the oplog rate`;
});

// ── 4. ⭐⭐ Disconnect longer than the oplog window ──────────────────────────────────────────────
//
// ⚠️ WHAT IS EXECUTED HERE AND WHAT IS NOT — read this before citing anything below.
//
// The question is "what happens after a disconnect longer than the oplog window". The intended
// probe was: evict a real resume token, then assert `ChangeStreamHistoryLost`. IT COULD NOT BE
// MADE TO HAPPEN. Measured on mongod 8.0.4 single-node: a token survived 98 MB of incompressible
// writes into a 1 MB oplog, and 586 MB into a 200 MB oplog, each followed by 30s of settling.
// Over-retention was 104x the cap at 1 MB and 3x at 200 MB — consistent with WiredTiger's
// truncate markers having a large minimum size that a small oplog cannot divide into.
//
// ⭐ That IS the finding, and it is more useful than the assertion it replaced: the oplog window
// is not a quantity the application can compute, and the resume-failure path cannot be exercised
// by racing the oplog. It has to be exercised by INJECTION — the client's recovery code needs a
// test seam, not an integration test.
//
// ⚠️ Code 286 WAS observed twice, via `startAtOperationTime`, on a server whose oplog had been
// through repeated burn cycles — but not reproducibly from a clean start, so it is recorded in
// the spike note as a dated observation and is NOT asserted by a green probe here.

/** The oldest entry mongod still retains. Everything before this is unresumable. */
const oldestRetained = async () => {
  const [e] = await client.db("local").collection("oplog.rs").find().sort({ $natural: 1 }).limit(1)
    .toArray();
  return e!.ts as Timestamp;
};

/** Incompressible, so a burn measures RETENTION rather than snappy's compression ratio. */
const rnd = () => {
  const a = new Uint8Array(6 * 1024);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a));
};

await R("token_survives_far_beyond_the_cap", async () => {
  const c = await fresh("t5");
  const s = await open(c);
  await c.insertOne({ n: 0 });
  const [ev] = await take(s, 1);
  await s.close();
  const tokenTs = ev.clusterTime as Timestamp;

  // ~100 MB of INCOMPRESSIBLE data into a 1 MB oplog, then stop and let truncation settle.
  let mb = 0;
  for (let round = 0; round < 250; round++) {
    await c.insertMany(Array.from({ length: 50 }, (_, i) => ({ round, i, pad: rnd() })));
    mb += (50 * 8) / 1024;
  }
  for (let i = 0; i < 60; i++) {
    if ((await oldestRetained()).greaterThan(tokenTs)) {
      throw new Error(
        `token WAS evicted after ${Math.round(mb)} MB + ${i * 500}ms — eviction is reachable on ` +
          `this build after all, so rewrite this probe to assert code 286 ChangeStreamHistoryLost`,
      );
    }
    await c.insertOne({ tick: i });
    await new Promise((r) => setTimeout(r, 500));
  }

  const st = await client.db("local").command({ collStats: "oplog.rs" });
  const s2 = c.watch([], { resumeAfter: ev._id });
  const [got] = await take(s2, 1, 5000);
  await s2.close();
  if (got.operationType !== "insert") throw new Error(`resumed but got ${got.operationType}`);
  return `token STILL resumable after ${Math.round(mb)} MB into a ${
    (st.maxSize / 1048576).toFixed(0)
  } MB oplog + 30s settling — the failure cannot be provoked on demand`;
});

await R("fresh_oplog_accepts_prehistoric_start", async () => {
  // ⭐ The distinction that is easy to get backwards, and it changes what the client must handle.
  const c = await fresh("t5c");
  const hourAgo = new Timestamp({ t: Math.floor(Date.now() / 1000) - 3600, i: 1 });
  const s = c.watch([], { startAtOperationTime: hourAgo });
  await c.insertOne({ n: 1 });
  const [ev] = await take(s, 1, 5000);
  await s.close();
  if (ev.fullDocument?.n !== 1) throw new Error(`unexpected event ${JSON.stringify(ev)}`);
  return `a start point 1h before an UN-TRUNCATED oplog is accepted — 286 means "truncated past you", NOT "your token is old"`;
});

await R("retention_far_exceeds_oplog_size", async () => {
  const c = await fresh("t5b");
  for (let round = 0; round < 12; round++) {
    await c.insertMany(Array.from({ length: 50 }, (_, i) => ({ round, i, pad: rnd() })));
  }
  const st = await client.db("local").command({ collStats: "oplog.rs" });
  const ratio = st.size / st.maxSize;
  if (ratio <= 2) {
    throw new Error(
      `oplog held ${(st.size / 1048576).toFixed(1)} MB against a ${
        (st.maxSize / 1048576).toFixed(0)
      } MB cap — only ${ratio.toFixed(1)}x`,
    );
  }
  return `${(st.size / 1048576).toFixed(0)} MB retained against a ${
    (st.maxSize / 1048576).toFixed(0)
  } MB cap (${ratio.toFixed(0)}x) — oplogSize is a FLOOR for retention, not a bound`;
});

// ── 5. resumeAfter vs startAfter across an invalidate ────────────────────────────────────────────
await R("invalidate_needs_start_after", async () => {
  const c = await fresh("t6");
  const s = await open(c);
  await c.insertOne({ n: 1 });
  await take(s, 1);
  await c.drop();
  // ⚠️ TWO events, and the order matters: `drop` names the collection, `invalidate` closes the
  // stream. A client that persists the token of the last event it saw persists the invalidate.
  const evs = await take(s, 2);
  const kinds = evs.map((e) => e.operationType);
  if (JSON.stringify(kinds) !== '["drop","invalidate"]') {
    throw new Error(`expected ["drop","invalidate"], got ${JSON.stringify(kinds)}`);
  }
  const inv = evs[1];
  await s.close();
  const c2 = db.collection("t6");
  let resumeAfterErr = "";
  try {
    const sa = await open(c2, [], { resumeAfter: inv._id });
    await c2.insertOne({ n: 2 });
    await take(sa, 1, 2500);
    await sa.close();
  } catch (e: any) {
    resumeAfterErr = `code=${e.code} ${e.codeName ?? e.name}`;
  }
  const ss = await open(c2, [], { startAfter: inv._id });
  await c2.insertOne({ n: 3 });
  const [got] = await take(ss, 1);
  await ss.close();
  if (!resumeAfterErr) throw new Error(`resumeAfter past an invalidate did NOT error`);
  return `resumeAfter -> ${resumeAfterErr}; startAfter delivers n=${got.fullDocument.n}. Two options, only one survives a drop`;
});

// ── 6. ⭐⭐ updateLookup returns the CURRENT document, not the document as of the event ──────────
await R("update_lookup_is_not_event_state", async () => {
  const c = await fresh("t7");
  const seed = await open(c);
  await c.insertOne({ _id: 1 as any, v: 1 });
  const [ins] = await take(seed, 1);
  await seed.close();
  // Both updates land BEFORE the resumed stream reads the first of them — i.e. a lagging reader.
  await c.updateOne({ _id: 1 as any }, { $set: { v: 2 } });
  await c.updateOne({ _id: 1 as any }, { $set: { v: 3 } });
  const s = c.watch([], { fullDocument: "updateLookup", resumeAfter: ins._id });
  const [ev] = await take(s, 1);
  await s.close();
  const changed = ev.updateDescription?.updatedFields?.v;
  const looked = ev.fullDocument?.v;
  if (changed !== 2) throw new Error(`expected the v=2 event, got updatedFields.v=${changed}`);
  if (looked !== 3) throw new Error(`updateLookup returned v=${looked}, expected the LATEST (3)`);
  return `event says v:1->2, fullDocument says v=3 — a lagging reader is handed a state that NEVER matched the event`;
});

await R("post_image_is_event_state", async () => {
  await db.collection("t8").drop().catch(() => {});
  await db.createCollection("t8", { changeStreamPreAndPostImages: { enabled: true } } as any);
  const c = db.collection("t8");
  const seed = await open(c);
  await c.insertOne({ _id: 1 as any, v: 1 });
  const [ins] = await take(seed, 1);
  await seed.close();
  await c.updateOne({ _id: 1 as any }, { $set: { v: 2 } });
  await c.updateOne({ _id: 1 as any }, { $set: { v: 3 } });
  const s = c.watch([], { fullDocument: "required", resumeAfter: ins._id });
  const [e] = await take(s, 1);
  await s.close();
  const looked = e.fullDocument?.v;
  if (looked !== 2) {
    throw new Error(`post-image returned v=${looked}, expected the event's own state (2)`);
  }
  return `changeStreamPreAndPostImages + fullDocument:"required" returns v=2 — the FIX, and it is per-collection opt-in`;
});

// ── 7. How much history 1 MB actually holds ──────────────────────────────────────────────────────
await R("oplog_window_ratio", async () => {
  const st = await client.db("local").command({ collStats: "oplog.rs" });
  const first = await client.db("local").collection("oplog.rs").find().sort({ $natural: 1 })
    .limit(1).toArray();
  const last = await client.db("local").collection("oplog.rs").find().sort({ $natural: -1 })
    .limit(1).toArray();
  const spanSec = last[0].ts.getHighBits() - first[0].ts.getHighBits();
  return `${
    (st.maxSize / 1048576).toFixed(0)
  } MB holds ${st.count} entries spanning ${spanSec}s at this write rate`;
});

await client.close();
emit(results);
