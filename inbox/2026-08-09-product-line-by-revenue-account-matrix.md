---
kind: finding
title: Product line by revenue account, measured across all 9,194 revenue lines — Delivery is the largest tracked line and Transport has never been used
contexts: [ledger, billing]
source: "api:2026-08-09:db_invoices_query — 999 invoices, 11,131 rows, 9,194 revenue-bearing lines"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run to settle whether the revenue account can stand in for the product line, and whether `Transport`
is a coherent line. Paged the whole invoice corpus, projecting `items[].tracking_category`,
`items[].coa_revenue`, `items[].type` and `items[].price.subtotal_discounted_cents`. Structural rows
(`order`, `destination`, `group` dividers) excluded — 11,131 rows, **9,194 revenue-bearing**.

| product line              |     lines |          revenue |     share | accounts                                                    |
| ------------------------- | --------: | ---------------: | --------: | ----------------------------------------------------------- |
| **«none»**                |       390 |       486,516.99 | **28.8%** | 2210 2800 4000 4100 4110 4120 4140 4150 4200 4210 4700 4800 |
| **Delivery**              |       473 |   **216,050.25** | **12.8%** | 4100 4110 4200                                              |
| Walkies & Hotspots        |       699 |       175,015.10 |     10.4% | 4000                                                        |
| Wardrobe                  |      1577 |       139,345.80 |      8.3% | 4000 4200                                                   |
| Hair & Makeup             |      1076 |       117,357.95 |      6.9% | 4000                                                        |
| Replacements              |       290 |        94,511.15 |      5.6% | 4200 4210                                                   |
| Tents                     |       786 |        87,003.12 |      5.2% | 4000                                                        |
| Tables & Chairs           |       445 |        79,872.80 |      4.7% | 4000                                                        |
| Power, Lights & Tools     |      1190 |        66,108.62 |      3.9% | 4000 4200 4800                                              |
| Surface Protection        |       230 |        59,947.03 |      3.5% | 4000 4200                                                   |
| Traffic, Safety & Signage |       641 |        57,432.14 |      3.4% | 4000 4200                                                   |
| Expendables               |       410 |        35,355.65 |      2.1% | 4200                                                        |
| Carts & Ramps             |       328 |        32,991.83 |      2.0% | 4000                                                        |
| Crafty                    |       127 |        16,265.60 |      1.0% | 4000 4200                                                   |
| Janitorial                |       261 |        10,619.55 |      0.6% | 4000                                                        |
| Fans & Heaters            |        40 |         3,768.40 |      0.2% | 4000                                                        |
| Office Supplies           |        25 |         3,504.00 |      0.2% | 4000                                                        |
| **Crew**                  |         7 |         2,625.00 |      0.2% | 4100                                                        |
| Transaction Fees          |        72 |         2,581.98 |      0.2% | 4700                                                        |
| Trash & Cleanup           |         2 |         1,750.00 |      0.1% | 4100                                                        |
| Other                     |       125 |           357.91 |      0.0% | 4000 4110                                                   |
| **Transport**             |     **0** |         **0.00** |  **0.0%** | —                                                           |
|                           | **9,194** | **1,688,980.87** |           |                                                             |

## Four findings, and two of them overturn a recommendation made an hour earlier

**1. `Transport` has never been used. Zero lines, zero revenue.** The line exists as a Xero tracking
category and no invoice line in the corpus carries it. So the proposed split of `Transport` into
`Trucking` and `Shipping` had nothing to split. Why it is empty is the interesting part: **activity
lines compete with goods lines for the same line item, and goods lines win.** Shipping a walkie is
categorised `Walkies & Hotspots` (699 lines, $175k, all on 4000) — by _what was shipped_, not by the
shipping. `Delivery` survives only because a delivery line has no product to be categorised as
instead.

**2. `Delivery` is the largest TRACKED product line in the business — 12.8%, $216,050.** Larger than
every goods line. That is the scale of the loss that will appear once labour and vehicle COGS reach
the ledger, and the size of the reallocation the official product-line P&L has to perform.

**3. The revenue account CANNOT stand in for the product line, in either direction.** `Delivery`
spans **4100 (79.8%), 4110 (20.0%) and 4200**, so a delivery line is four times more likely to be
Service Income than Delivery Surcharges. And 4100 holds `Delivery`, `Crew`, `Trash & Cleanup` and
part of «none» at once. ⚠️ This **retracts** the claim that a `Transport` restatement would be
derivable from the account — `Transport` + 4100 → Trucking, + 4150 → Shipping. The account is
coarser than the dimension for services, 4150 appears **only** under «none», and the mapping would
have been invented rather than derived. It was flagged as unverified when made; it does not survive
verification.

**4. The untracked share reproduces**: 28.8% / $486,516.99 here against the 28.74% / $485,821.72
recorded in REQ-LED-001's rationale on 2026-08-08 — different measure, same number, so the figure
that justifies the whole dimension rule is stable. It spans 12 accounts including **2210 Bottled
Water Tax and 2800 PSA Liability Clearing**, so "untracked revenue" also contains lines that are not
revenue at all.

## What this says about the taxonomy

The value set mixes **categories of goods** with **categories of activity**, and the measurement
shows the mix is not stable: of the four activity lines, one carries 12.8% of revenue (`Delivery`),
two are rounding errors (`Crew` $2,625, `Trash & Cleanup` $1,750) and one has never been used at all
(`Transport`). An operator facing a line with a product picks the product.

That is an argument for the boundary rather than against the activity lines: the ledger should
record what the line _was_, un-allocated, and the official P&L should perform the allocation — which
is the only way `Delivery`'s $216k of revenue and its (currently unrecorded) cost both end up
against the goods that caused them.
