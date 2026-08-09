# Stack reference — for Claude Code

Curated, Claude-facing reference notes for the target stack (Deno/Hono · MongoDB · TigerBeetle ·
DuckDB · Quint · Zod · Caddy). Read the relevant file **before** writing spec, entities, or
features that touch that tool — each one carries the project-specific traps that generic upstream
docs do not.

## What this directory is — and is not

- **Not spec.** Nothing here is a requirement, ADR, or event. It changes no `verified:` flag and
  sources no requirement.
- **Not a research-drop.** These files are never ingested. `deno task ingest` and `deno task gen`
  read only top-level `research-drop/*.md` and skip `_`-prefixed files; neither recurses into this
  subdirectory. `deno task validate` never walks `research-drop/` at all. So this directory is
  invisible to all three tools — no inbox items get minted from it, and it cannot trip the
  stale-generated-file CI gate.
- **Not vendored copies.** Each file is a pointer to upstream's own LLM docs (`llms.txt` where it
  exists) plus the CFS-specific notes. The upstream `llms.txt` is the live, full source; refresh
  from it rather than trusting a stale local dump.

## The stack

| Tool | Role in CFS | Canonical LLM doc |
|---|---|---|
| [Deno](deno.md) | Runtime for the API; shared TS types with clients | `docs.deno.com/llms.txt` |
| [Hono](hono.md) | HTTP framework on Deno | `hono.dev/llms.txt` |
| [Zod](zod.md) | Boundary validation + the app-enforced half of the schema | `zod.dev/llms.txt` |
| [MongoDB](mongodb.md) | Documents + masterfiles (orders, invoices, items tree) | `mongodb.com/docs/llms.txt` |
| [TigerBeetle](tigerbeetle.md) | The ledger — double-entry enforced in the DB | single-page docs dump |
| [DuckDB](duckdb.md) | Read side over Parquet — dimensional reporting | `duckdb.org/llms.txt` |
| [Quint](quint.md) | Formal specs (modern path for `formal/`) | `quint.sh/docs` + LLM kit |
| [Valkey](valkey.md) | Candidate cache / pub-sub / socket fan-out | curated (no `llms.txt`) |
| [Caddy](caddy.md) | Candidate reverse proxy / auto-HTTPS front | curated (no `llms.txt`) |

## Version pins

Every file states the version checked **2026-08-09**. Re-verify the version and the `llms.txt`
URL when you next touch that tool — pins go stale silently.

## Note on Quint

Beyond the doc links, `quint-co/quint-llm-kit` ships installable Claude Code skills (`quint-lang`,
`quint-modeling`, `quint-execute-spec`) plus MCP servers. If Quint work picks up, installing those
skills gives deeper support than these notes alone. See [quint.md](quint.md).
