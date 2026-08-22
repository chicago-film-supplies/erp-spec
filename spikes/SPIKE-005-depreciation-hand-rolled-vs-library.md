---
id: SPIKE-005
headline: build or buy the depreciation engine
question: Hand-roll the depreciation engine, or adopt a library?
timebox: 1 week
method: >-
  Build the full rules surface as a test corpus first — worked examples with known-correct answers
  from IRS publications and GAAP references. Then evaluate candidate libraries against that corpus
  and estimate the hand-rolled implementation against the same.
exit_criteria:
  - "Test corpus covers: mid-month, half-year AND MID-QUARTER conventions; GDS vs ADS class lives; §179 and bonus effects on basis; §280F caps on listed property; partial disposals; prospective useful-life revisions; the deferred GAAP/tax difference. ⚠️ WIDENED 2026-08-22 (HOT-023) — mid-quarter is mandatory when the 40% test trips, not a third option, and §280F caps the combined §179 + bonus + MACRS figure this corpus computes."
  - Every candidate is scored against that corpus, with failures itemised rather than summarised.
  - A decision with a stated migration path if the library is later abandoned.
closes_adr: ADR-0043
status: closed
---

## Notes

Highest-stakes correctness surface in the rebuild — errors here have filing consequences, not just
reporting ones.

Build the corpus before evaluating anything. A library chosen first and tested second gets graded on
the cases it happens to handle.

## Partial result — 2026-08-22. The corpus is built and graded; two facets remain

**Method followed as written: the corpus came first, authored with no candidate in view.** Its own
warning is why — _"a library chosen first and tested second gets graded on the cases it happens to
handle."_

### The corpus

`spikes/harness/depreciation-corpus.yaml`, graded by `deno task dep-corpus`.

⭐ **The answers are the IRS's, not ours.** Every case comes from IRS Publication 946 (2025)'s own
worked examples or its own percentage tables, so the known-correct answer is the publication's
rather than something computed here and then believed. ⚠️ **Extracted with `pdftotext -layout` from
the PDF, never through a summarizing fetch** — the repo has already been burned once by a summarized
fetch inventing a clean table the source did not contain.

**The grader has two arms and only one is about candidates.** Six arms reconcile the publication
against itself — where Pub 946 states BOTH a rate and a dollar amount, they must agree — which is an
**independent** property, not a fixed-point check on the transcription. All six pass across ten
stated figures. The seventh asserts **coverage facet by facet** and is **RED**:

```
FAILED | 6 passed | 1 failed
  corpus does not yet exercise: ADS class lives, partial disposals
```

⭐ **The coverage arm is the criterion.** Exit criterion 1 is a coverage claim, and a coverage claim
nothing can fail is exactly what burned SPIKE-012 and SPIKE-002 this same week. The six passing arms
matter because they prove the red one is a real gap rather than a broken test.

| facet                                             | case                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| mid-month · half-year · **mid-quarter**           | DEP-001, DEP-002, DEP-003, DEP-005                     |
| GDS class lives                                   | Tables A-1 to A-5, A-7a                                |
| ADS class lives, method and required-use triggers | DEP-012                                                |
| §179 effects on basis                             | DEP-007                                                |
| bonus effects on basis                            | DEP-008                                                |
| **§280F caps on listed property**                 | DEP-011                                                |
| **partial disposals**                             | DEP-013 — the Sankofa GAA example, six chained figures |
| prospective useful-life revisions                 | DEP-009 (ASC 250-10-45-17)                             |
| deferred GAAP/tax difference                      | DEP-010 (ADR-0026)                                     |

### ⭐ FINDING 1 — the scope list is short, and the missing rule is mandatory (HOT-023)

Three artifacts name **two** conventions; REQ-FA-002 names **three**. **The lone dissenter is
right.** Pub 946 L2326: _"**Use** this convention if … more than 40% …"_ — no election.

⚠️ **AN ASSET'S CONVENTION IS NOT A PROPERTY OF THE ASSET.** The 40% test runs over everything
placed in service in the entire year, so it cannot be resolved at acquisition — only once the year
closes. **A single late-December purchase retroactively changes the first-year deduction of every
personal-property asset placed in service earlier that year.** Pub 946 works it with the dollars
stated: a machine placed in **January** takes mid-quarter because of a computer bought in October.

⇒ **An engine that resolves convention at acquisition is wrong and wrong silently** — every figure
it produces is plausible. `DEP-002` is the case that catches it.

