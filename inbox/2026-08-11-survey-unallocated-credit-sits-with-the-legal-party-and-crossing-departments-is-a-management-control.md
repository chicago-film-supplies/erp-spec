---
kind: research
title: Survey — every reference draws the credit-allocation line at the LEGAL PARTY, so crossing settlement points inside one organization is a management control rather than an accounting constraint; and the migration delta is nil because the one historical crossing is a duplicate pair the mapping collapses
contexts: [billing, ledger]
source: ASC 210-20-45-1 (right of setoff) · Xero Central + Xero Product Ideas · SAP Help Portal (alternative payee, head office/branch) · Oracle NetSuite Applications Suite docs (customer credits, consolidated payments, credit limits) · Sage Intacct help (apply AR credit, single payment multiple customers) · Odoo res.partner commercial_partner_id + Odoo community; measured against CFS prod api:2026-08-11:search_credit_notes + get_credit_notes_uid_allocations (13 notes, 9 allocations)
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Required by CLAUDE.md → _Accounting decisions_ before any ADR states where unallocated credit sits
under ADR-0032's tree. The owner's decision (2026-08-10 interview) was **credit at the settlement
point, cross-node allocation legal but recorded**. This survey tests it against all six references
and measures the migration delta.

**Question surveyed:** at which level of a customer hierarchy is unallocated credit held, and may it
be applied to a sibling node's invoice? Secondarily: is a document's bill-to determined at header or
at line level?

## The six

### GAAP — the line is the legal counterparty, and nothing else

**ASC 210-20-45-1** states four conditions for a right of setoff: each of two parties owes the other
determinable amounts; the reporting party has the right to set off; it intends to set off; and the
right is enforceable at law. The controlling gloss: _an asset and liability should be offset under a
legal right of setoff **only when they represent amounts due to and from the same party**_, and an
entity **cannot** offset receivables and payables with different counterparties.

**This is the criterion the whole question turns on, and it is a test about PARTIES, not about
departments.** Within one legal entity there is exactly one counterparty, so setoff across its
internal divisions raises no GAAP question at all. Across two legal entities it is prohibited
outright, regardless of how related they look.

ADR-0032 already decided that a settlement point is an internal division of the liable organization.
**GAAP therefore permits credit to cross settlement points freely, and forbids it crossing
organizations** — and that mapping is exact, not approximate.

### Xero — the incumbent, and it has no hierarchy to have an opinion about

A credit note can be allocated only to invoices of the same contact and the same side of the ledger,
and it is not possible to allocate credit from one contact to another. The documented workarounds
are to **edit the credit note to change its contact**, or to reverse it and re-issue under the other
entity — both of which rewrite history rather than record a transfer.

Since CFS's 286 contacts are flat clones, a credit today is pinned to whichever clone it was raised
on, with no way to express that two clones are one party. The incumbent cannot state the question,
let alone answer it.

### SAP — the receivable is borne at the LEAF; clearing may happen at the root

Two distinct mechanisms, and conflating them is the trap:

- **Alternative payer/payee does not move the receivable.** "The system maintains all the
  transaction details in the account of the original customer" — using an alternative payer "does
  not waive the liability from original customer", and accounts are settled in their name. It is a
  payment-processing and correspondence convenience.
- **Head office / branch is the real hierarchy.** Items post to the branch account, and a payment
  made to the head office **clears the line item in the branch account**.

So SAP holds the balance at the leaf and permits clearing from above. That is the owner's shape
exactly.

### NetSuite — consolidation is opt-in, and it is a PAYMENT feature

Credits apply through the Apply subtab against that customer's invoices. On the hierarchy:

- By default "the credit limit you set for a customer doesn't include any of the customer's
  subcustomers" — a parent can be at its limit while its subcustomers trade on unrestricted.
- With **Consolidated Payments** enabled, "the credit limit defined for a top-level customer is
  applied to the entire hierarchy, and credit limits set on individual subcustomer records are not
  enforced."

Note what is being consolidated: **payments and limits**, not the balance. The subcustomer keeps its
own receivable either way.

### Sage Intacct — the sharpest line in the survey, and it splits CREDIT from PAYMENT

Intacct is explicit and restrictive on credit: _"You cannot apply credits from one customer to the
invoices of another customer, **even if they are in a parent-child relationship**."_

