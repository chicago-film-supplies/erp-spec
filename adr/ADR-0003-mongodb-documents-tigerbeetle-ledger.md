---
id: ADR-0003
title: MongoDB for documents and masterfiles; TigerBeetle for the ledger
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [ledger, ordering, billing]
relates_to: [SPIKE-001, SPIKE-002, SPIKE-006, HOT-005]
supersedes:
superseded_by:
---

> **In the context of** replacing Firestore, **facing** two genuinely different storage problems —
> nested mutable business documents and an immutable balance-bearing ledger — **we decided** to use
> MongoDB for documents and TigerBeetle for the ledger, **to achieve** a ledger with enforced
> double-entry and real throughput alongside a document store that fits the order shape,
> **accepting** a two-store commit problem that has to be specified formally.

## Context

- Orders and invoices are deeply nested documents with an items tree. That shape drove the
  Firestore design and it still fits a document store.
- A ledger has the opposite requirements: append-only, balance-enforcing, no partial writes.
  Storing it as documents means re-implementing debit/credit integrity in application code.
- TigerBeetle enforces double-entry in the database and is built for this exact workload.

## Considered options

- **Everything in MongoDB.** Simplest operationally; puts ledger integrity in application code,
  which is precisely the thing that must not be allowed to drift.
- **Everything in Postgres.** One store, real transactions, mature. Rejected because the document
  shape fights relational modelling and the ledger gains nothing over TigerBeetle.
- **MongoDB + TigerBeetle** (chosen). Each store does what it is good at, at the cost of a
  distributed commit.

## Decision

MongoDB for documents and masterfiles. TigerBeetle for the ledger.

## Consequences

- **A two-store commit protocol is now mandatory**, not optional. SPIKE-002 specifies it and
  `formal/two-store-commit.tla` model-checks it. The failure modes to rule out: an orphaned pending
  transfer, a Mongo document with no posted transfer, and a retry that double-posts.
- TigerBeetle must load under Deno — SPIKE-001, with a Go sidecar as the fallback (ADR-0004).
- MongoDB's `$jsonSchema` is an older JSON Schema draft, so schema enforcement is lossy relative to
  2020-12 — SPIKE-006 decides what is enforced where.
- TigerBeetle timestamps are posting time, not accounting date. This is HOT-005 and it is not a
  detail.
