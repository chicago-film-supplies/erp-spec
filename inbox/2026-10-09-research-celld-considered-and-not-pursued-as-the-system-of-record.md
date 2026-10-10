---
kind: research
title: >-
  celld (self-hosted Durable Objects) was considered as the system of record and not pursued —
  CFS's expensive writes cross entities, and actors shard a scale problem CFS does not have
contexts: [ledger, availability, ordering]
source: >-
  Owner raised "celld" on 2026-10-09 (named but unidentified in
  `inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md`),
  then gave the URL https://celld.dev. Read the same day from the homepage only, via a summarised
  fetch — a pointer, not evidence; the docs and source were not read.
confidence: medium
promotes_to: [ADR-0049]
verified: false
triage_count: 0
---

## What it is, per its homepage (2026-10-09)

- Deno Land Inc's self-hosted, distributed implementation of Cloudflare Durable Objects. v0.6.2
  beta, Apache-2.0, one static binary or a container.
- Each "cell" is a single-threaded actor with its own SQLite database, replicated as LTX files to an
  S3-compatible bucket (Linode Object Storage qualifies). Claims one epoch-fenced writer per cell
  and RPO=0. Claims Cloudflare Workers, KV, D1, Queues and Workflows run unchanged.
- The page says nothing about cross-cell transactions, subscriptions or change feeds, and does not
  mention ledgers or event sourcing.

## Why not

- **The costly writes cross entities.** One order write touches the order, stock for many products,
  bookings and the ledger. One actor per entity makes those separate cells, and nothing stated
  coordinates a commit across cells — the two-store commit returns across N stores.
- **Reporting is a cross-entity `GROUP BY`.** Separate SQLite files per cell need a change feed to
  another store for aggregates, which adds a storage site.
- **Scale.** Actor sharding answers high concurrency; v1 prod runs about 36 order updates a day.
- **Maturity.** A v0.6 beta from one vendor is too young to hold the ledger and the immutable event
  store.
- **Staging replica.** Copying a bucket is a snapshot; a live prod tail into a staging that also
  takes writes is not addressed.

## What it does have

- Deno-native, matching ADR-0004; open source and self-hostable.
- One single-threaded cell per product would serialize the oversell check by construction.
- Durable Objects hold WebSockets natively (unverified for celld).

## When to look again

A per-entity, independent workload — per-customer sessions in the public client app, say — as an
additional component, never the system of record.
