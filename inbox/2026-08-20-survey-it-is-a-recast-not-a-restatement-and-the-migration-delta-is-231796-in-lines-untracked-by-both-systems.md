---
kind: survey
title: >-
  Rule 8a survey for ADR-0020 — FASB replaced "restatement" with "recast" for exactly this, the six
  criteria collapse into two and CFS fails neither, and the migration delta is measured at
  $231,796.26 in lines untracked by BOTH systems
contexts: [ledger, billing]
source: >-
  Six-reference survey, 2026-08-20. Migration delta measured over all 814 pre-lock invoices, 100%
  coverage, read-only from the Firestore mirror — never the Xero API. Odoo behaviour read from
  source; GAAP from ASU 2023-07's basis for conclusions.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owed by **ADR-0020** (Xero history is restated, not imported as-is), `proposed` since 2026-08-09.

**The question.** Does history come across as transaction-level detail or opening balances only —
and may a reporting attribute be ASSIGNED to transactions inside a closed, locked period?

⚠️ **Two fabrications were produced and discarded during this run** — a SAP scope sentence existing
in no primary source, and a "3-year trend" phrasing no practitioner wrote. Neither is quoted below.

---

## The answer, in one table

| Reference            | What history comes across                                                                                               | May a closed-period reporting attribute change?                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**             | not its subject                                                                                                         | **not a GAAP question** — conforming prior-period presentation is a **recast**, owed "unless it is impracticable"                                                |
| **Xero** (incumbent) | conversion balances + every open item; prior years as **annual totals, not transactions**                               | **no** — locked rows are read-only, "non-selectable to make changes"                                                                                             |
| **SAP S/4HANA**      | New Implementation: **"No historical transactional data kept."**                                                        | **no — and not because of the period.** Dimensions are **update objects**, frozen "independent of the document change rules"                                     |
| **NetSuite**         | opening balance-sheet journals; "recommended that you don't load a complete transaction history"                        | **no** — "department, class, location, and custom segment" are listed among "fields that impact the general ledger"                                              |
| **Sage Intacct**     | beginning balances + open bills; uniquely, a "historical" import loading subledger detail **without posting to the GL** | **no when closed**; ⚠️ **yes when open** — Reclassify lists "Dimension value" as changeable on a posted, paid entry                                              |
| **Odoo**             | balances + open items, recommended as **a single total line**                                                           | **YES** — `analytic_distribution` is in none of the eleven lock-protected fields, so it is writable **even under the irreversible Hard Lock**, and **untracked** |

⇒ **Nobody brings transaction-level history across.** Every reference migrates balances plus open
items. That is a stronger consensus than ADR-0020's framing anticipates, and it is about _what to
bring_, not about _what to do with it once brought_.

## ⭐ GAAP already fixed the word ADR-0020 is arguing about

**It is a RECAST, not a restatement**, and FASB said so in writing. ASU 2023-07 **BC83**: Topic 280
used "restatement", but Topic 250 defines that term as correcting an **error** — _"Therefore, the
Board decided to replace the term restatement with recast throughout Topic 280 to avoid potential
confusion."_

- The disclosure owed is **ASC 205-10-50-1** — the nature, the reason, and the fact that
  comparatives were recast.
- **GAAP pushes TOWARD conforming prior periods**, "unless it is impracticable". It is not an
  obstacle to what ADR-0020 wants to do; it is a mild endorsement with a disclosure attached.
- ASC 280 binds **public entities only**. CFS is not one.

⚠️ **And one vendor's GAAP claim does not survive the standard.** Sage Intacct states that blocking
closed-period edits _"ensures that GAAP compliance is maintained"_. **GAAP governs statements, never
stored records.** A period lock is an internal-control choice wearing an accounting-standard label —
worth knowing, because ADR-0020 has been treating the lock as if it carried that weight.

## ⭐ The six criteria collapse into TWO, and CFS fails neither

|              | criterion                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| **GAAP**     | does the change correct an **error** in something **issued**?                                          |
| **Xero**     | has this period been **reported externally**?                                                          |
| **SAP**      | _"Because they have updated certain account balances during posting, these fields cannot be changed."_ |
| **NetSuite** | is the field part of the **ledger's identity**? — answered by publishing a list                        |
| **Intacct**  | is the period open, and is the **arithmetic preserved**?                                               |
| **Odoo**     | does the field **determine the accounting result**?                                                    |

⇒ **Two questions, not six: _was it published_, and _what would the write fail to reach_.** CFS's
tracking category was on no filed document and updates no balance. **It fails neither test.**

