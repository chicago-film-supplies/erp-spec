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
closes_adr: ADR-0045
status: closed
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

⚠️ **CORRECTED 2026-08-22 — the counts above are right; the reading I drew from them was wrong,
twice.** `destinations[].jurisdiction` is an **OVERRIDE seeded from
`organization.jurisdiction_claim`** — the field name says so, it is a _claim_ — and **the tax DOES
follow it**:

| invoices                   | org claim | dest jurisdiction | delivery city | tax applied          |
| -------------------------- | --------- | ----------------- | ------------- | -------------------- |
| Kenwood TV Productions ×13 | frankfort | frankfort         | **Chicago**   | **Frankfort 8%** ✅  |
| Chili Finger               | null      | rantoul           | Chicago       | **Rantoul 9%** ✅    |
| **2392**                   | null      | rantoul           | Chicago       | **Chicago 10.5%** ⚠️ |

⇒ **13 of the 15 "disagreements" are ONE customer's claim honoured correctly**, and the tax follows
the field in 4 of 5 checked. **"Wrong more often than right" miscounted what the number meant, and
"the applied tax follows the address" generalised from invoice 2392 against four cases showing the
opposite.**

⭐ **AND THE OWNER SUPPLIED THE POLICY, which settles it.** Overrides exist at **org, order and
invoice** level, are used **only for Frankfort and Rantoul**, are decided **per project**, and rest
on the gear being used **exclusively** in that jurisdiction despite being collected from the Chicago
shop. ⇒ **that is the ordinance's own test correctly applied** — the Chicago lease tax reaches
property _used in Chicago_, and gear used exclusively in Frankfort is not. **An earlier revision
here called it a tax POSITION needing a CPA to defend; that was too suspicious.**

Re-scored against the tax actually applied, all 15 differing destinations:

| outcome                  |                                                                   count |
| ------------------------ | ----------------------------------------------------------------------: |
| ✅ **override honoured** |                 **13** — 12 org-level (Kenwood) + 1 order/invoice-level |
| ✅ correctly untaxed     | 1 — inv 2328, all lines `service`/`surcharge`, in no tax's `item_types` |
| ❌ **override IGNORED**  |                                                    **1 — invoice 2392** |

⇒ **13 of 14 taxed cases honoured. The mechanism is sound**, and the single defect is narrow:
invoice 2392 carries an **order/invoice-level** `rantoul` override (org claim null) on a
`replacement` line and was charged **Chicago 10.5%** instead of **Rantoul 9%** — an **over**-charge
of $3.04, so a refund question rather than an under-remittance. ⭐ **Every ORG-level override works;
of the two order/invoice-level ones, the 2025 case worked and yesterday's did not** — a testable
hypothesis that the bug is in the order/invoice-level path. api-cloudrun#620.

✅ **PRECEDENCE ANSWERED (owner, 2026-08-22): "specificity governs — invoice overrides order
overrides org."** ⚠️ **And measured as completely unexercised**: of 954 non-void invoices, **22
carry both an org claim and a destination jurisdiction and all 22 AGREE**, and **0** have a
destination jurisdiction differing from their order's. ⇒ **zero cases where precedence decides
anything**, so it needs **golden vectors on each arm** before it can be believed — the repo's own
rule, in its strongest form: not one untried option but **no option ever taken**.

⭐ **And it sharpens the DEFAULT question instead: 941 of 954 invoices carry NEITHER**, so the
unstated default governs **98.6%** of invoices while the whole override machinery decides 13. **The
default is the rule and the overrides are the exception — and only the exception is written down.**

⚠️ **What the spec must carry beyond precedence**: a permitted target set of **Frankfort and Rantoul
only**, which the `jurisdiction` enum cannot express; and ⭐ **a REASON on the override, not just a
value** — the policy rests on the factual assertion _used exclusively in Frankfort_, and nothing
records who asserted it or for which project. **Same shape as `EVT-TAX-002` carrying a reason**,
because "no tax" and "no tax BECAUSE" audit differently.

⚠️ **Still open**: **96.4% of destinations carry no jurisdiction at all**, so an unstated default
drives everything else.

