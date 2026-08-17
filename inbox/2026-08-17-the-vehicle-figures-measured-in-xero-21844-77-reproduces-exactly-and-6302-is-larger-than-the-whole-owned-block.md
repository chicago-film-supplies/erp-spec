---
kind: finding
title: >-
  The vehicle figures measured in Xero — $21,844.77 reproduces EXACTLY, 6302 is 1.75× the whole
  owned block, the live P&L splits the vehicle accounts across two subtotals, and 5902's population
  measures one bill
contexts: [ledger, fixed-assets]
source: "xero:2026-08-17:get-report-profit-and-loss FY2025 + get-contacts + get-invoices, read OUTSIDE erp-spec"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

ADR-0030 was accepted 2026-08-16 recording that its own headline number was **unpinned and not
re-derivable from this repo's permitted sources**. That statement is still true — this measurement
was taken from the session, not from the repo, which is the distinction the ADR draws. Here is the
number it asked for.

## 1. ✅ `$21,844.77` reproduces to the cent

FY2025, `xero:2026-08-17:get-report-profit-and-loss`:

| account                             |        FY2025 |
| ----------------------------------- | ------------: |
| 6400 Vehicle: Repairs & Maintenance |     10,026.32 |
| 6401 Vehicle: Registrations & Fees  |      1,018.34 |
| 6402 Vehicle: Fuel                  |      6,532.35 |
| 6403 Vehicle: Parking & Tolls       |        631.88 |
| 6404 Vehicle: Tickets               |      3,635.88 |
| **total**                           | **21,844.77** |

**The figure was right all along; only its provenance was missing.** Worth stating because the
instinct on finding an unsourced number is to distrust the number. What was actually wrong was that
nothing could re-derive it — a different defect with a different fix, and the fix is this note. 6404
also reproduces its stated `$3,635.88` exactly.

## 2. ⚠️ The live P&L splits the vehicle block across TWO subtotals, and that is worse than "below gross profit"

The spec already recorded that 6401 is Xero type `Overhead` while the other four are `Expense`, and
called it harmless to the face of the P&L. **It is not.** Xero's standard layout puts `Overhead`
accounts in **Operating Expenses** and `Expense` accounts in **Other Income and Expense** — so:

- **6401 sits ABOVE** `Operating Income / (Loss)` — $412,774.19 for FY2025;
- **6400, 6402, 6403, 6404 sit BELOW it.**

⇒ Today's operating income includes vehicle registrations and excludes fuel, repairs, parking and
tickets. **One vehicle in two places on one statement.** The earlier note said a migration keyed on
account TYPE would split them; the split is already there, in the report the business reads.

## 3. ⚠️ 6302 is $38,216.91 — 1.75× the entire owned-vehicle block

`6302 Rented Tools, Machinery, Equipment` is **larger than 6400–6404 combined**, which makes the
6302 / 5100 / 5902 three-way split materially more important than it looked when it was decided from
the account's name alone.

## 4. ⚠️ AND YET 5902's measurable population is ONE BILL

`xero:2026-08-17:get-invoices` by contact:

- **Chicagoland Truck Rental** — the vendor the owner named as the main source of hired delivery
  trucks — has **two bills ever**: `Cube Truck 12/11, 12/12` at **$429.58** (2025-12-12, PAID) and
  one at $723.04 dated 2026-01-13 which is **DELETED** and therefore not in the books.
- **Elite Truck Rental** — the only other truck-named contact — has **zero invoices**.

⇒ Measured hired-truck spend in FY2025 bills: **$429.58, which is 1.1% of 6302.**

**This is the repo's own rule turned on work done hours earlier.** `5902 COGS: Vehicle (Hired)` was
minted, given a treatment, and argued through a reversal — all on the strength of a qualitative
statement, with **nobody measuring the population**. _An unexercised branch of a rule is a claim,
not a capability_ is the standard, and it was not applied here.

⚠️ **The measurement is a LOWER BOUND and must not be read as the answer.** `get-invoices` returns
ACCPAY **bills**; a truck rental paid by card is a **bank transaction**, and $38,216.91 in 6302
plainly does not arrive as bills from these two contacts. **The truck share of 6302 is still
unsettled** — what is settled is that the bill-side evidence for it is one line.

**What would settle it:** the account-transactions detail for 6302 across FY2025, by source
document, which separates card spend from bills. Until then 5902 is correct in principle and
unmeasured in fact.

⚠️ **It does not make ADR-0030 wrong**, and no hotspot is opened: a hired truck genuinely is
direct-at-actual COGS whatever the amount, so the RULE stands and only its materiality is in
question. The ADR is accepted and frozen (ADR-0034); this note is the correction index.

## 5. The comparability break, quantified

FY2025 as reported: revenue **$646,766.51**, cost of sales **$61,173.21**, gross profit
**$585,593.30** — a **90.54%** gross margin.

With ADR-0019 and ADR-0030 in force, COGS additionally absorbs wages ($172,261.35), vehicle running
cost less tickets ($18,208.89) and hired trucks (≥$429.58):

⇒ gross margin falls from **90.54% to about 61%**, roughly a **29-point** drop, with **net income
unchanged at $83,186.55**.

⚠️ **61% is a FLOOR, not the answer.** The $172,261.35 is the whole `6600 Wages` line and only crew
hours move — administrative wages stay in operating expenses, so the real figure sits somewhere
between 61% and 90.5%. **Splitting 6600 is the measurement that would close it**, and it is the same
shape of question as the 6302 split.

This is the comparability break ADR-0030 records, with a number on it: **anyone comparing gross
margin across the cutover is comparing 90% to 60% and seeing a collapse that did not happen.**

## Two things noticed on the way past

- **`Sunbelt Rentals` exists twice** as a Xero contact — `Sunbelt Rentals` and
  `SUNBELT RENTALS #000`. A duplicate vendor in the incumbent, and the likeliest holder of the
  scissor-lift/forklift population 6302 keeps.
- **`Cost of Goods Sold: Subrentals` (5100) is $19,202.94** — so the account ADR-0030 declined to
  put hired trucks into is itself substantial, which is the reason getting that boundary right
  matters beyond tidiness.
