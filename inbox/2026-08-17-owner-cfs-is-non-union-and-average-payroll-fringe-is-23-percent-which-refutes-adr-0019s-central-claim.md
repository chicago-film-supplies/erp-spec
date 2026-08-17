---
kind: decision
title: >-
  Owner — CFS is NON-UNION and average payroll fringe is 23%, which makes the labor cost rate
  computable today and refutes ADR-0019's "a rate variance cannot exist where there is no standard
  rate" outright
contexts: [ledger, fulfillment]
source: "Owner, 2026-08-17, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

> _"were non union our avg payroll fringe is 23%"_

Two facts, and the second closes a gap the survey had to leave open the same day.

## 1. The cost rate is computable NOW, and it is not the wage

The ADR-0019 survey found the crew is two populations with two true costs and could only say the W-2
burden was "an industry 40–50%" — a range borrowed from construction sources that bundle workers'
comp at construction rates, PTO, equipment and sometimes overhead. **23% is a payroll-fringe-only
figure and it is CFS's own.**

|   wage | W-2 cost rate (×1.23) | 1099 cost rate |
| -----: | --------------------: | -------------: |
| $30.00 |            **$36.90** |         $30.00 |
| $36.00 |            **$44.28** |         $36.00 |

⇒ The survey's recommendation — _the per-contact figure is a COST rate, distinct from the WAGE rate_
— stops being a design principle and becomes two columns somebody can fill in.

## 2. ⚠️ It REFUTES ADR-0019's central claim, and refutes it with the owner's own number

ADR-0019 says:

> A rate variance cannot exist where there is no standard rate, so `labor_variance` as specified in
> `posting-rules.yaml` would be a posting rule that can never fire (HOT-010).

**23% is an AVERAGE.** Applying one average fringe factor to every W-2 hour **is a standard rate
applied to actual hours** — the textbook definition of normal costing, which the survey already
found the spec was doing without saying so. And the difference between 23% and each person's actual
fringe is, precisely, **a rate variance**.

⇒ The premise "there is no standard rate" is false the moment a single fringe factor is used, and it
is false for the very reason the ADR exists — because CFS does not want to compute per-person fringe
per shift. **The variance is small and it is real**, which is a different disposition from "can
never fire": `labor_variance` should be a rule that fires rarely with small amounts, not one deleted
for impossibility.

⚠️ Note what did NOT change: ADR-0019 is still right that the **wage** is actual and per-person. The
standard rate is in the **fringe factor**, one level down, which is exactly where a claim of "we
have no standard rates" is easiest to make honestly and still be wrong.

## 3. Sizing — and it depends on a thing nobody has measured

`6600 Wages` is **$172,261.35** for FY2025 (`xero:2026-08-17`). Which reading applies is unknown:

| if 6600 is…                 |  bare wages |     fringe |                 fringe as a share |
| --------------------------- | ----------: | ---------: | --------------------------------: |
| **loaded** (fringe inside)  | $140,049.88 | $32,211.47 |         **18.70% of the account** |
| **bare** (fringe elsewhere) | $172,261.35 | $39,620.11 | would make true labor $211,881.46 |

⚠️ **Either way the un-absorbed remainder is material.** Absorbing at bare wage leaves roughly
**$32k–$40k** of real labor cost out of the jobs that caused it, landing in `5801` labelled
utilisation. That is not a rounding difference on a $585,593.30 gross profit.

**What settles it:** whether the payroll charge booked to 6600 includes employer taxes and comp, or
whether those sit in another account. Every payroll-liability account (2160, 2170, 2180, 2190) and
`6720 Payroll Tax Expense` are **Archived** and absent from the FY2025 P&L, which is evidence for
"loaded" and not proof of it. ⚠️ Recorded as unmeasured rather than assumed — the same discipline
that was missed on `5902` earlier today.

## 4. Non-union, and it sharpens the PSA boundary rather than blurring it

CFS's own operation is **non-union**. PSA is where union payroll appears — the client's production
crew, run through Revolution Payroll, because those clients _"wont sign entertainment union
contracts"_ or are overseas and _"dont want to set up usa busness and union deals for a few days
filming"_ (owner, 2026-08-17).

