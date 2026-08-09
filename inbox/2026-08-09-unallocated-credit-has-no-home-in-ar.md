---
kind: finding
title: An unallocated credit note has no home in Accounts Receivable — the control account and the subledger disagree
contexts: [billing, ledger]
source: "api:2026-08-09:search_credit_notes + get_settlements (13 credit notes, 8 credited invoices)"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

`EVT-BIL-005 CreditNoteIssued` has no credit-side account in the live chart. The two candidates are
a new liability account or crediting **1200 Accounts Receivable** directly, and the live data
settles it — measured against prod 2026-08-09.

## What the current system already asserts

- **13 credit notes** exist (`search_credit_notes`): 10 `applied`, 3 `void`.
- A credit note carries **`remaining_credit_cents`**, and its lifecycle is `issued | applied | void`
  with **no `part_applied`** — because the remaining balance carries that distinction
  (`code:2026-08-09:core@33f5654:src/schemas/credit-note.ts`).
- An invoice's `totals.amount_credited_cents` moves **only when a `settlements` row of
  `type: credit` exists** — the allocation, not the issue
  (`code:2026-08-09:core@33f5654:src/schemas/settlement.ts`).

So between issue and allocation the credit is a real, dated, numbered obligation to a customer that
is attached to **no invoice**. `remaining_credit_cents` is its balance.

## The argument that decides it

If the issue credits 1200 directly, the AR **control account** carries the unallocated credit while
**no invoice in the subledger** does. AR then no longer reconciles to the sum of open invoices, by
exactly the unallocated total, and the difference is invisible on the face of either. A receivables
control that does not tie to its subledger is the defect a control account exists to prevent.

Crediting a liability instead states the true fact: the business owes the customer value that is not
yet applied against anything. Allocation is then the entry that moves it into AR, invoice by
invoice.

## What allocation actually looks like in the corpus

Two shapes, both measured, and both are entries that span source documents:

- **One note across several invoices.** `CN-1015` ($259.74) is allocated $247.75 to invoice 1767 and
  $11.99 to invoice 1751.
- **Several notes in one operator action.** Invoice 1767 takes $247.75 from `CN-1015` and $27.26
  from `CN-1017` under **one `uid_session`** (`e3ee4106-e4c7-41a1-84af-19fd10e53553`). `uid_session`
  is documented as "one per operator action — groups a batch payment or a multi-invoice allocation".

The second is a journal entry referencing **two credit notes**, which is the direct evidence
erp-spec#3 wants for `journal_entry_id` not being derivable from a single source-document reference.
If allocation posts nothing, that evidence is gone and only `settlement_recorded` carries it.

## The trap on the debit side, already solved in the current system

`deriveCreditPostingAccount` (same file) puts **bad debt on 6900 and everything else on the line's
own revenue account**, because a write-off is not a revenue reversal — the sale happened and the
money did not arrive. It also returns **null** for `correction` and `unspecified`, deliberately: the
rule has no opinion and the caller must supply the account.

History does not obey the rule and the owner ruled that historic rather than sanctioned: **4 of 12
notes are miscoded** — CN-1007 books a bad-debt write-off to 4210 (revenue), and CN-1010/1011/1012
book customer credits to 6000 General Operating Expenses on a line whose Xero `TaxType` is `INPUT`,
a *purchase* tax type on a receivable.
