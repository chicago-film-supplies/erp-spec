---
kind: survey
title: >-
  Survey — ADR-0019's "actual vs standard" is a false binary and the answer is NORMAL costing; the
  crew is TWO populations with two true costs so the absorption rate cannot be one number; GAAP
  splits idle time normal from abnormal where 5801 has one bucket; and 5200 is both dormant and not
  a CFS labor account
contexts: [ledger, fulfillment]
source: "GAAP idle-time normal/abnormal + ASC 330 · Xero incumbent measured xero:2026-08-17:get-report-profit-and-loss · SAP S/4HANA activity price revaluation at actual · NetSuite job costing · Sage Intacct labor cost posting · Odoo timesheet hourly cost + analytic · Owner, 2026-08-17, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed per CLAUDE.md → _Accounting decisions_, because **ADR-0019 cites no survey and never has**.
It has been `proposed` since 2026-08-09 governing **$172,261.35** of wages — eight times ADR-0030's
vehicles — and rule 8a has required a survey of it since the day it was drafted.

⚠️ **It was found by asking the question systematically rather than by noticing.** After ADR-0030
turned out to be blocked by a missing survey, every proposed ADR was checked: **seven of ten cite
none**, and four of those are accounting-shaped. This is the largest.

## The question, stated precisely — four decisions

| #      | question                                                                               |
| ------ | -------------------------------------------------------------------------------------- |
| **D1** | Is labor costed at **actual** or at a **standard rate** — and is that the real choice? |
| **D2** | What rate does a crew hour absorb at, given the crew is not one population?            |
| **D3** | Where do **guaranteed-but-unworked** hours go?                                         |
| **D4** | Does **PSA** labor absorb into CFS COGS?                                               |

## The six

|                  | how a labor hour reaches a job                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**         | No rule on rate policy. It rules on **idle time**, and it splits it: **normal** idle time is part of product cost — absorbed through the direct-labor rate or through overhead — while **abnormal** idle time is a **period expense**, never capitalized (the ASC 330 treatment of abnormal amounts). The distinction is by CAUSE, not by whether a rate happened to absorb it.                                                                                                                               |
| **Xero**         | **The incumbent, and it does none of this.** Measured `xero:2026-08-17`: `6600 Wages` is a single undimensioned operating expense of **$172,261.35** for FY2025, below gross profit, with no job attribution of any kind. Every payroll-liability account — 2160, 2170, 2180, 2190 — and `6720 Payroll Tax Expense` are **Archived**. Xero Projects tracks time and, per the earlier owner-shift survey, is not integrated into the P&L.                                                                      |
| **SAP S/4HANA**  | **Does BOTH, in sequence, and that is the finding.** Activities confirm to the order at a **plan price** during the period; at close, **revaluation at actual prices** debits or credits the cost object with the difference, and cost-center under/over-absorption is pushed to the receivers. Plan-rate and actual are **phases**, not alternatives.                                                                                                                                                        |
| **NetSuite**     | Time entered against a project is costed from the **employee's labor cost** field and posted on approval. A per-person cost attribute, applied to actual hours.                                                                                                                                                                                                                                                                                                                                               |
| **Sage Intacct** | **States the criterion, and it is not about rate policy.** _"If payroll captures labor cost by employee, project and task, you may be able to post ACTUAL labor cost against projects… For many customers where payroll is posted at a SUMMARY level, labor costing multiplies hours by a COST RATE. These are ESTIMATED labor costs; actual labor cost comes from Payroll."_ It also computes a cost rate for salaried people as `Salary / 2080`, and drives the rate from an **earning type per employee**. |
| **Odoo**         | A **cost per hour on the employee record**, overridable per project, multiplied by timesheet hours into an **analytic** account. ⚠️ Informative by absence again: those entries _"do not have exact counterparts in the general accounts"_ — the labor cost reaches management reporting and **not the ledger** unless you build the bridge.                                                                                                                                                                  |

## Where they agree — and it is not where ADR-0019 looks

⚠️ **"Actual vs standard" is a FALSE BINARY.** The textbook third option is **normal costing** —
actual direct costs, _applied_ overhead — and every reference here lands on a variant of it. Nobody
costs a job at fully-actual: SAP applies a plan rate and trues up, Intacct and NetSuite and Odoo
apply a **per-person cost rate** to actual hours.

⇒ **The criterion is not "does CFS have a standard rate". It is: at what granularity does payroll
reconcile?** Intacct says it outright. A per-person rate × actual hours is _estimated_ labor cost
whenever payroll posts in aggregate, however precise the rate looks.

✅ **And the spec is ALREADY normal-costing without saying so.** ADR-0030 applies vehicle cost at a
rate over actual labor hours. That is the definition. ADR-0019 describes the model as "actual" and
the model is not.

## Findings

**F1 — ADR-0019's own supporting argument fails on both halves, and it is measurable.** The Context
says labor is _"already recorded today, in two places with two treatments: own wages at 6600,
subcontractors already in COGS at 5200"_, and the Consequences call moving own-crew cost _"a move,
not an invention"_ beside _"the existing 5200"_.

