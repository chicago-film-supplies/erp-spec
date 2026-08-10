---
id: ADR-0009
title: Anticorruption layer — foreign identifiers never enter domain models
status: proposed
date: 2026-08-08
review_by: 2026-09-15
deciders: [repo owner]
contexts: [ledger, billing, banking, ordering]
relates_to: [HOT-006]
supersedes:
superseded_by:
---

> **In the context of** integrating Plaid and any surviving external system, **facing** silent
> translation failures at a foreign boundary, **we decided** that foreign identifiers never enter
> domain models and an unresolvable id is a hard error, **to achieve** failures that are loud at the
> boundary instead of silent in the data, **accepting** that ingestion will refuse work that the
> current system would have accepted.

## Context

- Xero drops an unresolvable tracking option id and returns success. The line lands untracked. This
  is documented Xero behaviour and is what the fence is against.
- A null that means "we could not translate this" is indistinguishable from a null that means "this
  legitimately has no value" — and once written, the distinction is gone forever.

⚠️ **The 28.7% originally cited here was not measuring this.** This ADR opened "facing a tracking-id
drift that silently cost 28.7% of revenue its dimension", and its Context reported "28.7% of line
revenue with no product line; 254 lines where the CFS denorm was null while the Xero id survived"
(measured 2026-08-08). Re-measured against the **product master** on 2026-08-10
(`inbox/2026-08-10-the-untracked-revenue-denorm-is-repaired-and-28-7-percent-is-now-15-percent.md`),
that population decomposes into 227 lines whose product **was** categorised and whose line denorm
was never derived, 128 custom lines with no product master to inherit from, and 35 lines on a
genuinely uncategorised product — **$688.00, 0.041% of all line revenue**. The dominant defect was a
**CFS-side derivation that never ran** (api-cloudrun#473, repaired 2026-08-10), not foreign-id
drift. The number was evidence for the wrong proposition.

**The fence is retained on its own merits**, on the same grounds and by the same precedent as
`charter.md`'s no-hard-deletes fence, whose original evidence also failed to reproduce: Xero's
drop-and-succeed behaviour is real and documented independently of how much revenue it happened to
cost CFS, and the indistinguishable-null argument does not rest on a measurement at all. What is
retracted is the sizing and the attribution, not the decision.

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
- Every boundary needs a translation table and an explicit unmapped-value path — a quarantine, not a
  null.
- The fitness function has to be landed **red** against a deliberate violation and seen to fail, or
  it is not known to be a guard.
