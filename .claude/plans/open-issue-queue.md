# Clearing the erp-spec open issue queue

- **Date:** 2026-08-16
- **Repo:** erp-spec
- **Status:** ⏳ #16, #18 closed (PR #21) · #15, #13 closed (PR #23) · 7 issues open
- **Origin:** a review of the open issue queue, requested because #18 was on the owner's mind
- **Related:** open — #3, #4, #6, #8, #12, #14, #17, #19, #20 · closed by this work: #13, #15, #16,
  #18 · HOT-015 (resolved) · `tools/validate.ts`,
  `spikes/harness/{corpus,allocation-basis-probe,product-line-matrix-probe}.ts`,
  `ledger/posting-rules.yaml`

## START HERE

**Units 1, 2 and 3 are done.** #16 and #18 closed via PR #21; **#15 and #13 closed via PR #23**
(2026-08-16). `main` was CI-green at `c88041a` before PR #23.

**Seven issues remain open.** In priority order:

|        | Issue                             | State                                                           |
| ------ | --------------------------------- | --------------------------------------------------------------- |
| Unit 4 | **#14**                           | startable, **biggest roadmap payoff** — completes m3 outright   |
| Unit 5 | **#8**                            | startable, cheapest real win (one 5-minute fix + bulk coverage) |
| Unit 6 | **#6**                            | startable, but **its numbers are stale** — re-measure first     |
| —      | **#19**, **#3**                   | gated on **ADR-0036 acceptance**, an owner action               |
| —      | **#17**, **#12**, **#20**, **#4** | not startable — see the sections below                          |

If you want one thing to move the most: **accept ADR-0036**. It resolves both open hotspots and
unblocks #19 and #3 — and Unit 1 of this plan is what makes taking that action safe.

