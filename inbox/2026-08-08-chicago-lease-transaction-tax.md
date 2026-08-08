---
kind: constraint
title: Chicago Personal Property Lease Transaction Tax applies to equipment rental
contexts: [tax, billing]
source: prior-session analysis, 2026-08
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Equipment rental attracts the Chicago Personal Property Lease Transaction Tax — a nontrivial rules
problem distinct from sales tax, plus Illinois home-rule sales tax, 1099s and W-9s.

Verified shape in the current system: rental lines carry "Chicago Rental Tax" at 11% while sale
lines on the same invoice carry "Chicago Sales Tax" at 10.25% — two different regimes applied
line-by-line within one document, discriminated by item type. Invoices and organizations both
carry a `tax_profile` field.
