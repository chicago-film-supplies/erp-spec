# Quint

Executable specification language on the same foundation as TLA+ (Lamport's temporal logic of
actions), with modern syntax and a real CLI. **Adopted by [[ADR-0016]]** (accepted): every spec in
`formal/` is Quint (`two-store-commit.qnt`, `period-close.qnt`), and the `.tla` stubs they replaced
were deleted unexecuted. [[ADR-0054]] (proposed) makes the specs the oracle for v2's verification
layers.

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

## Version (checked 2026-10-09)

- npm `@informalsystems/quint` **0.33.0** is the latest (`npm view`, 2026-10-09). The recorded
  `formal/` runs used **0.32.0**, and that is the pin: `formal/expectations.yaml` owns it and
  `deno task formal` runs exactly that version (erp-spec#69).
- `quint verify` needs **Java 21** for Apalache, which it downloads on first use.

## CLI

- `quint typecheck` — type verification.
- `quint run` — the simulator: random executions of the spec, checking an invariant on each.
- `quint test` — runs the `run` declarations **written inside a `.qnt` file**: unit tests of the
  spec, by the spec. ⚠️ **It is not model-based testing.** Model-based testing drives the
  _implementation_ from the spec and compares, which is a separate layer ([[ADR-0054]] D1, layer 3)
  with its own tooling. This note conflated the two until 2026-10-09.
- `quint verify` — bounded model checking, backed by **Apalache**.

## CFS-specific gotchas / fit

- **Apalache underneath.** `quint verify` hands the spec to Apalache, the symbolic model checker
  from the TLA+ ecosystem. Bounded: a violation needing more steps than `--max-steps` is not found.
- **The `formal/` rule:** "a spec that has never been model-checked is prose with angle brackets."
  Milestone `m5`'s exit criterion is a **recorded checker run**, not a written spec.
- **Every spec carries a fail-closed companion** that must FAIL (`formal/README.md`); [[ADR-0054]]
  D3 makes that a rule for every model-based and trace check too. A run in which the companion
  passes is a broken model, not a safe protocol.
- **`two-store-commit.qnt` loses its subject under [[ADR-0049]]** (one store, no cross-store
  commit). It stays while [[ADR-0023]] (accepted) cites it, and is marked superseded in
  `formal/README.md` once ADR-0049 is accepted.

## Decision status

- Quint is decided ([[ADR-0016]], accepted), and runs in CI: `deno task formal` in the `formal`
  workflow checks every module against `formal/expectations.yaml`.

Cross-refs: [[SPIKE-002]] · `formal/two-store-commit.qnt` · `formal/period-close.qnt` · [[ADR-0016]]
· [[ADR-0054]]
