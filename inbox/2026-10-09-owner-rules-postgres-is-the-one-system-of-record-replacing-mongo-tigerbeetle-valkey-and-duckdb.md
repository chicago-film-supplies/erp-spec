---
kind: owner
title: >-
  Owner rules PostgreSQL the one system of record — it replaces MongoDB, TigerBeetle, Valkey and
  DuckDB, with Parquet kept only as a change-feed sink
contexts: [
  ledger,
  availability,
  fulfillment,
  ordering,
  billing,
  banking,
  tax,
  fixed-assets,
  procurement,
]
source: >-
  Owner, 2026-10-09, in an erp-spec session, settling the question that
  `inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md`
  left open. Two statements: "im settled on postgres replacing tigerbeetle and duckdb", then, asked
  whether documents and queues move too, "Postgres for all four".
confidence: high
promotes_to: [ADR-0049, ADR-0050, ADR-0051, ADR-0052, ADR-0053, HOT-025]
verified: false
triage_count: 0
---

## The ruling

- **PostgreSQL is the one system of record** for documents, the ledger and event store, queues and
  reporting.
- **Replaced:** MongoDB (documents), TigerBeetle (ledger), Valkey (queues / cache / pub-sub), DuckDB
  (sealed-period reporting).
- **Kept:** Parquet, only as an append-only change-feed sink (archive, audit, offline analysis);
  Typesense (search); self-hosting on Linode (ADR-0013).
- **Requirements that still stand**, from the reopening note: live streaming to clients; real-time
  accurate availability; a replayable, ideally immutable, event store for inventory, custody and
  money; open source; a live prod replica for staging.

## What this is not

- **Not an acceptance.** The ruling sets direction. The ADRs that carry it are drafted `proposed`
  and accepted by the owner, never by a session.
- **Not a decision on the mechanisms** the reopening note only explored: the browser transport
  (`read_models` + `NOTIFY`), the change-feed shape, the staging replica's conflict policy, the
  immutability enforcement (grants, triggers, hash chain). Each of those is still a choice.

## Why the scope question mattered

- With MongoDB kept for documents, an order write would still span two stores, so the two-store
  commit protocol (SPIKE-002, ADR-0042, `formal/two-store-commit.qnt`) would survive in a
  Mongo↔Postgres form.
- "All four" is what makes that protocol, and the sweeper, unnecessary rather than relocated.
