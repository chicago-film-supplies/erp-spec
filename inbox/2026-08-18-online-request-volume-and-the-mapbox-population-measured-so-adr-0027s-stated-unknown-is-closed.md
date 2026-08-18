---
kind: finding
title: >-
  Online request volume and the Mapbox geocoding population measured — ADR-0027's "cost and quota
  are unmeasured" is closed, neither is a constraint, and the planning number is the PEAK not the
  mean
contexts: [ordering, billing]
source: >-
  Mapbox population `api:2026-08-18:db_destinations_count` = 459. Request volume measured
  2026-08-18 from `team@chicagofilmsupplies.com` by month, over the most recent 14 full months.
  Sender identities `code:2026-08-18:api-cloudrun:src/lib/email.ts`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Prompted by the owner, 2026-08-18: Resend will send **draft quotes to customers when they request
online**, and the online-request volume is what should size it.

⚠️ **The incumbent webshop is out of scope for this spec** (owner, 2026-08-18) — it is being
replaced by a public client app on CFS's own API and DB, and nothing about it migrates. It appears
here **only as the source of the measurement**, because the numbers below cannot be re-measured once
it is gone.

⚠️ **PII.** Counts, subject patterns and latencies only. No customer names, addresses or bodies.

## Online request volume, by month

| month   |    | month       |        |
| ------- | -: | ----------- | -----: |
| 2025-06 |  2 | 2026-01     |      1 |
| 2025-07 |  2 | 2026-02     |      0 |
| 2025-08 |  1 | 2026-03     |      3 |
| 2025-09 |  4 | 2026-04     |      2 |
| 2025-10 |  6 | 2026-05     |      5 |
| 2025-11 |  3 | 2026-06     |      4 |
| 2025-12 |  0 | **2026-07** | **16** |

- **49 requests over 14 full months ⇒ mean 3.5/month.**
- **Peak 16, in the most recent complete month — 4.6× the mean, 2.7× the prior peak.**
- Trend is up on either cut: 2025 H2 ~2.7/month, 2026 Jan–Jul ~4.4/month.

⚠️ **PLAN ON THE PEAK.** Sizing on 3.5/month sizes on a figure the latest month already beats by
4.6×. Whether July 2026 is growth or Chicago production seasonality is not decidable from one month
— but the mean is the wrong number either way.

⚠️ **AND IT IS A FLOOR, NOT A FORECAST.** It measures demand through the surface being replaced.
Reading it as v2's volume assumes the replacement changes nothing, which is the opposite of why it
is being built.

## What that settles for ADR-0027

The ADR (proposed) records: _"Cost and quota are unmeasured. Neither service's usage volume, price,
or rate limit has been looked at for v2 scale. Recorded as unknown rather than assumed benign — the
Xero quota lesson is that a shared external limit becomes a production incident before anyone thinks
to measure it."_

Both halves are now measured, and **neither is a constraint**:

|                              |                                             measured | note                                                     |
| ---------------------------- | ---------------------------------------------------: | -------------------------------------------------------- |
| **Mapbox**                   |                       **459** destinations, lifetime | the entire geocoding population, behind a one-year cache |
| **Resend** — online requests |                          **16/month peak**, 3.5 mean | ⇒ at least one draft quote each                          |
| **Resend** — account mail    | 4 identities: `verify@` `reset@` `invite@` `alerts@` | unchanged                                                |

Even at peak with several messages per request, this is orders of magnitude inside any tier with a
limit. **The Xero-quota lesson does not transfer**, and that is a measured result rather than an
assumption. Worth recording before acceptance, because the body freezes there (ADR-0034).

## Two things the same pass established

### 1. Email is a notification, not the request — ADR-0027's framing holds

Measured across 50 threads: the request lands in the webshop, an email notifies `team@`, and a
person then writes to the customer. **The request never arrives AS email.** ADR-0027's consequence —
_"neither produces a domain event… Sending an email is a side effect of an event that already
happened"_ — is correct on the evidence.

`api-cloudrun` confirms it from the other side: **there is no inbound-email path at all.**
`src/lib/email.ts` has four `from` identities and nothing that receives; `team@` appears only as
`REPLY_TO` on line 15.

⇒ Under the replacement the request lands in CFS's own API and DB, so it becomes **a domain event in
`ordering`** — and Resend's part stays a side effect. **ADR-0027's reasoning survives; its scope
grows.**

### 2. ⚠️ ADR-0005 decided a framework for an application with no stated purpose

`ADR-0005` (keep SolidJS clients) is **accepted and frozen**. Its Context says:

> "A second client (a public web app) is on the roadmap and will share much of it as a package."

and its Decision is _"Keep SolidJS for all clients."_ **Nothing anywhere states what that app is
for.** The owner's 2026-08-18 ruling supplies it: it carries online order intake. Frozen, so this is
a `relates_to` correction rather than an edit (ADR-0034).

## What this owes

- **A domain event in `ordering`** for the online request. `ordering` is one of the four contexts
  with **zero requirements**, and this is the first concrete thing it has to describe.
- **ADR-0027 gains a fifth Resend use of a different kind** — a commercial document to a
  counterparty, not account mail. It also **crosses ADR-0028**, since a draft quote is rendered by
  Gotenberg and delivered by Resend, and neither ADR names the other in that path.

## Not established

- **Whether the draft quote is the only mail the flow sends.** Reminders, revisions and acceptance
  would each multiply the volume above, and none is specified.
- **What an online request contains.** The field set is unknown, and it is the first input any
  specification of this flow needs.
- Whether the replacement lands before or after the v2 cutover. If before, intake runs against the
  **v1** API and DB — a different sequencing problem from the one the roadmap describes.
