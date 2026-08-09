/**
 * TigerBeetle's N-API surface, in isolation.
 *
 * Its own module rather than a branch of a shared file, because `deno compile` embeds every
 * statically-reachable literal `import()` — a shared probe file makes every compile leg carry all
 * three dependency trees and the per-package answer becomes unobtainable.
 *
 * `id()` is the cheapest true round trip in the client: it calls into the Zig addon and returns a
 * u128 as a JS BigInt. u128 marshalling is what a half-working bridge silently breaks
 * (research-drop/reference/tigerbeetle.md:27-29), so assert the width and the monotonicity — not
 * merely that a value came back.
 */
import { type ProbeResult, time } from "./probe-util.ts";

export const probeTigerBeetle = (): Promise<ProbeResult> =>
  time("tigerbeetle-node/id()", async () => {
    const tb = await import("tigerbeetle-node");
    const a = tb.id();
    const b = tb.id();
    if (typeof a !== "bigint") throw new Error(`id() returned ${typeof a}, expected bigint`);
    if (!(b > a)) throw new Error(`id() not monotonic: ${a} then ${b}`);
    const U128_MAX = (1n << 128n) - 1n;
    if (a <= 0n || a > U128_MAX) throw new Error(`id() outside u128 range: ${a}`);
    // A bridge that truncated to u64 would keep ids under 2^64. A real TigerBeetle id carries a
    // millisecond timestamp in its high 48 bits and sits far above that boundary.
    if (a < 1n << 64n) {
      throw new Error(`id() fits in u64 (${a}) — high bits lost across the bridge`);
    }
    return `u128 ok, ${a.toString(16).length} hex digits, monotonic delta ${b - a}`;
  });
