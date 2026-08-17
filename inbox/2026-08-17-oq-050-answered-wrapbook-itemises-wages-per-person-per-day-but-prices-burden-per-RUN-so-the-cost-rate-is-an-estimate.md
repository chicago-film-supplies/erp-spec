---
kind: finding
title: >-
  OQ-050 ANSWERED — Wrapbook itemises WAGES per person per day but prices BURDEN per payroll RUN, so
  a per-shift labor cost is necessarily apportioned; the burden is also capped per person per year,
  which makes a flat factor systematically wrong rather than randomly wrong
contexts: [ledger, fulfillment]
source: "Owner-supplied Wrapbook exports, payroll 759715, 2026-08-17 — Payroll Register + Invoice Fee Summary"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

⚠️ **Source handling.** The exports carry names, home addresses and masked SSNs for five people.
**None of that is recorded here or anywhere in this repo.** What follows is the FIELD STRUCTURE, the
run-level aggregates and the statutory rate table — a schema and a set of totals, not personal data.

## The answer, and it is neither branch OQ-050 posed

OQ-050 asked whether the EOR reconciles **per person** (⇒ cost is an actual) or **in aggregate** (⇒
cost is an estimate). **It does both, on different halves of the same payroll**, and that is why the
question could not be answered by guessing which one it would be.

| half                             | granularity                                                                 | consequence                              |
| -------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| **Wages** — Payroll Register     | **per person, per day, per project**, with hours AND dollars                | actual, and attributable                 |
| **Burden** — Invoice Fee Summary | **per RUN**, one applicable-wages base with an effective rate per component | **must be apportioned to reach a shift** |

⇒ **A per-shift labor cost is necessarily part actual and part apportioned.** Apportioning a run's
burden pro-rata by wages IS a standard rate applied to actual hours. **ADR-0019's "a rate variance
cannot exist where there is no standard rate" is therefore WRONG** — and this time it is measured
rather than argued.

## Run 759715, measured

|                             | applicable wages |       rate |         fee |
| --------------------------- | ---------------: | ---------: | ----------: |
| Employer FICA               |        $2,323.50 |      6.20% |     $144.06 |
| Employer Medicare           |        $2,323.50 |      1.45% |      $33.69 |
| Federal Unemployment        |        $2,323.50 |      0.60% |      $13.95 |
| Illinois State Unemployment |        $2,323.50 |      7.05% |     $163.81 |
| Workers compensation — IL   |        $2,323.50 |      3.06% |      $71.09 |
| **Platform fees**           |        $2,323.50 |      1.49% |      $34.63 |
| **total**                   |                  | **19.85%** | **$461.23** |

**Wages $2,323.50 + fees $461.23 = CFS's cost $2,784.73.** Statutory burden alone is **18.36%**; the
platform fee is **1.49%**.

⚠️ **19.85% against the 23% blended average — this run is 3.15 points BELOW it.** The average is
real and so is the dispersion; one run is not the year.

## ⚠️ The burden is CAPPED per person per year, so a flat factor is SYSTEMATICALLY wrong

Three of the six components stop applying once an individual crosses an annual wage base:

| component                   |      rate | cap              | at $30/hr, crossed at ≈ |
| --------------------------- | --------: | ---------------- | ----------------------: |
| Federal Unemployment        |     0.60% | ~$7,000/yr       |                ~233 hrs |
| Illinois State Unemployment | **7.05%** | ~$13,600/yr      |                ~453 hrs |
| Employer FICA               |     6.20% | the SS wage base |               far later |
| Medicare + workers comp     | **4.51%** | uncapped         |                       — |

⇒ **The same person's true burden falls through the year**, from ~18.4% down toward a ~4.5%
statutory floor plus FICA. A crew member working regularly crosses the SUTA cap inside a season, and
SUTA is the single largest component at 7.05%.

**So a flat annual factor does not produce a random error, it produces a BIASED one** — over-stating
late-year hours and under-stating early-year hours, systematically, for anyone who works enough to
cross a cap. That is materially worse than a random variance, because it moves the reported margin
of early-season jobs against late-season ones and nothing in the numbers looks wrong.

## What the register gives, and the one thing it does not

Fields present per person: `Total Hours Worked (Hours)` and `(Dollars)`, `Total Days Worked`,
`First Date Worked` / `Last Date Worked`, `Worker Type`, `Job Title & Union / Local`, `Department`,
`Project`, `Payroll ID`, `Check Date`, plus a long tail of union/production premiums (stunt, night,
meal penalty, per diem, kit fee, wardrobe) all at zero here.

- ✅ **`Job Title & Union / Local` reads `Production Staff / Non-Union`** — confirms the owner's
  non-union statement in the data.
- ✅ **`Worker Type: Employee`**, and the fee summary carries **`Contractor Wages` and
  `Loan-Out
  Wages` lines at $0.00**. ⚠️ So Wrapbook CAN run contractors and loan-outs. **"Payment
  channel determines classification" is therefore not quite the rule** — a 1099 could be paid
  through Wrapbook too, and the discriminator is `Worker Type` on the record, not the rail the money
  took.
- ⚠️ **`Project` is `CFS2` — the company, not a job.** So the register says who worked, when, and
  for how long, and **NOT which order those hours served**. The causal job has to come from CFS's
  own shift records.

⇒ **The division of authority is clean and worth stating**: Wrapbook owns _who, when, how many
hours, how much paid_; CFS owns _which job those hours served_. ADR-0019 already assumes the second
half; what it gets wrong is assuming CFS also owns the first.

## Consequences for ADR-0019

1. **The wage side is ACTUAL and per-person** — the ADR is right about that, and the register is the
   authority rather than CFS's own wage table.
2. **The burden side is APPORTIONED** — a standard rate by construction, so `labor_variance` fires,
   and the ADR's central premise fails on measurement.
3. **The apportionment needs a true-up**, because the flat factor is biased by the caps, not merely
   imprecise. This is exactly SAP's shape — confirm at a plan rate during the period, revalue at
   actual at close — which the survey found and the ADR does not consider.
4. ⚠️ **The platform fee (1.49%) is a separable question.** Statutory burden is a cost of employing
   the person; a payroll platform's fee is a cost of _outsourcing payroll_. Whether it absorbs into
   COGS with the wages or sits in administrative expense is a real classification choice this note
   does not settle.
