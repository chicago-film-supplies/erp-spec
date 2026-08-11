---
kind: research
title: Survey — every reference but Xero keeps ONE customer identity with N settlement points, and puts the production on a separate project axis; CFS's three-level name is two axes, not a tree
contexts: [billing, ordering, ledger]
source: "GAAP ASC 280-10-50-42 · Xero contacts/contact-groups docs + community · SAP SD partner functions + customer hierarchy · NetSuite subcustomers + Consolidated Payments · Sage Intacct parent-child National Accounts · Odoo res.partner parent_id/child_ids — links inline, surveyed 2026-08-10"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

For OQ-036. Measured first in
`inbox/2026-08-10-three-concepts-are-crammed-into-the-organization-name.md`: 31 of 286 organizations
are department clones, `Netflix Productions, LLC` is 10 records with no parent, and four delimiter
conventions are in use.

## The question

CFS duplicates the organization and suffixes the name, because **invoices settle per department** —
"locations doesn't want to see what office or wardrobe owes". How do the references model a customer
whose departments settle separately?

## The six

|                      | Mechanism                                                                                                                                                                                                                  | Both views available?                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**             | ASC 280-10-50-42 — **"a group of entities known to be under common control shall be considered as a single customer"** for the 10%-of-revenue major-customer disclosure                                                    | Identity is defined by **common control**, not by who pays the invoice                                                                          |
| **Xero** (incumbent) | **No parent/child at all.** Contact groups filter and bulk-send but do not roll up into one statement; each contact still gets its own                                                                                     | **No.** Open feature requests for hierarchies and sub-contacts                                                                                  |
| **SAP S/4HANA**      | **Partner functions** — sold-to / ship-to / bill-to / **payer**, where payer is "the entity responsible for making the payment". One sold-to may carry many bill-to and payer partners. Plus an N-level customer hierarchy | Yes                                                                                                                                             |
| **NetSuite**         | **Subcustomers** + the **Consolidated Payments** feature                                                                                                                                                                   | Yes, explicitly — A/R Aging shows the **un-consolidated balance per subcustomer** _and_ totals per hierarchy, with a Consolidated Balance field |
| **Sage Intacct**     | **Parent-child "National Accounts"** — the parent may pay children's invoices; aging filters include children                                                                                                              | Yes                                                                                                                                             |
| **Odoo**             | `res.partner` with `parent_id` / `child_ids`, child typed `invoice`; a blank type means Odoo will not use it for invoicing                                                                                                 | Yes                                                                                                                                             |

## The CRITERION

**Separate settlement is an ADDRESSING concern, not an IDENTITY concern. Every reference keeps one
customer identity and hangs N settlement points off it. Not one of them creates a second customer.**

The reason they draw the line there:

- **Identity** carries credit exposure, trading history, pricing/discount inheritance and
  concentration risk.
- **Settlement** carries the invoice, the statement, the aging bucket and the dunning email.

Conflate them and you can have one or the other, never both. CFS currently has settlement and has
given up identity — which is why total exposure to Netflix requires a string match across 10
records.

**Xero is the outlier, and CFS's workaround is the documented Xero workaround.** The community
answer is contact groups (filter, no consolidated statement) or duplicate contacts — and the
duplicate route is explicitly warned against because it **double-counts the receivable** and
payments applied to one copy do not clear the other. CFS chose the duplicate route. The workaround
is not a CFS invention and its costs are known upstream.

## The finding that reframes the question

The measurement note concluded CFS has **three levels** — company → production → department. The
survey says that is **two axes, not a tree**:

| CFS string        | is really                                | axis        |
| ----------------- | ---------------------------------------- | ----------- |
| `20th Television` | the **customer**                         | identity    |
| `Deli Boys - S2`  | a **project**                            | cost object |
| `Locations`       | a **settlement point** (bill-to / payer) | addressing  |

Every serious reference has a _separate_ project/job concept alongside the customer hierarchy — SAP
WBS elements, NetSuite Projects, Intacct's project dimension, Odoo analytic accounts. **A production
is a project.** It is not a level of the customer tree, and modelling it as one is what forces the
combinatorial explosion: 2 productions × 5 departments = 10 organization records, which is exactly
what Netflix looks like today.

