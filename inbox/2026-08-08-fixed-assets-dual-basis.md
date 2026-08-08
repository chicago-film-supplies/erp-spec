---
kind: constraint
title: Fixed assets — hundreds of low-value assets, straight-line, dual GAAP and tax basis
contexts: [fixed-assets, tax, ledger]
source: prior-session analysis, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Hundreds of individually low-value assets, depreciated straight-line, carried on **both** a GAAP
and a tax basis, with the deferred difference between them reportable.

Volume matters as much as method: a per-asset manual close does not scale to hundreds, so the
depreciation run has to be a batch posting with a per-asset audit trail. SPIKE-005 decides
hand-rolled vs library.
