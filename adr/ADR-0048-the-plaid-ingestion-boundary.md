---
id: ADR-0048
headline: the bank feed lands in Mongo and does not post
title: >-
  The Plaid ingestion boundary — a MongoDB inbox at the edge that does not post, CFS-minted identity,
  and delta-atomic application
status: proposed
date: 2026-08-24
review_by: 2026-11-30
deciders: [repo owner]
contexts: [banking]
relates_to: [
  ADR-0002,
  ADR-0003,
  ADR-0009,
  ADR-0012,
  ADR-0015,
  ADR-0017,
  ADR-0042,
  SPIKE-004,
  OQ-062,
  OQ-063,
]
accounting_shaped: false
not_accounting_reason: >-
  This decides how a foreign feed is READ and STORED at the edge — identity, atomicity, precision,
  event emission. It names no account, decides no posting, and does not say what "cleared" means to
  the ledger. Those are the accounting half and they are deliberately withheld to OQ-063, which owes
  the six-reference survey rule 8a requires; deciding them here without one is exactly the shortcut
  the rule exists to prevent. The two artifacts blocked on SPIKE-004 — chart code 2500 and the
  `bank_transaction_matched` posting rule — are repointed at that question, not at this ADR.
measurements: [] # DELIBERATELY EMPTY. SPIKE-004 measured every figure below and gate 22 makes the
# measurer the owner; a deciding ADR cites. Cited by id in the body: SPIKE-004/M1 … M9.
asserts:
  - id: D1
    kind: decision
    claim: >-
      The boundary keeps a STORE OF RECORD of every row Plaid emits, verbatim, before any
      translation — not a cache.
  - id: D2
    kind: decision
    claim: >-
      A Plaid `transaction_id`, `account_id` and `item_id` are foreign identifiers under ADR-0009:
      they live only in the boundary translation table and never in a domain model.
  - id: D3
    kind: decision
    claim: >-
      A pending row and its posted successor are ONE bank transaction in the domain, joined by
      `pending_transaction_id`, with the posted row's values superseding the pending row's.
  - id: D4
    kind: decision
    claim: >-
      A removed pending row with no successor is a domain event in its own right — the hold
      expired — and never a silent delete.
  - id: D5
    kind: decision
    claim: >-
      After a re-link, incoming rows are MATCHED against the boundary store rather than trusted as
      new; an ambiguous match is quarantined, never merged and never nulled.
  - id: D6
    kind: decision
    claim: A whole delta is applied atomically. A page is never applied on its own.
  - id: D7
    kind: decision
    claim: >-
      The cursor advances only after the delta is durably applied, and re-reading an unadvanced
      cursor IS the recovery path — the ingester needs no idempotency key of its own.
  - id: D8
    kind: decision
    claim: >-
      A `modified` row byte-identical to the stored row emits no domain event; the boundary
      diffs before it announces.
  - id: D9
    kind: decision
    claim: >-
      Money crosses the boundary as integer minor units, rounded ONCE at ingest by an explicit
      rule, with the raw value retained verbatim in the boundary store; a value that was not
      already exact at the storage quantum is recorded as such rather than silently rounded.
  - id: D10
    kind: decision
    claim: >-
      Plaid's sign convention is normalized at the boundary, and the normalization carries a test
      that fails if it is inverted.
  - id: D11
    kind: decision
    claim: >-
      The feed supplies two dates and neither is automatically the accounting date; both `date` and
      `authorized_date` are carried, and `authorized_date` is never used alone because it is
      nullable.
  - id: D12
    kind: decision
    claim: >-
      A balance read is a CHECK FIGURE compared against an opening balance CFS carries forward,
      never a source the ledger derives from.
  - id: D14
    kind: decision
    claim: >-
      INGESTION DOES NOT POST. A bank transaction reaching the boundary store produces no
      TigerBeetle transfer; only a MATCH does. The boundary store is a MongoDB inbox of facts
      awaiting recognition, and it is deliberately outside the ledger.
  - id: D15
    kind: decision
    claim: >-
      Because TigerBeetle is append-only and Plaid is retractable, a retraction that arrives after
      a match has posted is corrected by a REVERSING posting, never by amending or deleting a
      transfer — and the reversal copies the keys of what it reverses.
  - id: D16
    kind: decision
    claim: >-
      Statement periods are reconciled on a recurring schedule from `/statements/list`, whose
      structured index is sufficient to detect a MISSING period without parsing any PDF.
  - id: D13
    kind: decision
    claim: >-
      An empty first sync is treated as UNKNOWN, not as an empty account: ingestion is not
      considered started until a delta has been observed or the historical-update signal received.
  - id: P1
    kind: premise
    claim: >-
      Plaid mints entirely new transaction and account ids for the same money on a re-link, and a
      re-link is a routine operational event.
    source: "SPIKE-004"
  - id: P2
    kind: premise
    claim: >-
      A `removed` entry carries only an account id and a transaction id — there is nothing in it to
      reverse.
    source: "SPIKE-004"
  - id: P3
    kind: premise
    claim: >-
      A `modified` entry is not evidence that anything changed; it can be byte-identical to the row
      already held.
    source: "SPIKE-004"
  - id: P4
    kind: premise
    claim: >-
      `amount` is typed `double` with no stated scale, and values finer than the cent do occur in
      practice.
    source: "SPIKE-004"
  - id: P5
    kind: premise
    claim: >-
      No opening balance is POPULATED by Plaid in anything measured: the balance endpoint carries
      none, and the transaction feed's `running_balance` field is present on every posted row and
      null in every one.
    source: "SPIKE-004"
  - id: P7
    kind: premise
    claim: >-
      Plaid's `pending` is a property of a BANK transaction and has no relationship to TigerBeetle's
      two-phase pending transfer; no GL posting rule uses a pending transfer at all.
    source: "ADR-0015"
  - id: P8
    kind: premise
    claim: >-
      Statements are retrievable from Plaid as bank-branded PDFs, indexed by a structured list that
      carries a statement id and period but no balance and no amounts.
    source: "SPIKE-004"
  - id: P6
    kind: premise
    claim: >-
      The first `/transactions/sync` on a fresh Item returns an empty, fully-drained page that is
      indistinguishable from a quiet account.
    source: "SPIKE-004"
