---
id: SPIKE-004
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
