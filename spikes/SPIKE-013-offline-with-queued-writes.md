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
status: open
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

## ⭐⭐⭐ Finding 3, 2026-08-24 — criterion 4 answered, and the popover is arbitrating the wrong axis

Harness `spikes/harness/conflict-surface-probe.ts`, `deno task conflict-surface`, read-only prod
under ADC. Corpus: **995 orders · 1019 invoices · 6,975 bookings · 568 products · 458 destinations ·
291 organizations · 166 contacts · 11 taxes**.

⚠️ **Every figure below is a POPULATION IN WHICH A CLASS APPLIES, never an observed frequency.** The
corpus holds current state and no edit history, so concurrency leaves no trace to count. A count
here answers _"how many documents could hit this"_, not _"how often it happened"_.

### ⛔ Half the criterion is structurally unanswerable, and that is the first result

**Prod has ONE live operator account** (`users`, role `admin`, created 2026-03-07, not deleted). A
popover arbitrates **actor vs actor** — two people moved the same field, here are their names and
times, pick one. ⇒ **every actor-vs-actor class has a corpus count of exactly 0, and 0 here means
UNOBSERVABLE rather than "does not happen".**

⚠️ **This is SPIKE-012's trap verbatim** — two boundaries reported _"PASSES — no future-dated unit
holds a transfer"_ on 11 rows corpus-wide. **The probe therefore refuses to print a zero for these
classes** and names them unmeasurable with the reason instead.

⚠️ **And it must not be read as "the popover is unnecessary."** That is the absence-to-absence error
this repo has now made four times. A **public client app is in scope** (owner, 2026-08-18 and
2026-08-23), so the actor count is known to be **rising** — the figure is a floor with a date on it.

⭐ **One account is not one person, and that cuts the other way.** If several humans share the
single admin login, the popover cannot name who made the competing edit **even in principle**. The
corpus cannot tell them apart and neither can the design. **Whether they do is an owner question,
not a query** — and it is the cheaper half of the answer.

### ⭐⭐ The reframing that makes criterion 4 answerable

**The conflicts a popover cannot arbitrate are mostly not actor-vs-actor at all. They are actor vs
STATE** — the invoice was paid while you were offline, the row your edit addressed is gone, the rate
moved, the field is derived, the posting is immutable. ⇒ **the second party is the SYSTEM, not a
second person**, and a single-actor corpus counts those exactly, because they need no concurrency to
exist.

### The classes, with counts

| class                                    | measured                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — the popover has no author**        | orders carry `created_by` on **0 of 995** and have **no `updated_by` field at all**; invoices carry `updated_by` on **1019 of 1019 — and 0 name a live human account** |
| **A — terminal state, refuse the merge** | **879 orders (88.3%)** complete/canceled · **998 invoices (97.9%)** paid/void                                                                                          |
| **B — derived, recompute not merge**     | **19,283 of 28,157 lines (68.5%)** carry ≥1 derived MONEY leaf; **91,329** derived leaves against **39,994** authored; `totals{}` on **100%** of orders                |
| **C — union, not choice**                | items[] is the populated set — median **8**, max **150** rows per order                                                                                                |
| **D — the target is gone**               | **11 dangling refs across 3 destinations**, live today with nobody offline                                                                                             |
| **E — the rate moved**                   | **11** tax definitions, all windowed; **9** superseded; **3** names reissued                                                                                           |
| **F — physical facts do not merge**      | **34 bookings / 2,461 units** natively out (see the cohort warning below)                                                                                              |
| **⛔ G — actor vs actor**                | **UNMEASURABLE** — 1 operator account                                                                                                                                  |

### ⭐ Class 0 is the sharpest of them, and it was not on anyone's list

The popover's own inputs are **author and timestamp**. On `orders` — the most heavily edited
collection in the system, and the one this spike is mostly about — **there is no author to show at
either end**: `created_by` is present on 0 of 995 documents and `updated_by` **does not exist in the
schema**. Deliberately so: `orders` is the most machine-written collection, and a field reading
"Cloud Task Worker" on almost every row was judged worse than no field
(`code:2026-08-24:core@9e38e9d:src/schemas/order.ts`, api-cloudrun#407).

On `invoices`, where `updated_by` does exist and is populated on **100%** of the corpus, **not one
of the 1019 values names a live user account.** The four names present are
`migrate-drop-tax-profile` (1018), `Manager Bot` (880), `CRMS Webhook` (134) and `Xero Sync` (6).

⇒ ⚠️ **the design owes an ANSWER to "who edited this", not merely a popover to display it.** The
popover is specified against a field that is absent on one collection and machine-valued on the
other.

### ⚠️ Two figures the probe corrects on the way past

- **Class F was 23,548 units out until it was split by cohort.** **21,087 of them belong to the
  2026-01-24 CRMS import**, which wrote terminal counters only — SPIKE-012's finding, reaching a
  second consumer. The honest number is **2,461 natively booked out across 34 bookings**. _Ask what
  a number is a figure OF._
- **Two of five reference arms in class D matched NOTHING** and are printed as **VACUOUS** rather
  than clean: `destinations.contacts[]` (0 refs) and `orders.destinations[].*.contact.uid` (0 refs).
  **A check that reads green while matching nothing is indistinguishable from one that passes.** The
  11 dangling refs come from the arms that did match.
- ⚠️ **The order-destination union case is vacuous too** — **all 995 orders carry exactly one
  destination**, so "two operators add different destinations" has no population. That is a fact
  about the CRMS-shaped corpus and **not** about the design: the schema is an array, and the v2
  invoice model bills several orders.

### What this does to the design

- ⭐ **The popover is a small part of the answer, not the centre of it.** Classes A, B, D, E and F
  all need machinery **before** any human is asked anything: a terminal-state refusal, an
  authored/derived partition, a failed-replay path, a repricing rule and a posting boundary.
- ⚠️ **Class B has no data behind it.** The authored/derived split **does not exist in any schema**
  — the probe's list is hand-written because there is nowhere to read it from, and **that absence is
  the finding.** It is the same shape as the transfer-field budget: a fact with no owner.
- ⇒ **Criterion 4 is met** for the classes that admit a count, with the actor-vs-actor half reported
  as unmeasurable and reasoned rather than scored zero.

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
