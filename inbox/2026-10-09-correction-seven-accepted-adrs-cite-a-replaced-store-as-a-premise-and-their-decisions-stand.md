---
kind: correction
title: >-
  Seven accepted ADRs keep their decisions under the PostgreSQL ruling but cite a replaced store as
  a premise — recorded here rather than superseded, per ADR-0034
contexts: [ledger, billing, tax, ordering]
source: >-
  erp-spec session 2026-10-09, inventory of every ADR against the ruling in
  `inbox/2026-10-09-owner-rules-postgres-is-the-one-system-of-record-replacing-mongo-tigerbeetle-valkey-and-duckdb.md`,
  read at erp-spec@0c3c21f.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Under ADR-0034, a decision that stands while a fact it cited no longer holds gets a dated note, not
a new ADR. Each ADR below gains `ADR-0049` in `relates_to` as the correction index.

| ADR                                                     | Decision that stands                  | Premise that no longer holds                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0004 (keep Deno and TypeScript)                     | Deno and TypeScript                   | its only revisit trigger is the TigerBeetle client failing under Deno                                                                                            |
| ADR-0010 (accounting date is not posting timestamp)     | the two are distinct fields           | "TigerBeetle assigns a posting timestamp, no accounting date"                                                                                                    |
| ADR-0013 (self-host on Linode)                          | self-hosting on Linode                | the hosted set is MongoDB, TigerBeetle and Valkey; "TigerBeetle's storage is not a free choice"                                                                  |
| ADR-0014 (lifecycle state is derived)                   | state is derived, not stored as truth | materialized into MongoDB because "TigerBeetle answers no queries"                                                                                               |
| ADR-0022 (invoice status is two derived projections)    | two derived projections               | materialized because the ledger answers no queries; the independent check is recompute-versus-TigerBeetle                                                        |
| ADR-0026 (the tax book does not post)                   | the tax book does not post            | "TigerBeetle holds one book"; the parallel-ledger rejection rests on the u128 id and the `user_data` count; the tax book is read from ADR-0017's sealed artifact |
| ADR-0036 (the ledger carries keys, not classifications) | keys, not classifications             | the supporting detail is TigerBeetle's field budget, `user_data_64`, `Transfer.code`, and "classification is a Mongo concern"                                    |

- **ADR-0026's rejection of a parallel tax ledger** should be re-checked on its own terms: two of
  its three reasons were TigerBeetle constraints. The decision may still stand on the third; that is
  a question for the owner, not a correction.
- **ADR-0005 (keep SolidJS)**, **ADR-0016 (Quint over TLA+)** and **ADR-0029, ADR-0034** mention a
  replaced store incidentally; no premise of theirs fails.
