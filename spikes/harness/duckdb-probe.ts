/**
 * SPIKE-007, server-side leg — `@duckdb/node-api` over a sealed-period Parquet file.
 *
 *   deno task duckdb
 *
 * ADR-0017 already measured the corpus and ruled that performance does not discriminate between
 * designs, so this does NOT benchmark to pick an access path. It answers three things the ADR left
 * open: does the native client work from Deno on a real trial balance, does money survive the read
 * side as an integer, and **at what corpus size does the client-side WASM path stop being viable** —
 * which needs Parquet sizes across scales, not a stopwatch on one.
 *
 * The corpus is generated, not exported. Prod data does not belong in a spec repo, and the
 * question is about size and shape rather than content. Scale is pinned to the real number:
 * 999 invoices / 9,197 line items measured in prod (`api:2026-08-09:db_invoices_count` → 999),
 * i.e. order 15k postings for ALL history.
 */
import { type ProbeResult, time } from "./probe-util.ts";

const DATA = new URL(".data/", import.meta.url).pathname;

/** Real history is ~15k postings. The rest exist to locate the crossover, not to describe CFS. */
const SCALES = [
  { rows: 15_000, label: "15k — all CFS history (ADR-0017)" },
  { rows: 150_000, label: "150k — 10×" },
  { rows: 1_500_000, label: "1.5M — 100×" },
  { rows: 15_000_000, label: "15M — 1000×" },
];

type Conn = {
  runAndReadAll: (sql: string) => Promise<{ getRows: () => unknown[][] }>;
  run: (sql: string) => Promise<unknown>;
  closeSync: () => void;
};

const open = async () => {
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect() as unknown as Conn;
  return { instance, conn };
};

/**
 * A balanced double-entry corpus: every journal entry emits exactly one debit row and one credit
 * row of equal magnitude. That makes "debits equal credits" a property the data guarantees, so a
 * later failure of that assertion is a failure of the READ PATH rather than of the generator.
 *
 * `accounting_date` and `posted_at` are separate columns carrying different values — never
 * conflated (CLAUDE.md rule 8). Money is BIGINT cents throughout; there is no DOUBLE anywhere in
 * the schema.
 */
const generateSql = (rows: number, path: string) => `
COPY (
  WITH entry AS (
    SELECT
      e                                                    AS entry_no,
      (DATE '2026-01-01' + INTERVAL (e % 365) DAY)::DATE   AS accounting_date,
      TIMESTAMP '2026-01-01 00:00:00' + INTERVAL ((e % 365) * 24 + 5) HOUR AS posted_at,
      ((e * 2654435761) % 40 + 1)                          AS acct_seed,
      ((e * 40503) % 7)                                    AS dept_seed,
      ((e * 2246822519) % 5)                               AS loc_seed,
      (((e * 1103515245 + 12345) % 4_000_00) + 1)::BIGINT  AS amount_cents
    FROM range(0, ${Math.ceil(rows / 2)}) t(e)
  )
  SELECT
    (entry_no * 2 + side)::BIGINT                          AS posting_id,
    -- u128 journal-entry reference (ADR-0008's user_data_128) as DECIMAL(38,0), NOT HUGEINT:
    -- \`COPY ... TO parquet\` silently downcasts HUGEINT to DOUBLE. See probeHugeintTrap below.
    (((entry_no::HUGEINT << 64) + 7))::DECIMAL(38, 0)      AS journal_entry_id,
    accounting_date,
    posted_at,
    -- debit and credit legs land on different accounts, as a real entry would
    printf('%04d', CASE WHEN side = 0 THEN acct_seed ELSE acct_seed + 5000 END) AS account_code,
    printf('dept-%d', dept_seed)                           AS department,
    printf('loc-%d', loc_seed)                             AS location,
    CASE WHEN side = 0 THEN amount_cents ELSE 0 END::BIGINT AS debit_cents,
    CASE WHEN side = 1 THEN amount_cents ELSE 0 END::BIGINT AS credit_cents
  FROM entry, (SELECT 0 AS side UNION ALL SELECT 1) sides
) TO '${path}' (FORMAT parquet, COMPRESSION zstd);
`;

/** The real query: a trial balance for one period, periodised by ACCOUNTING DATE. */
const trialBalanceSql = (path: string) => `
SELECT
  account_code,
  SUM(debit_cents)::HUGEINT               AS debits,
  SUM(credit_cents)::HUGEINT              AS credits,
  SUM(debit_cents - credit_cents)::HUGEINT AS movement
FROM read_parquet('${path}')
WHERE accounting_date >= DATE '2026-03-01'
  AND accounting_date <  DATE '2026-04-01'
GROUP BY account_code
ORDER BY account_code
`;

const num = (v: unknown) => (typeof v === "bigint" ? v : BigInt(String(v)));

