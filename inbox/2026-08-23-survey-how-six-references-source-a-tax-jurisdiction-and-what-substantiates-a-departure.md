---
kind: survey
title: >-
  Rule 8a survey for the ADR that closes SPIKE-008 — how six references source a tax jurisdiction
  and what substantiates a departure from the derived one; five of six refuse to substitute an
  origin for a missing destination, and all six converge on when a reason appears
contexts: [tax, ordering, billing]
source: >-
  Agent-driven research 2026-08-23, primary text extracted locally in every case — never a
  summarizing fetch. FASB via storage.fasb.org (curl + pdftotext); Xero via its published OpenAPI
  spec (developer.xero.com is a JS shell returning 200 with 83 characters of text); SAP via the
  Help Portal's underlying content API, recovered from the SPA bundle after the same 200-with-no-body
  trap; NetSuite via docs.oracle.com (server-rendered); Intacct via intacct.com help pages
  (Last modified Aug 21 2026); Odoo via odoo/odoo source at branch 18.0, commits pinned. CFS's own
  books measured read-only through `mcp__cfs-api-prod__db_*` — the Xero API was never called.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Rule 8a survey for the decision that closes `SPIKE-008` (Chicago lease transaction tax). Three
questions, carried over from that spike's draft:

- **D1** — absent an override, a line's jurisdiction defaults to CFS's own warehouse. Is that a
  **fallback for unknown use** or a **determination**?
- **D2** — an override today carries a value and **no reason and no evidence**. Should it carry them?
- **D3** — what constrains the permitted set of override targets?

## The one-line answer per reference

| Reference        | What sources the jurisdiction                                                                        | Reason/evidence on an override                       |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **GAAP**         | **nothing — it is silent.** Presumes tax law decided; asks only gross vs net                         | none; ASC 740 is income-tax-only so no FIN 48 duty   |
| **Xero**         | Model 1 (CFS's): a flat named rate, **no jurisdiction field at all**. Model 2: a `FROM`/`TO` address | **none anywhere** — `TaxRates` has no attachments    |
| **SAP S/4HANA**  | **six typed location concepts**, all transmitted; the engine returns which it used                   | reason codes are first-class but **engine-authored** |
| **NetSuite**     | registration first, then ship-to; ZIP+4 selects the rate                                             | none — **permission is the only control**            |
| **Sage Intacct** | native: **the address is never read**; a hand-assigned contact tax group                             | none — gates **who** may override, never **why**     |
| **Odoo**         | manual position wins outright, else a ranked `auto_apply` match on the **delivery** partner          | none, and the header override is **not even logged** |

## ⭐⭐ D1 — five of six refuse to substitute an origin for a missing destination

This is the strongest signal in the survey, and it runs against D1 as drafted:

- **SAP blocks the document.** `TAX_TXJCD` 100: *"Transaction processing is blocked, preventing
  order creation, invoice posting, or other tax-relevant business processes."*
- **Intacct fails closed** in order entry — *"If a tax schedule map … can't be found for a line
  item, the tax can't be calculated"* — and in AR it **widens the menu to every tax detail defined**
  rather than narrowing to a default.
- **NetSuite SuiteTax computes nothing** — *"If no ZIP code is provided in the address used for the
  tax determination, the taxes are not calculated for this address."*
- **Odoo falls through silently** to the product's default tax.

⚠️ **Every warehouse fallback any of them has is on the ORIGIN side, never the destination side.**
Intacct cascades *"the warehouse contact address, the entity contact address, or the company
address"* — for **ship-from**. Its warehouse-derived `Reporting location` decides **where you file**;
*what tax applies* never is. SAP's plant jurisdiction *"provides the external tax system with the
ship-from location for A/R."*

**One construct in six matches D1's shape**, and it is NetSuite Legacy's **`Home Tax Code`** —
*"Tax code to use for sales that you don't ship to another location."* ⭐ **Framed by the ABSENCE of
a shipment, not by a determination that goods are used at the seller's site**, which is D1's wording
exactly. ⚠️ NetSuite never says why it is defensible, only when it applies.

### ⭐⭐ But the CRITERION reframes the question, and two references supply it

**Intacct answers CFS's ~57% customer-collection case directly** — its AvaTax FAQ defines the
sourcing input as *"the buyer's location (**specifically, their shipping address unless they are
coming to you to pick up the product being sold**)."*

