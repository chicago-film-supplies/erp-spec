---
kind: research
title: Survey — every one of six references keeps the analytical dimension in the same durable store as the balance-bearing amount, five of six on the posting line itself, and SAP moved TO that shape on purpose; the criterion is whether the dimensional statement is reproducible from the accounting record alone, which is the one test CFS's two-store split can fail
contexts: [ledger]
source: "US GAAP ASC 280 (FASB, PwC Viewpoint, Deloitte DART, RSM, BDO) · Xero Accounting API Journals endpoint (TrackingCategories on JournalLine) + Xero Central tracking categories · SAP S/4HANA Universal Journal / ACDOCA (SAP Press, SAP Help Portal) · Oracle NetSuite Segments + Configuring GL Impact for a Custom Segment · Sage Intacct Dimensions overview + GL Detail API · Odoo 18/19 analytic accounting; read against ADR-0018, ADR-0017, ADR-0025, ADR-0003, ledger/dimensions.yaml, ledger/tigerbeetle-accounts.yaml"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveys **HOT-013** — ADR-0018 says dimensions are "carried on the posting, in `user_data` and in
the Mongo/Parquet projection", and the `user_data` half is unrepresentable. The question the new
narrow ADR has to answer:

> **Does the balance-bearing record itself carry the dimension, or is the dimensional view a
> separate structure?**

Required by CLAUDE.md → _Accounting decisions_: "where something posts" and "how two books relate"
both apply. Distinct from the 2026-08-16 party-versus-dimension survey, which asked _which axis a
value is_; this asks _which record physically holds it_.

## The six

### GAAP — requires the reconciliation, never the mechanism

ASC 280 is a **disclosure** standard on the **management approach**: segment information is reported
as the CODM actually reviews it, including whatever allocations and eliminations management makes.
It mandates reconciliation of segment revenue, profit or loss, assets and other significant items to
the consolidated totals — and **the presentation and format of the reconciliation is not
prescribed**.

So GAAP imposes **no requirement that the general ledger be dimensioned at all**. What it requires
is that the dimensional statement _tie to_ the audited totals. That is a constraint on the
relationship between the two, not on where the dimension is stored — and it is the reason a
projection-only design is not a GAAP violation.

⚠️ Read the other way round, this is the sharpest thing GAAP says here: **the obligation is a tie-
out.** A dimensional P&L that cannot be reconciled to the trial balance is the failure mode, and
that is a property of the two records agreeing, which is exactly what a second store puts at risk.

### Xero — the incumbent, and it puts tracking in the immutable journal

Tracking categories are not a report-time overlay. They ride on the **journal line**: the Accounting
API's `Journals` endpoint — Xero's immutable accounting journal, the record behind the trial balance
— returns `TrackingCategories` per `JournalLine`, and manual journals accept `Tracking` per line on
write.

**Migration delta: the incumbent already satisfies the strong reading.** CFS's books today hold the
product line inside the accounting record itself, one durable store, no join. Any design where the
dimension lives only outside the ledger is a **departure from the incumbent**, not a continuation of
it — and ADR-0001 replaces Xero, so that delta is carried across history rather than merely
designed.

### SAP S/4HANA — the reference that changed its mind, toward the posting

The Universal Journal (`ACDOCA`) is the single line-item table that **merged FI and CO**. Every
dimension is a column on the journal line: cost centre, profit centre, segment, functional area,
trading partner, plus the Margin Analysis characteristics — up to sixty, in a table of ~511 fields.

The history is the finding. In ECC, controlling detail lived in a **parallel document** alongside
the FI document, and reconciliation between them was a standing operational burden. S/4HANA's
central architectural act was to collapse that into one line. **SAP had the split, paid for it, and
deliberately removed it.** No other reference in the set states the cost of a parallel structure
from experience.

### NetSuite — the boundary is an explicit, per-segment flag

Class, Department and Location are standard; Custom Segments create more. **A custom segment does
not affect the GL unless the GL Impact box is enabled**, and once enabled it "becomes a first-class
financial dimension just like Class or Department".

NetSuite is the reference that makes "is this dimension _in_ the ledger" an explicit configuration
decision rather than an emergent one — and the affirmative case puts the value on the GL transaction
line.

