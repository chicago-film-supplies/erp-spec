---
id: ADR-0030
title: Vehicle cost moves from operating expense into COGS, absorbed and unabsorbed
status: proposed
date: 2026-08-09
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [ADR-0007, ADR-0019, ADR-0020, ADR-0026, ADR-0029, ADR-0031, SPIKE-005]
supersedes:
superseded_by:
---

> **In the context of** delivery being the largest tracked product line and carrying almost no cost,
> **facing** vehicle running costs sitting in operating expenses where no product line can see them,
> **we decided** to move vehicle cost into COGS on the same absorbed/unabsorbed shape ADR-0019 gave
> labour, **to achieve** a delivery cost that is complete enough to allocate, **accepting** a second
> utilisation measure to maintain and a mileage-or-hours basis that has to be captured.

## Context

- Vehicle costs are **operating expenses today**: 6400 Repairs & Maintenance, 6401 Registrations &
  Fees, 6402 Fuel, 6403 Parking & Tolls, 6404 Tickets. 2025 actuals total **$21,844.77**, plus
  vehicle depreciation against 1700/1701. ⚠️ **That total is UNPINNED and cannot be re-derived from
  this repo's permitted sources** — `chart-of-accounts` mirrors into Firestore without balances, and
  this repo does not call the Xero API. It is the number that sizes the whole decision. What would
  measure it is named in the survey.
- ⚠️ **The five accounts are not one block in the incumbent.** Measured 2026-08-16
  (`api:2026-08-16:db_chart_of_accounts_query`): 6401 is Xero type `Overhead`; the other four are
  `Expense`. Both render below gross profit, so the face of the P&L is unaffected — but a migration
  keyed on the account TYPE rather than the code range will split them.
