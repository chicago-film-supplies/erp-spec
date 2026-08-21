---
kind: survey
title: >-
  Rule 8a survey for ADR-0029 — three of five systems post allocations and none derives at report
  time, but the option the ADR never considered is the one they all implement: keep the allocation
  out of the STATEMENTS, not out of the ledger
contexts: [ledger, billing, fulfillment]
source: >-
  Six-reference survey, 2026-08-20. ASC 280 extracted locally with `pdftotext` from RSM's
  reproduction of the Codification text. SAP quotes from help.sap.com's content-search API and one
  complete static page; Xero from its machine-readable OpenAPI contract; Odoo from source. CFS's
  own chart measured via `mcp__cfs-api-prod__db_chart_of_accounts_query`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owed by **ADR-0029** (the ledger does not allocate), `proposed` since 2026-08-09 and unsurveyed.

**The question.** Does cost allocation POST to the general ledger, or is it a reporting-layer act?

⚠️ **Method note.** `help.sap.com`, `central.xero.com` and `developer.xero.com` are JS SPAs that
defeat fetching. **Two fabricated paraphrases were produced and discarded during this run** — the
failure mode CLAUDE.md names, occurring twice in one survey. Everything below is either verbatim
from a machine-readable contract, from a locally extracted PDF, from SAP's own content-search API
cross-checked across four versions, or from source code.

---

## The answer, in one table

| Reference          | Posts to GL?                                           | Original grain afterwards              |
| ------------------ | ------------------------------------------------------ | -------------------------------------- |
| **GAAP (ASC 280)** | posting is not the test at all                         | untouched; reconciliation **required** |
| **Xero**           | **no allocation engine exists**                        | untouched — nothing spreads            |
| **SAP S/4HANA**    | posts to ACDOCA — on a **six-rung permanence ladder**  | **depends on the primitive chosen**    |
| **NetSuite**       | always a posting journal entry                         | **configurable** via a credit account  |
| **Sage Intacct**   | posts — and **may only post into a user-defined book** | intact three ways                      |
| **Odoo**           | **no allocation engine**; analytic lines are not GL    | untouched                              |

**Three of five post. Two cannot allocate at all. None derives at report time.** By the default
alone, ADR-0029 departs from every reference that has the feature.

## 1. GAAP — ASC 280 is the sharpest hook and it points AWAY from posting

ASC 280-10-50-27, verbatim (RSM US LLP, _Expanded Reportable Segment Disclosures_, June 2024,
`rsmus.com/content/dam/rsm/insights/financial-reporting/1pdf/Expanded-Reportable-Segment-Disclosures.pdf`,
p13 — **PDF downloaded and extracted with `pdftotext`, not read through a summarizing fetch**, read
2026-08-20):

> "Adjustments and eliminations made in preparing a public entity's general-purpose financial
> statements and allocations of revenues, expenses, and gains or losses shall be included in
> determining reported segment profit or loss **only if they are included in the measure of the
> segment's profit or loss that is used by the chief operating decision maker**. … If amounts are
> allocated to reported segment profit or loss or assets, those amounts shall be allocated on a
> reasonable basis."

RSM's gloss, same page:

> "ASC 280 does not require that the measure of profit or loss or the assets of the segments be
> determined utilizing the same accounting principles that are required to be used for the
> consolidated financial statements."

**Posting is never mentioned.** The test is management-report membership, and it runs **both ways**:
a number can enter the audited segment note having never been a journal entry, and a cost that IS in
the GL must be **excluded** if the CODM's measure lacks it. ⇒ **GAAP treats the ledger as an input,
not the authority.**

⚠️ **This is not a free pass, it is a bill.** 50-29(b) requires the allocation policy disclosed, (d)
requires method changes and **their effect** quantified, (e) requires **asymmetrical allocations**
disclosed, and **50-30 requires reconciliation to the consolidated totals**. ADR-0031's
`basis_version` and `sealed_at_close: false` satisfy the first three by construction. **The
reconciliation is stated nowhere in the reporting spec** — and it is the one that makes the
un-allocated view load-bearing rather than merely available.

⚠️ **ASC 280 exempts "Nonpublic entities"** (same PDF, p4), so this is a criterion for CFS, not a
requirement — the FASB "encourages" it (ASC 280-10-15-2).

