---
id: ADR-0031
title: The official product-line P&L allocates by goods revenue on the causal order, declared as a proxy
status: proposed
date: 2026-08-09
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [
  ADR-0017,
  ADR-0019,
  ADR-0024,
  ADR-0025,
  ADR-0029,
  ADR-0030,
  OQ-006,
  OQ-018,
  OQ-031,
  OQ-032,
  OQ-033,
]
supersedes:
superseded_by:
---

> **In the context of** ADR-0029 promising exactly one official allocation and not saying what it
> is, **facing** three candidate bases that reassign up to a third of the largest product line's
> revenue between them, **we decided** to allocate by goods revenue on the causal order and to
> record in the report that this is a proxy rather than a cost driver, **to achieve** one
> reproducible margin per product line, **accepting** that the basis is the weakest tier in the
> standard criterion and stays that way until the shipping specs are populated this year.

## Context

- ADR-0029 decided the ledger records un-allocated facts and that allocation is one specified
  reporting act. It left the basis open, and named that gap as "the real cost of this decision".
- **The criterion is settled and is not a matter of taste.** Horngren's ranking — cause and effect,
  then benefits received, then fairness, then ability to bear — is what all five product references
  implement (`inbox/2026-08-09-allocation-basis-survey-six-references.md`). Ability to bear, which
  is what a revenue basis is, is described in the source as "usually unacceptable because of its
  negative effect on managerial motivation".
- **The tier's default is nonetheless revenue.** SAP S/4HANA top-down distribution names freight as
  its worked example and takes actual or planned sales as the reference base. NetSuite and Sage
  Intacct both ship a **statistical account** mechanism whose entire purpose is to allocate by a
  non-financial quantity — nobody builds that to allocate by revenue. So the survey does not split
  on the answer; it splits on whether you have gone and captured a driver.
- **CFS has not, and the way it has not is a trap.** Measured 2026-08-09 across all 549 products
  (`inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md`):
  `products.shipping.weight` is a real schema field, present on 531 products, and **0 of 549 hold a
  non-zero value**. Height, width and length likewise. No `weight`, `volume`, `mileage`, `distance`
  or `vehicle` field exists on `order`, `destination` or `fulfillment`, and `Address` stores a
  `mapbox_id` but no coordinates — the only coordinates live in an **expiring cache**. Distance is
  therefore derivable forward and **not recoverable historically**.
- **Quantity is available and wrong.** Units per $100 of revenue ranges from 1.14 (Office Supplies)
  to 59.88 (Expendables) — a **52× spread**. A box of tape and a cart are both "1 unit".
- **The choice is load-bearing.** Allocating each order's delivery revenue over its goods, the three
  bases disagree by **27.4% (revenue vs lines), 31.5% (revenue vs quantity) and 33.5% (lines vs
  quantity)** of all delivery revenue.
- **Xero performs no allocation at all** — tracking categories tag, nothing spreads — so the
  migration delta is a report that has never existed rather than a report whose numbers change.
  Nothing has to be carried across history.

## Decision

The official product-line P&L allocates each activity pool **pro-rata by the discounted goods
revenue on the causal order**.

1. **The base is goods revenue on the causal order.** Goods lines are the revenue-bearing lines
   carrying a product line that is not an activity line. The pool is spread over them in proportion
   to `subtotal_discounted`, in integer minor units, by largest remainder so the shares sum exactly
   to the pool.
2. **The scope is the ORDER, not the invoice** — ADR-0029's "the orders that caused them". Measured:
   **0 of 999 invoices bill more than one order** and 969 carry exactly one, so order-scope and
   invoice-scope coincide on today's corpus. Choosing the order costs nothing now and is the only
   one that stays correct when a multi-order invoice appears.
3. **The basis is declared a proxy, on the face of the report.** It is an ability-to-bear allocation
   standing in for an uncaptured cause-and-effect driver, and the report says so. This is not a
   caveat in a footnote — it is a named property of the stated basis, so that replacing it later is
   an upgrade against a recorded intention rather than a reversal.
4. **The basis is versioned.** Every produced report records the `basis_version` that made it. A
   report over a sealed period must be reproducible byte-for-byte, and a basis that changed silently
   between runs would break ADR-0017's guarantee that a closed period cannot drift.
5. **When the base is zero, the pool stays un-allocated and is shown.** An order with activity
   revenue and no goods line has no denominator. Its pool is reported in a named `unallocated`
   bucket on the face of the product-line P&L. It is never forced onto an arbitrary line, never
   spread across all lines, and never dropped.
6. **Void documents are excluded** from both pool and base.
7. **The same shape governs every future pool** — trip travel across the jobs a shared run served,
   warehouse overhead, and vehicle COGS under ADR-0030. Each names its pool, its base and its scope;
   the base defaults to this one and a pool that departs from it must say why. ⚠️ None of the three
   is expressible yet: `pools` is keyed by an **activity product line**, and those have none. They
   sit in `deferred_pools`, each holding erp-spec#12, rather than being given an invented shape.
   **`trip_travel` is not merely another pool — it is an allocation that runs BEFORE this one** (one
   shared run → the several orders it served), so it chains rather than composes, and its own basis
   is undecided and uncaptured. **Whether `Crew` and `Trash & Cleanup` follow `Delivery` at all is
   OQ-031**, deliberately left blocked: ADR-0029's argument for spreading delivery is severability,
   and it does not obviously transfer to a service that may stand on its own margin.

