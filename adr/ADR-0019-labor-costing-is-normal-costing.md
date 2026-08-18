---
id: ADR-0019
title: Labor costing is NORMAL costing — wages actual per person, burden apportioned per run — and absorption measures utilisation together with rate variance
status: accepted
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [
  ADR-0026,
  ADR-0029,
  ADR-0030,
  HOT-003,
  HOT-004,
  HOT-010,
  OQ-005,
  OQ-006,
  OQ-008,
  OQ-011,
  OQ-017,
  OQ-018,
  OQ-019,
  OQ-050,
]
accounting_shaped: true
survey:
  - inbox/2026-08-17-survey-labor-costing-is-normal-costing-not-actual-the-crew-is-two-populations-with-two-true-costs-and-idle-time-splits-normal-from-abnormal.md
supersedes:
superseded_by:
frozen_sha256: b37f2e39a639782a0b8164f64ba4eb941a6b53959cddeadc63a715ea6ea8a9cf
---

> **In the context of** bringing crew cost into COGS against the job that caused it, **facing** an
> employer of record that itemises wages per person and per day but prices employer burden per
> payroll RUN, **we decided** to cost labor as **normal costing** — wages actual, burden apportioned
> — **to achieve** a per-shift cost that reconciles to the invoice CFS actually pays, **accepting**
> a rate variance that is systematic rather than random and owes a period-close true-up.
>
> ⚠️ **This summary read "we decided to cost labor at actual and let absorption measure utilisation"
> until 2026-08-17**, when the Wrapbook exports measured otherwise (OQ-050, HOT-016). The title said
> the same and both were left behind by an amendment that corrected only the body.

## Context

- CFS does not use standard labor rates. The default wage is **$30/hr with a guaranteed 8 hours**;
  **1.5x after 8** in a day; **1.5x all day on a 6th and/or 7th consecutive day**. One person is at
  $36/hr. The wage is carried per contact and is overridable.
- Scheduling a contact adds them to the labor calendar, and cost flows from the **purchase order /
  bill that scheduling generates** — so the actual figure exists as a matchable document.
- Labor cost is recorded today at **COA 6600 Wages Expense**, a single undimensioned operating
  expense — **$172,261.35 for FY2025**, measured `xero:2026-08-17:get-report-profit-and-loss`, with
  no job attribution of any kind. Every payroll-liability account (2160, 2170, 2180, 2190) and
  `6720 Payroll Tax Expense` are **Archived**.
- ⚠️ **This bullet used to add "subcontractors already in COGS at COA 5200", and BOTH halves of that
  are wrong.** **5200 is not a CFS labor account** — owner, 2026-08-16: _"our wages are not
  subcontractors… a subcontractor is we hired another company to perform work for a customer… dont
  conflate the 2 labor related accounts."_ And **5200 is DORMANT**: FY2025 cost of sales is 5500,
  5000, 5300 and 5100 only, so it carried **zero activity**. The Consequences below leaned on it
  twice as "the existing 5200"; that support is withdrawn.
- ⚠️ **The crew is TWO POPULATIONS with two true costs.** Owner, 2026-08-17: CFS's own crew is **a
  mix of W-2 through an EOR and 1099 contractors**. A 1099 hour costs the contracted rate; a W-2
  hour costs the wage plus employer taxes, workers' comp and the EOR's fee — an industry burden of
  **23%** — owner, 2026-08-17, CFS being **non-union**, blended across **Wrapbook** employees (the
  EOR). ⚠️ **The classification follows the PAYMENT CHANNEL**: paid direct by Zelle/ACH → 1099, wage
  × hours, no fringe; paid through Wrapbook → W-2, fringe applies. A wage is not a cost:

  |   wage | W-2 cost rate (×1.23) | 1099 cost rate |
  | -----: | --------------------: | -------------: |
  | $30.00 |            **$36.90** |         $30.00 |
  | $36.00 |            **$44.28** |         $36.00 |

  ⚠️ **Sized, and material either way.** If `6600`'s $172,261.35 is loaded, fringe is $32,211.47 —
  **18.70% of the account**; if it is bare, true labor is $211,881.46 and fringe is $39,620.11.
  Absorbing at bare wage leaves **$32k–$40k** of real labor cost out of the jobs that caused it,
  against a $585,593.30 gross profit. Which reading applies is **unmeasured**: the archived payroll
  accounts are evidence for "loaded", not proof.
- ⚠️ **A THIRD labor population exists and this ADR never mentions it: PSA.** A production service
  agreement hands CFS a client's budget to produce their project, carrying their **union payroll**
  (owner, 2026-08-17). It is a pass-through, not a CFS cost, and it has five GL accounts and no
  other presence in the spec at all — **erp-spec#35**.
