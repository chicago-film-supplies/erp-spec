---
kind: research
title: Combined survey — when does a vendor-side amount become revenue rather than an adjustment to cost? ASC 606's control test makes CFS a PRINCIPAL on pass-throughs (gross), and ASC 330 permits either treatment for supplier discounts but demands consistency — so CFS's real defect is that both accounts are Active
contexts: [ledger, billing]
source: ASC 606-10-55-36ff principal-vs-agent (RevenueHub, BillingPlatform, Hubifi) · ASC 330 / PwC Inventory Guide 1.5 and 2.2 on purchase discounts · Oracle NetSuite "Billing Costs to Customers" + "Track Billable Expense in" · Odoo 18/19 "Re-invoice expenses" · Xero Central "Add billable expenses"; plus owner facts 2026-08-16 and api:2026-08-16 measurements
confidence: medium
promotes_to: []
verified: true
triage_count: 0
---

Surveys **OQ-026** (is a supplier discount other income or a contra-COGS?) and **OQ-041** (does a
pass-through carry a product line?) together, because they are the same question asked twice: **when
does a vendor-side amount become REVENUE, and when is it an ADJUSTMENT TO COST?**

⚠️ **This survey is complete on GAAP and thin on three of the five systems.** Substantive material
was reachable for GAAP, NetSuite and Odoo. Xero's markup mechanics, Sage Intacct's rebill
configuration and SAP's third-party/drop-ship posting were **not** reachable in the sources
searched. That is recorded rather than padded — CLAUDE.md asks for six references, and this is
three-and-a-half. The GAAP half is firm enough to act on; the migration delta against Xero is
**unmeasured** and named below as what would settle it.

## Topic A — the pass-through: gross or net

### GAAP — control is the test, and the indicators are evidence rather than a checklist

ASC 606-10-55-36ff: an entity is a **principal** if it **controls** the good or service before
transfer, and recognises revenue **gross**; an **agent** arranges for another party to provide it
and recognises **net**. Three indicators support the assessment — primary responsibility for
fulfilment, inventory risk, and price discretion.

⚠️ **The caveat is explicit and it corrects how this was framed to the owner.** _"These indicators
are evidence, not a three-part test. Meeting two of three doesn't automatically make the entity a
principal. Failing two of three doesn't make it an agent."_ An earlier message in this session said
"2 of 3 indicators point principal" as though counting settled it. It does not.

**Owner facts, 2026-08-16:**

| Indicator              | CFS                                                   | Points to     |
| ---------------------- | ----------------------------------------------------- | ------------- |
| Primary responsibility | **CFS** — "we own the problem"; customer comes to CFS | **principal** |
| Price discretion       | **CFS sets it** — discretion over the markup          | **principal** |
| Inventory risk         | none — the customer commits first, then CFS buys      | agent         |

**Determination: PRINCIPAL, therefore GROSS.** Not by counting, but because the two that point
principal are the two that establish **control**: being responsible for the acceptability of the
good and setting the price to the customer is directing its use and obtaining its benefit before
transfer. Absence of inventory risk is ordinary in a buy-to-order arrangement and does not by itself
make an agent — a drop-shipper with fulfilment responsibility and pricing power is still a
principal.

⇒ `4140 Pass Through Income` carries the **full re-billed amount** and
`5150 Cost of Goods Sold:
Pass Through` the **full vendor cost**. The pairing minted on 2026-08-16
is correct, and the margin is the markup.

### NetSuite — the most useful system finding: NET is the default, GROSS is opt-in

Costs are billed back through a **"Track Billable Expense in"** field on the expense account, which
names the account credited when the expense is invoiced. **Without it, NetSuite credits the EXPENSE
account** — a net presentation — and practitioners report exactly that surprise: _"a credit to
expenses was being posted, even though theoretically it is a passthrough… the solution is to use the
Track Billable Expense In field to direct the revenue to an income account instead."_

**So the mature mid-market default is NET, and gross is a deliberate configuration.** That matters
for CFS: choosing gross is a decision to be recorded, not a shape to assume, and 4140 existing as a
revenue account is already that choice made implicitly.

### Odoo — the markup IS the thing that creates revenue

Re-invoicing is governed by a per-expense **Re-invoice Costs** policy with two values: **"At cost"**
or **"Sales price"**. At cost re-bills the vendor amount with no margin; Sales price bills the
configured sales price, and the difference is revenue. The expense also carries **"Customer to
Reinvoice"** and an **Analytic Distribution**.

**The criterion made mechanical**: where there is no markup there is nothing to recognise beyond the
recovery; where there is a markup, that markup is the revenue. It is the same line ASC 606 draws,
expressed as a configuration field.

### Xero — the incumbent, and the delta is UNMEASURED

Billable expenses exist: assign a bill (or spend-money line) to a customer, then add it to their
invoice later. **What could not be established from the sources searched is how a markup is applied
and which income account receives it.** So whether CFS's Xero history presents pass-throughs gross
or net is **not known**, and that is the migration delta ADR-0020 would have to carry.

**What would settle it**: the Xero-derived fields already mirrored into Firestore — the one line
found on 4140 (`1Qr50IQXdPjKC2cB7WyV`, a `custom-` service line) has a `xero_id`, so its Xero
counterpart shows whether the cost was posted against it or separately. One document, and it decides
the delta. Not done here.

### Sage Intacct and SAP — not reached

Intacct documents reimbursable expenses and invoicing at point of entry, but the rebill/markup
revenue-account configuration was not reachable. SAP's third-party and drop-ship posting was not
reached at all. Two genuine gaps.

