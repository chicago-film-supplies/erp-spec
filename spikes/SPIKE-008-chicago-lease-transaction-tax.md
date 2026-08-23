---
id: SPIKE-008
headline: Chicago lease transaction tax
question: >-
  How do the Chicago Personal Property Lease Transaction Tax and Illinois home-rule sales tax
  apply across equipment rental versus services?
timebox: 1 week
method: >-
  Read the ordinance and the Illinois home-rule provisions directly. Build a decision table over
  the real product catalogue — rental, sale, service, surcharge, replacement — and validate it
  against historical invoices where the applied tax is already known.
exit_criteria:
  - Decision table covering every product type in the catalogue, including the mixed-regime case.
  - Reproduces the historical treatment on a sample of real invoices, with every disagreement explained rather than tolerated.
  - Nexus and rate-change handling specified, including how a rate change mid-rental is treated.
closes_adr: new
status: in_progress
---

## Notes

Verified starting point (2026-08-08): the current system applies "Chicago Rental Tax" at 11% to
rental lines and "Chicago Sales Tax" at 10.25% to sale lines **within the same invoice**,
discriminated by item type. Invoices and organizations both carry a `tax_profile`. Historical
Chicago Rental rates already exist as separate tax records, so rate history is a real concern.

A CPA should review the output. This spike produces the rules; it does not produce the authority.

## Partial result — 2026-08-22. The table exists as data; the sourcing field does not work

Harness `spikes/harness/tax-decision-table-probe.ts` (`deno task tax-table`), read-only prod under
ADC: **11 tax records, 1,019 invoices, 100% coverage.** Ordinance figures fetched and extracted from
the City of Chicago's own page — never a summarizing fetch. Full evidence:
`inbox/2026-08-22-spike-008-the-tax-decision-table-already-exists-as-data-and-the-jurisdiction-field-it-would-source-from-is-absent-or-wrong.md`

### ✅ Criterion 1 — the decision table, and it was already there

`taxes` carries `jurisdiction`, `item_types[]` and an `applied_from`/`applied_to` window per record.
**That IS the table** — (jurisdiction × item type × date) → rate. ⭐ **Chicago is the only
jurisdiction that splits `[rental]` from `[sale, replacement]`**, at a different rate, which is the
Personal Property Lease Transaction Tax and the whole reason this spike exists. Frankfort, Paxton
and Rantoul apply one rate to all three.

✅ **The Chicago rate history matches the ordinance exactly** — 9% / 11% / 15% at 1-1-2021,
1-1-2025, 1-1-2026, verified against the city's own published ladder.

⚠️ **This spike's own Notes are stale**: they record "verified 2026-08-08: Chicago Rental Tax at
11%". The 11% window closed **2026-01-01**; the rate then was 15%.

⚠️ **`service` and `surcharge` are in NO tax's `item_types`** — untaxed in every jurisdiction. The
probe confirms it: 28 lines fall through with no rule and all are `service`, `surcharge` or
`transaction_fee`.

### 🟡 Criterion 2 — reproduces the historical treatment, and every disagreement is explained

Scored **twice**, because each record carries two dates that differ:

| scored against                      | lines disagreeing |
| ----------------------------------- | ----------------: |
| CFS's own registry (`applied_from`) |             **1** |
| the LAW (`effective_from`)          |            **10** |

⇒ **9 lines correct by the registry and wrong by the law** — $3,083.00 of base, **$7.71
under-collected**, billed in the 18-day window between a rate becoming effective (2026-08-01) and
CFS applying it (2026-08-19). **That is api-cloudrun#600 with a number**, and the number is small
enough that remediation may cost more than the exposure — an input to that decision, not a reason to
ignore it.

The single registry-level disagreement is invoice **2392**, below.

⚠️ **Only 333 of the corpus's taxable lines could be scored at all**, and that is the next finding
rather than a limitation of the probe.

### ⭐⭐ THE CENTRAL FINDING — the sourcing field is absent, and wrong where present

|                                                     |               |
| --------------------------------------------------- | ------------: |
| destinations                                        |       **946** |
| carrying a `jurisdiction` at all                    | **34 — 3.6%** |
| where both a jurisdiction and a mappable city exist |            28 |
| …agree                                              |            13 |
| …**DISAGREE**                                       |        **15** |

Every disagreement is `jurisdiction=frankfort, city=chicago` (×13) or
`jurisdiction=rantoul,
city=chicago` (×2).

⇒ **The field a tax engine would source from disagrees with the delivery address more often than it
agrees, and is absent 96.4% of the time.** ⚠️ **Both failure modes at once** — "present but wrong"
beats "absent" at passing every existence check, and here neither is rare.

**Invoice 2392 (2026-08-21)** is the worked case: `jurisdiction: "rantoul"`, delivery city
**Chicago**, tax charged **Chicago Sales Tax 10.5%**. The applied tax follows the ADDRESS. ⇒
**whatever drives tax today, it is not this field**, and the spec cannot adopt it as the sourcing
input without first deciding what it is for.

### 🟡 Criterion 3 — specified, and the empirical half is UNANSWERABLE from this corpus

**Rate changes mid-rental are not rare.** Measured across every charge window with a real span:

