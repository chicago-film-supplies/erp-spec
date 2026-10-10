---
kind: idea
title: >-
  Owner skips OpenTimestamps as a second anchor and keeps the Cardano Foundation's Reeve as a
  candidate public anchor to consider later
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session: "we can skip opentimestamps but i'd like to consider cardano
  reeve in the future". Reeve facts below are from Cardano Foundation announcements found by web
  search the same day, not read in full or verified.
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

- The event-store anchor is the compliance-locked bucket alone for now
  (`inbox/2026-10-09-owner-accepts-prevent-chain-anchor-immutability-and-a-verifiable-parquet-archive-with-ten-year-retention.md`).
  No timestamp authority, no OpenTimestamps.
- **Reeve** (Cardano Foundation, open source) publishes financial records to the Cardano chain
  alongside an existing ERP. The Foundation has published its own statements through it since
  December 2024, with an auditor's attestation on-chain in 2025; a third-party pilot started July
  2026. Announcement pages:
  <https://cardanofoundation.org/blog/unveiling-reeve-enterprise-reporting>,
  <https://cardanofoundation.org/blog/reef-data-partnership>.
- ⚠️ Questions before it could be adopted: whether it can publish only hashes (chain heads, period
  seals) rather than transactions — a public chain is permanent disclosure; its fee and wallet
  model; and whether depending on one chain's continuity over ten years is a lock-in of its own.
- Nothing depends on it. Adding a public anchor later changes nothing already built.