✅ **Vocabulary CFS is missing:** ASU 2023-07 deliberately uses **"recast"** rather than "restate"
for a change in allocation method. ADR-0020 is currently arguing about the word "restate".

**Criterion — GAAP:** is this number in the measure the CODM actually uses? Then disclose it, hold
it stable, quantify changes, and reconcile it.

## 2. Xero — the incumbent cannot allocate, and already derives the dimension at report time

- ⚠️ **"Allocation" in Xero's vocabulary is not cost allocation.** Measured against its own OpenAPI
  contract: **139 of 139** uses of `allocat*` refer to credit-note, overpayment and prepayment
  settlement.
- The dimension is a **tag on a line, capped at two**, applied at entry.
- ✅ **Xero already computes the dimensional P&L at report time** — the tag is stored, the report
  slices. That is ADR-0036's model, running in production today.
- Its complete report surface was enumerated: **there is no allocation report.**
- ⚠️ **Xero does have one posted-dimension-shift mechanism and CFS has the account for it** — a
  `TRACKINGTRANSFERS` system account, and CFS's chart carries `2650 - Tracking Transfers`.

**Criterion — Xero:** none is offered, because no choice is offered. Tag the line; slice in the
report.

## 3. SAP S/4HANA — ships BOTH grains and forces the choice per cycle

_Distribution_
(`help.sap.com/docs/SAP_S4HANA_ON-PREMISE/…/0f892a028bcf449a895fdf499e421060.html?version=2025.001`):

> "The debit and credit postings for the distribution occur **under the original account/original
> cost element** … **The information of the original account/original cost element remains
> intact.**"

_Overhead Allocation_ (formerly assessment,
`…/d4ca330216f0418b87d9418c87b2b569.html?version=2025.001`):

> "the amounts are posted to separate overhead allocation accounts rather than to the original
> accounts. … **The information from the original account/original cost element is lost.** …
> performed **if the original composition of the actual/plan data does not contain any important
> information for the receiver**."

SAP Learning, official training:

> "**Depending on whether the original account/original cost element needs to be preserved with the
> allocation, the allocation type selected will be different.**"

SAP also ships a **six-rung permanence ladder** — test run → plan (ACDOCP) → extension ledger type S
→ type P → type Standard → leading ledger — and its second stated criterion is whether you need
"full journal entries, that is, journal entries with real document numbers" or only technical ones.
⚠️ **SAP permits test runs in LOCKED fiscal periods**: computation over a sealed period is the
reference behaviour, which is `sealed_at_close: false` arrived at independently.

**Criterion — SAP, and it is the best in the survey:** does the RECEIVER need to know what the cost
was made of? And separately: does this need a document number someone can be held to?

## 4. NetSuite — always posts; its "reporting" mode is a contra credit INSIDE the GL

Its allocation-schedule setup page asks, verbatim: **"do you want to move the amount or allocate for
reporting purposes?"** — and **both answers post a journal entry.** With no credit account the
source is zeroed; with one, it "leaves the actual expense amount in the source account."

Statistical accounts are the only genuinely non-GL surface, and they carry the **weight**, never the
amount.

**Criterion — NetSuite:** move it, or leave it and mark it. Posting is assumed either way.

## 5. Sage Intacct — posts, and buys reversibility by SEGREGATION

It posts, and **may only post into a user-defined allocation book, never the main one** — explicitly
"to ensure there's an opportunity for verification". The original grain survives three ways, and
report columns include or exclude the allocation book at will.

**Criterion — Intacct:** are the split parameters known at entry (tag it) or computable only after
the fact (allocate it — and quarantine the result)?

## 6. Odoo — no engine, and the dimension is deliberately not accounting data

⚠️ **Odoo never makes the negative claim in prose; it is proven from source.**
`analytic_distribution` appears in **neither** `_get_integrity_hash_fields()` **nor**
`_get_lock_date_protected_fields()` — so the analytic dimension is **re-writable on a posted,
hashed, lock-dated entry**. It is not accounting data, by construction.

✅ **That is executable proof for ADR-0036**, arrived at from a different direction.

**Criterion — Odoo:** the dimension is not accounting data, so it is never posted, hashed or locked.

---

## ⚠️ What this falsifies in ADR-0029

**Its opening Context claim — _"Allocation is destructive; grouping is not"_ — is FALSE as stated.**
SAP `distribution`, NetSuite's credit-account mode and Intacct's segregated book each keep both
grains **while posting**. Destructiveness is a property of one implementation choice, not of
allocation.

