---
kind: session
date: 2026-08-08
surface: claude-chat
topics: [ledger, formal-methods]
status: unprocessed
ingested_at:
---

## Findings
- [finding] TigerBeetle two-phase transfers expire after a configurable pending timeout, which bounds orphan lifetime.

## Decisions taken
- [decision] Period close writes the Parquet hash into the close record, making a closed period tamper-evident.

## Open questions raised
- [question] What pending-transfer timeout should the two-store commit use?

## Corrections to existing spec
- [correction] REQ-LED-001 understates the rule — the dimension must also be non-null on reversal postings, not only originals.

## Research notes
- [research] TLA+ TLC supports symmetry sets to cut state space; see Lamport, Specifying Systems, ch. 14.
