---
kind: decision-input
title: >-
  Owner: an org-level or project-level jurisdiction is a default override for NEW ORDERS based on
  the customer's stated intended use — so level 2 is a determination, not a weaker signal consulted
  when the order is silent
contexts: [tax, ordering]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, verbatim:

> rantoul and frankfort at the org level (or project level) are default jurisdiction overrides for
> new orders based customer stated intended use

## What it settles

⭐⭐ **The precedence chain reads like a ladder of decreasing confidence, and it is not one.** The
org/project rung is an **assertion of the same kind** as a per-order one — made once rather than
repeated. **Specificity governs** (owner, 2026-08-22) because a later statement supersedes a
standing one, **not** because the per-order value is more trustworthy.

| level          | what it is                                                  | kind              |
| -------------- | ----------------------------------------------------------- | ----------------- |
| `document`     | this order's own statement of intended use                  | **determination** |
| `organization` | the customer's standing statement, applied to new orders    | **determination** |
| `derived`      | nobody stated anything; the address and registration answer | **the fallback**  |

⇒ **the fallback/determination line falls BELOW both assertion levels, not between them.**

⭐ **And it names the REASON, which `OQ-056` had been circling.** The reason on an override is **the
customer's stated intended use** — for both rungs, in every case. That confirms the owner's
2026-08-22 framing (_"the reason in both cases is obvious, its just the evidence thats not"_): an
enum over one value buys nothing, and **what is missing is the evidence that the statement was
made**, not a taxonomy of why.

## ⚠️ Two implementation notes, and neither is a defect

**CFS has no project entity** — verified 2026-08-23, no `project` in `core/src/schemas/`. A project
maps onto an order, so **"project level" is the `document` rung.**

⭐ **The org claim is SNAPSHOTTED but not SEEDED, and those differ in the record rather than in the
tax.**

- ✅ **Snapshotted** — `buildOrganizationSnapshot` mirrors `Organization.jurisdiction_claim` onto
  the document at write, so a later change to the customer master **cannot restate a stored order.**
  That is the _"snapshot on the DOCUMENT, derive on the MASTER"_ rule already correctly applied.
- ⚠️ **Not seeded onto the destination** — the order form's empty option **is the inherit option**,
  and its stored value is `null` rather than a member
  (`code:2026-08-23:manager:src/components/orders/DestinationJurisdiction.tsx` — _"`""` is the
  inherit option — the stored value is `null`, not a member"_).

⇒ **a destination reading `null` means "inherit", so an order whose use was affirmatively determined
to be Frankfort — matching the standing claim — is indistinguishable from one where nobody looked.**
Same tax, different facts.

⚠️ **This is `ADR-0045` D1's problem one rung up**, and it is why the LEVEL rather than the value is
the thing worth storing: `resolveJurisdiction` already returns `organization` for the inherit case
and `document` for the explicit one, and **that distinction is computed and discarded.**
