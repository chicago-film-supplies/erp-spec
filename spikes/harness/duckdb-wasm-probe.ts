/**
 * SPIKE-007, client-side leg — what a browser would pay to query a sealed period itself.
 *
 *   deno task duckdb-wasm
 *
 * **Read this before quoting the numbers.** No browser is installed on the measuring machine, so
 * this runs `@duckdb/duckdb-wasm`'s *node* bundle under Deno. That is the same WebAssembly module
 * a browser loads, so the two numbers that decide the question — the engine's wire size and the
 * wasm linear memory a real query grows to — are the real ones. What it does NOT measure is page
 * JS heap, real network transfer, or a browser's own wasm memory cap. Those add to the cost; none
 * of them subtract. So a "not viable" verdict here is safe, and a "viable" verdict would need a
 * browser to confirm.
 *
 * The engine size is measured from disk rather than over the network on purpose: bytes on disk are
 * exactly the bytes a CDN serves, before content-encoding. Reported both raw and gzipped, because
 * a wasm binary is served compressed and quoting only the raw number overstates the cost.
 */
import { type ProbeResult, time } from "./probe-util.ts";

const DATA = new URL(".data/", import.meta.url).pathname;
const DIST = new URL(
  "node_modules/.deno/@duckdb+duckdb-wasm@1.33.1-dev57.0/node_modules/@duckdb/duckdb-wasm/dist/",
  import.meta.url,
)
  .pathname;

const gzippedSize = async (path: string): Promise<number> => {
  const f = await Deno.open(path, { read: true });
  let n = 0;
  await f.readable
    .pipeThrough(new CompressionStream("gzip"))
    .pipeTo(new WritableStream({ write: (c) => void (n += c.byteLength) }));
  return n;
};

/**
 * What the client downloads before it can run a single query. This is the whole verdict in one
 * number, and it does not depend on the corpus at all.
 */
const probeEngineWeight = () =>
  time("engine weight over the wire", async () => {
    const parts: string[] = [];
    for (const f of ["duckdb-eh.wasm", "duckdb-mvp.wasm", "duckdb-coi.wasm"]) {
      const raw = (await Deno.stat(`${DIST}${f}`)).size;
      const gz = await gzippedSize(`${DIST}${f}`);
      parts.push(
        `${f.replace("duckdb-", "").replace(".wasm", "")} ${(raw / 1e6).toFixed(1)}MB raw / ${
          (gz / 1e6).toFixed(1)
        }MB gz`,
      );
    }
    const js = (await Deno.stat(`${DIST}duckdb-browser.mjs`)).size;
    parts.push(`browser.mjs ${(js / 1e6).toFixed(2)}MB`);
    return parts.join(", ");
  });

/** What the client downloads per period. Measured across the same scales as the server-side leg. */
const probeCorpusWeight = () =>
  time("parquet over the wire", async () => {
    const parts: string[] = [];
    for (const rows of [15_000, 150_000, 1_500_000, 15_000_000]) {
      const p = `${DATA}postings-${rows}.parquet`;
      try {
        const raw = (await Deno.stat(p)).size;
        parts.push(`${rows.toLocaleString()} rows → ${(raw / 1e6).toFixed(1)}MB`);
      } catch {
        parts.push(
          `${rows.toLocaleString()} rows → (not generated; run \`deno task duckdb\` first)`,
        );
      }
    }
    return parts.join(", ");
  });

/**
 * The Parquet reader is NOT in the core wasm module.
 *
 * duckdb-wasm autoloads it from `extensions.duckdb.org` on first use — a 3.2 MB fetch from a
 * third-party CDN, at query time, per session. That is an architectural fact about the
 * client-side path, not a performance caveat: the browser needs the engine, then a runtime
 * round-trip to a domain CFS does not control, before it can read the artifact.
 *
 * The autoload also does not work under Deno's node-runtime shim, which is why the query probe
 * below reads CSV. The extension itself is published and reachable — checked 2026-08-09, HTTP 200
 * for v1.4.0, v1.5.4 and v1.5.5 of `wasm_eh/parquet.duckdb_extension.wasm` — so this is a
 * harness limitation, not an upstream gap, and it must not be reported as one.
 */
