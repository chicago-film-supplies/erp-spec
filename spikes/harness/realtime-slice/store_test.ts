/**
 * SPIKE-009 criterion 1 — the reactivity half, asserted rather than eyeballed.
 *
 * ⚠️ WHY THIS EXISTS INSTEAD OF A SCREENSHOT. The criterion says a server-side change must update
 * a SolidJS view "without a refetch". Two things could produce an identical-looking screenshot:
 * a fine-grained update of one cell, and a wholesale re-render of the table from a fresh array.
 * The second is what a naive socket client does, and it is the difference between keeping the
 * manager's rendering characteristics and quietly regressing them across 52 sites.
 *
 * So this asserts the property a picture cannot: applying a change frame for row `b` notifies
 * the effect watching `b.qty` and does NOT notify the effect watching `a.qty`.
 *
 * The transport half is proven separately and by execution — `deno task slice` counts the HTTP
 * requests it serves, and a `deno task slice-mutate` write arrives as a socket frame with that
 * counter unmoved.
 *
 * @module
 */
import { createRenderEffect, createRoot } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { assertEquals } from "jsr:@std/assert@1.0.8";

/**
 * ⚠️ `createEffect` was tried first and never ran: outside a renderer nothing flushes Solid's
 * user-effect queue, so the baseline read all-zeros and the test failed for the wrong reason.
 *
 * ⭐ `createRenderEffect` is not a workaround for that — it is the more faithful primitive. Solid
 * compiles a template's text bindings INTO render effects, so counting render-effect runs counts
 * the same notifications the real `<td>${() => r.qty}</td>` binding would receive.
 */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

type Row = { _id: string; name: string; status: string; qty: number };

const SNAPSHOT: Row[] = [
  { _id: "a", name: "Arri Alexa 35", status: "available", qty: 3 },
  { _id: "b", name: "Cooke S4 Set", status: "on hire", qty: 1 },
  { _id: "c", name: "O'Connor 2575", status: "available", qty: 2 },
];

Deno.test("a change frame notifies only the row it changed", async () => {
  const { hits, mutate, dispose } = createRoot((dispose) => {
    const [state, setState] = createStore<{ rows: Row[] }>({ rows: [] });
    setState("rows", reconcile(SNAPSHOT, { key: "_id" }));
    const hits: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (const id of ["a", "b", "c"]) {
      createRenderEffect(() => {
        void state.rows.find((r) => r._id === id)?.qty; // track this row's qty specifically
        hits[id]++;
      });
    }
    const mutate = () => {
      // The frame the socket delivers for `deno task slice-mutate`.
      const next = SNAPSHOT.map((r) => r._id === "b" ? { ...r, status: "available", qty: 2 } : r);
      setState("rows", reconcile(next, { key: "_id" }));
    };
    return { hits, mutate, dispose };
  });

  await flush();
  assertEquals(hits, { a: 1, b: 1, c: 1 }, "baseline — each effect runs once on creation");

  mutate();
  await flush();
  assertEquals(hits, { a: 1, b: 2, c: 1 }, "only b's effect may re-run; a and c must be untouched");
  dispose();
});

Deno.test("an unchanged frame notifies nothing at all", async () => {
  const { get, redeliver, dispose } = createRoot((dispose) => {
    const [state, setState] = createStore<{ rows: Row[] }>({ rows: [] });
    setState("rows", reconcile(SNAPSHOT, { key: "_id" }));
    let hits = 0;
    createRenderEffect(() => {
      void state.rows.map((r) => r.qty).join();
      hits++;
    });
    // A redelivered frame carrying identical data — a reconnect replay, or a duplicate.
    const redeliver = () =>
      setState("rows", reconcile(SNAPSHOT.map((r) => ({ ...r })), { key: "_id" }));
    return { get: () => hits, redeliver, dispose };
  });

  await flush();
  assertEquals(get(), 1, "baseline");
  redeliver();
  await flush();
  assertEquals(get(), 1, "an identical frame must not notify — a reconnect replay is free");
  dispose();
});
