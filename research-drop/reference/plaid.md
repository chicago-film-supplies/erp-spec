# Plaid

The bank feed for the single Chase operating account. **Adopted by [[ADR-0002]]** (accepted,
2026-08-08), which is explicit that Plaid's model is _a consumer-fintech model, not an accounting
bank feed_. **[[SPIKE-004]] measured the gap** and [[ADR-0048]] (proposed, 2026-08-24) is the
boundary contract that came out of it.

## Canonical docs

- `llms-full.txt` — 6.3 MB, cached at `.claude/docs/plaid.txt`, refetched by
  `deno task fetch-llms-docs`. **The biggest dump in this repo by an order of magnitude, and worth
  it**: the semantics that matter are prose in the product guides, not fields in the API reference.
  Grep it by heading.
- Transaction states (pending vs posted): <https://plaid.com/docs/transactions/transactions-data/>
- `/transactions/sync`: <https://plaid.com/docs/api/products/transactions/#transactionssync>
- Rate limits: <https://plaid.com/docs/errors/rate-limit-exceeded/>
- **No MCP server.** The executable path is `spikes/harness/plaid-probe.ts` (`deno task plaid`),
  which links a sandbox Item, drives a real pending→posted transition and removes what it made.

## Credentials

`PLAID_CLIENT_ID` and `PLAID_SECRET_SANDBOX` live in **Secret Manager on `cfs-dev-3100`** (created
2026-08-23). Neither exists in `cfs-3100`, which is correct — a sandbox key has no business in the
prod project. There is **no production Plaid credential yet**, and no live Item.

⚠️ **The `_SANDBOX` suffix fights the house convention**, where the project is the environment
discriminator and the secret name is not. Renaming a secret is destroy-and-recreate rather than an
edit, so the cost only rises; it is at its floor while the value is a sandbox key nobody has used.
Unsettled — [[OQ-062]].

## CFS-specific gotchas

Each of these is measured by `deno task plaid` rather than remembered — the check id is in brackets.
Where sandbox cannot answer, that is said instead of guessed.

- **⚠️ The first `/transactions/sync` on a fresh Item returns `added: []` with `has_more: false`**
  [C0]. Not `PRODUCT_NOT_READY` — the Item is _ready and empty_, and the seed lands seconds later
  (4.4s measured). **An empty first page is byte-identical to a quiet account**, so an ingester that
  trusts it begins reconciling against nothing. The real signal is the `SYNC_UPDATES_AVAILABLE`
  webhook; this probe polls because it has no receiver.
- **⚠️ `transaction_id` does not survive a re-link** [C3e] — 108 ids in Item A, 108 in Item B, **0
  shared**, same institution and same credentials. `account_id` too [C3f]. A re-link is routine
  (expired credentials, MFA re-consent), so **reconciliation state keyed on a Plaid id is destroyed
  by an ordinary operational event.** This is the finding [[ADR-0002]] chartered the spike to get.
- **⚠️ A pending row's id does not survive posting either** [C3a]. The transition is `removed` +
  `added` with a **new** id, linked by `pending_transaction_id` — never a mutation of the existing
  row. Both id families share long prefixes (23 characters observed), so **never abbreviate an id**:
  a truncated pair looks like a collision that is not there.
- **⚠️ A `removed` entry carries `{account_id, transaction_id}` and nothing else** [C1g]. There is
  no amount to reverse. **Un-posting is impossible without our own copy of the row**, which is what
  makes the boundary store load-bearing rather than a cache.
- **⚠️ A `modified` entry is not evidence that anything changed** [C1i] — **107 of 108** modified
  rows in one delta were byte-identical to the copy already held. Emitting a domain event per
  modified row emits 107 spurious ones.
- **⚠️ `amount` is typed `double` with no stated scale**, and sandbox emits genuine sub-cent values
  — **35 of 108** with more than 2 decimal places, up to **7** [C1c]. Balances too: `available` came
  back as `342.099285` [C1h]. Whether Chase does this is unmeasured; the point is that **the
  contract permits it**, so the boundary owes an explicit rounding decision rather than a `× 100`.
- **Sign is inverted from accounting**: positive means money **leaving** the account [C1d]. Debit
  card purchases are positive; deposits and refunds are negative.
- **`date` and `authorized_date` are different fields** [C1b] — 96 of 108 differ. `authorized_date`
  is nullable, so it cannot be the accounting date on its own. This is the same distinction the repo
  already enforces between accounting date and posting timestamp.
- **The balance is not a running total of the feed** [C4a]. `/accounts/balance/get` carries no
  opening balance, so a tie-out is a comparison against a figure _we_ carry forward.