const probeParquetExtension = () =>
  time("parquet reader is a CDN fetch", async () => {
    const local = `${DATA}parquet.duckdb_extension.wasm`;
    let size = 0;
    try {
      size = (await Deno.stat(local)).size;
    } catch {
      return "extension not downloaded locally — see _README.md; upstream URL returned 200 on 2026-08-09";
    }
    return `${
      (size / 1e6).toFixed(1)
    }MB, autoloaded from extensions.duckdb.org at first query, not bundled`;
  });

/**
 * Instantiate the engine and run the trial balance, reading the wasm linear memory it grows to.
 *
 * **Reads CSV, not Parquet** — see probeParquetExtension: the autoload path fails under Deno's
 * node-runtime shim. CSV is core to the engine and needs no extension. This makes the heap number
 * PESSIMISTIC rather than optimistic (the same rows are 1.3 MB of Parquet-equivalent data but
 * 136.8 MB of CSV at 1.5M rows, and CSV ingest is the heavier path), so it is safe to reason
 * "the real Parquet figure is no worse than this" and unsafe to reason the reverse.
 *
 * `HEAPU8.buffer.byteLength` is the wasm linear memory — the number that decides whether a phone
 * can do this. wasm32 addresses at most 4 GiB and browsers cap it far below in practice.
 */
const probeWasmHeap = () =>
  time("wasm engine heap under query", async () => {
    // The BLOCKING node bundle, not the async one: `duckdb-node.cjs` drives its worker with
    // `addEventListener`, which a `node:worker_threads` Worker under Deno does not have. Same
    // wasm module either way — the worker is a concurrency wrapper, not part of the engine.
    // deno-lint-ignore no-explicit-any
    const duckdb = await import("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs") as any;
    const db = await duckdb.createDuckDB(
      {
        mvp: { mainModule: `${DIST}duckdb-mvp.wasm`, mainWorker: null },
        eh: { mainModule: `${DIST}duckdb-eh.wasm`, mainWorker: null },
      },
      new duckdb.ConsoleLogger(duckdb.LogLevel?.ERROR ?? 4),
      duckdb.NODE_RUNTIME,
    );
    await db.instantiate(() => {});
    const heap = () => db.mod?.HEAPU8?.buffer?.byteLength ?? 0;
    const parts = [`instantiate ${(heap() / 1e6).toFixed(0)}MB`];

    for (const rows of [15_000, 1_500_000]) {
      const csv = await Deno.readFile(`${DATA}postings-${rows}.csv`);
      db.registerFileBuffer(`p-${rows}.csv`, csv);
      const conn = db.connect();
      const t0 = performance.now();
      const r = conn.query(`
        SELECT account_code, SUM(debit_cents) d, SUM(credit_cents) c
        FROM read_csv('p-${rows}.csv')
        WHERE accounting_date >= DATE '2026-03-01' AND accounting_date < DATE '2026-04-01'
        GROUP BY account_code ORDER BY account_code
      `);
      const ms = Math.round(performance.now() - t0);
      if ((r.numRows ?? 0) === 0) throw new Error(`wasm query returned no rows at ${rows}`);
      parts.push(
        `${rows.toLocaleString()} rows (${
          (csv.byteLength / 1e6).toFixed(1)
        }MB csv) → ${r.numRows} accounts, ${ms}ms, heap ${(heap() / 1e6).toFixed(0)}MB`,
      );
      conn.close();
    }
    return parts.join("; ");
  });

export const runWasmProbe = async (): Promise<ProbeResult[]> => [
  await probeEngineWeight(),
  await probeCorpusWeight(),
  await probeParquetExtension(),
  await probeWasmHeap(),
];

if (import.meta.main) {
  const results = await runWasmProbe();
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
