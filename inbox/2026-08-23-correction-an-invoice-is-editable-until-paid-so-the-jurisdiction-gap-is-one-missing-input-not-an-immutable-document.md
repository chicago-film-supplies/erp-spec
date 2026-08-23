---
kind: correction
title: >-
  Correction — an invoice is editable until a payment is applied, so the correction path is not
  blocked by an immutable document; the gap is one missing input on a PUT that already reprices, and
  the payment boundary answers the accounting question rather than leaving it open
contexts: [tax, billing]
source: "owner, 2026-08-23, in session; verified code:2026-08-23:api-cloudrun@22672044:src/services/invoices.ts"
confidence: high
promotes_to: [ADR-0045]
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> an invoice is editable until it has a payment applied to it

## What I got right, and what I framed wrong

`inbox/2026-08-23-owner-the-correction-path-is-the-destination-override-...md` said the correction
path _"cannot be exercised on an invoice today"_ and called the invoice _"the document most likely
to need a correction and the one that cannot take one."_

⚠️ **The narrow claim is true and the framing overstated it.** Verified verbatim at
`src/services/invoices.ts:897-901`:

> ⚠️ **This is the only tax lever a PUT has, and it is deliberately not symmetric with the
> order's.** An invoice's jurisdiction **has never been editable after create** — it is inherited
> from the embedded customer snapshot — so there is no second axis here to disagree with.

⇒ **the JURISDICTION is not an input. The INVOICE is not immutable.** A PUT exists, it edits items,
subject, references, notes and `tax_exempt`, and it **re-materializes tax through
`invoiceTaxContext`.** I collapsed "this field is not editable" into "this document cannot take a
correction", and those are different statements.

## ⭐ The gap is one missing input, and the slot is already built

The exemption axis is written **before** the items block _"which is what makes it take effect: that
block re-materializes the rebuilt lines through `invoiceTaxContext(updated, …)`, so the new value is
already in the context the rule reads."_

⇒ **a jurisdiction input would ride the identical path** — same slot, same ordering constraint, same
re-materialization. **This is a much smaller change than "invoices are immutable" implied**, and it
is the whole of what the owner's correction path needs on the invoice side.

## ⭐⭐ And the payment boundary ANSWERS the accounting question

The previous note left open: _"whether a correction on an issued invoice may change tax at all, or
must go through a credit note"_, citing `ADR-0020` (a restatement must not alter any amount).

⇒ **the boundary is already drawn, and it is payment.** Unpaid, a correction is an ordinary edit and
the amount may move. Paid, the document is closed and a credit note is the only route. **The system
does not need a new rule for this; it needs the jurisdiction input to respect the one that exists.**

## ⚠️ What I could NOT find, and it matters

**I could not locate a CFS-side payment gate on `updateInvoice`.** Greps for a payments-applied
refusal in the update path found only _Xero's_ rule — `:235` (_"paid invoices are immutable"_, about
Xero rejecting an update) and `:280` (Xero rejecting a void once payments are allocated). Both
describe the **remote** system.

⇒ **either the CFS-side guard lives somewhere I did not read — a status check, a route-level
precondition, or the manager — or the rule is intended and unenforced server-side.** ⚠️ **I am not
asserting which.** It is the difference between a business rule the API enforces and one it relies
on the UI to respect, and that distinction decides whether a jurisdiction input can be added safely
without adding the guard alongside it.

⭐ **This is worth resolving BEFORE the input is added**, not after: an editable jurisdiction on a
paid invoice would move a billed amount, which is exactly what `ADR-0020` forbids and what the
payment boundary is supposed to prevent. **If the guard is not there, the input must not go in
first.**
