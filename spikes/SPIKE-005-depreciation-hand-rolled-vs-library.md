---
id: SPIKE-005
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
status: open
---

## Notes

Highest-stakes correctness surface in the rebuild — errors here have filing consequences, not just
reporting ones.

Build the corpus before evaluating anything. A library chosen first and tested second gets graded on
the cases it happens to handle.
