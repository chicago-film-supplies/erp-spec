---
kind: survey
title: >-
  Survey — four of six references leave labor with no cost object in the natural expense account and
  only SAP can push it into product cost; GAAP abstains and asks for a stated policy instead; the
  asymmetry ADR-0038 defends between 5801 and 5901 is CONFIRMED by SAP's own mechanism; and the
  reporting machinery cannot carry a cost with no causal order into a product line at all
contexts: [ledger, fulfillment]
source: "SEC Reg S-X 210.5-03(b)(2)(c) via PwC Viewpoint · ASC 330-10-30-3 normal capacity / abnormal idle via PwC Viewpoint 1.4 · Xero incumbent measured xero:2026-08-17:get-report-profit-and-loss and api:2026-08-09:db_chart_of_accounts_query · SAP S/4HANA cost-center activity confirmation, revaluation at actual and settlement · NetSuite job costing project expense types + project cost variance account, docs.oracle.com · Sage Intacct earning types billable/non-billable GL accounts, intacct.com help · Odoo analytic timesheets, odoo.com documentation · accountingformanagement.org on idle time as indirect labor"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed per CLAUDE.md → _Accounting decisions_, because **ADR-0038 cites no survey** and gate 19
now fails an accounting-shaped ADR that reaches `accepted` without one.

⚠️ **The 2026-08-17 labor survey does NOT cover this question, and it looks as though it might.**
Its D3 asked what belongs _inside_ `5801` and answered "split normal from abnormal idle time"; it
assumed the account exists. ADR-0038 asks the prior question — **whether a paid day no order caused
belongs in a cost-of-revenue account at all.** Citing the earlier survey here would have been the
cheap answer and the wrong one.

## The question, stated precisely — three decisions

| #      | question                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Is labor that **no order caused** a cost of revenue, or an operating expense?                                                      |
| **D2** | Does the answer hold for **capacity-sustaining** work — warehouse cleanup, fleet maintenance — or only for idle and training time? |
| **D3** | Does `5901` — the vehicle **rate residual** — follow `5801` out of COGS, or is the asymmetry real?                                 |

## The six

|                  | where labor with no cost object lands                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**         | **Abstains, and that is the finding.** Reg S-X 5-03(b)(2) names five cost captions and the one CFS reports under is **(c) "expenses applicable to rental income"**. The rule does not define applicability, and it explicitly PERMITS merchandisers to fold **occupancy and buying costs** into the cost caption — so the caption was never limited to strictly traceable cost. ASC 330's normal/abnormal idle machinery governs what is **capitalized into inventory**, and CFS capitalizes no labor into anything. ⇒ **a presentation policy, stated and applied consistently.** |
| **Xero**         | **The incumbent, and it already does what ADR-0038 proposes.** `6600 Wages` is a single operating expense of **$172,261.35** FY2025 (`xero:2026-08-17`), below gross profit, no job attribution. ADR-0019 moves the causal part into COGS; ADR-0038 leaves the rest exactly where the live books have always had it.                                                                                                                                                                                                                                                               |
| **SAP S/4HANA**  | **The one that can push it into product cost — and only through a PRODUCTION cost center.** Factory payroll posts to a production cost center as a primary cost; confirmed activity allocates onto orders as a secondary posting; the residual is cost-center under/over-absorption, which is either **revalued at actual prices onto the receivers** or settled per a settlement rule. A cost center that serves no production settles to a period cost element.                                                                                                                  |
| **NetSuite**     | **Only allocated labor leaves the natural account.** "Job costing uses a project expense type to determine the account to debit when posting time transactions", and "when time is posted, NetSuite creates a journal entry that debits the assigned account and **credits your project cost variance account**". The default expense types split **Regular → direct labor** and **Overhead → indirect labor**; time with no project sits as **unallocated payroll** on the allocation page and stays where payroll put it.                                                        |
| **Sage Intacct** | **Makes the split at the SOURCE, by the nature of the time.** Setting up an earning type requires you to "enter the GL accounts to which to post **billable time and non-billable time**" — with the option to "select the same GL account for both". So the discriminator is a property of the hour, decided when it is recorded, not a residual computed at close.                                                                                                                                                                                                               |
| **Odoo**         | **Labor starts in the expense account and only chargeable work leaves it.** Payroll debits a labour expense account; as chargeable work is performed that same account is **credited** with a debit to WIP, and WIP relieves to COGS at invoicing. Nothing draws the non-chargeable remainder out.                                                                                                                                                                                                                                                                                 |

**The practitioner dissent, and it is worth stating rather than burying.** Standard cost-accounting
texts treat idle time of direct labor as **indirect labor → manufacturing overhead**, i.e. product
cost, not period expense, on the reasoning that a workforce must be kept available. Taken literally
that is an argument for keeping a no-order day in COGS.

