# The PostgreSQL pivot — every artifact the ruling touches, and the order to move them

**Date:** 2026-10-09 • **Repo:** erp-spec • **Status:** ⏳ phases 1, 2 and 3a done — nothing
accepted • **Origin:** owner ruling
`inbox/2026-10-09-owner-rules-postgres-is-the-one-system-of-record-replacing-mongo-tigerbeetle-valkey-and-duckdb.md`
• **Related:** ADR-0049 to ADR-0054, SPIKE-014, OQ-066 to OQ-069, HOT-025

> ## ⚠️ STATUS UPDATE 2026-10-09 (second session)
>
> - **Phase 2 done.** Owner rejected ADR-0015 and ADR-0042 (3ff7b14,
>   `inbox/2026-10-09-owner-rejects-adr-0015-and-adr-0042-and-asks-for-both-reservation-models-drafted.md`).
>   ADR-0055 (what a reservation is under PostgreSQL, proposed) carries what survives; custody phase
>   versus movement count is **OQ-070**, drafted both ways at the owner's request. Serialized
>   products reserve a quantity with optional named units (D4). HOT-022 has a resolution note;
>   SPIKE-012 closes ADR-0055. ADR-0039/0040/0046/0047/0048/0028/0031 reworded (9a3ca12); ADR-0040's
>   database mechanism is now **OQ-071**.
> - **Phase 3a done** (9a3ca12): EVT-FUL-004/005/007 carry `commitment_ref` + `unit_refs`, and
>   004/007 are `blocked_by: OQ-070` (they exist only under option A).
> - **Left over from 2/3a, not done:** ADR-0040's filename still says `mongo-validator` (a rename
>   breaks citations); glossary entries for `transfer`, `projection`, `sealed artifact`,
>   `close record` and `reservation` not added (`reservation` waits on OQ-070).
> - **Next:** phase 4 (runnable now) or 3b (waits on ADR-0051 acceptance). Close #63/#64 once
>   pushed.

## START HERE

- **The ruling:** PostgreSQL is the one system of record. MongoDB, TigerBeetle, Valkey and DuckDB
  leave. Parquet stays only as a change-feed sink; Typesense stays; Linode stays (ADR-0013).
- **Nothing is accepted.** Every superseder is `proposed` with `supersedes_on_acceptance`, so the
  in-force set still names the old stack. HOT-025 records that contradiction. Acceptance is the
  owner's act, never a session's (CLAUDE.md rule 3).
- **Gate 6 allows ONE `supersedes_on_acceptance` target per ADR**, which is why there are five
  narrow superseders and not one umbrella ADR.
- Re-derive the inventory before trusting the lists below: `grep -ril` for `tigerbeetle`, `mongo`,
  `valkey`, `duckdb`, `parquet`, `user_data`, `pending transfer`, `sweeper`, `sealed` across `adr/`,
  `contexts/`, `ledger/`, `reporting/`, `roadmap/`, `migration/`, `spikes/`, `formal/`, the root
  YAML files, `CLAUDE.md` and `README.md`.

## Phase 1 — decisions drafted ✅ 2026-10-09

| New                                                   | Supersedes on acceptance | Note                                                  |
| ----------------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| ADR-0049 PostgreSQL is the one system of record       | ADR-0003                 | gated by SPIKE-014                                    |
| ADR-0050 work queues live in PostgreSQL               | ADR-0012                 |                                                       |
| ADR-0051 one ledger answers every period              | ADR-0017                 | **accounting-shaped — survey owed before acceptance** |
| ADR-0052 DuckDB leaves; Parquet is a change-feed sink | ADR-0024                 |                                                       |
| ADR-0053 no native addons in the runtime              | ADR-0023                 | driver measured in SPIKE-014                          |
| ADR-0054 five verification layers                     | — (relates to ADR-0016)  |                                                       |

Also: SPIKE-014; OQ-066 (append-only enforcement), OQ-067 (live transport), OQ-068 (staging
replica), OQ-069 (hosting and failover); HOT-025; an OQ-065 note (sequences are not gapless); the
premise correction for seven accepted ADRs
(`inbox/2026-10-09-correction-seven-accepted-adrs-cite-a-replaced-store-as-a-premise-and-their-decisions-stand.md`),
with `ADR-0049` added to their `relates_to`; ADR-0028 `review_by` moved to 2026-12-15.

## Phase 2 — proposed ADRs that rest on a replaced store (#63 owner decisions, #64 rewording) ✅ 2026-10-09

