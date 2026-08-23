---
id: ADR-0045
headline: jurisdiction is a registration, and the level is stored
title: >-
  A tax jurisdiction is a registration rather than a claim about use, and the record stores which
  rung of the precedence answered — so a derived answer is never mistaken for an asserted one
status: proposed
date: 2026-08-23
review_by: 2026-11-30
deciders: [repo owner]
contexts: [tax, ordering, billing]
relates_to: [ADR-0001, ADR-0032, OQ-056, OQ-057, SPIKE-008]
accounting_shaped: true
survey:
  - inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md
measurements:
  - id: M1
    value: "1 caller, and 0 of them server-side"
    of: >-
      consumers of `resolveJurisdiction`, which returns `level: "document" | "organization" |
      "derived"`. The single caller is `manager/src/components/orders/DestinationJurisdiction.tsx`,
      which uses it for display at render time; the string appears **nowhere** in
      `api-cloudrun/src`. ⇒ **the level is computed on every resolution and stored on none.**
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: M2
    value: "30 of 994 orders (3.0%) carry any override; 964 carry neither field"
    of: >-
      the live order corpus, swept 2026-08-23. `destinations[].jurisdiction` non-null on 29 orders —
      rantoul 13, frankfort 13, **chicago 2**, **paxton 1**; `organization.jurisdiction_claim` on 24
      — frankfort 15, rantoul 9. ⚠️ **The two fields are independent, not a fallback chain**: 3 of
      24 org-claimed orders carry a destination that CONTRADICTS the claim, and 6 overrides exist
      with no org claim behind them at all.
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
  - id: M3
    value: "5 conceptual taxes occupy 9 distinct Xero TaxTypes"
    of: >-
      the migration delta against the incumbent. Xero's `TaxRate` carries no jurisdiction, no
      date-effectivity, no item scope and no attachment endpoint, so every rate change mints a new
      TaxType and permanently strands its predecessor. **The delta grows by one on every rate
      change.**
    source: "inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md"
asserts:
  - id: D1
    kind: decision
    claim: >-
      The resolved jurisdiction is stored on the document together with the LEVEL that produced it.
      There are TWO assertion levels and ONE fallback — a per-order statement and a standing
      org/project statement are both determinations of intended use; only the derivation is the
      unknown case. All three must be distinguishable in the stored record, and queryable as such.
  - id: D2
    kind: decision
    claim: >-
      An override carries a REASON and a reference to EVIDENCE. The evidence is a precondition on
      the override — an override whose evidence is absent or lapsed does not apply — rather than a
      free-text field recorded beside it.
  - id: D3
    kind: decision
    claim: >-
      The permitted set of override targets is the set of jurisdictions CFS held a valid
      registration in AS OF the transaction's own date. It is not a list, and it is not the full
      enum.
  - id: D4
    kind: decision
    claim: >-
      An override does not survive a change to the facts it rested on. Where a destination, date or
      registration changes, the override is re-evaluated rather than retained.
  - id: P1
    kind: premise
    claim: >-
      A jurisdiction is a REGISTRATION, not a place — CFS is registered to collect in exactly the
      enum's members, and an address outside them does not get its own rate.
    source: "code:2026-08-23:core@7bcc2db:src/schemas/common.ts"
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
      `deriveJurisdiction` never consults `customer_collecting`, so a collection carrying the
      warehouse's own Chicago address resolves through destination sourcing — an affirmative claim
      that the goods went to Chicago.
    source: "inbox/2026-08-23-destination-sourcing-cannot-tell-delivered-to-chicago-from-collected-at-our-chicago-dock-and-the-lease-tax-predicate-is-use.md"
  - id: P6
    kind: premise
    claim: >-
      An org-level or project-level jurisdiction is a DEFAULT OVERRIDE FOR NEW ORDERS, based on the
      customer's stated intended use. It is an assertion of the same kind as a per-order one, made
      once instead of per order — not a weaker signal consulted when the order is silent.
    source: "inbox/2026-08-23-owner-an-org-or-project-jurisdiction-is-a-default-override-for-new-orders-based-on-stated-intended-use.md"
supersedes:
superseded_by:
---