⇒ **Three populations, three fringe regimes, and only one of them is CFS's cost:**

| population          | union   | fringe         | whose cost                                     |
| ------------------- | ------- | -------------- | ---------------------------------------------- |
| CFS crew, W-2       | no      | **23%**        | CFS — absorbs                                  |
| CFS crew, 1099      | no      | none           | CFS — absorbs at the contracted rate           |
| PSA production crew | **yes** | union schedule | **the client's** — never absorbs (erp-spec#35) |

⚠️ **A single "labor fringe rate" constant would be wrong for two of the three**, and the temptation
to write one is high because 23% is now a known number. It applies to the W-2 CFS population only.

## 5. The classification follows the PAYMENT CHANNEL, and the EOR is Wrapbook

> _"when we pay an employee via zelle or ach, they are paid wage x hours and issued a 1099"_ · _"is
> blended avg across wrapbook employees"_

The split is operational rather than case-by-case: **paid direct by Zelle/ACH → 1099, wage × hours,
no fringe. Paid through Wrapbook → W-2, fringe applies.**

✅ **And that resolves what 23% means.** It is the fringe **across Wrapbook employees** — the
payroll population — not a blend with the 1099 hours. So:

| population         | cost rate       |
| ------------------ | --------------- |
| W-2 via Wrapbook   | **wage × 1.23** |
| 1099 via Zelle/ACH | **wage × 1.00** |

⚠️ **"Blended" still means AVERAGED, and that is the whole point of Finding 2.** It is one factor
standing in for many individuals' actual fringe — different comp levels, benefit elections, state
rates. That is a standard rate by construction, and the gap between 23% and any given Wrapbook
employee's actual fringe is a rate variance. **The refutation of ADR-0019's premise does not soften
now that the number is known; it sharpens.**

⚠️ Recorded because it was nearly written down wrong: before the owner clarified, "average payroll
fringe" could as easily have meant a blend across ALL crew hours, which at a 50/50 mix would imply a
true W-2 fringe of 46% and a $30/hr hour costing $43.80 rather than $36.90 — **a 19% error in the
cost rate, silent in both directions.**

## 6. Two consequences for the model

- **The person record must carry the CLASSIFICATION, because it selects the cost rate.** W-2 → wage
  × 1.23; 1099 → wage. It is the same per-contact field ADR-0019 already wants, with a discriminator
  beside it — and it is also what feeds the charter's in-scope **1099 / W-9 tracking**, which sits
  in the charter today with no connection to labor costing at all. One attribute, two consumers that
  do not know about each other.
- ⚠️ **"Employees are a role on a person" (OQ-017) may be the wrong name.** If a material share of
  crew hours are 1099, the role is **crew** with a classification attribute, not `employee`. Not
  pedantic: it decides whether a wage field means "pay this person" or "cost this person", which is
  the distinction Finding 1 turns on.

## 7. ⚠️ THREE vendors checked, THREE with zero bills — the spend may not arrive as bills at all

Measured `xero:2026-08-17:get-invoices` by contact:

| vendor                       | role                       |    ACCPAY bills |
| ---------------------------- | -------------------------- | --------------: |
| **Wrapbook**                 | the EOR — W-2 crew payroll |           **0** |
| **Revolution Payroll**       | PSA union payroll          |           **0** |
| **Chicagoland Truck Rental** | hired delivery trucks      | **1** ($429.58) |

Three of three move money outside the bill flow, so it lands as **bank transactions** — card, ACH,
direct debit.

⚠️ **That is a different shape from the one the procurement spec assumes.** `bill_received` and
`EVT-PRO-003` are built around a vendor bill as the source document, with `bill.direct_lines[]` and
`bill.reclassifications[]`. If most spend never becomes a bill, those rules cover a minority of
actual expenditure and the majority arrives through the bank feed ADR-0002 specifies — which has no
posting rules of comparable depth.

**Three vendors is a signal, not a measurement.** ⚠️ What would settle it: the FY2025 split of total
expense between ACCPAY bills and bank transactions. Recorded here rather than acted on, because
filing an issue off three data points is the mistake `5902` already made today.
