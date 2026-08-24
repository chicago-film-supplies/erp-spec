---
id: SPIKE-009
headline: what replaces Firestore listeners
question: >-
  What replaces Firestore real-time listeners — MongoDB change streams plus a socket layer — and
  what does that actually cost on the client?
timebox: 1 week
method: >-
  Build a vertical slice: a change stream on one collection, a socket layer, and a SolidJS store
  that stays live. Then inventory every place the current manager app depends on listener
  semantics and cost each one.
exit_criteria:
  - A working slice where a server-side document change updates a SolidJS view without a refetch.
  - Resume-token handling specified, including what happens after a disconnect longer than the oplog window.
  - An honest inventory of manager-side listener dependencies, with per-site effort — not a single aggregate estimate.
  - Authorization model stated: Firestore rules enforced reads directly; a socket layer must re-implement that.
closes_adr: new
status: in_progress
---

## Notes

**This is the largest hidden line item in the migration.** ADR-0005 keeps SolidJS, which makes it
tempting to treat the client as mostly done. The framework survives; the data layer does not.

The authorization point is easy to miss: today the manager reads Firestore directly under security
rules. A socket layer inherits that responsibility with nothing enforcing it by default.

## ✅ Criterion 3 — the listener inventory, 2026-08-23

Source-read of `code:2026-08-23:manager@56e41fd`, writer sets from
`code:2026-08-23:api-cloudrun@968c9542`. Read via `git archive HEAD`, so the uncommitted tax-surface
work influenced nothing; diffed separately and it adds no subscription site.

**52 distinct subscription sites across 34 collections.**

### ⭐ Three chokepoints cover 65% of them

| primitive                      | shape                                        | sites  |
| ------------------------------ | -------------------------------------------- | ------ |
| `createEntityCache`            | `onSnapshot(doc(...))`, one per cached doc   | **22** |
| `createEntityListCache`        | `onSnapshot(query)`, LRU-keyed               | **7**  |
| `createPaginatedFirestoreList` | `onSnapshot(pageQuery)` + count + cursor map | **5**  |
| hand-rolled                    | —                                            | 18     |

All funnel through `createAsyncState`, whose listener contract is _a fetcher that returns a cleanup
function_. ⚠️ **Anyone costing this from a raw `grep onSnapshot` count overestimates the porting and
underestimates the hard parts.**

### The verdict on "the largest hidden line item" — SUPPORTED, and do not soften it

| why it is live    | sites | share   |
| ----------------- | ----- | ------- |
| `external`        | 25    | 48%     |
| `collaborative`   | 16    | 31%     |
| `cross-surface`   | 6     | 12%     |
| **`convenience`** | **5** | **10%** |

⇒ **79% are driven by writers the client cannot invalidate against, because the client never made
the write** — five webhook endpoints (CRMS Member / Opportunity / Invoice, Xero Payment, GitHub
Templates) and ~30 Cloud Task workers. ⭐ **A fetch-on-mount + refetch-after-write architecture has
no answer for "Xero just paid this invoice" or "an admin revoked your role."**

Effort spread: **S ×20, M ×27, L ×5** — the L's are `orders`, `invoices` and three card fan-out
sites.

### ⭐⭐ THE HARD PARTS ARE NOT IN THE TABLE, and none of them scales with the site count

1. **Server-side predicate re-evaluation.** A change stream reports _the document that changed_, not
   _that it left some subscriber's query_. Firestore emits a removal when a doc stops matching; with
   `fullDocument: "updateLookup"` you get the new document and must re-evaluate **every live
   subscriber's predicate** yourself. ⚠️ **This is the single largest genuinely-new engineering
   piece and it has no Firestore analogue to copy.** Five sites depend on the effect —
   `deleted_at == null`, `status in INCOMPLETE`, `date_fs == null`, `array-contains`, date-overlap —
   and **none of them is a delete.** ⭐ **The mitigation is already latent**: the app never reads
   `docChanges()` and only ever consumes whole result sets, so **re-sending the full matched set
   reproduces all five exactly** — no `removed` event type on the wire. The cost moves to the
   server, entire.
