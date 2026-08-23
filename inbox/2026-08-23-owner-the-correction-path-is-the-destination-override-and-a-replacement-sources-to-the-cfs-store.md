---
kind: decision
title: >-
  Owner: the correction path is the same destination override at order/invoice level, and a
  replacement sources to the CFS store because CFS is the end user — which the code intends and
  cannot honour, since three of the four writers resolve the DEFAULT store regardless
contexts: [tax, ordering, billing]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> the correction path would need to be at the order/invoice level utilizing the same destination
> overide // replacements are used by cfs (not the customer, the customer is just paying for them)
> cfs is the end user so cfs store (default store, could be overridden to another cfs store
> determines jurisdiction)

## ✅ Ruling 1 — the correction path is the existing override, not a new mechanism

⭐ **No new machinery, and that is the point.** When an attestation turns out wrong — gear attested
for exclusive Frankfort use shoots in Chicago — the correction is a **new assertion at the
order/invoice destination level**, using the same field. A later, more specific statement supersedes
the standing one, which is the precedence rule already ruled on (owner, 2026-08-22: _"specificity
governs"_).

⚠️ **This MERGES two gaps that were filed separately, and reveals the second is load-bearing.** The
correction path and _"invoices have no jurisdiction editing path"_ are the same gap: an invoice's
jurisdiction is **not editable after create** (`api-cloudrun/src/services/invoices.ts:898-901`), and
the manager's control is typed `ViewHandle<Order | Fulfillment>` — there is no invoice-side surface
at all. ⇒ **the correction path the owner just specified cannot be exercised on an invoice today.**

⭐ **And an invoice is exactly where corrections arrive**, because invoices are issued after the
fact: `SPIKE-008` measured invoice 2100 dated 2025-11-06 for a window running to 2026-02-13. **The
document most likely to need a correction is the one that cannot take one.**

## ✅ Ruling 2 — a replacement sources to the CFS store, because CFS is the end user

_"replacements are used by cfs (not the customer, the customer is just paying for them)."_

⭐ **The code already implements the RULE**, and states the same reason — `resolveLineTax` returns
`{ jurisdiction: ctx.origin, level: "origin" }` before levels 1 and 2 are consulted, because every
replacement is a sale in which CFS is the end user, so the situs is CFS's own location. ⇒ ⭐ **the
earlier note flagging "an override to `no_nexus` does not reach a replacement line" is answered:
that is correct behaviour, not a gap.** A customer's attestation about where _they_ will use gear
says nothing about a part _CFS_ consumed.

## ⚠️⚠️ THE GAP — "could be overridden to another CFS store" is not reachable in 3 of 4 writers

The owner's rule has two halves: **the default store determines it, and it may be overridden to
another CFS store.** The second half is where the implementation falls short. Verified
`code:2026-08-23:api-cloudrun@22672044`:

| writer                             | origin resolved from  | store override |
| ---------------------------------- | --------------------- | -------------- |
| `updateOrder` (`orders.ts:1242`)   | `order.uid_store`     | ✅ **works**   |
| `createOrder` (`orders.ts:663`)    | **the DEFAULT store** | ❌             |
| invoice create (`invoices.ts:549`) | **the DEFAULT store** | ❌             |
| invoice update (`invoices.ts:846`) | **the DEFAULT store** | ❌             |

`createOrder` says so itself:

> `CreateOrderInput` carries **no `uid_store` yet**, so this resolves the DEFAULT store. When the
> input gains one, pass it here — the origin is a property of the selling store, not a constant.

⇒ **an order cannot be created against a non-default store through the API at all**, and an invoice
has no store field in either direction.

⚠️ **And the order path is INTERNALLY INCONSISTENT, which is the sharper half.** `createOrder`
resolves the default store while `updateOrder` resolves `order.uid_store`. So an order carrying a
non-default `uid_store` — set by a CRMS import or a script, since the API cannot — **prices at one
origin on create and a different one on its first edit.** Same order, different tax, depending only
on whether anyone touched it.

⭐ **This is the unexercised-branch pattern exactly.** It is invisible today only if every store
carries the same `jurisdiction`. ⚠️ **NOT MEASURED** — `Store.jurisdiction` is required and
non-nullable, and CFS runs at least two stores (`Fillmore`, `CSR`), but whether their jurisdictions
differ was not checked. **If they agree, the divergence is dormant and will fire the day CFS opens a
store elsewhere** — which is precisely the case the owner's override exists for.

## What this settles from the four open items

| item                                       | status                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| the correction path                        | ✅ **ruled** — the same destination override at order/invoice level                   |
| `replacement` ignores overrides            | ✅ **not a gap** — CFS is the end user, so a customer attestation is irrelevant to it |
| invoices have no jurisdiction editing path | ⚠️ **promoted from a UI gap to a BLOCKER on the correction path**                     |
| `project` is a v2 level                    | unchanged — target-state, no v1 counterpart                                           |

## Still not settled

- ⚠️ **Whether a correction on an issued invoice may change tax at all**, or must go through a
  credit note. `ADR-0020` holds that a restatement must not alter any amount; a jurisdiction
  correction on a billed document **does** alter one. ⭐ **That is an accounting question, not a UI
  one**, and it is the reason the editing gap is not merely a missing control.