Launch from: `erp-spec/`. Skills: none beyond this repo's `CLAUDE.md`.

- **ADR-0015** (reservations are pending transfers) — its decision IS a TigerBeetle mechanism.
  Re-decide: what a reservation is under ADR-0049. SPIKE-012's v1 measurements survive; its framing
  ("when a booking becomes a pending transfer") does not. ⚠️ Owner decision.
- **ADR-0042** (the sweeper is the sole resolver) — subject gone under ADR-0049. Propose `rejected`;
  HOT-022 then has a withdrawn resolver and needs a resolution note. ⚠️ Owner decision.
- **ADR-0039** (history loads as ordinary postings) — keep the decision, drop the TigerBeetle
  `imported` flag and `user_data_32` packing; accounting date is a column.
- **ADR-0040** (Zod is the schema authority) — keep "Zod is the authority"; replace the generated
  MongoDB validator with what Postgres enforces (DDL, CHECK constraints). The SPIKE-006 equivalent
  for Zod→DDL is an open question.
- **ADR-0046** (date-fns and TZDate) — drop the `user_data_32` reference; decide the stored form
  under Postgres (`timestamptz` versus offset string), which it explicitly left open.
- **ADR-0047** (client live and offline model) — re-express D1 (resume token) and D3 (pre/post
  images) once OQ-067 is answered; D4–D17 are store-agnostic.
- **ADR-0048** (bank feed lands in Mongo) — headline, D14, D15, P7: a Postgres inbox table that does
  not post.
- **ADR-0028, ADR-0031** — citations of ADR-0017's sealed artifact and SPIKE-011's TigerBeetle
  sizing.

## Phase 3 — structured spec (3a #64, 3b #65)

Launch from: `erp-spec/`. **3a can run now; 3b waits for ADR-0049/0051 acceptance.**

**3a — store-agnostic rewording (requirements must be implementation-free anyway):** ✅ 2026-10-09

- `contexts/fulfillment/events.yaml` — header and EVT-FUL-004/005/007 (`pending_transfer_ref`,
  `posted_transfer_ref`, `voided_transfer_ref`; "the pending transfer POSTED/VOIDED").
- `contexts/availability/events.yaml` header — keep the interval-math boundary, drop TigerBeetle.
- `contexts/billing/requirements.yaml` REQ-BIL-003 rationale; `contexts/tax/requirements.yaml`
  REQ-TAX-003 rationale.
- `contexts/ledger/context.md` open items (HOT-005/OQ-009 line; stale ADR-0008 line).
- `contexts/ledger/entities/posting.yaml` `line_identity` and `source_document` notes.
- `ledger/posting-rules.yaml` rationale lines naming TigerBeetle/Mongo;
  `ledger/vectors/_TEMPLATE.yaml` and ~15 vectors with incidental TigerBeetle prose.
- `glossary.yaml` — redefine `posting timestamp`, `key`, `period close`; decide whether `transfer`,
  `projection`, `sealed artifact`, `close record` get entries.
- `charter.md` Go-sidecar non-goal; `README.md` target-stack line, `formal/` line, context-code list
  (already missing `PRO`).
- `migration/field-map.yaml` — re-cite ADR-0003 → ADR-0049 on the `stock-locks` and `query_by_*`
  drops.

**3b — redesigns that depend on ADR-0051:**

- `period_closed` rule (`ledger/posting-rules.yaml` :220-250) and its three vectors, including the
  file name `close-writes-parquet-hash.yaml` and every `differs_from` pointing at it.
- EVT-LED-002 `parquet_sha256` → a closing hash over the period's postings.
- REQ-TAX-004 ("seal both bases in one artifact") and its two scenarios in
  `contexts/tax/features/tax-basis-is-derived-not-posted.feature`; the closed-period scenario in
  `contexts/billing/features/voided-documents-excluded.feature`. ⚠️ Accounting-shaped.
- `reporting/product-line-pl.yaml` `period_source`, `sealed_at_close`; `reporting/queries/*.sql`
  (`read_parquet`); `reporting/README.md`.
- `ledger/tigerbeetle-accounts.yaml` — salvage the store-agnostic rules (USD only; no balance
  direction on GL accounts; custody may not go negative, money may; journal entry id not derivable;
  accounting date is a calendar day), then retire it with `spikes/harness/tb-field-budget_test.ts`.
  ⚠️ ADR-0026 (accepted) cites it, so gate 11 needs an `EXEMPT` entry or the file stays.
