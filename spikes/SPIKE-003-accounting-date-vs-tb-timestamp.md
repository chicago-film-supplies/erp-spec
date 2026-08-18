---
id: SPIKE-003
headline: TigerBeetle timestamps on imported history
question: >-
  How does TigerBeetle's timestamp behave when loading history, and what are the `imported` flag's
  timestamp and monotonicity semantics?
timebox: 3 days
method: >-
  Load a synthetic multi-year history with accounting dates far behind wall clock, using the
  `imported` flag. Probe whether user-supplied timestamps are accepted, whether they must be
  monotonic, and how they interact with normal live posting afterwards.
exit_criteria:
  - Documented rule for which field carries accounting date and which carries posting timestamp.
  - A demonstrated history load whose accounting dates precede their posting timestamps by years.
  - Confirmation that live posting resumes correctly after an import batch.
closes_adr: ADR-0039
status: closed
---

## Notes

Feeds HOT-005 but does not settle it — whether TigerBeetle or DuckDB is the reporting source of
truth is a decision (OQ-009), not a finding.

## ⚠️ `closes_adr` was retargeted at close, from ADR-0010 to ADR-0039

ADR-0010 was **accepted 2026-08-08 and is frozen**, and its Decision defers this detail to this
spike. An answer cannot be written into it (ADR-0034), so the result lands as a new narrow ADR that
`relates_to` it and supersedes nothing — CLAUDE.md's "stands, but left a question open" row, with
ADR-0025 as precedent. SPIKE-001 did the same thing, retargeting from ADR-0004 to ADR-0023.

⚠️ **This spike was written to GATE a decision that was then taken without it.** Its job changed
from "decide" to "confirm or contradict", and nothing said so until close. `SPIKE-011` → `ADR-0013`
is in the same position and still open (erp-spec, 2026-08-18).

## Result — ADR-0010 confirmed, and `imported` refused on its own evidence

Measured 2026-08-18 against a real TigerBeetle `0.17.9+cc1c06a` single-replica cluster driven by
`tigerbeetle-node@0.17.9` under Deno 2.9.2 on `aarch64-apple-darwin`. **22 checks, 22 passing,
reproduced 4× with identical statuses.** Probe: `spikes/harness/tb-import-probe.ts`
(`deno task tb-import`), which formats, starts and deletes its own clusters — `imported` is defined
against the cluster's last committed timestamp, so a probe run against a shared cluster measures
that cluster's history rather than the flag.

### 1. Which field carries what — MET

| Fact                  | Field                                                             | Why it cannot be the other                                                                            |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Posting timestamp** | `Transfer.timestamp`, cluster-assigned (`timestamp: 0` on submit) | must be strictly increasing cluster-wide and globally unique — exactly a posting timestamp's contract |
| **Accounting date**   | `Transfer.user_data_32`, packed `YYYYMMDD`                        | may repeat, may regress — neither is representable in `Transfer.timestamp`                            |

Decided by two measurements, not by preference:

- Two `imported` transfers at the **same** nanosecond → `imported_event_timestamp_must_not_regress`
  **(60)**. So an accounting date used as the timestamp caps the ledger at **one posting per
  calendar day**.
- A regressing timestamp — a back-dated entry into an open prior period, the ordinary case ADR-0010
  exists for — → the same **(60)**.
- The converse works: accounting date `20260818` then `20260731` while the posting timestamp
  advanced `13,489,000` ns — **both created**, and `queryTransfers` on `user_data_32=20260731`
  returns **2**.

Corollaries: `timestamp` is forbidden without the flag (`timestamp_must_be_zero` **(3)**) and
required with it (`imported_event_timestamp_out_of_range` **(58)** for both `0` and `2^63`).
`user_data_32` round-trips exact and is a first-class `QueryFilter` field, **equality only** — a
period query needs one call per day, or the projection (ADR-0017).

### 2. A history load with dates years behind — MET by the plain load, NOT by `imported`

**Plain route (recommended):** 5 postings at `timestamp: 0` with `user_data_32` =
`20190115 …
20251015`, all created, accounting dates sitting up to **7.59 years before** their
posting timestamps — and it runs on a cluster that is **already live**.

**`imported` route:** 28 transfers loaded at 2019-01-15 … 2025-10-15, timestamps read back exact.
But the accounting date and the posting timestamp then **coincide**, so nothing precedes anything.
⚠️ **The criterion's own wording — "accounting dates precede their posting timestamps" — is only
satisfiable by the plain load.** It was written correctly and the `imported` route quietly fails it.

**The decisive cost:** `CreateTransferResult.timestamp` **echoes the user-supplied value**, and
there is no second field on the record. An `imported` load therefore leaves **no record of the real
commit time anywhere in TigerBeetle**, while `contexts/ledger/entities/posting.yaml` requires
`posting_timestamp: "when recorded. monotonic. never back-dated"` on every posting. Under `imported`
that field has no home.