**Invoice 2392 (2026-08-21)** is the one genuine anomaly: `jurisdiction: "rantoul"`, delivery city
**Chicago**, no organization claim at all, and tax charged **Chicago Sales Tax 10.5%** — following
neither the field nor a claim. ⚠️ **One destination out of 946, dated yesterday.** An earlier
revision of this spike read it as the system's behaviour; four other invoices show the opposite, and
generalising from it was the error.

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

#### ✅ The rate-attachment half is ANSWERED (owner, 2026-08-22)

**The rate LADDERS to the rate effective at the rental's `charge_start` — but only if that change
was known at quote time — and an invoice issued later must still honour the promised price.**

⇒ three requirements, none of which the model meets:

1. **The rate is a PROMISED value stored at pricing time**, not derived on read.
2. **It keys on `charge_start`**, so an order spanning a change needs a rate per charge window.
3. **The tax record needs `announced_at`** — `effective_from` and `applied_from` cannot distinguish
   a change enacted in November from one announced on 30 December, and the owner's rule gives those
   opposite answers.

⚠️ **AND THE ORDER — WHICH IS THE PROMISE — IS BEING OVERWRITTEN.** Quotes in Firestore are PDF
wrappers generated from orders and carry no pricing, so the order is the artifact that holds the
promise. Scored against the rate lawful at each order's earliest `charge_start`:

| rental started | lawful | order carries | lines |        base |
| -------------- | -----: | ------------: | ----: | ----------: |
| 2025           |    11% |       **15%** | 1,752 | $339,543.21 |
| 2024           |     9% |       **15%** |   945 | $169,664.00 |
| 2023           |     9% |       **15%** |   306 |  $58,850.40 |
| ✅             |    15% |           15% |   840 | $145,834.90 |

**3,003 lines, $568,057.61 of base, carrying a rate that did not exist when the rental happened.**
Corpus-wide the Chicago rental rate appears as 15% on 7,167 lines and 11% on **3**. ⭐ **Same defect
class as api-cloudrun#537** — a denorm restamped by a later write, where the artifacts assert
point-in-time fidelity and the writer does not implement it.

⭐ **THE MECHANISM, and it makes this a LIVE defect rather than an import artifact.** The owner:
_"firestore taxes carry applied from/to fields orders use to derive tax."_ ⇒ those windows **are**
the ladder, already correct — and the bug is the DATE fed into the lookup. 3,001 of 3,003 mis-rated
lines are the CRMS import cohort, which looks like a one-off; but **only 4 post-import orders have a
`charge_start` before 2026-01-01**, two carry no Chicago rental tax, and **both that can test the
ladder FAIL** (orders 795 and 702, both created February 2026, both carrying 15% where 11% was
lawful). **2 of 2 testable live cases fail.**

⚠️ **It looks fine in production only because it is almost never exercised** — 197 of 201
post-import orders rent in 2026, where 15% is right anyway. **The ladder is correct by coincidence,
not by construction.**

⚠️ **The issued invoice appears to preserve what the order lost** — invoice 2128 (2025-12-08)
carries 11%, and criterion 2 found one registry-level disagreement in 333 scored invoice lines. **A
head-to-head comparison was not completed**, so that reading rests on two observations and should be
confirmed rather than relied on.

#### What the spec must decide, and it is `OQ-056`

1. **What `jurisdiction` IS.** Derived from the destination address — in which case it is a CACHE
   and must never be authored by hand — or an operator-declared override, in which case it needs a
   stated meaning and a reason it may differ from the address. **It cannot stay both**, which is
   what produces 15 disagreements in 28 populated rows.
2. **Which date the rate attaches to** — charge date, charge-window start, or prorated across the
   window — **as a NAMED FIELD with golden vectors on each arm.** 48 windows already cross a
   boundary; the next rate change makes it 48 more.
3. ⛔ **WITHDRAWN 2026-08-22.** I claimed the ordinance's _"property leased outside the city that is
   primarily used outside the city (50%)"_ was a **partial exemption** a boolean could not express.
   **It does not apply to CFS at all** — the predicate is property _leased outside the city_, and
   CFS is a Chicago lessor. `(50%)` most likely defines "primarily", not a relief rate. ⚠️ **A rate
   inferred from a parenthetical on a summary page** — the footgun this repo names. §3-32-050 was
   never read; it is behind an HTTP 403.

