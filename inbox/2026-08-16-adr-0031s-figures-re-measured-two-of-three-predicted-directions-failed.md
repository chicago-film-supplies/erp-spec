---
kind: finding
title: ADR-0031's allocation figures re-measured on the repaired corpus — pool-exceeds-base ROSE against a prediction that it must fall, and the five orders the ADR named by name did not move at all
contexts: [ledger, billing, fulfillment]
source: "api:2026-08-16:firestore invoices+products under ADC via spikes/harness/allocation-basis-probe.ts — 1,010 invoices, 9,394 revenue-bearing lines, $1,715,472.79 tax-exclusive"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run to close erp-spec#13 item 2. ADR-0031's Consequences carried a ⚠️ block marking four figures
stale and stating the direction each would move; `reporting/product-line-pl.yaml` and
`reporting/queries/product-line-pl.sql` carry the same predictions. **They could not be re-run at
all** — `spikes/harness/allocation-basis-probe.ts` authenticated with a shared `CFS_API_TOKEN`
against `/mcp/cfs`, which moved to OAuth (erp-spec#15). The probe now reads Firestore directly under
ADC, and its goods/activity classification is read from the spec instead of hand-copied.

⚠️ **The probe had never been executed even once.** Its own provenance note in
`inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md` says so: _"a faithful
port that type-checks, but which has not itself been executed yet… Until that happens the probe
reproduces the method, not the measurement."_ Every figure below is the first run.

## The corpus moved, and three things changed at once

|                       |        2026-08-09 |                                       2026-08-16 |
| --------------------- | ----------------: | -----------------------------------------------: |
| invoices              |               999 |                                        **1,010** |
| revenue-bearing lines |             9,194 |                                        **9,394** |
| line revenue, ex-tax  |     $1,688,980.87 |                                **$1,715,472.79** |
| products              |               549 |                                          **567** |
| `Delivery` pool       | $216,050.25 incl. | $236,487.75 incl. void / **$230,737.75 ex-void** |

Three changes land together — the corpus grew, api-cloudrun#473 repaired the denorm, and OQ-034 /
OQ-032 moved two dimension values. **So every direction claim below is judged against a row measured
under the 2026-08-09 base rule AND the 2026-08-09 classification**, because attributing a direction
to one change while silently making the other two is how a comparison becomes a story. The
classification effect turns out to be small (0.11 pp) and the repair's is not.

⚠️ **The total ROW count is not comparable and nothing here uses it.** The 2026-08-09 note records
11,131 rows; a direct Firestore read gives **14,410**, and the difference is almost exactly the
3,056 `group` dividers — that note's `items[].x` MCP projection did not return them (`order` +
`destination` alone are 1,960 against its 1,937 structural rows). Revenue-bearing lines are
unaffected, so the incomparability is contained to a denominator no figure rests on. Fourth
base-comparability problem in this corpus in eight days.

## The four figures

| figure                          | 2026-08-09 | 2026-08-16 | predicted           | verdict                        |
| ------------------------------- | ---------: | ---------: | ------------------- | ------------------------------ |
| pool exceeds base               |  **41.4%** | **45.20%** | must **FALL**       | ⚠️ **ROSE 3.8 pp**             |
| structurally unallocable        |  **5.16%** |  **4.94%** | must FALL, maybe ~0 | ⚠️ share fell, **amount rose** |
| divergence: revenue vs lines    |      27.4% | **27.77%** | unknown             | flat                           |
| divergence: revenue vs quantity |      31.5% | **32.53%** | unknown             | flat                           |
| divergence: lines vs quantity   |      33.5% | **34.19%** | unknown             | flat                           |

**Control totals hold under all three bases**: allocated $219,337.75 + unallocated $11,400.00 =
$230,737.75, exactly the ex-void pool. That is the invariant `product-line-pl.sql` names as the one
that can actually fail, and it is the reason the numbers below can be trusted at all.

