---
id: ADR-0004
headline: keep Deno and TypeScript
title: Retain Deno/Hono and TypeScript
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [ledger, ordering, billing]
relates_to: [SPIKE-001]
accounting_shaped: false
supersedes:
superseded_by:
frozen_sha256: 68e882ced1b8fb46ba0d9a1cbeed69c2719594807c9c09617ddb4b4dedc617a3
---

> **In the context of** a greenfield rebuild that invites a stack change, **facing** a working
> Deno/Hono API and a one-person team, **we decided** to keep Deno, Hono and TypeScript, **to
> achieve** continuity of tooling and shared types with the clients, **accepting** that the
> TigerBeetle client may not load cleanly under Deno.

## Context

- The current API is Deno + Hono on Cloud Run and works.
- Types are shared with SolidJS clients through one package. A language split ends that.
- A one-person team cannot absorb a language migration and a domain rebuild simultaneously.

## Decision

Keep Deno, Hono and TypeScript. **No Rust or Go rewrite.**

**Revisit trigger:** if the TigerBeetle client cannot load under Deno (SPIKE-001), add a Go sidecar
for the ledger service only. That is a component boundary, not a language migration, and it does not
reopen this ADR for the rest of the system.

## Consequences

- SPIKE-001 is on the critical path — it gates whether the sidecar exists.
- A sidecar, if needed, adds a network hop inside the two-store commit, which SPIKE-002 and the TLA+
  spec must then account for.
