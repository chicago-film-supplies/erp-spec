---
kind: research
title: Survey — the accrued-expense account CFS needs is a MATCHED clearing account, not a period-end estimate, and the criterion all six references draw is matched-versus-estimated rather than goods-versus-services; the vendor bill therefore RECLASSIFIES and never reverses, and the two methods fail in opposite directions
contexts: [procurement, ledger]
source: 17 CFR 210.5-02(19)(20) via Cornell LII · PwC Viewpoint FSP 11.3/11.4 · Oracle NetSuite "Accounting for Received Purchase Orders" (Accrued Purchases) · SAP S/4HANA GR/IR + F.19 reclassification (SAP Press, SAP Help) · Sage Intacct Purchasing item GL accounts + transaction definitions (developer.intacct.com UPDATES_GL) · Odoo Anglo-Saxon Stock Interim (Received) · Xero "Accrued expenses" guide + ApprovalMax line-item accrual reports; plus `api:2026-08-16:db_chart_of_accounts_query` (134 accounts, 0 accrued-expense) and `api:2026-08-16:db_transactions_query` (74 purchase movements, 15 costed, $18,117.52)
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Rule 8a survey for **erp-spec#14**: `EVT-PRO-002 ObligationAccrued` needs a credit-side account that
does not exist, and `EVT-PRO-003 VendorBillReceived` needs a decision about what the bill _does_ to
it. Both are accounting-shaped, so both are surveyed before either is written.

## The question, stated so it can be answered wrongly

Not "which account?" — that is the easy half and every reference agrees a liability separate from
AP. The two that decide the posting rules are:

1. **Is there ONE accrued-liability account or two?** (goods vs services; matched vs estimated)
2. **Does the vendor bill RECLASSIFY the accrual, or REVERSE it and re-book the cost?** Both leave a
   balanced ledger. Only one of them is right, and the wrong one double-counts the expense.

## The criterion: matched versus estimated — NOT goods versus services

This is what the survey is for, and it cuts across the axis the issue implies. Every reference below
distinguishes two populations, and the line is **whether the amount is matched to a document or
estimated**:

| population                                                    | shape                           | cleared by                        | fails when                                    |
| ------------------------------------------------------------- | ------------------------------- | --------------------------------- | --------------------------------------------- |
| **received, not invoiced** — amount known, matched per source | a **clearing** account          | the matching bill, by **reclass** | the match is missed → cost booked twice       |
| **period-end estimate** — amount guessed, no document yet     | an **accrued expenses** account | a dated **auto-reversal**         | the reversal is forgotten → cost booked twice |

Both fail the same way and by opposite mechanisms, which is exactly erp-spec#14's warning: the
double-count still balances, so no balance check catches it.

## GAAP — the presentation rule requires the split, and says nothing about the mechanism

- **Reg S-X 5-02.19** names _trade creditors_ as a payable category to be stated separately;
  **5-02.20** puts everything else in other current liabilities and requires separate statement of
  **any item over 5% of total current liabilities**, naming accrued payrolls, accrued interest and
  taxes as the examples.
- PwC FSP 11.3 is explicit that accounts payable represents amounts owed to suppliers "that a
  reporting entity consumes through operations", and FSP 11.4 treats accruals separately.

⇒ **An amount owed for something received but not yet invoiced is not a trade payable**, because
there is no invoice and no agreed terms. It is an accrued liability. GAAP requires the presentation
split and is silent on how the account is cleared — so the mechanism has to come from the systems.

## SAP S/4HANA — the mechanism, and the one that names the distinction best

- Goods receipt **credits** GR/IR; invoice receipt **debits** it. The account nets to zero on a
  matched pair: "the GR/IR account balance is zero, signifying that all goods have been received and
  correctly invoiced."
- The sign of a residual is meaningful and reported: **credit balance = received not invoiced**,
  **debit balance = invoiced not received**.
- At period end, **F.19 / "Reclassify GR/IR"** does not delete the residual — it **reclassifies** it
  to adjustment accounts so the balance sheet shows the two populations separately. Configuration
  literally lives under _Periodic Processing → Reclassify → Define Adjustment Accounts for GR/IR
  Clearing_.
- SAP keeps the **estimated** population somewhere else entirely (the accrual engine). That is the
  clearest statement anywhere in the survey that these are two accounts, not one.

## NetSuite — the same shape, stated as GL impact

- Item receipt: **Dr Inventory / Cr Accrued Purchases**. The account is typed a **liability** and
  its documented purpose is to "offset your A/P register … for inventory that has been received but
  not paid for."
