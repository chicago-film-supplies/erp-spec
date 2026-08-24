# Banking (`BNK`)

## Responsibility

Money actually moving. Owns the bank feed, bank transactions, and reconciliation between bank lines
and ledger postings.

## Boundary

- Does **not** own the ledger — it produces postings and match outcomes for Ledger to record.
- Does **not** own invoice settlement semantics — Billing owns what "paid" means; Banking owns what
  "cleared" means. These are different dates and different facts.

## Upstream / downstream

- **Consumes:** Plaid bank feed (external, translated at the boundary per ADR-0009).
- **Produces:** bank transaction imported, bank transaction matched, reconciliation completed.

## Open

- **OQ-063** (what a bank line does to the ledger) — may a PENDING row post, which of the feed's two
  dates is the accounting date, and does an unmatched transaction rest in `2500 - Suspense`.
  Accounting-shaped, so it owes the six-reference survey. Chart code 2500 and the
  `bank_transaction_matched` posting rule are both blocked on it.
- **The re-link match key** — ADR-0048/D5 reconstructs identity by matching after a re-link and does
  not settle on what. A match has a false-positive rate, and two same-day same-amount transactions
  are exactly what it can pair wrongly.
- **Exit criterion 4 of SPIKE-004 is unmet** — the statement tie-out needs the production Plaid
  link. Sandbox balances are seeded constants.
- Manual statement import as a fallback if the feed drops.

## ✅ Settled by SPIKE-004 (closed 2026-08-24) and ADR-0048

- **Transaction id stability was the risk to settle first, and it is refuted twice.** 0 of 108 ids
  survive a re-link (SPIKE-004/M1); a pending row's id does not survive posting (SPIKE-004/M4). ⇒
  **no CFS state is ever keyed on a Plaid identifier**, and correspondence after a re-link is
  reconstructed by matching.
- **The boundary holds a verbatim store of record**, because a `removed` entry carries nothing to
  reverse (SPIKE-004/M5). It is not a cache.
- **Cleared vs pending is a real discriminator on the feed**, but what it means to the ledger is
  OQ-063, not this context's to assume.
