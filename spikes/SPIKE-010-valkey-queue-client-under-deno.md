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
status: closed
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

## Result — it works, and the free path is the one ADR-0012 already chose

Closed 2026-08-09. ADR-0012 is **unblocked** and stays `proposed` — accepting it is the repo
owner's call. Its `review_by` is 2026-10-01.

Harness `spikes/harness/valkey-queue-probe.ts` (`deno task valkey`), against a real
**Valkey 9.1.1** (`brew install valkey`, no container) started as
`valkey-server --port 6399 --dir .data --appendonly yes --appendfsync everysec --save ''`.
`bullmq@6.0.9` + `ioredis@6.0.0`, Deno 2.9.2.

**ioredis, not valkey-glide.** valkey-glide is a Rust N-API addon and would re-import the whole
`deno compile` native-addon problem into the queue path for nothing this spike needs. With ioredis
the queue path carries no native code of its own — asserted rather than assumed, by the shared
matrix.

| check | measured |
|---|---|
| per-entity lock serialises | 0 same-entity overlaps across 3 entities; peak cross-entity concurrency **3**, so it is not a disguised global cap |
| **…and fails without the lock** | **21 same-entity overlaps** with the lock removed |
| dedup / delay / ratelimit / failed | dedup by `jobId` → 1 job; 1 delayed; failed set 1 after 2 attempts; limiter 2/400ms ran 6 jobs in 833ms |
| repeatable with the worker down | 4 fired before; **0 during 5 elapsed windows**; 3 after restart; scheduler survived |
| AOF `everysec` | `appendonly=yes appendfsync=everysec save=''`; 150k–335k acked writes/s pipelined over 5 bursts |

Modes: `deno run` ✅ 5/5, `deno compile --self-extracting` ✅ 5/5 (347 MB), and the library-loading
row of `_matrix-result.md` is green in all six cells including `--bundle` — the queue path is the
only one of the three packages that bundles.

### The load-bearing criterion, and why the second row is the important one

ADR-0012 commits to "a lock keyed by entity, not a global concurrency cap", and to **eliminating**
the 180s CAS lease rather than reimplementing it. The lock is `SET NX PX` plus a
compare-and-delete release; two workers at concurrency 4 mean the queue is not the thing
serialising.

A concurrency test that passes whether or not the lock exists proves nothing, so the same run
executes with the lock removed and **must** report overlaps. It reports 21. Without that second
row the first row is unfalsifiable.

The cross-entity assertion was originally "was another entity active when this one started",
which is timing-dependent and **produced a false failure inside the compiled binary** where
startup latency happened to serialise the first jobs. It now counts peak total concurrency
instead — a maximum over the run rather than a sample at one instant.

### Repeatables: the Cloud Scheduler regression, measured

ADR-0012 flags that a repeatable which stops firing because its worker died is *silent*, where
Cloud Scheduler failed visibly. Confirmed exactly:

- **0 jobs fired while the worker was down**, across 5 elapsed windows.
- The scheduler record **survived** and the schedule resumed on restart.
- **The missed windows are not backfilled.** Nothing anywhere records that they were missed.

So the failure mode is not "the schedule breaks" — it is "the schedule silently skips". Monitoring
cannot be a queue-depth check, because the queue is empty and healthy the whole time. It has to be
worker liveness plus a last-fired-at freshness check per repeatable. That is the input ADR-0013:61-62
assumes is "wiring".

### Per-key grouping is a paid feature — citation, not recollection

**BullMQ Pro — Groups**: <https://docs.bullmq.io/bullmq-pro/groups/> (checked 2026-08-09, HTTP 200).
Groups sit entirely under the `bullmq-pro/` documentation tree and their examples use the
`QueuePro` / `WorkerPro` classes, not the open-source `Queue` / `Worker`. Group concurrency, group
rate limit, prioritised intra-group ordering, pausing a group, local group concurrency, local group
rate limit and max group size are all Pro-only.

Free alternatives evaluated:

- **GroupMQ** — pure JS, peer-depends on ioredis. **Last published 2025-11-26, 255 days ago** as of
  2026-08-09 (`api:2026-08-09:registry.npmjs.org/groupmq` → 1.1.0). Not adopted; the staleness is
  the reason.
- **Hash the entity key into N fixed queues, each at concurrency 1.** Works, but it is a global cap
  per shard wearing a costume, and it makes per-entity fairness a function of hash collisions.
- **An explicit lock keyed by entity** — what ADR-0012 already chose, and what is measured above.

So the design question was already settled; this criterion was a documentation task, and the answer
is that the free path is sufficient. **No paid tier is required.**

### The orphan criterion ADR-0012 left uncovered

ADR-0012 requires the AOF setting to be *stated rather than inherited from a default*, and no exit
criterion covered it. Stated here: **`appendonly yes`, `appendfsync everysec`, `save ''`** (RDB
snapshots off — AOF is the durability mechanism, and two overlapping ones only add confusion).

What `everysec` costs on a hard kill, measured rather than quoted: Valkey accepted **150k–335k
writes/s** pipelined over five bursts on this machine, so **order 10^5 acknowledged writes can sit
inside one unflushed fsync window**. Reported as a range because a single burst swings roughly 2×
run to run; the figure establishes an order of magnitude, not a precise loss.

That number is the argument for ADR-0012's reconciliation sweeper rather than against `everysec`:
"about a second" sounds small and is tens of thousands of jobs. Queue state is never a source of
truth, and the sweeper is the mechanism that makes that true — not a backstop.
