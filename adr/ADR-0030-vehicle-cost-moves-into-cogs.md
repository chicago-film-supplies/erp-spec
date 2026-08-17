---
id: ADR-0030
title: Vehicle cost moves from operating expense into COGS, absorbed and unabsorbed
status: proposed
date: 2026-08-09
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [
  ADR-0007,
  ADR-0011,
  ADR-0019,
  ADR-0020,
  ADR-0026,
  ADR-0027,
  ADR-0029,
  ADR-0031,
  SPIKE-005,
]
supersedes:
superseded_by:
---

> **In the context of** delivery being the largest tracked product line and carrying almost no cost,
> **facing** vehicle running costs sitting in operating expenses where no product line can see them,
> **we decided** to move vehicle cost into COGS on the same absorbed/unabsorbed shape ADR-0019 gave
> labour, absorbing on the shift's own allocation rows at a rate per computed mile, **to achieve** a
> delivery cost that is complete enough to allocate, **accepting** a second utilisation measure to
> maintain and a rate variance that labour does not have.

## Context

- Vehicle costs are **operating expenses today**: 6400 Repairs & Maintenance, 6401 Registrations &
  Fees, 6402 Fuel, 6403 Parking & Tolls, 6404 Tickets. 2025 actuals total **$21,844.77**, plus
  vehicle depreciation against 1700/1701. ⚠️ **That total is UNPINNED and cannot be re-derived from
  this repo's permitted sources** — `chart-of-accounts` mirrors into Firestore without balances, and
  this repo does not call the Xero API. It is the number that sizes the whole decision, and it is
  also **understated**, because it omits rented vehicles (below). What would measure it is named in
  the survey.
- ⚠️ **The five accounts are not one block in the incumbent.** Measured 2026-08-16
  (`api:2026-08-16:db_chart_of_accounts_query`): 6401 is Xero type `Overhead`; the other four are
  `Expense`. Both render below gross profit, so the face of the P&L is unaffected — but a migration
  keyed on the account TYPE rather than the code range will split them.
- ⚠️ **A SIXTH stream of vehicle cost exists and this ADR did not see it: RENTED vehicles.** Owner,
  2026-08-16: _"we also rent vehicles for delivery (currently in rented equipment, mostly from
  Chicagoland Truck Rental)"_ — so delivery vehicle cost is being incurred in
  `6302 Rented Tools,
  Machinery, Equipment` as well. **6302's own chart entry already says this is
  wrong**: its note reads _"Equipment rented for CFS's own use. Equipment rented IN to fill a
  customer order is a subrental and goes to 5100 — the distinction is whether an order caused it."_
  A truck hired to run a delivery **is caused by an order**. It does not belong in 5100 either — a
  subrental is gear CFS **supplies** to the customer, and a rented truck is a means of
  **performing**.
- ⚠️ **The two owned vehicles are used EXCLUSIVELY for delivery and trash removal**, and that fact
  removes the allocation question rather than answering it. Owner, 2026-08-16. Incidental
  administrative use exists (hardware runs, meals) and is immaterial.
