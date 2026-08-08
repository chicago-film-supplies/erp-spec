---
kind: finding
title: Every product's weight and dimensions are zero — all 549
contexts: [ordering, fulfillment]
source: "verified:2026-08-08:db_products_count"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

`shipping.{weight,height,width,length}` exist on every product. Products with `shipping.weight > 0`:
**0 of 549**. Products with `shipping.length > 0`: **0 of 549**.

Stronger than the seeded "effectively all zero" — it is literally all of them. The field has never
been populated, so any new design that depends on dimensional data is depending on data collection
that has failed for the life of the system. This is why `handling_bucket` exists.
