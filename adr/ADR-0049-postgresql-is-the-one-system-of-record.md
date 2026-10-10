---
id: ADR-0049
headline: PostgreSQL is the one system of record
title: PostgreSQL is the one system of record — documents, ledger, event store, queues and reporting in one transactional database
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [
  ledger,
  ordering,
  billing,
  fulfillment,
  availability,
  banking,
  tax,
  fixed-assets,
  procurement,
]
relates_to: [
  ADR-0003,
  ADR-0004,
  ADR-0010,
  ADR-0013,
  ADR-0014,
  ADR-0015,
  ADR-0017,
  ADR-0022,
  ADR-0026,
  ADR-0036,
  ADR-0042,
  ADR-0047,
  ADR-0048,
  ADR-0050,
  ADR-0051,
  ADR-0052,
  ADR-0053,
  SPIKE-002,
  SPIKE-011,
  SPIKE-014,
  HOT-005,
  HOT-022,
  HOT-025,
  OQ-065,
  OQ-066,
  OQ-067,
  OQ-068,
  OQ-069,
]
accounting_shaped: false
measurements:
  - id: M1
    value: "about 15k postings"
    of: >-
      The whole of CFS's ledger history, estimated at 15 transfers per invoice over 999 prod
      invoices. A figure OF v1's corpus, used here only to say that no candidate store is near a
      throughput limit — never to size v2.
    as_of: 2026-08-09
    source: ADR-0024
  - id: M2
    value: "1,078 PUT /orders/:uid in 30 days, about 36 a day"
    of: >-
      v1 prod order updates over the 30 days to 2026-10-09, from VictoriaMetrics. Write rate of the
      busiest document type in current behaviour.
    as_of: 2026-10-09
    source: inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md
  - id: M3
    value: "p95 POST /orders about 4.1s; traced requests made 30–50 sequential store and HTTP round trips"
    of: >-
      v1 prod latency over 30 days to 2026-10-09 (VictoriaMetrics, VictoriaTraces). Describes v1's
      round-trip pattern on Firestore. It is evidence that the cost is latency rather than
      throughput; it is NOT evidence that v2 on Postgres will be faster — SPIKE-014 measures that.
    as_of: 2026-10-09
    source: inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md
asserts:
  - id: D1
    kind: decision
    claim: >-
      PostgreSQL is the one system of record for documents, masterfiles, the ledger, the event
      store, work queues and reporting.
  - id: D2
    kind: decision
    claim: >-
      An event recording an inventory, custody or money fact commits in the SAME database
      transaction as the document change it explains.
  - id: D3
    kind: decision
    claim: >-
      The event store is append-only and the DATABASE enforces it; application discipline alone
      does not count.
  - id: D4
    kind: decision
    claim: >-
      Journal-entry balance (debits equal credits) is enforced by the database at commit, not by
      application code.
  - id: D5
    kind: decision
    claim: >-
      MongoDB, TigerBeetle, Valkey and DuckDB leave the target stack. Typesense stays as a
      derived search index; Parquet stays only as a change-feed sink.
  - id: P1
    kind: premise
    claim: >-
      The owner ruled PostgreSQL the one system of record, replacing all four stores.
    source: inbox/2026-10-09-owner-rules-postgres-is-the-one-system-of-record-replacing-mongo-tigerbeetle-valkey-and-duckdb.md
  - id: P2
    kind: premise
    claim: >-
      CFS's write volume and ledger size are orders of magnitude below what any candidate store
      handles (M1, M2).
    source: ADR-0024
supersedes:
supersedes_on_acceptance: ADR-0003
superseded_by:
---

> **In the context of** a two-store design whose integrity cost appears throughout the spec,
> **facing** an owner ruling that one open-source database should hold every record, **we decided**
> to make PostgreSQL the one system of record, with events committed in the same transaction as the
> documents they explain, **to achieve** atomic writes with no cross-store protocol and a ledger
> that can be queried by accounting date, **accepting** that ledger invariants become database
> constraints that a superuser or a migration can bypass, where TigerBeetle's could not be.

## Context

- ADR-0003 chose MongoDB for documents and TigerBeetle for the ledger, and named the cost: "a
  two-store commit protocol is now mandatory". It explicitly rejected "everything in Postgres"
  because "the document shape fights relational modelling and the ledger gains nothing over
  TigerBeetle".
- **Both reasons have since been tested by the spec's own work:**
  - The two-store commit grew into SPIKE-002, ADR-0042's sweeper, intent records, `T_claim` /
    `T_resolve` and a five-module Quint model (`formal/two-store-commit.qnt`). HOT-022 records the
    timeout mechanism the model refuted.
  - Ledger dimensions were decided three times against TigerBeetle's fixed transfer fields (ADR-0008
    and ADR-0018 superseded, ADR-0035 rejected, ADR-0036 accepted) — HOT-013 was "more dimension
    claimants than transfer fields".
  - TigerBeetle cannot range-query by accounting date, which is why ADR-0017 needed DuckDB and
    Parquet at all (HOT-005).
  - ADR-0015 records that TigerBeetle cannot stop a future date being double-booked.
  - The items tree is the document shape ADR-0003 worried about; `jsonb` stores it as a document
    while every other table stays relational.
