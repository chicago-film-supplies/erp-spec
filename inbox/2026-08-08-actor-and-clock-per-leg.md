---
kind: constraint
title: Actor per leg, clock in/out per stop, crew size per trip
contexts: [fulfillment, ledger]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Record the acting crew member on every leg, clock-in and clock-out at every stop, and crew size on
every trip.

None of these are recoverable from the current system because legs are derived rather than
recorded (HOT-007). Without them there is no basis for allocating a crew-day to a causal job, so
COGS labour allocation is not possible — this is the gap the rebuild exists to close.