### Sage Intacct — dimensions are on the transaction line and travel into the GL

Dimension values are selected on transaction entry, **propagate to the general ledger**, and are
committed with the entry as permanent accounting detail readable through the GL Detail API. The
dimension framework _is_ Intacct's general reporting substrate, and it is populated from the posting
rather than joined at report time.

### Odoo — the dissent, and it is the informative one

Analytic accounting is a **parallel ledger**: `analytic_distribution` on `account.move.line` spawns
`account.analytic.line` records that are explicitly **not double-entry** and are "linked to general
accounts but treated totally independently".

This is the only reference that separates the records — and its documented consequences are the cost
of doing so:

- Analytic lines do not balance and are not part of the trial balance, so there is no structural
  tie-out; agreement is a convention.
- Receivable/payable lines "rarely carry analytic data directly", so the Partner Ledger report needs
  a third-party module that reaches across to the counterpart income/expense lines.
- The distribution is a _model_ applied at posting time; re-running it restates the analytic view
  without touching the GL.

Odoo's absence-of-integration is exactly the informative case CLAUDE.md says to look for: the
workarounds published around it measure what the split costs.

## What the survey settles

| Reference    | Dimension lives                                   | Same record as the amount? | Same durable store? |
| ------------ | ------------------------------------------------- | -------------------------- | ------------------- |
| **GAAP**     | unspecified — only the tie-out is mandated        | n/a                        | n/a                 |
| **Xero**     | `TrackingCategories` on the journal line          | **yes**                    | **yes**             |
| **SAP**      | columns on `ACDOCA`, after merging FI + CO        | **yes** (deliberately)     | **yes**             |
| **NetSuite** | GL transaction line, behind a GL-Impact flag      | **yes** (opt-in)           | **yes**             |
| **Intacct**  | transaction line, propagated into the GL          | **yes**                    | **yes**             |
| **Odoo**     | `account.analytic.line`, a parallel non-DE ledger | **no**                     | **yes** (one DB)    |

**Five of six put the dimension on the posting line. Six of six keep it in the same durable store as
the balance.** Not one answers a dimensional question by joining to a structure that can be lost
independently of the ledger — Odoo splits the _record_ and still holds both halves in one Postgres
database.

**THE CRITERION — and it is not "on the line":** _can the dimensional statement be reproduced from
the accounting record alone?_ Every reference passes, by different means: Xero/SAP/NetSuite/Intacct
because the value is on the line; Odoo because both structures share one database and one backup.
"On the same line" is how five of them happen to achieve it, and SAP's ECC→S/4 move shows the split
version is workable but costly. **The store boundary is the thing the survey actually agrees on.**

⚠️ **No reference faces CFS's shape.** All six are single-store. ADR-0003 splits the accounting
record across **two stores with different failure domains** — TigerBeetle for balance integrity,
MongoDB for the document and the projection. So CFS is the first case in the set where "same record"
and "same store" come apart, and the survey's unanimous property is the one CFS's architecture can
fail. That is not an argument that the references settle the question; it is the reason the question
is a hotspot.

## Recommendation

**Carry both dimensions on the TigerBeetle transfer, in `Transfer.code` as a packed (`product_line`,
`cost_type`) pair.** Draft the narrow ADR that way, `relates_to: [ADR-0018]`, superseding nothing.

- **It satisfies the one property all six references share** without departing from ADR-0018's
  decision, which it merely completes: the sentence "in `user_data` and in the Mongo/Parquet
  projection" becomes "on the transfer and in the projection", and the plain-COA decision is
  untouched.
- **It is representable and cheap.** The payload is 84 combinations — 7 bits of a u16, 9 spare; no
  posting rule dimensions both legs; only account 5800 owes both dimensions. Measured, dated
  2026-08-16, in the companion note.
- **It preserves the incumbent's guarantee rather than regressing from it.** Xero holds the product
  line in the accounting record today. Projection-only would be the first time CFS's books could
  lose their dimensional history to a non-ledger failure.
