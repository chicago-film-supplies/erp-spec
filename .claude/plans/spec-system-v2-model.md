# Spec system v2 — information model (Phase 1 draft)

**Date:** 2026-10-11 • **Repo:** erp-spec (moves to the new repo with `spec-system-v2.md`) • **Status:** done
**Origin:** Phase 1 of `.claude/plans/spec-system-v2.md`. Draft by Claude, worked through with the owner. Rulings marked ✅ are taken; ⚖️ ones are open.
**Read with:** `.claude/plans/spec-system-v2.md`. erp-spec's ADRs (especially ADR-0034 and ADR-0037) and the survey `inbox/2026-08-17-survey-typed-claims-…` are **evidence for this design, not constraints on it** (owner, 2026-10-11: _"we're speccing something new we dont have to be restricted by past decisions, we should just be informed by them"_).

## START HERE

This is the Phase 1 deliverable in draft:
- §2–§6 are the model.
- §7 hand-maps two real erp-spec slices onto it and lists every gap found.
- §9 holds the rulings.

**Taken:**
- ✅ R1 — full IBIS.
- ✅ R1a — argument text stays editable after acceptance; change history (§2) keeps every version.
- ✅ Change-history mechanism — a Phase 2 choice; §2 states the requirement.
- ✅ R3 — only ADRs are decisions. An OQ answer stays a field on the question.
- ✅ R2 — every fact names the source that produced it.
- ✅ R4 — legacy ids are permanent aliases; new questions mint `Q-`.
- ✅ R5 — no annotation kind. A correction is new evidence plus a `corrects` link.
- ✅ R7 — design work lives in the tool; GitHub issues are for code only.

**Open:** none. ✅ Owner signed off 2026-10-11 (§11).

**Next step:** Phase 2, stack evaluation, in `spec-system-v2.md`.

---

## 1. Principles carried forward (adopted on their merits)

