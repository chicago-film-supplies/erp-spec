---
kind: finding
title: >-
  v1 settled the serialized-unit model that ADR-0015 leaves out of scope — a roster per product,
  per-booking unit sets, and units named on the movements
contexts: [availability, fulfillment, fixed-assets]
source: >-
  api-cloudrun session, 2026-10-07, on api-cloudrun#1199. Design and ledger in
  `api-cloudrun/.claude/plans/serial-tracking.md`; the walkie roster was seeded in prod the same day
  (269 units, 1001-1269) and `audit-units` / `audit-unit-replay` are clean there.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## What v1 now does

ADR-0015 says "serialized and asset-tracked units do not fit a fungible balance and are out of scope
here." v1 has since built it, for the walkie talkie (260-radio fleet), with hotspots, tents and makeup
mirrors queued. The shape, because v2 will meet the same requirement:

- **Identity is the NUMBER, not the serial.** `units/unit-{number}`; the serial is a changeable
  attribute with its own history, each entry naming the movement that set it. A replaced radio keeps its
  number. Numbers are globally unique (walkies 1001-2999, everything else 3000 up).
- **Availability stays anonymous counts.** `stock/{P}` never carries a unit identity.
- **Custody is a roster, one document per product** (`unit-rosters/{P}`: number -> shelf / prepped /
  out / away), written only by the ledger writer's fold over `movement.units`. One doc rather than one
  per unit because a 200-radio check-out is a write-count problem.
- **Each booking holds the unit sets per bucket** (`booking.units`), and every movement names its units.
- **Every ownership movement names its units**, so `count(active units) == quantity_held` holds by
  construction. A departure leaves the number `vacant`; retiring is a separate operator step.
- **Units carry no cost** (a unit cost would be a second money author); a unit points at its
  acquisition movement.

## Why it matters here

The roster is a projection folded from movements, which is the same shape this repo's pending-transfer
reservation model gives every other projection, so it should sit inside ADR-0015 rather than beside it.
What ADR-0015 needs to decide is whether a reservation of a serialized product reserves a quantity (v1:
yes, units are picked at prep or check-out) or a unit.

Measured 2026-10-07 in prod: 269 active units, 28 `unattributed_out` (numbers the cutover could not
attribute to a booking until the physical count), 252 of 260 serials loaded.
