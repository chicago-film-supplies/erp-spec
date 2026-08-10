---
kind: constraint
title: The self-hosted service tier carries into v2 — Gotenberg for PDF and the full Victoria stack for observability
contexts: [billing, ledger]
source: "code:2026-08-09:api-cloudrun@085e5b5c:infra/observability/docker-compose.yml.tpl + src/lib/gotenberg.ts"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Named by the owner as part of the v2 stack, 2026-08-09. Both are containers CFS already runs, and
both land on the host ADR-0013 provisions — so they are the second half of that decision rather
than new adoptions.

## Gotenberg — HTML→PDF

- `src/lib/gotenberg.ts`: HTML→PDF and screenshots, self-hosted, authenticated with a Cloud Run ID
  token in v1 (that auth mechanism is Cloud-Run-specific and does **not** carry to Linode).
- The client deadline is **65s and deliberately exceeds Gotenberg's own ~60s render timeout** — a
  cold-start render legitimately runs tens of seconds under concurrency=1 / scale-to-zero, and
  aborting below 60s recreated 502s that the infra fix had eliminated. A number with a reason,
  worth carrying rather than re-deriving.
- With `GOTENBERG_URL` unset it returns a **placeholder PDF** rather than failing, which is why a
  dev environment can render nothing and still look healthy.
- Deep notes already exist: `api-cloudrun/.claude/skills/gotenberg/SKILL.md`.

## The Victoria stack — metrics, logs, traces

Measured from `infra/observability/docker-compose.yml.tpl`, versions pinned there today:

| | |
|---|---|
| `victoria-metrics` | v1.148.0 — metrics store |
| `victoria-logs` | v1.52.0 — log store |
| `victoria-traces` | v0.10.0 — trace store |
| `vmagent` / `vmalert` / `vmauth` | v1.148.0 — scrape, alert rules, auth proxy |
| `otel/opentelemetry-collector-contrib` | 0.157.0 — the ingest fan-out |
| `alertmanager` | v0.33.1 |
| `node-exporter` / `cadvisor` | host and container metrics |

**The load-bearing detail: the app emits OTLP to an OpenTelemetry collector, and the collector fans
out to the three Victoria stores.** The instrumentation is vendor-neutral; only the collector
config knows what the backend is. That is what makes the obs backend a swappable decision rather
than a rewrite, and it is the reason this can be adopted without a spike.

All three stores are already reachable from Claude Code as MCP servers (`victoriametrics`,
`victorialogs`, `victoriatraces`, each with a `-prod` twin), so an agent can query production
telemetry directly — a live capability, not a plan.

## Why this is one note with Gotenberg rather than two

Same operational character, and it is the character that drives every consequence: **containers CFS
runs itself.** Nobody else is on the hook when they are down, they consume the same host budget,
they are in the deployment unit, and none of them can be stubbed out of an environment the way an
external API can — a missing Gotenberg silently returns a blank PDF, and a missing collector
silently drops telemetry. Both fail quiet.
