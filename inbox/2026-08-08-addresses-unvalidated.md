---
kind: finding
title: Addresses are geocoded but not normalized — region representation is inconsistent
contexts: [ordering, fulfillment]
source: "verified:2026-08-08:db_invoices_query invoice #2128"
confidence: medium
promotes_to: []
verified: true
triage_count: 0
---

The seeded claim was "hand-entered and unvalidated". Partly refuted: addresses carry a `mapbox_id`
and `address_coordinates`, so they pass through geocoding.

What is real is inconsistent normalization — on invoice #2128 the destination address stores
`region: "Illinois"` while the same organization's billing address stores `region: "IL"`. Two
representations of one state coexist inside one document. Misspellings and mismatched city/ZIP were
not checked corpus-wide.
