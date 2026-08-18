---
id: ADR-0007
headline: own the asset register, both bases
title: Replace asset.accountant; dual GAAP/tax basis in scope
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [fixed-assets, tax, ledger]
relates_to: [SPIKE-005]
accounting_shaped: true
survey_exemption: >-
  Accepted 2026-08-08, before rule 8a existed as a standing instruction (owner, 2026-08-09). The
  half that is accounting-shaped is "dual GAAP/tax basis in scope", and **ADR-0026 re-decided
  exactly that question and is itself unsurveyed** — so the survey that matters attaches there, and
  running one here would research a scope statement rather than a decision. The engine that produces
  the amounts is still SPIKE-005, unchosen.
supersedes:
superseded_by:
frozen_sha256: 4830f6f6c9fa468edd5e6da0d026f8dd378d367e722262c885136725e35d434c
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
