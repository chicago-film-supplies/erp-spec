---
kind: finding
title: >-
  SPIKE-005's convention list is short by one — mid-quarter is MANDATORY when the 40% test trips,
  it retroactively changes assets placed in service months earlier, and listed property is missing
  from the scope entirely
contexts: [fixed-assets, ledger]
source: >-
  IRS Publication 946 (2025), Cat. No. 13081F, dated 2026-03-13, extracted locally with
  `pdftotext -layout` on 2026-08-22 — never through a summarizing fetch. Line numbers are into that
  extraction. Corpus and grader: `spikes/harness/depreciation-corpus.yaml`, `deno task dep-corpus`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Found while building SPIKE-005's test corpus, which its own method requires be built **before** any
candidate is evaluated.

## The enumeration disagrees with itself, three to one

| artifact                                                                   | conventions named                     |
| -------------------------------------------------------------------------- | ------------------------------------- |
| `adr/ADR-0007:43` — **accepted, immutable**                                | mid-month, half-year                  |
| `spikes/SPIKE-005` exit criterion 1                                        | mid-month, half-year                  |
| `contexts/fixed-assets/requirements.yaml:13` — the scope banner            | mid-month, half-year                  |
| **`contexts/fixed-assets/requirements.yaml:52`** — REQ-FA-002's own caveat | mid-month, half-year, **mid-quarter** |

**The lone dissenter is right**, and not as a matter of preference.

## Mid-quarter is not a third option. It is mandatory, and it is retroactive

Pub 946 L2326, verbatim:

> "**The mid-quarter convention.** Use this convention if the mid-month convention does not apply
> and the total depreciable bases of MACRS property you placed in service during the last 3 months
> of the tax year (excluding nonresidential real property, residential rental property, any railroad
> grading or tunnel bore, property placed in service and disposed of in the same year, and property
> that is being depreciated under a method other than MACRS) are more than 40% of the total
> depreciable bases of all MACRS property you placed in service during the entire year."

Three things follow, and the second is the one that reaches the schema:

1. **"Use this convention if" — there is no election.** The three conventions are a strict
   precedence, not a menu: mid-month by property type, then mid-quarter by the 40% test, then
   half-year, which the pub defines purely as the fallback — _"Use this convention if neither the
   mid-quarter convention nor the mid-month convention applies"_ (L2289).
2. ⭐ **AN ASSET'S CONVENTION IS NOT A PROPERTY OF THE ASSET.** The test is computed over everything
   placed in service in the entire year, so it cannot be resolved when an asset is acquired — only
   once the tax year closes. **A single late-December purchase retroactively changes the convention,
   and therefore the first-year deduction, of every personal-property asset placed in service
   earlier that same year.**
3. **The exclusions are load-bearing.** Real property is excluded from the test's numerator _and_
   its denominator, so an engine that computes the ratio over "everything placed in service" gets
   the wrong answer for any taxpayer holding buildings. **CFS holds two: `1600 Buildings` and
   `1603 Building Improvements`.**

**Pub 946 works the case itself, with the dollars stated** (L2628–2663): a machine placed in
**January**, furniture in September, a computer in October; the computer's $5,000 is 50% of the
$10,000 total, so the mid-quarter convention applies to **all three** — including the machine bought
nine months before the purchase that changed it.

⇒ **An engine that resolves an asset's convention at acquisition is wrong, and wrong silently** —
every figure it produces is plausible. That is exactly the class of defect this corpus exists to
catch, and it is caught by `DEP-002`.

## A second gap, not named by any of the four artifacts

⚠️ **Listed property and §280F are absent from every enumeration, and CFS holds `1700 Vehicles`.**
Passenger automobiles carry §280F caps, and a drop in business-use percentage triggers recapture —
Pub 946 works it at L3867 (the Ellen Rye truck example, which computes $4,018 of excess
depreciation). Vehicles over 6,000 lb GVWR are treated differently, which for a rental house's box
trucks is the ordinary case rather than the exception. **ADR-0030 already moved vehicle cost into
COGS**, so vehicles are not a hypothetical corner of this spec.

## ⚠️ And the surface is not static — it changed inside tax year 2025 by legislation

The bonus allowance is **two regimes in one year**: 40% for qualified property acquired before
2025-01-20, and **100%** for property acquired _and_ placed in service after 2025-01-19, reinstated
by **P.L. 119-21** — with an election to take 40% instead. §179 sits at $2,500,000 with a $4,000,000
phase-out threshold and a $31,300 SUV cap, all year-specific. A new category, **§168(n) qualified
production property**, appears for property placed in service after 2025-07-04.

⭐ **This is the input the build-versus-buy decision actually turns on, and it is not arithmetic.**
A hand-rolled engine is a standing annual commitment to track tax legislation and re-verify every
figure against a fresh publication. The corpus is pinned to one tax year for exactly that reason.

## What is already done about it

`spikes/harness/depreciation-corpus.yaml` **covers mid-quarter regardless of the enumeration** —
`DEP-002` (the 40% test and the three-asset retroactive case), `DEP-003` (all four quarter tables),
`DEP-004` (disposal under mid-quarter). So the practical gap is closed; **the recorded scope is what
still disagrees with itself**, and an enumeration that omits a mandatory rule will mislead whoever
reads it next.

`deno task dep-corpus` grades the corpus: six arms reconcile the IRS's stated dollars against the
IRS's stated rates, and a seventh asserts coverage facet by facet and is **currently RED** on ADS
class lives and partial disposals.
