# Clearing the erp-spec open issue queue

- **Date:** 2026-08-16
- **Repo:** erp-spec
- **Status:** ⏳ #16, #18 (PR #21) · #15, #13 (PR #23) · **#14 (PR #25) — `m3` COMPLETE** · PRs
  #26–#29 · **PR #30 — five ADRs ACCEPTED** · **PR #31 — #19 + #20 + four owner rulings** · **PR #34
  MERGED — #8 CLOSED, `m6` measured for the first time** · **PR #33 MERGED — ADR-0030 surveyed, ten
  owner rulings, and ACCEPTED** · main green, nothing open
- **Origin:** a review of the open issue queue, requested because #18 was on the owner's mind
- **Related:** open — #3, #4, #6, #12, #17, **#32** · closed by this work: **#8**, #13, #14, #15,
  #16, #18, #19, #20 · HOT-015 resolved · OQ-045 opened; **OQ-046/047 opened AND answered, OQ-048
  and OQ-049 opened** · api-cloudrun#538 filed ·
  `tools/{validate,dates,labels,milestone-checks}.ts`, `spikes/harness/`,
  `ledger/{posting-rules,tigerbeetle-accounts,dimensions,chart-of-accounts}.yaml`,
  `migration/{field-map,live-paths.measured,live-chart.measured}.yaml`

## START HERE

`main` is CI-green and **nothing is open**. Units 1–8 done, both PRs merged 2026-08-16.

⚠️ **GitHub Actions went billing-blocked at 04:46Z** — "recent account payments have failed or your
spending limit needs to be increased", org-wide, four minutes after the last green run. PR #33 was
admin-merged on the owner's instruction after `validate`, `fmt --check` and `gen` were run locally
(the exact three things CI runs). **A push producing a FAILED run in 2s is a billing block, not a
code failure** — check billing before debugging. Distinct from the recorded case where a push
produces NO run at all, which is an Actions outage.

### ⚠️ ADR-0030 WAS NOT A ONE-OFF — seven of ten proposed ADRs cite no survey

Checked systematically after ADR-0030 turned out to be blocked by a missing survey rather than by
the owner. **Rule 8a is stated in `CLAUDE.md` and nothing executes it**, so the backlog was
invisible:

| ADR                                               | contexts                     | survey                                                  |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| **ADR-0019** labor costing is actual              | ledger, fulfillment          | **none** — surveyed 2026-08-17                          |
| **ADR-0020** Xero history is restated             | ledger, billing              | **none**                                                |
| **ADR-0025** dimension obligation per account     | ledger, billing              | **none**                                                |
| **ADR-0029** the ledger records unallocated facts | ledger, billing, fulfillment | **none**                                                |
| ADR-0015 reservations as pending transfers        | availability, fulfillment    | none                                                    |
| ADR-0027 / ADR-0028                               | —                            | none, and **not accounting-shaped** — 8a does not apply |
| ADR-0031 / ADR-0032 / ADR-0033                    |                              | ✓ 1 / 3 / 2                                             |

