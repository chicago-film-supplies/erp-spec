---
kind: decision
title: >-
  Owner rules the conflict popover the wrong shape — resolution belongs in a global notifications
  menu that surfaces, and a conflict is notified PER DOCUMENT rather than per field, which matches
  both the measured finding that most of the surface is actor-vs-state and the fact that replay
  itself is per document
contexts: [ordering, billing, fulfillment]
source: "owner, 2026-08-24, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-24, on being shown SPIKE-013's criterion 4 result:

> a popover for conflict resolution is the wrong shape, it should probably be a global notifications
> menu, surfacing

⚠️ **Recorded with the hedge intact.** "Probably" is the owner's word: this is a direction that
retires the popover, not a settled specification of what replaces it. The open questions at the
bottom are genuinely open.

## ⭐ Why this lands so exactly on the measurement

`SPIKE-013` criterion 4 found that the conflicts a same-field author/timestamp popover cannot
arbitrate are mostly **not actor-vs-actor**. They are **actor vs STATE** — the invoice was paid
while you were offline, the row your edit addressed is gone, the rate moved, the field is derived,
the posting is immutable. **The second party is the system, not a second person.**

⇒ **the popover shape assumes every item is a CHOICE**, and most of them are not:

| what happened             | is it a choice?                                                         |
| ------------------------- | ----------------------------------------------------------------------- |
| both moved the same field | ✅ yes — this is the only one a popover was ever right for              |
| the document is closed    | ⛔ no — the merge is refused; there is nothing to pick                  |
| the row is gone           | ⛔ no — the edit has no target; it failed rather than conflicted        |
| the field is derived      | ⛔ no — it is recomputed, never chosen from a side                      |
| both added different rows | ⛔ no — it is a union; asking "yours or theirs" discards someone's work |

**A widget that can only ask a two-option question has no question to ask in four of five rows.**

## ⭐⭐ What a notifications surface buys that a popover cannot

- **It is ASYNCHRONOUS, and the offline case makes that structural.** An operator reconnecting after
  a day out of signal may be replaying dozens of writes across many documents. A popover per
  conflict is a queue of modal interruptions **at the worst possible moment** — the moment they get
  signal back and are trying to do something else. A notifications surface is one badge.
- **It is HETEROGENEOUS.** Refusals, failures, genuine conflicts and rejected replays are different
  kinds with different remedies. A menu can carry them as distinct items; a popover flattens them
  into one gesture.
- ⭐ **It SURVIVES THE OPERATOR'S ABSENCE, which a popover cannot by construction.** SPIKE-013's
  exit criterion 3 already demanded this — _"a write that fails validation on replay lands somewhere
  a human sees it, with the field named; measured with the operator absent, which is the case that
  makes it hard."_ **The prototype built a durable failure inbox to satisfy it**
  (`spikes/harness/offline-queue/`), which is this surface in miniature and was arrived at from the
  criterion rather than from the shape.
- **It is GLOBAL, so it needs no per-site wiring.** SPIKE-013 showed the per-field state is a pure
  function of the queue; the same is true of the notification list. Neither needs a hook at any of
  the save-on-focusout sites.
- **It has room for things that were never conflicts** — a blob that failed to upload, a replay
  still in flight, "14 writes pending".

## ⭐⭐ Per document, not per field — and it gives the surface an INVARIANT

The second ruling is the sharper one, because it is not merely a display choice.

⭐ **Replay is already per document.** SPIKE-013 Finding 1 established that replay is not "send the
queue": the first write bumps the version, so each document must be **re-read, re-based and
re-diffed** on its own. ⇒ the unit of replay is the document, and notifying per document makes the
notification unit and the replay unit **the same unit**.

⇒ **one notification ⟺ one document whose replay is held back.** It appears when a document's replay
cannot complete and it clears when that replay succeeds — not when a human has looked at it, and not
when some of its fields have been decided. That is a testable invariant rather than a convention,
and it is the kind of thing the prototype's assertions can carry.

⇒ **the notification is an invitation to open the document, not a decision in itself.** Resolution
happens in the document's own context, where the operator can see the fields in the rows they belong
to — which is the thing a floating widget over one input cannot show.

⭐ **And it dissolves a volume problem the popover would have had.** An order carries a median of 8
rows and up to 150. Per-field notification of a document with eight conflicting lines is **eight
notifications for one job**; per-document is one, carrying a count.

⭐ **All four kinds roll up to a document, so the unit is consistent** rather than being right for
conflicts and awkward for everything else: a refusal is a property of the document, a failed row
belongs to one, a rejected replay is a document's write, and even a failed blob upload attaches to a
document and a field. **Nothing in the surface needs a second granularity.**

## ⚠️ What it does NOT replace

**Per-field indicators.** Criterion 6 asks that offline / pending / synced be derivable **at every
save-on-focusout site**, and a global menu does not tell an operator that the field under their
cursor is unsaved. **The two coexist**: the field says what is happening to it, the menu says what
needs a person.

## Open questions this raises

0. ⚠️ **Does a partly-resolved document stay notified?** The invariant above says yes — it clears
   when the replay succeeds, so deciding three of four conflicting fields leaves it open. That is
   the behaviour that cannot silently drop the fourth, but it needs confirming rather than assuming,
   because it also means an operator can leave a document diverged indefinitely (see 4).
1. **Is it the same surface as other operational notifications?** CFS already has alerting and
   operational events. One inbox for "your offline edit conflicted" and "a template publish failed"
   is either an obvious consolidation or a category error, and which one is not obvious.
2. **Can an item be dismissed, and what happens to the edit if it is?** A refused merge on an
   invoice that was paid while you were away leaves an edit that can never be applied. Dismissing it
   discards work. **Silently discarding an operator's typing is the failure this whole spike exists
   to avoid**, so the dismissal semantics are load-bearing rather than cosmetic.
3. **Where does read/dismissed state live?** It is itself state that has to survive a session, and
   with a public client app in scope it may need to be per-actor rather than per-device.
4. **Does anything ever BLOCK?** If a conflict on a money field is left unresolved indefinitely, the
   document sits diverged. Whether that is acceptable, or whether some classes must be resolved
   before further editing, is a decision the ADR owes.

⇒ Feeds the shared `SPIKE-009` + `SPIKE-013` ADR (erp-spec#51), which now owes a position on the
resolution surface's **shape** and not only on the merge algebra.
