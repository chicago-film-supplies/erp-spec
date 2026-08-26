/**
 * SPIKE-013 — the queue's merge algebra, asserted.
 *
 * ⚠️ **Each test names the exit criterion it serves**, because a test suite that passes without
 * anyone being able to say which criterion it discharged is how a spike closes on the appearance
 * of evidence. Criteria needing real durability or a real blob are NOT here — they cannot be
 * honestly faked in-process, and `browser_test.ts` is where they live.
 *
 *   deno task queue-test
 *
 * @module
 */
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1.0.19";
import {
  create,
  emptyState,
  enqueue,
  fieldState,
  type Item,
  keyItems,
  mergeItems,
  mintId,
  ours,
  pinBase,
  planReplay,
  recordFailures,
  settle,
  threeWayMerge,
} from "./queue.ts";

const POLICY = { derived: ["totals", "items.path"] };
const DOC = "order-1";
const BASE = { uid: DOC, subject: "Stage 3", qty: 2, totals: { total_cents: 1000 } };

// ── criterion 1 — coalescing and exactly-once ────────────────────────────────────────────────────

Deno.test("criterion 1: three offline edits to one field replay as ONE write", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4");
  s = enqueue(s, DOC, "subject", "Stage 5");
  s = enqueue(s, DOC, "subject", "Stage 6");

  assertEquals(s.ops.length, 1, "three edits to one field must coalesce to one op");
  assertEquals(s.ops[0].value, "Stage 6", "the LAST value is the only one the server should see");
  assertEquals(ours(s, DOC).subject, "Stage 6");
});

Deno.test("criterion 1: edits to DIFFERENT fields do not coalesce", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4");
  s = enqueue(s, DOC, "qty", 9);
  assertEquals(s.ops.length, 2);
});

Deno.test("criterion 1: settling a document clears its ops and its base — replay cannot repeat", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4");
  s = settle(s, DOC);
  assertEquals(s.ops.length, 0);
  assertEquals(s.bases[DOC], undefined);
  // And a second replay has nothing to plan — exactly-once, from the queue's side.
  assertEquals(planReplay(s, { [DOC]: BASE }, POLICY).length, 0);
});

// ── the property the whole design turns on ───────────────────────────────────────────────────────

Deno.test("different fields DO NOT collide — by construction, not by luck", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4"); // we moved subject
  const theirs = { ...BASE, qty: 5 }; // they moved qty
  const r = threeWayMerge(s, DOC, theirs, POLICY);

  assertEquals(r.conflicts, [], "a different-field edit must not be a conflict");
  assertEquals(r.merged!.subject, "Stage 4", "our edit survives");
  assertEquals(r.merged!.qty, 5, "their edit survives");
});

Deno.test("the SAME field moved by both sides IS a conflict, and carries all three values", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4");
  const r = threeWayMerge(s, DOC, { ...BASE, subject: "Stage 9" }, POLICY);

  assertEquals(r.conflicts.length, 1);
  assertEquals(r.conflicts[0], {
    doc: DOC,
    path: "subject",
    base: "Stage 3",
    ours: "Stage 4",
    theirs: "Stage 9",
  });
  assertEquals(r.merged!.subject, "Stage 9", "an unresolved conflict must NOT silently take ours");
});

Deno.test("converged edits are clean, not conflicts — both sides typed the same value", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "Stage 4");
  const r = threeWayMerge(s, DOC, { ...BASE, subject: "Stage 4" }, POLICY);
  assertEquals(r.conflicts, []);
  assertEquals(r.clean, ["subject"]);
});

// ── the base is load-bearing, and its absence must be LOUD ───────────────────────────────────────

Deno.test("a merge with no pinned base THROWS rather than degrading to a two-way diff", () => {
  const s = enqueue(emptyState(), DOC, "subject", "Stage 4");
  assertThrows(
    () => threeWayMerge(s, DOC, BASE, POLICY),
    Error,
    "no pinned base",
  );
});

