# Quint

Executable specification language on the same foundation as TLA+ (Lamport's temporal logic of
actions), with modern syntax and a real CLI. The candidate modern path for the `formal/` specs
(`two-store-commit.tla`, `period-close.tla`), which are currently TLA+ **stubs**.

## Canonical docs

- Docs: <https://quint.sh/docs> (`quint-lang.org/docs` redirects here)
- Language manual, CLI manual, built-in operators under Reference.
- Source: <https://github.com/informalsystems/quint>
- **LLM kit: <https://github.com/quint-co/quint-llm-kit>** — ships installable Claude Code skills
  (`quint-lang`, `quint-modeling`, `quint-execute-spec`), MCP servers for Quint docs + LSP, and a
  `/spec:next` workflow. If Quint work is real, install these skills directly — they beat this note.
- No `llms.txt`; the LLM kit is the LLM-facing resource.

## Version (checked 2026-08-09)

- Docs last updated 2026-06-15. Confirm locally with `quint --version`.

## CLI

- `quint typecheck` — type verification.
- `quint run` — simulator; random-explore executions of the spec.
- `quint test` — model-based tests.
- `quint verify` — model checking, backed by **Apalache**.

## CFS-specific gotchas / fit

- **Same checker underneath.** Quint transpiles to TLA+ and drives Apalache, so adopting Quint does
  **not** abandon the TLA+ toolchain in `formal/` — it is a nicer front end to the same verification.
- **The `formal/` rule holds either way:** "a spec that has never been model-checked is prose with
  angle brackets." Milestone `m5`'s exit criterion is a **recorded checker run**, not a written
  spec. `quint verify` (or `tlc2.TLC` on the `.tla`) is what produces that artifact.
- **`run`/`test` give executable exploration TLA+ lacks** — useful for enumerating the crash/retry
  interleavings in [[SPIKE-002]] before committing to a full `verify`.
- If a Go sidecar lands ([[ADR-0004]]), the extra network hop belongs in the model — Quint spec and
  TLA+ spec alike.

## Decision status

- `formal/` uses TLA+ today (run via `tla2tools.jar`). Introducing Quint is **not yet ADR'd** —
  open one before migrating the specs, so the choice is recorded rather than drifted into.

Cross-refs: [[SPIKE-002]] · `formal/two-store-commit.tla` · `formal/period-close.tla` · [[ADR-0004]]
