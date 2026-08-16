---
kind: finding
title: The product-line × revenue-account matrix rebuilt as a re-runnable artifact with the product-master join — the denorm and the master now agree on every one of 9,394 lines, and the account still cannot stand in for the dimension
contexts: [ledger, billing]
source: "api:2026-08-16:firestore invoices+products under ADC via spikes/harness/product-line-matrix-probe.ts — 1,010 invoices, 9,394 revenue-bearing lines, $1,715,472.79 tax-exclusive, 567 products"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run to close erp-spec#13 item 1. `inbox/2026-08-09-product-line-by-revenue-account-matrix.md` is the
matrix seven spec artifacts read, and individual rows had been re-measured piecemeal since — but the
matrix itself had never been rebuilt, and never as something that could be re-run rather than
believed. `spikes/harness/product-line-matrix-probe.ts` (`deno task matrix-lines`) is that artifact.
It diffs against the frozen 2026-08-09 table in code, so the comparison runs rather than being done
by eye.

## The matrix

Tax-exclusive (`subtotal_discounted_cents`); all statuses including the 43 voids, matching the
2026-08-09 basis. Voids are 481 lines / $70,127.26 / 4.09% of line revenue if a comparison needs
them carved out.

| product line              |     lines |           revenue |      share | kind       | accounts                                          |
| ------------------------- | --------: | ----------------: | ---------: | ---------- | ------------------------------------------------- |
| **«none»**                |       313 |       $253,269.75 | **14.76%** | —          | 2210 2800 4000 4100 4110 4120 4140 4200 4210 4800 |
| **Delivery**              |       537 |   **$236,487.75** | **13.79%** | activity   | 4100 4110 4200                                    |
| Walkies & Hotspots        |       706 |       $178,980.10 |     10.43% | goods      | 4000                                              |
| **Trash & Cleanup**       |        70 |   **$144,975.00** |  **8.45%** | activity   | 4100                                              |
| Wardrobe                  |     1,595 |       $142,085.80 |      8.28% | goods      | 4000 4200                                         |
| Hair & Makeup             |     1,089 |       $118,332.95 |      6.90% | goods      | 4000                                              |
| Replacements              |       295 |        $94,473.03 |      5.51% | goods      | 4200 4210                                         |
| Tents                     |       820 |        $91,803.20 |      5.35% | goods      | 4000                                              |
| Tables & Chairs           |       445 |        $79,872.80 |      4.66% | goods      | 4000                                              |
| Power, Lights & Tools     |     1,231 |        $70,718.62 |      4.12% | goods      | 4000 4200 4800                                    |
| Surface Protection        |       239 |        $61,452.03 |      3.58% | goods      | 4000 4200                                         |
| Traffic, Safety & Signage |       654 |        $59,574.74 |      3.47% | goods      | 4000 4200                                         |
| Crafty                    |       139 |        $45,530.48 |      2.65% | goods      | 4000 4200                                         |
| **Transport**             |        23 |        $39,665.00 |      2.31% | activity   | 4100 4150                                         |
| Expendables               |       429 |        $35,789.09 |      2.09% | goods      | 4200                                              |
| Carts & Ramps             |       344 |        $34,470.83 |      2.01% | goods      | 4000                                              |
| Janitorial                |       266 |        $11,159.55 |      0.65% | goods      | 4000                                              |
| ⚠️ Transaction Fees       |       123 |         $5,109.67 |      0.30% | undeclared | 4110 4700                                         |
| Office Supplies           |        26 |         $4,104.00 |      0.24% | goods      | 4000                                              |
| Fans & Heaters            |        41 |         $4,068.40 |      0.24% | goods      | 4000                                              |
| Crew                      |         9 |         $3,550.00 |      0.21% | activity   | 4100                                              |
| **Shipping**              |     **0** |         **$0.00** |      0.00% | activity   | —                                                 |
|                           | **9,394** | **$1,715,472.79** |            |            |                                                   |

## Finding 1 — the denorm and the master agree on EVERY line, and one of those zeroes is a warning

