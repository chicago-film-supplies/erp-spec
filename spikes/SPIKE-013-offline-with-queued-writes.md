---
id: SPIKE-013
headline: offline queued writes and their conflict surface
question: >-
  What does offline with queued writes actually cost, given that most fields save on
  focusout — how are writes coalesced and replayed, what identity does an offline create
  carry, and what does the conflict surface have to arbitrate beyond a same-field collision?
timebox: 1 week
method: >-
  Build the queue against the manager's existing localStorage stash rather than beside it, and
  drive it through a real disconnect: coalesce per (document, field path), replay in order,
  and force a deferred validation failure. Then enumerate the conflicts the popover CANNOT
  arbitrate, from the live corpus rather than from imagination.
exit_criteria:
  - A queued field write survives a disconnect longer than the session and replays exactly once, with three offline edits to one field replaying as one write.
  - An offline create is addressable by subsequent queued writes before it reaches the server — so the identity decision (client-generated uid or otherwise) is made and demonstrated, not assumed.
  - A write that fails validation on replay lands somewhere a human sees it, with the field named; measured with the operator absent, which is the case that makes it hard.
  - The conflicts a same-field author/timestamp popover CANNOT arbitrate are enumerated from the live corpus with a count for each, not asserted as a list.
  - Whether the undo path requires OQ-043's document event history is answered yes or no, with what breaks if it is no.
  - The offline/pending/synced state is shown to be derivable at every save-on-focusout site — the absence of an error is currently the only feedback, so this is the load-bearing half.
closes_adr: new
status: open
---

## Notes

⚠️⚠️ **THE ADR IS SHARED WITH `SPIKE-009` (what replaces Firestore listeners), BY OWNER RULING,
2026-08-23.** `closes_adr: new` on both — **they name the SAME new ADR, and a session that writes
two has misread this.** SPIKE-009's evidence is already complete and is waiting on this spike, so
**this spike is the critical path to m4's last machine-checkable criterion**, not a side quest.

**Opened 2026-08-23 at the owner's suggestion**, out of the `SPIKE-009` ADR interview. Full rulings
and their reasoning:
`inbox/2026-08-23-owner-rules-the-realtime-replacement-and-folds-offline-with-queued-writes-into-it.md`.

⚠️ **This is NEW CAPABILITY, not migration.** Firestore shipped offline persistence, but the manager
makes **zero direct client writes** (`allow write: if false` on all 38 collections —
`code:2026-08-23:manager@56e41fd:firestore.rules`), so it was never used for writes. **Nothing is
lost in the move to MongoDB**, and that is precisely why this is a spike of its own rather than a
line item inside the listener replacement.

## What is already known, and did not come from here

Three things were established during `SPIKE-009` and should not be re-derived:

- ⭐ **The write cadence is PER FIELD.** Most fields save on blur/focusout; only creates keep a
  final submit, and creates already persist drafts to the database. ⇒ **conflict granularity is the
  field**, so two operators editing different fields of one order never collide, and a deferred
  validation failure names a field rather than rejecting an opaque document. **Both make this
  cheaper than a document-submit model would.**
- ⭐ **The local-divergence machinery already exists and is tested.** `createEntityCache` overlays
  local edits on every snapshot with three-tier precedence (live dirty > stashed > server), backed
  by a `localStorage` stash epoch-versioned by `PENDING_SCHEMA_EPOCH = "cents"` so a pre-cents stash
  cannot replay values 100× low. **The queue extends this; it must not be built beside it.**
- ⚠️ **The transport must deliver SERVER TRUTH, UNMERGED.** A socket layer that echoes the client's
  own write back as authoritative makes `recomputeDirty` clear dirty fields that were never
  persisted — **a well-meant optimization that silently discards unsaved operator edits.**

## The two things the owner's conflict design does not yet cover

Recorded here because they are the exit criteria's whole point, not to relitigate the design.

1. ⚠️ **"If we're storing events" is not true for documents.** The ledger is append-only; orders and
   invoices are mutable documents with no event history, and whether the masters get one is
   **`OQ-043`, still open**. The undo path depends on it.
2. ⚠️ **Field-level conflict is not semantic conflict.** Two people fulfilling the same physical
   unit is not a popover; nor is an offline order edit replaying against a tax rate that has since
   changed, nor against an invoice that has since been paid — **which today is not even guarded**
   (api-cloudrun#648, where the rule that a paid invoice is closed is intended and not installed).
   ⭐ **Undo reverses a ledger entry with a new entry. It does not recall a van that already left.**

⚠️ **Enumerate these from the corpus, with counts.** A list of imagined conflicts is the same
mistake as a boundary that "PASSED" on 11 rows — it will look complete and prove nothing.
