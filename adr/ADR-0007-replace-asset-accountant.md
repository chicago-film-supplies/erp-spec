---
id: ADR-0007
title: Replace asset.accountant; dual GAAP/tax basis in scope
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [fixed-assets, tax, ledger]
relates_to: [SPIKE-005]
supersedes:
superseded_by:
---

> **In the context of** building our own ledger, **facing** a separate hosted tool holding the asset
> register, **we decided** to bring fixed assets in-house with both GAAP and tax basis, **to
> achieve** depreciation postings that originate in the same ledger as everything else and a
> reportable deferred difference, **accepting** a genuinely intricate tax-depreciation rules
> problem.

## Context

- Hundreds of individually low-value assets, straight-line.
- Two bases must be carried simultaneously — GAAP and tax — and the difference between them is
  itself a reportable number.
- Leaving assets in a hosted tool means depreciation arrives as a journal to be re-keyed, which is
  the pattern being eliminated.

## Decision

Replace asset.accountant. The fixed-asset register is in-house, carrying dual GAAP and tax basis per
asset.

## Consequences

- SPIKE-005 must cover the whole rules surface before any schema: mid-month and half-year
  conventions, GDS vs ADS class lives, §179 and bonus effects on basis, partial disposals,
  prospective useful-life revisions, and the deferred difference.
- Volume forces batch: a depreciation run posts for hundreds of assets at once and still needs a
  per-asset audit trail.
- Getting tax depreciation wrong has filing consequences, not just reporting ones. This is the
  highest-stakes correctness surface in the rebuild.
