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
closes_adr: new
status: open
---

## Notes

**Plaid transactions are not an accounting bank feed.** They are a consumer-fintech product. The gap
between what Plaid returns and what reconciliation needs is the actual deliverable here.

Unstable transaction ids would be a serious finding — reconciliation state keyed on them would
corrupt silently.

## Unblocked 2026-08-23 — the owner is obtaining Plaid sandbox credentials

Owner ruling: CFS will create the Plaid sandbox account and place `client_id` / `secret` in Secret
Manager. ⇒ **this spike closes against real sandbox traffic rather than against the API reference**,
which matters here more than usual: the reconciliation shape turns on the cursor model and the
webhook payloads, and ⭐ **an unexercised branch of a rule is a claim, not a capability** — the
repo's own standing rule, and the reason the cheaper "close it from the docs" path was declined.

**Blocked on:** credentials only. Nothing else in the spike needs a decision.