Two axes multiply; a tree does not. Netflix under two axes is **1 customer + 2 projects + 5
settlement points = 8 records that compose**, instead of 10 that do not.

**This is also where OQ-035's production type belongs.** A project is a dimension-bearing cost
object in all four systems. Attaching production type to a customer clone — the shape available
today — would put it on the wrong axis, and would inherit the denormalization trap in a new costume.

## Migration delta (Xero)

**Real, and it is the largest one found so far.** ADR-0020 already governs restating history; this
is a different kind of change — a **re-keying**, not a re-dimensioning.

- The 10 Netflix records must map to 1 customer + N projects + M settlement points. ADR-0009 fences
  foreign ids out of domain models, so that mapping has to be **authored and committed**, not
  derived — the four inconsistent delimiters make a parse unreliable, and `Transportation` /
  `Transpo` are one department spelled two ways.
- **Match-on-name is not a viable key**, independently: 5 exact-duplicate name pairs exist plus 3
  records suffixed with a literal `(copy)`, so `Sound Off Films` occurs three times.
- ⚠️ **AR balances must not move.** Xero's own warning about the duplicate-contact route is that it
  double-counts the receivable; a migration that consolidates 10 records into 1 must prove the
  consolidated balance equals the sum of the parts, per invoice and per settlement. This is the same
  assertion ADR-0020 makes about amounts, applied to a different axis.

## The GAAP caveat, stated rather than buried

ASC 280-10-50-42 binds **public entities**. CFS is private, so the major-customer disclosure is not
required of it. The survey cites it for the **criterion**, not the obligation: GAAP's answer to
"what is one customer" is **common control**, not billing convenience. That a private company need
not disclose it does not make ten Netflix records one customer for credit purposes — it just means
nobody outside will ask.

## Sources

- GAAP —
  [Deloitte DART 5.7, Information About Major Customers](https://dart.deloitte.com/USDART/home/codification/presentation/asc280-10/roadmap-segment-reporting/chapter-5-entity-wide-disclosures/5-7-information-about-major-customers)
  ·
  [PwC 25.7 Segment disclosures](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_25_segment_r_US/257_disclosures_US.html)
- Xero —
  [Parent-child customers in Xero: consolidated statements (Paidnice)](https://www.paidnice.com/blog/xero-parent-child-customers-consolidated-statements)
  ·
  [Invoicing different departments in the same company (Trove)](https://trove.works/xero-invoice-reminders-different-departments/)
  ·
  [Parent Child Hierarchy for Customer Invoicing (Xero Central)](https://central.xero.com/s/question/0D58V00008ywAEySAM/parent-child-hierarchy-for-customer-invoicing)
  ·
  [Contact — sub contacts (product ideas)](https://productideas.xero.com/forums/967130-contacts-files/suggestions/48238766-contact-sub-contacts)
- SAP —
  [Customer Master Data: Partner Functions in SAP SD](https://www.itpathshaala.com/tutorials/sap-sd/partner-functions.html)
  ·
  [One sold-to, multiple ship-to/bill-to/payers (SAP Community)](https://community.sap.com/t5/enterprise-resource-planning-q-a/one-sold-to-party-multiple-ship-to-bill-to-and-payers/qaq-p/4347553)
  ·
  [Customer hierarchy & partner determination (SAP Community)](https://community.sap.com/t5/enterprise-resource-planning-q-a/customer-hierarchy-partner-determination/qaq-p/2784583)
- NetSuite —
  [Creating a Subcustomer Record](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1085616.html)
  ·
  [Consolidated Payments](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1288474.html)
  ·
  [A/R Aging Summary Report](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1531392.html)
- Sage Intacct —
  [Customer Aging report](https://www.intacct.com/ia/docs/en_US/help_action/Accounts_Receivable/AR_reports/customer-aging-report.htm)
  ·
  [Sage Intacct 2023 R4 — parent-child payments / National Accounts](https://www.rklesolutions.com/blog/all-new-additions-and-upgrades-in-sage-intacct-r4-2023)
- Odoo —
  [The res.partner Model: Odoo's Contact Architecture](https://www.dasolo.ai/blog/odoo-data-api-5/odoo-res-partner-model-guide-154)
  ·
  [Choosing an existing contact as default invoice address](https://www.odoo.com/forum/help-1/choosing-an-existing-contact-as-default-invoice-or-delivery-address-261386)
