---
kind: research
title: Allocation basis for a product-line P&L, surveyed across six references — all six agree on the CRITERION, and by that criterion revenue is the worst of the defensible bases
contexts: [ledger, billing]
source: GAAP/ASC + Xero + SAP S/4HANA + NetSuite + Sage Intacct + Odoo documentation and practitioner material, 2026-08-09
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run to settle ADR-0029's open consequence — "the allocation basis is a decision that has not been
made" — under the standing rule that anything accounting-shaped is surveyed before it is decided.
The question: on what basis does the official product-line P&L spread delivery revenue and delivery
cost across the goods on the orders that caused them?

## The criterion, which is the part that matters

Every system below implements the same textbook hierarchy, so it is worth stating first. Horngren's
four criteria for choosing an allocation base, in the published order of preference:

|   | criterion                                                                                                                 | standing                                                                                                                                      |
| - | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **cause and effect** — allocate by the activity that _causes_ the cost                                                    | dominant; the basis of ABC                                                                                                                    |
| 2 | **benefits received** — allocate to beneficiaries in proportion to benefit                                                | dominant                                                                                                                                      |
| 3 | fairness / equity                                                                                                         | "problematic because fairness is difficult to achieve"                                                                                        |
| 4 | **ability to bear** — allocate in proportion to the cost object's capacity to absorb, e.g. by revenue or operating income | "**usually unacceptable** because of its negative effect on managerial motivation — it subsidizes poor performers at the expense of the best" |

⚠️ **This puts a revenue basis in the worst tier, by name.** Allocating delivery by goods revenue is
not a cause-and-effect allocation that happens to use dollars; it is an _ability-to-bear_
allocation. Revenue does not cause a van to drive. The line that sells most absorbs most, whether or
not it was on the truck.

That is the finding the default would have hidden — see below, because the default is revenue.

## The six

**GAAP.** Two separate things, and conflating them is the trap.

- On the _face of the statements_, shipping and handling is settled and narrow. ASC 606-10-25-18B
  lets an entity elect to treat shipping/handling occurring after the customer obtains control as a
  **fulfillment activity** rather than a separate performance obligation; activities before control
  transfers are fulfillment, not a performance obligation, with no election. The SEC staff does not
  object to classifying the cost in COGS, nor to keeping a prior policy that puts it elsewhere —
  with disclosure encouraged when the amount is significant and sits outside COGS.
- On **product-line profitability**, GAAP imposes no basis at all. ASC 280 does not require an
  entity to allocate anything to a segment _unless it already allocates it in the reports the CODM
  actually uses_ — and then the disclosure must match what the CODM sees. The measure reported "need
  not include all GAAP-based costs".

  **So GAAP's rule here is a consistency rule, not a basis rule**: pick one, use it in the report
  management actually runs on, and do not keep a second one. That is exactly ADR-0029's "stated once
  rather than chosen per report", arrived at independently.

**Xero — the incumbent, and it has no allocation engine at all.** Tracking categories tag a
transaction; nothing spreads a balance across them. The documented practice is manual: split the
cost across categories with a **manual journal**, or use the line-level split on the bill, or park
it on a "Head Office / Shared" tracking option and leave it unallocated. Practitioner guides also
work around the two-category ceiling by post-processing payroll journals into further manual
journals. **CFS today therefore performs no allocation whatsoever** — which is why the delivery
question has never had to be answered, and why the migration delta is a report that does not exist
rather than a report that changes.

**SAP S/4HANA — the most configurable, and the one that names the distinction worth having.** Margin
Analysis (CO-PA) provides **top-down distribution** for precisely this case: cost posted at a
generic level (company code, customer group, product group) is pushed down to a finer profitability
segment. Freight and insurance are the documented worked example. The reference base is **actual or
planned sales** — i.e. revenue — or production/sales volume. Two mechanisms are worth stealing
regardless of basis: the distribution is its own **document**, distinct from the original posting
and reversible; and the **reference data is named on the distribution rule**, so which base produced
a number is a recorded property of the run rather than a property of whoever ran it.

