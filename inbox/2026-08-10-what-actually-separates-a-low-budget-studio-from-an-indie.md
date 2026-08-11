---
kind: constraint
title: The studio budget-tier split is motivated by duration, spend and delivery-vs-pickup — and low-budget studio resembles indie on all three, differing only in how exceptions are handled
contexts: [ordering, billing, ledger]
source: repo owner, 2026-08-10 session
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

Background the owner gave for OQ-035's value set, unprompted, while approving the OQ-036 survey.
Recorded because it is the **motivation** behind an enum, which is the part that normally goes
unwritten and is the part that decides whether the enum survives contact with the data.

## What the owner said

> The main differentiators between high budget and low budget are **often, but not always**, project
> duration, spend and whether or not items are delivered. Low-budget studio looks more like indie —
> 3–6 weeks, prefers in-store pickup. Indies are one-offs, more worthy of exceptions, discounts
> etc., where low-budget studio stuff is more of an assembly line, so precedents matter more. Not
> sure that distinction applies here, just providing background on enum motivations.

## Three discriminators, all measurable in CFS data today

The owner hedged them ("often, but not always"), which is the right posture and also makes them
testable. Nothing here is verified — this note is the hypothesis, not the finding:

| discriminator              | where it is measurable                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project duration**       | `order.dates.delivery_start` → `delivery_end`; the claim is 3–6 weeks for the low tier                                                                                                             |
| **Spend**                  | order totals per customer, per production                                                                                                                                                          |
| **Delivered vs collected** | `destinations[].customer_collecting` / `.customer_returning` — already measured corpus-wide for HOT-002 (2.77% of revenue is asymmetric; 55.92% customer-collects both ways, 41.29% CFS both ways) |

⚠️ **The third one is already half-answered and does not obviously support the split.** If 55.92% of
revenue is customer-collecting both ways across the _whole_ corpus, "prefers in-store pickup" is
close to the corpus norm rather than a low-tier marker. Whether it discriminates _between tiers_ is
the open question, and it needs the customer axis that OQ-036 has not built yet.

## The part that is NOT a discriminator, and is the more interesting claim

> Indies are one-offs, more worthy of exceptions, discounts etc. — low-budget studio is more of an
> assembly line, so precedents matter more.

This is a statement about **how CFS treats a customer**, not about what the customer is. It predicts
a measurable difference in **discount frequency and dispersion** between the two, which is checkable
against `Discount.rate` on order lines — and if it holds, it is a stronger basis for a tier boundary
than duration or spend, because it describes CFS's own behaviour rather than the customer's.

The owner flagged uncertainty about whether it applies here. It may not belong in the _enum_ at all:
"exceptions are expected" is a policy about approvals and pricing, which the enum could inform
without encoding.

## Why this matters for OQ-035

The proposed set is `studio | indie | corporate/commercial/industrial | event | student`, with
`studio` possibly splitting by budget tier. **If low-budget studio resembles indie on all three
measured discriminators, the tier split may be the wrong cut** — the real boundary would be
`high-budget studio` versus `everything else`, and "studio" would be doing no work as a category.

That is a question the corpus can answer and a designer cannot, so **measure before declaring the
set**. The general rule this repo already learned the hard way: a category that nothing
distinguishes in the data is a category that reports as a bucket while saying nothing — the same
objection that retired `Other` (OQ-022, and the product master retirement on 2026-08-10).

## Blocked on

**OQ-036.** Every discriminator above needs a stable customer or production key to group by, and
today `20th Television` is spread across six organization records while `Netflix Productions, LLC`
is ten. A tier measurement run on the current org table would be measuring the naming convention.
