---
kind: decision
title: >-
  Owner rules the stored number stays an INTEGER and the prefix becomes a display function — orders
  and invoices are deliberately different number sets, and products, organizations and transactions
  need human numbers too
contexts: [ordering, billing, ledger, fulfillment]
source: >-
  Owner, 2026-08-29, in session. Corpus measured the same day with
  `spikes/harness/document-number-probe.ts` (`deno task doc-numbers`), read-only prod Firestore
  under ADC.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-29, answering the `OQ-065` survey:

> orders and invoices are different number sets (not all orders convert, some will have multiple
> invoices) i dont love the inv- ord- prefix i prefer the numbers be integers, but maybe we can have
> both use a sync function to prefix them when needed? products, orgs, transactions will also need
> human readable numbers i prefer these to be integers

Four rulings and one open proposal.

## 1. ✅ Separate sequences are DELIBERATE, and the reason is stated

_"not all orders convert, some will have multiple invoices"_ — so the order↔invoice relation is
neither total nor one-to-one, and a shared counter would be lying about a cardinality the business
actually has. ⇒ **The two sequences stay independent.** This closes the only reading under which the
~190-day collision could have been "fixed" by merging them.

## 2. ✅ The stored value is an INTEGER; the prefix is a DISPLAY FUNCTION

Owner: _"i prefer the numbers be integers… maybe we can have both use a sync function to prefix them
when needed"_.

⭐ **This is the same split the repo already took twice, and naming it that way is the argument for
it.** `ADR-0036` carries keys in the ledger and derives every classification at report time;
`ADR-0014` derives lifecycle rather than assigning it. **A prefixed string is a rendering of an
integer, not a different identifier** — so it is derived at the edge, and the store holds the key.

⇒ It also departs from every reference in the `OQ-065` survey. Sage Intacct's
`Fixed prefix /
Separators / Fixed suffix` and NetSuite's `Prefix` field both produce a **stored**
formatted id. **CFS would store the integer and format on read.** That is a departure worth stating,
and the reason it is defensible here is that CFS controls every surface — the counter-argument (a
formatted id survives export into systems that know nothing of your formatter) is weaker once
`ADR-0001` has removed the accounting system CFS exports to.

## 3. ⭐⭐ The measurement that makes this ruling stronger than it looks

Range separation was never doing the disambiguation work. Measured 2026-08-29, **six collections
carry a human `number` and 10 of 15 pairs ALREADY overlap**:

| collection     | numbered |       range | own sequence?                                                      |
| -------------- | -------: | ----------: | ------------------------------------------------------------------ |
| `orders`       |    1,002 |    1 … 1012 | **own**                                                            |
| `invoices`     |    1,022 | 1194 … 2395 | **own** — 0 of 1,022 is an order number                            |
| `transactions` |    1,127 |    1 … 1127 | **own** — and **gapless**, 1,127 distinct over 1,127 slots         |
| `credit-notes` |       13 | 1007 … 1026 | **own**                                                            |
| `fulfillments` |    1,002 |    1 … 1012 | **BORROWED** — 1002/1002 are order numbers, same cardinality       |
| `bookings`     |    7,021 |    1 … 1012 | **BORROWED** — 719/719 are order numbers, denormed onto 7,021 rows |

⇒ **`1000` is already simultaneously a valid order, transaction, fulfillment and booking number.**
The orders↔invoices collision dated at ~190 days in the survey is **the only pair that has not
already happened.**

⇒ **So the choice is not "prefix or stay unambiguous."** The bare integer is already ambiguous
across four live sequences, and has been for as long as they have coexisted. A display-time
qualifier is the only mechanism that can fix it, and the ruling above is the cheap way to get one.

### ⭐ And CFS already has an answer for documents that do NOT need their own number

**A fulfillment is not a thing with its own identity in the numbering scheme — it is an artifact OF
order 847**, and it wears that number. `bookings` does the same; `quotes` says so in the field name
(`order_number`). **Three places, one unstated rule: a document in an order's family borrows the
order's number rather than minting a sequence.**

⇒ That is the cheapest possible "human readable and short", it is already in production, and it
should be a **deliberate rule in v2 rather than an accident**. It also bounds the problem: the
number of sequences is the number of ROOTS, not the number of entities.

## 4. ✅ Four more entities need a human number — and two of them are free choices

| entity          | today                                                                     | note                                                              |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `transactions`  | ✅ **already has one**, and it is the only gapless sequence in the corpus | nothing to mint                                                   |
| `products`      | ❌ **none** — `uid`, `crms_id`, `xero_code` only                          | free choice                                                       |
| `organizations` | ❌ **none** — `uid`, `crms_id`, `xero_id` only                            | free choice                                                       |
| `contacts`      | ❌ none                                                                   | not named by the owner; listed because it is the obvious next ask |

⭐ **Products and organizations carry no high-water mark and no customer-facing legacy**, so unlike
orders and invoices they can start anywhere with no migration obligation. `migration/field-map.yaml`
commits to carrying each existing counter's final value forward; **these two have no counter to
carry.**

⚠️ **But `products` already has a human-ish identifier and it is not an integer.** `xero_code` is
present on 567 of 568 products scanned. **Minting a product number alongside it creates a second
human identifier for one thing**, and "which one does a person say out loud" is then undecided. ⇒
Ask whether the product number REPLACES `xero_code`'s role or sits beside it, before minting one.

## 5. ⚠️ What the display-function proposal does NOT solve, stated plainly

**Rendering is the easy half. INPUT is the hard half.**

- An operator types `1200` into a search box. A formatter that only runs on output cannot help — the
  search surface needs either a type filter or a parser that accepts `INV-1200`, `1200`, and decides
  what a bare integer means.
- A customer emails _"about invoice 1200"_. Fine — context carries it. An internal note saying _"see
  1200"_ does not.
- A URL, an export, a printed document, a CSV column: each is a surface, and **a prefix that is
  missing from any one of them is ambiguity restored there.**

⇒ **The format function needs a PARSE partner**, and the decision is not "do we prefix" but **"which
surfaces are required to carry the qualifier."** That is the part still to specify.

⚠️ **And the type→prefix map has to have exactly one owner.** This repo has been bitten twice by a
list that lived in two places — `tools/contexts.ts` said it was THE registry while `view.ts` held a
fifth hardcoded copy, and `db_schema`'s enum carries 35 of 50 collections. A prefix map is exactly
that shape.

## 6. What is NOT established

- **Whether a bare integer is allowed to be ambiguous in the store.** It is today. The ruling makes
  the qualifier a display concern, which is coherent — but nothing yet says what a **cross-entity
  reference** looks like when one document points at another.
- **Whether `credit-notes` should keep its own sequence or borrow** from the invoice it credits. It
  is 13 documents; the answer is cheap now and expensive later.
- **What the product number is FOR**, given `xero_code` (§4).
- **Whether "sortable" was answered.** The owner ruled on FORMAT. `OQ-065`'s sharper half — which
  clock the number sorts by, and at which lifecycle act it is minted — **is untouched by this ruling
  and still open.** 173 of 1,021 adjacent invoice pairs are still inverted against `date`.
