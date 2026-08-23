---
kind: decision
title: >-
  Owner confirms the customer-facing jurisdiction attestation is DECIDED, not merely proposed —
  which upgrades a note that was deliberately filed as a hedged input, and adds a fourth capability
  to the client app the charter still describes as having three
contexts: [tax, ordering]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> we also already decideed on some client ui for the customer to attest to the use jurisdiction

## Why this note exists rather than an edit

⭐ **The 2026-08-22 note was filed as `kind: decision-input`, `confidence: medium`,
`verified: false`, `promotes_to: []` — deliberately, because the owner's phrasing was hedged**
(_"**maybe we should** make it an active path in a client app"_) and a hedge is not a ruling. That
filing was correct at the time.

⇒ **the owner has now removed the hedge, and `inbox/` is append-only, so the upgrade is a new dated
note rather than a rewrite of the old one.** The 2026-08-22 file stays exactly as written; this is
the record that its direction became a decision.

## What is now decided, and what still is not

|                             |                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| ✅ **decided**              | the customer attests **directly**, in a customer-facing surface, riding the rental-agreement surface                               |
| ✅ **decided** (2026-08-22) | **no third-party signing vendor**; attestation is **PRIMARY** and the operator-recorded claim is the **FALLBACK** for phone orders |
| ✅ **decided** (2026-08-18) | the public client app is in scope                                                                                                  |
| 🟡 **design input only**    | what the attestation captures — hash the rendered instance, capture the act, hash-chain, email a copy                              |
| ⚠️ **NOT built**            | verified 2026-08-23 across `core`, `api-cloudrun`, `manager` and `templates`: **nothing, anywhere**                                |

⚠️ **"Decided" and "built" are different facts and the gap is total.** No attestation schema in
`core/src/schemas`; no matching route in `api-cloudrun`; nothing in `manager/src` beyond
`OAuthConsent.tsx` and `SignIn.tsx`, both staff auth; and **`templates/` holds exactly two files,
`quote.eta` and `quote.meta.json` — there is no rental agreement template.** ⇒ **the surface the
attestation is supposed to ride does not exist yet either.**

## ⚠️ The staleness this exposes, and it is in `charter.md`

The charter's in-scope bullet says the client app has **"Three capabilities: real-time stock
availability, quote request, and checkout for in-store orders."** ⭐ **The fourth — agreements and
attestations — was decided and never added**, and a charter that under-describes what is in scope is
the kind of stale statement that reads as current intent. Corrected in the same commit as this note.
Tracked at erp-spec#48.

## What this does NOT settle

- **The correction path** when an honest attestation turns out wrong — gear attested for exclusive
  Frankfort use shoots in Chicago. A dated attestation makes it _"as represented at T"_, so a change
  of use is a **new fact** rather than a contradiction — but whether that re-rates, credit-notes, or
  merely records is unstated.
- **The authority question** — whether a coordinator ticking a box binds the production company. ⭐
  **Inherited rather than new**: the rental agreement has to answer it regardless.
- **Retention**, which is 8 years and not the 7 first assumed (`inbox/2026-08-23-...` — see the
  retention note of 2026-08-22), and gates an irreversible lock.
