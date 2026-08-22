# Reaching m4 — the hotspot half is done; the milestone is now the spikes

> ## ⚠️ STATUS UPDATE 2026-08-22
>
> **The hotspot half of m4 went from 4 unresolved to 1**, and a spike attempt turned up a
> milestone-level blocker: **SPIKE-012 is gated on the manager check process going live (#46)**. The
> hotspot progress, and the last one is an owner decision, not authoring. `HOT-018`, `HOT-019` and
> `HOT-020` are resolved; `HOT-021` was opened and resolved on the same grounds. **m4's remaining
> machine-checkable work is the SPIKES — 7 of 12 still open.** Rewritten rather than prepended:
> every item in the old _Then, in order_ list above item 4 is done, and a plan that reads as a to-do
> list of finished work is worse than none.

- **Date:** 2026-08-22 (rewrites the 2026-08-21 revision, which replaced `open-issue-queue.md`)
- **Repo:** erp-spec
- **Status:** `main` is CI-green — `deno task ci` all 5 steps. **`deno task validate` is 0 failures
  / 17 warnings.** ⚠️ **The warnings are the CLOCK, not a regression** — all 17 are `2026-08-08`
  inbox notes crossing the 14-day unpromoted threshold on 2026-08-22. That is `validate.ts` reading
  the real date working exactly as designed, and it is erp-spec#6's backlog. **Do not read the 0→17
  jump as something this session broke.**
- **Unpushed:** 3 commits on `main` — `29c7850` (owner's, plan retirement), plus `a3b9b59` and
  `49487b1` from this session. **Ask before pushing; one is not Claude's.**
- **Related:** open — #3, #4, #6, #12, #17, #32, #35, #36, #37, #40, #41, **#42, #43, #44, #45, #46
  (new this run)** · closed this run: **#38** · **HOT-017 is the only open hotspot**

## START HERE

**m0–m3 are met. m4 is the only milestone with unmet machine-checkable criteria**, and after this
session it needs essentially one thing:

| criterion                                  | measured 2026-08-21    | measured 2026-08-22    |
| ------------------------------------------ | ---------------------- | ---------------------- |
| every hotspot resolved                     | 4 of 20 open           | ⭐ **1 of 21 open**    |
| every spike closed, naming the ADR it made | **7 of 12 still open** | **7 of 12 still open** |

⇒ **The milestone is now the spikes.** The one remaining hotspot, `HOT-017`, is blocked on `OQ-053`
(is CFS principal or agent on a PSA) — **an owner decision that no amount of authoring unblocks**,
and it gates a whole service line (#35).

### What landed 2026-08-21 → 22

**Three proposed ADRs were redrafted off premises now known false, and a fourth ADR was written.**

- **`ADR-0020` (HOT-020)** — redrafted as a **recast**, not a restatement. Both halves of the old
  decision were void. The new Decision is **neither of its two options**: derive the product line
  from the product master, declare a null where there is nothing to derive from. ✅ **The
  load-bearing premise is DISCHARGED** — owner, 2026-08-22: **a tracking category was on no
  externally filed document.** Typed as `ADR-0020/P1` so a future falsification has an anchor.
- **`ADR-0025` (HOT-019)** — narrowed to its one surviving clause and retitled: **a non-operating
  receipt moves ACCOUNT, not bucket.** Three of four decision clauses were dead or already-enacted.
- **`ADR-0029` (HOT-021)** — the decision stands, the argument changes. Gains the **Considered
  options** section it never had, carrying the family every reference implements.
- **`ADR-0041`** (new) — the labor variance posts as a keyed fact. Account, both posting arms, three
  vectors. **Closes #38 and resolves HOT-018.**

### ⛔ NEW 2026-08-22 — BOTH attempted spikes turned out to be blocked, and both for good reasons

**Two spikes were attempted this session. Neither closed, and each produced a finding worth more
than the close would have been.** ⚠️ **The hotspot count went 1 → 2**, because SPIKE-002 turned up a
real contradiction (HOT-022). That is progress, not regression: it was true before and nothing could
see it.

⭐ **SPIKE-002 — the Quint model could not express TigerBeetle's own timeout.** `two_store_commit`'s
`TbState` has no expired state, but TigerBeetle expires a pending transfer itself once
`Transfer.timeout` elapses (`pending_transfer_expired = 35`, pinned in the client's own
`bindings.d.ts`). The new `expiring_timeout` module fails in **three steps with `dead: false`
throughout — no crash required**, just a writer slower than the timeout. **`ADR-0015:61` proposes to
rely on exactly the mechanism `naive_sweeper` proves unsafe.** Criterion 1 re-verified, criterion 3
framed with a recommendation, criterion 2 needs a `mongod` and a ruling (#47).

⭐ **The two findings share ONE shape, and it is the session's lesson.** SPIKE-012 reported PASSES
on 11 rows; SPIKE-002 reported no violation on a case its own type system could not represent.
**Neither was a wrong answer — both were absences reading as results.** A failing arm is loud. **Ask
of every green check: could this have failed? What population, what state space?**

### ⛔ m4 also has a criterion gated on a BUSINESS PROCESS, not on authoring

**SPIKE-012 cannot be closed until the manager check-in/check-out process is live** (owner,
2026-08-22). It was attempted this session and is now `in_progress` with a measured partial result.
**It is the only one of the seven gated that way** — the other six are gated on research,
infrastructure or an owner decision, all of which are ours to move. Re-run condition: **#46**.

⚠️ **THE LESSON FROM ATTEMPTING IT, and it is the sharpest of the session.** The probe reported
_"PASSES — no future-dated unit holds a transfer"_ for two of four candidate boundaries. **Those
passes rest on 11 rows in the entire corpus**, because `prepped` is barely written while the
lifecycle is dormant. ⭐ **A failing arm is loud; a passing arm that matched almost nothing is
indistinguishable from a working one.** The repo's "an unexercised branch is a claim, not a
capability" usually bites on the branch nobody took — here it bit on the branch that **passed**, and
a boundary would have been chosen on 11 rows while reading as a clean result.

✅ **What the attempt DID establish, and it is not small:** `bookings.breakdown` is an exact
partition of `quantity` on **6,967 / 6,967 rows**, so v1 already holds a position a ledger can be
built from; and **B1 "at confirmation" is REFUTED on genuinely exercised data** — 392 future-dated
units, 43-day max lead. ADR-0015 predicted that failure in prose and now has the number.

### ⚠️ The one thing that keeps causing this

**All four trace to `ADR-0036`'s supersession of `ADR-0018` moving the ground under three proposed
ADRs, with nothing detecting it.** That is **#40**, still open — and it now has **four** ready-made
instances to land a gate red against instead of last session's three. **#44** is its sibling: a
narrower arm for _"ADR-NNNN requires `<field>`"_ where the field is absent from that ADR's body.

## Then, in order

|       |                                                                                                                                                                                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **HOT-022 — rule the timeout question.** Owner's, small, and it unblocks SPIKE-002 criterion 2 (#47) AND ADR-0015. Recommendation and the three options are in `spikes/SPIKE-002-two-store-commit.md`                                                                                                                   |
| **2** | **A spike.** ⛔ **NOT SPIKE-012** — `in_progress`, blocked on a business process (#46). ⛔ **SPIKE-002 is `in_progress` too** — criteria 1 and 3 done, criterion 2 needs a local `mongod` and a HOT-022 ruling (#47). ⇒ **`SPIKE-005` and `SPIKE-008` are the reachable ones**; `SPIKE-011` needs rescoping first (#41) |
| **3** | **`OQ-053` — put the PSA question to the owner.** It is the only thing between m4 and a clean hotspot criterion, and it blocks a whole service line. **Prepare the decision; do not wait for it.**                                                                                                                      |
| **4** | **#40 + #44** — the supersession-dependents gate and its citation-assertion sibling. Small, and four instances are sitting there as a red-first population                                                                                                                                                              |
| **5** | **#6** — requirements. `ordering`, `availability`, `banking`, `procurement` still have **zero**, and the public client app depends on the first two. The 17 new warnings are this issue's backlog surfacing                                                                                                             |
| **6** | **#45** — ADR-0041's D4 is a procedure with nothing executing on it, and it is the half that actually removes the seasonal bias                                                                                                                                                                                         |

⚠️ **The decision backlog is not blocked on the owner's availability — it is blocked on nobody
having prepared the decisions.** Every survey changed the ADR it was written for; **every redraft
this session found something the survey had not.** One prepared decision per session is probably
worth more than the authoring it displaces.

## Two capabilities every remaining unit should use

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. **This retires "a full sweep needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is not a list of the collections.** It carries 35; there are **50**,
  and it omits `credit-notes` and `settlements` — the second being 1,073 documents of cash
  application. Anything scoped from it is scoped short.
- ⚠️ **`--development` caps TigerBeetle's `createTransfers` at 253, not the documented 8189**
  (measured 2026-08-18). **Every TB measurement in this repo before that date was taken on
  `--development`.** `spikes/harness/_README.md` carries the caveat; SPIKE-011 owns the production
  numbers.

## Decisions worth not re-litigating

_All six carried forward; the last two are new._

- **#18 fixed with a new field, not a status-aware gate 6.** Rejected: gating only the acceptance
  transition, which would have left ADR-0036's promise as a comment with nothing behind it.
- **Gate 10n was deliberately NOT widened to check applicability** — every value in the refuted
  scenarios was legally declared. Both halves landed later as gate 10p, against the posting RULE.
- **`ledger/dimensions.yaml` did NOT move to `reporting/`**, which #19 proposed: four IMMUTABLE ADRs
  cite the path and gate 11 checks citations resolve, so a move buys four PERMANENT exemptions.
  **Refused on measured cost.**
- **Gate 18 is scoped to minted accounts, not all 143** (#37). A green gate 18 means "every account
  this spec minted has a home", never "every account has one".
- **The vehicle absorption rate is NOT registered in `reporting/allocation-bases.yaml`.** ADR-0030
  cites that file's **discipline**, not its registry.
- **The `closes_adr` exclusion proposed in #39 was wrong and is not implemented.** `SPIKE-012`
  declares `closes_adr: ADR-0015`, so the exclusion would have deleted ADR-0015's only real blocker.
  **Status alone is correct.** `tools/blockers_test.ts` asserts that exact row.
- ⚠️ **NEW — `ADR-0025` was NOT withdrawn**, which its own `resolution_shape` offered as a route.
  **Five IMMUTABLE ADRs cite it** (0029, 0031, 0034, 0035, 0038) and can never be updated, so
  withdrawal buys five permanent citations pointing at a rejected decision. **Same shape as the
  refused `dimensions.yaml` move, and refused for the same measured reason.**
- ⚠️ **NEW — `ADR-0041` did NOT answer `OQ-045`**, though they are one seam from two sides. It takes
  the **arithmetic** half (a fully-billed run, a rate estimate error) and leaves the **judgement**
  half (a vendor who may or may not bill again). **Narrowing explicitly, with a minimal-pair vector
  as the fence, beat answering both** — one is arithmetic and the other is a judgement about a
  vendor relationship.

## Sixteen things to carry across the clear

_The first thirteen are carried forward; this run earned three more, and they are the sharpest._

- **Firing a gate red is not ceremony — it is the only thing that finds the defects.**
- ⚠️ **An INCLUSIVE declaration fails closed; an EXCLUSION list fails open.**
- ⚠️ **Scope a gate to what the spec is RESPONSIBLE for, then measure what it does not cover.** **A
  noisy reporter is one nobody reads twice, which is the same outcome as no reporter.**
- ⚠️ **A value one letter from a legal one, in a file no gate reads, is the cheapest way to be
  wrong.** **Ask which file the value you just typed is checked AGAINST.**
- ⚠️ **Two messages for one defect is how a gate teaches the wrong lesson at 2am.**
- **When a doc states a count, something must count it.**
- ⚠️ **A rule that exists and is not applied blocks work silently.**
- ⚠️ **A self-declared flag needs something that can falsify it, and the falsifier should demand a
  REASON rather than a verdict.**
- ⚠️ **A correct conclusion reached by wrong reasoning is not a checked conclusion.**
- **The `db_schema` enum is not the collection list** — 35 against 50.
- ⚠️ **When you remove a wrong signal, ask what the absence will now be read as.**
- ⚠️ **A hand-written invariant is easy to get wrong in BOTH directions, and neither error is
  visible from the expression.** Only a conforming/violating pair tells them apart.
- ⚠️ **A delegated research pass will fabricate a quotable source, and it is not rare.** **Every one
  was caught by demanding a verbatim quote with a URL.**
- ⭐ **NEW — TYPE THE FIGURE. Gate 22 is the cheapest leverage in this repo and it is barely used.**
  Typing five figures as `ADR-0020` `measurements:` **immediately turned four live files red** for
  quoting them with no owner. HOT-018 exists _because_ one quantity had **three different values in
  three live files — 13.85/6.00, ~4.51, 12.20 — and every one was internally consistent
  arithmetic.** A figure with an owner cannot do that. ⚠️ Gate 22 matches **EXACT strings only**, so
  it cannot see a paraphrase — and `$688.00` is still loose across **seven** files (#43).
- ⭐ **NEW — A CONTROL TOTAL KEYED TO THE NATURAL DOCUMENT TOTAL SILENTLY FORBIDS EVERY ENTRY THAT
  IS NOT THE DOCUMENT TOTAL.** `control_total: bill.amount_minor` made CFS's own measured direction
  **unrepresentable** — where the EOR bills below the accrual, the entry posts the _accrued_ amount
  and the arithmetic cannot close. ⚠️ **`vehicle_cost_absorbed` had already hit this and written the
  reason down in its own invariant** — _"Using `pool_minor` … would have made the over-absorbed case
  unrepresentable"_ — **and nothing connected the two rules.** The same defect, the same fix, two
  entries apart in one file.
- ⭐ **NEW — AN ADR GOES STALE AGAINST THE MIGRATION SPEC THAT IMPLEMENTS IT, AND NOTHING COMPARES
  THEM.** `ADR-0020` said "restate all" while `migration/field-map.yaml` had **already** encoded
  derive-from-the-master in three places, including the sentence _"the authority the invoice line's
  tracking denorm is dropped in favour of"_. **The ADR was not proposing something the repo had
  declined to do — it had stopped tracking what the repo already did.** ⚠️ **And the companion:** a
  sentence that _accurately quotes a superseded claim_ is indistinguishable, out of context, from
  one asserting it — which is how `ADR-0029` acquired a requirement it never made, in two artifacts
  at once (#44).

## Context recommendation

**CLEAR CONTEXT.** Nothing needed is in anyone's head. Each resolved hotspot's `measured:` field
carries what was found and why; `ADR-0041`'s Consequences carry the design reasoning; the four new
issues (#42–#45) each carry a cold-pickup section; `STATUS.generated.md` reports the milestone
state; and `deno task ci` reproduces the whole CI contract locally.

⚠️ **The two things not written down anywhere else** are in this file and nowhere else: that the 17
validate warnings are the clock rather than a regression, and that **three of the three unpushed
commits include one that is the owner's** — ask before pushing.
