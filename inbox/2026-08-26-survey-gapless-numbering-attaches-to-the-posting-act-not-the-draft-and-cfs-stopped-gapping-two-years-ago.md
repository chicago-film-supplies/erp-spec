---
kind: survey
title: >-
  Rule 8a survey on document numbering — every system that guarantees gaplessness attaches it to the
  POSTING act rather than to the draft, none of them makes the human-readable number the gapless
  one, and CFS's own invoice sequence stopped gapping two years ago without anyone deciding to
contexts: [billing, ordering, ledger]
source: >-
  Six-reference survey, 2026-08-26, prompted by the owner: reconsider sequential no-gap order and
  invoice numbers, wanted human readable, short and sortable. Vendor quotes are VERBATIM from the
  pages named beside each one and were extracted individually rather than summarized. The incumbent
  half is measured from CFS's own corpus rather than fetched — `central.xero.com` timed out on two
  attempts and Xero is researched from CFS's mirrored data by house rule anyway. Corpus measured
  with `spikes/harness/document-number-probe.ts` (`deno task doc-numbers`), read-only prod Firestore
  under ADC.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-26:

> id also like to reconsider sequntial no gap order and invoice numbers, i wan them to be human
> readable, short and sortable, i dont think the contention/hot doc is huge problem, but think we
> should at least research alternatives and consider them

Four wants. **Three are measurable against the incumbent and one is not**: _readable_ is a
judgement, _short_ / _sortable_ / _no-gap_ are properties a corpus either has or does not. So the
corpus was measured first, and it moved the question.

## 1. What CFS's numbering actually is, measured

`deno task doc-numbers`, read-only prod Firestore, 2026-08-26. Re-runnable — the point of the probe
is that none of this has to be believed.

|                                      |                   orders |                    invoices |
| ------------------------------------ | -----------------------: | --------------------------: |
| documents                            |                      999 |                       1,022 |
| range                                |                 1 … 1009 |                 1194 … 2395 |
| **absent from CFS inside the range** | **10 (0.99%)** in 8 runs | **180 (14.98%)** in 93 runs |
| duplicated numbers                   |                    **0** |                       **0** |
| digit width                          |                      1–4 |                           4 |

⚠️ **"Absent from CFS" is not "never issued."** Xero frees an `InvoiceNumber` when its holder is
VOIDED or DELETED (workspace `CLAUDE.md`), and this probe reads CFS's own store. A hole is a number
CFS does not hold today, which is a weaker claim than a hole in the issued sequence.

### ⭐ The finding that reframes the question: the gapping STOPPED

A 14.98% gap rate reads as a problem to fix. **Bucketed by hundred it is almost entirely inherited,
and current practice is already effectively gapless:**

| block |       absent |   | block     |     absent |
| ----- | -----------: | - | --------- | ---------: |
| 1100s |    5/6 (83%) |   | 1800s     | 7/100 (7%) |
| 1200s | 58/100 (58%) |   | 1900s     | 2/100 (2%) |
| 1300s | 29/100 (29%) |   | **2000s** |  **0/100** |
| 1400s | 23/100 (23%) |   | **2100s** |  **1/100** |
| 1500s | 26/100 (26%) |   | **2200s** |  **1/100** |
| 1600s | 15/100 (15%) |   | **2300s** |   **0/96** |
| 1700s | 13/100 (13%) |   |           |            |

⇒ **2 absent numbers in the most recent 396 — 0.51%.** The sequence began at 1194 (inherited from
whatever preceded it), gapped heavily through the early years, and has been essentially continuous
since. **Nobody decided that; it is what the current writer does.**

⇒ **So "make it gapless" is not a migration of a broken sequence. It is writing down a property the
system has already drifted into, and building the thing that makes it hold.** That is a much smaller
change than the headline 15% suggests, and it is worth knowing before pricing it.

### ⚠️ And "sortable" is the want that is already broken

