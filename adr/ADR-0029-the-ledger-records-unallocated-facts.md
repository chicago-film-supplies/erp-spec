---
id: ADR-0029
title: The ledger records un-allocated facts; allocation is a specified reporting act
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [ADR-0014, ADR-0017, ADR-0018, ADR-0019, ADR-0025, OQ-006, OQ-018]
supersedes:
superseded_by:
---

> **In the context of** labor and vehicle costs arriving in the ledger for the first time,
> **facing** a choice about whether a delivery's cost is posted to the goods it delivered or to
> delivery itself, **we decided** that the ledger records costs and revenues at the grain they
> occurred and never allocates, and that allocation happens once, in a specified report, **to
> achieve** a record that can answer questions nobody has asked yet, **accepting** that the
> un-allocated view shows the largest tracked product line running at a structural loss and must
> never be read as a managed P&L.

## Context

- **Allocation is destructive; grouping is not.** An un-allocated posting that carries its causal
  order can be allocated downstream by any basis a question needs. An allocated posting cannot be
  un-allocated — the fact that the cost was _delivery_ is gone from the ledger, and only the source
  documents remember.
- The repo has already landed on this principle three times without naming it. **ADR-0014** derives
  lifecycle rather than assigning it. **ADR-0017** makes TigerBeetle balance-integrity and reporting
  a projection. **ADR-0018** keeps the chart plain expressly so it does not explode into reporting
  axes. The `amount:`-is-a-path fence in `ledger/posting-rules.yaml` keeps computation out of
  posting rules for the same reason. Four decisions, one unstated principle — so the next "should we
  allocate X" question has been re-argued from scratch every time.
- **Delivery is not a severable business.** Owner, 2026-08-09: "we wouldn't do a delivery with no
  products, we would rent far fewer products if we weren't delivering them." Delivery cost is a
  **joint cost** of the product revenue, not the cost of a product called delivery.
