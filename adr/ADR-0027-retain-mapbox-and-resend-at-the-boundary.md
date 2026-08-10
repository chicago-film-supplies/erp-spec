---
id: ADR-0027
title: Retain Mapbox for geocoding and Resend for transactional email, at the boundary
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [fulfillment, ordering, billing]
relates_to: [ADR-0009, ADR-0011, ADR-0014]
supersedes:
superseded_by:
---

> **In the context of** a rebuild that replaces the ledger, the datastore and the host, **facing**
> two external services that already work and are not the reason for the rebuild, **we decided** to
> retain Mapbox for geocoding and Resend for transactional email as boundary services with no domain
> footprint, **to achieve** a smaller cutover surface, **accepting** two live third-party
> dependencies that every test must be prevented from reaching.

## Context

- Both run in production today and **neither appears anywhere in this spec** — the charter, the
  contexts and every other ADR are silent about services the system cannot work without. That
  silence is the problem this ADR fixes; the retention itself is the easy part.
- **Mapbox** is geocoding behind a Firestore cache with a one-year TTL
  (`code:2026-08-09:api-cloudrun@085e5b5c:src/lib/geocode.ts`). Addresses are geocoded once and
  reused, so the dependency is off the hot path for every repeat destination. Its output feeds
  destination coordinates, and through them the distance and duration a shared trip needs to split
  travel cost across the jobs that caused it (ADR-0011).
- **Resend** is transactional email over REST, with four sender identities — `verify@`, `reset@`,
  `invite@`, `alerts@` (`src/lib/email.ts`). CFS runs its own DMARC monitoring
  (`src/services/dmarcReportParser.ts`), so deliverability is instrumented rather than assumed.
- Neither is implicated in why v2 exists. The rebuild replaces a rented ledger (ADR-0001), a
  document store (ADR-0003) and a host (ADR-0013). Geocoding and email are solved.

## Decision

Retain both, as **boundary services**: they are called at the edge, their outputs are enrichments or
side effects, and neither appears in a domain model or a domain event.

## Consequences

- **No foreign identifier enters the domain** (ADR-0009). A Mapbox place id and a Resend message id
  are correspondence for the boundary to hold, not fields on an entity. The same rule that keeps
  `xero_id` out of the chart of accounts applies here.
- **Neither produces a domain event, and this is worth stating because the mistake is tempting.**
  Sending an email is a side effect of an event that already happened; geocoding is an enrichment of
  an address. An `InvoiceEmailed` event in the ledger would be the assigned-state error ADR-0014
  forbids, one layer out — the fact is "the invoice was issued", and whether a message was delivered
  is the mail provider's business.
- **Tests must never reach either, and the fence already exists** —
  `api-cloudrun/tests/helpers/forbiddenHosts.ts` denies Mapbox and Resend by default. It exists
  because they _were_ being reached: until 2026-07-13 the suite sent a real alert email on every
  run. Carry the fence, not just the services.
- **Retaining Mapbox does not fix the address defect.** Addresses are geocoded but **not
  normalized**, and region representation is inconsistent
  (`inbox/2026-08-08-addresses-unvalidated.md`, verified). Normalization is ours to build whatever
  the geocoder is, and this decision must not be read as having settled it.
- **Both are replaceable, and the cache is why.** Geocoding results are stored, so a provider swap
  re-geocodes rather than loses history. Email has no history to lose. Neither creates the kind of
  lock-in the ledger did.
- **Cost and quota are unmeasured.** Neither service's usage volume, price, or rate limit has been
  looked at for v2 scale. Recorded as unknown rather than assumed benign — the Xero quota lesson is
  that a shared external limit becomes a production incident before anyone thinks to measure it.
