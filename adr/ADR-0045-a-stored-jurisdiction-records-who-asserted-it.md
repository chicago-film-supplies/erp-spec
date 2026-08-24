---
id: ADR-0045
headline: record the asserter, not the rung
title: >-
  A stored jurisdiction records WHO asserted it and under what authority — not which rung of the
  precedence answered, which is a restatement of fields the document already holds
status: proposed
date: 2026-08-23
review_by: 2026-11-30
deciders: [repo owner]
contexts: [tax, ordering, billing]
relates_to: [ADR-0001, ADR-0032, HOT-024, OQ-056, OQ-057, SPIKE-008]
accounting_shaped: true
survey:
  - inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md
measurements:
  - id: M1
    value: "0 imports of `JurisdictionLevel` in `api-cloudrun/src`; 1 consumer, and it is a label"
    of: >-
      how far `resolveJurisdiction`'s returned `level` travels. Its one consumer is
      `manager/src/utils/jurisdictionLabels.ts`, which renders it as English. It IS produced
      server-side — `destinationJurisdictions` at `api-cloudrun/src/services/orders.ts:2528` —
      and **discarded at `:2537`**. ⚠️ **Nothing persists it, and that is deliberate rather than an
      omission** — see D1's rejected options.
    as_of: 2026-08-23
    source: "code:2026-08-23:api-cloudrun@22672044:src/services/orders.ts"
  - id: M2
    value: "6 of 994 orders use level 1 to say anything level 2 does not"
    of: >-
      the live order corpus. 29 orders carry a destination jurisdiction and 21 of the 23
      co-populated ones **restate the org claim verbatim**. ⚠️ **CORRECTED — an earlier revision of
      this ADR read the residue as operator intent and it is migration output.** Commit `9a43032b`
      applied `migrate-document-tax-jurisdiction.ts` to 55 documents, and the manager control that
      lets an operator author one shipped days before the measurement.
    as_of: 2026-08-23
    source: "code:2026-08-23:api-cloudrun@22672044:tests/integration/orders/jurisdiction.test.ts"
  - id: M3
    value: "5 conceptual taxes occupy 9 distinct Xero TaxTypes"
    of: >-
      the migration delta against the incumbent. Xero's `TaxRate` carries no jurisdiction, no
      date-effectivity, no item scope and no attachment endpoint, so every rate change mints a new
      TaxType and strands its predecessor. ⇒ formalising the jurisdiction dimension **adds** one the
      incumbent never held; there is no history to restate and no Xero figure that can check it.
    as_of: 2026-08-23
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: M4
    value: "1,723 lines of rule in `core`; 1,131 of the API's 2,481 die with Xero and CRMS"
    of: >-
      where the tax calculation lives. The RULE — precedence, derivation, catalog selection,
      per-line materialization — is `core/src/utils/taxes.ts` + `src/schemas/tax.ts`, **pure, with
      no I/O, published**. `api-cloudrun` holds catalog CRUD, the Xero mapping and the lifecycle
      monitors. ⇒ **the rule is already portable and survives the rebuild nearly intact.**
    as_of: 2026-08-23
    source: "code:2026-08-23:core@c553f3c:src/utils/taxes.ts"
