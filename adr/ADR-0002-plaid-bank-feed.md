---
id: ADR-0002
title: Bank feed sourced from Plaid, single Chase account
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [banking, ledger]
relates_to: [SPIKE-004]
supersedes:
superseded_by:
frozen_sha256: aeaac105708d1a74417802b908d1fa15c72da219744e1afe59e1407e6c381208
---

> **In the context of** needing bank transactions now that Xero's feed goes away, **facing** one
> bank and one account, **we decided** to source the feed from Plaid, **to achieve** a working feed
> without a bank-specific integration, **accepting** that Plaid's transaction model is a
> consumer-fintech model, not an accounting bank feed.

## Context

- Exactly one Chase operating account. No multi-bank requirement.
- Direct bank file formats (BAI2, OFX) are available but need per-bank handling and often a
  commercial banking agreement.

## Decision

Use Plaid as the bank feed source for the single Chase account.

## Consequences

- SPIKE-004 must establish what Plaid actually gives us before any reconciliation design: pending vs
  posted semantics, the balance endpoints, the backfill window, and — critically — whether
  transaction ids are stable across updates.
- A Plaid transaction is not a journal entry. The translation is ours, and per ADR-0009 it happens
  at the boundary.
- Single point of failure: if Plaid drops the institution, the feed stops. Manual statement import
  needs to exist as a fallback path, even if unbuilt at v1.
