---
kind: finding
title: The untracked 28.8% is 51.8% denormalisation failure and 0.1% genuinely undecided — so "nobody decided" is refuted, Transport was dropped on an artifact, and Trash & Cleanup is the third-largest product line
contexts: [ledger, billing]
source: "api:2026-08-09:db_products_query + db_invoices_query — 549 products joined to all 9,194 revenue lines"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-09: _"trash removal is on the trash & cleanup product line, duradeck install/tearout
is on surface protection."_ Checking that against the data refuted a premise three spec artifacts
rest on.

## The products are categorised. The invoice lines are not.

`Trash Removal` and `Walk Around Trash Sweep` both carry `tracking_category_name: "Trash & Cleanup"`
at the **product master** (`uid_tracking_category: NL4IQCGf44kx1NaK2x9Y`). Their **invoice lines**
carry `tracking_category: null`.

So the untracked population is not one thing. Joining every untracked revenue line to its product:

| population                                                                |   lines |         revenue | share of untracked |
| ------------------------------------------------------------------------- | ------: | --------------: | -----------------: |
| **Denormalisation failure** — the product IS categorised, the line is not | **227** | **$252,161.36** |          **51.8%** |
| No product record at all — custom / ad-hoc lines                          |     128 |     $233,667.63 |              48.0% |
| **Genuinely undecided** — the product has no category either              |  **35** |     **$688.00** |           **0.1%** |
|                                                                           |     390 |     $486,516.99 |                    |

Of the 128 ad-hoc lines only 13 ($1,819.80) even share a name with a categorised product; **115
lines / $231,847.83 are genuinely bespoke**. And exactly **one** line in the whole corpus disagrees
with its product master rather than being empty (a `Card Fee`, $226.95).

⚠️ **"Nobody decided" is 0.1% of the untracked revenue, not 100% of it.** `ledger/dimensions.yaml`
states the opposite as the justification for REQ-LED-001:

> The current system's 28.7% of untracked line revenue came from postings where **nobody decided**
> and the field was quietly left empty.

Somebody _did_ decide, at the product, and the invoice line lost it. `tracking_category` on an
invoice line is an **invoice-only field carried forward from the request**
(`code:2026-08-09:api-cloudrun:src/routes/invoices.ts:150`, written at
`src/services/invoices.ts:438` as `item.tracking_category ?? null`) — nothing derives it from
`product.uid_tracking_category` at write time.

**This does not weaken REQ-LED-001; it relocates it.** Refusing an absent dimension is still right.
But the defect it guards against is a **propagation** failure, not an operator failing to choose,
and a rule that only refuses absence at the posting would have been satisfied by a system that
reliably copies the product's category — which is the actual fix.

## Three things this breaks

**1. `Transport` was dropped on a measurement that read the wrong field.** `ledger/dimensions.yaml`
dropped it 2026-08-09 on "**zero lines and zero revenue** across all 9,194 revenue-bearing lines —
it had never once been used", and explains at length why activity lines lose to goods lines.
Measured at the product master instead:

| product    |  lines |        revenue |
| ---------- | -----: | -------------: |
| `Trucking` |      7 |     $34,000.00 |
| `Shipping` |     16 |      $5,665.00 |
|            | **23** | **$39,665.00** |

Both products carry `Transport`. **It has been used continuously; none of it ever reached a line.**
The 0.0% was the denorm failure, and the explanation built on top of it explains an artifact. That
also revives the mapping OQ-025 needed — ADR-0020's restatement lists "Trucking to `Transport`", and
the target was deleted for being empty.

**2. `Trash & Cleanup` is not a rounding error — it is the third-largest product line.**

|                                               |  lines |                           revenue |
| --------------------------------------------- | -----: | --------------------------------: |
| recorded on lines today                       |      2 |                         $1,750.00 |
| `Trash Removal`, lost in the denorm           |     40 |                       $111,175.00 |
| `Walk Around Trash Sweep`, lost in the denorm |     28 |                        $32,050.00 |
| **true**                                      | **70** | **$144,975.00 — 8.6% of revenue** |

That places it **third**, behind `Delivery` ($216,050) and `Walkies & Hotspots` ($175,015) and ahead
of `Wardrobe` ($139,346). OQ-031 currently asks whether it allocates and reasons that it is "small
enough that the answer barely moves a number today" — **wrong by roughly 83×**, and the decision is
now one of the larger ones in the reporting spec.

**3. `Delivery` moves in both directions and is still the largest.** `Off Hours Surcharge` (32
lines, $10,100.00) and `Weekend Surcharge` (26 lines, $7,887.50) are categorised `Delivery` at the
product and null on the line, so the pool is understated by $17,987.50. Against that,
`Duradeck Install /
Tear Out / Relocate` (6 lines, $6,500.00) is categorised `Delivery` at the
**product** and per the owner belongs to `Surface Protection` — a genuine master-data error, and the
only one the owner's two examples turned out to be. Net: roughly $227,500, still comfortably the
largest.

## Why this was invisible

Every prior measurement in this repo read `items[].tracking_category` — the line denorm — because
that is what a revenue report reads. **The line and the master disagree by construction rather than
by drift**, so no amount of re-reading the line would ever have shown it. Joining to the product is
what surfaced it, and nothing had done that.

The same shape as the money `_str` mirror: one authority, faithfully rendered, and the rendering was
never compared to the thing it claimed to mirror.

## Numbers not to reuse

An earlier cut of this measurement matched product names against keywords and reported
`Walk Around Trash Sweep` at 56 lines / $64,100.00. **That is a double count** — the name matches
both the `Trash` and `Sweep` keywords and was tallied under each into the same bucket. The correct
figure is 28 lines / $32,050.00, and every number above comes from the product-uid join instead.
