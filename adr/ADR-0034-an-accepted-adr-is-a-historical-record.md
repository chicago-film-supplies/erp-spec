---
id: ADR-0034
title: An accepted ADR is a historical record of the decision as taken; corrections live outside it and superseding is reserved for re-deciding
status: accepted
date: 2026-08-16
deciders: [repo owner]
contexts: [ledger, billing]
relates_to: [HOT-012, HOT-013, ADR-0001, ADR-0018, ADR-0025]
accounting_shaped: false
supersedes:
superseded_by:
frozen_sha256: 5af782864db53611011a1514a5221804baed40d79ab0f222314e7797dc02da8b
---

> **In the context of** two accepted ADRs whose evidence was later corrected, **facing** a lifecycle
> rule that forbids editing them and a supersede mechanism that would mean re-deciding things nobody
> disputes, **we decided** that an accepted ADR is a historical record of the decision as taken,
> **to achieve** an `adr/` directory that can be trusted to say what was actually believed and when,
> **accepting** that a reader of an ADR cannot tell from the ADR alone that one of its claims has
> since been retracted.

## Context

- `adr/` is the one lifecycle in this repo that is **immutable once `accepted`**. `inbox/` is
  append-only; `contexts/`, `ledger/`, `migration/` are refactored freely; `adr/` is frozen.
