---
kind: correction
title: >-
  Correction — `destinations[].jurisdiction` is an override seeded from the organization's claim and
  the tax DOES follow it; 13 of the 15 "disagreements" are one customer's claim honoured correctly,
  and the 50% exemption I cited does not apply to CFS at all
contexts: [tax, billing]
source: >-
  `api:2026-08-22` — invoices 2305/2315/2346 (Kenwood TV Productions), 1960 (Chili Finger), 2392
  (Imagination Colony), read against `organization.jurisdiction_claim`,
  `destinations[].jurisdiction`, the delivery address and the taxes actually applied.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects two claims made earlier the same day in
`inbox/2026-08-22-spike-008-the-tax-decision-table-already-exists-as-data-and-the-jurisdiction-field-it-would-source-from-is-absent-or-wrong.md`,
which is append-only and stands as written. Both were raised by the owner.

## ⚠️ Correction 1 — "wrong more often than right" was the wrong reading

The earlier note reported: _of 28 destinations where a jurisdiction and a mappable city both exist,
13 agree and **15 disagree**_ — and concluded the field "disagrees with the delivery address more
often than it agrees."

**The count is right and the conclusion is wrong.** Looking at who the 15 are:

|              |                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **13 of 15** | one customer — **Kenwood TV Productions Inc**, whose `organization.jurisdiction_claim` **is `frankfort`** |
| 1            | Chili Finger LLC, `claim: null`, destination `rantoul`                                                    |
| 1            | Imagination Colony Inc, `claim: null`, destination `rantoul`                                              |

⇒ **`destinations[].jurisdiction` is an OVERRIDE, seeded from the organization's claim** — and the
field name says so. It is a _claim_, not a derivation. A destination disagreeing with its delivery
city is the mechanism working, not failing.

## ⚠️ Correction 2 — "the applied tax follows the ADDRESS" is false

The earlier note concluded from invoice 2392 that "whatever drives the tax today, it is not this
field." Checked against five invoices:

| invoice          | org claim | dest jurisdiction | delivery city | tax applied       | follows        |
| ---------------- | --------- | ----------------- | ------------- | ----------------- | -------------- |
| 2305, 2315, 2346 | frankfort | frankfort         | Chicago       | **Frankfort 8%**  | the FIELD      |
| 1960             | null      | rantoul           | Chicago       | **Rantoul 9%**    | the FIELD      |
| **2392**         | null      | rantoul           | Chicago       | **Chicago 10.5%** | ⚠️ the ADDRESS |

⇒ **The tax follows the jurisdiction field in 4 of 5. Invoice 2392 is the exception, not the rule**
— one destination, dated 2026-08-21, whose jurisdiction was ignored. **Generalising from it was the
error**: a single case was read as the system's behaviour when four others showed the opposite.

## ⚠️ Correction 3 — the 50% exemption does not apply to CFS

The earlier note claimed the ordinance's _"property leased outside the city that is primarily used
outside the city (50%)"_ is a **partial exemption** that CFS's boolean model cannot express, and
called it "not an edge case" for a rental house whose gear travels.

**Both halves are wrong, and the owner caught it.**

- **The predicate fails at its first clause.** The exemption is for property **leased outside the
  city**. CFS is a Chicago lessor leasing from a Chicago warehouse, so its leases are not described
  by this provision at all.
- **`(50%)` most likely defines "primarily"** — more than half of use — rather than stating the size
  of a relief. ⚠️ **I inferred a partial-exemption rate from a parenthetical on a summary page**,
  which is precisely the failure this repo's own footgun names: _extract the primary source before
  quoting a number from it._ §3-32-050's text was never read; it sits behind an HTTP 403.

⇒ **There is no 50% partial exemption to represent, and OQ-056's third part is withdrawn.**

## ⭐ What survives, and it is sharper than what it replaces

The mechanism works. **What is worth asking is whether it is LAWFUL**, and that is one question, not
three:

**Kenwood TV Productions is delivered to `3100 W Fillmore St, Chicago` and billed FRANKFORT sales
tax at 8%, on the strength of a claim.** The Chicago Personal Property Lease Transaction Tax reaches
property **used in Chicago** — and gear delivered to a Chicago address is, on its face, used in
Chicago.

⇒ **A customer's jurisdiction claim is a tax POSITION, not a data field.** If it is right, something
should record why it is right; if it is wrong, CFS is under-collecting Chicago lease tax at 15%
while remitting Frankfort sales tax at 8% — **a seven-point difference, on 13 invoices** in this
sample. ⚠️ **This repo produces rules, not authority. It is a CPA question and it should be asked.**

## Two things that remain open and were NOT wrong

- **96.4% of destinations carry no jurisdiction at all** (34 of 946). What drives the tax for the
  rest is an unstated default, and "unstated default" is the part worth writing down.
- **Invoice 2392** is a genuine one-off: a destination whose jurisdiction says `rantoul`, whose
  address says Chicago, and whose tax followed neither the claim (there is none) nor the field. It
  is dated 2026-08-21 and remains unexplained.
