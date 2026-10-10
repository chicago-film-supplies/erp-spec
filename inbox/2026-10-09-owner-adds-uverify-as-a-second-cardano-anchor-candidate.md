---
kind: idea
title: >-
  Owner adds UVerify beside Reeve as a candidate public anchor — it anchors hashes rather than
  records, which answers Reeve's disclosure question by construction
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session: "uverify should also be considered". UVerify facts below are
  from listing and announcement pages found by web search the same day, not its docs or repo.
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

- Extends
  `inbox/2026-10-09-owner-skips-opentimestamps-and-keeps-cardano-reeve-as-a-future-public-anchor.md`.
- **UVerify** anchors a file's or text's hash on the Cardano chain without uploading the content,
  and issues a shareable verification page per certificate. Presented by the Cardano developer
  office hours (2025-06-13) as needing no tokens or NFTs. Described as open source. Listing:
  <https://cardano.org/apps/uverify/>.
- ⭐ **Its shape matches what the anchor needs** — a daily chain head or a period seal is a hash,
  and anchoring only the hash discloses nothing. That is the question Reeve left open.
- Still to check from its docs or repo: the hash algorithm and what exactly is written on-chain; the
  fee and wallet model (sources disagree on whether a user wallet is needed); how verification works
  without UVerify's own site, which is the lock-in test.