- ⚠️ **5200 is not a CFS labor account.** Owner, 2026-08-16: _"our wages are not subcontractors… a
  subcontractor is we hired another company to perform work for a customer… dont conflate the 2
  labor related accounts."_ Already corrected on the chart entry; ADR-0019 still carries it twice.
- ⚠️ **5200 is also DORMANT.** Measured `xero:2026-08-17`: FY2025 Cost of Sales is 5500 ($1,380.92),
  5000 ($36,796.26), 5300 ($3,793.09) and 5100 ($19,202.94). **5200 does not appear — zero
  activity.** So "the absorption target already half exists" rests on an account that is neither the
  right kind nor currently used.

**F2 — the crew is TWO populations with two true costs, so the absorption rate cannot be one
number.** Owner, 2026-08-17: CFS's own crew is **a mix of W-2 through an EOR and 1099 contractors**.
A 1099 hour costs the contracted rate; a W-2 hour costs the wage **plus employer taxes, workers'
comp and the EOR's fee** — the industry range for that burden is **40–50% above bare wage**.

⇒ ADR-0019 absorbs at _"that person's actual rate"_ from a wage carried per contact. **A wage is not
a cost.** Absorbing both populations at their wage is exact for the 1099 half and understates the
W-2 half by its entire burden — and the shortfall lands in `5801 Unabsorbed`, **mislabelled as
utilisation**. That is structurally the same defect ADR-0030 records for `5901`, except there it was
a consequence of choosing a rate and here it is a consequence of choosing the wrong field.

✅ **The fix is small and the mechanism already exists.** The per-contact figure must be a **COST
rate**, distinct from the **WAGE rate**, exactly as Intacct drives cost from an earning type per
employee rather than from pay. Two fields, because they are two facts — and the wage still has to
exist for the pay side the charter leaves with the EOR.

**F3 — GAAP splits idle time and 5801 has one bucket.** Normal idle time is part of product cost;
abnormal idle time is a period expense. ADR-0019 puts **all** guaranteed-but-unworked hours into
`5801`, undimensioned, carrying `causal_orders: null`.

⚠️ **So a crew that was guaranteed 8 and worked 6 has the 2-hour remainder stripped off the job that
caused it.** That is normal idle time by every definition here, and the job it belongs to is known.
Only the case where no job existed at all is genuinely attributable to nothing. **One account is
being asked to mean two things**, and the two have different GAAP treatments.

**F4 — the utilisation claim is true but narrower than stated.** _"The gap between them is
utilisation, not rate deviation"_ holds **only if** the rate is a true cost rate (F2) **and** normal
idle time is not being swept in (F3). With either defect present, 5801 is utilisation plus burden
plus normal idle time, and the utilisation number cannot be read off it.

**F5 — ⚠️ PSA is a THIRD labor population and the spec does not model it at all.** PSA = production
service agreement: a client hands CFS a budget, CFS produces their project and carries their **union
payroll** through Revolution Payroll. Owner, 2026-08-17 — DePaul, and overseas productions that will
not stand up a US entity and union deals for a few days of filming.

Measured: **five GL accounts** — `2800 PSA Liability Clearing`, `2801 PSA: DePaul`,
`2802 PSA:
Yellow Flower`, `2803 PSA: TPS - Beauty In Black S1`, `4130 PSA Income` ($13,202.34
FY2025) — and **zero presence anywhere else in the spec**: no requirement, no event, no posting
rule, no bounded context, no glossary term, and no mention in the charter's scope OR its non-goals.

- ⚠️ **PSA labor must never absorb into CFS COGS.** It is a pass-through funded by the client's
  budget, not a cost CFS bears. ADR-0019 never says so, and a reader implementing "labor absorbs
  against the causal job" would sweep it in.
- ⚠️ **It sits against the charter's payroll non-goal** — _"CFS… does not calculate withholding,
  file payroll tax, or move payroll money"_ — which is true of CFS's own crew and **not** of PSA,
  where moving payroll money on a client's behalf is the service being sold. The charter names
  neither the distinction nor the exception.
- The chart already flagged the operational smell without a decision behind it: _"2801–2803 mint one
  GL account per PSA client, so the chart grows with the customer list."_
- **Owner ruling 2026-08-17: PSA is IN SCOPE for v2 and needs specifying.**

## Recommendation

1. **D1 — say `normal costing`, and stop calling it actual.** Actual hours at a per-person cost
   rate, with overhead applied. It is what the spec already does and naming it correctly is what
   lets SAP's phase model (plan rate, revalue at close) be considered rather than accidentally
   excluded.
2. **D2 — the per-contact figure is a COST rate, separate from the WAGE rate.** Burdened for W-2,
   contracted for 1099. Without it, 5801 silently absorbs the employer burden of half the crew.
3. **D3 — split normal from abnormal idle time.** Guaranteed hours on a day the crew worked a job
   belong to that job; only hours attributable to no job at all belong in `5801`.
4. **D4 — PSA labor is explicitly excluded from absorption**, and PSA gets specified as its own
   thing (a GitHub issue, per the owner's ruling).

⚠️ **What this survey does NOT settle:** whether the EOR's charge reconciles per-person, which
decides whether the W-2 cost rate can be actual or must be estimated and trued up. Intacct's
criterion makes that the hinge, and it is a question for the EOR rather than for the books.
