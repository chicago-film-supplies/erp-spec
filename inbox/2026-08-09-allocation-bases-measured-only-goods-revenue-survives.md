---
kind: finding
title: Allocation bases measured against the whole corpus — weight and volume are uniformly zero, quantity is not commensurable, and the surviving bases disagree by up to a third of delivery revenue
contexts: [ledger, billing, fulfillment]
source: "api:2026-08-09:db_products_count + db_invoices_query — 549 products; 999 invoices, 11,131 rows, 9,194 revenue-bearing lines"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run to decide ADR-0029's open consequence with numbers rather than preference. The survey
(`inbox/2026-08-09-allocation-basis-survey-six-references.md`) establishes that the criterion is
**cause and effect**, and that the tier escapes a revenue basis by capturing a physical quantity to
allocate by. So the question became: which bases does CFS's data actually support?

Line totals reproduce the 2026-08-09 matrix exactly — 999 invoices, 11,131 rows, 9,194
revenue-bearing, `Delivery` $216,050.25 — so this is the same corpus measured a different way.

## 1. Weight and cubic volume are dead, and the way they are dead is the trap

`products.shipping` is a real schema block (`weight`, `height`, `width`, `length`;
`code:2026-08-09:core@8e6deba9:src/schemas/product.ts`). Measured across all **549** products:

| field             | products with a value > 0 |
| ----------------- | ------------------------: |
| `shipping.weight` |                     **0** |
| `shipping.height` |                     **0** |
| `shipping.width`  |                     **0** |
| `shipping.length` |                     **0** |

**531 of 549 products carry the block with `weight` present as a number, and every one of them is
exactly 0.** The field is not missing — it is populated with zero. Anyone specifying a
weight-or-volume basis would read the schema, find the field, and be right about everything except
whether it holds data. The same shape as the `Transport` product line: present, plausible, never
once used.

Nothing else physical exists either. No `weight`, `volume`, `mileage`, `distance` or `vehicle` field
on `order`, `destination` or `fulfillment`. `Address` carries a `mapbox_id` but **no stored
coordinates** — the only coordinates in the system live in `cache-geocodes`, which carries an
`expiresAt` and is a cache, not a record. So distance is _derivable going forward_ (ADR-0027 retains
Mapbox) but is **not recoverable historically**.

## 2. Quantity is not commensurable across product lines

A base must mean the same thing on every line it weights. Units do not:

| product line              |  units | revenue | units per $100 |
| ------------------------- | -----: | ------: | -------------: |
| Expendables               | 21,170 |  35,356 |      **59.88** |
| Traffic, Safety & Signage | 16,534 |  57,432 |          28.79 |
| Tables & Chairs           | 18,708 |  79,873 |          23.42 |
| Wardrobe                  | 22,531 | 139,346 |          16.17 |
| …                         |        |         |                |
| Hair & Makeup             |  3,815 | 117,358 |           3.25 |
| Replacements              |  1,902 |  94,511 |           2.01 |
| Carts & Ramps             |    609 |  32,992 |           1.85 |
| Office Supplies           |     40 |   3,504 |       **1.14** |

**A 52× spread.** A quantity basis hands Expendables ~52× the delivery cost per revenue dollar that
Office Supplies gets, because a box of gaffer tape and a cart are both "1 unit". Quantity is a
cause-and-effect base only where the units are physically alike; here they are not.

## 3. The surviving bases disagree by a third of delivery revenue

Allocating each order's `Delivery` revenue across that order's goods lines, largest-remainder so the
shares sum exactly to the pool. $203,640 was allocable under all three bases:

|         | vs       | reassigned | share of delivery revenue |
| ------- | -------- | ---------: | ------------------------: |
| revenue | lines    | $59,096.66 |                 **27.4%** |
| revenue | quantity | $68,001.44 |                 **31.5%** |
| lines   | quantity | $72,289.22 |                 **33.5%** |

