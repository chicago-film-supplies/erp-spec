---
kind: constraint
title: fulfillment_mode enum on the order
contexts: [ordering, fulfillment]
source: prior-session design work, 2026-08
confidence: high
promotes_to: [REQ-FUL-003]
verified: false
triage_count: 0
---

`fulfillment_mode`: `local_delivery` | `counter` | `shipped` | `trucked`.

Discriminators to preserve: `counter` = both collecting and returning flags true. `shipped` = an
explicit shipping line was billed, NEVER inferred from geography. `delivery` = the union of "flags
indicate a field leg" OR "a delivery-category line was billed". `trucked` has no stated
discriminator — HOT-001.

Whether the enum belongs on the order or on each destination is OQ-003, now live because
multi-destination orders are possible.
