# CLAUDE.md — erp-spec

Planning repo for the greenfield CFS ERP. **No implementation code lives here.** The output is a
`spec-v1` tag.

This repo sits inside the `~/cfs` workspace, so the workspace `CLAUDE.md` one level up also applies.
Read it for what the _current_ system does — its money rules, date canonicalization, items-array
invariants, and the Xero/CRMS traps are the hard-won knowledge this rebuild has to carry forward
rather than re-learn. Where the two disagree about the _target_ system, this file wins.

## Three lifecycles, never mixed

| Directory                                                   | Mutability                    | Rule                                            |
| ----------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `inbox/`, `research-drop/`                                  | append-only                   | raw capture, one idea per file, never rewritten |
| `contexts/`, `ledger/`, `migration/`, `roadmap/`, `spikes/` | refactored freely             | structured spec, CI-validated                   |
| `adr/`                                                      | **immutable once `accepted`** | superseded by a new ADR, never edited           |

Nothing goes straight into a `requirements.yaml`. Everything enters `inbox/` and is **promoted** at
triage. Promotion writes `promotes_to:` into the inbox file and `source:` into the target. Nothing
is ever deleted.

**An accepted ADR is a HISTORICAL RECORD of the decision as taken, not a statement of current fact**
(ADR-0034, resolving HOT-012). Three consequences, and the third is the one that gets forgotten:

| The ADR's decision                                  | What you do                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **changed**                                         | supersede — symmetric `supersedes` / `superseded_by`, which gate 6 checks                                                                                      |
| **changed, but the superseder is still `proposed`** | `supersedes_on_acceptance:` on the superseder. **One-way** — nothing is written onto the target, so it stays in force until something has actually replaced it |
| **stands, but left a question open**                | a **new narrow ADR** that `relates_to` it and supersedes **nothing** (ADR-0025 is the precedent)                                                               |
| **stands, but a fact it cited was wrong**           | **no new ADR.** A dated note in `inbox/`, plus a `hotspots.yaml` entry when it contradicts something                                                           |

- The body is frozen at acceptance — no errata block, no inline correction, no appended "see also".
  `relates_to` may still gain ids: it is an index, not a claim, and it is the correction index.
- **Superseding is for re-deciding, never for correcting.** Superseding ADR-0001 to fix a Context
  bullet would mean re-opening "replace Xero", which nobody is asking to reopen.
- ⚠️ **Immutability bites only at `accepted`.** ADR-0032 was amended substantially while `proposed`.
  Draft freely; acceptance is the irreversible act, and it is never Claude's to make (rule 3 below).
