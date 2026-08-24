---
kind: decision
title: >-
  Owner proposes a three-way merge for offline replay — play the queue against the stale base and
  against the fresh document, diff the two, and raise only genuine conflicts in the client — and
  explicitly frees the design from replicating the current system
contexts: [ordering, billing, fulfillment]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23, on being shown that document-level optimistic concurrency makes naive replay 409
on everything:

> we dont have to replicate the current system if other architectures are better suited to our
> needs, i would think we'd want to play the whole queue on stale doc, and the fresh doc, the diff
> the 2 and raise conflicts in client

## What this is, and why it is stronger than what it replaces

It is a **three-way merge** — `base` (the snapshot frozen at disconnect), `ours` (base + the queue
replayed), `theirs` (the fresh server document).

⭐ **The version gate throws the base away.** It knows only _"something changed"_, so it cannot tell
_"we both changed this"_ from _"only one of us did"_ and must reject on both. A three-way merge
keeps the common ancestor, so a conflict is only where **both** sides moved the same node away from
base.

⇒ **"two operators editing different fields do not collide" becomes true BY CONSTRUCTION** — the
property that was wrongly claimed to already exist in
`inbox/2026-08-23-correction-the-per-field-save-is-a-trigger-not-a-payload-and-the-write-path-depends-on-the-listener.md`.
Under a three-way merge it is a real guarantee rather than a hoped-for accident, and it makes the
owner's author/timestamp popover fire only on genuine collisions.

⚠️ **And the standing permission matters as much as the design**: _"we dont have to replicate the
current system"_. The v1 write path is an input to the decision, not a constraint on it.

## ⭐⭐ Measured — the merge cannot key `items[]` by uid

`deno task merge-key` (`spikes/harness/merge-key-probe.ts`), read-only prod Firestore under ADC,
2026-08-23. **995 orders, 13,671 items, 9,847 leaves.**

| measured                                 | value                             |
| ---------------------------------------- | --------------------------------- |
| orders where a **leaf** uid repeats      | **182 — 18.3%**                   |
| leaves sitting in a repeated group       | 892 — **9.1% of all leaves**      |
| worst repetition of one uid in one order | **5×**                            |
| orders where a **divider** uid repeats   | **0 — 0.0%**                      |
| documents edited ≥5 times / ≥20 / max    | 840 (84.4%) / 78 (7.8%) / **153** |

⇒ ⚠️ **A merge keyed on `items[].uid` would pair the WRONG ROWS in 18.3% of orders, silently.** The
merge key must be `(uid, k-th occurrence)` — the same key the API's carry-forwards already use
(`carryForwardTaxedAs`, `preserveStoredCoaRevenue`) and for the same reason.

⇒ ⭐ **But dividers CAN be keyed by uid — 0 collisions corpus-wide.** So the merge is not uniformly
hard: **the tree structure keys cleanly and only the leaf rows need occurrence counting.** That is a
materially cheaper design than "items are unmergeable", and it was not knowable without the number.

⚠️ **`path` is not the alternative.** It is the row identity _within one document_, and divider uids
are reused **by name** (`reuseMemberUids`), so a group rename churns every descendant path — across
the two document versions a merge compares, a path is not stable. This is the workspace rule _"a
correspondence ACROSS TWO REBUILDS is a different question, and `path` is the wrong key for it"_,
reaching a second consumer.

⭐ **18.3% independently confirms the workspace `CLAUDE.md` figure of "18% of prod orders"**, which
had been carried as an assertion and never re-measured.

## What the design still owes, and none of it is the popover

1. **The base must be PINNED.** Today `latestSnapshot` is a single mutable baseline the client
   patches in place (`Object.assign(state.latestSnapshot, acceptedDiff)`). A three-way merge needs
   the base frozen at disconnect and immutable until the merge completes.
2. **Derived fields must be excluded and RECOMPUTED, not merged.** Totals, tax amounts and `path`
   are functions of the inputs; merging them field-wise produces a document whose totals do not
   match its own items. ⇒ the merge needs an authored-vs-derived distinction that **does not exist
   explicitly in the schemas today**.
3. **Some conflicts are not "pick a side".** Two operators adding _different_ items is a union, not
   a choice. Field-choice semantics and set semantics are both needed.
4. **Some documents are unmergeable at any granularity** — an invoice paid while you were offline is
   closed, whatever the merge says. There has to be a terminal-state class that refuses the merge
   rather than resolving it.
5. **Replay against `theirs` can FAIL, not merely conflict** — a queued edit addressed at a row that
   no longer exists has no target.
6. ⚠️ **Ledger postings do not merge.** A document field edit has a three-way merge; a TigerBeetle
   posting is immutable and is reversed by a further posting, never rewritten. **The boundary
   between what merges and what posts is a decision this ADR owes.**
