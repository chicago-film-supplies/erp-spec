---
id: ADR-0025
headline: a non-operating receipt moves account
title: >-
  A receipt that is not a categorised sale moves to 4800 Other Income rather than taking a null on
  an operating revenue account
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, billing]
relates_to:
  [HOT-011, HOT-019, OQ-021, OQ-022, OQ-025, REQ-LED-001, ADR-0009, ADR-0018, ADR-0020, ADR-0036]
accounting_shaped: true
survey:
  - inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md
measurements:
  - id: M1
    value: "5 accounts — 4800, 4810, 4820, 4830, 4840"
    of: >-
      The live `Other Income` block in the chart, all Active with no archived sixth. ⚠️ **Corrects
      this ADR's own "`4820 Interest Income` and five siblings"**, which counted six.
    source: "code:2026-08-22:erp-spec@29c7850:ledger/chart-of-accounts.yaml"
asserts:
  - id: D1
    kind: decision
    claim: >-
      The difference between "a categorised sale to which no tracked product line applies" and "not
      a categorised sale at all" is carried by the ACCOUNT. A receipt that is not revenue from a
      contract with a customer is coded to `4800 - Other Income` or a sibling, never to an operating
      revenue account.
  - id: D2
    kind: decision
    claim: >-
      Neither mechanism substitutes for the other. Coding a real service to 4800 understates
      operating revenue; leaving a genuine non-operating receipt on 4100 overstates it. Both are
      errors, and they are errors in opposite directions.
  - id: P1
    kind: premise
    claim: >-
      No surveyed system lets a POSTING declare "not applicable". Every not-applicable mechanism in
      SAP, NetSuite, Sage Intacct, Odoo and Xero attaches to the ACCOUNT or the SCOPE, once, in
      configuration. The account-shaped escape hatch is the mainstream answer, not a CFS invention.
    source: "inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md"
  - id: P2
    kind: premise
    claim: >-
      GAAP separates these two things on the face of the statement, not inside a dimension. Reg S-X
      210.5-03 puts net sales at caption 1 and non-operating income at caption 7; ASC 606-10-50-4(a)
      requires revenue from contracts with customers disclosed separately from other sources.
      Interest, cashback and vendor refunds are not revenue from a contract with a customer at all.
      ⚠️ Reg S-X binds registrants and CFS is private — this is a criterion, not a requirement.
    source: "inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md"
  - id: P3
    kind: premise
    claim: >-
      `product_line` is not a posting field. The ledger carries keys and every classification is
      derived at report time, so there is no per-posting dimension for an account to require.
    source: "ADR-0036"
supersedes:
superseded_by:
---

> **In the context of** a chart holding receipts that are not sales at all — interest, cashback,
> vendor refunds — alongside genuine sales that map to no tracked product line, **facing** a
> reporting taxonomy that ADR-0036 removed from postings entirely, **we decided** that the
> difference between the two is carried by the ACCOUNT rather than by a value on the posting, **to
> achieve** a P&L where a non-operating receipt is visible on the face of the statement rather than
> inside a dimension nobody reads, **accepting** that revenue mix changes shape when the history is
> recoded.

## Context

⚠️ **This ADR was drafted with four decision clauses and has one left. That is the Context.**

It was written 2026-08-09 to settle HOT-011 — three spec statements disagreeing about which postings
must carry which dimensions. Between then and now, ADR-0036 was accepted and three of the four
clauses stopped being this ADR's to decide:

| Original clause                                           | State now                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A per-account `dimensions:` list on every chart entry     | **Refused by a gate.** `tools/validate.ts` fails on any chart entry carrying a `dimensions` key, naming ADR-0036. 0 of 143 carry one |
| `Other` deleted from the `product_line` value set         | **Already enacted**, by OQ-022 rather than by this ADR                                                                               |
| REQ-LED-001 amended to declare-or-be-rejected             | **Already enacted**, by ADR-0036 — against `causal_orders` rather than a dimension. See below                                        |
| **`4800 Other Income` vs a null on an operating account** | ⭐ **Alive, undecided, and decided in no other ADR** — already leaned on in five places in `ledger/chart-of-accounts.yaml`           |

### The declare-or-be-rejected rule is ADR-0036's, and it is already in force

⚠️ **Recorded because two artifacts got this wrong and it changed which route this ADR could take.**
HOT-019 and the rule 8a survey both attributed the `causal_orders` obligation to **ADR-0029**, whose
body does not contain the string. Its owners are **ADR-0036** — _"That requirement is now this ADR's
decision rather than an unmet obligation"_ — and **REQ-LED-001**, restated 2026-08-16 to match. It
executes: 24 `causal_orders` declarations in `ledger/posting-rules.yaml` with golden vectors on all
three arms (`missing-causal-order-rejected`, `empty-causal-order-list-rejected`,
`declared-null-causal-order-recorded`). Corrected in
`inbox/2026-08-22-correction-the-causal-orders-obligation-is-adr-0036s-decision-not-adr-0029s-and-two-artifacts-carried-the-wrong-owner.md`.

⇒ **There is nothing to move, and this ADR proposes nothing about `causal_orders`.** What the survey
delivers there is **confirmation of a rule already in force**, which is recorded as a Consequence
below rather than as a decision.

### What the six references settle, and it is not close

- **Every not-applicable mechanism attaches to the ACCOUNT or the SCOPE** (P1) — Intacct's "Require
  dimensions" section on the GL account, SAP's field status group, Odoo's plan applicability on a
  GL-account prefix, NetSuite's segment restriction. SAP is bluntest: in CO-PA _"not assigned"_
  **is** SAP's name for blank, not a contrasting value.
