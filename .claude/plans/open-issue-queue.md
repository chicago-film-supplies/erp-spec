# Clearing the erp-spec open issue queue

- **Date:** 2026-08-16
- **Repo:** erp-spec
- **Status:** ⏳ #16, #18 (PR #21) · #15, #13 (PR #23) · **#14 (PR #25) — `m3` COMPLETE** · plus PRs
  #26–#29 (gate 11, transfer field budget, labels, m6 inventory) · **8 issues open, 6 of them
  blocked on an owner decision**
- **Origin:** a review of the open issue queue, requested because #18 was on the owner's mind
- **Related:** open — #3, #4, #6, #8, #12, #17, #19, #20 · closed by this work: #13, #14, #15, #16,
  #18 · HOT-015 resolved · OQ-045 opened · api-cloudrun#538 filed ·
  `tools/{validate,dates,labels}.ts`, `spikes/harness/`,
  `ledger/{posting-rules,tigerbeetle-accounts}.yaml`, `migration/live-paths.measured.yaml`

## START HERE

`main` is CI-green at `68024e7`. **Units 1–4 are done and #8 is started.**

**The queue is now labelled, and the labels are the triage.** `blocked:owner-decision` marks what
nobody can pick up: **6 of 8**.

|               | Issue        | State                                                               |
| ------------- | ------------ | ------------------------------------------------------------------- |
| **startable** | **#8**       | ⏳ **IN PROGRESS** — instrument built, authoring left               |
| **startable** | **#6**       | not begun; its own numbers are stale, re-measure first              |
| blocked       | #19, #3, #20 | **ADR-0036 acceptance**                                             |
| blocked       | #17          | OQ-039 + ADR-0032/0033 acceptance, and an ordering gate             |
| blocked       | #12          | three undecided things, none of them work                           |
| blocked       | #4           | only the m5 formal-methods ADR remains — its detection half is DONE |

### The one thing that moves the most, and it is not work

**Accept or reject ADR-0036.** It resolves both open hotspots — one of m4's two remaining criteria —
and unblocks #19, #20 and the live half of #3. Everything measured on 2026-08-16 is folded into it
**while it is still `proposed`**, including three things it would otherwise have been accepted
without:

- its shared-key economy **saves one field, not two** — a path subsumes `source_document_ref` but
  cannot absorb `journal_entry_id`;
- **a path does not fit any TigerBeetle field** — depth 7, 178 bytes, 14,410 of 14,410 over a u128's
  16 — so line identity is a hash or a surrogate, and the cost is opacity, not collision;
- its precondition (`api-cloudrun#485`) is a **false green** — closed `NOT_PLANNED` with the
  divergence standing, and the divergence measures **59 lines, six times the reported 10**.

✅ Owner rulings recorded 2026-08-16: **"we can allow source order null"** (so absence is refused
and an explicit null is recorded — the rule the repo already runs on everywhere else) and **"we can
change order path to match invoice path in v1"** (filed as api-cloudrun#538).

### Two capabilities every remaining unit should use

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. It now also exposes `listCollections` and `pathScan`. **This retires "a full sweep
  needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is not a list of the collections.** It carries 35; there are **50**.
  Anything scoped from it is scoped short — #8 was.

⚠️ **This triage is the corrected one.** The first pass covered 6 of 11 open issues: the initial
`gh issue list` was piped through `head -60` and #13's comment bodies consumed the output, silently
truncating #12, #8, #6, #4 and #3. Anything citing "six open issues" predates the correction.

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

### Unit 4 — #14, procurement's posting rules (PR #25) — CLOSED, and m3 with it

`m3` reads **4 met / 0 unmet / 0 prose**. `unwritten:` is empty; 13 rules specified, 2 blocked, 53
vectors. The issue's "not urgent and nothing is blocked" was wrong at the roadmap level, as
predicted — one bucket entry held two exit criteria red.

**The survey found the criterion is `matched` versus `estimated`, not goods versus services**, and
that one fact decided both rules. A matched accrual goes to a **clearing** account relieved by the
bill (SAP GR/IR, NetSuite `Accrued Purchases`, Odoo `Stock Interim (Received)`, Intacct's
advanced-workflow accrual); an estimated one goes to an accrued-expenses account relieved by a dated
**auto-reversal** — Xero's model, and the textbook one. Every accrual v2 produces carries an amount
from a source document, so **one** account was minted
(`2010 Accrued Expenses: Received Not
Invoiced`) and **none** for the estimated flavour, because no
v2 event produces one.