- Vendor bill: **Dr Accrued Purchases / Cr Accounts Payable.**
- The docs describe this as reclassification, not reversal. A partial bill clears part of the
  balance; the residual is the ordinary state, and NetSuite ships a reconciliation practice for it
  (an entire cottage industry of third-party "Accrued Purchases reconciliation" tooling exists,
  which is itself a measurement of how normal residuals are).

## Sage Intacct — same tier, and the weakest evidence in this survey

- The **standard** purchasing workflow defines only an expense account and an AP offset per item —
  **Dr expense / Cr AP, with no accrual stage.** (`Define GL accounts for items — Purchasing`.)
- **Advanced** workflows route through item GL groups, and a transaction definition's posting is a
  single `UPDATES_GL` choice of `A` (Accounts Payable) / `G` (General Ledger) / `N` (don't post).
  The received-not-invoiced accrual is achieved by pointing a receipt definition's offset at an
  accrual account — i.e. it is **configured, not built in**.

⚠️ **Recorded as thinner than the other four.** Intacct's public docs do not name a shipped
received-not-invoiced account the way NetSuite's do. Do not cite Intacct as agreeing on the account;
cite it as agreeing on the criterion via its workflow split.

## Odoo — the informative one, and it disagrees on classification

- Anglo-Saxon mode: receipt is **Dr Stock Valuation / Cr Stock Interim (Received)**; bill validation
  is **Dr Stock Interim (Received) / Cr Accounts Payable**. Identical mechanism, identical
  reclassification.
- ⚠️ **Odoo's interim account is typed a current ASSET in the default chart while carrying a credit
  balance for exactly the window that matters.** That is the presentation error Reg S-X 5-02 exists
  to prevent — a liability sitting inside assets — and it is the reason to state the class
  explicitly rather than copy a default. (CFS already has one account where the normal balance is
  routinely violated, `1998 Gain/Loss On Asset Disposal`, and its chart entry says so. This is not a
  second one: 2010 is a liability with a credit normal balance and no exception.)
- **Odoo has no equivalent for SERVICES.** Its answer for a service received and not billed is a
  manual accrual entry — and Odoo 19 moved receipt-time journal entries out of warehouse operations
  entirely, offering "Generate Entry" from the Inventory Valuation Report instead. Odoo's _absence_
  is the finding: the matched-clearing shape is built for goods everywhere, and services get the
  estimate-and-reverse shape by default. **CFS's largest accrual is labour**, so this is the
  reference that says the obvious default is the wrong one here.

## Xero — the incumbent, and the delta is a capability gap rather than a number

- Xero has **no accrual stage at all.** A purchase order is non-posting; the bill is the first
  entry. There is no receipt document and therefore no GRNI account.
- Xero's own guidance is the textbook estimate: at period end Dr expense / Cr accrued liabilities
  for an **estimated** amount, and reverse it at the start of the next period so the actual bill can
  be processed normally through AP. Manual journals carry an optional auto-reversal date.
- Practitioner evidence, which counts: **ApprovalMax sells a "line item accrual report" for Xero**
  that builds accrual journals from unbilled POs and posts them back — a third party charging money
  to supply the stage the product does not have.

**CFS's own books, measured today** (`api:2026-08-16:db_chart_of_accounts_query`, 134 accounts —
unchanged from the 2026-08-09 count):

- **Zero accrued-expense accounts.** Current liabilities are 2000 AP, the 2100 card block, 2200/2210
  tax, 2300 Unpaid Expense Claims, 2400 LOC, 2500 Suspense, 2510 Inventory Adjustment Clearing, 2550
  Historical Adjustment, 2600 Rounding, 2650 Tracking Transfers, 2700 and 2800–2803 PSA.
- All four payroll liabilities (2160/2170/2180/2190) are **Archived**, consistent with the EOR
  arrangement (OQ-024). **They are not the account being minted here** — an accrued expense is a
  different thing, and CFS has no payroll liability and will not have one.
- `1350 Vendor Deposits` exists and is **Archived** — the mirror image (paid, not received). Worth
  knowing it is there before anyone mints a second one.

### The migration delta, and the honest bound on it

The delta ADR-0001 has to carry across history is **when the expense lands**: today on the vendor's
bill date, under this rule on the shift or acquisition date. Its size is the cost that crosses a
period boundary between those two dates.

⚠️ **That number is not measurable from this repo's permitted sources, and saying so is the finding
rather than a gap in the work.** Vendor bills are Xero ACCPAY documents; CFS deliberately tracks
none of them, none are mirrored into Firestore, and this repo does not call the Xero API. What would
measure it: a Xero ACCPAY pull comparing each bill's `Date` to the service period it covers — an
owner action, not a CFS query.