**173 of 1,021 adjacent invoice pairs (16.94%) are INVERTED** — a higher number carrying an earlier
`date`, worst gap **408 days**.

That is not a defect. `invoice.date` is the **accounting date**, which an operator may legitimately
back-date; the number tracks **creation order**. They are different clocks, and this repo already
has a rule about exactly that pair (`CLAUDE.md` rule 8: accounting date and posting timestamp are
always distinct fields, never conflated).

⇒ ⭐ **"Sortable" is ambiguous, and the ambiguity is the decision.** Sortable by _issue order_ and
sortable by _accounting date_ are different requirements, **one monotonic sequence cannot satisfy
both**, and the incumbent silently chose issue order. Any proposal has to say which one it means.

### The contention question, answered with the rate

Owner: _"i dont think the contention/hot doc is huge problem."_ **Measured, and the intuition is
right by orders of magnitude.** Invoices by year: 2023:102 · 2024:252 · 2025:460 · 2026:208 (through
August). Peak year 2025 = **1.26 invoices/day**. Orders are ~999 over the same corpus.

⇒ A single monotonic counter at ~1.3 increments/day has no contention problem. **The hot-document
argument against gapless numbering is a high-throughput argument, and CFS is not a high-throughput
business.** ⚠️ **The cost that survives is not throughput — it is what happens on FAILURE**, which
is what §2 is about.

## 2. The six references

### GAAP and the Illinois statute — the finding is an ABSENCE, from a primary source

The Illinois Department of Revenue's own records guidance enumerates what a retailer must keep —
_"records of all sales, leases, or rentals and purchases you make"_, _"accounts receivable
records"_, _"the cash register tapes and other data that provide a daily record of the gross amount
of sales, leases, or rentals"_, _"a yearly inventory of the value of the stock on hand"_ — and **no
numbering requirement is present.** Nothing mandates a sequential, gapless, or particularly-shaped
invoice number.
(`tax.illinois.gov/research/publications/pubs/retailers-overview-of-sales-and-use-tax/keeping-complete-and-accurate-records.html`)

⚠️ **Scope of that negative, stated so it is not over-read.** It is the Department's own guidance
page, read in full for numbering language. It is **not** an exhaustive read of 86 Ill. Adm. Code
Subpart H §§130.801–825, and it says nothing about federal or non-tax obligations. ⇒ **no numbering
mandate was FOUND for CFS; that is weaker than "none exists".**

⇒ **CFS is in the jurisdiction where gaplessness is a CONTROL, not a law.** That matters because
every vendor feature below exists to serve jurisdictions where it _is_ a law.

### Oracle Fusion — what gaplessness is FOR, and what it costs

> "The purpose of gapless document sequencing functionality is to uniquely identify a fiscal
> document, which is a requirement of bookkeeping legislation and global standards in many
> countries. This requirement mandates the ability for each accounting posting of a fiscal document
> to support an audit trail back to the original document or transaction."

> "The document sequencing functionality is optional in the system and as mentioned can be
> configured at a country or country set of books level, and is only applied to specific documents."

⭐ **And the cost is stated as a UX consequence rather than a performance one:**

> "will use an asynchronous process to determine the next sequence number. The document will be put
> in a new status of Processing while this asynchronous process is working."

⇒ **The document does not get its number synchronously.** That is the real price of a guarantee, and
it is invisible in a throughput argument.
(`docs.oracle.com/cd/E76310_01/pdf/2212010/html/implementation_guide/gaplessdocument-sequences.htm`)

### NetSuite — THREE numbers, and the gapless ones are not the readable one

> "Auto-generated transaction numbers are internal, gapless, and can't be changed."

> "**Allow Override** - Check this box to enter your own name or number on records."

> "To ensure that no duplicate transaction numbers are used, clear the box in the **Allow Override**
> column for each transaction."

