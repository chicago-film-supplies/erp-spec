---
kind: correction
title: >-
  The tax model was rebuilt 2026-08-17 → 2026-08-22 and most of OQ-056 was already decided in
  api-cloudrun — three of my four draft items are settled or wrong, and two issues I filed there
  were filed on wrong readings
contexts: [tax, billing]
source: >-
  Two delegated research passes over `api-cloudrun`, `core`, `manager` and `templates`, 2026-08-22,
  with the load-bearing claims re-verified directly:
  `code:2026-08-22:core@7bcc2db:src/utils/taxes.ts` lines 988, 994, and `deriveOrderTaxAsOf`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Raised by the owner: _"have agents review the tax campaign record in api cloudrun, a lot of these
questions have been resolved over the last few days."_ **They had.**

## ⚠️ The setting: the tax model was rebuilt in the five days before I started specifying it

`tax_profile` — the document-wide enum — is **deleted**. The rule is now
**`(item type ×
jurisdiction)` resolved per LINE through its own destination**, implemented once in
`core/src/utils/taxes.ts` and shared by the API and the manager. Trigger: Illinois raised the NITA
rate 0.25% effective 2026-08-01 and CFS billed the old rate until 2026-08-19.

⇒ **I was scoring a corpus that partly predates the code that produces it**, and inferring behaviour
from stored state. That is the root of everything below.

## What OQ-056 asked, against what already exists

| draft item                                                      | verdict                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** the default is the warehouse, stated rather than implied | ✅ **ALREADY IMPLEMENTED.** `resolveJurisdiction` is `destination ?? organization claim ?? deriveJurisdiction(address, origin)`. The default is **derived**, never a hardcoded `chicago`, and `requireOriginJurisdiction()` **throws** rather than guessing when a store carries no jurisdiction                                                                                                                             |
| **D2** an override carries a REASON                             | ⭐ **GENUINELY OPEN, and deliberately deferred.** Zero grep hits across `core`, `api-cloudrun`, `manager`. `tax-jurisdiction-campaign-RECORD.md:203` lists _"exemption reasons"_ under what was not built. **This is the one item that survives**                                                                                                                                                                            |
| **D3** override targets are Frankfort and Rantoul only          | ❌ **WRONG.** Three narrower sets already exist for three different reasons — **derivable** (chicago/rantoul/frankfort; Paxton must not be derived but stays in the type because two prod documents embed its tax uid), **assertable in the UI** (+`no_nexus`, the legal answer for "no collection obligation"), and **levyable by a Tax doc**. The owner's "only Frankfort and Rantoul" is the PRACTICE, not the constraint |
| **T1** precedence needs vectors                                 | 🟡 **half right.** The precedence is implemented and the rungs are documented; what I measured — that no invoice exercises it — is a fact about the DATA, not about the code                                                                                                                                                                                                                                                 |

⭐ **And the `announced_at` field I said was missing already exists: it is `Tax.effective_from`.**
The schema says it **prices nothing** and exists _"so a late-discovered statutory change is a
recorded fact rather than a lost one, and so the `[effective_from, applied_from)` lag is
auditable."_ Added for this exact miss. **The two dates I "discovered" are a deliberate design.**

## ⚠️ Two issues I filed on api-cloudrun were filed on wrong readings

**api-cloudrun#620 — CLOSED as invalid.** Every claim in it was by-design or already settled:

- **Invoice 2392 is not a defect.** `core/src/utils/taxes.ts:994` —
  `if (key === "replacement")
  return { jurisdiction: ctx.origin, level: "origin" }` — landed
  **2026-08-20**, before the 2026-08-21 invoice. A `replacement` skips levels 1 and 2 by the owner's
  own ruling that CFS is the end user, origin is Fillmore, so **Chicago 10.5% is exactly what the
  rule prescribes.**
- **`taxed_as` is the PRIMARY tax key** — `const key = item.taxed_as ?? item.type` — written by
  three services and carried forward by `carryForwardTaxedAs`. My "a declared capability never
  exercised" was wrong; the low population is real and the implication was not.
- **"Absent on 96.4% of destinations" is the designed normal case.** `null` means _assert nothing,
  ask the next level_; `no_nexus` is the value meaning CFS collects nothing. There is no unstated
  default — `deriveJurisdiction` is it.

**api-cloudrun#622 — corrected and retitled.** The ladder I asked for **already exists**:
`deriveOrderTaxAsOf` returns the earliest destination `delivery_start`, earliest by INSTANT rather
than by string sort, plus a freeze for orders past `reserved`. ⚠️ **And my "2 of 2 testable live
cases fail" leaned on orders created 2026-02-02 and 2026-02-06 — both predate the ladder.** There is
no evidence of a live defect. What remains is narrower and real: **3,003 lines / $568,057.61 of
stored state predating the ladder, and a decision about whether to recompute or record them as
non-authoritative.**

## ⭐ The lesson, and it is a new one for this repo

**A MEASUREMENT OF STATE IS NOT A MEASUREMENT OF BEHAVIOUR WHEN THE CODE CHANGED LAST WEEK.**

Every probe in this session was read-only against prod and every figure it produced was accurate.
**The figures were right and the inferences were wrong**, because a corpus records what the code did
_over its whole history_, not what it does now. ⚠️ **The repo's existing rules do not cover this
case** — "verify structural assumptions against the live API" was followed, and it was the wrong
instrument. **Read the writer before inferring intent from what it wrote**, and check when it last
changed.

⚠️ **And there is a governance gap this exposes**: erp-spec cites api-cloudrun freely, but nothing
tells a spec author that a subsystem was rebuilt four days ago. The rebuild is recorded in
`api-cloudrun/CLAUDE.md` §"Tax", in `~/.claude/plans/chicago-sales-tax-increased-tidy-avalanche.md`
and across a dozen issues — **all of which I could have read first and did not.**

## Other things now settled that this repo should not re-derive

- **#598 (22 untaxed taxable lines) — CLOSED, decision NO REPAIR.** 16 of 22 are the rule working
  (13 `service` — no Tax document lists `service` in `item_types`). 🔴 The "partial invoice"
  argument **reverses**: on two invoices the TAXED siblings are the anomaly.
- **#600 (rate-change detection) — CLOSED**, `check-il-tax-rates` live daily. 🔴 **It covers 29.9%
  of tax CFS has ever collected.** Chicago Rental Tax is **70.1%** and unreachable — a City lease
  transaction tax in no machine-readable form — **and it is the faster-moving one**, 9→11→15%.
- **#613 subsumed by #618**; the stored `active` flag is deleted, liveness derived from the window.
- ⚠️ **#618 is MID-FLIGHT and reversed within the last day**: _a lapsed cell THROWS_ became _price
  forward and WARN_ (core `29e79b2`, "the refusal was an outage"). **`api-cloudrun` has it
  uncommitted**, its `CLAUDE.md` still states the throw, and `manager` is pinned a version behind
  asserting the refusal. **Three artifacts disagree about current doctrine — do not cite any of them
  as settled.**
