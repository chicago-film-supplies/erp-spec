---
id: ADR-0026
title: The general ledger is the GAAP book; the tax basis is a non-posting book derived at report time
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [fixed-assets, ledger, tax]
relates_to: [ADR-0007, ADR-0017, ADR-0018, SPIKE-005, OQ-027]
supersedes:
superseded_by:
---

> **In the context of** a fixed-asset register that must produce a full P&L *and balance sheet* on
> both a GAAP and a tax basis across years, **facing** a fleet where a §179 election expenses an
> asset in year 1 that GAAP carries for 5, 10 or 20, **we decided** that only the GAAP book posts to
> the general ledger and the tax book is derived at report time from the register's per-book
> schedules, **to achieve** two complete sets of statements without a second write path, **accepting**
> that the tax book has no double-entry enforcement of its own and is only as good as its
> derivation.

## Context

- The requirement is **two complete bases**, not a difference: "we have maintain P&L and Balance
  Sheets for tax and gaap across years" (owner, 2026-08-09;
  `inbox/2026-08-09-tax-and-gaap-statements-are-both-required.md`). ADR-0007 asked only for a
  reportable deferred difference, which is weaker, and the spec had been written against the weaker
  reading.
- The divergence is not marginal. Most of the fleet is §179'd to a tax NBV of 0 in year 1 while
  GAAP carries most of cost for years, so the two balance sheets differ materially and permanently.
- **The mature fixed-asset systems all default the tax book to non-posting.** SAP's posting
  indicator (0) — "area does not post any values to FI" — is a first-class setting; NetSuite states
  that "alternate methods are not linked to NetSuite journal postings"; Sage Fixed Assets updates
  the GL from **one** default posting book and warns that changing it double-posts. ERPNext posts
  per finance book, and Odoo has no native support at all — its documented answer is a duplicated
  asset record.
- Form 1065 models it the same way: **one** balance sheet (Schedule L) plus **M-1/M-2** reconciling
  book to tax. The reconciliation is the deliverable.
- **A partial second book inside one ledger is not available.** The two books differ in accumulated
  depreciation, but a disposal relieves cost against a *different* accumulated depreciation and a
  *different* gain per book, so the `Cr` to the asset account cannot be shared. Duplicating the asset
  account drags in the funding account, and that drags in AP. It is all postings or none.
- A true parallel ledger costs more here than the survey suggests. `ledger/tigerbeetle-accounts.yaml`
  fixes **TB account id = the GL code widened to u128**, and TigerBeetle account ids are globally
  unique rather than per-ledger — so a second ledger changes that rule. Every posting rule would fan
  over books, including the three already `specified` with 13 vectors. And a `book` tag carried on
  the transfer instead would be a **fifth** claimant on the three `user_data` fields erp-spec#3
  already has four claimants for.

## Decision

**TigerBeetle holds one book: GAAP.** No tax-basis value is ever posted to it.

The **tax book is produced by the read side** (ADR-0017: MongoDB for open periods, the sealed
Parquet artifact for closed ones) as a set of balanced, per-asset, per-period **tax-book entries**
derived from the fixed-asset register's tax schedule. They use the same chart of accounts — 7001
Section 179 Depreciation Expense, the `Less-Accumulated Depreciation` accounts, 1998 Gain/Loss On
Asset Disposal — and they are entries in the projection, never transfers in the ledger.

A statement is then a query over a book scope:

| Basis | Reads |
|---|---|
| GAAP | GL postings |
| Tax | GL postings **less** their GAAP fixed-asset entries, **plus** the register's tax-book entries |

The register is the authority for both schedules; it already carries a basis per book per asset
(`contexts/fixed-assets/entities/asset.yaml` — "a single-basis asset is a bug").

Consequently every posting rule in `ledger/posting-rules.yaml` states **one** set of postings, and
they are the GAAP set.

## Consequences

- **The tax book has no double-entry enforcement.** TigerBeetle guarantees the GAAP book and
  nothing else, so the tax book's integrity rests on its derivation being deterministic and on the
  per-asset audit trail ADR-0007 already requires. This is the real cost of the decision and it is
  the reason the derivation belongs in one place with vectors over it, not in a report template.
- **A closed period seals both books.** The Parquet artifact for a closed period carries the
  tax-book entries alongside the GAAP postings and is hashed as one artifact (ADR-0017), so a
  tax-basis balance sheet for a closed period cannot drift either.
- **`depreciation_run` still produces two sets of numbers per asset per period** — but only one of
  them is a GL posting. The `known` entry in `ledger/posting-rules.yaml` said "Two postings per
  asset per period, not one", which is now corrected to name which one posts. It stays blocked on
  SPIKE-005 for the engine, unaffected by this decision.
- **`asset_disposed` and `asset_basis_adjusted` become writable**, which is what unblocked them in
  erp-spec#5. A disposal posts the GAAP relief and gain/loss; the register carries `nbv_tax_minor`
  and the §1245 result for the tax book. A tax-only basis adjustment — a §179 election — posts
  **nothing** to the GL, which is why that rule's capitalisation list can legitimately be empty.
- **7001 Section 179 Depreciation Expense is a tax-book-only account.** It stays in the chart, and
  it will never carry a TigerBeetle transfer. Its `note` in `ledger/chart-of-accounts.yaml` already
  says a §179 election "is exactly a tax-basis-only expense".
- **Depreciation is not the only book difference, and the rest are not settled.** If CFS files on a
  cash basis, the tax balance sheet drops AR and AP entirely and the overlay is far larger than the
  register — **OQ-027**. Meals disallowance and accrual timing are P&L-only differences of the same
  family. This decision fixes *where* the tax book lives, not *what* is in it.
- **Reversible in one direction only, cheaply.** Adding a posting parallel ledger later means
  writing history into it; going the other way means deleting a ledger. Starting non-posting is the
  reversible end.
