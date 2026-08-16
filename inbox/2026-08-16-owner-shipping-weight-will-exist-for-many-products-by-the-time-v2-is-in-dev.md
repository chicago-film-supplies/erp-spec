---
kind: decision-input
title: Owner — shipping.weight will exist for MANY products by the time basis v2 is in dev, which makes partial population the anticipated state rather than a hazard, and core#51 closing means the precondition that handles it can now be written
contexts: [ledger, billing]
source: "owner, 2026-08-16, in session; core#51 CLOSED 2026-08-10; api:2026-08-16:firestore products under ADC — 0 of 567 non-zero, 537 null, 3 zero, 27 absent"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-16, verbatim:

> shipping.weight will exist for many products by the time v2 is in dev

Three things follow, and the second is the one that changes a design decision rather than a date.

## 1. The proxy's expiry is confirmed, and it is now tied to a milestone rather than a calendar year

OQ-033 and `reporting/allocation-bases.yaml` record the owner's 2026-08-09 statement that the specs
"will be populated this year". This sharpens it: the population lands **by the time basis v2 is in
dev**, i.e. alongside the work rather than before it. `ability_to_bear` stays v1's declared
criterion and v1 is never retired — historical periods have no physical data and must keep resolving
the basis that produced them.

## 2. "MANY", not "all" — so partial population is the ANTICIPATED state

OQ-033 already names the hazard: _"Uniform zero fails loudly… **partial population fails silently**:
an unmeasured line absorbs zero cost, the shares still sum exactly to the pool, the control total
passes, and the least-maintained catalogue entries report the best margins."_

It is written there as a risk to guard against. **It is the expected condition.** That promotes the
activation precondition from hardening to **the primary requirement of v2** — v2 is not "allocate by
weight", it is "allocate by weight where the whole order's base is measured, and degrade the whole
order to the unallocated bucket otherwise".

⚠️ **And a consequence neither OQ-033 nor ADR-0031 has recorded: under that precondition the
unallocated bucket becomes a COVERAGE METER, and period-over-period comparability moves with
catalogue maintenance.** Early in the population effort most orders will contain at least one
unmeasured line, so most of the pool degrades to the bucket; as coverage grows the bucket shrinks
and product-line margins move — **for a reason that is not economic.** A reader comparing Q1 to Q2
under v2 would see absorbed cost appear on goods lines because someone weighed inventory, not
because anything about the business changed.

That is not an argument against the precondition — spreading over the measured subset is strictly
worse, and silently. It is an argument for two things v2 has to carry:

- **Report coverage on the face of the report**, next to the unallocated row. The bucket's size is
  uninterpretable without it.
- **Activate v2 at a coverage threshold, not at first non-zero weight.** Otherwise v2's first
  periods are mostly-bucket and its second-year periods are mostly-allocated, and the series means
  different things at each end while every individual run looks internally consistent — which is the
  failure mode `allocation-bases.yaml` already names as "the worst shape of wrong".

## 3. The blocker that made the precondition un-writable is gone, measured today

core#51 asked for the four `shipping` dimensions to be made nullable _before_ the population effort
started, because `0` meant both "weighs nothing" and "nobody has weighed it", and a precondition
that cannot tell them apart either forbids a genuinely weightless line or silently admits an
unmeasured one.

**core#51 closed 2026-08-10.** `weight`, `height`, `width` and `length` are `z.number().nullable()`
(`code:2026-08-16:core@3847366:src/schemas/product.ts`), and prod agrees — measured 2026-08-16
across all **567** products, identically for all four fields:

| state                 | products |
| --------------------- | -------: |
| non-zero number       |    **0** |
| zero (weighs nothing) |        3 |
| **null (unmeasured)** |  **537** |
| block absent          |       27 |

So "unmeasured" is representable in the schema **and distinguished in the data**, and OQ-033's
precondition can be written correctly today.

⚠️ ADR-0031's Consequences still says the precondition is _"Blocked in practice on core#51 —
`shipping.weight` is a bare `z.number()`"_. **That is stale on both halves.** So is
`inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md`'s statement that "531 of
549 products carry the block with `weight` present as a number, and every one of them is exactly 0 —
the field is not missing, it is populated with zero". Today it is `null` on 537. Whether the data
was migrated when core#51 landed or that measurement counted key-presence rather than type is not
established here and does not matter: **the conclusion that mattered is unchanged — 0 products carry
a driver — and the ambiguity is not present in today's data.**

## What this asks of the spec

- OQ-033 gains the coverage-threshold and coverage-reporting requirements above, and loses the
  core#51 blocker.
- ADR-0031's `shipping.weight` bullet is amended to match (it is `proposed`, so amendable).
- `reporting/allocation-bases.yaml`'s `proxy_for` keeps its measurement and states it as null rather
  than zero, because the distinction is now load-bearing for v2 rather than incidental.
- **The driver premise is re-measured on every `deno task allocation` run**, and the probe prints a
  ⚠️⚠️ when the first non-zero value appears. A basis premise that flips without anyone noticing is
  how v1 outlives its own justification.
