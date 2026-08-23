---
kind: decision
title: >-
  Owner — the tax rate ladders to the rate effective at the rental's start date, but only if that
  change was known at quote time, and a later invoice must still honour the promise; measured, the
  ORDER that carries that promise is being overwritten on 3,003 lines
contexts: [tax, billing, ordering]
source: >-
  Owner, 2026-08-22, in session. Measurement:
  `code:2026-08-22:erp-spec:spikes/harness/tax-decision-table-probe.ts` and ad-hoc probes over all
  994 orders and 1,019 invoices, read-only prod under ADC, 100% coverage.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Answers `OQ-056`'s second question — which date a rental's tax rate attaches to — and adds a
condition none of the three candidate answers contained.

## The rule, in the owner's words

> _"cfs applies the rate at quote time"_ … _"there should be a ladder, a rental that starts after
> rate change should bill the effective rate for its start date (but only if that rate change is
> known at quote time)"_ … _"the trick is that invoices may be issued well after the fact and need
> to reflect the quoted (promised) price"_

⇒ **Three clauses, and each one adds a requirement the data model does not currently meet:**

| clause                                          | what it requires                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| the rate **ladders to the rental's start date** | the sourcing date is `charge_start`, not the quote date, the invoice date, or "now"                                                |
| **only if the change was known at quote time**  | a tax record needs a date for when a change became **KNOWABLE**, distinct from when it is effective and when CFS began applying it |
| **a later invoice honours the quoted price**    | the promised rate must be **stored immutably at pricing time** and survive every later write                                       |

⚠️ **And "quote" here means the ORDER.** Quote documents in Firestore are PDF wrappers generated
from an order — they carry `uid_order`, `version` and an Uploadcare uuid, and no pricing. **The
order is the promise; the quote is a rendering of it.**

## ⚠️ THE PROMISE IS BEING OVERWRITTEN — measured

Every Chicago rental line on every order, scored against the rate lawful at that order's earliest
`charge_start`:

| rental started | lawful rate | rate the order carries | lines |        base |
| -------------- | ----------: | ---------------------: | ----: | ----------: |
| 2025           |         11% |                **15%** | 1,752 | $339,543.21 |
| 2024           |          9% |                **15%** |   945 | $169,664.00 |
| 2023           |          9% |                **15%** |   306 |  $58,850.40 |
| ✅ correct     |         15% |                    15% |   840 | $145,834.90 |
| ✅ correct     |         11% |                    11% |     2 |     $750.00 |

⇒ **3,003 order lines carry today's 15% for rentals that happened when the rate was 9% or 11% —
$568,057.61 of base.** Across the whole corpus the Chicago rental rate appears as **15% on 7,167
lines and 11% on 3.**

⭐ **So the artifact that carries the price promise does not preserve it.** Whatever re-prices an
order stamps the CURRENT rate over the promised one, and the promise is then unrecoverable from the
order. **That is the same defect class as api-cloudrun#537** — a denorm restamped by a later write,
where three artifacts asserted point-in-time fidelity and the writer did not implement it.

⚠️ **The invoice appears to preserve it where an invoice exists.** Invoice 2128 (dated 2025-12-08)
carries **11%** on its rental lines, and SPIKE-008's criterion-2 scoring found only **one**
registry-level disagreement across 333 scored invoice lines. ⇒ **the issued invoice is a snapshot
and the order is not**, so the promise survives exactly where it has already been billed and is lost
everywhere it has not. **A head-to-head order-versus-invoice comparison was not completed and this
reading rests on those two observations — it should be confirmed before it is relied on.**

## ⚠️ The knowledge condition is unrepresentable today

"Only if that rate change is known at quote time" needs a **third date** on a tax record. The schema
has two:

- **`effective_from`** — when the law applies the rate
- **`applied_from`** — when CFS began charging it

Neither says **when the change became knowable**. A rate enacted in November effective 1 January is
knowable in November; one announced on 30 December is not. **The same `effective_from` produces
opposite answers under the owner's rule depending on a date nothing records.**

⇒ **`announced_at` (or `enacted_at`) is a required field**, and the rule becomes: for an order
priced on date **Q** covering a rental starting **S**, apply the rate effective at **S** _if_ the
change that produced it was announced on or before **Q**; otherwise hold the rate promised at **Q**
and absorb the difference.

⚠️ **"Absorb the difference" is a real cost and should be sized, not assumed small.** The 2026-01-01
change was **11% → 15%**, four points, and 48 charge windows cross a rate boundary.

## What follows for the spec

1. **A rental line's tax rate is a PROMISED value stored at pricing time**, not a derived one
   recomputed on read. Deriving it is what produces the 3,003 lines above.
2. **The ladder keys on `charge_start`**, so an order spanning a change needs a rate per charge
   window — not one rate per order.
3. **`announced_at` on the tax record**, or the knowledge condition cannot be evaluated at all.
4. ⚠️ **Golden vectors on both arms**: a change known at quote time (ladder up) and one not known
   (promise holds, CFS absorbs). **The second arm is the one nothing exercises today**, and an
   unexercised branch is a claim rather than a capability.
