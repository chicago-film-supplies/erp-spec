---
id: ADR-0044
headline: CFS is principal on a PSA
title: >-
  CFS is the principal on a production service agreement, so the client's budget is revenue and the
  crew cost is CFS's cost
status: proposed
date: 2026-08-22
review_by: 2026-11-30
deciders: [repo owner]
contexts: [ledger, billing, fulfillment]
relates_to: [ADR-0019, ADR-0026, ADR-0029, ADR-0031, ADR-0041, HOT-017, OQ-024, OQ-053]
accounting_shaped: true
survey:
  - inbox/2026-08-17-survey-psa-is-a-principal-or-agent-question-and-the-live-books-answer-it-four-different-ways.md
measurements:
  - id: M1
    value: "$101,720.00 — $69,650.00 to 4100, $25,070.00 to 4120, $7,000.00 through 2800"
    of: >-
      PSA-shaped invoice lines in the live corpus, measured 2026-08-17 across 1,013 invoices and
      14,425 lines. **93% by value is already billed GROSS**, which is the principal treatment, and
      7% through the liability, which is the agency one — for the same customer, on the same shape
      of work. `4130`, `2801`, `2802` and `2803` are named by **zero** invoice lines.
    source: "inbox/2026-08-17-survey-psa-is-a-principal-or-agent-question-and-the-live-books-answer-it-four-different-ways.md"
asserts:
  - id: D1
    kind: decision
    claim: >-
      CFS is the PRINCIPAL on a production service agreement. The client's budget is CFS revenue and
      the crew cost is CFS's cost, reported gross.
  - id: D2
    kind: decision
    claim: >-
      A PSA is its own product line. Its crew cost never absorbs into the rental or delivery pools,
      and that holds independently of D1.
  - id: P1
    kind: premise
    claim: >-
      CFS signs the crew engagement and is the contracting party; CFS buys its own general liability
      and inland marine cover for the work; and CFS is out of pocket if the client's money never
      arrives after the crew has been paid.
    source: "inbox/2026-08-22-owner-answers-oq-053-cfs-signs-insures-and-eats-the-loss-on-a-psa-and-uses-an-eor-for-the-payroll.md"
  - id: P2
    kind: premise
    claim: >-
      CFS has NO discretion in setting the price — crew cost passes through at cost plus a stated
      fee. This is the one ASC 606-10-55-39 indicator pointing at agent, and it is recorded as a
      dissent rather than reconciled away.
    source: "inbox/2026-08-22-owner-answers-oq-053-cfs-signs-insures-and-eats-the-loss-on-a-psa-and-uses-an-eor-for-the-payroll.md"
  - id: P3
    kind: premise
    claim: >-
      The arrangement exists because the client cannot be the employer — overseas productions use a
      PSA because they will not stand up a US entity and cannot hold union deals for a few days of
      filming.
    source: "inbox/2026-08-17-survey-psa-is-a-principal-or-agent-question-and-the-live-books-answer-it-four-different-ways.md"
  - id: P4
    kind: premise
    claim: >-
      PSA payroll runs through an employer of record — Entertainment Partners, Cast & Crew or
      Revolution Payroll — which is the same shape as CFS's own crew payroll, already specified.
    source: "inbox/2026-08-22-owner-answers-oq-053-cfs-signs-insures-and-eats-the-loss-on-a-psa-and-uses-an-eor-for-the-payroll.md"
supersedes:
superseded_by:
---

> **In the context of** a production service agreement whose accounting the charter asserts and the
> books contradict, **facing** an ASC 606 control test that turns on facts held by nobody in the
> data, **we decided** that CFS is the principal and reports the client's budget as revenue, **to
> achieve** one treatment where the live corpus currently carries two, **accepting** that the top
> line and every margin computed from it change, and that the history remains internally
> inconsistent.

## Context

`charter.md` states the mechanism outright — _"moving a client's payroll through
`2800 - PSA Liability Clearing` is the service being sold"_ — and names `4130 - PSA Income` as what
CFS sells. **The books do neither for 93% of it** (M1). This is a spec statement against a
measurement, and it is `HOT-017`.

**Nobody in the six-reference survey decides this by looking at the money.** Every reference decides
it by asking who is obligated: ASC 606 by control, NetSuite by the same rule restated, Odoo by
making it a declared property of the cost category, SAP by whether the receipt is revenue at all. ⇒
the question was never answerable from the corpus, which is why the survey ended in an open question
rather than a recommendation.

### The indicators, with the owner's facts against them

**ASC 606-10-55-37: _"An entity is a principal if it controls the specified good or service before
that good or service is transferred to a customer."_** The indicators at 55-39:

| indicator                                         | fact                                            | points at     |
| ------------------------------------------------- | ----------------------------------------------- | ------------- |
| primary responsibility for fulfilling the promise | **CFS signs the crew engagement** (P1)          | **principal** |
| inventory risk                                    | not applicable to a service                     | —             |
| discretion in establishing the price              | **pass-through at cost plus a stated fee** (P2) | ⚠️ **agent**  |

and two facts that are evidence of control without being listed indicators:

|                                               | fact                                           | points at     |
| --------------------------------------------- | ---------------------------------------------- | ------------- |
| who carries the liability exposure            | **CFS buys its own GL and inland marine** (P1) | **principal** |
| who bears the credit risk on the whole budget | **"CFS eats it"** (P1)                         | **principal** |

⚠️ **The dissent is real and is not smoothed over.** No price discretion is exactly why the
arrangement reads as a pass-through, and it is why `charter.md`, erp-spec#35 and an earlier ledger
survey all describe it that way. **Recording it is the point** — a decision that reports its
supporting evidence and hides its contrary evidence is not a decided question.

⭐ **It loses anyway, on three grounds.** The indicators **support the assessment of control and are
not a checklist** (55-39 is explicit that they are neither exhaustive nor individually
determinative). A **cost-plus fee is a pricing structure, not a statement about who is obligated** —
staffing and construction principals bill that way routinely. And the control fact is P3: **the
arrangement exists because the client cannot be the employer.** A party that signs, insures and
absorbs the loss is not arranging for someone else to provide the service; it is providing it.

## Decision

**CFS is the principal (D1).** The client's budget is CFS revenue; the crew cost is CFS's cost; both
are reported gross.

**A PSA is its own product line (D2)**, and its crew cost never absorbs into the rental or delivery
pools. ⚠️ **This is stated separately on purpose.** "PSA labor is not CFS's cost" and "PSA labor
must not absorb into the other pools" look like one claim and are two — **the second holds under
either answer to D1**, because spreading a PSA's crew cost over someone else's goods revenue would
be wrong however the revenue is presented. `ADR-0019`'s decision table asserts both as one row.

## Considered options

- **Agent — report only the fee, with the budget as money held.** _The charter's stated mechanism._
  Rejected on P1 and P3: CFS signs, insures and bears the loss, and the arrangement exists because
  the client cannot be the employer. ⚠️ **It is not an unreasonable reading** — it has one ASC 606
  indicator behind it (P2) and 7% of the live corpus.
- **Per-agreement classification, declared on each PSA.** Rejected as premature: the owner's answers
  describe one arrangement rather than a range, and a per-agreement flag invites the discriminator
  to become whoever wrote the invoice — which is **exactly the defect measured today**, where the
  same customer is billed both ways.
- **Leave it undecided and let the account on the line carry it.** Rejected: that is the status quo,
  and the status quo is M1.
- **Principal** (chosen).

## Consequences

- **The top line grows by the crew budget, and every margin computed from it changes shape.** Net
  income is identical. ⚠️ **This is a presentation change large enough to be noticed by anyone
  comparing years**, and it lands on top of a history that is itself inconsistent.
- ⚠️ **A CPA should confirm this before the first filed statement that depends on it.** One of the
  three applicable indicators dissents, the effect is material to the top line, and this repo
  produces the rules rather than the authority — the same limit `SPIKE-008` states about itself.
- ⭐ **The PSA cost side needs far less new machinery than erp-spec#35 assumes.** PSA payroll runs
  through an EOR (P4), and `OQ-024` already settled that **an EOR is not payroll — it is a vendor
  that invoices**. That is `obligation_accrued` → `vendor_bill_received`, already specified, and
  `ADR-0041`'s labor variance applies unchanged, because an EOR prices burden per payroll RUN
  whoever the crew is working for. **What PSA genuinely needs is the revenue side and its product
  line, not a payroll path.**
- **`2800` stays correct and stops being the mechanism.** Money received before the work is
  performed is a liability under every reference surveyed, so 2800 remains right as a holding
  account. What changes is that moving money through it is no longer _the service being sold_.
- ⚠️ **`charter.md` must be amended in the same change that lands the PSA posting rules**, not
  before and not after — its two sentences on PSA are the ones M1 contradicts.
- ⚠️ **The history stays inconsistent and no decision fixes that.** 93% of the invoiced value agrees
  with this decision and 7% does not, so the cutover carries **an inconsistent past rather than a
  consistent one presented differently** — a shape neither ADR-0020 nor ADR-0030 faces, and one the
  migration must state rather than silently normalise.
- ⚠️ **`4130 - PSA Income`'s $13,202.34 for FY2025 reconciles to nothing** — income recorded in Xero
  with no CFS invoice line naming that account. It must not be used to size PSA until the path that
  produced it is found, and this decision does not find it.
