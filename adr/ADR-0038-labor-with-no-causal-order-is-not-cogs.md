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
accounting_shaped: true
survey:
  - inbox/2026-08-17-survey-labor-with-no-cost-object-stays-in-the-natural-expense-account-and-the-vehicle-rate-residual-does-not-follow.md
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
- **Surveyed 2026-08-17**, per CLAUDE.md → _Accounting decisions_:
  `inbox/2026-08-17-survey-labor-with-no-cost-object-stays-in-the-natural-expense-account-and-the-vehicle-rate-residual-does-not-follow.md`.
  ⚠️ **The labor survey taken earlier the same day does NOT cover this question** — its D3 asked
  what belongs _inside_ `5801` and assumed the account exists. Four of six references leave labor
  with no cost object in the natural expense account; **GAAP abstains** (Reg S-X 5-03(b)(2) does not
  define applicability and lets a merchandiser fold occupancy and buying costs into the cost
  caption, and ASC 330's idle-time machinery governs what is capitalized into inventory — CFS
  capitalizes no labor into anything), so this is a stated presentation policy rather than a rule
  being followed.
- ⚠️ **The reporting machinery cannot carry a no-causal-order cost into a product line at all**, and
  that is the argument this ADR was missing. Since ADR-0036 `labor_line` is read off the shift's
  ABSORBED allocation row (OQ-042), and an allocation row exists only where a causal job does — so a
  warehouse-cleanup day reaches no pool in `reporting/product-line-pl.yaml`, including the
  `cost_only` pools OQ-046 created. Put in COGS it would sit unallocated permanently, which is the
  shape ADR-0029 exists to prevent. **The decision is forced by machinery already accepted.**

## Decision

**Labor no causal order produced is operating expense, and it stays in `6600 - Wages`.**

**`5801` is not created.** ADR-0019 minted it; nothing will post to it, so it is removed from the
chart rather than left as an account with no reachable path.

**`6600 - Wages` NARROWS rather than emptying.** ADR-0019 says own-crew cost moves from 6600 into
COGS; under but-for **only the causal part moves**. What 6600 keeps is exactly the named population:
training days, warehouse cleanup, maintenance projects — and any paid day no order caused.

⚠️ **That population is TWO things, and the survey's F3 asks that they be said separately** because
the references treat them differently and only the machinery makes the outcome the same:

| population                                         | why it lands in 6600                                                                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| training, meetings, administrative and office time | it serves nothing in particular — no cost object, and none could exist                                                                                                                                                              |
| **warehouse cleanup, fleet maintenance projects**  | it IS capacity-sustaining work on the assets rental revenue is drawn from, and every reference would call that an indirect cost of revenue **if it had a cost object to attach to**. It has none, so it cannot reach a product line |

**Same account, different reason.** An ADR giving one reason for both invites the next reader to
re-open the second — which is what the `6600` chart note already did by naming only "administrative
and office time".

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
- ⚠️ **`6600`'s own chart note contradicts this ADR's population and must be rewritten in the same
  change.** It reads _"this account retains only wages attributable to no job — administrative and
  office time… Job labor goes to 5800, idle and guaranteed-unworked time to 5801"_ — written for the
  ADR-0019 world, naming a narrower population and an account this ADR removes. **A live account
  whose meaning changes without its name changing is invisible in a diff**, so the note is the only
  place a reader will look.
- ✅ **The migration delta is ZERO for this population, and no other decision in this repo can say
  that.** ADR-0020 restates dimensions, ADR-0030 breaks gross-margin comparability, ADR-0032
  restates identity; here the incumbent already holds every dollar in `6600` and this ADR leaves it
  there. ⚠️ **Zero delta is not zero unknown** — nothing splits `6600` into crew and administrative
  wages, so the SIZE of what stays is unmeasured, and it is the same measurement OQ-050 wants for a
  different reason.
- **Measured blast radius — re-measured 2026-08-17 (evening): `5801` appears in 34 files, of which
  18 are mutable.** ⚠️ **This bullet read "28 files… six golden vectors" hours earlier and was
  already stale**, because `vehicle_cost_absorbed` landed in between and reasons about `5801`
  throughout. The mutable sweep is `ledger/chart-of-accounts.yaml`, `ledger/posting-rules.yaml`,
  **eight golden vectors**, `contexts/ledger/features/posting-keys.feature`,
  `reporting/product-line-pl.yaml`, `glossary.yaml`, `hotspots.yaml`, `open-questions.yaml` and the
  workspace `CLAUDE.md`. The frozen ADRs (0019, 0030, 0036) and the `inbox/` notes correctly keep it
  as a historical record.
  - ⚠️ **One golden vector is NAMED after the premise this ADR refutes** —
    `shift_recorded/paid-day-no-order-caused-lands-in-5801`. It is not an edit, it is a rename plus
    a re-pointed expectation, and it is the file most likely to be missed because its name reads as
    a description rather than as a claim.
  - ✅ **The sweep is CI-enforced rather than trusted**: `posting-keys.feature` names `5801` in a
    step, and gate 10n fails on an account code that does not resolve in the chart — so removing the
    account without sweeping the feature file turns CI red rather than passing quietly.
- ⚠️ **Nothing is wrong until this is accepted.** ADR-0019 is frozen saying 5801 is COGS and every
  mutable artifact agrees with it, so the spec is currently self-consistent. **The sweep must land
  in the same change as the acceptance**, or the repo spends the interval asserting two things.
- **Gate 16's arithmetic moves** from `143 = 134 live + 9 minted` to `142 = 134 + 8`, and re-derives
  it without being told.
