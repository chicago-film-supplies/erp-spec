---
id: SPIKE-007
question: How is DuckDB reached from Deno — native addon or WASM — and can the client query directly?
timebox: 2 days
method: >-
  Benchmark both access paths over a representative Parquet corpus (a year of postings) running a
  real trial-balance query. Separately, evaluate duckdb-wasm inside a SolidJS route.
exit_criteria:
  - Both access paths working from Deno, with query latency measured on a realistic corpus rather than a toy one.
  - A decision, with the memory ceiling of the WASM path stated as a number.
  - A verdict on client-side reporting via duckdb-wasm — viable or not, and at what corpus size it stops being viable.
closes_adr: new
status: open
---

## Notes

Client-side reporting would remove a whole API surface if it works. Measure before assuming it
does — a Parquet file that is fine server-side may be far too large to ship to a browser.
