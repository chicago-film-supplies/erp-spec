---
kind: finding
title: >-
  SPIKE-008 — the tax decision table already exists as data, the rate history matches the ordinance
  exactly, and the jurisdiction field a tax engine would source from is absent on 96.4% of
  destinations and disagrees with the delivery address more often than it agrees
contexts: [tax, billing]
source: >-
  `code:2026-08-22:erp-spec:spikes/harness/tax-decision-table-probe.ts` (`deno task tax-table`) —
  read-only prod under ADC, 11 tax records and 1,019 invoices at 100% coverage. Ordinance figures
  from the City of Chicago's own Personal Property Lease Transaction Tax page
  (`chicago.gov/city/en/depts/fin/supp_info/revenue/tax_list/personal_propertyleasetransactiontax.html`,
  fetched and extracted 2026-08-22) — never a summarizing fetch.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## ⭐ The decision table is not missing. It is already data.

`taxes` carries `jurisdiction`, `item_types[]` and an `applied_from`/`applied_to` window per record.
**That IS a decision table** — (jurisdiction × item type × date) → rate — so SPIKE-008's first exit
criterion is less "design one" than "write down the one that is running and check it."

| jurisdiction | tax                 |               rate | item types                    | window                                        |
| ------------ | ------------------- | -----------------: | ----------------------------- | --------------------------------------------- |
| chicago      | Chicago Rental Tax  | 9% → 11% → **15%** | `[rental]`                    | 2020-01-01 / 2025-01-01 / **2026-01-01 open** |
| chicago      | Chicago Sales Tax   | 10.25% → **10.5%** | `[sale, replacement]`         | → 2026-08-19 / **2026-08-19 open**            |
| chicago      | Water Bottle Tax    |     **$0.05 flat** | `[]` — matched by nothing     | 2026-03-27 open                               |
| frankfort    | Frankfort Sales Tax |     8% → **8.25%** | `[rental, sale, replacement]` | → 2026-08-19 / open                           |
| paxton       | Paxton Sales Tax    |              6.25% | `[rental, sale, replacement]` | 2020-01-01 open                               |
| rantoul      | Rantoul Sales Tax   |                 9% | `[rental, sale, replacement]` | 2020-01-01 open                               |

✅ **The Chicago rate history matches the ordinance EXACTLY.** The city's own page gives 15% as of
1-1-2026, 11% as of 1-1-2025, 9% as of 1-1-2021. CFS's three records reproduce that ladder.

⭐ **And Chicago is the only jurisdiction that SPLITS rental from sale** — a separate Personal
Property Lease Transaction Tax on `[rental]` at a different rate from its sales tax on
`[sale, replacement]`. Frankfort, Paxton and Rantoul apply one rate to all three. **That split is
the whole reason this spike exists**, and the registry already encodes it.

⚠️ **`service` and `surcharge` appear in NO tax's `item_types`.** Services are untaxed in every
jurisdiction, which the probe confirms: 28 lines fall through with no rule, all of them `service`,
`surcharge` or `transaction_fee`.

⚠️ **The spike's own note is stale.** It records "verified 2026-08-08: the current system applies
Chicago Rental Tax at 11%". The 11% window closed **2026-01-01**; the rate on that date was 15%.

## ⭐⭐ THE CENTRAL FINDING: the sourcing field is absent, and wrong where present

A tax engine must decide _which jurisdiction_. The obvious input is
`invoices.destinations[].jurisdiction`. Measured across all 1,019 invoices:

|                                                     |               |
| --------------------------------------------------- | ------------: |
| destinations                                        |       **946** |
| carrying a `jurisdiction` at all                    | **34 — 3.6%** |
| where both a jurisdiction and a mappable city exist |            28 |
| …**agree**                                          |            13 |
| …**DISAGREE**                                       |        **15** |

Every disagreement is the same shape: **`jurisdiction=frankfort` with `city=chicago` (×13)** and
**`jurisdiction=rantoul` with `city=chicago` (×2)**.

