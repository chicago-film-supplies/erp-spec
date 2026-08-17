---
kind: decision
title: >-
  Owner rulings on ADR-0030 — the vans are used EXCLUSIVELY for delivery and trash, rented trucks
  join the same pool, absorption rides the shift's allocation rows, and the basis is computed Mapbox
  distance rather than mileage nobody captures
contexts: [ledger, fulfillment]
source: "Owner, 2026-08-16, in session, after the six-reference survey"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Taken in one sitting, immediately after the survey
(`inbox/2026-08-16-survey-vehicle-cost-is-cost-of-rental-revenue-and-every-system-absorbs-it-at-a-rate-rather-than-recoding-the-purchase.md`).
**Three of the seven rulings changed the ADR's shape rather than confirming it**, and two of those
came from facts about the business the ADR had never been told.

## 1. The vehicles are used EXCLUSIVELY for delivery and trash removal

> _"we own 2 vehicles, both are exclusively used for delivery and trash removal … theres some amount
> of going to home depot for little stuff or picking up lunch, so some opex allocation may be
> justified, but its minimal"_

⚠️ **This removes the allocation question rather than answering it.** Outbound delivery cost is
normally a GAAP policy _election_ — cost of sales or selling expense — precisely because for most
companies delivery is incidental to selling a product. CFS sells the delivery **and** the asset that
performs it does nothing else, so "is this a cost of revenue" stops being a judgement.

⚠️ **It settles classification and NOT the basis.** Exclusivity says every vehicle dollar is a cost
of revenue; it says nothing about which job bears which dollar. Conflating the two is how the first
draft ended up with a split it could not compute.

**The incidental use is not allocated out, and that is a stated policy.** There is no GAAP de
minimis threshold — materiality governs — so the non-allocation is recorded in the ADR rather than
left to be inferred, because a documented non-allocation is defensible and an undocumented one reads
as an oversight. None of it is personal use: a hardware run and a crew lunch are incidental business
use, so no fringe-benefit question arises.

## 2. Rented trucks are vehicle COGS — and the account they sit in already said so

> _"we also rent vehicles for delivery (currently in rented equipement, mostly from chicagoland
> truck rental)"_

⚠️ **A sixth stream of vehicle cost the ADR had never seen**, and the account holding it already
carried the rule that excludes it. `6302 Rented Tools, Machinery, Equipment` notes: _"Equipment
rented for CFS's own use. Equipment rented IN to fill a customer order is a subrental and goes to
5100 — **the distinction is whether an order caused it**."_ A truck hired to run a delivery is
caused by an order.

It does not belong in 5100 either: a subrental is gear CFS **supplies** to the customer; a rented
truck is a means of **performing**. Neither existing account fits, which is the tell that it is the
third thing this ADR is minting.

⇒ It gets a natural account of its own (**6405 Vehicle: Rented**) and enters the same pool. **Pooled
rather than absorbed at actual**, though a rental invoice names its job and could absorb directly
like a subcontractor — one mechanism is simpler to specify, and the invoice detail stays available.
⚠️ The rate's denominator must then include rented mileage or rented spend absorbs twice.

⚠️ **It also means `$21,844.77` is understated**, not merely unpinned. The same defect class as
erp-spec#8's "~30 collections": a scope taken from the obvious list, short by whatever the
unexamined source holds.

## 3. Align with the labor strategy — and the alignment is literal, not analogical

> _"i want to align with the labor strategy"_

The recommendation at that point was the SIMPLE option — straight into COGS, no absorbed/unabsorbed
split — on the grounds that absorption needs a rate and a basis that did not exist. **The ruling
sent it back, and the ruling was right**, because the missing basis was not missing:

**A delivery, trucking or trash job already generates a shift** (ADR-0011, OQ-010), and that shift
carries hours, a causal job and a `labor_line`. Vehicle cost can absorb on **the same allocation
rows** — same event, same job, same `labor_line`, a different rate on a different quantity. No new
event, no new document, no new key.

✅ **And it settles the Delivery / Trash & Cleanup split for free.** Those are two product lines
with opposite treatments — `Delivery` spreads onto goods, `Trash & Cleanup` is severable and keeps
its own margin ($144,975, the third-largest line) — so one undifferentiated vehicle pool could not
have served both. The shift's `labor_line` already says which.

⚠️ **What does NOT carry over is ADR-0019's headline sentence.** "Absorption measures utilisation,
not rate variance" is true because labor is costed at ACTUAL, from a real wage on a real bill. A van
has no actual per-job cost, so vehicle absorption is a predetermined rate and 5901 is utilisation
**and** rate deviation. The structure aligns; the costing basis cannot. That is the price of the
alignment and it is stated in the ADR as a requirement to name the normal-capacity denominator.

