---
kind: survey
title: >-
  Survey — an unpaid owner shift is not an expense under GAAP, and all six references fence imputed
  labour out of the financial statements; the two that DO post it both fence the OFFSET, and none of
  them credits a payable
contexts: [ledger, fulfillment]
source: "Owner, 2026-08-16, in session · ASC 958-605 · Xero Projects · SAP S/4HANA secondary cost elements · NetSuite job costing · Sage Intacct labor cost posting · Odoo analytic accounting"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

**Owner, 2026-08-16:** _"i think what we need is a line in the labor pos or bills that allows for an
owner shift unpaid or paid, so that unpaid owner shifts dont dilute cogs."_

Surveyed per CLAUDE.md → _Accounting decisions_. **The survey does not come back unanimous, and the
split is the useful part.**

## The question, stated precisely

An owner works a shift. It absorbs against a causal job like any other (ADR-0019, `shift_recorded`).
**No wage is paid and no vendor will ever invoice for it.** Two things can go wrong and they are
opposite:

- **Post it as a normal shift** → 5800 is debited and **2010 Accrued Expenses: Received Not
  Invoiced** is credited, asserting a liability to the owner that does not exist and will never be
  relieved by a bill. 2010's balance — whose entire purpose is "received not invoiced" — stops
  meaning anything.
- **Post nothing** → the job's COGS excludes real work, gross margin is overstated, and the
  absorbed/unabsorbed utilisation number silently omits owner hours. **This is the "dilute COGS" the
  owner names**: a business that looks more profitable than a sustainable one, because some of its
  labour is free and nothing says so.

## The six

|                      | treatment of an imputed / uncompensated labour cost                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**             | **No expense.** ASC 958-605 (contributed services) is **not-for-profit only** — it is what lets an NFP recognise donated specialised services. A for-profit entity recognises nothing for owner labour it did not pay for: no obligation arose, so no expense was incurred.                                                     |
| **Xero** (incumbent) | Projects carries a per-staff **cost rate** and reports Cost / Charge / Invoiced per time entry. **"Xero Projects isn't integrated into the P&L."** A cost rate is a project-layer number and posts nothing.                                                                                                                     |
| **SAP S/4HANA**      | Activity type × activity price, charged through a **secondary cost element**. **"Secondary cost elements do not cause any change in any values in the Financial Accounting module"** — the allocation flows in CO only, with no FI involvement.                                                                                 |
| **NetSuite**         | ⚠️ **Posts.** Posting time debits the project expense account and credits a **project cost variance account**. Non-posted time creates no journal entry, so posting is a deliberate act.                                                                                                                                        |
| **Sage Intacct**     | ⚠️ **Posts — into a fenced range.** Project labour cost posts to GL accounts "outside of regular financial accounts (such as **9xxx**)… which will exclude them from all standard financial reports". And explicitly: **"These are ESTIMATED labor costs used for project costing; ACTUAL labor cost will come from Payroll."** |
| **Odoo**             | **Analytic only.** Timesheet cost is an analytic line, and analytic entries "do not match any entry in the general account… without exact counterparts in the general accounts".                                                                                                                                                |

## The DEFAULT: 4 of 6 keep it out of the statements entirely

GAAP, Xero, SAP and Odoo all keep an uncompensated labour cost out of the financial statements.
NetSuite and Intacct post it — **and both fence the offset.**

## ⚠️ The CRITERION, which is what the survey is actually for

All six draw the same line, and it is not "GL or not GL". It is:

> **Does this cost represent an obligation the entity actually incurred?**

If yes, it belongs in the financial statements. If no, it belongs in a costing layer that is
**fenced off from them** — and each reference fences it a different way: Odoo by not being in the GL
at all, SAP by a secondary cost element that cannot reach FI, Intacct by a 9xxx range excluded from
standard reports, NetSuite by an offsetting variance account.

⚠️ **The load-bearing agreement is on the CREDIT side, and it is unanimous across all six: NOBODY
CREDITS A PAYABLE.** That is the exact defect posting an unpaid owner shift through `shift_recorded`
would create — 2010 Accrued Expenses: Received Not Invoiced credited for a bill that will never
arrive. The two references that post an imputed cost both send the credit somewhere that nets out or
is excluded, precisely because no third party is owed.

