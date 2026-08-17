---
kind: gap
title: 'ADR-0003 replaces Firestore, which retires the prod→dev eventarc mirror as a mechanism — but the spec has ZERO statements about how a non-production environment gets realistic data, so a requirement v1 satisfies by accident is about to be dropped silently rather than decided'
contexts: []
source: "code:2026-08-17:api-cloudrun:src/services/devReplica.ts + src/lib/devReplicaRules.ts (SKIP_COLLECTIONS, 11 entries) · code:2026-08-17:api-cloudrun:infra/eventarc.tf (mirror-top-level, mirror-subcollections) · owner:2026-08-17 ruling on api-cloudrun#536 part 2 · grep:2026-08-17:erp-spec — 0 hits for the prod→dev mirror across all .md"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

**ADR-0003 replaces Firestore with MongoDB + TigerBeetle.** The prod→dev mirror is a Firestore
eventarc mechanism (`infra/eventarc.tf` → `/eventarc/mirror` → `mirrorDocument`), so it does not
survive that decision. Nothing is wrong with the ADR; the gap is that **the mirror is currently the
only answer to a requirement nobody has written down**, and replacing the store deletes the answer
without anyone having to notice the question.

Measured 2026-08-17: **zero hits across every `.md` in this repo** for the prod→dev mirror, dev
replica, or any statement about how a non-production environment is populated.

## The requirement v1 satisfies by accident

`cfs-dev-3100` is a live, continuously-refreshed copy of prod, maintained by an eventarc trigger on
every prod document write. That is what makes dev useful for building a UI against realistic
products, orders and invoices — and it is load-bearing for the manager work, where a screen is only
meaningfully testable against a corpus shaped like the real one.

**The owner ruled on the durability half on 2026-08-17** (api-cloudrun#536 part 2), and the ruling
is the requirement, stated for the first time:

> *"I'd like dev images to mirror prod, and a prod update can clobber dev images — dev is ephemeral
> always."*

So the shape v2 has to reproduce is: **a non-production environment continuously seeded from
production, whose own local state is expendable.** Not a fixture set, not a seeded snapshot — those
are different products, and the difference is exactly why the mirror exists.

## ⚠️ The part that will be missed: the mirror needs an EXCLUSION list, and each entry is a
## correctness claim rather than a preference

The naive v2 restatement is *"replicate prod to dev"*, and that is wrong in a way v1 already paid
for. `SKIP_COLLECTIONS` holds **11** entries, and they are not there to protect dev data — they are
there because mirroring those collections makes dev **actively incorrect**:

| skipped | why mirroring is WRONG, not merely wasteful |
|---|---|
| `counters/*` | dev's corpus is a **superset** of prod's, so a counter at prod's position is structurally behind the documents dev numbers — and prod is always the newer doc, so the mirror walks dev's sequence *backwards* (api-cloudrun#445) |
| `stock`, `stock-locks` | a projection of a corpus dev does not have; prod's answer is not stale in dev, it is an answer to a **different question** (#425). `stock-locks` is an allocator position, same class as counters |
| `typesense` | env-specific index state (`current_collection`, `schema_hash`); mirroring clobbers dev's alias and drove 111 same-doc 409s in 7 days (#259) |
| `uploadcare-worklist` | which CDN files **this env's** renders produced — env-local bookkeeping by definition (#535) |
| `sessions`, `calendar-events`, `trello-lookup`, `templates*` | env-local or externally-keyed state |

**The generalisation worth promoting, not just the list:** a replication rule needs a stated
exclusion criterion, and the criterion is *"is this document a fact about the environment rather
than about the business?"* Allocator positions, derived projections, index state and
env-local bookkeeping all answer yes. v1 discovered every one of these by incident — #445, #425,
#259 each cost a debugging session — so v2 inheriting the criterion rather than the list is the
whole value of writing it down.

## What this is asking for

⚠️ **`contexts: []` is deliberate and is itself part of the finding.** The eight bounded contexts
are business domains — a non-production environment belongs to none of them, and picking the ones
it happens to touch would be arbitrary. `validate` refused `[platform, migration]` on the first
attempt, which is the gate correctly declining to let a technical concern invent a business
context. **That means this note has no context to be promoted INTO**, so it is at risk of sitting
in `inbox/` indefinitely — the promotion path for cross-cutting platform requirements is itself
undecided, and that is worth triaging alongside the content.

A requirement stating that v2 provides a continuously-seeded,
expendable non-production environment, **with an exclusion criterion for environment-scoped state**
— and, if MongoDB change streams are the intended mechanism, an ADR recording that choice, since it
is a different consistency model from eventarc's per-document trigger and the newer-wins guard
(`isStaleMirrorWrite`) was itself re-derived twice in v1.

⚠️ Do not read this as a request to port `SKIP_COLLECTIONS`. The list is v1 collections; the
criterion is what transfers.
