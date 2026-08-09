---
id: ADR-0010
title: Accounting date vs posting timestamp policy
status: proposed
date: 2026-08-08
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger]
relates_to: [HOT-005, OQ-009, SPIKE-003]
supersedes:
superseded_by:
---

> **In the context of** a ledger whose store assigns its own timestamps, **facing** reporting that
> is periodised by business date, **we decided** to carry accounting date and posting timestamp as
> distinct fields with distinct rules, **to achieve** periodisation that survives late and
> back-dated entries, **accepting** that the ledger's native ordering is not the reporting
> ordering.

## Context

- **Accounting date** — the date a transaction belongs to. Set by the business event. May be
  back-dated within an open period.
- **Posting timestamp** — when it was durably recorded. Monotonic, assigned by the ledger, never
  back-dated.
- TigerBeetle assigns a posting timestamp. It has no concept of accounting date.
- Every report is periodised by accounting date. Conflating the two silently misfiles anything
  entered late.

## Decision

Both fields exist on every posting, always. Neither is derived from the other.

Detail — which field TigerBeetle carries, and how history is loaded — is **blocked on SPIKE-003**,
which must establish the `imported` flag's timestamp and monotonicity semantics.

## Consequences

- A posting's period is determined solely by accounting date.
- Period close forbids new postings with an accounting date inside a closed period, regardless of
  posting timestamp.
- Loading history means writing postings whose accounting dates are years before their posting
  timestamps. SPIKE-003 must confirm TigerBeetle permits this without breaking monotonicity.
