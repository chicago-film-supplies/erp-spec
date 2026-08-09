---
id: ADR-0025
title: The dimension obligation is stated per account, and the escape hatch is an account
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-011, OQ-021, OQ-022, OQ-025, REQ-LED-001, ADR-0009, ADR-0018, ADR-0020]
supersedes:
superseded_by:
---

> **In the context of** three spec statements disagreeing about which postings must carry which
> dimensions, **facing** a chart with revenue and COGS accounts for which neither dimension has a
> defensible value, **we decided** to state the obligation per account and to make an undimensioned
> *account* the escape hatch rather than an `Other` dimension value, **to achieve** a non-nullable
> dimension that never has to be faked, **accepting** that an uncategorised receipt now changes
> which account it lands in rather than merely which bucket it reports under.

## Context

Three statements disagreed, and all three were load-bearing (HOT-011):

- **REQ-LED-001** — both dimensions on *every* revenue and COGS posting.
- **`ledger/dimensions.yaml`** — `product_line` on revenue and COGS, `cost_type` on COGS only.
- **The chart itself** — accounts where even `product_line` has no defensible value.

`cost_type`'s own description is *"what kind of work a **labour** posting represents"*, with values
`delivery / counter / warehouse`. None of them is true of a camera rental, or of
`5000 Cost of Goods Sold: Retail Inventory`. Separately, `4820 Interest Income` and five siblings
are `type: Other Income` live and arise from no sale at all
(`api:2026-08-09:db_chart_of_accounts_query`, 134 accounts).

ADR-0018 removed the structural backstop: with dimensions off account identity, a posting missing
one has an account to land in, so **only the non-null rule stands between REQ-LED-001 and a silent
null**. `ledger/dimensions.yaml` had already flagged the trap — a non-nullable dimension makes
`Other` the new null.

## Decision

**The obligation is per account.** Each entry in `ledger/chart-of-accounts.yaml` carries an explicit
`dimensions:` list — the dimensions a posting to it must carry. `cost_type` appears on
`5800 Cost of Goods Sold: Wages (Absorbed)` and nowhere else.

**`Other` is deleted from the `product_line` value set** — 21 values become 20.

**The escape hatch is an account, not a value.** A one-off product or service that maps to no
product line is coded to **4800 Other Income**, which requires no dimension.

REQ-LED-001 is amended to match and keeps its teeth: a posting to an account whose `dimensions`
list names a dimension is **rejected** if it lacks one.

## Considered options

- **Widen the requirement** — require `cost_type` everywhere and mint a "not labour" value for it.
  Rejected: that value is a null with a name, and it would be the majority value.
- **Permit a null `product_line` on revenue.** Rejected on ADR-0009's ground: a null meaning "we
  could not categorise this" is indistinguishable from one meaning "this legitimately has no
  category", and once written the distinction is gone. It also re-permits the exact population
  REQ-LED-001 was written to stop — 28.74% of line revenue, measured.
- **Keep `Other`.** Rejected: it reads as a category and means "nobody chose". A line in 4800
  asserts *this was not a categorised sale*, which is a fact about the transaction. A line in 4100
  tagged `Other` asserts *this was a categorised sale* and then names no category, which is not.
- **Per-account obligation with an account-shaped escape hatch** (chosen).

## Consequences

- **Nothing infers a dimension requirement from a class.** The previous gate derived "needs
  `cost_type`" from `class == expense`, which was wrong for six COGS accounts the moment `cost_type`
  became labour-only. A per-account list cannot be wrong by inference — only by being written
  wrong, which is visible in review.
- **`dimensions.yaml` and the chart become two authorities that check each other.** The chart says
  which postings owe a dimension; `dimensions.yaml` says which values it may take. Gate 10 checks
  every golden vector against both — and therefore against neither the rule nor the vector it is
  checking, which is the independent-property discipline this repo requires.
- **An uncategorised receipt now moves account, not just bucket.** That is the real cost of this
  decision and it should be stated plainly: revenue mix on the P&L changes shape, because what used
  to sit in operating revenue under `Other` now sits in Other Income. That is the intent — it is
  visible on the face of the statement rather than inside a dimension nobody reads — but it is a
  reporting change, not only a data-model one.
- **It does not settle the history.** ADR-0020 restates every undimensioned line before import, and
  the residue — facility and professional services with no equipment category, on 4100 Service
  Income — now has no `Other` to fall back on. Reassigning it to 4800 would move money between P&L
  sections, which ADR-0020 forbids ("the restatement must not alter any amount"). **OQ-025.**
- **`cost_type` has exactly one account today.** A dimension with one consumer is worth re-examining
  when the labour rules land: if `shift_recorded` (blocked on OQ-018, OQ-019, OQ-024) ends up
  splitting across more accounts, the set grows; if it does not, `cost_type` may be a property of
  the shift rather than a ledger dimension at all.
