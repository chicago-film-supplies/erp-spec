---
kind: decision
title: >-
  Owner rules the change-feed archive writes one Parquet file per table per day and never compacts
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session, accepting the file-layout half of the Parquet design that the
  earlier ruling left to SPIKE-014.
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

- One Parquet file per table per day, written once at day close.
- No compaction. At CFS's volume the files are small, and compaction would rewrite files whose
  as-written hashes the manifest chain depends on.
- Completes
  `inbox/2026-10-09-owner-accepts-prevent-chain-anchor-immutability-and-a-verifiable-parquet-archive-with-ten-year-retention.md`,
  which left file size and compaction open.
