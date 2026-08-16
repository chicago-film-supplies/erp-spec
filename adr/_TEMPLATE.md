---
id: ADR-0000
title:
status: proposed # proposed | accepted | rejected | superseded
date: 2026-08-08
review_by: # REQUIRED while proposed. validate fails once this date passes.
deciders: [repo owner]
contexts: []
relates_to: [] # HOT-/OQ-/SPIKE-/REQ- ids
supersedes: # the act. Symmetric — the target owes `superseded_by` back, and `status: superseded`.
supersedes_on_acceptance: # the PROMISE, while this ADR is still `proposed`. One-way: nothing is
# written onto the target until acceptance, so it stays in force until something actually replaces
# it. At acceptance, move the id to `supersedes` and write both fields on the target. Gate 6 fails
# on an `accepted` ADR that still carries this, so the promise cannot be quietly forgotten.
superseded_by:
# frozen_sha256: <body SHA-256>  — added AT ACCEPTANCE, not before. Gate 14 recomputes it every run
# and fails if the body has changed since (ADR-0034). `validate` prints the value to paste in.
# Front matter is not hashed: `relates_to` must stay writable so a later correction can be linked.
---

> **In the context of** <situation>, **facing** <concern>, **we decided** <option>, **to achieve**
> <quality>, **accepting** <downside>.

## Context

What forces are at play. Terse, factual, no narrative.

## Decision

The decision, stated in the active voice.

## Considered options

Only if real options existed. Delete this section otherwise — a fabricated options list is worse
than none.

## Consequences

What becomes true, including what becomes harder. Enumerate the work this pulls into scope.
