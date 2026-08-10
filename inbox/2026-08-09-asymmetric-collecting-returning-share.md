---
kind: finding
title: The ~2% asymmetric collecting/returning share is confirmed — and the pattern it supposedly contradicted is not real
contexts: [fulfillment, ordering]
source: "api:2026-08-09:firestore prod cfs-3100 full orders read — 977 orders, 0 without destinations, $1,809,179.59 total"
confidence: high
promotes_to: [HOT-002]
verified: true
triage_count: 0
---

Revenue by `(customer_collecting, customer_returning)` across every order:

| Combination                                       | Orders |       Revenue |     Share |
| ------------------------------------------------- | -----: | ------------: | --------: |
| collecting **and** returning (customer both ways) |    599 | $1,011,801.41 |    55.92% |
| neither (CFS delivers **and** collects)           |    352 |   $747,058.37 |    41.29% |
| **asym** — CFS delivers, customer returns         |     23 |    $49,736.21 | **2.74%** |
| **asym** — customer collects, CFS returns         |      3 |       $583.60 | **0.03%** |

**Asymmetric total: 2.77% of revenue, 26 of 977 orders.** The ~2% figure is confirmed.

**And the contradiction dissolves.** HOT-002 recorded this share as suspicious because it seemed to
contradict "a confirmed deliver-out/customer-returns pattern". That pattern is
`collecting=false, returning=true` — and it is **2.74%**, not the norm. The norm is **symmetry**:
97.2% of revenue sits on orders where the customer does both or CFS does both. Nothing was
contradicted; the belief that deliver-out/customer-returns was common was simply wrong.

**This does not weaken the per-leg decision (OQ-007), and it is worth being clear why.** 2.77% is
too small to justify a structural change on its own. Per-leg is justified by ADR-0011 instead: a leg
carries an actor, a clock-in and a `shift_id`, and labour cannot be costed to the job that caused it
otherwise. The asymmetric tail is a consequence the model handles for free, not the reason for it.
Anyone revisiting OQ-007 on cost grounds should re-argue it against labour costing, not against this
2.77%.