- Vector vocabulary (`transfers`, `mirrors_original_transfer`) is TigerBeetle naming but not
  TigerBeetle semantics — renaming touches gates 10g/10h/10i/10m and `milestone-checks.ts:375`.
  Decide whether it is worth it; keeping it is defensible.

## Phase 4 — machinery (`ops` #68, Quint CI #69, retirement #70)

Launch from: `erp-spec/`.

- **`ops` context** (owner ruling 2026-10-09): one entry in `tools/contexts.ts`; scaffold from
  `contexts/_template/`; fix `tools/ingest.ts:151-160` (hard-coded 8 dirs, already missing
  `procurement` — import the registry instead); the context-code lists in `CLAUDE.md` and
  `README.md`; m2 prose "nine contexts"; `deno task labels --apply`. Gate 23 makes every
  `contexts/ops/entities/*.yaml` appear in OQ-058's `prerequisite_entities`.
- **Quint CI job** (owner ruling 2026-10-09): new workflow beside `spec.yml`, precedent
  `tax-rules-refresh.yml`. Pin Quint (unpinned `npx` today); Java 21 for Apalache; assert the
  fail-closed companions FAIL; add `run` tests to `period-close.qnt`; turn m5's two `prose_only`
  criteria into checks; update `tools/milestone-checks.ts:546-559` and `formal/README.md`'s
  hand-copied results table.
- **`formal/two-store-commit.qnt`** — keep (accepted ADR-0023 cites it; gate 11), mark superseded in
  `formal/README.md` once ADR-0049 is accepted; retire m5's two-store criterion
  (`roadmap/milestones.yaml:114`).
- **Reference notes** — add `research-drop/reference/postgres.md`; mark `tigerbeetle.md`,
  `mongodb.md`, `valkey.md`, `duckdb.md` retired (duckdb's Parquet half survives); fix the stale
  `research-drop/reference/README.md` table and the stale `quint.md` (still says TLA+, "not yet
  ADR'd", and conflates `quint test` with model-based testing).
- **Doc fetcher** — `tools/fetch-llms-docs.ts` SOURCES, `deno.json` `--allow-net`,
  `.claude/settings.json` WebFetch domains.
- **`CLAUDE.md`** — rule 10's stack list; the "LLM reference docs" list; the "fact about a
  third-party API has ONE owner" rule (the principle stands; its worked example and both pointers
  are TigerBeetle-only).
- **Harness** — keep the TigerBeetle/Mongo/DuckDB/Valkey probes as evidence for closed spikes (gate
  11 cites them); mark them retired in `spikes/harness/_README.md`. `tools/validate.ts:1563` (gate
  10m comment) cites TigerBeetle.

## Phase 5 — `ops` requirements (#68)

Launch from: `erp-spec/`. Source notes:
`inbox/2026-10-09-gap-the-spec-names-an-observability-stack-and-no-signal-it-must-carry.md`,
ADR-0054. Quiet-failure liveness, worker/cron liveness, slot lag and retained WAL, live-transport
gateway liveness, queue depth and age, conformance failures, external dead-man's switch, v2 log
retention and PII rules. Each REQ needs a `.feature` scenario (gate 3).

## Phase 6 — SPIKE-014 (#67)

Launch from: `erp-spec/` (harness in `spikes/harness/pg/`). Needs a local PostgreSQL. Reads v1 via
the read-only `cfs-api-prod` MCP tools only.

## Phase 7 — acceptance (owner; ADR-0051 survey #66)

- ADR-0051's six-reference survey into `inbox/` first (gate 19 fails acceptance without it).
- At each acceptance, three fields move together: `supersedes_on_acceptance` → `supersedes`; on the
  target, `superseded_by` and `status: superseded` (gate 6).
- Resolve HOT-025 by the accepted ADRs. Then sweep citations of ADR-0017's sealed artifact (ADR-0026
  read side, 0029, 0031, 0036, OQ-051, OQ-056).

## Not part of the pivot, found on the way

- Untriaged inbox notes from the last week that overturn spec premises:
  `inbox/2026-10-07-survey-v1-split-a-purchase-into-ordered-received-billed-and-paid-and-a-receipt-quantity-is-a-co-written-bucket.md`,
  `inbox/2026-10-07-survey-v1-settled-the-serialized-unit-model-that-adr-0015-leaves-out-of-scope.md`
  (the latter matters for ADR-0015's re-decision).

## Context recommendation

Clear before phase 2. Phase 1's inventory is in this doc; a fresh session reads it and the ADRs
rather than this conversation.
