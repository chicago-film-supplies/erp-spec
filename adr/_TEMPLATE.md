---
id: ADR-0000
title:
status: proposed # proposed | accepted | rejected | superseded
date: 2026-08-08
review_by: # REQUIRED while proposed. validate fails once this date passes.
deciders: [repo owner]
contexts: []
relates_to: [] # HOT-/OQ-/SPIKE-/REQ- ids
accounting_shaped: # REQUIRED, true | false. Absence is not an answer (gate 19, CLAUDE.md rule 8a).
# `true` iff the decision changes what the BOOKS SAY — where an amount posts, what an account means,
# how two books relate, how a statement is presented. `false` where it changes how the system is
# BUILT, even when the subject is the ledger: 31 of 38 ADRs name the `ledger` context, so the
# context list cannot decide this and you must.
survey: [] # `inbox/` paths, REQUIRED before `accepted` when accounting_shaped. Drafting is free of
# the survey and never of the declaration; gate 19 fails at acceptance and warns before it.
# survey_exemption: only for an ADR already frozen without one — say why it never will have one.
# not_accounting_reason: required when `accounting_shaped: false` and the body names a GL code.
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
