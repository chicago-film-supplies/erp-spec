# Clearing the erp-spec open issue queue

- **Date:** 2026-08-17 (rewritten; supersedes the 2026-08-16 revision)
- **Repo:** erp-spec
- **Status:** `main` is CI-green. **The two ADRs accepted 2026-08-17 are now EXECUTABLE**: gate 18
  fails on a minted account nothing posts to, `vehicle_cost_absorbed` is written with four golden
  vectors, and gate 19 makes CLAUDE.md rule 8a fire at acceptance. Ten issues open, two of them
  opened by this session's own measurements.
- **Origin:** a review of the open issue queue, requested because #18 was on the owner's mind
- **Related:** open — #3, #4, #6, #12, #17, #32, #35, #36, **#37 (the other 104 accounts)**, **#38
  (labor_variance)** · closed: #8, #13, #14, #15, #16, #18, #19, #20 · HOT-015, HOT-016 resolved ·
  OQ-045/046/047/049/050 answered; OQ-048, OQ-051, **OQ-052** open ·
  **`.claude/plans/addressable-claims.md`** is the companion plan for ADR-0037

## START HERE

Nothing is half-finished. The next session picks from _Then, in order_ below.

⚠️ **A GitHub OUTAGE on 2026-08-17 was misdiagnosed as a billing block**, in an earlier revision of
this doc and in `CLAUDE.md`. Actions failed in ~2s saying _"recent account payments have failed or
your spending limit needs to be increased"_. **Billing was fine.** Actions has been green since. ⇒
**A platform's own error message names the path it fell into, not the cause** — check
githubstatus.com before believing one.

✅ **`deno task ci` runs the whole CI contract locally** — validate, fmt check, gen, staleness, tool
tests — and the workflow calls the same file.

### What changed 2026-08-17 (evening), and what it cost

**1. Gate 18 — a minted account nothing posts to.** `coa_complete` verified accounts EXIST; nothing
verified anything could post to them. It landed RED on **five**, not the four the audit predicted:
`5150` was minted for ADR-0029 on 2026-08-16 and wired to nothing either, so an unreachable mint was
never an ADR-0030 one-off.

- **Scope is MINTED accounts (`disposition: new`)**, on the chart's own stated bar: _"an account
  enters this file because a posting rule has no legal account for one of its legs."_ ⚠️ **104 of
  108 ADOPTED accounts are named by no rule at all** and the gate does not fail on that — it
  MEASURES it in a note, and **#37** holds the work. Do not read a green gate 18 as "every account
  has a home".
- **A path-typed side (`line.debit_account`) reaches accounts no gate can see**, so a posting
  DECLARES them: `reaches_minted_accounts:`, code → reason. **Inclusive by construction** — an
  exclusion list fails OPEN, silently swallowing the next minted COGS account into a domain a vendor
  bill must never touch.
- ⚠️ **Firing it found a defect in the gate itself**: a declaration with a BLANK reason still
  counted as coverage, so the note read "5 of 9" on a run whose real reach was four.

**2. `vehicle_cost_absorbed` — the rule ADR-0030 has needed since acceptance.** `EVT-FUL-008`,
producer fulfillment on the `EVT-FA-002` precedent (the context that owns the facts computes the
schedule; the ledger posts it). `Dr 5900` per shift allocation row, `Dr 5901` residual, `Cr 6409`.

- ✅ **5150 and 5902 needed no rule** — both already arrive through `vendor_bill_received`'s direct
  line and `obligation_accrued`, and ADR-0030 says so outright ("it needs nothing new"). What was
  missing was the DECLARATION. **Writing a rule for either would have invented a second mechanism
  for a cost that already has one.**
- ⚠️ **A period may OVER-absorb and ADR-0030 does not address the direction.** Money is a
  non-negative integer, so it is a third leg (`Dr 6409 / Cr 5901`) and the control total is
  `entry_total_minor`, not the pool — with the pool as the control total the arithmetic does not
  close and the rule would silently work in one direction only. **OQ-052** holds where it should
  rest (rule 8a applies), and the branch is exercised rather than claimed.