### ⚠️ THE DRAFT BELOW IS SUPERSEDED — read this first

**The tax model was rebuilt 2026-08-17 → 2026-08-22, in `api-cloudrun` and `core`, and most of what
the draft proposes already exists.** Verified 2026-08-22 against
`code:2026-08-22:core@7bcc2db:src/utils/taxes.ts`. Full reconciliation:
`inbox/2026-08-22-the-tax-model-was-rebuilt-in-five-days-and-most-of-oq-056-was-already-decided-in-api-cloudrun.md`.

| draft item                                          | verdict                                                                                                                                                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** default is the warehouse, stated not implied | ✅ **ALREADY IMPLEMENTED** — `resolveJurisdiction` = `destination ?? org claim ?? deriveJurisdiction(address, origin)`. Never a hardcoded `chicago`, and `requireOriginJurisdiction()` **throws** rather than guessing |
| **D1a** `tax = exempt × date × jurisdiction`        | ✅ implemented, with **item type as the fourth axis** — `const key = item.taxed_as ?? item.type`                                                                                                                       |
| **D2** an override carries a REASON                 | ⭐ **THE ONE ITEM THAT SURVIVES.** Zero grep hits in `core`, `api-cloudrun`, `manager`; explicitly listed as out of scope in the campaign record                                                                       |
| **D3** targets restricted to Frankfort/Rantoul      | ❌ **WRONG** — three narrower sets already exist (derivable / assertable / levyable), each for a stated reason. The owner's phrasing was the PRACTICE, not the constraint                                              |
| **T1** precedence needs vectors                     | 🟡 the precedence is implemented; what I measured is a fact about the DATA                                                                                                                                             |

⭐ **And the `announced_at` field D-items asked for already exists as `Tax.effective_from`** — which
**prices nothing**, and exists so the `[effective_from, applied_from)` lag is auditable. The two
dates this spike "discovered" are a deliberate design.

⚠️ **THE LESSON, and it is new for this repo: A MEASUREMENT OF STATE IS NOT A MEASUREMENT OF
BEHAVIOUR WHEN THE CODE CHANGED LAST WEEK.** Every probe here was accurate and every figure real —
**the figures were right and the inferences were wrong**, because a corpus records what the code did
across its whole history, not what it does now. The repo's rule _"verify structural assumptions
against the live API"_ was followed and was the wrong instrument. **Read the writer before inferring
intent from what it wrote, and check when it last changed.**

⇒ **Two issues filed from this spike were filed on wrong readings**: api-cloudrun#620 is **closed as
invalid** (invoice 2392 is the `replacement` rule working, not a defect), and #622 is **corrected
and retitled** (the delivery-start ladder already exists; my "live defect" evidence was two orders
created before it landed).

### 📝 DRAFT SPECIFICATION for OQ-056 — for the owner's review, not yet ruled

Four items. **Three are decisions; the fourth is a test obligation.** Written as spec prose so they
can be promoted to `REQ-TAX-*` once approved.

#### D1 — The default is the WAREHOUSE, and the default case is the one where use is UNKNOWN

> **Absent any override, a line's tax jurisdiction is the jurisdiction of CFS's own warehouse —
> `3100 W Fillmore St, Chicago, IL 60612` — and the tax it resolves to is a function of
> `exempt status × date × jurisdiction`, with item type selecting which taxes in that jurisdiction
> apply to the line.**

⚠️ **AN EARLIER DRAFT SAID "the default is Chicago because it is the lessor's situs — gear is
collected from a Chicago shop, so absent an assertion of use elsewhere it IS used in Chicago." That
justification is wrong, and the owner's framing is what corrects it.**

Measured: **stores are `Fillmore` and `CSR`**; **540 of 946 destinations (57.1%) carry a Fillmore
delivery address**, **584 have `customer_collecting: true`**, and **510 are both.**

⇒ **A Fillmore address on a destination means the customer COLLECTED from the warehouse.** It is not
a delivery to Chicago. **It records where the gear left from, and says nothing whatever about where
it is used.**

