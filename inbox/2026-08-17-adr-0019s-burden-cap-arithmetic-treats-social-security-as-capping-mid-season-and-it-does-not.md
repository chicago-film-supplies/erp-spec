---
kind: correction
title: >-
  ADR-0019's capped-burden arithmetic silently classifies Social Security as capping within a
  season — it caps at the SSA wage base, ~5,870 hours at $30/hr, so the uncapped floor is 12.20%
  rather than 6.00% and 7.65 points switch off rather than 13.85
contexts: [ledger, fulfillment]
source: "Arithmetic over ADR-0019's own stated components (18.36% statutory + 1.49% platform fee = 19.85%, measured on Wrapbook run 759715) · US employer payroll tax structure · found 2026-08-17 while attempting to decompose ADR-0019 into typed claims"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

⚠️ **ADR-0019 is `accepted` and FROZEN. This note is the instrument ADR-0034 row 3 provides** — a
fact it cited was wrong, the decision stands, so a dated note plus a hotspot rather than an edit or
a supersession.

## The arithmetic, from the ADR's own numbers

ADR-0019 measures Wrapbook run 759715 at **19.85%** — "statutory 18.36% plus a 1.49% platform fee".
The statutory 18.36% decomposes as the standard US employer set:

| component              |       rate | caps at                 | reached at $30/hr |
| ---------------------- | ---------: | ----------------------- | ----------------- |
| Social Security (FICA) |      6.20% | the SSA wage base       | **~5,870 hours**  |
| Medicare (FICA)        |      1.45% | never                   | —                 |
| FUTA                   |      0.60% | ~$7,000                 | ~233 hours        |
| Illinois SUTA          |      7.05% | ~$13,600                | ~453 hours        |
| workers compensation   |      3.06% | never                   | —                 |
| **statutory**          | **18.36%** |                         |                   |
| Wrapbook platform fee  |      1.49% | never (the ADR says so) | —                 |
| **total**              | **19.85%** |                         |                   |

## The defect

ADR-0019 says the caps leave "a **6.00%** uncapped floor of Medicare, workers comp and the platform
fee", against "**13.85 points that switch off** mid-season".

- `1.45 + 3.06 + 1.49 = 6.00` ✓ — internally consistent.
- `19.85 − 6.00 = 13.85` ✓ — internally consistent.
- **But the only components that cap within a season are FUTA and SUTA: `0.60 + 7.05 = 7.65`.**
- The missing `13.85 − 7.65 = 6.20` is **Social Security**, which the sentence treats as switching
  off mid-season without saying so.

⇒ **Social Security caps at the SSA wage base, not at a seasonal figure.** At $30/hr that is
thousands of hours — an order of magnitude beyond the 233 and 453 the ADR itself computes for FUTA
and SUTA, and beyond any hours a seasonal crew member works in a year.

**Corrected:** the floor a person's burden decays toward within a season is **12.20%**
(`6.20 + 1.45 + 3.06 + 1.49`), and **7.65 points** switch off, not 13.85.

⚠️ **The exact wage base is NOT pinned here and the finding does not depend on it.** It is roughly
$176k–$185k depending on the year; at $30/hr the lower figure is already ~5,870 hours. Anyone who
needs the precise number should take it from the SSA and pin it — this note deliberately does not
assert one it could not verify.

## What survives, and what does not

✅ **The DECISION is untouched.** Burden is still capped per person per year, a flat factor is still
systematically wrong rather than imprecise, `labor_variance` still fires, and the apportionment
still owes a period-close true-up. HOT-010's resolution "on that reasoning, not on impossibility"
stands.

⚠️ **What moves is the SIZE, by about half.** The seasonal bias between early-year and late-year
hours is **7.65 points of wage**, not 13.85. A variance sized at 13.85 points would be nearly twice
the real one, and the number's whole job in ADR-0019 is to say how big the true-up has to be.

⚠️ **OQ-050 carries the same defect with a THIRD number: "~4.51% uncapped floor of Medicare plus
workers comp".** That is `1.45 + 3.06` — it omits Social Security **and** the platform fee. ADR-0019
later corrected the fee half ("it is also uncapped, so the floor… is exactly 6.00%") and left the
Social Security half in place. So two live artifacts state two different wrong floors, and neither
is the arithmetic. **OQ-050 is mutable and is corrected directly; ADR-0019 is frozen and gets
HOT-018.**

## How it was found, which is the transferable part

**By attempting to type it, not by reading it.** The defect survived the ADR's acceptance, a
six-reference survey, HOT-016's correction of the same bullet, and every gate — because every stated
number in the sentence is individually correct and the sentence is internally consistent. What
exposed it was writing the components out as a table with a `cap_base` column per row: the column
forces the question "caps at what" for every component, and Social Security is the row where the
answer contradicts the prose.

⇒ **A missing column in a typed record is visible in a way a missing clause in a sentence is not.**
That is a measured argument for the typed-claims proposal that produced it — and it is narrower than
the proposal: what caught this was typing a MEASUREMENT, which is the part of these artifacts that
decomposes essentially perfectly. It is not evidence that the reasoning around it types well.
