/**
 * SPIKE-001 — the TigerBeetle client against a real single-replica cluster, from Deno.
 *
 * `napi-probe.ts` already answered "does the addon load". This answers the question that matters:
 * does the client stay CORRECT across the N-API boundary under load-bearing operations. Every
 * check here is one a partially-working bridge would break while still returning successfully.
 *
 * Start the cluster first — see _README.md. Then:
 *   deno task tb
 *
 * Values are cents (asset scale 2), per the workspace money rule. IDs come from `id()`, which is
 * time-based and lexicographically sortable — TigerBeetle explicitly warns against random ids
 * because they hurt LSM write throughput, so the probe uses the same scheme production would.
 */
import { type ProbeResult, time } from "./probe-util.ts";

const PORT = Deno.env.get("TB_PORT") ?? "3033";
const LEDGER = 1; // USD, asset scale 2 → 1 unit = 1 cent
const CODE = 1;

// Flag values from tigerbeetle-node's bindings. Spelled out rather than imported so this file
// reads as the protocol it is exercising.
const ACCOUNT_LINKED = 1;
const ACCOUNT_DEBITS_MUST_NOT_EXCEED_CREDITS = 2;
const TRANSFER_LINKED = 1;
const TRANSFER_PENDING = 2;
const TRANSFER_POST_PENDING = 4;
const TRANSFER_VOID_PENDING = 8;

/**
 * `created` is **0xFFFFFFFF, not 0** — for both accounts and transfers. Zero is not a member of
 * either status enum. The obvious `status === 0` success check is therefore never true, and the
 * equally obvious `status !== 0` failure check treats every success as a failure. Worth naming:
 * this probe hit it on its first run and read `[4294967295, 4294967295]` as a hard error.
 */
const STATUS_OK = 4294967295;
const STATUS_LINKED_EVENT_FAILED = 1;
const STATUS_ACCOUNTS_MUST_BE_DIFFERENT = 12;
const STATUS_EXCEEDS_CREDITS = 54;

type Client = Awaited<ReturnType<typeof connect>>;

const connect = async () => {
  const tb = await import("tigerbeetle-node");
  return {
    tb,
    // ONE shared client for the whole process — TigerBeetle auto-batches behind it and explicitly
    // warns against a client per request. That shared object is also the thing a self-extracting
    // compiled binary is most likely to construct incorrectly, so the probe reuses it throughout
    // rather than reconnecting per check.
    client: tb.createClient({ cluster_id: 0n, replica_addresses: [PORT] }),
  };
};

const blankAccount = (id: bigint, flags: number) => ({
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
  timestamp: 0n,
});

const blankTransfer = (id: bigint, debit: bigint, credit: bigint, amount: bigint) => ({
  id,
  debit_account_id: debit,
  credit_account_id: credit,
  amount,
  pending_id: 0n,
  user_data_128: 0n,
  user_data_64: 0n,
  user_data_32: 0,
  timeout: 0,
  ledger: LEDGER,
  code: CODE,
  flags: 0,
  timestamp: 0n,
});

const statuses = (rs: { status: number }[]) => rs.map((r) => r.status);

/**
 * 1. Accounts, and u128 in both directions.
 *
 * ADR-0008 reserves `user_data_128` for the journal entry id — a high-cardinality 128-bit
 * reference. If the bridge truncates it to u64 the write still succeeds and the read still
 * returns a number; only an exact comparison against a value ABOVE 2^64 catches it. Same for
 * `amount`: a $1M line in cents is nowhere near the boundary, but the field is u128 and the
 * marshalling must be exact at the top of its range or nothing else here can be trusted.
 */
