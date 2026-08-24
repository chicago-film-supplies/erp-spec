---
kind: decision
title: >-
  Owner — the Quo contact sync is a one-way push with manager authoritative, which removes the
  cross-boundary merge entirely; and storing the text thread is open, with the evidence framing
  changing its calculus
contexts: [fulfillment, ordering]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> quo contact sync is a push manager is authoratative, its just to make it easier for delivery
> workers to text contacts they're on the way. i like the idea of storing the text thread for
> posterity, though its likely more trouble than its worh, we should still consider it

## ✅ The hard half of `OQ-060` is answered, and it dissolves rather than resolves

**One-way push. Manager is authoritative.** ⇒ there is **no bidirectional sync, no conflict, and no
cross-boundary three-way merge.** The note written hours earlier framed this as _"the three-way
merge problem again, across a system boundary… no shared base to diff against"_. **That problem does
not exist**, because there is only one writer.

⭐ **And the purpose is smaller than the mechanism suggested**: _"just to make it easier for
delivery workers to text contacts they're on the way."_ Quo is a **convenience surface for a field
worker**, not a system of record for customer relationships. **Scoping it as the latter would have
been the expensive mistake**, and the sentence that prevents it is the one about delivery workers.

⚠️ **`ADR-0009` still applies but shrinks.** CFS never reads identity back from Quo, so translation
is one-directional. ⭐ **And it may vanish entirely**: if Quo dedupes on phone number, CFS stores no
Quo identifier at all and the anticorruption obligation is satisfied by construction rather than by
a mapping table. **Worth establishing before building one** — an unnecessary id mapping is a
permanent maintenance cost.

## The remaining question — storing the text thread

Owner: _"i like the idea of storing the text thread for posterity, though its likely more trouble
than its worh, we should still consider it."_

⚠️ **The "not worth it" instinct is right IF the photos are a courtesy. It is wrong if they are
evidence** — and the same session established that jobs 2 and 3 are **proof of delivery and proof of
condition**.

⭐ **The criterion, which is worth more than the default**: **a photo in a CDN proves you took a
picture. It does not prove you told the customer.** If the reason for photographing a delivery or a
trash pickup is to settle a later dispute — _"you never delivered it", "the bins were not emptied"_
— then **the transmission is half the proof, and the thread IS the transmission record.**

⇒ **The question is not "is a thread worth storing" but "what are the photos FOR".**

- **Courtesy / customer experience** — the thread is genuinely more trouble than it is worth. Store
  the photo, forget the message.
- **Dispute evidence** — the thread is not optional, and storing the photo without it is the weaker
  half of a pair. ⚠️ Trash pickups in particular sound dispute-prone; whether that is a real posture
  or an imagined one is **unmeasured and should be asked rather than assumed.**

⚠️ **Do not treat this as decided by the argument above.** It gives the criterion, not the answer —
the same distinction rule 8a draws for accounting surveys, where the criterion outlived the default.

## Where it connects

- **`OQ-049`** — do the board and threads survive into v2. A Quo thread is a _second_ thread family
  beside `threads`/`comments`, and **that question already flags attachments explicitly.**
- **`OQ-051`** — where the chat seam sits, CFS implements or integrates. A stored Quo thread is a
  concrete instance of that seam, arriving before the seam is decided.
- **erp-spec#49** — the evidence retention lock. If the thread is evidence it inherits the retention
  duty, and it lands in the same argument as the photos and the Gmail evidence picker.
