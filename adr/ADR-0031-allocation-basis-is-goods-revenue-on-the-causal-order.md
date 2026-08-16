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
> standard criterion and stays that way until the shipping specs are populated.

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
- **CFS has not, and the way it has not is a trap.** `products.shipping.weight` is a real schema
  field and **0 products hold a non-zero value** — re-measured 2026-08-16 across all **567**: 0
  non-zero, 3 zero, 537 `null`, 27 with the block absent, identically for height, width and length.
  (Pre-repair reading, 2026-08-09 across 549: 0 non-zero, with 531 recorded as holding a number
  rather than null — see the correction under OQ-033. The conclusion is unchanged and the mechanism
  differs, which is what makes the precondition writable.) No `weight`, `volume`, `mileage`,
  `distance` or `vehicle` field exists on `order`, `destination` or `fulfillment`, and `Address`
  stores a `mapbox_id` but no coordinates — the only coordinates live in an **expiring cache**.
  Distance is therefore derivable forward and **not recoverable historically**.
- **Quantity is available and wrong.** Units per $100 of revenue ranges from 1.14 (Office Supplies)
  to 59.88 (Expendables) — a **52× spread** corpus-wide. Re-measured 2026-08-16 across the
  allocation base itself: 1.27 (Replacements) to 47.80 (Traffic, Safety & Signage), a **38×
  spread**. A box of tape and a cart are both "1 unit".
- **The choice is load-bearing.** Allocating each order's delivery revenue over its goods, the three
  bases disagree by **27.77% (revenue vs lines), 32.53% (revenue vs quantity) and 34.19% (lines vs
  quantity)** of ex-void delivery revenue — re-measured 2026-08-16 against 27.4 / 31.5 / 33.5% on
  the pre-repair corpus. ✅ **The one figure this ADR left unpredicted is the one that barely
  moved**, and it now stands on a base that is no longer a lower bound of unknown tightness. That
  the bases disagree materially was never in doubt and is confirmed.
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
   **0 of 1,010 invoices bill more than one order** and 980 carry exactly one — re-measured
   2026-08-16, against 0 of 999 / 969 pre-repair — so order-scope and invoice-scope coincide on
   today's corpus. Choosing the order costs nothing now and is the only one that stays correct when
   a multi-order invoice appears. The 30 invoices carrying no order divider at all are unchanged in
   count.
3. **The basis is declared a proxy, on the face of the report.** It is an ability-to-bear allocation
   standing in for an uncaptured cause-and-effect driver, and the report says so. This is not a
   caveat in a footnote — it is a named property of the stated basis, so that replacing it later is
   an upgrade against a recorded intention rather than a reversal.
4. **The basis is versioned.** Every produced report records the `basis_version` that made it, so a
   number can always be traced to the basis that produced it and two bases can be run over the same
   period and compared. ⚠️ **This clause read "…a report over a sealed period must be reproducible
   byte-for-byte, and a basis that changed silently between runs would break ADR-0017's guarantee
   that a closed period cannot drift." That premise is FALSE and is retracted 2026-08-16.** Owner:
   "there's no reason an ephemeral report would ever need to be sealed or locked… **a p&l by product
   line or customer type is driven by a need for business intelligence, not compliance**."
   ADR-0017's sealed artifact is the balance sheet and account-level P&L, and neither carries a
   product line — so this report is not a sealed-period report and cannot break that guarantee.
   Versioning survives on the merits stated above; only the ADR-0017 justification goes. Re-running
   a closed period under a new basis is a **feature**, not drift.
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
   is undecided and uncaptured. ✅ **Whether `Crew` and `Trash & Cleanup` follow `Delivery` at all
   was OQ-031, and it is ANSWERED — they do not** (owner, 2026-08-16). ADR-0029's argument for
   spreading delivery is severability, and it does not transfer: crew hired out and a wrap cleanup
   are each sold on their own terms, so spreading them would move a real profit or loss onto goods
   that did not cause it. `Transport` and `Shipping` are severable on the same criterion (OQ-034).
   **So five product lines are `activity` and exactly one spreads**, and `activity` therefore does
   not imply `spreads` — the two were the same question only while `Delivery` was the only one
   decided. ⚠️ Not allocated is not the same as not costed: each keeps its own labour cost via the
   causal-job rule, or a severable line with revenue and no cost against it reports a margin near
   100%.

