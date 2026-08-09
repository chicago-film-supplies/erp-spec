---
kind: research
title: Where a credit note and an advance sit — SAP, NetSuite, Sage Intacct and Odoo all draw the same line, and CFS falls on the other side of it
contexts: [billing, ledger]
source: vendor documentation and practitioner material, surveyed 2026-08-09
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed to settle the credit side of `credit_note_issued` (erp-spec#5) — a new liability account,
or credit 1200 directly. The survey changed the *reasoning* and confirmed the *answer*.

## What the four do

| | credit note / memo | value received in advance |
|---|---|---|
| **SAP S/4HANA** | the customer's ordinary **reconciliation account** — "when you enter a customer invoice or customer credit memo in accounts receivable, [it] is posted to the created reconciliation account in the same way" | a **special G/L indicator** routes it to an **alternative reconciliation account**, expressly because "down payments may not be presented in the balance sheet together with receivables and payables for goods and services" |
| **NetSuite** | **Dr Sales Income / Cr Accounts Receivable**. An unapplied credit memo is a negative receivable | **Customer Deposits**, an Other Current Liability — "they don't affect the customer's accounts receivable balance" |
| **Sage Intacct** | an AR adjustment | an unapplied payment becomes an **AR Advance**, a distinct object |
| **Odoo** | "a reverse entry that cancels out the journal items from the original invoice" — so it credits the receivable | a **down-payment product configured to book into a Current Liabilities account** |

Sources:
- SAP special G/L: <https://learning.sap.com/courses/configuring-additional-settings-in-financial-accounting-in-sap-s-4hana/managing-the-application-view-for-special-general-ledger-transactions>
- NetSuite GL impact per transaction type: <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1460914.html>
- NetSuite customer deposits: <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1296349.html>
- Prolecto (NetSuite practice): <https://blog.prolecto.com/2022/05/22/how-to-convert-netsuite-accounts-receivable-credits-to-customer-deposits/>
- Sage Intacct advances: <https://ethosystems.com/blog/how-advances-work-in-sage-intacct-makeyourforemanhappy/>
- Odoo credit notes: <https://www.odoo.com/documentation/18.0/applications/finance/accounting/customer_invoices/credit_notes.html>
- Odoo "deposits which are liabilities, not AR credits": <https://www.odoo.com/forum/help-1/how-can-i-handle-in-advance-customer-payments-deposits-which-are-liabilities-not-ar-credits-142687>

## The criterion, which matters more than the default

**All four put a credit memo in receivables.** Taken as a vote, that is 4–0 against a new account.

But the line they are all drawing is **"is this value attached to a sale that has been billed?"** In
every one of those systems a credit memo is raised *against an invoice*, so it belongs with that
invoice's receivable. An advance is attached to nothing, so it gets a liability — and each of the
four built a dedicated mechanism to keep it off trade receivables, with the balance-sheet
presentation as the stated reason.

**A CFS credit note fails that test on its own data model.** `credit-notes` is organization-scoped
and carries no `query_by_orders`, where `Invoice` requires min-1
(`code:2026-08-09:core@33f5654:src/schemas/credit-note.ts`). Where it lands is a separate
`settlements` row, and one note demonstrably splits across invoices: CN-1015's $259.74 goes $247.75
to invoice 1767 and $11.99 to invoice 1751 (`api:2026-08-09:get_settlements`). At issue it is
attached to nothing — the advance side of the line, not the credit-memo side.

So following the **criterion** and departing from the **default** is the correct read, and a survey
that had only collected defaults would have got this backwards.

## Practitioner material is evidence, not colour

A consultancy publishing *how to work around* a product's default measures what that default costs.
Prolecto, a NetSuite practice, publishes a procedure for converting AR credits into customer
deposits to "avoid net accounts receivable credits and instead have these re-classed as customer
deposits" in "the current liability section", noting that credits floating in AR aging "obscure the
true financial position". The Odoo forum question is titled, in the asker's own words, *"deposits
which are liabilities, not AR credits"*.

## GAAP, which is the reason any of them bother

**Customer credit balances are not netted against receivables.** A customer with an unallocated
credit and no open invoice has a credit balance in AR that nets against other customers' debit
balances, understating both the receivable and the amount owed back. Companies with material
customer credits reclassify at each reporting date; an account they never entered needs no reclass.
Hence the name adopted — **2050 Customer Credit Balances**, named for the rule rather than for the
document that most often fills it.

## One argument that was overstated and is withdrawn

The first draft of this reasoning claimed that crediting 1200 breaks the tie between the AR control
account and its subledger. **It does not.** An AR subledger is the customer ledger and credit memos
are part of it; Xero and QuickBooks park unallocated credits in AR and reconcile fine. The argument
that survives is presentation, not reconciliation.

## Materiality, stated because it cuts the other way

13 credit notes in the whole corpus — 10 `applied`, 3 `void`, and **none unallocated**: every
`remaining_credit_cents` is 0 (`api:2026-08-09:search_credit_notes`). The account's balance would be
$0.00 at cutover. It is being chosen for a state the model permits rather than one the corpus has
ever been in.
