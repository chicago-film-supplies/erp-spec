---
kind: decision
title: >-
  Owner: contacts will log in to view orders and invoices, place orders, and manage access control
  and contacts for their own project — which requires row-scoped permissions that do not exist in
  any form today, and inverts the authorization conclusion recorded hours earlier
contexts: [ordering, billing, tax]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> we should expect contacts to log in to view orders, invoices make new orders manage access control
> and contacts for their project, that will require som scoped permissions we potentially dont have
> today

## ⚠️⚠️ This INVERTS `SPIKE-009` criterion 4, recorded hours earlier the same day

That criterion concluded, from a live-verified read of `firestore.rules`:

> **No rule in the file references `resource.` at all** … every read rule is COLLECTION-scoped,
> never document-scoped … ⇒ **there is no per-document authorization decision to reproduce** … the
> whole v2 obligation is a per-`(user, collection)` boolean … **there is no redaction and no
> row-level scoping anywhere to carry across.**

⭐ **Every word of that is true, and the conclusion was stated unconditionally when it was
conditional.** It holds for an **operator-facing** application, which is the only application that
exists today. **The moment a customer logs in, per-document authorization becomes mandatory** — and
it is the one thing the current model has no machinery for whatsoever.

⚠️ **This is the repo's own footgun in a form worth naming: a finding measured accurately against
the CURRENT system, generalised into a claim about the TARGET one.** The same mistake as verifying
`project` against the v1 schemas earlier today, and it recurred within hours of that correction.

## The vocabulary cannot express it — verified, not assumed

`code:2026-08-23:core@ccaf327:src/schemas/permissions.ts`. **Every permission is
`<resource>.<verb>`**: `orders.create`, `orders.read`, `orders.update`, `orders.search`,
`orders.checkout`… **Not one carries a scope dimension.** There is no `own`, `self`, `tenant` or
`scope` concept anywhere in `permissions.ts` or `role.ts`.

⇒ **`orders.read` means EVERY order.** There is no expressible statement of the form _"read the
orders belonging to project P."_

## ⭐⭐ The mechanism already exists in the target spec — as an ADR, not as code

`ADR-0032` (the customer tree is a liability tree) already carries the scoping key, and
`glossary.yaml` states it at the settlement point:

> **Contact MEMBERSHIP EDGES belong here; the person does not.** A contact is one global record with
> N memberships, each carrying a **role** — 26 of 165 contacts are attached to two or more
> organizations today.

⇒ **the membership edge IS the scope.** A customer's permission is not `orders.read` but
`orders.read` **at the nodes their edges reach**.

⭐⭐ **And this is the SAME model that scopes the tax attestation** — `ADR-0045` P5, ruled today: a
coordinator holds project access and not org access. **One authority model answers both**, which is
a strong sign it is the right one rather than two coincidences.

## What is genuinely new, beyond scoping the reads

⭐ **"Manage access control and contacts for their project" is DELEGATED ADMINISTRATION** — the
customer administers their own users. Nobody has scoped it, and it is a materially harder problem
than scoped reads:

- **Who may grant what**, and the invariant that a delegate can never grant beyond their own scope.
- **The revocation path**, which is already unverified for operators (manager#332) and would now
  reach people outside CFS.
- **Invitation**, since a customer admin adding a contact is minting an identity.

## ⚠️ TWO authorization models, and they must not be one model retrofitted

`api-cloudrun/src/services/dbRead.ts` states the current posture deliberately:

> Documents are returned **as stored, unredacted**. That is a deliberate posture for an
> **operator-facing**, permission-gated seam… **It does mean prod PII (contacts, users, orders)
> reaches the caller: the gate is RBAC, not field-level redaction.**

⭐ **That is defensible for operators and is a data-leak surface the moment a customer holds a
token.** ⇒ **the operator model (collection-scoped, exists, well-tested) and the customer model
(row-scoped, does not exist) are different models**, and retrofitting scope onto the operator
vocabulary would make every existing permission ambiguous about which it meant.

⚠️ **And the surface is wider than the socket layer.** Every `/db/*` read route carries the same
posture, so scoping is an API-wide obligation, not a real-time-transport one.

## Consequences for `SPIKE-009`

- ⭐ **Criterion 4's conclusion stands for the operator app and must be re-scoped**, not deleted —
  the socket layer still needs the per-`(user, collection)` boolean for operators. It now ALSO needs
  a per-document predicate for customers.
- ⚠️ **This makes criterion 3's hardest item harder.** Server-side predicate re-evaluation was
  already _"the single largest genuinely-new engineering piece"_; with row-scoped authorization the
  server must re-evaluate **authorization** per event too, not just query membership.
- ⭐ **It also strengthens the socket design against a token-based one.** A socket layer holding its
  own session can push a revocation frame; a claims-in-token model cannot, and manager#332 is the
  live evidence of that difficulty.

## Not settled

- **Whether a customer's client is the same SolidJS app as the operator's or a separate one.**
  `ADR-0005` names a second client; the charter's client app now has four capabilities and this adds
  more. **Same codebase with scoped views, or a separate deployment, is an unmade decision** with
  large consequences for how the authorization split is enforced.
- **Whether customer identities live in the same `users` collection** as operators, or a separate
  one. The blast radius of a mistake differs enormously between those.