**Intacct states the two-books structure outright** — estimated for costing, actual from payroll —
and that is the CFS case exactly: an owner shift's _actual_ cost is zero and its _imputed_ cost is a
real crew-day.

## ⚠️ THE MIGRATION DELTA, and the incumbent already had an answer this repo proposed to delete

`ledger/chart-of-accounts.yaml` carries **`3130 Owner's Capital: Owner's Billable Time`** — an
equity account, **Archived** in the live chart, with `disposition: drop`. Its reason, as this repo
wrote it:

> Archived. Owner time that is billable is labour, and under ADR-0019 labour is costed at actual
> into 5800/5801 against the job that caused it — booking it to equity would put the cost outside
> COGS entirely and leave it out of every margin.

**That reasoning reads the account as the DEBIT side, and it is the CREDIT side.** Booking owner
time to equity _instead of_ COGS would indeed lose it from every margin. Booking the **debit to
5800** and the **credit to owner's capital** does the opposite: the job bears the cost, and the
credit records that it was _contributed_ rather than _owed_. **The live chart already contained the
fenced offset the survey says every system needs**, and the spec proposed dropping it while
describing a different account.

⚠️ It is Archived, so it is not in use today, and the delta is unmeasured: **how many owner shifts
have ever been worked is not recorded anywhere**, because the current system has no absorbed-labour
stage at all (erp-spec#14: "the population that makes 2010 material is labour, which measures as
zero everywhere"). **The delta cannot be measured before v2 runs, and that is the finding rather
than a gap to fill.** What would measure it: a `compensation` discriminator on the shift record from
day one, so the population is countable the moment the stage exists.

## The recommendation, for the owner to accept or reject

**A `compensation` discriminator on the shift, and an unpaid owner shift writes NO TRANSFER.**

- `shift.compensation: paid` → `shift_recorded` posts exactly as today (Dr 5800/5801, Cr 2010).
- `shift.compensation: contributed` → **no transfer at all.** No obligation was incurred, so the
  GAAP books say nothing — the majority answer, and the one GAAP requires of a for-profit entity. ⚠️
  **The shift record and its `absorbed_allocations` are written regardless**, carrying hours and the
  causal job, so the costing layer keeps everything it needs.
- **The imputed cost is a REPORT, not a posting.** ADR-0036 already built the two-layer architecture
  this needs — TigerBeetle holds the GL, Mongo holds the projection, and every classification is
  derived at report time. An imputed owner rate is a Mongo-layer fact by exactly the same argument,
  and "cost of a job including contributed labour" is one of the "other combos" the owner's earlier
  ruling makes cheap. **The survey's criterion and this repo's existing architecture agree**, which
  is the strongest form of a recommendation.

⚠️ **What this DOES NOT do, stated so it is not discovered later.** The GAAP gross margin will still
be flattered by contributed labour — that is what GAAP requires, and it is why the imputed report
has to exist rather than being optional. **A margin that is honest only in a report nobody runs is
not honest.**

⚠️ **The rejected alternative is live and is NetSuite's**: post Dr 5800 / Cr an owner-contribution
account, so the GAAP margin is right and the credit is fenced. It is refused here on GAAP — a
for-profit entity recognising an expense and a capital contribution for donated owner services is
not a treatment the standard permits — **not on convenience**, and if the owner's priority is a
single honest margin over statement conformity, that is the trade to re-open. It is also what `3130`
would be for, which is why 3130's disposition moves to `undecided` rather than `drop`.

## What it does NOT touch

- **5801 and the utilisation KPI.** An unpaid owner's unworked hours post nothing either. You cannot
  have idle-capacity _cost_ for capacity you did not pay for, so the absorbed/unabsorbed gap stays a
  measure of paid capacity.
- **The `labor_line` pools.** Pool amounts are actual paid cost; the imputed view is a separate
  report over the same keys.
- **`shift_recorded`'s control total.** `cost_minor` is zero on a contributed shift, and this file
  already rules that a zero-amount posting is not written — so the rule needs no conditional.
