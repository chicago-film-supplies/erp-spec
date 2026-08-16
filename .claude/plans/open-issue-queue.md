# Clearing the erp-spec open issue queue

- **Date:** 2026-08-16
- **Repo:** erp-spec
- **Status:** ⏳ 2 of 4 units landed · branch pushed, **not merged**
- **Origin:** a review of all six open issues (#13–#18), requested because #18 was on the owner's
  mind
- **Related:** #13, #14, #15, #17, #20 · closed by this work: #16, #18 · HOT-015 (resolved) ·
  `tools/validate.ts`, `spikes/harness/allocation-basis-probe.ts`, `ledger/posting-rules.yaml`

## START HERE

Six issues were open. **#16 and #18 are fixed on
`fix/supersede-machinery-and-feature-dimension-gate` (5 commits, pushed, NOT merged).** What remains
is **#15 → #13** (one unit; #15 exists only to unblock #13) and **#14** (its own session). **#17 is
deferred and not startable** — see Decisions.

Do **#14 next if you want roadmap movement**, **#15/#13 next if you want the stale numbers fixed**.
#14 is the larger payoff and the larger session; see Remaining for why its own issue text
understates it.

`deno task validate` is green and `deno fmt --check` is clean as of `8ae3f37`.

⚠️ **Before opening a PR: `origin/main` is 8 commits BEHIND local `main`** (measured 2026-08-16,
`git rev-list --count origin/main..main` = 8, oldest `1e34f73`, newest `5b1f8ae`). Those are the
ADR-0035/0036 and HOT-013/014 sessions, committed locally and never pushed. A PR opened against
`origin/main` today bundles all 13 commits and reviews as one change. **Push `main` first**, then
the PR is the 5 commits it should be.

⚠️ **`main` is CI-red until this branch lands.** `deno fmt --check` fails on `5b1f8ae` (7 files);
`12540fc` is the fix and it is on this branch.

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

## Remaining

### Unit 3 — #15 then #13 (one session)

**#15 — take option 2, direct Firestore via ADC.** `spikes/harness/allocation-basis-probe.ts`
authenticates with a shared `CFS_API_TOKEN`; `/mcp/cfs` moved to OAuth
(`requireMcpOAuth("mcp:cfs")`) and `MCP_LEGACY_BEARER_UNTIL` has passed. Option 2 over 1 or 3: the
probe needs read-only `invoices` paging and nothing else, `gcloud auth application-default login` is
already a workspace prerequisite, it kills the shared-token dependency, and it does not re-open a
path that was deliberately closed. **Update the probe's header comment** — it documents an auth path
that no longer works, which is what made this a 15-minute discovery instead of a 15-second one.

**#13 — two items left** (items 3 and 4 were completed 2026-08-16):

1. Rebuild the **product-line × revenue-account matrix** with the product-master join; diff line by
   line against `inbox/2026-08-09-product-line-by-revenue-account-matrix.md`. Individual lines have
   been re-measured piecemeal; the matrix has never been rebuilt as a re-runnable artifact.
2. Re-run **ADR-0031's allocation measurements**. ⚠️ Before running: the probe classifies
   `Transport` as goods **by omission**, and OQ-034 made it a fifth activity line that does not
   spread. Add the classification or the run is wrong.

Predicted directions are already recorded on #13 — 41.4% pool-exceeds-base must **fall**, 5.16%
unallocable must **fall** (85.5% of it is five Netflix Duradeck orders). **A reading that moves the
other way is a finding, not a result.** Record measured values as numbers, and state the denominator
on every figure — there have been three base mismatches in this corpus.

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

**CLEAR CONTEXT.** Units 3 and 4 are executable from this doc plus `CLAUDE.md`, they touch entirely
different material from Units 1 and 2 (ADC auth and allocation measurement; a six-reference
accounting survey), and #14 in particular wants a fresh full window.
