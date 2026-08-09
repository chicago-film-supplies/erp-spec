# TigerBeetle

The ledger store ([[ADR-0003]]): double-entry enforced *in the database*, not in application code.
Everything balance-bearing lives here; nested business documents do not (that is Mongo).

## Canonical docs

- Site: <https://docs.tigerbeetle.com/>
- **Single-page dump** (best single source to feed an LLM): <https://docs.tigerbeetle.com/single-page/>
- Doc source (markdown, versioned): <https://github.com/tigerbeetle/tigerbeetle/tree/main/docs>
- Node client: `tigerbeetle-node` — <https://www.npmjs.com/package/tigerbeetle-node>
- No `llms.txt` published as of 2026-08-09; the single-page dump is the substitute.

## Version (checked 2026-08-09)

- Cluster `0.16.x` (latest ~`0.16.57`). Releases are frequent (often several/week).
- **Client version must match the cluster version.** TB pins client↔server; a mismatched
  `tigerbeetle-node` will refuse to talk to the cluster. Pin both together and bump in lockstep.

## CFS-specific gotchas

- **Amounts are unsigned 128-bit integers.** In TS they are `BigInt` (`12345n`). This lines up
  exactly with the repo's money rule (integer minor units everywhere — CLAUDE.md §7). USD → asset
  scale 2 → cents → `1` unit = 1 cent.
- **Asset scale is effectively immutable.** You cannot change the scale of an existing account;
  a scale change means a new ledger + migration. Decide cents up front and never revisit.
- **Accounts and transfers are immutable; `id` is the idempotency key.** Use TB's recommended
  time-based, lexicographically-sortable 128-bit ids (48-bit ms timestamp + 80-bit random). Do
  **not** use random ids — they hurt LSM write throughput.
- **No queries, no joins, no ad-hoc aggregation.** Balances are per-account only. This is *why*
  [[ADR-0008]] explodes dimensions into account identity, and *why* DuckDB is the read side
  ([[ADR-0006]]). Do not plan to "just group transfers by dimension" — that is not a thing TB does.
- **Account `flags` set balance direction/constraints:** `debits_must_not_exceed_credits` /
  `credits_must_not_exceed_debits`. Choose per the COA normal balance for that account.
- **`user_data_128/64/32` are the only per-transfer reference fields.** [[ADR-0008]] reserves them:
  `128 → journal_entry_id`, `64 → source_document`, `32 → posting_rule`. High-cardinality refs go
  *here*, never into account identity.
- **TB timestamp = posting time, NOT accounting date** ([[HOT-005]] / [[ADR-0010]]). Never
  periodise a trial balance / P&L / close on the TB timestamp. Accounting date is a distinct field
  held outside TB. This is load-bearing, not a detail.
- **Two-phase transfers (pending → post/void) carry the two-store commit.** [[ADR-0003]] /
  [[SPIKE-002]] / `formal/two-store-commit.tla`: TB *pending* → Mongo write → TB *post* (or *void*
  if the Mongo write failed). The three failure modes to design out: orphaned pending, Mongo doc
  with no posted transfer, retry double-post.
- **One shared client per process; it auto-batches.** Max ~8189 events per batch. Do not spin up a
  client per request.

## Open risk

- **Loading under Deno is unproven** ([[SPIKE-001]]): the client is a native node-api addon. Exercise
  it under `deno run`, `deno test`, **and** `deno compile` — napi support differs across the three.
  Fallback if it fails is a Go sidecar for the ledger service only ([[ADR-0004]] revisit trigger),
  which adds a network hop the TLA+/Quint model must then include.

Cross-refs: [[ADR-0003]] · [[ADR-0004]] · [[ADR-0008]] · [[ADR-0010]] · [[SPIKE-001]] · [[SPIKE-002]] · [[HOT-005]]
