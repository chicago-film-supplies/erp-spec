---
id: ADR-0039
headline: history loads as ordinary postings
title: >-
  Historical ledger entries load as ordinary postings whose posting timestamp is the load instant;
  a back-dated posting timestamp is refused
status: proposed
date: 2026-08-18
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger]
relates_to: [ADR-0003, ADR-0010, ADR-0017, ADR-0020, SPIKE-003, ADR-0049, ADR-0051]
accounting_shaped: false
supersedes:
supersedes_on_acceptance:
superseded_by:
---

> **In the context of** ADR-0020 (restate Xero history into the CFS ledger) loading years of dated
> history, **facing** the temptation to back-date the posting timestamp so history "looks" native,
> **we decided** to load historical entries as ordinary postings: the accounting date carries the
> historical date and the posting timestamp is the instant of the load, **to achieve** a posting
> timestamp that means what ADR-0010 says it means and history that stays correctable after go-live,
> **accepting** that every historical posting shares the migration's posting window.

> ⚠️ **Reworded 2026-10-09 under ADR-0049 (PostgreSQL is the one system of record).** Drafted
> 2026-08-18 against TigerBeetle, where the choice was `TransferFlags.imported` versus ordinary
> transfers with the accounting date packed into `user_data_32`. The decision survives the store
> change; the mechanism and the field packing do not. SPIKE-003 (accounting date versus TigerBeetle
> timestamp) remains the measured record of the TigerBeetle half.

## Context

- ADR-0010 requires every posting to carry an accounting date **and** a posting timestamp, as
  distinct fields. `contexts/ledger/entities/posting.yaml` states the second as _"when recorded.
  monotonic. never back-dated."_
- Loading history invites a back-dated posting timestamp: it makes a historical entry look as if it
  were recorded on its own date, and a store that indexes only posting time would then periodize
  history for free.
- **SPIKE-003 measured what that costs on TigerBeetle** (`spikes/harness/tb-import-probe.ts`, 22
  checks): the real commit time is lost, because a back-dated record has no second timestamp; and
  once anything is posted live, a back-dated load is refused forever, so history becomes
  uncorrectable. The second cost was TigerBeetle-specific. The first is not: any design that writes
  a historical date into the posting timestamp has nowhere left to record when the entry was
  actually made.
- Under ADR-0049 the accounting date is an ordinary, range-queryable column, so a back-dated posting
  timestamp buys nothing — periods are queried by accounting date (ADR-0051).

## Decision

**Historical entries load as ordinary postings.** Each carries its historical accounting date in the
accounting-date field and the load instant as its posting timestamp. **No posting is ever written
with a back-dated posting timestamp**, during migration or after it.

## Consequences

- **The posting timestamp records when the ledger learned the fact**, for history as for live
  entries. "When was this restated into the ledger" stays answerable.
- **History stays correctable, permanently.** A correction to restated history is a new posting at
  today's posting timestamp carrying the historical accounting date — which is what an accounting
  restatement should be anyway.
- **⚠️ This binds ADR-0020.** A restatement re-run after cutover is _new postings_, not a reload.
  Any migration plan that assumes history can be reloaded in place is wrong.
- **Every historical posting falls inside the migration's posting window.** Reporting by posting
  timestamp cannot periodize history; reporting by accounting date can, and that is the only
  periodization the spec relies on (ADR-0051).
- **Idempotency is on a deterministic id.** A migration re-run that remints ids is not a re-run, it
  is a double-post — so the id derivation must be deterministic from the source row.
- **⚠️ What this does NOT decide.** Whether the restatement is import-as-is or restated is ADR-0020
  (proposed, blocked on HOT-006 and OQ-012). This ADR only says how whatever is decided gets loaded.
