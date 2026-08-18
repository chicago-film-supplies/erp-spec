---
kind: survey
title: >-
  Rule 8a survey — a labor rate variance from per-run EOR burden pricing has no asset to revalue, so
  GAAP bounds the PERIOD rather than the job, and the real lever is the RATE not the variance account
contexts: [ledger, fulfillment]
source: >-
  Six-reference survey, 2026-08-18. GAAP / Xero / SAP S/4HANA read directly; NetSuite / Sage Intacct
  / Odoo delegated to a subagent with a quote-the-primary-source instruction. Every link is inline
  with its read date. The Xero half is measured from
  `migration/live-chart.measured.yaml` rather than from documentation.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owed by **erp-spec#38**. `ADR-0019` is accepted and says a labor variance **fires**; no posting rule
exists, no account exists, and the issue records that no event triggers one. Rule 8a requires six
references before a recommendation.

**The question.** Employer burden is priced by the EOR **per payroll RUN** while wages are itemised
per person per day, so a per-shift labor cost is part actual and part apportioned — and apportioning
a run's burden pro-rata IS a standard rate applied to actual hours. Where does the resulting rate
variance post, and is it prorated back onto the causal jobs or expensed in the period it is found?

**The evidence base** is
`inbox/2026-08-17-oq-050-answered-…-per-RUN-so-the-cost-rate-is-an-estimate.md` (run 759715: 19.85%
actual against a 23% blended plan rate, on $2,323.50 applicable wages) as corrected by **HOT-018** —
only FUTA (0.60%) and Illinois SUTA (7.05%) switch off within a season, so the within-season swing
is **7.65 points** and the floor is **12.20%**, not the 13.85/6.00 the ADR and the OQ-050 note both
state. The platform fee absorbs into COGS
(`inbox/2026-08-17-owner-the-platform-fee-absorbs-into-cogs-…`), so the rate is the **whole**
Wrapbook charge.

---

## 1. GAAP — the obvious hook does not apply, and the one that does bounds the period only

**ASC 330 has no object here.** PwC Viewpoint 1.3, read 2026-08-18:

> "Although many companies may use a standard costing approach in their operations, for financial
> reporting purposes, variances between actual costs and standard costs must be absorbed to reflect
> actual costs **in inventory**, subject to the considerations in ASC 330-10-30-3 through ASC
> 330-10-30-8."
>
> —
> <https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/inventory/Inventory-Guide/Chapter-1-Inventory-costing/1_3_Cost.html>

ASC 330-10-30-7 likewise: unallocated overheads "shall be recognized as an expense in the period in
which they are incurred" — inventory again.

⚠️ **CFS capitalizes no labor into inventory.** Crew labor is expensed against the job it served, in
the period worked. **The reason ASC 330 requires proration is to stop a standard-cost variance from
misstating a balance-sheet ASSET.** There is no such asset, so the requirement has nothing to bite
on. A survey that stopped at "GAAP says prorate variances" would import a rule written for a problem
CFS does not have.

**What governs instead is ASC 250.** The shift accrual is an estimate of a liability; the EOR
invoice resolves it. PwC Viewpoint 30.5, read 2026-08-18:

> "A change in accounting estimate results from new information or modifications to the estimating
> techniques affecting the carrying amount of assets or liabilities."
>
> "changes in accounting estimates should not be accounted for by restating or retrospectively
> adjusting the amounts reported in prior period financial statements or by reporting pro forma
> amounts. Instead, a change in accounting estimate should be accounted for in the period of change
> and prospective periods, if applicable." (ASC 250-10-45-17)
>
> —
> <https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_30_accountin_US/305_change_in_accoun_US.html>

⇒ **GAAP's answer is the period of discovery, and it forbids restating a prior period. It says
nothing about jobs, because a job is not a reporting period.** GAAP sets an outer bound; it does not
choose the mechanism inside it.

## 2. Xero — the incumbent has no mechanism at all, and that makes the delta larger, not smaller

