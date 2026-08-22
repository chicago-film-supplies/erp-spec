# Formal specs

Two protocols are specified because their failure modes are **interleavings**, and interleavings are
not reachable by testing or by reading.

Written in **Quint** (`ADR-0016`). The `.tla` stubs these replaced were never executed and were
deleted rather than ported — nothing was sunk.

| Spec                   | Question                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `two-store-commit.qnt` | Can a MongoDB write and a TigerBeetle posting disagree across crash and retry? |
| `period-close.qnt`     | Can a posting land in a closed period?                                         |

## Every spec has a fail-closed companion

Each file holds **two** modules: the protocol, whose invariant must hold, and a deliberately-wrong
variant differing in exactly one action, whose invariant must **fail**. This is the same rule the
money sweeps follow in `~/cfs` — an oracle that cannot fail proves nothing.

It is not ceremony. The first run of `validate_then_commit` **passed**, which was a bug in the
model, not a property of the protocol: `x' = a or b` parses as `(x' = a) or b`, because `=` binds
tighter than `or`. The assignment silently kept the old value and the `or` became a free-floating
boolean, so the violation counter could never be set. Only the companion's failure to fail exposed
it. A single-module spec would have reported "no violation found" and been believed.

## Status — run 2026-08-09, quint 0.32.0. Re-run 2026-08-09, reproduced.

Both **simulated** (randomised, 20,000 traces × 20 steps) and **verified** (Apalache symbolic
bounded model checking, default 10 steps, Java 21).

| Module                 | Expected | Apalache                            | Re-run               | Simulation            | Re-run                |
| ---------------------- | -------- | ----------------------------------- | -------------------- | --------------------- | --------------------- |
| `two_store_commit`     | hold     | `NoError` (8,883 ms)                | `NoError` (5,195 ms) | no violation          | no violation (324 ms) |
| `naive_sweeper`        | **fail** | `Error` — counterexample (5,011 ms) | `Error` (3,895 ms)   | violation at 4 states | violation (18 ms)     |
| `expiring_timeout`     | **fail** | `Error` — counterexample (5,296 ms) | —                    | violation at 3 states | —                     |
| `period_close`         | hold     | `NoError` (19,508 ms)               | `NoError` (3,816 ms) | no violation          | no violation (72 ms)  |
| `validate_then_commit` | **fail** | `Error` — counterexample (4,174 ms) | `Error` (3,707 ms)   | violation             | violation (19 ms)     |

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
- **`validate_then_commit`** — `validate(period 0) → close(0) → commit`. Checking the period only at
  validation time lands a posting in a period closed underneath it. Time-of-check/time-of-use. The
  fix is a re-check at commit, and `refuse` exists so a posting whose period closed is refused
  rather than silently dropped or silently landed.

## Running

Quint is not vendored. Requires Java for `verify`.

```sh
npx @informalsystems/quint typecheck formal/period-close.qnt

# randomised simulation — fast, not exhaustive
npx @informalsystems/quint run formal/period-close.qnt \
  --main=period_close --invariant=inv --max-samples=20000 --max-steps=20

# symbolic bounded model checking via Apalache — slower, exhaustive to the step bound
npx @informalsystems/quint verify formal/period-close.qnt \
  --main=period_close --invariant=inv
```

Swap `--main` for a companion module (`naive_sweeper`, `expiring_timeout`, `validate_then_commit`)
and the run must report a violation. **If a companion ever passes, the spec is broken — not the
protocol.**

`verify` writes counterexample traces to `_apalache-out/` (gitignored), including ITF JSON.

## Not yet done

- **ITF trace replay against the implementation.** This is the property ADR-0016 was chosen for and
  it is not built. Nothing yet consumes the ITF output.
- **The sidecar hop.** ADR-0004 says a Go ledger sidecar (should SPIKE-001 force one) adds a network
  hop that `two-store-commit` must model. It is modelled without that hop today.
- `two-store-commit` models **one** operation. Concurrent operations against the same account are
  out of scope of the current model.
