---
kind: research
title: What the 2026-08-08 verification pass checked, and what it could not
contexts: [ledger, billing, ordering, fulfillment]
source: "verified:2026-08-08:mcp cfs-api-prod, read-only"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

**Confirmed:** product weight/dimensions all zero (0 of 549) · 28.7% of line revenue untracked,
worse than the seeded ~20% · two separable tracking defects · service lines are the epicentre
(71.9%) · void invoices unfiltered (41 invoices / 477 lines) · chargeable-field-leg semantics of
`Delivery/Setup/Removal` quantity · the 21 product lines · Chicago rental vs sales tax split.

**Refuted:** `Shipping`/`Trucking` having null tracking dimensions — both carry `Transport`.
Addresses being "unvalidated" — they are geocoded with a `mapbox_id`; the real defect is
inconsistent region normalization.

**Newly found:** duplicate ACTIVE charge products booking one event to two accounts (HOT-008).

**Could not verify:** the 55 hard-deleted order uids (OQ-013) · the ~2% asymmetric
collecting/returning share (HOT-002) · the ~90% Xero-behind-lock figure (deliberately not queried —
Xero is single-tenant, live, and quota-limited) · whether any labour COST exists today (OQ-011).
