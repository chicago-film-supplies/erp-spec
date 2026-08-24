---
kind: decision
title: >-
  Owner — the public app must be discoverable by MACHINES, not only by people: a product feed
  conforming to whatever Google Shopping requires, the equivalent for Bing/DuckDuckGo and others,
  and whatever OpenAI and Anthropic require or advise for LLM-friendly ecommerce — plus NEAR AI and
  any other open standard for agentic search and purchase
contexts: [ordering, availability, billing]
source: "Owner, 2026-08-24, in session"
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

> _"we'll want to provide whatever feed google requires to be in shopping results, and conform to
> any guidance from bing, duckduckgo and others for similar. we'll also want to provide whatever
> openai and claude require/advise for llm friendly ecommerce, research sessions should look into
> all of these and look into near ai plus any other open standards for agentic search/purchase"_

## What this is, and what it is not

⚠️ **This note records a SCOPE RULING and names candidates to research. It asserts nothing about
what any of those parties actually require** — `verified: false` is deliberate and load-bearing. The
owner's own instruction is that _research sessions should look into all of these_, and every named
standard below is a **candidate to go and read**, not a fact this repo holds.

⚠️⚠️ **This is the highest-risk research topic in the repo for fabricated evidence.**
Agentic-commerce standards are new, fast-moving, and heavily written-about by people who are
guessing. The repo's own footgun applies with force: **a summarised fetch can fabricate the artifact
you went looking for**, and the more precisely a prompt describes the expected shape, the more
likely it comes back in that shape. ⇒ **extract the primary source before quoting anything from it**
— the spec document, the vendor's own schema reference, the RFC — and treat any blog post, summary
or model recollection as a pointer.

## The seventh capability, and it is a different KIND from the other six

`charter.md` gives the public client app six capabilities, and every one of them is a **human**
using a browser. This is the first that is not: the audience is a crawler, a merchant-feed importer
or a purchasing agent, and none of them reads a page the way the other six assume.

⇒ **A design that satisfies the six can fail this one completely while looking finished.** Real-time
availability rendered client-side is exactly the shape a feed importer cannot see.

## Two halves, and they are NOT one problem

|                             | audience                                        | shape                                                                      |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| **Syndication / discovery** | Google Shopping, Bing, DuckDuckGo, others       | a **feed we publish** on their schedule, in their schema, plus page markup |
| **Agentic commerce**        | LLM assistants and autonomous purchasing agents | a **protocol they call**, live, possibly transacting — a money path        |

⚠️ **Only the second is a money path**, and that is what separates them. A shopping feed is a
publication; an agent that completes a purchase reaches checkout, card fees,
`4700 - Transaction Fee
Income` and settlement — which makes it **accounting-shaped under rule 8a**
and puts it beside the checkout ambiguity already recorded in
`inbox/2026-08-18-owner-the-public-client-app-is-in-scope-real-time-availability-quote-request-and-in-store-checkout.md`.

## Candidates to research — named, unverified, one per line so none is lost

**Syndication.** Google Merchant Center product feed · Bing / Microsoft Merchant Center ·
DuckDuckGo's own guidance (⚠️ **may not exist as a distinct programme** — DuckDuckGo sources results
from partners, so "conform to DuckDuckGo" may resolve to conforming to somebody else, and finding
that out IS the research) · schema.org `Product` / `Offer` / `AggregateOffer` structured data ·
whatever robots/sitemap conventions the above depend on.

**Agentic commerce.** OpenAI's published guidance for commerce · Anthropic's published guidance ·
**NEAR AI** (named by the owner) · any open standard for agent-initiated search and purchase.

⚠️ **The assistant's knowledge cutoff is May 2026 and this field moves in months.** Anything in this
area that is not read from a primary source dated after that is a guess wearing a citation.

## ⚠️ What CFS rents is not what a shopping feed models, and this is the substantive risk

Every feed schema named above is built for **retail units of a purchasable good** — a price, a
quantity, a shipping class. CFS's catalog is **rental equipment**, priced per pricing factor, with
availability that is an **interval computation** (`ADR-0015`) and not a stock number.

Three consequences, and none of them is a mapping detail:

- **What is the "price" of a rental line in a feed** that has one price field? A day rate? A week
  rate? The answer is a **commercial** decision, not a schema decision.
- **What is "in stock"** for an item whose availability depends on the requested window? `ADR-0015`
  records that a per-day rollup **oversells**, so the naive projection is known-wrong before anyone
  builds it.
- **Does CFS want a public quantity feed at all?** The 2026-08-18 note already asks whether public
  availability shows quantities or only in/out of stock, and calls it _"a disclosure decision as
  much as a technical one"_. **A syndicated feed makes that disclosure permanent and crawlable.**

⇒ **Do not model the feed as a projection of the product master until that is settled.**

## ⚠️ v1 has a `webshop_products` collection, and it is the WRONG oracle for this

The live CFS API exposes `webshop_products`, and it will be tempting to read it as "the catalog we
already syndicate". Two reasons not to:

1. `charter.md` says the public app **replaces the third-party webshop, which is itself out of scope
   and migrates nothing.** Whatever shape that collection has is the third party's shape.
2. This repo's standing rule: **v1 answers WHAT IS, never WHAT MUST BE.** Measuring
   `webshop_products` tells you what CFS publishes today; it cannot tell you what a feed should
   carry. It is legitimate evidence for **sizing** — how many products, how many have images,
   descriptions, dimensions — and illegitimate as an argument about the target schema.

## What this owes

- **Research**, per the owner's instruction — filed as GitHub issues, because it is _work_ someone
  must do rather than a decision someone must make.
- **An `OQ-`** on the rental-vs-retail modelling question above, once the research says what the
  schemas actually demand. Minting it before then would be asking the owner a question nobody has
  prepared.
- **A `charter.md` bullet**, same session — the six capabilities become seven.
- **Requirements** in `ordering` and `availability` eventually; both still have zero (`erp-spec#6`).

## Not established

- Whether syndication ships with the public app or after it.
- Whether the feed is generated from the v2 product master or from a separate publication model.
- Whether agentic purchase is in scope at all as a **transacting** path, or only as a **read** path
  (an agent that can find and price, but hands off to a human to buy). ⚠️ **These are very different
  scopes** and the owner's phrasing — _"agentic search/purchase"_ — names both without separating
  them.
- Whether any of this interacts with the sales-tax determination (`ADR-0045`): a purchase initiated
  by an agent still has a jurisdiction of intended use, and **nobody has attested to it**.
