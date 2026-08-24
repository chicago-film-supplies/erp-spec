---
kind: decision
title: >-
  Owner rules the six realtime-replacement decisions in one sitting — one shared transport with
  ADR-0032 membership edges as the scoping key, three audiences including anonymous, and offline
  with queued writes folded into the same ADR despite resting on no spike evidence
contexts: [ordering, availability, fulfillment, billing]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Interview conducted after `SPIKE-009` criteria 1 and 2 landed, to settle what its ADR decides.
**Three of the six rulings rest on measurement; three do not, and the split is the point of this
note.**

## ⭐ The structural fact the interview surfaced, which no criterion had

Owner, 2026-08-23:

> we have an option for customers, there is a public client app element to this (where customers,
> logged in or not can make orders, this is a different app than manager and would be an acceptable
> entry point for customer order/invoice/access control etc... management, it will share a ton
> functionality with manager likely via a client component package)

⇒ **There are TWO client apps, not one**, and the customer surface is its own application sharing a
component package with `manager`. This is a better answer to erp-spec#50's warning — _"it must not
be the operator vocabulary retrofitted"_ — than anything the spike proposed, because the customer
vocabulary gets its own app rather than a widened operator one.

⚠️ **And a THIRD audience nobody had counted: anonymous.** Customers may place orders **without
logging in**. Today the only anonymous surface in the entire system is `stock`
(`allow read: if true`, pre-reduced to `{start, end, quantity, kind}` intervals) —
`code:2026-08-23:manager@56e41fd:firestore.rules`.

## The six rulings

| #  | ruling                                                                    | rests on     |
| -- | ------------------------------------------------------------------------- | ------------ |
| R1 | The **client** persists the resume token and sends it on reconnect        | measured     |
| R2 | On resume failure, **silent full resync**                                 | measured     |
| R3 | Pre/post images on **money collections only**                             | measured     |
| R4 | **One shared transport**; `ADR-0032` membership edges are the scoping key | owner ruling |
| R5 | Anonymous visitors get **availability plus their own draft** live         | owner ruling |
| R6 | **Offline with queued writes is folded into the same ADR**                | owner ruling |

### R1 — the client persists the token

Chosen over server-owned subscription state, to keep the API process replaceable. The owner asked
for the downsides; five were given, and **the second is load-bearing against R4**:

- ⚠️ **A persisted token is a request for HISTORY.** A client holding one across a permission change
  can ask to replay events from when it was entitled to more. ⇒ **the server must RE-AUTHORIZE on
  resume, not merely resume**, and it must authorize the events being replayed rather than only the
  subscription being re-opened.
- The post-batch-token trap lands on every client author (one word, invisible until a reconnect) —
  mitigable only by putting it in the shared primitive so no site gets to choose.
- A server-internal encoding is now persisted on an untrusted device; forged or ancient tokens need
  validation and rate limiting.
- Multi-tab races under one storage key need per-subscription keying.
- Measured retention is generous but is a WiredTiger artifact, not a guarantee on the ADR-0013 host.

### R2 — silent full resync, and the trap it must avoid

⚠️ **The resync must go THROUGH `createEntityCache.applyServerData`, never around it.** Criterion 3
recorded that the manager already overlays local divergence on every snapshot with three-tier
precedence (live dirty > stashed > server), and that **the new transport must deliver SERVER TRUTH,
UNMERGED** — a socket layer that helpfully echoes the client's own write back as authoritative makes
`recomputeDirty` clear dirty fields that were never persisted. A silent resync is exactly the event
most likely to get this wrong, and R6 makes the stash bigger and longer-lived.

### R4 — one transport, and what it commits

Owner: _"i prefer the apps to share as much funcitonality as possible"_, confirmed as **one
transport with the scoping key decided** rather than two sockets or a deferred model.

⭐ The scoping key already exists in the target spec: `ADR-0032`'s contact **membership edges**,
each carrying a role at the `(project × department)` leaf. Criterion 4 noted the same model scopes
the `ADR-0045` tax attestation — **one model serving two unrelated obligations is evidence it is
right, rather than two coincidences.**

⚠️ **R5 adds a scoping key that is NOT a membership edge**: an anonymous draft is scoped by
**session identifier**. So the transport has three audiences and two kinds of key, and
unauthenticated sockets carry customer data.

### R6 — offline, and the scope cost stated and accepted

Owner picked **manager out on location** (hours of poor signal) **and the client app basket**, then
folded the whole thing into this ADR after the cost was put plainly.

**The distinction that was clarified, because the obvious reading is wrong.** Both options queue
locally and both go through the API. The difference is **who presses submit, and whether the app has
already told the user "saved"**:

- _Extend the stash_ — the form currently on screen survives a blip. Nothing ever submits on its
  own; you come back, press save yourself, and get the validation error to your face.
