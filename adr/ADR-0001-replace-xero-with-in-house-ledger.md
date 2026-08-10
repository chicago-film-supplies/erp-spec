---
id: ADR-0001
title: Replace Xero with an in-house ledger
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [ledger, billing, banking, tax]
relates_to: [HOT-005, HOT-006, OQ-012]
supersedes:
superseded_by:
---

> **In the context of** owning the order-to-invoice path but renting the ledger, **facing** a
> tracking-dimension defect that Xero silently absorbs and a costing model Xero cannot express, **we
> decided** to build the general ledger in-house, **to achieve** dimensional postings that cannot be
> null and a labour-absorption model we control, **accepting** that a large amount of unglamorous
> accounting surface area becomes ours to build and keep correct.

## Context

- CFS already owns orders, invoices, products and fulfillment. Xero owns only the ledger.
- The dimension on a Xero line is optional by construction: an unresolvable tracking option id is
  dropped and the push still succeeds. 28.7% of line revenue has no product line as a result.
- The costing design — standard cost, causal-job absorption, unabsorbed-labour as a KPI account — is
  not expressible in Xero.
- Xero is single-tenant, live, and rate-limited to ~1,000 calls/day. Every integration is competing
  with the money path.

## Decision

Build the general ledger in-house. Retire Xero.

## Consequences

All of the following become in-scope work, none of which exists today:

- **Bank feed** ingestion and normalization (ADR-0002).
- **Reconciliation UI** — matching bank lines to postings.
- **Sales and lease transaction tax** determination and reporting.
- **1099s and W-9s** for contractors.
- **Year-end close and lock**, including a retained earnings roll.
- **CPA access** — an external accountant must be able to read the books without a CFS login into
  operational data.
- Losing Xero's built-in audit trail means ours has to be at least as good, and provable.
