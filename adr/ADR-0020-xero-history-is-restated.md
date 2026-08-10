---
id: ADR-0020
title: Xero history is restated, not imported as-is
status: proposed
date: 2026-08-09
review_by: 2026-10-15
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-006, OQ-012, ADR-0018]
supersedes:
superseded_by:
---

> **In the context of** migrating invoice history whose product-line dimension is missing on a
> material share of revenue, **facing** a new ledger where that dimension is not nullable, **we
> decided** to restate the history rather than import it as-is, **to achieve** a corpus that can be
> reported dimensionally without a permanent unknown bucket, **accepting** that restatement assigns
> dimensions to lines inside closed periods.

## Context

Measured 2026-08-09 against prod, over 9,197 non-divider invoice line items totalling $1,689,895.68:

| Missing                   | Lines | % of lines |     Revenue | % of revenue |
| ------------------------- | ----: | ---------: | ----------: | -----------: |
| `tracking_category`       |   383 |      4.16% | $485,821.72 |   **28.74%** |
| `xero_tracking_option_id` |   129 |      1.40% | $234,960.36 |       13.90% |

- This **confirms** the charter's 28.7% figure, and settles that it was always a share of _revenue_,
  not of lines.
- Undimensioned lines average ~$1,268 against a $184 overall average — roughly 7x. The gap is
  concentrated in big-ticket items, not scattered across small ones.
- It is **not historical**: 55 in 2023, 174 in 2024, 80 in 2025, **74 already in 2026**.
- The taxonomy is not the problem. By revenue the population is Trash Removal ($111,175), Contract
  Labor ($56,570), Trucking ($34,000), Walk Around Trash Sweep ($32,050) — all of which have an
  existing value (`Trash & Cleanup`, `Crew`, `Transport`). They were never tagged.

## Decision

**Restate all.** Apply the mapping to every undimensioned line before import.

## Consequences

- **Most of the restatement is mechanical**, so it is not "inventing facts": Trash Removal and Walk
  Around Trash Sweep → `Trash & Cleanup`, Trucking → `Transport`, Contract Labor → `Crew`. The
  mapping table is the migration's evidence and must be committed, not applied ad hoc.
- **The ambiguous residue is one kind of thing** — facility and professional services with no
  equipment category: Warehouse Rental, Office Rental, Indoor Parking, Location Scouting, Security,
  Safety & Security Assessment. These need a real value, and they are the same population
  `ledger/dimensions.yaml` has in mind when it asks whether `Other` should exist at all, given a
  non-nullable dimension makes `Other` the new null. `m3` decides.
- **Restating touches closed periods.** ~90% of the corpus sits behind the 2025-12-31 lock. A
  dimension is a reporting attribute and assigning one moves no money, but the restatement must not
  alter any amount, and that has to be asserted rather than assumed.
- **This does not fix the live writer.** 74 undimensioned lines were created in 2026, so something
  still produces them. Restating history without closing that path means the population regrows —
  the non-nullable rule in REQ-LED-001 is what has to stop it, and it must be in place before or
  with the migration, not after.