| population                       |     lines |       revenue | share of line revenue |
| -------------------------------- | --------: | ------------: | --------------------: |
| agrees                           | **9,081** | $1,462,203.04 |                85.24% |
| line null, product categorised   |     **0** |         $0.00 |                 0.00% |
| line and product DISAGREE        |     **0** |         $0.00 |                 0.00% |
| line set, product uncategorised  |     **0** |         $0.00 |                 0.00% |
| no product record (custom line)  |       130 |   $233,610.63 |                13.62% |
| both null (uncategorised master) |       183 |    $19,659.12 |                 1.15% |

**The api-cloudrun#473 repair is holding**: the defect population was 227 lines / $252,161.36 when
filed, and it is 0. The two views of the matrix — off the denorm, off the master — are
byte-identical, which is why only one table is printed above. The join is still performed, and must
keep being performed: reading the repaired copy alone is a fixed-point check against the thing that
broke.

⚠️ **`DISAGREE` is 0, and that is not purely good news.** An invoice is a point-in-time document,
and the `audit-invoice-line-denorms.ts` header is explicit that a line disagreeing with a
since-renamed master is **expected and must never be repaired**. Nothing in the corpus exercises
that branch. By the repo's own rule — _an unexercised branch of a rule is a claim, not a capability_
— nobody should assume the writers preserve point-in-time fidelity under a category rename. It has
never happened, so it has never been tested, and it will look correct in review.

## Finding 2 — the diff, and what moved most

| product line        | lines then → now | revenue then → now        |                     Δ |
| ------------------- | ---------------- | ------------------------- | --------------------: |
| «none»              | 390 → 313        | $486,516.99 → $253,269.75 |          −$233,247.24 |
| **Trash & Cleanup** | 2 → 70           | $1,750.00 → $144,975.00   |      **+$143,225.00** |
| **Transport**       | 0 → 23           | $0.00 → $39,665.00        |       **+$39,665.00** |
| **Crafty**          | 127 → 139        | $16,265.60 → $45,530.48   |       **+$29,264.88** |
| Delivery            | 473 → 537        | $216,050.25 → $236,487.75 |           +$20,437.50 |
| Tents               | 786 → 820        | $87,003.12 → $91,803.20   |            +$4,800.08 |
| **Other**           | 125 → ✂️         | $357.91 → —               |               retired |
| (the other 15 rows) |                  |                           | −$38.12 to +$4,610.00 |

Totals: 9,194 → 9,394 lines, $1,688,980.87 → $1,715,472.79.

Two of the small movements are worth a second look rather than a shrug. **`Tables & Chairs` is
unchanged to the cent** — 445 lines and $79,872.80 on both dates, the only row that did not move at
all. And **`Replacements` moved DOWN $38.12 while gaining 5 lines**, which no repair explains; both
are consistent with ordinary invoice edits, but neither has been checked and a re-run that shows
either of them moving further should be looked at rather than accepted.

`Trash & Cleanup` at 8.45% and `Transport` at 2.31% are the two reversals OQ-031 and OQ-034 already
acted on, now reproduced by the rebuilt artifact. **`Crafty` is the one nobody flagged** — it nearly
tripled, and its account mix inverted from mostly-rental to **90.26% on 4200 Retail Sales** against
9.74% on 4000. It is the illustration ADR-0031 uses for its most important presentation rule, so the
figures quoted there are stale even though the point survives.

⚠️ **The total ROW count is not comparable and nothing derived may use it.** 11,131 then, **14,410**
now. The difference is almost exactly the 3,056 `group` dividers — the 2026-08-09 `items[].x` MCP
projection did not return them, and `order` + `destination` alone are 1,960 against that note's
1,937 structural rows. Revenue-bearing lines are unaffected. Fourth base-comparability problem in
this corpus in eight days, and the first one caused by the measurement TOOL rather than by a choice
of population.

## Finding 3 — the revenue account still cannot stand in for the product line, in either direction

