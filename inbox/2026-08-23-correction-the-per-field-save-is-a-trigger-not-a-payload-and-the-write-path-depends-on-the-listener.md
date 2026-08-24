---
kind: correction
title: >-
  Correction — save-on-focusout is a TRIGGER, not a payload: the write sends a whole-entity diff
  under document-level optimistic concurrency, so per-field saves do not give per-field conflicts,
  and the write path's own recovery depends on the realtime listener it is losing
contexts: [ordering, billing, fulfillment, availability]
source: "code:2026-08-23:manager@fd2fd54:src/primitives/createEntityCache.ts + code:2026-08-23:api-cloudrun@bbb791af:src/lib/version.ts"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## ⚠️ What was wrong

Hours earlier, in
`inbox/2026-08-23-owner-rules-the-realtime-replacement-and-folds-offline-with-queued-writes-into-it.md`,
the R6 addendum recorded this as a consequence of the owner's save-on-focusout note:

> ⭐ **Conflict granularity is the FIELD, not the document.** Save-on-blur means the queue fills
> with per-field writes, so two people editing different fields of the same order **do not conflict
> at all**.

**That is false, and it was reasoned rather than measured.** It was used to argue that queued writes
are **cheaper** than they had been priced. They are not.

## What is actually true

`update(id, field)` takes a field name, but the field name only selects **what to VALIDATE**. The
payload is built by `buildDiff`, which diffs the **whole entity** against the last server snapshot
and sends every differing top-level key plus `uid` and `version`.

⇒ **The trigger is per-field. The payload is a whole-entity diff under DOCUMENT-level optimistic
concurrency.**

`checkVersion` throws `409 PreconditionError` on any mismatch —
`code:2026-08-23:api-cloudrun@bbb791af:src/lib/version.ts` — and is called from **23 service files**
including orders, invoices, contacts and products. **21 manager caches declare `versioned: true`**
across 17 stores.

⇒ two operators editing **different** fields of one order **do** collide. The second one's `version`
is stale and the write 409s.

## ⭐ Why it does not bite today, which is the whole point

The 409 path **rebuilds the diff against the concurrent writer's state and re-sends** — and it gets
that state from **the Firestore listener**. The client also patches `latestSnapshot.version` from
the response opportunistically, _"so a rapid-fire second queued write doesn't round-trip through a
stale-version 409 while waiting for the Firestore listener."_

**The listener is what keeps `version` fresh, and that is why concurrent field edits feel
conflict-free today.** It is a property of the realtime transport, not of the write path.

## ⭐⭐⭐ And the finding that is larger than the correction

The **unknown-outcome** path — a 5xx, a network failure, a timeout — is reconciled by observing the
listener. Verbatim from the source:

> Don't trust the failure: reconcile by observing the server. Wait for the listener, then re-enter
> the loop to rebuild the diff against whatever the server now holds — if the write landed, the
> listener delivers the bumped version and the rebuilt diff is empty (resolves as SUCCESS, killing
> the false "save failed"); if it didn't, we re-send. Safe without idempotency keys because every
> write is version-gated.

⇒ ⚠️⚠️ **THE WRITE PATH'S CORRECTNESS DEPENDS ON THE REALTIME LISTENER.** A committed-but-unacked
write (api-cloudrun#247 — a same-doc PUT burst can time out or phantom-500 _after_ Firestore
committed) is resolved **only** by watching the server state arrive. There is no idempotency key,
and the source says so explicitly: **the version IS the idempotency key**, and the listener is how
the client learns it.

**This is not the `waitUntil` finding.** SPIKE-009 criterion 3 recorded a 2-second `waitUntil`
deadline at eight sites. This is deeper: it is the **core write path of every versioned entity**,
all 21 of them.

## Consequences, and they cut against the cheap reading

1. ⚠️ **Offline, the snapshot baseline FREEZES.** Every edit made offline accumulates against a
   version that is stale by however long the disconnect lasted, so **every queued write replays into
   a 409** if anyone else touched the document.
2. ⚠️ **Queued writes cannot resolve their own fate offline.** Both recovery paths — the 409 rebuild
   and the unknown-outcome reconcile — need fresh server state from a listener that, by definition,
   is not there.
3. ⚠️ **Replay is not "send the queue".** The first replayed write bumps the version, so the second
   carries a version already stale by its own predecessor. **Replay must re-read, re-base and
   re-diff** — which is where conflict resolution actually lives, not in the popover.
4. ⇒ **Per-field payloads plus a server-side field-level merge are a CHANGE TO THE WRITE PATH**, not
   something that already exists. The cheap reading assumed it was already there.

## ⭐ This retrospectively vindicates folding SPIKE-009 and SPIKE-013 into ONE ADR

The split was argued for on the grounds that offline is new capability and the transport question is
independent. **It is not independent.** The write path's recovery is defined in terms of the
listener, so a decision about what replaces the listener and a decision about offline writes are the
same decision seen from two sides. **The owner's ruling was right for a reason neither side had at
the time it was made.**