const checkAccountsAndU128 = ({ client }: Client, debit: bigint, credit: bigint) =>
  time("accounts + u128 round-trip", async () => {
    const created = await client.createAccounts([
      blankAccount(debit, 0),
      blankAccount(credit, 0),
    ]);
    const bad = created.filter((r) => r.status !== STATUS_OK);
    if (bad.length) throw new Error(`createAccounts returned ${JSON.stringify(statuses(created))}`);

    // A value that needs all 128 bits: high 64 set AND low 64 set, so neither half can be dropped
    // without changing it.
    const JOURNAL_ENTRY_ID = (1n << 127n) | (1n << 64n) | 0xdeadbeefcafef00dn;
    const AMOUNT = (1n << 70n) + 7n;

    const t = blankTransfer(client_id(), debit, credit, AMOUNT);
    t.user_data_128 = JOURNAL_ENTRY_ID;
    t.user_data_64 = (1n << 63n) | 12345n;
    t.user_data_32 = 4294967295; // u32 max — a signed-int bridge would hand back -1
    const res = await client.createTransfers([t]);
    if (res[0].status !== STATUS_OK) {
      throw new Error(`u128 transfer rejected: status ${res[0].status}`);
    }

    const [back] = await client.lookupTransfers([t.id]);
    if (!back) throw new Error("lookupTransfers returned nothing for a transfer just created");
    const mismatches: string[] = [];
    if (back.user_data_128 !== JOURNAL_ENTRY_ID) {
      mismatches.push(`user_data_128 ${back.user_data_128} !== ${JOURNAL_ENTRY_ID}`);
    }
    if (back.user_data_64 !== t.user_data_64) mismatches.push(`user_data_64 ${back.user_data_64}`);
    if (back.user_data_32 !== t.user_data_32) mismatches.push(`user_data_32 ${back.user_data_32}`);
    if (back.amount !== AMOUNT) mismatches.push(`amount ${back.amount} !== ${AMOUNT}`);
    if (back.id !== t.id) mismatches.push(`id ${back.id} !== ${t.id}`);
    if (mismatches.length) {
      throw new Error(`u128/u64/u32 round-trip lost data: ${mismatches.join("; ")}`);
    }

    if (typeof back.timestamp !== "bigint" || back.timestamp === 0n) {
      throw new Error(`server-assigned timestamp did not come back as a bigint: ${back.timestamp}`);
    }
    return `user_data_128 exact at 2^127|2^64|…, amount ${AMOUNT} exact, u32 max intact, ts ${back.timestamp}`;
  });

/**
 * 2. A linked batch, asserted by its ROLLBACK.
 *
 * "The batch returned ok" proves nothing about linking. The property that distinguishes a real
 * linked chain from N independent transfers is that a failure anywhere fails everything — so this
 * deliberately terminates the chain with an invalid transfer and asserts the VALID one was undone.
 * A bridge that dropped the linked flag would show `ok` for the first and leave the money moved.
 */
const checkLinkedRollback = ({ client }: Client, debit: bigint, credit: bigint) =>
  time("linked batch rolls back", async () => {
    const before = (await client.lookupAccounts([debit]))[0];

    const good = blankTransfer(client_id(), debit, credit, 500n);
    good.flags = TRANSFER_LINKED; // chained to the next event
    const doomed = blankTransfer(client_id(), debit, debit, 700n); // same account both sides — invalid
    // no linked flag: `doomed` terminates the chain

    const res = await client.createTransfers([good, doomed]);
    const got = statuses(res);
    if (got[0] !== STATUS_LINKED_EVENT_FAILED || got[1] !== STATUS_ACCOUNTS_MUST_BE_DIFFERENT) {
      throw new Error(
        `expected [linked_event_failed, accounts_must_be_different], got ${JSON.stringify(got)}`,
      );
    }
    const after = (await client.lookupAccounts([debit]))[0];
    if (after.debits_posted !== before.debits_posted) {
      throw new Error(
        `chain did NOT roll back: debits_posted ${before.debits_posted} → ${after.debits_posted}`,
      );
    }
    // And the linked transfer must not be findable at all.
    const orphan = await client.lookupTransfers([good.id]);
    if (orphan.length !== 0) {
      throw new Error(`rolled-back transfer is still readable: ${orphan[0].id}`);
    }
    return `[${got.join(",")}], debits_posted held at ${after.debits_posted}, no orphan row`;
  });

