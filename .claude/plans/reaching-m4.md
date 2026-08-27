# Reaching m4 — the spikes are externally blocked; the ACCEPTANCE QUEUE is the deadline

**Date:** 2026-08-24 • **Repo:** erp-spec • **Status:** ⏳ in progress — **the decision batch is
PREPARED and the ball is with the owner** **Origin:** m4 is the only milestone with an unmet
machine-checkable criterion **Related:** `roadmap/milestones.yaml` m4 · `STATUS.generated.md` ·
issues **#56 (the batch — the brief is a comment on it)**, #57, #6, #35, #40, #42, #43, #44, #45,
#52, #53, #54, #55 · `tools/validate.ts` gate 6

## START HERE

⭐⭐ **THE THING THIS DOC EXISTED TO SAY, AND SAID WRONG UNTIL 2026-08-24.** Every earlier revision
led with _"only the spikes remain"_ and stated that m4 was down to one machine-checkable criterion.
**Both were false.** m4 has three exit criteria and the binding one is the second:

| m4 exit criterion                                  | state                                                           |
| -------------------------------------------------- | --------------------------------------------------------------- |
| every SPIKE closed, naming the ADR it produced     | **2 open — both blocked on the world, not on work** (see below) |
| **no ADR remains `proposed` past its `review_by`** | ⛔ **19 proposed. The first four go red on 2026-10-02.**        |
| every HOT resolved                                 | ✅ 0 open of 24                                                 |

⚠️ **This is not a dashboard warning. `tools/validate.ts` gate 6 reads the REAL clock and FAILS**,
and `.github/workflows/spec.yml` runs `deno task ci`. ⇒ **on 2026-10-02 every push to this repo goes
red** and stays red until those ADRs are accepted, superseded, or their `review_by` is moved.

**Measured** with `SPEC_TODAY=<date> deno task validate` — the env var exists for exactly this:

| date           | proposed ADRs failing gate 6                           |
| -------------- | ------------------------------------------------------ |
| today          | 0                                                      |
| **2026-10-02** | **4** — `ADR-0025`, `ADR-0027`, `ADR-0028`, `ADR-0029` |
| 2026-10-16     | 5 — the above plus `ADR-0020`                          |
| 2026-11-02     | 9                                                      |
| 2026-11-16     | 16                                                     |
| 2026-12-01     | **19 — all of them**                                   |

⇒ **Re-derive this table rather than trusting it.** One command, and it is the only part of this doc
about the future.

## ✅ RULED 2026-08-26 — four accepted, and the October cliff is now ONE ADR and ONE PURCHASE

Owner: _"accept 25, 27, 29, 20"_ (`691b578`). `ADR-0028` stays `proposed` on purpose.

| date       | proposed ADRs failing gate 6 | was |
| ---------- | ---------------------------- | --- |
| 2026-10-02 | **1** — `ADR-0028` alone     | 4   |
| 2026-11-02 | **5**                        | 9   |

⇒ **The whole October deadline is now: buy the Linode host in time for `SPIKE-011` to land, or move
`ADR-0028`'s `review_by` deliberately with the reason in the same commit.** Nothing else on
criterion 2 is authoring work before November.

<details><summary>How the batch was prepared (kept for the pattern, not the queue)</summary>

**The brief is a comment on #56**: one section per ADR — what it decides, what changed since it was
drafted, what accepting costs, what stays open, and a recommendation. Four of the five need a
yes/no. **The fifth needs a purchase.**

⚠️ **Three of the five would have frozen something WRONG, and all three are fixed** (`e1cd282`) — a
body freezes at acceptance and none of it could have been written afterwards:

