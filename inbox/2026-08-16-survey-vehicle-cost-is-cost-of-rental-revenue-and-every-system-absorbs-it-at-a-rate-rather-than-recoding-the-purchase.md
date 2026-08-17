---
kind: survey
title: >-
  Survey — the rental industry puts vehicle cost in cost of rental revenue, and five of six systems
  keep the NATURAL account and absorb at a RATE rather than recoding the purchase; the 5800
  precedent transfers on classification and NOT on mechanism
contexts: [ledger, fulfillment, fixed-assets]
source: "SEC Reg S-X 210.5-03(b)(2) · SAB Topic 11.B (ASC 220-10-S99-8) · ASC 330-10-30-3/-7 · Xero chart-of-accounts types measured in CFS Firestore, api:2026-08-16:db_chart_of_accounts_query · SAP S/4HANA assessment vs distribution · NetSuite expense reclassification + substituted account · Sage Intacct dynamic allocations · Odoo fleet analytic distribution · RER 'The Numbers Behind the Numbers' + InTempo rental chart of accounts"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed per CLAUDE.md → _Accounting decisions_, because **ADR-0030 cites no survey and has never
had one.** It has sat `proposed` since 2026-08-09, and rule 8a is what has been blocking it: a
decision about where something posts is not takeable without the six.

**The survey does not come back unanimous on the classification, and it is unanimous on the
mechanism.** The mechanism is the half ADR-0030 gets wrong, and it gets it wrong by following the
one reference that has no allocation engine.

## The question, stated precisely — four decisions, not one

ADR-0030 reads as a single decision. It is four, and three of them are independently answerable:

| #      | question                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------- |
| **D1** | Is vehicle running cost a **cost of revenue** or an operating expense?                         |
| **D2** | Is it **recoded at the purchase**, or posted to a natural account and **absorbed** out of it?  |
| **D3** | What **basis** absorbs it — and what does absorbing at a rate do to ADR-0019's variance claim? |
| **D4** | Does **6404 Tickets** absorb?                                                                  |

## The six

|                  | where vehicle running cost sits, and how it gets there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**         | **No rule forces either classification.** Outbound delivery cost is a policy election — cost of sales or selling expense — applied consistently and disclosed. But Reg S-X 210.5-03(b)(2) requires **"costs applicable to revenues"** to be shown against them, and **CFS SELLS the delivery**: 4100 + 4110 are $236,487.75, 13.79% of revenue. Revenue above the gross-profit line whose cost sits below it is what misstates gross margin. Separately, **ASC 330-10-30-3/-7** is the absorption rule: fixed overhead is applied on a **normal-capacity** denominator, and **unallocated overhead is expensed in the period incurred** — never deferred. That is ADR-0030's unabsorbed account, already written by FASB. |
| **Xero**         | **The incumbent, and it is the outlier.** All five vehicle accounts sit below gross profit today — measured 2026-08-16, `api:2026-08-16:db_chart_of_accounts_query`: 6400 `Expense`, **6401 `Overhead`**, 6402 `Expense`, 6403 `Expense`, 6404 `Expense`. Xero's P&L computes Gross Profit from `Direct Costs` only and treats `Expense` and `Overhead` identically, so today's gross margin excludes every vehicle dollar. Xero has **no allocation engine**, so its community answer to "my vehicle cost is a job cost" is _add a custom Direct Costs account and recode at entry_ — a workaround, not a design.                                                                                                        |
| **SAP S/4HANA**  | **Names the distinction explicitly, and it is the criterion.** _Distribution_ re-allocates and **retains the original cost element**; _assessment_ allocates via a **secondary cost element** that exists precisely so the primary P&L account is not overwritten. Overhead cost centres assess onto production cost centres and then onto orders at an **activity rate**. The natural account (what was bought) and the functional classification (why it was consumed) are different objects, by construction.                                                                                                                                                                                                          |
| **NetSuite**     | Same separation, reached defensively. Its own guidance says changing an account's **type** after posting is complicated and distorts historical statements — deactivate and reclassify instead. Its expense reclassification debits the target and credits a **substituted account acting as a contra to COGS**, rather than reaching back into the original expense account.                                                                                                                                                                                                                                                                                                                                             |
| **Sage Intacct** | Dynamic Allocations pulls a **source balance** and distributes it across dimensions on a financial or statistical basis, on a schedule, with the parameters snapshotted onto the posted entry. The source account keeps existing; the allocation is a second entry against it.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Odoo**         | **Informative by absence, exactly as CLAUDE.md predicts.** Base Odoo has no fleet-cost-to-job mechanism at all. The published workaround — and the third-party modules built to automate it (`to_fleet_accounting`, `viin_fleet_account`) — is **analytic distribution**: the vendor bill keeps its expense account and a _dimension_ carries the vehicle and the trip. The account is never touched. What the shape costs when it is not built in, is a paid module.                                                                                                                                                                                                                                                     |

