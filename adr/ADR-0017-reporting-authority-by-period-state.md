---
id: ADR-0017
title: Reporting authority is split by period state
status: proposed
date: 2026-08-09
review_by: 2026-09-01
deciders: [repo owner]
contexts: [ledger, banking, billing]
relates_to: [HOT-005, OQ-009, ADR-0003, ADR-0010, ADR-0014, ADR-0018]
supersedes: ADR-0006
superseded_by:
---

> **In the context of** a ledger whose timestamps are posting time and reporting that is periodised
> by accounting date, **facing** a requirement that reported figures must not drift, **we decided**
> to split reporting authority by period state, **to achieve** closed-period figures that cannot
> drift at all, **accepting** that open-period figures come from the document store rather than the
> ledger.

## Context

- TigerBeetle cannot answer "the July trial balance" from a balance read: its timestamp is posting
  time, and filtering on `user_data` is equality-only, so there is no range query on accounting
  date. Some projection is therefore unavoidable — the question is only whose authority is named.
- Performance does not discriminate here. Measured 2026-08-09: 999 invoices and 9,197 line items in
  prod, so even at 15 transfers per invoice the entire history is on the order of 15k transfers.
  Every candidate design is faster than required by orders of magnitude.
- ADR-0006 made "DuckDB over Parquet" the read side generally. Its real content — the sealed,
  hashed period artifact — is narrower than that and is what carries the weight.

## Decision

| Period state | Reporting authority |
|---|---|
| **Open** | MongoDB, read live |
| **Closed** | The period's Parquet file, sealed **monthly** and hashed into the close record |

TigerBeetle remains the authority for **balance integrity** and for current balances. DuckDB reads
sealed periods and ad-hoc analysis; the `.duckdb` file stays a rebuildable cache.

Granularity follows the close cadence. Monthly is recorded here and confirmed when close is
specified in `m3`.

## Consequences

- **A closed period cannot drift**, because its artifact is immutable and hashed — a stronger
  guarantee than recompute-and-compare. An open period is not expected to be stable, so drift is
  not a meaningful notion there. The boundary is the close event, which is unambiguous.
- **Parquet is exported from MongoDB**, not from TigerBeetle: the two-store commit already writes
  the posting to Mongo, which holds the accounting date and is queryable. TigerBeetle has no bulk
  export.
- **This makes MongoDB load-bearing for the accounting record.** Lose it and balances rebuild from
  TigerBeetle but periods do not — unless TigerBeetle carries the accounting date. So this decision
  *strengthens* the case for accounting-date-in-`user_data` (erp-spec#3), rather than making it moot.
- **Parquet is never written on the request path.** It is a batch artifact produced at close;
  per-posting appends would make the commit a three-store commit and Parquet is not a transactional
  format.
- Supersedes ADR-0006, which stated the same artifact rule but framed DuckDB as the read side in
  general. The artifact rule survives verbatim; the general framing does not.
- The account-tree consequence is a separate decision — ADR-0018.
