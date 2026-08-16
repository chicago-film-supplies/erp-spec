---
kind: research
title: Survey — five of six references put the customer on the SUBLEDGER and dimensions on the GL, and Odoo shows they ride different legs of the same entry; so a settlement point is not a third dimension, and counting it exposes that ADR-0018 put dimensions in a `user_data` budget that has no room for them
contexts: [ledger, billing]
source: GAAP control-account/subsidiary-ledger doctrine · Xero Central (tracking categories, aged receivables by contact) · SAP reconciliation accounts (SAP Press, ERProof, SAP Help) · Oracle NetSuite Applications Suite (Segments, Configuring GL Impact for a Custom Segment) · Sage Intacct (Types of dimensions) · Odoo 18/19 analytic accounting + account.move.line partner_id; read against ledger/dimensions.yaml, ADR-0008, ADR-0018, ADR-0025, research-drop/reference/tigerbeetle.md and erp-spec#3
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveys **OQ-040** — is `settlement_point` a declared ledger dimension, or a document attribute the
read side joins to? Required before ADR-0033 can be accepted, and required by CLAUDE.md →
_Accounting decisions_ because "where something posts" is exactly what that rule covers.

The survey answers the question. It also turned up a contradiction that is larger than the question,
recorded separately as **HOT-013**.

## The six

### GAAP — customer detail is explicitly NOT in the general ledger

The control-account / subsidiary-ledger doctrine is unambiguous and is the oldest answer here:
_subsidiary ledger accounts are **not part of the general ledger** — they are supplemental accounts
providing the detail behind a control account_. The AR subsidiary ledger holds one account per
customer; the GL holds one Accounts Receivable control account. **Individual customer detail does
not appear in the trial balance**; only the control total does. The reconciliation obligation is
that the sum of the subsidiary accounts equals the control account.

So under GAAP, "what does each department owe" is a **subledger** question by construction, and
answering it does not require the general ledger to be sliced by anything.

### Xero — the incumbent, and it keeps contact and tracking category apart on purpose

Xero permits at most **four tracking categories, of which only two may be active** — and CFS's two
are already fully consumed (OQ-035). **Contact is not one of them.** It is a separate grouping
option on reports: aged receivables is a by-contact report, and tracking categories are an
independent axis you may additionally group by.

The incumbent therefore already separates the two mechanisms, and CFS's aging has never depended on
a tracking category.

### SAP — the GL never sees the customer list

_"In GL you will not have the list of vendors but a few reconciliation accounts."_ Postings go to a
subledger customer account and update a linked **reconciliation account** in the GL. Reconciliation
accounts appear on the financial statements; the individual subledger accounts do not.

SAP has a rich dimension mechanism (profit centre, segment, WBS) and **the customer is not part of
it** — it is master data on the line, resolved through the reconciliation account.

### NetSuite — the dimension mechanism is segments, and GL impact is an explicit opt-in

Class, Department and Location are the standard classifications; Custom Segments create more of the
same kind. Critically, _"by default a custom segment does not affect GL unless the GL Impact box is
enabled"_, and when it is, the segment _"becomes a first-class financial dimension just like Class
or Department."_

**Customer is not a segment.** It is the transaction's entity field. NetSuite makes the
dimension/non-dimension boundary an explicit configuration flag, and the customer sits outside it.

### Sage Intacct — the dissent, and it is informative rather than wrong

Intacct's standard dimensions are Location, Department, Project, **Customer**, Vendor, Employee,
Item and Class. So one reference of six **does** make the customer a first-class dimension.

Worth reading carefully rather than discounting: Intacct's dimension framework is its _general
reporting substrate for everything_, so making Customer a dimension is how Intacct produces
customer-sliced **P&L** — not how it produces aging. Aging still comes from AR. The dissent is about
what else you get, not about where the receivable detail lives.

### Odoo — the sharpest finding in the survey: they ride DIFFERENT LEGS

