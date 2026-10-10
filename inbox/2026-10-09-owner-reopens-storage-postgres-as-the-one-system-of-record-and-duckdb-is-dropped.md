---
kind: owner
title: >-
  Owner reopens the storage model — Postgres as the one system of record (documents, ledger, event
  store, queues) is the leading candidate, TigerBeetle is suspected of being forced, and DuckDB is
  dropped while Parquet survives as a change-feed sink
contexts: [ledger, availability, fulfillment, ordering, billing]
source: >-
  Owner, 2026-10-09, in a speculative workspace session (no spec edits) that reread ADR-0003, 0012,
  0015, 0017, 0024, 0042, 0047, SPIKE-009 and manager's data-layer skill. Latency figures measured the
  same day against prod VictoriaMetrics and VictoriaTraces (30-day window). Transcript:
  `research-drop/2026-10-09-storage-reopened-postgres-as-one-system-of-record.md`.
confidence: medium
promotes_to: [
  ADR-0049,
  ADR-0050,
  ADR-0051,
  ADR-0052,
  ADR-0053,
  SPIKE-014,
  OQ-066,
  OQ-067,
  OQ-068,
  OQ-069,
  HOT-025,
]
verified: true
triage_count: 0
---

## What the owner stated

- **Reopen most past storage decisions.** Requirements that stand: live streaming to clients;
  real-time accurate stock availability; a replayable, ideally immutable, event store for anything
  inventory, custody or money related; open source over vendor lock-in; self-hosted on Linode
  (ADR-0013 stands).