⚠️ **Its scope is what defeats it here.** The convention exists to decide what gets **absorbed into
inventory**. CFS has no inventoriable production: rental assets are fixed assets (ADR-0007,
ADR-0026), retail stock is bought and resold, and no labor hour is capitalized into either. With
nothing to absorb into, "treat it as overhead" has no destination but a P&L caption — which returns
the question to GAAP, which abstains.

## Where they agree — and it is not the default

Four of the six leave it in the natural expense account, but counting defaults is the weaker read.
**The criterion every one of them implements is the same: does the cost attach to a COST OBJECT that
revenue flows through?**

- NetSuite's cost object is the project; without one, the time is "unallocated payroll".
- Odoo's is the analytic account behind chargeable work; without one, nothing credits the expense.
- Intacct's is the project a billable hour names.
- SAP's is the **cost center**, and this is the case that sharpens the criterion rather than
  breaking it: a production cost center's residual stays production cost because **the cost center
  itself serves production**. Under-absorption there is a costing imprecision, not an absence of
  causation.

⇒ **"Did an order cause it" and "is there a cost object" are the same test in this spec**, because
`shift_recorded` writes an allocation row per causal job and nothing else creates one.

## Findings

**F1 — ADR-0038's central distinction survives the survey, which is the unusual outcome here.** It
argues `5801` goes and `5901` stays because one is an absence of causation and the other an
imprecision in a rate. **SAP implements exactly that distinction in its own mechanism**, and
NetSuite's project cost variance account is the same shape. Most surveys in this repo have reversed
something; this one confirms.

**F2 — ⚠️ THE REPORTING MACHINERY CANNOT CARRY A NO-CAUSAL-ORDER COST INTO A PRODUCT LINE, and that
is a structural argument the ADR does not make.** Since ADR-0036, `labor_line` is read off the
shift's **absorbed allocation row** (OQ-042), and an allocation row exists only where a causal job
does. A warehouse-cleanup day with no order therefore has no `labor_line` **and cannot reach any
pool in `reporting/product-line-pl.yaml`** — including the `warehouse` and `counter` `cost_only`
pools OQ-046 created. Put that cost in COGS and it sits there unallocated permanently, which is
precisely the shape ADR-0029 exists to prevent. **The decision is forced by machinery that is
already accepted**, not only by preference.

**F3 — the population sentence sweeps together two things the references treat differently, and the
ADR should name which it means.** _"Training days, warehouse cleanup or maintenance projects… and
any paid day no order caused"_ contains (a) time that serves nothing in particular — training,
meetings, administrative work — and (b) **capacity-sustaining work on the very assets rental revenue
is drawn from.** Every reference here would call (b) an indirect cost of the revenue-producing
capacity if it had a cost object to attach it to. F2 is why it does not, so the outcome is the same
— but the reason differs, and an ADR that gives one reason for both invites the next reader to
re-open (b).

**F4 — ⚠️ two mutable artifacts already disagree about the population.** `6600 - Wages`'s chart note
says the account retains _"only wages attributable to no job — administrative and office time"_;
ADR-0038 says training, warehouse cleanup and maintenance projects as well. The note predates the
ADR and describes the ADR-0019 world where idle time went to `5801`. **The sweep at acceptance must
rewrite it**, or the chart and the ADR will assert different populations for the same account.

**F5 — the migration delta is ZERO for this population, which no other decision in this repo can
say.** ADR-0020 restates dimensions, ADR-0030 breaks gross-margin comparability, ADR-0032 restates
identity. Here the incumbent already holds every dollar in `6600` and ADR-0038 leaves it there. ⚠️
**Zero delta is not zero unknown**: nothing splits `6600` into crew and administrative wages, so the
SIZE of what stays is unmeasured — the same measurement gap that leaves the post-cutover gross
margin bounded only between 61% and 90.5% (OQ-050).

## Recommendation

1. **D1 — accept: labor with no cost object is operating expense and stays in `6600 - Wages`.** Four
   of six references implement it, GAAP permits it as a stated policy, the incumbent already does
   it, and F2 makes the alternative unreportable rather than merely unconventional.
2. **D2 — give the capacity-sustaining half its own sentence.** Warehouse cleanup and fleet
   maintenance are not "time that serves nothing"; they are indirect costs of the capacity, and they
   land in opex because **no mechanism can route them to a product line**, not because they are
   unrelated to revenue. Saying so is what stops the question being re-opened every time someone
   reads the chart.
3. **D3 — `5901` does not follow, and the reason is now cited rather than asserted.** A rate
   residual on a fleet that serves revenue is a costing imprecision; SAP treats it the same way
   through a production cost center's under-absorption.
4. **Rewrite `6600`'s chart note in the same change as acceptance** (F4), and state the narrowed
   meaning on the account itself — a live account whose meaning changes without its name changing is
   invisible in a diff.

⚠️ **What this survey does NOT settle:** how big the surviving `6600` population is. That needs
`6600` split into crew and administrative wages in the live books, or a shift corpus that does not
exist yet, and it is the same measurement OQ-050 wants for a different reason.