**The choice is load-bearing, not cosmetic.** Between a quarter and a third of the largest tracked
product line's revenue lands on different goods depending on a decision nobody has made. This is
exactly the "two reports will disagree about the margin on the same product line" that ADR-0029
predicted, quantified.

## 4. Delivery is not a small surcharge on top of the goods — often it IS the order

Of the **305** order-groups carrying delivery revenue _and_ goods revenue:

- **115 (37.7%) have delivery revenue exceeding the goods revenue it would spread over** — holding
  **$89,425, 41.4% of all delivery revenue**.
- delivery/goods ratio: **median 0.775, p90 3.13, max 25.0**.
- worst cases: invoice 1907 — $250.00 delivery against **$10.00** of goods across 2 lines; invoice
  1619 — $1,250.00 delivery against $160.00 of goods on a single line.

The `Crafty` line is the clean illustration. Own revenue on delivery-bearing orders is **$11,735**;
a goods-revenue basis allocates it **$21,958** of delivery revenue — **187% of its own revenue** —
driven by five near-identical invoices (1616, 1617, 1678, 1679, 1680) where a $1,500–$2,500 delivery
sits against $480–$800 of Crafty as the _only_ goods on the order.

⚠️ **This is the finding that constrains the design.** When a pool is larger than its base, pro-rata
spreading does not adjust a product line's margin — it _replaces_ it. Whatever basis is chosen, a
product line's reported margin will on 38% of delivery-bearing orders be dominated by an activity
figure rather than by the product. That has to be visible in the report, not discovered by a reader.

## 5. Degenerate and boundary populations, all of which the spec must name

- **15 order-groups carry delivery revenue and have NO goods line at all — $12,410.25, 5.7% of
  delivery revenue.** Structurally unallocable under *every* basis; the denominator is zero. Largest
  are invoices 1856 ($3,250.00), 1875 / 1822 / 1803 ($1,750.00 each). One (1952, $250.00) is void.
  No group has goods lines totalling $0, and none has goods lines totalling 0 units — so the zero
  denominator arises exactly once, from "no goods at all".
- **Void invoices carry $5,750.00 of delivery revenue (2.7%) across 8 groups.** The corpus is 925
  paid / 41 void / 33 issued; the $216,050 headline includes voids
  (`inbox/2026-08-08-void-invoices-not-filtered.md`).
- **60 of 305 allocable groups spread onto exactly one product line** — a fifth of the time
  "allocation" is relabelling, not spreading. Median distinct lines per group is 4, max 14.
- **Multi-order invoices: 0 of 999.** `INVOICE_ITEM_LEVELS` admits an `order` divider and no invoice
  in the corpus bills more than one order; 30 invoices carry no order divider at all. So scoping the
  allocation to the **order** (ADR-0029's "the orders that caused them") rather than the invoice is
  free today and correct later — the two coincide on 969 of 999 and the difference has never once
  been exercised.

## What this leaves

Cause-and-effect bases: **unavailable** (weight/volume zero, distance not recorded historically).
Quantity: **available and wrong** (52× incommensurable). Line count: available, but a line is a
data-entry artifact — splitting one line into two would move money.

**Goods revenue on the causal order is what survives, and it survives as the least-bad proxy rather
than as a principled driver** — an ability-to-bear base in Horngren's ranking, adopted because the
cause-and-effect base is not captured. Recording _that_ is the point: it converts "what basis?" into
"capture the driver", which is the same requirement ADR-0030 already places on vehicle absorption.

## Provenance

Every number above was produced this session by paging the read-only prod `db_*` tools and
aggregating locally. `spikes/harness/allocation-basis-probe.ts` (`deno task allocation`) is the
re-runnable form — a faithful port that type-checks, **but which has not itself been executed yet**:
the sandbox refused the token-bearing invocation, so its first real run is still owed. Until that
happens the probe reproduces the method, not the measurement.
