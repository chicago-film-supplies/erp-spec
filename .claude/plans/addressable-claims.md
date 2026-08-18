# Stop tripping: make claims addressable

- **Date:** 2026-08-17
- **Repo:** erp-spec
- **Status:** 📋 PROPOSED, nothing built. **ADR-0037 is `proposed`** — acceptance is the owner's
  (rule 3), and this plan is the implementation behind it. ✅ **RED-TEAMED 2026-08-17**: two of its
  three load-bearing claims needed correcting and one hole was found that neither document had seen.
  The findings are folded into ADR-0037, which now asks for **four separable rulings** instead of
  one. See _Red team_.
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

⚠️ **The citation counts above are occurrences, not SWEEPABLE occurrences, and the difference is
large** — re-measured by locus in _Red team_ RT1: 84% of ADR-0036's are in mutable spec against
**44%** of ADR-0019's. A citation inside an `inbox/` note or a frozen ADR means "as it stood then"
and is correct where it is.

### The defects sort into three classes, not one

Thirteen defects in the 2026-08-17 session. They have different causes and different fixes, and
conflating them is how a fix ends up aimed at the wrong one.

⚠️ **THE THIRTEEN ARE NOT ENUMERATED ANYWHERE, and this document is the only place the number
appears.** Found 2026-08-17 by an agent reviewing this plan: `grep -rn thirteen` across the spec
returns it twice, both here, plus the 5/4/4 table — **so the population cannot be audited, the class
assignment cannot be checked, and "would X have prevented them" cannot be answered without
reconstructing them first.** That is exactly the defect this repo turned into gates 10q and 16 the
same week (_when a doc states a count, something must count it_), sitting inside the document that
proposes the fix for the class it belongs to. ⇒ **Anyone reasoning from the 5/4/4 split must
enumerate the thirteen first and say so**; a reconstruction is not the record.

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
⚠️ **RT3 refutes this as stated**: an accepted ADR's body is immutable, so it is never "next
touched", and the 23 in-force ADRs — where the citations point — would never gain it. Back-migration
of front matter is legal and measured at one afternoon (gate 19's sweep did exactly that).

### 2. The gate ADR-0037 makes possible

**An assertion's content may not be restated outside its owner — cite it.** This is the only
structural attack on class A, and it cannot be written until claims have identity. ⚠️ **RT2: it does
not reach the defect that motivates it.** HOT-016's sweep missed `charter.md` because the pattern
was "costed at actual" and the charter said "actual-cost absorption" — a PARAPHRASE, which no
presence test detects. Either the gate is stated as exact-only, or the editorial rule becomes "cite
the claim, never re-say it".

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

✅ **BUILT 2026-08-17 as gate 18, and class C's own lesson was in how it had to be scoped.**
Checking all 143 accounts would have failed on 109 and been ignored; scoped to the 9 the spec MINTS
it named five real defects, and **the 104 it does not check are a measured number in its own note
plus erp-spec#37**. ⇒ the class-C fix is not "declare scope" alone — it is **declare the scope AND
measure the complement**, because a scope statement nobody quantifies reads as coverage.

## ✅ Red team — done 2026-08-17, and it changed three of the claims

The plan asked for three claims to be attacked. **Two survived with corrections and one did not
survive as stated.** All findings are folded into ADR-0037's body (it is `proposed`, so it is
mutable) — this section is the audit trail, not a second copy of the decision.

**RT1 — "22:1 mismatch, 132 citations become ambiguous" — the argument survives, one number does
not.** Re-measured by LOCUS rather than by count (`code:2026-08-17:erp-spec`, every occurrence,
classified by the file it sits in):

| ADR      | occurrences | in MUTABLE spec | elsewhere (append-only, frozen ADR, generated) |
| -------- | ----------: | --------------: | ---------------------------------------------: |
| ADR-0036 |         275 |   **231 (84%)** |                                             44 |
| ADR-0019 |         178 |    **78 (44%)** |                                            100 |

