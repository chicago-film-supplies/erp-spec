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
closes_adr: new
status: in_progress
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
