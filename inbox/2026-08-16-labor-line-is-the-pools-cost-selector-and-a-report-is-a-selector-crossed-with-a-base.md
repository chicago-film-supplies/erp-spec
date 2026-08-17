---
kind: decision-input
title: >-
  `labor_line` is the allocation pool's COST SELECTOR — the product-line P&L distributes
  `labor_line: delivery` across product lines, and the same mechanism generalises to any
  (cost selector × base) combination, which is what makes future reports configuration rather than
  machinery
contexts: [ledger, fulfillment]
source: "Repo owner, 2026-08-16, in session · ADR-0029, ADR-0031, ADR-0036 · OQ-031, OQ-034, OQ-042 · reporting/product-line-pl.yaml"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

**Owner, 2026-08-16:** _"in whatever reporting mechanism we create, the p&l by product line will
distribute labor costs with labor_line delivery across product lines, the same mechanism will allow
other combos for future reporting."_

Two statements, and the second is the larger one.

## 1. `labor_line` selects the POOL. It was never a label

`reporting/product-line-pl.yaml` already carried this in prose — the `delivery` pool's note said
"cost joins this pool as it arrives: labour COGS … `labor_line: delivery`" — but only in prose, and
only for one pool. The ruling makes it the general rule: **a pool's cost side is a `labor_line`
selector.**

That answers OQ-046, which was opened the same day claiming nothing exercises `labor_line`. **The
claim was wrong in its conclusion and right in its evidence.** Nothing in `ledger/` exercises it and
nothing ever will — ADR-0036 makes it derived, so it reaches no transfer. What exercises it is the
REPORT, and the report was describing the selection in a sentence rather than declaring it.

## 2. ⚠️ The 3 → 7 enum growth was not cosmetic, and this is what it was FOR

`cost_type` had three values — `delivery`, `counter`, `warehouse`. With three, only one activity
pool could name its own labour and the rest had nowhere to point. **With seven, every severable
activity pool selects its own cost**, and the correspondence is exact:

| `labor_line`          | pool            | product line    | treatment                              |
| --------------------- | --------------- | --------------- | -------------------------------------- |
| `delivery`            | `delivery`      | Delivery        | **spreads** — not severable (ADR-0029) |
| `trucking`            | `transport`     | Transport       | severable, own margin (OQ-034)         |
| `shipping_&_handling` | `shipping`      | Shipping        | severable, own margin (OQ-034)         |
| `trash_&_cleanup`     | `trash_cleanup` | Trash & Cleanup | severable, own margin (OQ-031)         |
| `crew`                | `crew`          | Crew            | severable, own margin (OQ-031)         |
| `counter`             | —               | —               | bills nobody                           |
| `warehouse`           | —               | —               | bills nobody                           |

**Five of seven mirror an activity product line, and there are exactly five activity product
lines.** The correspondence is total, which is what makes a coverage gate possible at all.

⚠️ **The mapping is NOT derivable from the names and must be declared.** `trucking` ↔ `Transport` is
the counter-example: the labour classification and the product line are different words for the same
activity, because `Transport` is the incumbent Xero tracking category and `trucking` is what the
owner calls the work. A convention that matched on the string would silently drop that pool.

## 3. ⚠️ A DEFECT this ruling exposes — `transport` was selecting delivery labour

`reporting/product-line-pl.yaml`'s `transport` pool said its cost is "labour COGS resolving to
`labor_line: delivery`". **That was written when the enum had three values and trucking labour had
nowhere else to go.** It survived the erp-spec#19 sweep because the sweep renamed `cost_type` →
`labor_line` in that sentence without re-reading what it claimed.

The effect if built: a long-haul crew-day would enter the `delivery` pool and **spread across goods
lines**, while `Transport` — the pool that is meant to carry its own margin — reports revenue with
no cost against it. That is the exact failure the `crew` and `trash_cleanup` notes already warn
about, arrived at from the other side: _"a severable line with revenue and no cost against it would
report a margin near 100%."_ It would also overstate goods COGS by the same amount.

## 4. The general form, which is the ruling's second half

A report in this family is three things:

    (cost selector) → spread over (base) by (basis)

Today's official product-line P&L is `labor_line: delivery` → goods revenue on the causal order →
largest remainder (ADR-0031). "Other combos" are new **rows of configuration**, not new machinery:
the same three fields with different values.

⚠️ **What this does NOT do is make allocation re-openable.** ADR-0029's "exactly ONE official
allocation" stands — the official product-line P&L is one report with one basis. Other combos are
additional reports, and each is subject to the same rule that made ADR-0029 necessary: **stated
once, or two reports disagree about the margin on the same product line.** A configurable mechanism
makes it cheap to produce a second number; ADR-0029 is what says only one of them is the managed
one. The generality is in the machinery and must not leak into the authority.

## 5. What stays open

**`counter` and `warehouse` bill nobody, and where their cost lands is undecided.** Both are real
absorbed labour — a counter hour and a warehouse hour absorb into 5800 against a causal job — but
neither names a product line, so no pool selects them. Three shapes are available and the owner has
ruled on none:

- **spread**, like `delivery`, on the argument that counter and warehouse time is a joint cost of
  the goods revenue and not severable;
- **unallocated**, reported below the allocated margin, which is honest and leaves goods COGS
  understated;
- **attach to the causal order's goods directly**, without spreading — which is the causal-job rule
  `crew` and `trash_cleanup` already use, and is not the same thing as spreading.

⚠️ **The size is unmeasured and probably not small.** The current system has never had the absorbed
labour stage at all (erp-spec#14: "the population that makes 2010 material is labour, which measures
as zero everywhere"), so there is no corpus figure to cite here and there will not be one until v2
runs. That is an argument for deciding it on the criterion rather than waiting for the number —
`Delivery` spreads because it is not severable, and the same question asked of a warehouse hour has
an answer that does not depend on its size.

Carried as **OQ-046**, restated.
