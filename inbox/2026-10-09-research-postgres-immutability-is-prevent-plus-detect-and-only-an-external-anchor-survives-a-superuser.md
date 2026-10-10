---
kind: research
title: >-
  PostgreSQL immutability is prevent-in-the-database plus detect-outside-it — grants, ALWAYS
  triggers and an event trigger stop everyone but a superuser, and only a hash chain anchored in
  object-locked storage survives one
contexts: [ledger, ops]
source: >-
  erp-spec session 2026-10-09, three parallel research passes asked by the owner while weighing
  ADR-0049 ("are we compensating for what TigerBeetle gave us — immutability for instance"). Every
  quote below was re-fetched and grepped locally from the primary page on 2026-10-09; summaries
  were not used as evidence.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## Prevent — what PostgreSQL 18 can enforce, and who bypasses each

- **Privileges.** App role gets INSERT + SELECT only. ⚠️ The owner can always re-grant, ALTER or
  DROP: "The right to modify or destroy an object is inherent in being the object's owner, and
  cannot be granted or revoked in itself." (<https://www.postgresql.org/docs/18/ddl-priv.html>) ⇒
  the owner must be a NOLOGIN role.
- **Triggers.** BEFORE UPDATE/DELETE row triggers, plus a BEFORE TRUNCATE statement trigger —
  TRUNCATE "will not fire any ON DELETE triggers"
  (<https://www.postgresql.org/docs/18/sql-truncate.html>). ⚠️ `session_replication_role = replica`
  silences default triggers; "Only superusers and users with the appropriate SET privilege can
  change this setting" (<https://www.postgresql.org/docs/18/runtime-config-client.html>). Defence:
  "triggers configured as ENABLE ALWAYS will fire regardless of the current replication role"
  (<https://www.postgresql.org/docs/18/sql-altertable.html>).
- **Event trigger** on `ddl_command_start` rejecting ALTER / DROP / DISABLE TRIGGER on the ledger
  tables closes the owner bypass. "Only superusers can create event triggers. Event triggers are
  disabled in single-user mode … as well as when event_triggers is set to false."
  (<https://www.postgresql.org/docs/18/sql-createeventtrigger.html>)
- **Rejected:** rules (silently drop rather than raise; docs prefer triggers), RLS (TRUNCATE not
  covered; "Superusers and roles with the BYPASSRLS attribute always bypass the row security system"
  — <https://www.postgresql.org/docs/18/ddl-rowsecurity.html>), pgaudit (logs only; "It is not
  possible to reliably audit superusers" — <https://github.com/pgaudit/pgaudit>), temporal_tables /
  periods (keep history, prevent nothing).
- **Residual: a superuser can do anything** — drop the event trigger, set `event_triggers = false`,
  restart single-user, edit data files. Under ADR-0013 (self-host on Linode) CFS holds one.

## Detect — a hash chain, and what it does not do

- `row_hash = H(tag ‖ hash_version ‖ prev_hash ‖ canonical_bytes(row))`. The head must be read and
  the row written under one lock (`SELECT … FOR UPDATE` on a one-row head, or
  `pg_advisory_xact_lock`), or the chain forks. ⭐ **Held to commit, that lock also makes `seq`
  gapless and equal to commit order** — the total order TigerBeetle gave for free. At ~36 order
  writes a day contention is negligible (estimate, not measured — SPIKE-014).
- Per-account chains (Oracle: "By default, there are 32 chains in each instance") and SQL Server's
  asynchronous Merkle blocks solve throughput CFS does not have.
- **Canonical bytes are computed in the application from a versioned field list**, never from
  `jsonb::text`: "jsonb does not preserve white space, does not preserve the order of object keys,
  and does not keep duplicate object keys"
  (<https://www.postgresql.org/docs/18/datatype-json.html>). SQL Server and Oracle both hash a
  self-defined type-tagged encoding. Money as integer cents.
- **A chain prevents nothing.** A superuser rewrites a row and recomputes every later hash.
  Microsoft, on the same design: "Ledger can't prevent such attacks but guarantees that any
  tampering will be detected when the ledger data is verified."
  (<https://learn.microsoft.com/en-us/sql/relational-databases/security/ledger/ledger-overview>)
  Detection needs an **anchor** outside the attacker's reach. A truncated tail is still a valid
  chain — only an anchored (seq, head) exposes it.

## Anchor — and Linode has the piece

- ⭐ **Akamai/Linode Object Storage supports Object Lock**, including compliance mode: objects
  "cannot be overwritten, deleted, or have their retention period shortened by any user"; "any
  object versions cannot be deleted or modified by any user, or Akamai, until (1) the retention
  period expires (2) the account is deleted." "Object Lock must be enabled at bucket creation time."
  (<https://techdocs.akamai.com/cloud-computing/docs/protect-data-with-object-lock>, page updated
  2026-10-09 — re-check before relying on it.)
- ⇒ **A one-person shop does not need a second administrator**: compliance mode binds the account
  owner too. That replaces "a separately administered host" as the thing a superuser cannot reach.
  ⚠️ Retention cannot be shortened once set — an owner decision, and irreversible.
- Optional second anchor: an RFC 3161 timestamp token over each head — proves the head existed
  before a time; the TSA sees only a hash (<https://www.rfc-editor.org/rfc/rfc3161.html>).
- Prior art matching this shape: SQL Server Ledger stores a digest every ~30 s in immutable blob
  storage; Oracle signs a blockchain-table digest kept outside the database. Amazon QLDB is end of
  support (UNVERIFIED date — its docs now 404).

## Parquet — verifiable only if we add it

- Parquet's page CRC is unkeyed (accidental corruption only); modular encryption's AES-GCM tags
  authenticate modules but need key management and say nothing about the set of files
  (<https://github.com/apache/parquet-format>, Encryption.md).
- **Neither Iceberg nor Delta stores a content hash** — Iceberg `data_file` carries path, size,
  counts and bounds; Delta's `.crc` "Version Checksum" files hold aggregates, not a hash.
- ⇒ A per-file SHA-256 (of the file **as written** — Parquet is not byte-reproducible), a canonical
  row hash per file, contiguous LSN ranges, a daily manifest chain, and the manifest head written
  back into a Postgres row so archive and database anchor each other. Same object-locked bucket. A
  period seal becomes a Merkle root over that period's daily heads.

## Compared with TigerBeetle

- TigerBeetle's immutability is at the API: there is no update or delete to call. It is self-hosted
  too, so an operator with file access is outside what that guarantee covers; how its checksums
  would treat a direct edit was **not researched**.
- PostgreSQL's equivalent is prevention for every role but the superuser, plus detection that
  survives the superuser. Stronger in one respect: an anchored chain is evidence a third party can
  check, which TigerBeetle's API guarantee was not.

## Unverified, for SPIKE-014

- Akamai legal hold; whether Akamai accepts `x-amz-checksum-sha256`; whether Akamai managed
  PostgreSQL's root user is a true superuser and exposes WAL.