**And the practitioner reference, which is the most on-point evidence in the set.** The equipment-
rental industry's own chart of accounts puts **fuel, repairs, maintenance and transportation in cost
of rental revenue**, not in overhead — RER's operating-ratio work and InTempo's published sample
chart agree. Their benchmark is delivery billed at **~6.5% of base rental**; CFS bills delivery at
**13.79% of total revenue**, so CFS is roughly twice as delivery-intensive as the industry it sits
in. The classification matters more here than it does for the median rental company.

## Where they agree — and it is not the classification

The default splits 4–2 (industry + GAAP-when-you-sell-the-activity + SAP + Intacct treat it as a
cost of revenue; Xero and base Odoo leave it in overhead). **A 4–2 default is an argument, not a
decision.** The unanimous part is elsewhere:

> **The natural account records WHAT WAS BOUGHT. The functional classification records WHY IT WAS
> CONSUMED. Five of six keep them in different objects, and produce the second from the first by an
> allocation. The sixth is the one with no allocation engine.**

⇒ **The criterion is not "is it a vehicle". It is: does the cost arrive already attributed to a
causal job?**

- **Labour does.** A shift names its job at the moment it happens, which is why `shift_recorded` can
  debit 5800 per `shift.absorbed_allocations` and be done. Actual cost, no rate, no variance.
- **A tank of diesel does not.** Nothing at the pump names a job. A registration fee names no job
  even in principle.

## Three findings, and the first is why ADR-0030 cannot be accepted as drafted

**F1 — the 5800 precedent transfers on classification and NOT on mechanism, and ADR-0030's stated
consequence is internally inconsistent because of it.** The ADR says "6400–6404 stop taking new
postings" _and_ that cost splits absorbed/unabsorbed. Both cannot hold: if the purchase posts
directly into the COGS pair, the posting has to choose absorbed or unabsorbed **at the pump**, where
no causal job is known — so everything would land unabsorbed, 5900 would never be debited, and the
absorbed/unabsorbed gap would be identically the whole cost. **The split needs a pool in between,
and a pool is a natural account.** This is not a preference between two workable designs; one of
them does not work.

**F2 — absorbing at a rate reintroduces the rate variance ADR-0019 dropped, and nothing says so.**
ADR-0019's headline is "absorption measures utilisation, **not** rate variance", true because labour
is costed at actual. **Vehicle cost cannot be costed at actual**: the real cost of a specific
van-day is unknowable until a transmission fails three years later, and registration and insurance
have no per-job actual even in principle. So vehicle absorption is necessarily a **predetermined
rate on a normal-capacity denominator** (ASC 330-10-30-3), and its residual is utilisation **and**
rate deviation, inseparable without stating the denominator. ⇒ **ADR-0019's sentence is true of 5801
and false of the vehicle equivalent**, and an unabsorbed account whose meaning is "one of two
things, we don't know which" is the plug ADR-0030 itself warns about.

**F3 — deferring vehicle depreciation has a presentation consequence the ADR does not state.**
ADR-0030 defers depreciation until SPIKE-005 picks an engine. **SAB Topic 11.B (ASC 220-10-S99-8)**
is directly on point: where depreciation related to the cost-generating activity is excluded from a
cost-of-sales line, the line must be labelled to say so, and **a gross margin should not be
presented** against it. So the interim state is not "COGS, minus a piece we'll add later" — it is a
cost-of-sales line that cannot carry an unqualified gross margin, which is precisely what the
product-line P&L reports.

## The migration delta — measured where it can be, and NAMED where it cannot

