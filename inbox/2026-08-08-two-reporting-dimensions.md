---
kind: decision
title: Two reporting dimensions are required simultaneously — product line AND cost type
contexts: [ledger]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Every revenue and COGS posting carries both: **product line** (what category of goods/service) and
**cost type** (`delivery` | `counter` | `warehouse`). Neither substitutes for the other.

Verified evidence for why both are needed: COA 4100 alone spans the Crew, Delivery, Transport and
Trash & Cleanup product lines, so the account cannot stand in for the product line — and the
product line cannot tell you whether the labour was a delivery run or warehouse time.