**The case for `imported`, stated fairly:** it is the only way TigerBeetle's own `timestamp_min/max`
range filter reaches historical periods — measured **4** transfers for 2019 and **8** for 2019–2020.
It loses because ADR-0017 already puts period reporting in the projection, so the range filter is a
convenience rather than a capability the spec depends on. Route (ii) loses _filterability_, which
was already equality-only; route (i) loses _correctability_, permanently.

### 3. Live posting resumes — MET, and the clock never has to catch up

- Immediately after the import batch, a plain transfer was created at wall clock **+0.5 ms**, **0.84
  y** ahead of the imported watermark. No stall — and none is possible, because `now + 1 h` is
  already refused with `imported_event_timestamp_must_not_advance` **(59)**. The live clock is ahead
  of the import range by construction.
- After interleaving an import between two live postings, the account's `debits_posted`
  (**113,024**) equalled the sum of all **35** debit legs walked back out of `getAccountTransfers` —
  an independent property, not a restatement of the probe's own bookkeeping.

### ⚠️ The hard constraint: the import window never reopens

Once anything is posted live, a backdated import **cannot** be done — `2019-03-01` after one live
posting → **(60)**, while the same transfer at `liveTs + 1 ns` → created. Same for accounts
(**(26)**).

**The window is `(last committed timestamp of that object type, cluster clock]` and nothing widens
it.** After go-live every correction to imported history must be a _new_ posting at _today's_
timestamp carrying the historical accounting date — which is what the plain route already is, and
what an accounting restatement should be anyway. **This binds ADR-0020**: a restatement re-run after
cutover is new postings, not a reload.

### Migration mechanics, measured

- **Accounts must be imported before their transfers, backdated.** A _live_ account refuses any
  backdated imported transfer — `imported_event_timestamp_must_postdate_debit_account` **(61)** /
  `…_credit_account` **(62)**. Creating the chart normally and then importing history fails on every
  transfer.
- **Account and transfer watermarks are independent** (both directions measured), **but timestamps
  are globally unique across object types** — a transfer at exactly an existing `Account.timestamp`
  → **(60)**; 1 ns later → created.
- **Idempotency is on `id`, never on timestamp.** Verbatim re-submit → `exists` **(46)**; the same
  timestamp under a fresh id → **(60)**. A re-run that remints ids is not a re-run, it is a failure.
- **Batches may not mix modes** — `imported_event_expected` **(56)** / `imported_event_not_expected`
  **(57)**. The first event fixes the mode for the whole call.
- **Linked chains recover correctly**: a chain whose last event violates monotonicity returns
  `linked_event_failed` **(1)** on the earlier members, commits nothing, leaves the watermark
  untouched, and the same timestamps re-import clean.
- **`linked` is persisted in `Transfer.flags`**, so a verbatim re-import must replay whole chains —
  `exists_with_different_flags` **(36)** if stripped, `linked_event_chain_open` **(2)** if kept.
- **`imported` two-phase transfers cannot expire** — `imported_event_timeout_must_be_zero` **(63)**.
  Binds the inventory-custody ledger only (ADR-0015); no GL posting rule uses a pending transfer.

### ⚠️ Unexpected: `--development` cuts the batch ceiling by 32×

The harness `_README.md` prescribes `--development`, on which `createTransfers` caps at **253**
events. The docs say 8189 "in the default configuration". Rather than report a config artifact as a
TigerBeetle fact, the probe stands up a **second cluster on production defaults** and measures
**8189** there. So the docs are right and `--development` is what reduces it — and nothing in this
repo said the local recipe changes the number.

The ceiling is enforced **client-side as a thrown `ERR_TOO_MUCH_DATA`**, not as a per-event status,
so a migration that batches by count and catches per-event statuses will see an exception rather
than a rejection.

⚠️ **Every prior harness measurement of TigerBeetle here was taken on `--development`.** SPIKE-001's
checks all sit well under 253 so none is invalidated, but the general point stands: the local recipe
is not the production configuration, and at least one documented constant differs by 32×.

### Bearing on the transfer field budget

Reported, not restated — `ledger/tigerbeetle-accounts.yaml` owns the numbers.

- The `accounting_date` → `user_data_32` assignment is **measured working**; its
  `blocked_by: [SPIKE-003]` is discharged.
- The plain route **costs the budget nothing**: `posting_timestamp` rides `Transfer.timestamp`,
  which is protocol-assigned and not discretionary at all.
- The `imported` route **would create a claimant the budget cannot satisfy** — an argument against
  it, not a reason to spend the spare `code` u16.
- Nothing here bears on the `actor_ref` vs `causal_order_ref` contest (erp-spec#3).

### What this did NOT measure

- **Linux, and multi-replica.** macOS single replica only. The timestamp rules are state-machine
  behaviour and are not plausibly platform-dependent, but the batch ceiling is _demonstrably_
  configuration-dependent, so treat the ~15–17 k/s throughput as non-transferable. SPIKE-011 owns
  the deployment target.
- **The real restatement volume** — a 5,000-transfer synthetic load was used. Sizing the Xero corpus
  is ADR-0020's job.
- **`id_already_failed` (68)** never fired; the transient-error retry path is untested.