⭐ **So the default is not a determination that the gear is used in Chicago. It is a FALLBACK for
the case where CFS does not know where it is used** — and the Chicago Personal Property Lease
Transaction Tax reaches property _used in Chicago_, which for 510 collections is unestablished
rather than established.

⇒ ⭐ **THIS INVERTS THE FRAMING OF THE WHOLE OVERRIDE MECHANISM.** The override is not an exception
carved out of a known fact. **It is the only case where the use location is actually KNOWN** — the
customer has told CFS the gear will be used exclusively in Frankfort or Rantoul. The default covers
the unknown; the override covers the known. **Reading it the other way round is what made an earlier
revision of this spike treat 13 legitimate invoices as data defects.**

⚠️ **And the default must name the WAREHOUSE, not the jurisdiction.** "Chicago" is derived from the
Fillmore address; it is not the rule. **If CFS opens or moves a warehouse the default moves with
it**, and a spec that hardcodes `chicago` would silently keep taxing from a building CFS no longer
occupies. `CSR` is already a second store.

**The empirical picture, for the 941 invoices carrying no override at all:**

| tax applied                               |               share of base |
| ----------------------------------------- | --------------------------: |
| Chicago Rental Tax (9% / 11% / 15%)       |                   **63.3%** |
| Chicago Sales Tax (10.25% / 10.5%)        |                   **19.2%** |
| tax-exempt invoice                        |                       15.8% |
| ⚠️ no tax applied on a non-exempt invoice | 1.7% — 13 lines, $15,167.18 |

⇒ 82.5% of taxed base takes a Chicago rate and **nothing else appears at all**, which is consistent
with the warehouse default — but it is consistent with it, not evidence FOR it. The 13 no-tax lines
are **api-cloudrun#598**.

⭐ **`customer_collecting` is already a field, and it is the signal the spec should use.** A
collected order has an unknown use location; a delivered one has a destination address that is
genuinely about use. **The two cases deserve different treatment and the data already distinguishes
them** — 584 collections against 362 deliveries.

#### D1a — The decision function, as the owner states it

> **`tax = exempt status × date × jurisdiction`**

Three axes, and the multiplication is the point: **all three are required to resolve a rate, and
none of them is a short-circuit.** ⚠️ An earlier reading here treated exemption as a boolean gate
applied before the rest; it is a dimension of the same function.

⚠️ **A fourth axis is in the data and not in that sentence: ITEM TYPE.** `taxes.item_types[]`
selects which taxes in a jurisdiction reach a given line — Chicago splits `[rental]` from
`[sale, replacement]` at different rates, and `service`/`surcharge` appear in no tax's list at all.
**Confirm whether item type is understood as part of "jurisdiction" or as a fourth axis**, because
the spec must name it either way.

#### D2 — An override carries a REASON, an author and a date — not just a value

> **A jurisdiction override records the target jurisdiction, the factual assertion it rests on, who
> made that assertion, and when.**

The policy is that gear collected in Chicago but **used exclusively** in Frankfort or Rantoul takes
that jurisdiction's tax. **That is a factual claim about future use**, and it is the whole basis of
the position — yet **nothing in the data records it.** An override is currently a bare enum value.

⭐ **This is already the house pattern.** `EVT-TAX-002` carries a reason precisely because _"no
tax"_ and _"no tax BECAUSE"_ audit differently. A jurisdiction override is the same shape and a
larger number: **seven points** between Chicago's 15% lease tax and Frankfort's 8%.

⚠️ **The test is not "can we explain it today" but "can we explain it in 2029."** Kenwood's 13
invoices are defensible right now because the owner remembers why. The record does not.

#### D3 — The permitted override targets are FRANKFORT and RANTOUL only

> **An override may name only Frankfort or Rantoul. Chicago and Paxton are not valid targets.**

⚠️ **The `jurisdiction` enum is wider than the policy** — it admits `chicago`, `paxton` and
`no_nexus`, and nothing forbids overriding to them. The permitted-target set is therefore a
**narrower type than the field it constrains**, and expressing it as a separate enum makes the
invalid cases unrepresentable rather than merely discouraged.

⚠️ **And the restriction itself has no recorded reason.** Why those two and not Paxton — which is a
live jurisdiction with its own tax record — is not written down anywhere. **D2 asks an override to
justify itself; this asks the same of the rule that bounds them.**

