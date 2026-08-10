# Resend

Transactional email over REST. **Adopted by [[ADR-0027]]** (proposed, 2026-08-09) as a boundary
service. Already in production in v1 — a retention.

## Canonical docs

- API reference: <https://resend.com/docs/api-reference/introduction>
- Send an email: <https://resend.com/docs/api-reference/emails/send-email>
- **No `llms.txt`** as of 2026-08-09; this note is the curated substitute.
- **Reachable as an MCP server** (`resend`) — note it exposes _write_ tools (send, broadcast,
  domains, contacts). Treat them as production actions, because they are.

## CFS-specific gotchas

- **⚠️ Tests must never reach it, and this one has a scar.** `forbiddenHosts.ts` denies Resend by
  default because until **2026-07-13 the suite sent a real alert email on every run**.
- **Four sender identities** in v1 (`code:2026-08-09:api-cloudrun@085e5b5c:src/lib/email.ts`):
  `verify@`, `reset@`, `invite@`, `alerts@`, replying to `team@`. A new sender is a DNS change, not
  a code change.
- **CFS runs its own DMARC monitoring** (`src/services/dmarcReportParser.ts`,
  `services/dmarcReports.ts`) — deliverability is instrumented rather than assumed. Anything that
  changes sending domains has a downstream effect there.
- **Email is NOT a domain event** ([[ADR-0027]]). Sending is a side effect of an event that already
  happened. An `InvoiceEmailed` event in the ledger would be the assigned-state mistake [[ADR-0014]]
  forbids, one layer out — the fact is that the invoice was issued.
- **A Resend message id is a foreign identifier**, fenced out of domain models by [[ADR-0009]].

Cross-refs: [[ADR-0027]] · [[ADR-0009]] · [[ADR-0014]]
