---
kind: correction
title: Correction — the 4100/4110 split explains two accounts, and says nothing about the allocation basis
contexts: [ledger, billing]
source: repo owner, 2026-08-09 session
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects a claim in `inbox/2026-08-09-untracked-revenue-decomposes-into-three-populations.md`, which
is append-only and stands as written.

## What that note claimed

> So the Delivery line's cost attaches to the 4100 service, and the 4110 surcharge improves the
> line's margin without adding to its cost. Anything that allocated delivery COGS in proportion to
> _total_ Delivery revenue would misallocate by the surcharge share.

The second sentence is **wrong**, and the first is misleading in the same direction.

## What is actually true

The owner raised the 4100/4110 distinction to explain **why there are two separate revenue
accounts**. It was not a claim about allocation. Both accounts are the **Delivery product line**:

- **4100 Service Income** — the delivery / setup / removal charge, a service a person performs.
- **4110 Delivery Surcharges** — off-hours, rush or weekend. Nobody performs it; it is a premium for
  timing.

Two consequences the original note got backwards:

1. **The delivery line's margin includes BOTH.** Excluding the surcharge would drop 20.0% of
   delivery revenue — $43,290 of $216,050 — out of the line it belongs to. The margin question is a
   subtraction, not an allocation, and both accounts are on the revenue side of it.
2. **Delivery revenue was never going to be an allocation base.** Under ADR-0029 the official P&L
   spreads delivery revenue _and_ delivery cost across the goods on the orders that caused them — so
   delivery revenue is a thing being **allocated**, not a basis for allocating. The base is a
   property of the goods (their revenue, weight, count), and the surcharge question does not arise.

## What the split IS good for

**Forecasting, not allocation.** Delivery cost scales with 4100 service volume and not with
surcharge revenue, so a model predicting delivery cost from _total_ delivery revenue over-predicts
in a surcharge-heavy period. That is the same fact OQ-006 settled — the premium the customer pays is
margin, not cost — and it belongs to cost prediction rather than to the reporting basis.

## Why this is worth a note rather than a quiet edit

The wrong version had already reached **ADR-0029's consequences** and **erp-spec#11's checklist**,
where it read as a constraint on the reporting spec: "a surcharge is not an allocation base". Both
are corrected. Left standing it would have removed a fifth of delivery revenue from the delivery
line — an error introduced by over-extrapolating an explanation into a rule.
