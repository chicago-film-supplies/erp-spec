---
id: SPIKE-004
headline: what Plaid actually provides
question: What does Plaid actually provide, and what does bank reconciliation actually need?
timebox: 3 days
method: >-
  Connect the live Chase account read-only. Pull transactions and balances over a period that
  includes pending-to-posted transitions. Diff Plaid's view against a real bank statement for the
  same period.
exit_criteria:
  - Pending vs posted semantics documented, including whether a pending transaction's id survives posting.
  - Backfill window established — how far back history reaches on first link.
  - Transaction id stability confirmed or refuted across updates and re-links.
  - Balance endpoints reconciled against a statement closing balance, to the cent.
measurements:
  - id: M1
    value: "0 of 108 transaction ids shared; 0 of 2 account ids shared"
    of: >-
      two Plaid sandbox Items linked back-to-back with the SAME credentials at the SAME institution
      (`user_transactions_dynamic` at `ins_109508`), each drained to has_more=false
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M2
    value: "35 of 108 amounts carry more than 2 decimal places, to a maximum of 7"
    of: the first sync's transactions on one sandbox Item, measured on the decimal string
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M3
    value: "107 of 108 `modified` rows were byte-identical to the copy already held"
    of: the modified array across two /transactions/refresh rounds on one sandbox Item
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/refresh"
  - id: M4
    value: >-
      4 of 4 removed rows were pending in our store, and 4 of 4 named a NEW posted id via
      pending_transaction_id in the same delta; 0 reused the pending id
    of: one driven pending-to-posted transition on one sandbox Item
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M5
    value: "a `removed` entry carries exactly 2 fields — account_id and transaction_id"
    of: every removed entry in the driven transition
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M6
    value: "first sync added=0 with has_more=false; 108 transactions arrived 4.4s later"
    of: the first /transactions/sync call on a freshly exchanged sandbox access_token
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M7
    value: "96 of 108 rows carry an authorized_date different from date; 0 carry none"
    of: the first sync's transactions on one sandbox Item
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M8
    value: "balance current moved 0 cents while the feed's net over the same account moved 303142 cents"
    of: >-
      the sandbox depository account across one driven transition — evidence that the sandbox
      balance is a seeded constant, NOT that a production balance behaves this way
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/accounts/balance/get"
  - id: M9
    value: "108 transactions spanning 29 days, one page, across 2 accounts"
    of: >-
      the sandbox seed for `user_transactions_dynamic`; the DEPTH is a sandbox fact, production
      depth is set by transactions.days_requested
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M10
    value: >-
      `running_balance` is a key on 104 of 104 POSTED rows and 0 of 4 pending rows, and its value is
      null in every one of them
    of: >-
      the first sync's transactions on one sandbox Item — ⚠️ a SANDBOX fact about a field whose
      production population is UNMEASURED, not evidence that Chase leaves it empty
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/transactions/sync"
  - id: M11
    value: >-
      /statements/list returns 4 statements per account over a 3-month window carrying
      {statement_id, year, month, date_posted} and no balance; /statements/download returns a 205978
      byte application/pdf
    of: >-
      one sandbox Item linked with `statements` in initial_products — ⚠️ the PDF is a STATIC SAMPLE
      rendering dates as literal "XX/XX", unrelated to that Item's own transactions
    as_of: 2026-08-24
    source: "plaid:2026-08-24:sandbox/statements/list"
closes_adr: ADR-0048
status: closed
---

## Notes

**Plaid transactions are not an accounting bank feed.** They are a consumer-fintech product. The gap
between what Plaid returns and what reconciliation needs is the actual deliverable here.

Unstable transaction ids would be a serious finding — reconciliation state keyed on them would
corrupt silently.

## ✅ Result — closed 2026-08-24. Three of four criteria met; the fourth needs production

`ADR-0048` (the Plaid ingestion boundary contract) is the ADR this spike produced. It is `proposed`;
accepting it is the owner's call.

Harness `spikes/harness/plaid-probe.ts` (`deno task plaid`) — **27 checks, 24 pass, 0 fail, 3
reported UNMEASURABLE**, against real `sandbox.plaid.com` traffic on 2026-08-24. It links a sandbox
Item, drives a real pending→posted transition, links a second Item with the same credentials, and
removes both. `--allow-net` is narrowed to `sandbox.plaid.com`, so the probe **cannot** reach
`production.plaid.com`; there is no env knob to point it there.