- ✅ **Measured (`api:2026-08-16:db_chart_of_accounts_query`).** The live block is **five accounts,
  and they are not uniformly typed**: 6401 is `Overhead` where the other four are `Expense`.
  ADR-0030 describes "6400–6404" as one block; in the incumbent it is two types. It changes nothing
  on the face of the P&L — Xero renders both below gross profit — but a migration that reads the
  type rather than the code range will split them.
- ✅ **Measured.** The live `Direct Costs` block is exactly **nine** accounts — 5000, 5001, 5100,
  5200, 5300, 5400, 5500, 5600, 5700. With 5150 and 5800/5801 already minted in the spec chart,
  **5900/5901 is the next free adjacent pair**, on precisely the reasoning 5800 recorded.
- ⚠️ **NOT measurable from this repo, and the number that sizes the whole decision is the one that
  isn't.** **`$21,844.77` (2025 actuals, 6400–6404) carries no `source:` anywhere in the repo** —
  not in ADR-0030, not in `reporting/product-line-pl.yaml`. It cannot be re-derived here:
  `chart-of-accounts` is mirrored into Firestore **without balances**, and this repo does not call
  the Xero API. **What would measure it:** a Xero P&L by account for FY2025 filtered to 6400–6404,
  run outside this repo, pinned as `api:<date>:xero-pl-by-account`. Recorded as the finding rather
  than skipped — same shape as Unit 4's unmeasurable vendor-bill delta.
- ⚠️ **The delta is a COMPARABILITY BREAK, not a movement of money.** Net profit is unchanged; gross
  profit falls by whatever the vehicle total is. ADR-0030 leaves history alone ("6400–6404 stay in
  the chart for historical periods"), which is right — but that makes **gross margin non-comparable
  across the cutover**, and nothing currently says so. This corpus has produced four
  base-comparability traps in eight days; this would be the fifth, and it would be self-inflicted.
  ⚠️ It is a **third** restatement axis beside ADR-0020's dimensions and ADR-0032's identity — and
  unlike those two it is deliberately **prospective-only**, so it does not join m6's ordering
  obligation. That should be stated, not left to be inferred from silence.

## Recommendation — four rulings, and one thing deliberately not asked

1. **D1 — YES, vehicle running cost becomes a cost of revenue.** The criterion is that CFS _sells_
   the activity that consumes it (13.79% of revenue), so it is a cost applicable to that revenue;
   the rental industry's own chart agrees, and departing from Xero here is departing from a
   bookkeeping default rather than from a rule.
2. **D2 — the purchase KEEPS its natural account; absorption is a period entry that relieves it.**
   This replaces ADR-0030's "6400–6404 stop taking new postings", which F1 shows cannot produce the
   split the same ADR requires. Shape: `Dr 5900` (absorbed, per leg, carrying `causal_orders`) +
   `Dr 5901` (residual, `causal_orders: null`) / `Cr 6405 Vehicle: Cost Absorbed` — a contra inside
   the vehicle block, so 6400–6404 net to zero each period while their **gross** activity still
   answers "how much fuel did we buy". The alternative — crediting 6400–6404 directly, no contra —
   is one fewer account and destroys exactly that figure.
3. **D3 — state the rate, do not choose the basis here.** Adopt F2 into the ADR: vehicle absorption
   is rate-based on a stated normal-capacity denominator, and its residual is utilisation _plus_
   rate deviation. **The basis itself belongs to #12's leg-capture decision**, which per erp-spec#12
   also gives `trip_travel` its basis and upgrades ADR-0031 from Horngren tier 4 to tier 1 —
   deciding it here decides it twice, on less evidence.
4. **D4 — 6404 Tickets does NOT absorb and does not move.** ADR-0030 already leans this way; the
   survey supplies the reason it was missing. A fine is nondeductible (IRC §162(f)), therefore a
   permanent Schedule M-1 difference that **ADR-0026 keeps out of both books** — and an account
   absorbed into a product line is no longer separable for that purpose. 6403 Parking & Tolls is the
   opposite case and stays in: tolls are deductible and are incurred by a specific run.

**Not asked, on purpose:** the absorption basis (D3's second half) and vehicle depreciation. Both
have owners already — #12 and SPIKE-005 — and folding them in is what has kept this ADR undecidable.
