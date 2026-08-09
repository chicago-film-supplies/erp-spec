---
kind: finding
title: The 55 hard-deleted order uids do not reproduce — the count is zero
contexts: [ordering, billing]
source: "api:2026-08-09:firestore prod cfs-3100 full-collection read — 977 orders, 999 invoices, 845 distinct order uids referenced, 969 distinct invoice uids referenced, 0 dangling in either direction"
confidence: high
promotes_to: [OQ-013]
verified: true
triage_count: 0
---

Supersedes `inbox/2026-08-08-hard-deleted-order-uids.md`, which recorded 55 at `confidence: medium`
and `verified: false`.

Measured across **all five** order↔invoice reference paths, not just the denormalized array:

| Direction | Path | Refs | Dangling |
|---|---|---:|---:|
| invoice → order | `query_by_orders[]` | 969 | 0 |
| invoice → order | `items[type=order].uid` (the divider's uid IS the order doc-id) | 969 | 0 |
| invoice → order | `destinations[].uid_order` | 970 | 0 |
| order → invoice | `invoices[]` | 1159 | 0 |
| order → invoice | `query_by_invoices[]` | 1159 | 0 |

The first pass checked only `query_by_orders` and would have missed a dangling ref on either of the
other two invoice-side paths. Checking one path and reporting "clean" is the failure this table
exists to avoid.

**This matters beyond OQ-013.** The charter cites these 55 as the evidence for the **no hard
deletes, ever** fence, and `m0` requires every fence to be traceable to a finding. That finding now
measures 0. The fence may well be right on other grounds — an accounting system should not lose
records — but it currently rests on a number that does not reproduce, and the charter should say so
rather than keep citing it.

Not established: whether the 55 were real and later restored, whether the original count measured
dev rather than prod, or whether it measured something else entirely.