| exit criterion                                  | verdict                                                                                                                                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — pending vs posted, does the pending id live | ✅ **met.** It does not. Removed + added with a NEW id, joined by `pending_transaction_id` (M4)                                                                                                                                    |
| 2 — backfill window on first link               | ✅ **met**, with a correction to the question — see Finding 5                                                                                                                                                                      |
| 3 — id stability across updates and re-links    | ✅ **met, and REFUTED twice.** 0 of 108 survive a re-link (M1); 0 survive posting (M4)                                                                                                                                             |
| 4 — balances tied to a statement, to the cent   | ⛔ **NOT met**, for TWO independent reasons — sandbox balances are seeded constants (M8) and the sandbox statement PDF is a static sample (M11). ⭐ But statements ARE importable and the **gap** half is nearly free — Finding 10 |

### Finding 1 — ⭐ identity fails in two independent ways, and ADR-0002 named only one

ADR-0002 called transaction-id stability "critically" the thing to establish. **It is refuted twice
over**, and the second failure is the worse one:

- **Across posting** (M4) — Plaid removes the pending row and adds a new one. Documented, and now
  measured.
- **Across a RE-LINK** (M1) — two Items linked back to back, same institution, same credentials: **0
  of 108 transaction ids shared, 0 of 2 account ids shared.** ⇒ **reconciliation state keyed on a
  Plaid identifier is destroyed by an ordinary operational event.** Credentials expire; consent is
  re-collected. This is not an incident path.

⇒ `ADR-0048`/D2 is `ADR-0009` applied here, and D5 — reconstruct correspondence by MATCHING after a
re-link — exists only because of this. ⚠️ **The match key is not settled**, and it is the one place
the ADR knowingly leaves risk. ⚠️ **Do not reach for v1's `(uid, k-th occurrence)`**; that solves a
CRMS rebuild and transplanting it here is the error this repo has already made once.

### Finding 2 — ⭐ the quiet failure is at the very first call

The **first** `/transactions/sync` on a fresh Item returns `added: []` with `has_more: false` (M6).
Not `PRODUCT_NOT_READY` — the Item is ready, and empty. The seeded history arrived **4.4 seconds
later**.

⇒ **an ingester that follows the documented paging loop literally begins reconciling against an
empty feed, and nothing distinguishes that from a quiet account.** "Present but wrong beats absent
at passing every existence check", arriving from outside the system. The real signal is the
`SYNC_UPDATES_AVAILABLE` webhook; the probe polls because it has no receiver.

### Finding 3 — ⭐ the feed cannot undo itself, and `modified` is not evidence of change

- A `removed` entry is **`{account_id, transaction_id}` and nothing else** (M5). There is no amount
  to reverse. ⇒ the boundary store is **load-bearing, not a cache** — `ADR-0048`/D1 is forced rather
  than chosen, and the obligation to keep a second copy of the bank's data follows from it.
- **107 of 108 `modified` rows in one delta were byte-identical to the copy already held** (M3). ⇒ a
  boundary that emits a domain event per `modified` row emits 107 asserting a change that did not
  occur. `ADR-0048`/D8 diffs before it announces.

### Finding 4 — ⚠️ money is not clean at this boundary, and the contract is the thing to design against

`amount` is typed **`double` with no stated scale**. **35 of 108 sandbox amounts carried more than 2
decimal places, to a maximum of 7** (M2) — e.g. `10.021521`, `30.900715`. One balance figure did
too: `available: 342.099285`.

⚠️ **This is a claim about the CONTRACT, not about Chase.** Whether a real Chase feed ever emits a
sub-cent amount is **unmeasured**, and reading the sandbox's synthetic generator as a fact about the
bank would be the third-party form of the mistake this repo keeps catching. What is established is
that nothing in the API forbids it — so `ADR-0048`/D9 owes an explicit rounding rule and a record of
inexactness, and a design that assumes `× 100` is exact is total over the sandbox rather than over
the contract.

