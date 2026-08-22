---
id: ADR-0041
headline: the labor variance posts as a keyed fact
title: >-
  The labor rate variance posts as its own fact keyed to causal orders, and the plan burden rate is
  re-derived from each observed run
status: proposed
date: 2026-08-22
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [ADR-0019, ADR-0029, ADR-0031, ADR-0036, HOT-010, HOT-016, HOT-018, OQ-045, OQ-050]
accounting_shaped: true
survey:
  - inbox/2026-08-18-survey-the-labor-variance-has-no-asset-to-revalue-so-the-lever-is-the-rate-not-the-variance-account.md
measurements:
  - id: M1
    value: "7.65 points of wage, leaving a 12.20% floor"
    of: >-
      The WITHIN-SEASON swing in the employer burden rate — the components that actually exhaust
      inside one season, which are FUTA (0.60%) and Illinois SUTA (7.05%) only. ⚠️ **This is the
      figure the true-up is sized from, and it must come from here rather than from ADR-0019's
      body**, which states 13.85 points and a 6.00% floor. Both of the ADR's figures require Social
      Security to cap mid-season; it caps at the federal taxable maximum, ~6,150 hours at $30/hr.
      ⚠️ `OQ-050` stated a third figure, ~4.51%, omitting both Social Security and the platform fee.
    source: "inbox/2026-08-17-adr-0019s-burden-cap-arithmetic-treats-social-security-as-capping-mid-season-and-it-does-not.md"
asserts:
  - id: D1
    kind: decision
    claim: >-
      The variance is NOT prorated back onto the jobs and nothing already posted is revalued. It
      posts once, in the period the bill resolves the accrual, as its own fact.
  - id: D2
    kind: decision
    claim: >-
      The variance transfer carries the causal orders of the run it arose from, so the reporting
      layer can allocate it. The ledger records it un-allocated (ADR-0029) and performs no
      apportionment of its own.
  - id: D3
    kind: decision
    claim: >-
      `5190 - Cost of Goods Sold: Labor Variance` is restored. It stays in Direct Costs because it
      is a cost of labor that served jobs, merely no longer attributable to one of them.
  - id: D4
    kind: decision
    claim: >-
      The plan burden rate is re-derived from each observed run rate, effective-dated forward. This
      is the part that removes the seasonal bias; the variance account only disposes of what is
      left.
  - id: P1
    kind: premise
    claim: >-
      There is no asset to revalue. CFS capitalizes no labor into inventory — crew labor is expensed
      against the job it served, in the period worked — so ASC 330's requirement to absorb variances
      into inventory has nothing to bite on. What governs is ASC 250-10-45-17: a change in estimate
      is accounted for in the period of change, and prior periods are NOT restated.
    source: "inbox/2026-08-18-survey-the-labor-variance-has-no-asset-to-revalue-so-the-lever-is-the-rate-not-the-variance-account.md"
  - id: P2
    kind: premise
    claim: >-
      The estimate is BIASED, not noisy. The unemployment wage bases exhaust, so the true burden rate
      declines through the season — systematic directional drift, not random error. All five surveyed
      systems assume an unbiased standard rate and none re-rates interim job margins.
    source: "inbox/2026-08-18-survey-the-labor-variance-has-no-asset-to-revalue-so-the-lever-is-the-rate-not-the-variance-account.md"
  - id: P3
    kind: premise
    claim: >-
      No new event is needed for the variance to be discovered. `vendor_bill_received` already fires
      on the EOR's invoice and already relieves 2010; the variance is the residual at exactly that
      moment. ⚠️ erp-spec#38's "there is no EVENT to trigger it" was read off ADR-0019's
      "period-close true-up" phrasing rather than checked against the rule set.
    source: "code:2026-08-22:erp-spec@a3b9b59:ledger/posting-rules.yaml"
  - id: P4
    kind: premise
    claim: >-
      CFS computes no payroll tax components and should not model any. Payroll processing for its own
      crew is a charter non-goal; CFS's cost is the Wrapbook invoice, and what it can see, act on and
      verify is ONE number per run — the effective rate — plus the fact that it declines within a
      season.
    source: "inbox/2026-08-17-owner-cfs-tracks-no-payroll-tax-components-so-the-burden-defect-is-about-someone-elses-ledger.md"
supersedes:
superseded_by:
---

> **In the context of** an employer of record that itemises wages per person per day but prices
> employer burden per payroll RUN, **facing** an accrual made at a plan rate that is systematically
> wrong rather than merely imprecise, **we decided** to post the resulting difference once, as its
> own fact keyed to the causal orders, and to re-derive the plan rate from each observed run, **to
> achieve** a shrinking variance rather than a well-bookkept one, **accepting** that a job's margin
> is provisional until the run that paid for it is billed.

## Context

