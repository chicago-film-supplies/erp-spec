---
id: SPIKE-013
headline: offline queued writes and their conflict surface
question: >-
  What does offline with queued writes actually cost, given that most fields save on
  focusout — how are writes coalesced and replayed, what identity does an offline create
  carry, and what does the conflict surface have to arbitrate beyond a same-field collision?
timebox: 1 week
method: >-
  Build the queue against the manager's existing localStorage stash rather than beside it, and
  drive it through a real disconnect: coalesce per (document, field path), replay in order,
  and force a deferred validation failure. Then enumerate the conflicts the popover CANNOT
  arbitrate, from the live corpus rather than from imagination.
exit_criteria:
  - A queued field write survives a disconnect longer than the session and replays exactly once, with three offline edits to one field replaying as one write.
  - An offline create is addressable by subsequent queued writes before it reaches the server — so the identity decision (client-generated uid or otherwise) is made and demonstrated, not assumed.
  - A write that fails validation on replay lands somewhere a human sees it, with the field named; measured with the operator absent, which is the case that makes it hard.
  - The conflicts a same-field author/timestamp popover CANNOT arbitrate are enumerated from the live corpus with a count for each, not asserted as a list.
  - Whether the undo path requires OQ-043's document event history is answered yes or no, with what breaks if it is no.
  - The offline/pending/synced state is shown to be derivable at every save-on-focusout site — the absence of an error is currently the only feedback, so this is the load-bearing half.
  - A field photo captured offline survives and uploads on reconnect — blobs are not field writes, and a queue that treats `qty: 2` and a 4 MB JPEG identically has not been designed for the second.
closes_adr: new
status: in_progress
---

## Notes

⚠️⚠️ **THE ADR IS SHARED WITH `SPIKE-009` (what replaces Firestore listeners), BY OWNER RULING,
2026-08-23.** `closes_adr: new` on both — **they name the SAME new ADR, and a session that writes
two has misread this.** SPIKE-009's evidence is already complete and is waiting on this spike, so
**this spike is the critical path to m4's last machine-checkable criterion**, not a side quest.

**Opened 2026-08-23 at the owner's suggestion**, out of the `SPIKE-009` ADR interview. Full rulings
and their reasoning:
`inbox/2026-08-23-owner-rules-the-realtime-replacement-and-folds-offline-with-queued-writes-into-it.md`.

⚠️ **This is NEW CAPABILITY, not migration.** Firestore shipped offline persistence, but the manager
makes **zero direct client writes** (`allow write: if false` on all 38 collections —
`code:2026-08-23:manager@56e41fd:firestore.rules`), so it was never used for writes. **Nothing is
lost in the move to MongoDB**, and that is precisely why this is a spike of its own rather than a
line item inside the listener replacement.

## ⭐⭐⭐ Finding 1, 2026-08-23 — the write path's recovery DEPENDS on the listener

Measured at `code:2026-08-23:manager@fd2fd54:src/primitives/createEntityCache.ts` and
`code:2026-08-23:api-cloudrun@bbb791af:src/lib/version.ts`. Full account and the claim it corrects:
`inbox/2026-08-23-correction-the-per-field-save-is-a-trigger-not-a-payload-and-the-write-path-depends-on-the-listener.md`.

⚠️ **Save-on-focusout is a TRIGGER, not a payload.** `update(id, field)` uses the field name only to
choose what to VALIDATE; `buildDiff` sends the **whole entity diff** plus `uid` and `version`.
`checkVersion` 409s on any mismatch — **23 API service files, 21 `versioned: true` caches across 17
manager stores.** ⇒ **concurrency is DOCUMENT-level**, and two operators editing different fields of
one order **do** collide.

⭐ **It does not bite today because the LISTENER keeps `version` fresh.** The 409 path rebuilds the
diff against the concurrent writer's state, and the unknown-outcome path — a 5xx, a timeout, a
network failure — is reconciled by _"wait for the listener, then re-enter the loop to rebuild the
diff against whatever the server now holds"_. **There is no idempotency key: the version IS the
idempotency key, and the listener is how the client learns it** (api-cloudrun#247 — a same-doc PUT
burst can time out or phantom-500 _after_ Firestore committed).

⇒ ⚠️⚠️ **Four consequences, and they make this spike harder rather than easier:**

1. **Offline the snapshot baseline FREEZES**, so every queued write replays at a version stale by
   the length of the disconnect — **409 for every document anyone else touched.**
