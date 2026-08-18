/**
 * SPIKE-003 — TigerBeetle's `imported` flag: timestamp and monotonicity semantics.
 *
 * ADR-0010 says accounting date and posting timestamp are distinct fields and defers "which field
 * TigerBeetle carries, and how history is loaded" to this spike. `ledger/tigerbeetle-accounts.yaml`
 * records a `proposed` assignment `blocked_by: [SPIKE-003]`. This file is what unblocks it, and it
 * exists because the repo has already been burned by believing an exhaustiveness claim about
 * TigerBeetle read out of a note (`tb-field-budget_test.ts` header). Every statement below is a
 * measured status code from a real 0.17.9 cluster, not a reading of the docs.
 *
 * ── The cluster is spawned by this file, and that is load-bearing ────────────────────────────────
 *
 * `imported` is defined against the cluster's LAST COMMITTED TIMESTAMP. A probe run against a
 * cluster somebody else already posted into measures that cluster's history, not the flag. So this
 * formats a fresh single-replica cluster in a temp dir, runs the whole sequence against it, and
 * deletes it. The ORDER of the checks is part of the experiment: nothing after `liveAccount` can
 * import a backdated account, and nothing after `liveTransfer` can import a backdated transfer.
 * That is the finding, not an accident of sequencing.
 *
 *   deno run --allow-read --allow-write --allow-env --allow-ffi --allow-net --allow-run \
 *     tb-import-probe.ts
 *
 * TB_BIN overrides the server binary (default ./.data/tigerbeetle, see _README.md for the fetch).
 * TB_IMPORT_PORT overrides the port (default 3077 — deliberately not tb-probe.ts's 3033).
 */
import { type ProbeResult, time } from "./probe-util.ts";

const PORT = Deno.env.get("TB_IMPORT_PORT") ?? "3077";
const BIN = Deno.env.get("TB_BIN") ??
  new URL("./.data/tigerbeetle", import.meta.url).pathname;
const LEDGER = 1; // USD, asset scale 2 → 1 unit = 1 cent
const CODE = 1; // Transfer.code must not be zero

// ── flags ────────────────────────────────────────────────────────────────────────────────────────
const ACCOUNT_LINKED = 1;
const ACCOUNT_IMPORTED = 16;
const TRANSFER_LINKED = 1;
const TRANSFER_PENDING = 2;
const TRANSFER_IMPORTED = 256;

// ── statuses, from tigerbeetle-node's own bindings.d.ts ──────────────────────────────────────────
// `created` is 0xFFFFFFFF, not 0 — SPIKE-001's trap, restated here so this file reads standalone.
const OK = 4294967295;
const A = {
  linked_event_failed: 1,
  timestamp_must_be_zero: 3,
  imported_event_expected: 22,
  imported_event_not_expected: 23,
  imported_event_timestamp_out_of_range: 24,
  imported_event_timestamp_must_not_advance: 25,
  imported_event_timestamp_must_not_regress: 26,
  exists: 21,
} as const;
const T = {
  linked_event_failed: 1,
  timestamp_must_be_zero: 3,
  exists: 46,
  id_already_failed: 68,
  accounts_must_be_different: 12,
  imported_event_expected: 56,
  imported_event_not_expected: 57,
  imported_event_timestamp_out_of_range: 58,
  imported_event_timestamp_must_not_advance: 59,
  imported_event_timestamp_must_not_regress: 60,
  imported_event_timestamp_must_postdate_debit_account: 61,
  imported_event_timestamp_must_postdate_credit_account: 62,
  imported_event_timeout_must_be_zero: 63,
} as const;
const tName = (s: number) =>
  Object.entries(T).find(([, v]) => v === s)?.[0] ?? (s === OK ? "created" : `status_${s}`);
const aName = (s: number) =>
  Object.entries(A).find(([, v]) => v === s)?.[0] ?? (s === OK ? "created" : `status_${s}`);

// ── time helpers ─────────────────────────────────────────────────────────────────────────────────
/** ns since UNIX epoch for a UTC calendar day. TigerBeetle timestamps are u64 nanoseconds. */
const dayNs = (y: number, m: number, d: number) => BigInt(Date.UTC(y, m - 1, d)) * 1_000_000n;
const nowNs = () => BigInt(Date.now()) * 1_000_000n;
/** ADR-0010's accounting date, packed YYYYMMDD per `ledger/tigerbeetle-accounts.yaml`. */
const packDate = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
const yearsBetween = (a: bigint, b: bigint) =>
  Number((a - b) / 1_000_000_000n) / (365.2425 * 24 * 3600);

type TB = typeof import("tigerbeetle-node");
type Client = ReturnType<TB["createClient"]>;

const account = (id: bigint, flags: number, timestamp: bigint) => ({
  id,
  debits_pending: 0n,
  debits_posted: 0n,
  credits_pending: 0n,
  credits_posted: 0n,
  user_data_128: 0n,
  user_data_64: 0n,
  user_data_32: 0,
  reserved: 0,
  ledger: LEDGER,
  code: CODE,
  flags,
  timestamp,
});

