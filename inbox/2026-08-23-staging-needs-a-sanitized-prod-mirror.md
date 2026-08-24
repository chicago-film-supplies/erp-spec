---
kind: idea
title: v2 needs a staging environment fed by a sanitized one-way mirror of production
contexts: [ledger, banking]
source: planning session, 2026-08-23
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

Nothing in this spec describes an environment tier — `staging`, `sanitiz*` and `anonymiz*` match two
files, neither about environments, across 47 ADRs. v1's three worst recurring costs all trace to
that absence: Xero and CRMS are single-env and live (the test suite reached a real prod CRMS
opportunity until 2026-07-13), dev Firestore is a whole-document mirror where a prod write clobbers
dev state, and dev's corpus is a superset of prod's so counts never reconcile.

Self-hosting on Linode (ADR-0013) makes a third tier cheaper than it was on managed GCP, so this is
worth deciding rather than inheriting.

🔴 **The hard constraint is the ledger, and it is what makes this an ADR rather than an ops task.**
Under ADR-0003 the books are double-entry in TigerBeetle. A sanitized copy must preserve BALANCE
while changing values, or staging's trial balance does not reconcile and the environment is useless
for the testing it exists for. Masking a field is easy; masking an amount without breaking a posting
is not.

The external-dependency half is now solvable in a way it never was for v1: Plaid has a first-class
Sandbox with its own credentials and its own Items, so a staging tier can exercise the banking
integration end to end rather than against a mock. Xero and CRMS never offered that.
