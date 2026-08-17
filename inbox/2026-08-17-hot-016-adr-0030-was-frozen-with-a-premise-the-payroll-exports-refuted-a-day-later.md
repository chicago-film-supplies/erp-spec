---
kind: correction
title: >-
  HOT-016 — ADR-0030 was ACCEPTED and FROZEN with a premise the payroll exports refuted a day later,
  and three MUTABLE artifacts still repeat it; the first use of ADR-0034's "a fact it cited was
  wrong" path, which every existing hotspot had left untravelled
contexts: [ledger, fulfillment]
source: "adr/ADR-0030 (frozen 2026-08-16) against Wrapbook payroll 759715, measured 2026-08-17"
confidence: high
promotes_to: [HOT-016]
verified: true
triage_count: 0
---

## The contradiction

**ADR-0030, accepted and frozen 2026-08-16**, states as a supporting contrast:

> ADR-0019 could say "absorption measures utilisation, **not** rate variance" because labor is
> costed at actual, from a real per-contact wage on a real bill. **Vehicle cost cannot be**…

**Measured 2026-08-17** against the Wrapbook exports (OQ-050): labor is **not** costed at actual.
Wages are itemised per person, but **burden is priced per RUN** and must be apportioned — so labor
costing is normal costing with a standard-rate component, and `labor_variance` fires. The premise
was true when written and false a day later.

⚠️ **The DECISION is unaffected.** Vehicle absorption is still rate-based, `5901` still means
utilisation plus rate deviation, and nothing about ADR-0030's accounts or basis changes. What is
wrong is the **contrast** it drew, not the conclusion it reached.

## Why this is a hotspot and not a superseding ADR

ADR-0034's table has three rows and this is the third: **"stands, but a fact it cited was wrong" ⇒
no new ADR. A dated note in `inbox/`, plus a `hotspots.yaml` entry when it contradicts something.**
It does contradict something — ADR-0019's amended body now says the opposite — so rule 5 applies.

⚠️ **This is the FIRST use of that path.** All ten existing hotspots (HOT-006…HOT-015) are
`resolved`, and every one carries `resolved_by: ADR-XXXX` — they are all "two statements conflict
and a DECISION settles it". None is "an accepted ADR cited a fact that later measured false". By
this repo's own standard — _an unexercised branch of a rule is a claim, not a capability_ — the
machinery behind it should be assumed not to work until taken.

## ⚠️ Three MUTABLE artifacts still repeat the refuted claim, and two are my own amendment's fault

The frozen ADR-0030 text is **correct as a historical record** (ADR-0034) and stays. What must move
is everything live:

| artifact                                          | what it says                                                                    | mutable?                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| `adr/ADR-0030` line 231                           | _"because labor is costed at actual"_                                           | **no — frozen, and correctly so** |
| `adr/ADR-0019` **title**                          | _"Labor costing is actual; absorption measures utilisation, not rate variance"_ | yes — still `proposed`            |
| `adr/ADR-0019` **summary blockquote**             | _"we decided to cost labor at actual and let absorption measure utilisation"_   | yes                               |
| `ledger/chart-of-accounts.yaml` **5800's reason** | _"at that person's actual per-contact wage"_                                    | yes                               |

⚠️ **The ADR-0019 title and summary were left behind by MY OWN amendment.** The body was corrected
to the measurement and the two most-cited surfaces were not — **ADR-0019 has 121 citations across
the spec**, and a title is what a reader takes away without opening the file.

**That is precisely the HOT-011 / HOT-015 pattern repeating**: a rule amended in some artifacts
while another is left stating the refuted reading. HOT-015's own text describes it as _"HOT-011
surviving in the one artifact its resolution did not sweep"_. This is the third instance, and the
first where the incomplete sweep was made by the same session that found the defect.

⇒ **Amending a body is not amending a decision.** The title, the summary and every downstream
restatement carry the claim too, and only the body was checked.

## Resolution

Amend the three mutable artifacts to the measurement. ADR-0030 stays as written.

⚠️ **The resolution has no ADR behind it**, which is the machinery gap this exercise was expected to
find: every prior hotspot resolved via `resolved_by: <an ADR>`, and this one is resolved by **a
measurement** — the Wrapbook exports — with no decision taken at all. What that means for the
`resolved_by` field is recorded on HOT-016 itself.