> **In the context of** a tax jurisdiction model whose derivation is sound and whose stored record
> cannot say how it got its answer, **facing** a lease transaction tax whose predicate is use rather
> than delivery, **we decided** that the jurisdiction is a registration answer stored with the level
> that produced it, and that an override carries evidence as a precondition, **to achieve** a record
> in which a derived answer is never mistaken for an asserted one, **accepting** that this departs
> from the default of all six surveyed references, which require nothing.

## Context

`SPIKE-008` measured the corpus and drafted three items. **Two of the three are already implemented,
and the spike's stated REASONS for them were wrong twice over** — which is why this ADR records the
reasons rather than only the decisions. The third survives and is decided here.

### What the spike got wrong, and what the survey corrected

The draft said the default is _"a FALLBACK for the case where CFS does not know where the gear is
used."_ Both halves fail.

- ⭐ **It is not a fallback.** Sage Intacct's sourcing rule names the pickup case explicitly — the
  input is _"their shipping address **unless they are coming to you to pick up the product being
  sold**."_ A collection is a **determination**: the buyer's location is the seller's counter (P2).
- ⭐ **It is not a claim about use.** NetSuite asks _"am I registered where this is going?"_ before
  it asks where the goods are going, and refuses tax where the nexus does not reach _"even if the
  customer is taxable and the item is taxable in the customer's state."_ Under that criterion the
  default asserts only that CFS is registered in Chicago — a far narrower and more defensible claim
  than that the equipment is used there (P1).

⭐ **And CFS's own code already held the correct reason.** `core` states it plainly: _"a
jurisdiction is a registration, not a place."_ **The survey did not supply a new idea. It supplied
the reason the existing design is right, and the vocabulary to say so** — which is what stops the
next reader from re-deriving a wrong justification, as this spike did twice.

### The distinction the lease tax needs, and the reference that names it

**SAP types six location concepts and never lets one answer for another**: ship-from, ship-to, point
of order acceptance, point of order origin, title passage, and `COST_OBJECT` — _"where the goods are
consumed."_ It types `TAX_TYPE: 3 – Rental/Lease Tax` separately from sales tax for the same reason.

⇒ CFS's _"where the gear left from"_ is the ship-from fact. **It is not the consumption fact**, and
the Chicago Personal Property Lease Transaction Tax reaches property **used in** Chicago (P3).

⚠️ **This is not a defect report.** `deriveJurisdiction` never consults `customer_collecting` (P5),
so a collection at the Fillmore dock resolves through destination sourcing — but for sales tax
origin and destination coincide and the answer is right either way. **The two rules agree on the
answer and disagree on the question, and nothing in the record says which was asked.**

⚠️ **Whether the ordinance lets a lessor source to the lessee's use location at all is a CPA
question, not one this ADR settles.** `Hertz Corp. v. City of Chicago`, 2017 IL 119945, invalidated
Lease Transaction Tax Ruling 11 on exactly the "used in Chicago" question. **A table keyed on a
stored enum is a simplification of a rule the Illinois Supreme Court has already narrowed once.**

### ⭐⭐ Two determinations and one fallback — not one determination and two fallbacks

⚠️ **The precedence chain reads like a ladder of decreasing confidence, and it is not one** (P6,
owner 2026-08-23). An org-level or project-level jurisdiction is a **default override for new
orders, based on the customer's stated intended use.** It is an assertion of the same kind as a
per-order one — made once rather than repeated — and **specificity governs** because a later
statement supersedes a standing one, **not** because the per-order value is more trustworthy.

| level          | what it is                                                  | kind              |
| -------------- | ----------------------------------------------------------- | ----------------- |
| `document`     | this order's own statement of intended use                  | **determination** |
| `organization` | the customer's standing statement, applied to new orders    | **determination** |
| `derived`      | nobody stated anything; the address and registration answer | **the fallback**  |

⇒ **the fallback/determination line falls BELOW both assertion levels, not between them.** CFS has
no project entity — a project maps onto an order — so "project level" is the `document` rung.

