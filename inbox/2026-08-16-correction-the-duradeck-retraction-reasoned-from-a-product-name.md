---
kind: correction
title: Correction — the 2026-08-10 retraction of the service-only-jobs finding reasoned from a product NAME, not a product record; the five Netflix orders carry the install labour and their master category is Delivery
contexts: [ledger, billing]
source: "api:2026-08-16:firestore products/kqzVClx5uJrJ07bEjokX + invoices 1799/1803/1822/1856/1875 under ADC — master tracking_category_name = \"Delivery\"; 15 revenue lines across the five, all Delivery"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects a retraction, not a measurement. Both prior notes are append-only and stand as written.

## What was claimed, and where

`inbox/2026-08-09-correction-the-unallocable-population-is-smaller-and-is-one-customer.md` found
that the structurally-unallocable bucket was **85.5% one customer, one service, five weeks** — five
Netflix invoices totalling $9,750.00 — and concluded they were **service-only jobs, not a defect**:
CFS sold labour with no rental or retail goods on the order at all, so the pool genuinely has no
product line to belong to. That note ends by observing that Duradeck _is_ surface protection and
that the install labour is tracked `Delivery` "because a service line has no product to be
categorised as".

On 2026-08-10 that conclusion was retracted, in `reporting/product-line-pl.yaml`, in ADR-0031's
Consequences and in `reporting/queries/product-line-pl.sql`:

> ⚠️⚠️ **THE DOMINANT CASE HERE PROBABLY IS NOT UNALLOCABLE.** Those five Netflix orders qualified
> because their lines carried no product line — but Duradeck **is** categorised at the product
> master, as `Surface Protection`, so after the repair they carry a goods line and have a
> denominator. If that holds, **85.5% of this row's measured population disappears** and
> "service-only jobs, not a defect" was a conclusion drawn from the defect.

## Measured 2026-08-16: it does not hold

`products/kqzVClx5uJrJ07bEjokX.tracking_category_name` is **`"Delivery"`**. It is
`Duradeck Install / Tear Out / Relocate` — the **labour**, not the deck. Every revenue line on all
five invoices carries `Delivery` at the line _and_ at the master; not one carries a goods line, and
not one carries anything the base definition declines to count either.

| invoice | date       | lines                                                                                         |
| ------- | ---------- | --------------------------------------------------------------------------------------------- |
| 1799    | 2025-03-03 | service 4100 $1,000.00 · surcharge 4110 $250.00                                               |
| 1803    | 2025-02-28 | service 4100 $1,000.00 · surcharge 4110 $500.00 · surcharge 4110 $250.00                      |
| 1822    | 2025-03-18 | service 4100 $1,000.00 · surcharge 4110 $500.00 · surcharge 4110 $250.00                      |
| 1856    | 2025-03-30 | service 4100 $2,000.00 · surcharge 4110 $1,000.00 · surcharge 4110 $250.00                    |
| 1875    | 2025-04-04 | service 4100 $500.00 · service 4100 $500.00 · surcharge 4110 $500.00 · surcharge 4100 $250.00 |

All 15 lines are `tracking_category: "Delivery"`, master `"Delivery"`. Base $0.00 under every basis.

⇒ **The 2026-08-09 conclusion is reinstated. The five orders were never a defect, and 85.5% of the
row does not disappear.** The row's population is 12 groups / $11,400.00 ex-void — measured in
`inbox/2026-08-16-adr-0031s-figures-re-measured-two-of-three-predicted-directions-failed.md`, and it
grew rather than shrank.

## The mechanism of the error, which is the part worth keeping

The retraction reasoned: _Duradeck is surface protection → the Duradeck line is goods → the order
has a denominator._ Every step is sound except that the invoice does not carry a Duradeck line. **It
carries a different product — the install service — and the retraction never read either product
record.** It inferred a category from a product's NAME.

That is the same error class as the defect the whole re-measurement exists to correct, one level up.
api-cloudrun#473 was "seven artifacts read a derived copy instead of the master". This retraction
read neither: it read a string in an invoice line's description and reasoned about what that string
denotes. The independent property was available and cheap — one document fetch — and it inverts the
conclusion.

Two things follow that generalise:

- **A retraction is a claim and needs the same evidence standard as what it retracts.** This one was
  written as a ⚠️⚠️ prediction in three structured artifacts, with "if that holds" attached, and
  then nothing held it. It survived six days as the reading of record while the measurement it
  doubted was correct all along.
- **"Product X is a kind of goods" and "this line is a goods line" are different statements.** CFS
  sells the install of a thing as a separate product from the thing. Any rule that classifies a line
  by reasoning about what its product is _for_ will get this wrong in the same way; the
  classification has to come from the product record's own category, which is what `line_kinds` plus
  the master join now does.