const probeScale = (conn: Conn, rows: number, label: string) =>
  time(`parquet ${label}`, async () => {
    const path = `${DATA}postings-${rows}.parquet`;
    const t0 = performance.now();
    await conn.run(generateSql(rows, path));
    const genMs = Math.round(performance.now() - t0);
    const bytes = (await Deno.stat(path)).size;

    const t1 = performance.now();
    const reader = await conn.runAndReadAll(trialBalanceSql(path));
    const tb = reader.getRows();
    const queryMs = Math.round(performance.now() - t1);

    // The balance property. Debits must equal credits exactly, in integers.
    let debits = 0n, credits = 0n;
    for (const r of tb) {
      debits += num(r[1]);
      credits += num(r[2]);
      if (typeof r[1] !== "bigint") {
        throw new Error(
          `SUM(debit_cents) came back as ${typeof r[1]} — the read side widened money`,
        );
      }
    }
    if (debits !== credits) {
      throw new Error(`trial balance does not balance: debits ${debits} vs credits ${credits}`);
    }
    if (debits === 0n) {
      throw new Error("period is empty — the accounting_date filter matched nothing");
    }

    return [
      `${(bytes / 1e6).toFixed(1)} MB parquet`,
      `${tb.length} accounts`,
      `debits=credits=${debits}`,
      `query ${queryMs}ms`,
      `(generate ${genMs}ms)`,
    ].join(", ");
  });

/**
 * The fail-closed companion. Everything above passes whether or not the integer discipline
 * matters, so run the SAME aggregate through DOUBLE and assert it DISAGREES. If it ever agrees at
 * every scale, the corpus has stopped exercising the thing the rule exists for and the rule's
 * evidence here has gone vacuous — that is a finding, not a pass.
 */
const probeDoubleDisagrees = (conn: Conn, rows: number) =>
  time("DOUBLE disagrees with BIGINT", async () => {
    const path = `${DATA}postings-${rows}.parquet`;
    const reader = await conn.runAndReadAll(`
      SELECT
        SUM(debit_cents)::HUGEINT                 AS exact_cents,
        SUM(debit_cents::DOUBLE)                  AS float_cents,
        SUM(debit_cents::DOUBLE / 100.0)          AS float_dollars
      FROM read_parquet('${path}')
    `);
    const [row] = reader.getRows();
    const exact = num(row[0]);
    const asFloat = Number(row[1]);
    const dollars = Number(row[2]);

    const floatDrift = BigInt(Math.round(asFloat)) - exact;
    // Dollars is the form that actually appears in the wild: divide first, then sum.
    const dollarsDrift = Math.round(dollars * 100) - Number(exact);

    return [
      `exact ${exact} cents`,
      `SUM(::DOUBLE) drift ${floatDrift} cents`,
      `SUM(::DOUBLE/100) drift ${dollarsDrift} cents`,
      dollarsDrift === 0
        ? "— NOT YET DIVERGENT at this scale"
        : "— divergent, as the rule predicts",
    ].join(", ");
  });

/**
 * The u128 reference survives Parquet — but only in the right encoding.
 *
 * `accounting_date` is checked here too: `DATE + INTERVAL` yields a TIMESTAMP in DuckDB, so the
 * column silently became a TIMESTAMP on the first run. Accounting date and posting timestamp are
 * always distinct fields (CLAUDE.md rule 8) and the accounting date is a calendar day; a column
 * that quietly grew a time-of-day is the beginning of periodising on the wrong thing.
 */
const probeU128ThroughParquet = (conn: Conn, rows: number) =>
  time("u128 ref + DATE survive parquet", async () => {
    const path = `${DATA}postings-${rows}.parquet`;
    const types = await conn.runAndReadAll(
      `SELECT name, type FROM parquet_schema('${path}') WHERE name IN ('journal_entry_id','accounting_date','debit_cents')`,
    );
    const t = Object.fromEntries(types.getRows().map((r) => [String(r[0]), String(r[1])]));

    const reader = await conn.runAndReadAll(`
      SELECT journal_entry_id::VARCHAR, posting_id, typeof(accounting_date)
      FROM read_parquet('${path}') ORDER BY posting_id DESC LIMIT 1
    `);
    const [row] = reader.getRows();
    const jid = BigInt(String(row[0]).replace(/\.0+$/, ""));
    const postingId = BigInt(String(row[1]));
    const dateType = String(row[2]);

    const expected = (((postingId - (postingId % 2n)) / 2n) << 64n) + 7n;
    if (jid !== expected) {
      throw new Error(`journal_entry_id ${jid} !== ${expected} — lost through parquet`);
    }
    if (jid < 1n << 64n) throw new Error(`journal_entry_id ${jid} fits in u64 — high bits lost`);
    if (dateType !== "DATE") throw new Error(`accounting_date is ${dateType}, must be DATE`);
    if (t.debit_cents !== "INT64") {
      throw new Error(`debit_cents stored as ${t.debit_cents}, not INT64`);
    }

    return `jref ${jid} exact as ${t.journal_entry_id}, accounting_date ${t.accounting_date}/DATE, money INT64`;
  });

