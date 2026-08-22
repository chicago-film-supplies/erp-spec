---
kind: finding
title: >-
  The booking lifecycle is dormant, so SPIKE-012's boundary cannot be chosen yet — the verdict that
  looked like a PASS rests on 11 rows, while the boundary that FAILED is refuted on real exercised
  data
contexts: [availability, fulfillment, ordering]
source: >-
  `code:2026-08-22:erp-spec@64dd5f0:spikes/harness/booking-boundary-probe.ts` (`deno task boundary`)
  — read-only prod Firestore under ADC, 6,967 bookings and 994 orders at 100% coverage. Owner,
  2026-08-22, in session: the manager check-in/check-out process is not live yet.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Evidence for **SPIKE-012** (when a booking becomes a pending transfer), which is now `in_progress`
rather than closable, and for **ADR-0015** (reservations are pending transfers), which waits on it.

## ⭐ The thing that made it measurable: v1 already holds the position

`bookings.breakdown` carries seven counters —
`quoted, reserved, prepped, out, returned, damaged,
lost` — and `orders.bookings_breakdown` carries
the same seven rolled up. **A quantity split across states IS a position in TigerBeetle's sense**,
so ADR-0015's candidate boundaries map onto counters that already exist in prod rather than onto a
model.

**And the decomposition is exact: `sum(breakdown) === quantity` on 6,967 of 6,967 rows, 100.00%,
zero exceptions.** That check runs against each booking's OWN declared quantity, which no rollup
authors — so unlike the order-level agreement (711 / 0, same writer both sides) it is not a
fixed-point check.

## ⚠️ THE FINDING: the verdict that read as a clean pass is an absence of data

| boundary               | pending counters    | verdict as printed                               | what it rests on                                 |
| ---------------------- | ------------------- | ------------------------------------------------ | ------------------------------------------------ |
| **B1 at confirmation** | `reserved, prepped` | **FAILS — 392 future-dated units, max lead 43d** | 906 rows / 8,268 units — **genuinely exercised** |
| B2 at pick start       | `prepped`           | "PASSES — no future-dated unit"                  | ⚠️ **11 rows corpus-wide**                       |
| B3 at staged           | `prepped`           | "PASSES — no future-dated unit"                  | ⚠️ **the same 11 rows**                          |
| B4 at check-out only   | ∅                   | VACUOUS by construction                          | nothing pends                                    |

**Owner, 2026-08-22: the manager check-in/check-out process is not live; the booking lifecycle is
mostly dormant and will be turned on soon.** The corpus sizes exactly that:

| cohort                                            |  rows | counters populated                                              |
| ------------------------------------------------- | ----: | --------------------------------------------------------------- |
| CRMS import (793 orders, `created_at` 2026-01-24) | 5,545 | **`out` and `returned` ONLY** — zero quoted/reserved/prepped    |
| post-import (201 orders)                          | 1,422 | all seven, but **`prepped` = 11 rows (0.77%)**, `out` = 33 rows |

⇒ **A boundary chosen from this run would have been chosen on 11 rows while reading as a clean
result.** The repo's own rule, hit from the other side: _an unexercised branch is a claim, not a
capability_ — and here the unexercised branch is the one that PASSES, which is the direction that
does not announce itself. **A failing arm is loud; a passing arm that matched almost nothing is
indistinguishable from a working one.**

⚠️ **B2 and B3 are also not yet distinguishable at all.** Both map onto `prepped`, because v1 has no
pick-started counter — `part-prepped` exists as a booking STATUS with no counter behind it. Telling
the two apart needs the process that mints the distinction to be running.

## What survives, and it is the half that matters most

**B1 is refuted on live exercised data.** `reserved` is written today, at order confirmation, which
does work — and **392 future-dated units across 38 rows hold a transfer, with a 43-day maximum
lead**. That is precisely the failure ADR-0015 predicts in prose:

> A booking six months out must not consume stock today… a naive mapping draws both against the same
> account and refuses the second.

⇒ **The prediction now has a number.** Whatever boundary is eventually chosen, it is not
confirmation.

## Two figures produced and then retracted, both for the same reason

1. ⚠️ **`dates.start − created_at` came out at p50 −279 days, 6,325 of 6,967 negative.** It is not a
   lead time. **`created_at` is the CRMS import timestamp for 79.78% of orders** — 793 of 994 share
   the single day 2026-01-24. **Ask what a number is a figure OF**; this one was a figure of the
   import.
2. ⚠️ **Order-status derivability — 49.40% derived == stored, 22.13% disagree, 28.47% not derivable
   — must not be carried forward.** With the lifecycle dormant, `orders.status` is driven by CRMS
   sync rather than by the position, so the figure measures agreement between a live system and a
   dormant one.

**The anatomy is the tell, and it is worth keeping**: in four of the five disagreeing pairs, **every
one of the order's own booking rows carries the ORDER's status** — 2658/2658, 273/273, 45/45, 52/52.
⇒ **The stored statuses form one internally coherent system and the counters form another**, and
they disagree on 22.13% of orders. The largest pair, `stored=complete derived=active` (177 orders,
**23,409 units still sitting in `out`**), is entirely inside the 2026-01-24 import cohort.

## What this means for m4

⚠️ **m4 has a criterion gated on a business process starting, not on anyone's authoring.** "Every
spike closed, naming the ADR it produced" cannot be met for SPIKE-012 until check-in/check-out has
been live long enough to exercise `prepped` and `out` in the ordinary course. That is the only one
of the seven open spikes in that position — the other six are gated on research, infrastructure or
an owner decision, all of which are ours to move.

The re-run condition is written into the spike and tracked as **erp-spec#46**. The threshold for
"enough rows" should be **stated before the re-run rather than after it**, or the same absence-
reads-as-a-pass failure repeats with a bigger number.