**NetSuite.** Expense allocation schedules, weighted either by fixed percentages or — with the
Statistical Accounts and Dynamic Allocation features on — by the **balance of a statistical
account**, computed when the allocation journal is generated. Statistical accounts are updated by
statistical journal entry or by a saved search. Documented purpose: activity-based and usage-based
costing. **The mechanism exists specifically so the base can be a non-financial quantity** — units,
headcount, square feet, miles — rather than dollars.

**Sage Intacct.** Same tier, same shape: Dynamic Allocations pull source balances and distribute
across any standard or user-defined dimension, with the basis being either a **statistical account**
or a relative financial account balance, on a schedule and with an audit trail.

**Odoo — informative by absence.** No allocation engine. Analytic accounting tags a journal item
with an analytic distribution (percentages across analytic accounts), and **analytic distribution
models** auto-fill those percentages when a line matches a vendor / product / product-category /
account-prefix rule. That is _pre-tagging at posting time_, not allocation of a pooled balance
afterwards — the destructive direction ADR-0029 rejects. The workaround's existence measures what
the missing feature costs: you must decide the split before you know the period's numbers.

## What the survey actually decides

**The default is revenue** — SAP names sales as the reference base for freight, and it is the only
basis available out of the box without first _creating a statistic to allocate by_.

**The criterion says revenue is the weakest defensible choice**, and the two mid-market systems
agree with the criterion rather than the default: NetSuite and Sage Intacct both built a whole
statistical-account mechanism whose entire purpose is to allocate by something that is **not**
money. Nobody builds that to allocate by revenue — revenue is already a balance.

So the split is not five-against-one on the answer. It is: _everyone_ offers revenue because revenue
is always there, and _the serious ones_ offer a way to escape it because the cause-and-effect base
is usually a physical quantity you have to go and capture.

**The question that decides CFS's basis is therefore not "which basis" but "is the physical driver
captured".** It is not — measured separately, see
`inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md`.

## Two things the survey could NOT establish

- **What any of them does when the allocation base is zero.** Not documented by Sage Intacct,
  NetSuite or SAP in any public material found. It is a real population at CFS (5.7% of delivery
  revenue sits on orders with no goods line at all), so it must be _decided_ here rather than
  copied.
- **Whether the allocated result is stored or recomputed.** SAP's is a document, so it is stored;
  Xero has no result at all; the rest are ambiguous in public docs. Bears on ADR-0017's
  sealed-period guarantee and has to be settled in the reporting spec.

## Sources

- Horngren, _Cost Accounting_, ch. 14 — the four criteria and their ranking:
  https://www.vaia.com/en-us/textbooks/math/horngrens-cost-accounting-16-edition/chapter-14/problem-8-what-criteria-might-managers-use-to-guide-cost-all/
- ASC 606 shipping & handling, incl. 606-10-25-18B and the SEC staff position:
  https://www.hcvt.com/article-ASC-606 ·
  https://www.gaapdynamics.com/shipping-and-handling-new-revenue-recognition-standard-asc-606/
- ASC 280 segment measurement — allocate only what the CODM is shown:
  https://dart.deloitte.com/USDART/home/codification/presentation/asc280-10/roadmap-segment-reporting/chapter-4-disclosure-requirements/4-4-measurement-segment-disclosures
  · https://arch.bdo.com/Segment-Reporting-Under-ASC-280
- Xero tracking-category overhead workarounds:
  https://fhpaccounting.co.uk/xero-projects-and-tracking-categories/ ·
  https://jacrox.co/tracking-categories-xero/
- SAP S/4HANA top-down distribution / Universal Allocation:
  https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/top-down-distribution-in-sap-s-4hana/ba-p/13516829
  ·
  https://community.sap.com/t5/financial-management-blog-posts-by-members/introduction-to-universal-cost-allocation-in-sap-s-4hana-part-i/ba-p/13909866
- NetSuite allocation schedules weighted by statistical accounts:
  https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_3866895958.html ·
  https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N1483674.html
- Sage Intacct dynamic allocations:
  https://www.intacct.com/ia/docs/en_US/help_action/General_Ledger/Allocations/allocations-overview.htm
  ·
  https://www.sage.com/en-us/sage-business-cloud/intacct/product-capabilities/extended-capabilities/allocations/
- Odoo analytic accounting and distribution models:
  https://www.odoo.com/documentation/18.0/applications/finance/accounting/reporting/analytic_accounting.html