2. ⚠️ **Transparent reconnect is assumed absolutely and guarded NOWHERE.** `createAsyncState`'s
   listener branch logs and stops — no retry, no backoff, no re-subscribe, and no `visibilitychange`
   / `navigator.onLine` handler anywhere in `src/`. **A dropped subscription today is unrecoverable
   short of a page reload, and nothing tries.** The Firestore SDK resumes transparently, so the gap
   has never been exercised. ⇒ **a transport that does not resume converts this into a
   silent-stale-data class across all 52 sites at once**, and it will not show up in any site count.
3. ⭐⭐ **A 2-SECOND HARD DEADLINE at eight sites, three of them money.**
   `waitUntil(pred, { timeoutMs: 2000, intervalMs: 50 })` reconciles an **unknown-outcome write** by
   observing the listener deliver the row — `settlements`, `creditNotes`, `bookings`,
   `HolidayManager`, and three arms of `TaxManager`. ⇒ **a poll-based replacement with an interval
   above ~2s turns a LANDED PAYMENT into a reported failure.** This is invisible from the
   subscription table and is the sharpest single dependency in the inventory.

### What is free, and one way it can be broken

⭐ **Latency compensation is not used and could not be** — the manager makes **zero direct Firestore
writes** (`allow write: if false` on every collection), so a write never enters the SDK's mutation
queue. Zero hits for `hasPendingWrites` / `includeMetadataChanges` / `fromCache`.

It **built its own** instead: `createEntityCache.applyServerData` overlays local divergence on every
snapshot with three-tier precedence (live dirty > stashed > server), a dirty set recomputed by field
diff, and a `localStorage` stash epoch-versioned by `PENDING_SCHEMA_EPOCH = "cents"` so a pre-cents
stash cannot replay values 100× low. **Portable verbatim.**

⚠️ **But the new transport must deliver SERVER TRUTH, UNMERGED.** If a socket layer helpfully echoes
the client's own write back as authoritative, `recomputeDirty` clears dirty fields that were never
persisted. **A well-meant optimization silently discards unsaved operator edits.**

### Two sites worth naming individually

- ⭐⭐ **`users/{own uid}` is the RBAC REVOCATION PATH, not a UI nicety.** An admin bumps
  `token_version`; the listener fires; `getIdToken(true)` refreshes and `/auth/me` re-fetches.
  `firestore.rules`' `notStale()` refuses claims older than the doc's `token_version`, so **without
  this channel the client holds a stale claim for ~1h and every read is denied meanwhile.** ⇒
  **whatever replaces it must exist BEFORE any other listener migrates.**
- ⭐ **`typesense` is the cheapest win in the inventory.** `updates` is a monotonic counter used
  only as an edge trigger — it carries no domain data. **It is already the "collection X changed,
  re-query" message a socket layer would send.** One server-push message type replaces it and
  **retires a Firestore collection.**

⭐ **And one line item SHRINKS.** The per-list card fan-out exists because Firestore's `in` caps at
30, so N listeners are spun up reactively per selected list. **MongoDB has no such cap — one query
replaces N listeners.**

### What was NOT measured, and it would sharpen the estimate

⚠️ **`collaborative` was classified from WRITER SETS — who is capable of writing — not from measured
concurrency.** Whether two operators actually hold the same order open, and how often, is
**unmeasured**, and it decides whether ~16 sites need a socket or survive on refetch-after-write.
**It is measurable from VictoriaLogs.** Also unmeasured: per-collection change rates (which set poll
intervals for the 12 fetch-on-mount sites), and steady-state concurrent listeners per session —
**that number, not 52, sizes the server-side fan-out.**

## ✅ Criterion 4 — the authorization model, 2026-08-23

`code:2026-08-23:manager@56e41fd:firestore.rules`, 152 lines. ⭐ **Verified LIVE rather than
assumed** — fetched both deployed rulesets from `firebaserules.googleapis.com` and diffed:
**byte-identical to the repo file in both projects**, 9,985 bytes, 0 diff lines.

