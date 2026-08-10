---
id: SPIKE-012
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
closes_adr: ADR-0015
status: open
---

## Notes

The failure this spike exists to prevent is a boundary drawn too early. Pull it back far enough and
a forward booking starts consuming balance, which silently reintroduces the per-day-rollup oversell
the v1 engine deliberately avoids — and it would present as availability being _too low_, which
reads as conservative rather than as a bug.

The count of underivable statuses is the real output. ADR-0014 says to shrink the assigned set
without pretending it is empty; this is where that claim gets a number instead of an intention.
