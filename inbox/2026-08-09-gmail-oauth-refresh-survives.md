---
kind: decision
title: The Gmail OAuth refresh chain survives; token refresh stays in scope
contexts: [ordering]
source: "repo owner, 2026-08-09 — answers the open question in inbox/2026-08-09-cloud-tasks-queue-inventory.md"
confidence: high
promotes_to: [ADR-0012]
verified: true
triage_count: 0
---

Gmail stays. So `tokenRefreshQueue` is ported, carrying exactly one of its three current services —
`current` (CRMS) and `xero` both retire with their systems.

This closes the open question left in `inbox/2026-08-09-cloud-tasks-queue-inventory.md`: the port is
**11 queues, not 10**.

One property of the v1 design should not be carried over. The refresh is a **self-perpetuating
chain** — each task enqueues its successor — which makes a single dropped enqueue a permanent
failure, and is why an unresolved runtime service account throws there instead of skipping. Under
ADR-0012 this becomes a repeatable job with no chain to break, so the failure mode is designed out
rather than guarded.