## Finding 1 — pool-exceeds-base ROSE, and the reasoning behind the prediction was wrong

Like-for-like, 2026-08-09 base rule and classification on both sides:

|                         | 2026-08-09 |      2026-08-16 |
| ----------------------- | ---------: | --------------: |
| groups over / allocable |  115 / 305 |   **129 / 314** |
| pool held               | $89,425.00 | **$106,885.25** |
| share of pool           |  **41.4%** |      **45.20%** |
| median pool/base ratio  |      0.775 |       **0.862** |
| p90                     |       3.13 |        **3.33** |
| max                     |      25.00 |           25.00 |

The prediction was _"lines that were invisible to the base now count toward it, so the base grows on
exactly the groups where it was thinnest"_. The base did grow. **The pool grew faster** — the median
group's pool/base ratio rose from 0.775 to 0.862, and the pool itself gained
$20,437.50 (+9.46%) while
the number of allocable groups gained 9 (+2.9%). The repair categorised delivery service lines as
readily as it categorised goods, and on a service-heavy order there is little goods revenue to
categorise. The growth is on the service account, not the surcharge account: `Delivery`'s split moved
from 4100 79.8% / 4110 20.0% to **4100 81.38% ($192,447.75, 407 lines) / 4110 18.52%
($43,790.00, 129
lines)** — so 4110 is close to flat in dollars and 4100 absorbed nearly all of the +$20,437.50. (The
2026-08-09 split is recorded as percentages only, so the dollar decomposition is stated as shares
rather than given a false cent-precision it cannot have.)

**The mechanism the prediction assumed — a defect that suppressed only the base — was not what the
defect did.** It suppressed both sides, and it suppressed the pool side harder.

⚠️ Nothing about ADR-0031's design consequence changes, and it is worth being explicit that this
_strengthens_ it: own and allocated must be shown separately, and the population where spreading
**replaces** a product line's margin rather than adjusting it is larger than recorded, not smaller.

## Finding 2 — the unallocable share fell only because its denominator grew

|               | 2026-08-09 |     2026-08-16 |          |
| ------------- | ---------: | -------------: | -------- |
| share of pool |      5.16% |      **4.94%** | fell     |
| amount        | $11,150.00 | **$11,400.00** | **ROSE** |
| groups        |         11 |         **12** | **ROSE** |

Same base definition (spec base, ex-void) on both sides. **Nothing became allocable.** Quoting the
share alone reports this as the predicted improvement; it is the same base-mismatch failure this
corpus has already produced three times, in its subtlest form — same rule, different denominator
size.

By year, ex-void: 2023 1 group / $100.00 · 2024 1 / $250.00 · 2025 9 / $10,800.00 · 2026 1 /
$250.00. Still not a standing practice, and still concentrated in one quarter of 2025.

⚠️ **A reproduction worth recording as an integrity check.** Under the 2026-08-09 base rule the
probe measures **15 groups / $12,410.25** — exactly the recorded figure, to the cent, on a corpus 11
invoices larger. So the port is faithful and the 11 additions contributed nothing to this
population. The differences reported elsewhere in this note are real, not artifacts of a
re-implementation.

## Finding 3 — the five Netflix orders did NOT leave the bucket, and the claim that they would is refuted

ADR-0031 and `reporting/product-line-pl.yaml` both predicted **85.5% of this row's population
disappears**, on the reasoning that _"Duradeck **is** categorised at the product master, as
`Surface
Protection`, so after the repair they carry a goods line and have a denominator."_

Measured: all five are still unallocable, and **they carry no non-`Delivery` line whatsoever** —
base $0.00 across nothing, and nothing excluded from the base either.

