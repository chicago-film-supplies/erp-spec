---
kind: decision-input
title: >-
  Owner — make the jurisdiction assertion an active path in the client app rather than archaeology
  over an email thread; it dissolves the verifiability-versus-minimisation conflict instead of
  managing it, and rides a rental-agreement surface that is needed anyway
contexts: [tax, billing, ordering]
source: >-
  Owner, 2026-08-22, in session. Client-app scope from
  `inbox/2026-08-18-owner-the-public-client-app-is-in-scope-real-time-availability-quote-request-and-in-store-checkout.md`
  and `adr/ADR-0005:24`.
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

> _"maybe we should make it an active path in a client app, confirm exclusive use in x jurisdiction
> kind of thing, we'll need a surface to facilitate rental agreements anyway"_

## ⭐⭐ This is strictly better than the picker, and not only because it is easier

The Gmail picker was designed to **recover** an assertion that happened in correspondence. An
attestation surface makes the assertion **happen as a first-class act**. Four consequences, and the
second is the one that matters most:

**1. The evidence becomes structured and first-party.** Instead of _"somewhere in this thread the
customer said they'd use it in Frankfort"_, the record is: **customer X, at time T, affirmatively
confirmed exclusive use in Frankfort for order Y, against clause version V.** That is better
evidence than an email, not merely cheaper to obtain.

**2. ⭐⭐ IT DISSOLVES THE PII CONFLICT RATHER THAN MANAGING IT.** The whole tension in the previous
design — verification needs raw unmodified MIME, minimisation wants less, **and redaction is
impossible because it breaks the DKIM signature** — **simply does not arise.** A structured
attestation contains exactly the data the purpose requires and nothing else: no unrelated
conversation, no third parties' words, **no crew lists riding along in an attachment for seven
years.** The hardest problem in the picker design is not solved, it is _absent_.

**3. It moves the assertion to the right party.** Today an operator records a claim **about** the
customer. In the client app **the customer makes the claim themselves** — their representation
rather than CFS's reading of their email. That is materially stronger under a control test that asks
what the customer asserted.

**4. It rides infrastructure needed anyway.** A rental-agreement surface needs identity, versioned
terms and a record of acceptance. **The jurisdiction attestation is one more clause on it**, not a
separate build.

## What it still needs, and the discipline transfers rather than disappears

⭐ **The hash discipline moves from the email to the CLAUSE TEXT.** An attestation is only evidence
if what was agreed to is retrievable exactly. ⇒ **clause text is versioned and immutably
snapshotted**, and the record names the version. _"They accepted v3"_ is worthless unless v3's text
can be reproduced. **Same rule, much smaller artifact.**

Attributability needs: authenticated identity, timestamp, the clause version, and the order it binds
to. ⚠️ **And the authority question is real but not new** — whether a coordinator clicking a box can
bind the production company is a question **the rental agreement already has to answer**, so
jurisdiction inherits the answer rather than needing its own.

## ⚠️ Two things the spec must decide that the picker never raised

**1. What happens when the representation turns out wrong.** Gear attested for exclusive Frankfort
use ends up shooting in Chicago. The attestation was honest; the tax position is now wrong. ⭐
**This is a strength of the design rather than a hole** — a dated attestation makes it _"as
represented at time T"_, so a change of use is a **new fact rather than a contradiction**. But the
spec must say what the correction path is: does it re-rate, does it credit-note, does it simply
record?

**2. Not every order flows through the client app.** Phone orders, standing relationships,
CFS-entered work. ⇒ ⭐ **the reordering is the real output of this idea**: **client-app attestation
becomes the PRIMARY mechanism, and the operator-recorded claim with attached correspondence becomes
the FALLBACK** for orders that never touch it. The picker is not cancelled — it is demoted from the
mechanism to the exception, which is a much smaller and less permission-hungry thing to build.

## What it does to the client app's scope

`ADR-0005:24` already anticipates _"a second client (a public web app) … will share much of it as a
package"_, and the 2026-08-18 ruling gave it three capabilities: real-time availability, quote
request, and in-store checkout. **This adds a fourth: agreements and attestations.**

⚠️ **And it lands on the same empty ground.** `ordering`, `availability` and `banking` have **zero
requirements** between them, and `tax` now joins the list of contexts the client app is the first
concrete thing to describe. **The client app is becoming the forcing function for four contexts at
once**, which is worth noticing before it is discovered by accident.
