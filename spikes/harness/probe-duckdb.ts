/**
 * DuckDB's N-API surface, in isolation. See probe-tb.ts for why each probe is its own module.
 *
 * This is the package denoland/deno#29203 is filed against: `duckdb.node` dlopens a sibling
 * `libduckdb.dylib` through @rpath. Round-trip a HUGEINT wider than 2^53 — money is
 * BIGINT/HUGEINT in this design and never DOUBLE (research-drop/reference/duckdb.md), so a bridge
 * that hands back a float has failed even though it returned a number.
 */
import { type ProbeResult, time } from "./probe-util.ts";

export const probeDuckDb = (): Promise<ProbeResult> =>
  time("@duckdb/node-api/HUGEINT", async () => {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    const reader = await conn.runAndReadAll(
      "SELECT 170141183460469231731687303715884105727::HUGEINT AS h, version() AS v",
    );
    const [row] = reader.getRows();
    const h = row[0];
    const v = String(row[1]);
    if (typeof h !== "bigint") {
      throw new Error(`HUGEINT came back as ${typeof h} (${h}) — not bigint`);
    }
    if (h !== (1n << 127n) - 1n) throw new Error(`HUGEINT round-trip lost precision: ${h}`);
    conn.closeSync();
    instance.closeSync();
    return `hugeint i128 max exact, duckdb ${v}`;
  });
