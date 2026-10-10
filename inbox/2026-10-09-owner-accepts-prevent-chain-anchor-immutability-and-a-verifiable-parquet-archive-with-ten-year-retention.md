---
kind: decision
title: >-
  Owner accepts prevent-in-the-database, one head-locked hash chain and daily anchors in a
  compliance-locked bucket with ten-year retention, and a Parquet archive verified by manifest chain
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session, accepting two recommendations made from
  `inbox/2026-10-09-research-postgres-immutability-is-prevent-plus-detect-and-only-an-external-anchor-survives-a-superuser.md`,
  and setting retention: "10 year retention period".
confidence: high
promotes_to: [OQ-066, OQ-073]
verified: false
triage_count: 0
---

## Event store — all three layers together

- **Prevent:** the ledger tables are owned by a role nobody logs in as; the application role holds
  INSERT and SELECT only; UPDATE, DELETE and TRUNCATE are rejected by triggers set `ENABLE ALWAYS`;
  an event trigger rejects ALTER, DROP and DISABLE TRIGGER on those tables.
- **Detect:** one hash chain over the event rows, its head locked until commit, so the sequence is
  gapless and equals commit order. Hashes cover application-computed canonical bytes from a
  versioned field list, never the database's text form.
- **Anchor:** the chain head and sequence written daily to an object-locked bucket in COMPLIANCE
  mode. **Retention: ten years.** Irreversible once set — compliance mode cannot be shortened by
  anyone, including Akamai.
- A full verification runs nightly.

## Parquet archive

1. A SHA-256 of each file as written.
2. A hash over each file's rows in a fixed canonical form, which survives re-encoding.
3. The range of database changes each file covers, so a missing file is a gap.
4. Daily, the entries are chained into a manifest whose hash is written back into a PostgreSQL row,
   so the database and the archive anchor each other.
5. Everything lives in the object-locked bucket.

- A closed period is sealed by one hash over that period's daily manifests. This replaces the single
  hashed Parquet artifact of ADR-0017 (reporting authority splits by period state), and feeds
  ADR-0051's redesign (erp-spec#65).

## Not decided here

- Who holds the superuser and how its use is recorded — OQ-073.
- Whether a second, independent anchor (a timestamp authority or a public-chain timestamp) is added
  on top of the bucket.
