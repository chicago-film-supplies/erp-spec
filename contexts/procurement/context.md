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

## The rule this context owed, and what it corrected — settled 2026-08-16 (erp-spec#14)

`shift_recorded` and `asset_acquired` both credited **2000 Accounts Payable**. Both were wrong on
the date they posted: the EOR has not invoiced when the shift is worked, and the vendor has not
invoiced when the asset is received, so neither was trade debt. Both now credit **2010 Accrued
Expenses: Received Not Invoiced**, and `vendor_bill_received` reclassifies it into AP when the
invoice arrives.

⚠️ **This is why an accrued liability has a real purpose in v2 even though CFS has never had one.**
Measured across four years of balance sheets there is no payroll liability of any kind, and all four
payroll accounts (2160, 2170, 2180, 2190) are Archived in the live chart — consistent with the EOR
arrangement. The account v2 needed is **not** a payroll liability; it is an accrued expense, which
is a different thing. Re-measured 2026-08-16: the live chart holds **134 accounts and no
accrued-expense account of any kind** (`api:2026-08-16:db_chart_of_accounts_query`).

**The survey is what decided the shape**
(`inbox/2026-08-16-survey-the-accrued-liability-is-a-matched-clearing-account-and-the-bill-reclassifies-rather-than-reverses.md`).
All six references split accrued liabilities on **matched versus estimated**, not on goods versus
services. A matched amount goes to a clearing account relieved by the bill — SAP GR/IR, NetSuite
`Accrued Purchases`, Odoo `Stock Interim (Received)`, Intacct's advanced-workflow accrual — and an
estimated one goes to an accrued-expenses account relieved by a dated auto-reversal, which is Xero's
model and the textbook one. **Every accrual v2 produces carries an amount from a source document**,
so all of them are the first kind: one account, and the bill **reclassifies** rather than reverses.

⚠️ **Three rules credit 2010, not one, and procurement does not own all three.** `shift_recorded`
accrues labour, `asset_acquired` accrues fixed assets, and `obligation_accrued` accrues what
procurement itself receives. Procurement owns the accrual STAGE; the boundaries above still hold.

## Open

- **The over-accrual — `OQ-045`.** A bill for LESS than was accrued leaves a residual in 2010 that
  nothing retires; correcting or writing back an over-accrual is a fourth procurement event that
  does not exist. Deliberately not invented. A bill for MORE is already decided — the excess is an
  ordinary direct line — and a partial bill is the normal case, not an error.
- Whether a **recurring bill** is a distinct document type or a vendor invoice with a schedule.
- **Three-way matching** (PO → receipt → bill) stays out of scope, per `events.yaml`'s own header.
- Payment execution and bank matching remain Banking's, not this context's.
