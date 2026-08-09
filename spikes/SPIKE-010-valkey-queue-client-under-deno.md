---
id: SPIKE-010
question: >-
  Does a production-grade Valkey queue client run under Deno, and can it express per-entity
  serialization and repeatable jobs without a paid tier?
timebox: 3 days
method: >-
  Stand up a local Valkey. From Deno, drive the candidate client (BullMQ is the incumbent
  reference — npm, ioredis, Lua scripts) through: enqueue with a dedup id, a delayed job, a rate
  limit, a repeatable, and a failure that lands in the failed set. Then implement per-entity
  serialization two ways — a lock keyed by entity, and whatever grouping the library offers — and
  compare. Exercise under `deno run`, `deno test` and `deno compile`.
exit_criteria:
  - A Deno process enqueues, consumes, retries and inspects a failed job against a real Valkey.
  - Per-entity serialization demonstrated under concurrent workers, with a test that fails without it.
  - Repeatable jobs verified, including what is observable when the worker is down.
  - Whether per-key grouping needs a paid tier is answered with a citation, not a recollection.
  - If the client fails under Deno, the failure is characterised precisely enough to pick between
    another library and a sidecar.
closes_adr: ADR-0012
status: open
---

## Notes

**The Valkey client is not the risk — the queue library is.** `research-drop/reference/valkey.md`
is right that a RESP client is a plain network client and carries none of the `deno compile`/napi
exposure that TigerBeetle and DuckDB do. What is unproven is a queue *library* on top of it:
BullMQ ships Lua scripts and Node-API assumptions, and that is what this spike exercises. Scope the
timebox accordingly — connectivity will work on day one.

A failure here selects a different library or a sidecar. It does not reopen the substrate or the
language.

Per-entity serialization is the load-bearing criterion, not throughput. Three v1 queues use a
global concurrency cap of 1 as a stand-in for it, and ADR-0012 commits to eliminating the CAS lease
that backstops duplicate dispatch — so the lock has to be demonstrated, not assumed.