⇒ **a pickup is a DIFFERENT DETERMINATION, not a missing one.** The buyer's location *is* the
seller's counter. So for **sales tax**, CFS's collection case is not the unknown case at all, and
sourcing it to the Chicago shop is correct rather than a fallback.

⚠️ **For the lease transaction tax it is still the wrong question**, and **SAP is the reference that
names why.** SAP types **six** location concepts and never lets one stand in for another:

| SAP field    | What it is                                          |
| ------------ | --------------------------------------------------- |
| `TXJCD_SF`   | ship-from                                           |
| `TXJCD_ST`   | ship-to                                             |
| `TXJCD_POA`  | point of order **acceptance**                       |
| `TXJCD_POO`  | point of order **origin**                           |
| `PTP_IND`    | point of **title passage**                          |
| `COST_OBJECT`| ⭐ **"where the goods are consumed"**                |

⭐⭐ **That last row is the distinction D1 needs.** CFS's *"where the gear left from"* is `TXJCD_SF`.
It is **not** `COST_OBJECT`, and SAP would never let one answer for the other. A pickup determines
ship-from, ship-to, order acceptance and title passage all at the Chicago counter — and determines
**nothing** about consumption, which is the predicate the Chicago Personal Property Lease Transaction
Tax actually turns on. ⭐ SAP also types `TAX_TYPE: 3 – Rental/Lease Tax` as its own category,
separate from sales tax, which is the same distinction expressed on the other axis.

### ⭐⭐ And NetSuite supplies the framing that makes CFS's default defensible

**NetSuite asks "am I registered where this is going?" BEFORE "where is this going?"** — stated
twice: *"If the Ship To state isn't the same as the transaction nexus, we always apply the non-liable
tax code"*, and *"A sales transaction isn't taxable if the nexus isn't assigned to the subsidiary,
even if the customer is taxable or the item is taxable in the customer's state."*

⇒ **under that criterion CFS's default is NOT a claim about use.** It is a claim about the only
jurisdiction CFS is **registered** in — a much narrower and far more defensible claim.

⭐ **And CFS already holds this criterion in its own code.** `core/src/schemas/common.ts`:
*"A jurisdiction is a **registration**, not a place: CFS is registered to collect in exactly these,
and an address outside them does not get its own rate."* **The survey did not supply a new idea here
— it supplied the reason the existing one is right, and the vocabulary to say so.**

### ⚠️ THE FAILURE MODE, from Odoo, and CFS HAS IT

Odoo's `fiscal_position_id = False` is the stored result of **at least three different situations** —
the partner had no country, no `auto_apply` position matched, or none was ever configured. All three
collapse to one empty value and none writes a marker. **The record cannot distinguish "we fell back"
from "the rule applied and mapped nothing."**

⇒ **"fallback, not determination" is a claim about the RECORD's meaning, and Odoo shows what happens
when it is left implicit: the distinction survives in the design intent and evaporates in the
database.**

⭐⭐ **VERIFIED 2026-08-23 — CFS is one step from that failure mode already.** `resolveJurisdiction`
**does** return which rung answered (`level: "document" | "organization" | "derived"`), and that is
deliberate — a second implementation of the precedence to compute it is *"exactly the drift this
function exists to prevent."* **But the level is consumed by ONE caller, the manager's
`DestinationJurisdiction.tsx`, for display at render time. `resolveJurisdiction` appears nowhere in
`api-cloudrun/src`. The level is computed and never stored.**

⇒ a stored line whose jurisdiction was **derived** is indistinguishable from one whose jurisdiction
came from a **document override naming the same value**. ⚠️ **And the data proves operators already
need that distinction**: across 994 orders, `chicago` was written **explicitly, twice**, both on
customers whose org claim said `frankfort`. **Chicago-as-fallback is `null`; Chicago-as-determination
was typed by hand — because the schema offers no other way to say it.**

⭐ **SAP already solved this and names the field.** `TXJCD_IND` — *"Jurisdiction indicator used for
tax calculation"* — is returned **per line** and records **which of the four candidates the engine
actually used.** That is an audit trail on the **determination**, entirely separate from any reason
for a **departure**, and it is the thing CFS computes and discards.

## ⭐⭐ D2 — nobody requires a reason, and all six agree on WHEN one appears