- **"I liked TigerBeetle and am afraid we're forcing it."** Also concerned about the number of
  storage sites (today's spec: MongoDB + TigerBeetle + Valkey + Parquet/DuckDB + Typesense).
- **Typesense stays.**
- **Drop DuckDB; keep Parquet as change-feed sinks.**
- **A live replica of prod for a staging environment is still required** (v1 has one: prod → dev
  mirror, `api-cloudrun/src/services/devReplica.ts`, prod-wins with a newer-wins guard).
- Owner raised "celld" as a vague interest; it was not identified in the session — ask what it is.

## The case for Postgres that came out of the session (analysis, not a ruling)

- **Scale doesn't favour specialised stores.** ADR-0024 measured about 15k postings for all of CFS
  history. Prod writes are about 36 `PUT /orders/:uid` per day (1,078 in 30 days).
- **The owner's "hefty transactions that take seconds" are LATENCY, not throughput.** p95 over 30
  days: `POST /orders` about 4.1s, `PUT /fulfillments/bookings` about 3.3s, `POST /transactions`
  about 2.4s, `PUT /orders/:uid` about 2.2s. Two 3.3s `POST /orders` traces each made 30–50
  sequential Firestore/HTTP round trips (`BatchGetDocuments`, `DocumentReference.Get`, `Query.Get`,
  14–20 outbound `POST`s). `Transaction.Run` spanned 1.8–2.7s while its own reads and commit took
  about 300–450ms; the rest was not attributed (CPU or a contention retry).
  - A co-located database removes most of that cost.
  - TigerBeetle would not: its speed comes from batching thousands of transfers per request.
- **The friction TigerBeetle brought is visible in the spec itself:**
  - a mandatory two-store commit (SPIKE-002, ADR-0042's sweeper, intent records, T_claim/T_resolve);
  - ledger dimensions decided three times (ADR-0008 and ADR-0018 superseded, ADR-0035 rejected,
    before ADR-0036);
  - HOT-005 (posting time is not accounting date);
  - ADR-0015: TigerBeetle cannot prevent double-booking a future date.
- **Postgres reproduces what was liked about TigerBeetle, inside the same transaction as the
  document write:**
  - append-only event tables: INSERT-only grant, plus a trigger rejecting UPDATE/DELETE;
  - zero-sum journal entries via a deferred constraint trigger;
  - `CHECK (balance >= 0)` on custody balances only (stock availability negatives stay preserved);
  - pending/posted/voided as event types, with no timeout and no sweeper;
  - JSONB for the order/invoice items tree;
  - `SKIP LOCKED` queues enqueued in the same transaction, replacing Valkey.
- **Accepted weakness:** a superuser or a migration can bypass Postgres constraints; nobody can
  bypass TigerBeetle's. Mitigations: separate roles, the replay audit (api-cloudrun#1255
  `foldJournal`), and a hash chain.
- **MongoDB's real advantage is change streams.** Against that: SSPL (not OSI-approved open source),
  no constraints across documents, and it still needs a separate ledger store.
- **SQLite + Litestream was considered credible at this scale**, but loses on failover time, on
  grants that can enforce immutability, and on running more than one process.

## Shapes explored (not decided)

- **Browser live transport.** v1 manager already streams documents ASSEMBLED AT WRITE TIME, so the
  hard part of live queries (joins) is already gone.
  - Each write transaction updates a `read_models` row (`collection, id, version, body`) and calls
    `NOTIFY {collection,id,version}`.
  - A gateway in the API process LISTENs and fans out over WebSocket/SSE.
  - Query subscriptions re-run and diff by id; at this write rate brute force is correct.
  - Resume is per-document `version`, not a stream token, so logical decoding is not in the client
    path.
  - Auth becomes server code and can project fields, which removes the field-projection reason in
    api-cloudrun#698, and reports could become live subscriptions.
  - Hand-rolled was preferred over ElectricSQL, Supabase Realtime and Zero.
- **Change feed (logical replication slot) as the one durable, ordered outbound path.** Sinks:
  - **Typesense**, replacing the Eventarc → `/tasks/sync-typesense` path (about 2.4M
    `/eventarc/firestore` calls in 30 days);
  - **Parquet**, as an append-only change log
    (`lsn, commit_ts, table, op, pk, before, after,
    actor, request_id`), partitioned by table
    and day in Linode Object Storage, compacted and hashed daily. This doubles as the **audit
    stream** for documents that are not event-sourced. The actor travels via
    `pg_logical_emit_message`, and audited tables need `REPLICA IDENTITY FULL`;
  - **staging.**
  - Risk to monitor: a dead consumer retains WAL until the disk fills. Needs
    `max_slot_wal_keep_size` and an alert on slot lag.
- **Event store vs change feed are not the same thing.**
  - The event store is the domain FACTS, written deliberately by the app, and is the source of
    truth.
  - The change feed is the PHYSICAL row changes, derived from the WAL, and is how every change
    (events included) reaches other systems.
- **Staging replica.**
  - Seed by pgBackRest restore from prod, then tail the change feed with prod-wins upserts, deletes
    and a skip list.
  - Neither built-in option fits: a physical replica is read-only, and native logical replication
    stops on the first conflicting staging write.
  - UUIDv7 ids keep staging-written events from colliding with prod's.
  - Open choice: staging rebuilds its own projections from events, or accepts prod-wins drift and
    re-seeds.

## DuckDB: why dropping it is coherent

ADR-0017's Context says DuckDB/Parquet existed because TigerBeetle cannot range-query by accounting
date, and it left open periods reporting from the document store. With the ledger in Postgres, every
period is answered by one SQL `GROUP BY`. "Closed-period figures cannot drift" becomes a database
rule: reject postings dated in a closed period, and store a closing hash per period. Parquet keeps
archive, audit and offline-analysis value, readable by any engine.

## Decisions this would re-decide if pursued

ADR-0003, ADR-0012, ADR-0015, ADR-0017, ADR-0023 (at least its DuckDB/TigerBeetle-addon half),
ADR-0024 and ADR-0042. ADR-0047's D1/D2 (resume token, silent resync) carry over keyed per document.
`formal/two-store-commit` becomes moot.

Suggested next step: a spike porting `core/src/utils/stock.ts`, a posting table with the zero-sum
and non-negative constraints, a `NOTIFY` gateway feeding a `createEntityCache` port, and one heavy
prod order replayed end to end. Run SPIKE-002's failure cases against it, and kill the LISTEN
connection mid-write to check that clients converge.
