---
kind: finding
title: 55 order uids referenced by invoices do not exist
contexts: [ordering, billing]
source: prior-session analysis, 2026-08
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

55 order uids referenced by invoices have no corresponding order document — hard-deleted,
concentrated in 2023–24.

This is the evidence behind the charter's **no hard deletes, ever** fence. Not reproduced on
2026-08-08; confirming it needs a cross-reference of every invoice's `query_by_orders` against
the orders collection. Tracked as OQ-013.
