---
kind: decision
title: >-
  Owner refines the PSA credit-risk answer — the client is obligated to repay, but CFS is small and
  an overseas client may be difficult to collect from; both halves point at PRINCIPAL and the second
  is the one that sizes the exposure
contexts: [ledger, billing]
source: "Owner, 2026-08-22, in session, refining OQ-053's third question"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Refines the third answer captured in
`inbox/2026-08-22-owner-answers-oq-053-cfs-signs-insures-and-eats-the-loss-on-a-psa-and-uses-an-eor-for-the-payroll.md`,
which recorded the option label _"CFS eats it"_ rather than the owner's own words. That note is
append-only and stands; this is the primary phrasing.

## What was said

> _"we would chase the customer for the loss"_ … _"they would be obligated to it, but were small and
> if theyre overseas it may be difficult to collect"_

## ⭐ Both halves point at PRINCIPAL, including the one that sounds like a hedge

**"They would be obligated to it" is the stronger of the two, and it is a statement about who owes
whom.** CFS pays the crew and then pursues the client — which means **CFS holds a receivable for the
FULL BUDGET**, not for a fee.

⇒ **An agent never holds that receivable.** Under the agency reading the crew's claim runs against
the client directly and CFS is only facilitating; the most CFS could be owed is its commission.
**Being owed the whole budget is only possible because CFS paid the whole budget as its own
obligation.** ⭐ **You can only chase someone who owes YOU**, and that is the control fact restated
in collections language.

**"Difficult to collect" is credit risk REALISED, not credit risk absent.** A right of recovery that
may prove worthless is precisely what bearing the risk means — if collection were certain there
would be no risk to bear. ⚠️ **The hedge is the evidence**, and it is worth saying so plainly
because it reads at first like a softening of the answer.

## ⚠️ What it changes: the exposure is on the BUDGET, not on the fee

The gross-up cuts both ways, and only one direction gets discussed:

- **Revenue is larger** — the client's whole budget rather than CFS's fee.
- **So is the maximum bad-debt exposure.** An unrecovered PSA budget is a write-off against
  `1200 - Accounts Receivable` to `6900 - Bad Debt`, at the size of the budget. Under the agency
  reading it would never have been revenue and the write-off would be a fraction of it.

⇒ **The accounting decision does not create this risk. It reveals it on the face of the
statements**, which is an argument for the principal treatment rather than against it: **a small
company fronting a full production budget to an overseas client is exposed whether or not its income
statement says so.**

## ⭐ AND IT GIVES `2800` A SECOND LIFE, AS A CONTROL RATHER THAN A MECHANISM

`ADR-0044` takes `2800 - PSA Liability Clearing` away from `charter.md`'s reading — moving a
client's payroll through it is **not** the service being sold. **This refinement hands it a better
job.**

If the client funds **before** the crew is paid, the exposure never opens: money received in advance
of performance is a liability under every reference in the 2026-08-17 survey, sits in `2800`, and is
relieved as the work is performed. ⇒ **`2800` is the control that bounds the credit exposure the
principal treatment reveals** — and under a principal reading with a hard-to-collect overseas client
base, _funding in advance_ stops being a cash-flow preference and becomes the primary mitigation.

⚠️ **This is a policy question the spec should surface rather than assume**: is advance funding
required on a PSA, or merely usual? The measured corpus cannot answer it — only **$7,000.00** of
PSA-shaped value ever passed through `2800` (`ADR-0044/M1`), against 93% billed gross with no
holding step at all. **If advance funding is the real policy, the books do not show it.**
