---
kind: owner
title: >-
  Owner rules the Quint specs run in CI as a separate job, so a formal spec stops being a guarantee
  that nothing executes
contexts: [ledger]
source: >-
  Owner, 2026-10-09, erp-spec session, choosing between a separate CI job and deferring to an issue.
confidence: high
promotes_to: [ADR-0054]
verified: false
triage_count: 0
---

- Today CI checks only that each `.qnt` exists and that `formal/README.md` records a clean run
  (`tools/milestone-checks.ts:546-559`, which says it "does NOT run a model checker"). Results are
  copied into the README by hand.
- That is a stated guarantee nothing executes, which the repo's own rules say is not a guarantee.
- Ruling: a **separate** CI job runs the Quint specs (simulator, `quint test`, and the fail-closed
  companions asserting they DO fail). `deno task validate` stays free of npm dependencies; the new
  job carries the Quint dependency, pinned.
