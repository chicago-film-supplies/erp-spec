---
id: ADR-0016
title: Quint replaces TLA+ for the formal specs
status: proposed
date: 2026-08-09
review_by: 2026-09-01
deciders: [repo owner]
contexts: [ledger, ordering]
relates_to: [SPIKE-002, ADR-0010]
supersedes:
superseded_by:
---

> **In the context of** two formal specs that exist as never-executed stubs, **facing** a choice
> between TLA+ and Quint before either is written for real, **we decided** to use Quint, **to
> achieve** specs a one-person team will actually maintain and traces that can be replayed against
> the implementation, **accepting** a smaller ecosystem than TLA+'s.

## Context

- `formal/two-store-commit.tla` and `formal/period-close.tla` are Init/Next/invariant skeletons that
  model nothing and have never been run. Nothing is sunk.
- Quint is the same underlying state-machine model, checked by Apalache or TLC, with a syntax that
  is materially easier to read and write.
- `m5`'s exit criteria name the two `.tla` files by filename, so they contradict this and must move.

## Decision

Quint. Both specs are authored as `.qnt`.

**The deciding property is trace export, not syntax.** `quint test` plus ITF trace output lets a
model-generated trace be replayed against the implementation, which is the only mechanism here that
closes the gap between a spec and the code it describes — and it serves the repo's own rule that a
stated guarantee nothing executes is not a guarantee.

## Considered options

- **TLA+.** Twenty years of worked examples and the larger body of reference material. Rejected on
  maintainability for a one-person team, and because it offers no equivalent of trace replay.
- **Quint** (chosen).
- **Neither — prose invariants.** Rejected: the failure modes in question are interleavings, and
  interleavings are not reachable by testing or by reading.

## Consequences

- `m5`'s exit criteria change from `.tla` filenames to `.qnt`, and keep the requirement that both
  have been **run**, with model-checker output recorded.
- `two-store-commit` can be written now — its three failure questions depend on no open question.
  Model it **without** a sidecar hop; SPIKE-001 may add one, and ADR-0004 requires the model to
  include it if so.
- `period-close` is unblocked as of 2026-08-09: it needs the accounting-date rule, and ADR-0010's
  blockers (HOT-005 / OQ-009) are now answered.
- Apalache wants a well-typed model, which is a real learning cost and the main thing that could
  make this decision look wrong.
- Quint ships official agent skills, already enabled as a plugin — those are authoritative for
  authoring `.qnt` over both halves of the reference docs.
