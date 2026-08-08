---
kind: decision
title: Labour cost is a step function — do not weight allocation by expected hours
contexts: [fulfillment, ledger]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

8-hour minimum guarantee per person per day, 1.5x after 8 hours, 10 hours off required between
shifts.

The cost of a crew-day does not vary smoothly with hours worked, so **allocation must not be
weighted by expected hours**. A two-hour job and a seven-hour job on the same guaranteed day cost
the same. Weighting by hours would fabricate a proportionality that the pay rules do not have.
