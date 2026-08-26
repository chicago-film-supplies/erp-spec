/**
 * SPIKE-002 criterion 2 — the two-store commit protocol, as executable code.
 *
 * ONE definition of the protocol, shared by the writer subprocess and the recovery sweeper, because
 * two copies of a commit protocol is how a harness proves that its own two halves agree rather than
 * that the protocol is safe.
 *
 * The protocol is `ADR-0042` / `formal/two-store-commit.qnt`'s `intent_first` module:
 *
 *   0. writeIntent   MongoDB   ← BEFORE the reserve, or the orphan is undiscoverable
 *   1. reserve       TigerBeetle pending transfer, `timeout: 0` (ADR-0042/D1)
 *   2. writeDoc      MongoDB
 *   3. post          TigerBeetle post_pending_transfer
 *   4. clearIntent   MongoDB   ← only once the transfer has settled
 *
 * Recovery enumerates open intents, READS MONGO, and posts or voids accordingly. It never decides
 * from the ledger alone — that is `naive_sweeper`, which the model proves unsafe.
 */
import { MongoClient } from "mongodb";

export const TB_PORT = Deno.env.get("TB2SC_PORT") ?? "3044";
export const MONGO_URL = Deno.env.get("MONGO2SC_URL") ?? "mongodb://127.0.0.1:27078";
export const LEDGER = 1, CODE = 1;

export const F_PENDING = 2, F_POST = 4, F_VOID = 8;
/** From `tigerbeetle-node`'s own `CreateTransferStatus`. Spelled out so the assertions read as the API. */
export const OK = 0xffffffff;
export const ALREADY_POSTED = 33, ALREADY_VOIDED = 34, EXPIRED = 35;

/** The intent record, exactly as `writeIntent` writes it. */
export type Intent = {
  _id: string;
  transfer_id: string;
  state: "open" | "cleared";
  opened_at: Date;
};

/** The document whose durability the two-store commit is protecting. */
export type Doc = { _id: string; committed: boolean };

export async function tb() {
  const lib = await import("tigerbeetle-node");
  return { lib, client: lib.createClient({ cluster_id: 0n, replica_addresses: [TB_PORT] }) };
}
export async function mongo() {
  const c = new MongoClient(MONGO_URL);
  await c.connect();
  const db = c.db("two_store_commit");
  // ⚠️ These generics are load-bearing under `mongodb@7`. Both collections key on the opId — a
  // STRING ("op-6"), not an ObjectId — and driver 7 tightened `Filter<TSchema>._id` to
  // `InferIdType<TSchema>`, which defaults to `ObjectId` on an untyped `Document`. Without them,
  // every `findOne({ _id: opId })` is a type error; driver 6 accepted the string silently.
  // The shapes are the ones `writeIntent` / `writeDoc` below actually insert — state that once
  // here rather than casting at each read, so a field rename is a compile error and not a `null`.
  return {
    c,
    intents: db.collection<Intent>("intents"),
    docs: db.collection<Doc>("docs"),
  };
}

const blankTransfer = (id: bigint, debit: bigint, credit: bigint, amount: bigint) => ({
  id,
  debit_account_id: debit,
  credit_account_id: credit,
  amount,
  pending_id: 0n,
  user_data_128: 0n,
  user_data_64: 0n,
  user_data_32: 0,
  timeout: 0, // ⚠️ ADR-0042/D1 — TigerBeetle expires NOTHING. Case 5 asserts this never fires.
  ledger: LEDGER,
  code: CODE,
  flags: 0,
  timestamp: 0n,
});

const blankAccount = (id: bigint) => ({
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
  flags: 0,
  timestamp: 0n,
});

// deno-lint-ignore no-explicit-any
export async function ensureAccounts(client: any, a: bigint, b: bigint) {
  const res = await client.createAccounts([blankAccount(a), blankAccount(b)]);
  // `exists` is fine — the harness re-runs against the same cluster.
  const fatal = res.filter((r: { status: number }) => r.status !== OK && r.status !== 21);
  if (fatal.length) throw new Error(`createAccounts: ${JSON.stringify(fatal)}`);
}

// ── the five steps ──────────────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export const writeIntent = (intents: any, opId: string, transferId: bigint) =>
  intents.insertOne({
    _id: opId,
    transfer_id: transferId.toString(),
    state: "open",
    opened_at: new Date(0), // fixed — the harness never races a real clock
  });

// deno-lint-ignore no-explicit-any
export async function reserve(client: any, transferId: bigint, a: bigint, b: bigint, amt: bigint) {
  const t = { ...blankTransfer(transferId, a, b, amt), flags: F_PENDING };
  const [r] = await client.createTransfers([t]);
  return r.status as number;
}

// deno-lint-ignore no-explicit-any
export const writeDoc = (docs: any, opId: string) =>
  docs.insertOne({ _id: opId, committed: false });

// deno-lint-ignore no-explicit-any
export async function post(client: any, newId: bigint, pendingId: bigint, a: bigint, b: bigint) {
  const t = { ...blankTransfer(newId, a, b, 0n), pending_id: pendingId, flags: F_POST };
  const [r] = await client.createTransfers([t]);
  return r.status as number;
}

// deno-lint-ignore no-explicit-any
export async function voidPending(
  client: any,
  newId: bigint,
  pendingId: bigint,
  a: bigint,
  b: bigint,
) {
  const t = { ...blankTransfer(newId, a, b, 0n), pending_id: pendingId, flags: F_VOID };
  const [r] = await client.createTransfers([t]);
  return r.status as number;
}

// deno-lint-ignore no-explicit-any
export const clearIntent = (intents: any, opId: string) =>
  intents.updateOne({ _id: opId }, { $set: { state: "cleared" } });

// ── recovery ────────────────────────────────────────────────────────────────────────────────────

export interface RecoveryOutcome {
  opId: string;
  action: "posted" | "voided" | "cleared_no_transfer" | "already_settled";
  status?: number;
}

/**
 * The sweeper. Enumerates OPEN INTENTS — never TigerBeetle, which cannot answer "which pending
 * transfers are outstanding" (`QueryFilter` has no predicate for `flags.pending` or `pending_id`).
 * For each, it READS MONGO and then acts.
 */
// deno-lint-ignore no-explicit-any
export async function recover(
  client: any,
  lib: any,
  intents: any,
  docs: any,
  a: bigint,
  b: bigint,
) {
  const out: RecoveryOutcome[] = [];
  for await (const it of intents.find({ state: "open" })) {
    const opId = it._id as string;
    const pendingId = BigInt(it.transfer_id as string);
    const [existing] = await client.lookupTransfers([pendingId]);
    if (!existing) {
      // Crashed between writeIntent and reserve. Nothing was reserved, so nothing to compensate.
      await clearIntent(intents, opId);
      out.push({ opId, action: "cleared_no_transfer" });
      continue;
    }
    const doc = await docs.findOne({ _id: opId });
    const status = doc
      ? await post(client, lib.id(), pendingId, a, b)
      : await voidPending(client, lib.id(), pendingId, a, b);
    if (status === OK) {
      await clearIntent(intents, opId);
      out.push({ opId, action: doc ? "posted" : "voided", status });
    } else {
      // Already resolved by the writer before it died — clear and record WHY, never swallow it.
      await clearIntent(intents, opId);
      out.push({ opId, action: "already_settled", status });
    }
  }
  return out;
}
