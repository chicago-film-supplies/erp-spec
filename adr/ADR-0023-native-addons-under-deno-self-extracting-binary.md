---
id: ADR-0023
title: Native Node-API addons load under Deno; the deployment unit is a self-extracting compiled binary
status: accepted
date: 2026-08-09
deciders: [repo owner]
contexts: [ledger, billing, ordering]
relates_to: [SPIKE-001, SPIKE-007, SPIKE-010, ADR-0003, ADR-0004, ADR-0012, ADR-0013]
supersedes:
superseded_by:
---

> **In the context of** a Deno API that must load three npm packages with native or
> native-adjacent dependencies, **facing** a `deno compile` deployment unit whose Node-API support
> was entirely unmeasured, **we decided** to ship a `deno compile --self-extracting` binary and
> forbid `--bundle`, **to achieve** a single deployable artifact on plain VMs, **accepting** a
> ~364 MB binary, a first-run extraction step, and a flag whose necessity nothing type-checks.

## Context

ADR-0004 kept Deno and named exactly one revisit trigger: *if the TigerBeetle client cannot load
under Deno, add a Go sidecar for the ledger service only.* ADR-0013 chose processes on Linode VMs
with no Kubernetes, which makes one compiled binary the natural artifact. Neither claim had been
tested. Three spikes each independently restated the same instruction — exercise the client under
`deno run`, `deno test` **and** `deno compile` — and none had been run.

Measured 2026-08-09, Deno 2.9.2 on `aarch64-apple-darwin`, permissions
`--allow-read --allow-env --allow-ffi` in every cell
(`code:2026-08-09:erp-spec@b555c5c:spikes/harness/_matrix-result.md`):

| mode | `tigerbeetle-node` 0.17.9 | `@duckdb/node-api` 1.5.5-r.3 | `bullmq` 6.0.9 + `ioredis` 6.0.0 |
|---|---|---|---|
| `deno run` | ✅ | ✅ | ✅ |
| `deno test` | ✅ | ✅ | ✅ |
| `deno compile` (default) | ✅ 364 MB | ❌ | ✅ 364 MB |
| `deno compile --self-extracting` | ✅ 364 MB | ✅ 364 MB | ✅ 364 MB |
| `deno compile --bundle` | ❌ 192 MB | ❌ 192 MB | ✅ 193 MB |
| `deno compile --self-extracting --bundle` | ❌ 192 MB | ❌ 192 MB | ✅ 193 MB |

The default-compile DuckDB failure is `Library not loaded: @rpath/libduckdb.dylib` — the `.node`
extracts to a temp directory and its sibling dylib does not, exactly as denoland/deno#29203
describes. `--bundle` fails differently and for both addons:
`Cannot find module '@duckdb/node-bindings-darwin-arm64/duckdb.node'` and
`Cannot find module './bin/aarch64-macos/client.node'`.

## Decision

**Compile with `--self-extracting`. Never with `--bundle`.**

`--self-extracting` is not an optimisation; it is the only mode in which every dependency of this
system works. `--bundle` is incompatible with Node-API addons outright — it drops the `.node`
files — and `--self-extracting` does not rescue it.

## Consequences

- **ADR-0004's revisit trigger does not fire. There is no Go ledger sidecar.** The TigerBeetle
  client works from Deno against a real cluster, including the operations the ledger actually
  depends on (SPIKE-001).
- **`formal/two-store-commit.qnt` models no extra network hop.** The sidecar hop that SPIKE-002
  and `formal/README.md` were holding space for does not exist.
- **ADR-0013's "Caddy reverse-proxies the Deno process" stays singular.** One process, one binary.
- **The binary is ~364 MB and extracts on first run.** On a VM that is a startup cost and disk,
  not a blocker — but it rules out any deployment story that assumed a small artifact, and the
  extraction directory needs to survive between restarts or every restart pays again.
- **The flag requirement is invisible to the type system.** Nothing fails at compile time if
  someone drops `--self-extracting`; DuckDB fails at runtime, on the reporting path, with a dylib
  error that reads like a broken install. The build command is therefore load-bearing
  configuration and belongs under the same review as source.
- **This result is version-specific and platform-specific.** It is Deno 2.9.2 on macOS arm64.
  Re-run `deno task matrix` in `spikes/harness/` on every Deno upgrade and diff the table.
  TigerBeetle upstream treats macOS as a development configuration and supports Linux ≥5.6 for
  production, so **this ADR is a client-loading result and says nothing about storage behaviour on
  the deployment target** — that is SPIKE-011's job.
- **A stray `node_modules` above the build directory can poison `--bundle`.** Deno's node
  resolution walks up from the importing file; BullMQ v6 lazily `require('pg')` for a Postgres
  backend, and esbuild follows it eagerly. Since `--bundle` is forbidden here anyway this is
  documentation rather than a constraint, but it is why the harness stages outside `$HOME`.

## Considered options

- **`deno compile` default.** Rejected: DuckDB does not load. Would have forced the reporting path
  onto WASM for a reason that has nothing to do with reporting.
- **`--bundle` for a smaller artifact** (192 MB vs 364 MB). Rejected: incompatible with both native
  addons. Available only to a build that has no native dependencies at all, which this is not.
- **A Go sidecar for the ledger** (ADR-0004's named fallback). Not needed — nothing failed.
- **Run from source on the VM rather than compiling.** Viable: `deno run` passes every cell. Kept
  as the fallback if the binary size or the extraction step turns out to hurt, since it needs no
  code change — only a different launch command.
