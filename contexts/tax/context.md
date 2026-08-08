# Tax (`TAX`)

## Responsibility

Determining what tax applies. Owns tax rules, rates and their effective-date history, the
rental-vs-sales regime split, exemptions, and the 1099/W-9 contractor surface.

## Boundary

- Does **not** own the invoice line — Billing does. Tax determines an amount; Billing carries it.
- Does **not** own the posting — Ledger does.
- Does **not** own the tax *basis* of an asset — Fixed Assets does. Different meaning of "tax".

## Upstream / downstream

- **Consumes:** order/invoice line composition (ORD, BIL).
- **Produces:** tax determined.

## Open

- SPIKE-008 — Chicago Personal Property Lease Transaction Tax and Illinois home-rule sales tax
  across rental vs services.
- Verified 2026-08-08: rental lines take "Chicago Rental Tax" at 11% and sale lines take "Chicago
  Sales Tax" at 10.25%, **within the same invoice**, discriminated by item type. Rate history
  already matters — historical Chicago Rental rates exist as separate records.