|                                 |                                            |
| ------------------------------- | -----------------------------------------: |
| charge windows with a real span |                                    **763** |
| …that CROSS a rate boundary     |         **48** — $61,994.60 of rental base |
| …carrying ANY jurisdiction      | **6**, all Rantoul, whose rate never moved |
| …**unscoreable**                |                                     **42** |

⚠️ **So "which rate does CFS apply when a rental spans a change" cannot be answered from the data.**
Not because the population is thin — 48 windows is plenty — but because **the sourcing field is
absent exactly where the question lives.** ⇒ criterion 3 cannot be closed by measurement; it needs a
decision, and that is the finding rather than an obstacle to it.

⭐ **And rentals are billed IN ADVANCE, so the two candidate dates genuinely diverge.** Invoice 2100
is dated 2025-11-06 for a window running 2025-11-07 → 2026-02-13; invoice 2375 is dated 2026-08-12
for 2026-08-17 → 2026-09-18. **The charge date and the use period are different dates**, and a rate
change between them changes the answer.

#### What the ordinance settles

- **The tax is imposed "of receipts or charges for all leases"** — the City's own words on all three
  rate tiers. ⇒ **the taxable event is the CHARGE, not the day-by-day use.** ⚠️ **That the rate
  therefore attaches at the charge date rather than being prorated across the use period is an
  INFERENCE from that phrasing, not a quoted transitional rule.** §3-32-030's text is behind an HTTP
  403 at the code host and was not read. **Do not treat this as settled law** — it is the reading a
  decision should be drafted on and a CPA should confirm.
- **Nexus is USE, not billing**: the tax "applies to businesses or individuals that are either a
  lessor or lessee of personal property **used in Chicago**." ⇒ the sourcing input is where the gear
  goes — the destination — never the customer's billing address.
- ⚠️ **And "used in Chicago" is contested.** _Hertz Corp. v. City of Chicago_, 2017 IL 119945 held
  Lease Transaction Tax Ruling 11 invalid on exactly that question. **A table keyed on a stored
  jurisdiction enum is a simplification of a rule the Illinois Supreme Court has already narrowed
  once, and the spec should say so rather than imply the enum is the law.**

#### What the spec must decide, and it is `OQ-056`

1. **What `jurisdiction` IS.** Derived from the destination address — in which case it is a CACHE
   and must never be authored by hand — or an operator-declared override, in which case it needs a
   stated meaning and a reason it may differ from the address. **It cannot stay both**, which is
   what produces 15 disagreements in 28 populated rows.
2. **Which date the rate attaches to** — charge date, charge-window start, or prorated across the
   window — **as a NAMED FIELD with golden vectors on each arm.** 48 windows already cross a
   boundary; the next rate change makes it 48 more.
3. **A representable partial exemption.** The ordinance's 50% relief for property leased outside the
   city and primarily used outside it **cannot be expressed by a boolean**, and for a rental house
   whose gear travels to location shoots this is not an edge case.

### ⛔ What criterion 3 still owes

Rate-change handling is half-answered — the two-date model exists and the gap is measured — but
**nexus is not**, and it is now the harder half:

- ⚠️ **The ordinance's 50% exemption for "property leased outside the city that is primarily used
  outside the city" is UNREPRESENTABLE.** CFS models exemption as a boolean, so a partial exemption
  cannot be expressed and the probe cannot detect whether one was ever owed. **For a rental house
  whose gear travels to location shoots, this is not an edge case.**
- ⚠️ **The sourcing rule is contested law.** The tax reaches property _used in Chicago_, and **Hertz
  Corp. v. City of Chicago, 2017 IL 119945** held Lease Transaction Tax Ruling 11 invalid on exactly
  that point. A table keyed on a stored enum simplifies a rule the Illinois Supreme Court has
  already narrowed once.
- **A rate change mid-rental is untouched** — the exit criterion names it and nothing here measures
  it.

### ⚠️ A data-model defect the probe hit before it hit the data

**`taxes` cannot distinguish "a new RATE for an existing tax" from "an ADDITIONAL tax alongside."**
Successive versions are separate documents linked only by a shared `name`, and under
`effective_from` their windows genuinely overlap. **The probe's first version summed them and
reported an expectation of 16.25%** — a rate nobody ever charged. Any engine must group by lineage
and take the latest, summing only across lineages, and **nothing in the schema says so.**

⚠️ **And `active` does not mean "in force"** — two records are `active: true` with windows closed
2026-08-19. The window is the authority (api-cloudrun#613, confirmed).

### Where the spike stands

| criterion                                                               | state                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1 — decision table over every product type, incl. the mixed-regime case | ✅ **MET**                                                                                                    |
| 2 — reproduces historical treatment, disagreements explained            | 🟡 **substantially met** — every disagreement explained; coverage limited to 333 lines by the sourcing defect |
| 3 — nexus and rate-change handling specified                            | ⛔ **NOT DONE** — rate-change half-answered, nexus is the harder half                                         |

⇒ **`in_progress`, and now blocked on a DECISION rather than on work** — `OQ-056` — and, per this
spike's own note, **a CPA should review the output. This spike produces the rules; it does not
produce the authority.**
