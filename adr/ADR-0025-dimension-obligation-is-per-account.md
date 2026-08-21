---
id: ADR-0025
headline: dimension obligation is per account
title: The dimension obligation is per account, and what is refused is absence rather than null
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-011, HOT-019, OQ-021, OQ-022, OQ-025, REQ-LED-001, ADR-0009, ADR-0018, ADR-0020]
accounting_shaped: true
survey:
  - inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md
supersedes:
superseded_by:
---

> **In the context of** three spec statements disagreeing about which postings must carry which
> dimensions, **facing** a chart with revenue and COGS accounts for which neither dimension has a
> defensible value, **we decided** to state the obligation per account and to refuse ABSENCE rather
> than null, **to achieve** a dimension that never has to be faked and whose gaps are countable,
> **accepting** that "how much revenue has no product line" becomes a number someone must keep
> watching rather than an error the system cannot represent.

## Context

Three statements disagreed, and all three were load-bearing (HOT-011):

- **REQ-LED-001** — both dimensions on _every_ revenue and COGS posting.
- **`ledger/dimensions.yaml`** — `product_line` on revenue and COGS, `cost_type` on COGS only.
- **The chart itself** — accounts where even `product_line` has no defensible value.

`cost_type`'s own description is _"what kind of work a **labor** posting represents"_, with values
`delivery / counter / warehouse`. None of them is true of a camera rental, or of
`5000 Cost of Goods Sold: Retail Inventory`. Separately, `4820 Interest Income` and five siblings
are `type: Other Income` live and arise from no sale at all
(`api:2026-08-09:db_chart_of_accounts_query`, 134 accounts).

ADR-0018 removed the structural backstop: with dimensions off account identity, a posting missing
one has an account to land in, so **only this rule stands between REQ-LED-001 and a silent gap**.
`ledger/dimensions.yaml` had already flagged the trap — a non-nullable dimension makes `Other` the
new null, so forbidding null outright does not remove the gap, it renames it.

## Decision

**The obligation is per account.** Each entry in `ledger/chart-of-accounts.yaml` carries an explicit
`dimensions:` list — the dimensions a posting to it must carry. `cost_type` appears on
`5800 Cost of Goods Sold: Wages (Absorbed)` and nowhere else.

**`Other` is deleted from the `product_line` value set** — 21 values become 20.

**Two mechanisms replace `Other`, stating different facts.** `product_line: null` on a dimensioned
account says "this is a categorised kind of sale and no tracked product line applies". **4800 Other
Income**, which requires no dimension at all, says "this was not a categorised sale" — interest,
cashback, a vendor refund, a one-off oddity. Neither substitutes for the other: coding a real
service to 4800 understates operating revenue, and nulling a genuine one-off on 4100 overstates it.

REQ-LED-001 is amended to match and keeps its teeth, with the boundary drawn at **absence rather
than null** (OQ-025): a posting to an account whose `dimensions` list names a dimension must DECLARE
it — a value from the declared set, or an explicit `null` recording that no tracked value applies. A
posting that does not declare it is **rejected**, and so is one declaring `""`.

## Considered options

- **Widen the requirement** — require `cost_type` everywhere and mint a "not labor" value for it.
  Rejected: that value is a null with a name, and it would be the majority value.
- **Permit an absent `product_line` on revenue.** Rejected: it re-permits the exact population
  REQ-LED-001 was written to stop — **15.00% of line revenue, re-measured 2026-08-10** — and on
  ADR-0009's ground, a value that is simply missing cannot be told apart from an oversight. ⚠️ Read
  28.74% here until 2026-08-10; that figure counted a line denorm that was null on 227 categorised
  lines (api-cloudrun#473). ⚠️ An **explicit null is not this option** and is permitted. The
  distinction is the one ADR-0009 actually draws: what it forbids is a null nobody wrote down. A
  declared null is a determination — "no tracked product line applies" — and it is countable,
  reportable, and attributable, exactly as `EVT-TAX-002` carries a reason because "no tax" and "no
  tax BECAUSE" audit differently.
- **Keep `Other`.** Rejected: it reads as a category and means "nobody chose". A line in 4800
  asserts _this was not a categorised sale_, which is a fact about the transaction. A line in 4100
  tagged `Other` asserts _this was a categorised sale_ and then names no category, which is not.
- **Per-account obligation with an account-shaped escape hatch** (chosen).

## Consequences

- **Nothing infers a dimension requirement from a class.** The previous gate derived "needs
  `cost_type`" from `class == expense`, which was wrong for six COGS accounts the moment `cost_type`
  became labor-only. A per-account list cannot be wrong by inference — only by being written wrong,
  which is visible in review.
- **`dimensions.yaml` and the chart become two authorities that check each other.** The chart says
  which postings owe a dimension; `dimensions.yaml` says which values it may take. Gate 10 checks
  every golden vector against both — and therefore against neither the rule nor the vector it is
  checking, which is the independent-property discipline this repo requires.
- **A null is a population that must be watched — and the watch must read the authoritative field.**
  "Share of revenue with a null product line" is a number the read side can produce at any time. The
  current system's equivalent was invisible until someone measured it and found 28.7% — and ⚠️
  **that measurement was itself wrong**, because it counted a denorm on the invoice line rather than
  the product master behind it. The share that meant "an operator declined to classify" was
  **$688.00 — 0.041% of all line revenue**; the rest was a derivation that never ran
  (api-cloudrun#473, repaired 2026-08-10). If the population grows, the answer is a new product line
  or a real decision — never a default value — but first confirm the number is measuring a decision
  and not a defect.
- **A non-operating receipt now moves account, not just bucket.** That is the real cost of this
  decision and it should be stated plainly: revenue mix on the P&L changes shape, because what used
  to sit in operating revenue under `Other` now sits in Other Income. That is the intent — it is
  visible on the face of the statement rather than inside a dimension nobody reads — but it is a
  reporting change, not only a data-model one.
- **It settles the history too** (OQ-025). ADR-0020's restatement residue — facility and
  professional services with no equipment category, on 4100 Service Income — takes
  `product_line: null` and stays on 4100. They do not map to a tracked product line, so null is the
  true statement about them. Crucially this keeps the restatement to **assigning a dimension** and
  moves no money between P&L sections, which is what ADR-0020 requires ("the restatement must not
  alter any amount"). Reassigning them to 4800 would have.
- **`cost_type` has exactly one account today.** A dimension with one consumer is worth re-examining
  when the labor rules land: if `shift_recorded` (blocked on OQ-018, OQ-019, OQ-024) ends up
  splitting across more accounts, the set grows; if it does not, `cost_type` may be a property of
  the shift rather than a ledger dimension at all.
