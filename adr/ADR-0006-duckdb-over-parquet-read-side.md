---
id: ADR-0006
title: DuckDB over Parquet as the read side
status: superseded
date: 2026-08-08
deciders: [repo owner]
contexts: [ledger, banking]
relates_to: [HOT-005, SPIKE-007, OQ-009]
supersedes:
superseded_by: ADR-0017
frozen_sha256: 65732cd6369ed5089bd6b33e15dc5490dbbf7ac4616f1ab29bf237401a224f46
---

> **In the context of** needing analytical reporting over the ledger, **facing** a transactional
> store that cannot answer period questions by accounting date, **we decided** to build the read
> side as DuckDB over Parquet, **to achieve** fast dimensional reporting and a durable audit
> artifact per period, **accepting** that reporting truth and balance truth now live in different
> systems.

## Context

- Trial balance, P&L and close are all periodised by **accounting date**. TigerBeetle timestamps are
  **posting time**.
- Reporting is analytical: group by dimension, sum over a period. That is a columnar workload.

## Decision

DuckDB over Parquet is the read side.

**Parquet is the durable artifact; the `.duckdb` file is a rebuildable cache.** A closed period's
Parquet file is the audit artifact, and its hash goes into the close record.

## Consequences

- The close record must include the Parquet hash, making a closed period tamper-evident.
- `.duckdb` files are gitignored and may be deleted at any time. Nothing may depend on one existing.
- **This decision does not by itself resolve HOT-005.** Making DuckDB the read side is not the same
  as declaring it the reporting source of truth while TigerBeetle remains the balance source of
  truth. That split has to be stated explicitly and reconciled — OQ-009.
- SPIKE-007 decides how DuckDB is reached from Deno (native addon vs WASM), and whether duckdb-wasm
  in SolidJS gives client-side reporting for free.