- ⚠️ **A supersession declared while `proposed` is one-way and gets its own field.** Writing
  `superseded_by` onto the target is what removes it from in-force (`generate.ts` reads
  `status === "accepted" && !superseded_by`), so declaring the link early would retire a decision
  before its replacement was accepted. `supersedes_on_acceptance:` records the intent without
  touching the target; **at acceptance three fields move together** — promote it to `supersedes`,
  and write `superseded_by` **and** `status: superseded` on the target. Gate 6 fails on an
  `accepted` ADR that still carries the promise, and on a `superseded_by` set without the matching
  status, so neither half can be forgotten (erp-spec#18).
- ✅ **Enforced by `validate` gate 14.** An accepted or superseded ADR carries `frozen_sha256:` in
  its front matter, recomputed over the body on every run — edit the body and CI goes red. **Front
  matter is not hashed**, which is what lets `relates_to` gain the id of a later correction and lets
  `status` / `superseded_by` be written when superseding.

**The one exception to "no implementation code".** Measurement code that produces spike evidence and
implements nothing in the target system lives in `spikes/harness/`. It is the same category as
`tools/`: it exists so a claim in a spike's `## Notes` can be re-run rather than believed. The rule
is unchanged everywhere else — nothing in `contexts/`, `ledger/` or `adr/` is executable, and the
harness may never be imported by anything that ships. Underscore-prefix any `.md` you put under
`spikes/`, because `validate.ts` recurses and demands front matter on every `.md` it finds.

## ID formats

Never reused, never renumbered — including after deletion.

| Kind          | Pattern          | Example       |
| ------------- | ---------------- | ------------- |
| Requirement   | `REQ-<CTX>-<3d>` | `REQ-LED-014` |
| Decision      | `ADR-<4d>`       | `ADR-0007`    |
| Event         | `EVT-<CTX>-<3d>` | `EVT-FUL-002` |
| Hotspot       | `HOT-<3d>`       | `HOT-004`     |
| Open question | `OQ-<3d>`        | `OQ-011`      |
| Spike         | `SPIKE-<3d>`     | `SPIKE-001`   |

Context codes: `LED` ledger · `FUL` fulfillment · `BIL` billing · `FA` fixed-assets · `ORD` ordering
· `AVL` availability · `BNK` banking · `TAX` tax.

## Generated files

Carry `.generated.` in the filename and a header comment. Never hand-edited. Currently:

- `STATUS.generated.md` — the dashboard: what is undecided, blocked, or uncovered
- `spec-map.generated.opml` — the whole spec as a mind map (MindNode / Xmind / any outliner)
- `adr/in-force.generated.md` — accepted, not superseded
- `traceability/matrix.generated.json` — REQ ↔ ADR ↔ event ↔ scenario ↔ inbox source

CI regenerates them and fails on a diff, so a stale generated file is a build break, not a silent
lie.

**Generated files must read no clock.** `generate.ts` may not call `new Date()`, and must reduce any
YAML-parsed date to a UTC calendar day — a generated file that changes on its own turns the
stale-file gate red on unrelated pushes, and the gate stops meaning anything. Time-dependent
judgements (has a `decide_by` passed? is an ADR past its `review_by`?) belong in `validate.ts`,
which writes nothing and is therefore free to read the real date.

Two bugs have already come from the second half of that rule: YAML parses an unquoted
`date: 2026-08-08` into a JS `Date`, whose `String()` renders in the **runner's** timezone. It made
`generate.ts` machine-dependent and produced `inbox/` filenames beginning
`Fri Aug 07 2026 19:00:00 GMT-0500 (...)`.

## Rules for Claude Code working in this repo

1. **Verify structural assumptions before writing them as fact** — against the live CFS API for
   claims about data (read-only `mcp__cfs-api-prod__db_*`), against the repo for claims about code
   or infra. Both count as verification; see _Verification etiquette_ for the dated, pinned
   `source:` forms. Unverified assertions get `verified: false` and an `OQ-`.
2. Every requirement needs a `source:` — an inbox file, an ADR, or a verification query. No
   unsourced requirements.
3. Never mark an ADR `accepted` on your own initiative. Draft as `proposed`.
4. Requirements are implementation-free. "The system shall record the acting crew member on every
   leg" — not "add an `actor_id` column".
5. When two spec statements contradict, open a `HOT-` hotspot. Do not silently pick one.
6. Check `glossary.yaml` aliases before introducing a new term. Prefer editing over
   near-duplicating.
7. **Money is integer minor units everywhere.** No floats, no decimal strings, in any schema.
8. **Accounting date and posting timestamp are always distinct fields.** Never conflate. 8a.
   **Survey before deciding anything accounting-shaped** — see _Accounting decisions_ below. Not
   optional, and not only for the hard ones.
9. Prose style: bulleted, terse, no hedging, no filler preamble. Empty sections get a bare `TODO`,
   not placeholder prose. 9a. **House spelling is US — `labor`, never the British `-our` form**
   (owner, 2026-08-16). ⚠️ The banned spelling is deliberately not written out here, because gate 17
   would fail on this file for naming it; **`SPELLINGS` in `tools/validate.ts` is the definition**
   and this is the pointer. Enforced there rather than left to memory — the identifiers already used
   `labor` (`labor_line`) while the prose said otherwise, and nothing could see the split. ⚠️
   **Three exemptions, all on lifecycle grounds**: `inbox/` and `research-drop/` are append-only; an
   `accepted` ADR is immutable and ADR-0001, ADR-0011 and ADR-0036 keep the old spelling permanently
   (ADR-0034 — a historical record of the decision as taken); and a citation of an append-only
   filename keeps that filename's spelling, because those files are never renamed.
10. **Before writing spec that touches a stack tool, read its note in `research-drop/reference/`**,
    then the cached upstream dump in `.claude/docs/` if you need the mechanics. Curated,
    Claude-facing references for the target stack (Deno, Hono, Zod, MongoDB, TigerBeetle, DuckDB,
    Quint, Valkey, Caddy): the project-specific traps, cross-linked to the ADRs and spikes. Not
    spec, not ingested, not validated — see `research-drop/reference/README.md`.

## LLM reference docs

Two halves, and the order matters. The **curated note** (`research-drop/reference/<tool>.md`)
carries what upstream cannot know — which ADR adopted the tool, what is still undecided, the trap
that bit us. The **cached dump** (`.claude/docs/<tool>.txt`, gitignored) carries upstream's own
reference material, refetched by `deno task fetch-llms-docs` when the local copy is over 24h old.

The session-start digest (`.claude/hooks/stack-digest.sh`) lists both, **derived from the
filesystem** — which is why there is deliberately no table of filenames here. A hand-maintained list
is exactly what rots: `api-cloudrun/CLAUDE.md` still instructs the model to read a
`.claude/docs/eta.txt` its fetcher has never once been permitted to write.

Not every tool has an upstream dump, and the difference is worth knowing before you go looking:

- **Full reference** — TigerBeetle, Hono, Zod. Read the cached file; grep it by heading.
- **Link index only** — MongoDB, DuckDB, Quint (`llms-full.txt` 404s on all three, checked
  2026-08-09). The cached file is a routing table; follow a link with WebFetch for the content.
- **Nothing upstream** — Valkey, Caddy publish no `llms.txt` at all. The curated note is the source.
- **Quint** also ships official agent skills, enabled as a plugin in `.claude/settings.json` — those
  beat both halves for authoring `.qnt`.

## Footguns — check these, they have all bitten

**Citing**

- **Gloss an id on FIRST mention in a file**: `ADR-0030 (vehicle cost into COGS)`,
  `OQ-050 (does the
  EOR reconcile per person)`. **≤12 words, ideally under 5.** Bare ids
  thereafter.
- A bare id is unreadable to everyone who did not write it — including you, next week. ⚠️ `title:`
  is 11–23 words and `question:` / `statement:` are sentences; **none of them is the gloss.** Write
  a short one.
- **Same for GL accounts: `#### - Name` on first mention** —
  `5801 - Cost of Goods Sold: Wages
  (Unabsorbed)`, then bare after. No new field needed;
  `ledger/chart-of-accounts.yaml` already carries `name`.
- Cite the ADR that DECIDED it, not the one that mentions it.

**Claims**

- Amending a body is not amending a decision. Sweep the **title, the summary blockquote**, the chart
  `reason`, the glossary term, golden-vector prose and every citation.
- Grep a claim with **two or more phrasings** before stating a count. A count from one search is a
  count of that search.
- Rename a file and its citations break — including inside the note doing the renaming.
- Accepting an ADR freezes its **premises**, not just its decision. Check what it asserts as fact.

**Figures**

- Before using a number, ask what it is a figure **OF** — which population, whose cost, what basis.
- Do not mint an account, branch or enum value before **measuring its population**.
- An **average IS a standard rate**, and produces a variance.
- A vendor total is not a per-item cost. Check the **granularity** of the source document before
  attributing it.
- "Present but wrong" beats "absent" at passing every existence check. Coordinates, denorms and
  defaults are where it hides.

**Checks**

- Land every gate **red** first. A gate that reads green while matching nothing is indistinguishable
  from one that passes.
- Ask what a gate does **NOT** check — and whether its silence means "clean" or "not looked at".
- An **incomplete** fix is invisible in a way a missing one is not. When something reports its
  successes, ask what reports its failures.
- A check that bans a word cannot name it; a check that diffs a tree fails on work in progress.
  Exempt by identity, and say why.
- Minting an account creates no posting rule. Nothing currently notices.
- ⚠️ **Piping a check into `tail`/`head` masks its exit code** —
  `deno task ci | tail -3 && git push` pushes on failure. Run the check, read it, then act.

**Data**

- Payroll, contact and customer exports carry PII. **Record structure and aggregates, never rows.**
- Xero: read from the Firestore mirror; the API is single-tenant, live, and quota is shared.
- ⚠️ **A platform's own error message is not a diagnosis, especially during an outage.** GitHub
  Actions failed in ~2s on 2026-08-17 saying "recent account payments have failed **or** your
  spending limit needs to be increased" — **billing was fine; it was a GitHub outage.** Check
  githubstatus.com before believing a stated cause: a generic message names the path it fell into,
  not the reason.

## Four rules that exist because something here broke on them

The first two are already enforced in the `~/cfs` workspace. All four are load-bearing here:

- **A guard that can only consult its own oracle is not a guard.** A fixed-point check — "the stored
  value equals what the recompute produces" — is defined in terms of the normalizer and can only
  ever agree with it. Pair every such check with a property that holds independently.
- **A stated guarantee that nothing executes is not a guarantee.** If this repo asserts an
  invariant, something in `deno task validate` has to be able to fail on it. Land new gates **red**,
  watch them bite, then fix the data.
- **An unexercised branch of a rule is a claim, not a capability.** Where a rule permits several
  options and only one has ever been used, assume the machinery behind the others does not work. It
  will look correct in review — the code reads fine, the gates are green, and nothing is stale.
  **Neither instance below was found by reading. Both were found by being the first to take the
  other branch**, and both had been wrong for as long as the option existed:
  - Rule 2 permits a requirement's `source:` to be an inbox file, **an ADR**, or a verification
    query. Every requirement cited an inbox note until 2026-08-16, so `generate.ts` wrote `source`
    into a field named `inbox_source` and built `adrs` from `relates_to` alone. The first
    ADR-sourced requirements therefore recorded **no ADR at all** — REQ-FUL-003/004/005 each cite
    ADR-0011 and all three were reported under `gaps.requirements_without_adr`. The traceability
    matrix was dropping the strongest link it had.
  - `tools/contexts.ts` says "THE registry — nothing else may hold a copy", and erp-spec#10
    consolidated four hand-maintained lists into it. `view.ts` held a **fifth**, hardcoded at eight
    contexts, so the live viewer silently omitted every procurement requirement and event. It
    survived the consolidation because **`view.ts` runs no gate and so could never go red.**

  So: when you are about to be the first to use a documented-but-untravelled path, go and check the
  artifacts that claim to cover it, rather than assuming they do.

- **A fact about a third-party API has ONE owner in the structured spec, and something executes
  against the API.** `research-drop/reference/tigerbeetle.md` said `user_data_128/64/32` were "the
  **only** per-transfer reference fields". That is an **exhaustiveness claim about someone else's
  software**, and nothing here could falsify it — so it was believed, and it propagated into
  erp-spec#3's title ("three fields, four claimants"), HOT-013's "three slots, six live claimants"
  and ADR-0026's "fifth claimant" aside. **Four artifacts, one error, all wrong together.**
  `Transfer.code` is a fourth field, and it had to be re-discovered **twice** — ADR-0035 found it
  and was rejected, then a correction note found it again. A fact that gets re-discovered is not
  recorded anywhere that counts.

  Two halves, and the second is the one that was missing:

  - **One owner.** `ledger/tigerbeetle-accounts.yaml` owns the transfer field budget.
    `research-drop/reference/` may explain the mechanics and must not restate the numbers — it is
    "not spec, not ingested, not validated" by its own README, and that is exactly why it must not
    be where an authority lives. ⚠️ **An `adr/` or `inbox/` file repeating the old number is NOT
    scatter to fix**: an accepted ADR is a historical record (ADR-0034) and an inbox note is dated
    evidence. Only _live, mutable, authority-claiming_ copies are the problem, and there were three.
  - **Something executes.** `spikes/harness/tb-field-budget_test.ts` reads `tigerbeetle-node`'s own
    `bindings.d.ts` and fails if any discretionary `Transfer` field is unnamed by the budget — **it
    fails CLOSED**, so a field the library grows is unaccounted-for by default rather than
    invisible. Fired red three ways, one of them reproducing the original miscount exactly. ⚠️ **It
    is not in CI, and that is a stated limit**: CI runs `deno task validate`, which has no npm
    dependencies by design, and the ground truth is an unvendored package. The harness is where
    claims about third-party APIs get executed; `deno task tb-budget`.

## Accounting decisions: survey before deciding

**Standing instruction from the owner, 2026-08-09.** Any decision about where something posts, what
an account means, how two books relate, or how a document is presented is researched against **six
references before a recommendation is made**:

|                  | What it settles                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAAP**         | what the presentation rule actually requires — and it is usually narrower or stricter than the shape everyone builds                                                                  |
| **Xero**         | **the incumbent — what CFS's own books say TODAY.** Not one vendor opinion among five: it is the current state, so departing from it is a migration cost and not only a design choice |
| **SAP S/4HANA**  | the most configurable answer; its _mechanisms_ (special G/L indicators, non-posting depreciation areas, ledger groups) name the distinctions worth having                             |
| **NetSuite**     | the mid-market default, and its docs state GL impact per transaction type explicitly                                                                                                  |
| **Sage Intacct** | the same tier, different opinions — where it and NetSuite disagree there is a real choice                                                                                             |
| **Odoo**         | the open-source answer, and the one whose _absence_ of a feature is informative: its documented workarounds show what the shape costs when it is not built in                         |

⚠️ **Xero is researched from its documentation and from CFS data already mirrored into Firestore —
never by calling the Xero API from this repo.** The tenant is single, live, and its daily quota is a
shared exhaustible resource (_Verification etiquette_, and the workspace `CLAUDE.md`). The CFS API's
read-only `db_*` tools already carry the Xero-derived fields, which is where a claim about the live
books comes from.

Three things the survey is for, and only the first is obvious:

- **The default.** What five systems do by default is not automatically right, but differing from
  all five is a claim that needs an argument.
- **The CRITERION.** More valuable than the default. The tax-book survey found the systems split on
  whether a tax book posts — but agreed on _why_ (does the book need its own trial balance). The
  credit-balance survey found all four put a credit note in AR — but the line they all drew was "is
  this value attached to a billed sale", and **CFS's credit notes fail that test on their own data
  model**, so following the criterion and departing from the default was the correct read. A survey
  that only collects defaults gets this backwards.
- **The MIGRATION DELTA, which only Xero can tell you.** ADR-0001 replaces Xero, so a departure from
  it has to be carried across history rather than merely designed. **State the delta, state what
  would measure it, then go and measure it** — an unmeasured migration cost is the kind of claim
  that hardens into a reason not to do something. The credit-note decision is the worked example,
  end to end. Xero credits AR at issue and 2050 does not, so the two disagree only while a note is
  unallocated; the measurable fact is whether any note was ever unallocated across a period
  boundary; and the measurement came back **zero** — 9 of 9 allocations in the same month as issue.
  The delta that looked like a cost is nil, and the same query turned up a real defect on the way
  (api-cloudrun#469). ADR-0020's "the restatement must not alter any amount" is what makes the size
  matter.

Practitioner material counts and is sometimes the best evidence: a consultancy publishing _how to
work around_ a product's default is a measurement of what that default costs. Cite it.

Record the survey in `inbox/` with the links, dated, before it is cited by an ADR — the survey is
evidence and evidence is append-only. Worked examples:
`inbox/2026-08-09-tax-and-gaap-statements-are-both-required.md` and
`inbox/2026-08-09-unallocated-credit-has-no-home-in-ar.md`.

## Verification etiquette

The live CFS API is production. `db_*` reads are safe and are the point. Do not write, and do not
reach Xero or CRMS from here at all — both are single-tenant and live, and Xero's daily quota is a
shared exhaustible resource (workspace `CLAUDE.md` → _External systems_).

**Two kinds of verification count, and both set `verified: true`.** Both must be dated and pinned to
something that can go stale, because an undated claim silently becomes a lie:

| Kind                                        | `source:` form                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Live CFS API — a read-only `db_*` query     | `api:2026-08-09:db_invoices_query` + the number measured                            |
| Repo source or infra — a file actually read | `code:2026-08-09:api-cloudrun@1d3387bd:src/lib/taskQueues.ts` + the number measured |

- **Pin a source read to the commit sha**, not the release tag. A tag identifies what is _deployed_;
  a sha identifies what was _read_. Add the tag as well (`@v0.140.0`) only when the claim is about
  live behaviour rather than about the code.
- **Record the measured value as a number, not as "confirmed"** — a signal that does not flip is
  itself a finding.
- `verified: false` means nobody checked, and it still earns an `OQ-`. It does not mean "checked,
  but only against source".

## Deferred work

Anything identified but not finished in a session becomes a GitHub issue on
`chicago-film-supplies/erp-spec` before the session ends. Do not park deferred work only in
conversation summaries or TODO comments. Search for an existing issue first.

Open questions are different from deferred work: an `OQ-` is a _decision_ someone must make, and
lives in `open-questions.yaml` with an owner and a decide-by date. A GitHub issue is _work_ someone
must do.