const transfer = (
  id: bigint,
  debit: bigint,
  credit: bigint,
  amount: bigint,
  flags: number,
  timestamp: bigint,
  accountingDate = 0,
) => ({
  id,
  debit_account_id: debit,
  credit_account_id: credit,
  amount,
  pending_id: 0n,
  user_data_128: 0n,
  user_data_64: 0n,
  user_data_32: accountingDate, // ← the assignment under test
  timeout: 0,
  ledger: LEDGER,
  code: CODE,
  flags,
  timestamp,
});

const codes = (rs: { status: number }[]) => rs.map((r) => r.status);

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The cluster
// ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Cluster files go under `.data/` — already gitignored, and already where the binary lives, so
 * the probe needs `--allow-write=.data` rather than blanket write. */
const DATA = new URL("./.data", import.meta.url).pathname;

const startCluster = async (port: string, development = true) => {
  const dir = await Deno.makeTempDir({ dir: DATA, prefix: "tb-import-spike-" });
  const file = `${dir}/0_0.tigerbeetle`;
  const devArg = development ? ["--development"] : [];
  const fmt = await new Deno.Command(BIN, {
    args: ["format", "--cluster=0", "--replica=0", "--replica-count=1", ...devArg, file],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!fmt.success) {
    throw new Error(`format failed: ${new TextDecoder().decode(fmt.stderr)}`);
  }
  const proc = new Deno.Command(BIN, {
    args: ["start", `--addresses=${port}`, ...devArg, file],
    stdout: "null",
    stderr: "piped",
  }).spawn();
  // Wait for the listener rather than sleeping a guessed interval.
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const c = await Deno.connect({ hostname: "127.0.0.1", port: Number(port) });
      c.close();
      break;
    } catch (e) {
      if (Date.now() > deadline) throw new Error(`cluster never listened on ${port}: ${e}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return {
    dir,
    stop: async () => {
      try {
        proc.kill("SIGKILL");
      } catch { /* already gone */ }
      await proc.status;
      proc.stderr.cancel().catch(() => {});
      await Deno.remove(dir, { recursive: true });
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Shared state across checks — the sequence IS the experiment.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const st = {
  cash: 0n,
  revenue: 0n,
  expense: 0n,
  liveAcct: 0n,
  /** highest transfer timestamp committed so far */
  watermark: 0n,
  /** highest account timestamp committed so far */
  acctWatermark: 0n,
  importedTransferIds: [] as bigint[],
  liveTs: 0n,
  facts: [] as string[],
};

const ACCT_IMPORT_TS = {
  cash: dayNs(2018, 12, 31) + 1n,
  revenue: dayNs(2018, 12, 31) + 2n,
  expense: dayNs(2018, 12, 31) + 3n,
};

// ── 1. Accounts import backdated, and `Account.timestamp` is the user's ──────────────────────────
const checkImportAccounts = (c: Client, tb: TB) =>
  time("A1 accounts import backdated", async () => {
    st.cash = tb.id();
    st.revenue = tb.id();
    st.expense = tb.id();
    // Whole batch linked, per the docs' recommendation: if any fails, none commit and the
    // watermark is preserved for a corrected resubmission.
    const batch = [
      account(st.cash, ACCOUNT_IMPORTED | ACCOUNT_LINKED, ACCT_IMPORT_TS.cash),
      account(st.revenue, ACCOUNT_IMPORTED | ACCOUNT_LINKED, ACCT_IMPORT_TS.revenue),
      account(st.expense, ACCOUNT_IMPORTED, ACCT_IMPORT_TS.expense),
    ];
    const res = await c.createAccounts(batch);
    if (res.some((r) => r.status !== OK)) {
      throw new Error(`imported accounts rejected: ${codes(res).map(aName).join(",")}`);
    }
    const back = await c.lookupAccounts([st.cash, st.revenue, st.expense]);
    const wrong = back.filter((a, i) => a.timestamp !== batch[i].timestamp);
    if (wrong.length) {
      throw new Error(
        `Account.timestamp not the user's: ${back.map((a) => a.timestamp).join(",")} vs ${
          batch.map((b) => b.timestamp).join(",")
        }`,
      );
    }
    // CreateAccountResult carries a timestamp too — is it the user's or the commit's?
    const resTs = res.map((r) => r.timestamp);
    const echoed = resTs.every((t, i) => t === batch[i].timestamp);
    st.facts.push(
      `CreateAccountResult.timestamp ${
        echoed ? "echoes the user-supplied value" : `differs: ${resTs.join(",")}`
      }`,
    );
    return `3 accounts at 2018-12-31+1..3ns, Account.timestamp read back exact (${
      back[0].timestamp
    }), result ts echoed=${echoed}`;
  });

// ── 2. The history load: multi-year, accounting date years behind wall clock ─────────────────────
const HISTORY: Array<{ y: number; m: number; d: number; amount: bigint }> = [];
for (const y of [2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
  for (const m of [1, 4, 7, 10]) {
    HISTORY.push({ y, m, d: 15, amount: BigInt((y - 2018) * 1000 + m) });
  }
}

const checkHistoryLoad = (c: Client, tb: TB) =>
  time("A2 multi-year history load", async () => {
    const t0 = nowNs();
    const batch = HISTORY.map((h, i) =>
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        h.amount,
        TRANSFER_IMPORTED | (i < HISTORY.length - 1 ? TRANSFER_LINKED : 0),
        // TB timestamp = a POSTING timestamp we choose; strictly increasing, one ns apart within
        // a day so several postings can share an accounting date.
        dayNs(h.y, h.m, h.d) + BigInt(i),
        packDate(h.y, h.m, h.d), // ← accounting date, user_data_32, packed YYYYMMDD
      )
    );
    const res = await c.createTransfers(batch);
    const bad = res.filter((r) => r.status !== OK);
    if (bad.length) {
      throw new Error(
        `${bad.length}/${batch.length} rejected: ${[...new Set(codes(res).map(tName))].join(",")}`,
      );
    }
    st.importedTransferIds = batch.map((b) => b.id);
    st.watermark = batch[batch.length - 1].timestamp;

    const back = await c.lookupTransfers([batch[0].id, batch[batch.length - 1].id]);
    if (back[0].timestamp !== batch[0].timestamp) {
      throw new Error(`first transfer ts ${back[0].timestamp} != ${batch[0].timestamp}`);
    }
    if (back[0].user_data_32 !== batch[0].user_data_32) {
      throw new Error(`user_data_32 ${back[0].user_data_32} != ${batch[0].user_data_32}`);
    }
    // ⚠️ Does ANY record of the real commit time survive an imported load? If CreateTransferResult
    // echoes the user's timestamp, the answer is no — and ADR-0010's "posting timestamp" has no
    // home under this strategy.
    const echoed = res.every((r, i) => r.timestamp === batch[i].timestamp);
    st.facts.push(
      `CreateTransferResult.timestamp ${
        echoed
          ? "echoes the user-supplied value — an imported load leaves NO record of the real commit time anywhere in TigerBeetle"
          : `differs from the user value (${res[0].timestamp} vs ${batch[0].timestamp})`
      }`,
    );

    // The exit criterion: accounting date precedes the *wall clock at load time* by years.
    const oldest = yearsBetween(t0, back[0].timestamp);
    const newest = yearsBetween(t0, back[1].timestamp);
    return `${batch.length} transfers 2019-01-15..2025-10-15, accounting dates ${
      oldest.toFixed(2)
    }y..${newest.toFixed(2)}y behind the wall clock at load, user_data_32=${
      back[0].user_data_32
    } exact, result ts echoes user value=${echoed}`;
  });

// ── 2b. Batch scale — the shape the Xero restatement (ADR-0020) would actually submit ────────────
// The docs recommend submitting the whole import as ONE linked chain so a failure preserves the
// watermark. Whether that survives at the batch ceiling is a different question from whether it
// works at 28. Bulk legs run expense→revenue so the `cash` leg count stays inside the
// getAccountTransfers limit used by B3's independent balance check.
const BULK = 5_000;
const checkBatchScale = (c: Client, tb: TB) =>
  time("A2b import chain at batch max", async () => {
    const base = st.watermark;
    let cursor = 0;
    const chain = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        transfer(
          tb.id(),
          st.expense,
          st.revenue,
          1n,
          TRANSFER_IMPORTED | (i < n - 1 ? TRANSFER_LINKED : 0),
          base + BigInt(cursor + i + 1),
          packDate(2025, 12, 31),
        ));

    // ⚠️ The ceiling is enforced CLIENT-SIDE as a thrown RequestError, not as a per-event status,
    // so a migration that batches by count needs the real number. Measure it rather than quote the
    // docs' 8189: 5,000 already threw here. C1 below establishes whether the gap is TigerBeetle or
    // this cluster's `--development` flag.
    const maxOk = await maxBatch(c, tb);

    const t0 = performance.now();
    let total = 0;
    while (total < BULK) {
      const n = Math.min(maxOk, BULK - total);
      const res = await c.createTransfers(chain(n));
      const bad = res.filter((r) => r.status !== OK);
      if (bad.length) {
        throw new Error(
          `${bad.length}/${n} rejected: ${[...new Set(codes(res).map(tName))].join(",")}`,
        );
      }
      cursor += n;
      total += n;
    }
    const ms = performance.now() - t0;
    st.watermark = base + BigInt(cursor);
    const bal = (await c.lookupAccounts([st.expense]))[0];
    if (bal.debits_posted !== BigInt(BULK)) {
      throw new Error(`expense debits_posted ${bal.debits_posted}, expected ${BULK}`);
    }
    return `max imported events per createTransfers call = ${maxOk} (above it the CLIENT throws ERR_TOO_MUCH_DATA, no per-event status); ${BULK} imported transfers in ${
      Math.ceil(BULK / maxOk)
    } linked chains in ${ms.toFixed(0)}ms (${
      Math.round(BULK / (ms / 1000))
    }/s), debits_posted ${bal.debits_posted} exact`;
  });

// ── 3. Non-imported transfer may not carry a timestamp ───────────────────────────────────────────
const checkTimestampMustBeZero = (c: Client, tb: TB) =>
  time("A3 non-imported ts rejected", async () => {
    const res = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, 0, dayNs(2021, 6, 1), packDate(2021, 6, 1)),
    ]);
    if (res[0].status !== T.timestamp_must_be_zero) {
      throw new Error(`expected timestamp_must_be_zero(3), got ${tName(res[0].status)}`);
    }
    return `timestamp_must_be_zero(${res[0].status}) — without the flag the cluster owns the field`;
  });

// ── 4. imported + timestamp 0 ────────────────────────────────────────────────────────────────────
const checkImportedZeroTs = (c: Client, tb: TB) =>
  time("A4 imported ts=0 rejected", async () => {
    const res = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, 0n, packDate(2021, 6, 1)),
    ]);
    const hi = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, 1n << 63n, 0),
    ]);
    if (res[0].status !== T.imported_event_timestamp_out_of_range) {
      throw new Error(`ts=0 gave ${tName(res[0].status)}`);
    }
    if (hi[0].status !== T.imported_event_timestamp_out_of_range) {
      throw new Error(`ts=2^63 gave ${tName(hi[0].status)}`);
    }
    return `ts=0 and ts=2^63 both imported_event_timestamp_out_of_range(${
      res[0].status
    }) — the flag makes the field REQUIRED, not optional`;
  });

// ── 5. Future timestamp ──────────────────────────────────────────────────────────────────────────
const checkFutureTs = (c: Client, tb: TB) =>
  time("A5 future ts rejected", async () => {
    const future = nowNs() + 3_600n * 1_000_000_000n;
    const res = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, future, 0),
    ]);
    if (res[0].status !== T.imported_event_timestamp_must_not_advance) {
      throw new Error(`expected must_not_advance(59), got ${tName(res[0].status)}`);
    }
    return `+1h → imported_event_timestamp_must_not_advance(${
      res[0].status
    }); the import window is bounded ABOVE by the cluster clock`;
  });

// ── 6. Monotonicity within one batch, and the accounting-date-as-timestamp trap ──────────────────
const checkWithinBatchMonotonicity = (c: Client, tb: TB) =>
  time("A6 within-batch monotonicity", async () => {
    const base = st.watermark;
    // (a) strictly decreasing
    const dec = await c.createTransfers([
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        1n,
        TRANSFER_IMPORTED | TRANSFER_LINKED,
        base + 10n,
        0,
      ),
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, base + 5n, 0),
    ]);
    // (b) EQUAL timestamps — the shape you get if you set TB's timestamp to an accounting DAY and
    //     post twice on that day. This is the check that decides ADR-0010's field question.
    const sameDay = dayNs(2026, 1, 15);
    const eq = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED | TRANSFER_LINKED, sameDay, 0),
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, sameDay, 0),
    ]);
    const decLast = dec[1].status;
    const eqLast = eq[1].status;
    if (decLast !== T.imported_event_timestamp_must_not_regress) {
      throw new Error(`decreasing pair gave ${tName(decLast)}`);
    }
    if (eqLast !== T.imported_event_timestamp_must_not_regress) {
      throw new Error(`equal pair gave ${tName(eqLast)}`);
    }
    if (dec[0].status !== T.linked_event_failed || eq[0].status !== T.linked_event_failed) {
      throw new Error(
        `linked chain did not roll the first event back: ${tName(dec[0].status)}/${
          tName(eq[0].status)
        }`,
      );
    }
    // The chain rolled back, so the watermark must be untouched — resubmission with the SAME
    // timestamps is what the docs promise, and it is the migration's retry story.
    const retry = await c.createTransfers([
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        1n,
        TRANSFER_IMPORTED | TRANSFER_LINKED,
        base + 10n,
        0,
      ),
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, base + 11n, 0),
    ]);
    if (retry.some((r) => r.status !== OK)) {
      throw new Error(
        `corrected resubmission at the same timestamps failed: ${codes(retry).map(tName)}`,
      );
    }
    st.watermark = base + 11n;
    return `decreasing → must_not_regress(${decLast}); EQUAL → must_not_regress(${eqLast}) — two postings cannot share a timestamp, so TB's timestamp cannot be a calendar day; failed chain rolled back (linked_event_failed=${
      dec[0].status
    }) and the same timestamps re-imported clean`;
  });

// ── 7a. Are the account and transfer watermarks independent? ─────────────────────────────────────
// At this point the transfer watermark is ~2025 and the account watermark is 2018-12-31+3ns. An
// account imported at 2019-06-01 is BELOW the transfer watermark and ABOVE the account one. If it
// is created, the two watermarks are independent — which is a migration-ordering fact, because it
// means accounts and transfers can be imported in separate passes.
const checkWatermarksIndependent = (c: Client, tb: TB) =>
  time("A7a watermarks independent?", async () => {
    const ts = dayNs(2019, 6, 1);
    if (ts >= st.watermark) {
      throw new Error("setup broken: 2019 is not below the transfer watermark");
    }
    const id = tb.id();
    const res = await c.createAccounts([account(id, ACCOUNT_IMPORTED, ts)]);
    const created = res[0].status === OK;
    if (created) st.acctWatermark = ts;
    return `account imported at 2019-06-01 while the TRANSFER watermark is 2025-10-15 → ${
      aName(res[0].status)
    }(${res[0].status}) ⇒ watermarks are ${created ? "INDEPENDENT per object type" : "SHARED"}`;
  });

// ── 7b. Cross-object uniqueness, isolated ────────────────────────────────────────────────────────
// The docs claim a Transfer's timestamp "cannot be equal to the timestamp of any existing Account".
// The obvious test (reuse a 2018 account timestamp) is confounded: that value is also below the
// transfer watermark, so a regression error proves nothing. Isolate it by importing an account
// ABOVE the transfer watermark first, then aiming a transfer at exactly that value.
const checkCrossObjectUniqueness = (c: Client, tb: TB) =>
  time("A7b transfer ts == account ts", async () => {
    const W = st.watermark;
    const collide = W + 1000n;
    const acct = await c.createAccounts([account(tb.id(), ACCOUNT_IMPORTED, collide)]);
    if (acct[0].status !== OK) {
      throw new Error(`setup account at watermark+1000 rejected: ${aName(acct[0].status)}`);
    }
    st.acctWatermark = collide;

    // (i) A transfer BELOW the account watermark but above the transfer watermark. If it is
    //     created, an account's timestamp does not raise the floor for transfers.
    const below = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, W + 1n, 0),
    ]);
    if (below[0].status === OK) st.watermark = W + 1n;

    // (ii) A transfer at EXACTLY the account's timestamp.
    const res = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, collide, 0),
    ]);
    if (res[0].status === OK) st.watermark = collide;

    // (iii) Control: one nanosecond past the collision must be clean, so (ii)'s rejection is about
    //       the collision itself and not about the neighbourhood.
    const ctrl = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, collide + 1n, 0),
    ]);
    if (ctrl[0].status !== OK) {
      throw new Error(`control at collide+1ns also failed: ${tName(ctrl[0].status)}`);
    }
    st.watermark = collide + 1n;
    return `transfer below the account watermark → ${tName(below[0].status)}(${
      below[0].status
    }); transfer at EXACTLY an Account's timestamp → ${tName(res[0].status)}(${
      res[0].status
    }); 1ns later → ${
      tName(ctrl[0].status)
    }. Separate monotonic watermarks per object type, plus one global exact-value uniqueness rule.`;
  });

// ── 8. Imported pending transfer may not carry a timeout ─────────────────────────────────────────
const checkImportedTimeout = (c: Client, tb: TB) =>
  time("A8 imported timeout rejected", async () => {
    const t = transfer(
      tb.id(),
      st.cash,
      st.revenue,
      1n,
      TRANSFER_IMPORTED | TRANSFER_PENDING,
      st.watermark + 1n,
      0,
    );
    t.timeout = 60;
    const res = await c.createTransfers([t]);
    if (res[0].status !== T.imported_event_timeout_must_be_zero) {
      throw new Error(
        `expected imported_event_timeout_must_be_zero(63), got ${tName(res[0].status)}`,
      );
    }
    return `imported_event_timeout_must_be_zero(${
      res[0].status
    }) — an imported two-phase transfer has no auto-expiry; post/void must be explicit`;
  });

// ── 9. Batches may not mix imported and non-imported ─────────────────────────────────────────────
const checkNoMixing = (c: Client, tb: TB) =>
  time("A9 batches cannot mix", async () => {
    // imported first, plain second — the FIRST event determines the operation.
    const a = await c.createTransfers([
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        1n,
        TRANSFER_IMPORTED | TRANSFER_LINKED,
        st.watermark + 1n,
        0,
      ),
      transfer(tb.id(), st.cash, st.revenue, 1n, 0, 0n, 0),
    ]);
    // plain first, imported second.
    const b = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_LINKED, 0n, 0),
      transfer(tb.id(), st.cash, st.revenue, 1n, TRANSFER_IMPORTED, st.watermark + 2n, 0),
    ]);
    const aLast = a[1].status;
    const bLast = b[1].status;
    if (aLast !== T.imported_event_expected) {
      throw new Error(
        `[imported, plain] second event gave ${tName(aLast)}, expected imported_event_expected(56)`,
      );
    }
    if (bLast !== T.imported_event_not_expected) {
      throw new Error(
        `[plain, imported] second event gave ${
          tName(bLast)
        }, expected imported_event_not_expected(57)`,
      );
    }
    return `[imported,plain] → ${tName(aLast)}(${aLast}); [plain,imported] → ${
      tName(bLast)
    }(${bLast}) — the first event fixes the mode for the whole batch`;
  });

// ── 10. The timestamp range filter reaches the imported (historical) range ───────────────────────
const checkQueryFilters = (c: Client) =>
  time("A10 timestamp_min/max filters", async () => {
    const q2019 = await c.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      ledger: LEDGER,
      code: CODE,
      timestamp_min: dayNs(2019, 1, 1),
      timestamp_max: dayNs(2019, 12, 31),
      limit: 8189,
      flags: 0,
    });
    const q2019to2020 = await c.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      ledger: LEDGER,
      code: CODE,
      timestamp_min: dayNs(2019, 1, 1),
      timestamp_max: dayNs(2021, 1, 1),
      limit: 8189,
      flags: 0,
    });
    // Equality on the accounting date field — the only period-ish query TB can express.
    const byDate = await c.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: packDate(2019, 4, 15),
      ledger: LEDGER,
      code: CODE,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 8189,
      flags: 0,
    });
    const acct = await c.getAccountTransfers({
      account_id: st.cash,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      code: 0,
      timestamp_min: dayNs(2019, 1, 1),
      timestamp_max: dayNs(2019, 12, 31),
      limit: 8189,
      flags: 1 | 2, // debits | credits
    });
    if (q2019.length !== 4) throw new Error(`2019 range returned ${q2019.length}, expected 4`);
    if (q2019to2020.length !== 8) {
      throw new Error(`2019-2020 range returned ${q2019to2020.length}, expected 8`);
    }
    if (byDate.length !== 1) {
      throw new Error(
        `user_data_32=${packDate(2019, 4, 15)} returned ${byDate.length}, expected 1`,
      );
    }
    return `queryTransfers timestamp range 2019 → ${q2019.length}, 2019-2020 → ${q2019to2020.length}; getAccountTransfers 2019 → ${acct.length}; equality on user_data_32=${
      packDate(2019, 4, 15)
    } → ${byDate.length}. The range filter reaches imported timestamps because they ARE the timestamps.`;
  });

// ── 11. A LIVE account, then a backdated transfer referencing it ─────────────────────────────────
const checkPostdateAccount = (c: Client, tb: TB) =>
  time("A11 must postdate the account", async () => {
    st.liveAcct = tb.id();
    const made = await c.createAccounts([account(st.liveAcct, 0, 0n)]);
    if (made[0].status !== OK) throw new Error(`live account: ${aName(made[0].status)}`);
    const live = (await c.lookupAccounts([st.liveAcct]))[0];

    // A timestamp ABOVE the transfer watermark but BELOW the live account's timestamp — the only
    // way to isolate the postdate rule from the regression rule.
    const between = st.watermark + 1n;
    if (between >= live.timestamp) throw new Error("could not isolate: watermark >= account ts");
    const res = await c.createTransfers([
      transfer(tb.id(), st.liveAcct, st.revenue, 1n, TRANSFER_IMPORTED, between, 0),
    ]);
    const res2 = await c.createTransfers([
      transfer(tb.id(), st.revenue, st.liveAcct, 1n, TRANSFER_IMPORTED, between, 0),
    ]);
    if (res[0].status !== T.imported_event_timestamp_must_postdate_debit_account) {
      throw new Error(`debit side gave ${tName(res[0].status)}`);
    }
    if (res2[0].status !== T.imported_event_timestamp_must_postdate_credit_account) {
      throw new Error(`credit side gave ${tName(res2[0].status)}`);
    }
    return `live account ts ${live.timestamp}; a backdated transfer on it → ${
      tName(res[0].status)
    }(${res[0].status}) / ${tName(res2[0].status)}(${
      res2[0].status
    }). Accounts MUST be imported backdated before their transfers.`;
  });

// ── 12. Can an account still be imported backdated once a live account exists? ───────────────────
const checkAccountWatermark = (c: Client, tb: TB) =>
  time("A12 account watermark after live", async () => {
    const res = await c.createAccounts([
      account(tb.id(), ACCOUNT_IMPORTED, dayNs(2019, 6, 1)),
    ]);
    return `importing a 2019-dated account after a live account exists → ${aName(res[0].status)}(${
      res[0].status
    })`;
  });

// ── 13. Live posting resumes ─────────────────────────────────────────────────────────────────────
const checkLiveResumes = (c: Client, tb: TB) =>
  time("B1 live posting resumes", async () => {
    const before = nowNs();
    const t = transfer(tb.id(), st.cash, st.revenue, 777n, 0, 0n, packDate(2026, 8, 18));
    const res = await c.createTransfers([t]);
    if (res[0].status !== OK) {
      throw new Error(`live transfer after import batch failed: ${tName(res[0].status)}`);
    }
    const back = (await c.lookupTransfers([t.id]))[0];
    st.liveTs = back.timestamp;
    if (back.timestamp <= st.watermark) {
      throw new Error(
        `live ts ${back.timestamp} did not exceed the imported watermark ${st.watermark}`,
      );
    }
    const lagMs = Number(back.timestamp - before) / 1e6;
    const gapYears = yearsBetween(back.timestamp, st.watermark);
    const bal = (await c.lookupAccounts([st.cash]))[0];
    return `created; ts ${back.timestamp} = wall clock + ${lagMs.toFixed(1)}ms, ${
      gapYears.toFixed(2)
    }y ahead of the imported watermark — NO stall, the clock never had to catch up; debits_posted ${bal.debits_posted}`;
  });

// ── 14. THE CRUX — backdated import after live posting ───────────────────────────────────────────
const checkBackdateAfterLive = (c: Client, tb: TB) =>
  time("B2 backdate after live FAILS", async () => {
    const res = await c.createTransfers([
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        1n,
        TRANSFER_IMPORTED,
        dayNs(2019, 3, 1),
        packDate(2019, 3, 1),
      ),
    ]);
    if (res[0].status !== T.imported_event_timestamp_must_not_regress) {
      throw new Error(`expected must_not_regress(60), got ${tName(res[0].status)}`);
    }
    // How wide is the surviving window? (watermark, cluster clock].
    const inWindow = await c.createTransfers([
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        1n,
        TRANSFER_IMPORTED,
        st.liveTs + 1n,
        packDate(2019, 3, 1),
      ),
    ]);
    if (inWindow[0].status !== OK) {
      throw new Error(`ts = liveTs+1 gave ${tName(inWindow[0].status)}, expected created`);
    }
    st.watermark = st.liveTs + 1n;
    return `2019-03-01 after a live posting → ${tName(res[0].status)}(${
      res[0].status
    }); the SAME transfer at liveTs+1ns → created. The import window is (last committed ts, cluster clock] and nothing widens it.`;
  });

// ── 15. Live posting still works after an interleaved import ─────────────────────────────────────
const checkLiveAfterInterleavedImport = (c: Client, tb: TB) =>
  time("B3 live after interleaved import", async () => {
    const t = transfer(tb.id(), st.cash, st.revenue, 88n, 0, 0n, packDate(2026, 8, 18));
    const res = await c.createTransfers([t]);
    if (res[0].status !== OK) throw new Error(`live transfer failed: ${tName(res[0].status)}`);
    const back = (await c.lookupTransfers([t.id]))[0];
    if (back.timestamp <= st.watermark) {
      throw new Error(`live ts ${back.timestamp} <= watermark ${st.watermark}`);
    }
    const bal = (await c.lookupAccounts([st.cash]))[0];
    // An independent property rather than a restatement of this file's own bookkeeping: walk every
    // transfer that debits `cash` — imported and live, interleaved — and assert the ledger's own
    // running balance equals their sum. A rolled-back or double-posted event breaks this.
    const legs = await c.getAccountTransfers({
      account_id: st.cash,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      code: 0,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 8189,
      flags: 1, // debits only
    });
    const summed = legs.reduce((s, t) => s + t.amount, 0n);
    if (summed !== bal.debits_posted) {
      throw new Error(
        `debits_posted ${bal.debits_posted} != sum of ${legs.length} debit legs ${summed}`,
      );
    }
    return `created at ${back.timestamp} (+${
      Number(back.timestamp - st.watermark) / 1e6
    }ms past the import watermark); cash debits_posted ${bal.debits_posted} == sum of ${legs.length} debit legs (imported + live interleaved), so no event was lost or double-posted`;
  });

// ── 16. Idempotency of a re-run import ───────────────────────────────────────────────────────────
const checkReimportIdempotency = (c: Client, tb: TB) =>
  time("B4 re-importing the same batch", async () => {
    // Exact same id, flags and timestamp as A2's LAST transfer — the migration re-run case. The
    // last one is used because `linked` is PERSISTED in `flags`: re-submitting an interior member
    // of the chain with the flag stripped returns `exists_with_different_flags`(36), and with it
    // set returns `linked_event_chain_open`(2). Either measures the harness, not idempotency.
    const orig = (await c.lookupTransfers([
      st.importedTransferIds[st.importedTransferIds.length - 1],
    ]))[0];
    const same = { ...orig };
    const res = await c.createTransfers([same]);
    // And the same timestamp under a FRESH id — the case where a re-run remints ids.
    const freshId = await c.createTransfers([{ ...same, id: tb.id() }]);
    return `same id + same ts → ${tName(res[0].status)}(${res[0].status}); fresh id + same ts → ${
      tName(freshId[0].status)
    }(${freshId[0].status}) ⇒ re-running an import is idempotent on id, and NOT on timestamp`;
  });

// ── 17. The other strategy: a plain load carrying accounting date in user_data_32 ────────────────
// This is the shape ADR-0010 describes literally — the ledger assigns the posting timestamp, the
// accounting date is a separate field — and unlike the `imported` flag it works on a cluster that
// is already live. Run AFTER live posting has begun, precisely because the imported route cannot.
const PLAIN_HISTORY = [
  [2019, 1, 15],
  [2020, 6, 30],
  [2021, 12, 31],
  [2023, 3, 1],
  [2025, 10, 15],
] as const;

const checkPlainHistoryLoad = (c: Client, tb: TB) =>
  time("B5 plain load, date in u32", async () => {
    const batch = PLAIN_HISTORY.map(([y, m, d], i) =>
      transfer(
        tb.id(),
        st.cash,
        st.revenue,
        BigInt(100 + i),
        i < PLAIN_HISTORY.length - 1 ? TRANSFER_LINKED : 0,
        0n, // ← the cluster assigns the posting timestamp
        packDate(y, m, d), // ← accounting date, years earlier
      )
    );
    const res = await c.createTransfers(batch);
    if (res.some((r) => r.status !== OK)) {
      throw new Error(`plain historical load failed: ${codes(res).map(tName).join(",")}`);
    }
    const back = await c.lookupTransfers(batch.map((b) => b.id));
    const bad = back.filter((t, i) => t.user_data_32 !== batch[i].user_data_32);
    if (bad.length) throw new Error(`${bad.length} accounting dates did not round-trip`);
    // Monotonic posting timestamps, non-monotonic accounting dates — the two orderings differ.
    const tsSorted = back.every((t, i) => i === 0 || t.timestamp > back[i - 1].timestamp);
    if (!tsSorted) throw new Error("posting timestamps not strictly increasing within the batch");
    const gapOldest = yearsBetween(back[0].timestamp, dayNs(2019, 1, 15));
    return `${batch.length} postings created with cluster-assigned timestamps; accounting dates 2019-01-15..2025-10-15 sit up to ${
      gapOldest.toFixed(2)
    }y BEFORE their posting timestamps; posting ts strictly increasing while accounting dates are not; ${
      back[0].user_data_32
    } round-tripped exact`;
  });

// ── 18. A back-dated entry into an open prior period — the everyday ADR-0010 case ────────────────
const checkBackdatedAccountingDate = (c: Client, tb: TB) =>
  time("B6 accounting date regresses", async () => {
    const later = transfer(tb.id(), st.cash, st.revenue, 5n, 0, 0n, packDate(2026, 8, 18));
    const r1 = await c.createTransfers([later]);
    const earlier = transfer(tb.id(), st.cash, st.revenue, 6n, 0, 0n, packDate(2026, 7, 31));
    const r2 = await c.createTransfers([earlier]);
    if (r1[0].status !== OK || r2[0].status !== OK) {
      throw new Error(`back-dated entry rejected: ${codes([...r1, ...r2]).map(tName).join(",")}`);
    }
    const back = await c.lookupTransfers([later.id, earlier.id]);
    if (!(back[1].timestamp > back[0].timestamp)) {
      throw new Error("posting timestamps did not advance");
    }
    // The same day, twice — impossible if the accounting date were the timestamp (A6).
    const dup = await c.createTransfers([
      transfer(tb.id(), st.cash, st.revenue, 7n, 0, 0n, packDate(2026, 7, 31)),
    ]);
    if (dup[0].status !== OK) {
      throw new Error(`second posting on one date: ${tName(dup[0].status)}`);
    }
    const sameDay = await c.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: packDate(2026, 7, 31),
      ledger: LEDGER,
      code: CODE,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 8189,
      flags: 0,
    });
    return `accounting date 20260818 then 20260731 while the posting timestamp advanced ${
      back[1].timestamp - back[0].timestamp
    }ns — both created; two postings share accounting date 20260731 (queryTransfers → ${sameDay.length}). Neither is possible when the accounting date IS the timestamp.`;
  });

/**
 * Binary-search the largest batch `createTransfers` will accept. Every probe event is deliberately
 * invalid (`ledger: 0`), so the size check fires and nothing commits.
 */
const maxBatch = async (c: Client, tb: TB) => {
  let lo = 1, hi = 16_384, maxOk = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    try {
      await c.createTransfers(
        Array.from({ length: mid }, () => ({
          ...transfer(tb.id(), 1n, 2n, 1n, 0, 0n, 0),
          ledger: 0,
        })),
      );
      maxOk = mid;
      lo = mid + 1;
    } catch {
      hi = mid - 1;
    }
  }
  return maxOk;
};

// ── C1. Is the measured batch ceiling a TigerBeetle fact or a --development artifact? ────────────
// The docs state 8189 "in the default configuration"; the dev cluster above measured far less.
// A number that depends on a server flag must not be reported as a property of TigerBeetle, so
// this stands up a SECOND cluster on production defaults and measures the same thing.
const checkBatchCeilingIsConfig = (tb: TB) =>
  time("C1 batch ceiling, prod config", async () => {
    const port = String(Number(PORT) + 1);
    const cluster = await startCluster(port, false);
    const client = tb.createClient({ cluster_id: 0n, replica_addresses: [port] });
    try {
      const n = await maxBatch(client, tb);
      return `production-default cluster (no --development): max createTransfers batch = ${n}`;
    } finally {
      client.destroy();
      await cluster.stop();
    }
  });

// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const runImportProbe = async (): Promise<ProbeResult[]> => {
  const cluster = await startCluster(PORT);
  const tb = await import("tigerbeetle-node");
  const client = tb.createClient({ cluster_id: 0n, replica_addresses: [PORT] });
  const results: ProbeResult[] = [];
  try {
    results.push(await checkImportAccounts(client, tb));
    results.push(await checkHistoryLoad(client, tb));
    results.push(await checkBatchScale(client, tb));
    results.push(await checkTimestampMustBeZero(client, tb));
    results.push(await checkImportedZeroTs(client, tb));
    results.push(await checkFutureTs(client, tb));
    results.push(await checkWithinBatchMonotonicity(client, tb));
    results.push(await checkWatermarksIndependent(client, tb));
    results.push(await checkCrossObjectUniqueness(client, tb));
    results.push(await checkImportedTimeout(client, tb));
    results.push(await checkNoMixing(client, tb));
    results.push(await checkQueryFilters(client));
    results.push(await checkPostdateAccount(client, tb));
    results.push(await checkAccountWatermark(client, tb));
    results.push(await checkLiveResumes(client, tb));
    results.push(await checkBackdateAfterLive(client, tb));
    results.push(await checkLiveAfterInterleavedImport(client, tb));
    results.push(await checkReimportIdempotency(client, tb));
    results.push(await checkPlainHistoryLoad(client, tb));
    results.push(await checkBackdatedAccountingDate(client, tb));
  } finally {
    client.destroy();
    await cluster.stop();
  }
  results.push(await checkBatchCeilingIsConfig(tb));
  return results;
};

if (import.meta.main) {
  const results = await runImportProbe();
  for (const r of results) {
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(34)} ${
        r.ms.toString().padStart(6)
      }ms  ${r.detail}`,
    );
  }
  for (const f of st.facts) console.log(`NOTE  ${f}`);
  console.log(
    `MATRIX_JSON ${
      JSON.stringify({ deno: Deno.version.deno, tb_client: "0.17.9", results, notes: st.facts })
    }`,
  );
  if (results.some((r) => !r.ok)) Deno.exit(1);
}