⚠️ **The measurement itself was nearly wrong in the same way.** The first version tested
`|v × 100 − round(v × 100)| > ε`, which cannot tell a genuine third decimal from IEEE-754 noise —
`2835.8 × 100` is `283580.00000000006`. It reported 35 offenders and could not say whether **any**
were real. The check now reads the decimal string.

### Finding 5 — the backfill question was asked backwards

Criterion 2 asks "how far back history reaches on first link", which presumes a limit to discover.
Sandbox returned **108 transactions over 29 days** (M9) — but in production the depth is
`transactions.days_requested` on `/link/token/create`: **default 90, maximum 730.** ⇒ **it is a
parameter we choose, not a limit we find.** The criterion is met by establishing that; the sandbox
number is a sandbox fact and is labelled as one in M9's `of:`.

### Finding 6 — what the cursor guarantees, and the one hazard sandbox could not reproduce

- **Replaying an unadvanced cursor returns the identical delta, in identical order.** ⇒ the ingester
  may crash mid-apply and re-read; **advancing the stored cursor IS the acknowledgement**, and it
  needs no idempotency key of its own (`ADR-0048`/D7).
- ⛔ **Not reproduced:** Plaid states a removed pending row and its posted successor _"aren't
  guaranteed to be in the same page"_. **Every delta measured drained in one page**, so the split
  case never occurred and **cannot be asserted from sandbox.** It is recorded as a documented hazard
  this repo has not seen, and `ADR-0048`/D6 (apply per delta, never per page) rests on the
  documentation rather than on a measurement. Check `C3h` reports `N/A` rather than passing.

### Finding 7 — the harness itself demonstrated the rule it was written under

**The probe's first run reported 13 of 17 checks passing against an EMPTY feed.** The first sync
returned nothing, and checks like "0/0 matched successors changed amount", "`removed[]` fields =
`{}`" and "overlap = 0" were all true while measuring nothing.

⇒ every check that ranges over a population now asserts the population is non-empty, through one
`checkOver` helper. **A check that reads green while matching nothing is indistinguishable from one
that passes** — this repo's own rule, met from the wrong side, in the harness written to honour it.

### Finding 8 — ⭐ the feed does NOT reach TigerBeetle, and the two "pending"s are false cognates

Asked by the owner after the first close, and it was not considered: **how does a bank transaction
get recorded in TigerBeetle?** The answer is that on ingestion it does not. It reaches the ledger on
a **match**, through `bank_transaction_matched` — which is blocked on `OQ-063`. The boundary store
is a **MongoDB inbox of retractable facts awaiting recognition**, and that placement is forced:
Plaid rows are added, modified and **removed**, while TigerBeetle transfers are immutable and
append-only. Ingesting straight to the ledger would mean a bank retraction demanding a transfer be
unwritten, and nothing in TigerBeetle can unwrite one. `ADR-0048`/D14 and D15 record this; the
correction path is a **reversing posting**, the shape `invoice_voided` and `settlement_reversed`
already use.

⚠️⚠️ **PLAID'S `pending` AND TIGERBEETLE'S PENDING TRANSFER ARE UNRELATED, and the resemblance is
seductive** — both read as "provisional, later resolved". A Plaid pending row is an unsettled _bank_
record; a TigerBeetle pending transfer is a two-phase reservation resolved by
`post_pending`/`void_pending`. **No GL posting rule uses a pending transfer at all**; two-phase
appears only on the inventory-custody ledger (`ADR-0015`). Modelling one as the other would put an
unrecognised bank fact into the ledger under a resolution protocol that is not the bank's — **and it
would look right.**

### Finding 9 — ⚠️ `running_balance` exists, is always null, and weakens a claim this spike made

The first close asserted that **no** opening balance is on offer anywhere. That is too strong.
**`running_balance` is a key on all 104 posted rows** (M10) — and null in every one, absent from
pending rows entirely, and present on Plaid's own transactions reference **only inside example
payloads**, with no entry in the response-field list (read from the primary page, 2026-08-24).

⇒ **a per-row opening balance may well exist in production and is UNMEASURED.** This is the repo's
own footgun — _present but wrong beats absent at passing every existence check_ — as a field that is
always there and never filled. **Check it on the production link before building the carried-forward
opening balance `ADR-0048`/D12 assumes**; if Chase populates it, D12 gets much cheaper.

