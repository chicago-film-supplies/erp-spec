# TigerBeetle

The ledger store ([[ADR-0003]]): double-entry enforced _in the database_, not in application code.
Everything balance-bearing lives here; nested business documents do not (that is Mongo).

## Canonical docs

- Site: <https://docs.tigerbeetle.com/>
- **Single-page dump** (best single source to feed an LLM):
  <https://docs.tigerbeetle.com/single-page/>
- Doc source (markdown, versioned): <https://github.com/tigerbeetle/tigerbeetle/tree/main/docs>
- Node client: `tigerbeetle-node` — <https://www.npmjs.com/package/tigerbeetle-node>
- No `llms.txt` published as of 2026-08-09 — `docs.tigerbeetle.com/llms.txt` returns **404**
  (`api:2026-08-09`). The single-page dump is the substitute, and it is **cached locally** at
  `.claude/docs/tigerbeetle.txt` by `deno task fetch-llms-docs`: 1,230,763 B of HTML reduced to
  377,290 B of markdown-ish text (709 headings, 199 fenced blocks). Grep it by heading —
  `## Two-Phase Transfers`, `### pending_id`, `#### flags.post_pending_transfer` all resolve.

## Version (measured 2026-08-09)

- **Cluster `0.17.9`**, client `tigerbeetle-node@0.17.9`. Releases are frequent (often
  several/week).
- **Client version must match the cluster version.** TB pins client↔server; a mismatched
  `tigerbeetle-node` will refuse to talk to the cluster. Pin both together and bump in lockstep.
  They genuinely ship together: server `0.17.9` was tagged 2026-07-06T17:24:50Z and the npm package
  published 2026-07-06T17:24:43Z, seven seconds apart.
- Verified by running both: server reports `TigerBeetle version 0.17.9+cc1c06a`, and
  `spikes/harness/tb-probe.ts` drives it from Deno with the matching client
  (`code:2026-08-09:erp-spec@b555c5c:spikes/harness/tb-probe.ts`).
- **This entry said `0.16.x (latest ~0.16.57)` until 2026-08-09**, dated with the same check-date it
  carries now, five weeks after 0.17.0. Following that pin would have produced a client↔server
  mismatch and a SPIKE-001 "failure" with nothing to do with Deno. `research-drop/` is invisible to
  `validate`, `gen` and `ingest` by design, so nothing here can ever go red on its own — re-measure
  rather than trust the date.
- **`tigerbeetle-universal-macos.zip` is a release asset**, so no container runtime is needed to
  stand up a local cluster.

## Status-enum trap

`created` is **`4294967295` (0xFFFFFFFF), not `0`** — for both `CreateAccountStatus` and
`CreateTransferStatus`. Zero is not a member of either enum. So `status === 0` is never true, and
`status !== 0` reports every success as a failure. SPIKE-001's probe hit this on its first run and
read `[4294967295, 4294967295]` as a hard error.

## CFS-specific gotchas

- **Amounts are unsigned 128-bit integers.** In TS they are `BigInt` (`12345n`). This lines up
  exactly with the repo's money rule (integer minor units everywhere — CLAUDE.md §7). USD → asset
  scale 2 → cents → `1` unit = 1 cent.
- **Asset scale is effectively immutable.** You cannot change the scale of an existing account; a
  scale change means a new ledger + migration. Decide cents up front and never revisit.
- **Accounts and transfers are immutable; `id` is the idempotency key.** Use TB's recommended
  time-based, lexicographically-sortable 128-bit ids (48-bit ms timestamp + 80-bit random). Do
  **not** use random ids — they hurt LSM write throughput.
- **No joins, no ad-hoc aggregation.** Balances are per-account only. Do not plan to "just group
  transfers by dimension" — that is not a thing TB does. ⚠️ This used to say it was _why_
  [[ADR-0008]] exploded dimensions into account identity; **[[ADR-0008]] is superseded by
  [[ADR-0018]]**, which keeps the chart plain and carries dimensions on the posting, because
  [[ADR-0017]] made the read side answer dimensional balances anyway. Same TB limitation, opposite
  conclusion.
