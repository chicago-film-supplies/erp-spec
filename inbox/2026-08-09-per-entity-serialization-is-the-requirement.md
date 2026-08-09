---
kind: constraint
title: Per-entity serialization is what the queue layer actually has to provide
contexts: [ordering, billing]
source: "code read 2026-08-09 — api-cloudrun src/lib/taskQueues.ts (xeroInvoiceQueue, xeroQuoteQueue, userNameCascadeQueue, orderFinalizeQueue), src/lib/taskLease.ts (LEASE_MS 180s), taskQueueCoverage.test.ts T5"
confidence: high
promotes_to: [ADR-0012]
verified: false
triage_count: 0
---

Four v1 queues set `max_concurrent_dispatches = 1`, and in three of them it is a **correctness**
device, not throughput management:

- two Xero queues — serial dispatch is what stops two attempts both missing an `xero_id == null`
  check and double-creating in the live ledger
- `userNameCascade` — stops two renames interleaving read-modify-writes on container documents
- `orderFinalize` — the serialization *is* the coalescing (a task name could not be used: the ~24h
  tombstone would suppress the next legitimate finalize of that order)

This is a **per-entity** requirement being met with a **global** knob, and it costs throughput on
every unrelated entity. Any replacement has to provide it explicitly: a per-queue concurrency
setting does not express "serialize per order uid".

Where duplicate dispatch cannot be prevented it is currently *detected* — a 180s Firestore CAS
lease (`taskLease.ts`) on the three lease-backed queues, which drops to two once Trello goes. That
lease forces a three-way coupling asserted in CI: `retryBudget >= leaseMs > timeoutTier`. It exists
because the platform can dispatch a duplicate at will.

**The design opportunity: make duplicate processing structurally impossible rather than
lease-guarded.** An in-process worker holding a lock keyed by entity removes both the lease and the
coupled-knobs invariant, instead of reimplementing them. Whichever way this is decided it should be
decided, not inherited — the coupling has already caused one incident, and a queue-per-entity
workaround is not viable at order cardinality.
