---
kind: decision
title: >-
  Owner states the complete jurisdiction model — three collecting jurisdictions, origin-sources the
  rest of Illinois, no nexus out of state, Paxton retired as a one-off — and rules that the org and
  project levels ONLY initialize new documents rather than answering a precedence rung
contexts: [tax, ordering, billing]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, 2026-08-23, verbatim:

> were not collecting paxton tax anymore, that was a one off. cfs is registered to collect sales tax
> in a handful of jurisdictions frankfort, rantoul, chicago all in IL. if we deliver out of state we
> have no nexus and dont collct tax. when we deliver anywhere in IL our default is to collect
> chicago (point of origin our warehouse) we are not going to register for every sububr in cook
> county. we are registered in rantoul and frankfort, so if we deliver there we collect that tax
> instead (delivery if we have nexus), if a frankfort or rantoul customer attests to us they will
> exclusively used items picked in our store in frankfort, rantoul and/or out of state we can
> override jurisdiction at the org, project, or order/invoice desination level. override to one of
> the jurisdictions we collect in, or no nexus.

and:

> the org and/or project level just inits created orders and invoices with the override it doesnt do
> anything else

## ✅ The derivation already implements this EXACTLY

Verified `code:2026-08-23:core@c553f3c:src/utils/taxes.ts`. `deriveJurisdiction`'s three cases are
the owner's three rules, in order:

| owner's rule                                | code                                                    |
| ------------------------------------------- | ------------------------------------------------------- |
| out of state → no nexus, no tax             | case 1 — positively-resolved non-IL region → `no_nexus` |
| deliver to a jurisdiction we collect in     | case 2 — `COLLECTING_JURISDICTION_BY_CITY`              |
| anywhere else in IL → origin, our warehouse | case 3 — `return origin`                                |

and `COLLECTING_JURISDICTION_BY_CITY` is **exactly** `{CHICAGO, RANTOUL, FRANKFORT}` — the three
named, with Paxton already absent.

✅ **The permitted override target set is also already exactly right.** The owner: _"override to one
of the jurisdictions we collect in, or no nexus."_ The manager's `JURISDICTION_OPTIONS` is
`["chicago", "rantoul", "frankfort", "no_nexus"]`. ⭐ **The hand-kept list `ADR-0045` proposed
retiring is the correct list**, and the adversarial read that defended it was right on both members:
`no_nexus` is a valid target and is not a registration; `paxton` is not a valid target.

## ✅ Paxton is RETIRED — this resolves `HOT-024`

_"were not collecting paxton tax anymore, that was a one off."_ ⇒ the contradiction is decided in
favour of the manager, and the catalog is the side that is wrong.

⚠️ **The catalog row cannot simply be deleted** — one prod order and one invoice embed the Paxton
tax uid and `calculateItemTax` throws `Unknown tax uid` on a missing one. And letting the window
lapse is **also wrong**, because `taxCellState` would then report `expired`, which the code defines
as _"a configuration failure, not a rate of zero"_ — it would alert forever on a cell nobody
collects. ⭐ **The codebase already names the correct move**: _"a deliberate deregistration is
expressed as a successor at 0% with an open window, never as a closed window with no successor."_

## ⚠️⚠️ THE ONE REAL DIVERGENCE — org/project INITIALIZES, it does not answer a rung

**Owner:** _"the org and/or project level just inits created orders and invoices with the override
it doesnt do anything else."_

**Implemented:** the opposite. `organization.jurisdiction_claim` is **level 2 of a live
precedence**, read from the document's snapshot at every resolution (`resolveJurisdiction`:
`documentDestination ?? organization ?? derived`), and **the seed was deliberately DELETED** at
api-cloudrun#596:

> 🔴 **Two seeds used to live here and both are deleted.** The first wrote
> `orgDoc.jurisdiction_claim` down onto every destination so an operator could see it; now that
> `documentTaxContext` reads level 2 on its own rung, **a stored copy is not a convenience but an
> OVERRIDE that outranks the thing it copied.**

⭐⭐ **That objection assumed the seed and the rung would COEXIST, and under the owner's model there
is no rung.** Remove the rung and a seed outranks nothing — it is simply the value, authored once at
creation. **The two designs are not in conflict about a fact; they are different design points, and
the owner has chosen one.**

### ⭐ The init-only model is stronger on the codebase's OWN stated principle

`core/src/schemas/order.ts:297`: _"**This is a SNAPSHOT.** An order records what it was billed, so
level 1 must not re-resolve out from under a live document."_

|                                              | rung model (shipped)                               | init model (owner)              |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------- |
| changing an org claim moves stored orders    | **yes**, for every order whose destination is null | **no**                          |
| `destinations[i].jurisdiction == null` means | "inherit — ask the next rung"                      | ⭐ **"derived"**, unambiguously |
| a non-null value means                       | "asserted at this level"                           | ⭐ **"asserted"**, full stop    |

⇒ **the init model makes the fallback/determination distinction visible in the data with no new
field**, which is the problem `ADR-0045`'s withdrawn D1 tried and failed to solve by storing a
level. And it stops a customer-master edit from restating orders that were already billed.

⚠️ **The cost is real and should be stated**: with no rung, correcting an org's standing position
does **not** reach documents already created. That is a feature under the snapshot principle and a
support burden in practice — changing it later means re-opening each affected document.

## What this does NOT settle

- ⚠️ **The correction path** when an attestation turns out wrong — gear attested for exclusive
  Frankfort use shoots in Chicago. A dated attestation makes it _"as represented at T"_, so a change
  of use is a **new fact** rather than a contradiction, but whether that re-rates, credit-notes or
  merely records is unstated.
- ⚠️ **`replacement` ignores overrides entirely** — `resolveLineTax` returns `ctx.origin` at
  `level: "origin"` before levels 1 and 2 are consulted, because CFS is the end user of a
  replacement. ⇒ **an org or order override to `no_nexus` does NOT reach a replacement line.** That
  is defensible and it is not written down anywhere the owner's model can see it.
- ⚠️ **The invoice side has no editing path.** An invoice's jurisdiction is not editable after
  create, and `DestinationJurisdiction` is typed for `Order | Fulfillment` only — so "override at
  the order/invoice destination level" is currently order-only in the UI.
- ⚠️ **`project` does not exist yet** — it is a v2 level (`ADR-0032`), so the org → project → order
  init chain is a target-state design with no v1 counterpart.
- ⚠️ **Whether exclusive use out of state defeats the Illinois lease tax on a Chicago pickup is a
  CPA question**, not a modelling one. The override target `no_nexus` encodes an answer to it.