- **Two accepted ADRs now need a correction, and there is nowhere to put it.**
  - **HOT-012** — `ADR-0001`'s Context states "28.7% of line revenue has no product line" and blames
    Xero for dropping tracking option ids. Re-measured 2026-08-10, the dominant cause was a CFS-side
    derivation that never ran (api-cloudrun#473), and the genuinely-undecided share was **$688.00,
    0.041%**. Wrong by ~700× and pointing at the wrong system. Six other artifacts carrying the same
    figure were amended in place; `adr/` could not be.
  - **HOT-013** — `ADR-0018` says dimensions are "carried on the posting, in `user_data` and in the
    Mongo/Parquet projection". A TigerBeetle transfer has three `user_data` fields and all three are
    already claimed. Found 2026-08-16 while surveying OQ-040.
- **Neither ADR's DECISION is in doubt.** Replacing Xero rests on the costing model Xero cannot
  express and on ADR-0026's dual-basis requirement, none of it touched by the retracted number.
  ADR-0018's plain-COA choice rests on ADR-0017 moving reporting authority to the read side, which
  HOT-013 does not touch either. **ADR-0018 did not decide wrongly — it under-specified**, and the
  under-specification only became visible when someone counted claimants.
- So superseding is the wrong instrument in both cases: it would re-open "replace Xero" and "plain
  COA vs dimension-exploded accounts" in order to fix a Context bullet and a prepositional clause.
- **The repo already has a third pattern and it is unnamed.** `ADR-0025` narrowed the dimension
  obligation to per-account and amended REQ-LED-001's wording, carrying `relates_to: [… ADR-0018 …]`
  and an empty `supersedes:`. It refined an accepted ADR without replacing it. That worked, and
  nothing wrote down that it is allowed.

## Decision

**An accepted ADR records what was decided and why, on the date it was decided. It is not a
statement of present fact.** Three rules follow.

### 1. The body is frozen at acceptance — never edited, never annotated

No errata block, no inline correction, no "see also" appended later. The frontmatter's `relates_to`
may gain ids, because it is an index rather than a claim.

### 2. A correction to an accepted ADR's evidence lives in `inbox/`, and in `hotspots.yaml` when it is a contradiction

`inbox/` is append-only and dated, which is exactly the shape a retraction needs. A hotspot is
opened when the correction puts two spec statements in conflict — which is the normal case, since an
ADR's claim usually contradicts whatever measured it wrong.

**Nothing is ever deleted**, so a `resolved` hotspot keeps its evidence in `hotspots.yaml`
permanently. That is the durable home for the correction.

### 3. Superseding is reserved for RE-DECIDING; a question left open is answered by a new, narrow ADR

- The **decision changed** → supersede, with the symmetric `supersedes` / `superseded_by` pair gate
  6 checks.
- The **decision stands and a question it left open needs answering** → a new ADR that `relates_to`
  it and supersedes nothing. `ADR-0025` is the precedent.
- The **decision stands and a fact it cited was wrong** → rule 2. No new ADR at all.

## Considered options

- **An errata mechanism** — an appendable `errata:` block on the ADR, rendered into
  `in-force.generated.md`. Rejected: it puts truth in two places inside one file, needs a gate and a
  generator change, and makes "is this ADR current?" a question with a compound answer. It also
  concedes the premise that an ADR should be current, which is the thing being decided against.
- **Render `relates_to` hotspots under each ADR in `in-force.generated.md`** — no schema change,
  generator only. Rejected **for now** rather than on merit; see the consequences.
- **Supersede in both cases.** Rejected: re-deciding "replace Xero" to fix a Context bullet is
  disproportionate, and it would make the ADR log unreadable as a history of what was actually
  argued.
- **Historical record, resolved by convention** (chosen). Owner, 2026-08-16.

## Consequences

- **HOT-012 resolves by this convention**, and `ADR-0001` is left exactly as written — the honest
  record of what was believed on 2026-08-08.
- **HOT-013's SHAPE is settled and its SUBSTANCE is not.** ADR-0018 stays as written; the answer to
  "where do dimensions physically live on a transfer" will be a new narrow ADR under rule 3, not a
  supersede. That ADR still needs SPIKE-003 to settle TigerBeetle's query surface, and erp-spec#3's
  two candidate evictions (`journal_entry_id` may be derivable as `(source_document, posting event)`
  under ADR-0014; `posting_rule` may be a projection concern) may free the slots it needs.
- ⚠️ **The cost, stated plainly because it was accepted deliberately: a reader of an accepted ADR
  cannot tell from the ADR that one of its claims has been retracted.** They must find the hotspot
  or the inbox note. Today `ADR-0001` reads as current and its headline number is wrong by ~700×.
  **The cheap fix if this bites is the rejected middle option** — render each ADR's `relates_to`
  hotspots under it in `in-force.generated.md`, a generator change with no schema change and no edit
  to any frozen body. Recorded here so that reversing this trade-off later is a small deliberate act
  rather than a rediscovery.
- ✅ **Rule 1 is machine-enforced — `deno task validate` gate 14, built 2026-08-16.** The body's
  SHA-256 is recorded as `frozen_sha256:` in front matter and recomputed on every run, so editing a
  frozen body turns CI red and the only way to dismiss it is to update the hash in the same commit —
  a deliberate, reviewable line in the diff rather than a silent rewrite of the record. Required by
  this repo's standing rule that a stated guarantee nothing executes is not a guarantee.
  - **Landed red and watched to bite**: 19 failures on the first run (17 `accepted` + 2
    `superseded`), then green once stamped; inserting one sentence into ADR-0018's Context turns it
    red again with the two hashes named.
  - **Front matter is deliberately NOT hashed**, and that is what makes rule 1 and rule 2
    compatible: `relates_to` must be able to gain the id of a later correction, and `status` /
    `superseded_by` must be writable or superseding an ADR would trip the gate protecting it.
    Demonstrated in the same sitting — ADR-0018 gained `HOT-013` in `relates_to` with its body hash
    unchanged.
  - `superseded` counts as frozen: it was accepted once, and its body is the record of that.
- **Immutability bites only at `accepted`, and that is load-bearing.** `ADR-0032` was amended
  substantially on 2026-08-10 — a rename, a factual correction about contacts, a retracted claim
  about credit limits — precisely because it is `proposed`. Draft freely; accept deliberately.
  Acceptance is the irreversible act, not publication.
- **`relates_to` becomes the correction index**, so it must be kept current on accepted ADRs even
  though the body is not. This is the one write permitted to a frozen file, and gate xref already
  requires every id in it to resolve.
