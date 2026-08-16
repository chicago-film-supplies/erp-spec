---
kind: finding
title: The whole book-to-tax difference is two accounts — depreciation and retail inventory — and it reconciles to the cent
contexts: [fixed-assets, tax, ledger]
source: "owner-supplied 2025 statements, both bases (Xero GAAP + tax package), measured 2026-08-09"
confidence: high
promotes_to: [REQ-TAX-002]
verified: true
triage_count: 0
---

The owner supplied CFS's actual 2025 statements on **both** bases — balance sheet and P&L, three
comparative years each. Measured account by account rather than read: the tax and GAAP statements
differ in **exactly two accounts**, and every other difference is those two flowing through.

## P&L, year ended 2025-12-31 — 52 of 60 lines byte-identical

|                             |           tax |          GAAP |             Δ |
| --------------------------- | ------------: | ------------: | ------------: |
| 7000 Depreciation Expense   |    115,606.29 |     52,052.81 |     63,553.48 |
| 5000 COGS: Retail Inventory |     36,985.62 |     36,880.02 |      (105.60) |
| **Net Income**              | **19,443.71** | **83,102.79** | **63,659.08** |

63,553.48 + 105.60 = **63,659.08**. Zero residual. Holds for 2024 (−22,132.79 + 152.87 = −21,979.92)
and 2023 (225,274.77 + 0.66 = 225,275.43) as well.

## Balance sheet, 2025-12-31

|                                        |            tax |             GAAP |              Δ |
| -------------------------------------- | -------------: | ---------------: | -------------: |
| accumulated depreciation, six accounts |   (579,442.99) |     (111,804.31) |     467,638.68 |
| 1400 Retail Inventory                  |      43,392.63 |        43,651.76 |         259.13 |
| **Total Assets**                       | **824,225.75** | **1,292,123.56** | **467,897.81** |
| **Total Liabilities**                  | **502,453.95** |   **502,453.95** |       **0.00** |
| **Total Equity**                       | **321,771.80** |   **789,669.61** | **467,897.81** |

467,638.68 + 259.13 = 467,897.81 = the assets difference = the equity difference. **Liabilities are
identical to the cent.** The cumulative inventory difference of 259.13 is exactly the fold of the
three annual COGS differences (0.66 + 152.87 + 105.60).

## Four things this settles

1. **The tax basis is ACCRUAL** — confirmed by the owner and visible in the data before he said so:
   1200 Accounts Receivable is 25,824.26 and 2000 Accounts Payable is 30,240.04 on **both** balance
   sheets. A cash-basis tax statement carries neither. (OQ-027)
2. **ADR-0026's derivation is exact, and has TWO components rather than one.** The ADR said the tax
   book is derived from the fixed-asset register. Retail-inventory costing is the second component
   and it is not the register — small ($259.13 cumulative) but structurally a second source.
3. **Permanent differences are in NEITHER book.** 6005 Meals & Entertainment 17,777.88, 6011
   Political Expenditures 1,250.00 and 6404 Vehicle: Tickets 3,635.88 are identical on both
   statements, and all three are nondeductible or half-deductible. They are Schedule M-1 adjustments
   **on the return**, downstream of both sets of statements. Neither book should try to carry them.
4. **The §179 pattern is in the series.** Tax depreciation 2023 was 240,613.43 against GAAP's
   15,338.66; by 2024 it inverts (21,151.20 against 43,283.99) because the §179'd assets have no tax
   basis left to depreciate. Rental inventory is **92.4% depreciated for tax and 11.9% for GAAP**
   (1501: tax 474,452.21 of 513,292.66 cost, GAAP 61,006.44).

## Two consequences for migration

- **Opening equity differs by book.** 3000 Member Equity / Opening Balance is 266,586.46 on the tax
  basis and 467,529.68 on GAAP; 3100 Retained Earnings is 35,741.63 against 239,037.14. Opening
  balances load per book, and the difference is the accumulated basis divergence of prior years.
- **The tax depreciation number is produced by hand today.** The tax P&L annotates 7000 with "**
  From Tax Depreciation Schedule in Asset Accountant" — the hosted register ADR-0007 replaces. The
  architecture ADR-0026 describes is what CFS already does manually: the register supplies the tax
  number and it is substituted into the statements.

## Reproducing this

`deno run --allow-read` over the four CSVs, parsing "(1,234.56)" to signed cents and diffing by
account label. The raw statements were not committed — they are the owner's, and the derived
comparison above is what the spec cites.
