---
id: ADR-0020
headline: Xero history is recast, not restated
title: >-
  Xero history is recast, and the product line is derived from the master rather than assigned to
  the line
status: proposed
date: 2026-08-09
review_by: 2026-10-15
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-006, HOT-020, OQ-012, OQ-025, OQ-034, ADR-0018, ADR-0036, ADR-0009]
accounting_shaped: true
survey:
  - inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md
measurements:
  - id: M1
    value: "$231,796.26 — 106 lines, 15.66% of pre-lock revenue"
    of: >-
      Revenue lines untracked in BOTH systems, across all 814 pre-lock invoices at 100% coverage.
      This is the migration delta: the amount by which v2's tracking-sliced view of closed periods
      will differ from Xero's. ⚠️ It is a figure OF the pre-lock corpus, not of the whole corpus —
      M2 is the corpus-wide population and the two are not the same denominator.
    source: "inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md"
  - id: M2
    value: "130 lines / $233,610.63"
    of: >-
      Custom invoice lines with no product master, corpus-wide, re-measured 2026-08-16. **These are
      the lines with nothing to derive from, and they are the whole subject of this decision.**
      ⚠️ Read `128 / $233,667.63` in several places — that is the 2026-08-10 measurement, still
      quoted in `hotspots.yaml` HOT-020 and in the m4 plan. The money is flat; the denominator grew.
    source: "code:2026-08-22:erp-spec@29c7850:ledger/dimensions.yaml"
  - id: M3
    value: "80.04% of invoices, ~73.6–76.6% of lines"
    of: >-
      The share of the corpus behind the 2025-12-31 period lock. ⚠️ **Corrects the "~90%" this ADR
      carried undated**, a figure that appeared in four live places at once.
    source: "inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md"
  - id: M4
    value: "7 lines / $1,700.00, none since 2024-10-07"
    of: >-
      Lines where CFS holds a tracking category and Xero does not. ⚠️ **Replaces this ADR's 13.90% /
      $234,960.36**, which counted absent `xero_tracking_option_id` and was read as CFS-ahead-of-Xero.
      The real direction is the opposite one, and it is measured at M5.
    source: "inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md"
  - id: M5
    value: "151 lines / $19,350.96"
    of: >-
      Lines that are CFS-empty but Xero-SET — the incumbent holds a classification CFS's own line
      does not. A live v1 defect, not a migration question, and it belongs to api-cloudrun#597.
    source: "inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md"
asserts:
  - id: D1
    kind: decision
    claim: >-
      The product line for migrated history is DERIVED from the product master, never assigned to
      the invoice line. Nothing hand-maps a line to a category.
  - id: D2
    kind: decision
    claim: >-
      Where there is no product master to derive from, the line records an explicit null and is
      shown on its own row. No value is invented, and no catch-all member is minted to hold it.
  - id: D3
    kind: decision
    claim: >-
      The recast alters no amount. Nothing about this decision moves money between accounts, between
      P&L sections, or between periods.
  - id: P1
    kind: premise
    claim: >-
      A CFS tracking category was on no externally FILED document — no tax return, no lender or
      investor package, no audited statement. Filed documents carried account totals; the
      tracking-category slice was internal management reporting only.
    source: "inbox/2026-08-22-owner-a-tracking-category-was-on-no-externally-filed-document-so-the-recast-is-owed-to-nobody.md"
  - id: P2
    kind: premise
    claim: >-
      The migration already drops the invoice-line tracking denorm and carries the product master's
      assignment instead — `items[].tracking_category` is `disposition: drop`, and the products
      collection is described as "the authority the invoice line's tracking denorm is dropped in
      favour of". This ADR ratifies a behaviour the migration spec already encodes; it does not
      introduce one.
    source: "code:2026-08-22:erp-spec@29c7850:migration/field-map.yaml"
  - id: P3
    kind: premise
    claim: >-
      `product_line` is not a posting field. The ledger carries keys and every classification is
      derived at report time, so there is no per-line dimension for a migration to populate.
    source: "ADR-0036"
  - id: P4
    kind: premise
    claim: >-
      Xero's tracking-sliced P&L for closed periods is substantially complete, so there IS an
      incumbent report for v2 to diverge from. This ADR originally assumed the opposite.
    source: "inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md"
supersedes:
superseded_by:
---

> **In the context of** migrating invoice history whose product-line classification lives in a line
> denorm the migration drops, **facing** a product master that already carries the assignment and a
> residue of custom lines with no master to carry it, **we decided** to derive the product line from
> the master and to record an explicit null where there is nothing to derive from, **to achieve** a
> recast history that invents no classification and whose gap is one countable row, **accepting**
> that v2's tracking-sliced view of closed periods will differ from Xero's by $231,796.26.

## Context

### It is a RECAST, and FASB fixed the word for exactly this case

ASU 2023-07 **BC83**: Topic 280 used "restatement", but Topic 250 reserves that term for correcting
an **error** — _"Therefore, the Board decided to replace the term restatement with recast throughout
Topic 280 to avoid potential confusion."_

