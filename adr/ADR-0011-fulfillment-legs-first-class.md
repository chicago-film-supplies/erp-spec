---
id: ADR-0011
title: Fulfillment legs are first-class recorded events
status: proposed
date: 2026-08-08
review_by: 2026-09-01
deciders: [repo owner]
contexts: [fulfillment, ledger]
relates_to: [HOT-007, HOT-001, HOT-002, OQ-001, OQ-002, OQ-003, OQ-005, OQ-007, OQ-010, ADR-0019]
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

Settled 2026-08-09, unblocking this ADR:

| | Decision | Source |
|---|---|---|
| Leg identity | first-class, not derived | OQ-001 |
| `fulfillment_mode` | **per destination**, not per order | OQ-003 |
| collecting / returning flags | **per leg** | OQ-007 |
| Shift cardinality | **per person** — leg→shift is many-to-many and needs a join | OQ-005 |
| Trip | a **fulfillment-level aggregate** that MAY span orders, so it cannot live under one | OQ-002 |
| Trucked leg | labour-bearing — it generates a shift and absorbs a person-day | OQ-010 |

## Consequences

- **Someone has to record them.** This shifts work onto crew in the field, and a leg record that
  is routinely skipped is worse than none because it makes the costing look complete when it is
  not. Capture UX is a first-order requirement, not a follow-up.
- **Fulfillments must maintain item-list parity with their order.** First-class legs must not
  become a second, divergent copy of the order's items — a leg references items that stay in sync
  with the order. This is the invariant the current system enforces with a single path-computing
  normalizer, and it is the constraint most likely to be broken by giving legs their own lifecycle.
- **Leg history starts empty at cutover.** Per-destination history cannot be split into legs
  retroactively (OQ-007), and no leg-level actor or shift exists in the current corpus, so labour
  costing has no comparative prior year.
- **A trip that spans orders needs its own owner.** It is not reachable by walking down from an
  order, so trip is a top-level record that legs point at — and shared travel cost can then be
  split across the jobs that caused it rather than duplicated or arbitrarily assigned.
- **Per-destination `fulfillment_mode` means one order can mix modes** — counter pickup for one
  destination, delivery for another. Any read that assumes a single mode per order is wrong.
- Costing of the recorded leg is ADR-0019: actual per-person wage, absorption measuring utilisation.
