---
id: ADR-0022
title: Invoice status decomposes into two derived projections
status: accepted
date: 2026-08-09
deciders: [repo owner]
contexts: [billing, ledger]
relates_to: [HOT-009, ADR-0014, ADR-0017]
supersedes:
superseded_by:
---

> **In the context of** an invoice status field that carries two different kinds of fact at once,
> **facing** two live defect populations that are one of each, **we decided** to decompose it into
> two independently derived projections, **to achieve** a state that cannot go stale and a voided
> invoice that cannot hold a balance, **accepting** that the single `status` enum every reader
> knows is retired.

## Context

- `invoice.status` conflates an **assigned lifecycle** fact (`draft` / `issued` / `voided`) with a
  **derived balance** fact (`part_paid` / `paid`). One field, two semantics, so no invariant can be
  stated about either half.
- The two open defect populations in v1 are exactly one of each. 86 orders hold a stale
  denormalized invoice status (api-cloudrun#453) — the derived half drifting from the facts that
  determine it. Voided invoices still carry a balance the external ledger closed
  (api-cloudrun#436, recorded as **growing**) — the lifecycle half asserting a state the balance
  contradicts.
- ADR-0014 requires derived state to be a rebuildable projection and assigned state to be a
  recorded fact. A field that is both can be neither.

## Decision

`invoice.status` is retired. Two fields, **both derived**, from independent facts:

| Field | Derived from | Values |
|---|---|---|
| `lifecycle` | the invoice's posting history | `draft` — no AR posting exists · `issued` — an AR posting exists · `voided` — a reversal exists |
| `settlement` | the invoice's AR balance | `unpaid` · `part_paid` · `paid` |

Neither is assigned. Both are materialized into MongoDB as rebuildable projections per ADR-0014,
because TigerBeetle answers no queries and a list view needs them.

## Considered options

- **Split into one assigned lifecycle field and one derived settlement field.** The obvious
  reading of HOT-009, and what this ADR was expected to say. Rejected: in double-entry the
  lifecycle facts are already postings. An invoice that has not posted to AR is not an issued
  invoice, it is a draft document — so `issued` is a fact about the ledger, not an operator's
  assertion about it.
- **Two derived projections** (chosen).
- **Keep one field, define precedence.** Rejected: precedence rules are how the conflation
  survives. It would still be impossible to state an invariant about either half.

## Consequences

- **api-cloudrun#453's defect class becomes unrepresentable.** Nothing is stored as truth, so
  there is nothing to go stale — the projection is recomputed, and recompute-vs-TigerBeetle is an
  independent check because TigerBeetle is not the normalizer.
- **api-cloudrun#436's defect class becomes unrepresentable.** `voided` *means* "a reversal
  exists", and a reversal zeroes AR — so a voided invoice holding a live balance is not a state
  the model can express. This is stronger than detecting the population and repairing it.
- **The two fields can disagree without either being wrong**, and that is correct rather than a
  flaw: a voided invoice that was paid before voiding is `lifecycle: voided` and `settlement:
  paid`, which is the true history. The single enum could not say that at all, and had to pick.
- **Every reader of `status` is a migration site.** The rename is what makes each one a compile
  error rather than a silent behavioural change — the same discipline as the `_cents` rename.
  Retyping in place would type-check everywhere and be wrong.
- **This is the invoice-shaped instance of a general rule.** Orders have the same shape (ADR-0015
  makes fulfillment state partly derivable from pending vs posted transfers) and should be decided
  the same way rather than case by case.
- Unblocks ADR-0014, which was blocked on HOT-009. Resolves HOT-009.