### ⚠️⚠️ READ THIS BEFORE THE REST — the conclusion below is scoped to the OPERATOR app

**Owner, 2026-08-23, after this criterion was written:** _"we should expect contacts to log in to
view orders, invoices make new orders manage access control and contacts for their project, that
will require som scoped permissions we potentially dont have today."_

⭐ **Everything below is accurately measured and was stated unconditionally when it is
conditional.** It holds for an operator-facing application, which is the only one that exists today.
**The moment a customer logs in, per-document authorization becomes mandatory** — and the current
model has no machinery for it: verified at
`code:2026-08-23:core@ccaf327:src/schemas/permissions.ts`, **every permission is `<resource>.<verb>`
and not one carries a scope dimension.** `orders.read` means every order.

⚠️⚠️ **UPDATED 2026-08-23 — "does not exist" is expiring: V1 WILL GET A PUBLIC CLIENT APP** (owner).
⇒ **row-scoped authorization will be BUILT IN V1**, before ERP scaffolding starts, so v2 will be
able to **measure a working implementation** rather than design against a blank. ⚠️ **That is
evidence, not a decision** — v1 having a model does not make it v2's model, which would be the
solution-transplant error the fifth rule in `CLAUDE.md` names. ⭐ **And note the shape: this is the
THIRD turn of the same screw** — the absence was measured accurately, over-generalised, corrected to
"v2 needs a model that exists nowhere", and that correction is now expiring too. **An absence in v1
is not a reliable claim about v1's own future.**

⇒ **two authorization models, and they must not be one retrofitted.** The operator model
(collection-scoped, exists, tested) stands as described. The customer model (row-scoped, not yet
built) lands on **every `/db/*` route**, not only the socket layer — `dbRead.ts` returns documents
_"as stored, unredacted… the gate is RBAC, not field-level redaction"_, which is defensible for
operators and a leak the moment a customer holds a token.

⭐ **The scoping key already exists in the target spec**: `ADR-0032`'s contact **membership edges**,
each carrying a role at the `(project × department)` leaf. **The same model scopes the `ADR-0045`
tax attestation**, which is a strong sign it is right rather than two coincidences.

⚠️ **And it makes criterion 3's hardest item harder** — the server must now re-evaluate
**authorization** per event as well as query membership. Full note:
`inbox/2026-08-23-owner-contacts-will-log-in-which-inverts-the-authorization-finding-recorded-hours-earlier.md`.

### ⭐⭐ The structural fact that sizes the whole obligation

**No rule in the file references `resource.` at all** — zero matches for `resource.data`,
`resource.id`, `request.resource`. ⇒ **every read rule is COLLECTION-scoped, never
document-scoped.** Authorization is a pure function of the caller:
`(token.roles, token.tv, token.email_verified,
auth.uid)` plus two `get()` lookups, and for a given
user and collection it is **one boolean, constant across every document in it.**

⇒ ⭐ **There is no per-document authorization removal to reproduce**, because Firestore is never
making a per-document decision here. ⚠️ **Do not confuse this with criterion 3's predicate
re-evaluation** — a document leaving a _query's_ result set is still real work; a document leaving a
user's _permitted_ set does not happen.

38 collection blocks: **34 permission-gated** and collection-scoped, **1 hybrid** (`users/{uid}` —
self-read OR `users.read`, path-scoped, and the self-read arm deliberately bypasses `notStale()` so
a stale client can still discover its own `token_version` bump), **1 public** (`stock`,
`allow read: if true`, pre-reduced to anonymous `{start, end, quantity, kind}` intervals), **2
explicit deny**, and `allow write: if false` on all 38.

### The claims are NOT Firebase custom claims

⚠️ **There is no `setCustomUserClaims` anywhere in the workspace.** `api-cloudrun` is its own
identity provider and mints a **Firebase custom token whose DEVELOPER claims** carry the payload —
`{ email_verified, roles, tv }` — from three sites (`/auth/login`, `/auth/me`,
`/auth/accept-invite`).