**A second gap named by no artifact: listed property and §280F.** CFS holds `1700 Vehicles`,
ADR-0030 already moved vehicle cost into COGS, and a business-use drop triggers recapture. Whether
it belongs in this spike or its own is in HOT-023's resolution shape.

### ⭐ FINDING 2 — the rules surface is year-versioned, and 2025 moved mid-year by legislation

This is the input the build-versus-buy decision actually turns on, and **it is not arithmetic**:

- **Bonus is two regimes inside one tax year** — 40% for property acquired before 2025-01-20, and
  **100%** for property acquired _and_ placed in service after 2025-01-19, reinstated by **P.L.
  119-21**, with an election to take 40% instead. ⇒ **the rate is not derivable from the
  placed-in-service date alone**: it needs the acquisition date, the property type, and an election.
- §179 sits at $2,500,000 / $4,000,000 phase-out / $31,300 SUV cap — every figure year-specific.
- **§168(n) qualified production property is entirely new**, for property placed in service after
  2025-07-04.

⇒ **A hand-rolled engine is a standing annual commitment to track tax legislation** and re-verify
every figure against a fresh publication. The corpus is pinned to one tax year for that reason, and
re-running it annually is a cost that belongs in the comparison rather than in a footnote.

### ⚠️ A corpus-design finding that only appears once you try to grade something

**Pub 946's worked examples round to the whole DOLLAR.** $1,000 × 10.71% is $107.10 and the
publication states $107; $4,000 × 21.43% is $857.20 and it states $857. An exact-cents engine
differs from the publication by up to fifty cents a line. **So the corpus has to state a rounding
rule and a tolerance or it is not gradeable at all** — and that is invisible until something
actually tries to reconcile a figure.

### ⭐ FINDING 3 — §280F was scoped OUT on a premise the owner corrected the same day

It was first excluded by **measuring the population**: two owned vehicles, used exclusively for
revenue work, so the recapture branch had no members. Correct reasoning — applied to a static fleet.

**Owner, 2026-08-22: _"we do expect to acquire more vehicles."_**

⇒ ⚠️ **A population measured today is not a population, it is a snapshot** — and this is the harder
failure to catch, because nothing about the reasoning looked weak.

⭐ **The primary source then settled it independently of fleet size.** Pub 946: _"The depreciation
deduction, **including the section 179 deduction and special depreciation allowance**, you can claim
for a passenger automobile each year is limited."_ **§280F is a CEILING on the exact figure this
spike's engine computes**, so it could never have been a separate spike — a candidate either applies
it to the combined number or returns one too large and entirely plausible.

**No spike was minted.** What remains is a POLICY question, `OQ-054`, asked **per vehicle** because
two vans can straddle the 6,000 lb threshold and one fleet-level answer hides it.

⚠️ **Carry this to the next purchase:** a vehicle is a large-basis asset, so a **Q4 vehicle purchase
is the single most likely trigger of the 40% test** — retroactively re-computing every
personal-property asset placed in service earlier that year. **The timing of a vehicle purchase is a
tax decision, not only a fleet one.**

## Result — BUILD it, behind a package boundary. Closed 2026-08-22 → ADR-0043

**All three exit criteria met.** The corpus is `spikes/harness/depreciation-corpus.yaml`, graded by
`deno task dep-corpus` (**14/14**), candidates scored by `deno task dep-candidates`, and the annual
refresh executes as `deno task dep-refresh` plus a scheduled workflow.

**There is nothing to buy** — `macrs` returns zero packages on npm _and_ JSR, and the best of four
candidates evidences 2 of 10 required facets while being an IFRS engine. **ADR-0043** decides: build
it, behind a pure package boundary the corpus can import, computed **per taxpayer-year** because a
per-asset signature cannot be answered correctly, against **effective-dated rule data** so that a
new tax year is a data change rather than new functionality.

⭐ **Building the corpus first paid four times before a single candidate was examined** — the scope
gap (HOT-023), the year-versioning finding, the §280F ceiling, and the rounding regime. **None would
have surfaced from comparing libraries**, which is exactly what the method predicted.

### ⭐ FINDING 4 — the scope ruling reopened criterion 1, and that is the arm working

**Owner, 2026-08-22: _"the depreciation engine should cover all valid gaap and usa tax cases"_** —
not only the ones CFS uses today, and _"i dont want to build new functionality if that changes in
the future."_

