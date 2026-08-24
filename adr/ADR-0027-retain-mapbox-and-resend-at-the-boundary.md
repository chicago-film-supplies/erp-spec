---
id: ADR-0027
headline: keep Mapbox and Resend at the boundary
title: Retain Mapbox for geocoding and Resend for transactional email, at the boundary
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [fulfillment, ordering, billing]
relates_to: [ADR-0009, ADR-0011, ADR-0014]
accounting_shaped: false
not_accounting_reason: >-
  Geocoding and transactional email post nothing and appear in no book. The two GL codes in the body
  — 4700 and 5500 — are named only to say that the CARD PROCESSOR is accounting-shaped and owes its
  own rule 8a survey (OQ-064). They are the reason a different decision is fenced out of this one,
  not a posting this ADR makes.
measurements:
  - id: M1
    value: "459 destinations"
    of: >-
      The entire Mapbox geocoding population — every destination CFS has ever geocoded, behind a
      one-year cache. ⚠️ A figure OF the v1 corpus while CRMS still supplied every order, so it is
      the pre-cutover shape rather than a stable one.
    as_of: 2026-08-18
    source: "api:2026-08-18:db_destinations_count"
  - id: M2
    value: "16 requests in the peak month; 3.5/month mean over 14 full months"
    of: >-
      Online quote requests arriving through the INCUMBENT third-party webshop — the surface v2
      replaces. ⚠️ **A floor, not a forecast**: it measures demand through a surface that exists to
      be changed, and it cannot be re-measured once the webshop is gone. Plan on the peak, which the
      most recent complete month already set at 4.6× the mean.
    as_of: 2026-07-31
    source: "inbox/2026-08-18-online-request-volume-and-the-mapbox-population-measured-so-adr-0027s-stated-unknown-is-closed.md"
asserts:
  - id: D1
    kind: decision
    claim: >-
      Mapbox and Resend are retained as BOUNDARY services: called at the edge, their outputs are
      enrichments or side effects, and neither appears in a domain model or a domain event.
  - id: D2
    kind: decision
    claim: >-
      This ADR adopts these two services and no others. A boundary service not named here is
      undecided, not adopted by implication.
  - id: P1
    kind: premise
    claim: >-
      Neither service's volume is a constraint at v2 scale. The Xero-quota lesson does not transfer,
      and that is a measured result rather than an assumption (M1, M2).
    source: "inbox/2026-08-18-online-request-volume-and-the-mapbox-population-measured-so-adr-0027s-stated-unknown-is-closed.md"
  - id: P2
    kind: premise
    claim: >-
      An online request never arrives AS email. It lands in a system CFS owns and email only
      notifies, so Resend stays a side effect of an event that already happened.
    source: "inbox/2026-08-18-online-request-volume-and-the-mapbox-population-measured-so-adr-0027s-stated-unknown-is-closed.md"
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
side effects, and neither appears in a domain model or a domain event (D1).

⚠️ **What this ADR does NOT decide, and the list has grown since it was drafted.** This ADR's own
Context says the problem it fixes is that a service the system cannot work without appears nowhere
in the spec. **Three more services are now in exactly that position, and adopting them is not
implied by adopting these two** (D2):

| service                               | state                                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A CDN / image manager**             | Uploadcare is incumbent and is to be **re-evaluated** against imgix and others; most of what it was bought for went unused, and the residual need is signed uploads + a custom domain                            |
| **Quo** — outbound SMS + contact sync | Appears nowhere in the spec or in v1. It would be a **second** outbound channel to a customer contact alongside Resend, and its "contact crud should sync" is a cross-boundary three-way merge                   |
| **A card processor**                  | Most likely Authorize.Net, because CFS banks at Chase. **Accounting-shaped** — it reaches `4700 - Transaction Fee Income` and `5500 - Cost of Goods Sold: Merchant Fees`, so it owes a rule 8a survey (`OQ-064`) |

⇒ Each needs its own decision. Naming them here is a fence, not an adoption
(`inbox/2026-08-23-owner-the-image-manager-is-three-jobs-two-of-them-evidence-and-quo-is-a-new-boundary-with-a-contact-sync.md`,
`charter.md`).

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
- ✅ **Cost and quota were recorded here as unknown, and both halves are now MEASURED — neither is a
  constraint** (M1, M2). Mapbox's whole lifetime population is 459 destinations behind a one-year
  cache; Resend's commercial traffic is one draft quote per online request at a peak of 16 in a
  month, on top of four unchanged account-mail identities. Even at peak this is orders of magnitude
  inside any tier with a limit, so **the Xero-quota lesson does not transfer — and that is a
  measured result rather than an assumption** (P1). ⚠️ **Two limits on that comfort.** The request
  figure is a **floor**: it was taken through the third-party webshop v2 replaces, so reading it as
  v2's volume assumes the replacement changes nothing, which is the opposite of why it is being
  built. And neither service's **price** was looked at — volume and rate limit were.
- ⭐ **Resend gains a FIFTH use, of a different kind, and it crosses ADR-0028.** The four identities
  are account mail; a draft quote sent to a customer who requested online is a **commercial document
  to a counterparty**. That path is rendered by Gotenberg and delivered by Resend, and **neither ADR
  names the other in it**. The framing still holds — measured across 50 threads, the request lands
  in a system CFS owns and the email only notifies, so it is a side effect of an event that already
  happened (P2) — but under the replacement the request becomes a domain event in `ordering`, which
  is one of the contexts with zero requirements. **ADR-0027's reasoning survives; its scope grows.**
