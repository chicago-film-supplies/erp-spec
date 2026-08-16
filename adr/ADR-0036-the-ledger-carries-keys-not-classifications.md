---
id: ADR-0036
title: The ledger carries keys, not classifications — product line is derived at report time
status: proposed
date: 2026-08-16
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [
  ADR-0018,
  ADR-0029,
  ADR-0031,
  ADR-0017,
  ADR-0034,
  ADR-0035,
  HOT-013,
  HOT-014,
  REQ-LED-001,
]
supersedes: # promoted from `supersedes_on_acceptance` AT ACCEPTANCE. Gate 6 fails if it is not.
supersedes_on_acceptance: ADR-0018
superseded_by:
---

> **In the context of** ADR-0029 having made allocation a reporting act, **facing** a chart that
> also carried the reporting _classification_ on the posting, **we decided** that a posting records
> keys — causal order(s), invoice, line — and never a product line, **to achieve** a ledger whose
> facts do not move when a category does, **accepting** that no dimensional balance can be read from
> the ledger without joining to the product master.

## Context

- **Owner, 2026-08-16:** "distributing labor costs across product lines is a reporting concern, not
  a ledger concern. **product lines themselves are a reporting concern, not a ledger concern.**
  causal order(s) matter. invoice linking matters. item uids or skus matter."
- ADR-0018 kept the chart plain and moved dimensions onto the posting. **That was half a move.** It
  correctly refused to let a reporting axis into account identity, then let the same axis onto the
  transfer instead — where it is equally frozen, because a transfer is immutable.
- **A product line is not a fact about a posting.** It is `products.uid_tracking_category` — a
  mutable field on a mutable master record, verified 2026-08-16 against the live schema
  (`api:2026-08-16:db_schema products`). There is **no `sku` field**; product identity is
  `products.uid`.
- **It has already moved twice in one month, both times correctly.** `Other` was retired at the
  master, moving 12 products and ~135 lines; `Transport` was dropped 2026-08-09 on a bad measurement
  and restored 2026-08-16 (OQ-034). Under ADR-0018 each is a ledger restatement. Under this ADR each
  is a report re-run.
- ADR-0029 already said allocation is a reporting act and the ledger records un-allocated facts.
  This extends the same principle one step: **classification is a reporting act too.** Distribution
  and category are the same kind of thing, and only one of them had been fenced.

## Decision

**A posting records keys, not classifications.**

The keys a posting carries:

- **Causal order(s)** — the order or orders that caused it. Plural by construction: a shared run
  serving several jobs, and a settlement across several invoices, both exist.
- **Invoice link**, where the posting arises from billing.
- **Line identity — `item.path`**, never `item.uid`. `uid` identifies the _product_ and repeats
  within one document (18% of prod orders); `path` is the row identity, authored by exactly one
  function and self-inclusive (`path.at(-1) === item.uid`).

**One key may serve all three.** `INVOICE_ITEM_LEVELS` is `[order, destination, group]` against
`ORDER_ITEM_LEVELS`'s `[destination, group]`, so an invoice item's path is the order item's path
prefixed by an order divider — `path[0]` **is** the causal order. Where the two agree, one stored
path carries line identity, invoice link and causal order together, and TigerBeetle reference space
is freed rather than spent.

