---
kind: research
title: Survey — all six references snapshot a classification onto the posting; none joins to the master at report time, and each pairs the snapshot with a NAMED retroactive-change operation
contexts: [ledger, billing, ordering]
source: "GAAP ASC 280 (ASU 2023-07) · Xero tracking-category docs + CFS Firestore data · SAP S/4HANA CO-PA derivation + realignment · NetSuite master-value copy · Sage Intacct dimensions · Odoo analytic distribution — links inline, surveyed 2026-08-10"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Run for the proposed **production-type** classification
(`studio | indie | corporate/commercial/industrial |
event | student`), which the owner initially
framed as a _joinable attribute on the job_ rather than a posting dimension. The survey reframes the
question, so it is recorded before any ADR cites it (CLAUDE.md → _Accounting decisions_).

## The question as asked, and why it is the wrong axis

> Is a classification a **posting dimension** (frozen on the posting) or a **masterfile attribute**
> joined at report time?

**Not one of the six joins to the master at report time.** All six snapshot the value onto the
transaction. So the axis that actually divides them is not storage — it is:

> **What happens when the master's value changes afterwards?**

## The six

|                      | Mechanism                                                                                                                                   | Retroactive change                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**             | ASC 280 segment reporting                                                                                                                   | **Recast** prior periods, and **disclose that you recast**. ASU 2023-07 deliberately replaced "restate" with "recast" to keep it distinct from error correction under ASC 250.           |
| **Xero** (incumbent) | Tracking option, on the transaction line                                                                                                    | None. No realignment tool; history is what it is. **Hard cap of 2 active tracking categories**, ~100 options each.                                                                       |
| **SAP S/4HANA**      | CO-PA **characteristic derivation** at posting time; the as-posted view is retained in a dedicated Universal Journal table                  | **Realignment** — a named, run, auditable job that applies changed master data or changed derivation rules to already-posted data. Available for account-based CO-PA since S/4HANA 1610. |
| **NetSuite**         | Copies selected master values (customer's class, department, location, terms, address) onto the transaction at entry                        | Weakest of the four. Docs warn that removing a master reference destroys the roll-up key and makes historical transactions "appear to be from unrelated customers".                      |
| **Sage Intacct**     | Dimensions applied independently **per transaction line**                                                                                   | Dimension groups/structures are a reporting overlay over posted values.                                                                                                                  |
| **Odoo**             | Analytic distribution on the **journal item**; **analytic distribution models** derive it from account prefix, partner and partner category | Cannot edit distribution on a confirmed invoice — you must go to Journal Items and bulk-edit underneath. A documented workaround, which is a measurement of what the default costs.      |

## The CRITERION

**A classification is snapshotted at the moment of posting, and changing it retroactively is a named
operation with an audit trail — never a side effect of editing a master record.**

The reason is uniform across all six: **the master's value is "now"; a report is about "then".** A
live join silently rewrites history every time somebody corrects a customer record, and nobody can
see that it happened.

GAAP states the same thing from the opposite end. It does not forbid retroactive reclassification —
it _requires_ recasting when internal structure changes — but it requires you to **say that you
did**. The disclosure is the point. SAP's realignment job is the mechanical form of exactly that;
Xero's absence of one is why CFS's own history cannot be re-cut today.

## What this changes about the proposal

**"Joinable attribute" is the one option no reference supports.** The instinct behind it is sound —
you will occasionally mistype a production and want to fix it without a migration — but every system
here meets that need with a _realignment operation_, not with a live join, precisely because a live
join cannot be audited.

Note the option is only even available for production type, and not for `product_line`: production
type is constant per order, and ADR-0029 already requires every posting to carry its causal order,
so a join is expressible. `product_line` varies per line and has no other grain to join to.
**Availability is not the argument, though — auditability is.** Joining to a mutable order field
only moves the silent restatement one hop.

## The trap this repo just walked into, and why it does NOT argue against snapshotting

A snapshot of a master attribute onto a transaction is exactly the shape that failed on 2026-08-10:
`items[].tracking_category` is a denormalized copy of the product's category, and it was null on 227
lines (api-cloudrun#473).

**The defect was not that a denorm existed. It was that nothing derived it.** There were two writers
and only one of them populated the field. NetSuite and SAP snapshot the same way and are not broken,
because the copy has exactly one guaranteed writer and the derivation is the system's job rather
than the client's.

So the lesson to carry is narrower than "avoid denormalization":

- **One writer, server-side, no client-supplied value.** The CRMS webhook derived it; the native
  `POST`/`PUT /invoices` path took it from the client on trust. That asymmetry was the whole bug.
- **The snapshot must record what it derived from**, so a realignment can find the population later.
- **Measure the population against the AUTHORITY, not the copy** — the independent-property rule
  this repo already has. A watch pointed at the derived field measures the derivation, not the
  decision.

## Consequence for the org-level default

The owner wants the org to carry a **default** production type ("it will almost always be the
same"). Under this criterion that is safe, and the chain is three snapshots, each with a recorded
provenance:

```
org.default_production_type  →  order.production_type  →  posting.production_type
        (default at order creation)      (derived at posting)
```

Changing the org's default reaches **forwards only**. Correcting one order's type needs a
realignment of that order's postings. Neither silently rewrites a prior period, and both are
visible.

## Migration delta (Xero)

**Nil, and for an unusual reason.** Xero's 2-category cap is already fully consumed by CFS's
existing tracking — there was never room for a third classification, so no production-type history
exists in the incumbent to carry across. This is a capability CFS does not have today rather than
one that changes shape. **The delta is that the cap disappears**, which is an argument for ADR-0001
that had not been made in this form: the incumbent's binding constraint on management reporting is a
hard product limit, not a configuration choice.

## Sources

- GAAP / ASC 280 —
  [Deloitte DART 4.9, restatement of segment data](https://dart.deloitte.com/USDART/home/codification/presentation/asc280-10/roadmap-segment-reporting/chapter-4-disclosure-requirements/4-9-restatement-segment-data-because)
  ·
  [PwC on ASU 2023-07](https://viewpoint.pwc.com/dt/us/en/fasb_financial_accou/asus_fulltext/2023/asu202307/asu202307/asu202307.html)
  ·
  [BDO Blueprint, Segment Reporting under ASC 280 (Dec 2025)](https://arch.bdo.com/getContentAsset/5b49f65f-793a-4768-bbf2-2e79ba6dca68/bb620d56-5e9c-4774-8d17-fb9323eefdf4/Segment-Reporting-Under-ASC-280-BDO-Blueprint-12-2025.pdf?language=en)
- Xero —
  [Tracking category limits (product ideas thread)](https://productideas.xero.com/forums/967124-projects-tracking/suggestions/50517771-tracking-categories-increase-maximum-number-of-a)
  ·
  [xlreporting on the reporting ceiling](https://www.xlreporting.com/blog/report-on-xero-tracking-categories)
- SAP S/4HANA —
  [Characteristic Derivation (SAP Help)](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/5e23dc8fe9be4fd496f8ab556667ea05/71efc554ed0fb209e10000000a423f68.html)
  ·
  [Realignment (SAP Learning)](https://learning.sap.com/courses/profitability-analysis-in-sap-s-4hana/realignment)
  ·
  [Realignments in Account-Based CO-PA, S/4HANA 1610 (SAPinsider)](https://sapinsider.org/articles/you-can-now-do-realignments-in-account-based-co-pa-with-sap-s-4hana-1610/)
- NetSuite —
  [Five NetSuite Effective Dating Patterns for Understanding What Was True (Prolecto, 2026-07)](https://blog.prolecto.com/2026/07/25/five-netsuite-effective-dating-patterns-for-understanding-what-was-true/)
  ·
  [Preserve NetSuite Reporting with Structural Master Record Changes (Prolecto)](https://blog.prolecto.com/2022/07/31/preserve-netsuite-reporting-with-structural-master-record-changes/)
- Sage Intacct —
  [Dimensions overview](https://www.intacct.com/ia/docs/en_US/help_action/Intacct_basics/Dimensions/basics-dimensions-overview.htm)
  ·
  [Dimension groups and structures (CLA)](https://www.claconnect.com/en/resources/blogs/sage/sage-intacct-reports-dimension-groups-and-dimension-structures)
- Odoo —
  [Analytic accounting (18.0 docs)](https://www.odoo.com/documentation/18.0/applications/finance/accounting/reporting/analytic_accounting.html)
  ·
  [Analytic distribution impact on journal items (OCA)](https://odoo-community.org/groups/contributors-15/contributors-181390)

## One more thing the survey turned up, unasked

**Odoo's "analytic distribution model" is the primitive the owner described** — receivers, givers
and distribution rules — already built and documented. It is a rule table keyed on account prefix,
partner and partner category that applies a percentage distribution across analytic accounts. Worth
reading before designing ours from scratch, and worth citing in whatever ADR proposes it.
