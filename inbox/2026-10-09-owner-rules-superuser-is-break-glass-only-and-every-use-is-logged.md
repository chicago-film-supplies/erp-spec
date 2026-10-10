---
kind: decision
title: >-
  Owner rules the PostgreSQL superuser is break-glass only, and every superuser session is logged
  well enough to reconstruct what it did
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session, choosing option B for OQ-073: "b is the right move, we
  should have good logging on superuser activity".
confidence: high
promotes_to: [OQ-073, REQ-OPS-012]
verified: false
triage_count: 0
---

- No day-to-day login is a superuser. Migrations run as the table-owner role, still bounded by the
  event trigger; routine admin uses roles holding only the privileges their job needs.
- The superuser credential is held for emergencies only: disaster recovery, major upgrades.
- Every superuser session is logged — when it started and ended, who, and what it ran — somewhere
  that superuser cannot alter, as it happens.
- ⚠️ PostgreSQL's own logging cannot be that record alone: a superuser can change its settings, and
  pgaudit's README says it cannot reliably audit superusers. The record has to leave the host as it
  is written.
- Not decided: where the credential is stored, and whether a superuser login pages the owner or only
  writes the record.