/**
 * 3. Two-phase transfers, both terminations.
 *
 * This is what the two-store commit protocol runs on (ADR-0003 / SPIKE-002): TB pending → Mongo
 * write → TB post, or void if the Mongo write failed. Both arms have to work, and the pending
 * balance has to actually move and actually clear — an implementation that posted immediately
 * would look identical on the posted balance alone.
 */
const checkTwoPhase = ({ client }: Client, debit: bigint, credit: bigint) =>
  time("two-phase post + void", async () => {
    const base = (await client.lookupAccounts([debit]))[0];

    const pendPost = blankTransfer(client_id(), debit, credit, 1_200n);
    pendPost.flags = TRANSFER_PENDING;
    const pendVoid = blankTransfer(client_id(), debit, credit, 3_400n);
    pendVoid.flags = TRANSFER_PENDING;
    const created = await client.createTransfers([pendPost, pendVoid]);
    if (created.some((r) => r.status !== STATUS_OK)) {
      throw new Error(`pending creates failed: ${JSON.stringify(statuses(created))}`);
    }

    const held = (await client.lookupAccounts([debit]))[0];
    const expectedPending = base.debits_pending + 1_200n + 3_400n;
    if (held.debits_pending !== expectedPending) {
      throw new Error(`debits_pending ${held.debits_pending}, expected ${expectedPending}`);
    }
    if (held.debits_posted !== base.debits_posted) {
      throw new Error(`pending transfer moved debits_posted — it must not`);
    }

    const post = blankTransfer(client_id(), debit, credit, 1_200n);
    post.flags = TRANSFER_POST_PENDING;
    post.pending_id = pendPost.id;
    const voided = blankTransfer(client_id(), debit, credit, 0n);
    voided.flags = TRANSFER_VOID_PENDING;
    voided.pending_id = pendVoid.id;
    const settled = await client.createTransfers([post, voided]);
    if (settled.some((r) => r.status !== STATUS_OK)) {
      throw new Error(`post/void failed: ${JSON.stringify(statuses(settled))}`);
    }

    const done = (await client.lookupAccounts([debit]))[0];
    if (done.debits_pending !== base.debits_pending) {
      throw new Error(`debits_pending did not clear: ${done.debits_pending}`);
    }
    if (done.debits_posted !== base.debits_posted + 1_200n) {
      throw new Error(
        `debits_posted ${done.debits_posted}, expected ${
          base.debits_posted + 1_200n
        } — the voided 3400 must not land`,
      );
    }
    return `pending ${expectedPending} held then cleared, posted +1200, voided 3400 discarded`;
  });

/**
 * 4. The shared client under concurrency — i.e. auto-batching.
 *
 * TigerBeetle batches events behind one client; the documented ceiling is ~8189 events per batch.
 * Fire many independent createTransfers concurrently through the SAME client object and assert
 * every one lands exactly once. This is the check most likely to expose a compiled binary whose
 * shared client was constructed wrong, and it is also the one that would catch double-posting.
 */
const checkAutoBatching = ({ client }: Client, debit: bigint, credit: bigint) =>
  time("shared client auto-batching", async () => {
    const before = (await client.lookupAccounts([credit]))[0];
    const N = 400;
    const transfers = Array.from(
      { length: N },
      () => blankTransfer(client_id(), debit, credit, 11n),
    );
    const t0 = performance.now();
    // 40 concurrent calls of 10 transfers each, all through the one client.
    const chunks: (typeof transfers)[] = [];
    for (let i = 0; i < N; i += 10) chunks.push(transfers.slice(i, i + 10));
    const results = await Promise.all(chunks.map((c) => client.createTransfers(c)));
    const ms = Math.round(performance.now() - t0);

    const flat = results.flat();
    const failed = flat.filter((r) => r.status !== STATUS_OK);
    if (failed.length) throw new Error(`${failed.length}/${N} transfers failed`);

    const after = (await client.lookupAccounts([credit]))[0];
    const moved = after.credits_posted - before.credits_posted;
    if (moved !== BigInt(N) * 11n) {
      throw new Error(
        `credits_posted moved ${moved}, expected ${BigInt(N) * 11n} — double-post or loss`,
      );
    }
    return `${N} transfers via 40 concurrent calls on one client in ${ms}ms, credits +${moved} exactly`;
  });

