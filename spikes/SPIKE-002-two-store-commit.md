---
id: SPIKE-002
headline: two-store commit protocol
question: >-
  What commit protocol keeps a MongoDB document write and a TigerBeetle posting consistent across
  crash and retry at every step?
timebox: 1 week
method: >-
  Specify the protocol as TB pending transfer -> Mongo write -> post/void. Enumerate every
  interleaving of crash and retry. Model-check it in `formal/two-store-commit.qnt`. Then build a
  harness that kills the process at each step and asserts the invariants hold on recovery.
exit_criteria:
  - "Quint model checks clean for the three failure questions: can a pending transfer be orphaned; can a Mongo doc exist with no posted transfer; can a retry double-post."
  - A crash-injection harness reproduces each interleaving and the recovery path restores consistency.
  - Orphan detection and resolution is specified, including its time bound.
closes_adr: ADR-0042
status: closed
---

## Partial result — 2026-08-22. Criterion 1 MET; a new failure mode found on the way

### Criterion 1 — VERIFIED, not believed

All four arms re-run 2026-08-22 with **quint 0.32.0**, and every one reproduced its recorded
outcome. The protocol module holds all three failure questions; the companion fails with exactly the
recorded counterexample.

| run                                        | expected | got                           |
| ------------------------------------------ | -------- | ----------------------------- |
| `two_store_commit` simulation, 20,000 × 20 | hold     | no violation (474 ms)         |
| `two_store_commit` Apalache                | hold     | **`NoError`** (5,653 ms)      |
| `naive_sweeper` simulation                 | **fail** | violation at 3 states (14 ms) |
| `naive_sweeper` Apalache                   | **fail** | **counterexample** (3,886 ms) |

⚠️ **Re-run rather than read off `formal/README.md` on purpose.** A recorded result nobody has
repeated is a claim, not a measurement — and the re-run is what put the model in front of someone
long enough to find what follows.

### ⭐ FINDING 1: the model could not express TigerBeetle's own timeout

`two_store_commit`'s `TbState` is `TbNone | TbPending | TbPosted | TbVoided`. **There is no expired
state.** But TigerBeetle expires a pending transfer _itself_ once `Transfer.timeout` elapses:

> "A pending transfer may optionally be created with a timeout. If the timeout interval passes
> before the transfer is either posted or voided, the transfer expires and the full amount is
> returned to the original account."

Pinned in the client's own bindings, not just the docs: **`pending_transfer_expired = 35`**, beside
`pending_transfer_already_posted = 33` and `pending_transfer_already_voided = 34`
(`tigerbeetle-node@0.17.9`, `dist/bindings.d.ts`).

A third module, **`expiring_timeout`**, is the protocol as specified plus that one action. It was
landed **RED** and fails under both simulation and Apalache:

```
[State 1] { dead: false, mongo: MongoAbsent,  tb: TbPending }   reserve
[State 2] { dead: false, mongo: MongoWritten, tb: TbPending }   writeDoc
[State 3] { dead: false, mongo: MongoWritten, tb: TbExpired }   expire   ← violation
```

⚠️ **Three steps, `dead: false` throughout — NO CRASH IS REQUIRED.** This is not a crash
interleaving. It is a plain race between the writer and the clock: a writer merely slower than the
timeout leaves a durable MongoDB document behind a transfer that can never be posted. That is
failure mode 2, the one this spike exists to rule out.

⚠️ **Why it went unseen for thirteen days, and this is the transferable part.** The interleaving was
not unchecked — **it was unrepresentable.** A model with no expired state cannot produce the trace,
so it reports no violation, **and that is indistinguishable from a model that ruled the case out.**
The same shape as SPIKE-012's passing-on-11-rows: an absence reading as a result.

⇒ **`two_store_commit` silently assumes `timeout = 0` and never says so.** `ADR-0015:61` assumes the
opposite — _"the two-phase timeout is the compensation mechanism SPIKE-002 already needs"_ — and
**TigerBeetle's expiry is blind by construction, which is precisely what `naive_sweeper` proves
unsafe.** The two are different designs, not different wordings. Recorded as **HOT-022** rather than
picked, per rule 5.