⭐ **`roles` is a list of NAMES, not permissions.** The rules resolve name → permissions with a live
`get()` on `roles/{name}` at every evaluation, which is why that collection's document id is the
name rather than a uid — _"firestore.rules can only `get()` by path and never query, so the doc id
must BE the claim string."_

**The `get()` budget is 1 + 9 = 10, which is exactly Firestore's cap** for a single-document read,
and it is why roles are capped at 9 per user, enforced server-side. Recursion is unavailable, so the
role loop is manually unrolled `roleAt(0..8)`.

### ⭐⭐ Authorization is NOT stable for the life of a subscription

| vector                                | client's token changes?   | effect on an OPEN listener                              |
| ------------------------------------- | ------------------------- | ------------------------------------------------------- |
| **`roles/{name}.permissions` edited** | ⚠️ **No — not at all**    | every holder re-authorized or **de-authorized at once** |
| `users/{uid}.token_version` bumped    | not until the client acts | `notStale()` flips → **all 34 collections deny**        |
| `users/{uid}.roles` changed           | only on a new mint        | none until the token is replaced                        |

⭐ **The first row is the load-bearing one.** A socket layer authorizing once at subscribe would
keep serving a user whose role was stripped seconds earlier, **indefinitely, because nothing about
that session changed.** Firestore re-derives it on every evaluation.

⇒ ⭐⭐ **subscribe-time authorization is WRONG, and per-document authorization is UNNECESSARY.** The
obligation is a per-`(user, collection)` boolean, re-evaluated per event, invalidated only by writes
to two well-known document classes. **That is the whole of what v2 must reproduce** — there is no
redaction and no row-level scoping anywhere to carry across, on either the Firestore or the API
side.

⚠️ **And when it flips, the listener ERRORS and terminates — it does not silently empty.** Evidenced
by manager#233 (a rule naming a non-existent permission denied every user and surfaced as
`listener_error`) and by a code comment recording direct observation. ⇒ **the socket layer needs an
explicit REVOCATION FRAME**; dropping documents would be a semantic the current system does not
have, and the manager's detail routes now gate on `loadError()`.

⭐ **A useful precedent already exists**: `api-cloudrun/src/lib/permissionCache.ts` is a 60s-TTL
in-process role→permissions cache with explicit invalidation from the admin mutators. **So the API
is already up to 60s stale on a role edit while the rules are not** — v2 inherits that choice with a
documented answer rather than an open question.

### Two things the socket layer must not inherit by accident

- ⭐ **The authorization lookup is PRIVILEGED.** The rules' internal `get()`s bypass rules, so a
  user with `orders.read` but not `roles.read` reads orders while unable to read the role document
  that authorized them. **The socket layer must make the same split.**
- **App Check is ENFORCED** on `firestore.googleapis.com` in both projects (verified live). ⇒ even
  the "public" `stock` read is not reachable from an arbitrary HTTP client in production, and the
  rules test asserting anonymous success runs against an emulator where App Check does not apply.

### ⚠️ Where the model is a claim rather than a check

- **The rules test suite is a PRE-PUSH GIT HOOK, not CI.** Neither deploy workflow runs it — both go
  straight to `firebase deploy --only firestore:rules`. ⇒ **a `--no-verify` push, or any cloud
  agent, deploys rules to prod with the suite never having run.** Its `GATED_COLLECTIONS` list is
  also hand-maintained, so a new `match` block is untested by default.
- **`manager/firestore.rules.previous` exists, is referenced by nothing, and contains the pre-RBAC
  blanket rule** `allow read: if request.auth != null && email_verified`. ⚠️ **A dead file that
  reads as current config** — the same failure mode as a stale plan doc.
- ⭐ **The suite injects claims directly**, so it proves the RULE behaves correctly given a claim.
  **It proves nothing about whether the real system can produce that claim** — which is the next
  item.

