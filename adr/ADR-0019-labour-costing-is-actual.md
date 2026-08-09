---
id: ADR-0019
title: Labour costing is actual; absorption measures utilisation, not rate variance
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [HOT-003, HOT-004, HOT-010, OQ-005, OQ-006, OQ-008, OQ-011, OQ-017, OQ-018, OQ-019]
supersedes:
superseded_by:
---

> **In the context of** bringing crew cost into COGS against the job that caused it, **facing** a
> business that pays actual per-person wages rather than standard rates, **we decided** to cost
> labour at actual and let absorption measure utilisation, **to achieve** a variance that reflects
> something real, **accepting** that the charter's "standard-cost absorption" wording no longer
> describes the model.

## Context

- CFS does not use standard labour rates. The default wage is **$30/hr with a guaranteed 8 hours**;
  **1.5x after 8** in a day; **1.5x all day on a 6th and/or 7th consecutive day**. One person is at
  $36/hr. The wage is carried per contact and is overridable.
- Scheduling a contact adds them to the labour calendar, and cost flows from the **purchase order /
  bill that scheduling generates** — so the actual figure exists as a matchable document.
- Labour cost is already recorded today, in two places with two treatments: own wages at **COA 6600
  Wages Expense** in operating expenses, subcontractors already in COGS at **COA 5200**.
- A rate variance cannot exist where there is no standard rate, so `labour_variance` as specified in
  `posting-rules.yaml` would be a posting rule that can never fire (HOT-010).

## Decision

**Labour is costed at actual**, from the per-contact wage and the overtime rule above.

**Absorption survives, and measures utilisation.** A guaranteed 8 hours means paid-but-unworked time
is a real cost attributable to no job, so both accounts stand:

- `COGS-Labour Absorbed` — hours actually worked on a job, at that person's actual rate, dimensioned
- `COGS-Unabsorbed Labour` — guaranteed-but-unworked hours and idle time, undimensioned

The gap between them is **utilisation**, not rate deviation. `labour_variance` as a *rate* variance
is dropped.

## Consequences

- **The charter's "standard-cost absorption into COGS" wording is wrong** and needs amending;
  `posting-rules.yaml`'s `labour_variance` rule is replaced by the absorbed/unabsorbed split above.
  That is HOT-010, resolved here.
- **The absorption target already half exists.** Own-crew cost moves from 6600 into a dimensioned
  COGS account beside the existing 5200 — a move, not an invention (HOT-003).
- **No byproduct-loss premium.** A long-haul run absorbs the actual person-day; the premium the
  customer pays is margin. Absorbing it would book a cost never incurred (HOT-004, OQ-006).
- **Trucking is labour-bearing** and generates a shift, so it absorbs a person-day (OQ-010).
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
