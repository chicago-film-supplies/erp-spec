---
id: ADR-0039
headline: history loads as ordinary postings
title: >-
  Historical ledger entries load as ordinary postings with cluster-assigned timestamps; the
  TigerBeetle `imported` flag is refused
status: proposed
date: 2026-08-18
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger]
relates_to: [ADR-0003, ADR-0010, ADR-0017, ADR-0020, SPIKE-003]
accounting_shaped: false
supersedes:
supersedes_on_acceptance:
superseded_by:
---

> **In the context of** ADR-0020 restating Xero history into a ledger CFS owns, **facing** two
> TigerBeetle routes for loading dated history, **we decided** to load historical entries as
> ordinary postings with cluster-assigned timestamps and the accounting date in `user_data_32`,
> refusing `TransferFlags.imported`, **to achieve** a posting timestamp that survives the load and
> history that stays correctable after go-live, **accepting** that TigerBeetle's own timestamp range
> filter cannot reach historical periods and the projection must serve them.

## Context

- ADR-0010 requires every posting to carry an accounting date **and** a posting timestamp, as
  distinct fields. `contexts/ledger/entities/posting.yaml` states the second as _"when recorded.
  monotonic. never back-dated."_
- ADR-0003 puts the ledger in TigerBeetle, whose `Transfer.timestamp` is cluster-assigned and
  strictly increasing. TigerBeetle offers `TransferFlags.imported`, which lets the caller supply the
  timestamp — the obvious mechanism for loading years of history.
- SPIKE-003 measured both routes against a real `0.17.9` cluster (22 checks, reproduced 4×). The
  measurements below are its, and the probe is `spikes/harness/tb-import-probe.ts`.

**The two routes:**

|                                  | `imported`                  | ordinary postings                                    |
| -------------------------------- | --------------------------- | ---------------------------------------------------- |
| `Transfer.timestamp`             | caller-supplied, back-dated | cluster-assigned at load                             |
| accounting date                  | _is_ the timestamp          | `user_data_32`, packed `YYYYMMDD`                    |
| posting timestamp                | **nowhere**                 | `Transfer.timestamp`                                 |
| TB range filter over history     | works                       | useless — all history lands in the migration instant |
| correcting history after go-live | **impossible**              | ordinary                                             |

## Decision

**Historical entries load as ordinary postings.** `timestamp: 0` on submit, so the cluster assigns
the posting timestamp; the accounting date rides `user_data_32` as a packed `YYYYMMDD`.
**`TransferFlags.imported` is not used.**

## Consequences

- **The posting timestamp survives the load, which is why the other route loses.**
  `CreateTransferResult.timestamp` echoes the caller's value under `imported`, and there is no
  second field on the record — so an imported load leaves no record of the real commit time anywhere
  in TigerBeetle, and `posting_timestamp` has no home. All four discretionary `Transfer` fields are
  spoken for or too narrow. **This is an argument from measurement, not from taste.**
- **History stays correctable, permanently.** The import window is
  `(last committed timestamp of that object type, cluster clock]` and nothing widens it: once
  anything is posted live, a backdated import is refused with
  `imported_event_timestamp_must_not_regress` **(60)** forever. Under this decision a correction to
  restated history is a new posting at today's timestamp carrying the historical accounting date —
  **which is what an accounting restatement should be anyway.**
- **⚠️ This binds ADR-0020.** A restatement re-run after cutover is _new postings_, not a reload.
  Any migration plan that assumes history can be re-imported is wrong on measured behaviour.
- **TigerBeetle's `timestamp_min/max` filter cannot periodise history, and that is accepted.**
  Measured: under `imported` it returns 4 transfers for 2019 and 8 for 2019–2020; under this
  decision the whole restated corpus sits inside the migration instant. **ADR-0017 already makes the
  projection the reporting authority for closed periods**, so what is lost is a convenience, not a
  capability the spec depends on.
- **`user_data_32` is equality-only as a query filter.** A period query against TigerBeetle needs
  one call per day. The ledger stays self-describing — a rebuild after a document-store loss can
  still periodise — but reporting goes through the projection.
- **The chart of accounts is created normally, with no ordering constraint.** Under `imported`,
  accounts would have to be created backdated _before_ their transfers, because a live account
  refuses a backdated imported transfer (**(61)** / **(62)**) — a whole ordering discipline this
  decision deletes rather than documents.
- **The transfer field budget is unaffected.** `posting_timestamp` rides the protocol-assigned
  `Transfer.timestamp`, which is not a discretionary field. The rejected route would have created a
  claimant the budget cannot satisfy. `ledger/tigerbeetle-accounts.yaml` owns those numbers; this
  ADR does not restate them, and `blocked_by: [SPIKE-003]` on the `accounting_date` assignment is
  discharged.
- **Idempotency is on `id`.** A verbatim re-submit returns `exists` **(46)**; the same content under
  a fresh id is a different transfer. **A migration re-run that remints ids is not a re-run, it is a
  double-post** — so the id derivation must be deterministic from the source row.
- **⚠️ What this does NOT decide.** Whether the restatement is import-as-is or restated is ADR-0020
  (proposed, blocked on HOT-006 and OQ-012). This ADR only says how whatever is decided gets loaded.
- **⚠️ Measured on macOS, single replica.** The timestamp rules are state-machine behaviour and are
  not plausibly platform-dependent, but SPIKE-003 also demonstrated that at least one documented
  constant is configuration-dependent (the batch ceiling, 253 under `--development` against 8189 on
  production defaults). SPIKE-011 owns the deployment target; **re-confirm there before the
  migration runs**, and treat throughput numbers from the harness as non-transferable.