### 🔴 A flagged finding, NOT asserted — the revocation RECOVERY path may not work

`user.ts` intends: bump `token_version` → listener fires → `getIdToken(true)` → re-fetch `/auth/me`,
so _"role revocations bite within seconds instead of ~1h."_ **Four facts sit uneasily against it**:
there is **no `setCustomUserClaims`**, so no server-side record for a refreshed ID token to re-read
`tv` from; `refreshFromServer` **receives a new custom token in `result.firebaseToken` and discards
it**, never calling `signInWithCustomToken`; `checkSession` re-exchanges only when the uid differs,
so **even a full reload does not re-exchange**; and Firebase documents the refresh mechanisms for
`setCustomUserClaims`, not for custom-token developer claims.

⚠️ **If developer claims are pinned to the sign-in session, a `tv` bump denies all 34 gated
collections until an explicit logout.** ⭐ **Corroborating**: "View as Role" is documented as _"not
server enforcement or `firestore.rules`"_ — true only because the manager never exchanges the
preview-role token minted by the same mechanism. **Test coverage: zero.**

⇒ **Not stated as fact — the experiment was not run.** Filed as manager#332. ⭐ **It is load-bearing
for this spike either way**: it is the difference between _"revocation propagates in seconds"_ and
_"revocation requires re-authentication"_, and **a socket layer holding its own session has the
easier job — it can push a revocation frame — which is an argument in the socket design's favour.**

### Unknowns that bound the design

⚠️ **The propagation delay for a DATA-driven rule change under an active listener is undocumented.**
Firebase publishes a bound for changes to the rules _source_ (up to 10 minutes for active
listeners), not for a `roles/{name}` edit. ⭐ **This is the single most consequential unknown for
the socket spec, because it sets the bar the socket layer is being compared against** — and it is
measurable.

## ✅ Criterion 1 — the vertical slice, 2026-08-23

Executed. `spikes/harness/realtime-slice/` — a change stream on one collection, a Hono WebSocket,
and a SolidJS store that stays live. `deno task slice`, driven by `deno task slice-mutate`, which
connects to mongod **directly** and never touches the slice server, so the change under test is one
the client did not make and cannot invalidate against — the 79% case from criterion 3.

Needs a **replica set**, not the standalone `SPIKE-002` left behind: change streams read the oplog
and a standalone `mongod` has none. Setup in `spikes/harness/_README.md`.

### "Without a refetch" is asserted, not assumed

The server counts every HTTP request it serves and ships the count in each frame. Measured across a
server-side update: **`httpRequests` stayed at 1** — the page load — while the row changed. The
initial snapshot rides the socket for the same reason; otherwise "no refetch" would be true of
updates and false of the initial load, which is not what the criterion asks.

### ⭐ The manager's existing listener contract SURVIVES the transport swap

`createAsyncState` accepts _a fetcher that returns a cleanup function_
(`code:2026-08-23:manager@56e41fd:src/primitives/createAsyncState.ts`), which is how it consumes
`onSnapshot` today. `subscribeCollection` in the slice has exactly that shape. ⇒ **the primitive
does not have to change, and the 52 subscription sites keep their call signature.** That is the
single largest cost-reducer found so far, and it is why criterion 3's three chokepoints matter.

⚠️ **What does NOT survive is the FAILURE branch.** `createAsyncState`'s listener arm logs and stops
— no retry, no backoff, no re-subscribe. The slice reproduces that gap deliberately rather than
papering over it, and it is criterion 3's item 2 restated with a working example in front of it.

### ⚠️ NEW failure mode with no Firestore analogue: `watch()` is LAZY

The server-side cursor opens on the **first read**, not at the `watch()` call. A write issued
between the two lands before the stream's start point and **is never delivered** — silently.
Firestore's `onSnapshot` has no equivalent gap: it delivers an initial snapshot, so "subscribe then
write" is safe there and is a race here.