- **⚠️ "No queries" was WRONG and this entry said it flatly until 2026-08-16.** 0.17.9 ships
  `query_transfers` / `query_accounts` taking a `QueryFilter`: **equality only** on `user_data_128`,
  `user_data_64`, `user_data_32`, `ledger` and `code`, plus a **range** on `timestamp_min` /
  `timestamp_max` — TB's own timestamp, which is posting time and therefore the wrong date. Also
  `get_account_transfers` / `get_account_balances` by account. `limit` is capped at the batch max
  (`too_much_data` above it). **The conclusion is unchanged — no range filter on `user_data`, so no
  period query** — which is why [[SPIKE-003]] flagging this contradiction never threatened
  [[ADR-0017]]. `code:2026-08-16:.claude/docs/tigerbeetle.txt` (`QueryFilter` L13178, Requests
  L9442).
- **Account `flags` set balance direction/constraints:** `debits_must_not_exceed_credits` /
  `credits_must_not_exceed_debits`. ⚠️ **Do NOT choose these per the COA normal balance.** That
  advice stood here and is wrong for a general ledger: a revenue account legitimately goes
  debit-side on a reversal, and AR legitimately goes credit-side on a customer overpayment, so
  flagging by normal balance makes correct entries fail at the database. `normal_balance` in
  `ledger/chart-of-accounts.yaml` is a **reporting** property, not a constraint. These flags belong
  on the **inventory-custody** ledger ([[ADR-0015]]), where making overselling unrepresentable is
  the entire point — `EVT-FUL-005` says so in terms. See `ledger/tigerbeetle-accounts.yaml`.
- ⚠️ **THE FIELD BUDGET IS NOT HERE, AND MUST NOT BE COPIED BACK.** Its one owner is
  `ledger/tigerbeetle-accounts.yaml` → `transfer_field_budget`, checked against the library's own
  `bindings.d.ts` by `spikes/harness/tb-field-budget_test.ts` (`deno task tb-budget`, fails closed).
  **This entry used to state the assignment, and that is how the miscount below happened** — a note
  that is "not spec, not ingested, not validated" was serving as an authority, so nothing could go
  red when it was wrong. What belongs here is the mechanics; what belongs there is the decision.
  High-cardinality refs go into these fields, never into account identity.
- **⚠️ `Transfer.code` is a FOURTH discretionary field, and this entry said "only" until
  2026-08-16.** A u16 "user-defined enum denoting the reason for (or category of) the transfer", and
  a first-class `QueryFilter` filter alongside the three `user_data` fields. Must not be zero; on a
  `post_pending`/`void_pending` it must be zero (inherits the pending transfer's) or match it. **Do
  not confuse it with `Account.code`**, which `ledger/tigerbeetle-accounts.yaml` already assigns to
  the GL code — different field, different record. The transfer's `code` is **unclaimed**, and the
  miscount propagated into erp-spec#3 ("three fields, four claimants"), [[HOT-013]] ("three slots,
  six live claimants") and [[ADR-0026]]'s Context. `code:2026-08-16:.claude/docs/tigerbeetle.txt`
  (`Transfer.code` L12725, `QueryFilter.code` L13094).
- **TB timestamp = posting time, NOT accounting date** ([[HOT-005]] / [[ADR-0010]]). Never periodise
  a trial balance / P&L / close on the TB timestamp. Accounting date is a distinct field held
  outside TB. This is load-bearing, not a detail.
- **Two-phase transfers (pending → post/void) carry the two-store commit.** [[ADR-0003]] /
  [[SPIKE-002]] / `formal/two-store-commit.qnt`: TB _pending_ → Mongo write → TB _post_ (or _void_
  if the Mongo write failed). The three failure modes to design out: orphaned pending, Mongo doc
  with no posted transfer, retry double-post.
- **One shared client per process; it auto-batches.** Max ~8189 events per batch. Do not spin up a
  client per request.

## Loading under Deno — settled 2026-08-09

**It works. No Go sidecar.** [[SPIKE-001]] is closed; [[ADR-0023]] records the result. The client
drives a real 0.17.9 cluster from Deno under `deno run`, `deno test`, `deno compile` and
`deno compile --self-extracting` — u128 exact both ways, linked batches rolling back, two-phase post
_and_ void, and 400 transfers through one shared client with no double-post.

The one constraint that came out of it: **`deno compile --bundle` drops `client.node`**
(`Cannot find module './bin/aarch64-macos/client.node'`) and `--self-extracting` does not rescue it.
Compile with `--self-extracting`, never with `--bundle`.

Still open: this is macOS, which upstream treats as a development configuration — storage behaviour
on Linux is [[SPIKE-011]].

Cross-refs: [[ADR-0003]] · [[ADR-0004]] · [[ADR-0008]] · [[ADR-0010]] · [[ADR-0023]] · [[SPIKE-001]]
· [[SPIKE-002]] · [[SPIKE-011]] · [[HOT-005]]