- **ADR-0017 already argued for this and stopped one step short**: "Lose it and balances rebuild
  from TigerBeetle but periods do not — unless TigerBeetle carries the accounting date. So this
  decision _strengthens_ the case for accounting-date-in-`user_data`." The identical argument
  applies to dimensions and was not made, because the field budget looked full.
- **GAAP's tie-out obligation is better served.** With the dimension in both stores, "recompute the
  dimensional P&L from TigerBeetle and compare to the projection" is a real check that can fail —
  the repo's own rule against a guard that consults only its own oracle. Projection-only makes the
  dimensional P&L unfalsifiable against the ledger.

**Costs, stated plainly:**

- **`code` loses its conventional occupant.** Raw TigerBeetle data would no longer say which posting
  rule produced a transfer. `posting_rule` is already evicted to Mongo for unrelated reasons, so
  nothing regresses — but debuggability of the raw ledger does get worse, and 9 spare bits are not
  enough for 13 rules plus 84 combinations if that is later regretted (11 bits needed; it fits, but
  then the equality filter answers only the composite).
- **A packed integer is type-checked by nothing.** Same defect shape as the `YYYYMMDD` warning
  already in erp-spec#3 and the Typesense `money` boolean that shipped 100×-wrong money in both
  environments. **This needs a golden vector asserting the packed value**, not merely a declaration
  that the encoding exists.
- **Two stores now both hold the dimension, so they can disagree.** That is the price of the tie-out
  being checkable at all — an unfalsifiable projection cannot disagree either.

## Sources

- [FASB ASC 280 Segment Reporting](https://asc.fasb.org/layoutComponents/getPdf?isSitesBucket=false&fileName=GUID-035C438F-6CBD-4AB0-8286-1304711C8675.pdf)
- [PwC Viewpoint 25.7 — Segment disclosures](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/financial_statement_/financial_statement___18_US/chapter_25_segment_r_US/257_disclosures_US.html)
- [Deloitte DART 4.4 — Measurement of Segment Disclosures](https://dart.deloitte.com/USDART/home/codification/presentation/asc280-10/roadmap-segment-reporting/chapter-4-disclosure-requirements/4-4-measurement-segment-disclosures)
- [BDO — Segment Reporting Under ASC 280](https://arch.bdo.com/Segment-Reporting-Under-ASC-280)
- [RSM — Expanded Reportable Segment Disclosures (2024)](https://rsmus.com/content/dam/rsm/insights/financial-reporting/1pdf/Expanded-Reportable-Segment-Disclosures.pdf)
- [Xero Accounting API — Journals](https://xeroapi.github.io/xero-node/accounting/index.html)
- [Xero Central — Set up tracking categories](https://central.xero.com/0/article/Set-up-tracking-categories)
- [XeroAPI/Xero-NetStandard #350 — tracking categories on manual journal lines](https://github.com/XeroAPI/Xero-NetStandard/issues/350)
- [SAP Press — What Is SAP's Universal Journal?](https://blog.sap-press.com/what-is-saps-universal-journal)
- [SAP Help Portal — Universal Journal Entry (ACDOCA)](https://help.sap.com/docs/SAP_PROFITABILITY_PERFORMANCE_MANAGEMENT/7fa13890d47b4c69bbb62175e84e4aa8/dfc57fb640314d1390871ec844017fda.html)
- [Universal Journal in SAP S/4HANA — a master guide](https://s4hanaguide.com/universal-journal-in-sap-s4hana/)
- [NetSuite — Segments](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1542227070.html)
- [NetSuite — Configuring GL Impact for a Custom Segment](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4385199949.html)
- [Sage Intacct — Dimensions overview](https://www.intacct.com/ia/docs/en_GB/help_action/Intacct_basics/Dimensions/basics-dimensions-overview.htm)
- [Sage Intacct Developer — General Ledger Detail](https://developer.intacct.com/api/general-ledger/general-ledger-detail/)
- [Odoo 19 — Analytic accounting](https://www.odoo.com/documentation/19.0/applications/finance/accounting/reporting/analytic_accounting.html)
- [Odoo Apps — Analytic Distribution in Accounting Reports](https://apps.odoo.com/apps/modules/19.0/account_reports_analytic_distribution)
