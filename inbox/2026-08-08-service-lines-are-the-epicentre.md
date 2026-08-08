---
kind: finding
title: Untracked revenue is overwhelmingly service lines, not rentals
contexts: [ledger, billing]
source: "verified:2026-08-08:db_invoices_query, 999 invoices"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

By item type, share of revenue with no product-line dimension:
service **71.9%** ($447,267 of $621,879) · sale 26.9% · rental **0.8%** · replacement 0.1% ·
surcharge 0.0%.

Rentals are essentially clean. The defect is a service-line defect, which confirms "the CFS-side
denormalization was never correct for service-group categories" as a precise claim rather than a
general one. Largest single untracked bucket is COA 4100 (service revenue): $323,502.50.
