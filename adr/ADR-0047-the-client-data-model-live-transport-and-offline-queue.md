---
id: ADR-0047
headline: the client's live and offline data model
title: >-
  The client data model — one live transport replacing Firestore listeners, and an offline queue
  reconciled by three-way merge
status: proposed
date: 2026-08-24
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ordering, billing, fulfillment, availability]
relates_to: [ADR-0003, ADR-0005, ADR-0012, ADR-0032, ADR-0045, SPIKE-009, SPIKE-013, OQ-043, OQ-061]
accounting_shaped: false
measurements: [] # ⚠️ DELIBERATELY EMPTY, and it is the architecture rather than an omission.
# Every figure this decision rests on was measured by SPIKE-009 or SPIKE-013, and gate 22 makes
# whoever MEASURED a figure its owner. An ADR that re-declared them would own figures it did not
# take — which is exactly what the first draft of this file did, and the gate reported the SPIKE for
# restating the ADR, with the ownership backwards. A deciding ADR CITES; a measuring spike OWNS.
# The figures are cited by id in the body: SPIKE-009/M1, SPIKE-013/M1, SPIKE-013/M3.
asserts:
  - id: D1
    kind: decision
    claim: The CLIENT persists the change-stream resume token and sends it on reconnect.
  - id: D2
    kind: decision
    claim: >-
      On resume failure the client performs a silent full resync, and it goes THROUGH
      `applyServerData` rather than around it.
  - id: D3
    kind: decision
    claim: Pre/post images are enabled on money-bearing collections only.
  - id: D4
    kind: decision
    claim: >-
      ONE shared transport serves operators, authenticated customers and anonymous visitors, scoped
      by ADR-0032 membership edges.
  - id: D5
    kind: decision
    claim: >-
      Anonymous visitors receive availability and their own draft live, scoped by session
      identifier rather than by a membership edge.
  - id: D6
    kind: decision
    claim: >-
      Offline queued writes are reconciled by THREE-WAY MERGE against a pinned base, and the base is
      PERSISTED rather than merely pinned.
  - id: D7
    kind: decision
    claim: >-
      The merge key for `items[]` is `(uid, k-th occurrence)` for leaves and `uid` for dividers.
  - id: D8
    kind: decision
    claim: >-
      The queue, the base and the failure archive live in IndexedDB; blob bytes live in their own
      IndexedDB store, never in localStorage.
  - id: D9
    kind: decision
    claim: >-
      Derived fields are excluded from the merge and recomputed, which requires an authored/derived
      partition to be carried as DATA in the schemas.
  - id: D10
    kind: decision
    claim: >-
      A terminal-state class REFUSES the merge rather than resolving it at any granularity.
  - id: D11
    kind: decision
    claim: >-
      A failed replay and a conflict are different outcomes and are never collapsed: a conflict has
      two candidate values, a failure has no target.
  - id: D12
    kind: decision
    claim: Offline creates are addressable by client-minted document ids.
  - id: D13
    kind: decision
    claim: >-
      Resolution is surfaced as a notification PER DOCUMENT, never as a per-field popover, on one
      surface shared with operational alerts and typed by kind.
  - id: D14
    kind: decision
    claim: >-
      One notification corresponds to exactly one document whose replay is held back; it clears when
      that replay succeeds, not when a human has looked at it.
  - id: D15
    kind: decision
    claim: v2 ships an offline-capable app shell, so the queue is reachable while disconnected.
  - id: D16
    kind: decision
    claim: >-
      Dismissing a notification discards the pending edit from the queue and ARCHIVES it, recoverably.
  - id: D17
    kind: decision
    claim: >-
      Nothing blocks: a document may remain diverged indefinitely, and per-field state is what makes
      that survivable.
  - id: P1
    kind: premise
    claim: >-
      The v1 write path's recovery is DEFINED IN TERMS OF the listener — there is no idempotency key,
      the version is the idempotency key, and the listener is how the client learns it.
    source: "SPIKE-013"
  - id: P2
    kind: premise
    claim: >-
      Firestore offline persistence was never used for writes: the manager makes zero direct client
      writes (`allow write: if false` on all 38 collections), so nothing is lost in the move.
    source: "code:2026-08-23:manager@56e41fd:firestore.rules"
