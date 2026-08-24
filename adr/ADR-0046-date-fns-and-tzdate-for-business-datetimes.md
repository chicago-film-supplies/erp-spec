---
id: ADR-0046
headline: date-fns and TZDate for business datetimes
title: Adopt date-fns and @date-fns/tz as planned dependencies for every business datetime
status: proposed
date: 2026-08-24
review_by: 2026-11-01
deciders: [repo owner]
contexts: [ordering, billing, fulfillment, availability, tax]
relates_to: [ADR-0004, ADR-0039, SPIKE-008]
accounting_shaped: false
measurements:
  - id: M1
    value: "Temporal present in both halves of the target stack"
    of: >-
      The target runtimes, checked by execution rather than from memory: **Deno 2.9.2** (V8 14.9)
      returns `2026-08-23T23:01:42.326677002-05:00[America/Chicago]` from
      `Temporal.Now.zonedDateTimeISO`, and **Chromium 149** — the manager's own Playwright browser —
      returns the same. ⇒ **a native zone-aware datetime type emitting the exact offset form v1
      canonicalizes to is already available on both server and client.**
      ⚠️ This is a fact about the RUNTIME, not about v1, and it carries no migration caveat.
    as_of: 2026-08-24
    source: "code:2026-08-24:erp-spec@a0ec35c:spikes/harness"
  - id: M2
    value: "date-fns ^4.1.0–^4.4.0, @date-fns/tz ^1.4.1–^1.5.0 across three repos"
    of: >-
      The current workspace pins — `core` (^4.1.0 / ^1.4.1), `api-cloudrun` and `manager` (^4.4.0 /
      ^1.5.0). ⚠️ `core` floats lower than its consumers; harmless on a caret, worth knowing before
      anyone pins exactly.
      ⚠️ **A figure OF v1's dependency set**, which is what makes it evidence for CONTINUITY and
      evidence for nothing else.
    as_of: 2026-08-24
    source: "code:2026-08-24:core@9e38e9d:deno.json"
supersedes:
superseded_by:
---

> **In the context of** a rebuild whose rental days are Chicago days and whose stored business
> datetimes are already canonicalized to Chicago offset form, **facing** a choice between carrying
> forward the library that expresses that rule today and adopting the runtime's now-native
> `Temporal`, **we decided** to adopt `date-fns` and `@date-fns/tz` as planned dependencies for
> every business-datetime computation, **to achieve** continuity with the hard-won rule and one
> vocabulary shared by server and client, **accepting** that we are taking a dependency where the
> platform now offers a type that would make the defect class unrepresentable instead.

## Context

- **A rental day is a Chicago day.** Charging is by the day, the day is local, and Chicago observes
  DST — so the day an order starts is not derivable from a UTC instant without a zone. This is the
  fact that makes datetime handling a decision rather than a detail.
- **v1 already canonicalizes**, and it was expensive: every stored business datetime is Chicago
  offset form (`YYYY-MM-DDTHH:MM:SS.sss-06:00` / `-05:00`), enforced at write time by Zod transforms
  and backfilled across all 9,635 documents on 2026-04-23. The rule, the factory table and the
  anti-pattern list live in the workspace `CLAUDE.md`.
- **The library is already the vocabulary of that rule.** `@cfs/core/utils/dates` implements it with
  `date-fns` + `TZDate`, and all three v1 repos depend on both (M2).
- **The ledger's dates are settled elsewhere and this ADR does not touch them.** ADR-0039 stores a
  posting's accounting date as a packed `YYYYMMDD` in `user_data_32` with the cluster assigning the
  posting timestamp; ADR-0010 requires the two to be distinct fields.
- ⚠️ **`Temporal` is now native in both target runtimes** — measured, M1.

## Decision

**Adopt `date-fns` and `@date-fns/tz` as planned dependencies of the v2 stack**, for every
computation over a business datetime, on both the server and the clients.

`TZDate` and the `{ in: tz("America/Chicago") }` context option are the mechanism: an operation
happens **in a named zone** rather than in whatever zone the process happens to run in.

## Considered options

- **`date-fns` + `@date-fns/tz`** (chosen). One vocabulary across server and clients; the rule that
  already exists is already written in it; nothing about the canonicalization has to be re-derived.
- ⚠️ **`Temporal`, native** — and it deserves better than a one-line dismissal, because **the
  argument for it is this repo's own stated principle**: _prefer making a defect class
  unrepresentable over policing it._ `Temporal.ZonedDateTime` carries its zone in the type, so
  "formatted in the runner's zone by accident" stops being a thing a reviewer has to catch and
  starts being a thing that cannot be written. The workspace's anti-pattern list — three entries,
  all of them a missing zone — is precisely a policing regime.

  It is not chosen, and the reasons are continuity rather than capability: the rule, the helpers and
  the schema transforms exist today in date-fns terms; `@cfs/core` is shared with v1 across the
  transition, so a swap is not confined to v2; and the one area this would touch is the one already
  backfilled across every document, where the cost of being subtly wrong is highest.

  ⚠️ **That is a defensible trade and it is not obviously the right one.** Recorded here in full so
  that accepting this ADR is a decision about it rather than an oversight.
- **Luxon / Day.js / raw `Intl`.** Rejected without much argument: a third vocabulary buys nothing
  over either of the first two, and raw `Intl` is the policing regime with no helpers at all.

## Consequences

- **The v1 anti-patterns carry forward verbatim, and they are the whole operational content of this
  decision.** `new Date().toISOString()` emits `Z` form, not offset form.
  `.toISOString().slice(0, 10)` is a browser-local UTC day and is wrong across midnight.
  `format(d, "yyyy-MM-dd")` without `{ in: tz("America/Chicago") }` is the same defect. All three
  type-check everywhere.
- ⚠️ **Not every date field is a business datetime, and applying the rule everywhere is also a
  defect.** v1 deliberately leaves pure calendar dates and machine timestamps alone. The distinction
  — is this an instant, a local calendar day, or a machine stamp — is what the schema layer has to
  carry, and no library decides it.
- ⚠️ **This does NOT govern `tools/` in this repo.** `tools/` has zero npm or jsr dependencies by
  design, which is what lets CI run `deno task validate` with nothing installed; `tools/dates.ts` is
  the sole owner of its UTC calendar-day reduction and says so. A tool stamping when it ran is not a
  business datetime, and conflating the two is how a Chicago formatter once got pulled into a probe
  where it did not belong.
- **The storage FORM is a separate question and is not decided here.** ADR-0003 replaces Firestore
  with MongoDB, and whether v2 stores an offset string, a BSON `Date`, or both is a schema decision
  this ADR deliberately leaves open — adopting a library for arithmetic does not settle what the
  database holds.
- ⚠️ **A dependency now needs a version policy.** Three repos already float on carets at two
  different floors (M2). Nothing in this ADR sets one, and the cross-repo publish order in the
  workspace `CLAUDE.md` is where a pin would have to be honoured.
- ⭐ **Temporal does not go away by being rejected.** It is native, it is measured (M1), and the
  argument recorded above only gets stronger as the ecosystem moves. **If this is revisited, it is
  revisited by a superseding ADR** and not by drifting into it — which is the one outcome the
  Considered options section above exists to prevent.
