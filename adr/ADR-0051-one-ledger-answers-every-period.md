---
id: ADR-0051
headline: one ledger answers every period
title: The PostgreSQL ledger is the reporting authority for open and closed periods alike; a closed period is protected by the database and a closing hash
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [ledger, banking, billing]
relates_to: [
  ADR-0017,
  ADR-0006,
  ADR-0010,
  ADR-0049,
  ADR-0052,
  ADR-0026,
  ADR-0029,
  ADR-0031,
  HOT-005,
  OQ-009,
  OQ-051,
  OQ-056,
]
accounting_shaped: true
survey: []
asserts:
  - id: D1
    kind: decision
    claim: >-
      The PostgreSQL ledger is the reporting authority for every period, open or closed.
  - id: D2
    kind: decision
    claim: >-
      The database rejects a posting whose accounting date falls in a closed period, checked at
      commit, not only at validation.
  - id: D3
    kind: decision
    claim: >-
      Closing a period records a hash over that period's postings in the close record.
  - id: D4
    kind: decision
    claim: >-
      Parquet files are archive and audit copies of the change feed, never a reporting authority.
  - id: P1
    kind: premise
    claim: >-
      ADR-0017 split authority by period state because TigerBeetle cannot range-query by
      accounting date.
    source: ADR-0017
supersedes:
supersedes_on_acceptance: ADR-0017
superseded_by:
---

> **In the context of** a ledger that now lives in a queryable database (ADR-0049), **facing** a
> reporting split that existed only because the old ledger could not be queried by accounting date,
> **we decided** that the one ledger answers every period and that the database itself refuses
> postings into a closed period, **to achieve** one source for every figure with closed-period
> figures that cannot drift, **accepting** that "cannot drift" now rests on a constraint and a hash
> rather than on an immutable file.

## Context

- ADR-0017 named the MongoDB document store authoritative for open periods and a monthly sealed,
  hashed Parquet file for closed periods. Its own Context names the reason: TigerBeetle "cannot
  answer 'the July trial balance'", because filtering on `user_data` is equality-only (P1).
- Under ADR-0049 the postings live in PostgreSQL with the accounting date as an ordinary column, so
  "the July trial balance" is one `GROUP BY`.
- ADR-0017's `survey_exemption` states the survey "is owed by whatever supersedes it", and that a
  central premise was retracted in part: a product-line P&L is business intelligence and is never
  sealed (`reporting/allocation-bases.yaml`, owner 2026-08-16).
- `formal/period-close.qnt` already models the rule this ADR enforces: a posting re-checked at
  commit cannot land in a closed period, and its `validate_then_commit` companion shows that a
  validation-time check alone loses a race.

## Decision

- **One authority** (D1). Open and closed periods are both answered from the ledger tables.
- **A closed period refuses new postings, at commit** (D2). Back-dating stays legal into an open
  period, per ADR-0010.
- **The close record carries a hash over the period's postings** (D3), so a later change to a closed
  period is detectable even by someone who bypassed D2.
- **Parquet is archive, not authority** (D4). ADR-0052 owns its encoding.

## Consequences

- ⚠️ **The survey is owed before acceptance** (gate 19, CLAUDE.md rule 8a): how GAAP, Xero, SAP,
  NetSuite, Sage Intacct and Odoo protect a closed period — lock date, period status, or both — and
  how each reports into one. Xero's lock date is the migration delta to measure.
- **"Cannot drift" changes kind.** ADR-0017's closed period was an immutable file. Here it is a
  constraint plus a hash; the hash detects, it does not prevent. ADR-0049's mitigations (roles,
  replay audit, hash chain) are what make a bypass visible.
- **Every citation of ADR-0017's sealed artifact must move** once this is accepted — ADR-0026's tax
  book read side, ADR-0029, ADR-0031, ADR-0036, OQ-051 and OQ-056.
- **HOT-005 and OQ-009 lose their premise.** Both asked which store is reporting truth.
- **Reporting stays an API surface** (ADR-0052).
