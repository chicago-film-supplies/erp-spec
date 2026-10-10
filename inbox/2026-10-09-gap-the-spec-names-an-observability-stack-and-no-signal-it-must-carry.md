---
kind: gap
title: >-
  The spec adopts an observability stack and names no signal it must carry — quiet failures, the
  Postgres pivot's own failure modes and the watcher on the watched host are all unrequired
contexts: [ledger, availability, fulfillment, billing]
source: >-
  erp-spec session 2026-10-09, reading `adr/ADR-0028-self-hosted-tier-gotenberg-and-victoria.md`,
  `adr/ADR-0013-linode-self-hosted.md`, `research-drop/reference/victoria.md` and every
  `contexts/*/requirements.yaml` at erp-spec@0c3c21f.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## What exists

- ADR-0028 (self-hosted rendering and observability) is `proposed`, `review_by: 2026-10-01` —
  overdue — and blocked on SPIKE-011 (host sizing), which waits on an unprovisioned Linode host.
- It adopts VictoriaMetrics / Logs / Traces, vmagent, vmalert, vmauth and alertmanager behind an
  OTLP collector, and rules that the app never names the backend.
- **Zero requirements** in any `contexts/*/requirements.yaml` mention observability, telemetry or
  alerting. Alerting appears only as version pins.

## Signals the spec already says are needed, and nothing requires

- **Quiet failures ADR-0028 names:** a renderer that returns a placeholder PDF instead of erroring;
  a missing collector that drops telemetry silently. Each "needs a liveness signal that does not
  come from itself".
- **Worker and cron liveness** (ADR-0013 Consequences).

## Signals the Postgres pivot adds

- **Replication slot lag and retained WAL** — a dead change-feed consumer retains WAL until the disk
  fills.
- **Live-transport gateway liveness** — a dead LISTEN connection leaves clients stale and looking
  current.
- **Queue depth and age** for the in-database work queue.
- **Event-store conformance** — replay or trace-validation failures (see
  `inbox/2026-10-09-research-five-verification-layers-and-what-cfs-already-has-of-each.md`).

## Unaddressed

- **Who watches the watcher.** The stack runs on the host it monitors (ADR-0028), so a host outage
  silences the alerting too. Needs an external dead-man's switch.
- **Log retention and PII rules for v2.** None stated. v1's 90-day retention and redaction tiers are
  v1's choices, not constraints.
- **No context owns any of this.** Owner ruled 2026-10-09: a new `ops` context holds observability,
  alerting and verification requirements.
