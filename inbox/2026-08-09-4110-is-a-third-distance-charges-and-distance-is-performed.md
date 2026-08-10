---
kind: finding
title: 4110 is a third Distance Charges — so "a premium nobody performs" is false for a third of the account, and the same named surcharge posts to both 4100 and 4110
contexts: [ledger, billing]
source: "api:2026-08-09:db_invoices_query — all 9,194 revenue lines, 4110 decomposed by line name"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Found while checking what the delivery-only invoices actually contain. It refutes a premise that has
already reached two ADRs.

## The premise

ADR-0029, carried into ADR-0031 and `reporting/product-line-pl.yaml`, from the owner 2026-08-09:

> 4110 Delivery Surcharges is off-hours, rush or weekend, **which nobody performs**. […] the same
> crew does the same delivery on a Saturday, so the surcharge adds revenue and no cost.

And the consequence drawn from it: _delivery cost scales with 4100 service volume, so a model
predicting cost from total delivery revenue over-predicts in a surcharge-heavy period._

## What 4110 actually contains

Account-wide, all tracking categories, 999 invoices. 4110 totals **$45,776.06** (4100 totals
$500,887.75 — both figures span every product line on the account, not just `Delivery`).

| line name            |  lines |       revenue | share of 4110 |
| -------------------- | -----: | ------------: | ------------: |
| Off Hours Charge     |     51 |     17,040.00 |         37.2% |
| **Distance Charge**  | **41** | **15,250.00** |     **33.3%** |
| Weekend Charge       |     35 |     10,500.00 |         22.9% |
| Card Fee             |     42 |      1,986.06 |          4.3% |
| Rush Charge          |      1 |        500.00 |          1.1% |
| Weekend Charge - Old |      1 |        500.00 |          1.1% |

**A third of the account is a distance charge, and distance is performed.** Somebody drives the
extra miles. It burns fuel, it consumes crew hours, and it is the single clearest cost driver in the
whole delivery pool. "Nobody performs it" is true of off-hours, weekend and rush — **62.3%** — and
false of Distance.

**4.3% is not a delivery surcharge at all.** 42 lines named `Card Fee` post to 4110, a
payment-method fee sitting inside delivery revenue. Related: api-cloudrun#401 already moves Card Fee
off a `sale` line.

## The forecasting claim inverts for that third

The premise says surcharge revenue is a _bad_ cost predictor. For distance it is the **best** one
available: distance causes both the charge and the cost, so distance-surcharge revenue is a proxy
for exactly the driver nothing else records. A model predicting delivery cost from 4100 volume alone
will **under**-predict in a long-haul period — the opposite of the stated error, from the same
account.

This does not disturb ADR-0031's **basis**. Both accounts pool together and spread as one, which is
the point of the correction note that preceded it — the delivery line's margin includes both. What
it disturbs is the **rationale attached** to the split, which is now true of 62.3% of the account
and stated as though it were true of all of it.

## The coding is not consistent either

Where each named surcharge actually posts:

| line name              | 4100                     | 4110                  |
| ---------------------- | ------------------------ | --------------------- |
| Delivery/Setup/Removal | 327 lines / $163,410.25  | —                     |
| Weekend Charge         | —                        | 35 lines / $10,500.00 |
| Distance Charge        | **3 lines / $950.00**    | 41 lines / $15,250.00 |
| **Rush Charge**        | **12 lines / $3,000.00** | 1 line / $500.00      |

**Rush is on the wrong account 86% of the time by value** — the stated rule puts rush in 4110, and
$3,000 of $3,500 is on 4100. Distance leaks the other way on 3 lines.

So the 79.8% / 20.0% split between the two accounts is not a clean measurement of "service vs
premium"; it is that split _plus_ an unmeasured coding error in both directions. Anything that
reasons from the ratio — including the forecasting advice — inherits the error.

## What needs deciding

**Does `Distance Charge` belong on 4110 at all?** → OQ-032. It is the one line that is both a
surcharge and performed, so either 4110 stops meaning "not performed", or distance moves to 4100 and
4110 becomes homogeneous. The second makes the account mean something; it is also a restatement
under ADR-0020, which forbids altering any amount — moving a line between two revenue accounts does
not alter one, so it is in scope.

Nothing here changes a posting rule today. It changes what the ledger's own grouping can be _read_
as, which is the thing ADR-0029 says the un-allocated view is for.
