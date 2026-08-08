---
kind: constraint
title: shift_id on every leg — the highest-value single field
contexts: [fulfillment, ledger]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Every leg carries a `shift_id`. This one field subsumes person-day inference, trip grouping,
piggyback-delivery marking, morning/evening splits, and byproduct identification — each of which
would otherwise need its own heuristic over data that does not exist.

Depends on legs being first-class (HOT-007). Whether a shift is per-person or per-crew is
undecided (OQ-005) and changes the cardinality of this reference.
