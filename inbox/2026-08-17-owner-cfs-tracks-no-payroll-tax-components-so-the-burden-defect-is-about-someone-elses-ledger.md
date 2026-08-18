---
kind: correction
title: >-
  Owner — CFS runs no payroll and tracks no FUTA, SUTA or FICA; it uses an EOR and pays 1099
  subcontractors and loan-outs, so the burden components are WRAPBOOK'S ledger and the spec should
  never have reasoned in them — what CFS observes is one effective rate on an invoice
contexts: [ledger, fulfillment]
source: "Owner, 2026-08-17, in session · charter.md non-goal (payroll processing for CFS's OWN crew) · IRS Topic 751 for the rates and the 2026 taxable maximum"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-17, on the HOT-018 arithmetic: _"we dont run payroll direct, we dont track futa or
suta or any of that we use eors, pay subcontractors and loanouts (1099) why would we track that
stuff?"_ — then: _"i guess good for the app to have arithmetic if we ever change"_.

## The ruling, and it narrows HOT-018 rather than closing it

**CFS tracks none of these components and is not going to.** `charter.md` already says so as a
non-goal — payroll processing for CFS's OWN crew is out, an external employer of record stays, and
CFS _"does not calculate withholding, file payroll tax, or move payroll money"_. The three
populations are an EOR's W-2 crew, 1099 subcontractors, and loan-outs; **in none of them does CFS
compute a payroll tax.**

⇒ **FUTA, SUTA, FICA, workers comp and the platform fee are WRAPBOOK'S cost structure, not CFS's
chart of accounts.** ADR-0019 already reaches this conclusion in its own voice — _"our cost is just
the payment to wrapbook"_, and the absorbed rate is the whole charge — and then reasons in the
components anyway.

## What this changes about HOT-018

**The defect stands and its SUBJECT moves.** It is not an arithmetic error in something CFS
calculates; it is an error in an estimate of **how much the rate CFS is charged drifts across a
season**, and that drift is caused by caps in a ledger CFS does not keep.

- CFS observes **one number**: the effective rate on a Wrapbook run — 19.85% on run 759715.
- That number is **not constant across the year**, because two components inside it stop as a person
  crosses their wage bases. That is why a flat factor is systematically wrong and why the
  apportionment owes a true-up. **All of that survives.**
- What was wrong is the SIZE: ADR-0019 says 13.85 points switch off and 6.00% remains. Only FUTA and
  SUTA stop within a season — **7.65 points** — because Social Security stops at the federal taxable
  maximum, **$184,500 for 2026, with the employer rate at 6.2% and Medicare uncapped**
  (`https://www.irs.gov/taxtopics/tc751`, read 2026-08-17). At $30/hr that is **6,150 hours**,
  against 233 for FUTA and 453 for IL SUTA. **The floor is 12.20%.**

## ⚠️ The root cause is not a missing column. It is reasoning inside someone else's ledger

This defect was first written up as "a typed `BurdenComponent[]` with a `cap_base` column would have
made it unrepresentable" — an argument for typing. **On the owner's ruling that inverts.** The type
that would have caught it is a type **this spec should not have**, because the components are not
CFS's to model. A spec carrying `BurdenComponent[]` would be modelling Wrapbook's payroll engine as
a side effect of wanting a rate.

⇒ **The right structure is much smaller and CFS already has it**: an observed effective rate per
run, with its source document, plus the knowledge that it declines within a season. One measurement,
one provenance, one caveat — not six components with wage bases.

⇒ **And the honest lesson is the opposite of the one first recorded**: the ADR did not fail for want
of a schema. It failed by reasoning two layers down into a vendor's cost structure when the only
number CFS can see, act on, or verify is the one on the invoice. **A component breakdown of a number
you do not compute is a claim you cannot check** — which is the same shape as this repo's own rule
that a fact about a third party needs one owner and something that executes against it.

## What is kept, deliberately

Owner: _"good for the app to have arithmetic if we ever change"_. So the cap structure stays
**recorded as evidence, here, in the append-only tier** — not promoted into `ledger/` or into a
requirement, and not given a type. If the charter's payroll non-goal is ever revisited that is an
ADR, and this note is the arithmetic it starts from:

| component             |  rate | wage base            | hours at $30/hr |
| --------------------- | ----: | -------------------- | --------------: |
| Social Security       | 6.20% | $184,500 (2026, IRS) |       **6,150** |
| Medicare              | 1.45% | none (IRS)           |               — |
| FUTA                  | 0.60% | ~$7,000              |             233 |
| Illinois SUTA         | 7.05% | ~$13,600             |             453 |
| workers compensation  | 3.06% | none                 |               — |
| Wrapbook platform fee | 1.49% | none (ADR-0019)      |               — |

⚠️ The FUTA and Illinois SUTA bases are ADR-0019's figures and are **not pinned here** — no source
was read for them in this session. The federal ones are. Anyone who revisits the non-goal should pin
all four to a year before using them.
