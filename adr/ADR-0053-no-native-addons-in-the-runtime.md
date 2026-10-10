---
id: ADR-0053
headline: no native addons in the runtime
title: The v2 runtime carries no Node-API native addons, so the deployment unit is an ordinary compiled binary
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [ledger, billing, ordering]
relates_to: [
  ADR-0023,
  ADR-0004,
  ADR-0013,
  ADR-0049,
  ADR-0050,
  ADR-0052,
  SPIKE-001,
  SPIKE-007,
  SPIKE-010,
  SPIKE-014,
]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      No dependency of the v2 runtime may require a Node-API native addon; the PostgreSQL driver is
      pure TypeScript or JavaScript.
  - id: D2
    kind: decision
    claim: >-
      The compile mode is chosen by measurement in SPIKE-014, no longer forced to
      `--self-extracting`.
  - id: P1
    kind: premise
    claim: >-
      `--self-extracting` was mandatory only because `tigerbeetle-node` and `@duckdb/node-api` are
      native addons.
    source: ADR-0023
supersedes:
supersedes_on_acceptance: ADR-0023
superseded_by:
---

> **In the context of** a stack that no longer includes TigerBeetle, DuckDB or Valkey (ADR-0049),
> **facing** a deployment rule that existed only to load their native addons, **we decided** that
> the runtime carries no native addons at all, **to achieve** a smaller binary with no extraction
> step and no flag whose necessity nothing type-checks, **accepting** that a driver feature
> available only natively is out of reach.

## Context

- ADR-0023 measured `tigerbeetle-node`, `@duckdb/node-api` and `bullmq` + `ioredis` under every
  `deno compile` mode and made `--self-extracting` mandatory, `--bundle` forbidden (P1). It recorded
  the cost: a ~364 MB binary, a first-run extraction, and a flag nothing type-checks.
- All three libraries leave with ADR-0049, ADR-0050 and ADR-0052. What remains — Hono, Zod, a
  PostgreSQL driver, HTTP clients for Typesense, Gotenberg, Resend and Mapbox — has no native
  component, provided the driver is pure.

## Decision

- **No native addons** (D1). The PostgreSQL driver must be pure TypeScript or JavaScript.
- **The compile mode is measured, not inherited** (D2).

## Consequences

- **ADR-0004 keeps no revisit trigger.** Its only one — the TigerBeetle client failing under Deno —
  has no subject.
- **The driver must cover what ADR-0049 depends on**: transactions, `LISTEN`/`NOTIFY`, `COPY`, and
  the logical-replication protocol for the change feed. Whether a pure driver does all four under
  Deno is SPIKE-014's first measurement. If none does, this ADR is reopened rather than worked
  around.
- **The harness matrix (`deno task matrix`) is retired**; its replacement measures the driver.