#### T1 — Precedence needs golden vectors, because nothing exercises it

> **Specificity governs: invoice > order > org** (owner, 2026-08-22).

The rule is settled. ⚠️ **What is not settled is whether it works**, because measured over all 954
non-void invoices: **22 carry both an org claim and a destination jurisdiction and all 22 AGREE**,
and **0** have a destination jurisdiction differing from their order's.

⇒ **Zero cases decide anything.** ⭐ **Not "one option untried" but no option ever taken** — the
repo's own rule at full strength, and both prior instances here were broken the first time someone
took the other branch. **A vector per arm, landed red first.**

### ⛔ What criterion 3 still owes

Rate-change handling is half-answered — the two-date model exists and the gap is measured — but
**nexus is not**, and it is now the harder half:

- ⛔ **WITHDRAWN** — the 50% exemption cited here does not apply to CFS (Chicago lessor; the
  predicate is property _leased outside_ the city), and `(50%)` most likely defines "primarily"
  rather than a relief rate. See the correction note.
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

## ✅ CLOSED 2026-08-23 — `ADR-0045` (jurisdiction is a registration, and the level is stored)

All three exit criteria met, and the six-reference survey required by rule 8a is recorded at
`inbox/2026-08-23-survey-how-six-references-source-a-tax-jurisdiction-and-what-substantiates-a-departure.md`.

| criterion                                   | outcome                                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. decision table over every product type   | ✅ **it already existed as data** — `(jurisdiction × item type × date)` in the `taxes` collection, 100% coverage of 1,019 invoices                                   |
| 2. reproduces historical treatment          | ✅ scored twice; 1 disagreement against CFS's registry, 10 against the law, **every one explained** rather than tolerated                                            |
| 3. nexus and rate-change handling specified | ✅ nexus is `deriveJurisdiction` case 1; the rate ladders to `charge_start` where the change was known at quote time, and `deriveOrderTaxAsOf` already implements it |

⚠️ **Criterion 3's EMPIRICAL half stays unanswerable and that is a finding, not a shortfall.** 48
charge windows cross a rate boundary, but only 6 carry any jurisdiction and all 6 are Rantoul, whose
rate never moved. **The sourcing field is absent exactly where the question lives**, so the
criterion was closed by decision rather than by measurement.

### ⭐ What the survey changed, and it was the REASONS rather than the decisions

**Two of this spike's three draft items were already implemented — and the justifications written
here for them were wrong twice over.** The draft called the default _"a fallback for the case where
CFS does not know where the gear is used"_:

- **It is not a fallback.** Intacct's sourcing rule names the pickup case: the input is the
  customer's shipping address _"unless they are coming to you to pick up the product being sold."_ A
  collection is a **determination**.
- **It is not a claim about use.** NetSuite gates on registration before address. Under that
  criterion the default asserts only that CFS is registered in Chicago — ⭐ **which is what
  `core/src/schemas/common.ts` already said: "a jurisdiction is a registration, not a place."**

⇒ **the survey supplied the reason the existing design is right, not a new design.** Recording that
is the point: this spike derived a wrong justification twice, and a wrong reason survives review
because the decision it supports is correct.

### ⭐⭐ And it produced one thing nobody had: the level is computed and discarded

`resolveJurisdiction` returns which rung answered. **Exactly one caller consumes it — the manager's
`DestinationJurisdiction.tsx`, for display — and it appears nowhere in `api-cloudrun/src`.** So a
derived jurisdiction and a document override naming the same value are **indistinguishable in
storage**, which is Odoo's documented failure mode reached by a different route.

⭐ **The corpus shows operators already need the distinction**: `chicago` was written **explicitly,
twice**, both over a `frankfort` org claim. Chicago-as-fallback is `null`; Chicago-as-determination
was typed by hand because nothing else could express it. **That is `ADR-0045` D1.**

⚠️ **What this spike does NOT settle**, carried forward: whether the ordinance permits a lessor to
source a collection to the lessee's use location at all. `Hertz Corp. v. City of Chicago`, 2017 IL
119945, invalidated Lease Transaction Tax Ruling 11 on exactly that question. **A CPA question, and
the one that decides how much D2 is worth.**