supersedes:
superseded_by:
---

> **In the context of** ADR-0002 sourcing the bank feed from Plaid and ADR-0009 fencing foreign
> identifiers out of domain models, **facing** a feed that mints new ids on every re-link, deletes
> rows without saying what they were, announces changes that are not changes, and quotes money as an
> unscaled float, **we decided** that the feed lands in a verbatim MongoDB inbox that **does not
> post**, that CFS mints its own identity and reconstructs correspondence by matching rather than by
> id, and that a whole delta is applied atomically, **to achieve** a mutable, retractable feed held
> safely outside an append-only ledger, **accepting** that the boundary store is a second copy of
> the bank's data that we are now obliged to keep.

## Context

- **ADR-0002 said Plaid's model is a consumer-fintech model and not an accounting bank feed, and
  chartered SPIKE-004 to size the gap.** The gap is larger than the ADR guessed, and it is not where
  it guessed: the sharpest finding is not about pending versus posted at all.
- ⭐ **Identity is the whole problem, and it fails in two independent ways.** A pending row's id
  does not survive posting (SPIKE-004/M4) — Plaid removes it and adds a new one — and **no** id
  survives a re-link (SPIKE-004/M1: 0 of 108 shared, same institution, same credentials, back to
  back). ADR-0002 named id stability as "critically" the thing to establish. It is refuted twice
  over.
- ⚠️ **A re-link is not an incident.** Credentials expire and consent is re-collected on an ordinary
  schedule. ⇒ **any reconciliation state keyed on a Plaid id is destroyed by routine operations**,
  which is why D2 is ADR-0009 applied rather than restated, and why D5 exists at all.