- **Surveyed 2026-08-17**, per CLAUDE.md → _Accounting decisions_ — GAAP, Xero, SAP S/4HANA,
  NetSuite, Sage Intacct, Odoo:
  `inbox/2026-08-17-survey-labor-costing-is-normal-costing-not-actual-the-crew-is-two-populations-with-two-true-costs-and-idle-time-splits-normal-from-abnormal.md`.
  ⚠️ **This ADR carried no survey from 2026-08-09 until then**, governing eight times the money
  ADR-0030 does. It was found by checking every proposed ADR after ADR-0030 turned out to be blocked
  the same way — **seven of ten cite none**.
- ⚠️ **This bullet used to read "a rate variance cannot exist where there is no standard rate, so
  `labor_variance` … would be a posting rule that can never fire". MEASURED 2026-08-17, IT IS
  WRONG** — OQ-050, against Wrapbook payroll 759715. **The EOR does both, on different halves of the
  same payroll.** Wages are itemised **per person, per day, per project**, with hours and dollars —
  actual and attributable. **Burden is priced per RUN**: one applicable-wages base with an effective
  rate per component. So reaching a per-shift cost requires **apportionment**, and pro-rata
  apportionment IS a standard rate over actual hours. Run 759715: wages
  **$2,323.50** + fees **$461.23** = CFS's cost **$2,784.73**, an effective
  **19.85%** — statutory 18.36% plus a 1.49% platform fee, and **3.15 points below** the 23% blended
  average.
  ⚠️ **And the burden is CAPPED per person per year, so a flat factor is SYSTEMATICALLY wrong rather
  than imprecise.** FUTA (0.60%) stops at ~$7,000 and Illinois SUTA — **7.05%, the largest
  component** — at ~$13,600, about 233 and 453 hours at $30/hr, leaving a **6.00%** uncapped floor
  of Medicare, workers comp and the platform fee. A regular crew member crosses both inside a
  season, so a flat rate **over-states late-year hours and under-states early-year ones**, biasing
  early-season job margins against late-season ones with nothing in the numbers looking wrong. ⇒
  `labor_variance` **fires**, and the apportionment owes a **period-close true-up** — SAP's
  confirm-at-plan, revalue-at-actual shape. HOT-010 resolves here on that reasoning, not on
  impossibility. ✅ **The absorbed rate is the WHOLE Wrapbook charge — 19.85%, not the 18.36%
  statutory part.** Owner, 2026-08-17: the platform fee _"absorb[s] into cogs"_, which _"our cost is
  just the payment to wrapbook"_ had already implied. It is not severable in the source document and
  it varies one-for-one with labor volume. ⚠️ It is also **uncapped**, so the floor a person's
  burden decays toward is exactly **6.00%** against **13.85 points that switch off** mid-season. ⚠️
  **The fee follows the RAIL, not the classification** — the fee summary carries a
  `Contractor
  Wages` line, so a 1099 paid through Wrapbook incurs it and one paid direct by
  Zelle/ACH does not. Two people doing identical work can cost differently because of how they were
  paid: true under actual costing, and an argument for **one blended rate** rather than per-rail
  precision.

## Decision

**The model is NORMAL COSTING, not actual costing**, and naming it correctly is the first amendment.
Actual hours at a **per-person cost rate**, with overhead applied — which is what every reference
does, and what the spec already does, since ADR-0030 applies vehicle cost at a rate over these same
hours. ⚠️ "Actual vs standard" was a false binary: nobody costs a job fully-actual, SAP applies a
plan price and **revalues to actual at close**, and Intacct's criterion is not rate policy at all
but **at what granularity payroll reconciles**.

⚠️ **The costing input is the EOR's CHARGE, not CFS's wage table — and this ADR reasons from the
wrong source.** ✅ Confirmed 2026-08-17: the register carries hours and dollars per person, and
`Project` reads **`CFS2` — the company, not a job**, so **Wrapbook owns _who, when, how long, how
much paid_ and CFS owns _which job those hours served_.** This ADR assumes the second half correctly
and wrongly assumes CFS owns the first. It costs a shift at _"that person's actual rate"_ from a
wage _"carried per contact and overridable"_. Under a true EOR the **wage** is what CFS agreed the
worker receives (a scheduling fact) and the **cost** is what Wrapbook charges (an invoice fact).
Those can diverge, and only the second belongs in COGS — structurally the same defect as leaning on
`5200`: reasoning from a source that is not the authority for the number needed.

**The per-contact figure is a COST rate, and it is NOT the wage rate.** Two fields, because they are
two facts: burdened for W-2, contracted for 1099, while the wage still exists for the pay side the
charter leaves with the EOR. Absorbing both populations at their wage is exact for one half and
understates the other by its entire burden.

