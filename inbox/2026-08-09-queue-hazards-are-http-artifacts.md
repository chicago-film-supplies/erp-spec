---
kind: finding
title: Most of v1's queueing complexity is HTTP-delivery shaped, not domain shaped
contexts: [ordering, billing]
source: "code:2026-08-09:api-cloudrun@1d3387bd:.claude/skills/queueing/SKILL.md+src/lib/taskHandler.ts+src/lib/cloudTasks.ts — 7 documented platform facts, 5 of them transport-derived"
confidence: high
promotes_to: [ADR-0012]
verified: true
triage_count: 0
---

Cloud Tasks delivers by HTTP POST to a Cloud Run URL. Five of the seven documented platform
hazards — each of which caused an incident — exist only because of that transport, and disappear
under an in-process worker:

1. **A non-2xx is a retry.** A malformed payload is redelivered up to `max_attempts` (15) against a
   body malformed on every attempt. The whole `taskHandler` "parse, then return 200 and log" dance
   exists to defuse this. In-process, a parse failure just returns.
2. **No dead-letter queue.** Today's substitute is the 200-drop plus an alert on the error log.
3. **`Retry-After` is inert** — only the queue's `RetryConfig` governs timing, so the Xero 60s
   backoff floors *approximate* "wait out the rate window". In-process it can be honoured exactly.
4. **A framework timeout returns 504 without cancelling the handler**, so the platform dispatches a
   duplicate against work still running.
5. **CPU is throttled the instant the response is sent**, so post-response fan-out can be starved
   and its enqueue silently dropped.

The sixth — a queue paused out-of-band is invisible to Terraform, and swallowed enqueues for ~7
weeks — becomes "a worker process that is not running". Same class of silent failure; it needs an
equivalent liveness audit, not an assumption that self-hosting removed the problem.

**The dedup question is already answered.** All five task-name strategies (version-keyed,
content-addressed, day-keyed, cancel-and-reschedule, quota-deferred) map onto one job-id primitive.
The only asymmetry is Cloud Tasks' ~24h name tombstone, which has no equivalent — and an audit on
2026-07-26 found **no call site depends on that window expiring**; every one carries a fresh
discriminator. The tombstone was being worked around, not relied on. Several discriminators that
exist purely to dodge it (`-{attempt}`, `-{day}`) become dead weight and should be deleted rather
than ported.

One exception to carry forward deliberately: a once-per-deployment task currently gets its
idempotence from the tombstone and would need an explicit marker.
