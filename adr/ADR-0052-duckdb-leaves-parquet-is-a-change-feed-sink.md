---
id: ADR-0052
headline: DuckDB leaves; Parquet is a change-feed sink
title: DuckDB leaves the runtime; Parquet survives as an append-only change-feed sink, keeping ADR-0024's encoding rules
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [ledger, billing, banking]
relates_to: [ADR-0024, ADR-0017, ADR-0049, ADR-0051, ADR-0053, ADR-0013, SPIKE-007, SPIKE-014]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: DuckDB is not a component of the v2 runtime.
  - id: D2
    kind: decision
    claim: >-
      Reporting is served by the API from PostgreSQL; client-side reporting stays rejected.
  - id: D3
    kind: decision
    claim: >-
      Parquet files are an append-only sink of the change feed, partitioned by table and day, in
      object storage.
  - id: D4
    kind: decision
    claim: >-
      In those files money is a 64-bit integer, identifiers are never written as a float or a
      HUGEINT, and an accounting date is a DATE.
  - id: P1
    kind: premise
    claim: >-
      DuckDB's COPY to Parquet silently downcasts HUGEINT to DOUBLE, and DATE plus INTERVAL yields
      a TIMESTAMP.
    source: ADR-0024
supersedes:
supersedes_on_acceptance: ADR-0024
superseded_by:
---

> **In the context of** one ledger answering every period (ADR-0051), **facing** a reporting engine
> whose job no longer exists, **we decided** to drop DuckDB from the runtime and keep Parquet only
> as an append-only change-feed sink, **to achieve** one fewer engine with the archive and audit
> value intact, **accepting** that offline analysis is done with whatever engine reads Parquet,
> outside the system.

## Context

- ADR-0024 reached DuckDB natively, server-side, to read ADR-0017's sealed Parquet periods. With
  ADR-0051 there is nothing for it to read on the request path.
- Its measurements still bind any Parquet writer: the silent `HUGEINT → DOUBLE` downcast that
  corrupted a 37-digit reference to `1.2676506002282294e+30`, the `DATE + INTERVAL → TIMESTAMP`
  drift, money as `BIGINT` being exact (P1).
- Owner, 2026-10-09: drop DuckDB, keep Parquet as change-feed sinks.

## Decision

- **No DuckDB in the runtime** (D1). The native addon, the WASM fallback and the
  `extensions.duckdb.org` dependency all go.
- **Reporting is SQL in PostgreSQL, served by the API** (D2). ADR-0024's rejection of client-side
  reporting stands on its own numbers.
- **Parquet is a change-feed sink** (D3): one append-only log of committed row changes, partitioned
  by table and day, in Linode Object Storage.
- **ADR-0024's encoding rules carry over** (D4).

## Consequences

- **The sink doubles as the audit stream** for documents that are not event-sourced: who changed
  what and when, readable by any engine. Its row shape (LSN, commit time, operation, before/after,
  actor, request id) is SPIKE-014 work. The hashing was ruled by the owner on 2026-10-09: a per-file
  hash as written, a canonical-row hash, the range of changes each file covers, daily manifests
  chained and written back into PostgreSQL, a period sealed by one hash over its daily manifests,
  all in a compliance-locked bucket with ten-year retention. One file per table per day, never
  compacted
  (`inbox/2026-10-09-owner-accepts-prevent-chain-anchor-immutability-and-a-verifiable-parquet-archive-with-ten-year-retention.md`,
  `inbox/2026-10-09-owner-rules-one-parquet-file-per-table-per-day-and-no-compaction.md`).
- **It needs a durable, ordered consumer.** A logical-replication consumer that stops retains WAL
  (ADR-0049 Consequences).
- **Offline analysis is anyone's engine.** DuckDB on a laptop reading the archive is fine; it is a
  tool, not a component.
- **ADR-0023's native-addon matrix loses its DuckDB column** — ADR-0053.
