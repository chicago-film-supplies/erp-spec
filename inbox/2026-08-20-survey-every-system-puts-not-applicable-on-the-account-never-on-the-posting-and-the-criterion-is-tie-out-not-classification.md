---
kind: survey
title: >-
  Rule 8a survey for ADR-0025's surviving question — no surveyed system lets a POSTING declare "not
  applicable"; every escape hatch sits on the account or the scope, and the criterion running
  through all five is tie-out rather than classification
contexts: [ledger, billing]
source: >-
  Six-reference survey, 2026-08-20, plus two beyond the six (Kimball DT#43, XBRL Dimensions 1.0).
  Xero delta measured read-only from the Firestore mirror via `spikes/harness/corpus.ts` — never
  the Xero API. Chart measured `api:2026-08-20:db_chart_of_accounts_query`, 134 accounts.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owed by **ADR-0025** (the dimension obligation is per account), `proposed` since 2026-08-09.

⚠️ **The ADR's own mechanism is dead** — a per-account `dimensions:` list is refused by a validate
gate since ADR-0036 superseded ADR-0018
(`inbox/2026-08-20-superseding-adr-0018-invalidated-the-foundations-of-three-proposed-adrs-and-nothing-detected-it.md`).
This surveys the question that **survives**: _when a reporting dimension does not apply, how is that
recorded — and is "no value applies" distinguished from "nobody classified it"?_

⚠️ **Reach failure, stated up front.** The session's 200-call search budget was exhausted partway
through and every fallback engine returned challenges. **Practitioner guidance on catch-all members
is unfilled for every vendor — do not read that silence as "practitioners are silent."**

---

## The answer, in one table

| Reference                          | Explicit "not applicable" member?                                             | Requirable **per account**?                                | Declared-null ≠ absent? |
| ---------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------- |
| **GAAP**                           | residual _captions_ permitted, no member                                      | n/a                                                        | **no**                  |
| **Xero** (incumbent)               | **no** — reports label it `Unassigned`                                        | **no**, declined twice in public                           | **no**                  |
| **SAP S/4HANA**                    | **substituted, not declared** — a dummy profit center is a real master record | **YES** — field status group on the G/L account            | **no**                  |
| **NetSuite**                       | only in **mapping rules**, never on the transaction                           | **no** in core; a localization bolt-on                     | **no**                  |
| **Sage Intacct**                   | **no** — "no value" is a computed report row                                  | **YES** — a GL-account section titled "Require dimensions" | **no**                  |
| **Odoo**                           | **no** — unset is an empty JSON mapping                                       | **YES** via plan applicability on GL-account prefix        | **no**                  |
| _(beyond six)_ **Kimball DT#43**   | **YES — three, one per reason**                                               | n/a                                                        | **YES**                 |
| _(beyond six)_ **XBRL Dimensions** | **inverted** — absence _means_ the default member                             | n/a                                                        | **no**                  |

## ⚠️ The crux: nobody does what ADR-0025 proposes

**No surveyed system distinguishes "declared not applicable" from "missing" on a posting.** Every
not-applicable mechanism attaches to the **account or the scope**, once, in configuration —
Intacct's unchecked "Require dimensions", SAP's `Suppress` field status, NetSuite's segment
restriction, Odoo's plan `unavailable`.

SAP is the most explicit: in CO-PA, **"not assigned" is SAP's name for blank**, not a contrasting
value — _"blank (otherwise known as 'not assigned' or 'unassigned' in CO-PA)"_. Intacct is the most
precise about why: _"the general ledger isn't looking for this flag, it's looking for transactions
without a dimension in the field."_ The flag lives in the report layer; the GL holds an empty field.

**The nearest miss is NetSuite's `-Unassigned-`** — "a specific value" defined as "null on the
transaction record", priority-ranked against `-Any-`. And **where it sits is the finding**: in the
Chart of Accounts Mapping rule, **one layer above the ledger**. NetSuite named the null so a _rule_
could target it, and still did not put it on the transaction.

Only the dimensional-modeling tradition draws CFS's line, and it draws **three** states rather than
two — Kimball DT#43 gives separate named members for "Data not yet available", "(correctly) not
applicable" and "Missing key".

## ⭐ THE CRITERION — and it redirects the rule rather than confirming it

**The line running through all five ERPs is not "was this classified?" It is "can the book still be
tied out if this is missing?"**

- SAP's dummy profit center exists so _"internal and financial accounting data are reconciled"_.
- BW creates its Not-Assigned node to guarantee _"always same overall result"_.
- SAP Analytics Cloud's rule for which dimensions get an unassigned member is _"**all of your data
  needs to be explicitly assigned**"_ — completeness, not applicability.

⇒ **Completeness of a book that must reconcile, never completeness of classification.**

Applied to CFS, that criterion cuts two ways and both are useful:

1. ✅ **It endorses ADR-0036.** `product_line` is explicitly BI-not-compliance, and
   `reporting/product-line-pl.yaml` is `sealed_at_close: false`. That is exactly the case where
   every surveyed system lets the value be absent and reports the residual on its own row.
2. ⭐ **It endorses moving the obligation to `causal_orders`** — which **is** a key something must
   tie out on, and which **ADR-0029 already requires on every posting** or its allocation quietly
   becomes "never allocate". The rule ADR-0025 wants is defensible; it is pointed at the wrong
   field.

## GAAP settles the account-vs-dimension half, and it is not close

- **Reg S-X 210.5-03** puts "Net sales and gross revenues" at **caption 1** and **"Non-operating
  income" at caption 7**, naming interest and "miscellaneous other income" inside 7 — with material
  amounts there required to be broken out _"indicating clearly the nature of the transactions out of
  which the items arose"_.
- **ASC 606-10-50-4(a)** requires revenue from contracts with customers disclosed _"separately from
  its other sources of revenue"_. Interest, cashback and vendor refunds are not revenue from a
  contract with a customer at all.

⇒ **`4820 Interest Income` cannot be a `product_line` value under any reading**, and tagging it on
`4100` would leave it inside operating revenue on the face of the statement. **`4800 - Other Income`
is the mainstream answer**, and every system's escape hatch is likewise an account or a scope. **The
declared null beside it is the part nobody else has.**

✅ And **GAAP names CFS's dimension**: ASC 606-10-55-91's first example disaggregation category is
_"Type of good or service (for example, **major product lines**)"_.

⚠️ Reg S-X binds registrants; CFS is private. Criterion, not requirement.

## Catch-all members — and CFS's stated reason is the one thing unsupported

**GAAP explicitly permits two** ("other revenues", "miscellaneous other income"), bounded by a
**10%** combining threshold plus the break-out-and-describe requirement. Sage's 1,193-page help
corpus contains **no dimension-design best-practices page at all**.

The strongest vendor evidence is **SAP warning three times on its current S/4HANA page against its
own catch-all** — and the remedy it repeats is instructive: _"For such cases, **define separate
profit centers**"_ — **more members, not a null and not the bucket.** SAP also treats a dummy value
as less trustworthy than a real one: it is the single field a correction tool may overwrite.

⚠️ **CFS's stated reason for deleting `Other` — "it reads as a category and means 'nobody chose'" —
is corroborated by no surveyed system**, and the one tradition that addresses it head-on (Kimball)
contradicts it by keeping named members for exactly that. **The defensible argument is the
materiality one, and it reaches the same conclusion**: the "operator declined" population is
**0.041% / $688.00**, and the population that forces a visible row is **15.37%** — and they are not
the same population.

⚠️ **A forced declaration is not a determination.** Charted (a NetSuite partner) names the risks of
making a dimension mandatory: _"users selecting the first value they find because they don't know
what to choose"_ and _"users simply leave that default and never update"_. CFS's declared null is a
better answer than a forced member — but **$688.00 measures the operators who DECLINED, never the
ones who GUESSED, and no gate can see the difference.**

## The migration delta — stated, then measured, and it is not nil

**Stated: Xero imposes no obligation at all, and has publicly declined twice to build one.** Making
tracking mandatory _"isn't on our roadmap for development"_ (Xero, 15 Jul 2025); binding a tracking
category to a chart-of-accounts code _"isn't in our plans for the time being"_ (15 Aug 2025). Both
**"Not in pipeline"**. Confirmed in the primary schema: an `Account` has **no tracking field of any
kind**, and a line's `Tracking` is an array with no null member.

⇒ **ADR-0025's mechanism is the feature Xero users have been requesting since 2024 and Xero has
refused. CFS is not departing from Xero's default — it is building something Xero lacks.**

**Measured 2026-08-20** (Firestore mirror, void/draft excluded): 1,017 invoices · **8,937
revenue-bearing lines · $1,647,754.17**.

|                                                          |   lines |           value |      share |
| -------------------------------------------------------- | ------: | --------------: | ---------: |
| **Unassigned in Xero** (`xero_tracking_option_id` empty) | **152** | **$235,579.19** | **14.30%** |
| CFS line `tracking_category` empty                       |     296 |     $253,230.15 |     15.37% |

⚠️ **151 lines / $19,350.96 are CFS-empty but Xero-SET** — the Xero ledger holds a classification
CFS's own line does not. Same direction as the invoice #1987 `Transport` finding at **151× the
scale**, and **not covered by the `tracking_missing` → 0 repair**, which was denorm-vs-master where
this is denorm-vs-Xero. **This is a new defect and it belongs in api-cloudrun, not here.**

⚠️ **Retiring a dimension member has a measured cost.** **222 revenue-bearing lines / $158,002.94**
carry a Xero tracking option id **not in CFS's live 20-option registry**, across 8 ids. Five were
named indirectly from CFS's own denorm (`Trash & Cleanup` 39/$112,100; a mixed id 46/$15,535;
`Transport` 7/$11,250; `Replacements` 14/$8,997). **The largest by line count — 110 lines /
$6,830.96, `tracking_category` null on every one — is UNNAMED.** Its shape fits a retired `Other`.
Naming it needs `includeArchived=true` against the Xero API, **which this repo must not call. Do not
assume.**

