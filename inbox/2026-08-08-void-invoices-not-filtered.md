---
kind: finding
title: Void invoices are not filtered by default
contexts: [billing, ledger]
source: "verified:2026-08-08:db_invoices_count status=void"
confidence: high
promotes_to: [REQ-BIL-001]
verified: true
triage_count: 0
---

41 of 999 invoices are `status: void`, carrying 477 line items worth $69,769.66. Nothing filters
them by default — they landed inside the untracked-revenue measurement on this very date until
counted separately.

Requirement shape: a voided source document must be excluded from every default aggregate, and
including it must be an explicit opt-in rather than an omission.