- **`Delivery` is the largest tracked product line in the business — 537 lines, $236,487.75, 13.79%
  of revenue** (re-measured 2026-08-16,
  `inbox/2026-08-16-the-product-line-matrix-rebuilt-with-the-master-join-denorm-and-master-now-agree-on-every-line.md`;
  534 / $234,987.75 / 13.91% on 2026-08-10). It currently has almost no cost against it, because
  labor and vehicle costs are not in the ledger yet. ⚠️ The figures first written here — 473 lines,
  $216,050, 12.8% — came from `inbox/2026-08-09-product-line-by-revenue-account-matrix.md`, which
  counted `tracking_category` on the invoice line. That denorm was null on 227 lines whose product
  master **was** categorised (api-cloudrun#473, repaired 2026-08-10). The rank is unchanged and the
  conclusion below is unaffected; the size is not.
- The taxonomy mixes categories of **goods** with categories of **activity**, and the mix is not
  stable: of **five** activity lines **two are material** — `Delivery` 13.79% and `Trash & Cleanup`
  8.45%, together 22.2% of revenue — `Transport` (trucking) is 1.98%, and two are small (`Shipping`
  0.33%, `Crew` 0.21%); re-measured 2026-08-16. `Transaction Fees` **left the dimension** on
  2026-08-16 (OQ-032) — a card fee is caused by how the customer paid, not by what was supplied —
  and its 123 lines / $5,109.67 are still in the corpus awaiting an ADR-0020 restatement. An
  operator facing a line that has a product picks the product. ⚠️ This bullet originally read "one
  carries 12.8%, two are rounding errors, and `Transport` had never been used at all and has been
  dropped." All three clauses were artifacts of the same broken denorm. `Trash & Cleanup` is not a
  rounding error — it is **70 lines, $144,975.00, the third largest line in the business**, measured
  at $1,750 only because its lines were among the 227. `Transport` was used continuously — 23 lines,
  $39,665.00, 2.31% — and it **was restored as a fifth activity line that does not spread** (OQ-034,
  2026-08-16), split from `Shipping` on the account it already sat on. **The argument this bullet
  supports gets stronger, not weaker:** two material activity lines make the allocation question
  larger than it looked.

## Decision

**The ledger records what happened, at the grain it happened, un-allocated.** A posting carries its
causal order, its dimensions and its source document — enough for any allocation to be performed
later — and performs none itself.

**Allocation is a reporting act, and there is exactly ONE official allocation**: the standardized
**product-line P&L**, which spreads activity costs and activity revenues across the goods on the
orders that caused them. It is specified once, versioned, and reproducible — not composed per
analyst and not per query.

Both views are legitimate and they answer different questions:

| View                                          | Reads                            | Answers                                              |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| **Un-allocated** (the ledger's own grouping)  | postings as posted               | what did delivery cost us; what did we charge for it |
| **Allocated** (the official product-line P&L) | postings + the stated allocation | what does a product line really earn, delivered      |

## Consequences

- ⚠️ **The un-allocated view will show Delivery at a large loss, by construction, and that is not a
  finding.** Delivery revenue is a surcharge on orders; delivery cost is crew plus vehicle. The two
  were never meant to cover each other. **Anyone reading the un-allocated P&L as a managed report
  will conclude delivery should be cut — which would cut product revenue.** This is the single most
  likely misreading of the whole design and it is why the official allocated P&L exists.
- **The allocated number is the managed number.** "True income from product" requires the
  allocation; the ledger's own grouping is an input to it, not a substitute.
- **The allocation basis is a decision that has not been made** — by revenue, by weight, by item
  count, by line count. It belongs to the reporting spec, and it must be stated once rather than
  chosen per report, or two reports will disagree about the margin on the same product line. That is
  the real cost of this decision and the reason the allocation is _specified_ rather than merely
  _permitted_.
- **Delivery revenue spans two accounts and BOTH are the Delivery product line.** Owner, 2026-08-09:
  4100 Service Income is the delivery/setup/removal charge — a service performed by a person, and
  labor-bearing; 4110 Delivery Surcharges is off-hours, rush, weekend or distance. ⚠️ **This bullet
  said 4110 "is off-hours, rush or weekend, WHICH NOBODY PERFORMS", and that gloss is retracted
  (OQ-032, owner 2026-08-16).** It was wrong about a third of the account — distance is 33.3% of it
  and somebody drives those miles — and wrong about the question. Owner: "the performance is the
  delivery, the distance surcharge is because it takes longer, the rush surcharge is because it was
  unplanned." **4110 carries a premium priced for a CONDITION of the job**, not for a separately
  performed thing; the account's own name already said so. Measured 79.8% / 20.0%, and ⚠️ that split
  carries an unmeasured coding error until the OQ-032 restatement runs — `Rush Charge` is on 4100
  for 86% of its value against the stated rule. The two accounts exist because the two revenues have
  different **cost causation**, not because they are different product lines: the same crew does the
  same delivery on a Saturday, so the surcharge adds revenue and no cost — OQ-006's ruling that "the
  premium the customer pays is margin, not cost". So the delivery line's margin includes **both**,
  and both are allocated across the order's goods by whatever basis the official P&L states. What
  the split is good for is **forecasting**: delivery cost scales with the 4100 service volume, and a
  model predicting cost from total delivery revenue will over-predict in a surcharge-heavy period.
  ⚠️ **That forecasting claim is WRONG FOR DISTANCE, and the direction INVERTS** (OQ-032, owner
  2026-08-16). It rests on "the surcharge adds revenue and no cost". The extra cost of a distant
  delivery is "the opportunity cost of the team being gone longer (and thus unavailable for a second
  delivery), and additional gas" — three components, and only one of them is an entry: **wage** is
  unchanged, so OQ-006's "the premium is margin, not cost" holds for labor; **fuel** is a real
  incremental cost and lands in vehicle COGS (ADR-0030); **opportunity cost** is real and
  deliberately NOT booked — ADR-0019's absorption model already expresses it, because the long haul
  absorbs its person-day into 5800 while no second job absorbs the rest of the day, and the
  shortfall surfaces as 5801 Unabsorbed Labor. That is HOT-010's "absorption measures UTILISATION",
  and it answers HOT-004 without loading a premium onto the job. ⇒ a model predicting delivery cost
  from 4100 volume alone **under-predicts** in a long-haul period, and distance-surcharge revenue is
  the best available proxy for a driver nothing else records. Out-of-hours and weekend stay
  unreconciled — they cost more in WAGE where distance costs more in FUEL — and that is the narrower
  question this bullet now leaves open.
- **Activity product lines are kept, not dropped.** `Delivery` is where the un-allocated activity
  revenue and its cost meet; deleting it would force the allocation into the posting, which is the
  destructive direction. The mixed-basis taxonomy is tolerable _because_ the ledger does not
  allocate — it would be intolerable if it did, because activity lines would then hold revenue with
  no cost.
- **Every posting must carry its causal order**, or allocation is impossible and this decision
  quietly becomes "never allocate". That is the load-bearing requirement this ADR places on every
  future posting rule.
- **This governs the questions not yet asked.** Vehicle COGS, trip travel cost, warehouse overhead
  and any future shared cost are all the same shape, and the answer is now stated once instead of
  re-argued each time.
