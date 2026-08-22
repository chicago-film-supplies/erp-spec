---
id: ADR-0042
headline: the sweeper is the sole resolver
title: >-
  An orphaned pending transfer is resolved only by the application sweeper, which needs an intent
  record written before the reserve
status: proposed
date: 2026-08-22
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger, availability, fulfillment]
relates_to: [ADR-0003, ADR-0015, ADR-0017, HOT-022, SPIKE-002, SPIKE-001]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      `Transfer.timeout` is ZERO on every pending transfer. TigerBeetle never expires anything, and
      the application sweeper is the sole resolver of an orphaned pending transfer.
  - id: D2
    kind: decision
    claim: >-
      The sweeper resolves by READING MONGODB and then acting: document present, post the transfer;
      document absent, void it. It never decides from the ledger alone.
  - id: D3
    kind: decision
    claim: >-
      An INTENT record is written before the reserve and cleared only after the transfer settles.
      The intent is what the sweeper enumerates. It may be the MongoDB document itself in a
      pre-committed state; this decision does not require a third store.
  - id: D4
    kind: decision
    claim: >-
      Two time bounds are stated and monitored: T_claim, the age at which the sweeper may treat an
      intent as orphaned, which must exceed the writer's worst-case completion time; and T_resolve,
      the maximum time an orphan may hold stock, which is an SLO with an orphan-age metric behind
      it. T_resolve is what replaces TigerBeetle's timeout as the answer to "reserved funds are not
      held in limbo indefinitely".
  - id: P1
    kind: premise
    claim: >-
      TigerBeetle expires a pending transfer unilaterally once `Transfer.timeout` elapses, and
      posting an expired transfer fails with `pending_transfer_expired`. Its expiry consults nothing
      and cannot be prevented while the timeout is non-zero.
    source: "code:2026-08-22:tigerbeetle-node@0.17.9:dist/bindings.d.ts"
  - id: P2
    kind: premise
    claim: >-
      TigerBeetle cannot enumerate unresolved pending transfers. `QueryFilter` carries no predicate
      for `flags.pending` and none for `pending_id`, so "which pending transfers are still
      outstanding" is not a question the ledger can answer.
    source: "code:2026-08-22:tigerbeetle-node@0.17.9:dist/bindings.d.ts"
  - id: P3
    kind: premise
    claim: >-
      A pending transfer can be posted or voided only once, and a second attempt returns
      `pending_transfer_already_posted` or `pending_transfer_already_voided`. TigerBeetle therefore
      supplies the atomicity that makes a sweeper racing a live writer safe rather than a hazard.
    source: "code:2026-08-22:tigerbeetle-node@0.17.9:dist/bindings.d.ts"
supersedes:
superseded_by:
---

> **In the context of** a two-store commit whose pending transfer can be orphaned by a crash,
> **facing** a ledger that expires such transfers blindly and cannot enumerate them at all, **we
> decided** that the application sweeper is the sole resolver and that an intent record is written
> before the reserve, **to achieve** an orphan that is always findable and always resolved against
> both stores, **accepting** that "not held in limbo indefinitely" becomes our SLO to meet rather
> than the database's to enforce.

## Context

`SPIKE-002` verified the commit protocol — reserve, write, post or void — under both randomised
simulation and Apalache bounded verification. **Two questions the model could not express turned out
to decide the design**, and both were found by adding the missing state rather than by reading.

### The timeout is blind, and blindness is the thing the spec already refuses (HOT-022)

`ADR-0015` proposed relying on `Transfer.timeout`: _"An orphaned pending transfer expires on its
own, which is the recovery path for a crash between the TigerBeetle pending and the MongoDB write."_

⚠️ **The formal spec has refused that mechanism since 2026-08-09 without anyone noticing.** Its
`naive_sweeper` companion models recovery that voids on timeout **without reading MongoDB**, and
fails. **TigerBeetle's built-in expiry is that companion, running inside the database** — it is
blind by construction (P1).

The `expiring_timeout` module makes it concrete. Counterexample, three steps, `dead: false`
throughout:

```
reserve → writeDoc → expire        ⇒ a durable document behind a transfer that can never be posted
```

⭐ **NO CRASH IS REQUIRED.** This is a race with the clock, not a crash interleaving: a writer
merely slower than the timeout strands the document. **And no timeout value fixes it** — a longer
timeout shrinks the window but never closes it, and the two are correlated, because expiry fires
precisely when the writer is slow, which is the case the timeout was supposed to survive.

⚠️ **Why it went unseen for thirteen days, and it is the more useful half.** `two_store_commit`'s
`TbState` has no expired state, so the interleaving was not unchecked — **it was unrepresentable.**
A model that cannot express a failure reports no violation, and that is indistinguishable from a
model that ruled the case out.

### With the timeout refused, discovery becomes load-bearing — and the ledger cannot help

Once the sweeper is the only resolver, the question `two_store_commit` never asks becomes the whole
problem: **how does the sweeper FIND an orphan?** The model lets recovery fire out of nowhere.
Nothing modelled discovery, so nothing could show it failing.

**It cannot come from TigerBeetle** (P2). The query surface is equality-only on the three
`user_data` fields, `ledger` and `code`, plus a timestamp range — `ledger/tigerbeetle-accounts.yaml`
owns that surface and this ADR does not restate it — and **it carries no predicate for
`flags.pending` and none for `pending_id`.** "List unresolved pending transfers" is not a question
the ledger can answer.

