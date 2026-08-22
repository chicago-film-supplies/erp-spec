---
kind: decision
title: >-
  Owner — a tracking category was on no externally filed document, which discharges the one
  load-bearing premise ADR-0020's survey could not measure and makes the $231,796.26 divergence
  cost nothing
contexts: [ledger, billing]
source: "Owner, 2026-08-22, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Answers the premise flagged as unmeasurable by
`inbox/2026-08-20-survey-it-is-a-recast-not-a-restatement-and-the-migration-delta-is-231796-in-lines-untracked-by-both-systems.md`,
which stated it twice — once in the criteria section and once under _What was NOT verified_ — and
said outright: **"Everything above rests on it."**

## The question, and the answer

**Asked:** was a CFS tracking category ever on an externally **filed** document — a tax return, a
lender or investor package, an audited statement? Explicitly not an internal management report.

**Owner, 2026-08-22: NO. Tracking is internal only.** Filed documents carried account totals; the
tracking-category slice never left the building.

## What it discharges

- ⭐ **The six references' criteria collapse to two — _was it published_, and _what would the write
  fail to reach_ — and CFS now demonstrably fails neither.** The second half was already settled
  mechanically: a tracking category updates no balance. The first half was this question.
- **No recast disclosure is owed to anybody.** ASC 205-10-50-1 attaches to a party that received the
  earlier presentation. There is none. ASC 280 binds public entities only and CFS is not one, so the
  ASU 2023-07 BC83 vocabulary is the right _word_ without being a _requirement_.
- **The $231,796.26 migration delta — 106 lines, 15.66% of pre-lock revenue, untracked in BOTH
  systems — costs nothing.** v2 will disagree with Xero's tracking-sliced P&L by that amount, and no
  external reader ever saw the number it disagrees with.
- ⇒ **The 2025-12-31 period lock stops being an obstacle to ADR-0020 and becomes an internal
  control.** The survey already established the lock is a setting rather than a physical
  impossibility, and that Sage Intacct's "ensures GAAP compliance is maintained" is a control choice
  wearing a standards label. This ruling removes the last reason to treat it as more.

## What it does NOT discharge

- ⚠️ **It says nothing about the derivation.** The recommendation stands on its own ground: derive
  the product line from the product master, declare a null where there is nothing to derive from.
  This ruling makes that _permissible_; ADR-0036 and `migration/field-map.yaml` are what make it
  _correct_.
- ⚠️ **It says nothing about the 128 custom lines.** They have no master to derive from, and OQ-025
  plus `reporting/product-line-pl.yaml` already hold the house pattern — a declared null, shown on
  its own row.
- ⚠️ **Present-but-wrong tracking is a live defect and is unaffected.** Several categories map to
  two Xero option ids; one line bills bottled water under `Surface Protection`; 151 lines are
  CFS-empty but Xero-set. All of it passes every existence check. It belongs in api-cloudrun
  (api-cloudrun#597), not here, and no ruling about filing touches it.

## The shape worth carrying

⭐ **A premise nobody can measure from documentation is not therefore unknowable — it is addressed
to a person rather than to a corpus.** The survey did the right thing by naming it, refusing to
assume it, and stating what rested on it. It sat unanswered for two days because it was recorded as
a research gap rather than as a question with an owner. **When a survey finds a premise only the
owner can settle, that is an `OQ-` with a name on it, not a caveat.**
