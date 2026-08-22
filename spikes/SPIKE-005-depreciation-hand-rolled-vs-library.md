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
  - "Test corpus covers: mid-month and half-year conventions; GDS vs ADS class lives; §179 and bonus effects on basis; partial disposals; prospective useful-life revisions; the deferred GAAP/tax difference."
  - Every candidate is scored against that corpus, with failures itemised rather than summarised.
  - A decision with a stated migration path if the library is later abandoned.
closes_adr: new
status: in_progress
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

| facet                                   | state                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| mid-month · half-year · **mid-quarter** | ✅ DEP-001, DEP-002, DEP-003, DEP-005                                 |
| GDS class lives                         | ✅ Tables A-1 to A-5, A-7a                                            |
| **ADS class lives**                     | ❌ recovery periods not extracted (Table A-20, class lives at L6552+) |
| §179 effects on basis                   | ✅ DEP-007                                                            |
| bonus effects on basis                  | ✅ DEP-008                                                            |
| **partial disposals**                   | ❌ GAA examples at L3399/L3405 not extracted                          |
| prospective useful-life revisions       | ✅ DEP-009 (ASC 250-10-45-17)                                         |
| deferred GAAP/tax difference            | ✅ DEP-010 (ADR-0026)                                                 |

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

### Where the spike stands

| criterion                                                        | state                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 — test corpus covers the rules surface                         | 🟡 **8 of 10 facets**; coverage arm RED on ADS and partial disposals |
| 2 — every candidate scored against the corpus, failures itemised | ⛔ not started — the corpus had to exist first                       |
| 3 — a decision with a stated migration path                      | ⛔ not started                                                       |

⇒ **`in_progress`.** Nothing here is blocked on infrastructure or on anyone else; the remaining work
is extraction and evaluation.

## Notes

Highest-stakes correctness surface in the rebuild — errors here have filing consequences, not just
reporting ones.

Build the corpus before evaluating anything. A library chosen first and tested second gets graded on
the cases it happens to handle. ✅ **Followed. And it paid twice before a single candidate was
looked at** — the scope gap (HOT-023) and the year-versioning finding both came out of building the
corpus, and neither would have surfaced from comparing libraries.
