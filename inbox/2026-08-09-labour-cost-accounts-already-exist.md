---
kind: finding
title: Labour cost is already recorded — in two places, with two different treatments
contexts: [ledger, fulfillment]
source: "api:2026-08-09:firestore prod cfs-3100 chart-of-accounts read + repo owner 2026-08-09"
confidence: high
promotes_to: [OQ-011]
verified: true
triage_count: 0
---

Own wages are recorded to **6600 Wages Expense**, in general operating expenses. Subcontractor cost
already sits on the COGS side at **5200 "Cost of Goods Sold: Subcontractors, Sales Commissions"**.

Live accounts touching labour:

```
6600  Wages Expense                              Expense
6720  Payroll Tax Expense                        Expense
5200  COGS: Subcontractors, Sales Commissions    Direct Costs / Expense
4120  Contract Labor Income                      Sales / Revenue
2160  Payroll Wages Payable                      Current Liability
2170  Federal Payroll Liability   2180 Other Payroll Liability   2190 State Payroll Liability
```

So two labour cost treatments already coexist: **own crew in opex, subcontractors in COGS.**

That reframes the charter's absorption model. It is not a from-scratch invention — it is moving
own-crew cost out of 6600 and into a dimensioned COGS account beside the 5200 that already exists.
Shorter path than "starts from zero", and it means there IS cost history to carry, though it is
undimensioned and unallocated to jobs.

Answers HOT-003 (does the `Crew` product line carry labour today) in two parts: the `Crew` product
line carries labour **revenue** at COA 4100; labour **cost** is real but lives at 6600, entirely
disconnected from the jobs that caused it. Nothing joins the two today — which is precisely the gap
the rebuild exists to close.
