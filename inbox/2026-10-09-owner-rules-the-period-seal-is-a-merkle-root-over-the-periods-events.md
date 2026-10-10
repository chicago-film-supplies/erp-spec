---
kind: decision
title: >-
  Owner rules a closed period is sealed by a Merkle root over the period's events, so one posting
  can be proven in the sealed books without disclosing the rest
contexts: [ledger, ops]
source: >-
  Owner, 2026-10-09, erp-spec session, accepting the recommendation that the period seal be a
  Merkle root rather than an unspecified hash, with individual events as the leaves.
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

- Refines
  `inbox/2026-10-09-owner-accepts-prevent-chain-anchor-immutability-and-a-verifiable-parquet-archive-with-ten-year-retention.md`,
  which said only "one hash over that period's daily manifests".
- **The seal is a Merkle root whose leaves are the period's event rows, in sequence order**, each
  leaf the row's canonical hash. Built with RFC 9162's domain separation — leaf `H(0x00 ‖ d)`, node
  `H(0x01 ‖ left ‖ right)` — so a node cannot be passed off as a leaf
  (<https://www.rfc-editor.org/rfc/rfc9162.html>).
- **What it buys:** an inclusion proof — about log₂(n) hashes — shows one posting or invoice is in a
  sealed period without revealing any other row, to an auditor or a customer. Consistency proofs
  between successive seals show history was only appended to. And it is the one value a public
  anchor (Reeve, UVerify — both deferred) would publish.
- **Unchanged:** the linear hash chain over the event store and the daily manifest chain stay the
  day-to-day tamper check. The Merkle root is computed at close, from rows the chain already covers.
- Decided now because adding it after periods are sealed with a plain hash would mean re-sealing
  them.