- Nothing connects them to a job, so `Delivery` — **13.79% of revenue, $236,487.75**
  (`inbox/2026-08-10-the-untracked-revenue-denorm-is-repaired-and-28-7-percent-is-now-15-percent.md`)
  — carries essentially no cost, and the product-line P&L ADR-0029 specifies cannot be assembled. ⚠️
  Written here as 12.8% / $216,050 from the 2026-08-09 matrix, which read a denorm that was null on
  227 categorised lines (api-cloudrun#473, repaired 2026-08-10). Larger, not smaller — the argument
  for moving the cost is unaffected.
- **This is structurally the move ADR-0019 already made for wages**: 6600 Wages was an operating
  expense and became 5800/5801 in COGS. The owner has named vehicle COGS the next priority after
  labour. ⚠️ **The precedent transfers on the CLASSIFICATION and not on the MECHANISM** — see the
  survey, and the Decision below, which is where the first draft of this ADR was wrong.
- A vehicle has idle capacity in exactly the way a guaranteed crew day does — a van sitting on the
  lot costs insurance, registration and depreciation whether or not it runs.
- **Surveyed 2026-08-16**, per CLAUDE.md → _Accounting decisions_ — GAAP, Xero, SAP S/4HANA,
  NetSuite, Sage Intacct, Odoo, plus the equipment-rental industry's own published chart of
  accounts:
  `inbox/2026-08-16-survey-vehicle-cost-is-cost-of-rental-revenue-and-every-system-absorbs-it-at-a-rate-rather-than-recoding-the-purchase.md`.
  ⚠️ **This ADR carried no survey until then**, which is what had made it undecidable rather than
  merely undecided.

## Decision

Vehicle cost becomes **cost of goods sold**, split absorbed / unabsorbed on the ADR-0019 pattern:
running cost attributable to a causal job absorbs against that job, and the standing cost of having
a fleet at all is unabsorbed. Both are posted **un-allocated** per ADR-0029 — to `Delivery`, not
spread across the goods delivered — and the official product-line P&L performs the spread.

**The purchase keeps its natural account, and absorption is a separate period entry that relieves
it.** The natural account records WHAT WAS BOUGHT; the COGS account records WHY IT WAS CONSUMED.
Five of the six references keep those in different objects and derive the second from the first —
SAP by assessment through a secondary cost element, Intacct by dynamic allocation off a source
balance, NetSuite through a substituted contra account, Odoo through analytic distribution that
never touches the account at all. **The sixth is Xero, which recodes at entry because it has no
allocation engine** — a workaround of the incumbent, not a design to inherit.

## Consequences

- **Two new COGS accounts, adjacent, on the 5800/5801 precedent: `5900` absorbed and `5901`
  unabsorbed.** ⚠️ **The codes are now NAMED rather than deferred** — this ADR previously said "the
  chart picks the next free pair", which left `reporting/product-line-pl.yaml` with two pools
  carrying `cost_sources.pending` and nothing to name. Measured 2026-08-16: the live `Direct Costs`
  block is exactly nine accounts (5000, 5001, 5100, 5200, 5300, 5400, 5500, 5600, 5700), and 5150
  and 5800/5801 are already minted in the chart, so **5900 is the next free hundred** and 5901
  sub-numbers under it exactly as 5801 does under 5800.
- **A THIRD account, and it is the one that makes the split work: `6405 Vehicle: Cost Absorbed`, a
  credit-normal contra inside the vehicle block.** Each period: `Dr 5900` for the portion absorbed
  against causal jobs, `Dr 5901` for the residual, `Cr 6405` for the total — so 6400–6404 net to
  zero while their **gross** activity still answers "how much fuel did we buy". The alternative is
  crediting 6400–6404 directly; it is one account cheaper and destroys precisely that figure.
- ⚠️ **6400–6404 KEEP TAKING POSTINGS. This reverses a consequence of the first draft, which said
  they "stop taking new postings" — and the two halves of that draft could not both hold.** If the
  purchase posts straight into the COGS pair, the posting must choose absorbed or unabsorbed **at
  the pump**, where no causal job is known; everything would land unabsorbed, 5900 would never be
  debited, and the absorbed/unabsorbed gap would be identically the whole cost. The split needs a
  pool in between, and a pool is a natural account. **This is the disanalogy with 6600 Wages:** a
  shift names its job at the moment it happens, which is why `shift_recorded` debits 5800 per
  `shift.absorbed_allocations` and is finished. A tank of diesel names no job, and a registration
  fee names none even in principle.
- ⚠️ **Absorbing at a rate reintroduces the rate variance ADR-0019 dropped, and the unabsorbed
  account therefore means something different here than 5801 does.** ADR-0019 could say "absorption
  measures utilisation, **not** rate variance" because labour is costed at actual. **Vehicle cost
  cannot be**: the real cost of a van-day is unknowable until a transmission fails three years
  later, and registration and insurance have no per-job actual at all. So vehicle absorption is a
  **predetermined rate on a stated normal-capacity denominator** (ASC 330-10-30-3), and 5901's
  balance is utilisation **and** rate deviation, inseparable unless the denominator is stated. An
  unabsorbed account whose meaning is "one of two things, we do not know which" is the plug this ADR
  already warns about — so **the denominator is a requirement, not a footnote**.
- **The absorption basis is unresolved and is deliberately NOT decided here.** Labour had an obvious
  one — hours, which the shift already records. A vehicle's is mileage, or hours in service, or
  trips, and **none of those is captured today**. Choosing it decides what the fulfillment context
  must record on a leg, so it is a data-capture requirement before it is an accounting one — and per
  erp-spec#12 **the same capture decision gives `trip_travel` its basis and upgrades ADR-0031's
  official allocation from Horngren tier 4 to tier 1.** Deciding it inside this ADR decides it
  twice, on less evidence. It stays with #12.
- **A second utilisation number appears**, and it is genuinely useful: the gap between absorbed and
  unabsorbed vehicle cost is fleet utilisation, the same shape as crew utilisation. It is also a
  second thing to keep honest, with the same trap — an unabsorbed account that can be dimensioned
  becomes a plug.
- **Depreciation is the awkward part and is deliberately deferred.** Vehicle depreciation belongs in
  the same absorbed/unabsorbed treatment, but it is computed by the engine SPIKE-005 has not chosen
  and it differs per book under ADR-0026. Bringing running costs across first, and depreciation when
  the engine exists, is the sequencing this ADR assumes. ⚠️ **The deferral has a PRESENTATION
  consequence, not just a completeness one.** SAB Topic 11.B (ASC 220-10-S99-8): where depreciation
  related to the cost-generating activity is excluded from a cost-of-sales line, the line must be
  labelled to say so and **a gross margin should not be presented** against it. The interim state is
  therefore a cost-of-sales line that cannot carry an unqualified gross margin — which is exactly
  what the product-line P&L reports.
- ⚠️ **The migration delta is a COMPARABILITY BREAK, not a movement of money.** Net profit is
  unchanged; gross profit falls by the vehicle total. History is **not** restated — 6400–6404 stay
  in the chart for historical periods, the same treatment 6600 Wages receives under ADR-0019 — so
  **gross margin is not comparable across the cutover**, and that must be stated rather than
  inferred. Because it is prospective-only it is a **third** restatement axis beside ADR-0020's
  dimensions and ADR-0032's identity, and unlike those two it does **not** join m6's ordering
  obligation.
- **Tickets (6404, $3,635.88 in 2025) do NOT absorb and 6404 does not move.** A parking fine is not
  a cost of serving a job; it is a cost of how a job was served, and absorbing it into a product
  line would make a product look expensive because someone parked badly. The survey supplies the
  reason the first draft was missing: a fine is nondeductible (IRC §162(f)) and therefore a
  permanent Schedule M-1 difference that **ADR-0026 keeps out of both books** — and an account
  absorbed into a product line is no longer separable for that purpose. 6403 Parking & Tolls is the
  opposite case and stays in: tolls are deductible and are incurred by a specific run.

## What the owner is being asked

Four rulings, each answerable in a sentence. The recommendation is the survey's, and it is stated so
that a bare "yes" accepts the ADR as written.

1. **Vehicle running cost becomes a cost of revenue.** ⇒ **Rec: yes.** CFS _sells_ the activity that
   consumes it (13.79% of revenue), so it is a cost applicable to that revenue under Reg S-X
   210.5-03(b)(2); the equipment-rental industry's own chart of accounts puts fuel, repairs and
   transportation in cost of rental revenue. Departing from Xero here departs from a bookkeeping
   default, not from a rule.
2. **The purchase keeps its natural account; absorption is a period entry that relieves it into
   COGS.** ⇒ **Rec: yes.** This is the reversal above, and it is not a preference between two
   workable designs — the drafted alternative cannot produce the split the same ADR requires.
3. **Accounts: mint `5900` / `5901`, plus the `6405` contra.** ⇒ **Rec: yes**, or "yes but credit
   6400–6404 directly" if the gross fuel figure is not worth an account.
4. **6404 Tickets never absorbs and stays in operating expenses.** ⇒ **Rec: yes.**

⚠️ **Accepting this unblocks ONE of erp-spec#12's three pools, not #12.** `trip_travel` still needs
the leg-capture decision, and `warehouse_overhead` still needs an ADR nobody has written. What it
does close immediately is the `cost_sources.pending` on the `delivery` and `transport` pools in
`reporting/product-line-pl.yaml`, which currently name this ADR as the reason their cost side is
incomplete.