- **OQ-052** also holds the rate and the normal-capacity denominator ADR-0030 called "a requirement,
  not a footnote" and nobody had written down.
- **m3 gains a fifth criterion** (`minted_accounts_reachable`) — gate 18 enforces, the milestone
  reports, the arrangement `adr_review_by_current` already has with gate 6.

**3. Gate 10q — the header's own bucket counts.** It landed red on `no_posting[] 11` against
**thirteen** entries, stale since `EVT-PRO-001` arrived with procurement and `EVT-BIL-007` with
ADR-0033, and on "24 ledger events" that had never been re-measured. It is **29**.

**4. Gate 19 — rule 8a executes.** Every ADR declares `accounting_shaped: true | false`; an
`accepted` one that is `true` must cite a `survey:` under `inbox/`.

- ⚠️ **It cannot be derived from `contexts:` — 31 of 38 ADRs name `ledger`**, including "self-host
  on Linode". A gate keyed on that demands a six-reference accounting survey for a hosting decision.
- **Fires at acceptance, warns before it.** Four warnings stand: ADR-0020, ADR-0025, ADR-0029 — the
  three the audit predicted — and **ADR-0038, proposed the day before and on nobody's list**.
- **Six accepted ADRs carry a `survey_exemption`**: 0007, 0010, 0017, 0021, 0026 and ⚠️ **0036,
  which is not legacy — accepted seven days after the instruction.** Two of the six point rather
  than excuse: **ADR-0026's survey EXISTS and was never labelled one**, and ADR-0017's premise is
  already partly retracted, so the survey is owed by whatever supersedes it.
- **Front matter is not hashed** (gate 14), which is the only reason a frozen ADR can gain these
  fields at all.

**5. Gate 10r — a `labor_line` named under `ledger/` resolves.** ⚠️ **Written because this session's
own golden vectors carried `labor_line: trash_cleanup`, which is not a value** — the declared id is
`trash_&_cleanup` and `trash_cleanup` is the POOL id in `reporting/product-line-pl.yaml`. Two things
one letter apart in two files, invisible to every gate: 13h checks the reporting side, and a
`labor_line` inside a vector's `given` was read by nothing. It is the ledger half of what OQ-046
asked for.

**6. `labor_variance` is parked in #38, and the park itself is a finding.** ADR-0019 is accepted and
says it fires (OQ-050 measured why). It has no account — `5190` was deleted when HOT-010 killed the
rate variance on a premise measurement has since refuted — and no event. ⚠️ **It cannot go in
`unwritten:` either: all four coverage buckets are keyed by EVENT**, so a rule whose trigger has not
been storm-ed has nowhere to sit, and `unwritten: []` does NOT mean every known gap is covered.

### The queue: 10 open — 5 blocked on the owner, 5 startable

|               | Issue   | State                                                                       |
| ------------- | ------- | --------------------------------------------------------------------------- |
| **startable** | **#35** | PSA is a whole service line with no spec at all                             |
| **startable** | **#36** | but-for hides what the paid-for slack PRODUCED                              |
| **startable** | **#37** | ⚠️ NEW — the 104 adopted accounts no rule names                             |
| **startable** | **#38** | ⚠️ NEW — `labor_variance`; the survey is the work, and it is rule-8a-shaped |
| **startable** | **#6**  | re-measured 2026-08-17 and commented — half the size its own text claims    |
| blocked       | #32     | the imputed-labor view — needs OQ-048, the imputed rate                     |
| blocked       | #17     | OQ-039 + ADR-0032/0033 acceptance, and an ordering gate                     |
| blocked       | #12     | ✅ `vehicle_cogs` fully expressible now — **two pools left**                |
| blocked       | #4      | only the m5 formal-methods ADR remains — detection DONE                     |
| blocked       | #3      | the spare u16: three contenders, decided on other grounds                   |

