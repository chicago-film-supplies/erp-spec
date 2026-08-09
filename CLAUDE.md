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
| `contexts/`, `ledger/`, `migration/`, `roadmap/` | refactored freely | structured spec, CI-validated |
| `adr/` | **immutable once `accepted`** | superseded by a new ADR, never edited |

Nothing goes straight into a `requirements.yaml`. Everything enters `inbox/` and is **promoted**
at triage. Promotion writes `promotes_to:` into the inbox file and `source:` into the target.
Nothing is ever deleted.

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

1. **Verify structural assumptions against the live CFS API before writing them as fact.**
   Read-only queries only (`mcp__cfs-api-prod__db_*`). Unverified assertions get
   `verified: false` and an `OQ-`.
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
9. Prose style: bulleted, terse, no hedging, no filler preamble. Empty sections get a bare
   `TODO`, not placeholder prose.

## Two rules that exist because the current system broke on them

Both are already enforced in the `~/cfs` workspace and both are load-bearing here:

- **A guard that can only consult its own oracle is not a guard.** A fixed-point check — "the
  stored value equals what the recompute produces" — is defined in terms of the normalizer and
  can only ever agree with it. Pair every such check with a property that holds independently.
- **A stated guarantee that nothing executes is not a guarantee.** If this repo asserts an
  invariant, something in `deno task validate` has to be able to fail on it. Land new gates
  **red**, watch them bite, then fix the data.

## Verification etiquette

The live CFS API is production. `db_*` reads are safe and are the point. Do not write, and do
not reach Xero or CRMS from here at all — both are single-tenant and live, and Xero's daily
quota is a shared exhaustible resource (workspace `CLAUDE.md` → *External systems*).

Record a verification as a `source:` of the form `verified:2026-08-08:db_invoices_query` plus
the number you actually measured. **Record the measured value as a number, not as "confirmed"** —
a signal that does not flip is itself a finding.

## Deferred work

Anything identified but not finished in a session becomes a GitHub issue on
`chicago-film-supplies/erp-spec` before the session ends. Do not park deferred work only in
conversation summaries or TODO comments. Search for an existing issue first.

Open questions are different from deferred work: an `OQ-` is a *decision* someone must make, and
lives in `open-questions.yaml` with an owner and a decide-by date. A GitHub issue is *work*
someone must do.