## Considered options

| basis                     |                                                                                                                                                                                                                                                                                                                                                                                                                                       why not |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| **weight / cubic volume** | The cause-and-effect answer, and **structurally unavailable TODAY**: 0 of 567 products carry a non-zero shipping dimension (re-measured 2026-08-16; 537 hold `null`). **Scheduled for population, and the owner expects MANY products covered by the time v2 is in dev** — at which point it becomes basis v2, gated on a coverage threshold, OQ-033. Historical periods stay on v1 regardless, because no past order records what was moved. |
| **distance travelled**    |                                                                                                                                                                                                                                                                 Also cause-and-effect, and unavailable historically — no stored coordinates, geocodes live in an expiring cache. Available _going forward_ if captured; see the consequences. |
| **item count (quantity)** |                                                                                                                                                                                                                                                    Available, and **not commensurable** — a 52× spread in units per revenue dollar between Expendables and Office Supplies. It would allocate delivery cost by how finely a line is packaged. |
| **line count**            |                                                                                                                                                                                                                                                                   Available, and a line is a **data-entry artifact**: `splitItem` divides one line into two, which would move money between product lines without anything physical changing. |
| **goods revenue**         |                                                                                                                                                                                                                                                                                                                                                             **Chosen.** The weakest defensible criterion, and the only one the data supports. |

## Consequences

> ✅ **RE-MEASURED 2026-08-16 on the repaired corpus, and this block's predictions were wrong.** The
> figures below were taken on the pre-repair corpus; erp-spec#15 is fixed, the probe reads prod
> Firestore under ADC, and it had in fact **never been executed even once** before this run
> (`inbox/2026-08-16-adr-0031s-figures-re-measured-two-of-three-predicted-directions-failed.md`).
> Judged like-for-like — the 2026-08-09 base rule AND its classification on both sides, because the
> corpus grew and OQ-034/OQ-032 moved two values at the same time:
>
> - ⚠️ **Pool-exceeds-base ROSE: 41.4% → 45.20%**, 115/305 → 129/314 groups, median pool/base ratio
>   0.775 → 0.862. The prediction assumed the defect suppressed only the base. **It suppressed both
>   sides and suppressed the pool harder** — `Delivery` gained $20,437.50 and almost all of it on
>   4100 Service Income, where a service-heavy order has little goods revenue to categorise against
>   it. The design consequence is unaffected and **strengthened**: the population where spreading
>   replaces a margin rather than adjusting it is larger than recorded, not smaller.
> - ⚠️ **Structurally unallocable: the share fell only because its denominator grew.** 5.16% →
>   4.94%, but the amount rose $11,150.00 → $11,400.00 and the group count 11 → 12. **Nothing became
>   allocable.** Quoting the share alone reports this as the predicted improvement.
> - ⚠️ **The five Netflix Duradeck orders did NOT stop qualifying, and the reasoning that they would
>   is refuted.** `products/kqzVClx5uJrJ07bEjokX.tracking_category_name` is **`"Delivery"`** — the
>   install / tear-out / relocate labour, not the deck — and all 15 lines across the five invoices
>   are `Delivery` at both the line and the master, with no goods line anywhere. The retraction
>   inferred a category from a product NAME and never read either product record
>   (`inbox/2026-08-16-correction-the-duradeck-retraction-reasoned-from-a-product-name.md`). **The
>   2026-08-09 reading — service-only jobs, not a defect — is reinstated.**
> - ✅ **Inter-basis divergence is flat**: 27.4 → 27.77%, 31.5 → 32.53%, 33.5 → 34.19%. The premise
>   this ADR rests on survives on a base that is no longer a lower bound of unknown tightness.
>
> Control totals hold under all three bases: allocated $219,337.75 + unallocated $11,400.00 =
> $230,737.75, exactly the ex-void pool.
>
> ✅ **The `Trash & Cleanup` re-scoping this block flagged is resolved, by decision rather than by
> measurement.** It grew from $1,750 to $144,975 — 83× — and the pool-exceeds-base and unallocable
> analyses had been performed for `Delivery` alone on the reasoning that the other activity lines
> were rounding errors. **OQ-031 answered on 2026-08-16 that `Trash & Cleanup` does NOT spread**
> (severable, carries its own margin via the causal-job rule), so `Delivery` remains the only
> spreading pool and the analyses are correctly scoped to it. `reporting/product-line-pl.yaml` holds
> the five pools and their statuses, and the probe now reads that file rather than carrying its own
> copy.

