---
kind: correction
title: REFUTED — Shipping and Trucking do carry a tracking dimension
contexts: [ledger, fulfillment]
source: "verified:2026-08-08:db_products_query tracking_category_name=Transport"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

The seeded finding said `Shipping` and `Trucking` both exist as products with a null tracking
dimension. **False.** Both are active service products in the `Transport` product line.

Exactly ONE product of 549 has a null tracking dimension: "Chicago Bottled Water Tax
( $0.05/bottle )", a `sale` product booking to COA 2210 — a liability account, not revenue. That
one is arguably correct as-is.

The real signal in this pair is the COA split: `Trucking` → 4100, `Shipping` → 4150. See HOT-001.
