/**
 * BullMQ + ioredis, loaded but not connected. See probe-tb.ts for why each probe is its own module.
 *
 * Both are pure JS, so the interesting question is not whether they load — it is whether anything
 * in the transitive tree reaches for a `.node`. msgpackr ships an OPTIONAL native accelerator
 * (msgpackr-extract) whose build script Deno declines to run, and it swallows its own load
 * failure, so probe it directly rather than inferring from the queue path still working.
 */
import { type ProbeResult, time } from "./probe-util.ts";

export const probeQueue = (): Promise<ProbeResult> =>
  time("bullmq+ioredis/pure-js", async () => {
    const { Queue } = await import("bullmq");
    const { default: Redis } = await import("ioredis");
    if (typeof Queue !== "function") throw new Error("bullmq Queue is not a constructor");
    if (typeof Redis !== "function") throw new Error("ioredis default export is not a constructor");

    // 2^62 cents, i.e. far above 2^53 — money crosses this codec as job payload and must not be
    // silently widened to a float. Note the ceiling: msgpackr refuses a bigint above 2^64 without
    // `useBigIntExtension`, so a u128 TigerBeetle id cannot travel as a raw job field.
    const { pack, unpack } = await import("msgpackr");
    const cents = 2n ** 62n + 1n;
    const round = unpack(pack({ entity: "order:1", cents }));
    if ((round as { cents: bigint }).cents !== cents) {
      throw new Error(
        `msgpackr bigint round-trip lost precision: ${(round as { cents: unknown }).cents}`,
      );
    }

    let extract = "not-attempted";
    try {
      const m = await import("msgpackr-extract");
      extract = typeof (m as { extractStrings?: unknown }).extractStrings === "function"
        ? "loaded"
        : `loaded-but-no-extractStrings (${Object.keys(m).join(",")})`;
    } catch (e) {
      extract = `unavailable: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`;
    }
    return `bullmq+ioredis constructible, msgpackr bigint exact, msgpackr-extract ${extract}`;
  });