`ADR-0019` is accepted and frozen. It says a labor variance **fires** and that the apportionment
owes a period-close true-up. **It names no account, no event and no mechanism**, and it named only
one of SAP's two branches — which is the "stands, but left a question open" case, so this is a new
narrow ADR that supersedes nothing (ADR-0034; ADR-0025 is the precedent).

- **Wages are actual and attributable; burden is not.** The EOR itemises wages per person per day,
  and prices burden per payroll RUN. So a per-shift labor cost is part actual and part apportioned —
  **and apportioning a run's burden pro-rata IS a standard rate applied to actual hours.** That is
  what makes a variance exist at all, and it is what `HOT-010` denied on the then-correct premise
  that costing was at actual and no standard rate existed.
- ⚠️ **The estimate is biased, and that is the whole difficulty** (P2). The unemployment wage bases
  exhaust, so the true rate declines through the season. A flat plan rate over-states late-season
  hours and under-states early ones, **with nothing in the numbers looking wrong.**
- ⚠️ **Size it from HOT-018, never from ADR-0019's body.** The within-season swing is **7.65 points
  of wage, floor 12.20%** (M1) — FUTA and Illinois SUTA are the only components that exhaust inside
  a season. ADR-0019 states 13.85 points and a 6.00% floor; both figures require Social Security to
  cap mid-season and it does not. **A true-up built to the frozen figure would be scaled to roughly
  twice the real dispersion.** Every individual number in ADR-0019's sentence is correct and the
  sentence ties arithmetically, which is why it survived acceptance, a six-reference survey,
  HOT-016's correction of the same bullet, and twenty gates.
- ⚠️ **CFS computes none of those components and this ADR models none of them** (P4). The spec
  records what the EOR charged and that the charge drifts within a season. **A component breakdown
  of a number you do not compute is a claim you cannot check.**

### GAAP's obvious hook does not apply, and the one that does bounds only the period

**ASC 330 has no object here** (P1). Its requirement to absorb standard-cost variances exists to
stop them misstating a balance-sheet **asset**, and CFS capitalizes no labor into inventory. ⚠️ **A
survey that stopped at "GAAP says prorate variances" would have imported a rule written for a
problem CFS does not have.**

What governs instead is **ASC 250**: the shift accrual is an estimate, the EOR invoice resolves it,
and 250-10-45-17 says a change in estimate is accounted for **in the period of change** and that
prior periods are **not** restated. ⇒ **GAAP sets an outer bound and does not choose the mechanism
inside it. It says nothing about jobs, because a job is not a reporting period.**

### The vendors ship both branches, and CFS's own decisions pick one

Three of five surveyed systems post the variance, two have no allocation engine at all, and SAP,
NetSuite and Sage Intacct each ship **both** the prorate-back and the leave-it-in-the-period
branches as a configuration flag rather than a doctrine. **The vendors do not pick; CFS's already-
taken decisions do:**

- **ADR-0036** — the ledger carries keys, not classifications.
- **ADR-0029** — the ledger records un-allocated facts; allocation is a specified reporting act.

⇒ **Re-rating 5800 to make job margins true is the wrong layer under decisions already taken.**

## Decision

**1. Do not revalue** (D1). Nothing already posted moves. There is no asset to revalue, GAAP forbids
restating a closed period, and the allocation layer is the reporting layer.

**2. Post the difference as its own fact, keyed to the causal orders** (D2). One transfer, carrying
the `causal_orders` of every job the run served — **un-allocated, exactly as ADR-0029 requires** —
and the reporting layer allocates it on ADR-0031's basis. ⭐ **The variance is not apportioned in
the posting rule**, which keeps the `amount:`-is-a-path fence intact and stops a rate from being
quantized inside a posting rule.

**3. Restore `5190 - Cost of Goods Sold: Labor Variance`** (D3). It was deleted when HOT-010 killed
the rate variance — correct on the premise ADR-0019 then held, and refuted by OQ-050's measurement.
It stays in Direct Costs: this is a cost of labor that served jobs, merely no longer attributable to
one of them.

**4. Re-derive the plan burden rate from each observed run rate**, effective-dated forward (D4).

⭐ **This is the part no reference volunteered and the part that actually fixes the defect.** All
five surveyed systems assume the standard rate is unbiased and treat the variance as noise; CFS's is
neither. A biased estimate corrected only at the back end **leaves every interim job margin wrong,
and no surveyed product re-rates those.** Setting period N+1's plan rate from period N's observed
rate is empirical, needs **no component model** — so it does not collide with the owner's 2026-08-17
ruling (P4) — and **shrinks the variance rather than perfecting the bookkeeping of it.** Both Sage
Intacct and Sage Construction Management support effective-dated rates natively.

### ⚠️ What this ADR deliberately does NOT decide