## 4. The basis is computed Mapbox distance, not captured mileage

> _"for the allocator machinery destinations + mapbox geocoding should allow for good mileage
> estimates (we should record actuals from time to time if appropriate, there will be some
> variance)"_

⚠️ **This retired a blocker that had been asserted twice and never checked.** Both this plan and
erp-spec#12 recorded vehicle absorption as waiting on a leg-capture decision, on the reasoning that
"mileage is not captured today". It is not captured — and it is **derivable**:
`destinations.address.address_coordinates` already holds Mapbox coordinates, Mapbox is retained at
the boundary by ADR-0027, and `cache-geocodes` already exists as the cache. Distance is a
computation over data the system has.

**The owner's own qualification is the correct accounting shape.** Computed distance is the
allocation **base**; periodic odometer and fuel sampling calibrates the **rate**. Two different
variances, and they must be reported separately: base variance is round trips, multi-stop runs
(which are _less_ than the sum of their legs) and idle time that covers no distance at all; rate
variance is assumed cost per mile against actual.

⚠️ **It does not unblock `trip_travel`.** Distance says how far a destination is, not which orders
shared a van. The distance half of erp-spec#12's blocker exists; the trip-grouping half does not.

## 5. The geocodes are wrong in a way that looks right — and the discriminator is already stored

Measured 2026-08-16, first 200 of 459 (`api:2026-08-16:db_destinations_query`): roughly half carry
no coordinates, and several that do are badly wrong. `TBD, Chicago, IL` → near Bloomington.
`60098 Mill Hill Road, Woodstock` → **New York state**, the ZIP parsed as a street number. A
Louisville PO box → **Kansas**. `2258 West 16th Street` → **Davenport, Iowa**.

✅ **Every one of them carries a `mapbox_id` beginning `urn:mbxadr-itp:`** — Mapbox's _interpolated_
result, its fallback when it cannot match a real address — where correctly resolved rows carry
`urn:mbxadr:`. ⚠️ **One-way**: every bad one is interpolated, not every interpolated one is bad
(`825 E Erie` is `-itp` and correct). It screens; it does not decide. Paired with a service-radius
bound it is the plausibility gate.

**Owner: record it in the spec, do not open a v1 issue.** The reasoning is that the defect stops
being produced:

> _"once we switch away from crms to manager destinations are set by mapbox autofill the data
> quality issue is going to improve, its a bounded set to backfill at migration time"_

Which is right, and it is visible in the data: the bad rows are free text that was geocoded after
the fact, and autofill returns a matched feature instead. ⚠️ **The gate ships anyway.** A bad
geocode can recur, and a check justified only by dirty data is a check that gets removed the week
before it is needed.

## 8. ⚠️ 6302 KEEPS a live population — the correction over-reached before the ink dried

> _"we did rent a scissor lift and fork lift for internal use when we moved, that likely is sitting
> in the rented equipment account, we should keep the opex account in case i rent equipment for
> building maintenance in future"_

**Ruling 2 above was written as though 6405 received everything 6302 takes.** It does not. The
criterion 6302's own note states — _"whether an order caused it"_ — sorts equipment hire into
**three** accounts, and the note named two:

| what was hired, and why                                                                                   | account                            |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| for CFS's **own use** — the scissor lift and forklift for the warehouse move, future building maintenance | **6302**, unchanged                |
| **supplied to a customer** to fill their order                                                            | 5100 Subrentals                    |
| to **perform** a delivery or a haul                                                                       | **6405** → vehicle COGS (ADR-0030) |

⚠️ **The two errors are opposite and both came from reading one clause and not the rest.** The
original defect was that a delivery truck sat in 6302 even though "whether an order caused it"
already excluded it. The correction then emptied the account on the strength of the same clause,
even though "CFS's own use" — the branch that clause preserves — has actual members.

⇒ **One population moving out of an account is not the account becoming empty.** This repo's
standing rule is that _a branch with no members is a claim, not a capability_; the inverse holds and
is easier to get wrong, because deleting a branch feels like simplification. **The scissor lift is
the member that says otherwise**, and it is recorded on 6302's chart entry so the branch is
evidenced rather than asserted.

## 9. Hired trucks go STRAIGHT to a COGS account — and the machinery already existed

