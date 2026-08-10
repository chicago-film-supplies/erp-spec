---
id: ADR-0028
title: The self-hosted service tier — Gotenberg for rendering, the Victoria stack for observability
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [billing, ledger]
relates_to: [ADR-0013, ADR-0017, ADR-0023]
supersedes:
superseded_by:
---

> **In the context of** ADR-0013 moving the system onto a host CFS operates, **facing** two service
> groups already running as containers, **we decided** to retain Gotenberg for document rendering
> and the full VictoriaMetrics stack for observability on that same host, **to achieve** one
> deployment unit and no new vendors, **accepting** that CFS is on the hook when either is down and
> that both fail quiet rather than loud.

## Context

- ADR-0013 self-hosts on Linode. That decision named Caddy and the application; it did not name
  what else has to run beside them. These are that list.
- **Gotenberg** renders HTML to PDF and to screenshots
  (`code:2026-08-09:api-cloudrun@085e5b5c:src/lib/gotenberg.ts`). Invoices, quotes and delivery
  documents all go through it. Template *content* is git-canonical and Firestore is a rebuildable
  projection, so the renderer is the only piece of that pipeline that is infrastructure.
- **The Victoria stack** is already the whole observability tier, pinned in
  `infra/observability/docker-compose.yml.tpl`: victoria-metrics v1.148.0, victoria-logs v1.52.0,
  victoria-traces v0.10.0, vmagent / vmalert / vmauth v1.148.0, alertmanager v0.33.1,
  node-exporter and cadvisor.
- **The application emits OTLP to an OpenTelemetry collector** (`otel/opentelemetry-collector-contrib`
  0.157.0), which fans out to the three stores. The instrumentation is vendor-neutral; only the
  collector config knows what the backend is.

## Decision

Retain both on the ADR-0013 host. Gotenberg is the rendering service; VictoriaMetrics, VictoriaLogs
and VictoriaTraces are the observability stores, reached through an OpenTelemetry collector.

## Consequences

- **The obs backend stays swappable and the app never learns its name.** Because instrumentation is
  OTLP, replacing Victoria is a collector-config change rather than a re-instrumentation. This is
  the property that lets the stack be adopted without a spike, and it is worth protecting: a
  direct-to-Victoria client library anywhere in application code would silently spend it.
- **A rendered PDF is a projection, never a source document.** The invoice is the accounting record;
  the PDF is a rendering of it. Nothing may reconstruct an amount by reading a document, and a
  re-render that differs from the original is a rendering bug, not a restatement (ADR-0017 makes
  the sealed Parquet artifact the closed-period authority — not the paperwork).
- **Both fail QUIET, and that is the operational risk to design against.** With `GOTENBERG_URL`
  unset the client returns a **placeholder PDF** rather than an error, so an environment can render
  nothing and look healthy. A missing collector drops telemetry silently — and the thing that has
  gone missing is the thing that would have told you. Each needs a liveness signal that does not
  come from itself.
- **Gotenberg's auth mechanism does not survive the move.** v1 authenticates with a Cloud Run ID
  token; on Linode there is no metadata server to mint one. The service moves, its front door does
  not, and that is unbuilt work rather than a carried-over solution.
- **The 65-second client deadline is a number with a reason.** It deliberately exceeds Gotenberg's
  own ~60s render timeout: under concurrency=1 with scale-to-zero a cold-start render legitimately
  runs tens of seconds, and aborting below 60s reproduced 502s that an infra fix had already
  eliminated. Self-hosting changes the cold-start profile, so re-derive it rather than copy it.
- **Observability is in scope for the host budget** — nine containers before the application, the
  database or the ledger. SPIKE-011 sizes Linode for TigerBeetle's durability and latency; it
  should size for this tier too, or the answer is about the wrong machine.
- **Agents can already query production telemetry.** All three stores are exposed as MCP servers
  with `-prod` twins, so an investigation can read live metrics, logs and traces directly. That is
  a capability the v2 design should keep rather than rediscover.