- Nothing connects them to a job, so `Delivery` — **13.79% of revenue, $236,487.75**
  (`inbox/2026-08-10-the-untracked-revenue-denorm-is-repaired-and-28-7-percent-is-now-15-percent.md`)
  — carries essentially no cost, and the product-line P&L ADR-0029 specifies cannot be assembled. ⚠️
  Written here as 12.8% / $216,050 from the 2026-08-09 matrix, which read a denorm that was null on
  227 categorised lines (api-cloudrun#473, repaired 2026-08-10). Larger, not smaller — the argument
  for moving the cost is unaffected.
- **This is structurally the move ADR-0019 already made for wages**: 6600 Wages was an operating
  expense and became 5800/5801 in COGS. ⚠️ **The precedent transfers on the CLASSIFICATION and on
  the ACCOUNTS, and NOT on the costing basis** — see the Decision, which is where the first draft of
  this ADR was wrong.
- A vehicle has idle capacity in exactly the way a guaranteed crew day does — a van sitting on the
  lot costs insurance, registration and depreciation whether or not it runs.
- **Surveyed 2026-08-16**, per CLAUDE.md → _Accounting decisions_ — GAAP, Xero, SAP S/4HANA,
  NetSuite, Sage Intacct, Odoo, plus the equipment-rental industry's own published chart of
  accounts:
  `inbox/2026-08-16-survey-vehicle-cost-is-cost-of-rental-revenue-and-every-system-absorbs-it-at-a-rate-rather-than-recoding-the-purchase.md`.
  ⚠️ **This ADR carried no survey until then**, which is what had made it undecidable rather than
  merely undecided.
- **Owner rulings taken 2026-08-16**, after the survey:
  `inbox/2026-08-16-owner-rulings-vehicles-are-exclusively-revenue-producing-rented-trucks-join-the-pool-and-the-basis-is-computed-distance.md`.

## Decision

Vehicle cost becomes **cost of goods sold**, split absorbed / unabsorbed on the ADR-0019 pattern:
running cost attributable to a causal job absorbs against that job, and the standing cost of having
a fleet at all is unabsorbed. Both are posted **un-allocated** per ADR-0029 — to `Delivery`, not
spread across the goods delivered — and the official product-line P&L performs the spread.

**Every vehicle dollar is in scope, whether the vehicle is owned or rented.** A truck hired to run a
delivery is the same economic activity as a van driven to run one, so it takes the same
classification. It moves out of `6302 Rented Tools, Machinery, Equipment` and into the vehicle
block.

**No mixed-use allocation is performed, and that is a stated policy rather than an omission.** The
owned vehicles are used exclusively in revenue-producing delivery and trash-removal activity;
incidental administrative use is immaterial and is not allocated out. There is no GAAP de minimis
threshold — materiality governs — so the policy is recorded here so that its consistency is
auditable and a later change is visible as a change.

**The purchase keeps its natural account, and absorption is a separate period entry that relieves
it.** The natural account records WHAT WAS BOUGHT; the COGS account records WHY IT WAS CONSUMED.
Five of the six references keep those in different objects and derive the second from the first —
SAP by assessment through a secondary cost element, Intacct by dynamic allocation off a source
balance, NetSuite through a substituted contra account, Odoo through analytic distribution that
never touches the account at all. **The sixth is Xero, which recodes at entry because it has no
allocation engine** — a workaround of the incumbent, not a design to inherit.

**Absorption rides the SHIFT'S OWN ALLOCATION ROWS.** A delivery, trucking or trash-removal job
generates a shift (ADR-0011, OQ-010), and that shift already carries hours, a causal job and a
`labor_line`. Vehicle cost absorbs against the same rows labour does — same source event, same
causal job, same `labor_line` — at a rate applied to a different quantity. Two consequences, and the
second is what makes the design cheap:

- **the Delivery / Trash & Cleanup split comes for free.** The two are different product lines with
  different treatments — `Delivery` spreads onto the goods it delivered, `Trash & Cleanup` is
  severable and keeps its own margin — so a single undifferentiated vehicle pool could not serve
  both. The shift's `labor_line` already says which, so the vehicle cost inherits the answer instead
  of needing an allocation of its own;
- **it needs no new event, no new document and no new key.** The absorption is a second amount on a
  row that already exists.

**The quantity is COMPUTED DISTANCE, plausibility-gated.** Destination coordinates already exist
(`destinations.address.address_coordinates`, Mapbox, ADR-0027), so warehouse-to-destination distance
is derivable today without capturing anything new. ⚠️ **The gate is not optional and is specified in
the Consequences** — a wrong coordinate is a valid-looking number, and an ungated distance basis
would silently bill a Chicago delivery as though the van had driven to Phoenix.

## Consequences

### The accounts

**Natural — what was bought. These KEEP taking postings.**

| code     |                                |                                                |
| -------- | ------------------------------ | ---------------------------------------------- |
| 6400     | Vehicle: Repairs & Maintenance | live, unchanged                                |
| 6401     | Vehicle: Registrations & Fees  | live, unchanged                                |
| 6402     | Vehicle: Fuel                  | live, unchanged                                |
| 6403     | Vehicle: Parking & Tolls       | live, unchanged                                |
| 6404     | Vehicle: Tickets               | live, unchanged — **never absorbs**, see below |
| **6405** | **Vehicle: Rented**            | **minted**; receives what 6302 takes today     |
| **6409** | **Vehicle: Cost Absorbed**     | **minted**, credit-normal contra               |

**COGS — why it was consumed. Minted, on the 5800/5801 precedent.**

| code     |                                          |
| -------- | ---------------------------------------- |
| **5900** | Cost of Goods Sold: Vehicle (Absorbed)   |
| **5901** | Cost of Goods Sold: Vehicle (Unabsorbed) |

Each period: `Dr 5900` for the portion absorbed against causal jobs, `Dr 5901` for the residual,
`Cr 6409` for the total — so 6400–6403 and 6405 net to zero while their **gross** activity still
answers "how much fuel did we buy, how much was repairs, how much did we hire in". The alternative
is crediting the natural accounts directly; it is one account cheaper and destroys precisely that
figure. **5900 is the next free hundred** — measured 2026-08-16, the live `Direct Costs` block is
exactly nine accounts (5000, 5001, 5100, 5200, 5300, 5400, 5500, 5600, 5700), with 5150 and
5800/5801 already minted.

- ⚠️ **6400–6405 KEEP TAKING POSTINGS. This reverses a consequence of the first draft, which said
  they "stop taking new postings" — and the two halves of that draft could not both hold.** If the
  purchase posts straight into the COGS pair, the posting must choose absorbed or unabsorbed **at
  the pump**, where no causal job is known; everything would land unabsorbed, 5900 would never be
  debited, and the absorbed/unabsorbed gap would be identically the whole cost. The split needs a
  pool in between, and a pool is a natural account. **This is the disanalogy with 6600 Wages:** a
  shift names its job at the moment it happens, which is why `shift_recorded` debits 5800 per
  `shift.absorbed_allocations` and is finished. A tank of diesel names no job, and a registration
  fee names none even in principle.
- **Rented vehicles are POOLED, not absorbed at actual.** A rental invoice for a specific job names
  that job, which is better information than the pool needs — the shape 5200 Subcontractors already
  handles. It is deliberately not used: one mechanism for all vehicle cost is simpler to specify and
  to explain, and the per-job detail on the invoice remains available if a later ADR wants it. ⚠️ It
  follows that the rate's denominator must include rented mileage, or rented spend is absorbed
  twice.

### The rate, and the variance labour does not have

- ⚠️ **Absorbing at a rate reintroduces the rate variance ADR-0019 dropped, and 5901 therefore means
  something different from 5801.** ADR-0019 could say "absorption measures utilisation, **not** rate
  variance" because labour is costed at actual, from a real per-contact wage on a real bill.
  **Vehicle cost cannot be**: the real cost of a van-day is unknowable until a transmission fails
  three years later, and registration and insurance have no per-job actual at all. So vehicle
  absorption is a **predetermined rate on a stated normal-capacity denominator** (ASC 330-10-30-3),
  and 5901's balance is utilisation **and** rate deviation together. **The denominator is a
  requirement, not a footnote** — an unabsorbed account whose meaning is "one of two things, we do
  not know which" is the plug this ADR already warns about.
- **Two variances, and they are calibrated differently.** Owner, 2026-08-16: _"we should record
  actuals from time to time if appropriate, there will be some variance."_ The **base** variance is
  computed distance against miles actually driven — a round trip is twice a one-way distance, a
  multi-stop run is **less** than the sum of its legs, and a van idling on set covers no distance at
  all. The **rate** variance is assumed cost per mile against actual. **Periodic odometer and fuel
  sampling calibrates the RATE, not the base**, and the two must be reported separately or 5901
  becomes uninterpretable again.
- **The basis is versioned** (`reporting/allocation-bases.yaml`'s discipline) — two periods computed
  at different rates would disagree about the same job's margin, which is the failure ADR-0029
  exists to prevent. A later composite of distance and time supersedes rather than mutates. ⚠️
  Distance and time measure genuinely different things: fuel scales with distance, depreciation and
  the van's opportunity cost scale with time. Distance alone is the choice, taken deliberately,
  because it is the larger driver in this business and it is available today.

### The plausibility gate

⚠️ **A wrong coordinate is a valid-looking number, and this corpus contains them.** Measured
2026-08-16 across the first 200 of 459 destinations (`api:2026-08-16:db_destinations_query`):
roughly half carry no coordinates at all, and among those that do, several are badly wrong —
`TBD, Chicago, IL` resolved near Bloomington; `60098 Mill Hill Road, Woodstock` resolved to **New
York state** because the ZIP was parsed as a street number; a Louisville PO box resolved to
**Kansas**; `2258 West 16th Street` resolved to **Davenport, Iowa**.

✅ **The discriminator is already in the data, and it is not a distance heuristic.** Every wrong
geocode found carries a `mapbox_id` beginning `urn:mbxadr-itp:` — Mapbox's **interpolated** result,
its fallback when it cannot match a real address — where correctly resolved rows carry
`urn:mbxadr:`. ⚠️ **The implication is one-way**: every bad one is interpolated, and not every
interpolated one is bad (`825 E Erie` is `-itp` and correct). So it screens rather than decides, and
it pairs with a service-radius bound.

⇒ **A destination whose coordinates fail the gate is QUARANTINED and does not enter the
allocation.** It must not fall back to zero distance, which would silently under-absorb, nor to an
average, which would silently invent one.

- ✅ **The population is bounded and shrinking, and that is why this is a migration finding rather
  than a design problem.** Owner, 2026-08-16: destinations are authored through CRMS today and will
  be set by **manager's Mapbox autofill** after the cutover, which returns a matched feature rather
  than free text to be geocoded afterwards. So the defect stops being produced, and what remains is
  a fixed backfill of 459 records at migration time. **The gate still ships** — a bad geocode can
  recur, and a check that exists only until the data is clean is a check that is removed the week
  before it is needed.

### The rest

- **A second utilisation number appears**, and it is genuinely useful: the gap between absorbed and
  unabsorbed vehicle cost is fleet utilisation. It is also a second thing to keep honest, with the
  same trap — an unabsorbed account that can be dimensioned becomes a plug.
- **Depreciation is deliberately deferred**, and exclusive use makes the deferral purely mechanical
  rather than a judgement: there is no allocation to argue about, only SPIKE-005's engine to choose,
  and it differs per book under ADR-0026. ⚠️ **The deferral has a PRESENTATION consequence.** SAB
  Topic 11.B (ASC 220-10-S99-8): where depreciation related to the cost-generating activity is
  excluded from a cost-of-sales line, the line must be labelled to say so and **a gross margin
  should not be presented** against it. The interim state is therefore a cost-of-sales line that
  cannot carry an unqualified gross margin — which is exactly what the product-line P&L reports.
- **Retrieving inventory from a vendor is a THIRD treatment and is not delivery COGS.** Owner,
  2026-08-16: the vans occasionally collect stock from a local vendor. Under ASC 330-10-30-1 (and
  ASC 360 for a rental asset) that is **freight-in** — part of the cost of acquiring the item, so it
  capitalises into the inventory or the asset and reaches the P&L as cost of sale or as
  depreciation, not when the fuel was burned. Immaterial in this corpus and named so it is not
  silently swept into the delivery pool.
- **Tickets (6404, $3,635.88 in 2025) do NOT absorb and 6404 does not move.** A parking fine is not
  a cost of serving a job; it is a cost of how a job was served, and absorbing it into a product
  line would make a product look expensive because someone parked badly. The survey supplies the
  reason the first draft was missing: a fine is nondeductible (IRC §162(f)) and therefore a
  permanent Schedule M-1 difference that **ADR-0026 keeps out of both books** — and an account
  absorbed into a product line is no longer separable for that purpose. 6403 Parking & Tolls is the
  opposite case and moves: tolls are deductible and are incurred by a specific run.
- ⚠️ **The migration delta is a COMPARABILITY BREAK, not a movement of money.** Net profit is
  unchanged; gross profit falls by the vehicle total. History is **not** restated — 6400–6404 stay
  in the chart for historical periods, the same treatment 6600 Wages receives under ADR-0019 — so
  **gross margin is not comparable across the cutover**, and that must be stated rather than
  inferred. Because it is prospective-only it is a **third** restatement axis beside ADR-0020's
  dimensions and ADR-0032's identity, and unlike those two it does **not** join m6's ordering
  obligation.
- ⚠️ **This unblocks ONE of erp-spec#12's three pools.** `trip_travel` still needs the inner
  allocation from one shared run to the several orders it served, and **computed distance does not
  supply it**: distance says how far a destination is, not which orders shared a van. The distance
  half of that blocker exists; the trip-grouping half does not. `warehouse_overhead` still needs an
  ADR nobody has written.
