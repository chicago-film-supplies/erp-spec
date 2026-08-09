# Deno

Runtime for the Hono API ([[ADR-0004]]), and the reason types are shared with the SolidJS clients
through one package. Also the runtime for this repo's own tooling (`tools/*.ts`).

## Canonical docs

- Docs: <https://docs.deno.com/>
- `llms.txt`: <https://docs.deno.com/llms.txt> · summary `llms-summary.txt` · full `llms-full.txt`
- AI entrypoint: <https://docs.deno.com/ai/>

## Version (checked 2026-08-09)

- Deno `2.x`.

## CFS-specific gotchas

- **This repo is already a Deno project.** `deno.json` defines the four tasks (`validate`, `triage`,
  `gen`, `ingest`) and imports `@std/yaml`, `@std/fs`, `@std/path` from JSR. Match that: JSR/`npm:`
  specifiers over a `node_modules` tree; add deps with `deno add`.
- **Permissions are narrow and deliberate.** `validate` runs `--allow-read --allow-env=SPEC_TODAY`
  only; `gen` gets `--allow-write` but must **read no clock** (CLAUDE.md — a generated file that
  changes on its own turns the stale-file gate red on unrelated pushes). Preserve that discipline in
  any new tool: time-dependent judgement belongs in `validate`, which writes nothing.
- **Native addons are the open risk.** TigerBeetle (`tigerbeetle-node`) and DuckDB
  (`@duckdb/node-api`) are node-api/native modules; clean loading under Deno is exactly what
  [[SPIKE-001]] and [[SPIKE-007]] exist to settle. Test under `deno run`, `deno test`, **and**
  `deno compile` — napi support differs across them.

Cross-refs: [[ADR-0004]] · [[ADR-0005]] · [[SPIKE-001]] · [[SPIKE-007]]
