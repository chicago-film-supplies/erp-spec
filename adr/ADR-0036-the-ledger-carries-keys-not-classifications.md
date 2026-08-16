---
id: ADR-0036
title: The ledger carries keys, not classifications — product line is derived at report time
status: proposed
date: 2026-08-16
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [ADR-0018, ADR-0029, ADR-0031, ADR-0017, ADR-0034, ADR-0035, HOT-013, HOT-014, REQ-LED-001]
supersedes: # ⚠️ ADR-0018 — written in AT ACCEPTANCE, not now. See "Supersedes ADR-0018" below.
superseded_by:
---

> **In the context of** ADR-0029 having made allocation a reporting act, **facing** a chart that also
> carried the reporting *classification* on the posting, **we decided** that a posting records keys —
> causal order(s), invoice, line — and never a product line, **to achieve** a ledger whose facts do
> not move when a category does, **accepting** that no dimensional balance can be read from the
> ledger without joining to the product master.

## Context

- **Owner, 2026-08-16:** "distributing labor costs across product lines is a reporting concern, not a
  ledger concern. **product lines themselves are a reporting concern, not a ledger concern.** causal
  order(s) matter. invoice linking matters. item uids or skus matter."
- ADR-0018 kept the chart plain and moved dimensions onto the posting. **That was half a move.** It
  correctly refused to let a reporting axis into account identity, then let the same axis onto the
  transfer instead — where it is equally frozen, because a transfer is immutable.
- **A product line is not a fact about a posting.** It is
  `products.uid_tracking_category` — a mutable field on a mutable master record, verified
  2026-08-16 against the live schema (`api:2026-08-16:db_schema products`). There is **no `sku`
  field**; product identity is `products.uid`.
- **It has already moved twice in one month, both times correctly.** `Other` was retired at the
  master, moving 12 products and ~135 lines; `Transport` was dropped 2026-08-09 on a bad measurement
  and restored 2026-08-16 (OQ-034). Under ADR-0018 each is a ledger restatement. Under this ADR each
  is a report re-run.
- ADR-0029 already said allocation is a reporting act and the ledger records un-allocated facts. This
  extends the same principle one step: **classification is a reporting act too.** Distribution and
  category are the same kind of thing, and only one of them had been fenced.

## Decision

**A posting records keys, not classifications.**

The keys a posting carries:

- **Causal order(s)** — the order or orders that caused it. Plural by construction: a shared run
  serving several jobs, and a settlement across several invoices, both exist.
- **Invoice link**, where the posting arises from billing.
- **Line identity** — which line of which document the posting is for.

`product_line` and `cost_type` are **not** posting fields. The product-line view is derived at report
time by joining the posting's line identity to the product master. `ledger/dimensions.yaml` describes
a **reporting** taxonomy, not a ledger one.

**Supersedes ADR-0018.** ADR-0018's chosen option — a plain chart of accounts, one account per GL
code — **survives unchanged and is re-affirmed here**. What is reversed is the second half of its
sentence: dimensions are not carried on the posting either. Per ADR-0034 this is a change of
decision, so superseding is the correct instrument and a narrow relates-to ADR is not.

⚠️ **The `supersedes:` field is deliberately EMPTY while this ADR is `proposed`, and must be filled
in at acceptance** — together with `ADR-0018.superseded_by` and `ADR-0018.status`. The repo cannot
express a proposed supersession: gate 6 demands the link be symmetric, and `generate.ts` computes
in-force as `status === "accepted" && !superseded_by`, so declaring it now would drop ADR-0018 out
of `in-force.generated.md` and leave the repo with **no in-force decision on the chart of accounts**
while nothing accepted had replaced it. Tracked as **erp-spec#18** — the third instance of the repo's own
rule that an unexercised branch is a claim rather than a capability, and it surfaced the same way
the other two did, by being the first to take the untravelled path.

## Consequences

- **HOT-013 dissolves rather than resolves.** There was never a dimension to fit into a `user_data`
  field. The claimant list loses `product_line` and `cost_type` and gains the keys above — which is
  a different budget problem, not the same one, and it is a problem about **references**, which is
  what `user_data` is for.
- **HOT-014 is absorbed.** It said ADR-0029 requires every posting to carry its causal order and none
  does. That requirement is now this ADR's decision rather than an unmet obligation, and the
  posting entity has to gain the field either way.
- **REQ-LED-001 must be restated, not deleted.** Its real content is the absence-versus-null rule —
  what is refused is an undeclared value, not a null. That rule is *better* against a key than
  against a classification: a posting with no causal order is unallocatable and should be refused,
  and unlike a category there is no defensible null. The golden rejection vectors move from
  "missing dimension" to "missing key".
- ⚠️ **`cost_type` is NOT settled by this ADR.** It is `[delivery, counter, warehouse]` — "what kind
  of work a labour posting represents" — which is a fact about the **shift**, not a classification of
  a product, and the owner's statement addressed product lines. It may well be a genuine posting
  field. Left open deliberately rather than swept along.
- ⚠️ **`item.uid` is NOT a line identity and must not be used as one.** It identifies the *product*
  and repeats within a single document — 18% of prod orders per the workspace `CLAUDE.md`, which is
  why `path` exists and why `uid_parent: string` was unrepresentable. A posting keyed on `item.uid`
  cannot distinguish two lines of the same product in different groups. **What "line identity" means
  concretely is the first thing this ADR's implementation must pin**, and the candidates are the
  item `path` or a minted stable line id.
- **The dimensional balance stops being readable from the ledger alone.** Every product-line figure
  now requires a join to the product master. That is the cost, and it is the same cost ADR-0029
  already accepted for allocation.
- ⚠️ **A join to a mutable master means a report is only reproducible if the master's state is
  pinned.** ADR-0017 seals a period's Parquet and hashes it; that artifact must therefore carry the
  product-line *as resolved at seal time*, or a re-categorisation silently restates a closed period —
  the exact failure this ADR exists to prevent, reintroduced one layer up. **A sealed period pins the
  classification; an open period resolves it live.** Re-running history under a *new* categorisation
  then becomes a deliberate, versioned act, exactly like ADR-0031's `basis_version`.
- **Re-runnability, which is the owner's reason for the whole split, now covers categorisation too.**
  Before this ADR, a basis could be re-run but a category could not. Both can now.
- **The chart of accounts' `dimensions:` lists and gate 10's dimension checks are obsoleted** in their
  current form, and `ledger/vectors/` will need reworking. That is a large mechanical follow-up and
  it is not performed here.
