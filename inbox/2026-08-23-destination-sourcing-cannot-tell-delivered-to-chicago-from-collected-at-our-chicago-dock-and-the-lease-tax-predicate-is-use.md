---
kind: finding
title: >-
  Destination sourcing cannot distinguish "delivered to Chicago" from "collected at our Chicago
  dock" — both present as a Chicago address, and for the lease transaction tax, whose predicate is
  USE rather than delivery, those are different questions
contexts: [tax, ordering]
source: >-
  code:2026-08-23:core@7bcc2db:src/utils/taxes.ts and src/schemas/common.ts — read in full, not
  grepped. `deriveJurisdiction` has three cases; `customer_collecting` appears in neither the
  derivation nor the precedence.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Groundwork for the ADR that closes `SPIKE-008` (Chicago lease transaction tax). ⭐ **Most of what
that spike's draft D1 proposed is already implemented, and better than drafted** — but reading the
implementation surfaced one thing the spike did not have.

## What is already built, and the names are better than mine

`deriveJurisdiction(address, origin)` is **TOTAL** — three cases with three distinct legal reasons:

| # | address                          | result     | why                                                                    |
| - | -------------------------------- | ---------- | ---------------------------------------------------------------------- |
| 1 | outside Illinois                 | `no_nexus` | **nexus** — no obligation in another state                             |
| 2 | an Illinois city CFS collects in | that one   | **destination sourcing**                                               |
| 3 | any other Illinois municipality  | `origin`   | **origin sourcing** — the sale is deemed to occur at the selling place |

⭐ **`SPIKE-008`'s D1 called the default "a FALLBACK for the case where CFS does not know where the
gear is used." The code has a better answer: case 3 is ORIGIN SOURCING, a real doctrine, not an
admission of ignorance.** Take the correct name.

⭐ **And the D1 warning "the default must name the WAREHOUSE, not the jurisdiction" is already
satisfied** — the origin is `Store.jurisdiction`, _"a property of the selling business rather than
of a street."_ A destination-master level existed until api-cloudrun#591 and was **deleted**, with
the reason recorded: _"a destination is keyed by address and reused across orders and years, so a
stamped jurisdiction goes wrong PROSPECTIVELY the day CFS registers somewhere new."_ ⇒ **snapshot on
the DOCUMENT, which records a transaction; derive on the MASTER, which is a long-lived reference.**
That is a general rule worth lifting into the spec on its own.

⭐ **A jurisdiction is a REGISTRATION, not a place.** `JURISDICTIONS` is
`["chicago", "rantoul", "frankfort", "paxton", "no_nexus"]`, and ⚠️ **`SPIKE-008`'s D3 — "restrict
override targets to Frankfort and Rantoul" — is answered by that sentence rather than by a list.**
The sets are nested for stated reasons: `paxton` stays in the _vocabulary_ so one historical order
and invoice remain re-derivable, while being out of the derivation rule and the manager picker;
`no_nexus` is a sourcing ANSWER that nobody _levies_, so it is absent from `taxes[].jurisdiction`.

## ⚠️ THE FINDING — case 2 answers a question the lease tax does not ask

`deriveJurisdiction` **never consults `customer_collecting`.** Verified: the token appears nowhere
in the derivation or the precedence — only in a comment, and in `orders.ts` where it picks the
string _"In Store Pickup"_ against _"Delivery"_ for a label.

⇒ **a customer-collection destination carrying the warehouse's own Chicago address takes case 2 —
DESTINATION SOURCING — which asserts the goods went to Chicago.** The fact actually recorded is that
the customer picked them up at CFS's Chicago dock.

⭐ **For sales tax this is harmless: origin and destination coincide, so case 2 and case 3 return
`chicago` either way.** The two paths agree by geography, not by reasoning.

⚠️ **For the Personal Property Lease Transaction Tax they are different questions, and the
difference is the whole subject of this spike.** That tax reaches property **used in Chicago**.
Collection at a Chicago dock establishes where the gear _left from_ and says nothing about where it
is _used_. Case 2 supplies an affirmative destination answer to a predicate about use.

⭐⭐ **AND THIS IS WHY THE OVERRIDE MECHANISM IS THE RIGHT SHAPE.** The Frankfort and Rantoul
overrides are not exceptions carved out of a known fact — **they are the only cases where use is
actually KNOWN**, because the customer asserted it. The derivation covers the unknown; the override
covers the known. ⚠️ **Reading it the other way round is what made an earlier revision of
`SPIKE-008` treat 13 legitimate invoices as data defects.**

⚠️ **This is NOT a claim that the current behaviour is wrong**, and the distinction matters: the two
sourcing rules agree on the answer, so nothing is mis-collected today. What is missing is that
**nothing records which question was answered** — and that is exactly the gap an override's REASON
would close, on the side where CFS knows the answer.

⚠️ **Whether the ordinance permits a lessor to source a collection to the lessee's use location at
all is a CPA question, and it is the one that decides how much this matters.**
`Hertz Corp. v. City
of Chicago`, 2017 IL 119945, invalidated Lease Transaction Tax Ruling 11 on
precisely the "used in Chicago" question, so this is contested ground rather than a gap in CFS's
implementation.

## What this leaves for the ADR

D1 and D3 are implemented; what the ADR decides is **D2 — an override carries a reason and an
evidenced attestation** — plus recording the sourcing rule and the case-2 limit above so the next
reader does not re-derive them. The six-reference survey under rule 8a is running.
