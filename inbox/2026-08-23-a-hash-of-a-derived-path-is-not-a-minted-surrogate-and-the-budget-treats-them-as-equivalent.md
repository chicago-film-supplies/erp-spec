---
kind: correction
title: >-
  A hash of a derived path and a minted surrogate are not interchangeable — the transfer field
  budget offers them as alternatives, but only one is immutable, and reparenting is a live user
  operation that changes a path by design
contexts: [ledger, ordering, billing]
source: "owner, 2026-08-23, in session + code:2026-08-23:api-cloudrun@bbb791af:src/lib/itemNesting.ts + code:2026-08-23:manager@fd2fd54:src/components/invoices/InvoiceItems.tsx"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> items[].uid is not a valid identifier items can repeat in the items array a line item should key
> on path to the extent path is to long to be represented in tigerbeetle can it compressed or hashed
> or something?

## ✅ Both halves of the premise are correct, and one corrects me

**`uid` is not a row identity** — re-measured 2026-08-23 over all 995 prod orders: a leaf uid
repeats in **182 orders, 18.3%**, worst case **5×** (`deno task merge-key`).

⚠️ **And my proposed fix — key the merge on `(uid, k-th occurrence)` — was a v1 constraint imported
into a v2 design.** The path churn that motivated it comes from `reuseMemberUids`, which reuses
divider uids **by name**. Verified: it is called from **exactly two files, `webhooks/invoice.ts` and
`webhooks/opportunity.ts` — both CRMS**, and CRMS is being retired at cutover (api-cloudrun#556). ⇒
**that source of churn dies with CRMS and must not shape the target design.** This is the third
recorded instance of the same mistake in this repo: _the v1 code is the wrong oracle for a
target-state question, and it is seductive precisely because it is executable._

## ⚠️ But `path` is still not a stable key, for a reason CRMS has nothing to do with

**Reparenting is a live, first-class user operation.** `manager`'s invoice items component
implements _"auto-reparenting to the correct container when hovering over a child"_ and
_"Destination header targeted by a group/item drag — insert into this destination"_
(`code:2026-08-23:manager@fd2fd54:src/components/invoices/InvoiceItems.tsx` L183, L202).

`path` is **derived** — `computeItemPaths` is its sole author and builds it from the resolved parent
chain. ⇒ **drag a line into another group and its path changes, by design.** A rename churns
descendants; a reparent churns the row itself. Neither is a defect.

⇒ **`path` is the row identity WITHIN one version of a document, and is not an identity ACROSS
two.** A three-way merge compares exactly two versions, and an immutable ledger holds a key forever
— both are "across".

## ⭐⭐ The finding: the budget offers two options as if they were equivalent

`ledger/tigerbeetle-accounts.yaml` assigns
`user_data_64: line_identity # a hash or minted
surrogate`, and its justification concludes
**"Storing line identity means storing a HASH or a minted surrogate"** — presenting them as one
choice with one cost.

**They are not the same object:**

| option                  | immutable?                        | resolves or verifies?                |
| ----------------------- | --------------------------------- | ------------------------------------ |
| **hash of `item.path`** | ❌ inherits the path's mutability | verifies — recompute and compare     |
| **minted surrogate**    | ✅ immutable by construction      | resolves — look the row up by its id |

⚠️ **Hashing a derived, mutable path into an immutable store writes a key that stops resolving the
first time anyone renames a group or drags a line.** The transfer cannot be rewritten, so the
breakage is permanent and silent — it fails the repo's own test, _"present but wrong beats absent at
passing every existence check"_.

### ⭐ And minting it as a u64 removes the cost the budget accepted

The budget records the price of storing line identity as **opacity**: _"TigerBeetle would hold a
fingerprint that VERIFIES against the projection rather than a reference that RESOLVES without it,
which is a weaker self-description than the one the two fields above were justified by."_

**That cost is a property of hashing, not of storing line identity.** Mint the surrogate **as a u64
in the first place** and:

- it fits `user_data_64` **exactly** — no hash, no truncation, and the collision question does not
  arise at all rather than being answered with a birthday bound;
- it **resolves** — the row is found by its id — restoring the self-description the other two fields
  were justified by;
- ⭐ **the merge key and the ledger key become the SAME OBJECT.** One stable line id serves the
  three-way merge (identity across two document versions) and the posting (identity forever). Two
  problems, one field, and neither needs the other's compromise.

⚠️ **The sizing measurements stay valid and are why this matters** — measured over 1,010 invoices
(14,410 items) and 987 orders: paths reach **depth 7 and 178 bytes**, median 115B, and **14,410 of
14,410 exceed a u128's 16 bytes — 100%**. A single 36-char uuid overflows a u128 alone, and the
corpus mixes three uid flavours, so **no packing rescues a path**. The owner's question — _can it be
compressed or hashed_ — is answered **yes, it must be**; the correction is only about **which of the
two "or"s to take.**

## What this does not decide

- **`path[0]` as the causal order** (ADR-0036) is untouched — that is a claim about the FIRST
  segment, which names the order divider, not about the path as a key.
- **Whether `path` remains derived.** It should: `computeItemPaths` as sole author is what makes a
  client-supplied chain unable to survive a write. A minted line id sits **beside** the path, not
  instead of it — the path stays structure and ordering, the id becomes identity.