Deno.test("pinBase is idempotent — the ancestor cannot drift toward theirs", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = pinBase(s, DOC, { ...BASE, subject: "MOVED" }, 9);
  assertEquals(s.bases[DOC].doc.subject, "Stage 3", "a second pin must not overwrite the ancestor");
  assertEquals(s.bases[DOC].version, 7);
});

// ── derived, terminal, failed ────────────────────────────────────────────────────────────────────

Deno.test("derived fields are excluded from the merge and recomputed", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "qty", 4);
  s = enqueue(s, DOC, "totals.total_cents", 2000); // derived — must not be merged field-wise
  const theirs = { ...BASE, totals: { total_cents: 9999 } };

  const r = threeWayMerge(s, DOC, theirs, {
    ...POLICY,
    recompute: (m) => ({ ...m, totals: { total_cents: (m.qty as number) * 500 } }),
  });
  assertEquals(r.conflicts, [], "a derived field must never produce a conflict");
  assertEquals(
    (r.merged!.totals as { total_cents: number }).total_cents,
    2000,
    "the total must be RECOMPUTED from the merged qty, not chosen from either side",
  );
});

Deno.test("a terminal document REFUSES the merge — it is not resolved at any granularity", () => {
  let s = pinBase(emptyState(), "inv-1", { uid: "inv-1", status: "issued", subject: "x" }, 3);
  s = enqueue(s, "inv-1", "subject", "edited while offline");
  const r = threeWayMerge(s, "inv-1", { uid: "inv-1", status: "paid", subject: "x" }, {
    ...POLICY,
    terminal: (t) => t.status === "paid" ? "the invoice was paid while you were offline" : null,
  });
  assertEquals(r.refused, "the invoice was paid while you were offline");
  assertEquals(r.merged, null);
  assertEquals(r.conflicts, [], "a refusal is not a conflict — there is nothing to choose");
});

Deno.test("a vanished target FAILS and is not offered as a conflict", () => {
  let s = pinBase(emptyState(), DOC, { ...BASE, note: { a: "x" } }, 7);
  s = enqueue(s, DOC, "note.a", "edited offline");
  const theirs = { uid: DOC, subject: "Stage 3", qty: 2, totals: { total_cents: 1000 } };
  const r = threeWayMerge(s, DOC, theirs, POLICY);

  assertEquals(r.conflicts, [], "there is no second value to choose between");
  assertEquals(r.failed.length, 1);
  assertEquals(r.failed[0].field, "note.a", "a failure must NAME the field or it is unactionable");
});

Deno.test("a deleted document fails every op it held, each naming its field", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "subject", "a");
  s = enqueue(s, DOC, "qty", 3);
  const r = threeWayMerge(s, DOC, null, POLICY);
  assertEquals(r.failed.map((f) => f.field).sort(), ["qty", "subject"]);
});

// ── criterion 2 — an offline create is addressable ───────────────────────────────────────────────

Deno.test("criterion 2: an offline create is addressable by later queued writes", () => {
  const id = mintId();
  let s = create(emptyState(), id, { uid: id, subject: "", qty: 1 });
  s = enqueue(s, id, "subject", "New job");
  s = enqueue(s, id, "qty", 4);
  s = enqueue(s, id, "subject", "New job, renamed");

  assertEquals(s.ops.filter((o) => o.doc === id).length, 2, "still coalesced");
  const built = ours(s, id);
  assertEquals(built.subject, "New job, renamed");
  assertEquals(built.qty, 4);
  assertEquals(built.uid, id, "the client-minted id IS the document identity — no rewrite pass");
});

Deno.test("criterion 2: a minted id is unique and needs no server", () => {
  const ids = new Set(Array.from({ length: 1000 }, mintId));
  assertEquals(ids.size, 1000);
});

// ── items[]: the measured merge key ──────────────────────────────────────────────────────────────