- **The nearest miss is instructive.** NetSuite's `-Unassigned-` is "a specific value" defined as
  "null on the transaction record" — and it lives in the **Chart of Accounts Mapping rule**, one
  layer above the ledger. NetSuite named the null so a _rule_ could target it, and still did not put
  it on the transaction.
- **GAAP draws the same line, and draws it on the face of the statement** (P2). ⇒
  **`4820 Interest
  Income` cannot be a `product_line` value under any reading**, and tagging it on
  an operating account would leave it inside operating revenue on the face of the P&L.
- ✅ **GAAP also names CFS's dimension.** ASC 606-10-55-91's first example disaggregation category
  is _"Type of good or service (for example, **major product lines**)"_.

### One figure this ADR stated wrong

It said _"`4820 Interest Income` and **five siblings** are `type: Other Income` live"_ — six.
Measured: **exactly five in total** — 4800, 4810, 4820, 4830, 4840, all Active, no archived sixth
(M1). Verified independently against `ledger/chart-of-accounts.yaml` as well as the survey.

## Decision

**The account carries the distinction.**

- **`4800 - Other Income` and its four siblings hold receipts that are not revenue from a contract
  with a customer** — interest, cashback, a vendor refund, a sales-tax discount, a one-off oddity
  (D1).
- **An operating revenue account holds a categorised sale**, including one to which no tracked
  product line applies. The product-line view of it is derived at report time (ADR-0036), and where
  nothing is derivable the reporting layer shows a declared-null row (OQ-025,
  `reporting/product-line-pl.yaml`).
- **Neither substitutes for the other** (D2). This is the whole content of the decision: the two
  facts are different facts, and the chart is where the difference is recorded.

⚠️ **What this ADR does NOT decide, stated so nobody re-reads it into the text**: it mints no
per-account `dimensions:` list, it amends REQ-LED-001 not at all, and it proposes nothing about
`causal_orders`.

## Considered options

- **A per-account `dimensions:` list, with an account-shaped escape hatch.** _This ADR's own former
  decision._ Rejected: `validate.ts` fails on any chart entry carrying the key, and ADR-0036 is the
  reason. Enacting it would turn CI red (P3). ⚠️ **It was not wrong when written** — ADR-0018 was in
  force and dimensions were posting fields.
- **Keep `Other` as a product-line value.** Rejected, and already enacted by OQ-022. It reads as a
  category and means "nobody chose". A line in 4800 asserts _this was not a categorised sale_, which
  is a fact about the transaction; a line in an operating account tagged `Other` asserts _this was a
  categorised sale_ and then names no category, which is not.
- **Put the receipt in operating revenue and mark it non-operating with a flag or a dimension.**
  Rejected on P2: GAAP separates these at the caption, and Intacct names the mechanism failure
  exactly — _"the general ledger isn't looking for this flag, it's looking for transactions without
  a dimension in the field."_ A flag in the report layer over a GL that holds them together is a
  presentation built on a record that disagrees with it.
- **The account carries the distinction** (chosen).

## Consequences

- **A non-operating receipt moves account, not just bucket, and revenue mix on the P&L changes
  shape.** That is the real cost of this decision and it should be stated plainly: what used to sit
  in operating revenue under `Other` now sits in Other Income. **That is the intent** — it is
  visible on the face of the statement rather than inside a dimension nobody reads — but it is a
  reporting change, not only a data-model one.
- ⭐ **The survey CONFIRMS `causal_orders`, and confirmation is worth recording.** The criterion
  running through all five ERPs is not "was this classified" but **"can the book still be tied out
  if this is missing"** — completeness of a book that must reconcile, never completeness of
  classification. Applied to CFS it endorses ADR-0036 twice over: `product_line` is BI-not-
  compliance and belongs absent-with-a-residual-row, while `causal_orders` **is** a key that must
  tie out and is exactly where the declare-or-be-rejected rule already sits. **Six references
  independently converging on the rule CFS already runs is evidence it is right.**
- ⚠️ **CFS remains the only system in the survey where a posting can say "I considered this and no
  value applies"** — on `causal_orders`, under ADR-0036. Unusual is not wrong: XBRL inverts the rule
  outright (absence _encodes_ the default member), and Kimball keeps three named members rather than
  one null. **"Absence is always an oversight" is a design position, not a universal** — but CFS
  should know it is holding a minority position deliberately.
- ⚠️ **A forced declaration is not a determination, and no gate can see the difference.** The
  measured "operator declined to classify" population is **$688.00 — 0.041% of line revenue** — and
  that figure counts the operators who **DECLINED, never the ones who GUESSED**. NetSuite
  practitioners name the failure directly: _"users selecting the first value they find because they
  don't know what to choose"_. ⚠️ **This is also the figure whose ownership is unassigned** — it
  appears in seven live files, is typed as a `measurements:` entry by none of them, and originates
  in api-cloudrun#473 rather than here. Filed as deferred work.
- **`Other`'s deletion cost something measurable, and it is not this ADR's to pay.** 222
  revenue-bearing lines / $158,002.94 carry a Xero tracking option id not in CFS's live registry,
  and the largest by line count — 110 lines / $6,830.96 — is **unnamed**, its shape fitting a
  retired `Other`. Naming it needs `includeArchived=true` against the Xero API, **which this repo
  must not call. Do not assume.**
- **`4800` requires no product line, so nothing about it is blocked on the reporting taxonomy.** It
  is outside `reporting/product-line-pl.yaml`'s scope by construction — a non-operating receipt has
  no product line because it has no product, not because nobody chose one.