2. **Queued writes cannot resolve their own fate offline.** Both recovery paths need fresh server
   state from a listener that is not there.
3. **Replay is not "send the queue".** The first replayed write bumps the version, so the second is
   stale by its own predecessor. **Replay must re-read, re-base and re-diff** — that is where
   conflict resolution lives, not in the popover.
4. **Per-field payloads with a server-side field-level merge are a CHANGE TO THE WRITE PATH**, not
   something already present.

⭐ **This is why the shared ADR is right.** The write path's recovery is _defined in terms of_ the
listener, so "what replaces the listener" and "what happens offline" are one decision seen from two
sides — which neither side knew when the ruling was made.

## ⚠️ Scope addition, 2026-08-23 — the queue must carry BLOBS, not only field writes

Owner input
(`inbox/2026-08-23-owner-the-image-manager-is-three-jobs-two-of-them-evidence-and-quo-is-a-new-boundary-with-a-contact-sync.md`):
employees photograph what was delivered and set up, and trash pickups, and text them to customer
contacts. ⇒ **field photos are captured exactly where the signal is worst** — a delivery, a location
— which is this spike's "manager out on location" case.

⚠️ **But everything above designs the queue for FIELD WRITES**: small, coalescible by
`(document, field path)`, replayed as diffs. **A photo is a blob** — megabytes, not coalescible, and
its idempotency story is upload-level rather than field-level. A 4 MB JPEG and `qty: 2` are the same
object to the queue as specified, and they should not be.

⇒ Exit criterion added. ⭐ **And the storage question is `OQ-059`'s, not this spike's**: two of the
three image jobs are **evidence** with retention duties that a CDN reaper fights, so where the blob
lands is a separate decision from whether the queue can carry it.

## ⭐⭐ Finding 2, 2026-08-23 — the architecture is a THREE-WAY MERGE, and its key is measured

Owner ruling — _"we dont have to replicate the current system… play the whole queue on stale doc,
and the fresh doc, the diff the 2 and raise conflicts in client"_. Full note:
`inbox/2026-08-23-owner-proposes-three-way-merge-replay-the-queue-against-both-base-and-fresh-and-diff.md`.

⭐ **Strictly stronger than the version gate it replaces**, which discards the base and so cannot
tell _"we both changed this"_ from _"only one of us did"_. Keeping the common ancestor makes
_"different fields do not collide"_ true **by construction** rather than as an accident of listener
freshness — and it makes the author/timestamp popover fire only on genuine collisions.

**Measured** — `deno task merge-key`, read-only prod under ADC, 995 orders / 13,671 items:

| measured                               | value                             |
| -------------------------------------- | --------------------------------- |
| orders where a **leaf** uid repeats    | **182 — 18.3%**                   |
| leaves in a repeated group             | 892 — **9.1% of all leaves**      |
| worst repetition of one uid            | **5×**                            |
| orders where a **divider** uid repeats | **0 — 0.0%**                      |
| edited ≥5 times / ≥20 / max            | 840 (84.4%) / 78 (7.8%) / **153** |

⇒ ⚠️ **keying the merge on `items[].uid` pairs the WRONG ROWS in 18.3% of orders, silently.** The
key must be `(uid, k-th occurrence)` — the API carry-forwards' key, for the same reason. ⇒ ⭐
**dividers key cleanly by uid (0 collisions), so only leaf rows need occurrence counting** —
materially cheaper than "items are unmergeable", and unknowable without the number. ⚠️ **`path` is
not the alternative**: divider uids are reused by name, so a group rename churns every descendant
path, and a merge compares exactly two document versions.

⭐ **18.3% independently confirms the workspace `CLAUDE.md` figure of "18% of prod orders"**,
carried as an assertion and never re-measured until now.

**Six things the design still owes, and none is the popover:** pin the base (today's baseline is
mutated in place); exclude and recompute derived fields (totals/tax/`path` — an authored-vs-derived
distinction the schemas do not carry); union semantics for concurrent adds, not just field choice; a
terminal-state class that REFUSES the merge (an invoice paid while you were offline is closed);
replay against `theirs` can FAIL, not merely conflict, when its target row is gone; and **ledger
postings do not merge at all** — a posting is reversed by a further posting, so the boundary between
what merges and what posts is a decision this ADR owes.

## ⭐⭐⭐ Finding 3, 2026-08-24 — criterion 4 answered: the popover cannot arbitrate ACTOR-vs-STATE

