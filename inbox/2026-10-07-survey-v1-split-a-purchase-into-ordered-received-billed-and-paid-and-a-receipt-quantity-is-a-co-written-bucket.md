---
kind: survey
title: >-
  v1 split a purchase into ordered, received, billed and paid on 2026-10-06 — a receipt is a movement
  naming a purchase, a bill and a supplier credit are their own documents, and a receipt quantity is a
  co-written bucket rather than a sum anyone recomputes
contexts: [procurement, ledger, fixed-assets]
source: >-
  Landed in v1 across `@cfs/core@10.0.0-beta.604`–`beta.620`, api-cloudrun `v0.330.0` onward and manager
  `27.33.0` (api-cloudrun#1210; the plan lived at `api-cloudrun/.claude/plans/purchases.md` until it
  was deleted on landing, recoverable from git). Corpus figures measured 2026-10-02 (P0) and
  2026-10-07 (the prod backfill) against prod Firestore and the live Xero tenant.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

`contexts/procurement/context.md` reasons from _"CFS holds only the third stage"_ — the dated vendor
invoice. The 2026-08-31 survey recorded v1 acquiring a real `suppliers` collection and a
CFS-authored ACCPAY path. **Both are now superseded as descriptions of v1's current model**, not as
history: v1 stopped treating a `purchase` movement as the order, the delivery, the bill and the debt
at once. This note records the shape it moved to, because v2's procurement model should start from
the sequence v1 had to learn rather than from the one it began with.

## The sequence the owner actually runs

**Order → bill → delivery (days or weeks later, possibly partial) → payment.** Before the split
nothing could hold _"billed, not received"_: movement #3882 recorded three radios that had not
arrived, because the only available record of buying a thing was the receipt of it. A model that
puts the document's date and the stock's arrival in one row cannot represent the state the business
spends most of its purchasing life in.

## Four facts, four homes

| fact     | v1's home                                                  | what it moves                          |
| -------- | ---------------------------------------------------------- | -------------------------------------- |
| ordered  | `purchases` — one line per product, quantity + line amount | nothing                                |
| received | `purchase` movements naming the purchase in `sources[]`    | held quantity, cost basis, unit roster |
| billed   | `purchase-bills` and `purchase-credits`                    | the Xero document                      |
| paid     | `settlements` rows against a bill                          | the bill's totals                      |

## Things worth carrying into the v2 model

1. 🔴 **A receipt quantity is a CO-WRITTEN bucket, not a derived sum.** Each purchase line carries
   `quantity_received`, `quantity_billed` and `quantity_canceled`, written in the same transaction
   as the receipt, bill or close that moves it, and the document's `status`
   (`active | complete |
   canceled`) is derived from them and refused at parse if it disagrees.
   The alternative — summing receipts on read — was rejected because the bucket is what the oversell
   and short-close rules need to read at one point in time. A purchase **received in full but
   unbilled is `active`**, on purpose: a purchase reading `complete` while a bill is owed hides
   exactly the work the split exists to show. Payment does not hold a purchase open; it is the
   bill's business.
2. ⚠️ **A line is `(purchase, uid_product)`, and a second price is a second purchase.** The k-th
   receipt or bill against a line is priced by the _cumulative share_ of the line amount, rounded
   once, so partials sum to the amount exactly with no remainder rule and no stored unit cost. A
   stored unit cost beside the amount it derives from would be a second source of truth.
3. **A supplier credit is a document, and it can be raised by a CLOSE.** Closing a purchase short
   (cancelling units never received) that leaves a line billed beyond what it received raises one
   pushed credit for the excess in the same commit, and allocates it to the purchase's bills after
   the commit, newest first. An allocation is its own journal row (`bill_credit`), written unsynced
   and pushed to Xero afterwards; **an unsynced allocation can be reversed by CFS, a synced one can
   only be removed in Xero**, whose webhook then retracts the row. v2 needs the same asymmetry
   whenever a ledger entry has an external twin: the author of the undo is whoever holds the twin.
4. **Payable and receivable settlements share ONE journal with disjoint keys and no stored side.**
   Rows name `uid_invoice` or `uid_purchase_bill`/`uid_purchase_credit`, and each settlement type
   declares which bucket it folds into. A bill's identity is
   `paid + credited + voided + due ==
   total`, exact in cents, the same identity an invoice has.
5. **A linked bill's total is the external document's, not the purchase's.** 21 of the 299 historic
   documents have a cost basis that differs from the lines Xero holds (a line moved between
   documents, a rounded unit), so a bill written FROM an existing Xero document takes Xero's total
   and prices its lines by share. A bill CFS PUSHES is the other way round. v2 will have no external
   twin for these, but the migration from v1 will meet both.
6. **There is no tax anywhere on a purchase** (owner, 2026-10-05): stock bought for sale or rent is
   bought resale-exempt and the tax is collected from the end user, so the pricing document never
   runs for a purchase.
7. **The supplier is a point-in-time snapshot and is deliberately not cascaded on a rename** (owner,
   api-cloudrun#1224). The Xero contact is not renamed either, so a cascaded bill would disagree
   with its own document, and the receipt-to-purchase and bill-to-purchase equality invariants would
   loosen to the uid alone. Finding a supplier's documents after a rename is a filter on
   `supplier.uid`.

## What the backfill measured (the migration the v2 cutover will face again)

- **406 purchase movements over 299 Xero documents**: 276 card payments (SPEND bank transactions,
  born paid) and 23 vendor bills (ACCPAY, 3 still open). Every movement already carried a supplier
  and a Xero id, which is what made grouping by document possible; **299 became 300 purchases**
  because one document is not a vendor bill (see the 2026-10-06 expense-claim finding).
- **One document repeated a product** across two movements: a purchase line is `(purchase, product)`
  so it merged to one line while the two receipts stayed separate, which loses nothing because the
  receipt sum is what the bucket reads.
- **The order date was never recorded.** The earliest receipt stands in, and the purchase's notes
  say so. v2's migration should expect `ordered_at` to be unknowable for history, not null by
  accident.
- A movement-level `purchase` is now **refused on input** and the legacy posting path is retired:
  receipts post nothing to Xero, because the bill is the purchase's own document.

## Why this is a survey and not a requirement

v2's procurement model is not obliged to copy any of it; `contexts/procurement/` can still choose
three-way match as a first-class state instead of a derived status. What this records is that v1,
under real use, had to separate the four facts, and that the separation was driven by one state
(_billed, not received_) the single-row model could not hold.
