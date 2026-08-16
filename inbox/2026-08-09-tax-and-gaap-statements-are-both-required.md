---
kind: constraint
title: Both a tax-basis and a GAAP-basis P&L and balance sheet are required, across years
contexts: [fixed-assets, tax, ledger]
source: repo owner, 2026-08-09 session
confidence: high
promotes_to: [REQ-TAX-001, REQ-TAX-002]
verified: false
triage_count: 0
---

Stated by the owner while settling how the tax book reaches the ledger:

> hundreds soon to be thousands of low value fixed assets (rental inventory) many take sec 179 for
> tax purpose and are fully depreciated in year 1 but for gaap are 5/10/20 years. we have maintain
> P&L and Balance Sheets for tax and gaap across years

Three facts, and the third is the one that changes a design:

1. **Volume** — hundreds now, thousands soon. Rental inventory _is_ the fixed-asset register.
2. **The bases diverge hard, not marginally.** A §179 election expenses the whole basis in year 1;
   GAAP carries the same asset 5, 10 or 20 years. So tax NBV is 0 while GAAP NBV is most of cost,
   for most of the fleet, for most of its life.
3. **Both bases must produce a full P&L _and balance sheet_, across years** — not a single deferred
   difference. `ADR-0007` says "the deferred difference between them is itself reportable", which is
   a weaker requirement and is what the spec had been designed against.

(3) is what rules out treating the tax basis as a memo schedule on the register: a balance sheet
needs tax-basis accumulated depreciation, tax-basis asset carrying value, and the tax-basis equity
that follows from them.

## What the accounting suites do with a tax book

Surveyed 2026-08-09 because the obvious reading of (3) — "then the tax book must post" — is not what
the mature fixed-asset systems chose.

| Suite                 | Does the tax book post to the GL?                                                                                                                                                                                                                    | Mechanism                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **SAP S/4HANA FI-AA** | Optional, and non-posting is a first-class setting: posting indicator **(0) "Area does not post any values to FI"**, "for reporting purposes only". A tax area that _does_ post goes to a **non-leading ledger** — never mixed into the leading one. | depreciation area + posting indicator               |
| **NetSuite**          | **No**, for tax methods: _"Alternate methods are not linked to NetSuite journal postings."_ Multi-Book Accounting separately distinguishes **GL Posting** from **Non GL Posting** books.                                                             | alternate method, or a whole second accounting book |
| **Sage Fixed Assets** | **No** — one **default posting book** (Internal) updates the GL; Tax / ACE / State are reporting books. The docs warn that changing which book posts double-posts depreciation.                                                                      | many books, one posting book                        |
| **ERPNext**           | **Yes** — `Finance Book` is carried on the entry, each book gets its own depreciation schedule and its own GL entries, blank means default.                                                                                                          | a dimension on the posting                          |
| **Odoo**              | No native support. The documented workaround is a **duplicated asset record posted to a different journal**, so both do post — by duplication, not by design.                                                                                        | duplicate asset + journal                           |

The three suites built for serious fixed-asset accounting all default the tax book to **non-posting
and reported**. The two lighter ones post it, and Odoo's is explicitly a workaround.

The IRS's own model agrees: Form 1065 carries **one** balance sheet (Schedule L) plus **Schedules
M-1/M-2** reconciling book to tax. The reconciliation is the artifact, not a second ledger.

Sources:

- SAP:
  <https://learning.sap.com/courses/configuring-asset-accounting-in-sap-s4hana/defining-how-depreciation-areas-post-to-the-general-ledger>
- NetSuite:
  <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_164862707730.html>
- Sage Fixed Assets: <https://docs.sage.com/docs/en/customer/sfa/Guides/open/SFALinks.pdf>
- ERPNext: <https://docs.frappe.io/erpnext/using-finance-book-for-asset-depreciation>
- Odoo:
  <https://www.odoo.com/forum/help-1/does-odoo-support-multiple-depreciation-tables-methods-areas-for-a-single-fixed-asset-289196>

## Why a partial second book inside one ledger does not work

Worth recording, because it is the design that looks cheapest and is wrong. The two books differ in
accumulated depreciation and depreciation expense, so the tempting move is to give only those
accounts a per-book twin and share everything else. A disposal breaks it: the asset leaves the books
**once**, but its cost is relieved against a different accumulated depreciation and a different gain
in each book — so `Cr 1500` cannot be shared, and duplicating the asset account drags in the funding
account, which drags in AP, which is the whole ledger. Either every posting is duplicated or none
is.

## Local costs of a true parallel ledger

- `ledger/tigerbeetle-accounts.yaml` sets **TB account id = the GL code widened to u128**.
  TigerBeetle account ids are globally unique, not per-ledger, so a second ledger needs a book
  component in the id and that rule changes.
- Every posting rule fans over books, including the three already `specified` with 13 vectors.
- A `book` tag on the transfer instead is a **fifth claimant** on three `user_data` fields that
  erp-spec#3 already has four claimants for.
