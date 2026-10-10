---
kind: decision
title: >-
  Owner rules PostgreSQL is self-hosted on a Linode VM by default, and a move to a managed database
  needs a compelling reason
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session, asked whether managed PostgreSQL is required: "assume self
  hosting, open to switching to managed if theres a compelling reason".
confidence: high
promotes_to: [OQ-069]
verified: false
triage_count: 0
---

- Default: self-managed PostgreSQL on a Linode VM. Motive: avoiding vendor lock-in (ADR-0013).
- Not a prohibition. A managed database stays available if a compelling reason emerges; the burden
  of proof sits with the switch.
- Fits the immutability design
  (`inbox/2026-10-09-research-postgres-immutability-is-prevent-plus-detect-and-only-an-external-anchor-survives-a-superuser.md`):
  event triggers need a real superuser, and logical-replication slots and WAL archiving need
  server-level control — none verified as available on Akamai's managed offering.
- Still open inside OQ-069: backup tool, recovery point and recovery time objectives, failover
  arrangement.