- ⚠️ **On 41% of delivery-bearing orders the pool is LARGER than the base it spreads over.**
  Re-measured 2026-08-16: **125 of 307 allocable order-groups ex-void, holding $104,875.00 — 45.45%
  of ex-void delivery revenue**; ratio median 0.840, p90 3.33, **max 25.00**. (Pre-repair: 115 of
  305,
  $89,425, 41.4%, median 0.775 — it **rose**, against this ADR's own prediction that it must fall.)
  `Crafty` is still the clean case — **$16,990.00** of own revenue on delivery-bearing orders
  receives **$21,549.26, 126.8% of itself** (pre-repair $11,735 receiving $21,958, 187%), from five
  near-identical invoices where a $1,500–$2,500 delivery sits against $480–$800 of Crafty as the
  only goods on the order. **Where a pool exceeds its base, pro-rata spreading does not adjust a
  product line's margin — it replaces it.** The report must therefore show own and allocated amounts
  as separate figures, never only their sum, or a reader cannot tell a product's economics from an
  activity's. **The re-measurement makes this rule bigger, not smaller.**
- **$11,400.00 — 4.94% of ex-void delivery revenue, 12 order-groups — is structurally unallocable**
  under every basis, because those orders carry no goods line at all. It becomes a visible number
  rather than a rounding difference. If it grows, that is a signal about how work is being booked,
  and a bucket is how it stays visible. ⚠️ **It did grow.** Pre-repair it was $11,150.00 across 11
  groups and 5.16%; the share fell only because the pool denominator grew. By year, ex-void: 2023 1
  group / $100.00 · 2024 1 / $250.00 · 2025 9 / $10,800.00 · 2026 1 / $250.00 — still concentrated
  in one quarter of 2025 and still not a standing practice.
- **The proxy has an expiry, and it is now tied to a milestone.** Owner, 2026-08-09: the product
  shipping specs will be populated this year. Owner, 2026-08-16: **weights will exist for MANY
  products by the time basis v2 is in dev.** So the basis is interim-with-a-trigger rather than
  interim in principle, and it is why `basis_version` exists. Re-measured on every
  `deno task allocation` run, so the premise cannot flip unnoticed — v1 outliving its own
  justification is the failure mode that matters here, and it is silent.
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
  the bucket. ⚠️ **Owner, 2026-08-16: weights will exist for MANY products by the time v2 is in dev
  — so partial population is the ANTICIPATED state and the precondition is v2's primary requirement
  rather than its hardening.** Two things follow that OQ-033 now carries: the unallocated bucket
  becomes a **coverage meter**, so coverage is reported beside it; and v2 activates at a coverage
  **threshold**, not at the first non-zero weight, or margins move across the series because someone
  weighed inventory rather than because anything economic changed. ✅ **core#51 is CLOSED
  (2026-08-10) and no longer blocks it**: the four dimensions are `z.number().nullable()` and prod
  holds **0 non-zero, 3 zero, 537 null and 27 with the block absent, of 567 products** (measured
  2026-08-16), so "unmeasured" is representable in the schema and distinguished in the data.
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
