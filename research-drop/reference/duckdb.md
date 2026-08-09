# DuckDB

The read side, over Parquet ([[ADR-0006]]): fast dimensional reporting (trial balance, P&L, close)
periodised by **accounting date** — the thing TigerBeetle structurally cannot do.

## Canonical docs

- `llms.txt`: <https://duckdb.org/llms.txt>
- Docs: <https://duckdb.org/docs/>
- **Node "Neo" client (`@duckdb/node-api`)**: <https://duckdb.org/docs/clients/node_neo/overview>
  — the current Node client. The older `duckdb` npm package is legacy; prefer Neo.
- No `llms-full.txt` referenced from `llms.txt` as of 2026-08-09.

## Version (checked 2026-08-09)

- DuckDB `1.5.5` (released 2026-07-22).

## CFS-specific gotchas

- **Parquet is the durable artifact; `.duckdb` is a rebuildable cache** ([[ADR-0006]]). A closed
  period's Parquet file is the audit artifact and its hash goes into the close record. `.duckdb`
  files are gitignored and may be deleted at any time — **nothing may depend on one existing.**
- **Access from Deno is unresolved** ([[SPIKE-007]]): native node-api addon (`@duckdb/node-api`, via
  an `npm:` specifier — needs node-api/FFI permissions under Deno) **vs** WASM (`@duckdb/duckdb-wasm`).
  The WASM path also runs in SolidJS, which could give client-side reporting for free — but measure
  the corpus size at which shipping the Parquet to a browser stops being viable.
- **Reporting periodises on accounting date** — the entire reason DuckDB exists here, since TB
  timestamps are posting time ([[HOT-005]]).
- **Reporting truth vs balance truth is an unsettled split** ([[HOT-005]] / [[OQ-009]]). Making DuckDB
  the read side is *not* the same as declaring it the reporting source of truth while TB stays the
  balance source of truth. Do not assume DuckDB is authoritative — that split is still open, and it
  gates [[ADR-0008]].
- **Keep money integer.** DuckDB has `DECIMAL`, `BIGINT`, `HUGEINT` — store minor units as
  `BIGINT`/`HUGEINT` to mirror TB's u128. Never introduce `DOUBLE`/floats on the read side.

Cross-refs: [[ADR-0006]] · [[SPIKE-007]] · [[HOT-005]] · [[OQ-009]] · [[ADR-0008]]