## Is CFS's rule wrong or unusual? Plainly

**Unusual: yes, more than expected. Wrong: not shown — but the ADR's own argument is not the one
that carries it.**

1. CFS would be **the only system in the survey where a posting can say "I considered this and no
   value applies."**
2. **Intacct thought about exactly this and put the determination in the report, not the ledger** —
   which is what ADR-0036 later decided independently.
3. **XBRL inverts the rule outright**: absence is _required_ to encode the default member. "Absence
   is always an oversight" is a design position, not a universal.
4. **Kimball keeps the distinction and rejects the null**, because a null drops rows — a reason CFS
   already accepts (`unallocated_row_shown: true`).
5. The rule is **exercised, not theoretical** — `ledger/posting-rules.yaml` carries ~15
   `causal_orders: null` declarations with golden vectors on both arms. ⭐ **Note which field those
   are on.** The mechanism already works where the criterion says it belongs.

## ⚠️ One measured discrepancy in ADR-0025 itself

Its Context says _"`4820 Interest Income` **and five siblings** are `type: Other Income` live"_ —
six. Measured today: **exactly five** (4800, 4810, 4820, 4830, 4840, all Active, no archived sixth).
ADR-0025 is `proposed`, so this is an amendment rather than an ADR-0034 correction note.

## What was NOT verified — 19 rows in the working file