- ⚠️ **It was not a pure addition, and the correction is bigger than the addition.**
  `shift_recorded` and `asset_acquired` both credited 2000 AP — wrong on the shift and acquisition
  dates, because the vendor has not invoiced. Until 2010 existed **every shift in the ledger
  overstated trade payables by its own cost.** Five existing golden vectors moved with them.
- **Two schema defects surfaced only by writing the rules**, neither visible from the issue text:
  `EVT-PRO-002` carried no `debit_account` and no `product_line`, so it **could not have produced a
  legal transfer**; and `EVT-PRO-003`'s singular `obligation_id` could not express an EOR invoice
  covering a fortnight of shifts. It is now `reclassifications[]` + `direct_lines[]`, making this
  the **third** rule whose entry spans source documents — more evidence for #3.
- **The goods number will mislead whoever measures it first.** Prod holds 74 `type: purchase`
  movements, 15 costed, **$18,117.52** total, 60% of it one pallet buy. The population that makes
  2010 material is **labour**, which measures as zero everywhere because the current system has
  never had the stage.
- **The migration delta is unmeasurable from this repo's permitted sources**, and that is recorded
  as the finding rather than skipped: vendor bills are Xero ACCPAY documents, none are mirrored into
  Firestore, and this repo does not call the Xero API. What would measure it is named in the survey.
- Opened **OQ-045** — a bill for LESS than was accrued leaves a residual nothing retires. A bill for
  MORE is decided (the excess is an ordinary direct line, and **no variance account was minted** —
  2600 Rounding was dropped on the same reasoning), and a partial bill is normal, not an error.

### Also landed 2026-08-16, outside the units (PRs #26–#29)

- **Gate 11 widened** to `contexts/`, `ledger/`, `reporting/`, `migration/`, `roadmap/` (it scanned
  only `adr/` + `spikes/`). Green on 189 files, fired red twice first. ⚠️ `inbox/` and
  `research-drop/` stay OUT: they are append-only, so a citation gone stale there has no legal fix
  but an exemption, and that allowlist would grow forever. **This closes the detection half of #4.**
- **erp-spec#3's arithmetic settled** — `Transfer.code` is a fourth discretionary field; both
  candidate evictions are closed and neither frees a slot; the query surface is measured. **#3 stays
  open**: one spare u16, **three contenders** (dimensions, the actor ref, the causal order), decided
  on entirely different grounds and therefore not tradeable on capacity.
- **The actor ref** is recorded as a claimant. It passes ADR-0036's own criterion — an actor is a
  KEY, an immutable fact about an event, not a mutable master attribute. Cardinality is not the
  constraint (166 actors, u16 has 65k); **encoding is** — uids are strings, so it needs a registry
  or a hash.
- **Issue labels, derived not typed** (`deno task labels`): contexts from `CONTEXT_CODE_OF`, areas
  from the spec directories, plus the single state label. A hand-typed set would have been another
  hand-maintained list of the domains.
- **`tools/dates.ts`** — the calendar-day reduction had **six** copies. UTC, deliberately, for
  machine-independence; **not date-fns**, because `tools/` has zero npm deps by design and the
  workspace's date-fns rule governs _business datetimes in Firestore_, not tool stamps.

### ⚠️ The pattern behind three of those, now a rule in `CLAUDE.md`

**A fact about a third-party API has ONE owner in the structured spec, and something executes
against the API.** `research-drop/reference/tigerbeetle.md` claimed `user_data_128/64/32` were "the
**only**" per-transfer reference fields — an exhaustiveness claim about someone else's software,
unfalsifiable in-repo — and it propagated into #3's title, HOT-013 and ADR-0026. `Transfer.code` had
to be re-discovered **twice**.

Two halves, and the second was the missing one: **one owner** (`ledger/tigerbeetle-accounts.yaml`;
the reference note now points rather than restates) and **something executes**
(`spikes/harness/tb-field-budget_test.ts`, fails closed, `deno task tb-budget`).

⚠️ **A consolidation without a gate is not a fix** — `view.ts` held a stale copy of the context
registry _after_ erp-spec#10 consolidated four of them, and held a stale copy of the date helper
today, both because **it runs no gate and so can never go red**.

⚠️ **Not all restatement is scatter.** An `adr/` or `inbox/` file repeating an old number is a
historical record (ADR-0034) or dated evidence. Only live, mutable, authority-claiming copies count
— there were three, not the 17 a grep suggests.

## Remaining

### Unit 5 — #8, the m6 field map — ⏳ IN PROGRESS, instrument built, authoring left

**PR #29 landed the instrument. Nothing is authored yet.** Pick up here.