- **⚠️ `running_balance` EXISTS on every posted transaction and is NULL in all of them** [C4c] — a
  key on 104 of 104 posted rows, absent from pending rows, and present on Plaid's own transactions
  reference **only inside example payloads**, with no entry in the response-field list (primary page
  read 2026-08-24). ⇒ **a per-row opening balance may exist in production and is UNMEASURED.**
  Present-but-empty is the shape that passes an existence check. **Check it on the production link
  before building a carried-forward opening balance.**
- **`/transactions/refresh` is capped at 2 per minute PER ITEM** (120/hour, 2,880/day) — the
  per-Item column, not the roomy per-client one. A 429 is expected traffic when driving transitions.
- **A refresh does not guarantee a delta** [C1j] — one round came back wholly empty even for the
  `user_transactions_dynamic` user, which the docs say always produces new transactions.

## Statements — importable, and the cheap half needs no parsing

- **`/statements/list`** returns a **structured index** per account:
  `{statement_id, year, month,
  date_posted}` [C5b]. ⭐ **A recurring job can prove no statement
  PERIOD is missing from this alone**, with no PDF parsing at all.
- **`/statements/download`** returns a **bank-branded PDF** and nothing else [C5c] — no balance, no
  amounts. ⇒ any tie-out is a PDF-extraction job. Precedent in this repo:
  `spikes/harness/tax-rules-refresh-probe.ts` pulls a publication and extracts it **locally** with
  `pdftotext` rather than trusting a fetch.
- ⚠️ **Statements is a separate product and its WINDOW is fixed at LINK TIME.** `initial_products`
  must contain `statements` **and** `options.statements` must carry `{start_date, end_date}`;
  omitting the object is a hard `INVALID_FIELD`, not a default [C5a]. Up to 2 years. ⇒ **one
  decision at link bounds every statement that Item can ever produce.**
- ⚠️ **A `plaid-content-hash` header accompanies the download** — useful for dedup and integrity.

## Where a bank transaction goes — and it is NOT TigerBeetle

- **Ingestion does not post** ([[ADR-0048]]/D14). The boundary store is a **MongoDB inbox of
  retractable facts awaiting recognition**; the ledger is reached on a **match**, through
  `bank_transaction_matched`, which is blocked on [[OQ-063]].
- **The placement is forced, not stylistic.** Plaid rows are added, modified and **removed**;
  TigerBeetle transfers are **immutable and append-only**. A retraction arriving after a match is
  corrected by a **reversing posting** ([[ADR-0048]]/D15) — the shape `invoice_voided` and
  `settlement_reversed` already use — never by amending a transfer.
- ⚠️⚠️ **PLAID'S `pending` AND TIGERBEETLE'S PENDING TRANSFER ARE FALSE COGNATES.** One is an
  unsettled _bank_ record; the other is a two-phase reservation resolved by
  `post_pending`/`void_pending`. **No GL posting rule uses a pending transfer**; two-phase appears
  only on the inventory-custody ledger ([[ADR-0015]]). Modelling one as the other puts an
  unrecognised bank fact into the ledger under the wrong resolution protocol — **and it looks
  right.**
- **ADR-0042's two-store commit is not engaged by ingestion**, which writes one store. It engages at
  the match.

## What sandbox CANNOT tell you

Recorded as unmeasured, not as benign:

- **The statement tie-out**, for TWO independent reasons. Sandbox balances are seeded constants —
  `current` did not move at all while the feed moved (SPIKE-004/M8) [C4b] — **and** the sandbox
  statement PDF is a **static sample**, rendering dates as literal `XX/XX` with a Balance column
  that repeats values, unrelated to the Item's own transactions [C5d]. The **mechanism** is proven
  end to end; the tie-out is not. [[SPIKE-004]] exit criterion 4 is **unmet**.
- **Whether Chase populates `running_balance`.** See above — this is the one unmeasured field that
  could materially simplify reconciliation.
- **Whether `added` and `removed` can split across pages.** Every delta measured drained in one page
  [C3h]. Plaid states the pair _"aren't guaranteed to be in the same page"_ ⇒ **apply per-delta, not
  per-page**, or a split double-counts.
- **Anything Chase-specific** — backfill depth beyond `transactions.days_requested`, whether Chase
  supplies pending data at all (Capital One and USAA do not), real amount precision.

Cross-refs: [[ADR-0002]] · [[ADR-0048]] · [[ADR-0009]] · [[ADR-0015]] · [[ADR-0042]] · [[SPIKE-004]]
· [[OQ-062]] · [[OQ-063]]