asserts:
  - id: D1
    kind: decision
    claim: >-
      A stored jurisdiction records WHO asserted it and under what authority — the acting party and
      the tree level their access reaches. It does NOT record which rung of the precedence answered,
      because that is a total function of fields the document already stores.
  - id: D3
    kind: decision
    claim: >-
      The org and project levels INITIALIZE a new order or invoice with an override and do nothing
      else. There is no live organization rung in the precedence, so a document's own stored value
      is either an assertion or absent, and absent means derived.
  - id: D4
    kind: decision
    claim: >-
      A correction to a jurisdiction is a new assertion at the order or invoice destination level,
      using the same override field. There is no separate correction mechanism.
  - id: D5
    kind: decision
    claim: >-
      A replacement line sources to the CFS store, because CFS is the end user and the customer is
      only paying for it. The default store determines it, overridable to another CFS store, and a
      customer's attestation about their own use never reaches it.
  - id: P7
    kind: premise
    claim: >-
      CFS collects in chicago, rantoul and frankfort only. Out of state is no nexus; anywhere else
      in Illinois origin-sources to the warehouse. Paxton was a one-off and is retired. An override
      may target only a collecting jurisdiction or no_nexus.
    source: "inbox/2026-08-23-owner-states-the-whole-jurisdiction-model-paxton-is-retired-and-the-org-level-only-inits.md"
  - id: D2
    kind: decision
    claim: >-
      An override carries a REASON. It does not carry an evidence PRECONDITION — evidence that
      lapses must warn, never withdraw an answer from a stored document.
  - id: P1
    kind: premise
    claim: >-
      A jurisdiction is a REGISTRATION, not a place — CFS is registered to collect in the enum's
      collecting members, and an address outside them does not get its own rate.
    source: "code:2026-08-23:core@c553f3c:src/schemas/common.ts"
  - id: P2
    kind: premise
    claim: >-
      A customer collection is a DETERMINATION rather than a missing destination — the buyer's
      location is the seller's counter — so sourcing a pickup to the Chicago shop is correct for
      sales tax and is not a fallback.
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: P3
    kind: premise
    claim: >-
      Physical movement and consumption are different facts about one transaction, and the Chicago
      Personal Property Lease Transaction Tax turns on consumption. A pickup determines ship-from,
      ship-to, order acceptance and title passage at the counter, and determines nothing about where
      the property is used.
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: P4
    kind: premise
    claim: >-
      No reference in the six-reference survey requires a reason or evidence on a jurisdiction
      override. All six converge on when one appears: exactly where an outside authority will read
      it.
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: P5
    kind: premise
    claim: >-
      Authority is scoped by tree level. A coordinator holds project access and not org access, and
      for a large customer no contact CFS deals with holds org-level access at all — so an org-rung
      jurisdiction is in practice a CFS-authored default while a project-rung one is the customer's
      own representation.
    source: "inbox/2026-08-23-owner-authority-is-scoped-by-tree-level-and-a-coordinator-has-project-access-not-org-access.md"
  - id: P6
    kind: premise
    claim: >-
      The resolution LEVEL records which rung answered, never who authored the value. A migration
      script and an operator both produce `level: "document"`, and prod orders 895 and 902 are that
      case — a repair script pinned the DERIVED value at level 1 to stop a legacy `tax_profile`
      falling through to the customer's claim.
    source: "code:2026-08-23:api-cloudrun@22672044:tests/integration/orders/jurisdiction.test.ts"
supersedes:
superseded_by:
---

> **In the context of** a jurisdiction model whose derivation is sound and whose stored record
> cannot say who asserted a value, **facing** a customer tree in which the rung a default lives at
> is not a rung anyone can attest at, **we decided** to record the asserter and their authority
> rather than the rung, **to achieve** a stored jurisdiction that can be told apart from CFS's own
> default, **accepting** that this is a new artifact rather than a field, and that three decisions
> an earlier revision of this ADR made are withdrawn as wrong.

## ⚠️ This ADR was substantially rewritten on the day it was drafted

An earlier revision carried four decisions. **Three were wrong and are withdrawn**, and the evidence
for the fourth was **inverted**. The rewrite is recorded here rather than hidden because the reasons
are the useful part — each rejection is a design the codebase had already considered and declined,
with the reasoning written down, and a spec that re-proposes them in ignorance would keep doing so.

⭐ **The owner's read was right: the API's model is superior.** What survives is one gap it does not
cover, and the owner named it — **authority**.

## Context

`SPIKE-008` measured the corpus and drafted three items; the six-reference survey corrected their
reasons; an adversarial read of the implementation then falsified most of what remained.

### What the survey settled, and it stands

- ⭐ **The default is not a fallback for unknown use.** Intacct's rule names the pickup case — the
  input is the customer's shipping address _"unless they are coming to you to pick up the product
  being sold"_ — so a collection is a **determination** (P2).
- ⭐ **It is not a claim about use either.** NetSuite gates on registration before address, so the
  default asserts only that CFS is registered in Chicago (P1) — which is what
  `core/src/schemas/common.ts` already said: _"a jurisdiction is a registration, not a place."_
- ⚠️ **For the lease transaction tax the question is still wrong, and SAP names why**: it types six
  location concepts — ship-from, ship-to, order acceptance, order origin, title passage, and
  `COST_OBJECT`, _"where the goods are consumed"_ — and never lets one answer for another (P3).

### ⭐⭐ What the adversarial read falsified — the level records the RUNG, never the AUTHOR

The earlier revision's strongest argument was that **`chicago` was written explicitly twice, over a
`frankfort` org claim**, and that _"someone reached for a way to record 'I actually determined this'
and the only tool available was the value that otherwise means we did not decide."_

**That is backwards.** Those rows are prod orders **895 and 902**, and
`api-cloudrun/tests/integration/orders/jurisdiction.test.ts` records what wrote them:

> the other was the inbound translation of `tax_profile`, whose `"tax_applied"` member meant _"this
> order is ordinary"_ and had to be STORED as the derived value to block the customer's claim
> (**prod orders #895 and #902 are the class; the #596 migration wrote exactly that value onto
> both**)… the stored instances remain, and they are now ordinary level-1 overrides
> **indistinguishable from an operator's**.

