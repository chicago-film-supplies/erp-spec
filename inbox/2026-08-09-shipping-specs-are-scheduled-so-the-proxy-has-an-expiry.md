---
kind: constraint
title: Shipping specs will be populated this year — so the allocation proxy has an expiry, a physical basis becomes SUFFICIENT rather than merely better, and partial population is more dangerous than uniform zero
contexts: [ledger, billing, fulfillment]
source: repo owner, 2026-08-09 session
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-09: **product shipping specs will be populated this year.**

ADR-0031 adopted goods revenue as the allocation basis and recorded it as
`criterion: ability_to_bear` with an explicit `proxy_for`, on the measured fact that
`products.shipping.weight` is present on 531 of 549 products and **zero on all 549**. That
measurement stands. What changes is its expected lifetime: the proxy is now **interim with a date**,
not interim in principle.

## Distance does not matter here, and that is why this is sufficient rather than helpful

The official allocation spreads **one order's** delivery pool across **that order's** goods lines.
So the only question is what varies _between lines of the same order_.

Distance, crew size, stop count and drive time are **order-level** — identical for every line on the
order, so they cancel out entirely. Weight and cube are the only things that vary line to line.

**A populated shipping spec therefore closes the cause-and-effect gap for this allocation
completely.** It does not merely improve the proxy; it makes a tier-1 basis available where today
there is none. Distance remains uncaptured and remains necessary — but only for `trip_travel`, the
_inter_-order allocation of one shared run across the several jobs it served (erp-spec#12), which is
a different allocation that runs before this one.

That is a sharper statement than ADR-0031's consequence, which bundled both captures together as one
requirement. They are separable, and the shipping spec is the half that is already scheduled.

## Weight or cube — the freight industry already answered this, and it is neither

A truck runs out of **mass or space**, whichever comes first, which is why every carrier bills on
**dimensional weight**: `max(actual weight, volume ÷ dimensional factor)`. Neither weight nor cube
alone is the driver.

It matters for this catalogue specifically. Tents, tables, wardrobe rails and surface protection are
bulky and light; a walkie case or a Duradeck sheet is dense and small. A pure weight basis would
under-allocate delivery cost to exactly the bulky lines that fill the van, and a pure cube basis
would under-allocate to the heavy ones. `shipping` carries `weight`, `height`, `width` **and**
`length`, so both inputs arrive together and the choice is real. → OQ-033.

## ⚠️ Partial population fails SILENTLY, and uniform zero does not

This is the trap, and it arrives during the population effort rather than after it.

- **Today, uniformly zero**: a weight basis gives every order a zero denominator, so 100% of the
  pool falls into the unallocated bucket. Loud, immediate, impossible to miss.
- **Mid-population, say 60% covered**: an order with two measured lines and one unmeasured spreads
  the whole pool across the two. The unmeasured line absorbs **zero delivery cost** and reports a
  margin that looks excellent. **Every share still sums exactly to the pool, so the control total
  passes and nothing fails.**

The bias is not random: it tracks how well a product's catalogue entry is maintained, so the
least-maintained lines look the most profitable. That is the same defect class as the money `_str`
mirror that rendered 100× in both environments while a location ratchet passed — _it balances_ is
not _it is right_.

**So a physical basis owes an activation precondition**: every goods line in an order's base must
carry a non-zero driver, or the whole order falls to the unallocated bucket. Degrading loudly to the
bucket is correct; spreading over the measured subset is not.

## And `weight: 0` cannot currently express "not measured yet"

`code:2026-08-09:core@8e6deba9:src/schemas/product.ts` — the `shipping` block is `.optional()`, but
inside it `weight`, `height`, `width` and `length` are each a bare `z.number()`: **not nullable, no
default, no `measured_at`**. So zero is a legal value meaning both _"weighs nothing"_ and _"nobody
has weighed it"_.

Two consequences:

1. **Population progress cannot be measured** — "how many products are done" has no query, because
   done-and-zero looks like not-started.
2. **The activation precondition above cannot be evaluated correctly.** It would have to treat 0 as
   unmeasured, which permanently forbids a genuinely weightless line.

Making these nullable — or adding a `measured_at` — is a `core` schema change and wants doing
**before** the population effort starts rather than after, because a backfill of 549 products cannot
distinguish the two states retroactively either. Filed as core#51.
