---
kind: decision
title: >-
  Owner answers OQ-053 — CFS signs the crew engagement, buys its own GL and inland marine, and eats
  the loss if the client does not pay; the crew cost passes through at cost plus a stated fee, and
  the payroll runs through an EOR
contexts: [ledger, billing, fulfillment]
source: "Owner, 2026-08-22, in session, in answer to OQ-053's four questions"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

The three facts `OQ-053` said were _"not in the books"_, plus the fourth ASC 606 indicator, asked as
facts rather than as an accounting judgement — because the owner knows who signs and who insures,
and the classification follows from that.

## The answers

| ASC 606-10-55-39 indicator                                            | fact (owner, 2026-08-22)                                     | points at     |
| --------------------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| **primary responsibility for fulfilling the promise**                 | **CFS signs the crew engagement / is the contracting party** | **PRINCIPAL** |
| _(supporting)_ whose insurance answers                                | **CFS buys its own policy for it — GL and inland marine**    | **PRINCIPAL** |
| _(supporting)_ who bears the loss if the client's money never arrives | **"CFS eats it"**                                            | **PRINCIPAL** |
| **inventory risk**                                                    | not applicable to a service                                  | —             |
| **discretion in establishing the price**                              | **pass-through at cost, plus a stated fee**                  | ⚠️ **AGENT**  |

⚠️ **One indicator dissents, and it should not be smoothed over.** Price discretion is the reason
the arrangement _feels_ like a pass-through, and it is why `charter.md` and erp-spec#35 describe it
that way. It is a real datum against the principal reading.

⭐ **But the indicators support the assessment of CONTROL (ASC 606-10-55-37); they are not a
checklist**, and a cost-plus fee is a **pricing structure rather than a statement about who is
obligated** — staffing and construction principals routinely bill at cost plus a fee. The control
fact is the one the owner gave on 2026-08-17: overseas productions use a PSA precisely because they
**will not stand up a US entity and cannot hold union deals for a few days of filming.** ⇒ **The
arrangement exists BECAUSE the client cannot be the employer.** Three facts now confirm CFS is: it
signs, it insures, and it is out of pocket if the money never comes.

## ⭐ THE FINDING NOBODY ASKED FOR: the PSA payroll runs through an EOR

> _"we would buy a policy for this (gl/inland marine) and we would use an eor for payroll (ep, cast
> and crew, revolution)"_

**Entertainment Partners, Cast & Crew, Revolution Payroll.** ⇒ **PSA payroll is the same shape as
CFS's own crew payroll**, which OQ-024 already settled: _an EOR is not payroll — it is a vendor that
invoices._

**That is `obligation_accrued` → `vendor_bill_received`, already specified**, and `ADR-0041`'s labor
variance applies to it unchanged: an EOR prices burden per payroll RUN while itemising wages per
person per day, whoever the crew is working for.

⇒ ⚠️ **erp-spec#35's cost side may need far less new machinery than "no requirement, no event, no
posting rule" suggests.** What PSA genuinely needs new is the REVENUE side and its product line —
not a payroll path, which exists.

## ⚠️ One distinction to keep, and not to resolve here

The owner's first answer said **"CFS is the employer of record"** and the second said **"we would
use an eor for payroll"**. Those describe two different relationships and both can be true:

- **client ↔ CFS** — CFS is the contracting party the client engages, which is what decides D1;
- **CFS ↔ EOR ↔ crew** — the EOR is the legal employer for payroll purposes, engaged by CFS.

**Which of the two holds the union deals is not settled by these answers**, and it matters for the
insurance and the employment obligation rather than for the revenue classification. Recorded as a
distinction rather than collapsed, because collapsing it is how a later reader concludes something
neither answer said.

## What this does NOT settle

- ⚠️ **`4130 - PSA Income`'s $13,202.34 for FY2025 still reconciles to nothing** — income in Xero
  with no CFS invoice line naming the account. Whatever produced it is a path this repo has not
  seen, and it must not be used to size PSA until it does.
- ⚠️ **The history stays inconsistent whichever way this lands** — 93% of the invoiced value is
  billed gross and 7% through the liability, for the same customer on the same shape of work. The
  cutover carries a comparability break of a kind neither ADR-0020 nor ADR-0030 has: **an
  inconsistent past rather than a consistent one presented differently.**
- ✅ **`2800` needs no ruling to stay correct.** Money received before the work is performed is a
  liability under every reference in the survey, so 2800 remains right as a holding account — what
  changes is that it is no longer the _mechanism by which the service is sold_.
