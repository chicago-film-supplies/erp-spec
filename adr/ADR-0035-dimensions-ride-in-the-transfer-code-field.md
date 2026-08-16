---
id: ADR-0035
title: Dimensions ride on the transfer in `Transfer.code`, not in `user_data`
status: proposed
date: 2026-08-16
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ledger]
relates_to: [ADR-0018, ADR-0025, ADR-0017, ADR-0034, HOT-013, SPIKE-003]
supersedes:
superseded_by:
---

> **In the context of** ADR-0018 having decided that dimensions ride on the posting, **facing** a
> `user_data` budget in which all three fields were already claimed, **we decided** to carry the
> `product_line` / `cost_type` pair packed into `Transfer.code`, **to achieve** the placement
> ADR-0018 chose actually being representable, **accepting** that raw TigerBeetle data no longer
> names the posting rule that produced a transfer.

## Context

- **ADR-0018 decided WHERE dimensions live and that decision is not reopened here.** "Dimensions are
  carried on the posting… never in account identity." What it did not do was check that the
  mechanism it named in passing — `user_data` — had room. ADR-0034: it "did not decide wrongly — it
  under-specified", and superseding it to fix a prepositional clause is the wrong instrument.
- **The three `user_data` fields are fully claimed, and both proposed escapes are refused.**
  `ledger/tigerbeetle-accounts.yaml` records `128 → journal_entry_id`, `64 → source_document_ref`,
  `32 → accounting_date`; `posting_rule` is already evicted to Mongo and the slot it freed was
  already spent on `accounting_date`; and `journal_entry_id_is_not_derivable` because EVT-BIL-006
  and EVT-BIL-003 each allocate one instrument across several invoices. HOT-013's hoped-for
  dissolution does not exist.
- **`Transfer.code` was never counted.** A u16, "a user-defined enum denoting the reason for (or
  category of) the transfer", and a first-class filter in `QueryFilter` beside the three `user_data`
  fields. It is distinct from `Account.code`, which `ledger/tigerbeetle-accounts.yaml` already
  assigns to the GL code — different field, different record. The miscount originated in
  `research-drop/reference/tigerbeetle.md` ("the **only** per-transfer reference fields") and
  propagated into erp-spec#3's title, HOT-013's claimant count, and ADR-0026's Context.
- **The unhoused payload is 7 bits.** Measured 2026-08-16 across all 13 `specified` posting rules:
  **no posting dimensions both legs** — every dimensioned posting pairs one dimensioned account with
  an undimensioned counterparty. 19 of 138 accounts are dimensioned; **5800 alone** owes both. So the
  maximum on one transfer is a single pair: 21 `product_line` values × 4 `cost_type` values = 84
  combinations.
- **The query surface is settled and was never load-bearing.** TigerBeetle 0.17.9 does expose
  `query_transfers` — equality on `user_data_128/64/32`, `ledger`, `code`; range only on its own
  posting timestamp. No range filter on `user_data`, so ADR-0017 stands unchanged. And the case for
  dimensions in TigerBeetle is reconstruction after a MongoDB loss, which needs the value
  **present**, not filterable: ~15k transfers walk in full.

## Decision

**`Transfer.code` carries the dimension pair.** Its value is
`1 + (product_line_index × 4) + cost_type_index`, where each index is a position in the declared
value list of `ledger/dimensions.yaml` with an explicit null occupying index 0. The leading `+ 1` is
required — TigerBeetle refuses `code == 0`.

- A transfer to accounts owing neither dimension carries the pair `(null, null)`, which is `code 1`.
  **Absence is still unrepresentable**, which is REQ-LED-001's actual rule: what is refused is a
  missing declaration, not a null.
- `posting_rule` **stays evicted** to the MongoDB projection, recoverable through
  `(source_document_ref, journal_entry_id)`. It does not move back into `code` beside the
  dimensions.
- `user_data_128/64/32` are unchanged and this ADR does not touch them.
- **The encoding is pinned by a golden vector asserting the packed integer**, not by this sentence.

## Considered options

- **Pack `(posting_rule, product_line, cost_type)` into `code`** — 13 rules × 84 pairs = 1,092
  values, 11 bits, still inside u16. Rejected: the equality filter would then answer only the
  composite, so "all Crew revenue" becomes 52 enumerated queries rather than one, and it buys back
  a debuggability property that is already absent today.
- **Steal the 5 spare high bits of `user_data_32`** — `YYYYMMDD` tops out at `99991231`, using ~27
  of 32 bits. Rejected: it destroys the equality filter on accounting date, which is the only reason
  that value sits in a filterable field, and it compounds the "a u32 carrying a date is type-checked
  by nothing" hazard erp-spec#3 already names.