⭐ **Found by being bitten, not by reading.** The first probe run hung with zero output because the
insert it was waiting for had happened before the cursor existed. ⇒ **every subscription site
acquires a start-point obligation it does not have today**, and the fix (`tryNext()` before
announcing readiness) has to be inside the shared primitive or it will be forgotten at 52 sites.

### ⭐⭐ Reactivity is asserted by EFFECT COUNT, because a screenshot cannot tell the difference

`deno task slice-store` — applying a change frame for row `b` notifies the render effect watching
`b.qty` **exactly once** and the effects on `a` and `c` **not at all**; an identical redelivered
frame notifies **nothing**.

A fine-grained cell update and a wholesale table re-render produce the **same screenshot**, and the
second is what a naive socket client does. The test was inverted to check it can fail: replacing
`reconcile` with a plain array assignment turns it red, which is the regression it exists for.

⚠️ **NOT verified: the actual DOM painting in a browser.** No browser automation was available this
session. The transport is proven by execution and the reactivity by assertion; a human loading
`http://127.0.0.1:8791` and running `deno task slice-mutate` is what closes the last gap. **Recorded
as unverified rather than implied.**

### ⭐⭐ A test-infrastructure finding that outlives this spike

**Solid ships a reactive browser build and a non-reactive SSR build, and there are TWO independent
ways to silently get the SSR one under Deno:**

1. `npm:solid-js` honours an explicit **`deno` export condition** pointing at `dist/server.js`.
2. **esm.sh serves Deno the same SSR build** unless a browser target is forced (`?target=es2022`).

In the SSR build **`createEffect` never runs and `createRenderEffect` runs once and never again.** ⇒
**a reactivity test written the obvious way measures nothing and reports success.** It cost four red
runs to find, and only because the assertions were positive counts — an assertion of the form "the
other rows did not update" would have passed against a runtime where **nothing** updates.

⚠️ There is a third variant of the same trap: mapping `solid-js` to the browser build while
`solid-js/store` re-resolves its own internal `solid-js` through the `deno` condition gives **two
reactive runtimes**, store signals in one and effects in the other, and nothing notifies anything.
Same class as this harness's existing Zod double-instance warning.

⇒ **Client reactivity belongs in `manager`'s existing vitest/jsdom suite, not in a Deno harness.**
The pin and the reason are in `spikes/harness/deno.json`; it is `?target=es2022` that is
load-bearing.

## ✅ Criterion 2 — resume tokens, 2026-08-23

`deno task change-stream` — 11 probes, all green from a cold server, against **mongod 8.0.4**
single-node replica set, driver `mongodb@6.20.0`. Every probe asserts a value; none asserts an
absence of throw.

### What a resume token is

| measured                | value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| shape                   | `{_data}` and nothing else — **188 hex chars, 94 bytes**           |
| ordering                | arrival order **is** lexicographic order — a token is COMPARABLE   |
| `resumeAfter` semantics | **exclusive** of its own event, so persisting it cannot re-deliver |

### ⭐ The post-batch resume token is what makes a filtered subscription safe

A stream whose `$match` nothing satisfies still advances `stream.resumeToken` — measured across
**200 non-matching writes with zero events delivered**.

⚠️ **This only helps a client that persists `stream.resumeToken`.** A client that persists the token
of the **last delivered event** — the obvious implementation — lets an idle filtered subscriber's
token rot at the oplog's rate while the server knew better the whole time. **The distinction is
invisible until a reconnect, and it is a one-word difference in the client.**

### ⭐⭐ The oplog window is NOT a quantity the application can compute

The intended probe was: evict a real token, assert `ChangeStreamHistoryLost`. **It could not be made
to happen.**

| configured `oplogSize` | incompressible writes + 30s settling | token still resumable? | retention |
| ---------------------- | ------------------------------------ | ---------------------- | --------- |
| 1 MB                   | 98 MB                                | **yes**                | **104x**  |
| 200 MB                 | 586 MB                               | **yes**                | **3x**    |

