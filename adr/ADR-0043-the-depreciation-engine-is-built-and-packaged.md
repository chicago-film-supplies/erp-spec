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
  - id: D5
    kind: decision
    claim: >-
      Rule sets are EFFECTIVE-DATED, not keyed by tax year, and are selected by the asset's own
      acquisition and placed-in-service dates. The engine refuses to compute a date no rule set
      covers; it never extrapolates from the most recent one.
  - id: D6
    kind: decision
    claim: >-
      A rule set is immutable once published and is NEVER retired. Forward-edge expiry only — a
      39-year asset placed in service in 2025 depreciates under 2025's rules until 2064, so every
      historical set is retained for as long as any asset placed under it is still depreciating.
  - id: D7
    kind: decision
    claim: >-
      Each rule set carries a dated verification stamp naming the publication it was extracted
      from. The annual refresh is an agent-driven research pass whose output is a DIFF with a line
      number into a freshly extracted primary source for every changed figure — never a figure
      stated from knowledge.
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

### ⭐ A tax YEAR is not fine-grained enough, and 2025 proves it

`DEP-008` measures two bonus regimes **inside one tax year**, split by acquisition date: 40% for
property acquired before 2025-01-20, 100% for property acquired and placed in service after
2025-01-19, with an election either way.

⇒ **A table keyed by tax year cannot express 2025 at all.** The key has to be a date range, and the
selector has to be the asset's own acquisition and placed-in-service dates rather than "the current
year" (D5).

⚠️ **But "effective through" means something narrower than it sounds, and reading it as expiry is
the trap.** A rule set stops applying to NEW placements; it never stops being NEEDED. Nonresidential
real property runs 39 years, so an asset placed in service in 2025 is still depreciating under
2025's table in 2064. ⇒ **rule sets are append-only and immutable, and expiry exists on the forward
edge only** (D6). The engine may refuse a date it has no rules for; it may never refuse a date it
does.

### The annual refresh fails CLOSED, and the agent is not allowed to know the answer

⚠️ **An unmatched date must throw rather than fall back to the most recent rule set.** A fallback
computes a 2027 schedule from 2026's limits and returns an entirely plausible number that nobody
queries — the repo's own rule, in its sharpest form: an inclusive declaration fails closed, an
exclusion list fails open, and "use the latest one we have" is an exclusion list.

⭐ **The refresh is an agent-driven research pass, and its single hard constraint is that the agent
must extract the primary source rather than state a figure** (D7). This repo has measured what
happens otherwise: **four fabricated sources were caught and discarded across three surveys**, every
one caught by demanding a verbatim quote with a URL, and the passes that extracted primary sources
locally produced the strongest evidence here. **"What is next year's §179 limit" is precisely the
question a model answers confidently and sometimes wrongly, and a wrong §179 limit has filing
consequences.**

So the pass is shaped to make fabrication mechanically impossible rather than merely discouraged:

1. **Fetch** the new publication as a PDF and extract it **locally**.
2. **Locate** each figure by search against that extraction, capturing a line number.
3. **Propose a diff** against the previous rule set — every changed figure carrying its line number
   and the surrounding quoted text.
4. **Re-run the corpus** against the proposed set.
5. **A human accepts**, exactly as an ADR is accepted rather than self-accepted.

⭐ **Step 3 is the checkable one, and it is what makes the whole thing safe: a line number cannot be
fabricated, because a grep against the extraction either confirms it or does not.** The verification
stamp records which publication, extracted when — so a rule set that has never been re-verified is
visibly distinguishable from one that has.

### ⚠️ What the refresh can and cannot automate — measured 2026-08-22, not assumed

| source                               | machine-readable                                                                                                                    | carries what the rule sets need                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **eCFR API** (`ecfr.gov/api`)        | ✅ free, no key, **dated** — Title 26 reports `latest_amended_on` and `up_to_date_as_of`                                            | 26 CFR, the Treasury _regulations_. Good for rule TEXT, and it does not carry the annual dollar figures                                                   |
| **Federal Register API**             | ✅ free, no key, filterable by agency                                                                                               | IRS regulations and notices. ⚠️ **Revenue Procedures generally publish in the IRB, not here**, so the annual inflation figures are not reliably reachable |
| **IRS publications and Rev. Procs.** | ⚠️ fetchable PDFs, not structured (`/pub/irs-pdf/p946.pdf`, `/pub/irs-drop/rp-*.pdf`, both HTTP 200)                                | ⭐ **This is where §179's limits, the §280F caps and the bonus rate actually live**                                                                       |
| **IRS developer API**                | ❌ **none** — `api.irs.gov` does not resolve                                                                                        | —                                                                                                                                                         |
| **FASB ASC (GAAP)**                  | ❌ **none.** `asc.fasb.org` and `fasb.org` both return **HTTP 403** to a plain client; the Codification is copyrighted and licensed | —                                                                                                                                                         |

⇒ **The tax half automates as local PDF extraction and the GAAP half does not automate at all.**
That is not a limitation of the design — it is the shape of what is published, and D7's pipeline was
built around it rather than in spite of it.

⭐ **eCFR is a WATCH rather than a SOURCE, and it is free.** It cannot supply a dollar figure, but a
change in Title 26's `latest_amended_on` is a cheap signal that something may have moved — a trigger
for the refresh pass rather than an input to it.

⚠️ **And the GAAP 403 has already cost this corpus something.** `DEP-009` (ASC 250-10-45-17) and
`DEP-010` are sourced from **PwC Viewpoint, a secondary source**, because the primary one is
paywalled. Every tax case here quotes a primary source; **no GAAP case does, and no automated pass
will change that.** It is recorded rather than smoothed over.

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
- **Key the rule data by tax year.** Rejected: `DEP-008` shows 2025 needs two rule sets, so the key
  must be a date range. ⚠️ Recorded because it is the obvious first design and it looks sufficient
  right up until a mid-year Act of Congress.
- **Fall back to the most recent rule set for an unknown year.** Rejected: it converts a loud
  failure into a silent one, on numbers with filing consequences.
- **Retire old rule sets once superseded.** Rejected: 39-year property outlives them by decades.
- **Build behind a package boundary, per taxpayer-year, on effective-dated versioned data**
  (chosen).

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
