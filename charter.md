# Charter

**Status:** draft — `m0` is not complete until the non-goals list stops changing.

## Purpose

Rebuild the CFS inventory/order/invoice system as a full ERP with its own double-entry
accounting layer, retiring Xero and asset.accountant. Bring labour scheduling in-house so that
crew cost can be allocated to COGS against the job that caused it.

## In scope

- Order → fulfillment → invoice → posting → report, end to end.
- A double-entry general ledger owned by CFS, with period close and lock.
- Fixed asset register with **dual GAAP and tax basis** and a reportable deferred difference.
- Labour scheduling, shift recording, and standard-cost absorption into COGS.
- Sales and Chicago Personal Property Lease Transaction Tax determination.
- Bank feed ingestion and reconciliation.
- 1099 / W-9 tracking for contractors.
- Year-end close, retained earnings roll, and CPA read access.

## Out of scope — non-goals

Each of these is a deliberate decision, not an oversight. Reversing one is an ADR.

- **Payroll processing.** An external employer of record stays. CFS schedules labour and records
  shifts; it does not calculate withholding, file payroll tax, or move payroll money.
- **A general-purpose accounting product.** This ledger serves CFS's chart of accounts and
  CFS's posting rules. It is not built to be configurable for another business.
- **Multi-currency.** USD only. No FX translation, no revaluation.
- **Multi-entity / consolidation.** One legal entity.
- **Migrating Xero's historical detail.** See `HOT-006` — roughly 90% of historical Xero lines
  sit behind the 2025-12-31 lock and are unrepairable. The decision is import-as-is vs restate,
  not repair.
- **Preserving CRMS.** CRMS is being retired at the cutover. Do not design around it.
- **Rewriting into another language.** `ADR-0004` keeps Deno/TypeScript, with a narrow Go
  sidecar escape hatch for the ledger service only.
- **Replacing the external EOR's time-and-attendance system of record for payroll purposes.**
  CFS shift records drive *costing*; the EOR's records drive *pay*. They will disagree at the
  margin and that is tolerated. Reconciling them is not a goal.

## Fences

- **No hard deletes, ever.** 55 order uids referenced by invoices do not exist in the current
  system (`inbox/2026-08-08-hard-deleted-order-uids.md`, unverified — `OQ-013`). Every domain
  object is soft-deleted or superseded.
- **Money is integer minor units** in every schema, wire format, and stored document.
- **Accounting date and posting timestamp are distinct fields** on every posting.
- **Foreign-system identifiers never enter domain models** (`ADR-0009`). Translation happens at
  the boundary; an unresolvable ID is a hard error, never a null. The current system's 28.7%
  untracked revenue is what the opposite policy costs.

## Success criteria for `spec-v1`

See `roadmap/milestones.yaml`. Summarised: every milestone's exit criteria met, zero open
questions without an owner and a decide-by date, and a clean `deno task validate`.

## Context recommendation

Clear. This document is a fence, not a working state — nothing downstream needs the
conversation that produced it.