- Conforming a prior period's presentation is a **recast**, and GAAP pushes **toward** it, "unless
  it is impracticable". It is not an obstacle to what this ADR wants; it is a mild endorsement.
- ⚠️ **The lock is a control, not a standard.** Sage Intacct says blocking closed-period edits
  _"ensures that GAAP compliance is maintained"_. GAAP governs statements, never stored records. A
  period lock is an internal-control choice wearing a standards label — and `charter.md`'s
  "unrepairable" is the same shape, a policy claim wearing a mechanical one.
- ASC 280 binds **public entities** only. CFS is not one.

### The criteria collapse to two, and CFS fails neither

Six references, six differently-worded rules about when a closed-period reporting attribute may
change — GAAP's "error in something issued", Xero's "reported externally", SAP's "updated certain
account balances", NetSuite's published list of ledger-identity fields, Intacct's open-period-plus-
arithmetic test, Odoo's "determines the accounting result".

⇒ **Two questions: _was it published_, and _what would the write fail to reach_.**

- The second was always settled mechanically: **a tracking category updates no balance.**
- ✅ **The first is settled by the owner, 2026-08-22: a tracking category was on no externally filed
  document.** That premise was named by the survey as load-bearing and unmeasurable from
  documentation, and it is the reason everything below holds (P1).
- ⇒ **No recast disclosure is owed.** ASC 205-10-50-1 attaches to a party that received the earlier
  presentation, and there is none.

### The Decision this ADR carried had no object left

Two things moved under it after 2026-08-09, and neither is a detail:

- **`ADR-0036` (accepted 2026-08-16) makes `product_line` not a posting field at all** — nullable or
  otherwise. The Y-statement's "a new ledger where that dimension is not nullable" describes a
  constraint that no longer exists (P3).
- **`migration/field-map.yaml` already drops the field the mapping was to be applied to.**
  `items[].tracking_category` is `disposition: drop` — _"a denorm of the product master"_ — and the
  products collection is _"the authority the invoice line's tracking denorm is dropped in favour
  of"_ (P2).

⇒ **"Apply the mapping to every undimensioned line before import" describes an operation on a field
the migration does not carry.** ⭐ **And the thing it should have said instead was already written
down in three places in the migration spec.** ADR-0020 was the last artifact still saying "restate";
it was not proposing something the repo had declined to do, it had simply stopped tracking it.

### The original measurement, and what survived it

Measured 2026-08-09 against prod, over 9,197 non-divider invoice line items totalling $1,689,895.68:

| Missing                   | Lines | % of lines |     Revenue | % of revenue |
| ------------------------- | ----: | ---------: | ----------: | -----------: |
| `tracking_category`       |   383 |      4.16% | $485,821.72 |   **28.74%** |
| `xero_tracking_option_id` |   129 |      1.40% | $234,960.36 |       13.90% |

