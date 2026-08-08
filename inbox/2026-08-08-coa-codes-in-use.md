---
kind: research
title: Revenue COA codes observed in the live invoice corpus
contexts: [ledger]
source: "verified:2026-08-08:db_invoices_query + db_products_query"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Codes seen on real lines: 4000 (rental) · 4100 (service/labour) · 4110 (surcharge) · 4120 · 4140 ·
4150 (shipping) · 4200 (sale/expendables) · 4210 (replacements) · 4700 · 4800 · 2210 (bottled
water tax, a liability) · 2800.

COA 4100 is a catch-all spanning the Crew, Delivery, Transport and Trash & Cleanup product lines,
so the account alone does not determine the product line. That is the argument for carrying the
dimension on the posting rather than deriving it from the account — and the argument against
assuming a dimension-exploded account tree stays small (ADR-0008).

Not a chart of accounts. Input to building one.