- Typed ids, never reused, never renumbered.
- **The record of a decision as it was taken is recoverable forever.** Here that means a pinned transaction in the change history (§2), not a hash of a file body.
- **A figure has an `of` and an `as_of`.** The source date says when the figure was read. `as_of` says when the population was that population.
- **Every check reports its blind spot as a number.** When a check is silent, its output says whether that means "clean" or "not looked at".
- **v1 answers what is, never what must be.** Source type `v1-read` is labeled so a census can count target-state records resting only on v1 evidence (erp-spec#52).
- **The only executable claims are ones something runs against.** Structure nothing checks is stated as such in the check output.

## 2. Layers, and the change history under all of them

| Layer | Kinds |
|---|---|
| **Evidence** | `source`, `fact`, `capture` |
| **Deliberation** (IBIS) | `question`, `option`, `argument`, `decision` |
| **Spec** (current state) | `domain`, `entity`, `event`, `rule`, `requirement`, `scenario`, `client`, `stack`, `term` |
| **Work** (the design project's own tracker, R7) | `task` (subtype `investigation` = today's spike), `milestone` |
| cross-cutting | `link`, `lesson`, `exemption` |

**Change history is complete and cannot be bypassed** — 🔴 hard requirement; R1a depends on it.
- Every change to any record is recorded as `(txid, at, actor, verb, record_id, before, after)`.
- It is recorded **in the same transaction as the change**, so a committed change with no history row cannot exist.
- History rows are never updated or deleted.
- The database enforces this. Application discipline does not count.
- `actor` and `verb` record **intent** ("owner accepted", "argument withdrawn"), not just the row diff. The write path sets them per transaction, and the capture copies them in.
- **The mechanism is Phase 2's to choose (owner, 2026-10-11).** The candidates and their trade-offs are in §10. A post-commit sink alone (logical replication to an external store) does **not** meet this requirement: it is asynchronous, and a dropped replication slot leaves a gap nothing reports. It is fine *in addition*, feeding the export and the archive.

Consequences:
- **Every kind has full history for free.** So "append-only" and "mutable" stop being storage properties. They become per-kind policy on which verbs are allowed.
- **Evidence kinds** allow no `edit` verb on content. A source's body is what was said or read. A correction is a new source or fact with a `corrects` link (R5).
- **Spec kinds** allow `edit`. Today `REQ-LED-001`'s rationale carries a dated narrative of its own restatements; here that is the record's history, not one of its fields.
- **Deliberation kinds** allow `edit`. Acceptance pins a transaction (§6) rather than banning edits.

## 3. Kinds and their fields

Every record has `id`, `kind`, `headline` (≤12 words, required on every kind), `created_at`, `created_by`, `origin` (`author` / `rule:<name>` / `import` / `llm`) and `domains[]`.

### Evidence

| Kind | Fields | Notes |
|---|---|---|
| `source` | `type` (§5), `title`, `body` (verbatim), `locator` (URL / `code:<date>:<repo>@<sha>:<path>` / `api:<date>:<tool>` / transcript id), `read_at`, `confidence` | Covers today's inbox notes, research-drop files, surveys, owner rulings and verification reads. **An owner ruling is a source** (type `owner`), whose body is the verbatim quote. |
| `fact` | `value`, `unit` (`qualitative` allowed, G8), `of` (required), `as_of`, `source` (required, R2; must be an evidence record, never a decision, G1), `method` | Today's `measurements[]`. |
| `capture` | `body`, `triage` (`untriaged` / `promoted` / `dismissed`), `promotes_to[]` | A raw idea before triage. |

### Deliberation — full IBIS (✅ R1)

| Kind | Fields | Notes |
|---|---|---|
| `question` | `subtype` (`open` / `conflict`), `statement`, `owner`, `decide_by`, `status`, and when answered inline: `answer` (statement), `answer_option` (the chosen option, if the tree has one), `answer_source` (an `owner` source, required), `answered_txid` | IBIS *issue*. `conflict` = today's HOT. Answered **either** by an ADR (an `answers` link) **or** inline (R3). |
| `option` | `question`, `statement`, `status` (`live` / `chosen` / `rejected`) | IBIS *position*. Rejected options are kept. Why one lost is in its arguments, so there is no `rejected_because` field. |
| `argument` | `target` (an option, argument or decision), `role` (`supports` / `objects_to`), `claim` (one or two sentences), `basis` (`factual` / `judgement`), `cites[]` (facts, sources), `status` (`standing` / `withdrawn` / `refuted`), `accepted_cost` (bool; owner only, on an objection to a chosen option) | **Nests.** An argument may target an argument, which gives rebuttal chains. It may raise a question through a `raises` link. A `basis: factual` argument is today's `premise`. `basis: judgement` covers materiality, preference and risk appetite: things no fact can refute. |
| `decision` | `answers[]`, `chooses`, `clauses[]` (today's `asserts` of kind `decision`), `body` (prose), `status`, `accounting_shaped`, `deciders`, `review_by`, `accepted_txid` | `accepted_txid` is the transaction the acceptance pinned. |

**Prose and tree, both kept.**
- A decision's `body` and an option's notes are where connective reasoning lives. That is the ~83% of load-bearing text the 2026-08-17 survey found does not decompose into claims.
- The body **cites arguments by id** (`{{ARG-n}}`) and does not restate them. The restatement rule (§8) flags exact restatement.
- Two copies drifting is the downside the owner accepted with R1, and this is its containment.

**Derived flags** (computed, never stored):
- `contested`: has a standing `objects_to` child with no standing response.
- `undermined`: something it cites, or a `supports` argument under it, is refuted.
- `changed_since_acceptance`: in a decision's pinned tree, and edited after `accepted_txid`.

### Spec

| Kind | Fields | Notes |
|---|---|---|
| `domain` | `code`, `name`, `summary` | Today's `tools/contexts.ts` registry. |
| `entity` | `domain`, `schema`, `notes` | |
| `event` | `domain`, `name`, `payload` | Today's `EVT-`. |
| `rule` | `domain`, `statement`, `vectors[]`, `accounts[]` | Posting rules and business rules, with golden vectors. |
| `requirement` | `domain`, `statement`, `priority`, `verification_method` | Implementation-free. |
| `scenario` | `requirement`, `gherkin` | Today's `.feature` files. |
| `client` | `name` (manager, public), `surfaces[]` | |
| `stack` | `component`, `role` | Status is **derived** from its `justified_by` decision: proposed ⇒ candidate, accepted ⇒ adopted, superseded ⇒ retired (G5). |
| `term` | `definition`, `aliases[]` | Glossary. |

Every spec record declares `justified_by → decision`, `open_on → question` and `cites → fact/source`. Each may be empty; an empty one is counted in the census.

### Work (R7)

| Kind | Fields | Notes |
|---|---|---|
| `task` | `subtype` (`investigation` / `survey` / `drafting` / `review` / `import` / `other`), `statement`, `serves[]` (the questions, ADRs or spec records it moves forward), `done_when` (the proof, stated before work starts), `status` (`open` / `in_progress` / `done` / `dropped`), `produced[]` (records the work created), `dropped_reason`, `blocked_by[]`, `code_issue` (optional URL, when the task needs code changed in a repo) | One tracker. `investigation` keeps today's spike rules: `question`, `timebox`, `method`, `exit_criteria[]`. |
| `milestone` | `statement`, `exit_criteria[]` (each a named query over records, e.g. "no open LED question past `decide_by`"), `target_date` | Status is **derived** from the criteria, never set by hand. Every criterion reports `checked N, failing M`. |

### Cross-cutting

| Kind | Fields | Notes |
|---|---|---|
| `link` | `from`, `to`, `rel`, `state` (`proposed` / `confirmed` / `rejected`), `origin`, `decided_by`, `decided_at` | A rejected `(from, to, rel)` is remembered and never re-proposed. |
| `lesson` | `statement`, `trigger`, `cites[]` | Today's CLAUDE.md footguns. |
| `exemption` | `rule`, `target`, `reason`, `expires` (a date, or `never` + why) | Exempt by identity, never by cutoff. |

## 4. Relations

Argument structure (target and role) lives in the argument's own fields, so it is not a link. Everything else is a link:

| `rel` | from → to | Confirmation |
|---|---|---|
| `answers` | decision → question | author |
| `raises` | argument → question | author |
| `supersedes` | decision → decision | **owner only**. A proposed one retires nothing; confirming it is part of accepting the superseder. |
| `contradicts` | any → any | **owner only**. A proposed one auto-drafts a `conflict` question. |
| `depends_on` | any → any (`blocks` is its inverse view) | author |
| `cites` | any → fact / source / argument | author |
| `justified_by` | spec → decision | author |
| `corrects` | fact → fact, source → source | author. The old record shows a "corrected by" banner. A correction is itself evidence, so R2 applies to it. |
| `refutes` | fact / source → argument | owner confirms. Confirming sets the argument to `refuted`. |
| `relates_to` | any → any | author; the weakest link |

Every link target must resolve to a record. A domain-level target links to the `domain` record, never to a bare code like `REQ-LED`.

## 5. Labeling standard — one registry table

`vocab(axis, value, definition, since, retired)` owns every closed vocabulary. Membership is enforced by foreign key, and nothing else holds a copy.

| Axis | Values (draft) |
|---|---|
| `kind` | §3 |
| `status:<kind>` | per kind, §3 and §6 |
| `rel` | §4 |
| `argument.role` / `argument.basis` | `supports` `objects_to` / `factual` `judgement` |
| `domain` | LED FUL BIL FA ORD AVL BNK TAX PRO OPS |
| `source.type` | `owner` · `survey` · `research` · `v1-read` · `code-read` · `measurement` · `transcript` · `capture-session` |
| `confidence` | `high` · `medium` · `low` |
| `origin` | `author` · `rule:<name>` · `import` · `llm` |
| `topic` | open set, registered before use; `area:` parity with GitHub labels |

## 6. Lifecycles and preconditions

The tool enforces each precondition at write time. A refused write names the precondition it failed.

**question:** `open → answered | withdrawn`; `answered → reopened`.
- `→ answered` requires **one** of:
  - an `answers` link from an accepted ADR;
  - an inline answer: `answer` + `answer_source` (an `owner` source) + optionally `answer_option`. That sets the option `chosen` and its rivals `rejected`.
- An inline answer runs **none** of the ADR acceptance checks: no survey, no accepted cost (R3, owner's choice). The census reports what that leaves unseen (§8).
- Inline answers are editable with history, and `answered_txid` pins the as-answered view, the same mechanism as acceptance.

**option:** `live → chosen | rejected`.
- An option becomes `chosen` only when a decision that chooses it is accepted.

**argument:** `standing → withdrawn | refuted`.
- `withdrawn` is the author retracting the argument. It is legal at any time, and on a pinned argument it shows as changed since acceptance.
- `refuted` happens only by the owner confirming a `refutes` link, or by the owner ruling a responding objection decisive.

**decision:** `proposed → accepted | rejected`; `accepted → superseded`.
- `→ accepted` requires all of:
  - the actor is the owner, via the CLI;
  - `accounting_shaped` is declared, and if true, ≥1 `survey` source is cited or an unexpired `exemption` applies;
  - no `supports` argument on the chosen option is `refuted` or `undermined`;
  - every standing objection on the chosen option is either answered (it carries a standing response) or marked `accepted_cost` by the owner;
  - **≥1 objection is marked `accepted_cost`.** This is the accepted downside, today's "accepting …" clause made structural. A decision with no stated cost cannot be accepted.
- **On accept:** `accepted_txid` = the accepting transaction.
  - The **as-decided view** is the decision's tree, meaning its question, options and argument subtree, as of `accepted_txid` (read from change history).
  - The **current view** is current state.
  - The page shows both and marks every difference.
- **After accept:**
  - Arguments may be added, edited (✅ R1a) or withdrawn.
  - A new standing objection on the chosen option, or a supporting argument going `undermined`, raises a **review item**. It never reopens the decision automatically.
  - `clauses[]` and `body` stay editable too, under the same marker. Whether to lock those two harder is noted in R1a.
- `→ superseded` happens only by the owner confirming a `supersedes` link.

**task:** `open → in_progress → done | dropped`.
- `→ done` requires ≥1 record in `produced[]`. A task that produced nothing has not finished; it was dropped.
- `→ dropped` requires `dropped_reason`.
- **subtype `investigation`, `→ done`** additionally requires ≥1 `fact` from a measurement it produced, and either an ADR it produced or a `no_decision_reason`.
- **subtype `survey`, `→ done`** requires a `source` of type `survey` in `produced[]`.

**milestone:** no stored state. Met when every exit criterion passes. Milestones gate nothing unless the owner asks; acceptance stays the owner's call.

**capture:** `untriaged → promoted | dismissed`.
- `→ promoted` requires `promotes_to`.

**spec records:** stateless.
- A record whose `justified_by` decision is superseded raises a review item.

## 7. Hand-mapped slices

### 7a. The storage pivot (ADR-0003 → ADR-0049)

```yaml
# Evidence
SRC-a  source type: owner     research-drop/2026-10-09-storage-reopened-postgres-as-one-system-of-record.md
SRC-b  source type: research  inbox/2026-10-09-research-celld-considered-and-not-pursued-…md   confidence: medium
SRC-c  source type: owner     inbox/2026-10-09-owner-rules-postgres-is-the-one-system-of-record-…md
       body: "im settled on postgres replacing tigerbeetle and duckdb" / "Postgres for all four"
FACT-1 fact ~15k postings  of: v1 ledger history (15 transfers × 999 prod invoices)  as_of: 2026-08-09
       source: ADR-0024   # ⚠ G1

# Deliberation
Q-1    question  "what is the system of record?"                    # ⚠ G2: never a record today
OPT-1  option    Mongo + TigerBeetle (+ Valkey, DuckDB)   → rejected when ADR-0049 is accepted
  ARG-1  supports  OPT-1  factual   "TigerBeetle enforces double-entry in the database"
  ARG-2  objects_to OPT-1 judgement "four storage sites; owner fears forcing TigerBeetle"  cites SRC-a
  ARG-3  objects_to OPT-1 factual   "two-store commit has to be specified formally"
OPT-2  option    celld                                     rejected
  ARG-4  objects_to OPT-2 factual   "the expensive writes cross entities; nothing coordinates a commit across cells"  cites SRC-b
    ARG-5  objects_to ARG-4 ...     # nesting: room for a rebuttal; none was ever made
OPT-3  option    PostgreSQL for all four
  ARG-6  supports  OPT-3 factual    "volume is orders of magnitude below any candidate's limit"  cites FACT-1  (= ADR-0049/P2)
  ARG-7  supports  OPT-3 judgement  "owner ruling"  cites SRC-c                                      (= ADR-0049/P1)
  ARG-8  objects_to OPT-3 factual   "append-only and balance enforcement become our job, not the store's"
         accepted_cost: (owner, at acceptance)
ADR-0003  decision  accepted  answers Q-1  chooses OPT-1
ADR-0049  decision  proposed  answers Q-1  chooses OPT-3  clauses: D1…D5
link      ADR-0049 supersedes ADR-0003  proposed          # HOT-025 becomes a view (G3)

# The seven-ADR correction (inbox/2026-10-09-correction-seven-accepted-adrs-…)
ARG-9  supports <ADR-0010's option> factual "TigerBeetle assigns a posting timestamp, no accounting date"  origin: import
link   SRC-c refutes ARG-9   → owner confirms → ARG-9 refuted → ADR-0010 undermined? NO:
       ADR-0010's decision rests on other supports too → review item, decision stands
       ×7 (ADR-0004, 0010, 0013, 0014, 0022, 0026, 0036)
Q-3    question raised by the refutation of ADR-0026's TigerBeetle-shaped objections:
       "does rejecting a parallel tax ledger still stand on its third reason?"   # was prose in the note
```

**Gaps found:**
- **G1.** A fact's source is sometimes a decision (ADR-0024 citing a measurement).
  - Proposal: a fact's source must be evidence, so import walks the chain back to the original read.
  - Where the chain can't be walked, import mints `source type: measurement, locator: unknown` and counts it.
- **G2.** ADRs carry their question only implicitly, in "facing …". Import mints `Q-<adr>` from that clause (`origin: import`) and the owner merges duplicates. ADR-0003 and ADR-0049 share Q-1 only after a merge. This is judgment, and it is queued as triage rather than done silently.
- **G3.** HOT-025 is not two records disagreeing. It is a ruling whose implementing decisions are still `proposed`. The proposed `supersedes` links already carry that, so the question board shows "accepted decisions with a proposed superseder" as a standing view, and no hand-made record is needed.
- **G4.** Legacy arguments: the seven ADRs' premises exist as prose, and only some exist as `asserts:`.
  - Import mints them as `argument basis: factual, origin: import`.
  - The census reports how many legacy decisions have **no argument tree at all**. The legacy corpus stays mostly flat, and that number keeps the gap visible.
- **G5.** Spec state derived from decision state: `stack` status derives (§3).
- **G10.** **Full IBIS showed a distinction the flat model didn't.** A refuted supporting argument does not undermine a decision that has other standing supports. The seven-ADR correction is exactly that case ("their decisions stand"), and the tree computes it.
  - ⚠️ That is only true if "stands on its other supports" is a valid inference. It isn't always: one support can be load-bearing.
  - Proposal: a refuted support always raises a review item, and the owner rules "still stands" by marking it.

### 7b. An accounting decision with its survey (ADR-0029, the ledger does not allocate)

```yaml
Q-4    question  "does cost allocation post to the GL?"
OPT-5  option    "the ledger never allocates; allocation is a specified report"     → chosen
  ARG-10 supports OPT-5 factual  "allocation is destructive; grouping is not"   (Context, bullet 1)
OPT-6  option    "allocation posts to the GL"                                      → rejected
ADR-0029  decision  proposed 2026-08-09  accounting_shaped: true  answers Q-4  chooses OPT-5
# accept → REFUSED: accounting_shaped, no survey cited
SRC-e  source type: survey  2026-08-20  inbox/2026-08-20-survey-nobody-keeps-allocations-out-of-the-ledger-…md
FACT-2..7  qualitative, one per reference (GAAP, Xero, SAP, NetSuite, Intacct, Odoo): posts to GL? grain kept?
  ARG-11 objects_to ARG-10 factual "destructiveness belongs to one implementation, not to allocation:
         SAP distribution, NetSuite credit-account mode and an Intacct segregated book all keep the grain"
         cites FACT-4, FACT-5, FACT-6                                              # = HOT-021
  ARG-11 raises → OPT-7  option "keep the allocation out of the STATEMENTS, not the ledger"   # the unconsidered option
# accept → REFUSED: ARG-10 is contested
# 2026-08-22 redraft: ARG-10 withdrawn; new supports written against the survey; OPT-7 argued and rejected
# 2026-08-26 accept: owner via CLI, citing SRC-f (the m4 batch ruling, commit 691b578)
#   preconditions: survey ✓; no refuted or undermined support ✓; objections answered or accepted_cost ✓
#   accepted_cost: "the un-allocated view shows the largest product line at a structural loss"  (the ADR's "accepting")
```

**Gaps found:**
- **G6.** **Withdraw vs refute.** ARG-10 was withdrawn in a redraft, not refuted by the owner, and the history shows which one happened. Both states exist (§6).
- **G7.** **HOT-021 is an objection argument, not a separate record.** Acceptance is refused while ARG-10 is contested, which is exactly what HOT-019, HOT-020 and HOT-021 were opened to enforce by hand.
- **G8.** The survey's per-reference rows are qualitative facts (`unit: qualitative`). The census counts them separately, because they can't be compared mechanically.
- **G9.** One batch ruling (the m4 batch: ADR-0020, -0025, -0027 and -0029) is one `source` cited by four `accept` events. That fits the model.
- **G11.** **The survey produced a new option**, OPT-7, through `raises`. IBIS has a place for "the option nobody considered". The flat model would have left it in prose.

## 8. Discovery and enforcement rules

| Rule | Fires on | Does | Blind spot it reports |
|---|---|---|---|
| **undeclared mention** | an id in any prose field with no link from that record | proposes `relates_to` for triage | mentions that resolve to nothing |
| **restatement** | an argument's `claim`, or a `fact.value`, appearing in prose outside an `{{id}}` reference | flags the prose; proposes `cites` | **paraphrase is not detected**: exact and normalised-numeric only |
| **link-or-dismiss** | every proposed link | waits in the triage queue; a rejection is remembered | queue length; age of the oldest |
| **contradiction → conflict** | a proposed `contradicts` | drafts a `conflict` question | — |
| **refutation ripple** | an argument going `refuted` | marks everything above it `undermined`; raises review items on decisions | — |
| **post-acceptance drift** | an edit or new objection inside an accepted decision's tree | marks `changed_since_acceptance`; raises a review item | — |
| **superseded justification** | a spec record whose decision is superseded | review item | spec records with empty `justified_by` |
| **flat legacy** | an accepted decision with no argument tree | census line | count |
| **term alias** | `term` create, or a noun in a requirement matching an alias | refuses or warns | — |
| **lesson surface** | a write touching a `lesson.trigger` | shows the lesson | lessons with no trigger |
| **v1-only census** | target-state records whose every source is `v1-read` / `code-read` | census line (erp-spec#52) | — |
| **expiring exemption** | `exemption.expires` passed | refuses the exempted transition | `never` exemptions |
| **lost provenance** | facts whose source is a `locator: unknown` placeholder | census line | count, by domain |
| **inline-answer census** | questions answered inline | census line | ⚠️ standing line: `N answered inline, M of them in an accounting domain (LED/BIL/TAX/FA/BNK) — the survey check does not see these` |
| **nesting is unchecked** | — | — | ⚠️ standing line: nothing verifies that a response actually answers its target; only the owner's ruling does |

Every rule prints `checked N, flagged M, not checked K (why)`.

## 9. Rulings

- ✅ **R1 — Full IBIS (owner, 2026-10-11: _"go full ibis"_).** The recommendation was flat arguments with no nesting. It was overruled after the downsides were set out. Accepted downsides, and how each is contained:
  - **Prose and tree duplicate each other.** Contained by: the body cites arguments by id, and the restatement rule flags exact restatement.
  - **Nothing checks nesting.** Contained by: a standing blind-spot line in §8.
  - **The legacy corpus stays flat.** Contained by: G4 import, plus the flat-legacy census.
  - **Owner triage load.** Contained by: arguments need no confirmation; only `refutes`, `contradicts` and `supersedes` do.
  - **Freeze semantics.** Contained by: acceptance pins a log position (§6).

  In favor, and decisive: agents write most records, so the capture cost that killed earlier rationale tools is far lower here.
- ✅ **R1a — Pinned arguments stay editable after acceptance (owner, 2026-10-11: _"a, as long as the log is recording change history"_).**
  - The as-decided view is reconstructed from change history; edits after acceptance are marked.
  - Conditional on §2's requirement: complete, same-transaction, unbypassable change history, enforced by the database. Mechanism ruled a Phase 2 choice (owner, 2026-10-11).
  - Still open inside it: should `clauses[]` and `body` lock harder than arguments? The recommendation is no, for the same reason, because the marker and the history cover them.
- ✅ **R3 — Only ADRs are decisions (owner, 2026-10-11: option b).** The recommendation was one decision kind in two forms, with the same checks on both. Ruled instead:
  - an ADR is the only `decision` record;
  - an OQ answer stays a field on its question (§3, §6);
  - inbox `kind: decision` notes and inline "(owner, date)" rulings import as `owner` sources, each attached as a question's `answer_source` or cited by an ADR. A ruling that matches no question gets a question proposed at import, for triage.

  Accepted consequence: the survey and accepted-cost checks do not apply to inline answers. The inline-answer census (§8) reports how many sit in an accounting domain, so that gap stays a visible number. If it bites, the cheap fix is a rule that an accounting-domain question can only be answered by an ADR. That is noted here, not adopted.
- ✅ **R2 — Every fact names its source (owner, 2026-10-11: option a).** A fact is shown in its source's context; the facts "registry" is a view across sources. A fact whose origin is lost gets a placeholder `source` (`type: measurement`, `locator: unknown`), counted in the census.

  The reasoning, as recommended: A figure without the read that produced it is the "present but wrong" failure: it passes every existence check. (a) still gives each figure one owner to cite as `{{FACT-n}}`. The cost is that a fact with a lost provenance can't be entered without minting a placeholder source, which is G1's `locator: unknown`, counted. ADR-0037 rejected a registry for a different reason (it splits a claim from its reasoning), and full IBIS removes that reason, because the reasoning now lives in arguments that cite the fact.
- ✅ **R4 — Legacy ids (owner, 2026-10-11: recommendation accepted).**
  - Every existing id resolves forever: `ADR-`, `OQ-`, `HOT-`, `REQ-<CTX>-`, `EVT-<CTX>-`, `SPIKE-`, plus claim ids like `ADR-0049/P1`. There are 5,041 prose mentions, many in ADR bodies imported word for word.
  - **An alias is a pointer, not a second id.** A record has exactly one id; an `alias(old, record_id)` table maps old forms to it. Prose, search and links accept either form, and the record page shows both.
  - **New records mint per-kind prefixes:** `SRC-`, `FACT-`, `CAP-`, `Q-`, `OPT-`, `ARG-`, `LSN-`.
  - **Kinds with an existing series keep it:** `ADR-` (0056 next), `REQ-<CTX>-`, `EVT-<CTX>-`, `SPIKE-`.
  - **New questions mint `Q-` whatever their subtype.** A question can change subtype mid-discussion (open ↔ conflict), so the id must not claim one. `OQ-`/`HOT-` ids stay as aliases of the questions they name.
- ✅ **R5 — No annotation kind (owner, 2026-10-11: option b; this reverses the draft).**
  - A correction to evidence is **new evidence**: a `fact` or `source` with its own date and provenance, plus a `corrects` link. The old record shows a "corrected by" banner.
  - Example: ADR-0001's 28.7% figure (share of revenue with no product line) becomes a fact corrected by the 2026-08-10 re-measurement ($688.00, 0.041%).
  - Corrections that are not measurements (for example, a misattributed quote) are minted as a `source` of type `research` or `owner`.
  - Non-correction context notes are `capture`s linked to their target.
  - Spec and deliberation records are edited, with history, or argued against.
- ~~R6~~ **Withdrawn.** It asked whether the new repo owed erp-spec a record of departing from ADR-0037. Under the inform-don't-bind rule it doesn't: the evidence is cited where relevant, and nothing more is needed.
- ✅ **R7 — Design work lives in the tool; GitHub issues are for code (owner, 2026-10-11).** The recommendation was to keep tasks in GitHub. Overruled: _"gh issues etc.. should be for the codebase, not the project the codebase exists to support … the project manager is the gh project. the erp spec is the project that project manager exists to design"_. Revisit only if GitHub becomes the database, which the owner does not expect.
  - **In the tool:** investigations, owed surveys, drafting, reviews, import triage and milestones: everything that moves the ERP design forward (§3 Work).
  - **In GitHub:** work on code, both the spec tool's own repo and the ERP repos once implementation starts. A design task that needs code changed carries a `code_issue` URL. Nothing is mirrored in either direction.
  - **Consequences for later phases:**
    - **Phase 4 import splits erp-spec's open issues.** Design-work issues (for example erp-spec#66, a survey owed; erp-spec#67, the SPIKE-014 investigation) import as `task`s. Issues about erp-spec's own tooling (validate gates, generated files, CI) are code work: they close when the tool replaces erp-spec, or move to the new repo's issues if they still apply.
    - **The workspace `CLAUDE.md` rule "Deferred tasks → GitHub issues" needs a carve-out at cutover (Phase 5).** Deferred design work goes into the tool, and code work stays in issues. The same carve-out applies to the `cfs-issues` skill and erp-spec's own "Deferred work" section. Until cutover, erp-spec issues remain the queue.
    - **The `done_when` / `produced[]` pair is the plan-docs rule made structural:** every item carries its proof, and a task closed with nothing to show for it is refused.

## 10. Not decided here (Phase 2)

- Storage engine — **constrained by §2: complete, same-transaction change history, enforced by the database.** Candidates for the history mechanism:
  - **Tables + trigger-written history** (Claude's lean). Current state is ordinary tables, so FKs and CHECKs and the §6 preconditions sit on real tables. Triggers write before/after into a history table in the same transaction, copying `actor`/`verb` from `SET LOCAL` session settings. Gaps to close: `TRUNCATE` needs a statement trigger or a revoked grant; disabling triggers needs table-owner rights, so it is a permissions rule. Works the same in SQLite (except there are no session settings, so actor/verb go through a per-transaction context row).
  - **Log-first (event sourcing).** The log is canonical and state is a projection. Intent is native. But constraints have to be enforced against a projection, and a replay engine has to be maintained.
  - **Native system-versioned (SQL:2011 temporal) tables**, if Postgres 18 has them. **Unverified, so check before relying on it.**
  - **In addition, not instead:** a post-commit sink (Postgres logical replication → git text export / archive), with a continuity check that reports gaps. Logical decoding emits no DDL and needs `REPLICA IDENTITY FULL` for before-images; `pg_logical_emit_message` can carry intent in the same transaction. SQLite has no logical decoding, so its export is a periodic dump.
  - Postgres versus SQLite for this tool is still open. The plan leaned SQLite; Postgres adds hosting cost.
- Front end, hosting, agent write path, search.
- Whether git stays canonical or becomes the text export.
- The new repo's name.

## 11. Sign-off

Phase 1's proof, per `spec-system-v2.md`, is the owner's sign-off recorded here. Before signing, check:
- §2: the layers, and the change-history requirement;
- §3: every kind and its fields;
- §4: relations;
- §5: vocabularies;
- §6: preconditions;
- §8: discovery rules.

These were drafted around the rulings and have not been reviewed line by line. §7's slices are the test that they hold on real material.

- [x] **Owner sign-off: given 2026-10-11** (_"apprived"_, in the Phase 1 session). This model is the basis for Phase 2.

## Context recommendation
**Context:** CLEAR CONTEXT — signed off; every ruling and its reasoning is recorded here, so Phase 2 starts cold from this doc.
**Execute with:** opus — information-model design, where a plausible wrong model passes every check.
