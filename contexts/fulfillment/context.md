# Fulfillment (`FUL`)

## Responsibility

The physical movement of equipment and the labour that moves it. Owns legs, trips, shifts, crew
assignment, clock-in/clock-out, and the causal-job attribution that makes labour costing possible.

## Boundary

- Does **not** own what was ordered — Ordering does.
- Does **not** own what was charged for delivery — Billing does. A chargeable field leg is a
  fulfillment fact; its price is a billing fact.
- Does **not** own stock levels or reservations — Availability does.
- Does **not** compute labour cost. It records shifts and legs; Ledger applies standard cost and
  posts the variance.

## Upstream / downstream

- **Consumes:** order confirmed (ORD).
- **Produces:** leg completed, shift recorded, trip completed.

## Open

- HOT-007 / OQ-001 — legs first-class or derived. Everything else here depends on it.
- HOT-001 / OQ-010 — whether a trucked leg generates a shift.
- OQ-005 — shift cardinality (per-person or per-crew).
