---
id: ADR-0024
title: DuckDB is reached natively and server-side; client-side reporting is rejected
status: accepted
date: 2026-08-09
deciders: [repo owner]
contexts: [ledger, billing, banking]
relates_to: [SPIKE-007, ADR-0017, ADR-0008, ADR-0010, ADR-0023]
supersedes:
superseded_by:
---

> **In the context of** sealed-period Parquet as the closed-period reporting authority (ADR-0017),
> **facing** a choice between the native DuckDB addon, WASM in the API process, and WASM in the
> browser, **we decided** to reach DuckDB natively and server-side and to reject client-side
> reporting, **to achieve** exact integer reporting over an artifact the server controls,
> **accepting** that reporting stays an API surface we have to build.

## Context

Measured 2026-08-09 (`code:2026-08-09:erp-spec@9134489:spikes/harness/duckdb-probe.ts` and
`duckdb-wasm-probe.ts`), `@duckdb/node-api@1.5.5-r.3` / `@duckdb/duckdb-wasm@1.33.1-dev57.0`, Deno
2.9.2. Corpus generated at the real scale — 999 invoices measured in prod
(`api:2026-08-09:db_invoices_count` → 999), i.e. order 15k postings for all history — plus 10×, 100×
and 1000× to locate the crossover.

**Server-side, native.** A trial balance periodised by accounting date, over Parquet:

| rows                  | Parquet | query |
| --------------------- | ------- | ----- |
| 15k — all CFS history | 0.1 MB  | 8 ms  |
| 150k                  | 0.5 MB  | 3 ms  |
| 1.5M                  | 5.3 MB  | 22 ms |
| 15M                   | 54.3 MB | 37 ms |

**Client-side, WASM.** What a browser pays before it can answer anything:

|                               | measured                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| engine (`duckdb-eh.wasm`)     | 35.9 MB raw, **8.2 MB gzipped**                                                   |
| Parquet reader                | **+3.2 MB, autoloaded from `extensions.duckdb.org` at first query** — not bundled |
| wasm heap, idle               | 17 MB                                                                             |
| wasm heap, 15k rows           | 84 MB                                                                             |
| wasm heap, 1.5M rows          | 303 MB                                                                            |
| the data itself, at CFS scale | 0.1 MB                                                                            |

## Decision

**Reach DuckDB through `@duckdb/node-api`, in the API process. Do not ship reporting to the
browser.**

**Store the u128 journal-entry reference as `DECIMAL(38,0)`, never as `HUGEINT`.**

**Named fallback** — the thing no ADR previously stated: if the native addon becomes unusable (a
Deno upgrade breaks Node-API, or a deployment platform has no prebuilt binding), **run
`@duckdb/duckdb-wasm` server-side inside the Deno process.** Same engine, same SQL, no native code.
It is measured working under Deno. The cost is memory and speed, not correctness, and it requires no
change to the query layer. This is DuckDB's equivalent of ADR-0004's Go-sidecar trigger, which
TigerBeetle had and DuckDB did not.

## Consequences

- **Reporting remains an API surface.** Client-side reporting would have removed one; it does not
  pay. At CFS's real corpus a browser downloads ~11.4 MB compressed of engine plus extension to
  query **0.1 MB** of data — roughly 100× the payload it is there to read — and grows an 84 MB wasm
  heap to aggregate 15k rows. The crossover where the artifact is worth the engine is where the
  Parquet approaches the engine's own size: ~3M postings, about **200× CFS's entire history**. The
  honest counter-argument is that the engine is HTTP-cacheable across sessions while each period's
  Parquet is not, so heavy repeat use amortises it — but that trades a fixed 8.2 MB first-load and a
  300 MB heap ceiling on mobile against an API endpoint that costs milliseconds, and at 15k rows
  there is nothing to amortise.
- **A runtime dependency on `extensions.duckdb.org` would have been inherited silently.** The
  Parquet reader is not in the core wasm module; the engine fetches it from a third-party CDN on
  first query. Server-side that would put a domain CFS does not control on the reporting path. The
  native client has no such dependency.
- **`COPY ... TO parquet` silently downcasts `HUGEINT` to `DOUBLE`.** No error, no warning. Written
  as `HUGEINT`, ADR-0008's `user_data_128` journal-entry reference comes back as a JS `number` with
  everything below ~2^53 gone — `1267650600228229401496703205383` read back as
  `1.2676506002282294e+30`. This is the money-precision failure class applied to an identifier, and
  it would have corrupted the link between a sealed period and its ledger entries.
  - `DECIMAL(38,0)` → `FIXED_LEN_BYTE_ARRAY`, exact. A real TigerBeetle id today is **37 decimal
    digits** (bit 121), so it fits with room to spare, and the encoding **errors loudly**
    (`Conversion Error`) above 10^38 rather than truncating — the opposite failure mode to HUGEINT,
    and the reason it is the default rather than VARCHAR.
  - `VARCHAR` → `BYTE_ARRAY`, exact across the full u128 range. Use it if a reference is ever
    written that is not TigerBeetle-generated.
- **Money is safe as `BIGINT`.** Cents store as `INT64` and `SUM` returns a JS bigint. The
  fail-closed companion measures the wrong form drifting: summing the same column through `DOUBLE`
  after dividing by 100 is exact at 15k rows and off by **3 cents at 15M**. That "0 at real scale"
  is the finding — the discipline cannot be justified empirically at CFS's size and must be
  structural.
- **`DATE + INTERVAL` yields a `TIMESTAMP` in DuckDB.** The corpus's `accounting_date` silently
  became a timestamp on the first run. Accounting date is a calendar day and is always a distinct
  field from the posting timestamp; a column that quietly grows a time-of-day is how periodising on
  the wrong thing starts. Cast explicitly.
- **`--self-extracting` is mandatory** — see ADR-0023. Default `deno compile` fails with
  `Library not loaded: @rpath/libduckdb.dylib`; `--bundle` fails outright.

## Considered options

- **`@duckdb/duckdb-wasm` in the browser.** Rejected on the numbers above.
- **`@duckdb/duckdb-wasm` server-side as the primary path.** Rejected as primary — it costs memory
  and adds the extension CDN — but adopted as the named fallback, which is its real value.
- **The legacy `duckdb` npm package.** Not evaluated: upstream marks it legacy in favour of the Neo
  client, and the Neo client works.