What **is** measurable bounds the goods half, and it is small
(`api:2026-08-16:db_transactions_query`, `type: purchase`):

- **74 purchase stock movements** in the whole corpus, of which **15 carry a non-zero cost** and 59
  carry `cost.amount_cents: 0`.
- The 15 total **$18,117.52**, and one of them (a pallet buy, $10,944.00) is 60% of it.

⇒ **The goods side of this account is immaterial in the current corpus.** The population that makes
it worth having is **labour** — the EOR invoice against shifts already worked — which is precisely
the stage the current system has never had, so it measures as zero everywhere and would be
mis-scoped by anyone reading the goods number as the whole.

## What this settles

1. **One account, minted for the MATCHED population.**
   `2010 Accrued Expenses: Received Not
   Invoiced`, class liability, credit normal balance, no
   dimension. Named for the criterion, not for the mechanism or the document — the same principle
   that named 2050 for the presentation rule.
2. **The estimated population gets no account, because nothing in v2 produces one.** No event
   estimates an unbilled cost; `EVT-PRO-002` carries a known amount from a source document. Minting
   an "Accrued Expenses (estimated)" account now would be machinery for an unexercised branch —
   which this repo has been bitten by twice.
3. **The bill RECLASSIFIES.** Dr 2010 / Cr 2000, for the amount the bill covers against a resolved
   obligation. Four of the five systems do exactly this; Xero is the exception and Xero has no
   accrual stage to reclassify from.
4. **A reverse-and-re-book is REFUSED, not merely discouraged.** It is the failure mode the survey
   identifies as the most common cause of double-counted expense, and it balances, so only an
   explicit refusal catches it. This is the reject vector erp-spec#14 asked for.
5. **A partial bill is normal and leaves a residual.** Both SAP and NetSuite treat the residual as
   the ordinary state with a reconciliation practice attached, not as an error. So the reclassified
   amount is what the bill covers, capped at the obligation's outstanding balance — the same shape
   `credit_note_allocated` already uses against a note's remaining credit.
6. **A bill for MORE than was accrued is not a variance posting.** The excess is an ordinary direct
   line on the same bill, booked to its own expense account. CFS needs no price-variance account and
   should not mint one: 2600 Rounding was dropped for the same reason — an account that exists to
   absorb a difference gives a defect somewhere to hide.

## What it does not settle

- **A bill for LESS than was accrued** leaves a residual that nothing yet retires. Correcting or
  writing back an over-accrual is a fourth procurement event that does not exist. Not invented here.
- **Three-way matching** (PO → receipt → bill) is out of scope by
  `contexts/procurement/events.yaml`'s own header and stays out.
- **Whether a recurring bill is its own document type.** Untouched.

## Sources

- [17 CFR § 210.5-02 (Cornell LII)](https://www.law.cornell.edu/cfr/text/17/210.5-02)
- [PwC Viewpoint FSP 11.3 — Accounts and notes payable](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_11_other_lia_US/113_accounts_and_not_US.html)
- [PwC Viewpoint FSP 11.4 — Accruals and other liabilities](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_11_other_lia_US/114_accruals_and_oth_US.html)
- [NetSuite — Accounting for Received Purchase Orders](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2408991.html)
- [NetSuite — Vendor/Purchase Transaction GL Impact](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1461991.html)
- [SAP Press — GR/IR Analysis in SAP S/4HANA Finance](https://blog.sap-press.com/gr-ir-analysis-in-sap-s4hana-finance)
- [SAP Help — Reconcile GR/IR Accounts](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/651d8af3ea974ad1a4d74449122c620e/17f3a45189524e78b4a80bf51ff2b741.html)
- [Sage Intacct — Define GL accounts for items, Purchasing](https://www.intacct.com/ia/docs/en_AU/help_action/Purchasing/Setting_up_Purchasing/Items/define-gl-accounts-for-items-purchasing.htm)
- [Sage Intacct Developer — Purchasing transaction definitions](https://developer.intacct.com/api/purchasing/purchasing-transaction-definitions/)
- [Odoo — Inventory valuation configuration (Anglo-Saxon interim accounts)](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/product_management/inventory_valuation/inventory_valuation_config.html)
- [Xero — Accrued expenses: what they are and how to record them](https://www.xero.com/us/guides/accrued-expenses/)
- [ApprovalMax — Xero line item accrual reports](https://support.approvalmax.com/en/articles/413511-step-by-step-guide-to-using-xero-line-item-accrual-reports)