supersedes:
superseded_by:
---

> **In the context of** ADR-0003 replacing Firestore with MongoDB and ADR-0005 keeping SolidJS,
> **facing** a client whose live reads and whose write recovery are both defined in terms of a
> listener that will not exist, **we decided** one shared change-stream transport with a
> client-persisted resume token, plus an offline queue reconciled by three-way merge against a
> persisted base and surfaced as per-document notifications, **to achieve** a client that keeps
> working out of signal without silently discarding an operator's work, **accepting** a service
> worker's cache-invalidation problem, an unbounded divergence window, and an authored/derived
> partition that has to be built before the merge can be correct.

## Context

- **The listener is the largest hidden line item in the migration, and the port surface is
  measured** (M1). ADR-0005 keeps the framework; the data layer does not survive.
- ⭐ **The two halves are one decision seen from two sides, and neither side knew it when the spikes
  were split.** The write path's recovery _depends on the listener_ (P1): `checkVersion` 409s on any
  mismatch, and both recovery paths — the 409 rebuild and the unknown-outcome path — need fresh
  server state that only the listener supplies. ⇒ "what replaces the listener" and "what happens
  offline" cannot be answered separately, which is why the owner folded them into one ADR.
- ⚠️ **Offline is NEW CAPABILITY, not migration** (P2). Firestore shipped offline persistence and
  the manager never used it for writes.
- **The conflict surface was measured and it is not what the shape assumed.** Most of it is
  actor-vs-STATE — a closed document, a vanished row, a moved rate, a derived field, an immutable
  posting — where the second party is the system, not a second person. **Four of five classes are
  not choices at all**, which is why a two-option popover had no question to ask in most of them.

## Decision

**Seventeen decisions, D1–D17 above. What each rests on is labelled, and the labelling is not
decoration:**

