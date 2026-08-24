---
id: SPIKE-012
headline: when a booking becomes a pending transfer
question: >-
  At which fulfillment moment does a booking become a TigerBeetle pending transfer, and how much of
  order status is derivable once that boundary is fixed?
timebox: 1 week
method: >-
  Take the real order lifecycle and mark, for each transition, whether it has an inventory or ledger
  consequence. For the candidate boundaries — confirmation, pick start, staged, checked out — model
  the resulting TigerBeetle position and ask three questions of each: does a future-dated booking
  ever consume balance; can the current order status be recomputed from the position alone; and
  what remains that must be recorded rather than derived. Replay a week of real v1 orders against
  each candidate.
exit_criteria:
  - A boundary chosen, with the transitions on each side enumerated.
  - Proof by replay that no future-dated booking consumes balance at the chosen boundary.
  - The derived/assigned split for order status stated field by field, as a table.
  - A count of orders in the replay whose status could NOT be derived, with the reason for each.
measurements:
  - id: M1
    value: "6,967 of 6,967 — 100.00%, zero exceptions"
    of: >-
      Bookings whose `breakdown` counters sum EXACTLY to that booking's own declared `quantity`.
      Checked against each row's own quantity, which no rollup authors, so it is independent of the
      order-level denorm. ⇒ **a TigerBeetle-style position can be built from `breakdown`**, which is
      what made the boundary question measurable at all.
    as_of: 2026-08-22
    source: "code:2026-08-22:erp-spec@26bf708:spikes/harness/booking-boundary-probe.ts"
  - id: M2
    value: "392 future-dated units across 38 rows, max lead 43 days"
    of: >-
      Units held in `reserved` whose charge window has not started — i.e. a forward booking already
      consuming balance at candidate boundary B1 ("at confirmation").
      ⭐ **This REFUTES B1 on exercised data**, and it is exactly the failure ADR-0015 predicts. It
      is a real measurement rather than an absence: `reserved` is genuinely in use post-import
      (906 rows / 8,268 units).
    as_of: 2026-08-22
    source: "code:2026-08-22:erp-spec@26bf708:spikes/harness/booking-boundary-probe.ts"
  - id: M3
    value: "11 rows — 0.77%"
    of: >-
      Post-import bookings with the `prepped` counter populated, out of 1,422.
      ⛔ **THIS IS WHY THE SPIKE CANNOT CLOSE, AND IT IS RECORDED AS A MEASUREMENT SO IT CANNOT BE
      MISREAD AS A PASS.** Candidate boundaries B2 and B3 both reported "PASSES — no future-dated
      unit holds a transfer" resting on these 11 rows. **The manager's check-in/check-out process
      is not live**, so the verdict is an absence of data wearing a result's clothes. An unexercised
      branch is a claim, not a capability (erp-spec#46).
    as_of: 2026-08-22
    source: "code:2026-08-22:erp-spec@26bf708:spikes/harness/booking-boundary-probe.ts"
  - id: M4
    value: "49.40% derived == stored · 22.13% disagree · 28.47% not derivable"
    of: >-
      Orders whose status was compared against a status derived from the booking position alone.
      ⛔ **DO NOT CARRY THESE FORWARD.** With the lifecycle dormant, `orders.status` is driven by
      CRMS sync rather than by the position, so this measures agreement between a LIVE system and a
      DORMANT one — two coherent systems that simply disagree. The largest disagreeing pair (177
      orders, 23,409 units still `out`) is entirely the 2026-01-24 import cohort.
    as_of: 2026-08-22
    source: "code:2026-08-22:erp-spec@26bf708:spikes/harness/booking-boundary-probe.ts"
closes_adr: ADR-0015
status: in_progress
---

## Notes

The failure this spike exists to prevent is a boundary drawn too early. Pull it back far enough and
a forward booking starts consuming balance, which silently reintroduces the per-day-rollup oversell
the v1 engine deliberately avoids — and it would present as availability being _too low_, which
reads as conservative rather than as a bug.

The count of underivable statuses is the real output. ADR-0014 says to shrink the assigned set
without pretending it is empty; this is where that claim gets a number instead of an intention.

## Partial result — measured 2026-08-22, NOT closed

Harness `spikes/harness/booking-boundary-probe.ts`, `deno task boundary`, read-only prod under ADC.
Corpus: **6,967 bookings · 994 orders**. ⚠️ The corpus is live and moves between runs — two runs
minutes apart differed on `reserved` and `prepped`; `--as-of` pins the reference date, not the data.

### ⭐ What made this measurable at all

**v1 already holds the position.** `bookings.breakdown` carries seven counters —
`quoted, reserved,
prepped, out, returned, damaged, lost` — and `orders.bookings_breakdown` carries
the same seven rolled up. A quantity split across states **is** a position in TigerBeetle's sense,
so the candidate boundaries map onto counters that already exist and are already populated.

### Established, and these hold regardless of what happens next

|                                                          |                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`breakdown` is an exact partition of `quantity`**      | **6,967 / 6,967 — 100.00%, zero exceptions.** Checked against each booking's OWN declared quantity, which no rollup authors, so this is independent of the denorm. ⇒ **a position can be built from it**                                                                       |
| **The order rollup is exactly consistent**               | 711 agree / **0 disagree** against the sum of that order's own booking rows; 283 orders carry no booking row at all (service-only, `stock_method: none`, draft). ⚠️ This one is a fixed-point check — same writer both sides — and is reported as consistency, not as evidence |
| ⭐ **B1 "at confirmation" is REFUTED on exercised data** | **392 future-dated units across 38 rows hold a transfer, max lead 43 days.** `reserved` is genuinely in use (906 rows / 8,268 units post-import), so this is a real measurement rather than an absence. **This is exactly the failure ADR-0015 predicts**, now with a number   |

### ⛔ Why it CANNOT be closed: the lifecycle it measures is not running yet

**Owner, 2026-08-22: the manager check-in / check-out process is not live; the booking lifecycle is
mostly dormant and will be turned on soon.** The corpus confirms it and sizes it:

| cohort                                                |  rows | counters actually populated                                                                        |
| ----------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------- |
| **CRMS import** (793 orders, `created_at` 2026-01-24) | 5,545 | **`out` and `returned` ONLY** — zero quoted, reserved, prepped. The import wrote terminal counters |
| **post-import** (201 orders)                          | 1,422 | all seven appear, but **`prepped` is 11 rows — 0.77%** — and `out` is 33 rows                      |

⚠️ **THE VERDICT THAT LOOKED LIKE A PASS IS AN ABSENCE OF DATA.** B2 "at pick start" and B3 "at
staged" both reported _"PASSES — no future-dated unit holds a transfer"_. **They rest on 11 rows in
the entire corpus.** An unexercised branch is a claim, not a capability — and a boundary chosen on
this evidence would have been chosen on 11 rows while reading as a clean result.

⚠️ **B2 and B3 are also not yet distinguishable.** Both currently map onto `prepped`, because v1 has
no separate pick-started counter — `part-prepped` exists as a booking STATUS with no counter behind
it. Telling them apart needs the process that mints the distinction to exist.

⇒ **Exit criteria 1, 3 and 4 are unreachable on this corpus at any cost.** Criterion 2 is answered
for B1 and unanswerable for B2/B3.

### The derivability numbers, and why they do not mean what they appear to

Order status derived from the position alone: **49.40% derived == stored · 22.13% disagree · 28.47%
not derivable.** ⚠️ **Do not carry these forward.** With the lifecycle dormant, `orders.status` is
driven by CRMS sync rather than by the position, so this measures agreement between a live system
and a dormant one. The anatomy shows it plainly — **in four of the five disagreeing pairs, every one
of the order's own booking rows carries the ORDER's status** (2658/2658, 273/273, 45/45, 52/52). The
statuses form one coherent system and the counters form another; they disagree on 22.13% of orders.

The largest pair, **`stored=complete derived=active` (177 orders, 23,409 units still in `out`)**, is
an **import artifact**: every one is in the 2026-01-24 cohort, and CRMS's import populated `out` and
`returned` without the intermediate states.

### ⚠️ One figure this probe produced and then had to retract

`dates.start − created_at` came out at **p50 −279 days, 6,325 of 6,967 negative.** That is not a
lead time — **`created_at` is the CRMS import timestamp for 79.78% of orders** (793 of 994 share the
single day 2026-01-24). The probe now prints the cohort test beside it and labels the figure
unusable. **Ask what a number is a figure OF**: this one was a figure of the import.

### Re-run trigger — the condition that closes this spike

**Re-run `deno task boundary` once check-in/check-out has been live long enough that `prepped` and
`out` are exercised in the ordinary course.** A defensible close needs, at minimum:

- **`prepped` populated on enough rows to distinguish a pass from an absence** — 11 is not enough,
  and the threshold should be stated before the run rather than after it.
- **A pick-started signal that is not `prepped`**, or an explicit finding that B2 and B3 are the
  same boundary in this business and the spike's four candidates are really three.
- **`orders.status` driven by the position rather than by CRMS sync**, or the derivability question
  restricted to orders created after that cutover.

Tracked as erp-spec#46.

## Notes

The failure this spike exists to prevent is a boundary drawn too early. Pull it back far enough and
a forward booking starts consuming balance, which silently reintroduces the per-day-rollup oversell
the v1 engine deliberately avoids — and it would present as availability being _too low_, which
reads as conservative rather than as a bug. ✅ **Measured 2026-08-22 at B1: it happens, 392 units.**

The count of underivable statuses is the real output. ADR-0014 says to shrink the assigned set
without pretending it is empty; this is where that claim gets a number instead of an intention. ⚠️
**That number is not yet available** — see the partial result above.