Harness `spikes/harness/conflict-surface-probe.ts`, `deno task conflict-surface`, read-only prod
under ADC. Corpus: **995 orders · 1019 invoices · 6,975 bookings · 568 products · 458 destinations ·
291 organizations · 166 contacts · 11 taxes**.

### ⛔ Read this before any number below — what it is a figure OF

⚠️⚠️ **This measures the v1 MIGRATION CORPUS. v1 is UNFINISHED and is not the model.** Every count
sizes a class **within history**. None of them says what v2 must do, and none predicts how often a
v2 operator meets one.

⚠️ **The first version of this finding got that wrong, and the owner caught it.** It reported
_"orders carry no author at either end, so the popover is specified against a field that is absent"_
and concluded the design owed an answer to "who edited this". **That is the absence-to-absence
error, for the fifth recorded time.** `REQ-FUL-001` already requires v2 to record the acting crew
member, and `REQ-FUL-002` exists precisely to keep _"no actor"_ distinguishable from _"an actor
nobody wrote down"_. ⇒ **v1's missing author is a v1 gap** — api-cloudrun#407 is the open issue to
close it — **not a constraint on the system being specified.**

### ⭐⭐ What the criterion actually answers, and why this half survives

**The conflicts a same-field author/timestamp popover cannot arbitrate are mostly not
actor-vs-actor. They are actor vs STATE**: the invoice was paid while you were offline, the row your
edit addressed is gone, the rate moved, the field is derived and must be recomputed rather than
chosen, the posting is immutable. ⇒ **the second party is the SYSTEM, not a second person.**

⭐ **And that is a DOMAIN argument, not a corpus one — which is exactly why it survived while the
authorship claim did not.** Invoices get paid, rows get deleted, rates change, totals are derived
and postings are immutable in **any** version, at any staffing level, under any actor model. A
popover that offers "yours or theirs" has no question to ask in a single one of these cases.

### The classes, and what each count is a figure of