WiredTiger truncates in markers with a large minimum size, which a small oplog cannot divide into —
the ratio collapsing from 104x to 3x as the oplog grows is that mechanism showing itself. Truncation
also lags **far** behind a sustained burn (the oplog was measured at 85x its cap mid-burn) and
catches up once writes stop.

⇒ ⭐ **Two consequences, and the second is the one that changes the design:**

1. `oplogSize` is a **floor** for retention, never a bound. Capacity planning on the ADR-0013 host
   cannot use it to answer "how long may a client be offline".
2. **The resume-failure path cannot be exercised by racing the oplog.** It has to be driven by
   INJECTION — so the client's recovery code needs a **test seam**, and a plan to integration-test
   it against a real server is a plan that will never run the branch.

⚠️ **Code 286 `ChangeStreamHistoryLost` WAS observed twice**, via `startAtOperationTime` on a server
whose oplog had been through repeated burn cycles — but **not reproducibly from a clean start**, so
it is recorded here as a dated observation and is **not** asserted by a green probe.

### ⭐ 286 means "truncated past you", NOT "your token is old"

A start point **an hour before** an un-truncated oplog is **accepted**, not rejected. The error is
about lost history, not about age — so a client that treats "my token is old" as the failure
condition will handle a case the server never raises, and miss the one it does.

### A drop emits TWO events, and only one resume option survives it

| step                      | measured                                                   |
| ------------------------- | ---------------------------------------------------------- |
| `drop` then `invalidate`  | two events, in that order; `invalidate` closes the stream  |
| `resumeAfter(invalidate)` | **code 260 `InvalidResumeToken`**                          |
| `startAfter(invalidate)`  | works — delivers the next event on the recreated namespace |

⇒ a client that persists the token of the last event it saw persists the **invalidate**, and
`resumeAfter` — the obvious call — is the one that fails on it.

### ⭐⭐ `fullDocument: "updateLookup"` hands a lagging reader a state that NEVER EXISTED at the event

Measured: an update `v:1→2` followed by `v:2→3` before the stream is read delivers the **v=2 event**
carrying **`fullDocument.v === 3`**.

⇒ **the event's `updateDescription` and its `fullDocument` describe different moments**, and the gap
widens exactly when the reader is behind — which is precisely when a reconnect replay is running. ⚠️
This directly sharpens criterion 3's item 1: **a server re-evaluating subscriber predicates against
`updateLookup` is evaluating them against the wrong document.**

**The fix is measured and it is per-collection opt-in**:
`changeStreamPreAndPostImages: { enabled:
true }` plus `fullDocument: "required"` returns **v=2**,
the event's own state. That is a storage cost and a per-collection decision, and it is not the
default. ⇒ **the collections where a lagging reader would act on a state that never existed — the
money ones — have to be named.**

## What remains

⚠️⚠️ **THE ADR IS SHARED WITH `SPIKE-013` (offline queued writes), BY OWNER RULING, 2026-08-23.**
`closes_adr: new` on both — **they name the SAME new ADR, and a session that writes two has misread
this.** ⇒ **this spike's evidence is complete and its ADR cannot be drafted until SPIKE-013
reports**, because the owner chose one coherent statement of how the client works over closing m4
sooner. The cost was stated and accepted: m4's last machine-checkable criterion now waits on both.

Rulings and their reasoning:
`inbox/2026-08-23-owner-rules-the-realtime-replacement-and-folds-offline-with-queued-writes-into-it.md`.
**Three rest on this spike's measurements (R1, R2, R3) and three on owner rulings (R4, R5, R6); the
ADR must label which is which** rather than let them read alike.

- **Criterion 1's browser confirmation** — one human, one page load, one `deno task slice-mutate`.
  ⭐ `manager` has a mature Playwright setup (`light`/`dark`/`smoke` projects, auth + fixture setup,
  a route graph) which can assert the DOM changed **while counting network requests** — strictly
  better than the manual step, and it is also the only realistic way to exercise reconnect, since
  the oplog cannot be raced.
- **The shared ADR**, once SPIKE-013 lands.
