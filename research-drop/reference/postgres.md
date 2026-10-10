# PostgreSQL

The one system of record — documents, masterfiles, the ledger, the event store, work queues and
reporting in one transactional database. **Adopted by [[ADR-0049]]** (proposed, 2026-10-09, on an
owner ruling), with [[ADR-0050]] (queues), [[ADR-0051]] (one ledger answers every period),
[[ADR-0052]] (Parquet as a change-feed sink) and [[ADR-0053]] (no native addons). **Nothing is
accepted yet**: until it is, the in-force set still names MongoDB and TigerBeetle, and [[HOT-025]]
records that contradiction. [[SPIKE-014]] validates the ruling before acceptance.

## Canonical docs

- Docs (current major): <https://www.postgresql.org/docs/current/>
- Versioning policy and support dates: <https://www.postgresql.org/support/versioning/>
- Logical replication: <https://www.postgresql.org/docs/current/logical-replication.html>
- `LISTEN` / `NOTIFY`: <https://www.postgresql.org/docs/current/sql-notify.html>
- Explicit locking and `SKIP LOCKED`:
  <https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE>
- **No `llms.txt`.** `postgresql.org/llms.txt`, `/docs/llms.txt` and `/llms-full.txt` all 404
  (probed 2026-10-09). This note is the curated substitute; follow the links for mechanics.

## Version (checked 2026-10-09)

- **18.6** is the newest GA minor; 17.11, 16.15 and 15.19 are the other supported lines.
- **19 is in beta** (Beta 4, 2026-09-24). Do not pin to it in spec text until it is GA.
- Majors are supported five years. Re-check the versioning page when you next touch this note.

## CFS-specific gotchas

- **A sequence is not gapless.** `nextval` is not rolled back with the transaction, so a gapless
  document number needs a counter row updated in the posting transaction. [[OQ-065]] carries it.
- **Every database-enforced invariant is bypassable by a superuser or a migration.** TigerBeetle's
  double-entry check could not be turned off; a `CHECK`, trigger or grant can be dropped. ADR-0049
  names this as the accepted downside and lists mitigations (separate roles, replay audit, hash
  chain, migrations reviewed as code). Which mechanism makes the event store append-only is
  [[OQ-066]].
- **A logical-replication slot retains WAL until its consumer confirms.** A stopped change-feed
  consumer ([[ADR-0052]]) fills the disk rather than losing data. Slot lag and retained WAL are
  therefore an alerted signal, and belong to the `ops` context (erp-spec#68).
- **`NOTIFY` delivers on commit only, and its payload is capped** (8000 bytes by default). A
  notification is a wake-up, never a carrier of the change itself. A dropped `LISTEN` connection
  misses notifications silently, so a client must re-read on reconnect. The live transport is
  [[OQ-067]].
- **`timestamptz` stores an instant, not the offset it was written with.** It normalises to UTC and
  renders in the session's `TimeZone`. v1's stored Chicago-offset strings (workspace `CLAUDE.md`)
  therefore do not round-trip through it unchanged. The stored form is [[ADR-0046]]'s open question,
  not settled here. Accounting date is a calendar day and is `date`, not a timestamp —
  [[ADR-0010]]'s two fields stay distinct.
- **Money is `bigint` minor units** (rule 7). `numeric` is exact but is a decimal type, which rule 7
  bans in any schema; `money` is locale-dependent.
- **`jsonb` stores the items tree as a document** and normalises it — key order and duplicate keys
  are not preserved. Anything that hashes a document must hash a canonical serialisation, not the
  stored bytes.
- **What Postgres enforces from Zod is open.** [[ADR-0040]] keeps Zod as the authority; the DDL and
  `CHECK` half is [[OQ-071]], the successor to SPIKE-006's `$jsonSchema` translation.

## Driver (undecided)

- [[ADR-0053]]: pure TypeScript or JavaScript, no native addon. It must cover transactions,
  `LISTEN`/`NOTIFY`, `COPY` and the logical-replication protocol under Deno.
- Candidates are not yet measured. SPIKE-014's first measurement picks one; if none covers all four,
  ADR-0053 is reopened rather than worked around.
- The queue library — hand-rolled `SKIP LOCKED` versus a Postgres job library — is the same spike
  ([[ADR-0050]]).