## Topic B — the supplier discount: 4300 or 5001

### GAAP — and this REVERSES the prior stated in this session

ASC 330 / the retail inventory method: cash discounts are _"credited directly to the purchases
account at cost, reducing the cost of inventory"_, and under a perpetual method the buyer records
the discount as a **reduction of inventory**.

⚠️ **But it is not exclusive.** _"GAAP allows recognition either as a reduction of purchases or as
other income, but consistency must be maintained."_

**An earlier message in this session predicted "GAAP likely has a firm answer here … which would
make this narrower than it looks." That was wrong**, and it is exactly the kind of prior the survey
rule exists to catch. Both treatments are permissible. The default and the conceptually preferred
treatment is reduction of cost; **the binding requirement is CONSISTENCY.**

### ⇒ The real defect is not which account. It is that BOTH are Active

`4300 Discounts Received` (Revenue) and `5001 Cost of Goods Sold: Purchase Discounts`
(contra-Expense) are **both Active today**, so — in OQ-026's own words — "the treatment is currently
whichever account the operator picked." Under a standard that permits either treatment **but
requires consistency**, an operator-by-operator choice is the one thing that is not permitted.

So OQ-026 is not really "which is right". It is **"pick one and retire the other"**, and the default
answer is `5001`.

### Owner facts scope it further

Owner, 2026-08-16: supplier discounts are _"often none"_; pass-throughs are _"usually one off deal
done as a courtesy to customer"_; _"if it's from a vendor we have account with we might have net 30
terms"_; and _"any real wholesale price relationship would generally warrant creating a product in
the catalog"_.

⇒ The population is **early-payment terms on account vendors, and it is small**. Not volume rebates,
not marketing or co-op allowances — which is worth stating because those three are treated
differently again and none of them applies here.

## A rule the data already obeyed

Owner, 2026-08-16: **"pass through items should exclusively be custom items (not product/service
catalog)."**

**Measured the same day and the corpus already conforms**: `api:2026-08-16:db_products_count` — **0
of 549 products** carry `price.coa_revenue: 4140`; `api:2026-08-16:db_invoices_query` over the first
**63** invoices found **1** line on 4140 and it is a `custom-` line. ⚠️ 63 of 999, not a corpus-wide
count.

It is self-enforcing by the owner's own logic — anything with a durable wholesale price _graduates_
into the catalog and stops being a pass-through — and it is **requirement-shaped and testable**: a
product configured with `coa_revenue: 4140` should be refused.

## What the survey settles, and what it does not

|                           |                                                                              |
| ------------------------- | ---------------------------------------------------------------------------- |
| **OQ-041, gross vs net**  | **Settled: principal, gross.** GAAP control test + owner facts               |
| **OQ-041, the dimension** | **Recommendation below**, owner's call                                       |
| **OQ-026**                | **Reframed: the defect is two Active accounts**, not the choice between them |
| **Xero migration delta**  | **Unmeasured.** One document would settle it                                 |
| **Intacct, SAP**          | **Not reached**                                                              |

**Dimension recommendation for 4140 / 5150: `product_line: null`, keeping the obligation to
declare.** `ledger/dimensions.yaml` already defines exactly this fact — _"this IS a categorised kind
of sale, and no tracked product line applies to it"_ — and a pass-through is precisely that: a real
sale, of a thing that by rule is not in the catalogue and therefore has no line. **That is different
from what 4700/5500 took on the same day**, which is _no dimension obligation at all_, because a
card fee is not a sale. Two empty-looking answers, two different reasons, and the distinction is the
one `dimensions.yaml` was written to preserve.

## Sources

- [Principal/Agent Considerations (Gross vs Net) in ASC 606 — RevenueHub](https://www.revenuehub.org/article/principalagent-considerations-gross-vs-net)
- [ASC 606 Principal vs. Agent — BillingPlatform](https://billingplatform.com/blog/asc-606-principal-vs-agent)
- [Agent vs. Principal under ASC 606: Gross vs. Net Revenue — Hubifi](https://www.hubifi.com/blog/acting-as-agent-vs-principal)
- [PwC Inventory Guide 1.5 — Other inventory costing matters](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/inventory/Inventory-Guide/Chapter-1-Inventory-costing/1_5_Other.html)
- [PwC Inventory Guide 2.2 — retail inventory method, cash discounts credited to purchases](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/inventory/Inventory-Guide/Chapter-2-Retail-inventory-method/2_2-Challenges-in-the-application-of-the-retail-inventory-method.html)
- [Journal Entries for Purchase Discounts: Gross vs Net Method — AccountingTitan](https://accountingtitan.com/financial-reporting/journal-entries-for-purchase-discounts/)
- [NetSuite — Billing Costs to Customers](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1248576.html)
- [NetSuite — Billing Expenses to Customers](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1250082.html)
- [Tracking NetSuite billable expenses as income ("Track Billable Expense in") — Limebox](https://limebox.com/how-to-easily-track-netsuite-billable-expenses-as-income/)
- [Odoo 18 — Re-invoice expenses](https://www.odoo.com/documentation/18.0/applications/sales/sales/invoicing/expense.html)
- [Odoo 19 — Reinvoice expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/reinvoice_expenses.html)
- [Xero Central — Add billable expenses](https://central.xero.com/s/article/Add-billable-expenses-to-bills)
- [Sage Intacct — project costing, invoicing and billing](https://www.sage.com/en-us/sage-business-cloud/intacct/product-capabilities/extended-capabilities/project-costing/)
