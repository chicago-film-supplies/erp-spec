---
kind: decision
title: >-
  Owner — CRMS id becomes SKU and product/group ids are greenfield in v2, which collapses the path
  encoding problem entirely; but mutability was the binding constraint, and making a SKU the product
  identity walks into the trap this repo has already recorded twice
contexts: [ledger, ordering, billing]
source: "owner, 2026-08-23, in session + ledger/tigerbeetle-accounts.yaml"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> so crms id will be replaced by sku after cutover. product uids are currently firestore doc ids,
> both of these things are greenfield in v2, using uuid for groups was convenience its not reuqired,
> are there id alterntives we should consider? can path use tigerbeatle 128 is something else
> already using it?

## 1. `user_data_128` — taken, and its occupant was already examined for eviction

`assignment.user_data_128: journal_entry_id`. **erp-spec#3 asked exactly this question** — could
`journal_entry_id` be derived as (source document, posting event) under ADR-0014 and the field
freed? **The answer on record is no**, and it is not a judgement call:

- `EVT-BIL-006 CreditNoteAllocated` — a credit note applied across several invoices "is the case
  that may span source documents, which is why journal-entry grouping cannot simply be derived from
  a single source document reference".
- `EVT-BIL-003 SettlementRecorded` — same shape, one payment allocated across several invoices.

⇒ one journal entry, several source documents, so the grouping **is not a function of** the source
document ref. **The field stays reserved.**

⚠️ **And it would not fit anyway**: a path is up to 178 bytes raw, and interned with honest headroom
(20 bits/segment × depth 7) is **17.5 bytes — over a u128.**

## 2. ⭐ Greenfield ids collapse the SIZE problem completely — and change nothing that matters

If product identity becomes a SKU and divider ids need not be uuids, the segment dictionary shrinks
and the widths collapse: a path could be encoded into a u64 with room. **The owner is right about
that.**

⚠️ **But size was never the binding constraint — mutability was.** A path changes when a group is
renamed and when a line is dragged into another group, and **reparenting is a live user operation**
(`manager` auto-reparents on hover). An encoding that fits does not make a mutable key immutable. ⇒
**the minted-row-id recommendation is unchanged; greenfield ids only make its rejected alternative
cheaper, not correct.**

## 3. ⚠️⚠️ SKU AS THE PRODUCT IDENTITY IS THE TRAP THIS REPO HAS ALREADY RECORDED TWICE

A SKU is **human-authored and mutable** — a typo gets corrected, a numbering scheme gets
restructured, two products get merged. **If the SKU is the identity, every posting that named it is
wrong the moment it is edited, and a transfer cannot be rewritten.**

⭐ **The precedent is in this codebase.** `reuseMemberUids` reuses divider uids **BY NAME**, and
that is precisely the mechanism that makes paths unstable across a rebuild — the defect the last two
days of work have been navigating around. **Making SKU the product key is the same decision, one
level up, on a store that cannot be corrected.**

⇒ ✅ **SKU is a human LABEL with a uniqueness constraint. The product keeps an opaque immutable
id.** Identical in shape to the line-identity conclusion, and for the identical reason.

## 4. Id alternatives — and the offline requirement decides it

⭐ **The constraint that eliminates most options**: SPIKE-013 established that **offline creates
need client-generated identity** — the client must create a row and reference it from later queued
writes before the server has ever seen it. **That rules out server-assigned sequences outright**
(counter document, contention, and it needs the server to be reachable).

So the id must be **client-generatable AND fit `user_data_64`**:

| option                                  | fits u64 | client-generatable | verdict                                                                                           |
| --------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| **random u64 + uniqueness constraint**  | ✅ exact | ✅                 | ⭐ **recommended** — the constraint turns collision from a probability into a caught error        |
| Snowflake-style (time \| worker \| seq) | ✅ exact | ⚠️ needs worker id | sortable and embeds creation time; worker-id allocation is awkward for anonymous public-app users |
| UUIDv7 / ULID                           | ❌ 128b  | ✅                 | time-sortable and pleasant, but `user_data_128` is taken and refused for eviction                 |
| document-scoped ordinals                | ✅ tiny  | ✅                 | ❌ **renumber on reorder and reparent — the mutability problem, reintroduced**                    |
| server sequence                         | ✅       | ❌                 | ❌ fails the offline requirement outright                                                         |