And permissive on payment. A single payment offers three modes: one customer's invoices; **parent
and child customer invoices**; or **multiple, unrelated customers' invoices** (entering a payer
name).

**That split is the most useful finding in the survey.** Intacct is not saying "hierarchies don't
matter" — it is saying that a _credit_ is a value pinned to the party that earned it, while a
_payment_ is money arriving that may settle anything. Two different questions with two different
answers, in the same module.

### Odoo — the opposite placement from SAP, via `commercial_partner_id`

Odoo records the **commercial partner** on every invoice and payment — the "fiduciary" or bill
payer, set automatically. "Account Receivable balances can only be paid by the same Customer that
accrued them, and Odoo manages this via the Commercial Entity field." Child contacts under a company
are **addressing**; the commercial entity bears the receivable. Odoo pushes AR **up** to the root
where SAP holds it **down** at the leaf.

Odoo also documents the escape hatch that makes the criterion visible: you can configure two
customers to accrue AR "on behalf of the same Commercial Entity — a third Customer — and any of the
three Customers can pay those balances." **The thing that licenses cross-node payment is a declared
shared commercial entity** — i.e. a declared single party. GAAP's test again, implemented.

## What the survey settles

| Reference | Where the balance sits           | Credit may cross a node?                       | Payment may cross?       |
| --------- | -------------------------------- | ---------------------------------------------- | ------------------------ |
| GAAP      | n/a — asks about parties         | **yes within one party; never across parties** | same test                |
| Xero      | the contact                      | **no** (edit or reverse)                       | no                       |
| SAP       | **the leaf** (branch)            | via head-office clearing                       | yes, head office         |
| NetSuite  | the subcustomer                  | via Consolidated Payments                      | yes                      |
| Intacct   | the customer                     | **no, even parent-child**                      | **yes**, incl. unrelated |
| Odoo      | **the root** (commercial entity) | yes, within the entity                         | yes, within the entity   |

**THE CRITERION: every reference draws its line at the legal party, and they differ only on whether
a sub-node bears its own balance.** Where nodes are modelled as _separate customers_ (Xero contacts,
Intacct parent/child), credit cannot cross — the system cannot prove they are one party. Where nodes
are modelled as _internal divisions of one party_ (SAP branch, Odoo commercial entity), crossing is
native and needs no ceremony.

**CFS's settlement points are internal divisions of one legal entity by construction** — that is
precisely what ADR-0032 decided. So the owner's choice is supported, and the split placement (SAP at
the leaf, Odoo at the root) is a genuine choice rather than a default to follow. Holding the balance
at the leaf is what makes the per-department aging the owner asked for computable without a tree
walk.

⚠️ **The one thing the survey corrects in the owner's framing.** Nothing in GAAP, and nothing in
four of the five systems, _requires_ a recorded event when credit crosses settlement points inside
one organization — GAAP is silent because there is one counterparty, and SAP/NetSuite/Odoo do it
natively without ceremony. **So the recorded cross-node transfer is a MANAGEMENT control, not an
accounting constraint, and the ADR must say so.** Its justification is the owner's own requirement —
_locations doesn't want to see what office owes_ — and its inverse, that Locations must be able to
see where its overpayment went. Framed as an accounting requirement it would be wrong; framed as a
deliberate control it is defensible and cheap.

**On header vs item bill-to: five of six are header-only.** Only SAP determines partners per
document at header _and_ item level. That supports ADR-0032's header-only decision and makes the
level-tagged reference (rather than an item-level split now) the conservative read.

## The migration delta — measured, and it is nil

`api:2026-08-11:search_credit_notes` (all 13) + `get_credit_notes_uid_allocations` on each of the 10
`applied` notes:

| Fact                                                   | Measured                        |
| ------------------------------------------------------ | ------------------------------- |
| Credit notes total                                     | **13** (10 `applied`, 3 `void`) |
| Allocation rows across the applied notes               | **9**                           |
| Allocations naming the SAME organization as their note | **8 of 9**                      |
| Allocations CROSSING an organization                   | **1 of 9**                      |
| Applied notes with **no allocation row at all**        | **2**                           |