For ADR-0036 the citations really are live and sweepable. **For ADR-0019 fewer than half are** — the
rest are dated evidence and frozen ADRs, where a citation meaning "as it stood then" is correct and
must never be rewritten. ⚠️ **The repo already recorded this exact lesson** ("only live, mutable,
authority-claiming copies count — there were three, not the 17 a grep suggests") and the ADR's own
evidence had not applied it.

**RT2 — "HOT-016 would not have needed to exist" — DOES NOT SURVIVE.** Premise typing removes ONE
instance: ADR-0030's own frozen assertion. HOT-016's actual work was the other **six** — a golden
vector, `glossary.yaml`, `charter.md`, and ADR-0019's own title and summary. ⚠️ **And the step-2
gate would not have caught the sixth either, for a reason HOT-016 itself records**: the sweep missed
the charter because _"the pattern was 'costed at actual' and the charter says 'actual-cost
absorption'"_. **The defect class is PARAPHRASE and the proposed mechanism is exact presence.** ⇒
either the gate is stated as "catches exact restatement only", or the editorial rule becomes the
strong form (cite `ADR-0019/A1`, never re-say it) — which is a convention with a crude gate, exactly
like `headline:`. Not fatal. Selling the strong version unexamined would have been.

**RT3 — "forward-only adoption produces a useful gate" — DOES NOT SURVIVE AS STATED.** "The existing
36 gain it when next touched for another reason" cannot happen to an `accepted` ADR: its body is
immutable, so it is never touched. ⇒ the **23 in-force ADRs would never carry `asserts:`**, and they
hold the citations (ADR-0036 is accepted, 231 live). ✅ **Back-migration is legal and now
measured**: front matter is not hashed, and gate 19's sweep put a new field on all 38 ADRs in one
pass on 2026-08-17. An afternoon, not a project.

**RT4 — a hole neither the plan nor the ADR had seen: "a premise is not frozen" leaks the historical
record.** Gate 14 hashes the body, not the front matter, so a mutable `asserts:` block on an
accepted ADR could be edited to claim it rested on something it never did — and ADR-0034's whole
point is that an accepted ADR records the decision **as taken**. ⇒ a premise's `claim:` text must be
frozen exactly as the body is, with only `status:` and `refuted_by:` appendable, and **a gate can
enforce it** by hashing `asserts[].claim` alongside the body.

**RT5 — class A and class C overlap more than the table admits, and today's session is the
evidence.** Three class-A defects (a stale count restated: `no_posting[] 11`, "24 ledger events",
"138 entries, four minted") were killed by **two small class-C gates** — "when a doc states a count,
something must count it" — with no claim-addressing machinery at all. ⇒ **`asserts:` should be
judged on the residue that cheap gates cannot reach**, not on the whole of class A. That residue is
real (the charter paraphrase is in it) and it is smaller than 5 of 13.

⇒ **Recommendation: split the decision.** ADR-0037 now carries a `What the owner is being asked`
section with four separable rulings — `asserts:` (take it for the premise half), the step-2 gate
(take it stated as exact-only), forward-only versus back-migration (back-migrate), and `headline:`
(cheap, separable, take it regardless).

## Open work this plan does NOT cover, carried so it is not lost

- ✅ **A golden vector asserting the opposite of an accepted ADR — FIXED 2026-08-17.**
  `guaranteed-hours-unworked-land-in-5801.yaml` put all three idle hours in 5801 while ADR-0019 said
  the causing order bears them; it was renamed to
  `guaranteed-hours-absorb-into-the-job-that-caused-the-hire` and its expected transfers re-pointed
  the same day, and the account it named was deleted outright by ADR-0038 a few hours later. ⚠️
  **This entry stayed live in THIS plan for a day after the fix, and a reader took it as current
  state** — an agent reviewing this plan on 2026-08-17 cited it as an outstanding defect. **A stale
  plan reads as current intent**, which is the workspace's own rule for plan docs, demonstrated
  against the plan whose subject is claims going stale.
- ✅ **`labor_variance` — DONE as far as it can go**: parked in **erp-spec#38** with the survey
  named as the work. ⚠️ It could not go in `unwritten:` because all four coverage buckets are keyed
  by EVENT and no event triggers a period-close true-up — recorded in `ledger/posting-rules.yaml`'s
  header, because `unwritten: []` reads as "no known gaps" and is not.
- ✅ **ADR-0030's accounts — DONE 2026-08-17.** `vehicle_cost_absorbed` posts 5900/5901/6409 with
  four golden vectors; 5902 needed no rule (it arrives through the vendor bill) and is declared
  instead. **Gate 18** now fails on any minted account nothing posts to, and it landed red on FIVE —
  `5150` was unreachable too.
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