⚠️ **That economy is not yet available and its precondition is measurable.** `api-cloudrun#485`: 10
invoice lines sit at a different path than their order line, a component flattened out of its parent
subtree. Small, and it must close first — a posting keyed on a wrong path is wrong forever. ⚠️ **And
it does not cover labour.** `shift_recorded` keys to a causal job with no invoice line, and its
`absorbed_allocations` rows need their own identity (HOT-014's three-transfers-from-one-shift).

⚠️ **THE PRECONDITION IS A FALSE GREEN, and this ADR must not inherit it.** `api-cloudrun#485`
closed on 2026-08-16 as **`NOT_PLANNED`** — shut, with the divergence standing. "It must close
first" is satisfied in letter and in nothing else. **So the property was measured rather than the
issue** (2026-08-16, whole corpus): of **9,307** comparable invoice lines, **8,981 align**, **267
are invoice-only** lines that never had an order path to agree with, and **59 (0.634%) are
misaligned — the same line uid at a different path.** Six times #485's count, and one defect class:
components flattened out of their parent rental, and custom lines lifted out of their group, on
invoices that omit the unbilled zero-priced parent entirely. ⇒ **The alignment has to become a
property something can fail on** — `scripts/audit-item-paths.ts` already walks both collections, and
#485's own last comment proposed that guard — or this ADR's shared key is wrong for 59 lines,
permanently, in an immutable store. ⚠️ **Separating the 267 is what makes the 59 credible**:
counting all 326 as misalignment would manufacture a defect out of ordinary invoicing.

✅ **The economy is now MEASURED, and it saves one field rather than two**
(`inbox/2026-08-16-the-two-reference-fields-answer-different-questions-and-a-path-fits-neither.md`;
whole corpus, `spikes/harness/posting-key-width-probe.ts`). Three corrections follow, and the ADR
would have been accepted on all three unstated:

- **A path SUBSUMES `source_document_ref` and should displace it**, because it names the document
  and the row within it. That is the saving, and it is real: `user_data_64` holds line identity
  rather than a document ref. It cannot also absorb `journal_entry_id` — 3 of 13 `specified` rules
  span several source documents, so grouping and provenance are two facts and neither derives the
  other.
- ⚠️ **A path does not FIT, and it is not close.** Invoice paths run to depth 7 and **178 bytes**,
  median 115B; **14,410 of 14,410 exceed a u128's 16 bytes — 100%**, and a single 36-char uuid
  overflows one on its own. **Line identity is therefore stored as a HASH or a minted surrogate**,
  not as a path. Collision is not the risk (19,176 revenue-bearing lines gives a ~1e-11 birthday
  bound on 64 bits); **opacity is** — TigerBeetle holds a fingerprint that VERIFIES against the
  projection rather than a reference that RESOLVES without it, which is weaker self-description than
  the two fields it joins were justified by. This ADR takes that trade deliberately.
- ⚠️ **`path[0]` is not reliably the causal order.** **30 of 1,010 invoices (2.97%) carry no `order`
  divider at all**, holding **87 revenue-bearing lines worth $87,839.76**. ✅ The discriminator is
  decisive: **0 of the 30 reference an order and 30 of the 30 carry a `crms_id`** — they are legacy
  CRMS imports, a migration population rather than a live pattern. ✅ **Owner, 2026-08-16: "we can
  change order path to match invoice path in v1."** Re-basing `ORDER_ITEM_LEVELS` to
  `[order, destination, group]` makes the two structurally identical, which turns "where the two
  agree" from a conditional into an invariant **for everything the live system produces**. It cannot
  reach the 30 — they reference no order, so there is nothing for a divider to name. The rule is
  fixed going forward; the 30 need a migration answer, not a path answer.

**Keys are `products.uid`, never `sku`.** A human-readable id is by construction one someone will
want to change; `sku` is a display and integration concern (it replaces `crms_id` within ~6 months
and does not govern).

`product_line` and `cost_type` are **not** posting fields. The product-line view is derived at
report time by joining the posting's line identity to the product master. `ledger/dimensions.yaml`
describes a **reporting** taxonomy, not a ledger one.

**Supersedes ADR-0018.** ADR-0018's chosen option — a plain chart of accounts, one account per GL
code — **survives unchanged and is re-affirmed here**. What is reversed is the second half of its
sentence: dimensions are not carried on the posting either. Per ADR-0034 this is a change of
decision, so superseding is the correct instrument and a narrow relates-to ADR is not.

The supersession is **declared, not yet enacted**: `supersedes_on_acceptance: ADR-0018` in the front
matter above. ADR-0018 stays in force until this ADR is accepted, which is correct — nothing has
replaced it yet.

At acceptance, three fields move together: this ADR's `supersedes_on_acceptance` → `supersedes`, and
`ADR-0018.superseded_by` → `ADR-0036` with `ADR-0018.status` → `superseded`. **That is gated, not
remembered** — gate 6 fails on an `accepted` ADR still carrying `supersedes_on_acceptance`, and
again on a `superseded_by` written without the matching status.

The field exists because of this ADR. Drafting it was the first time anything here declared a
supersession from a `proposed` ADR, and the machinery could not express one: gate 6 demanded
symmetry unconditionally, and `generate.ts` computed in-force as
`status === "accepted" && !superseded_by`, so satisfying the gate meant dropping ADR-0018 out of
`in-force.generated.md` and leaving the repo with **no in-force decision on the chart of accounts**
while nothing accepted had replaced it. **erp-spec#18** — the third instance of the repo's own rule
that an unexercised branch is a claim rather than a capability, and it surfaced the same way the
other two did, by being the first to take the untravelled path.

## Consequences

- **HOT-013 dissolves rather than resolves.** There was never a dimension to fit into a `user_data`
  field. The claimant list loses `product_line` and `cost_type` and gains the keys above — which is
  a different budget problem, not the same one, and it is a problem about **references**, which is
  what `user_data` is for.
- ⚠️ **And this is a CHOICE, not a forced move — the slot exists and is declined.** HOT-013 and
  erp-spec#3 were both written against a field count that is wrong: `Transfer.code` is a **fourth**
  discretionary reference field (u16, "the reason for/category of the transfer", a first-class
  `QueryFilter` filter), and nothing in `ledger/` claims it. The unhoused dimensional payload
  measures **84 combinations — 7 bits of 16** across all 13 `specified` rules, because no posting
  dimensions both legs and 5800 alone owes two dimensions. So "there is nowhere to put them" was
  never the argument and must not become the remembered one
  (`inbox/2026-08-16-the-transfer-field-budget-is-four-fields-not-three-and-both-candidate-evictions-are-already-refused.md`,
  `code:2026-08-16:.claude/docs/tigerbeetle.txt` — `Transfer.code` L12725). **The rejected
  alternative is therefore live and stated:** keep dimensions on the transfer, packed into `code`.
  It is refused on this ADR's own criterion rather than on capacity — a product line is
  `products.uid_tracking_category`, a mutable field on a mutable master, and freezing it into an
  immutable transfer is the defect regardless of which field holds it. It has moved twice in one
  month. **A cheap wrong answer is still the wrong answer**, and it would cost `code` its
  conventional occupant (the transfer's reason) on top.
- **HOT-014 is absorbed.** It said ADR-0029 requires every posting to carry its causal order and
  none does. That requirement is now this ADR's decision rather than an unmet obligation, and the
  posting entity has to gain the field either way.
- **REQ-LED-001 must be restated, not deleted.** Its real content is the absence-versus-null rule —
  what is refused is an undeclared value, not a null. That rule is _better_ against a key than
  against a classification: a posting with no causal order is unallocatable and should be refused,
  and unlike a category there is no defensible null. The golden rejection vectors move from "missing
  dimension" to "missing key". ⚠️ **"No defensible null" is FALSIFIED by the corpus, and the
  correction is the owner's to choose.** **$87,839.76 across 87 revenue-bearing lines on 30 issued
  invoices have no causal order** — all 30 legacy CRMS imports referencing no order at all. Refusing
  them outright makes 30 historical invoices unpostable, which ADR-0020's "the restatement must not
  alter any amount" forbids. Three amendments are available: **(1)** the rule binds NEW postings
  only and migrated history carries an explicit null; **(2)** the migration mints a synthetic order
  per legacy invoice — fabricating a document that never existed; **(3)** the key is nullable
  outright, which weakens it into exactly the classification-shaped thing this ADR refuses. **(1) is
  the only one that neither fabricates a record nor dissolves the rule**, and it is what this ADR
  should say before acceptance. Recorded here rather than silently chosen, because it changes what
  the rejection vectors assert.
- **`cost_type` is renamed `labor_line` and its enum grows to seven** — `delivery`, `counter`,
  `warehouse`, `trash_&_cleanup`, `shipping_&_handling`, `trucking`, `crew` (owner, 2026-08-16).
  `cost_type` was too broad, and `labor_line` pairs with `product_line` by design. Five of the seven
  mirror an activity product line; `counter` and `warehouse` bill nobody. **American spelling, and
  the live books decide it rather than taste**: of 134 live accounts,
  `4120
  Contract **Labor** Income` is the only one naming the concept and **no account contains
  "Labour"** (`api:2026-08-16:db_chart_of_accounts_query`, 134 accounts). The repo's British prose
  is spec-side drift from the incumbent chart. The field has never been called `labour_line` in any
  artifact, so the rename goes `cost_type` → `labor_line` directly.
- **`labor_line` is DERIVED, not a posting field** (OQ-042, owner 2026-08-16): "labor_line should
  follow same protocol as products… **so ledger account rides TigerBeetle, the classification is a
  Mongo** [detail]." So this ADR's rule has no exceptions: **the posting carries the GL account and
  its keys; every classification is a Mongo concern.** TigerBeetle records that wages were incurred
  — the account — and _what kind of work_ is read off the shift's allocation row, whose identity the
  posting must carry anyway (HOT-014). Deriving from the **shift record** crosses into a recorded
  historical fact, not into a mutable master, so the criterion above is satisfied rather than
  waived. ⇒ `5800`'s `dimensions: [product_line, cost_type]` becomes `dimensions: []`.
- **Wages move from operating expense into COGS, and this is already specified** —
  `5800 Cost of Goods Sold: Wages (Absorbed)` / `5801 … (Unabsorbed)`, both `disposition: new`,
  `status_live: absent`, against the live `6600 Wages`. ADR-0019 is the decision behind them; this
  ADR only removes their dimension columns. **What 6600 retains — salaried staff who never touch a
  delivery — is OQ-044**, and the utilisation split is why that is a difference in kind: a salaried
  person who sometimes delivers absorbs into 5800 for those hours and 5801 otherwise, while one who
  never does has no absorption mechanism at all.
- **The dimensional balance stops being readable from the ledger alone.** Every product-line figure
  now requires a join to the product master. That is the cost, and it is the same cost ADR-0029
  already accepted for allocation.
- **Nothing needs pinning at seal time, because these reports are never sealed.** Owner, 2026-08-16:
  "there's no reason an ephemeral report would ever need to be sealed or locked. The balance sheet
  and P&L can be derived without these mutable fields. **A P&L by product line or customer type is
  driven by a need for business intelligence, not compliance.**" ADR-0017's sealed artifact is the
  compliance statement — balance sheet and account-level P&L — and neither carries a product line.
  So deriving from a mutable master creates no closed-period exposure at all.
- ⚠️ **ADR-0031 §4 and `reporting/allocation-bases.yaml` therefore overstate their case** and need
  amending: both justify `basis_version` as protecting ADR-0017's no-drift guarantee for "a report
  over a sealed period", and the product-line P&L is not one. **`basis_version` survives on its own
  merits** — knowing which basis produced a number, and ADR-0031's own "run both and compare". Only
  the ADR-0017 justification goes.
- **Re-runnability, which is the owner's reason for the whole split, now covers categorisation
  too.** Before this ADR, a basis could be re-run but a category could not. Both can now — and with
  a categorisation history on the product master, a historical P&L becomes re-derivable **as
  classified then** as well as **as classified now**, with no ledger field at all.
- **Per-product TigerBeetle accounts married to a product-line account were raised and set aside**
  (owner, 2026-08-16: "probably overkill and/or trying to force something into TigerBeetle that
  doesn't naturally fit"). Recorded so it is not re-argued a third time: it is ADR-0008's exploded
  model again, **the marriage is the mutable half** and TigerBeetle accounts cannot be re-parented,
  and the one place the shape _is_ natural already exists — per-item balances that must not go
  negative are the inventory-custody ledger (ADR-0015). Per-product **money** balances are a
  reporting roll-up, which is the test for what does not belong in TigerBeetle.
- **The chart of accounts' `dimensions:` lists and gate 10's dimension checks are obsoleted** in
  their current form, and `ledger/vectors/` will need reworking. That is a large mechanical
  follow-up and it is not performed here.
