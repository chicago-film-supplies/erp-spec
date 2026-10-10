---
kind: owner
title: >-
  Owner rejects ADR-0015 and ADR-0042 under the PostgreSQL ruling, asks for both reservation models
  drafted and decided at review, and wants serialized reservations by quantity with optional units
contexts: [availability, fulfillment, ledger]
source: >-
  Owner, 2026-10-09, in an erp-spec session working erp-spec#63, answering four questions put
  after `.claude/plans/postgres-pivot.md` phase 2.
confidence: high
promotes_to: [ADR-0055, OQ-070]
verified: false
triage_count: 0
---

## The answers

- **ADR-0042 (the sweeper is the sole resolver):** reject now. Its subject — an orphaned pending
  transfer between two stores — does not exist under ADR-0049.
- **ADR-0015 (reservations are pending transfers):** reject, and record the re-decision as a new ADR
  rather than rewriting 0015 in place.
- **What a reservation is under PostgreSQL:** "Draft both, decide at review" — a custody phase with
  a database check, or no reservation entity with movement counts only. Neither is chosen.
- **Serialized units:** "can reserve qty optionally reserve units? that may be valuable" — a
  reservation reserves a quantity and may also name specific units.

## What follows

- ADR-0055 (proposed) carries the settled parts and lays out both models; OQ-070 holds the choice.
- HOT-022's resolver is rejected; the hotspot is moot under ADR-0049.
- SPIKE-012 now closes ADR-0055.
