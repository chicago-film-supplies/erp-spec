---
id: ADR-0054
headline: five verification layers, spec as independent oracle
title: v2 is verified in five layers — Quint tests, property tests, model-based tests, trace validation and runtime monitors — with each formal spec an oracle written independently of the code
status: proposed
date: 2026-10-09
review_by: 2026-12-15
deciders: [repo owner]
contexts: [ledger, availability, fulfillment]
relates_to: [ADR-0016, ADR-0028, ADR-0049, ADR-0051, SPIKE-014]
accounting_shaped: false
asserts:
  - id: D1
    kind: decision
    claim: >-
      v2 is verified in five layers: `quint test` on the specs, property tests on the code,
      model-based tests driving the code from the specs, trace validation of recorded runs through
      the specs, and runtime monitors wired to alerts.
  - id: D2
    kind: decision
    claim: >-
      A formal spec is written independently of the code it checks; neither is ever generated from
      the other.
  - id: D3
    kind: decision
    claim: >-
      Every model-based or trace check has a deliberately broken companion that must fail, and
      reports coverage per spec action.
  - id: D4
    kind: decision
    claim: >-
      Trace validation fails closed: an observed event with no matching spec action is a failure.
  - id: D5
    kind: decision
    claim: >-
      Committed-state conformance is validated from the event store; request-handling conformance,
      including refusals, is validated from verification events in the logs.
  - id: D6
    kind: decision
    claim: >-
      Verification events carry no personal data, a per-entity sequence number and a per-entity
      version, and committed facts reach them from the commit rather than from application code
      that runs beside it.
  - id: D7
    kind: decision
    claim: >-
      The Quint specs run in CI in a job separate from `deno task validate`, including their
      fail-closed companions asserted to fail.
  - id: P1
    kind: premise
    claim: >-
      ADR-0016 chose Quint so a model-generated trace could be replayed against the
      implementation, and nothing yet consumes that output.
    source: ADR-0016
  - id: P2
    kind: premise
    claim: >-
      v1 runs runtime monitors and replay audits but no spec-driven layer, and no repo depends on a
      property-testing library.
    source: inbox/2026-10-09-research-five-verification-layers-and-what-cfs-already-has-of-each.md
supersedes:
superseded_by:
---

> **In the context of** formal specs that nothing executes and an implementation that does not yet
> exist, **facing** the risk that a green spec and a green test suite describe different systems,
> **we decided** on five verification layers with each spec an oracle written independently of the
> code, **to achieve** a measurable answer to "does the code do what the spec says", **accepting**
> that every layer is work to build and that the specs become load-bearing artifacts to maintain.

## Context

- ADR-0016 chose Quint for its trace output: "a model-generated trace [can] be replayed against the
  implementation" (P1). `formal/README.md` records that nothing consumes it yet.
- CI checks only that each `.qnt` exists and that its README records a clean run; results are copied
  by hand (`tools/milestone-checks.ts`, "does NOT run a model checker").
- v1 already runs the runtime-monitor layer in hand-written form — vmalert rules, drift sweeps,
  write guards, replay audits (P2).
- The repo's rule that a guard consulting only its own oracle is not a guard applies to the spec
  itself: a spec derived from the code agrees with the code by construction.
- This ADR relates to ADR-0016 and supersedes nothing; it settles a question ADR-0016 left open (the
  ADR-0025 precedent).

## Decision

1. **Five layers** (D1):
   - `quint test` — the spec against its own intended runs. Lives in this repo.
   - **Property tests** — the code over generated inputs, seeded and reproducible, one counter per
     branch.
   - **Model-based tests** — action sequences generated from a spec, driven against the real API on
     a throwaway database, with state compared after each step.
   - **Trace validation** — recorded runs replayed through the spec's transitions.
   - **Runtime monitors** — invariants checked live, wired to alerts.
2. **Spec and code are independent** (D2).
3. **Every check has a broken companion and counts coverage** (D3). The fail-closed companion
   modules in `formal/` are the precedent.
4. **Trace validation fails closed** (D4).
5. **Two trace sources, two questions** (D5). The event store answers "did committed state follow
   the spec". Logs answer "did request handling follow the spec" — including refusals, which the
   event store never sees.
6. **Verification events are designed for it** (D6): PII-free so retention and erasure never touch
   them, sequenced so a gap is visible, versioned so order is total per entity, and emitted from the
   commit so a crash cannot lose one or record a rolled-back write.
7. **Quint runs in CI, separately** (D7). `deno task validate` stays free of npm dependencies.

## Consequences

- **Only the first layer lives in erp-spec.** The other four become implementation-free requirements
  in the new `ops` context; their code belongs to v2.
- **Specs need modelled refusals** to use the log source — a spec of accepted writes only cannot say
  whether a refusal was correct.
- **Naive invariants are wrong.** Negative availability is a preserved shortage signal, and an
  invoice or fulfillment legitimately differs from its order. Those are permitted divergences with
  an explanation set, never `>= 0` or equality.
- **`formal/two-store-commit.qnt` stops being the main model** under ADR-0049. `period-close.qnt` is
  store-agnostic and becomes the first spec with `run` tests and a trace-replay target (SPIKE-014).
- **Runtime monitors depend on the observability tier** (ADR-0028, still `proposed`).
- **Property tests may use a library** such as fast-check, provided runs are seeded and every branch
  is counted.