- ⚠️ **The feed cannot undo itself.** A `removed` entry is `{account_id, transaction_id}` and
  nothing else (SPIKE-004/M5). Reversing a row we no longer hold is impossible, so the boundary
  store is load-bearing rather than a convenience — that is D1, and it is forced, not chosen.
- ⚠️ **The quiet failure is at the very first call.** The first sync returns `added: []` with
  `has_more: false` (SPIKE-004/M6) — not `PRODUCT_NOT_READY`. It is byte-identical to a quiet
  account, so an ingester that follows the documented paging loop literally begins reconciling
  against nothing and cannot tell. This is "present but wrong beats absent at passing every
  existence check", arriving from outside.
- **Money is not clean at this boundary.** `amount` is `double` with no scale, and 35 of 108 sandbox
  amounts carried more than 2 decimal places, to 7 (SPIKE-004/M2); one balance figure did too. Rule
  7 says integer minor units everywhere, so a rounding decision is forced. ⚠️ **Whether Chase does
  this is unmeasured** — what is measured is that the CONTRACT permits it, which is the part a
  design must be total over.

## Decision

**Thirteen decisions, D1–D13 above. What each rests on is labelled:**

| resting on        | which                                     |
| ----------------- | ----------------------------------------- |
| **measurement**   | D1, D2, D3, D4, D5, D8, D9, D11, D12, D13 |
| **existing rule** | D2 (ADR-0009), D9 (rule 7), D11 (rule 8)  |
| **engineering**   | D6, D7, D10                               |

⚠️ **D6 and D7 are the pair, and D6 is the one that looks optional.** Plaid states that a removed
pending row and its posted successor _"aren't guaranteed to be in the same page"_. **SPIKE-004 could
not exercise that** — every delta measured drained in one page — so it is a documented hazard this
repo has NOT reproduced, and it is recorded that way rather than as a finding. A per-page apply that
sees the addition without the removal double-counts the money.

### ⭐ D14 and D15 — where this sits relative to TigerBeetle, and why the answer is "nowhere"

**A bank transaction does not reach TigerBeetle on import.** It reaches it on a MATCH, through the
`bank_transaction_matched` posting rule — which is still blocked on `OQ-063`. The boundary store is
a **MongoDB inbox of ephemeral, retractable facts awaiting recognition**, and keeping it outside the
ledger is forced by the two stores' opposite natures:

|                  | Plaid feed                                  | TigerBeetle                                       |
| ---------------- | ------------------------------------------- | ------------------------------------------------- |
| mutability       | rows are **added, modified and REMOVED**    | transfers are **immutable and append-only**       |
| identity         | ids do not survive a re-link (SPIKE-004/M1) | account id = GL code, deterministic and permanent |
| what a row means | "the bank says money moved"                 | "CFS recognises a movement"                       |

⇒ Ingesting straight to the ledger would mean a bank retraction demanding a transfer be unwritten,
and **nothing in TigerBeetle can unwrite one.** D15 says the correction is a reversing posting, and
that is not a new invention: `invoice_voided` and `settlement_reversed` already work this way, and
the rule that a reversal **copies the keys of what it reverses** (so reports net to zero rather than
losing one side) applies unchanged. If the original's period is closed, the reversal takes an
accounting date in an OPEN period (ADR-0017).

⚠️⚠️ **PLAID'S `pending` AND TIGERBEETLE'S PENDING TRANSFER ARE FALSE COGNATES, AND THIS IS THE ONE
TO WRITE DOWN** (P7). A Plaid pending transaction is an unsettled _bank_ record. A TigerBeetle
pending transfer is a two-phase reservation resolved by `post_pending`/`void_pending`. The words
match and nothing else does — and the resemblance is seductive because both are "provisional, later
resolved". **No GL posting rule uses a pending transfer**; two-phase appears only on the
inventory-custody ledger (ADR-0015). ⇒ modelling a pending bank line as a pending GL transfer would
put an unrecognised bank fact into the ledger with a resolution protocol that is not the bank's, and
it would look right.

