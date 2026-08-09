/**
 * The `deno test` leg of the matrix. Same code path as `deno run` and the compiled binary — the
 * point of the spike is that the three modes load native addons differently, so the probe body
 * must not be re-implemented per mode or the comparison means nothing.
 */
import { probeDuckDb, probeQueue, probeTigerBeetle } from "./napi-probe.ts";

Deno.test("tigerbeetle-node: u128 crosses the N-API boundary intact under deno test", async () => {
  const r = await probeTigerBeetle();
  if (!r.ok) throw new Error(r.detail);
  console.log(`  → ${r.detail} (${r.ms}ms)`);
});

Deno.test("@duckdb/node-api: duckdb.node dlopens its sibling libduckdb under deno test", async () => {
  const r = await probeDuckDb();
  if (!r.ok) throw new Error(r.detail);
  console.log(`  → ${r.detail} (${r.ms}ms)`);
});

Deno.test("bullmq+ioredis: the queue path loads with no native code of its own", async () => {
  const r = await probeQueue();
  if (!r.ok) throw new Error(r.detail);
  console.log(`  → ${r.detail} (${r.ms}ms)`);
});