- **Scale does not favour specialised stores here** (P2). TigerBeetle's advantage is batching
  thousands of transfers per request; CFS's slow requests are latency from sequential round trips
  (M3), which batching does not address.
- The owner's standing requirements: live streaming to clients, real-time accurate availability, a
  replayable and ideally immutable event store for inventory, custody and money, open source over
  lock-in, self-hosting on Linode (ADR-0013), and a live prod replica for staging.

## Decision

**PostgreSQL is the one system of record** (D1). Documents, masterfiles, the ledger and event store,
work queues (ADR-0050) and reporting (ADR-0051) live in one database.

- **Events commit with the documents they explain** (D2). There is no second store to reconcile
  with, so there is no commit protocol, no pending-transfer timeout and no sweeper to resolve one.
- **The event store is append-only, enforced by the database** (D3). Which mechanism — grants,
  triggers, a hash chain, or a combination — is OQ-066.
- **A journal entry that does not balance cannot commit** (D4).
- **Four stores leave** (D5): MongoDB, TigerBeetle, Valkey (ADR-0050) and DuckDB (ADR-0052).
  Typesense stays as a derived index; Parquet stays as an append-only change-feed sink (ADR-0052).

This ADR does not decide the browser live transport (OQ-067), the staging replica's conflict policy
(OQ-068), or hosting and failover (OQ-069).

## Considered options

- **MongoDB + TigerBeetle** (ADR-0003, the incumbent). Rejected: the costs listed under Context.
- **MongoDB for documents, PostgreSQL for the ledger.** Rejected: an order write still spans two
  stores, so the two-store commit survives in a Mongo↔Postgres form. MongoDB's real advantage,
  change streams, has a Postgres counterpart in logical replication. MongoDB is licensed under the
  SSPL, which is not OSI-approved.
- **SQLite + Litestream.** Credible at this scale. Rejected on failover time, on having no role
  grants to enforce append-only, and on running more than one writer process.
- **celld (self-hosted Durable Objects).** Rejected: the expensive writes cross entities and nothing
  coordinates a commit across cells
  (`inbox/2026-10-09-research-celld-considered-and-not-pursued-as-the-system-of-record.md`).
- **PostgreSQL for everything** (chosen).

## Consequences

- **The two-store commit is moot.** SPIKE-002's protocol, ADR-0042 (the sweeper is the sole
  resolver), HOT-022 and `formal/two-store-commit.qnt` lose their subject. ADR-0015 (reservations
  are pending transfers) must be re-decided, not ported.
- ⚠️ **Ledger integrity becomes bypassable, and that is the accepted downside.** TigerBeetle
  enforced double-entry in a way no operator could override. Postgres constraints, triggers and
  grants can all be dropped by a superuser or a migration. Mitigations, none sufficient alone:
  - separate roles, with the application role unable to alter the schema or bypass triggers;
  - a replay audit that rebuilds balances and projections from the event store and compares;
  - a hash chain over the event store, so an altered or removed row is detectable after the fact;
  - migrations reviewed as code, with event-store tables changed only by new tables or columns.
- **Accounting date is an ordinary, range-queryable column.** HOT-005's root cause (posting time is
  the only timestamp TigerBeetle indexes) goes away; ADR-0010's rule that the two dates are distinct
  fields stands unchanged.
- **The transfer field budget retires.** `ledger/tigerbeetle-accounts.yaml` and
  `spikes/harness/tb-field-budget_test.ts` exist because TigerBeetle has four discretionary
  per-transfer fields. ADR-0036's rule — the ledger carries keys, not classifications — stands; the
  slot arithmetic around it does not.
- **Gapless numbering is not free.** Postgres sequences are not transactional and leave gaps on
  rollback, so a gapless number needs a counter row updated in the posting transaction. OQ-065
  carries it.
- **One database to back up, replicate and restore.** Backup, point-in-time recovery, failover and
  the staging replica become first-class operational work (OQ-068, OQ-069). A replication slot that
  stops being consumed retains WAL until the disk fills; it needs a cap and an alert.
- **Accepted ADRs whose decisions stand but whose premises named a replaced store** — 0004, 0010,
  0013, 0014, 0022, 0026, 0036 — are not superseded. Their correction is recorded in
  `inbox/2026-10-09-correction-seven-accepted-adrs-cite-a-replaced-store-as-a-premise-and-their-decisions-stand.md`.
- **SPIKE-014 validates this before acceptance**: a port of the stock engine, a balanced posting
  table, the live transport, one heavy prod order replayed end to end, and SPIKE-002's failure cases
  rerun against the single store.
