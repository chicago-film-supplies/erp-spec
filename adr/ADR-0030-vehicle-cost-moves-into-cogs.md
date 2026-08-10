---
id: ADR-0030
title: Vehicle cost moves from operating expense into COGS, absorbed and unabsorbed
status: proposed
date: 2026-08-09
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ledger, fulfillment]
relates_to: [ADR-0007, ADR-0019, ADR-0026, ADR-0029, SPIKE-005]
supersedes:
superseded_by:
---

> **In the context of** delivery being the largest tracked product line and carrying almost no cost,
> **facing** vehicle running costs sitting in operating expenses where no product line can see them,
> **we decided** to move vehicle cost into COGS on the same absorbed/unabsorbed shape ADR-0019 gave
> labour, **to achieve** a delivery cost that is complete enough to allocate, **accepting** a second
> utilisation measure to maintain and a mileage-or-hours basis that has to be captured.

## Context

- Vehicle costs are **operating expenses today**: 6400 Repairs & Maintenance, 6401 Registrations &
  Fees, 6402 Fuel, 6403 Parking & Tolls, 6404 Tickets. 2025 actuals total **$21,844.77**, plus
  vehicle depreciation against 1700/1701.
- Nothing connects them to a job, so `Delivery` — 12.8% of revenue, $216,050
  (`inbox/2026-08-09-product-line-by-revenue-account-matrix.md`) — carries essentially no cost, and
  the product-line P&L ADR-0029 specifies cannot be assembled.
- **This is structurally the move ADR-0019 already made for wages**: 6600 Wages was an operating
  expense and became 5800/5801 in COGS. The owner has named vehicle COGS the next priority after
  labour.
- A vehicle has idle capacity in exactly the way a guaranteed crew day does — a van sitting on the
  lot costs insurance, registration and depreciation whether or not it runs.

## Decision

Vehicle cost becomes **cost of goods sold**, split absorbed / unabsorbed on the ADR-0019 pattern:
running cost attributable to a causal job absorbs against that job, and the standing cost of having
a fleet at all is unabsorbed. Both are posted **un-allocated** per ADR-0029 — to `Delivery`, not
spread across the goods delivered — and the official product-line P&L performs the spread.

## Consequences

- **Two new accounts, adjacent, on the 5800/5801 precedent.** Codes are not chosen here; the chart
  picks the next free pair and states its reasoning as 5800 did.
- **6400–6404 stop taking new postings** and stay in the chart for historical periods, the same
  treatment 6600 Wages receives under ADR-0019.
- **The absorption basis is unresolved and is the real work.** Labour had an obvious one — hours,
  which the shift already records. A vehicle's is mileage, or hours in service, or trips, and
  **none of those is captured today**. Choosing it decides what the fulfillment context must record
  on a leg, so it is a data-capture requirement before it is an accounting one.
- **A second utilisation number appears**, and it is genuinely useful: the gap between absorbed and
  unabsorbed vehicle cost is fleet utilisation, the same shape as crew utilisation. It is also a
  second thing to keep honest, with the same trap — an unabsorbed account that can be dimensioned
  becomes a plug.
- **Depreciation is the awkward part and is deliberately deferred.** Vehicle depreciation belongs in
  the same absorbed/unabsorbed treatment, but it is computed by the engine SPIKE-005 has not chosen
  and it differs per book under ADR-0026. Bringing running costs across first, and depreciation when
  the engine exists, is the sequencing this ADR assumes.
- **Tickets (6404, $3,635.88 in 2025) should probably NOT absorb.** A parking fine is not a cost of
  serving a job; it is a cost of how a job was served, and absorbing it into a product line would
  make a product look expensive because someone parked badly. It is also nondeductible for tax, and
  therefore a Schedule M-1 permanent difference that ADR-0026 keeps out of both books. Left as a
  question for the chart entry rather than settled here.
