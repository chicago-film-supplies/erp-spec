---
kind: decision
title: >-
  Owner — a public client app is IN SCOPE with three capabilities: real-time stock availability,
  quote request, and checkout for in-store orders — which gives ADR-0005's unnamed second client a
  purpose and puts a money path in front of the public
contexts: [ordering, availability, billing, banking]
source: "Owner, 2026-08-18, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

> _"a public client app with real time stock availability, quote request, checkout for in store
> orders is in scope so that should be added somewhere"_

Added to `charter.md` → **In scope**, same session.

## What it settles

`ADR-0005` (keep SolidJS clients) is **accepted and frozen**, and its Context already says:

> "A second client (a public web app) is on the roadmap and will share much of it as a package."

It decided the framework — _"Keep SolidJS for all clients"_ — for an application **whose purpose was
never written down anywhere.** This ruling supplies it. Frozen, so `relates_to` is the only thing
that may gain an id (ADR-0034); nothing in ADR-0005's body changes.

## The three capabilities, and they are not one feature

|                                  | context              | why it is not routine                               |
| -------------------------------- | -------------------- | --------------------------------------------------- |
| **Real-time stock availability** | `availability`       | the hard one — see below                            |
| **Quote request**                | `ordering`           | the intake event; Resend then sends the draft quote |
| **Checkout for in-store orders** | `billing`, `banking` | a **money path**, exposed to the public             |

⚠️ **All four named contexts are among those with the least coverage.** `ordering`, `availability`
and `banking` each have **zero requirements** today — three of the four empty contexts in the repo —
and this is now the first concrete thing each has to describe.

## ⚠️ Three things that are bigger than they look

### 1. "Real-time" to the PUBLIC is not the problem SPIKE-009 is scoped to

`SPIKE-009` asks what replaces Firestore real-time listeners — "MongoDB change streams plus a socket
layer" — and `ADR-0005` calls it _"the largest hidden line item in the migration."_ Both are written
against the **operator UI**: a handful of authenticated staff.

A public app changes the fan-out profile, the auth model and the abuse surface at once. The spike's
question as written does not cover it, and a spike that answers for the manager and is read as
having answered for the public is the failure mode. **SPIKE-009 should be rescoped before it runs.**

⇒ This is the same shape found earlier the same day: `ADR-0028` depends on `SPIKE-011`, whose exit
criteria size TigerBeetle's storage and not the nine-container tier the ADR puts on the same host.
**Two open spikes, each scoped narrower than the decision that depends on it.** There is a precedent
for the fix — commit `8921cfa` rescoped `SPIKE-007` to what `ADR-0017` left open.

### 2. Availability is already decided to be interval-based, and a public reader stresses it

`ADR-0015` (proposed) records that availability is computed from **raw intervals**, and that
decomposing to a per-day rollup **oversells** — with `held = 2` and bookings on days 1–2 and 4–5,
the window `[1,5]` is exactly 0 while a daily curve says 1. It also scopes reservations to the
operational window only, leaving forward-booking conflicts to the interval engine.

**"Real-time stock availability" on a public app is a read of exactly that engine, at a cadence and
volume nobody has sized.** The correctness argument is settled; the serving question is not asked
anywhere.

### 3. Checkout is accounting-shaped and the term is ambiguous

Checkout takes money. That reaches the card-fee treatment, `4700 - Transaction Fee Income`, the
`2101`–`2110` card block, and settlement — so whatever ADR specifies it is
**`accounting_shaped:
true` and owes a rule 8a survey** (six references) before acceptance, not
after.

⚠️ **"Checkout for in-store orders" has at least two readings and they are different systems:**

- a customer **pays online for an order raised in-store** (a payment surface over an existing
  order), or
- a customer **places and pays for an order to collect in-store** (an intake surface that also takes
  money).

The first needs no ordering flow; the second is a second intake path beside quote request. **This is
an `OQ-`, not an assumption.** Recording it now because the ambiguity is invisible once someone
picks a reading and builds on it.

## What this owes

- **An `OQ-`** on the checkout reading above, owned and dated.
- **Requirements** in `ordering`, `availability` and `billing`/`banking` — the promotion path for
  this note (`promotes_to:` gets written at triage). This is `erp-spec#6`'s backlog gaining its
  first non-optional entries.
- **A domain event** for the online quote request, and one for checkout.
- **`SPIKE-009` rescoped** to cover a public real-time reader, or a second spike that does.
- **`ADR-0005` gains this note's id in `relates_to`** — the correction index, not an edit.
- **`ADR-0027`'s Resend scope grows** — the draft quote is a commercial document to a counterparty,
  not account mail, and it crosses `ADR-0028` because Gotenberg renders it. Volume is measured in
  `inbox/2026-08-18-online-request-volume-and-the-mapbox-population-measured-so-adr-0027s-stated-unknown-is-closed.md`
  — **peak 16/month, not the 3.5 mean.**

## Not established

- **What a quote request contains.** No field set exists anywhere; it is the first input the
  `ordering` requirement needs.
- **Whether the public app ships before or after the v2 cutover.** If before, it runs against the
  **v1** API and DB, which is a different sequencing problem from the one `roadmap/milestones.yaml`
  describes.
- **Whether "real-time" means push (sockets) or poll.** The charter bullet says real-time; only a
  requirement can say what latency and what mechanism, and the two have very different costs.
- **Whether public availability shows quantities or only in/out of stock.** A public quantity feed
  is a disclosure decision as much as a technical one.
