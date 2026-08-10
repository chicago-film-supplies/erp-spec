---
kind: correction
title: Correction — the unallocable population is 12 groups / $11,400 under the spec's own base, not 15 / $12,410, and 85% of it is one customer in one quarter
contexts: [ledger, billing]
source: "api:2026-08-09:db_invoices_query — 999 invoices, re-measured under the account-based goods definition"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects a number in `inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md`,
which is append-only and stands as written. Raised by the owner asking what year those orders were
from — a question the original measurement never asked.

## The number was measured under a different base than the spec states

`reporting/allocation-bases.yaml` says: **a goods line carrying `product_line: null` is still part
of the base**, because null is a determination and not an absence (ADR-0025), and excluding it would
concentrate the pool onto the tracked lines. The spec decides goods-vs-not by the **account** — 4000
rental, 4200 retail, 4210 replacement — when the product line is null.

The original measurement classified **every** null-tracking line as not-goods. So it excluded from
the base exactly the population the spec includes.

| base definition                                           | groups | delivery revenue |     share |
| --------------------------------------------------------- | -----: | ---------------: | --------: |
| original — null excluded                                  |     15 |       $12,410.25 |     5.74% |
| **the spec's own — null goods in base**                   | **12** |   **$11,400.00** | **5.28%** |
| the spec's own, and excluding voids as the spec also does | **11** |   **$11,150.00** |     5.16% |

Three groups moved out of the unallocable bucket and into the allocable one, together $1,010.25 —
invoices **2225** (a Seamless backdrop and stand kit), **1879** (a shipped item plus freight) and
**2206** (bottled water). Each carries real goods-account revenue with no product line set, which is
the 4.0% defect population showing up exactly where it matters.

⚠️ **The lesson is not the 0.46 percentage points.** It is that a measurement and the spec it
justifies were classifying by different rules, and both looked right in isolation. The measurement
ran first and the rule was written afterwards; nothing re-ran the measurement against the rule.

## What the remaining 12 actually are, by year

| year     | groups | delivery revenue |
| -------- | -----: | ---------------: |
| 2023     |      1 |          $100.00 |
| **2024** |  **0** |        **$0.00** |
| 2025     |     10 |       $11,050.00 |
| 2026     |      1 |          $250.00 |

**It is not a standing practice.** 2024 has none at all, and 2026 has a single $250 line.

**85.5% of the whole population is one customer, one service, five weeks.** Five invoices — 1799,
1803, 1822, 1856, 1875 — total **$9,750.00**, all **Netflix Productions, LLC**, all the same service
line (`Duradeck Install / Tear Out / Relocate`, product uid `kqzVClx5uJrJ07bEjokX`), dated
2025-02-28 to 2025-04-04, mostly to the Fillmore destination.

## So the bucket is a real category, not a defect

These orders are **service-only jobs**: CFS sold labour — install, tear-out, relocate, trash
removal, sweeps — with no rental or retail goods on the order at all. The delivery and distance
charges on them are not orphaned; they are attached to a job that genuinely has no goods to absorb
them.

That **strengthens** ADR-0031's decision to give the pool its own row rather than force it onto a
product line. There is no product line it belongs to. It also reframes what the row means: watch it
for _service-only work becoming a bigger share of the business_, not for a booking error.

⚠️ And note what a Duradeck job is: Duradeck is **surface protection**, a goods line. The install
labour is tracked `Delivery` because a service line has no product to be categorised as — the same
mechanism that left `Transport` at zero for its whole life. The activity/goods taxonomy is doing the
same thing here that it did there.
