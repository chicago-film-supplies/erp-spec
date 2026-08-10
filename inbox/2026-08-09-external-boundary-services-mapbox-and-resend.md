---
kind: constraint
title: Two external services carry into v2 — Mapbox for geocoding and Resend for transactional email
contexts: [fulfillment, ordering, billing]
source: "code:2026-08-09:api-cloudrun@085e5b5c:src/lib/geocode.ts + src/lib/email.ts"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Named by the owner as part of the v2 stack, 2026-08-09. Both already run in production and neither
appears anywhere in the spec, so the charter and every ADR are silent about services the system
cannot work without.

## Mapbox — geocoding

- `src/lib/geocode.ts`: Mapbox geocoding **behind a Firestore cache** (`cache-geocodes`, 1-year
  TTL). The cache is not incidental — an address is geocoded once and reused, so the external
  dependency sits off the hot path for every repeat destination.
- Consumers: destination addresses, which feed trip planning and the distance/duration inputs a
  shared run needs to split travel cost across the jobs that caused it.
- **A known defect already captured**: `inbox/2026-08-08-addresses-unvalidated.md` — addresses are
  geocoded but **not normalized**, and region representation is inconsistent. Retaining Mapbox does
  not fix that; normalization is ours.

## Resend — transactional email

- `src/lib/email.ts`: direct REST to `api.resend.com/emails`. Four sender identities in use —
  `verify@`, `reset@`, `invite@`, `alerts@` — replying to `team@`.
- CFS runs **its own DMARC monitoring** (`src/services/dmarcReportParser.ts` + `dmarcReports.ts`),
  so deliverability is instrumented rather than assumed.

## What they have in common, and it is the reason to record them together

- **Both are already fenced out of tests.** `tests/helpers/forbiddenHosts.ts` denies Xero, CRMS,
  **Resend** and **Mapbox** by default. That fence exists because they _were_ being reached: until
  2026-07-13 the suite sent a real alert email on every run.
- **Both mint foreign identifiers** — a Mapbox place id, a Resend message id — and ADR-0009 fences
  those out of domain models. Neither belongs in a domain entity.
- **Neither produces a domain event.** Sending an email is a side effect of an event that already
  happened; geocoding is an enrichment of an address. Modelling `InvoiceEmailed` as a ledger event
  would be the assigned-state mistake ADR-0014 forbids, one layer out.
