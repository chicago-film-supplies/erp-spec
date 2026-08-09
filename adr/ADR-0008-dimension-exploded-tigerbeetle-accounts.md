---
id: ADR-0008
title: Dimension-exploded TigerBeetle accounts
status: superseded
date: 2026-08-08
review_by: 2026-10-15
deciders: [repo owner]
contexts: [ledger]
relates_to: [HOT-005, OQ-009]
supersedes:
superseded_by: ADR-0018
---

> **In the context of** needing real-time balances sliced by dimension, **facing** TigerBeetle's
> fixed account model with no native dimension support, **we decided** to explode dimensions into
> the account identity — one account per (GL code × product line × cost type) — **to achieve**
> dimensional balances that are read directly rather than aggregated, **accepting** a
> multiplicative account count and a migration cost whenever a dimension value is added.

## Context

- Two dimensions are mandatory on every revenue and COGS posting: product line and cost type.
- TigerBeetle accounts have no dimension fields. Balances are per account.
- Deriving dimensional balances by scanning transfers defeats the point of using TigerBeetle.

## Decision

One TigerBeetle account per (GL code × product line × cost type).

Transfer `user_data` fields are reserved for **high-cardinality** references — journal entry id,
source document, posting rule — which must not become part of account identity.

## Consequences

- Account count is the product of the dimension cardinalities. With 21 product lines and 3 cost
  types observed today, the revenue and COGS sections alone reach the hundreds. Verify this stays
  tractable before accepting.
- Adding a product line means minting accounts, not altering rows. That is cheap, but it is a
  migration step that must exist.
- **Blocked on HOT-005 / OQ-009.** If DuckDB is the reporting source of truth, real-time
  dimensional balances in TigerBeetle may be solving a problem nobody has — and the simpler
  account tree would win. Do not accept this ADR before that split is settled.
