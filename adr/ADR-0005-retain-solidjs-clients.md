---
id: ADR-0005
headline: keep SolidJS clients
title: Retain SolidJS clients
status: accepted
date: 2026-08-08
deciders: [repo owner]
contexts: [ordering, fulfillment]
relates_to: [SPIKE-009]
accounting_shaped: false
supersedes:
superseded_by:
frozen_sha256: 808a2ebb5036953014654ce5d97deba8a67d8386d9365c85c57a0b27d7d06d88
---

> **In the context of** rebuilding the API underneath the operator UI, **facing** a working SolidJS
> manager app, **we decided** to keep SolidJS, **to achieve** reuse of the existing client and its
> component work, **accepting** that the reactive data layer must be rebuilt regardless because
> Firestore's real-time listeners go away.

## Context

- The manager app is SolidJS and substantial.
- A second client (a public web app) is on the roadmap and will share much of it as a package.

## Decision

Keep SolidJS for all clients.

## Consequences

- The framework survives; **the data layer does not.** Firestore listeners are what the client's
  reactivity is currently built on. Replacing them with Mongo change streams plus a socket layer is
  SPIKE-009, and it is the largest hidden line item in the migration — scope it honestly rather than
  treating "we keep SolidJS" as though it means the client is mostly done.