`partner_id` on `account.move.line` "links to the customer for aging and reconciliation… essential
for receivable/payable account lines". `analytic_distribution` is the separate dimension mechanism.

And the mechanism that makes the distinction visible: for the Partner Ledger report, _"where
**receivable/payable lines rarely carry analytic data directly**, the module automatically looks up
the analytic distribution from the counterpart income/expense lines of the same journal entry."_

**The party is on the receivable leg. The dimension is on the revenue/expense leg. Same journal
entry, different lines.** A report wanting both has to join across the entry — which is precisely
what a third-party module had to be written to do.

## What the survey settles

| Reference    | Customer/party lives            | Dimension mechanism                       | Same field? |
| ------------ | ------------------------------- | ----------------------------------------- | ----------- |
| **GAAP**     | AR **subsidiary ledger**        | n/a — not in the trial balance at all     | **no**      |
| **Xero**     | contact, a report grouping      | tracking categories (2 active, both used) | **no**      |
| **SAP**      | subledger + reconciliation acct | profit centre / segment / WBS             | **no**      |
| **NetSuite** | transaction entity field        | segments, GL-impact an opt-in flag        | **no**      |
| **Intacct**  | **a standard dimension**        | the same dimension framework              | **yes**     |
| **Odoo**     | `partner_id`, receivable leg    | `analytic_distribution`, P&L legs         | **no**      |

**THE CRITERION: is the question answered from a TRIAL BALANCE or from a SUBLEDGER?** A dimension
slices the P&L and shows up in a dimensional trial balance. A party drives aging, statements and
dunning, which are subsidiary-ledger reports that GAAP says are _not_ in the trial balance. The two
mechanisms answer different questions, and five of six references keep them structurally apart.

## Recommendation for OQ-040

**A settlement point is a SUBLEDGER KEY on the receivable-bearing leg, not a third declared
dimension.** `ledger/dimensions.yaml` stays at two.

- **It already fits the repo's own shape.** `product_line` is `required_on: [revenue, cogs]` and
  `cost_type` on `[labour_cogs]`. **Neither is required on 1200 AR or 2050.** The dimensions and the
  party were already obligations on different accounts — the survey names why.
- **It is what makes ADR-0033's independent check possible, not merely convenient.** That check is
  "sum open invoice amounts grouped by `billed_to.id`, without traversing the tree". That is a
  subledger query. If the party were a GL dimension the check would be a dimensional GL read, which
  is the same machinery as the roll-up it is supposed to be independent of — a guard consulting its
  own oracle.
- **The reconciliation obligation comes free and is the right one**: sum of settlement-point
  balances equals the 1200 control account. That is GAAP's own subsidiary-ledger rule, and it is the
  same assertion ADR-0032 already demands.
- **Intacct's dissent is not ignored, it is scoped.** If CFS later wants a customer-sliced _P&L_ —
  margin by settlement point — that is a dimension question and Intacct is the precedent for
  answering it that way. It is not this question, and it is not needed for aging.

⚠️ **What this recommendation does NOT resolve:** where the party key physically lives on a
TigerBeetle transfer. See below — the answer is currently unrepresentable, and not because of
settlement point.

## ⚠️ The larger finding: ADR-0018 put dimensions somewhere with no room for them

Counting claimants to see whether a third dimension would fit produced a contradiction that exists
**without** it.

**In TigerBeetle one transfer is one debit account plus one credit account.** So `invoice_issued`
(Dr 1200 AR / Cr 4100 Revenue) is a single transfer whose debit side wants a settlement point and
whose credit side wants a product line — the same transfer, two obligations. Odoo splits these onto
two lines; TigerBeetle's model does not offer that split.

A transfer has exactly three discretionary reference fields. Claimants:

| # | Claimant           | Asserted by                                             |
| - | ------------------ | ------------------------------------------------------- |
| 1 | `journal_entry_id` | erp-spec#3, `research-drop/reference/tigerbeetle.md`    |
| 2 | `source_document`  | same                                                    |
| 3 | `accounting_date`  | same — packed `YYYYMMDD` in `user_data_32`              |
| 4 | `posting_rule`     | **already evicted** to the Mongo projection             |
| 5 | `product_line`     | **ADR-0018** — "carried on the posting, in `user_data`" |
| 6 | `cost_type`        | **ADR-0018** — same sentence                            |
| 7 | `settlement_point` | this survey, if it were a dimension                     |

**Three slots. Six live claimants before settlement point is considered at all.**

erp-spec#3 is titled _"three fields, four claimants"_ and enumerates 1–4. **It never counted 5 and
6.** ADR-0008 reserved all three `user_data` fields in a world where dimensions lived in _account
identity_ and `user_data` was therefore free for high-cardinality references. ADR-0018 superseded
ADR-0008 and moved dimensions onto the posting — **without re-doing the budget that assumption had
made safe.**

`ledger/dimensions.yaml` records the cost of ADR-0018 accurately in every other respect ("nothing
structural catches a missing one… the rejection vectors are the entire enforcement") and does not
notice this one.

**Recorded as HOT-013 rather than resolved here**, per CLAUDE.md rule 5 — two spec statements
contradict and picking one silently is forbidden. Two readings of ADR-0018's sentence are possible
and the ambiguity is itself load-bearing: whether TigerBeetle carries dimensions decides whether a
dimensional P&L can be rebuilt from the ledger alone after a Mongo loss.

⚠️ **And ADR-0018 is `accepted`, therefore immutable** — so this lands on exactly the unresolved
meta-question **HOT-012** already poses: what happens when an accepted ADR needs correcting. HOT-013
is the second instance, which is itself an argument for settling HOT-012.

## Sources

- [Subsidiary Ledgers — Accounting Principles I (CliffsNotes)](https://www.cliffsnotes.com/study-guides/accounting/accounting-principles-i/subsidiary-ledgers-and-special-journals/subsidiary-ledgers)
- [General ledger vs subsidiary ledger — Universal CPA Review](https://www.universalcpareview.com/ask-joey/what-is-the-difference-between-the-general-ledger-and-subsidiary-ledger/)
- [Accounts receivable subsidiary ledger — Chaser](https://www.chaserhq.com/blog/accounts-receivable-subsidiary-ledger)
- [Xero Central — set up tracking categories and options](https://central.xero.com/0/article/Set-up-tracking-categories)
- [Xero — aged receivables by contact](https://www.accon.services/xero-report-aged-receivables-by-contact.html)
- [Reconciliation Accounts in SAP S/4HANA — SAP Press](https://blog.sap-press.com/reconciliation-accounts-in-sap-s4hana)
- [What is SAP Reconciliation Account? — ERProof](https://erproof.com/sap-reconciliation-account/)
- [SAP Help — Reconciliation of General Ledger and Subledgers](https://help.sap.com/docs/SAP_BUSINESS_BYDESIGN/2754875d2d2a403f95e58a41a9c7d6de/2c27f391722d1014bc1de4a00360e714.html)
- [NetSuite — Segments](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_1542227070.html)
- [NetSuite — Configuring GL Impact for a Custom Segment](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4385199949.html)
- [Sage Intacct — Types of dimensions](https://www.intacct.com/ia/docs/en_US/help_action/Reporting/Dimensions/Dimension_basics/types-of-dimensions.htm)
- [Odoo 18 — Analytic accounting](https://www.odoo.com/documentation/18.0/applications/finance/accounting/reporting/analytic_accounting.html)
- [Odoo — the account.move.line model](https://www.dasolo.ai/blog/odoo-data-api-5/odoo-account-move-line-model-guide-156)
- [Odoo Apps — Analytic Distribution in Accounting Reports (partner ledger fetches analytics from counterpart lines)](https://apps.odoo.com/apps/modules/19.0/account_reports_analytic_distribution)