⚠️ **Three populations, three fringe regimes, and only two are CFS's cost** — a single "labor fringe
rate" constant would be wrong for two of the three, and 23% being a known number makes writing one
tempting:

| population                     | union   | fringe                               | whose cost                           |
| ------------------------------ | ------- | ------------------------------------ | ------------------------------------ |
| CFS crew, W-2 via **Wrapbook** | no      | **23%** blended across its employees | CFS — absorbs at wage × 1.23         |
| CFS crew, 1099 via Zelle/ACH   | no      | none                                 | CFS — absorbs at the contracted rate |
| PSA production crew            | **yes** | union schedule                       | **the client's** — never absorbs     |

**PSA labor never absorbs.** It carries no `labor_line`, enters no product-line pool, and reaches no
COGS account — it is a client's money passing through a liability, not a cost CFS bears
(erp-spec#35).

**Absorption survives, and measures utilisation.** A guaranteed 8 hours means paid-but-unworked time
is a real cost attributable to no job, so both accounts stand:

- `COGS-Labor Absorbed` (5800) — hours worked on a job, at that person's **cost** rate, plus the
  **normal** idle time of a day that served a job;
- `COGS-Unabsorbed Labor` (5801) — hours attributable to **no job at all**.

⚠️ **The boundary moved, and GAAP is why.** Idle time splits **normal** from **abnormal**: normal
idle time is part of product cost, abnormal idle time is a period expense. A crew guaranteed 8 hours
that worked 6 on one job produces 2 hours of NORMAL idle time **belonging to that job** — stripping
it into 5801 understates the job that caused it. Only a guaranteed day that served nothing is
attributable to nothing.

The gap between them is **utilisation**, not rate deviation — ⚠️ **but only if the rate is a true
cost rate and normal idle time is not swept in.** With either defect present 5801 is utilisation
plus employer burden plus normal idle time, and no utilisation number can be read off it.
`labor_variance` as a _rate_ variance is dropped.

## Consequences

- **The charter's "standard-cost absorption into COGS" wording is wrong** and needs amending;
  `posting-rules.yaml`'s `labor_variance` rule is replaced by the absorbed/unabsorbed split above.
  That is HOT-010, resolved here.
- **Own-crew cost moves from 6600 into a COGS account.** ⚠️ This consequence read "the absorption
  target already half exists… beside the existing 5200 — a move, not an invention". **Both supports
  failed** (see Context): 5200 is not a CFS labor account and carried zero FY2025 activity. It is an
  invention, and calling it a move made it look cheaper than it is. HOT-003 still resolves here.
- **No byproduct-loss premium.** A long-haul run absorbs the actual person-day; the premium the
  customer pays is margin. Absorbing it would book a cost never incurred (HOT-004, OQ-006).
- **Trucking is labor-bearing** and generates a shift, so it absorbs a person-day (OQ-010).
- **Shifts are per person** (OQ-005), which is what makes a per-contact actual rate usable at all —
  a crew-level shift could not carry two people on different rates.
- **Employees are a role on a person**, not a separate record (OQ-017). The wage attaches to the
  employee role, which is also what keeps it off a customer-facing contact record.
- **Two allocation rules are still unwritten** and this ADR does not settle them: which job absorbs
  the overtime premium when a shift spans several (OQ-018), and what "consecutive day" means and
  whether it compounds with the after-8 rule (OQ-019).
- **Purchase orders become a first-class concept**, and are not in the charter's in-scope list. The
  second use case is inventory acquisition — retail stock, and fixed assets for rental or internal
  ops.

## What the owner is being asked

Four rulings. The recommendation on each is the survey's, and a bare "yes" accepts the ADR as
amended.

1. **Call the model `normal costing`, not actual.** ⇒ **Rec: yes.** It is what the spec already does
   — ADR-0030 applies vehicle cost at a rate over these hours — and naming it correctly is what lets
   SAP's plan-then-revalue shape be considered rather than accidentally excluded.
2. **The per-contact figure is a COST rate, distinct from the WAGE rate** — burdened for W-2,
   contracted for 1099. ⇒ **Rec: yes.** Without it, the employer burden of half the crew lands in
   5801 disguised as utilisation.
3. **Normal idle time belongs to the job; only hours attributable to no job at all reach 5801.** ⇒
   **Rec: yes**, on GAAP's own normal/abnormal split.
4. **PSA labor never absorbs** — no `labor_line`, no pool, no COGS account. ⇒ **Rec: yes**
   (erp-spec#35 specifies PSA itself).

⚠️ **Not asked, because it is not the owner's to answer from the books: OQ-050**, whether the EOR
reconciles per person. It decides whether the W-2 cost rate is an actual or an estimate needing a
period-close true-up, and the answer is in the EOR's remittance report rather than in the ledger.
Both paths build differently, which is why it is worth settling before the stage exists.
