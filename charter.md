# Charter

**Status:** draft — `m0` is not complete until the non-goals list stops changing.

## Purpose

Rebuild the CFS inventory/order/invoice system as a full ERP with its own double-entry accounting
layer, retiring Xero and asset.accountant. Bring labor scheduling in-house so that crew cost can be
allocated to COGS against the job that caused it.

## In scope

- Order → fulfillment → invoice → posting → report, end to end.
- A double-entry general ledger owned by CFS, with period close and lock.
- Fixed asset register with **dual GAAP and tax basis** and a reportable deferred difference.
- Labor scheduling, shift recording, and **normal-cost** absorption into COGS — wages actual per
  person, employer burden apportioned from the payroll run — borne by the order that caused the hire
  (`ADR-0019`, but-for causation).
- **Purchase orders**, in two roles: the document labor scheduling generates and costs flow from,
  and inventory acquisition — retail stock, and fixed assets bought for rental or internal ops.
- Sales and Chicago Personal Property Lease Transaction Tax determination.
- Bank feed ingestion and reconciliation.
- 1099 / W-9 tracking for contractors.
- **Production service agreements.** Producing a client's project on their budget, including
  carrying their union payroll. A service CFS sells (`4130 - PSA Income`), not an accounting
  convenience — `erp-spec#35`.
- **The operational board and the comment threads attached to domain objects.** A version of each
  survives (`OQ-049`); the board's current form is a rough draft, and where the chat seam sits is
  open (`OQ-051`).
- Year-end close, retained earnings roll, and CPA read access.

## Out of scope — non-goals

Each of these is a deliberate decision, not an oversight. Reversing one is an ADR.

- **Payroll processing for CFS's OWN crew.** An external employer of record (Wrapbook) stays. CFS
  schedules labor and records shifts; it does not calculate withholding, file payroll tax, or move
  its own payroll money. ⚠️ **This does not extend to PSA**, where moving a client's payroll through
  `2800 - PSA Liability Clearing` is the service being sold — see In scope.
- **A general-purpose accounting product.** This ledger serves CFS's chart of accounts and CFS's
  posting rules. It is not built to be configurable for another business.
- **Multi-currency.** USD only. No FX translation, no revaluation.
- **Multi-entity / consolidation.** One legal entity.
- **Migrating Xero's historical detail.** See `HOT-006` — roughly 90% of historical Xero lines sit
  behind the 2025-12-31 lock and are unrepairable. The decision is import-as-is vs restate, not
  repair.
- **Preserving CRMS.** CRMS is being retired at the cutover. Do not design around it.
- **Rewriting into another language.** `ADR-0004` keeps Deno/TypeScript, with a narrow Go sidecar
  escape hatch for the ledger service only.
- **Replacing the external EOR's time-and-attendance system of record for payroll purposes.** CFS
  shift records drive _costing_; the EOR's records drive _pay_. They will disagree at the margin and
  that is tolerated. Reconciling them is not a goal.

## Fences

- **No hard deletes, ever.** Every domain object is soft-deleted or superseded. ⚠️ **The evidence
  originally cited for this fence does not reproduce.** The claim was 55 order uids referenced by
  invoices with no order document; measured against prod on 2026-08-09 across all five order↔invoice
  reference paths, the count is **0**
  (`inbox/2026-08-09-hard-deleted-order-uids-do-not-reproduce.md`, `OQ-013`). The fence is retained
  on its own merits — an accounting system whose charter is to be the record must not lose records,
  and `ADR-0021` already depends on a deactivated product's references still resolving — but it is
  retained _deliberately_, not on the strength of that number.
- **Money is integer minor units** in every schema, wire format, and stored document.
- **Accounting date and posting timestamp are distinct fields** on every posting.
- **Foreign-system identifiers never enter domain models** (`ADR-0009`). Translation happens at the
  boundary; an unresolvable ID is a hard error, never a null. ⚠️ **The 28.7% untracked revenue
  originally cited for this fence was measuring something else** — re-measured against the product
  master on 2026-08-10, 227 of those lines were a CFS-side derivation that never ran and only
  $688.00 (0.041% of line revenue) was an undecided dimension (api-cloudrun#473). Like the
  no-hard-deletes fence above, this one is **retained on its own merits**: Xero's drop-an-
  unresolvable-id-and-return-success behaviour is real independently of what it cost CFS, and a null
  meaning "could not translate" is indistinguishable from one meaning "no value applies" at any
  population size.

## Success criteria for `spec-v1`

See `roadmap/milestones.yaml`. Summarised: every milestone's exit criteria met, zero open questions
without an owner and a decide-by date, and a clean `deno task validate`.

## Context recommendation

Clear. This document is a fence, not a working state — nothing downstream needs the conversation
that produced it.