/**
 * 5. Account flags cross the boundary AS FLAGS, and the constraint bites.
 *
 * `flags` is a u16 bitfield sent as a JS number. Everything else here would still pass if it
 * arrived as zero — the accounts would just be unconstrained. So create an account with
 * `debits_must_not_exceed_credits` and assert an unfunded debit is REJECTED. This is the
 * fail-closed companion to the checks above: a property that holds independently of whether the
 * happy path works.
 *
 * (The probe's own first run failed here by accident — this flag was set on the main debit
 * account, so every transfer in every other check came back `exceeds_credits`. That is the
 * constraint working; it was the test that was wrong.)
 */
const checkFlagsBite = ({ client }: Client, credit: bigint) =>
  time("account flags bite", async () => {
    const constrained = client_id();
    const made = await client.createAccounts([
      blankAccount(constrained, ACCOUNT_DEBITS_MUST_NOT_EXCEED_CREDITS),
    ]);
    if (made[0].status !== STATUS_OK) {
      throw new Error(`constrained account not created: ${made[0].status}`);
    }

    const overdraw = blankTransfer(client_id(), constrained, credit, 100n);
    const res = await client.createTransfers([overdraw]);
    if (res[0].status !== STATUS_EXCEEDS_CREDITS) {
      throw new Error(
        `expected exceeds_credits (${STATUS_EXCEEDS_CREDITS}) on an unfunded constrained account, got ${
          res[0].status
        } — the flag did not cross as a flag`,
      );
    }
    const acct = (await client.lookupAccounts([constrained]))[0];
    if (acct.flags !== ACCOUNT_DEBITS_MUST_NOT_EXCEED_CREDITS) {
      throw new Error(
        `flags read back as ${acct.flags}, expected ${ACCOUNT_DEBITS_MUST_NOT_EXCEED_CREDITS}`,
      );
    }
    if (acct.debits_posted !== 0n) throw new Error(`rejected debit still moved the balance`);
    return `debits_must_not_exceed_credits rejected an unfunded debit (status ${
      res[0].status
    }), flags read back intact`;
  });

/** 6. `amount_max` — a module-level bigint constant crossing the boundary at construction time. */
const checkAmountMax = ({ tb }: Client) =>
  time("amount_max sentinel", async () => {
    await Promise.resolve();
    const m = tb.amount_max;
    if (typeof m !== "bigint") throw new Error(`amount_max is ${typeof m}`);
    if (m !== (1n << 128n) - 1n) throw new Error(`amount_max is ${m}, expected 2^128-1`);
    return `2^128-1 exact`;
  });

let idFn: () => bigint;
const client_id = () => idFn();

export const runTbProbe = async (): Promise<ProbeResult[]> => {
  const c = await connect();
  idFn = c.tb.id;

  const debit = c.tb.id();
  const credit = c.tb.id();

  const results: ProbeResult[] = [];
  results.push(await checkAccountsAndU128(c, debit, credit));
  results.push(await checkLinkedRollback(c, debit, credit));
  results.push(await checkTwoPhase(c, debit, credit));
  results.push(await checkAutoBatching(c, debit, credit));
  results.push(await checkFlagsBite(c, credit));
  results.push(await checkAmountMax(c));
  c.client.destroy();
  return results;
};

if (import.meta.main) {
  const results = await runTbProbe();
  for (const r of results) {
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(30)} ${
        r.ms.toString().padStart(6)
      }ms  ${r.detail}`,
    );
  }
  console.log(
    `MATRIX_JSON ${JSON.stringify({ deno: Deno.version.deno, tb_client: "0.17.9", results })}`,
  );
  if (results.some((r) => !r.ok)) Deno.exit(1);
}