- _Queued writes_ — you press save **while offline**, the app accepts it, and replays it later
  **without you there**. ⇒ ordering matters, many items are in flight, and **a write can fail
  validation hours later when nobody is watching.** The cost is not the queue. It is having promised
  a write succeeded before it could be validated, and needing somewhere for _"actually, it didn't"_
  to land.

⇒ **"Hours on location" forces queued writes** — a crew's whole shift of check-ins does not fit in
one on-screen form.

#### The owner's conflict-resolution design

> the thing to get right will be a common conflict resolution surface in the client apps, probably
> just a popover with author/timestamp choose, if we're storing events it should be simple enough to
> undo if a superior team member disagrees with the choice (that way we dont have to go crazy with
> authority hierarchy)

Sound, and deliberately trading an authority hierarchy for a human tiebreak. **Two things it does
not cover, both raised and neither yet answered:**

1. ⚠️ **"If we're storing events" is not true for documents.** The _ledger_ is append-only; orders
   and invoices are mutable documents with no event history, and whether the masters get one is
   **`OQ-043`, still open**. ⇒ **this ruling forces OQ-043 to be answered yes**, and the ADR cannot
   pretend otherwise.
2. ⚠️ **Field-level conflict is not semantic conflict.** Two people editing `qty` is a popover. Two
   people fulfilling the same physical unit is not, nor is an offline order edit replaying against a
   tax rate that has since changed, nor against an invoice that has since been paid — which today is
   not even guarded (api-cloudrun#648). **Undo works on a ledger entry, which is reversed by a new
   entry. It does not work on a van that has already left.**

#### ⚠️ What folding R6 in costs, stated before the choice and accepted

- **Offline is NEW CAPABILITY, not migration.** Firestore shipped offline persistence, but the
  manager makes **zero direct client writes** (`allow write: if false` on all 38 collections), so it
  was never used for writes. **Nothing is being lost in the move**, so nothing forces this into the
  migration ADR.
- ⇒ **m4's last machine-checkable criterion now waits on a large new design** that touches conflict
  resolution and OQ-043, rather than on the transport question `SPIKE-009` actually asked.
- ⇒ ⚠️ **The ADR will decide things the spike measured NOTHING about.** `SPIKE-009`'s four exit
  criteria cover transport, resume tokens, the listener inventory and authorization. There is no
  offline evidence of any kind. **R4, R5 and R6 rest on owner rulings; R1, R2 and R3 rest on
  measurement, and the ADR must label which is which** rather than let them read alike.

## ⭐⭐ R6 addendum — the write cadence is PER FIELD, which changes the price

Owner, 2026-08-23, after the ruling:

> we should queue, an important note, most form fields save onblur/focusout very few (mostly creates
> have a final submit button and creates are still saving drafts to db, clients should be
> transparent about offline status

Four consequences, and the first two make queued writes **cheaper** than they were priced above.

1. ⭐ **Conflict granularity is the FIELD, not the document.** Save-on-blur means the queue fills
   with per-field writes, so two people editing different fields of the same order **do not conflict
   at all**. The author/timestamp popover only ever has to arbitrate a genuine same-field collision,
   which is a far smaller and far more explicable surface than "your version vs theirs".
2. ⭐ **A validation failure hours later is a FIELD-level failure.** The main cost raised against
   queued writes — _having promised a write succeeded before it could be validated, and needing
   somewhere for "actually, it didn't" to land_ — lands on one field with a known label, not on an
   opaque document submit. **That is a tractable UI; a deferred whole-document rejection is not.**
3. ⚠️ **Per-field writes need COALESCING before replay.** Three offline edits to one field must
   replay as one write, keyed by `(document, field path)`, last-write-wins. Without it the queue
   grows with keystrokes-to-blur rather than with intent, and the replay re-runs a history nobody
   needs.
4. ⚠️⚠️ **Offline CREATES force client-generated identity.** Creates are the exception that keeps a
   final submit button, and they **already save drafts to the database** — so a draft's identity is
   currently the server's to mint. Offline, it cannot be: the client must be able to create a draft,
   edit it, and reference it from subsequent queued writes **before anything reaches the server**. ⇒
   **client-generated uids are a prerequisite for offline creates**, and that is a decision about
   identity, not about transport.

### Offline status is EXPLICIT, which refines R2 rather than contradicting it

> clients should be transparent about offline status

R2 chose _silent full resync_ for the case where a stream cannot resume. That stands — it is about
**data recovery**, and a scary modal buys the operator nothing. It is now paired with an explicit
**connection and pending-write state** that is always visible.

⚠️ **Save-on-blur makes this non-optional rather than a nicety.** A field that saves on focusout and
silently does not is indistinguishable from one that saved — **the operator's only feedback today is
the absence of an error.** ⇒ the client owes a visible `offline / N pending / synced` state, and it
is the load-bearing half of the whole offline design, not chrome.
