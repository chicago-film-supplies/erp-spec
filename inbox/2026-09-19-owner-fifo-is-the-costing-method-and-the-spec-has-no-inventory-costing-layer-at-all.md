---
kind: owner
title: >-
  Owner rules FIFO for both inventory relief and asset disposition — and the spec has no inventory
  costing layer at all, while v1 inherited Xero's average cost
contexts: [fixed-assets, procurement, ledger, billing]
source: >-
  Owner, 2026-09-19, in an api-cloudrun session on api-cloudrun#737 / #763 / #1069. Corpus figures
  measured the same day against prod Firestore and the live Xero tenant; see
  `api-cloudrun/.claude/plans/inventory-movements-originate-in-cfs.md`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## The ruling

Asked whether a rental-fleet disposal is a `§1.168(i)-8` **asset disposition** (which needs per-unit
identification) or **inventory** relieved under `§471` (where average cost is permitted), the owner
ruled **FIFO for both**, and stated the sequencing:

> *"my first goal for cfs is financial reporting, i want to be able to measure return on investment,
> the next step will be gaap + tax depreciation tracking. until xero can be fully eliminated the big
> thing is record inventory acquisitions in cfs to prevent drift."*

Two earlier rulings the same day bound it: **CFS considers no assets as expensed** (every held unit
carries a basis regardless of how Xero booked it), and **account 6500 "Rental Inventory (less than
1K)" represents ASSET purchases** that count toward rental cost basis alongside the fixed-asset
schedule. So the expensed/capitalised split is a Xero bookkeeping artefact, not a CFS distinction.

## 🔴 The gap — this repo has planned the depreciation half and none of the costing half

`contexts/fixed-assets` is thorough on **depreciation**: two books, `class_life`, `convention`,
`section_179_minor`, `bonus_minor`, the `depreciation_run` / `asset_disposed` /
`asset_basis_adjusted` vectors, ADR-0043's engine. **There is no inventory costing method anywhere in
the repo.** A full-text search on 2026-09-19 returns **zero** hits for `FIFO` and zero for
`weighted average` / `moving average` outside two unrelated labour-allocation inbox notes.

That is not an omission of detail — it is a missing layer, and the ruling above is the first thing
that requires it.

### Three specific places the ruling does not currently fit

1. ⚠️ **`Asset` has no quantity.** `contexts/fixed-assets/entities/asset.yaml` is one asset, one
   `cost_minor`. The live register does not look like that: `A00244` is *"Motorola R2 UHF Two Way
   Radio (260)"* — **one row, 260 units, $118,482.00** — and 112 such rows carry $513,292.66. FIFO
   needs a per-unit or per-lot acquisition layer; a single `cost_minor` on a 260-unit row cannot
   express which units left.
2. ⚠️ **The asset ↔ product join is declared out of scope and assigned to nobody.**
   `contexts/fixed-assets/context.md`: *"Does not own rental stock counts. An asset in the register
   and a rentable product are different things that may refer to the same physical object."* That
   boundary is right, but **the join itself is what `api-cloudrun#737` is blocked on**, and no
   context owns it. Measured: only 42 of 106 rental asset rows match a product by exact normalized
   name — **25.4% by value**. The other shapes are one row spanning several products
   (`Gemini Jr (8) Gemini Sr (2)`), historical counts (`20lb Shot Bag (150)` against 185 held), and
   renames.
3. ⚠️ **The $1,000 capitalisation threshold is read off the account NAMES and the owner says it
   expires after 2025.** `ledger/posting-rules.yaml` draws *"the line at $1,000 in the account names
   themselves"*, and `ledger/vectors/asset_acquired/below-capitalisation-threshold-rejected.yaml`
   rejects a $400 rack to 6500. Under capitalise-everything that vector's expectation changes, and
   under the no-assets-are-expensed ruling the 6500 units still carry a CFS basis either way — so
   the threshold stops being a basis question and becomes purely a tax-book question.

## What v1 does today, and why it is not a precedent

`applyMovementToLedger` (`@cfs/core/utils/movements`) relieves cost on a decrease through
`costOfUnits(basis, held, quantity)` — a **weighted-average** share of the basis captured before the
quantity moves. That is not a considered choice: **it is Xero's method, inherited.** Xero's core
product supports neither FIFO nor a selectable average-cost method; it carries a single per-item
average cost and relieves on it, and FIFO in the Xero ecosystem is a third-party app.

⭐ **So adopting FIFO is a deliberate divergence from Xero, and it permanently closes off any
reconciliation to `Item.TotalCostPool`.** That costs nothing — `api-cloudrun#728` §1 already ruled
Xero's inventory side governs nothing — but it should be recorded as a consequence rather than
discovered later.

⚠️ **And it is a `@cfs/core` change, not a script.** Every v1 movement writer reaches the basis
through that one fold, which is what makes the change tractable; it also means v1 and v2 would use
different costing methods until v2 lands, unless v1 moves first.

## Open, and not for Claude to settle

- Does FIFO apply to **consumable retail stock** as well as the rental fleet, or is the ruling
  specific to the fleet? The question that produced it was about the fleet.
- Is the lot grain the **purchase document line**, or the individual unit? A 260-unit line is one
  acquisition at one unit cost, so a line-grained lot is far cheaper and is indistinguishable from
  unit-grained FIFO whenever a line's units share a cost.
- Which context owns the **asset ↔ product join** — `fixed-assets` disclaims it, `availability` owns
  stock counts, and `procurement` owns the acquisition.
