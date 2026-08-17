---
kind: correction
title: >-
  Correction — Wrapbook is a TRUE EOR, so CFS's cost is the invoice and the 23% is Wrapbook's
  pricing rather than a CFS burden; the same-day claim that this "refutes ADR-0019's central claim"
  was OVERSTATED and is now conditional on OQ-050
contexts: [ledger, fulfillment]
source: "Owner, 2026-08-17, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

> _"our cost is just the payment to wrapbook, theyre an eor the frings are theirs not mine"_

Written the same day as
`inbox/2026-08-17-owner-cfs-is-non-union-and-average-payroll-fringe-is-23-percent-which-refutes-adr-0019s-central-claim.md`,
which is append-only and stands as written. **This note is the correction index for it.**

## What was wrong

That note framed 23% as a **burden CFS incurs on top of a wage** — employer taxes and workers' comp
that CFS bears and must add to reach true cost. **It is not.** Wrapbook is the employer of record:
the fringes are **Wrapbook's own costs**, priced into what it charges. CFS has no employer-tax
liability for those people at all.

⚠️ **The arithmetic is unchanged and the meaning is not.** A W-2 hour still costs CFS about wage ×
1.23 — but as **a vendor's price**, not as a wage plus a burden CFS owes. The distinction decides
where the number comes from, and therefore whether it is an actual or an estimate.

## What that does to the "refutation"

The earlier note asserted that 23% being a blended average **refutes** ADR-0019's claim that _"a
rate variance cannot exist where there is no standard rate"_. ⚠️ **That was asserted as settled and
it is conditional.** It holds only under one of two readings, and the owner's correction is what
makes the other reading live:

| if Wrapbook's charge is…                                                        | CFS's cost per shift                                                                | ADR-0019's claim                                                                     |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **itemised per person** (and per day/production, as EOR invoices typically are) | an **ACTUAL** — the amount Wrapbook charged for that person                         | ⇒ **CORRECT.** No standard rate, no variance, `labor_variance` genuinely cannot fire |
| **aggregate per payroll run**                                                   | an **ESTIMATE** — CFS must apportion, and 23% is the factor it would apportion with | ⇒ **wrong**, and a small rate variance exists by construction                        |

⇒ **The refutation is withdrawn as an assertion and restated as conditional on OQ-050.** OQ-050 was
already open on exactly this granularity question; it stops being a secondary detail and becomes
**the whole decision**.

⚠️ **This is the third time in one session that a number was reasoned from before what it MEANT was
checked** — `5902`'s population, the ambiguity in "average payroll fringe", and now this. The first
two were caught by measuring and by asking. This one was caught by the owner. **Knowing a figure is
not knowing what it is a figure OF.**

## The modelling consequence, which is larger than the correction

ADR-0019 costs a shift from **CFS's own per-contact wage table** — _"at that person's actual rate"_,
a wage _"carried per contact and overridable"_. Under a true EOR the authority is elsewhere:

- the **wage** is what CFS agreed the worker receives — a scheduling and agreement fact;
- the **cost** is what Wrapbook charges — an invoice fact, on a document CFS receives.

**Those can diverge**, and only the second belongs in COGS. ⚠️ So ADR-0019 reasons from a source
that is not the authority for the number it needs — structurally the same defect as it leaning on
`5200`, which turned out to be neither a CFS labor account nor in use.

⇒ The per-contact figure ADR-0019 wants is real and is **not** the costing input. The costing input
is the EOR's charge, attributed to shifts by whatever granularity that charge carries.

## What is unaffected

- **The 1099 population is untouched.** Paid direct by Zelle/ACH at wage × hours, no intermediary,
  no fringe — the wage IS the cost, and it is actual by construction.
- **PSA remains a pass-through** and still never absorbs (erp-spec#35).
- **The normal/abnormal idle-time finding stands** — it is about which hours belong to a job, not
  about what an hour costs.
- **"Normal costing, not actual" stands**, and for a reason this correction strengthens: whatever
  the labor input turns out to be, ADR-0030 applies vehicle cost at a rate over these hours, so the
  model is normal costing regardless.