Deno.test("keying items[] by uid ALONE pairs the wrong rows — 18.3% of orders have a repeat", () => {
  const items: Item[] = [
    { uid: "p1", qty: 1 },
    { uid: "p2", qty: 5 },
    { uid: "p1", qty: 9 }, // the same product again, in another group
  ];
  const naive = new Map(items.map((i) => [i.uid, i]));
  assertEquals(naive.size, 2, "uid alone LOSES a row — this is the defect, asserted");

  const keyed = keyItems(items);
  assertEquals(keyed.size, 3);
  assertEquals((keyed.get("p1#0") as Item).qty, 1);
  assertEquals((keyed.get("p1#1") as Item).qty, 9);
});

Deno.test("concurrent adds UNION — neither operator's row is discarded", () => {
  const base: Item[] = [{ uid: "p1", qty: 1 }];
  const ours_: Item[] = [{ uid: "p1", qty: 1 }, { uid: "p2", qty: 2 }]; // we added p2
  const theirs: Item[] = [{ uid: "p1", qty: 1 }, { uid: "p3", qty: 3 }]; // they added p3

  const r = mergeItems(base, ours_, theirs);
  assertEquals(r.items.map((i) => i.uid).sort(), ["p1", "p2", "p3"]);
  assertEquals(r.added, ["p2#0"]);
});

Deno.test("our removal survives their untouched row", () => {
  const base: Item[] = [{ uid: "p1", qty: 1 }, { uid: "p2", qty: 2 }];
  const ours_: Item[] = [{ uid: "p1", qty: 1 }]; // we removed p2
  const theirs: Item[] = [{ uid: "p1", qty: 1 }, { uid: "p2", qty: 2 }];
  const r = mergeItems(base, ours_, theirs);
  assertEquals(r.items.map((i) => i.uid), ["p1"]);
  assertEquals(r.removed, ["p2#0"]);
});

// ── criterion 6 — per-field state is derivable from the queue alone ──────────────────────────────

Deno.test("criterion 6: field state is derivable with no per-site wiring", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  assertEquals(fieldState(s, DOC, "subject"), "synced");

  s = enqueue(s, DOC, "subject", "Stage 4");
  assertEquals(fieldState(s, DOC, "subject"), "pending");
  assertEquals(fieldState(s, DOC, "qty"), "synced", "an untouched field is not pending");

  s = settle(s, DOC);
  assertEquals(fieldState(s, DOC, "subject"), "synced");

  s = recordFailures(s, [{ doc: DOC, field: "subject", reason: "rejected", value: "x" }]);
  assertEquals(fieldState(s, DOC, "subject"), "failed");
});

// ── criterion 3 — a deferred failure outlives the session, with the operator absent ──────────────

Deno.test("criterion 3: a replay failure lands in a durable inbox naming the field", () => {
  let s = pinBase(emptyState(), DOC, BASE, 7);
  s = enqueue(s, DOC, "qty", -5); // will be rejected on replay
  const r = threeWayMerge(s, DOC, null, POLICY); // target gone → failure
  s = recordFailures(s, r.failed);

  // The whole state is a plain value, so "outlives the session" is `JSON.parse(JSON.stringify(…))`.
  const revived = JSON.parse(JSON.stringify(s)) as typeof s;
  assertEquals(revived.failures.length, 1);
  assertEquals(revived.failures[0].field, "qty");
  assert(revived.failures[0].reason.length > 0, "a failure with no reason is not actionable");
});

// ── planReplay ───────────────────────────────────────────────────────────────────────────────────

Deno.test("planReplay classifies each document independently", () => {
  let s = emptyState();
  s = pinBase(s, "a", { uid: "a", subject: "x" }, 1);
  s = enqueue(s, "a", "subject", "ours"); // clean → send
  s = pinBase(s, "b", { uid: "b", subject: "x" }, 1);
  s = enqueue(s, "b", "subject", "ours"); // both moved → conflict
  s = pinBase(s, "c", { uid: "c", subject: "x" }, 1);
  s = enqueue(s, "c", "subject", "ours"); // gone → failed

  const plan = planReplay(s, {
    a: { uid: "a", subject: "x" },
    b: { uid: "b", subject: "theirs" },
    c: null,
  }, POLICY);

  assertEquals(plan.map((p) => `${p.doc}:${p.kind}`).sort(), [
    "a:send",
    "b:conflict",
    "c:failed",
  ]);
});
