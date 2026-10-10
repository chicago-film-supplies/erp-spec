---
kind: owner
title: >-
  Owner rules a new `ops` bounded context to own observability, alerting and verification
  requirements, rather than scattering them across the contexts they monitor
contexts: [ledger, availability, fulfillment, billing]
source: >-
  Owner, 2026-10-09, erp-spec session, choosing between a new context and distributing each
  requirement to the context it monitors.
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

- No existing context owns cross-cutting operational requirements: liveness of quiet-failing
  services, change-feed lag, conformance of the event store to the formal specs, the external
  dead-man's switch.
- Ruling: a new `ops` context, registered in `tools/contexts.ts` (the single registry), so those
  requirements live together and get one view.
- The context code is a permanent id infix and is never renamed, so choose it once.