⇒ **The field disagrees with the delivery address more often than it agrees, and is absent 96.4% of
the time.** ⚠️ **"Present but wrong" beats "absent" at passing every existence check** — and here
both failure modes are live at once.

**Worked example, invoice 2392 (2026-08-21):** `destinations[0].jurisdiction = "rantoul"`, delivery
address city **Chicago**, and the tax actually charged is **Chicago Sales Tax 10.5%**. The applied
tax follows the ADDRESS; the stored field says otherwise. ⇒ **whatever drives the tax today, it is
not this field** — which means the spec cannot adopt it as the sourcing input without deciding what
it is for.

## ⭐ Two dates, and the gap between them is a measured liability

Each record carries **`effective_from`** — when the law says the rate starts — and
**`applied_from`** — when CFS began charging it. On both August increases they differ: effective
**2026-08-01**, applied **2026-08-19**. An 18-day gap.

Every taxable line was therefore scored **twice**:

| scored against                                                 | lines disagreeing |
| -------------------------------------------------------------- | ----------------: |
| CFS's own registry (`applied_from`) — a self-consistency check |             **1** |
| the LAW (`effective_from`) — the real question                 |            **10** |

⇒ **9 lines were correct by the registry and wrong by the law**: $3,083.00 of taxable base,
**$7.71 under-collected**. That is **api-cloudrun#600 with a number on it** — and the number is
small enough that the remediation may cost more than the exposure, which is a real input to that
decision rather than a reason to ignore it.

⚠️ **The 1 line failing even against CFS's own registry is invoice 2392 above** — a Rantoul-flagged
destination charged the Chicago rate. Not a timing problem; a sourcing one.

## ⚠️ A data-model defect the probe hit before it hit the data

**`taxes` has no field distinguishing "a new RATE for an existing tax" from "an ADDITIONAL tax that
applies alongside."** Successive versions are separate documents whose only link is a shared `name`,
and under `effective_from` their windows genuinely overlap. **The first version of this probe summed
them and reported an expectation of 16.25%** — a rate nobody ever charged.

⇒ any engine must group by lineage and take the latest, and sum only _across_ lineages. **Nothing in
the schema says so.** Recorded rather than quietly fixed, because every implementation will meet it.

⚠️ **And `active` does not mean "in force."** Two records are `active: true` with windows that
closed 2026-08-19 (Chicago Sales Tax 10.25%, Frankfort 8%). **The window is the authority, not the
flag** — api-cloudrun#613, confirmed.

## ⚠️ What the ordinance requires that CFS cannot express

The City's page lists twelve exempt lease types and two exempt lessee classes. Two matter here:

- ⭐ **"Property leased outside the city that is primarily used outside the city (50%)"** — a
  **PARTIAL** exemption. **CFS models exemption as a boolean** (`invoice.tax_exempt`,
  `organization.tax_exempt`), so a 50% exemption is **unrepresentable**. For an equipment rental
  house whose gear travels to location shoots, this is not an edge case.
- **"Lease of motion picture film by theaters is exempt"** — narrow, and not CFS's business, but
  worth knowing it exists in a film-adjacent ordinance.

⚠️ **And the sourcing rule itself is contested law.** The tax reaches property _used in Chicago_,
and **Hertz Corp. v. City of Chicago, 2017 IL 119945** held Lease Transaction Tax Ruling 11 invalid
on exactly that question. **A decision table keyed on a stored `jurisdiction` enum is a
simplification of a rule the Illinois Supreme Court has already narrowed once.**

## What is NOT established

- **Flat taxes are unscored.** The $0.05 bottled-water tax carries `item_types: []`, so nothing
  matches it by type and the probe scores percent rates only. How it is actually applied is unknown.
- **4,763 lines were skipped** for having no resolvable jurisdiction — a direct consequence of the
  3.6% population above, and the reason only 333 lines could be scored.
- **Whether the 50% exemption was ever OWED.** Unrepresentable in the data, therefore undetectable.
- **A CPA has not reviewed any of this.** The spike says so itself: it produces the rules, not the
  authority.
