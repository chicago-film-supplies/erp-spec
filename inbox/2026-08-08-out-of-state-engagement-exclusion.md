---
kind: constraint
title: The one-off out-of-state engagement needs an explicit exclusion flag
contexts: [billing, ledger]
source: prior-session analysis, 2026-08
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

A single out-of-state engagement distorts run-rate analysis. It must carry a first-class
exclusion flag on the source document — not a note in a document, not a hardcoded uid in a query.

Semantics undecided: excluded from run-rate reporting only, or from more? Tracked as OQ-015.