⇒ **The systematic fix is a gate**: an accounting-shaped ADR cannot reach `accepted` without citing
a survey, fired at acceptance so drafting stays free (mirroring gate 14's freeze). Not built yet.

### The queue: 7 open — 5 blocked, 2 startable

|               | Issue   | State                                                          |
| ------------- | ------- | -------------------------------------------------------------- |
| **startable** | **#35** | ⚠️ NEW — PSA is a whole service line with no spec at all       |
| **startable** | **#6**  | re-measure first — its own numbers are stale in its own favour |
| blocked       | #32     | the imputed-labor view — needs OQ-048, the imputed rate        |
| blocked       | #17     | OQ-039 + ADR-0032/0033 acceptance, and an ordering gate        |
| blocked       | #12     | ✅ ADR-0030 ACCEPTED — **two blockers left, not three**        |
| blocked       | #4      | only the m5 formal-methods ADR remains — detection DONE        |
| blocked       | #3      | the spare u16: three contenders, decided on other grounds      |

### What is still the owner's

- **ADR-0032 + ADR-0033 + OQ-039** → unblocks #17.
- **The trip-grouping decision and a warehouse-overhead ADR** → the two blockers left on #12. ⚠️
  ADR-0030 is off that list — ACCEPTED, `deferred_pools.vehicle_cogs` removed, and `delivery` /
  `transport` / `trash_cleanup` now declare `vehicle_accounts: [5900, 5901, 5902]`. ⚠️ **The
  "leg-capture" framing was wrong** and both this doc and #12 carried it: distance is derivable from
  Mapbox coordinates today. What `trip_travel` actually needs is **which orders shared a run**,
  which distance cannot supply.
- **Who gets `Transfer.code`** → #3's live half. Two contenders are fully worked: the actor ref, and
  the causal order on the 2.97% of invoices where `path[0]` cannot supply it.
- **OQ-048** — what rate to impute for a contributed owner shift. The GAAP decision does not wait on
  it; the imputed report (#32) does.
- **OQ-049 — NEW.** Does v2 carry the operational board and the comment threads? 5,315 documents
  across `cards`/`lists`/`threads`/`comments` turn on the charter naming neither them nor their
  absence. Held as `quarantine` in the field map meanwhile.
- **11 ADRs remain proposed.** ⚠️ **ADR-0025 is now safe to consider** — #19 has landed, so the
  ground ADR-0036 moved under it has been rewritten. It is still cited 48× and is now a historical
  record of a rule that no longer applies; accepting it would freeze that, which is correct under
  ADR-0034 but worth doing deliberately.

### Two capabilities every remaining unit should use

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. **This retires "a full sweep needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is not a list of the collections.** It carries 35; there are **50**.
  Anything scoped from it is scoped short — #8 was.

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
  labor, not the deck. That retraction inferred a category from a product NAME and read neither
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
  2010 material is **labor**, which measures as zero everywhere because the current system has never
  had the stage.
- **The migration delta is unmeasurable from this repo's permitted sources**, and that is recorded
  as the finding rather than skipped: vendor bills are Xero ACCPAY documents, none are mirrored into
  Firestore, and this repo does not call the Xero API. What would measure it is named in the survey.
- Opened **OQ-045** — a bill for LESS than was accrued leaves a residual nothing retires. A bill for
  MORE is decided (the excess is an ordinary direct line, and **no variance account was minted** —
  2600 Rounding was dropped on the same reasoning), and a partial bill is normal, not an error.

### Unit 6 — #19 with #20 folded in, the keys-not-classifications sweep (PR #31) — BOTH CLOSED

ADR-0036's mechanical follow-up. **61 files, 12 gate arms fired red, 0 failures at land.**

**The authority moved rather than disappearing, and that is the whole shape of it.** The chart's
per-account `dimensions:` lists said WHICH postings owed a dimension; `ledger/posting-rules.yaml`
now says which KEYS a posting owes, because that is a property of what happened rather than of where
it landed. `ledger/dimensions.yaml` became a reporting taxonomy.

- **`dimensions:` was DELETED from all 139 chart entries, not emptied to `[]`**, and gate 10a is
  inverted to fail on one. ⚠️ ADR-0036's own text says `[]`; its next bullet says "obsoleted in
  their current form", and a key that can only hold `[]` is a key someone refills. Stated in the
  chart header so the reading is auditable.
- **`ledger/dimensions.yaml` did NOT move to `reporting/`**, which #19 proposed. Four IMMUTABLE ADRs
  cite the path in backticks (0020, 0025, 0035, 0036) and gate 11 checks citations resolve, so a
  move buys four PERMANENT exemptions. **Refused on measured cost.**
- **REQ-LED-001 restated, not deleted.** Absence-versus-null moved to `causal_orders`; `[]` is
  refused as `""` was; an explicit null is legal (30 legacy CRMS invoices, 87 lines, $87,839.76).
- **#20 delivered in its surviving form** — the applicability check joins scenarios to the posting
  RULE, not to the chart's deleted lists. Its "genuinely undecided" blocker was already stale.

⚠️ **Four things were found by FIRING the gates, none by reading**, and that is the transferable
part:

- **`invoice_issued`'s tax posting declared no `invoice` key while every vector's tax transfer
  carried one.** The union arm could not see it, so rule and vectors disagreed with every gate
  green. Only removing the key from a transfer — expecting a failure that did not come — exposed it.
- **The empty-string arm double-reported the empty-LIST case** (`String([]) === ""`). Two messages
  for one defect is how a gate teaches the wrong lesson at 2am.
- **10n's account arm matched nothing.** The only scenario naming accounts is a Scenario Outline
  whose `Given` says `<account>`; every real code lives in the Examples table, which is not a step.
  **A check that reads green while matching nothing is indistinguishable from one that passes.**
- **m3's "Dimensions defined … and their DECLARATION RULE" was never checked on the second half.**
  The check counted value sets and stopped. It now also verifies every specified rule declares
  `causal_orders`; m3 stays 4 met.

Also: **gate 11 widened to the repo-root files** — 114 citations there, 2 dead, both created by this
sweep's own rename. And the chart header said "138 entries, four minted"; it is **139 and five**,
wrong since 5150 was added, because nothing counts those numbers.

**Opened OQ-046 — nothing exercises `labor_line`.** Under ADR-0025 `cost_type` had exactly one
consumer, a golden vector whose own derivation said so; this sweep repurposed it. Seven declared
values now have nothing that can go red on them, which is this repo's own definition of a claim. ⚠️
`product_line` is not in the same position — gate 13 fails when a value is unclassified in
`reporting/product-line-pl.yaml`.

### Unit 7 — four owner rulings, taken and implemented the same day (PR #31)

Landed on top of the sweep, in the order they were given.

**1. `labor_line` is the allocation pool's COST SELECTOR** — "the p&l by product line will
distribute labor costs with labor_line delivery across product lines, the same mechanism will allow
other combos for future reporting." A report here is **(cost selector) → spread over (base) by
(basis)**; other combos are configuration, not machinery. ⚠️ The generality stays in the machinery:
ADR-0029's "exactly ONE official allocation" is what says which number is managed.

⚠️ **It exposed a defect this very sweep had carried forward.** The `transport` pool selected
`labor_line: delivery` — correct when the enum had three values and trucking labor had nowhere else
to point, wrong from the moment it had seven. Built as written, a long-haul crew-day would have
spread across goods lines while Transport reported a ~100% margin. **Renaming `cost_type` →
`labor_line` in a sentence does not re-read what the sentence claims.**

**2. "counter and warehouse can bill goods too (just like delivery does)"** — both absorb against a
causal job, so both are joint costs of that order's goods and neither is severable.
`kind: cost_only` is a second pool shape (cost, no revenue), and **it must be `allocated`**: a cost
pool that does not spread reaches no report at all. ✅ Coverage became TOTAL, and structurally so —
`labor_line` is read off the ABSORBED allocation row, and unabsorbed hours have no allocation row
and therefore no value at all. The two-branch `billable`/`bills_nobody` map written hours earlier
was **deleted**: a branch with no members is a claim, not a capability.

**3 + 4. The unpaid owner shift — surveyed, then decided.** "a line in the labor pos or bills that
allows for an owner shift unpaid or paid, so that unpaid owner shifts dont dilute cogs", then "stick
with gaap, and your rec". ⚠️ **The six-reference survey did NOT come back unanimous, and the split
was the useful part**: GAAP, Xero, SAP and Odoo keep uncompensated labor out of the statements;
NetSuite and Intacct post it but fence the offset. **The unanimous part is the credit side — nobody
credits a payable**, which is exactly the defect (2010 Received Not Invoiced, for a bill that never
arrives). ⇒ `EVT-FUL-002` gains `compensation: paid | contributed`; a contributed shift writes **no
transfer**, and needs no conditional because a zero-amount posting is already never written.

⚠️ **`3130 Owner's Capital: Owner's Billable Time` sat at `drop` on a reason that read it as the
DEBIT side when it is the CREDIT side.** The disposition was right and the reasoning was not, so
nothing could have caught it — it took the owner asking a question the account already answered. **A
correct conclusion reached by wrong reasoning is not a checked conclusion**, and that is the second
instance of the same lesson in one session.

**New gates, all fired red:** 13h (every `labor_line` selected by exactly one pool), 13d's
`cost_only` arms. **New issue #32** — the imputed-labor view, `required: true, official: false`,
blocked on OQ-048.

### Unit 8 — #8, the m6 field map (PR #34) — CLOSED, and `m6` is measured for the first time

**`m6` went from `0 met / 0 unmet / 4 prose` to `1 met / 0 unmet / 3 prose`.** It was the only
milestone about which nothing was being asked at all, and m7 depends on it.

**Step 2 was done FIRST, on purpose.** The criterion was wired before anything was authored, so it
landed reporting `0 of 1537 live paths dispositioned across 0 of 50 collections` and the authoring
was measured as it went. Gate 12 fails on a criterion wired to nothing, never on an unmet one.

⚠️ **`met` would have OVERCLAIMED, and catching that is the most transferable thing in the unit.**
The criterion says a path maps _to a new field_; a collection-level `paths_default: map` says only
that it maps. Without a named target the criterion would have gone met the moment 50 dispositions
were typed — **a check reading green while asserting nothing**, the exact defect class this repo
keeps paying for. Gate 15 now refuses a `map` that names no `paths_default_to`.

**Gate 15 landed RED on the map as it stood, and both failures were real:**

- `invoices.query_by_orders` — the measured path is `query_by_orders[]`.
- ⚠️ **`destinations[].customer_collecting` named the wrong object.** The top-level `destinations`
  collection (459 docs) is an ADDRESS BOOK and has no such field; it lives on
  `orders.destinations[]`. **Two things share a name**, and a migration reading the collection would
  have found the field missing and concluded it was unpopulated.

**Three findings from reading the corpus rather than the issue:**

- ⚠️ **`customers` (150 docs) is DEAD** — a CRMS-shaped mirror superseded by `contacts` +
  `organizations`, in no source file, no security rule, no index
  (`code:2026-08-16:api-cloudrun@2ff1e8c2`). The plan's own "check what it is first" was right.
- ⚠️ **`config` is the OAuth TOKEN STORE**, not application config — `access_token`,
  `refresh_token`. It must never be read into a migration artifact.
- ⚠️ **`settlements` (1,073 docs) is cash application AND is the "credit-note allocations" the map
  already named as a separate object.** One collection, two names. Also one of the two the
  `db_schema` enum omits.

⚠️ **The probe's own dynamic-key collapse was defective, and wiring the criterion is what found
it.** It decided per DOCUMENT while unioning paths per COLLECTION, so a `tracking-categories` record
whose `products` map held two entries kept its literal uids while one holding three contributed
`<key>` — both readings of one map in one inventory. **31 of 1,537 "paths" were doc ids.** Fixed
with a whole-collection pre-pass; re-measured **1,537 → 1,523**. ⚠️ **The probe's header already
claimed to have fixed this at larger scale** ("1,123 paths across 20 documents") — the fix was
incomplete and nothing could see it, **because the collapse reported what it collapsed and never
looked at what it left behind.** It now names the leftovers, and that reporter's first run returned
four false positives (`recurrence_overrides`, `crms_opportunity_ids`, `crms_stock_level_ids`,
`last_message_preview` — every one exactly 20 characters), so the accusation was narrowed to what a
Firestore auto-id actually looks like.

✅ **Step 4's premise was wrong and the correction is better than the task.** The issue says the
live→target GL correspondence "belongs here and exists nowhere". **It exists — it is
`ledger/chart-of-accounts.yaml`** — and it is exact: 139 spec entries against 134 live + 5 minted, 0
live codes missing, 0 `status_live` disagreements, 0 name disagreements. **What was missing is an
EXECUTION.** Gate 16 + `spikes/harness/live-chart-probe.ts` now check every live code is
adopted/merged/dropped and never omitted, every `status_live` against the live `status`, every `new`
genuinely absent and never on an occupied code, and `139 == 134 + 5` as arithmetic — the header that
read "138 entries, four minted" was wrong in both halves for weeks because nothing counted it.

**Opened OQ-049** — the board and the threads, 5,315 documents, on a charter silence. ⚠️
`quarantine` IS one of the three dispositions the criterion accepts, so those four count as settled
for the milestone and remain unsettled for the migration. **Do not read `quarantine` as `mapped`.**

Every arm fired red before landing: gate 15 on a phantom collection, a bad path, a target-less
`map`, a missing reason and a stale measurement; gate 16 on an omitted live account, a false
`status_live`, a rename under `adopt`, a mint onto an occupied code; the milestone check on both a
missing collection and a survivor naming no default.

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

### Unit 9 — #6, the requirements promotion backlog

⚠️ **The issue's numbers are badly stale and nobody updated them.** It says "2 requirements total"
and "6 of 8 contexts have `requirements: []`". `STATUS.generated.md` today reports **21
requirements**, 0 without a scenario, and 4 contexts uncovered (`ordering`, `availability`,
`banking`, `procurement`). 19 were promoted on 2026-08-16. **Re-measure before planning it** — this
is the largest remaining structural gap and it blocks m7, but it is roughly half the size the issue
claims.

The trap the issue names is still live: **adding a requirement trips gate 3**, which demands a
tagged Gherkin scenario. Promotion is requirement + scenario, never requirement alone. And as of
this session those scenarios are also checked by gate 10n.

## ✅ ADR-0036 — ACCEPTED 2026-08-16. What it settled, and what it did not

The section that used to sit here said accepting it was "one owner action that moves four things".
It moved them. Kept because the _consequences_ are what the next session works from.

**Accepted after being amended on measurements taken the same day** — three things it would
otherwise have been accepted without, all now frozen into its body:

- its shared-key economy **saves one field, not two** — a path subsumes `source_document_ref` but
  cannot absorb `journal_entry_id` (3 of 13 rules span source documents);
- **a path does not fit any TigerBeetle field** — depth 7, 178 bytes, 14,410 of 14,410 over a u128's
  16 — so line identity is a hash or a surrogate. Collision is not the risk (~1e-11 on 64 bits);
  **opacity is**;
- its precondition (`api-cloudrun#485`) was a **false green** — closed `NOT_PLANNED` with the
  divergence standing, measuring **59 lines against the reported 10**.

**HOT-013 DISSOLVED** — the claimants were removed, not accommodated. ⚠️ Not for want of a slot:
`Transfer.code` is a fourth discretionary field and the payload is 7 bits of 16. It is declined on
ADR-0036's criterion, not on capacity. **HOT-014 ABSORBED** — the gap was real and ADR-0036 makes it
a decision.

⚠️ **First real use of `supersedes_on_acceptance`** (Unit 1 / #18). All three gate-6 arms were fired
against the real ADRs and reverted: the promise left on an accepted ADR, `superseded_by` without the
matching status, and the promise promoted without telling the target. Three fields move together and
no half can be forgotten — now evidenced rather than claimed.

✅ Owner rulings the same day: **"we can allow source order null"** (absence refused, explicit null
recorded — the rule the repo already runs on) and **"we can change order path to match invoice path
in v1"** (api-cloudrun#538).

## Not startable — leave open

- **#17** — see Decisions.
- **#12**, the three deferred allocation pools (`vehicle_cogs`, `trip_travel`,
  `warehouse_overhead`). ⚠️ **Two blockers now, not three — ADR-0030 is prepared and names its
  accounts (PR #33), so `vehicle_cogs` is one acceptance away.** `trip_travel` needs an inner
  allocation with no basis and no data; `warehouse_overhead` needs an ADR moving it into COGS that
  nobody has written. Worth knowing for Unit 3: **one capture decision answers two questions** —
  recording what a leg moved and how far gives `trip_travel` its basis _and_ upgrades ADR-0031's
  official allocation from Horngren tier 4 (`ability_to_bear`, an explicit proxy) to tier 1.
  Measured 2026-08-09: `products.shipping.weight` is present on 540 of 567 products and **non-zero
  on 0 of them** — re-measured 2026-08-16: 537 hold `null`, 3 hold 0, 27 lack the block. core#51
  closed 2026-08-10 and made the four dimensions nullable, so "unmeasured" is now distinguishable
  from "weighs nothing" — which is what OQ-033's coverage precondition needs, and the owner expects
  **many** products populated by the time basis v2 is in dev.
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
  not invent: REQ-LED-001 refuses ABSENCE and says nothing about PRESENCE. Filed as **#20**. ⚠️
  **Both halves are now settled and neither the way #20 expected.** The presence question was never
  open — gate 10h had refused an unowed dimension all along. And the check #20 designed could not be
  built as designed, because ADR-0036 deleted its join target; it landed as gate 10p against the
  posting RULE, and REQ-LED-001's text now says what the gate does.
- **#17 is deferred, and it is not a judgement call.** OQ-039 is open with `decide_by: 2027-01-15`
  and `tax_profile` sits in `quarantine` in the field map; neither ADR-0032 nor ADR-0033 is
  `accepted`; and the issue records its own ordering gate — ADR-0020's dimension restatement must
  run **first** and prove no amount moved, because both cross the same closed periods (~90% behind
  the 2025-12-31 lock) and run together neither proof names a culprit. Starting now means
  hand-authoring 286 rows against a shape two un-accepted ADRs may still change. It stays open as
  the m6 exit criterion it already is.

## ✅ ADR-0030 — ACCEPTED 2026-08-16 (PR #33), after the survey it never had

The previous revision of this doc said to "spend ~30 minutes preparing ADR-0030 for a decision".
That was done, and it took longer than 30 minutes for a reason worth recording.

⚠️ **What was blocking it was not the owner's time. It carried NO SURVEY.** CLAUDE.md rule 8a
requires six references before any accounting-shaped decision, and ADR-0030 — drafted 2026-08-09,
the same day the standing instruction was given — had none. **That is what made it undecidable
rather than merely undecided**, and no amount of availability substitutes for it.

**The survey splits 4–2 on the classification and is UNANIMOUS on the mechanism, and the mechanism
is the half the ADR got wrong.** All five references with an allocation engine keep the NATURAL
account (what was bought) separate from the FUNCTIONAL classification (why it was consumed) and
derive the second by allocation — SAP by assessment through a secondary cost element, Intacct off a
source balance, NetSuite through a substituted contra, Odoo through analytic distribution that never
touches the account. **The sixth is Xero, which recodes at entry because it has no allocation
engine** — and ADR-0030's first draft followed Xero's workaround.

⇒ **The criterion is not "is it a vehicle". It is: does the cost arrive already attributed to a
causal job?** A shift names its job the moment it happens, which is why `shift_recorded` debits 5800
per `shift.absorbed_allocations` and is finished. **A tank of diesel names none**, and a
registration fee names none even in principle.

**Three findings, and the first is decisive rather than a preference:**

- ⚠️ **The draft's two halves could not both hold.** It said 6400–6404 "stop taking new postings"
  _and_ that cost splits absorbed/unabsorbed. A posting made at the pump must choose one, where no
  causal job is known — so everything lands unabsorbed, 5900 is never debited, and the gap is
  identically the whole cost. The split needs a pool in between, and a pool is a natural account.
- ⚠️ **Absorbing at a rate reintroduces the rate variance ADR-0019 dropped.** Vehicle cost cannot be
  costed at actual — a van-day's real cost is unknowable until a transmission fails. So it is a
  predetermined rate on a normal-capacity denominator (ASC 330-10-30-3), and the unabsorbed balance
  is utilisation **and** rate deviation. **ADR-0019's headline sentence is true of 5801 and false
  here.**
- ⚠️ **Deferring depreciation has a PRESENTATION consequence** (SAB Topic 11.B): a cost-of-sales
  line excluding the related depreciation must be labelled and should not carry an unqualified gross
  margin — which is what the product-line P&L reports.

**Accounts named rather than deferred: `5900` absorbed, `5901` unabsorbed, plus a `6405` contra.**
Measured — the live `Direct Costs` block is exactly nine accounts, so 5900 is the next free hundred
on 5800's own recorded reasoning.

⚠️ **Two measurements, and the one that sizes the decision cannot be taken from this repo.** The
five live accounts are NOT one block (6401 is Xero type `Overhead`, the other four `Expense`), and
**`$21,844.77` carries no `source:` anywhere** — `chart-of-accounts` mirrors into Firestore without
balances and this repo does not call Xero. What would measure it is named in the survey.

**The delta is a COMPARABILITY BREAK, not a movement of money.** Net profit unchanged, gross profit
falls, history deliberately not restated ⇒ gross margin is not comparable across the cutover. A
third restatement axis beside ADR-0020 and ADR-0032, and the only prospective-only one, so it does
**not** join m6's ordering obligation.

### ⚠️ Then the owner ruled, and THREE of the seven rulings changed the ADR rather than confirming it

- **The two owned vehicles are used EXCLUSIVELY for delivery and trash removal.** That removes the
  classification question rather than answering it — and it settles classification and NOT the
  basis, which is the conflation that produced the broken first draft.
- ⚠️ **A SIXTH stream of vehicle cost the ADR never saw: RENTED trucks**, in
  `6302 Rented Tools,
  Machinery, Equipment`. **6302's own note already excluded them** — "the
  distinction is whether an order caused it" — and nobody had read it that way. ⇒
  `6405 Vehicle: Rented`, and `$21,844.77` is **understated**, not merely unpinned.
- ⚠️ **"Align with the labor strategy", and the alignment is LITERAL.** The recommendation at that
  point was the simple option, because absorption needs a basis that did not exist. **The ruling
  sent it back and was right**: a delivery job already generates a shift carrying hours, a causal
  job and a `labor_line`, so vehicle cost absorbs on THE SAME ALLOCATION ROWS — no new event, no new
  document, no new key — and the Delivery / Trash split comes for free.
- ⚠️ **The basis is computed Mapbox distance, which retired a blocker asserted twice and never
  checked.** This doc AND #12 both recorded vehicle absorption as waiting on leg capture because
  "mileage is not captured". True, and it is **derivable** —
  `destinations.address.address_coordinates` already holds it. ⇒ **It does not unblock
  `trip_travel`**: distance says how far a destination is, not which orders shared a van.
- ⚠️ **The geocodes are wrong in a way that looks right**, and the discriminator is already stored:
  every bad one carries `urn:mbxadr-itp:` (Mapbox's INTERPOLATED fallback) where correct rows carry
  `urn:mbxadr:`. One-way — it screens, it does not decide. Owner: record in the spec, no v1 issue,
  because destinations move to manager's autofill at cutover. **The gate ships anyway.**

**Four accounts minted** — 5900/5901, 6405, and the 6409 contra without which the split cannot be
computed. Chart header 139 → 143 entries, 5 → 9 minted, every count re-derived from the file.

⚠️ **What does NOT carry over from labor is ADR-0019's headline sentence.** "Absorption measures
utilisation, not rate variance" holds because labor is costed at ACTUAL. A van has no actual per-job
cost, so 5901 is utilisation AND rate deviation, and naming the normal-capacity denominator is a
requirement rather than a footnote.

**Still not decided in this ADR, on purpose:** vehicle depreciation (SPIKE-005's engine), and
`trip_travel`'s trip grouping.

### ⚠️ Then three MORE rulings arrived, and one reversed a recommendation of mine

- ⚠️ **6302 keeps a live population.** The rented-truck correction was written as though 6405
  received everything 6302 takes. It does not — a scissor lift hired for the warehouse move is CFS's
  own use. **One population moving out is not the account becoming empty**, which is the inverse of
  "a branch with no members is a claim" and is easier to get wrong, because deleting a branch feels
  like simplification.
- ⚠️ **Hired trucks post DIRECT to COGS at actual (5902), not pooled — reversing MY
  recommendation.** Pooling was recommended because "one mechanism is simpler to specify", **which
  is not the criterion the survey established**. `bill.direct_lines[]` already carries a
  `debit_account` AND `causal_orders`, so there was no second mechanism to avoid. `6405` was never
  created.
- ⚠️ **5200 Subcontractors is NOT a CFS labor account — and its own note said it was**, calling 5800
  and 5200 "the two labor populations". A subcontractor is a PURCHASE from another company. The
  replacement axis is stronger: **bought in versus owned**, which is what 5200 and 5902 share.
- **"labor" has no u** — swept across the refactorable spec, two file renames, and **gate 17**
  enforces it with three lifecycle exemptions. ⚠️ Gate 11 caught all twelve inbox-path citations the
  sweep broke, which is how the third exemption was found.

**ACCEPTED, frozen (gate 14), and the follow-on landed in the same PR**:
`deferred_pools.vehicle_cogs` removed, three pools declaring their vehicle accounts, both
`cost_sources.pending` blocks gone. ✅ **Gate 16 re-derived `143 = 134 + 9` across the merge without
being told**, because it counts rather than asserts.

## Context recommendation

**CLEAR CONTEXT.** The remaining work is #6 — a requirements backlog — and it touches entirely
different material from migration dispositions, gate arithmetic and vehicle costing. Nothing needed
is in anyone's head: `STATUS.generated.md`, the inbox and this doc are all on disk.

### Take #6, and re-measure before planning it

It is the only startable issue left. ⚠️ **Its own numbers are badly stale and nobody updated them**:
it says "2 requirements total" and "6 of 8 contexts have `requirements: []`". STATUS today reports
**21 requirements**, 0 without a scenario, and 4 contexts uncovered (`ordering`, `availability`,
`banking`, `procurement`). It is roughly half the size the issue claims, and it blocks m7.

The trap the issue names is still live: **adding a requirement trips gate 3**, which demands a
tagged Gherkin scenario, and as of 2026-08-16 those scenarios are also checked by gate 10n.

### ⚠️ The thing that should change how the next session budgets its time

**Five of six remaining issues are blocked on owner decisions.** The 2026-08-16 session took three
of them in a few sentences each — because every one arrived with measured evidence, a criterion and
a recommendation. **The decision backlog is not blocked on the owner's availability. It is blocked
on nobody having prepared the decisions.**

⚠️ **And ADR-0030 shows what "prepared" actually costs.** It sat `proposed` for a week looking like
it needed a signature; what it needed was a survey rule 8a had required all along, and running that
survey **reversed one of its stated consequences**. A decision that has not been prepared is not one
sentence away from being taken — assume the preparation is the work.

⇒ **One prepared decision per session is probably worth more than the authoring it displaces.**
Ranked by what they unblock: **ADR-0030 is now ready (PR #33)** · `Transfer.code`, where both
contenders are already fully worked (#3) · OQ-048, the imputed rate (#32) · OQ-049, the board and
the threads · OQ-039 + ADR-0032/0033 (#17, heaviest).

### Seven things to carry across the clear, because none is obvious from the issue text

- **Firing a gate red is not ceremony — it is the only thing that finds the defects.** Across two
  sessions ~thirty arms were fired and ten found real bugs, none surfaced by reading: a rule and its
  vectors disagreeing while every gate stayed green, a double-reported failure, a check matching
  nothing at all, a milestone criterion whose second half was never verified, a pool selecting the
  wrong labor, a field map naming the wrong object, and a probe reporting doc ids as schema. **A
  check that reads green while matching nothing is indistinguishable from one that passes.**
- ⚠️ **An INCOMPLETE fix is invisible in exactly the way a missing one is not.** The path probe's
  header described fixing the dynamic-key defect at large scale and it was still leaking 31 paths,
  **because the collapse reported what it collapsed and never looked at what it left behind.** When
  something reports its successes, ask what reports its failures.
- ⚠️ **A defect class does not survive its rule being written — it survives in the reporter.** The
  leak reporter's first run returned four false positives, all real field names that happen to be
  exactly 20 characters. **A noisy reporter is one nobody reads twice**, which is the same outcome
  as no reporter.
- ⚠️ **A correct conclusion reached by wrong reasoning is not a checked conclusion.** The
  `transport` pool selected `labor_line: delivery` — right at three enum values, wrong from the
  moment there were seven, and it survived a rename that touched the very sentence. **When a
  sentence is rewritten, re-read what it CLAIMS, not just the words that changed.**
- **When a doc states a count, something must count it.** The chart header said "138 entries, four
  minted" and was wrong in both halves for weeks; **gate 16 counts it now**. ⚠️ This section said
  "four things to carry" over five bullets until 2026-08-16 — the same defect, in the paragraph
  warning about it.
- ⚠️ **A rule that exists and is not applied blocks work silently.** ADR-0030 looked like it was
  waiting for the owner and was waiting for rule 8a. Before concluding a decision is blocked on a
  person, check what the repo's own standing instructions already require of it.
- **The `db_schema` enum is not the collection list** — 35 against 50, and it omits `credit-notes`
  and `settlements`, the second of which turned out to be 1,073 documents of cash application.
  Anything scoped from that enum is scoped short.
