---
kind: finding
title: Two distinct tracking defects with different signatures, separable in the data
contexts: [ledger, billing]
source: "verified:2026-08-08:db_invoices_query, 999 invoices"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

The untracked revenue splits cleanly into two failures that need different fixes:

- `tracking_category` null AND `xero_tracking_option_id` null — 129 lines, $234,960.36 (13.9%).
  Never tracked on either side.
- `tracking_category` null BUT `xero_tracking_option_id` SET — 254 lines, $250,861.36 (14.8%). The
  CFS-side denormalization failed while the Xero id survived. Directly observable on prod invoice
  #2128, lines "Walk Around Trash Sweep" and "Trash Removal".

The second class is recoverable from the Xero option id; the first is not. Any migration that treats
"untracked" as one bucket will under-recover.
