---
id: ADR-0021
title: Item type determines the revenue account; duplicate charge products are canonicalized
status: accepted
date: 2026-08-09
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-008, OQ-014]
supersedes:
superseded_by:
frozen_sha256: 1b3db617ee73a2d7f636b59b533dcc9b8261f2b48042dc832418a9105a2c8057
---

> **In the context of** duplicate active charge products booking the same economic event to
> different revenue accounts, **facing** posting rules that must map a billed line to exactly one
> account, **we decided** that the item type determines the account and the correctly-typed
> duplicate is canonical, **to achieve** a rule a posting engine can enforce, **accepting** that
> some historical revenue moves account under ADR-0020's restatement.

## Context

- Duplicate ACTIVE products book the same event to different accounts, and the inconsistency runs
  both ways: "Distance Charge" exists as `service` @ 4100 _and_ `surcharge` @ 4110; "Rush Charge"
  exists twice, both `surcharge` @ 4100; "Off Hours Surcharge" (`service` @ 4100) coexists with "Off
  Hours Charge" (`surcharge` @ 4110).
- So the source data does not determine the posting — the account depends on which of two
  identically-named active products the operator happened to pick.
- A per-pair judgement would resolve today's duplicates and leave nothing to stop the ambiguity
  recurring.

## Decision

**Type determines the account, always:** a `surcharge` books to **4110**, a `service` to **4100**.

For each duplicate pair, the correctly-typed member is **canonical**; the other is deactivated — not
deleted, per the no-hard-deletes fence.

## Consequences

- The posting engine gets a mechanical rule rather than a lookup table of exceptions, which is what
  makes this non-recurring.
- **Rush Charge is the case that proves the rule bites**: both members are typed `surcharge` but
  both book to 4100, so both are wrong under this decision and both move to 4110. A rule that only
  ratified existing data would have missed it.
- Historical lines on the deactivated member keep their original account unless ADR-0020's
  restatement moves them. Whether restatement covers account reassignment as well as dimension
  assignment is an `m3` question — the two are different kinds of change and only one of them moves
  money between accounts.
- Deactivating a product that invoices reference means those references must still resolve. The
  no-hard-deletes fence already requires this; it is called out here because a "cleanup" that
  deletes the loser is the obvious wrong move.
