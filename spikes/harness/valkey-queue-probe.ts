/**
 * SPIKE-010 — BullMQ + ioredis against a real Valkey, from Deno.
 *
 *   valkey-server --port 6399 --dir .data --appendonly yes --appendfsync everysec --save ''
 *   deno task valkey
 *
 * **ioredis, not valkey-glide**, deliberately: valkey-glide is a Rust N-API addon and would
 * re-import the whole `deno compile` native-addon problem into the queue path for no benefit the
 * spike identifies. With ioredis the queue path carries no native code of its own — asserted, not
 * assumed, by `probe-queue.ts` in the shared matrix.
 *
 * The load-bearing criterion is per-entity serialization, and a concurrency test that passes
 * whether or not the lock exists proves nothing. So the serialization check runs TWICE — with the
 * lock and with it removed — and the run without it must FAIL. That is the same discipline as the
 * repo's "pair every fixed-point check with a property that holds independently", applied to
 * concurrency.
 */
import { type ProbeResult, time } from "./probe-util.ts";

const PORT = Number(Deno.env.get("VALKEY_PORT") ?? 6399);
const CONN = { host: "127.0.0.1", port: PORT, maxRetriesPerRequest: null };

// deno-lint-ignore no-explicit-any
type Any = any;

const lib = async () => {
  const bull = await import("bullmq") as Any;
  const { default: Redis } = await import("ioredis") as Any;
  return { bull, Redis };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uniq = (s: string) => `${s}-${performance.now().toString(36).replace(".", "")}`;

/**
 * ADR-0012's decision, implemented: "a lock keyed by entity, not a global concurrency cap."
 *
 * SET NX PX is the whole mechanism. The worker holds the entity's lock for the duration of the
 * job and releases it after; a second worker that cannot take the lock defers its job rather than
 * running it concurrently. Nothing here needs a paid tier.
 */
const withEntityLock = async (
  redis: Any,
  entity: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<boolean> => {
  const key = `lock:{${entity}}`;
  const token = crypto.randomUUID();
  const got = await redis.set(key, token, "PX", ttlMs, "NX");
  if (!got) return false;
  try {
    await fn();
    return true;
  } finally {
    // Release only if we still own it — a naive DEL would drop a successor's lock after expiry.
    await redis.eval(
      `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
      1,
      key,
      token,
    );
  }
};

/**
 * Two workers, jobs on two entities, concurrency 4 — so the queue is NOT the thing serialising.
 * Each job records enter/exit against its entity; overlap on one entity is a violation.
 *
 * Run with `locked = false` and it must report overlaps. If it does not, the test is not
 * exercising concurrency and its green run means nothing.
 */
const serializationRun = async (locked: boolean) => {
  const { bull, Redis } = await lib();
  const redis = new Redis(CONN);
  const name = uniq(locked ? "ser-locked" : "ser-unlocked");
  const queue = new bull.Queue(name, { connection: CONN });

  const active: Record<string, number> = {};
  const overlaps: Record<string, number> = {};
  // Max jobs running at once ACROSS all entities. With the lock, same-entity is capped at 1, so
  // anything above 1 here is cross-entity concurrency — i.e. proof the lock is not a global cap.
  // Counting a maximum rather than sampling "was another entity active when I started" matters:
  // the sampled form is timing-dependent and reported a false failure inside a compiled binary,
  // where startup latency happened to serialise the first jobs.
  let maxTotalActive = 0;

  const process = async (job: Any) => {
    const entity = job.data.entity as string;
    const body = async () => {
      active[entity] = (active[entity] ?? 0) + 1;
      if (active[entity] > 1) overlaps[entity] = (overlaps[entity] ?? 0) + 1;
      const total = Object.values(active).reduce((a, b) => a + b, 0);
      if (total > maxTotalActive) maxTotalActive = total;
      await sleep(40);
      active[entity] -= 1;
    };
    if (!locked) return void (await body());
    // Deferral, not a busy-wait: if the entity is held, re-enqueue and let the holder finish.
    const ran = await withEntityLock(redis, entity, 5_000, body);
    if (!ran) {
      await queue.add("j", job.data, { delay: 25 });
    }
  };

  const workers = [0, 1].map(() =>
    new bull.Worker(name, process, { connection: CONN, concurrency: 4 })
  );

  const ENTITIES = ["order:A", "order:B", "order:C"];
  const PER = 8;
  for (const e of ENTITIES) {
    for (let i = 0; i < PER; i++) await queue.add("j", { entity: e, i });
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const counts = await queue.getJobCounts("waiting", "active", "delayed");
    if (counts.waiting + counts.active + counts.delayed === 0) break;
    await sleep(50);
  }

  for (const w of workers) await w.close();
  await queue.obliterate({ force: true }).catch(() => {});
  await queue.close();
  await redis.quit();

  const totalOverlaps = Object.values(overlaps).reduce((a, b) => a + b, 0);
  return { totalOverlaps, maxTotalActive, entities: ENTITIES.length };
};

const checkSerialization = () =>
  time("per-entity lock serialises", async () => {
    const withLock = await serializationRun(true);
    if (withLock.totalOverlaps !== 0) {
      throw new Error(`lock failed: ${withLock.totalOverlaps} same-entity overlaps`);
    }
    if (withLock.maxTotalActive < 2) {
      throw new Error(
        `lock is a disguised global cap: peak concurrency across ${withLock.entities} entities was ${withLock.maxTotalActive}`,
      );
    }
    return `0 same-entity overlaps across ${withLock.entities} entities, peak cross-entity concurrency ${withLock.maxTotalActive} (so it is not a global cap)`;
  });

/** The fail-closed companion: the SAME test with the lock removed must report overlaps. */
const checkSerializationFailsWithoutLock = () =>
  time("…and fails without the lock", async () => {
    const noLock = await serializationRun(false);
    if (noLock.totalOverlaps === 0) {
      throw new Error(
        "removing the lock produced 0 overlaps — the test does not exercise concurrency, so its green run proves nothing",
      );
    }
    return `${noLock.totalOverlaps} same-entity overlaps without the lock — the test bites`;
  });

/** Dedup id, delayed job, rate limit, and a failure landing in the failed set. */
const checkQueueMechanics = () =>
  time("dedup / delay / ratelimit / failed", async () => {
    const { bull } = await lib();
    const name = uniq("mech");
    const queue = new bull.Queue(name, { connection: CONN });
    const notes: string[] = [];

    // Dedup by explicit job id — the second add must not create a second job.
    await queue.add("a", { n: 1 }, { jobId: "dedup-me" });
    await queue.add("a", { n: 2 }, { jobId: "dedup-me" });
    const waiting = await queue.getJobCounts("waiting");
    if (waiting.waiting !== 1) {
      throw new Error(`dedup failed: ${waiting.waiting} waiting, expected 1`);
    }
    notes.push("dedup by jobId: 1 job");

    // Delay.
    await queue.add("b", { n: 3 }, { delay: 60_000 });
    const delayed = await queue.getJobCounts("delayed");
    if (delayed.delayed !== 1) throw new Error(`delay failed: ${delayed.delayed} delayed`);
    notes.push("delayed: 1");

    // Failure lands in the failed set, after retries are exhausted.
    const failQ = new bull.Queue(uniq("fail"), { connection: CONN });
    await failQ.add("boom", {}, { attempts: 2, backoff: { type: "fixed", delay: 10 } });
    let attempts = 0;
    const fw = new bull.Worker(failQ.name, () => {
      attempts++;
      throw new Error("deliberate");
    }, { connection: CONN });
    const t = Date.now();
    while (Date.now() - t < 10_000) {
      if ((await failQ.getJobCounts("failed")).failed === 1) break;
      await sleep(50);
    }
    const failedCount = (await failQ.getJobCounts("failed")).failed;
    await fw.close();
    if (failedCount !== 1) throw new Error(`failed set has ${failedCount}, expected 1`);
    notes.push(`failed set: 1 after ${attempts} attempts`);

    // Rate limit: 2 jobs per 400ms means 6 jobs cannot finish inside 400ms.
    const rlName = uniq("rl");
    const rlQ = new bull.Queue(rlName, { connection: CONN });
    for (let i = 0; i < 6; i++) await rlQ.add("r", { i });
    let done = 0;
    const rw = new bull.Worker(rlName, () => {
      done++;
      return Promise.resolve();
    }, { connection: CONN, limiter: { max: 2, duration: 400 } });
    const rt = Date.now();
    while (Date.now() - rt < 6_000 && done < 6) await sleep(25);
    const elapsed = Date.now() - rt;
    await rw.close();
    if (done !== 6) throw new Error(`rate-limited run finished ${done}/6`);
    if (elapsed < 800) {
      throw new Error(`6 jobs at 2/400ms took ${elapsed}ms — the limiter did not bite`);
    }
    notes.push(`ratelimit 2/400ms: 6 jobs in ${elapsed}ms`);

    for (const q of [queue, failQ, rlQ]) {
      await q.obliterate({ force: true }).catch(() => {});
      await q.close();
    }
    return notes.join("; ");
  });

/**
 * The regression ADR-0012 flags against Cloud Scheduler: a repeatable that stops firing because
 * its worker died is SILENT, where Cloud Scheduler failed visibly.
 *
 * So: run a repeatable, stop the worker, let several windows pass, restart, and record what is
 * recoverable. The answer is the input to the monitoring ADR-0013 assumes is "wiring".
 */
const checkRepeatableWhileDown = () =>
  time("repeatable with the worker down", async () => {
    const { bull } = await lib();
    const name = uniq("rep");
    const queue = new bull.Queue(name, { connection: CONN });
    const EVERY = 300;

    let fired = 0;
    const mk = () =>
      new bull.Worker(name, () => {
        fired++;
        return Promise.resolve();
      }, { connection: CONN });

    await queue.upsertJobScheduler("tick", { every: EVERY }, { name: "tick" });

    let w = mk();
    await sleep(EVERY * 3.5);
    const beforeDown = fired;
    await w.close();

    const downFor = EVERY * 5;
    await sleep(downFor);
    const duringDown = fired - beforeDown;

    w = mk();
    await sleep(EVERY * 2.5);
    const afterUp = fired - beforeDown - duringDown;
    await w.close();

    const schedulers = await queue.getJobSchedulers();
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close();

    const missedWindows = Math.floor(downFor / EVERY);
    return [
      `${beforeDown} fired before`,
      `${duringDown} while the worker was down (${missedWindows} windows elapsed)`,
      `${afterUp} in the first ${EVERY * 2.5}ms after restart`,
      `scheduler survived: ${schedulers.length === 1}`,
      duringDown === 0
        ? "→ missed windows are NOT backfilled; the schedule resumes, the gap is silent"
        : "→ something fired with no worker, re-check the model",
    ].join("; ");
  });

/**
 * ADR-0012 requires the AOF setting to be STATED rather than inherited, and no exit criterion
 * covered it. Measure what `everysec` actually costs on a hard kill rather than quoting "about a
 * second".
 */
const checkAofWindow = () =>
  time("AOF everysec loss window", async () => {
    const { Redis } = await lib();
    const redis = new Redis(CONN);
    const cfg = Object.fromEntries(
      await Promise.all(
        ["appendonly", "appendfsync", "save"].map(async (
          k,
        ) => [k, (await redis.config("GET", k))[1]]),
      ),
    );
    if (cfg.appendonly !== "yes") {
      throw new Error(`appendonly is ${cfg.appendonly} — durability is off`);
    }
    if (cfg.appendfsync !== "everysec") {
      throw new Error(`appendfsync is ${cfg.appendfsync}, expected everysec`);
    }

    // How many acknowledged writes fit in one fsync window — i.e. the size of the loss on a hard
    // kill. Not a guess: measured throughput × the window.
    // Five bursts, reported as a range. A single burst swings roughly 2× run to run (98k vs 208k
    // observed), so quoting one figure to five digits would be false precision about a number
    // whose only job is to establish an order of magnitude.
    const N = 2_000;
    const rates: number[] = [];
    for (let round = 0; round < 5; round++) {
      const t0 = performance.now();
      const pipe = redis.pipeline();
      for (let i = 0; i < N; i++) pipe.set(`aofprobe:${round}:${i}`, i);
      await pipe.exec();
      rates.push(Math.round(N / ((performance.now() - t0) / 1000)));
    }
    const lo = Math.min(...rates), hi = Math.max(...rates);
    for (let round = 0; round < 5; round++) {
      await redis.del(...Array.from({ length: N }, (_, i) => `aofprobe:${round}:${i}`));
    }
    await redis.quit();

    const k = (n: number) => `${Math.round(n / 1000)}k`;
    return [
      `appendonly=${cfg.appendonly}`,
      `appendfsync=${cfg.appendfsync}`,
      `save='${cfg.save}'`,
      `${k(lo)}–${
        k(hi)
      } acked writes/s pipelined over 5 bursts → order 10^5 acked writes can sit inside one fsync window`,
    ].join(", ");
  });

export const runValkeyProbe = async (): Promise<ProbeResult[]> => [
  await checkSerialization(),
  await checkSerializationFailsWithoutLock(),
  await checkQueueMechanics(),
  await checkRepeatableWhileDown(),
  await checkAofWindow(),
];

if (import.meta.main) {
  const results = await runValkeyProbe();
  for (const r of results) {
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(34)} ${
        r.ms.toString().padStart(6)
      }ms  ${r.detail}`,
    );
  }
  console.log(`MATRIX_JSON ${JSON.stringify({ deno: Deno.version.deno, results })}`);
  if (results.some((r) => !r.ok)) Deno.exit(1);
}
