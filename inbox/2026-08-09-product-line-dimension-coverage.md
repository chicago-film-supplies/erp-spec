---
kind: finding
title: The 28.7% undimensioned revenue is confirmed — and it is 383 lines, not 28
contexts: [ledger, billing]
source: "api:2026-08-09:firestore prod cfs-3100 full-collection read — 999 invoices, 9,197 non-divider line items, $1,689,895.68 total line revenue"
confidence: high
promotes_to: [OQ-012]
verified: true
triage_count: 0
---

| Missing dimension | Lines | % of lines | Revenue | % of revenue |
|---|---:|---:|---:|---:|
| `tracking_category` | **383** | 4.16% | $485,821.72 | **28.74%** |
| `xero_tracking_option_id` | 129 | 1.40% | $234,960.36 | 13.90% |

The charter's "28.7% untracked revenue" is **confirmed at 28.74%**, and the measurement settles
what it was a percentage OF: revenue, not lines.

**The disproportion is the finding.** 4.16% of lines carry 28.74% of revenue — undimensioned lines
average ~$1,268 against a $184 overall average, roughly 7x. This is not scattered data entry on
small lines; it is concentrated in big-ticket items, which implies a systematic cause.

It is also **not historical**: 55 in 2023, 174 in 2024, 80 in 2025, **74 already in 2026**. 358 of
the 383 sit on `paid` invoices, 13 on `void`. So there is a live writer producing undimensioned
lines today, and importing history does not address it.

**Most of it is mechanically mappable — the taxonomy is not the problem.** By revenue: Trash
Removal ($111,175 / 40 lines), Contract Labor ($56,570 / 2), Trucking ($34,000 / 7), Walk Around
Trash Sweep ($32,050 / 28). Values already exist for these — `Trash & Cleanup`, `Crew`, `Transport`.
The lines were simply never tagged.

The genuinely ambiguous residue is small and is one kind of thing: facility and professional
services with no equipment category — Warehouse Rental, Office Rental, Indoor Parking, Location
Scouting, Security, Safety & Security Assessment. That is the same population `ledger/dimensions.yaml`
already flags when it asks whether `Other` should exist at all, given a non-nullable dimension makes
`Other` the new null.
