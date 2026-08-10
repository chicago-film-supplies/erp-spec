---
kind: finding
title: The untracked-revenue denorm is repaired — 28.7% is now 15.00%, and "nobody decided" was 0.141%
contexts: [ledger, billing]
source: "api-cloudrun:2026-08-10:scripts/audit-invoice-line-denorms.ts + repair-invoice-line-denorms.ts — all 9,194 revenue lines, joined to the product master"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

The defect behind the 28.7% figure is **fixed in the source system**, and the number every
product-line claim rests on has moved. This supersedes the measurement in
`2026-08-09-untracked-revenue-is-mostly-a-denorm-failure-not-an-undecided-dimension.md` and
`2026-08-09-untracked-revenue-decomposes-into-three-populations.md`, both of which were measuring a
corpus that no longer exists.

## What was wrong

An invoice line carries five fields that are facts about the line's **product**, not about the row.
There were two writers and they disagreed: the CRMS webhook derived all five from the product; the
native `POST`/`PUT /invoices` path derived `coa_revenue` only and took `tracking_category` from the
client on trust. So 227 lines sat `null` while their product **was** categorised.

That was never an operator declining to classify. It was a derivation that never ran
(api-cloudrun#473, fixed 2026-08-10).

## The corrected split, measured before the repair

Revenue is **tax-exclusive** (`subtotal_discounted_cents`). The first pass of this measurement summed
`total_cents` and produced $255,086.18; tax is a liability CFS collects, not revenue it earns, so
attributing it to a product line overstates every category by its tax rate. The tax-exclusive figure
is $252,161.36 — which matches the original #473 report to the cent, confirming that report was
always tax-exclusive.

| population                                              | lines |     revenue |
| ------------------------------------------------------- | ----: | ----------: |
| **Denorm failure** — product IS categorised, line null   |   227 | $252,161.36 |
| **No product** — custom/one-off line, nothing to inherit |   128 | $233,667.63 |
| **Genuinely uncategorised product** — nobody decided     |    35 |     $688.00 |

**"Nobody decided" was $688.00 of $486,516.99 — 0.141%.** Not 28.7%, and not the 22.1% the
three-population note attributed to service revenue where "a declared null may be the right answer".
99.86% of untracked revenue was a missing derivation plus custom lines.

## After the repair

`tracking_missing` 227 → **0**. `crms_id_missing` 3 → **0**. `tracking_stale` 0, `tracking_orphan` 0.
A dry re-run of the repair touches 0 invoices.

Untracked line revenue is now **15.00%** ($253,306.59 of $1,688,980.87), and what remains is exactly
the two populations that are not defects: 128 custom lines with no product master ($233,667.63) and
170 lines on genuinely uncategorised products ($19,638.96).

⚠️ That second figure is **not** comparable to the $688 above. `Other` was retired at the product
master in the same sitting (below), which moved 12 products and their ~135 lines out of a named
category and into "uncategorised". The pre-retirement nobody-decided number is the one to cite for
"how often did an operator decline to classify": **$688.00**.

## The corrected product-line table

The number REQ-LED-001 and `ledger/dimensions.yaml` should be restated against.

| product line              | lines |     revenue |  share |
| ------------------------- | ----: | ----------: | -----: |
| (unallocated)             |   298 | $253,306.59 | 15.00% |
| Delivery                  |   534 | $234,987.75 | 13.91% |
| Walkies & Hotspots        |   699 | $175,015.10 | 10.36% |
| **Trash & Cleanup**       |    70 | $144,975.00 |  8.58% |
| Wardrobe                  |  1577 | $139,345.80 |  8.25% |
| Hair & Makeup             |  1076 | $117,357.95 |  6.95% |
| Replacements              |   293 |  $94,589.03 |  5.60% |
| Tents                     |   786 |  $87,003.12 |  5.15% |
| Tables & Chairs           |   445 |  $79,872.80 |  4.73% |
| Power, Lights & Tools     |  1195 |  $66,338.62 |  3.93% |
| Surface Protection        |   230 |  $59,947.03 |  3.55% |
| Traffic, Safety & Signage |   641 |  $57,432.14 |  3.40% |
| Crafty                    |   135 |  $44,509.48 |  2.64% |
| **Transport**             |    23 |  $39,665.00 |  2.35% |
| Expendables               |   410 |  $35,355.65 |  2.09% |
| Carts & Ramps             |   328 |  $32,991.83 |  1.95% |
| Janitorial                |   261 |  $10,619.55 |  0.63% |
| Transaction Fees          |   119 |   $4,846.03 |  0.29% |
| Fans & Heaters            |    40 |   $3,768.40 |  0.22% |
| Crew                      |     9 |   $3,550.00 |  0.21% |
| Office Supplies           |    25 |   $3,504.00 |  0.21% |

Total line revenue $1,688,980.87.

## Two spec decisions this reverses

**`Transport` must be reinstated.** It was dropped on 2026-08-09 as never-used. It is **23 lines /
$39,665.00 — 2.35%, the 14th largest line**, carried by `Trucking` and `Shipping`. It read as
never-used only because those lines' denorm was among the 227. The product master said `Transport`
the whole time, and so did **Xero** — prod invoice #1987's `Trucking` line was tagged `Transport` in
the Xero ledger while the CFS line was `null`. Two independent systems of record already agreed; the
spec was reading the one broken copy.

**`Other` must be dropped from the dimension list.** Retired at the product master 2026-08-10 (12
products) and stripped from the historical CFS lines and the Xero ledger. It is not a product line —
it is the absence of one wearing a name, and it reports as a bucket while saying nothing about what
was sold. The revenue it held is now *unallocated*, which is an honest answer, rather than
*allocated to "Other"*, which was not. It no longer appears in the table above.

## The methodological point, which outlives the numbers

Nothing before this read the **product master**. Every prior measurement of "untracked revenue"
counted `tracking_category` on the invoice line and stopped — a field the writer never populated —
so the conclusion "28.7% of postings had nobody decide" was an artifact of the measurement's own
blind spot, restated across seven spec artifacts as a fact about operator behaviour.

The independent property is `item.uid == product.uid` → go read the product and compare. It cost one
join, it was available the entire time, and it moved the headline number by a factor of 200.

Related: api-cloudrun#473, api-cloudrun#402, erp-spec#13, OQ-034.