| resting on       | which                                                  |
| ---------------- | ------------------------------------------------------ |
| **measurement**  | D1, D2, D3 · D6–D12 (SPIKE-013's prototype and corpus) |
| **owner ruling** | D4, D5 · D13–D17                                       |

⚠️ **A measured decision and a ruled one fail differently.** A measured one is falsified by
re-measuring; a ruled one is changed only by the owner changing their mind. Presenting them alike
would make the second look re-derivable and the first look arbitrary.

## Consequences

- ⚠️ **A persisted resume token is a request for HISTORY.** A client holding one across a permission
  change can ask to replay events from when it was entitled to more. ⇒ **the server must
  RE-AUTHORIZE on resume, not merely resume**, and it must authorize the events being replayed
  rather than only the subscription being re-opened. This is the sharpest consequence of D1 and it
  is made worse by D4, which puts three audiences on one transport.
- ⚠️ **D4 and D5 give the transport three audiences and two kinds of scoping key**, and
  unauthenticated sockets carry customer data. The membership-edge model is reused rather than
  invented — it already scopes the ADR-0045 tax attestation, and one model serving two unrelated
  obligations is evidence rather than coincidence — but a session identifier is not a membership
  edge, and the two cannot share an authorization path by default.
- ⚠️ **The resync must deliver SERVER TRUTH, UNMERGED.** A socket layer that echoes the client's own
  write back as authoritative makes `recomputeDirty` clear dirty fields that were never persisted —
  **a well-meant optimization that silently discards unsaved edits.** D2's silent resync is the
  event most likely to get this wrong, and D6 makes the local stash bigger and longer-lived.
- ⭐ **D6 is strictly stronger than the version gate it replaces.** The gate discards the base, so
  it cannot tell "we both changed this" from "only one of us did" and must reject on both. Keeping
  the ancestor makes _different fields do not collide_ true **by construction** rather than as an
  accident of listener freshness.
- ⚠️ **"Persisted" in D6 is the load-bearing word.** A three-way merge needs the ancestor and a
  queue that outlives its process needs durable storage; if the queue is durable and the base is
  not, replay comes back holding `ours` and `theirs` with no `base` and **degrades silently to the
  two-way gate it was chosen to replace.**
- ⚠️ **D9 is not a rule, it is unbuilt work.** Most lines carry a derived money leaf and **no schema
  distinguishes authored from derived** (`SPIKE-013/M3`) — the measurement needed a hand-written
  list. Until that partition is data, the merge cannot be correct and cannot be tested against
  anything but itself.
- ⚠️ **D15's cost, accepted rather than assumed:** a service worker is its own cache-invalidation
  problem, and **a stale shell serving old code against a new API is a class of bug the app does not
  have today.** It is accepted because the measured alternative is worse — without it the queue
  survives a disconnect and is **unreachable**, so an operator who closes the laptop on a job site
  cannot see their own unsent work.
- ⚠️⚠️ **D17 and D13 together mean the ONLY thing making an operator resolve a conflict is noticing
  it.** That is a deliberate choice of never-interrupting over never-missing, and it rests on two
  mitigations that are therefore **load-bearing rather than nice to have**:
  - **per-field state** — offline / pending / conflicted / synced, derived from the queue alone at
    every save-on-focusout site, so the fields say they are diverged while the operator types. **If
    this is dropped, D17 must be revisited.**
  - **the kind in D13** — one surface is fine, an undifferentiated list is not. A personal
    unresolved conflict and an FYI that a publish failed have different audiences, lifetimes and
    dismissal rules, and `kind` has to be load-bearing in ordering and filtering, not a label.
- ⚠️ **D16 plus D17 give work two ways to become invisible** — dismissed-and-archived, and
  never-looked-at. ⇒ **the archive's REACHABILITY is what matters, not its existence.** Where it
  lives is adjacent to `OQ-061` without being the same question: OQ-061 recovers a value that WAS
  applied, this preserves one that never was. **They may share a mechanism, and if they do, one
  store is cheaper than two** — establish that before building either.
- ⭐ **D14 gives the surface a testable invariant rather than a convention**: replay is per document
  (each must be re-read, re-based and re-diffed, because the first write bumps the version), so the
  notification unit and the replay unit are the same unit. All four outcome kinds roll up to a
  document, so **nothing in the surface needs a second granularity.**
- ⚠️ **D7 is a MIGRATION constraint and must not be read as a v2 data rule.** `SPIKE-013/M1` is a
  figure of the pre-cutover CRMS-shaped corpus and that share only falls from cutover onward. **The
  key is required to migrate the corpus correctly; whether v2's own data ever needs it is a
  different question** (`SPIKE-013/M1`), and `path` is not the alternative — divider uids are reused
  by name, so a rename churns every descendant path across the two versions a merge compares.
- **Ledger postings are outside all of this, by construction.** A document field has a three-way
  merge; a posting is immutable and is reversed by a further posting. **The boundary between what
  merges and what posts is the line D6–D12 stop at.**

## Considered options

- **Two transports** — one for operators, one for the public client. Rejected by ruling: the owner
  asked for the apps to share as much functionality as possible, and one transport with a decided
  scoping key beat two sockets or a deferred model.
- **Server-owned subscription state** instead of D1. Rejected to keep the API process replaceable —
  at the cost of the re-authorization obligation above, which is the price of that choice and not an
  oversight.
- **Per-field payloads with a server-side field-level merge.** Not chosen, and worth recording that
  it is a **change to the write path** rather than something already present: save-on-focusout is a
  TRIGGER, not a payload — the field name chooses what to validate while the whole entity diff is
  sent.
- **A same-field author/timestamp popover.** Retired by ruling and by measurement together, from
  opposite ends. ⚠️ **An earlier draft of SPIKE-013 argued against it on the grounds that orders
  carry no author — that reasoning was wrong and is withdrawn**: v2 records an actor (REQ-FUL-001),
  and v1's missing field is a v1 gap. The surviving argument is that four of five conflict classes
  are not choices at all.
