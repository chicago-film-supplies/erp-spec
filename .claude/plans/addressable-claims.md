# Stop tripping: make claims addressable

- **Date:** 2026-08-17
- **Repo:** erp-spec
- **Status:** 📋 PROPOSED, nothing built. **ADR-0037 is `proposed`** — acceptance is the owner's
  (rule 3), and this plan is the implementation behind it.
- **Origin:** owner asked whether a broader architecture change would stop the recurring defects,
  and explicitly put a hard fork and a greenfield on the table
- **Related:** ADR-0037 · ADR-0034 (an accepted ADR is a historical record) · HOT-011, HOT-015,
  HOT-016 (the same defect class, three times) · OQ-050

## START HERE

**The answer to "should we fork or greenfield" is NO**, and it is a measured no rather than a
conservative one. See _Why not a rewrite_. What is worth doing is narrower and additive.

### The diagnosis, measured 2026-08-17

|                                    |           |
| ---------------------------------- | --------: |
| ADR-0036 citations                 |   **249** |
| ADR-0019 citations                 |   **132** |
| ADR-0019 length                    | 212 lines |
| distinct load-bearing claims in it |   **~22** |

⇒ **A 22:1 mismatch between what is CITED (a document) and what is CLAIMED (a statement).** Refute
one claim and all 132 citations become ambiguous, with nothing able to say which depended on it.

### The defects sort into three classes, not one

Thirteen defects in the 2026-08-17 session. They have different causes and different fixes, and
conflating them is how a fix ends up aimed at the wrong one.

| class                                                           | count | cause                                                        | fix                               |
| --------------------------------------------------------------- | ----: | ------------------------------------------------------------ | --------------------------------- |
| **A** — a claim restated in N places, only some updated         |     5 | citations are document-grained                               | **ADR-0037** — addressable claims |
| **B** — reasoned from a figure without checking what it denotes |     4 | measured / inherited / guessed is unmarked at point of use   | measured-value pinning            |
| **C** — a check that does not ask what you think it asks        |     4 | gates are written against artifact SHAPE, not against claims | gates declare their scope         |

## Why not a rewrite

Three reasons, in order of weight:

1. **The defects are representational, not accumulated.** None of the thirteen came from cruft,
   legacy shape or a wrong early decision. A greenfield spec reproduces all three classes on day one
   — and would be written fast, in prose, by the same author, which is precisely the condition that
   generated them.
2. **The machinery works and is the expensive part.** Gates 11 and 14–17 plus `deno task ci` caught
   **four** of the thirteen within minutes of existing, including one defect inside the hotspot
   documenting that defect class. A rewrite discards a working immune system to fix a layer above
   it.
3. **The good part of this repo is the prose.** ADRs here carry reasoning, retractions and evidence,
   which is why a cold session can pick them up. Any change that trades that for structure is a net
   loss. ⇒ **structure the CLAIMS, keep the narrative.**

## The work, in order

### 1. ADR-0037 — `asserts:` on ADRs (PROPOSED, not built)

Front matter gains a block naming each load-bearing claim with `id`, `kind` (`decision` | `premise`)
and a one-line `claim`. Addressed as `ADR-0019/A1`. The body is untouched.

⚠️ **The `premise` type is the half that pays for itself immediately.** ADR-0030 was frozen with a
supporting premise that measured false a day later; a premise is not frozen, so it could have been
marked refuted **without touching the decision and without HOT-016 existing at all.**

**Adopted forward-only.** New and amended ADRs carry it; the existing 36 gain it when next touched.

### 2. The gate ADR-0037 makes possible

**An assertion's content may not be restated outside its owner — cite it.** This is the only
structural attack on class A, and it cannot be written until claims have identity.

⚠️ **Two things it must get right or it will be worse than nothing:**

- **Every `asserts[].claim` must appear in substance in the body.** A presence test, not a
  similarity score. State it as the weak check it is rather than selling it as strong.
- **Its silence must mean "not adopted here", not "nothing wrong here"** — because adoption is
  gradual and it will be silent on 36 ADRs for a long time. **This is exactly how `m3` is misread
  today**, so the output has to say which ADRs it actually examined.

### 3. Measured-value pinning, beyond requirements (class B)

The `api:DATE:query` / `code:DATE:sha` convention exists and applies only to requirements. Extend it
to any figure in a load-bearing file, with a gate flagging bare numbers.

Would have caught: `5902` minted for an unmeasured population; the `$21,844.77` that sat unsourced
for a week; the 23% used before anyone checked what it was a figure OF.

⚠️ Would NOT have caught "Wrapbook is the EOR" — that was an inference from absence, and no pinning
convention catches a wrong inference. **Say so rather than overselling the fix.**

### 4. Gates declare what they do NOT check (class C)

`m3 Ledger core` reads **4 met / 0 unmet** while four accounts accepted the same day have **zero**
posting rules and zero vectors — because its checks ask "is every EVENT covered" and "does every
RULE have vectors", and nothing asks **"is every ACCOUNT reachable"**.

⇒ Each gate declares its scope; a report counts the claim surface no gate covers.

**The immediate instance is worth doing on its own**: an account-reachability check. `coa_complete`
verifies accounts EXIST; nothing verifies anything posts to them.

## Open work this plan does NOT cover, carried so it is not lost

- ⚠️ **A golden vector asserts the opposite of an accepted ADR, executably.**
  `ledger/vectors/shift_recorded/guaranteed-hours-unworked-land-in-5801.yaml` puts all three idle
  hours in 5801; ADR-0019 (accepted 2026-08-17) says normal idle time on a day that served a job
  belongs to that job. Its name, its `given` and its expected transfers all encode the refuted rule
  — **the derivation prose was amended and the assertion was not.**
- **`labor_variance` has no posting rule** though ADR-0019 now says it fires, and `unwritten: []` is
  empty so it is not even parked as known-missing.
- **ADR-0030's four accounts (5900/5901/5902/6409) have no posting rules and no vectors.**
- **The charter's payroll non-goal contradicts PSA being in scope** (owner ruling, 2026-08-17):
  _"CFS … does not … move payroll money"_, and on a production service agreement it does. Rule 5
  makes that a `HOT-`; erp-spec#35 names the charter amendment and has not done it.
- ⚠️ **`resolved_by` on a hotspot has no legal value for a resolution settled by MEASUREMENT.** Its
  implicit contract is "the DECISION that settled it"; the real contract is "the AUTHORITY", which
  may be an ADR, an answered OQ, or a measurement with no home. HOT-016 used `OQ-050` as the closest
  expressible thing. One instance is not a pattern — recorded, not widened.

## Context recommendation

**CLEAR CONTEXT before building any of this.** The diagnosis is on disk — this plan, ADR-0037, and
HOT-016 — and nothing needed is in anyone's head. The work itself is tool-writing against
`tools/validate.ts`, which touches entirely different material from the accounting decisions that
produced the diagnosis.

⚠️ **Do not start building before ADR-0037 is accepted or rejected.** It changes how every future
decision is recorded, so building first would be the thing this repo most reliably regrets: an
instrument shaping the decisions it was supposed to serve.

⚠️ **And red-team it first.** `refine-plan` exists for exactly this. The load-bearing claims worth
attacking: that the three classes are really distinct; that `premise` typing would have prevented
HOT-016 rather than merely relabelling it; and that forward-only adoption produces a useful gate
rather than one silent on everything that matters.
