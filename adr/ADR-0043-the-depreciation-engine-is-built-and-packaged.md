---
id: ADR-0043
headline: the depreciation engine is built, not bought
title: >-
  The depreciation engine is hand-rolled behind a package boundary, computed per taxpayer-year, with
  the year's rules as versioned data
status: proposed
date: 2026-08-22
review_by: 2026-11-15
deciders: [repo owner]
contexts: [fixed-assets, ledger]
relates_to: [ADR-0004, ADR-0007, ADR-0026, ADR-0030, ADR-0040, HOT-023, OQ-054, SPIKE-005]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      The depreciation engine is BUILT rather than adopted. No published package implements US tax
      depreciation, so this is a measured absence of alternatives rather than a preference.
  - id: D2
    kind: decision
    claim: >-
      It lives behind a package boundary as a pure library — no IO, no database, no framework —
      consistent with ADR-0004's one shared package. The corpus is its acceptance test, and the
      boundary is what makes the engine replaceable without touching its callers.
  - id: D3
    kind: decision
    claim: >-
      The unit of computation is a TAXPAYER-YEAR, never a single asset. The engine takes every asset
      placed in service in a tax year plus that year's elections and returns the schedules; it does
      not expose a per-asset entry point that could be called in isolation.
  - id: D4
    kind: decision
    claim: >-
      The year's rates, limits, thresholds and caps are DATA versioned by tax year, consumed by the
      algorithm. Adding a tax year is a data change plus a corpus re-run, never new functionality.
  - id: P1
    kind: premise
    claim: >-
      No package on npm or JSR implements MACRS. Searching "macrs" returns zero results on both
      registries, and "section179" returns zero on npm. The nearest candidate is an IFRS engine
      that names neither MACRS, §179, §280F, ADS nor GDS; the best of four candidates evidences 2
      of 10 required facets and two evidence none.
    source: "code:2026-08-22:erp-spec@0f2d985:spikes/harness/depreciation-candidates-probe.ts"
  - id: P2
    kind: premise
    claim: >-
      An asset's convention cannot be determined from the asset. The mid-quarter test is computed
      over the total depreciable bases of everything placed in service in the entire tax year, so a
      late-year purchase retroactively changes the first-year deduction of assets placed in service
      months earlier.
    source: "code:2026-08-22:erp-spec@0f2d985:spikes/harness/depreciation-corpus.yaml"
  - id: P3
    kind: premise
    claim: >-
      The rules change annually, and in 2025 changed inside the tax year by legislation — P.L.
      119-21 reinstated a 100% bonus allowance for property acquired and placed in service after
      2025-01-19, against 40% before it, with an election either way. Completeness is therefore a
      statement about a tax year, not about the engine.
    source: "code:2026-08-22:erp-spec@0f2d985:spikes/harness/depreciation-corpus.yaml"
  - id: P4
    kind: premise
    claim: >-
      CFS runs a large §179 population on the tax side with straight line elsewhere, so the GAAP and
      tax books diverge on most assets and ADR-0026's deferred difference is the ordinary case
      rather than an illustration.
    source: "inbox/2026-08-22-owner-the-depreciation-engine-covers-all-valid-gaap-and-us-tax-cases-not-just-the-ones-cfs-uses-today.md"
supersedes:
superseded_by:
---

> **In the context of** an accepted decision to bring fixed assets in-house on both a GAAP and a tax
> basis, **facing** a registry with no US tax depreciation engine in it, **we decided** to build one
> behind a package boundary, computed per taxpayer-year against year-versioned rule data, **to
> achieve** an engine graded by a corpus rather than trusted, and an annual tax-law update that is a
> data change, **accepting** that correctness on filing-consequential numbers is now ours to own.

## Context

`SPIKE-005` asked hand-roll or adopt, and required the test corpus be built **first** — because a
library chosen first and tested second gets graded on the cases it happens to handle. The corpus
exists (`spikes/harness/depreciation-corpus.yaml`); this is what it found.

### There is nothing to buy, and that is measured (P1)

| candidate                                        | evidences                                     | verdict       |
| ------------------------------------------------ | --------------------------------------------- | ------------- |
| npm `macrs`                                      | **0 packages exist**                          | —             |
| npm `section179`                                 | **0 packages exist**                          | —             |
| `asset-depreciation-calculator`                  | 0 of 10 facets · last published 2021          | not scoreable |
| `@finprecise/depreciation`                       | 0 of 10 · SLN/DB/DDB/SYD, the Excel functions | not scoreable |
| `@classytic/assets`                              | 2 of 10 · **IFRS** — IAS 16 / 36 / 8          | not scoreable |
| `@simplifyingcalculation/irs-sec-179-calculator` | 2 of 10 · §179 only                           | not scoreable |

⚠️ **Every failure is a CAPABILITY gap, not a quality judgement.** `@classytic/assets` is a
competent IFRS engine; IFRS simply has no MACRS, no §179 and no §280F, because those are US tax law
rather than accounting. **The build decision is therefore not a preference and should not be
defended as one.**

⭐ **And the absence is the most perishable claim in this ADR**, true only until someone publishes
one. It is re-runnable — `deno task dep-candidates` — rather than asserted here.

### The engine cannot be a function of an asset (P2)