### What is still the owner's

- **ADR-0032 + ADR-0033 + OQ-039** → unblocks #17.
- **The trip-grouping decision and a warehouse-overhead ADR** → #12's two remaining pools. ⚠️
  Distance does **not** unblock `trip_travel`: it says how far a destination is, not which orders
  shared a van.
- **Who gets `Transfer.code`** → #3's live half. Two contenders fully worked: the actor ref, and the
  causal order on the 2.97% of invoices where `path[0]` cannot supply it.
- **OQ-048** — what rate to impute for a contributed owner shift (#32 waits on it; GAAP does not).
- **OQ-051** — where the seam sits between CFS and a chat system for comments/threads.
- **OQ-052 — NEW.** The vehicle rate, its normal-capacity denominator, and where an over-absorbed
  balance rests. The third part is rule-8a-shaped.
- **Accept or reject ADR-0037** (ids carry meaning where used) and **ADR-0038** (no causal order
  means not COGS). ⚠️ ADR-0038 now carries a gate-19 warning — it is accounting-shaped and cites no
  survey, so **acceptance will fail until one exists**.
- **Team meals in COGS** — answered 2026-08-17: meals stay in opex.
- **11 ADRs remain proposed.** ⚠️ Four of them cannot be accepted as they stand (gate 19).

### Two capabilities every remaining unit should use

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. **This retires "a full sweep needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is not a list of the collections.** It carries 35; there are **50**.
  Anything scoped from it is scoped short — #8 was.

## Then, in order

|                         |                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ADR-0037 + ADR-0038** | red-team ADR-0037 first (`refine-plan`); ⚠️ **ADR-0038's sweep must land in the SAME change as its acceptance** — 28 files, and nothing is wrong until it is accepted; ⚠️ **and ADR-0038 owes a survey first (gate 19)** |
| **#35**                 | PSA — a service line with five GL accounts and no spec; includes a charter contradiction that owes a `HOT-`. ✅ Gate 18 measured the same gap from the other side: `2800`–`2803` and `4130` are reachable from nothing   |
| **#38**                 | `labor_variance` — the survey IS the work; the account was deleted on a refuted premise                                                                                                                                  |
| **#37**                 | the other 104 accounts — an inclusive `resolves_to:` per path, land it red, and ⚠️ **rule 8a applies to the domains**, so it is not a bulk typing job                                                                    |
| **#36**                 | the shift records `hours_idle` where the truth may be "worked on something else"                                                                                                                                         |
| **#6**                  | requirements backlog, blocks m7 — 21 requirements, 4 of 9 contexts uncovered (measured 2026-08-17)                                                                                                                       |

⚠️ **Five of ten issues are blocked on owner decisions, and the decision backlog is not blocked on
the owner's availability — it is blocked on nobody having prepared the decisions.** The 2026-08-16
session took three in a few sentences each, because every one arrived with measured evidence, a
criterion and a recommendation. **ADR-0030 shows what "prepared" costs**: it sat `proposed` for a
week looking like it needed a signature; what it needed was a survey rule 8a had required all along,
and running that survey reversed one of its stated consequences. ⇒ **One prepared decision per
session is probably worth more than the authoring it displaces.**

## Done — the units, compressed

Each landed with its gates fired red first; the commits carry the detail.

- **#18, the supersede machinery** (`a5debf1`). `supersedes_on_acceptance:` — one-way by
  construction, so nothing is written onto the target until acceptance. Three gate-6 arms fired,
  including **`superseded_by` set without `status: superseded`**, a second hole found while
  verifying the first.
- **#16, the `.feature` dimension gate + HOT-015** (`8bb41cc`, `8ae3f37`). Gate 10n checks dimension
  values named in a **step**. ⚠️ **Step lines only, and the restriction is load-bearing** — a first
  cut fired on the Feature's own retraction paragraph, i.e. on the notes the repo asks people to
  write.
- **#15 + #13** (PR #23). `spikes/harness/corpus.ts`; the probe had **never been executed once**. ⚠️
  **The bigger half was not the auth** — the probe held a hand-maintained sixth copy of the
  goods/activity taxonomy, so OQ-034's restoration of `Transport` left $39,665 classified goods by
  omission. Two of three predicted directions FAILED: pool-exceeds-base **rose** 3.8pp, and
  unallocable's share fell **only because its denominator grew**.
- **#14, procurement's posting rules** (PR #25), and m3 with it. The survey found the criterion is
  **matched versus estimated**, not goods versus services, and that one fact decided both rules. ⚠️
  Not a pure addition: until `2010` existed **every shift in the ledger overstated trade payables by
  its own cost**.
- **#19 + #20, keys-not-classifications** (PR #31). 61 files, 12 gate arms fired red. `dimensions:`
  DELETED from all 139 chart entries rather than emptied to `[]`. ⚠️ **Four things were found by
  FIRING the gates, none by reading** — including a rule and its vectors disagreeing with every gate
  green, and **10n's account arm matching nothing at all**.
- **Four owner rulings, same day** (PR #31). `labor_line` is the allocation pool's COST SELECTOR;
  counter and warehouse bill goods too (`kind: cost_only`); the unpaid owner shift writes no
  transfer. ⚠️ It exposed a defect the sweep itself carried: the `transport` pool selected
  `labor_line: delivery` — correct at three enum values, wrong from the moment there were seven.
- **#8, the m6 field map** (PR #34). `m6` measured for the first time. ⚠️ **`met` would have
  OVERCLAIMED** — a collection-level `paths_default: map` says only that it maps, so gate 15 now
  refuses a `map` naming no target. Found `customers` (150 docs) DEAD, `config` an OAuth **token
  store**, and `settlements` (1,073 docs) the same object the map already named twice.
- **ADR-0030 accepted** (PR #33) after the survey it never had, and ⚠️ **three of seven owner
  rulings CHANGED it**: hired trucks post direct at actual (reversing my own recommendation), 6302
  keeps a live population, and 5200 is not a CFS labor account.
- **ADR-0019 accepted** 2026-08-17. Labor costing is NORMAL costing; OQ-050 measured that Wrapbook
  itemises wages per person per day but prices burden per RUN.
- **This session** — gates 18, 19, 10q; `vehicle_cost_absorbed`; OQ-052; #37 and #38 opened.

## Not startable — leave open

- **#17** — OQ-039 is open with `decide_by: 2027-01-15`, neither ADR-0032 nor ADR-0033 is accepted,
  and the issue records its own ordering gate: ADR-0020's dimension restatement must run **first**
  and prove no amount moved, because both cross the same closed periods.
- **#12** — `trip_travel` needs which orders shared a run; `warehouse_overhead` needs an ADR nobody
  has written. ✅ `vehicle_cogs` is done.
- **#4** — ADR-0003 cites `formal/two-store-commit.tla`, which no longer exists. ADR-0003 is
  immutable, so the fix is the m5 formal-methods ADR. ✅ **Its detection half is DONE** — gate 11,
  widened 2026-08-16 to `contexts/`, `ledger/`, `reporting/`, `migration/`, `roadmap/`; `inbox/` and
  `research-drop/` stay out because a citation gone stale there has no legal fix but an exemption.
- **#3** — one spare u16, three contenders (dimensions, the actor ref, the causal order), decided on
  entirely different grounds and therefore not tradeable on capacity.

## Decisions worth not re-litigating

- **#18 fixed with a new field, not a status-aware gate 6.** Rejected: gating only the acceptance
  transition, which would have left ADR-0036's promise as a comment with nothing behind it.
- **Gate 10n was deliberately NOT widened to check applicability** — every value in the refuted
  scenarios was legally declared. Both halves landed later as gate 10p, against the posting RULE.
- **`ledger/dimensions.yaml` did NOT move to `reporting/`**, which #19 proposed: four IMMUTABLE ADRs
  cite the path in backticks and gate 11 checks citations resolve, so a move buys four PERMANENT
  exemptions. **Refused on measured cost.**
- **Gate 18 is scoped to minted accounts, not all 143.** Answering "what may post here" for the
  adopted ones is a where-does-it-post decision under rule 8a; bulk-typing 104 assignments is
  exactly the shape 8a exists to prevent. The limit is measured in the gate's own note (#37).
- **The vehicle absorption rate is NOT registered in `reporting/allocation-bases.yaml`.** Every
  field there (`base`, `zero_base`, `rounding`) describes spreading a pool proportionally over a
  base, and a rate applied to a quantity has none of them. ADR-0030 cites that file's
  **discipline**, not its registry.

## Context recommendation

**CLEAR CONTEXT.** Nothing needed is in anyone's head — `STATUS.generated.md`, the inbox, the ADRs
and this doc are all on disk, and `deno task ci` reproduces the whole CI contract locally.

### Ten things to carry across the clear, because none is obvious from the issue text

- **Firing a gate red is not ceremony — it is the only thing that finds the defects.** Across three
  sessions ~forty arms were fired and twelve found real bugs, none surfaced by reading: a rule and
  its vectors disagreeing while every gate stayed green, a double-reported failure, a check matching
  nothing at all, a milestone criterion whose second half was never verified, a pool selecting the
  wrong labor, a field map naming the wrong object, a probe reporting doc ids as schema, **a header
  count stale by two for a week**, and **a gate of my own that counted a blank claim as coverage**.
- ⚠️ **An INCLUSIVE declaration fails closed; an EXCLUSION list fails open.** "Any expense account
  except these" silently swallows the next minted COGS account; "these codes" goes red until someone
  writes the new one down. This decided gate 18's shape and it will decide #37's.
- ⚠️ **Scope a gate to what the spec is RESPONSIBLE for, then measure what it does not cover.** The
  reachability check could have failed on 109 accounts and been ignored; scoped to the 9 it mints it
  named five real defects, and the 104 it skips are a NUMBER in its own note plus an issue. **A
  noisy reporter is one nobody reads twice, which is the same outcome as no reporter.**
- ⚠️ **A value one letter from a legal one, in a file no gate reads, is the cheapest way to be
  wrong.** `trash_cleanup` (a POOL id) for `trash_&_cleanup` (a `labor_line` value) survived
  authoring, review and a green CI run — written by the same session that wrote the gates. **Ask
  which file the value you just typed is checked AGAINST**; if the answer is none, that is the next
  gate (10r).
- ⚠️ **Two messages for one defect is how a gate teaches the wrong lesson at 2am.** Gate 18's
  malformed-claim arm was written to report both the bad claim and the resulting unreachable
  account, until it was fired with a blank reason.
- **When a doc states a count, something must count it.** `no_posting[] 11` against thirteen
  entries; "24 ledger events" against 29; "138 entries, four minted" against 143 and nine. Three
  instances, three gates (10q, 16), one rule.
- ⚠️ **A rule that exists and is not applied blocks work silently.** ADR-0030 looked like it was
  waiting for the owner and was waiting for rule 8a. **Gate 19 executes it now** — and the first
  thing it found was an ADR proposed the previous day with no survey.
- ⚠️ **A self-declared flag needs something that can falsify it, and the falsifier should demand a
  REASON rather than a verdict.** Gate 19's tripwire fires on an ADR calling itself
  not-accounting-shaped while naming GL codes; forcing ADR-0037 to call itself accounting-shaped
  would have been the wrong answer, loudly.
- ⚠️ **A correct conclusion reached by wrong reasoning is not a checked conclusion.** The
  `transport` pool selected `labor_line: delivery` — right at three enum values, wrong from the
  moment there were seven, and it survived a rename that touched the very sentence.
- **The `db_schema` enum is not the collection list** — 35 against 50, and it omits `credit-notes`
  and `settlements`, the second of which is 1,073 documents of cash application.