**Collision, for the record**: 28,157 rows today; even at 10⁶ rows a random u64 gives ~2.7e-8
birthday probability. ⚠️ **Quote it only as context** — the uniqueness constraint is what makes it a
non-issue, and a probability is not a guarantee.

## 5. One alternative worth naming and not recommending

**Drop line identity from TigerBeetle entirely** and resolve it from the projection, freeing
`user_data_64` for the actor ref or the causal order. ⚠️ **The budget already evicted `posting_rule`
on exactly that reasoning and spent the freed slot on `accounting_date`**, so this trades a
self-describing ledger for a second projection dependency. Recording it as considered; the case for
it would have to be made on the criterion, not on capacity — the lesson `product_line` and
`cost_type` are in this file to teach.

## ⚠️⚠️ 6. CORRECTION — there is no CRMS/ERP overlap, so half the cost analysis was moot

Owner, 2026-08-23:

> crms cutover is next week and erp spec scaffolding is next year there is no crms erp overlap

**This corrects
`inbox/2026-08-23-what-a-minted-line-id-costs-and-why-path-interning-converges-on-it.md`**, written
hours earlier, whose Part 2 framed the whole cost as _"dominated by ONE fact and it inverts at CRMS
cutover"_ and offered a timing decision:

> Introduce the id BEFORE cutover and you pay for it twice and get the weaker guarantee. Introduce
> it AT or AFTER cutover and it is close to free and it retires code.

⇒ ⚠️ **The "before cutover" branch is UNREACHABLE.** CRMS retires next week; ERP scaffolding starts
next year. **v2 never coexists with CRMS**, so there is no timing decision, no seventh
carry-forward, and no double payment. **The cost analysis collapses to its cheap branch and the
expensive branch was never on the table.**

⇒ **What a minted line id actually costs in v2**, with the CRMS axis removed entirely:

| site                 | cost                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------ |
| minting              | one author, on the `computeItemPaths` doctrine — the precedent is established and enforced |
| **merge-on-add**     | ⚠️ **the only genuinely hard case**: consolidation kills an id a posting may already name  |
| `splitItem`          | cheap — new sibling gets a new id, the original keeps its own                              |
| order↔invoice mirror | **nil** — document-level `{uid, number, status}`, never line-level                         |
| validation           | one arm: present, unique within the document, never reused                                 |
| migration            | one-time id assignment at load; **no pairing, because nothing rebuilds afterward**         |

### ⭐ But the MIGRATION CORPUS is still CRMS-shaped, and that is a different claim

No overlap removes the _ongoing_ rebuild. It does not remove what CRMS already wrote into the data
being migrated: **995 of 995 orders carry a `crms_id`**, the 18.3% duplicate-uid population is baked
in, and the **30 invoices with no `order` divider** are — by the budget's own discriminator — "0 of
them reference an order and 30 of 30 carry a `crms_id`… legacy CRMS imports, not a live pattern".

⇒ **v2 mints fresh ids at load and owes no pairing; but any claim about historical PATHS is a claim
about CRMS-shaped data**, and ADR-0036's `path[0]` invariant is the place that matters.

### ⭐⭐ The pattern, and it is the fourth instance in two days

Analysing a **v1 constraint as though it were a v2 decision**. The prior three: concluding `project`
does not exist because it is absent from the v1 schemas; reading `firestore.rules` as proving there
is no per-document authorization to reproduce; and proposing `(uid, k-th occurrence)` as the v2
merge key because that is what the CRMS carry-forwards use. **All four were caught by the owner, not
by me, and none was caught by reading — each needed someone who knew what v2 was for.**

⚠️ **The repo's existing rule is not strong enough.** It says the v1 code is the wrong oracle for a
target-state question. **The sharper form: v1's SCHEDULE is also not a v2 constraint** — a fact
about when v1 does something says nothing about v2 unless the two are contemporaneous, and here they
are explicitly not.