### Finding 10 — ⭐ statements ARE importable, and the gap check needs no PDF parsing

Also asked by the owner, and worth more than it sounds. `/statements/list` returns a **structured
index** per account — `{statement_id, year, month, date_posted}` — and `/statements/download`
returns a **bank-branded PDF** and nothing else (M11).

The two halves pull apart, and that is the useful part:

- ✅ **A recurring job can prove no statement PERIOD is missing from the list alone**, with no
  parsing. Nearly free, and it is a genuine **gap** detector.
- ⚠️ **A balance or amount tie-out needs the PDF extracted** — the list carries no balance and no
  amounts. Precedent exists: `tax-rules-refresh-probe.ts` pulls a publication and extracts it
  **locally** with `pdftotext` rather than trusting a fetch.
- ⚠️ **The statement WINDOW is fixed at LINK TIME.** `options.statements` must carry
  `{start_date, end_date}` when the Item is created; omitting it is a hard `INVALID_FIELD`, not a
  default (check `C5a`). Up to 2 years. ⇒ **one decision at link bounds every statement that Item
  can ever produce.**
- ⛔ **And it does not rescue exit criterion 4.** The sandbox PDF is a **static sample** — dates
  render as literal `XX/XX`, its Balance column repeats values, and its lines are unrelated to the
  Item's own transactions. The **mechanism** is proven end to end; the **tie-out** still needs the
  production link. A second, independent reason criterion 4 cannot close here.

### Finding 11 — an EXISTENCE claim and a UNIVERSAL claim need different check semantics

`C1i` ("a `modified` row can be byte-identical") **went red on a re-run** in which the transition
landed in the first refresh, so no modified rows were emitted to inspect at all. Nothing was refuted
— there was nothing to look at.

⇒ **an existence claim is established by one observation and is not refuted by a later absence**, so
zero population means `N/A`, not `FAIL`. A universal claim — "every removed id was pending" (`C1e`)
— is the opposite and stays a hard assertion. **A check that goes red on the sandbox's scheduling
teaches whoever re-runs it to ignore red**, which costs more than the check is worth.

### What this spike did NOT settle, deliberately

⚠️ **Nothing here says what POSTS.** Whether a pending row may reach the ledger, which of the two
dates is the accounting date, and whether an unmatched transaction rests in `2500 - Suspense` are
**accounting-shaped under rule 8a** and owe the six-reference survey. They are `OQ-063`, and the two
artifacts that were blocked on this spike — chart code 2500 and the `bank_transaction_matched`
posting rule — **moved their block there rather than expiring it.**

`OQ-062` records the `PLAID_SECRET_SANDBOX` naming question, which is at its cost floor now and
rises the moment a production credential exists.

## Unblocked 2026-08-23 — the owner is obtaining Plaid sandbox credentials

Owner ruling: CFS will create the Plaid sandbox account and place `client_id` / `secret` in Secret
Manager. ⇒ **this spike closes against real sandbox traffic rather than against the API reference**,
which matters here more than usual: the reconciliation shape turns on the cursor model and the
webhook payloads, and ⭐ **an unexercised branch of a rule is a claim, not a capability** — the
repo's own standing rule, and the reason the cheaper "close it from the docs" path was declined.

**Blocked on:** credentials only. Nothing else in the spike needs a decision.

## ✅ Unblocked in fact, 2026-08-24 — the credentials are in place

Measured `gcloud secrets list --project=cfs-dev-3100`: **`PLAID_CLIENT_ID` and
`PLAID_SECRET_SANDBOX`, both created 2026-08-23.** Neither exists in `cfs-3100`, which is correct —
sandbox credentials have no business in the prod project.

⇒ **this spike has NO remaining blocker**, and the line above went stale within a day of being
written. It is the cheapest close among the five open spikes: a 3-day timebox, nothing depends on
it, and nothing it depends on is outstanding.

⚠️ **Settle the `_SANDBOX` suffix before any real value exists.** It fights the house convention,
and renaming a secret is destroy-and-recreate rather than an edit — so the cost of the decision only
goes up from here, and it is at its floor while the value is a sandbox key nobody has used.
