---
kind: decision
title: >-
  Owner — CFS also SELLS items and will expand retail considerably, and online checkout is wanted for
  rental orders where every item is in stock — which narrows the feed-schema mismatch recorded
  earlier the same day and adds a capability an agent should be able to complete
contexts: [ordering, availability, billing]
source: "Owner, 2026-08-24, in session"
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

> _"cfs also sells items and will be expanding the number of retail sale items quite a bit, we'll
> also be offering online checkout for rental orders where all items are in stock (maybe not
> relevent to feed, but prob something we want an agent to be able to do)"_

⚠️ **This note exists because `inbox/` is append-only.** It corrects
`inbox/2026-08-24-owner-the-public-app-must-be-syndicated-to-shopping-feeds-and-legible-to-buying-agents.md`,
written hours earlier in the same session, which is **not edited**. Read the two together; this one
is later and wins where they disagree.

## What it corrects, and the correction is substantive

That note called the rental-vs-retail mismatch _"the substantive risk"_ and said flatly: _"CFS's
catalog is **rental equipment**."_ **That is wrong as a description of the catalog and wrong about
the size of the risk.** CFS sells retail items today and is expanding that side considerably.

⇒ **The catalog is TWO populations with different natures, and a shopping feed fits one of them
natively:**

|                       | fits a shopping feed | why                                                                                                     |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Retail sale items** | ✅ **directly**      | a purchasable unit with a price and a quantity — exactly what every feed schema models                  |
| **Rental equipment**  | ⚠️ **not natively**  | priced per pricing factor; availability is an **interval computation** (`ADR-0015`), not a stock number |

**The retail half is the easy, growing, high-value half, and the earlier note buried it.** It also
means the feed is worth more than that note implied: a growing retail catalog is precisely what
syndication pays off on.

⚠️ **What survives from the earlier note is the RENTAL half only** — "what is the price of a rental
line in a schema with one price field", "what is in stock for a window-dependent item", and whether
a public quantity feed is a disclosure CFS wants. Those questions are unchanged and still
unanswered; they are simply **not the whole catalog**.

⚠️ **And do not now over-correct.** "Retail fits a feed" is a claim about the SHAPE, not a
measurement. **Nobody has measured the retail population** — how many sale items exist today, how
many carry the images, descriptions, GTINs/MPNs, dimensions and shipping data a feed requires. **A
feed schema's required attributes are where a catalog that "fits" turns out not to.** Measure before
promising a feed.

## The new capability: online checkout for an all-in-stock rental order

> _"online checkout for rental orders where all items are in stock"_

⭐ **This resolves an ambiguity the 2026-08-18 note flagged as needing an `OQ-`.** That note
recorded that "checkout for in-store orders" had two readings — _pay online for an order raised
in-store_, vs _place and pay for an order to collect in-store_ — and warned the ambiguity becomes
invisible once someone picks a reading. This ruling names a **third, distinct** thing: a customer
places **and** pays for a **rental** order online, unattended, gated on availability.

⚠️ **The availability gate is the whole difficulty, and it is not a stock check.** _"Where all items
are in stock"_ is a predicate over a **requested rental window**, and `ADR-0015` already records
that a per-day rollup **oversells** — with `held = 2` and bookings on days 1–2 and 4–5, the window
`[1,5]` is exactly 0 while a daily curve says 1. ⇒ **the gate must be the interval engine, not a
projection of it**, or the app will confirm and take money for an order it cannot fill.

⚠️ **This is a money path taking money for a RESERVATION**, which is a different obligation from
retail checkout: the goods have not moved, the window is in the future, and the order can still fail
operationally. Whether it authorizes, captures, or captures a deposit is unasked and reaches
`OQ-064`.

## ⚠️ The owner's aside is the sharpest thing in this note

> _"maybe not relevent to feed, but prob something we want an agent to be able to do"_

**Correct on both halves, and the second is the important one.** Rental checkout is probably not
feed-shaped — but it is exactly what an agentic-commerce path would be asked to complete, which
means the **agentic half has a capability the syndication half does not**, and the two are being
designed as if they were one. ⇒ they diverge here, not only in audience:

- **Syndication** publishes the retail catalog and, at most, points at rental.
- **Agentic** may be asked to price a window, check interval availability, and **transact** on it.

⚠️ **That makes the read-vs-transact scope question from the earlier note urgent rather than
theoretical**, and it collides with `ADR-0045`: an agent-completed rental order still has a
**jurisdiction of intended use**, and **nobody has attested to it.**

## What this owes

- **Amend `charter.md`** — the seventh capability's framing, and rental online checkout named.
- **Measure the retail population** before any feed commitment: count, and required-attribute
  coverage.
- **An `OQ-`** on the availability gate for unattended rental checkout — which engine, at what
  freshness, and what happens when availability changes between quote and capture.
- Feeds `erp-spec#53`, `#54`, `#55`, and `#6`.

## Not established

- How large the retail catalog is now or will be. **"Quite a bit" is not a number.**
- Whether retail and rental share a product master or are separate populations in v2.
- Whether unattended rental checkout ships with the public app or later.
- Whether an agent may complete a rental checkout, or only a retail one. **These are different
  risks** and the owner's phrasing does not choose.
