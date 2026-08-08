---
id: ADR-0009
title: Anticorruption layer — foreign identifiers never enter domain models
status: proposed
date: 2026-08-08
review_by: 2026-10-15
deciders: [repo owner]
contexts: [ledger, billing, banking, ordering]
relates_to: [HOT-006]
supersedes:
superseded_by:
---

> **In the context of** integrating Plaid and any surviving external system, **facing** a
> tracking-id drift that silently cost 28.7% of revenue its dimension, **we decided** that foreign
> identifiers never enter domain models and an unresolvable id is a hard error, **to achieve**
> failures that are loud at the boundary instead of silent in the data, **accepting** that
> ingestion will refuse work that the current system would have accepted.

## Context

This decision exists because the opposite policy has a measured cost.

- Xero drops an unresolvable tracking option id and returns success. The line lands untracked.
- CFS-side denormalization independently failed for service-group categories.
- Result, measured 2026-08-08: 28.7% of line revenue with no product line; 254 lines where the CFS
  denorm was null while the Xero id survived.

A null that means "we could not translate this" is indistinguishable from a null that means "this
legitimately has no value" — and once written, the distinction is gone forever.

## Decision

Foreign-system identifiers never enter domain models. Translation happens at the boundary. **An
unresolvable identifier is a hard error, never a null.**

Pair this ADR with a **fitness function** — a dependency-cruiser rule — so that an import crossing
the boundary fails CI. A decision with no enforcement is a comment.

## Consequences

- Ingestion refuses work it cannot translate. That is the intent, and it will be inconvenient in
  exactly the moments it matters.
- Every boundary needs a translation table and an explicit unmapped-value path — a quarantine, not
  a null.
- The fitness function has to be landed **red** against a deliberate violation and seen to fail,
  or it is not known to be a guard.
