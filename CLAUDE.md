# CLAUDE.md — erp-spec

Planning repo for the greenfield CFS ERP. **No implementation code lives here.** The output is a
`spec-v1` tag.

This repo sits inside the `~/cfs` workspace, so the workspace `CLAUDE.md` one level up also
applies. Read it for what the *current* system does — its money rules, date canonicalization,
items-array invariants, and the Xero/CRMS traps are the hard-won knowledge this rebuild has to
carry forward rather than re-learn. Where the two disagree about the *target* system, this file
wins.

## Three lifecycles, never mixed

| Directory | Mutability | Rule |
|---|---|---|
| `inbox/`, `research-drop/` | append-only | raw capture, one idea per file, never rewritten |
| `contexts/`, `ledger/`, `migration/`, `roadmap/`, `spikes/` | refactored freely | structured spec, CI-validated |
| `adr/` | **immutable once `accepted`** | superseded by a new ADR, never edited |

Nothing goes straight into a `requirements.yaml`. Everything enters `inbox/` and is **promoted**
at triage. Promotion writes `promotes_to:` into the inbox file and `source:` into the target.
Nothing is ever deleted.

**The one exception to "no implementation code".** Measurement code that produces spike evidence
and implements nothing in the target system lives in `spikes/harness/`. It is the same category as
`tools/`: it exists so a claim in a spike's `## Notes` can be re-run rather than believed. The rule
is unchanged everywhere else — nothing in `contexts/`, `ledger/` or `adr/` is executable, and the
harness may never be imported by anything that ships. Underscore-prefix any `.md` you put under
`spikes/`, because `validate.ts` recurses and demands front matter on every `.md` it finds.

## ID formats

Never reused, never renumbered — including after deletion.

| Kind | Pattern | Example |
|---|---|---|
| Requirement | `REQ-<CTX>-<3d>` | `REQ-LED-014` |
| Decision | `ADR-<4d>` | `ADR-0007` |
| Event | `EVT-<CTX>-<3d>` | `EVT-FUL-002` |
| Hotspot | `HOT-<3d>` | `HOT-004` |
| Open question | `OQ-<3d>` | `OQ-011` |
| Spike | `SPIKE-<3d>` | `SPIKE-001` |

Context codes: `LED` ledger · `FUL` fulfillment · `BIL` billing · `FA` fixed-assets ·
`ORD` ordering · `AVL` availability · `BNK` banking · `TAX` tax.

## Generated files

Carry `.generated.` in the filename and a header comment. Never hand-edited. Currently:

- `STATUS.generated.md` — the dashboard: what is undecided, blocked, or uncovered
- `spec-map.generated.opml` — the whole spec as a mind map (MindNode / Xmind / any outliner)
- `adr/in-force.generated.md` — accepted, not superseded
- `traceability/matrix.generated.json` — REQ ↔ ADR ↔ event ↔ scenario ↔ inbox source

CI regenerates them and fails on a diff, so a stale generated file is a build break, not a
silent lie.

**Generated files must read no clock.** `generate.ts` may not call `new Date()`, and must reduce
any YAML-parsed date to a UTC calendar day — a generated file that changes on its own turns the
stale-file gate red on unrelated pushes, and the gate stops meaning anything. Time-dependent
judgements (has a `decide_by` passed? is an ADR past its `review_by`?) belong in `validate.ts`,
which writes nothing and is therefore free to read the real date.

Two bugs have already come from the second half of that rule: YAML parses an unquoted
`date: 2026-08-08` into a JS `Date`, whose `String()` renders in the **runner's** timezone. It
made `generate.ts` machine-dependent and produced `inbox/` filenames beginning
`Fri Aug 07 2026 19:00:00 GMT-0500 (...)`.

## Rules for Claude Code working in this repo

1. **Verify structural assumptions before writing them as fact** — against the live CFS API for
   claims about data (read-only `mcp__cfs-api-prod__db_*`), against the repo for claims about code
   or infra. Both count as verification; see *Verification etiquette* for the dated, pinned
   `source:` forms. Unverified assertions get `verified: false` and an `OQ-`.
2. Every requirement needs a `source:` — an inbox file, an ADR, or a verification query. No
   unsourced requirements.
3. Never mark an ADR `accepted` on your own initiative. Draft as `proposed`.
4. Requirements are implementation-free. "The system shall record the acting crew member on
   every leg" — not "add an `actor_id` column".
5. When two spec statements contradict, open a `HOT-` hotspot. Do not silently pick one.
6. Check `glossary.yaml` aliases before introducing a new term. Prefer editing over
   near-duplicating.
7. **Money is integer minor units everywhere.** No floats, no decimal strings, in any schema.
8. **Accounting date and posting timestamp are always distinct fields.** Never conflate.
8a. **Survey before deciding anything accounting-shaped** — see *Accounting decisions* below. Not
    optional, and not only for the hard ones.
9. Prose style: bulleted, terse, no hedging, no filler preamble. Empty sections get a bare
   `TODO`, not placeholder prose.
10. **Before writing spec that touches a stack tool, read its note in `research-drop/reference/`**,
    then the cached upstream dump in `.claude/docs/` if you need the mechanics. Curated,
    Claude-facing references for the target stack (Deno, Hono, Zod, MongoDB, TigerBeetle,
    DuckDB, Quint, Valkey, Caddy): the project-specific traps, cross-linked to
    the ADRs and spikes. Not spec, not ingested, not validated — see `research-drop/reference/README.md`.

