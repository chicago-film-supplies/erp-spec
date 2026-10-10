---
id: ADR-0055
headline: what a reservation is under PostgreSQL
title: >-
  A reservation commits with the document that causes it, future bookings stay intervals, and a
  serialized product reserves a quantity with optional named units
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [availability, fulfillment, ordering]
relates_to: [
  ADR-0015,
  ADR-0049,
  ADR-0014,
  ADR-0042,
  HOT-022,
  SPIKE-012,
  SPIKE-014,
  OQ-070,
]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      A future-dated booking is an interval record and never consumes custody. Availability over a
      window is computed from raw intervals, never from a per-day rollup.
  - id: D2
    kind: decision
    claim: >-
      A reservation, and every custody movement, commits in the same database transaction as the
      document change that causes it.
  - id: D3
    kind: decision
    claim: >-
      Checking out more units than are held is refused by the database at commit, not by an
      application check that a code path can skip.
  - id: D4
    kind: decision
    claim: >-
      A reservation of a serialized product reserves a quantity, and MAY also name specific units.
      Two live reservations naming the same unit may not overlap in time. Units not named at
      reservation are named on the movement that moves them.
  - id: P1
    kind: premise
    claim: >-
      ADR-0015 modelled a reservation as a TigerBeetle pending transfer, and ADR-0049 removes
      TigerBeetle from the target stack.
    source: ADR-0049
  - id: P2
    kind: premise
    claim: >-
      v1 tracks serialized units by number on a per-product roster folded from movements, reserves
      quantities, and names units at prep or check-out.
    source: inbox/2026-10-07-survey-v1-settled-the-serialized-unit-model-that-adr-0015-leaves-out-of-scope.md
supersedes:
superseded_by:
---

> **In the context of** one transactional system of record (ADR-0049), **facing** a reservation
> model (ADR-0015, rejected) that was a TigerBeetle mechanism, **we decided** that a reservation
> commits with the document that causes it, that forward bookings stay interval records, and that a
> serialized product reserves a quantity with optional named units, **to achieve** custody oversell
> refused by the database without a cross-store protocol, **accepting** that whether "committed to
> an in-progress fulfillment" is a custody phase or only a movement count is still open (OQ-070).

## Context

- ADR-0015 mapped fulfillment onto a two-phase transfer: reserve → pending, check out → post, cancel
  → void. Its value was that custody oversell became unrepresentable and fulfillment state became a
  balance question (ADR-0014). Its cost was a second store, an orphanable pending transfer, and
  ADR-0042's sweeper. Both ADRs are rejected (P1).
- **Its interval argument does not depend on the store and carries over.** A booking six months out
  must not consume stock today, and with `held = 2` and bookings on days 1–2 and 4–5, the window
  `[1,5]` is exactly 0 while a daily curve says 1. A per-day rollup oversells.
- Under ADR-0049 the reservation, the document and the custody balance share one transaction, so
  there is no orphan and no timeout to choose. What is left is what a reservation IS.
- **Serialized units** were out of ADR-0015's scope. v1 has since built a unit roster (P2). That is
  evidence of a working shape, not a reason to adopt it. The owner asked, 2026-10-09, for a quantity
  reservation that may optionally name units, and for both reservation models below to be drafted
  and decided at review
  (`inbox/2026-10-09-owner-rejects-adr-0015-and-adr-0042-and-asks-for-both-reservation-models-drafted.md`).
- SPIKE-012 measured where the reservation boundary can sit without a forward booking consuming
  custody. Its measurements are of v1 and survive; its "pending transfer" framing does not.

## Decision

**Settled:**

- **Future bookings are intervals** (D1). Forward-booking conflict detection is interval math over
  raw intervals, in application code, under whatever per-product serialization SPIKE-014 measures.
- **A reservation commits with its cause** (D2). No intent record, no sweeper, no timeout.
- **The database refuses custody oversell** (D3). How — a `CHECK` on a per-product custody row, a
  constraint trigger, or an exclusion constraint — is an implementation choice for SPIKE-014.
- **Serialized products reserve a quantity, optionally named units** (D4). A named unit is held by
  at most one live reservation over any instant, which is interval math per unit. A unit not named
  up front is named on the prep or check-out movement.

**Open — OQ-070 (reservation as custody phase or movement count):**

| Option                        | A reservation is…                                                                                                                                                                     | Oversell refused by                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A — custody phase**         | an event that moves units from `held` to `committed` on the product's custody balance. Check-out moves `committed` → `out`; cancel moves them back. The three phases are event kinds. | a constraint that `held − committed − out ≥ 0`                          |
| **B — no reservation entity** | not a balance state. Fulfillment progress is a count per booking (picked, prepped, out, returned) derived from movement events; nothing is held until it leaves.                      | a constraint on check-out only; picking does not reduce what is on hand |

- **A** keeps ADR-0015's property that two concurrent picks cannot both commit the last unit. It
  needs a rule for a reservation an operator abandons, because it holds custody until cancelled.
- **B** is the smaller model, and closer to v1's per-booking `breakdown` counters (SPIKE-012 M1) —
  which is evidence it is buildable, not that it is right. Two picks of the last unit both succeed
  and the second check-out fails, which surfaces the conflict at the dock rather than at the shelf.

## Considered options

- **Port ADR-0015 to PostgreSQL** — a `pending` row with a timeout and a resolver. Rejected: the
  timeout and resolver existed only because the reservation and the document were in different
  stores.
- **An account per time bucket.** Rejected, as in ADR-0015: a per-day decomposition oversells.
- **Reserve units only, never quantities.** Rejected for D4: it forces a unit choice at booking time
  for fungible use, and the walkie fleet is 260 interchangeable radios.
- **A and B** (above) — undecided.

## Consequences

- ADR-0042 and HOT-022's question (how is an orphaned pending transfer found) have no subject.
- **SPIKE-012 closes this ADR** and its question becomes "at which fulfillment moment does a booking
  first affect custody". Under B the answer is check-out by construction.
- **SPIKE-014 measures D3**: a concurrent check-out of the last unit refused at commit.
- Named-unit reservations make the unit roster a reservation input, not only a projection of
  movements. The roster still carries no cost.
- Forward-booking conflict detection is unchanged and is still application logic. Nothing here makes
  the database refuse a double-booked future date.
