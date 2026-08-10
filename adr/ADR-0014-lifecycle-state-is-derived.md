---
id: ADR-0014
title: Lifecycle state is derived from the ledger, never assigned
status: accepted
date: 2026-08-09
deciders: [repo owner]
contexts: [ordering, billing, ledger, fulfillment]
relates_to: [ADR-0003, ADR-0015, HOT-005, HOT-009]
supersedes:
superseded_by:
---

> **In the context of** deciding where order and invoice status live, **facing** a v1 corpus where
> stored status drifts from the facts that determine it, **we decided** that lifecycle state is
> derived from the ledger and materialized into MongoDB as a rebuildable projection, **to achieve**
> a stale status that is unrepresentable rather than merely monitored, **accepting** that a
> transition with no ledger consequence still needs a recorded fact.

## Context

- Two live defect populations are the same defect: 86 orders hold a stale denormalized invoice
  status (api-cloudrun#453), and voided invoices still carry a balance the external ledger closed
  (api-cloudrun#436, a population that is **growing**, not historical).
- Both are what a stored copy of a derived value costs. Neither is a logic bug — the derivation is
  correct, the copy is stale.
- In double-entry, most of what an invoice's status _means_ is already a fact about postings. `paid`
  is an AR balance of zero. `issued` is "has posted to AR". `voided` is "a reversal exists". An
  invoice that has not posted is not an issued invoice; it is a draft document.

## Decision

**Lifecycle state is derived.** Where a transition has a ledger or inventory consequence, the status
is computed from that consequence and **materialized into MongoDB as a rebuildable projection**.
Nothing assigns it.

**The boundary rule: a lifecycle field is derivable exactly when its transition has a ledger or
inventory consequence.** Transitions with no such consequence — a cancellation before anything
posted, a soft-delete, a human annotation like on-hold or flagged — have no fact to derive from and
are recorded directly. Strive to make the assigned set as small as possible; do not pretend it is
empty.

**Never mint a posting solely to make a status derivable.** A zero-amount transfer whose only
purpose is to mark a state change corrupts the ledger's meaning: it stops recording that money or
stock moved and starts recording that things happened. An assigned field is the correct answer where
no real consequence exists.

## Consequences

- **Materialization is mandatory, not an optimization.** TigerBeetle answers no queries, so "every
  invoice that is part-paid" cannot be asked of it. Deriving on read is not available at list scale;
  the projection in MongoDB is how the state becomes queryable.
- **The rebuild must stay cheap enough to run as an audit.** A full recompute is both the recovery
  path and the check, so its cost bounds how often correctness can be confirmed.
- **The audit is independent, which is the point.** "Recompute from TigerBeetle and compare" is not
  a fixed-point check — TigerBeetle is not the normalizer, so the comparison can fail. This
  satisfies the repo rule that a guard which can only consult its own oracle is not a guard.
- **Invoice status must be decomposed before this can be applied to it.** Today one enum carries an
  assigned lifecycle meaning and a derived balance meaning at once, which is why #436 and #453 are
  both possible and why no invariant can be stated about either. HOT-009.
- **Point-in-time status is a different question from current status**, and this decision does not
  answer it. "Was this invoice paid as of the period end" is periodised by accounting date, while
  TigerBeetle timestamps are posting time — so the historical derivation runs against the
  accounting-date read side, not against TigerBeetle. Blocked on the same split as HOT-005 / OQ-009.
- Order status becomes derivable only to the extent that fulfillment has a ledger or inventory
  consequence. ADR-0015.
