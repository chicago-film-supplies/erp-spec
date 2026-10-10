---
kind: research
title: >-
  Five verification layers — quint test, property tests, model-based testing, trace validation and
  runtime monitors — measured against what CFS already runs, with seven corrections to the generic
  advice
contexts: [ledger, availability, fulfillment]
source: >-
  Owner, 2026-10-09: a pasted outside conversation proposing the five layers, reviewed in an
  erp-spec session against the org rules (cfs-skills SKILL.md files, every repo CLAUDE.md,
  repo-scoped skills) and against api-cloudrun / core / manager history from 2026-09-28 to
  2026-10-09. Repo state read at erp-spec@0c3c21f, api-cloudrun@21322c1b.
confidence: medium
promotes_to: [ADR-0054]
verified: true
triage_count: 0
---

## The five layers, and what exists today

| Layer                           | What it checks                                                | Foothold today                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) `quint test`                | the spec against its own intended runs                        | **None.** `formal/*.qnt` hold zero `run`/`test` definitions; CI checks only that each spec file exists and its README records a run (`tools/milestone-checks.ts:546-559`). Nearest analog: the fail-closed companion modules (`formal/README.md:14-24`). |
| (b) property tests (fast-check) | real code over generated inputs                               | **The discipline, not the library.** No repo depends on fast-check. The money sweeps use seeded LCG corpora, an independent rational oracle and one counter per arm (`cfs-money` skill).                                                                 |
| (c) model-based testing         | spec-generated action sequences against the real API          | **None, but already decided.** ADR-0016 (Quint over TLA+) chose Quint for ITF trace replay against the implementation (`adr/ADR-0016-quint-over-tla.md:33-36`); `formal/README.md:119-120` records it as not built.                                      |
| (d) trace validation            | recorded runs replayed through the spec's transition relation | **Replay against stored state only.** v1 has `foldJournal` / `replayOrder` (core beta.645, which closed api-cloudrun#1255) and ~10 `audit-*` replay scripts. Nothing replays through a spec.                                                             |
| (e) runtime monitors            | invariants checked live, wired to alerts                      | **The most mature layer.** vmalert rules with a `shape:` contract, hourly and daily drift sweeps, write guards (`validatedUpdate*` refuses a patch that disagrees with the merged document). The invariants are hand-written, not spec-derived.          |

## Seven corrections to the generic advice

1. **Logs work as a trace source only under three conditions.** Retention and PII scrubbing are v2's
   choice, not v1's 90-day policy. The fields a transition depends on (ids, quantities, states,
   amounts, legs) are not personal data, so verification events can be PII-free by construction and
   survive erasure. What does decide it:
   - **completeness** — a collector under backpressure drops data, and ADR-0028 records that the
     collector fails quiet. Needs per-entity sequence numbers so a gap is visible;
   - **ordering** — multi-process timestamps are not a total order. Needs a per-entity version;
   - **atomicity with the write** — an event logged after commit is lost on a crash in between;
     logged before, it records a rolled-back write. Committed facts must reach the log from the
     commit (change feed or outbox).
2. **Logs see what the event store never will: refused requests.** A spec that models rejection
   actions lets trace validation check that refusals were correct, not only that accepted writes
   were. So: event store for committed-state conformance, logs for request-handling conformance.
3. **The spec is itself an oracle.** A guard that consults only its own oracle is not a guard
   (erp-spec `CLAUDE.md`, five rules). So the `.qnt` is written independently of the handlers and
   never generated from them, every model-based or trace check carries a deliberately broken variant
   that must fail, and branch coverage is counted separately — a sampler can miss a branch the way
   the money clamp went unexercised in 200k draws.
4. **Naive invariants page on correct behavior.** Negative availability is a preserved shortage
   signal, and invoices and fulfillments legitimately differ from their order. Model these as
   permitted divergence plus an explanation set, the way `audit-fulfillment-diff` already does.
5. **Trace validation fails closed.** An observed event the spec has no action for is a failure, not
   a skip. `two_store_commit` reported clean partly because its failures were unrepresentable
   (`formal/README.md:68-71`).
6. **The conversation's `/debug/state` endpoint is unnecessary** when the store is Postgres: the
   driver reads the database. And model-based runs can use a throwaway database per run, which v1
   cannot (no emulator, shared dev Firestore mirrored from prod).
7. **Only layer (a) lives in erp-spec.** The repo holds no implementation code, so (b)–(e) enter as
   implementation-free requirements and an ADR; their code belongs to v2.

## Measured incidentals

- **Trace sampling:** no sampler is configured anywhere in api-cloudrun
  (`infra/cloud-run-api.tf:209-249` sets `OTEL_DENO=true` and an endpoint only;
  `infra/observability/otelcol-config.yaml:62-68` is a logs-only pipeline). The OTel default keeps
  every trace; Deno's native OTel following that default is unverified.
- **Five of the seven Quint modules model the two-store commit** (`formal/two-store-commit.qnt`);
  `period-close.qnt` is store-agnostic.
