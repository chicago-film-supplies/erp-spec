---
kind: decision-input
title: >-
  The owner's reason for allocation-as-reporting is RE-RUNNABILITY — multiple bases, and
  re-allocating what is already booked — which inverts HOT-014's third candidate, because the sealed
  artifact must carry the allocation INPUTS rather than the allocated output
contexts: [ledger, billing, fulfillment]
source: "Repo owner, 2026-08-16, in session · code:2026-08-16:erp-spec@8e24cea:contexts/ledger/entities/posting.yaml · code:2026-08-16:erp-spec@8e24cea:reporting/queries/product-line-pl.sql · code:2026-08-16:erp-spec@8e24cea:reporting/allocation-bases.yaml · ADR-0017, ADR-0029, ADR-0031"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## The owner's stated reason, recorded because it is a design constraint and not a preference

> "i liked allocation being a reporting function, that way i can reallocate, i can have multiple
> allocation methods"

ADR-0029 argued allocation-as-reporting from **destructiveness** — "an allocated posting cannot be
un-allocated". This is the same decision reached from the other side, and it is a **stronger and
more testable requirement**: not merely "do not destroy the un-allocated fact" but "**be able to run
a different basis over facts already booked**".

The two are not the same, and the difference is exactly where the spec is thin. Non-destructiveness
is satisfied by never allocating at post time. Re-runnability additionally requires that the
allocation's **inputs** stay reachable for as long as anyone may want to re-ask — including across a
period close.

**Two capabilities, and the spec's support for them differs:**

| Capability                                                 | Supported today?                                                                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Several bases available, pinned per report**             | **Yes, by design.** `reporting/allocation-bases.yaml` is a versioned registry; a report pins `(id, version)`; superseded bases stay so historical reports still resolve what made them |
| **Re-allocate a period already closed, under a new basis** | **Not established — and the key it would run on is not recorded anywhere.** See below                                                                                                  |

## The gap, measured

**`contexts/ledger/entities/posting.yaml` has no causal-order field.** Its fields are `posting_id`,
`journal_entry_id`, `account_ref`, `amount_minor`, `direction`, `accounting_date`,
`posting_timestamp`, `product_line`, `cost_type`, `source_document`, `posting_rule`. That is the
only place in the spec where the posting shape is written.

**`reporting/queries/product-line-pl.sql` joins on `causal_order_id` throughout** —
`SELECT
causal_order_id`, `JOIN base_total t USING (causal_order_id)`,
`PARTITION BY causal_order_id,
pool_id`. The official report's own query reads a column the posting
does not declare.

**ADR-0029 requires it in terms**: "every posting must carry its causal order, or allocation is
impossible and this decision quietly becomes 'never allocate'."

So three artifacts, and the two that need the field disagree with the one that defines the record.
The only place a causal order actually appears is `shift.absorbed_allocations[].causal_job` — inside
the **source document**, below the posting, which is the one shape a `source_document` reference
cannot recover (HOT-014).

## Why this inverts HOT-014's third candidate

HOT-014 listed "**seal the allocation instead of the key**" as the option fitting the existing
architecture best, and recommended surveying it first. **Against this requirement it is the worst of
the three**, because sealing the allocated _output_ is precisely what makes a period
un-re-allocable: you get one frozen answer per period and no way to ask a second question of it.

The correct form of that option is the opposite one: **seal the allocation INPUTS.** ADR-0017
already exports the sealed Parquet **from MongoDB**, "which holds the accounting date and is
queryable" — postings, not report rows. If the posting carries its causal order and its base
amounts, then the sealed artifact carries them, and **any basis whose inputs are in the artifact can
be re-run over a closed period, reproducibly, forever**. That is the capability the owner asked for,
and it costs one field on a record that is already being sealed.

It also narrows the DR exposure to something statable: TigerBeetle would not carry the causal order,
so a MongoDB loss **before close** costs that open period's allocability. After close, the sealed
Parquet holds it. That is a bounded, nameable window rather than an open-ended "the managed number
is not recoverable".

## What is genuinely foreclosed, and should not be mistaken for this gap

Re-running the **weight/cube basis (v2, OQ-033)** over history stays impossible, and for an
unrelated and honest reason: the driver was never captured. `products.shipping.weight` is zero on
all 549 products and no past order records what was moved. `allocation-bases.yaml` says so —
"historical periods have no physical data and must keep resolving the basis that produced them."

**That is a data-capture limit, not an architectural one.** Bases whose inputs _are_ recorded —
goods revenue, line count, quantity — could all be re-run over history if the causal order survives.
Conflating the two would make an avoidable architectural limit look like an unavoidable data one.

## One tension to state rather than resolve

ADR-0017 guarantees "a closed period cannot drift", enforced by an immutable hashed artifact.
Re-allocating a closed period under a new basis produces a **different number for that period**.

That is not drift, and the mechanism to keep it from being drift already exists: a report pins
`(basis_id, version)`, so two reports over the same sealed period under different bases are each
reproducible and each self-identifying. **But the guarantee's wording is about the period, and this
makes it about the (period, basis) pair.** Worth saying explicitly wherever the re-allocation
capability is written down, because a reader comparing two correctly-produced numbers for July needs
to know which axis they differ on.
