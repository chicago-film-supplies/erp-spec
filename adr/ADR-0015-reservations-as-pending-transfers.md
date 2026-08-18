---
id: ADR-0015
headline: reservations are pending transfers
title: Inventory reservations are TigerBeetle pending transfers, over the operational window only
status: proposed
date: 2026-08-09
review_by: 2026-11-01
deciders: [repo owner]
contexts: [availability, fulfillment, ordering]
relates_to: [ADR-0003, ADR-0014, SPIKE-002, SPIKE-012]
accounting_shaped: false
supersedes:
superseded_by:
---

> **In the context of** wanting order state derivable and oversell prevented in the database,
> **facing** a balance model with no time dimension and an availability question that is entirely
> about time, **we decided** to model reservations as two-phase transfers over the operational
> window only, **to achieve** custody oversell that is unrepresentable and a fulfillment state that
> is derived, **accepting** that future-dated booking conflicts stay with the interval engine.

## Context

- The two-phase transfer maps onto fulfillment almost exactly: reserve → pending, check out → post,
  cancel → void, with the transfer timeout as built-in expiry. `debits_must_not_exceed_credits` then
  makes overselling a database-level impossibility rather than an application check.
- **But TigerBeetle balances are point-in-time and rental availability is not.** A booking six
  months out must not consume stock today, and two bookings on non-overlapping dates do not compete
  at all. A pending transfer has no date range, so a naive mapping draws both against the same
  account and refuses the second.
- The v1 engine already gets this right and the correctness argument is recorded: availability is
  computed from raw intervals, and decomposing to a per-day rollup **oversells** — with `held = 2`
  and bookings on days 1–2 and 4–5, the window `[1,5]` is exactly 0, while a daily curve says 1.
- So an account-per-time-bucket design is not a scaling concern. It is wrong.

## Decision

Reservations are TigerBeetle two-phase transfers **scoped to the operational window** — units
committed to a fulfillment that is in progress:

| Phase   | Meaning                                                                |
| ------- | ---------------------------------------------------------------------- |
| pending | committed to an in-progress fulfillment (picked / staged, not yet out) |
| post    | checked out — custody transferred                                      |
| void    | pick cancelled or expired                                              |

**Future-dated bookings are not transfers.** They remain interval records, and availability over a
window remains interval math. The stock position TigerBeetle holds is physical custody, not the
forward booking book.

## Consequences

- **Custody oversell becomes unrepresentable** — you cannot check out more units than are held,
  enforced by the account flag rather than by a check that can be skipped.
- **Fulfillment state becomes derivable** (ADR-0014): pending units versus posted units are a
  balance question, so the pick/out/returned portion of order status needs no stored copy.
- **Forward-booking conflict detection is unchanged and still application logic.** TigerBeetle
  contributes nothing there, and the interval engine's exactness rule continues to hold. Anyone
  reading "reservations are in the ledger" must not conclude the ledger prevents double-booking a
  future date — it does not.
- **The two-phase timeout is the compensation mechanism SPIKE-002 already needs.** An orphaned
  pending transfer expires on its own, which is the recovery path for a crash between the
  TigerBeetle pending and the MongoDB write.
- **Where the boundary sits is not yet settled** — at pick, at staging, or at some earlier
  commitment point. SPIKE-012 decides it, and the answer determines how much of order status is
  derived versus recorded.
- Serialized and asset-tracked units do not fit a fungible balance and are out of scope here.
