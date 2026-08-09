---
id: ADR-0012
title: Valkey-backed queues with in-process workers, replacing Cloud Tasks
status: proposed
date: 2026-08-09
review_by: 2026-10-15
deciders: [repo owner]
contexts: [ordering, billing, fulfillment]
relates_to: [SPIKE-010, ADR-0004]
supersedes:
superseded_by:
---

> **In the context of** leaving Cloud Tasks along with the rest of the GCP platform, **facing** 16
> queues whose config largely encodes HTTP-delivery hazards rather than domain requirements, **we
> decided** to run queues on Valkey with in-process workers and serialize on a per-entity lock,
> **to achieve** the removal of the duplicate-dispatch lease and its coupled-knobs invariant,
> **accepting** that durability becomes a configuration decision and worker liveness becomes ours
> to monitor.

## Context

- v1 runs 16 Cloud Tasks queues, 29 `/tasks/*` handlers and 15 Cloud Scheduler jobs. Five queues
  and four scheduler handlers retire with Xero, CRMS and Trello and are not ported.
- Cloud Tasks delivers over HTTP. Five of its seven documented platform hazards — non-2xx-is-a-retry,
  no dead-letter queue, inert `Retry-After`, a framework timeout that returns 504 without
  cancelling, and CPU throttling after response — are artifacts of that transport.
- Four queues set concurrency to 1. In three of them that is a correctness device standing in for
  per-entity serialization, applied globally because the platform offers no per-key notion.
- Where duplicate dispatch cannot be prevented it is detected, by a 180s CAS lease. That forces a
  three-way CI invariant, `retryBudget >= leaseMs > timeoutTier`, whose knobs have already caused
  an incident when changed independently.
- Capture: `inbox/2026-08-09-cloud-tasks-queue-inventory.md`,
  `inbox/2026-08-09-queue-hazards-are-http-artifacts.md`,
  `inbox/2026-08-09-per-entity-serialization-is-the-requirement.md`.

## Decision

Queues run on **Valkey**, consumed by **in-process workers**. Serialization is a **lock keyed by
entity**, not a global concurrency cap.

The duplicate-dispatch lease and the `retryBudget >= leaseMs > timeoutTier` invariant are
**eliminated, not reimplemented** — an in-process worker holding an entity lock makes duplicate
processing structurally impossible rather than detectable after the fact.

**This decides the queue role only.** `research-drop/reference/valkey.md` requires each Valkey role
to be adopted explicitly; the socket / real-time fan-out role stays undecided under SPIKE-009, and
the pub/sub-vs-Streams choice belongs to that decision, not this one.

**Revisit trigger:** if the chosen queue library cannot run under Deno (SPIKE-010), that selects a
different library or a sidecar. It does not reopen the substrate — a RESP client is a plain network
client and carries no native-addon risk.

## Considered options

- **Cloud Tasks equivalent on another managed platform.** Rejected: it carries the HTTP-delivery
  hazard set forward for no gain once the platform is self-hosted anyway.
- **A queue in the primary datastore, for transactional enqueue.** Rejected: state lives in
  MongoDB and TigerBeetle, so an enqueue into a third store is not transactional with the thing
  that caused it. It buys no atomicity here and adds a system.
- **Valkey with in-process workers** (chosen).

## Consequences

- **Correctness rests on reconciliation, not on enqueue atomicity.** No enqueue can be atomic with
  a Mongo + TigerBeetle commit, so a periodic pass must find state needing work with no job in
  flight. SPIKE-002 already requires orphan detection with a time bound for pending transfers; this
  is the same loop and should be specified once. Jobs must be idempotent and reconstructible from
  state.
- **Queue state is never a source of truth.** Valkey AOF at `everysec` can lose about a second of
  acknowledged jobs on hard crash, and the reference note's rule is stronger than a durability
  setting: anything in Valkey must be rebuildable from MongoDB, TigerBeetle or Parquet. The
  reconciliation sweeper is what makes that true for queued work — it is the mechanism, not a
  backstop. The AOF setting must still be stated rather than inherited from a default.
- **Worker liveness replaces the paused-queue trap.** A queue paused out-of-band once swallowed
  enqueues for seven weeks unnoticed. The equivalent failure is a worker that is not running, and
  it needs an equivalent audit — self-hosting does not remove the failure class.
- **Cron loses a managed failure surface.** 15 Cloud Scheduler jobs become repeatable jobs. A
  repeatable that stops firing because its worker died is silent, where Cloud Scheduler failed
  visibly. Monitoring is in scope, not optional.
- **Deployment topology changes.** Handlers stop being HTTP routes and become worker functions,
  which changes both how they scale and how they are tested.
- Task-name discriminators that exist only to dodge Cloud Tasks' ~24h name tombstone become dead
  weight and are deleted rather than ported. A once-per-deployment task that currently gets its
  idempotence from the tombstone needs an explicit marker.
- The catalog↔Terraform parity guards become unnecessary — queues are defined in code, one source
  of truth. The route↔queue, scheduler↔job and render-budget guards still need homes.