The 2026-08-09 table listed each line's account _set_ and not the split, so this had to be measured
separately then; the rebuilt matrix carries it. A matrix should be a matrix.

**A product line spans accounts:**

- **Delivery** — 4100 $192,447.75 (**81.38%**, 407 lines) · 4110 $43,790.00 (18.52%, 129) · 4200
  $250.00 (0.11%, 1)
- **Transport** — 4100 $34,000.00 (85.72%, 7) · 4150 $5,665.00 (14.28%, 16)
- **Surface Protection** — 4200 $32,060.50 (52.17%, 84) · 4000 $29,391.53 (47.83%, 155)
- **Crafty** — 4200 $41,094.88 (90.26%, 53) · 4000 $4,435.60 (9.74%, 86)
- **Transaction Fees** — 4700 $3,123.61 (61.13%, 81) · 4110 $1,986.06 (38.87%, 42)
- Wardrobe, Replacements, Power/Lights/Tools, Traffic/Safety/Signage each spill 0.85–7.52% onto a
  second account.

**An account spans product lines:**

- **4000** $833,049.88 across **14** lines (Walkies 21.48% … Fans & Heaters 0.49%)
- **4100** $501,887.75 across **5**: Delivery 38.34% · Trash & Cleanup 28.89% · «none» 25.29% ·
  Transport 6.77% · Crew 0.71%
- **4110** $46,276.06 across **3**: Delivery 94.63% · Transaction Fees 4.29% · «none» 1.08%
- **4200** $137,866.01 across **9** · **4210** $100,427.93 across 2 · **4800** $39,567.99 across 2

⇒ The finding stands with new numbers. **Delivery's 79.8 / 20.0 split is now 81.38 / 18.52**, so a
delivery line is still four times more likely to be Service Income than Delivery Surcharges. 4100 is
now _less_ dominated by `Delivery` than it was — 38.34%, because `Trash & Cleanup` at 28.89% is on
it too — which makes account-as-proxy worse, not better. And `4150` no longer appears only under
«none»: it is entirely `Transport`, which is what makes OQ-034's trucking/shipping split derivable.

## Finding 4 — the «none» row decomposes into exactly the two populations that are not defects

| population                                |   lines |         revenue | 2026-08-10 baseline |
| ----------------------------------------- | ------: | --------------: | ------------------- |
| custom line, no product record to inherit |     130 |     $233,610.63 | 128 / $233,667.63   |
| product exists and is uncategorised       |     183 |      $19,659.12 | 170 / $19,638.96    |
| **total untracked**                       | **313** | **$253,269.75** | 298 / $253,306.59   |

Untracked line revenue is **14.76% of $1,715,472.79**, against 15.00% of $1,688,980.87 on 2026-08-10
— the money is flat and the denominator grew. The `both_null` count rose 170 → 183 while its money
barely moved, consistent with the `Other` retirement moving small lines to null at the master.

**The sub-population that matters to ADR-0031** is the null lines that are still in the allocation
base because their ACCOUNT is a goods account: **264 lines, $38,678.20, 2.25% of line revenue** —
4200 $21,716.14 / 36 lines · 4000 $10,671.16 / 220 · 4210 $6,290.90 / 8.
`reporting/vectors/product_line_pl/null-product-line-goods-absorb-their-share.yaml` cites this as
**143 lines / $67,156 / 4.0%**. Lines nearly doubled and money nearly halved: the repair took the
large categorised lines out, and the `Other` retirement put ~135 small ones in. The vector's
argument is unaffected — the population is emphatically not hypothetical — but its source figure is
stale.

## Provenance

`spikes/harness/product-line-matrix-probe.ts`, `deno task matrix-lines`. Read-only prod Firestore
under ADC (erp-spec#15), integer cents throughout, no token. The goods/activity column is read from
`reporting/product-line-pl.yaml` and the declared-value list from `ledger/dimensions.yaml`, so a
value the spec has not classified shows as `undeclared` in the run instead of silently defaulting to
goods.