### Criterion 3 — ✅ MET. Ruled 2026-08-22, and the ruling found a second defect

"Orphan detection and resolution is specified, **including its time bound**" is not documentation:
**the time bound decides which of two mutually exclusive designs is in force.**

| design                     | orphan resolved by                                               | what it costs                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`timeout = 0`**          | the application sweeper only — reads Mongo, then posts or voids  | Safe (this is the verified protocol). The time bound becomes the SWEEPER's, and needs a stated SLO plus a monitored orphan-age metric — TigerBeetle's own warning about funds "held in limbo indefinitely" is real and nothing else answers it |
| **`timeout > 0`**          | TigerBeetle, as a backstop behind the sweeper                    | Needs the timeout to exceed worst-case sweeper latency by a stated margin **and** an answer for when the backstop fires — because that state is the proven-unsafe one. ⚠️ **A backstop that is unsafe when it fires is not a backstop**        |
| **compensatable document** | recovery retracts the document when it finds an expired transfer | Makes expiry survivable. ⚠️ An order document a user has already seen can vanish — a product decision, not a protocol one                                                                                                                      |

✅ **OWNER RULED `timeout = 0`, 2026-08-22 → `ADR-0042`.** ADR-0015's compensation bullet is amended
rather than superseded; only that bullet was wrong.

⭐ **The ruling immediately exposed a second unrepresentable case, and it is the bigger one.** With
expiry refused the sweeper is the only resolver, so the question `two_store_commit` never asks
becomes the whole problem: **how does the sweeper FIND an orphan?** Recovery fires out of nowhere in
the model — nothing modelled discovery, so nothing could show it failing.

- ⚠️ **Not from TigerBeetle.** `QueryFilter` carries **no predicate for `flags.pending` and none for
  `pending_id`** (measured against `bindings.d.ts`), so "list unresolved pending transfers" is not a
  question the ledger can answer. `ledger/tigerbeetle-accounts.yaml` owns the query surface; this is
  its consequence, not a restatement of it.
- ⚠️ **Not from MongoDB either, in the window that matters** — the document is written _after_ the
  reserve. **`undiscoverable_orphan` fails in two steps**: `reserve → crash` leaves a pending
  transfer holding stock that neither store can find.
- ✅ **`intent_first` fixes it and holds** under simulation and Apalache: write an intent record
  before the reserve, clear it only once the transfer settles. **A minimal pair against
  `undiscoverable_orphan`** — same invariant, difference is the write ordering. ⭐ The intent may be
  the MongoDB document itself in a pre-committed state; the model is abstract over where it lives
  and does **not** demand a third store.

**The time bound criterion 3 asks for is two numbers** (ADR-0042/D4): `T_claim`, the age at which
the sweeper may claim an intent, which must exceed the writer's worst-case completion; and
`T_resolve`, the SLO for how long an orphan may hold stock, with an orphan-age metric behind it. ⚠️
**The numbers are deliberately not set** — they depend on measured writer latency, and a number
invented before that measurement is a guess wearing a decision's clothes.

⚠️ **All five modules stay permanently**: `two_store_commit` and `intent_first` must keep holding;
`naive_sweeper`, `expiring_timeout` and `undiscoverable_orphan` must keep failing. **Both defects
were unrepresentable before they were refuted**, and keeping the states is what stops the next
reader over-reading a green run.

### ⛔ Criterion 2 — not started, and it needs infrastructure

"A crash-injection harness reproduces each interleaving and the recovery path restores consistency."
Needs a local `mongod` **and** a TigerBeetle cluster. `mongod` is not installed on this machine
(SPIKE-006 fetched the official macOS tarball and ran it directly — there is no container runtime);
TigerBeetle is proven under Deno by SPIKE-001 with `spikes/harness/tb-probe.ts`.

⚠️ **The new module raises this criterion's value rather than lowering it.** `expiring_timeout`
shows the failure is a timing race, and a timing race is exactly the class a crash-injection harness
measures and a model can only assume. **The harness should now include a slow-writer case, not only
kill-at-each-step.**

