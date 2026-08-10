# Procurement (`PRO`)

## Responsibility

The **inbound document, in all its forms**, and the payables lifecycle those documents drive: labour
purchase orders, inventory purchase orders, and recurring bills. Owns the procure-to-pay cycle from
commitment through accrual to a dated vendor invoice, and the state transitions between them.

It exists because **the procure-to-pay cycle has three stages and each answers a different
forecasting question** (OQ-020):

| stage              | state                   | answers                    |
| ------------------ | ----------------------- | -------------------------- |
| **purchase order** | committed, not incurred | spend forecast             |
| **accrual**        | incurred, not invoiced  | amount known, date unknown |
| **vendor invoice** | dated, with terms       | cashflow forecast          |

**CFS's current system holds only the third.** That is what "AP is underutilized today" means
concretely: there is nowhere to record a commitment, and nowhere to record work done but not yet
billed. The first two stages are the whole reason this context was worth a ninth code.

## Boundary

- Does **not** own the general ledger — Ledger does. Procurement emits events; posting rules
  translate them.
- Does **not** own the asset register — Fixed Assets does. An inventory PO for a rental asset causes
  `asset_acquired`; procurement owns the document that authorised the purchase, not the asset.
- Does **not** own stock levels — Availability does. Receiving inbound stock is procurement's event
  and availability's consequence.
- Does **not** own **customer**-facing documents — Billing owns invoices and credit notes. The
  symmetry is deliberate and the two must not be merged: an invoice CFS sends and a bill CFS
  receives share a shape and share no lifecycle.
- Does **not** own payment execution or bank matching — Banking does. Procurement says what is owed
  and when; Banking says what left the account.
- Does **not** own **payroll**. The charter makes payroll processing a non-goal: an external
  **employer of record** stays, and CFS does not calculate withholding, file payroll tax, or move
  payroll money. **An EOR is not payroll — it is a vendor that invoices** (OQ-024), so an EOR bill
  is an ordinary vendor bill and enters here like any other.

## Upstream / downstream

- **Consumes:** labour scheduling (FUL) — scheduling a contact generates the labour PO that cost
  flows from (OQ-008); inventory replenishment (AVL); asset purchase decisions (FA).
- **Produces:** purchase order issued, obligation accrued, vendor bill received — all consumed by
  Ledger.

## The rule this context owes, and why it does not exist yet

`shift_recorded` credits **2000 Accounts Payable** today. But the EOR has not invoiced on the shift
date, so the accurate credit leg is an **accrued labour liability** that the EOR's invoice later
**reclassifies** into AP. That reclassification is a procurement posting rule and it is unwritten.
`asset_acquired` has the same shape — it credits AP directly and notes the accrual stage as
procurement's to specify.

⚠️ **This is why a wages liability has a real purpose in v2 even though CFS has never had one.**
Measured across four years of balance sheets there is no payroll liability of any kind, and all four
payroll accounts (2160, 2170, 2180, 2190) are Archived in the live chart — consistent with the EOR
arrangement. The account v2 needs is not a payroll liability; it is an **accrued expense** account,
which is a different thing and does not exist yet either.

## Open

- **erp-spec#14** — the three posting rules: what a PO posts (nothing), what an accrual posts, and
  what the reclassification posts. `EVT-PRO-002` and `EVT-PRO-003` sit in `unwritten` until then.
- The accrued-liability **account** is unchosen. The chart has no accrued-expense account; adding
  one is part of the same work.
- Whether a **recurring bill** is a distinct document type or a vendor invoice with a schedule.
- Nothing is blocked on any of this — eleven posting rules are specified without it. It becomes
  urgent when the accrual stage is specified, because that is procurement's first real posting rule.
