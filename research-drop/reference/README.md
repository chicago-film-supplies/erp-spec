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
- **Not vendored copies.** Each file is the CFS-specific half only: what upstream cannot know —
  which ADR adopted the tool, what is still undecided, the trap that bit us. Upstream's own
  reference material is cached *separately*, at `.claude/docs/<tool>.txt` (gitignored), refetched
  by `deno task fetch-llms-docs` when the local copy is over 24h old.

  **Read the note first, then the dump.** The dump is a local copy of a live source, so it can be
  stale by up to a day — and further if the fetch has been failing. `.claude/docs/MANIFEST.txt`
  records what was fetched and when; `.claude/hooks/stack-digest.sh` diffs it against what is
  actually on disk at session start and says so when a file is missing or the set is over a week
  old. Do not hand-edit anything under `.claude/docs/`; refetch instead.

## The stack

**Upstream coverage varies, and it is worth knowing which kind you are getting before you go
looking.** All statuses probed 2026-08-09.

| Tool | Role in CFS | Cached as | Upstream coverage |
|---|---|---|---|
| [TigerBeetle](tigerbeetle.md) | The ledger — double-entry enforced in the DB | `tigerbeetle.txt` | **full** — no `llms.txt` (404); single-page HTML dump, converted |
| [Hono](hono.md) | HTTP framework on Deno | `hono-full.txt`, `hono-index.txt` | **full** — `hono.dev/llms-full.txt` |
| [Zod](zod.md) | Boundary validation + the app-enforced half of the schema | `zod.txt` | **full** — `zod.dev/llms-full.txt` |
| [Deno](deno.md) | Runtime for the API; shared TS types with clients | `deno.txt` | **guide** — `llms-full-guide.txt`; the 2.5 MB `llms-full.txt` is skipped as too large |
| [MongoDB](mongodb.md) | Documents + masterfiles (orders, invoices, items tree) | `mongodb.txt` | **index only** — `llms-full.txt` 404s |
| [DuckDB](duckdb.md) | Read side over Parquet — dimensional reporting | `duckdb.txt` | **index only** — `llms-full.txt` 404s |
| [Quint](quint.md) | Formal specs (modern path for `formal/`) | `quint.txt` | **index only** — `llms-full.txt` 404s; but see below |
| [Valkey](valkey.md) | Job queues (ADR-0012); cache / socket fan-out undecided | — | **none** — no `llms.txt` (404) |
| [Caddy](caddy.md) | Reverse proxy / auto-HTTPS front (ADR-0013) | — | **none** — no `llms.txt` (404) |

An **index only** cache is a routing table, not reference content — follow one of its links with
WebFetch. For **none**, the curated note is the whole source.

## Version pins

Every file states the version checked **2026-08-09**. Re-verify the version and the `llms.txt`
URL when you next touch that tool — pins go stale silently.

## Note on Quint

Quint ships **official agent skills** — `quint-lang` and `quint-modeling`, in the main
[`quint-co/quint`](https://github.com/quint-co/quint/tree/main/skills) repo. They are **already
enabled** here: `.claude/settings.json` registers the `quint-co/quint` marketplace and turns on the
`quint@quint` plugin, so nothing needs installing. They beat this directory for anything hands-on,
and `quint-modeling/guidelines/from-tlaplus.md` is the direct path for the `formal/` stubs.

They are **not** in `quint-co/quint-llm-kit`, which this file previously claimed — that is a Docker
environment with MCP servers and no `skills/` directory. See [quint.md](quint.md) for the full
correction.
