---
id: SPIKE-007
question: >-
  Which access path reaches DuckDB from Deno — the native addon or WASM — and can a browser query
  a sealed period's Parquet directly, removing a reporting API surface?
timebox: 2 days
method: >-
  Run `@duckdb/node-api` over a sealed-period Parquet file sized from the real corpus, executing a
  trial balance periodised by accounting date, through every execution mode in
  `spikes/harness/_matrix-result.md`. Separately load the same Parquet into `@duckdb/duckdb-wasm`
  in a headless browser and measure what shipping it to a client actually costs.
exit_criteria:
  - Both access paths working from Deno, with the mode matrix filled in for the native path.
  - A decision on the access path, with the memory ceiling of the WASM path stated as a number.
  - A verdict on client-side reporting via duckdb-wasm — viable or not, and at what corpus size it stops being viable.
  - An explicit fallback stated for the case where the native addon cannot be used, since no ADR names one today.
closes_adr: ADR-0024
status: closed
---

## Notes

Client-side reporting would remove a whole API surface if it works. Measure before assuming it
does — a Parquet file that is fine server-side may be far too large to ship to a browser.

## Amended 2026-08-09, before running anything

ADR-0017 landed after this spike was written and answered part of it. Recording the amendment
rather than quietly running a stale spike:

- **The latency benchmark is dropped.** The original `method` asked for "query latency measured on
  a realistic corpus", and `exit_criteria` required it. ADR-0017:25-27 already measured the corpus
  — 999 invoices and 9,197 line items in prod, so on the order of 15k transfers for *all history* —
  and concluded that "every candidate design is faster than required by orders of magnitude".
  Benchmarking a 15k-row Parquet file would produce a number with no decision attached to it. What
  survives is the *crossover*: the corpus size at which the client-side path stops working, which
  is a genuine threshold rather than a stopwatch reading.
- **"Evaluate duckdb-wasm inside a SolidJS route" became "in a headless browser".** The question is
  what the browser pays — heap, transfer, latency. A SolidJS route adds a framework to the
  measurement without adding anything to the answer.
- **A fourth exit criterion was added: name the fallback.** ADR-0004 gives TigerBeetle an explicit
  revisit trigger (a Go sidecar) if its client fails. DuckDB had no equivalent anywhere in the
  spec — the WASM path is the de-facto answer and it is written down nowhere. A gap found while
  rescoping, so it is closed here rather than filed.
- The framing "the read side ([[ADR-0006]])" is stale throughout the old text: ADR-0006 is
  superseded by ADR-0017, which narrows DuckDB to sealed periods and ad-hoc analysis, with open
  periods read live from MongoDB.

## Result — native server-side; client-side reporting rejected

Closed 2026-08-09. ADR-0024 records the decision. Harness: `spikes/harness/duckdb-probe.ts`
(`deno task duckdb`) and `duckdb-wasm-probe.ts` (`deno task duckdb-wasm`). Corpus generated at the
real scale — 999 invoices measured in prod (`api:2026-08-09:db_invoices_count` → 999), order 15k
postings for all history — plus 10×/100×/1000× to locate the crossover.

### Both access paths work

**Native, `@duckdb/node-api@1.5.5-r.3`** — a trial balance periodised by accounting date, over
Parquet, asserting debits equal credits exactly in integers:

| rows | Parquet | query |
|---|---|---|
| 15k — all CFS history | 0.1 MB | 8 ms |
| 150k | 0.5 MB | 3 ms |
| 1.5M | 5.3 MB | 22 ms |
| 15M | 54.3 MB | 37 ms |

Modes: `deno run` ✅, `deno test` ✅, `deno compile --self-extracting` ✅. Default `deno compile`
fails (`@rpath/libduckdb.dylib`) and `--bundle` fails outright — ADR-0023.

**WASM** instantiates and queries under Deno too, which is what makes it a usable fallback.

### The client-side verdict: no, by two orders of magnitude

| | measured |
|---|---|
| engine `duckdb-eh.wasm` | 35.9 MB raw, **8.2 MB gzipped** |
| Parquet reader | **+3.2 MB, autoloaded from `extensions.duckdb.org` at first query** |
| wasm heap idle / 15k rows / 1.5M rows | 17 MB / 84 MB / 303 MB |
| the data, at CFS scale | 0.1 MB |

**Crossover: ~3M postings**, where the Parquet approaches the engine's own size — about **200×
CFS's entire history**. At the real corpus the browser downloads ~11.4 MB compressed to read
0.1 MB.

The counter-argument, stated because it is real: the engine is HTTP-cacheable across sessions
while each period's Parquet is not, so heavy repeat use amortises the first load. It does not
change the answer at 15k rows, and it does not move the 300 MB heap ceiling on mobile.

### The finding that mattered most

**`COPY ... TO parquet` silently downcasts `HUGEINT` to `DOUBLE`.** No error, no warning.
`1267650600228229401496703205383` written as HUGEINT reads back as `1.2676506002282294e+30`.
ADR-0008 reserves `user_data_128` for the journal-entry id, so this is exactly the field that
would have been corrupted — the money-precision failure class applied to an identifier.

Store it as `DECIMAL(38,0)` (FIXED_LEN_BYTE_ARRAY; a real TigerBeetle id is 37 digits / bit 121, and
the encoding **errors loudly** above 10^38 rather than truncating) or `VARCHAR` (BYTE_ARRAY, exact
across the full u128). `harness/duckdb-probe.ts` asserts the trap **still exists**, so if DuckDB
ever gains int128 Parquet support the check flips and says the workaround can retire.

Two smaller ones:

- **Money is fine.** `BIGINT` cents → `INT64`, `SUM` returns a bigint. The fail-closed companion
  sums the same column through `DOUBLE`: exact at 15k, **off by 3 cents at 15M**. The "0 at real
  scale" is itself the finding — the integer rule cannot be justified empirically at CFS's size
  and has to be structural.
- **`DATE + INTERVAL` yields `TIMESTAMP`.** `accounting_date` silently became a timestamp on the
  first run. Cast explicitly; accounting date is a calendar day and always distinct from the
  posting timestamp.

### What this did NOT measure

No browser is installed on the measuring machine, so the WASM leg ran the *node* bundle under
Deno. Same wasm module, so engine size and wasm heap are real; **page JS heap, real network
transfer and a browser's own wasm memory cap are not covered**. All three add cost, so the
"not viable" verdict is safe in that direction — a *viable* verdict would have needed a browser.

The wasm query reads CSV rather than Parquet: the extension autoload path does not work under
Deno's node-runtime shim. The extension itself is published and reachable (HTTP 200 for v1.4.0,
v1.5.4, v1.5.5 on 2026-08-09) — a harness limitation, not an upstream gap. CSV is the heavier
ingest, so the heap figures are pessimistic rather than flattering.