> _"should hired to perform delivery go straight to a cogs account?"_ … _"when a chicagoland invoice
> hits our app, chicagoland the vendor can default to cogs: vehicles: rented account but i can
> change in the less likely event it's for internal use"_

**Yes, and ruling 2's "pool them with the rest" is reversed.** ⚠️ **The reversal is on ME, not on
the ruling**: pooling was recommended on the grounds that "one mechanism is simpler to specify",
which is **not the criterion the survey established**. The criterion is _does the cost arrive
already attributed to a causal job?_ — and a rental invoice does.

**There was no second mechanism to avoid.** `bill_received` already carries it:

```yaml
- debit_account: line.debit_account
  per: bill.direct_lines
  amount: line.amount_minor
  keys:
    causal_orders: line.causal_orders
```

`bill.direct_lines[]` already holds an arbitrary `debit_account` AND its own `causal_orders`. A
truck-hire line is an existing rule with a different account in it.

⇒ **Mint `5902 COGS: Vehicle (Hired)`; do NOT mint `6405 Vehicle: Rented`.** An attributable cost
needs no natural operating-expense account. ✅ Three things improve: 5900/5901 stay readable as
owned-fleet utilisation and rate deviation rather than mixing an actual into a rate-absorbed pool;
the rate-denominator double-count hazard **disappears** rather than needing management; and the job
attribution the invoice already supplies is used instead of discarded.

**The vendor carries a DEFAULT account, overridable per line.** This is what makes the three-way
6302 / 5100 / 5902 split operable rather than aspirational. Three cautions, all recorded in the ADR:

- ⚠️ a default is a claim about a vendor and **will be silently wrong** in exactly the 6302 case — a
  scissor lift coded by reflex to COGS overstates delivery cost with nothing to flag it, so the
  default must be **visible on the line**, not applied invisibly;
- ⚠️ it supplies the ACCOUNT and never the **causal job**. REQ-LED-001 refuses an absent key and
  permits an explicit null, and **a null arrived at by defaulting is an absence wearing a
  determination's clothes**;
- ⚠️ it is consumed at WRITE time and **never re-read**. Nothing may re-derive a posting's coding
  from the vendor master later — that is ADR-0036's rule and the exact trap
  `invoices.items[].tracking_category` was.

## 10. 5200 Subcontractors is NOT a CFS labor account — and its own note said it was

> _"our wages are not subcontractors, a subcontractor is we hired another company to perform work
> for a customer, dont conflate the 2 labor related accounts, subcontractors is not a cfs labor
> account. labor does not have a u, adopt this"_

⚠️ **The conflation was inherited, not invented.** 5200's chart note read: _"Subcontractor labor is
already in COGS here … ADR-0019's absorption model puts own-crew cost beside it in 5800 … **the two
labor populations become comparable for the first time**."_ A subcontractor's cost is a PURCHASE
from another company; 5800/5801 are CFS's own wages. They are labor-related and they are **not one
population**, so "comparable for the first time" asserted a comparison that does not hold. Corrected
on the account.

✅ **The corrected axis is stronger than the one it replaces.** What 5200 shares with 5902 is the
PROCUREMENT SHAPE — a vendor bill naming the job it served — so the table is **bought in versus
owned**, not labor versus not-labor:

|                     | bought in — the bill names the job | CFS-owned — no per-job actual |
| ------------------- | ---------------------------------- | ----------------------------- |
| capacity to perform | 5200 Subcontractors                | 5800 / 5801 own crew          |
| vehicles            | **5902 Vehicle (Hired)**           | **5900 / 5901** owned fleet   |

**And "labor" has no u — adopted as the house spelling.** Swept across the refactorable spec and
enforced by **gate 17**, because a convention nothing executes is the class of claim this repo has
paid for most often. ⚠️ Three exemptions, all on lifecycle grounds: `inbox/` and `research-drop/`
are append-only; an accepted ADR is immutable and ADR-0001, ADR-0011 and ADR-0036 keep "labor"
permanently (ADR-0034 — a historical record of the decision as taken, spelling included); and a
citation of an append-only filename keeps that filename's spelling. **Gate 11 caught all twelve
citations the sweep broke**, which is how the third exemption was found.

## 6 and 7 — confirmed as recommended

- **Tickets (6404) never absorb and stay in operating expenses.** Nondeductible under IRC §162(f),
  therefore a permanent Schedule M-1 difference ADR-0026 keeps out of both books; an absorbed
  account is no longer separable for that.
- **The natural accounts keep taking postings**, relieved by a `6409 Vehicle: Cost Absorbed` contra,
  so the gross fuel / repairs / hire figures survive the period entry.