| invoice | date       |      pool |  base | everything else on the order |
| ------- | ---------- | --------: | ----: | ---------------------------- |
| 1799    | 2025-03-03 | $1,250.00 | $0.00 | nothing                      |
| 1803    | 2025-02-28 | $1,750.00 | $0.00 | nothing                      |
| 1822    | 2025-03-18 | $1,750.00 | $0.00 | nothing                      |
| 1856    | 2025-03-30 | $3,250.00 | $0.00 | nothing                      |
| 1875    | 2025-04-04 | $1,750.00 | $0.00 | nothing                      |

The product on those invoices is `kqzVClx5uJrJ07bEjokX`, and its master category is **`"Delivery"`**
— not `Surface Protection`. It is the install / tear-out / relocate **labour**, not the deck. Every
line on all five invoices is `Delivery` at both the line and the master. Full detail and the
retraction are in
`inbox/2026-08-16-correction-the-duradeck-retraction-reasoned-from-a-product-name.md`.

⇒ **The 2026-08-09 characterisation of this row — "service-only jobs, not orphaned deliveries" — is
correct and stands.** It was retracted on 2026-08-10 and that retraction is what is wrong.

## Finding 4 — the divergence figures are stable, so the decision they justify is unaffected

27.4 → 27.77%, 31.5 → 32.53%, 33.5 → 34.19% of the pool reassigned between bases. ADR-0031 said
_"that the bases disagree materially is not in doubt"_ and left the direction unpredicted; it moved
by under a percentage point on each pair. **Between a quarter and a third of the pool still lands on
different goods depending on a decision nobody had made**, which is the whole premise, measured on a
base that is no longer a lower bound of unknown tightness.

Quantity remains incommensurable: units per $100 of base revenue ranges from **1.27**
(`Replacements`) to **47.80** (`Traffic, Safety & Signage`) on pool-bearing groups — a 38× spread,
against the 52× measured corpus-wide on 2026-08-09.

## The `Crafty` illustration moved, and it is still the illustration

Own revenue on pool-bearing groups **$16,990.00** (was $11,735.00); allocated by revenue
**$21,549.26** (was
$21,958.00) = **126.83% of its own** (was 187.12%). Still over 100%, so the point
survives; the specific "187%" is stale wherever it is quoted. `Crafty`'s corpus-wide revenue nearly
tripled ($16,265.60 → $45,530.48) and its account mix inverted — it is now 90.26% on 4200 Retail
Sales against 9.74% on 4000.

## Two secondary findings the run turned up

- **`Transaction Fees` is still in the corpus and no longer in the dimension.** 123 lines,
  **$5,109.67**, split `4700` $3,123.61 / 81 lines and `4110` $1,986.06 / 42 lines. OQ-032 moved it
  out of `product_line` on 2026-08-16 and `line_kinds` does not classify it, so the probe counts it
  as neither pool nor base — correct for the target system. The 42 lines on 4110 are exactly
  OQ-032's pending `Card Fee` → 4700 restatement, now measured rather than asserted. This is an
  ADR-0020 restatement obligation, **not** a value to re-declare.
- **`Shipping` reads 0 lines and this is not a repeat of the `Transport` failure.** OQ-034 split
  `Transport` / `Shipping` in the spec on 2026-08-16; the corpus carries one value spanning both
  accounts. The split is derivable by account and **reproduces the spec's stated figures exactly** —
  `4100` $34,000.00 / 7 lines (trucking) and `4150` $5,665.00 / 16 lines (shipping), against
  OQ-034's $34,000.00 / 7 and $5,665.00 / 16. Nothing to re-measure; the restatement is what is
  outstanding.

## Provenance

`spikes/harness/allocation-basis-probe.ts`, `deno task allocation`. Read-only prod Firestore under
ADC, integer cents throughout, control total asserted in the run. The probe's goods/activity split
and its set of spreading pools are read from `reporting/product-line-pl.yaml` and
`ledger/dimensions.yaml` rather than held in the probe — the previous hand-copied set had already
gone wrong once, classifying `Transport` as goods by omission after OQ-034 (erp-spec#15).