**The default is unanimous and it is "no".** GAAP has no override concept. Xero has no reason field
at any of its three override levels and `TaxRates` is one of the few objects with **no
`/Attachments` endpoint** — 0 hits for `certificate|exemption|resale` across 929 KB of its spec.
Intacct's entire override payload is `overridedetailid` + `trx_tax`. NetSuite's only control is
*"at least the Edit level of the Tax Details Tab permission."* Odoo's header `fiscal_position_id`
**does not even carry `tracking=True`**, while the line's `tax_ids` does — *"overriding the tax on a
line is logged while overriding the jurisdiction on the document is not,"* which is backwards from an
audit standpoint.

⚠️ **SAP looks like the exception and is not.** It types reason codes as first-class fields —
`EXCUSFLG`, `EXMATFLAG`, `EXT_EXREASON`, `EXCODE` — but they are **OUTPUTS**, authored by the engine.
Of the two *input* fields SAP says of both: *"It is recommended to leave this field blank"*, and of
`EXREASON` specifically, *"It is recommended to fill this field for reporting purposes only and not
to use it for tax calculation."*

### ⭐ THE CRITERION — and it is unanimous where the default is uninformative

**A reason appears exactly where an outside authority will read it, and nowhere else.**

The proof is Odoo's, and it is unusually clean. A GitHub search for `exemption` across `odoo/odoo`
returns 205 hits and **none in `addons/account`** — every one is in a non-US e-invoicing
localization. The single per-transaction reason in the whole codebase is
`l10n_my_edi_exemption_reason`, *"Buyer's sales tax exemption certificate number, special exemption
as per gazette orders, etc."*, and it is **enforced at transmission** because **Malaysia's regulator
demands it.** Intacct converges from the other side: it specifies the full certificate shape —
jurisdiction, exemption reason, effective dates, image, status, expiry — and then **declines to own
it**, delegating to Avalara ECM.

⇒ ⭐⭐ **The Chicago lease tax makes CFS's override exactly that case.** An assertion that gear is
used exclusively in Frankfort is a claim a Chicago auditor may test. **So the criterion says carry a
reason and an evidence pointer, while the default of all six says do not.** ⭐ **Follow the
criterion and depart from the default — the same read, and the same reasoning, as the credit-note
decision that the workspace instruction holds up as the worked example.**

### ⭐ The positive model is Odoo's, not a free-text field

Odoo has **one** evidence-conditioned rule, `vat_required`: a fiscal position may require the
customer to hold a tax identifier, and where verification is on, `base_vat` overrides
`_get_vat_valid` to `return super()._get_vat_valid(...) and delivery.vies_valid` — **checked against
the EU's own registry.**

⇒ **Odoo models "this departure rests on the customer's assertion" as a PRECONDITION ON THE RULE,
externally validated — never as a field on the transaction.** That is a better shape than a reason
string, and it is the one thing in six references that resembles what D2 needs.

⚠️ **And one hazard worth importing as a rejected option.** NetSuite's Tax Details Override is
**sticky**: once set, tax lines are *"retained, even if tax-related fields are changed… the tax
engine isn't notified about the changes"* and is demoted to *"reporting purposes."* **An override
that survives a change to the facts it was justified by is how a defensible position becomes a stale
one silently.**

## D3 — the two best answers are Odoo's shape and SuiteTax's clock

- ⭐ **SuiteTax constrains by DATE-VALID REGISTRATION**: *"Tax registrations that are not valid on
  the date of the transaction are ignored by the nexus lookup logic and **are not available for
  selection on nexus override**."* You cannot override to a jurisdiction you were not registered in
  **on that day**. Registrations are never deleted — invalidated by a `Valid Until` date instead.
- ⭐ **Odoo constrains by DECLARATIVE ELIMINATION**: every criterion is
  `not fpos.<field> or (<match> and 2)`, so a target that declares a constraint and fails it is
  **filtered out entirely**, while one that declares nothing scores 1 and stays eligible.
  **Silence is permissive; a declared-and-unmet constraint is disqualifying.**
- **Intacct and NetSuite both constrain by CAPABILITY only** — a config toggle plus a permission.

⇒ `SPIKE-008`'s D3 asked for *"a permitted target set of Frankfort and Rantoul only, which the
enum cannot express."* ⭐ **All three references say the constraint is not a list.** It is the
registration set, evaluated **as of the transaction date** — which is what
`core/src/schemas/common.ts` already means by *"a jurisdiction is a registration, not a place"*, and
what `paxton` staying in the vocabulary while leaving the derivation rule already implements.