Measured from `migration/live-chart.measured.yaml` (written by `spikes/harness/live-chart-probe.ts`
from CFS's Firestore mirror of the live chart; chart measured 2026-08-17):

- **There is no accrual liability account of any kind.** The complete live liability block is
  Accounts Payable, Gift Card Liability, the four payroll accounts below, Sales Tax, Bottled Water
  Tax, Unpaid Expense Claims, Line of Credit, Suspense, Inventory Adjustment Clearing, Historical
  Adjustment, Rounding, Tracking Transfers, Non-Current Liabilities, and the PSA block.
  `2010 - Accrued Expenses: Received Not Invoiced` is `status_live: absent` — **v2 mints it**.
- **All four payroll liability accounts are ARCHIVED**: `2160 - Payroll Wages Payable`,
  `2170 - Federal Payroll Liability`, `2180 - Other Payroll Liability`,
  `2190 - State Payroll Liability`.
- **`6720 - Payroll Tax Expense` is ARCHIVED.** ⇒ CFS stopped tracking burden components when it
  moved to the EOR model. **The books already agree with the owner's 2026-08-17 ruling** that CFS
  computes none of these components — this is that ruling visible as archived accounts rather than
  as a statement.
- Xero has no standard costing, and its job costing is two tracking categories
  (<https://www.xero.com/us/accounting-software/track-projects/job-costing/>, read 2026-08-18).

⇒ **Today the Wrapbook invoice is expensed when it arrives. No accrual ⇒ no variance ⇒ nothing to
true up.**

⚠️ **THE MIGRATION DELTA IS NOT A CLASSIFICATION DIFFERENCE — v2 CREATES THE VARIANCE.**
`shift_recorded` (Dr `5800` / Cr `2010`) introduces an accrual the incumbent has never had.
Departing from Xero here is not "we post it somewhere else"; it is "we post something Xero never
posted at all." **State the delta in those terms**, and note what would measure it: for each
Wrapbook run across the restated history, `(actual run rate − plan rate) × applicable wages`.
**Measured so far: n = 1.** Run 759715 = 19.85% vs 23% on $2,323.50 = **$73.19 over-accrued**. One
run is not a year — go and measure the rest before the ADR asserts a size.

## 3. SAP S/4HANA — ships BOTH branches and makes it a configuration flag, not a doctrine

The mechanism maps onto CFS almost exactly. An **activity type** (a crew hour) is consumed at a
**plan price** (wage + rate); at period close **actual activity price calculation (KSII)** derives
the actual price from actual cost ÷ actual quantity; then **revaluation (MFN1 / CON2)** optionally
pushes the difference back onto the receiving orders. SAP-PRESS, _Calculating Actual Price with SAP
S/4HANA_, read 2026-08-18:

> "Actual price calculation and revaluation allow you to post cost center variances to product cost
> collectors and manufacturing orders."
>
> "Orders are then revalued with the incremental debits, and the cost center receives corresponding
> credits."
>
> "As long as you've set the **Revaluation** indicator in the **Version**… and set the **Act. price
> indicator** in the activity type… revaluation automatically occurs during actual price
> calculation."
>
> — <https://blog.sap-press.com/calculating-actual-price-with-sap-s4hana>

- **Revaluation ON** → the variance returns to the jobs and the cost center balance goes to zero.
- **Revaluation OFF** → the cost center carries an **over/under-absorption** balance, settled to
  CO-PA / P&L as a period item.

⇒ **SAP's CRITERION: does the JOB's margin need to be true, or only the PERIOD's P&L?** Revaluation
buys job-level accuracy by restating already-posted job costs, and SAP makes it a per-version flag
precisely because the answer depends on what you report on.

⚠️ **This is the reference `ADR-0019` gestured at** — "SAP's confirm-at-plan, revalue-at-actual
shape" — **and it named only one of the two branches SAP ships.**

## 4. NetSuite — the residual is a clearing balance, and proration is deliberately pointed away from jobs

- Project labor posts at a rate; the offsetting side lands in the **Project Cost Variance Account**,
  a clearing account cleared by a **manual** payroll journal entry. Nothing routinely pushes it onto
  jobs.
- The **Labor Expense Allocation SuiteApp** implements exactly the arithmetic CFS needs —
  `hours × pay ÷ total hours` — but its **allowed targets are department, class, location, employee
  and custom segment. Project is not one of them.** That is the same formula pointed somewhere else
  on purpose.
- Retroactive revaluation exists in NetSuite only **against inventory** (vendor bill variances,
  standard costing).

⇒ **CRITERION: is the target a job or a reporting segment, and is the value still in an asset
account?** NetSuite treats the job as rate-costed and the pay pool as a functional-expense object,
and never lets the two meet at job granularity.

⚠️ **Not documented: what NetSuite does when the accrual OVER-states** — which is CFS's measured
direction. Oracle's NetSuite Community returned 403 and then went fully down on 2026-08-18, so the
practitioner view was unobtainable. Recorded as a gap, not inferred.

## 5. Sage Intacct — implements both answers and makes it a per-employee switch

- `Salary with variance` on the employee record → jobs are charged at the rate and the residual goes
  to a per-company **Variance account**.
- Plain `Salary` → the period total is "pro-rated to the project/tasks on which the employee
  worked", and **no variance exists at all**.
- ⚠️ **The variance entry blanks Project / Customer / Task on purpose** — verified at the `<td>`
  level in the raw HTML of Sage's own documentation page (dated 2026-08-13). The residual is
  explicitly stripped of the job dimension.
- Sage's own worked example is the **over-absorbed** direction, which is CFS's: jobs charged
  1,558.75 against a 1,450.00 actual → **DR Payroll Payable / CR Variance 108.75**. Symmetric by
  construction.

⇒ **CRITERION: which figure is authoritative for the job — the RATE or the PERIOD TOTAL?** If the
rate, a variance exists and carries no job dimension. If the period total, it is prorated by hours
and there is no variance to post.

## 6. Odoo — the two numbers never meet in the same ledger, and the absence is the finding

- Timesheet labor cost **never enters the GL**. It is an **analytic entry** only. No variance
  account, no burden object, no per-job apportionment of an employer contribution.
- Odoo's own project-profitability dashboard puts a rate estimate ("Timesheets … based on the
  employee's HR settings") next to an actual ("Purchase Orders … only appears once the vendor bill
  is posted") and **reconciles nothing**.
- Odoo's Price Difference Account is inventory-only.
- **The documented workaround**: filter Analytic Items by month and key a **manual JE** into WIP.
  One forum thread accepts that as the answer; a second asking the same question in GL terms is
  **unanswered**, with a "Any solution found?" follow-up.

⇒ **CRITERION: do the two numbers live in the same ledger?** In Odoo they do not, and a
standard-vs-actual difference posts only where a value sits in an inventory asset account.

---

## What the survey found, and it is not the default

### Finding 1 — there is no asset to revalue, and all five systems draw the line there

**Every retroactive revaluation mechanism across all five commercial systems is bound to an
inventory asset account. None will revalue a cost already sitting in the P&L.** CFS has no inventory
and no labor WIP asset, so **"prorate the variance back onto the jobs" is a re-dimensioning of an
already-expensed amount, not a revaluation** — a different operation wearing the same name.

Three independent signals that the industry draws the line in exactly that place, and none of them
is a default anyone chose to copy:

- Intacct **blanks Project / Customer / Task on the variance entry deliberately**;
- NetSuite has the proration formula and **points it at functional segments rather than projects**;
- Odoo keeps job labor analytic and financial payroll separate, with **nothing bridging them**.

This is the same conclusion GAAP reaches from the other direction — ASC 330's proration rule has no
object because there is no asset — arrived at independently through five products' mechanics.

### Finding 2 — GAAP and SAP answer different questions and do not conflict

GAAP bounds the **period** (never restate a closed one). SAP names the choice **inside** that bound
(revalue open jobs, or don't). Reading either as "the answer" gets it wrong.

### Finding 3 — ⚠️ THE VARIANCE ACCOUNT IS THE WRONG LEVER FOR CFS'S ACTUAL DEFECT

**All five systems assume the standard rate is unbiased and the variance is noise. CFS's is
neither.** The unemployment wage bases exhaust, so the true rate **declines through the season** —
7.65 points of systematic, directional drift (HOT-018's corrected figure), not random error.

A biased estimate corrected only at the back end **leaves every interim job margin wrong**, and no
surveyed product re-rates those. ⇒ **An effective-dated burden rate — re-derived from each observed
run rate — addresses the defect more directly than any variance-posting scheme.** Both Intacct and
Sage Construction Management support effective-dated rates natively.

⚠️ **And this needs NO component model, so it does not collide with the owner's 2026-08-17 ruling.**
CFS never computes FUTA, SUTA or FICA. It **observes** each run's effective rate on the Wrapbook
invoice — and that observed rate already steps down through the season, because it is the actual.
Setting period N+1's plan rate from period N's observed rate is empirical, uses the one number the
owner said CFS can see, act on and verify, and **shrinks the variance rather than perfecting the
bookkeeping of it.**

### Finding 4 — CFS's own architecture picks the layer, and the vendors do not

- **ADR-0036** — the ledger carries keys, not classifications; product line is derived at report
  time.
- **ADR-0029** (proposed) — the ledger records un-allocated facts; allocation is a specified
  reporting act.

⇒ Re-rating `5800` to make job margins true is **the wrong layer under decisions already taken**.
The ledger should record the difference as its own fact **carrying `causal_orders` keys**, and let
the reporting layer allocate it. One branch, no restatement, GAAP-clean, consistent with an accepted
ADR and a proposed one, and it matches where four of the five products put the residual.

## Two defects in erp-spec#38's own framing, found on the way

1. ⚠️ **#38 and OQ-045 are the same seam from two sides, and neither names the other.** OQ-045 asks
   "when a vendor bills LESS than was accrued, what retires the residual left in `2010`?" **The
   residual in `2010` after `vendor_bill_received` relieves the accrual IS the labor variance.** One
   quantity, two ids, no cross-reference. Whatever is decided must answer both or explicitly narrow
   one.
2. ⚠️ **#38 states "there is no EVENT to trigger it." There is.** The Wrapbook invoice is a vendor
   bill; `vendor_bill_received` already exists and already relieves `2010`. The variance is
   discovered at exactly that moment, and **a period-close event does not need inventing.** That
   claim appears to have been read off ADR-0019's "period-close true-up" phrasing rather than
   checked against the rule set — the repo's own footgun, one more time. **It removes the structural
   objection that sent this to a GitHub issue instead of `unwritten:`**, since `unwritten:`'s four
   buckets are keyed by event and this event exists.

## The recommendation this survey supports

**A new narrow ADR that `relates_to` ADR-0019 and supersedes nothing** — ADR-0025 is the precedent,
and `CLAUDE.md`'s ADR-0034 table is explicit that "stands, but left a question open" takes this path
rather than a supersession. ADR-0019's decision holds: costing is normal costing, the variance
fires, a true-up is owed. What it left open is the mechanism, and it named only one of SAP's two
branches.

The shape, in three parts, and the third is the one no reference volunteered:

1. **Do not revalue.** There is no asset to revalue, GAAP forbids restating a closed period, and
   ADR-0036/0029 put allocation at report time.
2. **Post the difference as its own fact, keyed to the causal orders**, so the reporting layer can
   allocate it. That needs one account — `5190 - COGS: Labor Variance` was deleted on a premise
   OQ-050 has since refuted, and restoring it is the minimal move. It stays in COGS (`Direct Costs`)
   because it is a cost of labor that served jobs, merely no longer attributable to one.
3. **Fix the estimate, not the disposal.** Re-derive the plan burden rate from each observed run
   rate. This is the part that actually removes the seasonal bias, and it is the part every surveyed
   product would have left broken.

## ⚠️ What is NOT verified

Recorded rather than smoothed over, because a survey that reports only its successes hides what it
could not reach:

- **NetSuite's treatment of an over-stated accrual — NOT DOCUMENTED.** Oracle Community was 403 and
  then down on 2026-08-18. **This is CFS's measured direction**, so it is the most consequential gap
  here.
- **NetSuite void-and-repost as the retroactive route — LOW confidence.** Asserted only by search
  summaries; the primary page was never retrieved. Do not cite it.
- **Whether Intacct can revalue already-posted labor at a corrected rate — NOT DOCUMENTED.** Only
  prospective effective-dated rates were found. Finding 3 rests on the prospective form, which _is_
  documented; it does not need the retroactive one.
- **The Intacct 9xxx / "Manpower Cost" separate-books pattern — MEDIUM-HIGH.** A single partner
  source (RKL, 2021), not in Sage's own documentation.
- **Odoo payroll analytic precedence — MEDIUM**; the cited forum thread returned only navigation
  chrome. **Whether Odoo stamps timesheet cost at creation or recomputes on rate change — NOT
  CHECKED.**
- **The migration delta is measured at n = 1.** $73.19 on one run.

## One aside, relevant to a different decision

NetSuite's documentation states that journal entries created from posting time are "stamped with the
date and time they're posted, not the date and time of the original time transaction entry" — i.e.
**it collapses accounting date into posting timestamp** for this transaction type. That is precisely
what `ADR-0010` and repo rule 8 forbid, and it is worth knowing that a major ERP does it, because
"every system keeps them distinct" is the kind of claim that would otherwise go unchallenged. Not a
reason to change ADR-0010 — a data point for whoever next argues about it, and for SPIKE-003.