- ⚠️ **Neither row means what it was read to mean, and the table is kept so that stays visible.**
- **28.74% was a broken denorm, not a classification gap.** The field was null on 227 lines whose
  product master **was** categorised. This was read at the time as _confirming_ the charter's 28.7%
  figure; both numbers came from counting the same line field, so it was one measurement taken
  twice. **Two readings of one broken source do not confirm each other.** Repaired at source
  2026-08-10 (api-cloudrun#473); `tracking_missing` is **227 → 0** and a dry re-run touches 0
  invoices.
- ⚠️ **13.90% is replaced outright.** Lines where CFS holds a category and Xero does not are **7 /
  $1,700.00, none since 2024-10-07** (M4). ⇒ **Xero's tracking-sliced P&L for closed periods is
  substantially complete** — there IS a report to diverge from, which this ADR assumed away (P4).
  The real divergence runs the other way and is measured at M5.
- **What did survive is the taxonomy finding.** By revenue the undimensioned population was Trash
  Removal, Contract Labor, Trucking, Walk Around Trash Sweep — all with an existing value. They were
  never tagged. ✅ **And 2026-08-10 proved it the hard way**: those products were categorised at the
  **master** the whole time. The correspondence this ADR proposed to restate by hand is the one the
  source-system repair derived automatically. **The evidence for "derive it" was already inside the
  argument for "assign it".**
- **It was not historical then and is not now**: 55 in 2023, 174 in 2024, 80 in 2025, 74 already in
  2026 at the time of measurement.

### The population that actually needs deciding

After the repair, untracked line revenue decomposes into two things that were never defects
(re-measured 2026-08-16):

| Population                                    |   Lines |     Revenue | Derivable?                          |
| --------------------------------------------- | ------: | ----------: | ----------------------------------- |
| Custom lines with **no product master**       | **130** | $233,610.63 | **No**                              |
| Lines on a genuinely **uncategorised** master |     183 |  $19,659.12 | Yes, once the master is categorised |

⭐ **The second is not a decision, it is a data-entry queue.** The first is the whole subject of
this ADR: 130 lines with nothing to derive from. Restricted to the pre-lock corpus and measured
against Xero as well, that population is the migration delta — **$231,796.26, 106 lines, 15.66% of
pre-lock revenue, untracked in BOTH systems** (M1). The two figures corroborate at different scopes;
they are not the same denominator and should never be quoted as one.

### Two figures in this ADR's neighbourhood were wrong

- **"~90% of the corpus sits behind the 2025-12-31 lock" is wrong and appeared undated in four live
  places.** Measured: **80.04% of invoices**, ~73.6–76.6% of lines (M3). It does not change the
  direction of anything here — a smaller share crossing the lock is still crossing it — but a figure
  quoted in four places and sourced in none is how a number stops being checkable.
- **`OQ-034` is answered**: `Transport` is **RESTORED**, as an activity line that does not spread
  (owner, 2026-08-16). The `Trucking → Transport` correspondence has a target.

## Decision

**Derive the product line from the product master. Where there is no master to derive from, record
an explicit null.**

- **Nothing hand-maps a line to a category** (D1). The mapping table this ADR proposed to commit is
  not written, because the correspondence it would encode is the product master's assignment, and
  the master is migrating whole.
- **A line with no master records a declared null and is shown on its own row** (D2) — the house
  pattern already held by `OQ-025` and `reporting/product-line-pl.yaml`. It is a determination
  ("nothing to derive from"), not an absence, and it is countable, reportable and attributable.
- **No amount changes** (D3).

## Considered options

- **Restate all — apply a hand-authored mapping to every undimensioned line before import.** _This
  ADR's own former decision._ Rejected on three independent grounds, any one of which is sufficient:
  the field it would write is dropped by the migration (P2); `product_line` is not a posting field
  (P3); and the correspondence it would hand-author is the one the source-system repair already
  derived automatically. ⚠️ **It was not wrong when written** — it was drafted before ADR-0036 and
  before api-cloudrun#473, and both changed the ground under it.
- **Import as-is and leave the history unclassified.** Rejected. It discards a classification the
  product master demonstrably holds, and it makes the pre-lock period unreadable by product line for
  no gain — the derivation is free and invents nothing. NetSuite practitioners name the failure mode
  this option is really guarding against — _"you have to invent fake data… the segmentation is
  artificial"_ — but that argues against **inventing**, not against **deriving**.
- **Mint a catch-all member to hold the residue.** Rejected, and the survey evidence is unusually
  one-directional: SAP warns three times on its current S/4HANA page against its own catch-all, and
  the remedy it repeats is _"define separate profit centers"_ — **more members, not a bucket.**
  `Other` was already deleted by OQ-022 for the same reason: it reads as a category and means nobody
  chose.
- **Mint a synthetic product master per custom line**, so everything derives. Rejected: it
  fabricates a master record that never existed in order to make a derivation succeed, which is
  inventing a classification with an extra step.
- **Derive from the master; declare a null where there is nothing to derive from** (chosen).

## Consequences

- **v2's tracking-sliced view of closed periods will differ from Xero's by $231,796.26** across 106
  pre-lock lines, and that divergence is **acceptable because the sliced report was never filed**
  (P1). ⚠️ **This consequence is entirely contingent on P1.** If it is ever falsified — if some
  package did carry the tracking slice — this is the bullet that has to be re-opened, and the ASC
  205-10-50-1 disclosure becomes owed.
- **The declared-null row is a number someone must watch.** "Share of revenue with no derivable
  product line" is publishable at any time. ⚠️ **And the watch must read the authoritative field** —
  the last watch on this population read a line denorm rather than the master behind it and was
  wrong by 28.74% against 0.041%.
- **The recast is owed no disclosure but is still owed a record.** The migration commits which lines
  took a declared null and why, in the same way it commits every other disposition. The absence of
  an external obligation is not an absence of an internal one.
- **183 lines / $19,659.12 sit on masters nobody has categorised.** That is a queue, not a decision,
  and it is worth clearing **before** cutover rather than after: a master categorised before the
  migration derives correctly for its whole history, and one categorised after needs the derivation
  re-run.
- ⚠️ **The live v1 divergence is untouched by any of this and is getting worse in the direction
  nobody was watching.** 151 lines / $19,350.96 are CFS-empty but Xero-set (M5), plus 222 lines /
  $158,002.94 on Xero option ids CFS no longer knows. Neither is a migration question — they are
  api-cloudrun#597 — but a migration that derives from the master will silently **not** reproduce a
  classification that only ever existed in Xero.
- **`Trucking → Transport` has a target** (OQ-034, answered). The facility and professional-service
  residue this ADR originally called ambiguous — Warehouse Rental, Office Rental, Indoor Parking,
  Location Scouting, Security — resolves under D2 rather than needing a new value, and OQ-025
  already settled that they stay on `4100` and move no money between P&L sections.
- **This does not fix the live writer, and that stayed true.** ✅ Closed 2026-08-10: the producing
  path was the native `POST`/`PUT /invoices` writer, which derived `coa_revenue` from the product
  and took `tracking_category` from the client on trust (api-cloudrun#473).
