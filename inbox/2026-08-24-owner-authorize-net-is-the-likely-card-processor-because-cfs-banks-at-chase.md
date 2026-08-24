---
kind: idea
title: >-
  Owner — the public app will most likely take cards through Authorize.Net, because CFS banks at
  Chase and the merchant account is there; other payment methods are of interest too
contexts: [billing, banking]
source: "Owner, 2026-08-24, in session"
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

> _"cfs public app will most likely be using authorize.net for credit card payments (b/c we bank at
> chase and our merchant account is there) we may be interested in receiving payments other ways
> too"_

⚠️ **"Most likely" is the owner's own hedge and it is preserved deliberately.** `confidence: medium`
and `kind: idea` rather than `decision` — this is a leading candidate with a stated reason, not a
ruling. Recording it as decided would remove a choice nobody has made.

## Why the reason matters more than the candidate

The argument is **not** "Authorize.Net is the best gateway". It is _"we bank at Chase and our
merchant account is there"_ — which is a statement about **where settlement already lands**, and
that is the part that survives even if the gateway changes.

⇒ **The criterion is: whatever CFS chooses must settle into the existing Chase merchant account
without a second banking relationship.** That criterion is testable against any candidate; the
candidate is not. Same lesson as the credit-note survey: **the criterion outlives the default.**

## ⚠️ This is accounting-shaped and it reaches accounts that already exist

Taking a card is not a technical integration with an accounting footnote. It reaches:

- **`4700 - Transaction Fee Income`** — what the customer is charged for paying by card.
- **`5500 - Cost of Goods Sold: Merchant Fees`** — what the processor takes. The chart already
  records that these two pair, and that _"the margin is the recharge spread"_.
- **Settlement**: a processor pays out in **batches, net of fees, on its own schedule**, so one
  deposit on the bank feed is many invoices minus a fee. ⚠️ **That is a reconciliation shape
  `ADR-0048` does not cover** — it specifies how a Plaid row is ingested, not how one net deposit is
  matched to many receipts.

⇒ Whatever ADR specifies payment acceptance is **`accounting_shaped: true` and owes the rule 8a
six-reference survey** before a recommendation, not after. The 2026-08-18 public-app note already
said this about checkout; this note names the concrete accounts.

⚠️ **Do not repeat the "`2101`–`2110` card block" framing from the 2026-08-18 note without checking
it.** Those accounts are named after **people** (`K MCGRAIL`, `A. HUGHES`, …) and are classed
`asset`/debit — they look like CFS's own spending cards, not a customer-receipts block. **Read the
chart before citing it**; a citation example in this repo has already gone stale once.

## "Other ways too" — unenumerated, and that is the point

The owner names no second method. Do not invent a list. What the phrase does establish is a **design
constraint**: the payment path must not assume exactly one processor or exactly one instrument. ⇒
**an unexercised branch of a rule is a claim, not a capability** — if the model permits several
methods and only cards are ever built, assume the rest does not work.

Candidates worth asking the owner about, as questions rather than assumptions: ACH / bank debit
(materially cheaper at CFS's ticket sizes, and CFS already has the bank relationship), check and
wire (⚠️ almost certainly already received today — this would be **recording** an existing path, not
adding one), and whatever an agentic purchase flow turns out to require, which is
`inbox/2026-08-24-owner-the-public-app-must-be-syndicated-to-shopping-feeds-and-legible-to-buying-agents.md`'s
problem and may not be a card at all.

## What this owes

- **An `OQ-`** on payment acceptance — the processor, and whether more than one method is in scope
  at v1. Owned and dated, so it is decided rather than defaulted at build time.
- **A survey** under `inbox/`, dated, before any ADR: GAAP on gross-vs-net presentation of a
  recharged fee, **Xero as the incumbent** (how are card receipts and merchant fees recorded in
  CFS's books TODAY — that is the migration delta and only Xero can tell you), then SAP, NetSuite,
  Sage Intacct and Odoo on how each models a payment gateway, its clearing account and its
  settlement batch.
- **Requirements** in `billing` and `banking`. `banking` has zero today (`erp-spec#6`).

## Not established

- Whether Authorize.Net is actually the choice, or whether Chase's own current gateway offering is
  the same product under a different name. ⚠️ **Verify what the Chase merchant account actually
  provides before treating "Authorize.Net" as a separate integration decision** — the two may not be
  independent.
- The fee structure, and therefore whether the `4700`/`5500` recharge spread is positive, zero or
  negative. **A recharge that under-recovers is a real outcome and nobody has measured it.**
- Whether a stored payment method / card-on-file is in scope. That is a PCI question and a very
  different obligation from a one-off checkout.
- Whether an agent-initiated purchase can use this path at all.
