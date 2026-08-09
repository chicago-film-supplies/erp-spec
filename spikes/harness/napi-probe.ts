/**
 * The shared native-addon probe. One experiment, run once, cited by SPIKE-001, SPIKE-007 and
 * SPIKE-010 instead of each repeating it.
 *
 * The question is not "does the module import" — a module that imports and then returns garbage
 * across the N-API boundary is the failure mode that matters. So every check calls into the addon
 * and asserts a VALUE, not an absence of throw.
 *
 * This file is the combined `deno run` / `deno test` entrypoint. The compile legs use
 * `entry-*.ts`, one package each, because `deno compile` embeds every statically-reachable
 * literal `import()` — going through this file would make every compiled binary carry all three
 * trees and the per-package answer would be unobtainable.
 */
export { probeTigerBeetle } from "./probe-tb.ts";
export { probeDuckDb } from "./probe-duckdb.ts";
export { probeQueue } from "./probe-queue.ts";
export type { ProbeResult } from "./probe-util.ts";

import { probeTigerBeetle } from "./probe-tb.ts";
import { probeDuckDb } from "./probe-duckdb.ts";
import { probeQueue } from "./probe-queue.ts";
import { emit, type ProbeResult } from "./probe-util.ts";

export const runAll = async (): Promise<ProbeResult[]> => {
  const out: ProbeResult[] = [];
  for (const p of [probeTigerBeetle, probeDuckDb, probeQueue]) out.push(await p());
  return out;
};

if (import.meta.main) emit(await runAll());
