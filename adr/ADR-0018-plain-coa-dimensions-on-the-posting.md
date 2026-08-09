---
id: ADR-0018
title: A plain chart of accounts, with dimensions carried on the posting
status: proposed
date: 2026-08-09
review_by: 2026-09-01
deciders: [repo owner]
contexts: [ledger]
relates_to: [HOT-005, OQ-009, ADR-0017, ADR-0003]
supersedes: ADR-0008
superseded_by:
---

> **In the context of** needing balances sliced by product line and cost type, **facing** a ledger
> with no dimension fields, **we decided** to keep the chart of accounts plain and carry dimensions
> on the posting, **to achieve** an account tree an auditor can read and a dimension set that grows
> by addition, **accepting** that a dimensional balance is answered by the read side rather than by
> a single account read.

## Context

- ADR-0008 exploded dimensions into account identity — one account per GL code × product line ×
  cost type — so that dimensional balances could be read directly rather than aggregated.
- ADR-0017 removed the premise: reporting authority is the read side, so a dimensional balance is
  answered there anyway. Real-time dimensional balances were solving a problem nobody has.
- Account **count** was never the real objection. TigerBeetle handles millions of accounts and CFS
  has ~15k transfers of history.

## Decision

The chart of accounts stays plain — one account per GL code. **Dimensions are carried on the
posting**, in `user_data` and in the Mongo/Parquet projection, never in account identity.

## Considered options

- **Dimension-exploded accounts** (ADR-0008). Rejected for the reasons below, none of them
  performance.
- **Period-scoped accounts** — one account per GL code × dimensions × period, making a period trial
  balance a direct set of balance reads. Genuinely viable at this volume (~7,600 accounts over ten
  years). Rejected because Parquet exists regardless under ADR-0017, so this adds a second
  mechanism without removing the first, and leaves two things to keep in agreement.
- **Plain COA, dimensions on the posting** (chosen).

## Consequences

- **Cardinality grows by addition, not multiplication.** The exploded tree was 21 product lines × 3
  cost types = 63 per dimensioned GL code, and a third dimension would have multiplied again. That
  future dimension, not today's count, was the real risk.
- **Adding a product line stops being a migration.** Under ADR-0008 it meant minting N accounts as
  a deploy step, forever, that could be forgotten — and a missing account means a posting fails or
  lands in the wrong place.
- **The COA stays legible to an auditor.** The charter gives the CPA read access; ~60 accounts plus
  a dimension column hands over cleanly, several hundred synthetic keys like `4100-Crew-Direct` does
  not.
- **It matches the evidence.** COA 4100 is a catch-all spanning Crew, Delivery, Transport and Trash
  & Cleanup, so the account already does not determine the product line. Exploding it would have
  invented a mapping rather than refined the existing chart.
- REQ-LED-001's rule is unchanged and is now the only thing enforcing dimensionality: both mandatory
  dimensions are **not nullable** on revenue and COGS postings, and a posting missing either is
  rejected rather than recorded. With dimensions off account identity, nothing structural catches a
  missing one — the non-null rule has to.
