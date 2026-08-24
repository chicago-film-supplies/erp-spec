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
- **The balance is not a running total of the feed** [C4a]. Neither `/accounts/balance/get` nor
  `/transactions/sync` carries an **opening balance**, so a tie-out is a comparison against a figure
  _we_ carry forward, never a derivation.
- **`/transactions/refresh` is capped at 2 per minute PER ITEM** (120/hour, 2,880/day) — the
  per-Item column, not the roomy per-client one. A 429 is expected traffic when driving transitions.
- **A refresh does not guarantee a delta** [C1j] — one round came back wholly empty even for the
  `user_transactions_dynamic` user, which the docs say always produces new transactions.

## What sandbox CANNOT tell you

Recorded as unmeasured, not as benign:

- **The statement tie-out.** Sandbox balances are seeded constants — `current` did not move at all
  while the feed moved $3,031.42 [C4b]. [[SPIKE-004]] exit criterion 4 is **unmet** and needs the
  production link.
- **Whether `added` and `removed` can split across pages.** Every delta measured drained in one page
  [C3h]. Plaid states the pair _"aren't guaranteed to be in the same page"_ ⇒ **apply per-delta, not
  per-page**, or a split double-counts.
- **Anything Chase-specific** — backfill depth beyond `transactions.days_requested`, whether Chase
  supplies pending data at all (Capital One and USAA do not), real amount precision.

Cross-refs: [[ADR-0002]] · [[ADR-0048]] · [[ADR-0009]] · [[SPIKE-004]] · [[OQ-062]]