- **Dimensions in the projection only** — Odoo's shape, and defensible under ADR-0017. **Not a live
  option**: ADR-0018 is accepted and says dimensions ride on the posting, so choosing this would be
  re-deciding ADR-0018 rather than completing it (ADR-0034).
- **Dimension-exploded accounts** — ADR-0008, already superseded by ADR-0018.

## Consequences

- **The ledger becomes dimensionally self-describing, which is what ADR-0017 asked for and stopped
  one step short of.** ADR-0017 argued that losing MongoDB leaves balances rebuildable but periods
  not, "unless TigerBeetle carries the accounting date", and therefore *strengthened* the case for
  accounting-date-in-`user_data`. The identical argument applies to dimensions and was not made,
  because the budget looked full. After a total MongoDB loss, **the UN-ALLOCATED dimensional P&L**
  rebuilds from TigerBeetle alone.
- ⚠️ **The ALLOCATED P&L does not, and this ADR does not fix that.** ADR-0029 places one
  load-bearing requirement on every posting rule — "**every posting must carry its causal order**, or
  allocation is impossible and this decision quietly becomes *never allocate*" — and **the transfer
  does not carry it.** `user_data_64` holds `source_document_ref`, which for `shift_recorded` is the
  **shift**, not the order; the rule fans over `shift.absorbed_allocations`, so one shift becomes
  several transfers with several different `causal_job`s, and the golden vectors' expected transfer
  shape has no field for it. The causal order lives one hop away, in MongoDB, per transfer.
  So what survives a MongoDB loss is precisely the view ADR-0029 says "**must never be read as a
  managed P&L**", and what does not survive is the one it calls "the managed number". `code`'s 9
  spare bits cannot close the gap — orders already number ~1,000 and grow. **Tracked as HOT-014**;
  this ADR narrows its own claim rather than pretending to.
- ⚠️ **It makes the misreading easier to reach.** ADR-0029 names reading the un-allocated view as a
  managed report "the single most likely misreading of the whole design" — `Delivery` shows a large
  structural loss by construction. After this ADR, that view is a single `query_transfers` call
  against a filterable field. The ledger's `product_line` is **the line a cost was booked to**, not
  the line ADR-0031's official P&L attributes it to after spreading, and those are different numbers
  wearing the same name.
- **REQ-LED-001 is enforced where it is stated.** `ledger/dimensions.yaml` says the rejection vectors
  are "the entire enforcement" of dimensionality. Those vectors now check a property of the artifact
  the ledger actually stores, rather than of a projection beside it.
- **"Recompute the dimensional P&L from TigerBeetle and compare to the projection" becomes a check
  that can fail.** TigerBeetle is not the projection's normalizer, so this is not a fixed-point
  check — the repo's standing rule that a guard which can only consult its own oracle is not a
  guard. Projection-only would have made the dimensional P&L unfalsifiable against the ledger.
- **It preserves what the incumbent already guarantees.** Xero carries `TrackingCategories` on the
  journal line of its immutable Journals record, so CFS's books hold the product line inside the
  accounting record today. This is continuity, not a migration cost.
- **Raw TigerBeetle data no longer names the posting rule.** `code` conventionally holds the
  transfer's reason. Nothing regresses — `posting_rule` was already evicted for unrelated reasons —
  but a reader of the raw ledger has one less handle, and the 9 spare bits are not a comfortable
  place to put it back later.
- ⚠️ **A packed integer is type-checked by nothing.** One writer storing
  `product_line × 4 + cost_type` and another storing `cost_type × 21 + product_line` both compile and
  both are silently wrong — the same defect shape as the Typesense `money` boolean that shipped
  100×-wrong money in both environments, and as the `YYYYMMDD` hazard erp-spec#3 already flags for
  `user_data_32`. **A declaration that the encoding exists is not enough**; the golden vector must
  assert the value. Landing that vector red first is the repo's own rule.
- **Adding a product line stays cheap, but stops being free.** ADR-0018 made cardinality grow by
  addition; a new value is now also a new index, and indices are positional. **Append only, never
  reorder or delete** — reordering `ledger/dimensions.yaml` silently restates history. `Transport`
  being dropped and restored between 2026-08-09 and 2026-08-16 (OQ-034) is exactly the event that
  would have done it.
- **A both-legs-dimensioned posting is not representable at 84 values** and none exists today. If one
  ever does, the pair-of-pairs form is 7,056 values and still fits in u16 — a re-encoding, not a
  redesign. Note separately that TigerBeetle forbids `debit_account_id == credit_account_id`, so a
  same-account reclassification between product lines needs a clearing account regardless.
