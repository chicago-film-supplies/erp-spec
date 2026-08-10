# Quint

Executable specification language on the same foundation as TLA+ (Lamport's temporal logic of
actions), with modern syntax and a real CLI. The candidate modern path for the `formal/` specs
(`two-store-commit.qnt`, `period-close.qnt`). The `.tla` stubs they replaced were never executed.

## Canonical docs

- Docs: <https://quint.sh/docs> (`quint-lang.org/docs` redirects here)
- Language manual, CLI manual, built-in operators under Reference.
- Source: <https://github.com/quint-co/quint> (was `informalsystems/quint`; independent since 2025)
- **Official agent skills: <https://github.com/quint-co/quint/tree/main/skills>** — `quint-lang`
  (guidelines for CLI, operators, patterns, constraints, simulations, tests, choreo) and
  `quint-modeling` (from-code, from-nothing, from-requirements, **from-tlaplus**, review; plus
  worked `.qnt` examples). **Already enabled** for this repo — `.claude/settings.json` adds the
  `quint-co/quint` marketplace and turns on the `quint@quint` plugin. They beat this note for
  anything hands-on; `from-tlaplus.md` is the direct path for the `formal/` stubs.
- `llms.txt` exists but is a **link index only** (5,673 B); `llms-full.txt` 404s. It is cached at
  `.claude/docs/quint.txt` as a routing table, not as reference content.

**Correction, 2026-08-09.** This note previously credited `quint-co/quint-llm-kit` with shipping
installable Claude Code skills named `quint-lang`, `quint-modeling` and `quint-execute-spec`. Two of
those three claims are wrong. The kit is a **Docker** development environment (Quint CLI + LSP + MCP
servers + `agentic/agents/*.md`) and contains **no `skills/` directory**; the installable skills
live in the main `quint-co/quint` repo, and there are **2**, not 3 — `quint-execute-spec` does not
exist. Source: `api:2026-08-09:github-trees:quint-co/quint@main` (970 paths, `skills/quint-lang` +
`skills/quint-modeling`, plus `.claude-plugin/marketplace.json` declaring **1** plugin named
`quint`) and `api:2026-08-09:github-trees:quint-co/quint-llm-kit@main` (0 paths under `skills/`).
The kit remains interesting if containerised Quint work starts — it is not a skills source.

## Version (checked 2026-08-09)

- Docs last updated 2026-06-15. Confirm locally with `quint --version`.

## CLI

- `quint typecheck` — type verification.
- `quint run` — simulator; random-explore executions of the spec.
- `quint test` — model-based tests.
- `quint verify` — model checking, backed by **Apalache**.

## CFS-specific gotchas / fit

- **Same checker underneath.** Quint transpiles to TLA+ and drives Apalache, so adopting Quint does
  **not** abandon the TLA+ toolchain in `formal/` — it is a nicer front end to the same
  verification.
- **The `formal/` rule holds either way:** "a spec that has never been model-checked is prose with
  angle brackets." Milestone `m5`'s exit criterion is a **recorded checker run**, not a written
  spec. `quint verify` is what produces that artifact.
- **`run`/`test` give executable exploration TLA+ lacks** — useful for enumerating the crash/retry
  interleavings in [[SPIKE-002]] before committing to a full `verify`.
- If a Go sidecar lands ([[ADR-0004]]), the extra network hop belongs in the model — Quint spec and
  TLA+ spec alike.

## Decision status

- `formal/` uses TLA+ today (run via `tla2tools.jar`). Introducing Quint is **not yet ADR'd** — open
  one before migrating the specs, so the choice is recorded rather than drifted into.

Cross-refs: [[SPIKE-002]] · `formal/two-store-commit.qnt` · `formal/period-close.qnt` · [[ADR-0004]]
· [[ADR-0016]]
