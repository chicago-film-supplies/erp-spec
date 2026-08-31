---
kind: survey
title: >-
  v1 now has a real `suppliers` collection and a CFS-authored ACCPAY path — procurement's "CFS holds
  only the third stage" stays true, but its vendor record is now real data rather than a hypothetical
contexts: [procurement, ledger, fixed-assets]
source: >-
  Landed 2026-08-31 in v1: `@cfs/core@10.0.0-beta.299`, api-cloudrun `dc2b8849`, manager `00a803c`.
  Corpus figures measured the same day against prod Firestore and the live Xero tenant; see
  `api-cloudrun/.claude/plans/inventory-movements-originate-in-cfs.md`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

`contexts/procurement/context.md` reasons from *"CFS's current system holds only the third [stage]"*
— the dated vendor invoice, with no commitment and no accrual. **That claim is still true and should
not be edited.** What changed is that the third stage is now a modelled thing in v1 rather than a
side effect of Xero, so the v1→v2 mapping for a vendor is real data instead of a hypothesis. Same
shape as `erp-spec#60`, where v1's organization tree turned out to be real.

## What v1 acquired

- **A `suppliers` collection** — `uid` / `name` / `active` / `xero_id`, operator-created, soft-deleted
  by `active: false`. Uniqueness is `name`, case-folded, over the WHOLE collection including inactive
  rows.
- **`Movement.supplier`** — a point-in-time `{uid, name}` snapshot on the movement, deliberately NOT
  cascaded on a supplier rename, because a movement is an immutable historical record.
- **A CFS-authored ACCPAY path** — a `purchase` movement posts a bill to that supplier's Xero
  contact. Its offset is real Accounts Payable and the document total IS the payable, unlike every
  other movement bill, which nets to `$0.00`.

## Three things worth carrying into the v2 model

1. 🔴 **The vendor identity is CFS-native and the external id is nullable and self-healing.**
   `xero_id` starts `null` and is resolved on first push (search Xero by exact name, adopt or
   create, write back). v2 should not assume a vendor is born with its external identity — the
   ordering is *record the vendor, then reconcile it outward*, which survives replacing Xero.
2. ⚠️ **A rate is not an amount, and a rate is not a total.** A retail purchase line must carry the
   real unit count, which forces the unit price to be a 4dp rate, and `q × round4(total ÷ q)` cannot
   reproduce an arbitrary total. Bounded by `q ÷ 20,000 + $0.005` — TWO roundings, not one. Measured
   live exposure across all 76 v1 purchases: **one cent**. ADR-0001's in-house ledger should decide
   deliberately whether a purchase line stores a rate or a total; v1 stores the total and derives.
3. ⭐ **The supplier is not the only counterparty shape.** A capitalised purchase (account 1999)
   flows to a THIRD system, asset.accountant, which imports the line and mints a fixed asset from
   its description. v2's `fixed-assets` context inherits that boundary, and the join key v1 uses is
   a `[CFS-MOV-{number}]` token embedded in the line description — a token survives an operator
   editing the prose around it, where a whole-string name match does not.

## What this does NOT say

It does not model a purchase order or an accrual. v1 still has neither, so the first two stages of
the table in `contexts/procurement/context.md` remain unevidenced by v1 data and stay v2-only.

`inbox/` is append-only; nothing enters the structured spec without being promoted. This is a note.
