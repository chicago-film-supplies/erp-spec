---
kind: decision-input
title: >-
  Owner: a project inherits its jurisdiction default from the organization, but a coordinator holds
  PROJECT access and not ORG access — so the rung an attester can act at is not the rung the default
  lives at, and the level records authority rather than only provenance
contexts: [tax, ordering, billing]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> a project should inherit default from an org, but a coordinator more likely has project access and
> not org access, in the case of netflix its unlikely that any contact would have org level access

## ⚠️ First, a correction — I claimed CFS has no project level, and that is wrong

`ADR-0045` P6 and
`inbox/2026-08-23-owner-an-org-or-project-jurisdiction-is-a-default-override-for-new-orders-based-on-stated-intended-use.md`
both say _"CFS has no project entity — a project maps onto an order."_

⚠️ **That is true of the V1 system and false of the TARGET**, which is what the ADR is about. I
checked `core/src/schemas/` — the shipped code — and concluded from its absence there. **The target
model has had `project` as a first-class level since `ADR-0032` (the customer tree is a liability
tree)**, and `glossary.yaml` defines it: _"A production. The middle level of the organization tree,
and the cost object a job attaches to."_

⭐ **This is the repo's own footgun in its purest form**: I verified against the live system a claim
about the system being designed. **The v1 schemas are the wrong oracle for a target-state
question.**

## The tree already exists, and so does the authority model

`ADR-0032`: **organization → project → settlement point** (a department on a project). And the
authority half is already specified at the leaf:

> **Contact MEMBERSHIP EDGES belong here; the person does not.** A contact is one global record with
> N memberships, each carrying a **role** — 26 of 165 contacts are attached to two or more
> organizations today.

⇒ **the owner's constraint is not new machinery; it is the membership edge read for a new purpose.**
A coordinator holds an edge at a project's department. Netflix has many productions and no contact
CFS deals with holds an edge above one of them.

## ⭐⭐ What this changes: the level records AUTHORITY, not only provenance

`ADR-0045` D1 argues for storing which rung answered because the record should be falsifiable.
**That argument is weaker than the one available here.**

| rung             | who can assert it                                                               | evidentiary status                                 |
| ---------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| **organization** | someone with org authority — ⚠️ **for a large customer, NOBODY CFS deals with** | in practice a **CFS-authored operational default** |
| **project**      | a coordinator, who has exactly this access                                      | ⭐ **the customer's own attestation**              |
| **document**     | per-order, same or narrower access                                              | the customer's own attestation, scoped tighter     |

⭐⭐ **So the org rung and the project rung do not differ only in SPECIFICITY. They differ in WHO
COULD HAVE MADE THE ASSERTION, and therefore in what the assertion is worth.** An org-level default
on Netflix is CFS's guess; a project-level attestation is Netflix's representation.

⇒ **the level is the field that says which of those a stored jurisdiction is** — and that is a much
stronger reason to persist it than "the record should be falsifiable." ⚠️ **A single stored
`jurisdiction: frankfort` is either a customer representation or CFS's own default, and today
nothing distinguishes them.**

## It also answers a question filed as unsettled

`inbox/2026-08-23-owner-confirms-the-client-app-attestation-is-decided-...md` lists as open:
_"whether a coordinator ticking a box binds the production company."_ ⭐ **The answer has a shape
now: bind what they have access to.** A coordinator attests **for their project**, which is the
scope their membership edge already grants — so the attestation's authority is not a new claim to
adjudicate but the access model, applied.

⚠️ **It does NOT settle whether that suffices legally.** Illinois UETA §9(a) makes attribution a
fact question — _"the act of the person… may be shown in any manner"_ — and whether a coordinator's
act binds the entity is agency law, not attribution. **What the access model gives is a defensible
boundary and a record of it, not a conclusion.**

## Consequences to carry

- **A project inherits the org default** — so the chain is
  `document ?? project ?? organization ??
  derived`, **four rungs, not three.**
  `resolveJurisdiction` implements three today.
- ⚠️ **Inheritance and attestation run in OPPOSITE directions.** The default flows **down** the tree
  (org → project → order); the authority to assert flows **up** only as far as the edge reaches,
  which for a large customer is one level from the bottom. **The rung the default lives at is not a
  rung anyone can attest at.**
- ⭐ **An org with exactly one project is the general shape with N=1**, per `ADR-0032` §3 — _"the
  API mints the level, records that it derived it, and the UI suppresses it."_ ⇒ Kenwood, where the
  org claim genuinely IS the customer's standing statement, is the N=1 case rather than a different
  rule. **Same mechanism, and the difference is only whether a human ever saw the middle level.**
