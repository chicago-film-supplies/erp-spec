---
kind: correction
title: Correction — two of the three "not reachable" references in the vendor-side survey were a malformed query, not a source gap; SAP models CFS's case exactly and presents it GROSS, and the Xero delta is narrower than stated
contexts: [ledger, billing]
source: SAP Press "Drop Shipping with SAP S/4HANA Sales" + SAPinsider drop-ship billing configuration · Sage Intacct project costing / time-and-expense · Xero Central "Add billable expenses" (fetched, procedure only) · api:2026-08-16:db_invoices_get on 1Qr50IQXdPjKC2cB7WyV
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects
`inbox/2026-08-16-survey-a-vendor-side-amount-becomes-revenue-only-where-control-or-a-markup-does.md`,
which is append-only and stands as written. Its **conclusions survive and strengthen**; its claim
that three of six references were "not reachable" does not.

## Two of the three were a malformed query

The survey ran Sage Intacct and SAP as **one search**:
`Sage Intacct billable expenses rebill markup revenue account "SAP" third party drop ship principal
gross posting`.
That asks about two unrelated products at once and predictably returned marketing pages for both.
"Not reachable" described the query, not the documentation.

Run separately, both returned substantive material.

### SAP — and it models CFS's case exactly, gross

**Third-party order processing (drop shipment)**: goods go from the supplier direct to the customer
"without passing through the warehouse of the trader or distributor". The flow is a sales order that
automatically raises a **purchase requisition**; a **statistical goods receipt** (MIGO) that records
receipt **without creating inventory**; a vendor invoice through the normal receipt process (MIRO);
and the sales order line then **becomes relevant for billing**.

**This is the strongest single reference in the whole survey and it was the one skipped.** Revenue
posts on the sales order at the full amount and the vendor cost posts separately — a **gross**
presentation — and the _statistical_ goods receipt is precisely the mechanism for holding **no
inventory** while still being the principal.

⇒ It answers the one indicator that pointed "agent". CFS carrying no inventory risk is not evidence
of agency here; it is the defining feature of the drop-ship shape, which SAP treats as a principal
transaction by construction.

### Sage Intacct — markup is native

Automatic **percentage markups on billable transactions** "to ensure profitability", and for
projects and grants, indirect costs billed at "a negotiated rate, specific rate, or markup based on
the type of expense". The exact revenue account is still not documented in reachable sources, but
the substantive point — a re-billed cost carries a configurable margin — is established.

## Xero — the gap is real, but the survey had not earned the claim

The survey asserted unreachability after **one search**, without fetching the Xero Central article
whose URL it already had. Fetched since: one attempt timed out, a second returned the **procedure**
only — how to assign a bill to a customer and add it to their invoice. Xero Central documents the
workflow and not the posting.

So the documentation gap stands. What was wrong was claiming it without testing it.

## The migration delta is NARROWER than the survey stated, and partly unanswerable by design

The survey said: _"One document, and it decides the delta."_ Read
(`api:2026-08-16:db_invoices_get`), it does not.

**Invoice 1308 — "Internet @ Firehouse", $800.00 (2 × $400.00), `GWave Productions, LLC / Office`,
2023-09-15, paid.** CFS bought internet service at a shoot location and re-billed it: the exact
shape the owner described, a vendor that will not onboard a production for a two-week service.

- **The revenue side IS visible and IS gross.** The full $800 posts to `4140`, a revenue account —
  not a markup-only figure.
- **The cost side is not visible and cannot be.** A pass-through's cost is an **ACCPAY** bill, and
  the workspace rule is explicit that "ACCPAY are company bills that live only in Xero — CFS
  deliberately tracks none of them". Calling the Xero API from this repo is forbidden.

⇒ The open question is not "does Xero present this gross or net" — the revenue half is already gross
in CFS's own record. It is **"where did the vendor cost land"**, and that is unanswerable from CFS
data by design rather than by omission.

## A finding the same document supplies

That line's **`tracking_category` is `null`**, and its `xero_tracking_option_id` is `null` too. So
the single pass-through in the corpus **already carries no product line** — which is the
recommendation the survey made for OQ-041's dimension, observed rather than proposed. One line is
not a population, but it is not nothing either: the operator who typed it reached the same answer.

## What changes in the conclusions

Nothing reverses. Three things strengthen:

- **Principal / gross** gains its most direct reference. SAP builds the no-inventory drop-ship case
  as a gross principal transaction, so the indicator that pointed "agent" is explained rather than
  merely outweighed.
- **The survey is four-and-a-half of six**, not three-and-a-half. Xero's posting mechanics and
  Intacct's exact revenue account remain undocumented in reachable sources.
- **OQ-041's dimension recommendation** has one observation behind it instead of none.

## The lesson worth keeping

**A combined query is not a shortcut, it is a silent narrowing of the search.** Two vendors in one
string returned plausible-looking results for both and evidence for neither — and the failure was
invisible, because a search that returns _something_ does not look like a search that failed. The
survey then recorded the outcome as a property of the sources.

Same shape as this repo's standing rule about unexercised branches: the machinery looked like it
worked because nothing went red.
