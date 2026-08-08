---
id: ADR-0011
title: Fulfillment legs are first-class recorded events
status: proposed
date: 2026-08-08
review_by: 2026-10-15
deciders: [repo owner]
contexts: [fulfillment, ledger]
relates_to: [HOT-007, HOT-001, HOT-002, OQ-001, OQ-005, OQ-007]
supersedes:
superseded_by:
---

> **In the context of** wanting COGS labour allocation, **facing** a current system that derives
> legs from order flags, **we decided** to record legs as first-class events, **to achieve** an
> actor, a clock and a shift on every movement, **accepting** that legs become data to be captured
> in the field rather than inferred for free.

## Context

- The current system derives legs from `destinations[].customer_collecting` /
  `customer_returning` — verified 2026-08-08 to be per-destination, not per-leg.
- A derived leg cannot carry an actor, a clock-in, or a shift id.
- Without those, there is no basis for attributing a crew-day to a causal job, so labour
  allocation is not possible at all.

## Decision

Fulfillment legs are first-class recorded events with their own identity, each carrying an actor,
clock-in/clock-out, and a `shift_id`.

## Consequences

- **Someone has to record them.** This shifts work onto crew in the field, and a leg record that
  is routinely skipped is worse than none because it makes the costing look complete when it is
  not. Capture UX is a first-order requirement, not a follow-up.
- History cannot be backfilled: no leg-level actor or shift exists in the current corpus. Labour
  costing starts at cutover and has no comparative prior year.
- **Blocked on HOT-007** (the decision itself) and informed by HOT-001 (whether a trucked leg
  generates a shift at all) and OQ-005 (shift cardinality).
