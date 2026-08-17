# Ledger (`LED`)

## Responsibility

The double-entry general ledger. Owns accounts, journal entries, postings, dimensions, posting
rules, period close and lock, and the trial balance. Every number that appears in a financial
statement originates here or is derived from here.

## Boundary

- Does **not** own invoices or their line items — Billing does. The ledger receives a posting
  derived from an invoice; it does not know what a discount is.
- Does **not** own the asset register — Fixed Assets does. It receives depreciation postings.
- Does **not** own bank transactions — Banking does. It receives postings and reconciliation
  outcomes.
- Does **not** own tax determination — Tax does. It receives the determined amounts.

The ledger is deliberately ignorant of business semantics. A posting rule translates a business
event into debits and credits at the boundary; past that boundary there are only accounts and
amounts.

## Upstream / downstream

- **Consumes:** invoice issued/voided (BIL), shift recorded (FUL), depreciation run (FA), bank
  transaction matched (BNK), tax determined (TAX).
- **Produces:** journal entry posted, period closed.

## Open

- HOT-005 / OQ-009 — whether TigerBeetle or DuckDB is the reporting source of truth.
- ADR-0008 — dimension-exploded accounts, blocked on the above.
- OQ-008 — who sets standard labor rates.
