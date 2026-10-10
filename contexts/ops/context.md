# Ops (`OPS`)

## Responsibility

The operational requirements no business context owns: that the running system **says when it is
broken**, and that what it committed **conforms to the formal specs**. Owns liveness of
quiet-failing services, change-feed and queue health, the external dead-man's switch, log retention
and PII rules, and the verification events and conformance checks ADR-0054 (five verification
layers, spec as independent oracle) decides.

It exists because the requirements were otherwise homeless. ADR-0028 (self-hosted rendering and
observability) adopts a stack and names no signal it must carry, and zero requirements in any other
context mention observability, telemetry or alerting
(`inbox/2026-10-09-gap-the-spec-names-an-observability-stack-and-no-signal-it-must-carry.md`). The
owner ruled a separate context over scattering each signal into the context it watches
(`inbox/2026-10-09-owner-a-new-ops-context-owns-observability-alerting-and-verification.md`).

## Boundary

- Does **not** own business invariants — the context that owns the state owns the rule. Ops owns the
  **signal** that a rule was broken in production and who hears it, never the rule.
- Does **not** own the formal specs themselves (`formal/`, ADR-0016 Quint replaces TLA+). It owns
  the requirement that recorded runs are checked against them.
- Does **not** choose the observability backend. ADR-0028 rules the app never names it; requirements
  here are stated as signals, never as a vendor's metric or query.
- Does **not** own hosting, backup and failover — OQ-069 (PostgreSQL hosting, backup and failover)
  and ADR-0013 (self-host on Linode). It owns the requirement that their failure is detected.
- Does **not** own audit history of business documents. An audit trail is a record the business
  reads; a log is a diagnostic the operator reads. Retention rules here cover the second only.

## Upstream / downstream

- **Consumes:** every context's committed events (conformance, D5 of ADR-0054); the work queue
  (ADR-0050 work queues live in PostgreSQL); the change feed (ADR-0052 DuckDB leaves; Parquet is a
  change-feed sink); the live transport (OQ-067 the live transport to clients under PostgreSQL).
- **Produces:** alerts to a human. Nothing another context consumes — an ops signal never changes
  business state.

## Open

- **OQ-072** (v2 log retention and PII rules) — a decision, so it is not a requirement here.
- Whether a verification event (ADR-0054 D5) is a domain event in `events.yaml` or a log record
  outside it. Undecided; `events.yaml` is empty until it is.
- The stack runs on the host it watches (ADR-0028), so a host outage silences it. The external
  dead-man's switch is required; where it runs is not decided.