⇒ a **repair script** pinned the **derived** value at level 1 — the exact opposite of a hand-typed
determination (P6).

⭐⭐ **And the last clause is the finding that reshapes this ADR.** _"Indistinguishable from an
operator's"_ is the real defect, and **storing the level would not fix it**: both cases produce
`level: "document"`, which is true about which rung answered and a lie about how the answer was
reached. **The rung is not the author.**

## Decision

**D1 — record the asserter and the authority, not the rung.** A stored jurisdiction that departs
from the derivation carries who asserted it and the tree level their access reaches.

⭐ **The owner's constraint is what makes this the right field** (P5): a project inherits its
default from the organization, but a coordinator holds **project** access and not **org** access —
and at a customer the size of Netflix, no contact CFS deals with holds org-level access at all.

| rung             | who can assert it                   | what a stored value is worth         |
| ---------------- | ----------------------------------- | ------------------------------------ |
| **organization** | ⚠️ for a large customer, **nobody** | a **CFS-authored default**           |
| **project**      | a coordinator — exactly this access | ⭐ **the customer's representation** |
| **document**     | same or narrower                    | the customer's, scoped tighter       |

⇒ **the org and project rungs do not differ only in specificity. They differ in who COULD have made
the assertion, and therefore in what it is worth** — and that is a fact about an act, which is
exactly the kind of fact a derivation cannot reproduce and a record must hold.

⚠️ **Inheritance and authority run in OPPOSITE directions.** The default flows **down** the tree;
the authority to assert reaches **up** only as far as the membership edge goes. **The rung the
default lives at is not a rung anyone can attest at.**

**D2 — an override carries a REASON, and no evidence precondition.** The reason is cheap,
non-destructive, and follows the survey's criterion (P4): a reason appears where an outside
authority will read it, and a Chicago auditor may test an exclusive-use assertion. ⚠️ **The
precondition half is withdrawn — see below.**

### ⭐⭐ The org and project levels INITIALIZE — they do not answer a rung (D3)

Owner, 2026-08-23: _"the org and/or project level just inits created orders and invoices with the
override it doesnt do anything else."_

⚠️ **The shipped model is the opposite** — `organization.jurisdiction_claim` is level 2 of a live
precedence read from the document snapshot, and the seed was **deliberately deleted** at
api-cloudrun#596: _"a stored copy is not a convenience but an OVERRIDE that outranks the thing it
copied."_

⭐⭐ **That objection assumed the seed and the rung would COEXIST. Under D3 there is no rung**, so a
seed outranks nothing — it is simply the value, authored once at creation. The two are different
design points rather than a disagreement about a fact.

⭐ **And D3 is stronger on the codebase's own stated principle** — `core/src/schemas/order.ts:297`:
_"**This is a SNAPSHOT.** An order records what it was billed, so level 1 must not re-resolve out
from under a live document."_ With no rung, changing a customer master cannot move a stored order,
and `destinations[i].jurisdiction == null` means **derived**, unambiguously, rather than _"inherit —
ask the next rung"_.

⇒ ⭐⭐ **D3 delivers for free what the withdrawn store-the-level decision tried and failed to buy:
the fallback/determination distinction becomes visible in the data, with no new field.** D1 then
carries only what remains genuinely unrecorded — **who asserted, and under what authority.**

⚠️ **The cost is real.** With no rung, correcting an organization's standing position does not reach
documents already created; each affected document must be re-opened. That is a feature under the
snapshot principle and a support burden in practice.

### ⭐ The correction path is the override itself (D4), which promotes a UI gap to a blocker

Owner, 2026-08-23: _"the correction path would need to be at the order/invoice level utilizing the
same destination overide."_ ⇒ **no new machinery** — a later, more specific statement supersedes the
standing one, which is the precedence already ruled on.

⚠️ **The invoice PUT has no jurisdiction input** — `src/services/invoices.ts:897-901`: _"This is the
only tax lever a PUT has… An invoice's jurisdiction has never been editable after create."_ ⭐ **But
the invoice is NOT immutable** (owner, 2026-08-23): it is editable until a payment is applied, and
the PUT already re-materializes tax through `invoiceTaxContext`. ⇒ **the gap is one missing input
riding a slot that exists**, not a closed document.

⭐⭐ **And the payment boundary answers the accounting question rather than leaving it open.**
Unpaid, a correction is an ordinary edit and the amount may move; paid, a credit note is the only
route — which is `ADR-0020`'s _"a restatement must not alter any amount"_, already drawn. ⚠️ **A
CFS-side payment gate on `updateInvoice` was NOT located** — the refusals found describe Xero's
rule, not CFS's — so whether that boundary is enforced server-side or relied on from the UI is
unresolved, and it must be settled **before** a jurisdiction input is added rather than after.

