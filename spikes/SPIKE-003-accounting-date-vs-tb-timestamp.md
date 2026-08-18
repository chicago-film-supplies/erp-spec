---
id: SPIKE-003
headline: TigerBeetle timestamps on imported history
question: >-
  How does TigerBeetle's timestamp behave when loading history, and what are the `imported` flag's
  timestamp and monotonicity semantics?
timebox: 3 days
method: >-
  Load a synthetic multi-year history with accounting dates far behind wall clock, using the
  `imported` flag. Probe whether user-supplied timestamps are accepted, whether they must be
  monotonic, and how they interact with normal live posting afterwards.
exit_criteria:
  - Documented rule for which field carries accounting date and which carries posting timestamp.
  - A demonstrated history load whose accounting dates precede their posting timestamps by years.
  - Confirmation that live posting resumes correctly after an import batch.
closes_adr: ADR-0010
status: open
---

## Notes

Feeds HOT-005 but does not settle it — whether TigerBeetle or DuckDB is the reporting source of
truth is a decision (OQ-009), not a finding.