**And MongoDB cannot help either, in exactly the window that matters.** Under the protocol's own
ordering the document is written _after_ the reserve, so a crash in between leaves a pending
transfer invisible to both stores at once. The `undiscoverable_orphan` module fails in **two
steps**:

```
reserve → crash                    ⇒ a pending transfer holding stock that nothing can find
```

## Decision

**The application sweeper is the sole resolver, and it is given something to enumerate.**

1. **`Transfer.timeout` is zero on every pending transfer** (D1). TigerBeetle expires nothing.
2. **The sweeper reads MongoDB, then acts** (D2) — document present, post; document absent, void.
   Never from the ledger alone, which is the property `naive_sweeper` exists to protect.
3. **An intent record is written BEFORE the reserve and cleared only after the transfer settles**
   (D3). The intent is what the sweeper enumerates. ⭐ **It may be the MongoDB document itself in a
   pre-committed state** — the model treats the intent abstractly and does **not** require a third
   store; what it requires is that some store we control knows an operation is in flight before the
   ledger does.
4. **Two time bounds, both stated and both monitored** (D4):
   - **`T_claim`** — how old an intent must be before the sweeper may treat it as orphaned. **It
     must exceed the writer's worst-case completion time**, or the sweeper races a live writer as
     routine behaviour rather than as an exception.
   - **`T_resolve`** — the maximum time an orphan may hold stock. **This is the SLO that replaces
     TigerBeetle's timeout**, and the honest reading of the trade: TigerBeetle's own warning about
     reserved funds "held in limbo indefinitely" is real, and refusing its mechanism means owning
     the answer ourselves. The metric behind it is the age of the oldest unresolved intent, alerted
     above `T_resolve`.

⚠️ **The numbers are deliberately not set here.** They are operational, they depend on the writer's
measured latency, and a number invented before that measurement exists would be a guess wearing a
decision's clothes. What this ADR fixes is that **two named bounds exist, that one of them is an
SLO, and that something measures it.**

## Considered options

- **Rely on `Transfer.timeout`** — ADR-0015's proposal. **Rejected on a proof, not a preference**:
  it is blind, and `expiring_timeout` shows it strands a durable document with no crash involved.
- **`Transfer.timeout` as a backstop behind the sweeper.** Rejected: when the backstop fires the
  system is in the proven-unsafe state. ⚠️ **A backstop that is unsafe when it fires is not a
  backstop** — it is a rare bug with a scheduled trigger.
- **Make the document retractable**, so expiry is survivable: recovery that finds an expired
  transfer retracts the document rather than posting. Rejected here, and the reason is worth
  recording — it is not a protocol trade but a **product** one, because an order document a user has
  already seen could vanish. It remains available if `T_resolve` ever proves unmeetable.
- **Discover orphans by scanning TigerBeetle.** Rejected: not expressible (P2). ⚠️ A `code`-scoped
  `queryTransfers` window plus local pairing against post/void transfers is the nearest workable
  shape, and it is refused twice over — pairing needs `pending_id`, which is not filterable, and it
  would claim `Transfer.code`, the one spare discretionary field, which already has two contenders
  (`ledger/tigerbeetle-accounts.yaml`). **Spending the last field on a query the sweeper does not
  need is the expensive way to avoid an intent record.**
- **Intent record before the reserve, sweeper resolves against both stores** (chosen). Verified:
  `intent_first` holds under simulation and Apalache, and is a minimal pair against
  `undiscoverable_orphan` — same invariant, difference is the write ordering.

## Consequences

- **"Not held in limbo indefinitely" is now ours to guarantee.** That is the real cost of this
  decision and it should be stated plainly rather than discovered: the database was offering to do
  it, and we refused because its offer is unsafe. **`T_resolve` and its metric are not optional
  extras — they are the thing standing in for the mechanism we declined.**
- **The writer must handle `pending_transfer_already_voided`** (P3). If the sweeper claims an intent
  and voids while a slow writer is still alive, the writer's own post fails with that code, and it
  must compensate rather than treat the failure as success. **`T_claim` makes this rare; the result
  code makes it detectable.** The mirror case is safe by construction — a double post returns
  `pending_transfer_already_posted` and the ledger holds one posting either way.
- **The intent record is a new durable write on the hot path**, before the ledger is touched at all.
  Where it lives is an implementation choice this ADR deliberately leaves open, but it is not free,
  and a design that puts it in the same store as the document gets crash-consistency between them
  for nothing.
- ⚠️ **`ADR-0015` must be amended, not superseded.** It is `proposed`, and only the compensation
  bullet is wrong — the two-phase mapping, the operational-window scoping and the interval-math
  argument all stand. Superseding it would reopen "reservations are pending transfers", which
  nothing here questions.
- **The model keeps all five modules permanently.** `expiring_timeout` and `undiscoverable_orphan`
  must keep failing; `two_store_commit` and `intent_first` must keep holding. ⭐ **Both defects were
  unrepresentable before they were refuted**, and keeping the states in the model is what stops the
  next reader over-reading a green run.
- ⚠️ **This decision is verified against a model, not against a running system.** SPIKE-002's second
  exit criterion — a crash-injection harness — is still unmet (erp-spec#47), and it is now the one
  that matters most, because `expiring_timeout` showed the failure class is a **timing race**, which
  is precisely what a model must assume and a harness can measure.
