---
kind: constraint
title: handling_bucket per product
contexts: [ordering, fulfillment]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Each product carries a handling bucket: `bag` | `two_person_lift` | `needs_cart_or_truck_space`.
Drives crew sizing and vehicle capacity planning.

Exists precisely because dimensional data does not — see
[[2026-08-08-product-weight-dimensions-empty]]. A coarse bucket someone will actually fill in
beats a precise field that has been zero for 549 products.
