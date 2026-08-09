# DuckDB

**Sealed periods and ad-hoc analysis** ([[ADR-0017]]): a closed period's Parquet file is the
reporting authority, queried by accounting date — the thing TigerBeetle structurally cannot do.
Open periods are read live from MongoDB, not from here.

> Corrected 2026-08-09. This note previously opened *"The read side ([[ADR-0006]])"* and listed
> [[HOT-005]] and [[OQ-009]] as open. All three were stale: **ADR-0006 is superseded by
> [[ADR-0017]]**, HOT-005 is `resolved_by: ADR-0017`, and OQ-009 is `answered`. ADR-0017 keeps
> ADR-0006's artifact rule verbatim and drops its general "DuckDB is the read side" framing —
> which is precisely the sentence this note was repeating. `research-drop/` is invisible to
> `validate`, `gen` and `ingest` by design, so nothing here can ever go red on its own.

## Canonical docs

- `llms.txt`: <https://duckdb.org/llms.txt>
- Docs: <https://duckdb.org/docs/>
- **Node "Neo" client (`@duckdb/node-api`)**: <https://duckdb.org/docs/clients/node_neo/overview>
  — the current Node client. The older `duckdb` npm package is legacy; prefer Neo.
- No `llms-full.txt` referenced from `llms.txt` as of 2026-08-09.

## Version (measured 2026-08-09)

- `@duckdb/node-api@1.5.5-r.3`, reporting engine version `v1.5.5` from `SELECT version()` run
  under Deno (`code:2026-08-09:erp-spec@b555c5c:spikes/harness/probe-duckdb.ts`).
- `@duckdb/duckdb-wasm@1.33.1-dev57.0`.

## Access from Deno — settled 2026-08-09

**The native addon works** ([[SPIKE-007]], [[ADR-0023]], [[ADR-0024]]). `duckdb.node` loads under
`deno run`, `deno test` and a compiled binary, and a `HUGEINT` round-trips exactly at `2^127-1`
rather than arriving as a float.

**One hard constraint:** `duckdb.node` dlopens a sibling `libduckdb.dylib` through `@rpath`, and a
default `deno compile` extracts the `.node` to a temp dir without the dylib —
`Library not loaded: @rpath/libduckdb.dylib` (denoland/deno#29203). **Compile with
`--self-extracting`.** `--bundle` fails differently and is not rescued by `--self-extracting`:
`Cannot find module '@duckdb/node-bindings-darwin-arm64/duckdb.node'`.

## CFS-specific gotchas

- **Parquet is the durable artifact; `.duckdb` is a rebuildable cache** ([[ADR-0017]]). A closed
  period's Parquet file is the audit artifact and its hash goes into the close record. `.duckdb`
  files are gitignored and may be deleted at any time — **nothing may depend on one existing.**
- **Parquet is exported from MongoDB, not from TigerBeetle** ([[ADR-0017]]) — Mongo holds the
  accounting date and is queryable; TB has no bulk export. And it is **never written on the request
  path**: it is a batch artifact produced at close.
- **Reporting periodises on accounting date**, never on the TigerBeetle timestamp, which is posting
  time ([[ADR-0010]]).
- **Keep money integer.** DuckDB has `DECIMAL`, `BIGINT`, `HUGEINT` — store minor units as
  `BIGINT`/`HUGEINT` to mirror TB's u128. Never introduce `DOUBLE`/floats on the read side.
  Verified round-tripping `2^127-1` through the Neo client without loss.
- **Performance does not discriminate between designs here.** ADR-0017 measured 999 invoices and
  9,197 line items in prod — order 15k transfers for all history. Do not benchmark to choose an
  access path; the interesting number is the *crossover* at which the client-side WASM path stops
  working, not throughput.

Cross-refs: [[ADR-0017]] · [[ADR-0023]] · [[ADR-0024]] · [[ADR-0010]] · [[SPIKE-007]]
