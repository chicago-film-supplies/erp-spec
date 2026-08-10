# VictoriaMetrics stack (metrics, logs, traces)

The whole observability tier: **VictoriaMetrics** (metrics), **VictoriaLogs** (logs),
**VictoriaTraces** (traces), plus vmagent / vmalert / vmauth and alertmanager. **Adopted by
[[ADR-0028]]** (proposed, 2026-08-09) onto the [[ADR-0013]] host. Already running in v1 — a
retention.

## Canonical docs

- VictoriaMetrics: <https://docs.victoriametrics.com/>
- VictoriaLogs + LogsQL: <https://docs.victoriametrics.com/victorialogs/logsql/>
- VictoriaTraces: <https://docs.victoriametrics.com/victoriatraces/>
- **Reachable as MCP servers from Claude Code** — `victoriametrics`, `victorialogs`,
  `victoriatraces`, each with a `-prod` twin. Prefer querying the live stack over reading docs when
  the question is "what is happening"; each server ships its own instructions and a `documentation`
  tool.

## Versions (pinned in v1, checked 2026-08-09)

`code:2026-08-09:api-cloudrun@085e5b5c:infra/observability/docker-compose.yml.tpl` —
victoria-metrics `v1.148.0`, victoria-logs `v1.52.0`, victoria-traces `v0.10.0`,
vmagent/vmalert/vmauth `v1.148.0`, otel-collector-contrib `0.157.0`, alertmanager `v0.33.1`.

## CFS-specific gotchas

- **The app speaks OTLP, never Victoria.** Instrumentation goes to an OpenTelemetry collector, which
  fans out to the three stores. That vendor-neutrality is the reason this could be adopted without a
  spike, and a direct Victoria client library in application code would silently spend it. Treat
  "the app knows the backend's name" as a defect.
- **LogsQL is not PromQL and not Lucene.** VictoriaLogs has its own query language; reaching for
  Prometheus syntax against the log store is the usual first mistake.
- **It fails quiet.** A missing or misconfigured collector drops telemetry, and the thing that has
  gone missing is the thing that would have told you. The stack cannot be its own liveness signal.
- **Nine containers before the app, the database or the ledger.** [[SPIKE-011]] sizes Linode for
  TigerBeetle; if it sizes only for TigerBeetle it is measuring the wrong machine ([[ADR-0028]]).

Cross-refs: [[ADR-0028]] · [[ADR-0013]] · [[SPIKE-011]]