**The one crossing is a duplicate pair, not a department.** CN-1024's single allocation names
organization `AxDwNH8IFZEKJJrMqjQc`, while the note's indexed organization is `CTFP195QqkTtEl4kyfc2`
— the **two duplicate `Free Spirit Media` records** recorded in the 2026-08-10 interview note. The
invoice it settles, #1981 (`7XHkIvda0ABfpYdfM4mT`, $150.00, `amount_credited_cents: 15000`), belongs
to `AxDw…`.

⇒ **The authored mapping collapses that pair into one organization, so the crossing becomes
intra-organization and needs no transfer event. The cross-node transfer machinery has ZERO
historical population** — it is for the future shape, not for the migration. Same result as the
2026-08-09 credit-note survey, arrived at independently: the delta that looked like a cost is nil.

⚠️ **Caveat on that read, stated rather than hidden.** There is no `db_credit_notes_*` tool —
`credit-notes` is absent from `db_schema`'s collection enum — so the authoritative Firestore
document could not be read, only its Typesense projection. Two of three sources (the allocation row
and the settled invoice) say `AxDw…`; the index says `CTFP…`. Either it is a genuine cross-org
allocation or the note's indexed organization is stale. **Both readings resolve the same way** — the
pair collapses in the mapping — so the conclusion holds, but the underlying record should be
inspected when the mapping is authored.

## A defect this measurement identifies by uid

**api-cloudrun#469** records "two credit notes report `applied` with zero remaining credit but have
no allocation row" without naming them. They are:

- `MKeNqa5Xc9yfQj5jqqbT` — CN-1016, `Yellow Film LLC` (`DKyHS1VLElkZgnsyG8ou`)
- `zFXSXP1jLdtfyO9nVpYl` — CN-1013, `Juniper Productions` (`fK0Iqo4f6mJEWnuyJAvw`)

Both `status: applied`, both `remaining_credit_cents: 0`, both with an empty allocations array.
Worth adding to the issue so it can be picked up cold.

## Sources

- [ASC 210-20-45-1 — right of setoff, four conditions](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_2_balance_sh_US/24_balance_sheet_off_US.html)
- [Overview of the offsetting rules — same-party requirement](https://www.esevans.com/2023/11/overview-of-the-offsetting-rules/)
- [Xero Central — apply a customer's credit to an invoice](https://central.xero.com/0/article/Apply-a-customer-s-credit-to-an-invoice)
- [Xero Product Ideas — "Credit Note: allocate to different contact"](https://productideas.xero.com/forums/967115-invoices-quotes/suggestions/47672633-credit-note-allocate-to-different-contact)
- [SAP Help Portal — Alternative Payee](https://help.sap.com/docs/SAP_ERP/72b431fb78a649da9c8b46951e64fb88/cde8d353ca9f4408e10000000a174cb4.html)
- [SAP Help Portal — Setting Up Head Office and Branch Accounts](https://help.sap.com/docs/SAP_ERP/72b431fb78a649da9c8b46951e64fb88/72e8d353ca9f4408e10000000a174cb4.html)
- [SAP Community — Alternative Payer/Payee vs Head Office/Branch](https://community.sap.com/t5/enterprise-resource-planning-q-a/alternative-payer-payee-v-s-head-office-branch-functionality/qaq-p/10007856)
- [NetSuite — Applying a Customer Credit Memo](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1312521.html)
- [NetSuite — Managing Customer Credit Limits and Holds](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1080144.html)
- [NetSuite — Consolidated Payments](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1288474.html)
- [Sage Intacct — Apply an AR credit to an invoice](https://www.intacct.com/ia/docs/en_US/help_action/Accounts_Receivable/Adjustments/How_Do_I/apply-credit-to-an-invoice.htm)
- [Sage Intacct — Receive a payment for multiple customers](https://www.intacct.com/ia/docs/en_US/help_action/Accounts_Receivable/Payments/single-payment-multiple-customers.htm)
- [Odoo — the res.partner model and commercial_partner_id](https://www.dasolo.ai/blog/odoo-data-api-5/odoo-res-partner-model-guide-154)
- [Odoo forum — can a parent company pay a subsidiary's invoices](https://www.odoo.com/forum/help-1/can-one-company-my-customer-s-parent-pay-the-invoices-of-another-company-my-customer-a-subsidiary-of-the-other-company-176557)