| class                             | the kind (domain — holds in v2)                          | migration corpus                                          |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| **A — terminal state**            | a closed document refuses a merge at any granularity     | 879 orders · 998 invoices are terminal in history         |
| **B — derived fields**            | a derived value is recomputed, never chosen from a side  | 19,283 of 28,157 lines carry a derived money leaf         |
| **C — union, not choice**         | two operators adding different rows is a union           | items[] median 8, max 150 rows                            |
| **D — the target is gone**        | an edit whose row vanished FAILS; it does not conflict   | 11 dangling refs across 3 destinations (api-cloudrun#654) |
| **E — the rate moved**            | repricing is a function of the rate as at the edit       | 11 tax definitions, 9 superseded, 3 names reissued        |
| **F — physical and ledger facts** | a posting is reversed by a further posting, never merged | ⛔ **not sizeable — see below**                           |

⇒ **the left column is the finding. The right column sizes the migration and nothing else.**

⛔ **Class F cannot be sized at all, and printing a number for it would repeat SPIKE-012's error.**
The probe reports 34 bookings / 2,461 units "natively" out once the CRMS import is excluded — but
**the fulfillment lifecycle is not live**: the manager's check-in/check-out process has not been
turned on, `prepped` stood at **11 rows corpus-wide** when SPIKE-012 measured it, and `out` is
written mostly by the import. ⇒ the residue is a figure of a **dormant subsystem**, not of a
warehouse. **The KIND is a domain fact and stands; the count is withdrawn.**

### ⛔ Class G — actor vs actor has no number, and would be the wrong question if it did

Two independent reasons, and the second is the one that matters:

1. v1 keeps current state and no edit history, so a collision leaves no trace even where one
   occurred.
2. ⛔ **v1 is a single-operator app that is not finished.** Counting collisions in it would measure
   the staffing of an unfinished system.

⇒ **v2's actor model is a requirement, not an observation**, and a public client app is in scope
besides. ⚠️ **A low number here is not evidence that concurrent editing is rare, and not evidence
that the popover is unnecessary.**

### ⚠️ Two figures the probe corrects on the way past

- **Class F read 23,548 units out until it was split by cohort.** **21,087 belong to the 2026-01-24
  CRMS import**, which wrote terminal counters only — SPIKE-012's finding reaching a second
  consumer. The honest number is **2,461 natively booked out across 34 bookings**.
- **Two of five reference arms matched NOTHING** and print as **VACUOUS** rather than clean:
  `destinations.contacts[]` and `orders.destinations[].*.contact.uid`. **A check that reads green
  while matching nothing is indistinguishable from one that passes.** ⚠️ **The order-destination
  union case is vacuous too** — all 995 orders carry exactly one destination, which is a fact about
  the CRMS-shaped corpus and not about the design.

### What this does to the design

- ⭐ **The popover is a small part of the answer, not the centre of it.** Classes A–F each need
  machinery **before** any human is asked anything: a terminal-state refusal, an authored/derived
  partition, a failed-replay path, a repricing rule and a posting boundary.
- ⚠️ **Class B has no data behind it.** The authored/derived split **exists in no schema** — the
  probe's list is hand-written because there is nowhere to read it from, and **that absence is the
  finding.** Same shape as the transfer-field budget: a fact with no owner.
- ⇒ **Criterion 4 is met**, with each class's kind stated as a domain property and its corpus count
  labelled as a migration figure.

## ⭐⭐⭐ Finding 4, 2026-08-24 — criterion 5 answered NO, and the question named the wrong artifact

Source-read of `code:2026-08-24:manager@9504a1e:src/primitives/createEntityCache.ts`,
`src/types/store.ts`, `src/components/RecoveryLayer.tsx`, `src/components/StatusBar.tsx`.

### The answer: NO — and OQ-043 could not have answered it either way

⚠️ **`OQ-043` is about a DIFFERENT SET OF COLLECTIONS.** It asks whether the **product and
organization masters** carry an event history so a past _classification_ is recoverable. This
spike's undo path is about **orders and invoices**. The two are disjoint, so deciding OQ-043 in
either direction leaves this criterion exactly where it was.

⇒ ⚠️ **The earlier note in this file — _"whether the masters get one is `OQ-043`, still open. The
undo path depends on it"_ — conflated a master-data question with a transactional-document one.**
Corrected here rather than by editing it away; it is the kind of adjacency that reads right.

### Undo splits in two, and only one half needs anything

- ⭐ **Undo WITHIN an unresolved merge is FREE.** `base`, `ours` and `theirs` are all in hand by
  construction while the merge is open, so reversing a resolution choice is re-deriving from the
  same three inputs. **No history, no new storage, no decision.** This is the common case.
- ⚠️ **Undo AFTER the merge commits needs something, and it is still not OQ-043's history.** Once
  committed the base is discarded and nothing holds the pre-merge value.

**What breaks if the answer stays no**, precisely — and the split is not where it looks:

| field family                 | recoverable?                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| anything that **posted**     | ✅ **the ledger IS the history.** A posting is immutable and reversed by a further posting, so the prior state is reconstructible from the journal           |
| **authored, not yet posted** | ⛔ **nothing holds the prior value.** Subject, reference, notes, dates, quantities, a discount rate before it posts — the operator's only recourse is memory |

⇒ **The gap is exactly "authored, not yet posted"**, and it is narrower than "orders and invoices
have no event history" suggests. Whether to close it is a real decision, it is **not** OQ-043's, and
it is now **`OQ-061` (can a committed field edit be undone)**.

### ⭐⭐ The obligation that outranks the undo question, and it was measured on the way

**The three-way merge's base does not survive the event most likely to happen during a long
disconnect.** Three facts, each read rather than assumed:

1. **The base is IN-MEMORY ONLY.** `latestSnapshot` lives in `updateStates`, a plain `Map` in the
   factory closure. A reload or a tab close loses it.
2. **The stash does not carry it.** `PendingUpdateRecord` persists `fields` (the dirty values —
   `ours`) and `baseVersion: number | null`, and the type's own comment calls that number
   **"display-only — retry diffs against the fresh snapshot, so the normal 409 path handles real
   conflicts."** ⇒ **the persisted format is the TWO-WAY version gate, stated in the type.**
3. ⚠️⚠️ **The stash is written only when a HUMAN CLICKS A BUTTON.** `stashPending` has exactly two
   callers, both `onClick` — `RecoveryLayer.tsx:81` and `StatusBar.tsx:109`. There is **no**
   automatic stash on save failure, on unload, or on going offline.

⇒ ⚠️⚠️ **A reload during a disconnect therefore loses BOTH the base and, unless somebody clicked,
the queue.** Design obligation 1 must read **"pin AND PERSIST the base"** — pinning an in-memory
object against mutation does not survive the process that holds it.

⭐ **This sharpens "the queue extends the existing machinery" into something specific.** What exists
is **operator-triggered save-failure recovery**, not an automatic queue. Extending it is right; the
extension is the automatic half, and that half is where the work is.

### ⚠️ A cost note for criterion 6, and it is ONLY a cost note

**Zero occurrences of `navigator.onLine`, `addEventListener("offline")`, `"online"` or
`beforeunload` anywhere in `manager/src`** (the single `visibilitychange` is the logger's flush).

⇒ **there is no existing implementation to port or to measure** — the signal is built from scratch.
⚠️ **This says nothing about whether v2 needs per-field offline state.** That is settled by the
design, and criterion 6 already asserts it. Recorded only so the remaining work is not costed as
though a signal were already there.

## ⭐⭐⭐ Finding 5, 2026-08-24 — the queue is BUILT, and criteria 1, 2, 3, 6 and 7 have executable evidence

`spikes/harness/offline-queue/` — `deno task queue-test` (20 assertions, pure) and
`deno task oq-browser` (6 assertions, real Chromium). **All 26 mutation-tested: 19 mutations, every
one goes red.**

⚠️ **Split deliberately into a pure half and a browser half**, because three criteria are claims
about **durability** and **bytes** that an in-process fake satisfies by construction. A Deno object
that survives because nothing tore it down proves nothing about surviving a session; a `Uint8Array`
does not care that 4 MB will not fit in localStorage.

| where                        | what it can honestly assert                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `queue.ts` + `queue_test`    | the merge ALGEBRA — coalescing, three-way outcomes, the item key, per-field state |
| `client.js` + `browser_test` | DURABILITY across a destroyed session, a rejected replay, and 4 MB of real bytes  |

⭐ **The disconnect is Playwright's `context.setOffline(true)`** — the real network stack fails, so
`navigator.onLine` flips, the `offline` event fires and `fetch` rejects. A server-side "wired to
off" flag would have run the client's happy path with a different status code.

### Criterion by criterion

| # | criterion                                                                      | evidence                                                                                                                                                                     |
| - | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | survives a disconnect longer than the session, replays once, 3 edits → 1 write | ✅ browser. 3 offline edits coalesce to **1** queued op; the page is **destroyed**; a fresh page replays and the server receives **exactly one** PUT carrying the last value |
| 2 | an offline create is addressable before it reaches the server                  | ✅ pure. **Client-minted uid**, and later queued writes address it normally with **no rewrite pass**                                                                         |
| 3 | a failed replay lands where a human sees it, field named, operator absent      | ✅ browser. A 422 naming `qty` lands in a **durable inbox**, survives the session, and the field itself reads `failed`                                                       |
| 4 | the conflict surface enumerated with counts                                    | ✅ Finding 3                                                                                                                                                                 |
| 5 | does undo need OQ-043's event history                                          | ✅ Finding 4 — **no**, and `OQ-061` carries what is actually owed                                                                                                            |
| 6 | offline/pending/synced derivable at every save-on-focusout site                | ⚠️ **partly** — see the caveat below                                                                                                                                         |
| 7 | a field photo survives offline and uploads on reconnect                        | ✅ browser. **4,194,304 bytes**, byte-exact across a destroyed session, uploaded on reconnect — and asserted **not** to be in localStorage                                   |

### ⭐⭐ The identity decision (criterion 2), made rather than assumed

**Client-minted document ids**, and the argument is forced by the criterion itself: an offline
create must be **addressable by subsequent queued writes before it reaches the server**. Only the
client is present at that moment, so only the client can name it.

⇒ the alternative — a server-assigned id with a client temp-id and a rewrite pass over every queued
op that references it — adds a rewrite that can half-apply, and buys nothing the criterion asked
for.

⚠️ **v1 does something similar, and that is corroboration rather than the reason.** `newDraft` mints
a Firestore auto-id locally with no round-trip and persists a draft under it
(`code:2026-08-24:manager@9504a1e`). Worth knowing because it shows the pattern is cheap and
familiar — **not** worth treating as the justification, which is the solution-transplant error in
its usual costume.

### ⚠️ Two findings the build produced, and neither was on the list

**1. THE APP CANNOT START OFFLINE.** `page.reload()` while disconnected fails with
`ERR_INTERNET_DISCONNECTED` — the shell itself has to be fetched. Measured, not inferred:
**`manager` has no service worker**, no `serviceWorker` registration, no PWA plugin, and `public/`
holds only a favicon (`code:2026-08-24:manager@9504a1e`).

⇒ ⚠️ **the queue survives and is unreachable.** An operator who closes the tab out of signal reopens
to a browser error page, with the work intact in IndexedDB and no way to see it. **An offline queue
without an offline app shell is half a capability**, and the ADR owes a position on the other half.
There is a test asserting exactly this failure, so the limit is executable rather than remembered.

**2. THE STORAGE SPLIT IS A DECISION, not an implementation detail.** The queue, the pinned base and
the failure inbox go to **IndexedDB**; blob bytes go to **IndexedDB in their own store**. v1's stash
is localStorage — string-only, ~5 MB for the whole origin — and a 4 MB JPEG base64s to ~5.5 MB,
taking the entire budget. ⇒ **"the queue carries blobs" is a storage decision before it is a queue
decision**, and the browser test asserts the bytes are _not_ in localStorage precisely so the choice
cannot quietly revert.

### ⚠️ Criterion 6 is PARTLY met, and the gap is stated rather than glossed

`fieldState(queue, doc, path)` is a **pure function of the queue** — no per-site wiring, no extra
store, no flag any of the 52 subscription sites has to remember to set. That is the derivability the
criterion asks about, and it is asserted twice (pure and in the page).

⚠️ **But "at every save-on-focusout site" is not demonstrated, because the prototype is a harness
slice and does not touch the manager's 52 sites.** What is shown is that the derivation _needs_
nothing from them. **What is not shown is that all 52 render it** — and today the absence of an
error is their only feedback. ⇒ that residue is real work and belongs in the ADR's consequences, not
in a tick.

### ⚠️ What the prototype deliberately does NOT do

- **It does not resolve conflicts.** It _detects_ them and holds the write back — asserted by a test
  about a **non-event**: with the base re-pinned on boot, our edit would apply "cleanly" and
  silently overwrite the other operator, and the assertion is that our write is never sent. ⭐
  **That mutation survived the first mutation sweep**, which is why the test exists.
- **It does not merge `items[]` in the browser.** `mergeItems` and the measured
  `(uid, k-th occurrence)` key are asserted in the pure half only.
- **Ledger postings are out of scope BY CONSTRUCTION.** This merges documents. The boundary between
  what merges and what posts is the ADR's, and is unchanged by anything here.

## What is already known, and did not come from here

Three things were established during `SPIKE-009` and should not be re-derived:

- ⭐ **The write cadence is PER FIELD.** Most fields save on blur/focusout; only creates keep a
  final submit, and creates already persist drafts to the database. ⇒ **conflict granularity is the
  field**, so two operators editing different fields of one order never collide, and a deferred
  validation failure names a field rather than rejecting an opaque document. **Both make this
  cheaper than a document-submit model would.**
- ⭐ **The local-divergence machinery already exists and is tested.** `createEntityCache` overlays
  local edits on every snapshot with three-tier precedence (live dirty > stashed > server), backed
  by a `localStorage` stash epoch-versioned by `PENDING_SCHEMA_EPOCH = "cents"` so a pre-cents stash
  cannot replay values 100× low. **The queue extends this; it must not be built beside it.**
- ⚠️ **The transport must deliver SERVER TRUTH, UNMERGED.** A socket layer that echoes the client's
  own write back as authoritative makes `recomputeDirty` clear dirty fields that were never
  persisted — **a well-meant optimization that silently discards unsaved operator edits.**

## The two things the owner's conflict design does not yet cover

Recorded here because they are the exit criteria's whole point, not to relitigate the design.

1. ⚠️ **"If we're storing events" is not true for documents.** The ledger is append-only; orders and
   invoices are mutable documents with no event history, and whether the masters get one is
   **`OQ-043`, still open**. The undo path depends on it.
2. ⚠️ **Field-level conflict is not semantic conflict.** Two people fulfilling the same physical
   unit is not a popover; nor is an offline order edit replaying against a tax rate that has since
   changed, nor against an invoice that has since been paid — **which today is not even guarded**
   (api-cloudrun#648, where the rule that a paid invoice is closed is intended and not installed).
   ⭐ **Undo reverses a ledger entry with a new entry. It does not recall a van that already left.**

⚠️ **Enumerate these from the corpus, with counts.** A list of imagined conflicts is the same
mistake as a boundary that "PASSED" on 11 rows — it will look complete and prove nothing.