| ADR        | what would have frozen                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ADR-0027` | _"cost and quota are unmeasured"_ — **both halves were measured 2026-08-18 and neither is a constraint.** Now typed as `M1`/`M2`, with the two surviving limits attached       |
| `ADR-0028` | nothing — **`STATUS.generated.md` showed it blocked on nothing, which reads as ready to sign.** `SPIKE-011` is now in `relates_to`, so the open spike shows as an open blocker |
| `ADR-0029` | _"the allocation basis is a decision that has not been made"_ — **contradicted twice by the same document.** `ADR-0031` makes exactly that choice                              |

⇒ **What is left on this criterion is not authoring.** It is the ruling, and `ADR-0028`'s host.

### The batch's own leftovers, for whoever picks this up next

- ⭐ **`ADR-0029`'s figures are still untyped — and they did NOT foreclose at acceptance.** ⚠️ **The
  brief claimed they did, and that was wrong.** Gate 21 `continue`s past the freeze when an ADR
  carries neither block, so an accepted `ADR-0029` can still gain `measurements:` with a
  `frozen_asserts_sha256` written in the same commit. The `ADR-0019`/`ADR-0030` precedent is about
  blocks that were **already frozen** — the opposite case. ⇒ **the deadline was imaginary, and an
  imaginary deadline pushes toward a hasty yes.** ⚠️ **`ADR-0020`, `ADR-0025` and `ADR-0027` ARE
  frozen this way**: their blocks existed at acceptance, so nothing may be added. **The distinction
  is whether a block was there, not the status.** Its activity-line figures (`$144,975.00`,
  `$39,665.00`, `8.45%`, `2.31%`, `22.2%`, `1.98%`) are **owned by nobody** and already quoted
  across **four mutable files**, so typing them binds those files through gate 22. ⚠️ **Do NOT type
  `13.79%` or `$236,487.75` — `ADR-0030/M2` owns both**, and gate 22 now fails on a second claimant.
- **`ADR-0020` needs one thing re-affirmed, not re-argued**: P1, the owner's own 2026-08-22 ruling
  that a tracking category was on no externally filed document. The whole `$231,796.26` consequence
  is contingent on it, and falsifying it makes an ASC 205-10-50-1 disclosure owed.

</details>

---

**Nothing was missing from those five but a decision.** `gate 19: 0 proposed and unsurveyed` — every
accounting-shaped ADR already carries its six-reference survey. They are not blocked on research, on
a spike, or on another ADR.

⚠️ **And this repo has already proved twice that the decision backlog is NOT blocked on the owner's
availability — it is blocked on nobody having PREPARED the decisions.** `HOT-022` took one sentence
to rule and unblocked two exit criteria, an ADR amendment and a new ADR. **`OQ-053` sat open five
days phrased _"is CFS principal or agent"_ — a question asking the owner to do the accounting.
Re-asked as _who signs, who insures, who eats the loss_, it was answered in one sitting and closed
the last hotspot.** ⇒ **A question addressed to the wrong expertise looks like a question nobody has
time for.**

**The deliverable is a decision brief the owner can rule on in one sitting**, one section per ADR:
what it decides, **what has changed since it was drafted**, what accepting costs, what stays open,
and a recommendation. ⚠️ **Rule 3 — accepting is NEVER Claude's.** Draft only.

| ADR        | review_by  | decides                                           | note                                                                    |
| ---------- | ---------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `ADR-0025` | 2026-10-01 | uncategorised receipts move to 4800 Other Income  | accounting-shaped, surveyed. **Not withdrawable** — see Decisions below |
| `ADR-0027` | 2026-10-01 | retain Mapbox + Resend at the boundary            | states cost and rate limits as UNKNOWN, not benign                      |
| `ADR-0028` | 2026-10-01 | the self-hosted tier — Gotenberg + Victoria       | ⛔ **the one you probably cannot just sign — see below**                |
| `ADR-0029` | 2026-10-01 | the ledger records un-allocated facts             | accounting-shaped, surveyed                                             |
| `ADR-0020` | 2026-10-15 | Xero history recast; product line from the master | ⚠️ **already went stale against `migration/field-map.yaml` once**       |

⛔ **`ADR-0028` is the one with a real dependency, and it is now dated.** It puts nine containers on
the `ADR-0013` Linode host, and **`SPIKE-011` — rescoped 2026-08-24 to size exactly that tier — is
open and waiting on provisioning.** ⇒ **SPIKE-011 is no longer "blocked externally, not yours to
unblock, ignore it". It is on the critical path for an October date.** If the host is not bought
soon, ADR-0028 goes red with nothing prepared to fix it. ⚠️ The widened scope may also exceed the
spend already approved — settle that **before** buying.

⚠️ **The tempting non-answer is bumping `review_by`.** One line per ADR, and it makes gate 6 stop
meaning anything — this repo's own rule about a check that reads green while matching nothing,
inverted. If a date genuinely was wrong, move it **and say why in the same commit**.

### Where the two open spikes actually stand

| spike                                 | state         | what it needs                                                                                                                                                              |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **011** Linode host → `ADR-0013`      | open          | ⛔ **provisioning.** Spend authorized; rescope landed 2026-08-24 (it had NOT landed when #41 was closed). **Now gates `ADR-0028`'s October date** — this is the escalation |
| **012** booking boundary → `ADR-0015` | `in_progress` | ⛔ **a BUSINESS PROCESS** — manager check-in/out going live (#46). Not yours to unblock, and no amount of authoring moves it                                               |

## Then, in order

|       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | ✅ **DONE 2026-08-24 — the brief is a comment on #56.** What remains on m4 criterion 2 is the owner's ruling, not authoring. ⚠️ **Do not re-prepare it**; read the brief, then act on what it asks for                                                                                                                                                                                                                                                                      |
| **2** | ⛔ **Get the Linode host bought** — or accept that `ADR-0028` cannot be decided by 2026-10-01 and move its date deliberately, with the reason recorded                                                                                                                                                                                                                                                                                                                      |
| **3** | **#6 — requirements.** `ordering`, `availability`, `banking`, `procurement` still have **zero**; ~39 validate warnings are this backlog surfacing and growing daily. ⚠️ **`banking` is the ripest** — `ADR-0048`'s 16 decisions are already implementation-free, and rule 2 lets an ADR be a `source:`. ⚠️ But that path is barely travelled: the first ADR-sourced requirements recorded **no ADR at all** in the matrix. **Check `generate.ts` output, do not assume it** |
| **4** | **#35 PSA, smaller than it reads.** `ADR-0044` settled principal-vs-agent and the EOR finding means the cost path is specified — PSA needs the **revenue side and a product line**, not a payroll path. Feeds #3                                                                                                                                                                                                                                                            |
| **5** | **#40 + #44** — the supersession-dependents gate and its citation-assertion sibling. **Four ready-made instances to land red against**                                                                                                                                                                                                                                                                                                                                      |
| **6** | **#52** — the census for target-state claims resting only on non-target evidence. ⭐ **Widen the predicate**: SPIKE-004 found the third-party-sandbox sibling of the v1 problem, so one rule over the `source:` prefix covers both                                                                                                                                                                                                                                          |
| **7** | **#53 / #54 / #55 / #57** — the boundary and public-app queue. #53/#54/#55 are research (shopping feeds, agentic commerce, payment acceptance); ⚠️ **owner said research SESSIONS**, and **#54 is the highest fabrication-risk topic in the repo**: new field, May 2026 cutoff, heavily written about by people guessing. **#57 is two DECISIONS** — a CDN and Quo — and its sharp end is that **two of the image manager's three jobs are evidence, not decoration**       |
| **8** | **#45** — `ADR-0041`'s D4 is a procedure with nothing executing on it, and it is the half that removes the seasonal bias                                                                                                                                                                                                                                                                                                                                                    |

## Decisions worth not re-litigating

- **`ADR-0025` was NOT withdrawn**, which its own `resolution_shape` offered. **Five IMMUTABLE ADRs
  cite it** (0029, 0031, 0034, 0035, 0038) and can never be updated, so withdrawal buys five
  permanent citations pointing at a rejected decision. **Refused on measured cost.**
- **`ledger/dimensions.yaml` did NOT move to `reporting/`** (#19): four immutable ADRs cite the path
  and gate 11 checks citations resolve, so a move buys four permanent exemptions. Same shape, same
  reason.
- **`ADR-0041` did NOT answer `OQ-045`.** It takes the **arithmetic** half and leaves the
  **judgement** half (a vendor who may or may not bill again). **Narrowing explicitly, with a
  minimal-pair vector as the fence, beat answering both.**
- **#18 fixed with a new field, not a status-aware gate 6.** Rejected: gating only the acceptance
  transition would have left `ADR-0036`'s promise as a comment with nothing behind it.
- **Gate 10n was NOT widened to check applicability** — every value in the refuted scenarios was
  legally declared. Both halves landed later as gate 10p, against the posting RULE.
- **Gate 18 is scoped to minted accounts, not all 143** (#37). Green means "every account this spec
  minted has a home", never "every account has one".
- **The vehicle absorption rate is NOT registered in `reporting/allocation-bases.yaml`** —
  `ADR-0030` cites that file's **discipline**, not its registry.
- **The `closes_adr` exclusion proposed in #39 was wrong and is not implemented.** `SPIKE-012`
  declares `closes_adr: ADR-0015`, so it would have deleted `ADR-0015`'s only real blocker.
  `tools/blockers_test.ts` asserts that exact row.
- **`ADR-0048` took the INGESTION half only** and left what POSTS to `OQ-063`, because that is
  accounting-shaped and owes a survey. Chart code 2500 and `bank_transaction_matched` **moved**
  their block there rather than expiring it.

## Things to carry across a clear

**One shape, and everything below is an instance of it: A CHECK THAT COULD NOT HAVE FAILED REPORTS
SUCCESS, AND AN ABSENCE READS AS A RESULT.**

- **Land every gate red first.** It is not ceremony — it is the only thing that finds the defects.
  Ask of every green check: **could this have failed, over what population, over what state space?**
- ⭐ **Assert a POSITIVE COUNT.** The negative form ("the other rows did not update") passes against
  a runtime where **nothing** runs. Two 08-23 findings were caught only because the assertion
  counted something.
- ⭐ **Guard every population-ranging check with its population.** The Plaid probe reported **13 of
  17 checks PASSING against an empty feed** — "0/0 successors changed amount" is true and measures
  nothing. Three verdicts, not two: `N/A` is what a check returns when it genuinely cannot reach the
  question, so an unmeasurable claim cannot hide inside a green run.
- ⭐ **An EXISTENCE claim and a UNIVERSAL claim need different check semantics.** "It CAN be
  byte-identical" is established by one observation and is **not refuted** by a later absence ⇒ zero
  population is `N/A`, not `FAIL`. **A check that goes red on a vendor's scheduling teaches whoever
  re-runs it to ignore red.**
- ⚠️ **An INCLUSIVE declaration fails closed; an EXCLUSION list fails open.**
- ⚠️ **A self-declared flag needs something that can falsify it**, and the falsifier should demand a
  REASON rather than a verdict.
- ⚠️ **A hand-written invariant is easy to get wrong in BOTH directions**, and neither error is
  visible from the expression. Only a conforming/violating pair tells them apart.
- ⚠️ **When you remove a wrong signal, ask what the absence will now be read as.**
- **When a doc states a count, something must count it.**

**On figures and their owners:**

- ⭐ **TYPE THE FIGURE — gate 22 is the cheapest leverage here and is barely used.** Typing five
  figures as `ADR-0020` `measurements:` immediately turned **four live files red** for quoting them
  uncited. `HOT-018` existed _because_ one quantity had **three internally-consistent values in
  three live files**. ⚠️ Gate 22 matches **EXACT strings**, so it cannot see a paraphrase —
  `$688.00` is still loose across **seven** files (#43).
- ⭐ **A measuring SPIKE owns a figure; a deciding ADR CITES it.** Landing `ADR-0047` with
  re-declared figures made the gate report the _spike_ for restating the _ADR_ — ownership exactly
  backwards.
- ⭐ **And "one owner" was a PREMISE gate 22 could not enforce until 2026-08-24.** `owned` is a Map
  keyed by the figure, so a second declaration **silently replaced** the first and every file citing
  the losing id failed while the winning id looked clean. **Latent, not live** — 34 owned figures, 0
  duplicates — which is precisely why it needed writing down: nobody would have known either way. ⚠️
  **Its first draft was wrong, and only landing it RED caught that**: keyed on the figure alone it
  reported `SPIKE-012/M1` against itself, whose value is `"6,967 of 6,967 — 100.00%"`. **One
  measurement naming one figure twice is not two owners**, and no reading of the expression shows
  you which direction it is wrong in.
- ⚠️ **A CONTROL TOTAL KEYED TO THE NATURAL DOCUMENT TOTAL SILENTLY FORBIDS EVERY ENTRY THAT IS NOT
  THAT TOTAL.** `control_total: bill.amount_minor` made CFS's own measured direction
  **unrepresentable**. `vehicle_cost_absorbed` had already hit this and written the reason down
  **two entries away in the same file**, and nothing connected them.
- ⚠️ **MEASURED POPULATION ANSWERS "IS THIS URGENT", NOT "IS THIS IN SCOPE."** Corrected twice by
  the owner in one day. The footgun about not minting a branch before measuring its population is
  about machinery for branches nothing takes; **it does not license omitting a rule the law requires
  and a future asset will reach.**

**On staleness and citation:**

- ⚠️ **AN ADR GOES STALE AGAINST THE MIGRATION SPEC THAT IMPLEMENTS IT, and nothing compares them.**
  `ADR-0020` said "restate all" while `migration/field-map.yaml` had **already** encoded
  derive-from-the-master in three places. **It had stopped tracking what the repo already did.**
- ⚠️ **A SENTENCE THAT ACCURATELY QUOTES A SUPERSEDED CLAIM reads, out of context, as asserting it**
  — how `ADR-0029` acquired a requirement it never made, in two artifacts (#44).
- ⚠️ **A value one letter from a legal one, in a file no gate reads, is the cheapest way to be
  wrong.** Ask which file the value you just typed is checked AGAINST.
- ⚠️ **A CLOSED ISSUE READS AS DONE WORK.** #41 was closed in the same pass that recorded "widen the
  scope before provisioning" — and the widening was never written. **Check the artifact, not the
  queue.**

**On evidence from outside the target system:**

- ⚠️ **v1 answers WHAT IS, never WHAT MUST BE** — five instances, all caught by the owner.
- ⭐ **AND ITS THIRD-PARTY SIBLING: A SANDBOX ANSWERS WHAT THE API DOES, NEVER WHAT THE INSTITUTION
  WILL SEND.** Seductive for the same reason — executable, pinned and citable while production is
  none of those. `validate.ts` carries the limit at the `plaid:` regex; two SPIKE-004 figures are
  labelled sandbox-only in their own `of:`.
- ⚠️ **DELEGATED RESEARCH WILL FABRICATE A QUOTABLE SOURCE, and it is not rare.** Every instance was
  caught by demanding a **verbatim quote with a URL**. Make fabrication mechanically impossible
  rather than discouraged: the tax-rule refresh proposes a **line number** into a locally extracted
  primary source, and **a line number cannot be fabricated.**
- ⚠️ **"PRESENT BUT WRONG" BEATS "ABSENT" AT PASSING EVERY EXISTENCE CHECK.** `running_balance` is a
  key on every posted Plaid row and null in all of them. An existence check passes; the field is
  empty; production behaviour is unmeasured.

**Capabilities worth not rediscovering:**

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. **This retires "a full sweep needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is NOT the collection list** — it carries 35; there are **50**, and
  it omits `credit-notes` and `settlements` (1,073 documents of cash application). Anything scoped
  from it is scoped short.
- ⚠️ **`--development` caps TigerBeetle's `createTransfers` at 253, not the documented 8189.**
  **Every TB measurement here before 2026-08-18 was taken on `--development`.** `SPIKE-011` owns the
  production numbers.
- `deno task ci` reproduces the whole CI contract locally. ⚠️ **Never pipe it into `tail`/`head`** —
  that masks the exit code.

## Context recommendation

**CLEAR CONTEXT.** The decision batch is executable from this doc, the five ADRs' own bodies, their
cited surveys, and `CLAUDE.md`. Nothing needed is in anyone's head, and the context that produced
this revision is full of Plaid sandbox internals the batch does not need.

⚠️ **The one thing written down nowhere else** is the START HERE table: **m4's binding criterion is
the `review_by` cliff, not the spikes**, and it breaks CI on **2026-10-02**. Everything else —
milestone state, hotspot reasoning, issue backlog — is in `STATUS.generated.md`, the ADRs, and the
issues.

⚠️ **And as of 2026-08-24 the batch is PREPARED, so a fresh session's job on criterion 2 is NOT to
write the brief again.** It is a comment on #56. Read it, then either act on a ruling or work item 3
onward — re-preparing it would be a day spent producing something that already exists.

⚠️ **The recommendation is the part of a plan doc that goes stale fastest**, because it is the only
part written about the future. This one named "the shared 009+013 ADR, then SPIKE-004" until
2026-08-24, and both had closed by the time anyone read it. **Re-derive from
`SPEC_TODAY=<date> deno task validate` and the spike front matter; treat this footnote as the reason
to.**