Headlines: **Xero Central's own article text** (JS shell; curl, Googlebot UA and three WebFetch
attempts all failed), so the 100-option limit is practitioner-only — the 2-category limit **is**
confirmed from the OpenAPI report parameters. **The two unnamed retired Xero option ids.** **Whether
a required dimension can EVER be satisfied by an explicit null in Sage** (undocumented, strongly
implied no). **NetSuite's `-None-` as a real dropdown label**, and `community.oracle.com` fully 403
— its two most on-point threads are the first place to look next. **Any SAP term for a declared
not-applicable value**, and **two SAP pages giving conflicting field-status priority orderings**
(quoted, not reconciled).

## ⭐ One thing worth carrying regardless of the decision

Odoo's **stated** guarantee — _"The entry cannot be confirmed if no analytic account is selected"_ —
and its **executing** guarantee differ by a `validate_analytic` context key set on five buttons in
view XML. Unchanged 16.0 → 19.0, and the author's own PR says the bypass is deliberate _"so
automatic flows are still not blocked"_. Odoo's own test suite asserts the bypass and asserts the
invoice posts.

⇒ **This repo's "a stated guarantee that nothing executes is not a guarantee", visible in a shipping
ERP.** Whatever CFS states about a required dimension, the question is which code paths the check
actually runs on.
