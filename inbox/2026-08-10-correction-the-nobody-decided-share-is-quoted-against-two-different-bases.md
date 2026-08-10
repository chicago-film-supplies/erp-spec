---
kind: correction
title: Correction — "0.141%, not 28.7%" compares a share of untracked revenue against a share of total revenue; on one base the factor is ~705, not ~200
contexts: [ledger, billing]
source: "arithmetic on the table in inbox/2026-08-10-the-untracked-revenue-denorm-is-repaired-and-28-7-percent-is-now-15-percent.md — $688.00 / $486,516.99 vs $688.00 / $1,688,980.87"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects a presentation of a number in
`inbox/2026-08-10-the-untracked-revenue-denorm-is-repaired-and-28-7-percent-is-now-15-percent.md`,
which is append-only and stands as written. The measurement is right; the comparison is not.

## The mismatch

That note states, and the commit message repeats:

> **"Nobody decided" was $688.00 of $486,516.99 — 0.141%.** Not 28.7%

$486,516.99 is the **untracked population**. $688.00 / $486,516.99 = 0.141%, correctly. But 28.7% is
a share of **all line revenue** ($1,688,980.87). The two figures sit either side of "not" with
different denominators, so the sentence reads as one comparison and is two.

| figure                         | base             |      value |
| ------------------------------ | ---------------- | ---------: |
| $688.00 / untracked revenue    | $486,516.99      | **0.141%** |
| $688.00 / **all line revenue** | $1,688,980.87    | **0.041%** |
| 28.7% (the figure contrasted)  | all line revenue |      28.7% |

On a consistent base the correction is **28.7% → 0.041%, a factor of ~705**. The note's own "factor
of 200" is 28.7 / 0.141, which divides a share-of-total by a share-of-untracked.

## Why this is worth its own note rather than a footnote

The understatement is in the conservative direction, so nothing downstream is overstated — but this
is the **third** base-mismatch found in this corpus in three days, after
`inbox/2026-08-09-correction-the-unallocable-population-is-smaller-and-is-one-customer.md` (the
unallocable population measured under a base the spec does not state) and the 4110 split. The
recurring shape is not carelessness about arithmetic; it is quoting a ratio without its denominator,
in a corpus where "revenue" can mean total, tracked, untracked, tax-inclusive or tax-exclusive.

**A percentage in this repo should not be written without its base.** The structured artifacts
amended on 2026-08-10 all now carry "$688.00 — 0.041% of all line revenue", with the
share-of-untracked given in parentheses where the contrast is useful.

## Which base to cite

**Share of all line revenue.** It is the base 28.7% used, the base 15.00% uses, and the only one on
which the before/after figures in every amended artifact are comparable to each other.

## Superseded inbox notes, for the record

Append-only, so none is edited. Every product-line or untracked-revenue figure in these was measured
off `items[].tracking_category` and is superseded by the 2026-08-10 product-master join:

- `2026-08-08-untracked-revenue-share.md` — the original 28.7%
- `2026-08-08-two-tracking-defects.md`
- `2026-08-08-verification-pass-summary.md`
- `2026-08-08-shipping-trucking-tracking-refuted.md` — the `Transport` refutation, itself refuted
- `2026-08-09-product-line-dimension-coverage.md` — 383 lines / 28.74%
- `2026-08-09-product-line-by-revenue-account-matrix.md` — the matrix `Transport` was dropped on
- `2026-08-09-untracked-revenue-decomposes-into-three-populations.md` — 2.8% / 22.1% / 4.0%
- `2026-08-09-untracked-revenue-is-mostly-a-denorm-failure-not-an-undecided-dimension.md` — 51.8% /
  48.0% / 0.1%, the first note to read the product master and the one that got the direction right

`2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md` is **not** superseded by the
join — its allocation figures are pending a re-run that is blocked on erp-spec#15, and until that
runs they remain the only measurement there is.