⚠️ **"A tracking category is on no filed document" is the load-bearing premise and it is
unmeasurable from documentation.** It needs the owner's confirmation. Everything above rests on it.

## Where the references genuinely disagree

**Is a reporting dimension part of the ledger record?** NetSuite says **yes** — changing one mints a
copy-and-reversal pair. Odoo and Intacct say **no**.

⇒ **ADR-0020's "a dimension is a reporting attribute and assigning one moves no money" is Odoo's and
Intacct's position, and NetSuite's opposite.** Defensible, but the ADR states it as self-evident
when it is contested.

⭐ **And the split tracks storage model rather than principle**: SAP freezes the dimension because
it **copied** it into CO / PCA / FI-SL. The freeze is a consequence of denormalisation, not a
judgement about what a dimension is. That is the most useful sentence in the survey for a system
still choosing its storage model.

## ⭐ The migration delta — previously called unmeasurable, now $231,796.26

Measured 2026-08-20 across **all 814 pre-lock invoices, 100% coverage**:

- **ADR-0020's 13.90% figure is gone.** Lines where CFS holds a category and Xero does not: **7
  lines / $1,700.00**, and **none since 2024-10-07**.
- ⇒ **Xero's tracking-sliced P&L for closed periods is substantially complete.** There _is_ a report
  to diverge from, which the ADR assumed away.
- **The real delta is 106 lines / $231,796.26 — 15.66% of pre-lock revenue — untracked in BOTH
  systems.** Ad-hoc custom lines. Assigning them makes v2 disagree with Xero by that amount.
- Corroborates `ledger/dimensions.yaml`'s independently-derived 128 lines / $233,610 corpus-wide.

⚠️ **The counter, and it is the owner's call:** that report was never filed. **Filed = account
totals; tracking = management reporting.** If nothing external ever carried the tracking slice, the
divergence costs nothing and the recast disclosure is owed to nobody.

## ⚠️ The recommendation is NEITHER of the ADR's options

**Derive from the product master; declare a null where there is nothing to derive from.**

- **ADR-0036 (accepted) makes the product line derived at report time**, and
  `migration/field-map.yaml` already sets `items[].tracking_category` → **`disposition: drop`**. ⇒
  **"Apply the mapping to every undimensioned line" describes an operation on a field the migration
  already drops.** The ADR's Decision has no object.
- **"Import as-is" is also wrong**, and NetSuite practitioners name the failure exactly — _"you have
  to invent fake data… the segmentation is artificial"_. But that argues against **inventing**, not
  against **deriving**.
- ⇒ **The $688.00 is not the decision. The 128 custom lines are** — they have no master to derive
  from. **OQ-025 and `reporting/product-line-pl.yaml` already hold the house pattern**: a declared
  null, shown on its own row.

## ⚠️ Three things to carry regardless of the decision

1. **The "~90% behind the lock" figure is wrong and appears undated in four live places.** Measured:
   **80.04% of invoices**, ~**73.6–76.6% of lines**. And `charter.md`'s "unrepairable" is a **policy
   claim wearing a mechanical one** — the lock is a setting, not a physical impossibility.
2. ⚠️ **Present-but-wrong tracking is live and nothing tracks it.** Several categories map to
   **two** Xero option ids, and one line bills bottled water under `Surface Protection`. **All of it
   passes every existence check** — the repo's own "present but wrong beats absent at passing every
   existence check", measured in production.
3. ⚠️ **Do not accept ADR-0020 on this survey without first amending its Y-statement.** It faces "a
   new ledger where that dimension is not nullable", which ADR-0036 made untrue. **Citing a survey
   that concludes the premise is void would freeze the contradiction permanently** (ADR-0034 — the
   body freezes at acceptance).

## What was NOT verified

- **Xero Central and developer.xero.com are SPAs** — quoted from verbatim mirrors; Xero Product
  Ideas is the primary source used.
- **NetSuite publishes no field list for "Allow Non-G/L Changes"**; the closed-period conclusion is
  a two-step inference from two separately-scoped statements.
- **SAP: no general-FI sentence naming profit center**, no CDHDR/CDPOS attestation for FI, no stated
  rationale for balances-over-detail, and **no practitioner evidence at all** — `community.sap.com`
  403s and the search budget was exhausted.
- **Odoo's prose contradicts its own code** on posted entries; the code is what is quoted.
- **"A tracking category is on no filed document"** — the load-bearing premise, unmeasurable from
  documentation, needs the owner.
