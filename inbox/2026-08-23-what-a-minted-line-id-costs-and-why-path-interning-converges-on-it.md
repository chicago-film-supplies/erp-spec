---
kind: research
title: >-
  What a minted line id costs across order/invoice CRUD and propagation — and why interning a path
  converges on the same object, because representation was never the binding constraint
contexts: [ordering, billing, ledger]
source: "code:2026-08-23:api-cloudrun@bbb791af:src/lib/itemNesting.ts + api:2026-08-23:db_orders_count + spikes/harness/path-encoding-probe.ts"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Two owner questions, 2026-08-23, answered together because they have one answer.

> but what does minting a stable line id cost in terms of order/invoice crud and propagation
> machinery?

> isnt there something that can take each path string token and turn it into an 8 byte token that
> can be reversed?

## Part 1 — can a path be reversibly encoded small?

`deno task path-encoding`, over **28,157 items** across all prod orders and invoices.

⚠️ **Two mechanisms get confused, and only one is real.** _Compression_ is bounded by the pigeonhole
principle — a v4 uuid segment carries ~122 bits of entropy, so reversibly encoding **one** of them
in 8 bytes is not hard, it is **impossible**. _Interning_ is not compression: a dictionary gives
each distinct value a small integer, and it is reversible because the bits move into the dictionary.

So the question is how big the dictionary is, and whether the encoded path fits:

| measured                   | value                  |
| -------------------------- | ---------------------- |
| path depth                 | max **7**, median 3    |
| path bytes                 | max **178**, median 94 |
| distinct **product** uids  | 523 → 10 bits          |
| distinct **divider** uids  | **4,753** → 13 bits    |
| interned path at max depth | **12 bytes**           |

⇒ ✅ **The owner's instinct fits — at 13 bits a segment, a depth-7 path interns to 12 bytes, inside
a u128.** It does **not** fit a u64, which is the field line identity is assigned.

⇒ ⚠️ **But the divider dictionary is UNBOUNDED and already 58% spent.** Divider uids are
per-document uuids: the set grows by ~1 for every divider ever created, forever, and every
historical posting needs it to resolve. **4,753 of 8,192** at 13 bits. Give it honest headroom — 20
bits — and depth 7 becomes **17.5 bytes, over a u128 as well.** A fixed segment width has a fuse on
it.

⭐ **And interning the WHOLE PATH is the same mechanism with one lookup instead of seven.** That
single integer **is** the minted surrogate. ⇒ **the two proposals converge**, and whole-path
interning strictly dominates: no fixed-width fuse, one dictionary, fits a u64 with room.

⭐⭐ **Which exposes the real point: SIZE WAS NEVER THE BINDING CONSTRAINT.** Interning a path
string yields a stable id _for a path_ — but the path is the thing that moves, on rename and on
reparent. Interning the **row** yields a stable id _for the row_. Identical storage, different
referent, and only the second survives a drag between groups.

## Part 2 — what a minted line id costs

**The cost is dominated by ONE fact and it inverts at CRMS cutover.**

### ⚠️ Before cutover: it ADDS machinery rather than replacing it

**995 of 995 prod orders carry a `crms_id`** (`api:2026-08-23:db_orders_count`, 100% — the code
comment's "993 of 993" re-measured). The CRMS webhooks rebuild `items` **wholesale on every event**.

⇒ **A minted id would be destroyed on every rebuild and would have to be paired back** — using
`carryForwardRowField`'s `(uid, k-th occurrence)`, the very key that is a v1 artifact. **In v1 a
minted line id is a SEVENTH carry-forward, not a replacement for the six**, and it is the one whose
miss is worst: a missed `taxed_as` reverts a line to a product default, while a missed _identity_
orphans every ledger posting that named it.

### ✅ After cutover: it deletes machinery

No wholesale rebuild ⇒ the id is authoritative, the pairing problem disappears, and the
carry-forwards exist only for fields CRMS actually overwrites — which is none, because CRMS is gone.
**`reuseMemberUids` is called from exactly two files, both CRMS webhooks** (api-cloudrun#556 removes
them in one piece).

⇒ ⭐ **Introduce the id BEFORE cutover and you pay for it twice and get the weaker guarantee.
Introduce it AT or AFTER cutover and it is close to free and it retires code.**

### The rest of the surface, and it is smaller than it looks

| site                                       | cost                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **12 files** touch item arrays             | Low **if** minting follows the `computeItemPaths` doctrine — one author, every writer calls it. The precedent is established and enforced |
| `consolidateDuplicateItems` (merge-on-add) | ⚠️ **The real one.** It merges on `(parentUid, uid)`, so when two rows consolidate **one id dies** — and a posting may name it            |
| `splitItem`                                | Cheap. New sibling gets a new id; the original keeps its own, and existing postings stay historically correct                             |
| `order.invoices[]` mirror                  | **Nil** — the mirror is `{uid, number, status}`, document-level, never line-level                                                         |
| validation (`validateItemPaths`)           | One new arm: every line has an id, unique within the document, never reused. Cheap, and exactly the shape this repo wants                 |
| migration                                  | **28,157 items** need ids backfilled, one-time                                                                                            |

### ⚠️ The one genuinely hard case, and it is not in the list above

**Merge-on-add kills an id that the ledger may already reference.** A posting is immutable, so a
transfer naming a row that no longer exists cannot be repaired — it can only be resolved through a
tombstone (`merged_into`) in the projection. ⇒ **the dictionary needs to retain dead ids**, which is
fine, and **the merge needs to record the survivor**, which is a new obligation on a code path that
today just drops a duplicate.

⭐ This is the same shape as the ledger boundary already noted: **document rows merge; postings do
not.** A minted id is the object that makes the boundary expressible rather than implicit.