### Where the spike stands

| criterion                                                          | state                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1 — Quint model checks clean on the three failure questions        | ✅ **MET**, re-verified 2026-08-22                                                                          |
| 2 — crash-injection harness                                        | ✅ **MET** — `deno task two-store`, **14/14** against a real mongod and a real TigerBeetle, fired RED twice |
| 3 — orphan detection and resolution specified, with its time bound | ✅ **MET** → ADR-0042                                                                                       |

⇒ ✅ **ALL THREE MET. CLOSED 2026-08-22 → `ADR-0042`.**

## Notes

This is the load-bearing consequence of ADR-0003. If the protocol cannot be made safe, the two-store
split is wrong and ADR-0003 needs superseding rather than patching. ✅ **Safe under `timeout = 0`,
verified twice. Unsafe under `timeout > 0`, proven 2026-08-22 (HOT-022).**

If SPIKE-001 forces a Go sidecar, the extra network hop belongs in this model. ✅ **SPIKE-001 closed
with no sidecar (ADR-0023)**, so the hop does not exist — but the finding above says the model's
missing dimension was never the hop, it was the CLOCK.

## Result — the protocol is safe under `timeout = 0`. Closed 2026-08-22 → ADR-0042

`deno task two-store` drives a real writer subprocess to a **real SIGKILL** at each step, then runs
the recovery sweeper against whatever durable state survives. **14 assertions, 0 failures**, against
a local `mongod` 8.0.4 and a single-replica TigerBeetle 0.17.9 cluster.

⚠️ **The writer SIGKILLs ITSELF rather than returning early, and that is the difference between
criterion 2 and a simulation.** An in-process "pretend we stopped here" flag proves the recovery
agrees with a mock; a SIGKILL leaves real state in two real datastores with no unwinding, no
`finally`, and no client shutdown — which is what a crash actually is.

| case                                        | asserts                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SIGKILL between `writeIntent` and `reserve` | the orphan is **discoverable** — an open intent survives, and TigerBeetle could not have told us  |
| SIGKILL between `reserve` and `writeDoc`    | recovery **VOIDS**, having read MongoDB and found nothing — the branch `naive_sweeper` gets wrong |
| SIGKILL between `writeDoc` and `post`       | recovery **POSTS**; no document is left unbacked; **a second pass is a no-op**                    |
| SIGKILL after `post`                        | the retry is refused with `pending_transfer_already_posted` (**33**)                              |
| sweeper races a live writer                 | the writer's post fails with `pending_transfer_already_voided` (**34**), so it can compensate     |
| `timeout` is 0                              | expiry **never fires**                                                                            |

⭐ **Every case asserts a CODE, not an absence of throw** — because "the second post did not happen"
is also exactly what a dropped request looks like.

### ⭐ FIRED RED TWICE, and the second result was larger than expected

A harness that has never failed is indistinguishable from one asserting nothing.

| perturbation                                                                  | result                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **remove the intent record** (revert to the `undiscoverable_orphan` protocol) | the discovery assertions fail — the orphan becomes invisible to both stores |
| **set `Transfer.timeout` to 1s and let it elapse**                            | ⚠️ **SEVEN assertions fail across FIVE cases**                              |

⚠️ **A non-zero timeout does not degrade gracefully.** It breaks recovery, voiding, posting _and_
the double-post refusal simultaneously, because pending transfers expire out from under every
operation. `expiring_timeout` predicted exactly this in the model; the cluster demonstrates it.

⭐ **And case 6 — the assertion that NOTHING HAPPENS, the one most likely to be vacuous — fired.**
That is the assertion a reviewer would most reasonably have deleted.

### What the harness does NOT establish, stated

- **Concurrency between two DIFFERENT operations.** Every case is one operation.
- **A crash of MongoDB or TigerBeetle themselves** — only of the writer between them.
- **That `T_claim` and `T_resolve` are correctly VALUED** (ADR-0042/D4). Case 5 proves the race is
  detectable and compensable; the numbers are operational and deliberately unset.
