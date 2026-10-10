---
id: ADR-0050
headline: work queues live in PostgreSQL
title: Work queues are PostgreSQL tables, enqueued in the transaction that causes the work and claimed with SKIP LOCKED
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [ordering, billing, fulfillment]
relates_to: [ADR-0012, ADR-0049, ADR-0013, ADR-0047, SPIKE-010, SPIKE-014]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      A job is a row in PostgreSQL, inserted in the same transaction as the state change that
      requires it.
  - id: D2
    kind: decision
    claim: >-
      Workers claim jobs with row locks that skip already-locked rows, and per-entity serialization
      is a lock keyed by entity, never a global concurrency cap.
  - id: D3
    kind: decision
    claim: Valkey leaves the target stack in every role — queue, cache and pub/sub.
  - id: P1
    kind: premise
    claim: >-
      ADR-0012 rejected a queue in the primary datastore only because state lived in MongoDB and
      TigerBeetle, so an enqueue could not be atomic with the change that caused it.
    source: ADR-0012
supersedes:
supersedes_on_acceptance: ADR-0012
superseded_by:
---

> **In the context of** one transactional system of record (ADR-0049), **facing** a queue decision
> whose only argument against the database was that the database was two stores, **we decided** to
> keep work queues in PostgreSQL, enqueued in the transaction that causes the work, **to achieve**
> enqueue that cannot be lost or orphaned relative to its cause, **accepting** that queue load
> shares the database with everything else.

## Context

- ADR-0012 moved queues from Cloud Tasks to Valkey with in-process workers and per-entity locks. Its
  valuable content — eliminate the HTTP-delivery hazards, eliminate the duplicate-dispatch lease and
  its `retryBudget >= leaseMs > timeoutTier` invariant, serialize per entity — does not depend on
  Valkey.
- It considered and rejected "a queue in the primary datastore, for transactional enqueue" because
  "state lives in MongoDB and TigerBeetle, so an enqueue into a third store is not transactional
  with the thing that caused it" (P1). ADR-0049 removes that premise.
- Its central consequence was that "correctness rests on reconciliation, not on enqueue atomicity" —
  a periodic sweeper finding state that needs work with no job in flight.

## Decision

- **A job is a row, inserted with its cause** (D1). If the transaction rolls back, so does the job.
- **Claims skip locked rows; serialization is per entity** (D2). ADR-0012's elimination of the
  duplicate-dispatch lease carries over unchanged.
- **Valkey leaves entirely** (D3). ADR-0012 adopted it for the queue role only; the cache and
  pub/sub roles were never adopted. Live fan-out is OQ-067 under ADR-0047, and no cache is required
  at CFS's scale.

## Consequences

- **The reconciliation sweeper loses its reason.** It existed because enqueue could not be atomic.
  Jobs must still be idempotent — a worker can crash after doing the work and before marking the job
  done.
- **Queue state becomes durable state.** ADR-0012's "anything in Valkey must be rebuildable" rule
  and the AOF `everysec` loss window no longer apply; a job is as durable as any committed row.
- **Worker and cron liveness still need monitoring** — ADR-0012's paused-queue lesson and the silent
  repeatable-job failure stand. They become `ops` requirements (owner, 2026-10-09).
- **Queue load shares the database.** At about 36 order writes a day (ADR-0049 M2) this is not a
  constraint; queue depth and job age become alerted signals.
- **The library is open.** SPIKE-010's BullMQ/ioredis findings do not carry. Hand-rolled
  `SKIP LOCKED` versus a Postgres job library that runs under Deno is measured in SPIKE-014.
- ADR-0012's other consequences stand: handlers become worker functions, Cloud Tasks name-tombstone
  discriminators are deleted rather than ported, and queues are defined in code.
