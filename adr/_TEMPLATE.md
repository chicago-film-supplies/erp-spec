---
id: ADR-0000
headline: # REQUIRED, <=12 words and ideally under 5 (gate 20). What this is CALLED where it is
# cited — "vehicle cost into COGS" — not what it IS, which is `title`. A bare id is unreadable to
# everyone who did not write it, including you next week (ADR-0037).
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
measurements: [] # the figures this ADR asserts. Each: id (M1…), value, `of` (the POPULATION it is
# a figure of — a figure without one is a number nobody can check), `as_of`, and a dated pinned
# `source:`. ~95% of measured claims decompose cleanly; this is the block that pays (gate 21).
# ⚠️ `as_of` is NOT the source date. The SOURCE date says when you READ; `as_of` says when the
# population WAS that population — and v1 is under active development with a pending CRMS break, so
# the referent moves underneath a description that stays word-for-word the same. The two
# legitimately differ (a 2026-01-24 import cohort, measured 2026-08-24), and `as_of` may precede its
# source but never follow it: that would be a forecast wearing a measurement's clothes.
# ⭐ SPIKES CARRY THIS BLOCK TOO, and it is required once a spike is no longer `closed` — a spike is
# where measuring actually happens, and it typed nothing until 2026-08-24.
asserts: [] # claims with ids. Each: id (D1/P1…), kind: decision | premise, claim, and — for a
# premise — a `source:`. A PREMISE is a fact the decision rested on: it may later gain
# `status: refuted` + `refuted_by:`, which is how a frozen ADR says a fact it cited was wrong.
# ⚠️ Type the CLAIM, never the REASON. The reasoning stays in the body and that is deliberate:
# every notation surveyed that typed rationale produced a standard nobody implemented.
# frozen_asserts_sha256: <hash> — added AT ACCEPTANCE over the two blocks above, separate from the
# body's hash. Once frozen, only `status` and `refuted_by` may be added.
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
