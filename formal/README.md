# Formal specs

Two protocols are specified because their failure modes are **interleavings**, and interleavings are
not reachable by testing or by reading.

Written in **Quint** (`ADR-0016`). The `.tla` stubs these replaced were never executed and were
deleted rather than ported — nothing was sunk.

| Spec                   | Question                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `two-store-commit.qnt` | Can a MongoDB write and a TigerBeetle posting disagree across crash and retry? |
| `period-close.qnt`     | Can a posting land in a closed period?                                         |

⚠️ **`two-store-commit.qnt` loses its subject under ADR-0049** (PostgreSQL is the one system of
record, proposed 2026-10-09): one store, so no cross-store commit. It stays — ADR-0023 (accepted)
cites it, and ADR-0003 is in force until ADR-0049 is accepted — and is marked superseded here at
that acceptance, when m5's two-store criterion retires with it.

## Checked in CI — `deno task formal`

**`formal/expectations.yaml` is the record of what each module must do**, and the `formal` workflow
(`.github/workflows/formal.yml`) executes it on every change under `formal/`. Per module it runs
`quint test`, `quint run` (20,000 × 20) and `quint verify` (Apalache), and fails unless each outcome
matches — a `hold` module finds no violation, a `fail` companion finds one, and the test count is
exact. It fails closed on a module or `.qnt` file the expectations do not name. Quint is pinned
there (0.32.0).

```sh
deno task formal              # everything; verify needs Java 21
deno task formal --no-verify  # tests + simulation only
```

**Landed red 2026-10-09**: adding the re-check to `validate_then_commit` turned its test, run and
verify all red; a misspelt module name and a wrong test count each failed it. Until then CI only
checked that a result had been copied into the table below.

## Every spec has a fail-closed companion

Each file holds **two** modules: the protocol, whose invariant must hold, and a deliberately-wrong
variant differing in exactly one action, whose invariant must **fail**. This is the same rule the
money sweeps follow in `~/cfs` — an oracle that cannot fail proves nothing.

It is not ceremony. The first run of `validate_then_commit` **passed**, which was a bug in the
model, not a property of the protocol: `x' = a or b` parses as `(x' = a) or b`, because `=` binds
tighter than `or`. The assignment silently kept the old value and the `or` became a free-floating
boolean, so the violation counter could never be set. Only the companion's failure to fail exposed
it. A single-module spec would have reported "no violation found" and been believed.

## Recorded runs before CI — 2026-08-09 and 2026-08-22, quint 0.32.0

History, kept for the timings and for what each companion found. **No longer updated by hand** — the
CI run is the record now. All seven outcomes reproduced again under `deno task formal` on
2026-10-09.

Both **simulated** (randomised, 20,000 traces × 20 steps) and **verified** (Apalache symbolic
bounded model checking, default 10 steps, Java 21).

| Module                  | Expected | Apalache                            | Re-run               | Simulation            | Re-run                |
| ----------------------- | -------- | ----------------------------------- | -------------------- | --------------------- | --------------------- |
| `two_store_commit`      | hold     | `NoError` (8,883 ms)                | `NoError` (5,195 ms) | no violation          | no violation (324 ms) |
| `naive_sweeper`         | **fail** | `Error` — counterexample (5,011 ms) | `Error` (3,895 ms)   | violation at 4 states | violation (18 ms)     |
| `expiring_timeout`      | **fail** | `Error` — counterexample (5,296 ms) | —                    | violation at 3 states | —                     |
| `undiscoverable_orphan` | **fail** | `Error` — counterexample (4,187 ms) | —                    | violation at 2 states | —                     |
| `intent_first`          | hold     | `NoError` (6,396 ms)                | —                    | no violation (340 ms) | —                     |
| `period_close`          | hold     | `NoError` (19,508 ms)               | `NoError` (3,816 ms) | no violation          | no violation (72 ms)  |
| `validate_then_commit`  | **fail** | `Error` — counterexample (4,174 ms) | `Error` (3,707 ms)   | violation             | violation (19 ms)     |

**All eight of the original runs reproduced their recorded outcome**, and were reproduced a third
time on 2026-08-22 (quint 0.32.0) when `expiring_timeout` was added. The re-run exists because a
recorded result nobody has repeated is a claim, not a measurement — the same reason a spike's
`## Notes` must be re-runnable rather than believed.

⚠️ **The timings did not reproduce and that is expected** — `period_close` verified in 19.5 s
originally and 3.8 s on the re-run, a 5x spread from machine, JIT and Apalache-download warmth.
**The outcome is the measurement here; the timing is not.** Do not treat a timing change as a
finding, and do not tune anything on these numbers.

