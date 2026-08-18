---
id: ADR-0038
headline: no causal order means not COGS
title: Labor with no causal order is not COGS — 5801 is not created and 6600 Wages narrows instead
status: proposed
date: 2026-08-17
review_by: 2026-12-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [ADR-0019, ADR-0025, ADR-0029, ADR-0030]
supersedes:
supersedes_on_acceptance:
superseded_by:
---

> **In the context of** but-for attribution putting a guaranteed day onto the order that caused the
> hire, **facing** the consequence that labor no order caused has no revenue it is applicable to,
> **we decided** that such labor is operating expense and stays in `6600 - Wages` rather than
> reaching a COGS account, **to achieve** a cost-of-revenue line that contains only costs of
> revenue, **accepting** that ADR-0019's `5801` is not created and that a superficially identical
> vehicle account deliberately does not follow.

## Context

- ADR-0019 adopted **but-for causation** (owner, 2026-08-17): _"if not for the order the person
  would not be hired"_, so a guaranteed day is borne by the order that caused the hire.
- It also minted `5801 - Cost of Goods Sold: Wages (Unabsorbed)` for _"hours attributable to no job
  at all"_ — **a COGS account for cost with no revenue behind it.**
- Owner, 2026-08-17: _"we will pay people for training days, or warehouse cleanup or maintenance
  projects etc… those should be opex though … labor without a causal order in this paradigm is not
  cogs."_
- **COGS is costs applicable to revenues.** Where no order caused the hire, there is no revenue the
  cost is applicable to. ⚠️ The two positions cannot both hold, and ADR-0019 holds both.
- `6600 - Wages` is `disposition: adopt` and `status_live: Active` — **it was never being retired.**

## Decision

**Labor no causal order produced is operating expense, and it stays in `6600 - Wages`.**

**`5801` is not created.** ADR-0019 minted it; nothing will post to it, so it is removed from the
chart rather than left as an account with no reachable path.

**`6600 - Wages` NARROWS rather than emptying.** ADR-0019 says own-crew cost moves from 6600 into
COGS; under but-for **only the causal part moves**. What 6600 keeps is exactly the named population:
training days, warehouse cleanup, maintenance projects — and any paid day no order caused.

⚠️ **`5901 - Cost of Goods Sold: Vehicle (Unabsorbed)` DOES NOT FOLLOW, and the distinction is the
substance of this decision** (owner, 2026-08-17):

| account | what it holds                            | why                                                                   |
| ------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `5801`  | a **day no order caused**                | no revenue behind it at all ⇒ **not** a cost of revenue               |
| `5901`  | the **residual of a predetermined RATE** | under-recovery on a fleet that **does** serve revenue ⇒ stays in COGS |

They look like a matched pair and are different in kind. One is an absence of causation; the other
is an imprecision in a rate.

## Consequences

- **The absorbed/unabsorbed pair stops being symmetric across labor and vehicles**, deliberately.
  Anyone reading the chart will see `5900/5901` and expect `5800/5801`; the chart must say why the
  second half is absent, or the asymmetry reads as an omission.
- ⚠️ **ADR-0019's own text becomes partly historical the moment this is accepted.** It is frozen and
  correct as a record (ADR-0034); it describes an account that will not exist. This ADR **supersedes
  nothing** — ADR-0019's decision (normal costing, but-for, absorbed versus unabsorbed) stands
  entirely. What changes is the CLASSIFICATION of the unabsorbed side, which ADR-0019 asserted as a
  consequence rather than decided. ADR-0025 is the precedent for a narrow ADR that relates and
  supersedes nothing.
- **The utilisation question moves further from the ledger, and that is now unambiguous.** With no
  5801, the 5800-versus-something gap does not exist at all. _"What is the guarantee costing us"_
  and _"how much did we pay for time no order caused"_ are both reports over shift records
  (`hours_guaranteed`, `hours_worked`, presence of a causal order) — see erp-spec#36.
- ⚠️ **`6600 - Wages` needs its narrowed meaning written down or it will be read as the old
  account.** It currently means "all own-crew wages"; it will mean "wages no order caused". A live
  account whose meaning changes without its name changing is invisible in a diff.
- **Measured blast radius, 2026-08-17** — `5801` appears in **28 files**. Of those, **three are
  frozen ADRs** (0019, 0030, 0036) which correctly keep it as a historical record, and the `inbox/`
  notes are append-only. The mutable sweep is `ledger/chart-of-accounts.yaml`,
  `ledger/posting-rules.yaml`, **six golden vectors**, `reporting/product-line-pl.yaml`,
  `glossary.yaml` and `hotspots.yaml`.
- ⚠️ **Nothing is wrong until this is accepted.** ADR-0019 is frozen saying 5801 is COGS and every
  mutable artifact agrees with it, so the spec is currently self-consistent. **The sweep must land
  in the same change as the acceptance**, or the repo spends the interval asserting two things.
- **Gate 16's arithmetic moves** from `143 = 134 live + 9 minted` to `142 = 134 + 8`, and re-derives
  it without being told.
