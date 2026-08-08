---
id: SPIKE-001
question: Does the TigerBeetle client load and run under Deno via node-api compatibility?
timebox: 2 days
method: >-
  Stand up a local TigerBeetle single-replica cluster. From Deno, create accounts, submit a linked
  transfer batch, query balances. Exercise the client under `deno run`, `deno test` and a compiled
  binary — node-api support differs across them.
exit_criteria:
  - A Deno process creates accounts and posts a two-phase transfer against a real TigerBeetle cluster.
  - The same code path runs under `deno test` and under `deno compile`.
  - If it fails, the failure mode is characterised precisely enough to size the Go sidecar.
closes_adr: ADR-0004
status: open
---

## Notes

Gates ADR-0004's revisit clause. A failure here does NOT reopen the language decision — it adds a
Go sidecar for the ledger service only.
