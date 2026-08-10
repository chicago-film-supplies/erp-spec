# Billing (`BIL`)

## Responsibility

Turning fulfilled work into money owed. Owns invoices, credit notes, line items, discounts, pricing
application, and the invoice lifecycle including void.

## Boundary

- Does **not** own the ledger posting — it emits an event; Ledger's posting rules decide the
  accounts.
- Does **not** determine tax — Tax does. Billing carries the determined amounts on the line.
- Does **not** own payment settlement mechanics beyond recording that settlement occurred.

## Upstream / downstream

- **Consumes:** order confirmed (ORD), legs completed (FUL), tax determined (TAX).
- **Produces:** invoice issued, invoice voided, credit note issued.

## Open

- HOT-008 / OQ-014 — duplicate active charge products make the account ambiguous.
- OQ-015 — the out-of-state engagement exclusion flag.
- Void semantics: verified that 41 of 999 invoices are void and nothing filters them by default.
