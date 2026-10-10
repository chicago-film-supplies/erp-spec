---
id: SPIKE-014
headline: PostgreSQL as the one system of record
question: >-
  Does one PostgreSQL database carry CFS's documents, ledger, event store, queues, live transport and
  change feed under Deno, with the integrity properties ADR-0049 claims and the failure behaviour
  SPIKE-002 demanded of the two-store design?
timebox: "5 days"
method: >-
  Build a throwaway slice in `spikes/harness/pg/` against a local PostgreSQL. Port the stock
  availability engine, a balanced posting table, an append-only event table, a job queue, a
  live-transport gateway and a change-feed consumer. Replay one heavy prod order end to end from the
  v1 read-only API. Rerun SPIKE-002's crash points. Replay the event table through
  `formal/period-close.qnt`.
exit_criteria:
  - >-
      A pure TypeScript/JavaScript PostgreSQL driver runs under `deno run`, `deno test` and
      `deno compile`, and supports transactions, LISTEN/NOTIFY, COPY and the logical-replication
      protocol — or the missing capability is named (ADR-0053).
  - >-
      An unbalanced journal entry fails to commit, and an UPDATE or DELETE on the event table fails for
      the application role; both are shown failing, not only passing.
  - >-
      A posting dated in a closed period is refused at commit when the period closes between
      validation and commit (the race `validate_then_commit` models).
  - >-
      SIGKILL at each step of an order write leaves no document without its events and no events
      without their document, across every crash point SPIKE-002 enumerated.
  - >-
      A job enqueued in a transaction that rolls back is never claimed, and two workers never process
      the same entity concurrently.
  - >-
      Clients converge after the LISTEN connection is killed mid-write: every subscribed document
      reaches its committed version.
  - >-
      The change-feed consumer writes an ordered Parquet log with money as INT64 and identifiers exact,
      and a stopped consumer's retained WAL is measured and capped.
  - >-
      One heavy prod order replayed end to end, with its p95 write latency measured against v1's
      (ADR-0049 M3).
  - >-
      The event table replays through `period-close.qnt`, and a deliberately illegal event fails the
      replay.
closes_adr: ADR-0049
status: open
measurements:
  - id: M1
    value: "p95 POST /orders about 4.1s, PUT /orders/:uid about 2.2s"
    of: >-
      v1 prod request latency over the 30 days to 2026-10-09. The baseline the heavy-order replay is
      compared with; a figure OF v1 on Firestore, not a v2 target.
    as_of: 2026-10-09
    source: inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md
---

## Notes

- Opened 2026-10-09 out of the owner's ruling
  (`inbox/2026-10-09-owner-rules-postgres-is-the-one-system-of-record-replacing-mongo-tigerbeetle-valkey-and-duckdb.md`).
  The ruling is made; this spike validates it before ADR-0049 is accepted, and is where ADR-0050,
  ADR-0052 and ADR-0053's open measurements are taken.
- Gates ADR-0049. Feeds ADR-0050 (queue library), ADR-0052 (Parquet row shape) and ADR-0053
  (driver).
- TODO