⭐ **And the implementation expresses that intent one step differently, which is the same theme a
rung up.** The org claim is **snapshotted onto the document** at write (`buildOrganizationSnapshot`,
_"mirrored from `Organization.jurisdiction_claim`"_), so a later change to the customer master
cannot restate a stored order — that half is right and is the _"snapshot on the DOCUMENT, derive on
the MASTER"_ rule already applied. **But it is not SEEDED onto the destination**: the order form's
empty option is the _inherit_ option, whose stored value is `null` rather than a member.

⇒ **a destination reading `null` means "inherit", and an order whose use was affirmatively
determined to be Frankfort — matching the standing claim — is indistinguishable from one where
nobody looked.** The two produce the same tax and record different facts, and only the level tells
them apart. ⚠️ **That is D1's problem again, one rung up, and it is why the level rather than the
value is the thing worth storing.**

### ⭐⭐ The failure mode, and CFS is one step from it

Odoo stores `fiscal_position_id = False` for **three different situations** — no country on the
partner, no rule matched, or none was ever configured. All three collapse to one empty value. **The
record cannot distinguish "we fell back" from "the rule applied and mapped nothing."**

⇒ **"fallback, not determination" is a claim about the RECORD's meaning**, and Odoo demonstrates
what happens when it is left implicit: **the distinction survives in the design intent and
evaporates in the database.**

CFS is better placed than Odoo and not by much. `resolveJurisdiction` **does** return which rung
answered, deliberately — a second implementation of the precedence to compute it would be _"exactly
the drift this function exists to prevent."_ **But it is computed on every resolution and stored on
none** (M1).

⭐ **And the data shows operators already need the distinction the schema denies them.** Across 994
orders (M2), `chicago` was written **explicitly, twice** — both on customers whose standing claim
said `frankfort`. **Chicago-as-fallback is `null`. Chicago-as-determination was typed by hand,
because the schema offers no other way to say it.** Someone reached for a way to record "I actually
determined this" and the only tool available was the value that otherwise means "we did not decide".

⭐ **SAP solved this and names the field.** `TXJCD_IND` — _"Jurisdiction indicator used for tax
calculation"_ — is returned per line and records **which of the four candidates the engine actually
used**. That is an audit trail on the **determination**, separate from any reason for a
**departure**, and it is precisely what CFS computes and discards.

### What the survey says about evidence, and why the default loses

**All six references require nothing.** Xero has no reason field at any of its three override levels
and `TaxRates` is one of the few objects with no attachments endpoint. Intacct's whole override
payload is two fields, and it gates **who** may override rather than **why**. NetSuite's only
control is a permission. Odoo's header `fiscal_position_id` does not even carry `tracking=True`,
while the line's `tax_ids` does — **the tax override is logged and the jurisdiction override is
not**, which is backwards from an audit standpoint. SAP types reason codes richly, but they are
**engine outputs**; of its two input fields it says _"It is recommended to leave this field blank."_

⭐ **The criterion is unanimous where the default is uninformative: a reason appears exactly where
an outside authority will read it** (P4). Odoo's single per-transaction reason in its entire
codebase exists because Malaysia's regulator demands it — 205 matches for `exemption` across the
repository and **none in the accounting module**. Intacct specifies the full certificate shape —
jurisdiction, reason, effective dates, image, status, expiry — and then **declines to own it.**

⇒ **the Chicago lease tax makes CFS's override that case.** An assertion that gear is used
exclusively in Frankfort is a claim a Chicago auditor may test. **Following the criterion means
departing from the default of all six** — the same read, and the same reasoning, as the credit-note
decision the workspace instruction holds up as its worked example.

## Decision

**D1 — the record stores the level, not only the value.** A resolved jurisdiction is persisted
together with which rung of the precedence produced it, and that is queryable. A `derived` answer
and a `document` override naming the same jurisdiction are different facts and must not share a
representation.

**D2 — an override carries a reason and an evidence reference, and the evidence is a precondition.**
⭐ **The shape is Odoo's `vat_required`, not a free-text note.** Odoo models "this departure rests
on the customer's assertion" as a condition **on the rule**, externally validated — `_get_vat_valid`
returns `super()._get_vat_valid(...) and delivery.vies_valid`, checked against the EU's own
registry. ⇒ **an override whose evidence is absent or lapsed does not apply**, rather than applying
while carrying a note that says it should not have. The evidence artifact itself is `OQ-056`'s
customer attestation and is not re-specified here.