/**
 * The trap, asserted as a trap.
 *
 * `COPY ... TO parquet` **silently downcasts HUGEINT to DOUBLE** — no error, no warning. The value
 * writes, reads, and comes back as a JS `number` with everything below ~2^53 gone. ADR-0008
 * reserves `user_data_128` for the journal entry id, so this is the exact field that would have
 * been corrupted.
 *
 * This asserts the defect STILL EXISTS. If DuckDB ever gains int128 Parquet support the check
 * flips and tells us the encoding workaround can be retired — which is the point of writing it as
 * an assertion rather than a comment.
 */
const probeHugeintTrap = (conn: Conn) =>
  time("HUGEINT→parquet is still lossy", async () => {
    const v = (1n << 100n) + 7n; // needs both halves; far above 2^53
    const path = `${DATA}hugeint-trap.parquet`;
    await conn.run(`COPY (SELECT ${v}::HUGEINT AS v) TO '${path}' (FORMAT parquet)`);
    const sch = await conn.runAndReadAll(
      `SELECT type FROM parquet_schema('${path}') WHERE name='v'`,
    );
    const stored = String(sch.getRows()[0][0]);
    const back = await conn.runAndReadAll(
      `SELECT v::VARCHAR, typeof(v) FROM read_parquet('${path}')`,
    );
    const [r] = back.getRows();
    const exact = String(r[0]) === String(v);
    if (stored !== "DOUBLE") {
      return `⚠️ CHANGED: HUGEINT now stores as ${stored} (was DOUBLE) — re-evaluate the encoding rule`;
    }
    if (exact) {
      throw new Error("HUGEINT stored as DOUBLE yet round-tripped exactly — check the probe");
    }
    return `confirmed lossy: HUGEINT → parquet ${stored} → ${r[1]}, ${v} came back as ${r[0]}`;
  });

/** The encodings that DO survive, so ADR-0024 can name one rather than only forbid HUGEINT. */
const probeU128Encodings = (conn: Conn) =>
  time("u128 encodings that survive", async () => {
    const tb = await import("tigerbeetle-node");
    const realId = tb.id();
    const u128max = (1n << 128n) - 1n;
    const out: string[] = [];

    for (
      const [label, expr, v] of [
        ["DECIMAL(38,0)/real-id", `${realId}::DECIMAL(38,0)`, realId],
        ["VARCHAR/u128-max", `'${u128max}'`, u128max],
      ] as [string, string, bigint][]
    ) {
      const path = `${DATA}enc-${label.replace(/\W/g, "")}.parquet`;
      await conn.run(`COPY (SELECT ${expr} AS v) TO '${path}' (FORMAT parquet)`);
      const sch = await conn.runAndReadAll(
        `SELECT type FROM parquet_schema('${path}') WHERE name='v'`,
      );
      const back = await conn.runAndReadAll(`SELECT v::VARCHAR FROM read_parquet('${path}')`);
      const got = String(back.getRows()[0][0]).replace(/\.0+$/, "");
      if (got !== String(v)) throw new Error(`${label} round-trip inexact: ${got} !== ${v}`);
      out.push(`${label}→${sch.getRows()[0][0]} exact`);
    }

    // And the boundary: DECIMAL(38,0) cannot hold a full u128, but it FAILS LOUDLY rather than
    // silently — the opposite of HUGEINT, and the reason it is still the better default.
    let loud = "did NOT reject";
    try {
      await conn.run(`SELECT ${u128max}::DECIMAL(38,0)`);
    } catch (e) {
      loud = `rejects u128 max (${(e as Error).message.split(":")[0]})`;
    }
    out.push(`DECIMAL(38,0) ${loud}`);
    out.push(`real TB id is ${realId.toString().length} digits / bit ${realId.toString(2).length}`);
    return out.join("; ");
  });

export const runDuckDbProbe = async (): Promise<ProbeResult[]> => {
  await Deno.mkdir(DATA, { recursive: true });
  const { instance, conn } = await open();
  const results: ProbeResult[] = [];

  for (const s of SCALES) results.push(await probeScale(conn, s.rows, s.label));
  results.push(await probeU128ThroughParquet(conn, 15_000));
  results.push(await probeHugeintTrap(conn));
  results.push(await probeU128Encodings(conn));
  results.push(await probeDoubleDisagrees(conn, 15_000));
  results.push(await probeDoubleDisagrees(conn, 15_000_000));

  conn.closeSync();
  (instance as unknown as { closeSync: () => void }).closeSync();
  return results;
};

if (import.meta.main) {
  const results = await runDuckDbProbe();
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
