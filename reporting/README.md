# reporting/

The read side. **One official allocation, specified once** — ADR-0029 — plus the queries that
produce the statements.

This directory is in the _refactored freely_ lifecycle (`CLAUDE.md`): CI-validated, rewritten as the
spec sharpens. Nothing here is executable spec — the `.sql` files are stubs against a posting schema
`m3` has not finished, and they say so.

## What is here

| file                       | what it settles                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `allocation-bases.yaml`    | the versioned registry of ways a pool may be spread, each declaring its criterion tier                                    |
| `product-line-pl.yaml`     | **the** official report: which lines are goods, which are activity, which pools allocate, and how the result is presented |
| `vectors/product_line_pl/` | golden input → expected-share vectors, including the cases an implementation gets wrong                                   |
| `queries/`                 | the DuckDB/SQL shape of each statement                                                                                    |
| `fixtures/`                | (empty)                                                                                                                   |

Gate 13 in `tools/validate.ts` enforces the lot.

## Three things worth knowing before editing

**The allocation is a proxy and the data says so.** `criterion: ability_to_bear` on the only active
basis is not self-deprecation — it is Horngren's lowest tier, recorded in the field the gate reads,
because the cause-and-effect driver (weight, volume, distance) is **uncaptured**: 0 of 549 products
carry a non-zero shipping dimension. Gate 13 refuses any basis below `cause_and_effect` that does
not name the driver it stands in for, so the day someone adds a better basis the old one cannot
quietly claim to be one.

**Coverage is the gate that will actually fire on you.** Every value in `ledger/dimensions.yaml`'s
`product_line` must be classified `goods` or `activity` here, and every activity line must land in
exactly one pool — `allocated`, `not_allocated` with a reason, or `blocked` on a live blocker.
Adding a product line without deciding is a build break, and that is deliberate: the silent default
would be "goods", and a goods line starts absorbing delivery cost the moment it exists.

**The control total is the one property that is not a restatement of the spreading rule.** Every
vector asserts `Σ shares + unallocated == pool`. Proportionality would be defined in terms of the
rule and could only ever agree with it — the repo has already paid for that mistake once, when a
path guard that could only consult its own normalizer certified 79 provably-wrong items as clean.
Pair every fixed-point check with a property that holds independently of it.

## The two views, and the one that must never be published as the margin

| view                                         | reads                       | answers                                              |
| -------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| **un-allocated** (the ledger's own grouping) | postings as posted          | what did delivery cost us; what did we charge for it |
| **allocated** (this report)                  | postings + the stated basis | what does a product line really earn, delivered      |

⚠️ The un-allocated view shows `Delivery` — the largest tracked product line, $216,050 and 12.8% of
revenue — at a large loss **by construction**, because delivery revenue is a surcharge and delivery
cost is crew plus vehicle and the two were never meant to cover each other. Anyone reading it as a
managed P&L concludes delivery should be cut, which would cut product revenue. ADR-0029 calls this
the single most likely misreading of the whole design.