**This is bounded verification, not proof.** Apalache checks to a step bound; a violation needing
more steps than the bound is not found. Raising `--max-steps` is the lever.

### What the companions actually found

- **`naive_sweeper`** — `reserve → writeDoc → blindTimeout`. A recovery sweeper that voids a pending
  transfer on timeout _without reading Mongo_ leaves a written document behind a voided transfer.
  That is SPIKE-002's failure mode 2, and blind-timeout is the obvious implementation. The fix is in
  the protocol: recovery reads Mongo and either voids (document absent) or posts (document present).
- ⭐ **`expiring_timeout`** (added 2026-08-22, HOT-022) — `reserve → writeDoc → expire`. **The
  protocol as specified, plus TigerBeetle's own `Transfer.timeout`.** Not a strawman and not our
  code: `pending_transfer_expired = 35` is a real result in `tigerbeetle-node@0.17.9`'s
  `bindings.d.ts`, and upstream is explicit that _"if the timeout interval passes before the
  transfer is either posted or voided, the transfer expires"_. **TigerBeetle's expiry is
  `naive_sweeper` — blind by construction — running inside the database.** ⚠️ **The counterexample
  is three steps long with `dead: false` throughout: NO CRASH IS REQUIRED.** A writer merely slower
  than the timeout strands a durable document behind a transfer that can never be posted. This is a
  race with the clock, not a crash-interleaving bug. ⚠️ **And note WHY it went unseen for thirteen
  days.** `two_store_commit`'s `TbState` has no expired state, so the interleaving was not unchecked
  — **it was unrepresentable**, and a model that cannot express a failure reports no violation.
  **That is indistinguishable from a model that ruled it out.** The protocol module silently assumes
  `timeout = 0` and never says so; `ADR-0015` assumes the opposite. HOT-022 holds the choice.
- ⭐ **`undiscoverable_orphan` / `intent_first`** (added 2026-08-22, ADR-0042) — **a minimal pair,
  and the difference is the write ordering.** Once HOT-022 ruled `timeout = 0`, the sweeper became
  the only resolver, which made a question the other modules never ask into the whole problem: **how
  does the sweeper FIND an orphan?** `two_store_commit` lets recovery fire out of nowhere — nothing
  modelled discovery, so nothing could show it failing. It cannot come from TigerBeetle:
  `QueryFilter` carries **no predicate for `flags.pending` and none for `pending_id`**
  (`ledger/tigerbeetle-accounts.yaml` owns the query surface). And under the protocol's own ordering
  it cannot come from MongoDB either, because the document is written **after** the reserve. ⇒
  `undiscoverable_orphan` fails in **two steps** — `reserve → crash` — a pending transfer holding
  stock that neither store can find. `intent_first` writes an intent record **before** the reserve
  and clears it only once the transfer settles; it holds both ways.
- **`validate_then_commit`** — `validate(period 0) → close(0) → commit`. Checking the period only at
  validation time lands a posting in a period closed underneath it. Time-of-check/time-of-use. The
  fix is a re-check at commit, and `refuse` exists so a posting whose period closed is refused
  rather than silently dropped or silently landed.

## Running a single module by hand

```sh
npx @informalsystems/quint@0.32.0 typecheck formal/period-close.qnt
npx @informalsystems/quint@0.32.0 test formal/period-close.qnt --main=period_close
npx @informalsystems/quint@0.32.0 run formal/period-close.qnt \
  --main=period_close --invariant=inv --max-samples=20000 --max-steps=20
npx @informalsystems/quint@0.32.0 verify formal/period-close.qnt \
  --main=period_close --invariant=inv
```

Which modules must hold and which must fail is in `expectations.yaml`, not here.

⚠️ **Two of the three failing companions describe defects that were UNREPRESENTABLE before they were
written** — `two_store_commit` has no expired state and no notion of discovery, so it reported no
violation on both. **A model that cannot express a failure is indistinguishable from one that ruled
it out.** That is why the companions are kept rather than deleted once understood. **If a companion
ever passes, the spec is broken — not the protocol.**

`verify` writes counterexample traces to `_apalache-out/` (gitignored), including ITF JSON.

## Not yet done

- **ITF trace replay against the implementation.** This is the property ADR-0016 was chosen for and
  it is not built. Nothing yet consumes the ITF output. ADR-0054's layers 3 and 4.
- **Coverage per action** (ADR-0054 D3). A run that never fires an action still reports no
  violation; `deno task formal` does not measure it.
- **The sidecar hop** — moot. It existed for a Go ledger sidecar should the TigerBeetle client fail
  under Deno; ADR-0053 (no native addons, proposed) removes that trigger.
- `two-store-commit` models **one** operation. Concurrent operations against the same account are
  out of scope of the current model.