### ⭐ A replacement sources to the CFS store, and that closes a question rather than opening one (D5)

_"replacements are used by cfs (not the customer, the customer is just paying for them)."_ The code
already implements it — `resolveLineTax` returns `ctx.origin` before levels 1 and 2 are consulted. ⇒
**an override to `no_nexus` not reaching a replacement line is CORRECT**, not a gap: a customer's
attestation about where _they_ will use gear says nothing about a part _CFS_ consumed.

⚠️ **The override half of D5 is not reachable in three of four writers.** `updateOrder` resolves
`order.uid_store`; `createOrder` and both invoice writers resolve the **default** store, and
`CreateOrderInput` carries no `uid_store` at all. ⇒ an order with a non-default store **prices at
one origin on create and another on its first edit** — dormant only while every store shares a
jurisdiction, and the day that stops being true is the day the override is needed.

## Considered options — the three withdrawn decisions, and why each is worse

| withdrawn                                                | the evidence against it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Store the resolution LEVEL**                           | It is a **total function of two nullability checks on fields the document already stores** — both snapshots, so a stored copy can only agree or be wrong. `api-cloudrun/src/services/orders.ts:702-717`: _"a stored copy is not a convenience but an **OVERRIDE that outranks the thing it copied**."_ And `:2470-2476`: _"a stored 'is stale' boolean is a second copy… **and the copy is what goes stale**."_ Declined three times already, including at api-cloudrun#591 and #613                                                                                                         |
| **Evidence as a PRECONDITION on the override**           | ⚠️ **The same shape as a refusal reverted on 2026-08-23.** An order resolves at its earliest **delivery start — a future date** — so a lapsing precondition is not a review deadline but a ceiling on forward booking. Measured: **1 of 81 live orders became unwritable the moment one was set.** An attestation expiring in October would silently re-rate a November order. The house pattern is `UnreviewedTaxWarning`: **price, and report**                                                                                                                                            |
| **Target set = registrations valid at transaction date** | **Inverted at both non-trivial members.** `no_nexus` is deliberately offered and is _not_ a registration — _"the only way to say it now that `isEntirelyOutOfIllinois` is gone"_ — so the rule deletes it. `paxton` is deliberately _not_ offered but IS a live catalog registration, so the rule makes it newly assertable, reversing a closure. ⚠️ **And the stated blocker was false**: the `taxes` collection IS the registration record, with deregistration written as _"a successor at 0% with an open window"_                                                                       |
| **An override does not outlive its facts**               | **Already implemented in the half that is right** — `orders.ts:1322-1329`: _"a jurisdiction may only ever follow the same address (#593)."_ Change the address and the carry-forward misses by uid. In the half that is not, it would let a **registration** change reach into stored orders, which `core/src/schemas/order.ts:297` forbids: _"**This is a SNAPSHOT.** An order records what it was billed."_ ⚠️ And the NetSuite stickiness it imported as a rejected option is a **category error** — NetSuite retains computed tax LINES; CFS retains an assertion and recomputes from it |

## Consequences

- ⭐ **D1 is an ARTIFACT, not a field.** The asserter and their authority are properties of an act,
  and the act is `OQ-056`'s customer attestation — decided, and **not built anywhere**. ⇒ D1 is
  inert until that lands, and stating it now is what stops the attestation being designed as a
  free-text box or as a level enum.
- ⭐ **The rule survives the rebuild almost untouched** (M4). The calculation is a pure published
  package with no I/O; `api-cloudrun`'s half is catalog CRUD, Xero mapping and lifecycle, and
  **1,131 of its 2,481 tax lines die with Xero and CRMS.** ⇒ the migration risk here is far lower
  than `SPIKE-008` assumed, and the spec should carry the rule by reference rather than restate it.
- ⚠️ **A CFS-authored default is not a defect and must not be styled as one.** For 964 of 994 orders
  nobody asserts anything and the derivation answers — correctly, per P1 and P2. **D1 applies only
  where someone departs from it.**
- ⚠️ **Whether the ordinance permits sourcing a collection to the lessee's use location at all is a
  CPA question**, and it decides whether D2's reason is worth carrying.
  `Hertz Corp. v. City of
  Chicago`, 2017 IL 119945, invalidated Lease Transaction Tax Ruling 11 on
  exactly that question.
- ⚠️ **Authority is a defensible boundary, not a legal conclusion.** Illinois UETA §9(a) makes
  attribution a fact question — _"the act of the person… may be shown in any manner"_ — and whether
  a coordinator's act binds the entity is agency law, which this does not settle.