**D3 — the permitted target set is the registration set as of the transaction date.** ⭐ SuiteTax
states the rule this ADR adopts: _"Tax registrations that are not valid on the date of the
transaction are ignored by the nexus lookup logic and **are not available for selection on nexus
override**."_ ⇒ the spike's _"Frankfort and Rantoul only"_ is retired: it was the practice, not the
constraint. ⭐ **And the elimination is declarative, in Odoo's shape — silence is permissive, a
declared-and-unmet constraint disqualifies** — so a target removes itself rather than being absent
from a hand-kept list.

**D4 — an override does not outlive the facts it rested on.** ⚠️ Imported as a **rejected option**
from NetSuite, whose Tax Details Override is sticky: once set, tax lines are _"retained, **even if
tax-related fields are changed**… the tax engine isn't notified about the changes"_ and is demoted
to _"reporting purposes."_ **An override that survives a change to the facts that justified it is
how a defensible position becomes a stale one silently.**

## Considered options

| option                                                            | why not                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Store nothing new; the derivation is already correct**          | It is correct, and unfalsifiable. Odoo's `False` is the demonstration, and M2 shows operators already encoding a determination as the fallback value because nothing else can say it                               |
| **Re-derive the level on read instead of storing it**             | The derivation reads the _current_ master and the _current_ registration set; the level is a fact about the transaction. Re-deriving it answers what would happen today, which is the question nobody asked        |
| **A free-text reason field on the override**                      | The default of all six references is no field at all, so a free-text one follows neither the default nor the criterion. It records that someone typed something, which is not evidence                             |
| **Require a reason on every jurisdiction, derived ones included** | 964 of 994 orders carry no override (M2). A reason on a derivation is a reason for the ordinary case, which trains everyone to skip it                                                                             |
| **Buy a determination engine** (Vertex, Avalara, Sovos)           | It is the market's revealed answer, and it is what SAP and NetSuite both delegate to. ⚠️ **Not evaluated here** — it is a real option, it is out of `SPIKE-008`'s scope, and it belongs to a build-or-buy decision |
| **Restrict override targets to a named list**                     | `SPIKE-008`'s D3. Retired by D3 above: a list cannot express "registered on that date", and it goes stale the day CFS registers somewhere new                                                                      |

## Consequences

- ⭐ **The claim becomes falsifiable.** "The jurisdiction was derived, not asserted" is currently a
  statement about intent. After D1 it is a stored fact something can be queried against, and the
  first useful query is how many lines were sourced by each rung.
- ⚠️ **The level is a new field on documents that already exist.** Every historical line resolves to
  a level that can be recomputed but **must not be back-stamped as though it had been recorded** —
  the same distinction ADR-0034 draws about a frozen ADR. A migration writes what it can derive and
  says so.
- ⚠️ **D2 has no evidence artifact yet.** `OQ-056` specifies it and nothing is built — no
  attestation surface, no storage, no retention lock. **D2 is a decision about SHAPE that is inert
  until that lands**, and stating it now is what stops the evidence being designed as a free-text
  box.
- ⚠️ **D3 needs a registration record CFS does not keep.** "Registered in `frankfort` from date X"
  exists nowhere — the enum is a list of names with no validity dates. **D3 is not implementable
  against today's data**, and that gap is the finding rather than an objection.
- ⭐ **D4 makes the override a rule rather than a stamp**, which is what allows D2's precondition to
  bite. A sticky override and an evidence precondition are incompatible: the first retains an
  answer, the second withdraws it.
- ⚠️ **A departure from all six references is a claim that needs an argument**, and the argument is
  the criterion rather than the default. **If the criterion is wrong — if a Chicago auditor would
  never test an exclusive-use assertion — then D2 is over-built** and the honest answer is Xero's:
  accept the assertion and store nothing. That is the question for the CPA.
- ⭐ **The migration delta runs the other way from usual.** M3 measures that Xero has never held the
  jurisdiction dimension at all. ⇒ this ADR **adds** a dimension rather than carrying one across, so
  there is no history to restate — and correspondingly no Xero figure that can check it.
