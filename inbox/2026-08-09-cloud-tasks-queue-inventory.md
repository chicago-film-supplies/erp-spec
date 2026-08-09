---
kind: research
title: The v1 Cloud Tasks surface, and how much of it survives the rebuild
contexts: [ordering, billing, fulfillment]
source: "code read 2026-08-09 — api-cloudrun src/lib/taskQueues.ts (16 queues, 29 handlers), infra/main.tf local.task_queues, infra/cloud-scheduler.tf (15 jobs), 18 createCloudTask call sites"
confidence: high
promotes_to: [ADR-0012]
verified: false
triage_count: 0
---

v1 runs **16 Cloud Tasks queues** and **29 `/tasks/*` handlers** (16 queue-fed, 13 scheduler-only)
against **15 Cloud Scheduler jobs**. Config is a typed catalog in `src/lib/taskQueues.ts`, mirrored
into Terraform with CI parity guards (T1–T6).

**Most queues are not domain requirements.** They encode a constraint of an external system, of
Gotenberg, or of Firestore:

- external rate limit (5) — `xeroQuote` 0.16/s, `xeroQuoteBackfill` 0.08/s, `xeroInvoice` 0.5/s,
  `calendarUpdate` 2/s, `trelloUpdate` 5/s
- scarce internal resource (3) — `draftQuote` 3 + `invoicePdf` 5 = 8 concurrent Gotenberg renders
  against 10 instances; `typesenseReindex` 2, memory-bound on a shared 512 MiB VM
- serialization for correctness (4) — `xeroInvoice`/`xeroQuote` at concurrency 1 close a
  double-create race; `userNameCascade` 1 prevents interleaved read-modify-writes;
  `orderFinalize` 1 *is* the coalescing
- Firestore contention (2) — `opportunityReconcile` `min_backoff = 120s`, derived from a measured
  60–87s abandoned-transaction lock tail; `stockSummaryRebuild` exists only because the rebuild
  used to run inside the order transaction
- debounce / chain (2) — `holidayDraftRecompute`, `tokenRefresh`

**Five of sixteen retire with the systems they serve, not with the platform:** `xeroQuote`,
`xeroQuoteBackfill`, `xeroInvoice` (Xero, ADR-0001), `opportunityReconcile` (CRMS), `trelloUpdate`
(Trello — confirmed going away 2026-08-09). Four of the thirteen scheduler handlers go the same
way: `sweep-crms-order-status`, `sweep-xero-quote-expiry`, `reconcile-xero-item-links`,
`audit-tracking-options`.

**`tokenRefreshQueue` collapses to a single service.** `OAuthService` is
`"current" | "xero" | "gmail"` — `current` is CRMS. Both retire, leaving `gmail`. Google Calendar
does **not** use this chain: `src/lib/calendar.ts` mints a service-account token with its own
in-process cache. Whether a `gmail` OAuth refresh is still needed at all is an open question.

So the port is ~11 queues, and two of those (`stockSummaryRebuild`, `opportunityReconcile`'s
backoff derivation) lose their *rationale* with Firestore rather than their function — they must be
re-derived against the new store's concurrency model, not carried over.