⇒ **Four facets excluded earlier the same day came back in scope**: short tax years, the full ADS
class-life tables, §280F recapture, and §168(n). Each had been excluded on a **measured population
of zero**. Exit criterion 1 went from MET back to NOT MET and the coverage arm went green → red
naming exactly those four. ✅ **All four are now covered** — DEP-014 through DEP-017 — and the arm
is green again **by adding data, never by narrowing the required list.**

⚠️ **THE PATTERN, and it is the second correction of this shape in one session** — §280F was scoped
out on a fleet of two and corrected by _"we do expect to acquire more vehicles."_ **Measuring the
population is the right test for "is this URGENT" and the wrong test for "is this IN SCOPE" when the
requirement is completeness.** The repo's own footgun — _do not mint a branch before measuring its
population_ — is about not inventing machinery for branches nothing takes. **It does not license
omitting a rule that law requires and a future asset will reach.** The two questions look identical
and are answered by different people.

⚠️ **And "no new functionality later" is achievable while "no work later" is not.** Coverage
completeness is buildable once. Rule currency is not, by any design — the bonus rate changed inside
tax year 2025 by an Act of Congress. **They reconcile by SHAPE**: year-versioned rule DATA consumed
by the algorithm makes an annual update a data change plus a corpus re-run. That is ADR-0043/D4, and
it comes from the ruling rather than from taste.

### Criterion 2 — ✅ MET. There is nothing to buy, and it is measured

`deno task dep-candidates` sweeps both registries the stack can consume and scores each candidate
facet by facet, **itemised rather than summarised** as the criterion requires.

| candidate                                        | evidences                                     | verdict       |
| ------------------------------------------------ | --------------------------------------------- | ------------- |
| npm `macrs` · JSR `macrs`                        | **0 packages exist on either**                | —             |
| npm `section179`                                 | **0 packages exist**                          | —             |
| `asset-depreciation-calculator`                  | 0 of 10 · last published 2021                 | not scoreable |
| `@finprecise/depreciation`                       | 0 of 10 · SLN/DB/DDB/SYD, the Excel functions | not scoreable |
| `@classytic/assets`                              | 2 of 10 · **IFRS** (IAS 16/36/8)              | not scoreable |
| `@simplifyingcalculation/irs-sec-179-calculator` | 2 of 10 · §179 only                           | not scoreable |

⚠️ **Every failure is a CAPABILITY gap, not a quality judgement.** The nearest candidate is a
competent engine for the wrong standard — IFRS has no MACRS, no §179 and no §280F because those are
US tax law rather than accounting. ⭐ **The finding is an ABSENCE, which is the most perishable kind
of claim** — true until someone publishes one, and nothing announces that. It is a re-runnable probe
for exactly that reason.

### Criterion 3 — ✅ MET → ADR-0043, and the migration path is INVERTED

The criterion asks for "a stated migration path **if the library is later abandoned**" — written
when buying looked possible. **There is no library to abandon.** ⇒ the path that matters runs the
other way: if a credible engine ever appears, the probe finds it, the corpus scores it, and the
package boundary is the seam it is swapped in behind. **The corpus and the boundary together ARE the
migration path, in both directions.**

ADR-0043 decides: build; behind a **pure package boundary** the corpus can import (SPIKE-006's
precedent); computed per **taxpayer-year** rather than per asset, because DEP-002 proves a per-asset
signature cannot be answered correctly; on **year-versioned rule data**.

### Where the spike stands

| criterion                                                        | state                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 — test corpus covers the rules surface                         | ✅ **MET** — 15 cases, 14 facets, `deno task dep-corpus` 14/14 green |
| 2 — every candidate scored against the corpus, failures itemised | ✅ **MET** — `deno task dep-candidates`; nothing reaches the floor   |
| 3 — a decision with a stated migration path                      | ✅ **MET** → `ADR-0043` (proposed)                                   |

⇒ **`in_progress`.** Nothing is blocked on infrastructure or on anyone else — criterion 2 is
candidate evaluation against a yardstick that now exists, and criterion 3 follows from it. ⚠️ **The
corpus was authored with no candidate in view and must stay that way.** Widening it to accommodate
what a library happens to support would invert the method it was built to serve.

## Notes

Highest-stakes correctness surface in the rebuild — errors here have filing consequences, not just
reporting ones.

Build the corpus before evaluating anything. A library chosen first and tested second gets graded on
the cases it happens to handle. ✅ **Followed. And it paid twice before a single candidate was
looked at** — the scope gap (HOT-023) and the year-versioning finding both came out of building the
corpus, and neither would have surfaced from comparing libraries.
