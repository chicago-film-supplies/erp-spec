---
kind: research
title: What the 6th/7th day actually is, who bears an overtime premium, and where a labour credit leg lands
contexts: [fulfillment, ledger]
source: vendor and payroll-industry documentation + Illinois statute, surveyed 2026-08-09
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed to move the three blockers on `shift_recorded` — OQ-018 (who bears the overtime
premium), OQ-019 (what a consecutive day is), OQ-024 (the credit leg). Owner named Wrapbook,
GreenSlate and Entertainment Partners as the references for the second.

## OQ-019 — the 6th/7th day: two different definitions, and they are not interchangeable

| Source | Definition |
|---|---|
| **Entertainment Partners** (Pact/Bectu HETV) | "A sixth day is where a crew member works six days **in a row**" → 1.5T; seventh day in a row → 2T. Crew are **prohibited from working eight days in a row**. |
| **GreenSlate** | Treats 6th/7th day premiums as a **union** construct — IATSE "On Call", Animation Guild 839 (6th day 1.5×, 7th day raised 1.5×→2× effective 2024-12-29). Non-union is production policy. |
| **Wrapbook** (non-union) | Follows the **legal** baseline: FLSA is weekly-40 only; California's seventh-day rule triggers on the seventh consecutive day **within the employer-defined workweek**, not on consecutive days worked. |

So the industry/union convention is **consecutive days worked**, and the statutory convention
(where one exists at all) is **relative to a defined workweek**. They give different answers for
someone working Thursday through Wednesday — which is exactly what OQ-019 asked.

**⚠️ The binding constraint for CFS is neither of those.** Illinois **ODRISA**, as amended
effective 2023-01-01, requires **24 consecutive hours of rest in every consecutive seven-day
period** — changed from "one day of rest per calendar week", precisely to stop employers scheduling
more than seven straight days across a week boundary. Violations are civil offences at up to **$250
per offence**, and **each seven-day period without the rest is a separate offence**. Exemptions are
narrow: part-time ≤20 hours/week, machinery breakdown or emergency, seasonal agriculture.

**A seventh consecutive day is therefore not a thing to price — it is a thing to prevent.** Any
seventh-day rate CFS states is a rate for a day that Illinois law generally forbids. (Who carries
the ODRISA obligation when the crew are paid through an employer of record is a legal question, not
a spec question — flagged, not answered.)

Sources: <https://www.ep.com/blog/types-of-working-days-in-the-uk-hetv-industry-and-what-they-mean/> ·
<https://greenslate.com/blog/the-animation-guild-local-839-increases-and-changes> ·
<https://help.wrapbook.com/docs/non-union-time-calculations> ·
<https://labor.illinois.gov/content/dam/soi/en/web/idol/laws-rules/fls/odrisa/One%20Day%20Rest%20in%20Seven%20Act%20Eff.%20Jan%201%202023.pdf> ·
<https://www.jacksonlewis.com/insights/illinois-amends-one-day-rest-seven-law-significant-revisions>

## OQ-018 — the overtime premium: the convention is already what the owner proposed

Standard cost accounting splits an overtime hour in two and treats the halves differently:

- **The base rate** for the hour is **direct labour**, charged to the job worked, exactly like any
  other hour.
- **The premium** — the extra half or full rate — is **NOT a direct charge**. It is recovered as
  overhead and allocated across jobs, because the premium is caused by the volume of work in
  aggregate rather than by whichever job happened to be on the clock after hour eight.

Two named exceptions:
- **Customer-requested overtime** is charged direct to the job that asked for it.
- **Overtime caused by inefficiency or poor planning** is a period cost, not a product cost.

Sources: <https://www.accountingformanagement.org/treatment-of-idle-time-overtime-and-fringe-benefit-costs/> ·
<https://www.double-entry-bookkeeping.com/costing/overtime-premium/>

This is the same answer OQ-018 was circling: chronological attribution makes the same two jobs in
the opposite order produce different COGS, which is why no textbook uses it.

## OQ-024 — the credit leg is measurable, and the statements measure it

The question assumed a payroll liability had to be found. **CFS does not have one, and its own
balance sheet proves it.** Current liabilities at 2025-12-31, both bases:
2000 Accounts Payable, 2100 credit cards, 2200 Sales Tax, 2600 Rounding, 2801/2802 PSA. **No
payroll liability of any kind** — consistent with all four live payroll accounts (2160, 2170, 2180,
2190) being Archived.

That follows from the charter, which makes payroll processing a non-goal: an external **employer of
record** stays, and "CFS schedules labour and records shifts; it does not calculate withholding,
file payroll tax, or move payroll money." An EOR is not payroll — **it is a vendor that invoices**.
So the credit leg is the ordinary one for a vendor bill.

ADR-0019 already pointed here — "cost flows from the purchase order / bill that labour scheduling
generates" — but called it an inference from account status. It is no longer an inference: a
company that owed wages would show the liability, and this one shows none, across four years.

## Forced calls — what the owner asked about, for the record

A **forced call** is a short turnaround: a crew member called back with less than the agreed rest
period between wrap and next call. Union thresholds are 12 hours (SAG-AFTRA, sometimes 11) and 10
hours (FIST). Penalties differ in kind — SAG-AFTRA pays a flat penalty per violation (day performer:
the lesser of daily rate or $900), while FIST treats the shortfall as **overtime hours**, which is
the version that would fit a costing model. **Non-union has no statutory turnaround rule at all**,
so any CFS threshold is policy.

Sources: <https://www.sagaftra.org/rest-periods-forced-calls-0> ·
<https://beverlyboy.com/filmmaking/what-is-a-forced-call-on-a-film-set/> ·
<https://fsufilmhandbook.com/fist-agreement/>
