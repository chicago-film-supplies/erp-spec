---
kind: finding
title: The 28.8% untracked figure is three populations, and only 4.0% is unambiguously undecided
contexts: [ledger, billing]
source: "api:2026-08-09:db_invoices_query — all 9,194 revenue lines, decomposed by account"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

REQ-LED-001's rationale rests on a measured number: **28.7% of line revenue carries no product
line**, and it is the justification for making the dimension non-optional. Reproduced today at 28.8%
/ $486,516.99. Decomposed by account, it turns out to be three different things.

| population                                                                                           | lines |    revenue | of all revenue |
| ---------------------------------------------------------------------------------------------------- | ----: | ---------: | -------------: |
| **Dimensionless by design** — 4800 Other Income, 2210 Bottled Water Tax, 2800 PSA Clearing           |     9 |  46,798.39 |       **2.8%** |
| **Service and other — a declared null may be the right answer** — 4100, 4120, 4140, 4150, 4110, 4700 |   238 | 372,562.60 |      **22.1%** |
| **Goods — a product line unambiguously applies** — 4000 Rental, 4200 Retail, 4210 Replacement        |   143 |  67,156.00 |       **4.0%** |

## Why this matters to the requirement it justifies

**After ADR-0025, "carries no product line" and "is a defect" stopped being the same statement.** An
explicit `product_line: null` is now a legal, countable answer meaning "no tracked value applies";
absence is what is refused. So the 28.8% figure conflates:

- 2.8% that is **correctly** dimensionless — those accounts name no dimension, so a posting to them
  carrying one would be _refused_. Not a defect in any reading.
- 22.1% of service revenue where the OQ-025 residue lives (Warehouse Rental, Office Rental, Indoor
  Parking, Location Scouting, Security) — for which **null is the decided, correct answer**. Some of
  it is certainly genuinely undecided too, and this measurement cannot separate the two without
  reading line descriptions.
- **4.0% — 143 lines, $67,156 — on rental, retail and replacement accounts, where a product line
  obviously applies and nobody set one.** This is the unambiguous defect, and it is the number that
  should be watched.

The requirement is unaffected: absence must still be refused, and a dimension that may be absent
will be absent. But **the rationale's headline number overstates the defect by roughly seven
times**, and it was measured before ADR-0025 made null a legal answer. Worth amending rather than
requoting.

The largest untracked lines are all `type: service` on 4100 — $31,500, $19,250, $16,000, $15,000,
$14,400, $13,600 — which is the shape of the facility and professional-service population, not of
mis-keyed rentals.

⚠️ One expectation this measurement did **not** confirm. Large one-off contract-labour work is real
— the P&L shows **4120 Contract Labor Income of $156,500 in 2023** — but only **$31,570 across 3
lines** appears in the invoice corpus carrying line-level tracking. The rest is not in these 999
invoices at all, so it is invisible to any line-level analysis and cannot be what drives the 28.8%.
Where that revenue was booked is unresolved.

## The 4100 / 4110 split is deliberate, and it has a costing consequence

Owner, 2026-08-09, on why `Delivery` spans two accounts — it is not drift:

- **4100 Service Income** — the delivery / setup / removal **charge**. A service performed by a
  person, so it is **labour-bearing**.
- **4110 Delivery Surcharges** — off-hours, rush or weekend. Part of the Delivery product line, but
  **not a service performed by a person**. A surcharge.

Measured: Delivery is 79.8% on 4100 ($172,510) and 20.0% on 4110 ($43,290).

**The consequence for labour costing is already decided by OQ-006.** A surcharge carries no
incremental labour: the same delivery happens, at the same crew cost, and the customer pays more
because it is a Saturday. So 4110 revenue is **margin, not a cost driver** — exactly OQ-006's ruling
that "the premium the customer pays is margin, not cost; absorbing it would book a cost never
incurred and overstate COGS." So the Delivery line's cost attaches to the 4100 service, and the 4110
surcharge improves the line's margin without adding to its cost. Anything that allocated delivery
COGS in proportion to _total_ Delivery revenue would misallocate by the surcharge share.
