---
kind: correction
title: HOT-013's budget arithmetic is wrong twice over — `Transfer.code` is an uncounted fourth discretionary field, and both of the candidate evictions it waits on were already closed against it in `ledger/tigerbeetle-accounts.yaml`
contexts: [ledger]
source: "code:2026-08-16:erp-spec@225f435:ledger/tigerbeetle-accounts.yaml · code:2026-08-16:erp-spec@225f435:ledger/posting-rules.yaml · code:2026-08-16:erp-spec@225f435:ledger/chart-of-accounts.yaml · TigerBeetle 0.17.9 single-page reference cached at .claude/docs/tigerbeetle.txt (Transfer.code L12725, QueryFilter L13178, Requests L9442)"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Three findings, all measured, none of them a decision. **HOT-013 stays open** — this note changes
the arithmetic the choice is made on, not the choice.

## 1. The two candidate evictions are already closed, and neither frees a slot

HOT-013's `resolution_shape` says the ADR it needs "still needs" the two candidate evictions in
erp-spec#3, "which may make the shortfall disappear rather than force a choice". **The repo already
answered both, and the answer is no on both.** `ledger/tigerbeetle-accounts.yaml` records it:

| Candidate          | Status in the repo today                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `journal_entry_id` | **Refused.** `journal_entry_id_is_not_derivable:` — `EVT-BIL-006 CreditNoteAllocated` and `EVT-BIL-003 SettlementRecorded` both allocate one instrument across several invoices, so the grouping is not a function of `source_document_ref`. The field stays reserved. |
| `posting_rule`     | **Already evicted**, to the Mongo projection — and the slot it freed was *already spent*: it "is what lets `accounting_date` take `user_data_32` at no cost".                                                        |

So there is no dissolution path through the evictions. All three `user_data` fields are spoken for
by claimants the repo has separately justified, and `product_line` / `cost_type` have nowhere to go
**within `user_data`**. HOT-013's shortfall is real and the hotspot's own escape hatch is closed.

## 2. `Transfer.code` is a fourth discretionary reference field, and nothing has claimed it

`research-drop/reference/tigerbeetle.md` says "`user_data_128/64/32` are the **only** per-transfer
reference fields". That is wrong, and every count downstream of it inherits the error — erp-spec#3's
"three fields, four claimants", HOT-013's "three slots, six live claimants", ADR-0026's "fifth
claimant" aside.

`Transfer.code` is a **u16, user-defined, "the reason for (or category of) the transfer"**, and it
is a first-class filter in `QueryFilter` alongside the three `user_data` fields. Constraints: must
not be zero; on a `post_pending`/`void_pending` it must be zero (inherits) or match the pending
transfer's code.

**Nothing in `ledger/` claims it.** `ledger/tigerbeetle-accounts.yaml` has an `account_code_rule`
("TB account `code` (u16) = the GL code") — that is the **Account's** `code`, a different field on a
different record. The **Transfer's** `code` appears nowhere in the ledger spec.

## 3. The unhoused payload is 7 bits, and the worst case still fits

Measured across all 13 `specified` posting rules: **no posting dimensions both legs.** Every
dimensioned posting pairs exactly one dimensioned account with an undimensioned counterparty —
`invoice_issued` is Dr 1200 (none) / Cr revenue (`product_line`); `credit_note_issued` is
Dr revenue (`product_line`) / Cr 2050 (none); `shift_recorded` is Dr 5800
(`product_line` + `cost_type`) / Cr 2000 (none).

19 of 138 accounts are dimensioned — 18 `[product_line]`, and **5800 alone** carries
`[product_line, cost_type]`.

So the maximum dimensional payload on one transfer is one pair: 21 `product_line` values
(20 + explicit null) × 4 `cost_type` values (3 + explicit null) = **84 combinations, 7 bits**. In a
u16 that leaves 9 bits spare. Even the hypothetical both-legs-dimensioned transfer the current rules
never produce is 84 × 84 = 7,056 — still inside u16.

⚠️ **Sizing is not the same as deciding.** That the payload fits says the *representation* question
has an answer; it does not say the ledger should carry dimensions at all. That is the choice HOT-013
poses, and the survey note dated today is the evidence for it.

⚠️ **If dimensions land in `code`, they displace its conventional occupant** — the transfer's
reason, which is `posting_rule`, already evicted for an unrelated reason. Raw TigerBeetle data would
then not say which rule produced a transfer. That is a real cost and belongs in the decision.

## 4. SPIKE-003's flagged contradiction is settled, and it does not move the answer

erp-spec#3 flagged that `research-drop/reference/tigerbeetle.md` says flatly "no queries" while
0.16.x/0.17.x was believed to expose a limited `query_transfers`. **The belief is correct.**
TigerBeetle 0.17.9 ships `query_transfers` and `query_accounts` taking a `QueryFilter`:

- **Equality only** on `user_data_128`, `user_data_64`, `user_data_32`, `ledger`, `code`.
- **Range only** on `timestamp_min` / `timestamp_max` — TigerBeetle's own timestamp, which is
  **posting time**, the wrong date (ADR-0010).
- Plus `limit` (capped at the batch max, `too_much_data` above it) and `flags.reversed`.

So the conclusion in `ledger/tigerbeetle-accounts.yaml` → `what_spike_003_still_owes` holds exactly
as written: **no range filter on `user_data`**, therefore no period query, therefore periodisation
still comes from the projection (ADR-0017). The reference note's "no queries" is stale and is
corrected there.

⚠️ **And the query surface is not what the decision turns on.** The case for carrying dimensions in
TigerBeetle is *reconstruction after a Mongo loss*, which needs the value to be **present**, not
filterable — a full walk of ~15k transfers rebuilds a dimensional P&L regardless of what
`QueryFilter` can express. Settling the query surface removes a stated blocker from HOT-013 without
changing either side of the argument.

## What this leaves for SPIKE-003

Its first exit criterion — "documented rule for which field carries accounting date" — is
answerable now and is unaffected by all of the above: `user_data_32`, packed `YYYYMMDD`. The other
two exit criteria are untouched and still need the spike: the `imported` flag's timestamp and
monotonicity semantics, and that live posting resumes after an import batch. **HOT-013 does not
depend on either.**
