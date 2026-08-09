---
id: ADR-0013
title: Self-host on Linode, with Caddy fronting TLS
status: proposed
date: 2026-08-09
review_by: 2026-10-01
deciders: [repo owner]
contexts: [ledger, ordering, billing, fulfillment]
relates_to: [ADR-0003, ADR-0004, ADR-0012, SPIKE-011]
supersedes:
superseded_by:
---

> **In the context of** rebuilding on a stack whose stores are all self-hosted anyway, **facing** a
> managed-service bill and a set of GCP primitives with no portable equivalent, **we decided** to
> host on Linode with Caddy terminating TLS, **to achieve** predictable cost and no platform
> lock-in, **accepting** that eight GCP managed services become ours to replace and operate.

## Context

- v1 runs on Cloud Run and leans on Firestore, Cloud Tasks, Cloud Scheduler, Secret Manager,
  Eventarc, IAM, Cloud Build and managed backups.
- The rebuild already self-hosts its stores: MongoDB, TigerBeetle and Valkey are ours to run under
  ADR-0003 and ADR-0012, and Typesense and the Victoria observability stack are already
  self-hosted today. The managed-platform argument is therefore much weaker than it was.
- Caddy has been a candidate front since ADR-0004's context but has no decision of its own; its
  reference note says explicitly that it is only worth adopting if the API is self-hosted.

## Decision

Host on **Linode**. **Caddy** terminates TLS and reverse-proxies the Deno process.

**No Kubernetes.** The deployment unit is processes on a small number of VMs behind a load
balancer. With one maintainer and four stateful services, an orchestrator is a second full-time
system, not a simplification.

## Considered options

- **Stay on GCP.** Keeps the managed primitives, but pays for them while self-hosting the stores
  anyway — the platform's main value is in services this design no longer uses.
- **Linode with LKE (managed Kubernetes).** Rejected above on operator cost, not on technical
  merit. Revisit if the team grows past one.
- **Linode, plain VMs** (chosen).

## Consequences

- **Eight replacements enter scope, and each needs naming.** Firestore → MongoDB (ADR-0003);
  Cloud Tasks → Valkey (ADR-0012); Cloud Scheduler → repeatable jobs (ADR-0012); Cloud Build → a
  CI runner; Eventarc → application-level events; Cloud Run autoscaling → fixed capacity;
  **Secret Manager → undecided**; **managed backups → undecided**. The last two are the gaps.
- **Secrets management is an open question, not a detail.** All secret values live in GCP Secret
  Manager today and nothing in the spec replaces it.
- **Backups become a designed artifact.** Four stateful services with four different backup
  mechanisms, plus the Parquet period artifacts that ADR-0006 makes the audit record. Object
  Storage is the natural target.
- **TigerBeetle's storage is not a free choice.** It is built around direct I/O and expects
  dedicated disks; network-attached block storage may or may not suit it. SPIKE-011.
- **Linode Object Storage is S3-compatible**, which suits the ADR-0006 Parquet artifacts and the
  backup target. Whether Linode's managed-database offerings cover MongoDB is unverified and
  should not be assumed.
- **Worker liveness and cron liveness become monitored concerns** (ADR-0012). The Victoria stack
  already runs self-hosted and carries alerting, so this is wiring rather than new infrastructure.
- **Caddy's open question closes.** The hosting/TLS boundary is now a recorded decision rather
  than an accident of setup.
