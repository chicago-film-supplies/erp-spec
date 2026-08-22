---
kind: decision
title: >-
  Owner — the depreciation engine covers ALL valid GAAP and US tax cases, not just the ones CFS uses
  today; CFS runs a ton of §179 assets with everything else straight line, and the deferred
  difference is therefore the normal case rather than an edge one
contexts: [fixed-assets, ledger]
source: "Owner, 2026-08-22, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Given while SPIKE-005's candidate evaluation was running.

## The rulings

> _"we have a ton of section 179 assets, everything else is straight line, i dont want to build new
> functionality if that changes in the future, the depreciation engine should cover all valid gaap
> and usa tax cases"_

Three separate things, and they pull in different directions:

1. **Scope is COMPLETENESS, not current usage** — all valid GAAP and US tax cases.
2. **CFS's own book today**: heavy §179 on the tax side, straight line on everything else.
3. **No incremental build** — the engine should not need new functionality when CFS's asset mix
   changes.

## ⚠️ It overrides three scope decisions taken earlier the same day, and the pattern is the lesson

`spikes/harness/depreciation-corpus.yaml` had excluded three facets, each on the same reasoning —
**the population is zero today**:

| excluded                       | the reasoning at the time                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| short tax year                 | CFS is a calendar-year taxpayer with no short year                                    |
| the full ADS class-life tables | none of CFS's required-use triggers fires                                             |
| §280F recapture                | the fleet is used exclusively for revenue work, so business use cannot fall below 50% |

**All three are valid US tax cases, so all three are now in scope.** ⇒ **Exit criterion 1 goes back
from MET to not-met**, and the corpus's coverage arm goes red again. That is the arm doing its job:
the requirement widened, so the claim it guards is no longer true.

⭐ **THE PATTERN, and this is the second correction of the same shape in one session.** §280F was
scoped out earlier on a measured population of two vehicles, and the owner corrected it with _"we do
expect to acquire more vehicles."_ Now three more exclusions fall to the same ruling.

⇒ **Measuring the population is the right test for "is this URGENT". It is the wrong test for "is
this IN SCOPE" when the requirement is completeness.** The repo's own footgun — _do not mint a
branch before measuring its population_ — is about not inventing machinery for branches nothing
takes. It does not license omitting a rule that law requires and that a future asset will reach.
**The two questions look identical and are answered by different people: coverage is the owner's,
urgency is measurable.**

## ⭐ The deferred difference is the NORMAL case, not an edge case

§179 is a **tax** election; GAAP has no §179 and depreciates over useful life. So "a ton of §179
assets, everything else straight line" describes **two books that diverge on most assets**, not a
few.

`ADR-0026` already decided that only the GAAP book posts to the ledger and the tax book is derived
at report time from the register's per-book schedules. That decision was framed around a fleet where
_"a §179 election expenses an asset in year 1 that GAAP carries for 5, 10 or 20"_ — and this ruling
says that is the ordinary shape of CFS's register rather than an illustration.

⇒ **`DEP-010`'s deferred difference is load-bearing, high-volume, and the thing most likely to be
materially wrong.** An engine that produces one book well and the other approximately is not
half-right here; it is wrong on the number ADR-0026 exists to produce.

## ⚠️ "No new functionality later" is achievable; "no work later" is not, and they are different

**Coverage completeness is achievable** — build every valid case once, which is the ruling.

**Rule currency is not**, by any design. Measured on this same day from IRS Publication 946 (2025):
the §179 limit, the phase-out threshold and the SUV cap are all year-specific, and the bonus rate
**changed inside tax year 2025 by an Act of Congress** — P.L. 119-21 reinstated 100% for property
acquired and placed in service after 2025-01-19, against 40% before it, with an election either way.

⇒ **The two are reconciled by SHAPE rather than by effort.** If the year's rates, limits and
thresholds are **data versioned by tax year** and the algorithm consumes them, then an annual update
is a data change plus a corpus re-run — **not new functionality**, which is exactly what the ruling
asks for. If the figures are baked into the algorithm, every year is a code change and the ruling
cannot be honoured no matter how complete the first build is.

**That is a design constraint on the engine, and it comes from the owner's ruling rather than from
taste.**