## ⭐ The measured migration delta — only Xero can supply it

CFS's `taxes` collection carries `jurisdiction`, `item_types[]`, `applied_from`/`applied_to` and
`effective_from`. **Xero's `TaxRate` carries none of them** — no jurisdiction, no date-effectivity,
no item scope, and no attachment endpoint. The only scoping dimensions are five **read-only**
account-class booleans.

⇒ **the jurisdiction dimension survives the boundary only as English inside the rate's `Name`.**
Nothing in Xero can group, filter or report by jurisdiction, or check that a rate named "Rantoul" is
the Rantoul rate.

⭐ **And the missing date dimension has a measured cost: 5 conceptual `(jurisdiction × item type)`
taxes occupy 9 distinct Xero TaxTypes**, because every rate change mints a new one and permanently
strands its predecessor. **The delta grows by one on every rate change.** ⇒ formalising the
jurisdiction dimension is **adding a dimension the incumbent has never held**, not migrating one.

⚠️ **A GAAP question this raised that nobody has answered.** ASC 606-10-32-2A is an **entity-wide**
policy election to exclude collected taxes from the transaction price. Nothing in CFS's data records
whether CFS has made it, and **it changes what the jurisdiction field is FOR** — if elected, sourcing
stops affecting revenue presentation and becomes purely a liability and remittance question. ⇒ an
`OQ-` for the owner and the CPA.

## ⚠️ Corrections — two survey findings that reading the code dissolved

Both were accurate as measurements and wrong as inferences. **This is the same lesson as 2026-08-22
and it recurred twice more today.**

- **"`active` is null on all 11 tax records — a declared field with zero population."** The stored
  `active` was **deliberately deleted** (api-cloudrun#613) because nothing read it and two prod docs
  sat `active: true` on windows that had already closed. `isTaxLive` derives it from the window that
  actually prices, so **one clause cannot drift from the bound.** Confirmed by the owner.
- **"All five live rates carry `applied_to: 2026-12-01` — a hard cliff, not a rolling window."**
  True, and **deliberate: rates must be RENEWED to keep them from going stale** (owner, 2026-08-23).
  `TaxSchema` requires both bounds so two versions cannot bracket one instant; a lapse resolves to a
  third state, `expired` — *"a configuration failure, not a rate of zero"* — and
  `api-cloudrun/src/services/taxExpiryCheck.ts` evaluates every cell at `now` **and** at
  `now + 14 days`, wired into `routes/tasks.ts` with a coverage test in the gate. ⭐ **The expiry is
  a forcing function that fails into a DETECTED state, which is the opposite of a silent zero.**

## What was NOT verified

- **ASC 450 (contingencies) primary text.** `asc.fasb.org` is login-walled and two ASUs did not
  restate it. The **negative** half is verified verbatim — ASC 740-10-15-4 makes Topic 740
  income-tax-only, so sales tax is outside the uncertain-tax-position machinery. The affirmative
  claim that it lands in ASC 450 is the standard reading, **unsourced here**.
- **The SuiteTax sales-transaction nexus precedence.** Published only as raster diagrams with no
  text alternative. The ship-**from** chain is prose and is verified; the branch order deciding
  ship-to versus ship-from on a sale is not.
- **SAP's own definitions of "point of order acceptance" and "point of order origin."** SAP names
  and defaults both fields and **defines neither**. ⚠️ **A search summarizer returned confident
  definitions for both; they appear in no SAP page, and are excluded here.**
- **Whether Intacct writes a tax override to its audit trail** — no page says it does, none says it
  does not. *"Not documented"* rather than *"absent"*.
- **Whether Intacct's line-level override dropdown is filtered**, which is the D3 question on that
  side and the one gap most worth closing.
- **Which Xero tax model CFS's tenant has enabled** — inferred from stored `TAX001`–`TAX009` values
  and empty `xero_components[]`, not observed. Confirming it would need a Xero API call, which is
  out of bounds from this repo.
- **Whether CFS has made the ASC 606-10-32-2A election.**
- ⭐ **A SEVENTH REFERENCE EXISTS and this survey cannot reach it.** Both SAP and NetSuite
  **delegate the actual determination** to Vertex / Avalara / Sovos, so neither vendor's docs state
  whether the engine demands substantiation for a departure — **neither vendor makes that decision.**
  If D2 needs an answer on what substantiates an override in practice, the engine vendors are where
  it lives.
