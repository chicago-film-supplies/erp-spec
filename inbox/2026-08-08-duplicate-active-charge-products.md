---
kind: finding
title: Duplicate ACTIVE charge products book the same event to different revenue accounts
contexts: [ledger, billing]
source: "verified:2026-08-08:db_products_query tracking_category_name=Delivery"
confidence: high
promotes_to: [HOT-008]
verified: true
triage_count: 0
---

Not previously seeded — found during the verification pass. In the `Delivery` product line, all
`active: true`:

- "Distance Charge" ×2 — one `service` @ COA 4100, one `surcharge` @ COA 4110
- "Rush Charge" ×2 — both `surcharge` @ COA 4100
- "Off Hours Surcharge" (`service` @ 4100) vs "Off Hours Charge" (`surcharge` @ 4110)
- "Weekend Surcharge" (`service` @ 4100) vs "Weekend Charge" (`surcharge` @ 4110)

The `- Old` variants are correctly inactive; these are not. Which account a surcharge lands in
depends on which of two identical-looking active products the operator picked, so no posting rule
can be derived from history without first resolving the pairs.
