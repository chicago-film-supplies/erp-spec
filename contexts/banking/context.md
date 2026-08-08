# Banking (`BNK`)

## Responsibility

Money actually moving. Owns the bank feed, bank transactions, and reconciliation between bank
lines and ledger postings.

## Boundary

- Does **not** own the ledger — it produces postings and match outcomes for Ledger to record.
- Does **not** own invoice settlement semantics — Billing owns what "paid" means; Banking owns
  what "cleared" means. These are different dates and different facts.

## Upstream / downstream

- **Consumes:** Plaid bank feed (external, translated at the boundary per ADR-0009).
- **Produces:** bank transaction imported, bank transaction matched, reconciliation completed.

## Open

- SPIKE-004 — what Plaid actually provides vs what reconciliation needs. Transaction id stability
  is the risk to settle first.
- Manual statement import as a fallback if the feed drops.