> "**Minimum Digits** - Enter the minimum number of digits for your auto-generated numbers, from
> 0-20. For example, if you enter **4**, your first record is 0001."

And separately, a **third** number:

> "The GL Audit Numbering feature applies gapless numbering sequences to all general ledger posting
> transactions." "Gapless GL audit numbering enables companies to meet international compliance
> requirements." "GL Audit Numbering is independent of other auto generated numbering you have set
> up at Setup > Company > Auto-Generated Numbers." "When you run a permanent GL audit numbering
> sequence, the number assigned to a general ledger impacting transaction can't be changed."
> "Transactions that don't post until they're approved including commission, journal entries,
> expense reports, and vendor bills (These transactions are included in GL audit numbering only
> after they're approved.)"

⇒ ⭐⭐ **This is the sharpest result in the survey.** NetSuite carries an internal gapless
transaction number, a user-facing **overridable** document number, and a gapless **GL audit** number
— and the last is assigned **only after the transaction posts**. **The number humans read is the one
NetSuite declines to make gapless.** (`docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/` —
`bridgehead_4340444343`, `subsect_0404032958`, `section_N547392`, `section_3735573963`)

### SAP — internal vs external, and the fiscal-year choice

> "Internal Numbering: Under this system, SAP S/4HANA keeps a record of the last document number
> generated by the customized number range in the _Current Number_ field." "External Number
> Assignment: This numbering method allows the user to manually input the original document number,
> or it can be transferred from another system." "It's important to note that the numbering can be
> alphanumeric." (external assignment) "Continuity: With the beginning of a new fiscal year, SAP
> S/4HANA continues the numbering from where it had previously left off (the current number) for the
> next sequence." "Annual Basis: In this option, SAP S/4HANA resets to the first number in the range
> at the start of every new fiscal year."

⇒ SAP makes **continuous vs annual-reset a configuration choice per document type**, and confines
alphanumerics to externally-assigned numbers. Gaps are **NOT PRESENT** on the page read.
(`learning.sap.com/courses/detailing-configuration-of-r2r-posting-processes/managing-document-numbering`)

⚠️ **An unverified pointer, recorded as one.** Search results repeatedly name report **`RFBNUM00`**
as SAP's tool for finding gaps in document number assignment, and describe documenting existing gaps
for audit. **The primary page 403'd and the claim is NOT established here.** If it holds it is the
strongest evidence in the survey that even SAP treats gaps as a thing to _explain_ rather than
_prevent_ — which is worth going and confirming before anyone leans on it.

### Sage Intacct — a format grammar, and the sequence freezes

> "You can use document sequencing to generate new IDs automatically for common transactions and
> records, such as new customers, vendors, invoices, and more." "Fixed prefix, Separators, Fixed
> suffix" — "Characters that appear before, in between, and after the primary sequence." "Numeric
> sequence length" — "The total length of the primary numeric sequence that includes the leading
> zeroes." "After you **Save**, you can no longer change this sequence"

⇒ The shape everyone converges on is **`<prefix><separator><zero-padded counter>`**, and Intacct
makes the sequence immutable once created. Gaps: **NOT PRESENT** on the page read.
(`intacct.com/ia/docs/en_US/help_action/Company/Document_numbering/document-sequences-for-ids.htm`)

### Odoo — the year is in the number, and gaps are SURFACED rather than prevented

> "By default, it uses the sequence format `INV/year/incrementing-number` (e.g., `INV/2025/00001`),
> which restarts from `00001` each year." "If there are any irregularities in the new sequence, such
> as gaps, cancelled, or deleted entries within the open period, a Gaps in the sequence message
> appears..." "To view more details about the related invoice(s), click Gaps in the sequence. This
> visual marker is temporary and will disappear once the entry's accounting date is on or after the
> lock date."

⇒ **Odoo's default answer to gaps is a WARNING BADGE, not a guarantee** — and the badge is scoped to
the open period, disappearing once the entry is behind the lock date. A guarantee of gaplessness is
**NOT PRESENT** on that page.
(`odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/sequence.html`)

### Xero — the incumbent, read from CFS's own corpus

⚠️ `central.xero.com` timed out on two fetch attempts, so nothing is quoted from it. By house rule
Xero is researched from documentation **and from CFS data already mirrored into Firestore**, and the
mirrored half is §1 above: **prefix-free 4-digit integers, 0 duplicates, 180 historical holes, 2 in
the last 396.**

Two Xero facts this repo already holds, dated and verified (workspace `CLAUDE.md`):

- **`InvoiceNumber` is Xero's idempotency key.** `POST /Invoices` is `updateOrCreateInvoices` and
  **matches on `InvoiceNumber`**; `PUT` does not check it and will mint a duplicate. ⇒ **the number
  is load-bearing machinery today, not only a label.**
- **Xero frees a number once its holder is VOIDED or DELETED**, which is why prod holds four
  duplicate-number pairs each with a dead partner. ⇒ **Xero's own model permits reuse**, which is
  the opposite of a gapless guarantee.

## 3. What the references agree on — the CRITERION, not the default

The defaults split (NetSuite and Oracle offer gapless; Odoo warns; Intacct and SAP are silent).
**The line they all draw is the same one**, and it is more useful than any default:

⭐ **GAPLESSNESS ATTACHES TO THE POSTING ACT, NEVER TO THE DRAFT — and never to the number a human
reads.** NetSuite's gapless number is minted when the transaction posts (and only after approval);
Oracle's is minted asynchronously at the fiscal-document level; Odoo's gaps come from numbering a
draft that is later deleted. **The failure mode every one of them is avoiding is the same: a number
consumed by a document that never became a document.**

⇒ Applied to CFS, that is not a numbering scheme — it is a question about **when** the number is
minted, and this repo already has the vocabulary for it: `ADR-0022` decomposed invoice status, and
`ADR-0014` derives lifecycle rather than assigning it. **A number minted at ISSUE rather than at
CREATE is gapless almost for free**, because nothing is discarded after it has been numbered.

⚠️ **And that is exactly what CFS's own bucket table shows already happening**, without anyone
having decided it. The early gapping is consistent with numbering-at-create; the recent continuity
is consistent with numbering closer to the issue act.

## 4. What is NOT established

- **Why the recent gaps stopped.** The correlation is measured; the writer change that caused it is
  not identified. ⚠️ **Two absent numbers in the last 396 could be voids in Xero rather than gaps at
  all**, and this probe cannot tell those apart — it reads CFS only.
- **What the 180 historical holes ARE.** Void, deleted, issued-in-another-system, or never-issued.
  Distinguishing them needs the Xero side, which this repo must not call.
- **Whether the order number and the invoice number should share a scheme.** They have different
  populations (1,009 vs 2,395), different digit widths, and only one of them is an accounting
  document.
- **What a customer-visible number change costs.** An invoice number is known to Xero, to CRMS and
  to **customers**; `migration/field-map.yaml` already commits that the migration carries each
  counter's high-water mark forward so v2 does not mint a number that already means something else.
  **A format change is a different act from a counter carry-forward**, and nothing has priced it.
- **`RFBNUM00`**, above.

## 5. What this owes

- ⇒ **An `OQ-`**, because a decision is required and nobody has made it: the scheme, and — the
  sharper half — **which clock "sortable" means** and **at which lifecycle act the number is
  minted.**
- ⚠️ **Accounting-shaped under rule 8a.** Any answering ADR needs this survey cited, and it is the
  reason this note exists before any ADR does.
- It sits inside **`OQ-058`** (identity for v2 domain entities), which already asks _"what happens
  to the business identifiers (SKU, order number, invoice number) that people actually use to refer
  to things"_. **This is the numbering half of that question, and it is separable** — a scheme can
  be chosen without settling opaque-id policy for every entity.
