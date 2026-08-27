---
id: ADR-0029
headline: the ledger does not allocate
title: The ledger records un-allocated facts; allocation is a specified reporting act
status: accepted
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [
  ADR-0014,
  ADR-0017,
  ADR-0018,
  ADR-0019,
  ADR-0025,
  ADR-0031,
  ADR-0036,
  HOT-021,
  OQ-006,
  OQ-018,
]
accounting_shaped: true
survey:
  - inbox/2026-08-20-survey-nobody-keeps-allocations-out-of-the-ledger-they-keep-them-out-of-the-statements.md
supersedes:
superseded_by:
frozen_sha256: 3adb98ab8e3406340fbead1395429930edb8874003b762685aa3439ed4c464a1
---

> **In the context of** labor and vehicle costs arriving in the ledger for the first time,
> **facing** a choice about whether a delivery's cost is posted to the goods it delivered or to
> delivery itself, **we decided** that the ledger records costs and revenues at the grain they
> occurred and never allocates, and that allocation happens once, in a specified report, **to
> achieve** a record that can answer questions nobody has asked yet, **accepting** that the
> un-allocated view shows the largest tracked product line running at a structural loss and must
> never be read as a managed P&L.

## Context

- **An un-allocated posting that carries its causal order can be allocated downstream by any basis a
  question needs.** The reverse is not free: recovering the original grain from an allocated posting
  requires that the implementation deliberately preserved it. ⚠️ **This bullet read "Allocation is
  destructive; grouping is not" until 2026-08-22, and the rule 8a survey this ADR cites refutes that
  as stated** (HOT-021). **SAP `distribution` keeps the grain while posting; `overhead allocation`
  destroys it — and SAP forces the choice per cycle.** NetSuite's credit-account mode and Sage
  Intacct's segregated book each keep both grains while posting. ⇒ **Destructiveness is a property
  of the primitive chosen, not of allocation.** The claim was too strong, and the decision never
  needed it — see the Decision's stated reason below.
- ⚠️ **Three of five surveyed systems post allocations, two have no allocation engine at all, and
  NONE derives at report time.** By the default alone this decision departs from every reference
  that has the feature, which is a claim that needs an argument rather than an assumption.
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
  of revenue** (`ADR-0030/M2` owns that figure; this ADR cites it. Re-measured 2026-08-16,
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

## Considered options

⚠️ **This section did not exist until 2026-08-22.** The survey's sharpest finding was not that the
ADR chose wrongly but that **it never considered the family every reference actually implements**
(HOT-021).

- **Post the allocation to the general ledger, destroying the original grain.** Rejected, and this
  is the only option the ADR originally argued against. SAP's `overhead allocation` is this, and SAP
  itself treats it as the heavier end of a six-rung permanence ladder.
- ⭐ **Post the allocation to the ledger while PRESERVING the original grain — keep it out of the
  STATEMENTS rather than out of the LEDGER.** _The option nobody here had considered, and the one
  they all implement._ Three shapes: SAP's `S Secondary Costs` account type, Sage Intacct's
  mandatory user-defined allocation book, NetSuite's contra credit account. **Rejected, but on a
  narrow and stateable ground rather than by omission**: each gives the allocated number a document
  number, and _a number whose correctness depends on a basis `ADR-0031` itself calls the weakest
  defensible tier should not be given one._ That is SAP's own second criterion for choosing a
  primitive, and it is the argument this decision actually rests on.
- **Derive the allocation at report time, posting nothing** (chosen). ✅ **It has a production
  precedent that had not been cited**: Deltek Vision — _"Overhead allocation does not impact the
  general ledger… they are not posted to the database"_ — with **year-to-date recomputation**, which
  is the same idempotence property as `sealed_at_close: false`. ⚠️ **The known cost is real and
  documented**: reporting-layer allocations rot. A posted allocation is maintained because the close
  cannot finish without it, and nothing yet makes the official product-line P&L a thing that must
  keep working.

## Consequences

- ⚠️ **The un-allocated view will show Delivery at a large loss, by construction, and that is not a
  finding.** Delivery revenue is a surcharge on orders; delivery cost is crew plus vehicle. The two
  were never meant to cover each other. **Anyone reading the un-allocated P&L as a managed report
  will conclude delivery should be cut — which would cut product revenue.** This is the single most
  likely misreading of the whole design and it is why the official allocated P&L exists.
- **The allocated number is the managed number.** "True income from product" requires the
  allocation; the ledger's own grouping is an input to it, not a substitute.
- **The allocation basis must be stated once rather than chosen per report**, or two reports will
  disagree about the margin on the same product line. That is the real cost of this decision and the
  reason the allocation is _specified_ rather than merely _permitted_. ⚠️ **This bullet read "the
  allocation basis is a decision that has not been made — by revenue, by weight, by item count, by
  line count" until 2026-08-24, and this same document contradicts that twice**: `ADR-0031`
  (allocate by goods revenue on the causal order) makes exactly that choice, and the Considered
  options above already lean on it — _"a basis ADR-0031 itself calls the weakest defensible tier"_.
  ⇒ **the basis IS decided, in ADR-0031, which is `proposed`.** What this ADR places on the
  reporting spec is the requirement that there be **one** stated basis, not the choice of which.
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

- ⚠️ **ASC 280's hook is a BILL, and one line of it is unpaid.** 280-10-50-27 never mentions posting
  — the test is membership of the measure the chief operating decision maker actually uses, which
  runs both ways and treats the ledger as an input rather than the authority. But 50-29(b) requires
  the allocation policy disclosed, (d) requires method changes and **their effect** quantified, (e)
  requires **asymmetrical allocations** disclosed, and **50-30 requires reconciliation to the
  consolidated totals.** `ADR-0031`'s `basis_version` and `sealed_at_close: false` satisfy the first
  three by construction. ⚠️ **The reconciliation is stated nowhere in the reporting spec** — and it
  is the obligation that makes the un-allocated view load-bearing rather than merely available,
  because it is what forces the derived statement to tie back to the book. ASC 280 exempts nonpublic
  entities (280-10-15-2 "encourages" rather than requires), so this is a criterion for CFS and not a
  requirement — but it is the criterion this whole decision is measured against.
- ✅ **"Recast", not "restate", is the word for a change in allocation method** — ASU 2023-07 chose
  it deliberately, because Topic 250 reserves "restatement" for correcting an error. `ADR-0020`
  carries the same correction.