⚠️ **And the option ADR-0029 never considers is the one they all implement: nobody keeps allocations
out of the LEDGER — they keep them out of the STATEMENTS.** SAP's `S Secondary Costs` account type,
Intacct's mandatory allocation book, NetSuite's contra credit. Three implementations of one idea,
and ADR-0029's Considered Options contains none of them.

**The decision survives anyway, on a different and stronger argument:** a number whose correctness
depends on a basis ADR-0031 itself calls the weakest defensible tier **should not be given a
document number**. That is SAP's own second criterion, and it is the one to write down.

✅ **And it has a production precedent nobody had cited**: Deltek Vision — "Overhead allocation does
not impact the general ledger… they are not posted to the database" — with **year-to-date
recomputation** making it idempotent, the same property as `sealed_at_close: false`.

## Five more things that argue against, recorded because a survey that only confirms is not a survey

1. **Reporting-layer allocations are documented to rot.** AccountingTools on ABC: "a very high
   proportion of the projects either fail or eventually lapse into disuse… requires a separate
   database… quite difficult to maintain." A posted allocation is maintained because the close
   cannot finish without it. **Nothing makes the official product-line P&L a thing that must keep
   working.**
2. **HOT-014 — the load-bearing precondition is unmet.** ADR-0029 requires every posting to carry
   its causal order or "this decision quietly becomes 'never allocate'". No posting carries one yet.
3. **The asymmetry sharpens it**: after a document-store loss, the recoverable view is the one
   ADR-0029 says must never be read as a managed P&L. Intacct's allocation book and SAP's extension
   ledger are durable answers to exactly that.
4. **Kaplan recanted the separation thesis** after CFO pushback, recasting it as "an intermediate
   and sensible stage" rather than the objective.
5. ⚠️ **The rental-industry reference chart (InTempo) has no delivery cost centre at all** — it does
   not even build the un-allocated view.

## ⚠️ Two questions, not one — and they must not lean on each other

- On **allocation** (ADR-0029), CFS departs from the three references that have the feature, with
  GAAP's own criterion behind it and two references forcing it.
- On the **dimension** (ADR-0036), the 2026-08-10 survey found **6 of 6 snapshot it onto the
  transaction**. CFS took the option no reference supports.

They are the same principle one layer apart, and the evidence splits differently on them. **Neither
may cite the other as authority.**

## The migration delta from Xero

ADR-0031's "the delta is nil" is **right about the allocated view and incomplete about the
un-allocated one.** Measured 2026-08-20: 134 accounts, 53 Expense, **zero allocation, absorption,
applied or variance accounts**; `6600 Wages` and `6400`–`6404 Vehicle:*` are undimensioned opex
**outside** the COGS block, which contains no labor and no vehicle line at all.

⇒ **Both views in ADR-0029's table are new. Not one of them exists today.** And Xero's two-category
cap is fully spent, so **no cost-side dimension history is recoverable** — this is forward-only.

**Four read-only measurements would close it**, all belonging in an `api-cloudrun` script under
`assertXeroProdProject`:

|        | what                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **M1** | lines posted to `2650 - Tracking Transfers` — expected 0; non-zero refutes "nothing spreads"                                 |
| **M2** | manual journals carrying ≥2 tracking options on one account code                                                             |
| **M3** | ⚠️ **what fraction of expense-side lines carry any tracking option** — this one changes the decision's shape                 |
| **M4** | a year of `6600` + `6400`–`6404` against `4100` + `4110` — turns "Delivery shows a large loss by construction" into a number |

## What was NOT established

- **Whether a SAP allocation reversal restores balances exactly** — five phrasings searched; SAP
  never states it.
- **What Xero's `TRACKINGTRANSFERS` is for**, and whether CFS's `2650` was ever posted to (M1).
- **The IMA/CAM-I _Conceptual Framework for Managerial Costing_** — the one accounting-body source
  that speaks directly to this question. Every route to the primary text is dead.
- ⚠️ **"Allocation drift" is not a term of art** — every hit is portfolio drift. Do not use it in
  the spec.
- ⚠️ **No published source anywhere debates whether an equipment-rental company should leave
  delivery in a cost centre or spread it.** ADR-0029 is answering a question the literature does not
  address, which is worth knowing before leaning on any of the above as precedent.