⚠️ **The issue's scope is wrong and it is wrong in the expensive direction.** It says "~10 mappings
against ~30 Firestore collections". Measured 2026-08-16 (`migration/live-paths.measured.yaml`): **50
collections, 1,537 paths.** The "~30" came from the MCP `db_schema` enum, which carries 35 and omits
`credit-notes` and `settlements` — both of which the field map already maps.

✅ **The five-minute fix is already done.** `invoices.query_by_orders` no longer reads
`disposition: defective` on the strength of OQ-013's non-reproducing 55; it is `map`, with the
handling rule retained on its own merits.

✅ **m6's first exit criterion is now checkable, which it was not.** `roadmap/milestones.yaml`
marked it `prose_only: true` because _"a checker would compare the map against itself and always
pass"_ — correct, and this repo's own first rule. `spikes/harness/live-path-inventory-probe.ts`
writes the inventory from `db.listCollections()` + an unprojected scan; the checker reads the
written file. The same shape as `tb-field-budget_test.ts` against `tigerbeetle-node`. **Refresh with
`cd spikes/harness && deno task inventory --write`.**

**What is left, in order:**

1. **Per-collection dispositions for the 50.** A path-by-path map of 1,537 rows is neither tractable
   nor useful; the shape is a collection-level disposition plus per-path exceptions, which is what
   the file already does for `*.{_cents fields}`. Many are obviously infrastructure and drop as a
   unit — `sessions` (2,318), `stock-locks`, `mcp-oauth-*`, `migration-state`, `trello-lookup`,
   `uploadcare-sweep`, `webhooks`, `xero-budget`, `counters`, `typesense`,
   `current-replacement-lookup`, `cache-geocodes`. ⚠️ `customers` (150 docs) is NOT `contacts` and
   NOT `organizations` — check what it is before disposing of it.
2. **Wire m6's criterion to a real check** in `tools/milestone-checks.ts`, reading the inventory and
   the field map. It will report a low number and that is fine — gate 12 does not fail on an unmet
   criterion, only on one wired to nothing, so CI stays green while STATUS tells the truth.
3. **A `validate` gate** for internal consistency: every collection the map names must exist in the
   inventory, and the inventory's `measured_at_utc` earns a staleness _warning_ (validate reads the
   clock; generated files may not).
4. **The live→target GL account correspondence**, which belongs here and exists nowhere —
   `ledger/chart-of-accounts.yaml` deliberately carries no `xero_id` (ADR-0009). ⚠️ Its **138**
   entries include **four minted accounts with no live counterpart at all** (5800, 5801, 2050, 2010)
   — a distinct case the map must state rather than leave blank.

⚠️ Same milestone as **#17**, which is blocked. #8 does not depend on it and must not wait for it.

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
  ✅ **Its detection note is DONE and the plan was stale on this** — gate 11
  (`repo paths cited in
  prose resolve`) already existed, built for #4, with the ADR-0003 citation
  carried as a self-expiring exemption that fails if the path ever comes back. **Widened
  2026-08-16** from `adr/` + `spikes/` to `contexts/`, `ledger/`, `reporting/`, `migration/` and
  `roadmap/` as well; it landed green (0 unresolved citations in 189 files) and was fired red twice
  first. `inbox/` and `research-drop/` stay out on purpose: they are append-only, so a citation gone
  stale there has no legal fix but an exemption, and that allowlist would grow forever. **What
  remains on #4 is only the ADR**, not the detection.

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

**CLEAR CONTEXT.** The remaining work is authoring, and it touches entirely different material from
what the last session held — 50 collections' worth of migration dispositions and a requirements
backlog, against TigerBeetle field budgets, path widths and date helpers. Nothing needed is in
anyone's head: the inventory, the field map, `milestone-checks.ts` and this doc are all on disk.

**Take #8.** It is one of two unblocked issues, the instrument is built, and step 1 is the bulk.
Then #6 — but **re-measure first**: its own numbers say "2 requirements, 6 of 8 contexts empty" and
STATUS says 21 requirements, 0 without a scenario, 4 contexts uncovered.

Three things to carry across the clear, because none is obvious from the issue text:

- **The `db_schema` enum is not the collection list** — 35 against 50. #8 was scoped from it and is
  therefore scoped short. Anything else scoped that way is too.
- **A gate that lands green is still worth landing, but fire it red first.** Every check added this
  week landed green on real data and was fired red deliberately before landing; that is the only
  evidence a green gate is a gate.
- **The queue's real shape is 6 blocked / 2 startable**, and the labels say so now. Do not re-triage
  from issue text — several issues carry numbers that are stale in their own favour.
