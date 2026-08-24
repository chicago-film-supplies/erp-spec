# Reaching m4 — every hotspot is resolved; only the spikes remain

> ## ⚠️ STATUS 2026-08-23 (compacted — the 08-22 and earlier blocks are folded in, not stacked)
>
> ⭐ **ALL 23 HOTSPOTS RESOLVED, and m4 is down to ONE machine-checkable criterion in the whole
> spec**: `spikes_closed_with_adr`. `main` is CI-green — `deno task ci` all 5 steps, `validate` **0
> failures**. Everything committed and pushed.
>
> ⚠️ **The ~25 validate warnings are the CLOCK, not a regression** — `2026-08-08`/`08-09` inbox
> notes crossing the 14-day unpromoted threshold. That is erp-spec#6's backlog surfacing, and it
> grows every day nobody promotes.
>
> **Spikes: 12 total, 4 not closed.** Two closed this week — `SPIKE-008` → `ADR-0045`, `SPIKE-005` →
> `ADR-0043` — and `SPIKE-009` moved `open` → `in_progress` with **all four exit criteria now
> carrying evidence**.
>
> ⭐⭐ **The pattern that has now bitten three times, and it is the one to carry across a clear: a
> finding measured accurately against the CURRENT system, generalised into a claim about the TARGET
> one.** `project` was declared not to exist because it is absent from the v1 schemas — it has been
> an `ADR-0032` level all along. `firestore.rules` was read as proving _"there is no per-document
> authorization decision to reproduce"_ — true for an operator app, and **customers will log in**
> (erp-spec#50). **The v1 code is the wrong oracle for a target-state question, and it is seductive
> precisely because it is executable.**
>
> ⭐ **And its sibling, from 2026-08-23's second half: an ABSENCE READS AS A RESULT.** The
> `SPIKE-009` probe hung with zero output because `watch()` is lazy and the write it waited on had
> already happened; a Solid reactivity test measured **nothing at all** because Deno resolves the
> non-reactive SSR build. Neither was found by reading. **Both were found by asserting a positive
> count and watching it stay at zero.**

- **Date:** 2026-08-23
- **Repo:** erp-spec · **everything is pushed**
- **Open issues:** #3, #4, #6, #12, #17, #32, #35, #36, #37, #40, #42, #43, #44, #45, #46, #48, #49,
  #50, **#51 (new — SPIKE-009's ADR)**

## START HERE

**m0–m3 are met. m4 is the only milestone with an unmet machine-checkable criterion**, and it is now
one thing:

| criterion                                  | 2026-08-21   | now                       |
| ------------------------------------------ | ------------ | ------------------------- |
| every hotspot resolved                     | 4 of 20 open | ✅ **0 of 23 open — MET** |
| every spike closed, naming the ADR it made | 7 of 12 open | **4 of 12 open**          |

### Where each remaining spike actually stands

| spike                                    | state         | what it needs                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **009** Firestore listeners → new        | `in_progress` | ⭐ **all four criteria have evidence — only the ADR remains** (#51). Four decisions to make, not one; they are enumerated in the issue                                                                                                                                                        |
| **004** Plaid → new                      | open          | **unblocked** — `PLAID_CLIENT_ID` / `PLAID_SECRET_SANDBOX` are in dev Secret Manager and imported into dev TF state. ⚠️ prod plan still shows 2 creates, and the `_SANDBOX` suffix fights the house convention — renaming is destroy-and-recreate, so **decide before any real value exists** |
| **011** TigerBeetle on Linode → ADR-0013 | open          | spend authorized and the rescope landed (#41 closed) — but it is provisioning plus a wait, and macOS numbers do not transfer                                                                                                                                                                  |
| **012** booking boundary → ADR-0015      | `in_progress` | ⛔ **blocked on a BUSINESS PROCESS** — manager check-in/out going live (#46). Not yours to unblock                                                                                                                                                                                            |

⇒ **009's ADR is the shortest path to closing m4**, and it is desk work with the evidence already
gathered. 004 is the next self-contained one.

### ✅ What closed 2026-08-22 / 08-23

- **SPIKE-008 → ADR-0045** (08-23), promoted into six `REQ-TAX-*` with 16 scenarios. ⭐ The
  session's real output was a **correction**: an adversarial read falsified three of ADR-0045's four
  decisions and inverted the evidence for the fourth — the two `chicago` overrides it rested on were
  written by a migration script, not typed by an operator.
- **SPIKE-009 criteria 1–4** (08-23) — evidence complete, ADR outstanding (#51).
- **SPIKE-005 → ADR-0043.** Build the depreciation engine; there is nothing to buy (`macrs` returns
  **zero** packages on npm _and_ JSR). Behind a **pure package boundary** the corpus can import,
  computed **per taxpayer-year**, on **effective-dated rule data**. Corpus at 14/14, candidates
  scored, and the annual refresh **executes** — `deno task dep-refresh` plus a scheduled workflow,
  fired red both ways before being believed.
- **OQ-053 → ADR-0044.** CFS is the **principal** on a PSA. Resolved HOT-017, open since 2026-08-17.
- **HOT-018 → ADR-0041**, HOT-019 → ADR-0025, HOT-020 → ADR-0020, HOT-021 → ADR-0029, HOT-022 →
  ADR-0042, HOT-023 → SPIKE-005.

### ⭐ THE RECURRING SHAPE — seven findings across 2026-08-22 and 08-23, ONE shape

**Every substantive finding across both days was an ABSENCE READING AS A RESULT.** None was a wrong
answer; each was a check that could not have failed, reporting success.

| finding           | the green that meant nothing                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| SPIKE-012         | two boundaries "PASSED — no future-dated unit holds a transfer" **on 11 rows corpus-wide**               |
| SPIKE-002         | no violation on a case its `TbState` **could not represent** (no expired state)                          |
| SPIKE-002 again   | no violation on discovery, because **nothing modelled discovery at all**                                 |
| SPIKE-005         | a coverage claim with **no coverage arm behind it**                                                      |
| the refresh probe | 12/12 figures matching **from the wrong edition**, until an edition check was added                      |
| SPIKE-009 (08-23) | a probe hanging with **zero output** — `watch()` is lazy, so the write it waited on had already happened |
| SPIKE-009 (08-23) | a Solid reactivity test measuring **nothing**, because Deno resolves the non-reactive SSR build          |

⇒ **A failing arm is loud. A passing arm that matched almost nothing is indistinguishable from a
working one.** Ask of every green check: **could this have failed? Over what population, over what
state space?** And where the answer is "nothing would have caught it", **land the arm red first** —
seven times across two days that is what turned a comfortable green into a real finding.

⭐ **08-23 sharpened the rule: assert a POSITIVE COUNT.** Both of that day's instances were caught
because the assertion was "this effect ran once" rather than "the other rows did not update" — the
negative form passes against a runtime where **nothing** runs.

⚠️ **AND THE SCOPE VERSION OF THE SAME MISTAKE, corrected twice by the owner in one session.** §280F
was scoped out on a fleet of two ("we do expect to acquire more vehicles"); four more facets were
scoped out on populations of zero ("cover all valid gaap and usa tax cases"). **Measuring the
population is the right test for "is this URGENT" and the WRONG test for "is this IN SCOPE" when the
requirement is completeness.** The repo's footgun about not minting a branch before measuring its
population is about not building machinery for branches nothing takes — **it does not license
omitting a rule that law requires and a future asset will reach.** The two questions look identical
and are answered by different people.

### ⚠️ The one thing that keeps causing the ADR churn

**Four proposed ADRs rested on `ADR-0036`'s supersession of `ADR-0018` and nothing detected it.**
That is **#40**, still open, and it now has four instances as a ready-made red-first population.
**#44** is its narrower sibling: _"ADR-NNNN requires `<field>`"_ where the field never appears in
that ADR's body — which is how ADR-0029 acquired a requirement it never made, in two artifacts at
once.

## Then, in order

|       |                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **SPIKE-009's ADR (#51).** The nearest close, and the only remaining m4 blocker that is pure desk work. Four decisions with evidence behind each: what the client persists on reconnect, how the resume-failure path gets an injectable seam, which collections enable pre/post images, and where the lazy-`watch()` fix lives |
| **2** | **SPIKE-004 against the Plaid sandbox.** Self-contained, credentials in place. Settle the `_SANDBOX` naming before any real value exists                                                                                                                                                                                       |
| **3** | **#6 — requirements.** `ordering`, `availability`, `banking`, `procurement` still have **zero**, and the ~25 validate warnings are this backlog surfacing and growing daily                                                                                                                                                    |
| **4** | **#35 PSA, now much smaller than it reads.** ADR-0044 settled principal-vs-agent and the EOR finding means the cost path is already specified — PSA needs the **revenue side and a product line**, not a payroll path. Feeds #6                                                                                                |
| **5** | **#40 + #44** — the supersession-dependents gate and its citation-assertion sibling. Four ready-made instances to land red against                                                                                                                                                                                             |
| **6** | **#45** — ADR-0041's D4 is a procedure with nothing executing on it, and it is the half that removes the seasonal bias                                                                                                                                                                                                         |

⚠️ **The decision backlog is not blocked on the owner's availability — it is blocked on nobody
having prepared the decisions.** ⭐ **2026-08-22 is the proof, twice over.** HOT-022 took one
sentence to rule and unblocked two exit criteria, an ADR amendment and a new ADR. **OQ-053 had been
open since 2026-08-17 phrased _"is CFS principal or agent"_ — a question that asks the owner to do
the accounting. Re-asked as _who signs, who insures, who eats the loss_, it was answered in one
sitting and closed the last hotspot.**

⇒ **A question addressed to the wrong expertise looks like a question nobody has time for.** Before
concluding a decision is stalled, check whether it is asking its owner for something they actually
hold.

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

## Things to carry across the clear

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

- ⭐ **NEW — AN ABSENCE READS AS A RESULT, and it is the defect class of this whole session.** Five
  times: a boundary passing on 11 rows, a model silent on a case it could not represent, a model
  silent on a question it never asked, a coverage claim with no coverage arm, and 12 figures
  matching from the wrong edition. **Ask of every green check: could this have failed, and over
  what?**
- ⭐ **NEW — MEASURED POPULATION ANSWERS "IS THIS URGENT", NOT "IS THIS IN SCOPE".** Corrected twice
  by the owner in one day. The footgun about not minting a branch before measuring its population is
  about machinery for branches nothing takes; **it does not license omitting a rule the law requires
  and a future asset will reach.**
- ⭐ **NEW — ASK THE OWNER FOR FACTS, NOT FOR CLASSIFICATIONS.** OQ-053 sat open for five days as
  "is CFS principal or agent" and was answered in one sitting as "who signs, who insures, who eats
  the loss". **A question addressed to the wrong expertise looks like a question nobody has time
  for.**
- ⭐ **NEW — A CONTROL TOTAL KEYED TO THE NATURAL DOCUMENT TOTAL SILENTLY FORBIDS EVERY ENTRY THAT
  IS NOT THAT TOTAL**, and `vehicle_cost_absorbed` had already written the reason down two entries
  away in the same file.
- ⭐ **NEW — TYPE THE FIGURE.** Gate 22 is the cheapest leverage in this repo. Typing five figures
  as `measurements:` turned four live files red for quoting them uncited. HOT-018 existed _because_
  one quantity had three internally-consistent values in three files.
- ⚠️ **NEW — AN ADR GOES STALE AGAINST THE MIGRATION SPEC THAT IMPLEMENTS IT.** `ADR-0020` said
  "restate all" while `field-map.yaml` had already encoded derive-from-the-master in three places.
  **The ADR had stopped tracking what the repo already did**, and nothing compares the two.
- ⚠️ **NEW — A SENTENCE THAT ACCURATELY QUOTES A SUPERSEDED CLAIM reads, out of context, as
  asserting it.** That is how ADR-0029 acquired a requirement it never made, in two artifacts (#44).
- ⚠️ **NEW — DELEGATED RESEARCH WILL FABRICATE A FIGURE, so make fabrication mechanically impossible
  rather than discouraged.** The tax-rule refresh proposes a **line number** into a locally
  extracted primary source; **a line number cannot be fabricated.**

## Context recommendation

**CLEAR CONTEXT.** Nothing needed is in anyone's head. Every resolved hotspot's `measured:` field
carries what was found and why; the ADRs carry the reasoning; the eleven open issues each carry a
cold-pickup section; `STATUS.generated.md` reports the milestone state; and `deno task ci`
reproduces the whole CI contract locally.

⚠️ **The two things not written down anywhere else** are in this file: that the 17 validate warnings
are the clock rather than a regression, and that **the reachable work is now SPIKE-002's harness
(#47), then 008 or 009** — the other three spikes are gated on money, credentials or the business
and no amount of authoring moves them.