The mid-quarter convention is mandatory whenever more than 40% of the year's depreciable bases land
in the last three months, and that test ranges over **everything placed in service in the entire
year**. Pub 946 works the case with the dollars stated: a machine placed in **January** takes the
mid-quarter convention because of a computer bought in October.

⇒ **An engine exposing `depreciate(asset)` bakes in a defect that produces entirely plausible
numbers.** The smallest correct unit is a taxpayer-year.

### The rules move, including inside a year (P3)

§179's limit, its phase-out threshold and the SUV cap are year-specific; the bonus allowance was 40%
and became 100% mid-2025 by Act of Congress, with an election either way; §168(n) is new.

## Decision

**Build it, behind a package boundary, per taxpayer-year, against versioned rule data.**

1. **BUILD** (D1) — on P1, not on preference.
2. **A package, and a pure one** (D2). No IO, no database, no framework: inputs in, schedules out.
   ADR-0004 already keeps types in one shared package and ADR-0040 makes that package the schema
   authority, so this is the established seam rather than a new one. ⭐ **`SPIKE-006` set the
   precedent that the spike harness can import the real package and grade it**, which is exactly how
   the corpus reaches the engine.
3. **The unit of computation is a taxpayer-year** (D3). No per-asset entry point is exposed — **not
   as a convenience withheld, but because a per-asset call cannot be answered correctly** and an API
   that offers one invites the P2 defect at every call site.
4. **Year-versioned rule data** (D4). ⭐ **This is what makes the owner's "no new functionality
   later" achievable.** Coverage completeness is buildable once; rule currency is not avoidable by
   any design. Separating them means a new tax year is a data file and a corpus re-run. Baking the
   figures into the algorithm makes every year a code change, and the ruling cannot be honoured no
   matter how complete the first build is.

## Considered options

- **Adopt a library.** Rejected on P1 — there is none. ⚠️ **Recorded as an option because the
  absence must be re-checkable**, and because "we looked and there was nothing" is a claim that
  decays into "we never looked".
- **Adopt an IFRS engine and add the US tax layer on top.** Rejected: the divergence is not a layer.
  MACRS is a different method, on different lives, under a different convention, with a separate
  book that does not post (ADR-0026) — the IFRS engine would contribute the straight-line
  arithmetic, which is the part nobody needs help with.
- **Build it inside the API service rather than as a package.** Rejected on two grounds. The corpus
  lives in the spec repo and **cannot import a service**, so the engine would become ungradeable —
  and the spec repo forbids implementation code, so the corpus can never hold its own copy. **A
  boundary the corpus can reach is the difference between an engine that is tested and one that is
  believed.** Second, it would put filing-consequential arithmetic behind an HTTP surface with a
  database in scope, when it is a pure function of numbers and dates.
- **Expose a per-asset API for convenience, with a batch wrapper.** Rejected on P2: the convenient
  signature is the incorrect one.
- **Build behind a package boundary, per taxpayer-year, on versioned data** (chosen).

## Consequences

- ⭐ **The migration path this spike asked for is INVERTED, and that is worth saying plainly.** Exit
  criterion 3 asks for "a stated migration path if the library is later abandoned" — written when
  buying looked possible. There is no library to abandon. **The path that matters runs the other
  way**: if a credible MACRS engine ever appears, `deno task dep-candidates` finds it, the corpus
  scores it, and the package boundary is the seam it would be swapped in behind. **The corpus and
  the boundary together ARE the migration path**, in both directions.
- **Correctness on filing-consequential numbers is now ours.** That is the real cost of building.
  The mitigation is that the engine is graded against the IRS's own published answers rather than
  against our reading of them — but a corpus is a floor, not a proof, and **it should be reviewed by
  a CPA before the first filing that depends on it.**
- ⚠️ **The deferred difference is high-volume and is the number most likely to be materially wrong**
  (P4). §179 is a tax election with no GAAP counterpart, so a register that is mostly §179 on one
  side and straight line on the other diverges on most assets. ADR-0026 says only the GAAP book
  posts and the tax book is derived; **an engine that gets one book right and the other
  approximately is not half-right — it is wrong on the number ADR-0026 exists to produce.**
- ⚠️ **Two rounding regimes, and they are not the same.** The GAAP book posts to the ledger, which
  is integer minor units. Tax returns are filed in whole dollars, and the IRS's own worked examples
  round there — a rate applied to a basis differs from the published figure by up to fifty cents a
  line otherwise. **Rounding is a property of the BOOK, not of the engine**, and the two books must
  be allowed to round differently. ⚠️ And depreciation is `basis × rate` — a multiplication by a
  fraction, which is **not closed** under the money quantum, so it takes the workspace's `× n ÷ d`
  in integer minor units with one rounding at the end, never a chain of quantized intermediates.
- **`deno task dep-corpus`'s coverage arm becomes the engine's definition of done**, and it is
  currently RED on four facets the owner's completeness ruling added. **It must be allowed to stay
  red**; turning it green by narrowing the required list would invert the whole method.
- ⚠️ **Where the package sits is deliberately left open.** Whether it is a subpath of the existing
  shared package or a sibling beside it is a publishing decision with a release-cadence argument on
  both sides, and nothing in this ADR turns on it. **What this ADR fixes is that there IS a
  boundary, that it is pure, and that the corpus can reach it.**
