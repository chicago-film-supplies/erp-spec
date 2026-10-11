# Spec system v2 — a fresh repo for the ERP spec, its evidence, and a browsable UI

**Date:** 2026-10-11 • **Repo:** erp-spec (until the new repo exists; then this doc moves there) • **Status:** planned
**Origin:** research session 2026-10-11 — eleven read-only agents covering a content audit, a CI audit, storage options, UI options, open-source wiki/PM/ALM/argument tools, a capability catalog and relationship discovery. Their findings are summarised under *Evidence* below; nothing in erp-spec was changed by that session.
**Related:** `tools/validate.ts`, `tools/view.ts`, `open-questions.yaml`, `hotspots.yaml`, `adr/`, `inbox/`, erp-spec#52 (v1-only evidence census), erp-spec#37 (accounts named by no rule)

## START HERE

erp-spec proved the idea and outgrew its format.
- **What works:** typed ids, a frozen-decision lifecycle, provenance, surveys.
- **What doesn't:**
  - The records live in a few giant YAML files.
  - Only about 13% of cross-references are machine-readable; the rest are prose mentions.
  - About 9k lines of after-the-fact validation do a database's job.
  - There is no usable way to browse.

The owner chose to build the replacement, not adopt a tool: probably SQLite plus a light Solid front end, in a fresh repo. **Phase 1 (the information model) is the next step and is a design phase — no code.** First command:

```bash
git -C ~/cfs/erp-spec show origin/main:.claude/plans/spec-system-v2.md
```

Then work through Phase 1 with the owner.

## Goals (owner, 2026-10-11)

1. **A current spec you can read at any time.** It covers stack, domains, data model and schema, rules, and clients (manager, public). It is incomplete by design and changes as work proceeds.
2. **An append-only evidence base that informs the spec:** research, measurements, surveys, captures, decisions.
3. **Tooling that:**
   - surfaces conflicts;
   - prevents re-discovering something already known;
   - enforces surveys before accounting-shaped decisions are accepted;
   - applies labelling standards.
4. **A browsing UI that is actually good.** Runs locally; optionally hosted cheaply (Cloud Run + Firebase Hosting). No paid third parties.

## Evidence the plan rests on (measured 2026-10-11)

- **The bulk is bloated records, not record count.**
  - open-questions.yaml is 73 records in 241 KB; `notes` is 151 KB of it. OQ-056 alone is 28 KB of dated log.
  - 24 of 25 hotspots are resolved and still make up about 93% of hotspots.yaml.
- **Links are mostly prose.**
  - 5,041 spec-id mentions, of which 674 are structured links.
  - ADR bodies mention 350 ids; 99 of them appear in no link field.
  - 21 OQ `blocks` targets are bare codes like `REQ-LED`.
- **Decisions live in 4 places:** ADRs, 43 answered-OQ `answer` fields, 39 inbox `kind: decision` notes, and inline "(owner, date)" rulings.
- **Measurements live in 5 places**, and figures are restated: `19.85` in 11 files, `18.3%` in 8.
- **Real rediscovery / overlook incidents** (the design drivers):
  - SPIKE-008 re-did api-cloudrun's tax work five days late (`e088b42`).
  - `Transfer.code` was rediscovered twice.
  - HOT-016: a refuted premise survived in 5 artifacts.
  - HOT-012: an ADR-0001 figure is about 700× wrong and still reads as current.
  - HOT-018 to HOT-023 were contradictions found late.
- **The tooling is heavy.** About 9k lines in `tools/` and formal tooling, plus 12.5k in the harness. About 38% of CLAUDE.md explains the gates. Generated files appear in 58% of commits.
- **Git as used:** 297 commits, 0 merges, one branch, so PR review is unused.
- **Off-the-shelf tools fall short.** None models question → option → decision → evidence. Every one needs a YAML export step, and none can enforce transition preconditions.
  - Closest candidates: StrictDoc, SilverBullet, Semantic MediaWiki.
  - Plane and OpenProject: the features that matter are paywalled.
- **Features that look like ceremony but serve the goals:**
  - the accounting-survey precondition;
  - `of` / `as_of` on measurements;
  - single-owner figures cited by id;
  - headlines as glosses;
  - named, expiring exemptions;
  - every check reporting its own blind spot as a number.

## The information model — draft for Phase 1 to settle

**Is IBIS right?** Partly. IBIS (Issue-Based Information System: issue → positions → arguments) is the right model for the *deliberation* layer. It says nothing about the artifact being built, the evidence, or the work. Four layers:

| Layer | Mutability | Kinds | Comes from |
|---|---|---|---|
| **Evidence** | append-only | `source` (research doc, survey, v1 data/code read, owner ruling, conversation), `fact` (value, unit, `of`, `as_of`, source), `capture` (raw idea, today's inbox) | provenance / nanopublication shape; Wikidata statements |
| **Deliberation** | append-only history; status moves by events | `question` (subtype `conflict` = today's HOT), `option` (rejected ones kept), `argument` (pro/con, cites facts; premises refutable), `decision` (chosen option; frozen at acceptance; superseded, never edited) | IBIS + ADRs (Nygard) + EventStorming hotspots |
| **Spec** | mutable current state | `domain` (bounded context), `entity` / schema, `rule` (business rule, posting rule + golden vectors), `requirement` (+ acceptance scenarios), `client` surface (manager, public), `stack` component | DDD, BDD, arc42-style architecture docs |
| **Work** | ordinary tracker | `investigation` (spike), `milestone`, tasks | XP spikes; may live in GitHub issues/projects (Phase 2 decides) |

**Joining rules:**
- Every spec element carries `justified_by → decision`, `open_on → question` and `cites → fact`.
- The spec view renders open questions inline where they bite.
- Corrections are `annotation`s attached to a record and displayed with it. They are never appended into its fields, and never hidden behind a frozen body.
- Figures appear in prose only by reference (`{{FACT-012}}`).

**Typed relations, about 8:** `answers`, `supersedes`, `contradicts`, `depends_on`/`blocks`, `cites`, `justified_by`, `refutes`, `relates_to`. Each link is `proposed`, `confirmed` or `rejected`, and records its origin (author, rule, search, llm). `contradicts` and `supersedes` stay proposed until the owner confirms.

**How it overlaps other philosophies:**

| Philosophy | What it contributes | Where it does not fit |
|---|---|---|
| **Agile / Scrum** | spikes; backlog ≈ requirements; acceptance criteria ≈ scenarios; *Definition of Ready / Done* ≈ transition preconditions (survey-before-accept is a Definition of Ready); living documentation ≈ the mutable spec | it tracks delivery of work, not knowledge — the reason Jira-style trackers modelled this badly |
| **Kanban** | the question board by status, WIP visibility | — |
| **Lean** | *last responsible moment* ≈ `decide_by`; set-based design ≈ keep rejected options | — |
| **RAID log** (traditional PM) | risks, assumptions (≈ premises), issues (≈ questions), dependencies (≈ `blocks`) | flat list, no decision chain |
| **DDD / EventStorming** | domains, entities, domain events, hotspots (≈ conflicts) | — |
| **BDD** | requirement scenarios | — |
| **GTD / Zettelkasten** | capture → triage → promote | — |

**Labelling standards to define in Phase 1:**
- closed vocabularies for record kind, status per kind, relation type, domain code, source type, confidence, and topic tags;
- one registry table that owns them, so nothing keeps a copy.

## Remaining

### Phase 1 — information model (design, no code)
**Launch from:** `erp-spec/` • **Skills:** cfs-skills:cfs-issues, cfs-skills:cfs-plan-docs • **Read:** this doc, `erp-spec/CLAUDE.md`, ADR-0034 and ADR-0037 (immutability, typed measurements/asserts)
- [ ] Settle the four layers, the kind list, the per-kind fields, the relation types and the lifecycle state machines, with transition preconditions (survey-before-accept, close-spike-requires-facts, answer-requires-links). Proof: `model.md` in the new repo, owner sign-off recorded in it.
- [ ] Define the labelling standard and the registry. Proof: vocabulary tables in `model.md`.
- [ ] **Hand-map one real end-to-end slice** onto the model before anything is built: the storage pivot (research drop → questions → ADR-0003 / ADR-0049 → spec "stack" section → facts) and one accounting decision with its survey. Proof: the slice written as records in `model.md`, with every gap noted.
- [ ] Define the discovery and enforcement rules:
  - undeclared-id mentions;
  - fact restatement;
  - link-or-dismiss with remembered dismissals;
  - a `contradicts` link auto-drafts a conflict question;
  - per-check blind-spot counts.

  Proof: a rules section in `model.md`.

### Phase 2 — stack evaluation (against the settled model)
**Launch from:** `erp-spec/` (or the new repo once it exists) • **Skills:** cfs-skills:cfs-issues • **Read:** `manager/.claude/skills/design-system/SKILL.md` if Solid + Tailwind is in play
- [ ] **Storage.**
  - Candidates: SQLite local; SQLite + Litestream on Cloud Run (single instance, unverified); Firestore; Cloud SQL Postgres; files + derived SQLite.
  - Criteria: write-time constraints, concurrent agent sessions, agent write path, hosting cost, portability, and a round-trip text export.
- [ ] **Front end.** SolidStart vs. Solid + Vite + Tailwind (the manager's pattern) behind a Hono API. Hosting: local only vs. Cloud Run behind auth vs. a static Firebase export.
- [ ] **Agent write path.** MCP server vs. CLI vs. both. Acceptance stays owner-only, from the CLI, never through MCP (erp-spec rule 3).
- [ ] **GitHub's role.**
  - Archive/backup via a deterministic text export.
  - Issues, Projects and Milestones as the *work* layer, instead of building one.
  - Also consider a wiki for long-form research.
- [ ] **Search.** FTS5 keyword search first. Semantic search only if it beats keyword recall@k on the 367 existing `relates_to` links (a free eval set).

Proof: a stack decision record in the new repo, each choice listing the alternatives rejected and why.

### Phase 3 — walking skeleton in the new repo
**Launch from:** new repo (name TBD — Phase 1) • **Skills:** cfs-skills:cfs-issues, cfs-skills:cfs-plan-docs
- [ ] Schema, plus write operations for 5 verbs: `capture`, `ask`, `decide`, `annotate`, `link`. Each runs its preconditions and discovery.
- [ ] Read UI:
  - current-spec document view, with open questions inline;
  - record page with backlinks, annotations and history;
  - question board;
  - search.
- [ ] Round-trip test: export → import → export, byte-identical.

Proof: the round-trip test passes in CI, and the UI renders the Phase 1 hand-mapped slice.

### Phase 4 — import erp-spec
**Launch from:** new repo • **Read:** `erp-spec/CLAUDE.md`
- [ ] Import:
  - structured links → confirmed links; prose id mentions → proposed links (triage queue);
  - ADR/spike `measurements` → facts; `asserts` → arguments with global ids;
  - OQ/HOT → questions, with their dated notes split into an answer plus annotations (owner reviews OQ-056 and the other long ones);
  - inbox → captures/sources;
  - accepted ADR bodies verbatim, keeping `frozen_sha256`.
- [ ] Port only the executable domain checks: golden-vector balance, minimal pairs, coverage completeness, allocation control totals.

Proof: record counts by kind match the 2026-10-11 census, and the link-triage queue is reported as a number.

### Phase 5 — cutover
- [ ] erp-spec becomes a read-only archive: README banner, no new content.
- [ ] Slim CLAUDE.md to "how to use the tool". Footguns become `lesson` records that discovery surfaces.
- [ ] Close or move erp-spec's open issues.

Proof: `gh issue list -R chicago-film-supplies/erp-spec --state open` is empty or migrated.

## Decisions

- **Build, don't adopt (owner, 2026-10-11).** Rejected:
  - Plane: types and custom properties are paywalled.
  - OpenProject: read-only work packages and MCP are paywalled; relations are a fixed set.
  - Tuleap: cross-tracker search and code hooks are Enterprise-only.
  - Redmine: dated, fixed relation types.
  - StrictDoc, SilverBullet, Semantic MediaWiki: each needs an export step, none enforces preconditions or models deliberation.
  - Wikibase: heavy, handles prose badly.
  - Notion-likes: licensing (Anytype, AFFiNE server), or a tool database that has to become the master copy.
- **Fresh repo, not a refactor of erp-spec.** The new repo holds implementation code, which erp-spec's charter excludes, and the content model changes.
- **Not reached until Phase 2:** SQLite vs. Firestore vs. other; SolidStart vs. Solid + Tailwind; whether git stays canonical or becomes an export. Current lean: SQLite canonical with a git text export (no merges are being done, so a change log beats git history), but Phase 2 decides against the model, not before it.
- **Not cut, despite the CI audit:** survey enforcement, typed measurements (`of`, `as_of`), single-owner figures, headlines. Each serves "don't overlook / don't redo". What goes: the opml map, the stale-generated-file gate, spelling and headline-length gates, and the milestone checker as built.

## Context recommendation
**Context:** CLEAR CONTEXT — Phase 1 is a design dialogue that this doc fully seeds; the research context is summarised above and is not needed verbatim.
**Execute with:** opus — Phase 1 is information-model design, where a plausible wrong model passes every check.