⚠️ **New capability every remaining unit should use.** `spikes/harness/corpus.ts` reads prod
Firestore read-only under ADC — no token, project hardcoded to `cfs-3100`, `--allow-net` narrowed so
it cannot reach Xero or CRMS, write verbs unreachable by construction. **This retires "a full sweep
needs a script rather than MCP paging"**, which the spec was carrying as an accepted limit in at
least one place (`chart-of-accounts` 4140, now measured corpus-wide). Unit 5 (#8) in particular is a
~30-collection sweep that was priced as manual work and is not any more.

⚠️ **This triage is the corrected one.** The first pass covered 6 of 11 open issues: the initial
`gh issue list` was piped through `head -60` and #13's comment bodies consumed the output, silently
truncating #12, #8, #6, #4 and #3. #19 was filed by a parallel session while planning. Anything
citing "six open issues" predates the correction.

## Done

### Unit 1 — #18, the supersede machinery (`a5debf1`) — CLOSED

Gate 6 checked `supersedes`/`superseded_by` symmetry unconditionally on status, and
`tools/generate.ts` computes in-force as `status === "accepted" && !superseded_by` — so
`superseded_by` **alone** removes an ADR. A `proposed` superseder therefore could not declare its
supersession without retiring its target: ADR-0036 would have left the repo with no in-force
decision on the chart of accounts.

Shipped `supersedes_on_acceptance:` — one-way by construction, so nothing is written onto the target
until acceptance and `inForce` needed no change. Three gate-6 failures added, **all fired
deliberately and reverted before landing**:

- an `accepted` ADR still carrying `supersedes_on_acceptance` (the promotion was forgotten);
- the same target named in both `supersedes` and `supersedes_on_acceptance`;
- **`superseded_by` set without `status: superseded`** — a second, ungated hole found while
  verifying the first. ADR-0006 and ADR-0008 held that pairing by hand convention alone.

Touched: `tools/validate.ts`, `tools/generate.ts`, `tools/view.ts` (it holds its own front-matter
copy and runs no gate), `adr/_TEMPLATE.md`, `adr/ADR-0036-*.md`, `CLAUDE.md`.

Verified after `deno task gen`: ADR-0018 is still one of the 17 in force, and ADR-0036 shows
`ADR-0018` in the new `Supersedes on acceptance` column.

### Unit 2 — #16, the `.feature` dimension gate + HOT-015 (`8bb41cc`, `8ae3f37`) — CLOSED

**Gate 10n** checks every dimension value named in a `.feature` **step** against
`ledger/dimensions.yaml`. Two things worth knowing:

- **It lands green.** #16 predicted a red landing on `dimensional-postings.feature:25`, but
  `Transport` was restored on 2026-08-16 (OQ-034, `702270b`) five days after the issue was filed.
  Fired three ways before landing, the third reproducing the original bug by dropping `Transport`
  back out of `dimensions.yaml` — one FAIL, on line 25, exactly as the issue predicted.
- **Step lines only, and the restriction is load-bearing.** A first cut matched anywhere and fired a
  second time on the Feature's description paragraph, which named `"Transport"` while explaining
  that the value had been dropped. That is the repo's retraction convention working; a gate that
  read prose would turn CI red on the notes the repo asks people to write.

**HOT-015** was opened and resolved in the same session — **HOT-011 surviving in the one artifact
ADR-0025's resolution did not sweep**. The feature file contradicted **itself**: its last Scenario
Outline already stated the per-account rule correctly ("5800 is the only account in the chart that
names `cost_type` at all") while its title and two scenarios 40 lines above asserted the refuted
per-class reading.

Amended: title → "A posting declares every dimension its own account names"; scenario 1 stops
putting a `cost_type` on a revenue posting; **scenario 3 flips from `rejected` to `recorded`** and
names account 5000 (`dimensions: [product_line]`); a scenario was added for 5800 so a declared
`cost_type` value stays exercised by 10n; the stale ⚠️ `Transport` paragraph was removed.

### Unit 0 — formatting (`12540fc`)

`deno fmt --check` is a CI step and was **failing on `main` at `5b1f8ae`** — 7 files, none touched
by this work. Landed separately so it did not swamp the real diffs.

### Unit 3 — #15 then #13 (PR #23) — CLOSED

**#15** took option 2, direct Firestore via ADC. `spikes/harness/corpus.ts` holds it: no token, the
`Firestore` handle confined to a closure so write verbs are unreachable, `--allow-net` narrowed to
Google hosts so the harness cannot reach Xero or CRMS, project hardcoded to `cfs-3100`. The probe
had **never been executed once** — its own provenance note said so.

⚠️ **The bigger half of #15 was not the auth.** The probe held a hand-maintained sixth copy of the
goods/activity taxonomy, so OQ-034's restoration of `Transport` left it classified **goods by
omission** — $39,665 in the allocation base. `validate.ts` does not read `spikes/`, so no gate could
ever have caught it. `loadClassification` now reads `line_kinds` and the pools' `status` from
`reporting/product-line-pl.yaml`. Same lesson as `view.ts`'s fifth copy of the context registry.

**#13 — both remaining items done, and two of three predicted directions FAILED.**

| figure                   |      2026-08-09 |             2026-08-16 | predicted      | outcome                              |
| ------------------------ | --------------: | ---------------------: | -------------- | ------------------------------------ |
| pool exceeds base        |           41.4% |             **45.20%** | must FALL      | ⚠️ **ROSE 3.8 pp**                   |
| structurally unallocable |           5.16% |              **4.94%** | FALL, maybe ~0 | ⚠️ share fell, **amount+count rose** |
| inter-basis divergence   | 27.4/31.5/33.5% | **27.77/32.53/34.19%** | unknown        | flat — the unpredicted one was right |

- **Pool-exceeds-base rose** because the defect suppressed BOTH sides and suppressed the pool
  harder. `Delivery` gained $20,437.50, almost all on 4100 Service Income, where a service-heavy
  order has little goods revenue to categorise against it. The design rule gets **bigger**, not
  smaller.
- **Unallocable's share fell only because its denominator grew** — amount $11,150 → $11,400, groups
  11 → 12. Nothing became allocable. Fourth base-comparability trap in this corpus in eight days.
- **The five Netflix Duradeck orders did not move**, and the 2026-08-10 retraction saying they would
  is **withdrawn**: `products/kqzVClx5uJrJ07bEjokX` is `"Delivery"` at the master — the install
  labour, not the deck. That retraction inferred a category from a product NAME and read neither
  product record. The 2026-08-09 "service-only jobs, not a defect" reading is reinstated.
- Both golden vectors asked to be re-checked and **both were vindicated**, including invoice 1616's
  worked example (exactly two revenue lines; all five near-identical invoices at exactly 312.5%).

⚠️ **Two traps worth carrying forward.** The 2026-08-09 note's **row** count (11,131) is not
comparable to a direct Firestore read (14,410) — its `items[].x` MCP projection omitted all 3,056
`group` dividers; revenue-bearing lines are unaffected. And `Crafty` nearly tripled to $45,530.48
with its account mix inverting to 90.26% retail, which nobody had flagged.

✅ Also closed on the way: **core#51 is closed and ADR-0031 still cited it as live**. The `shipping`
dimensions are nullable and prod holds 537 `null` / 3 zero / 0 non-zero of 567, so OQ-033's
activation precondition is writable — and the owner's ruling that weights will exist for **many**
products by the time v2 is in dev makes partial population the anticipated state, so that
precondition is v2's primary requirement. Two new consequences recorded on OQ-033: the unallocated
bucket as a **coverage meter**, and activation at a coverage **threshold** rather than first
non-zero weight.

## Remaining

### Unit 4 — #14, procurement's three posting rules (its own session)

⚠️ **The issue says "not urgent and nothing is blocked". That is wrong at the roadmap level.** Both
unmet `m3` criteria — `posting_rules_cover_events` and `vectors_cover_rules` — require
`w.unwrittenRules === 0` (`tools/milestone-checks.ts:291,304`), and `EVT-PRO-002`/`EVT-PRO-003` are
the **only** two entries in `ledger/posting-rules.yaml`'s `unwritten:` bucket. m3 has four criteria,
two met, **zero `prose_only`** — so #14 completes m3 outright. It is the only milestone in the repo
finishable by machine today, and m3 gates m4 and m7 → `spec-v1`.

Order matters:

1. **Survey first (rule 8a, non-optional)** — the accrued-expense account against all six
   references. Record in `inbox/`, dated, before any rule cites it.
2. `ledger/chart-of-accounts.yaml` — add the accrued-expense account. ⚠️ **Not 2160**: CFS has no
   payroll liability across four years, payroll is a charter non-goal, the EOR is a vendor that
   invoices (OQ-024).
3. `EVT-PRO-002 ObligationAccrued` — Dr expense/asset, Cr accrued liability.
4. `EVT-PRO-003 VendorBillReceived` — one event, two postings, discriminated on whether
   `obligation_id` resolves. **Getting this wrong double-books the expense in a way that still
   balances**, so no balance check catches it. The reject vector is the load-bearing artifact.
5. Vectors — gate 10k requires an accept **and** a reject per specified rule.
6. **Amend `shift_recorded` and `asset_acquired`** — both credit 2000 AP today, wrong on the
   shift/acquisition date because the vendor has not invoiced. **Not a pure addition**: both are
   `specified` with existing golden vectors under `ledger/vectors/`, and the vectors move with them.
7. `EVT-PRO-001 PurchaseOrderIssued` stays `no_posting` — decided, not deferred.

Exit check: `m3` reads **4 met / 0 unmet / 0 prose** in `STATUS.generated.md` and `unwritten:` is
empty.

### Unit 5 — #8, the m6 field map (cheapest real win)

`migration/field-map.yaml` holds ~10 mappings against ~30 Firestore collections, against an m6 exit
criterion of "every current Firestore path maps to a new field, an explicit drop, or a quarantine".
Unblocked and parallelisable with everything else.

Two parts, very different sizes:

- **Five minutes:** `invoices.query_by_orders` carries `disposition: defective` on the strength of
  "55 referenced order uids reportedly do not exist" — **OQ-013 answered that with a measured 0**
  (`inbox/2026-08-09-hard-deleted-order-uids-do-not-reproduce.md`). Do what `charter.md` already
  does for the no-hard-deletes fence: keep the disposition if it stands on other grounds, and say
  plainly that the original evidence does not reproduce.
- **The bulk:** the remaining ~20 collections. Also the live→target GL account correspondence, which
  belongs here and exists nowhere — `ledger/chart-of-accounts.yaml` deliberately carries no
  `xero_id` (ADR-0009 fences foreign identifiers out of domain models).

⚠️ Same milestone as **#17**, which is deferred. #8 does not depend on it and should not wait for
it.

### Unit 6 — #6, the requirements promotion backlog

⚠️ **The issue's numbers are badly stale and nobody updated them.** It says "2 requirements total"
and "6 of 8 contexts have `requirements: []`". `STATUS.generated.md` today reports **21
requirements**, 0 without a scenario, and 4 contexts uncovered (`ordering`, `availability`,
`banking`, `procurement`). 19 were promoted on 2026-08-16. **Re-measure before planning it** — this
is the largest remaining structural gap and it blocks m7, but it is roughly half the size the issue
claims.

The trap the issue names is still live: **adding a requirement trips gate 3**, which demands a
tagged Gherkin scenario. Promotion is requirement + scenario, never requirement alone. And as of
this session those scenarios are also checked by gate 10n.

## Gated on ADR-0036 acceptance — the single biggest unblocker left

Accepting ADR-0036 is now **one owner action that moves four things**, and Unit 1 is what makes it
safe to take: the promise is machine-enforced rather than remembered, and ADR-0018 stays in force
until the moment of acceptance.

- **HOT-013 and HOT-014** — the repo's only two open conflicts. ADR-0036 is the sole proposed
  resolution of both, and they are 1 of m4's 3 unmet criteria.
- **#19 — `cost_type` → `labour_line` (3 → 7 values) plus the keys-not-classifications rework.** The
  issue says explicitly **do not start before ADR-0036 is accepted**: it reworks the same files, and
  renaming first means touching every vector twice.
- **#3 — the TigerBeetle `user_data` budget (three fields, four claimants).** Its premise moves
  under ADR-0036, which changes what a posting carries at all. Do not re-litigate the eviction
  before the decision lands. It is HOT-013's subject.

⚠️ **#19 lands directly on top of what this session built.** It renames `cost_type`, and its own
editable list names `tools/validate.ts` (gate 10) and
`contexts/ledger/features/dimensional-postings.feature` — gate 10n's `DIM_OF` map hardcodes
`"cost type" → cost_type`, and the amended scenarios use the value `delivery`. Both move in the
sweep. Two things #19 flags that must be settled first: the British/American spelling
(`labour_line`, per ADR-0019 and `labour_cogs`), and whether `labour_line` stays a posting field at
all under ADR-0036's own criterion.

## Not startable — leave open

- **#17** — see Decisions.
- **#12**, the three deferred allocation pools (`vehicle_cogs`, `trip_travel`,
  `warehouse_overhead`). Three separate blockers, none decided: ADR-0030 chooses no accounts, so
  there is nothing to pool; `trip_travel` needs an inner allocation with no basis and no data;
  `warehouse_overhead` needs an ADR moving it into COGS that nobody has written. Worth knowing for
  Unit 3: **one capture decision answers two questions** — recording what a leg moved and how far
  gives `trip_travel` its basis _and_ upgrades ADR-0031's official allocation from Horngren tier 4
  (`ability_to_bear`, an explicit proxy) to tier 1. Measured 2026-08-09: `products.shipping.weight`
  is present on 540 of 567 products and **non-zero on 0 of them** — re-measured 2026-08-16: 537 hold
  `null`, 3 hold 0, 27 lack the block. core#51 closed 2026-08-10 and made the four dimensions
  nullable, so "unmeasured" is now distinguishable from "weighs nothing" — which is what OQ-033's
  coverage precondition needs, and the owner expects **many** products populated by the time basis
  v2 is in dev.
- **#20** — needs the presence-vs-absence decision first; see Decisions.
- **#4** — ADR-0003 cites `formal/two-store-commit.tla`, which no longer exists (Quint, ADR-0016).
  ADR-0003 is `accepted` and immutable, so the fix is not an edit. The issue's own preferred option
  is right: **fold it into the m5 formal-methods ADR**, which has to supersede that clause anyway.
  Its detection note is worth acting on independently — a gate asserting that file paths cited by
  ADRs and spikes actually resolve would have caught all six stale `.tla` references at once, and is
  the same shape as gate 10n.

## Decisions

- **#18 fixed with a new field, not a status-aware gate 6.** The alternative still required
  `generate.ts` to learn to ignore `superseded_by` from a non-accepted superseder — more moving
  parts for the same guarantee. **Rejected:** gating only the acceptance transition; it would have
  left ADR-0036's promise as a front-matter comment with nothing behind it.
- **The `.feature` contradiction got a `HOT-`, per rule 5**, rather than being quietly amended.
  Resolution is `resolved_by: ADR-0025` — no new decision was taken, because ADR-0025 had already
  taken it and three of four artifacts already agreed.
- **Gate 10n was deliberately NOT widened to check applicability.** Every value in the refuted
  scenarios was legally declared, so 10n could never have caught HOT-015. The stronger check needs
  scenarios to name accounts (3 of 6 now do, after the amendment) **and** needs a decision 10n must
  not invent: REQ-LED-001 refuses ABSENCE and says nothing about PRESENCE. Filed as **#20**.
- **#17 is deferred, and it is not a judgement call.** OQ-039 is open with `decide_by: 2027-01-15`
  and `tax_profile` sits in `quarantine` in the field map; neither ADR-0032 nor ADR-0033 is
  `accepted`; and the issue records its own ordering gate — ADR-0020's dimension restatement must
  run **first** and prove no amount moved, because both cross the same closed periods (~90% behind
  the 2025-12-31 lock) and run together neither proof names a culprit. Starting now means
  hand-authoring 286 rows against a shape two un-accepted ADRs may still change. It stays open as
  the m6 exit criterion it already is.

## Context recommendation

**CLEAR CONTEXT.** Units 4-6 are executable from this doc plus `CLAUDE.md`, and they touch entirely
different material from Units 1-3 — a six-reference accounting survey, a Firestore-collection sweep,
a requirements-promotion backlog. **#14 in particular wants a fresh full window**, and it is the one
to take next: it completes m3 outright and m3 gates m4 and m7 → `spec-v1`.

One thing to carry across the clear, because it is not obvious from the issue text: **the "needs a
script rather than MCP paging" excuse is gone.** `spikes/harness/corpus.ts` pages any prod
collection read-only under ADC in a few lines, and Units 5 and 6 were both scoped assuming that was
expensive.