**The general over-accrual write-back stays with `OQ-045`.** The survey found that #38 and OQ-045
are one seam from two sides — the residual left in `2010` after `vendor_bill_received` relieves the
accrual **is** the labor variance — so this ADR must either answer both or narrow explicitly. **It
narrows.**

- **In scope:** the EOR/labor case, where the difference is a **rate estimate error**, the run is
  fully billed, and no further bill is coming.
- **Out of scope:** every other unclearable `2010` residual — a vendor who under-bills, a partial
  delivery never completed, a disputed line. Those need OQ-045's fourth procurement event and its
  own survey, and inventing one here would be machinery for branches nothing takes.
- ⚠️ **The distinction is real and not a dodge**: a labor variance is a **known** quantity
  discovered by a bill that resolves the obligation completely, where OQ-045's case is an
  **unknown** — nobody can say whether another bill is coming. **One is arithmetic; the other is a
  judgement about a vendor relationship**, which is why OQ-045 says it must be a decision and not a
  default.

## Considered options

- **Prorate the variance back onto the causal jobs.** _SAP's and Intacct's first branch._ Rejected
  on P1 and on ADR-0029: there is no asset whose carrying amount depends on getting it right, GAAP
  requires the period rather than the job, and allocating in the ledger is the layer ADR-0029
  forbids. ⚠️ **The temptation is real** — it is the answer that makes job margins true — and D4 is
  what addresses that want without the restatement.
- **Re-rate the absorbed cost — revalue 5800 against the actual.** Rejected: it restates COGS after
  the fact, in periods that may be closed and hashed (ADR-0017), and ASC 250-10-45-17 forbids it for
  a change in estimate.
- **Let it fall into the unabsorbed wages account.** Rejected explicitly, because it is the tempting
  answer. ADR-0019 defines unabsorbed as hours attributable to **no job at all**, and burden
  dispersion is not idle time — the hours were worked on real jobs and the rate was wrong. ⚠️ **The
  account named in erp-spec#38 for this option no longer exists**: ADR-0038 deleted `5801` on
  2026-08-17, so the option is now doubly refused.
- **Post the difference as its own keyed fact and fix the rate going forward** (chosen).

## Consequences

- **A job's margin is provisional until the run that paid for it is billed**, and that should be
  said out loud rather than discovered. D4 shrinks the provisional window's size; it does not close
  it. The reporting layer must be able to show a product-line P&L both before and after the run is
  billed without the two being confused for each other.
- ⚠️ **`vendor_bill_received`'s control total has to change, and the precedent is exact.**
  `control_total: bill.amount_minor` makes the OVER-accrual case **unrepresentable** — where the
  bill is less than the accrual, the entry posts the accrued amount, not the billed one, and the
  arithmetic simply does not close. This is verbatim the problem `vehicle_cost_absorbed` solved with
  `run.entry_total_minor`, whose own invariant records the reasoning: _"Using `pool_minor` as the
  control total would have made the over-absorbed case unrepresentable."_ ⇒ the bill states
  `entry_total_minor` alongside `amount_minor`, and the two disagreeing is the signal, not an error.
- ⚠️ **BOTH DIRECTIONS ARE WRITTEN, and the over direction is CFS's measured one.** Run 759715 came
  in at an actual rate BELOW the blended plan rate, so the accrual over-stated. **A rule that only
  works when the numbers go one way is a hole** — `vehicle_cost_absorbed` needed the same explicit
  treatment for the same reason, and its `a-period-that-over-absorbs-credits-5901` vector exists
  precisely so the branch is not a claim nobody exercised.
- **The variance legs carry `causal_orders` where the reclassification legs carry `null`, and that
  asymmetry is load-bearing.** A reclassification moves a liability between two liability accounts
  and therefore **cannot** re-key a cost to a different job. A variance leg touches an expense
  account and is a new fact about cost, so it both can and must carry its keys — otherwise the
  reporting layer has nothing to allocate it by, and D2 is empty.
- ⚠️ **Nothing yet re-derives the rate, and D4 is the half most likely to be quietly dropped.**
  D1–D3 produce an account, a rule and vectors that a gate can check; D4 produces a **procedure**,
  and this repo's own rule is that a stated guarantee nothing executes is not a guarantee. It needs
  an owner, a cadence and somewhere the observed rate per run is recorded — filed as deferred work
  rather than asserted here.
- **The migration delta is measured at n = 1** — $73.19 on one run. That is enough to establish the
  direction and the mechanism, and **not** enough to size the account. ⚠️ Do not quote it as a
  magnitude.
- ⚠️ **The most consequential gap in the survey is on CFS's own direction.** NetSuite's treatment of
  an OVER-stated accrual is **not documented** — Oracle Community was 403 and then down on
  2026-08-18. Four of five references support the shape chosen here; the fifth is unread on exactly
  the branch CFS takes most.