## LLM reference docs

Two halves, and the order matters. The **curated note** (`research-drop/reference/<tool>.md`) carries
what upstream cannot know — which ADR adopted the tool, what is still undecided, the trap that bit
us. The **cached dump** (`.claude/docs/<tool>.txt`, gitignored) carries upstream's own reference
material, refetched by `deno task fetch-llms-docs` when the local copy is over 24h old.

The session-start digest (`.claude/hooks/stack-digest.sh`) lists both, **derived from the
filesystem** — which is why there is deliberately no table of filenames here. A hand-maintained
list is exactly what rots: `api-cloudrun/CLAUDE.md` still instructs the model to read a
`.claude/docs/eta.txt` its fetcher has never once been permitted to write.

Not every tool has an upstream dump, and the difference is worth knowing before you go looking:

- **Full reference** — TigerBeetle, Hono, Zod. Read the cached file; grep it by heading.
- **Link index only** — MongoDB, DuckDB, Quint (`llms-full.txt` 404s on all three, checked
  2026-08-09). The cached file is a routing table; follow a link with WebFetch for the content.
- **Nothing upstream** — Valkey, Caddy publish no `llms.txt` at all. The curated note is the source.
- **Quint** also ships official agent skills, enabled as a plugin in `.claude/settings.json` —
  those beat both halves for authoring `.qnt`.

## Two rules that exist because the current system broke on them

Both are already enforced in the `~/cfs` workspace and both are load-bearing here:

- **A guard that can only consult its own oracle is not a guard.** A fixed-point check — "the
  stored value equals what the recompute produces" — is defined in terms of the normalizer and
  can only ever agree with it. Pair every such check with a property that holds independently.
- **A stated guarantee that nothing executes is not a guarantee.** If this repo asserts an
  invariant, something in `deno task validate` has to be able to fail on it. Land new gates
  **red**, watch them bite, then fix the data.

## Accounting decisions: survey before deciding

**Standing instruction from the owner, 2026-08-09.** Any decision about where something posts, what
an account means, how two books relate, or how a document is presented is researched against **five
references before a recommendation is made**:

| | What it settles |
|---|---|
| **GAAP** | what the presentation rule actually requires — and it is usually narrower or stricter than the shape everyone builds |
| **SAP S/4HANA** | the most configurable answer; its *mechanisms* (special G/L indicators, non-posting depreciation areas, ledger groups) name the distinctions worth having |
| **NetSuite** | the mid-market default, and its docs state GL impact per transaction type explicitly |
| **Sage Intacct** | the same tier, different opinions — where it and NetSuite disagree there is a real choice |
| **Odoo** | the open-source answer, and the one whose *absence* of a feature is informative: its documented workarounds show what the shape costs when it is not built in |

Two things the survey is for, and only the first is obvious:

- **The default.** What four systems do by default is not automatically right, but differing from all
  four is a claim that needs an argument.
- **The CRITERION.** More valuable than the default. The tax-book survey found the systems split on
  whether a tax book posts — but agreed on *why* (does the book need its own trial balance). The
  credit-balance survey found all four put a credit note in AR — but the line they all drew was "is
  this value attached to a billed sale", and **CFS's credit notes fail that test on their own data
  model**, so following the criterion and departing from the default was the correct read. A survey
  that only collects defaults gets this backwards.

Practitioner material counts and is sometimes the best evidence: a consultancy publishing *how to
work around* a product's default is a measurement of what that default costs. Cite it.

Record the survey in `inbox/` with the links, dated, before it is cited by an ADR — the survey is
evidence and evidence is append-only. Worked examples:
`inbox/2026-08-09-tax-and-gaap-statements-are-both-required.md` and
`inbox/2026-08-09-unallocated-credit-has-no-home-in-ar.md`.

## Verification etiquette

The live CFS API is production. `db_*` reads are safe and are the point. Do not write, and do
not reach Xero or CRMS from here at all — both are single-tenant and live, and Xero's daily
quota is a shared exhaustible resource (workspace `CLAUDE.md` → *External systems*).

**Two kinds of verification count, and both set `verified: true`.** Both must be dated and pinned
to something that can go stale, because an undated claim silently becomes a lie:

| Kind | `source:` form |
|---|---|
| Live CFS API — a read-only `db_*` query | `api:2026-08-09:db_invoices_query` + the number measured |
| Repo source or infra — a file actually read | `code:2026-08-09:api-cloudrun@1d3387bd:src/lib/taskQueues.ts` + the number measured |

- **Pin a source read to the commit sha**, not the release tag. A tag identifies what is
  *deployed*; a sha identifies what was *read*. Add the tag as well (`@v0.140.0`) only when the
  claim is about live behaviour rather than about the code.
- **Record the measured value as a number, not as "confirmed"** — a signal that does not flip is
  itself a finding.
- `verified: false` means nobody checked, and it still earns an `OQ-`. It does not mean "checked,
  but only against source".

## Deferred work

Anything identified but not finished in a session becomes a GitHub issue on
`chicago-film-supplies/erp-spec` before the session ends. Do not park deferred work only in
conversation summaries or TODO comments. Search for an existing issue first.

Open questions are different from deferred work: an `OQ-` is a *decision* someone must make, and
lives in `open-questions.yaml` with an owner and a decide-by date. A GitHub issue is *work*
someone must do.