## Considered options

| basis                     |                                                                                                                                                                                                                                                                                                  why not |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **weight / cubic volume** | The cause-and-effect answer, and **structurally unavailable TODAY**: 0 of 549 products carry a non-zero shipping dimension. **Scheduled for population this year**, at which point it becomes basis v2 — OQ-033. Historical periods stay on v1 regardless, because no past order records what was moved. |
| **distance travelled**    |                                                                                                                            Also cause-and-effect, and unavailable historically — no stored coordinates, geocodes live in an expiring cache. Available _going forward_ if captured; see the consequences. |
| **item count (quantity)** |                                                                                                               Available, and **not commensurable** — a 52× spread in units per revenue dollar between Expendables and Office Supplies. It would allocate delivery cost by how finely a line is packaged. |
| **line count**            |                                                                                                                              Available, and a line is a **data-entry artifact**: `splitItem` divides one line into two, which would move money between product lines without anything physical changing. |
| **goods revenue**         |                                                                                                                                                                                                                        **Chosen.** The weakest defensible criterion, and the only one the data supports. |

## Consequences

- ⚠️ **On 38% of delivery-bearing orders the pool is LARGER than the base it spreads over.**
  Measured: 115 of 305 allocable order-groups, holding **$89,425 — 41.4% of all delivery revenue**;
  ratio median 0.775, p90 3.13, **max 25.0**. `Crafty` is the clean case — $11,735 of own revenue on
  delivery-bearing orders receives **$21,958**, 187% of itself, from five near-identical invoices
  where a $1,500–$2,500 delivery sits against $480–$800 of Crafty as the only goods on the order.
  **Where a pool exceeds its base, pro-rata spreading does not adjust a product line's margin — it
  replaces it.** The report must therefore show own and allocated amounts as separate figures, never
  only their sum, or a reader cannot tell a product's economics from an activity's.
- **$11,150.00 — 5.16% of delivery revenue, 11 order-groups ex-void — is structurally unallocable**
  under every basis, because those orders carry no goods line at all. It becomes a visible number
  rather than a rounding difference. If it grows, that is a signal about how work is being booked,
  and a bucket is how it stays visible.
- **The proxy has an expiry, and it is this year.** Owner, 2026-08-09: the product shipping specs
  will be populated. That makes this basis explicitly interim-with-a-date rather than interim in
  principle, and it is why `basis_version` exists.
- **A populated shipping spec is SUFFICIENT here, not merely better** — and this corrects the
  assumption that one capture serves both this allocation and vehicle absorption. The official
  allocation spreads **one order's** pool across **that order's** lines, so only what varies
  _between lines of the same order_ can matter. Distance, crew size, stop count and drive time are
  **order-level and cancel out entirely**. Weight and cube are the only line-level physical facts.
  So the shipping spec closes the cause-and-effect gap for this allocation completely, and distance
  remains necessary only for `trip_travel` — the _inter_-order allocation of a shared run
  (erp-spec#12), which is a different allocation running before this one. **The two captures are
  separable, and the one that is already scheduled is the one this ADR needs.**
- **Which physical basis, and when it activates, is OQ-033.** Probably neither weight nor cube
  alone: a truck runs out of mass or space, whichever comes first, which is why carriers bill on
  **dimensional weight**. ⚠️ The activation precondition is the load-bearing half — uniform zero
  fails loudly (every denominator zero, whole pool to the bucket) while **partial population fails
  silently**: an unmeasured line absorbs zero cost, the shares still sum exactly to the pool, the
  control total passes, and the least-maintained catalogue entries report the best margins. v2 must
  require every line in an order's base to carry a non-zero driver or degrade that whole order to
  the bucket. Blocked in practice on **core#51** — `shipping.weight` is a bare `z.number()`, so `0`
  means both "weighs nothing" and "not yet weighed".
- ⚠️ **The 4110 rationale quoted above is true of 62.3% of that account and not of a third of it.**
  Measured after this ADR was drafted: `Distance Charge` is **33.3% of 4110**, and distance is
  performed and is the pool's clearest cost driver. The forecasting consequence inverts for that
  third. The basis is unaffected — both accounts pool and spread as one — but the reasoning attached
  to the split is not. → **OQ-032**.
- **A second basis version is now a schema concern, not a code change.** Because the basis is
  versioned and recorded, adding a driver-based basis later means running both over an open period
  and comparing, rather than a migration.
- **Nothing about the ledger changes.** The allocation consumes postings that already carry their
  causal order — ADR-0029's load-bearing requirement on every posting rule — and writes nothing
  back. If a future posting rule omits the causal order, this report silently loses that revenue
  from its base; that is the coupling to watch.
- ⚠️ **A revenue basis creates a feedback loop that must never be closed.** Allocated delivery cost
  raises a line's costs in proportion to its revenue, so the line's margin percentage is pulled
  toward the average. Reading this report as evidence that the best line is less profitable than it
  looked is the misreading, and it is the exact hazard the criterion names. The report showing own
  and allocated separately is what prevents it.
- **Reporting authority is unchanged (ADR-0017).** Whether the allocated view is sealed at close or
  recomputed on demand from sealed inputs is decided in `reporting/`, not here — but it is only a
  free choice _because_ the basis is versioned.