⚠️ **The two-store commit protocol (ADR-0042) is NOT engaged by ingestion**, precisely because
ingestion writes one store. It engages at the MATCH, which is `OQ-063`'s.

### D16 — statements are importable, and the cheap half needs no PDF parsing

Measured 2026-08-24: `/statements/list` returns a **structured index** per account —
`{statement_id, year, month, date_posted}` — and `/statements/download` returns a **bank-branded
PDF** and nothing else (P8). Two consequences that pull apart:

- ✅ **A recurring job can prove no statement PERIOD is missing from `/statements/list` alone**,
  with no parsing at all. That is the gap check, and it is nearly free.
- ⚠️ **A balance or amount tie-out needs the PDF extracted**, because the list carries neither. The
  repo already does exactly this shape for the depreciation corpus — `tax-rules-refresh-probe.ts`
  pulls a publication and extracts it **locally** with `pdftotext` rather than trusting a fetch, and
  that precedent applies here for the same reason.
- ⚠️ **The statement WINDOW is fixed at LINK TIME** — `options.statements` must carry
  `{start_date, end_date}` when the Item is created, and omitting it is a hard `INVALID_FIELD`, not
  a default. Up to 2 years. ⇒ **a decision made once, at link, bounds every statement ever
  retrievable from that Item.**

## Consequences

- **We now keep a second copy of the bank's data**, indefinitely, and it is a store of record rather
  than a cache (D1). That is a retention, privacy and backup obligation that did not exist before,
  and it is the price of being able to reverse a removal at all.
- ⚠️ **D5 replaces an id join with a MATCH, and a match has a false-positive rate.** Pairing a
  re-linked feed back onto existing bank transactions on (account, posted date, amount, description)
  can pair two genuinely distinct same-day, same-amount transactions. The quarantine is what keeps
  that loud — but **the correct match key is not decided here and is not obvious**; it is `OQ-063`'s
  companion, and it is the one place this ADR leaves real risk on the table.
  - ⚠️ **Do not reach for v1's `(uid, k-th occurrence)` carry-forward key.** That is a solution to a
    CRMS rebuild, and transplanting it here would be the error this repo has already made once.
- **D9 obliges an explicit rounding rule and a record of inexactness**, which means the boundary
  store carries the raw value beside the integer. Retaining the raw float is what makes the rounding
  auditable later; discarding it makes every downstream figure unfalsifiable.
- ⚠️ **Exit criterion 4 of SPIKE-004 is UNMET and this ADR does not close it.** The statement
  tie-out needs the production link — sandbox balances are seeded constants (SPIKE-004/M8). D12
  states the SHAPE the tie-out must take; it does not assert that the tie-out has ever been
  performed.
- **Nothing here says what posts.** `OQ-063` owns whether a pending row may reach the ledger, which
  date is the accounting date, and whether an unmatched transaction rests in suspense — with the
  six-reference survey rule 8a requires. Chart code 2500 and the `bank_transaction_matched` posting
  rule move their block to it.

## Considered options

- **Key reconciliation on the Plaid `transaction_id`.** Rejected: SPIKE-004/M1 measures it to zero
  survival across a re-link, and SPIKE-004/M4 to zero survival across posting. It is the option
  ADR-0002 was most worried about and the measurement is unambiguous.
- **Treat the boundary as a cache and re-fetch on demand.** Rejected: `removed` carries nothing to
  re-fetch (SPIKE-004/M5), and Plaid does not serve a row it has removed.
- **Emit a domain event per `added`/`modified`/`removed` entry, unfiltered.** Rejected: 107 of 108
  modified rows in one delta changed nothing (SPIKE-004/M3), so the ledger would carry 107 events
  asserting a change that did not occur.
- **Apply per page, advancing the cursor as each page lands.** Rejected under D6/D7 — it makes a
  documented split delta into a double count, and buys nothing, because replaying an unadvanced
  cursor is already exact (measured: identical delta, identical order).
