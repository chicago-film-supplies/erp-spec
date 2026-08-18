---
id: SPIKE-001
headline: TigerBeetle under Deno
question: Does the TigerBeetle client load and run under Deno via node-api compatibility?
timebox: 2 days
method: >-
  Stand up a local TigerBeetle single-replica cluster. From Deno, create accounts, submit a linked
  transfer batch, query balances. Exercise the client under `deno run`, `deno test` and a compiled
  binary — node-api support differs across them.
exit_criteria:
  - A Deno process creates accounts and posts a two-phase transfer against a real TigerBeetle cluster.
  - The same code path runs under `deno test` and under `deno compile`.
  - If it fails, the failure mode is characterised precisely enough to size the Go sidecar.
closes_adr: ADR-0023
status: closed
---

## Notes

Gates ADR-0004's revisit clause. A failure here does NOT reopen the language decision — it adds a Go
sidecar for the ledger service only.

## Result — it works. No sidecar.

Closed 2026-08-09. All three exit criteria met; the third is vacuous because nothing failed.

Measured against a **real single-replica cluster** (server 0.17.9+cc1c06a, `--development`, no
container — `tigerbeetle-universal-macos.zip` is a release asset), client `tigerbeetle-node@0.17.9`,
Deno 2.9.2 on `aarch64-apple-darwin`. Harness: `spikes/harness/tb-probe.ts`, re-runnable with
`deno task tb`. Source pin `code:2026-08-09:erp-spec@b555c5c:spikes/harness/tb-probe.ts`.

**Six checks, all passing in every mode.** Each is one a partially-working N-API bridge would break
_while still returning successfully_ — "the call did not throw" is not evidence.

| check                       | measured                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accounts + u128 round-trip  | `user_data_128` exact at `2^127 \| 2^64 \| 0xdeadbeefcafef00d`, `amount` 1180591620717411303431 exact, `user_data_32` 4294967295 intact, server timestamp returned as bigint |
| linked batch rolls back     | statuses `[1,12]` = `[linked_event_failed, accounts_must_be_different]`, `debits_posted` unmoved, rolled-back transfer not readable                                          |
| two-phase post + void       | pending 4600 held then cleared; posted +1200; the voided 3400 discarded                                                                                                      |
| shared client auto-batching | 400 transfers via 40 concurrent calls on **one** client in 44ms, `credits_posted` +4400 exactly — no double-post, no loss                                                    |
| account flags bite          | `debits_must_not_exceed_credits` rejected an unfunded debit (status 54 `exceeds_credits`), flags read back intact                                                            |
| `amount_max` sentinel       | `2^128-1` exact                                                                                                                                                              |

**Modes** (`deno task matrix` covers the loading question for all three packages;
`spikes/harness/_matrix-result.md`):

| mode                             | result                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `deno run`                       | ✅ 6/6                                                    |
| `deno test`                      | ✅ 6/6                                                    |
| `deno compile` (default)         | ✅ 6/6, 364 MB                                            |
| `deno compile --self-extracting` | ✅ 6/6, 364 MB                                            |
| `deno compile --bundle`          | ❌ `Cannot find module './bin/aarch64-macos/client.node'` |

The shared-client lifecycle was the specific worry — that object is what a compiled binary is most
likely to construct wrongly — and it survives 40 concurrent calls inside a self-extracting binary.

### Consequences, recorded so they are not re-litigated

- **ADR-0004's revisit trigger does not fire.** No Go ledger sidecar.
- `formal/two-store-commit.qnt` models **no extra network hop**; the space SPIKE-002 and
  `formal/README.md` held for one can be closed out.
- ADR-0013's "Caddy reverse-proxies **the** Deno process" stays singular.
- **`closes_adr` here is ADR-0023, not ADR-0004.** ADR-0004 is `accepted` and therefore immutable —
  it is the ADR whose _risk_ this settled, but it cannot be edited to record the settlement. The
  field is read as "the ADR this spike produced", per milestone m4's wording. See `_TEMPLATE.md`.

### Two traps worth carrying forward

- **`created` is `4294967295`, not `0`** — for both `CreateAccountStatus` and
  `CreateTransferStatus`. Zero is not a member of either enum. `status === 0` is never true and
  `status !== 0` treats every success as a failure. This probe's first run read
  `[4294967295, 4294967295]` as a hard error.
- **macOS is a development configuration.** TigerBeetle upstream supports Linux ≥5.6 for production.
  This is a _client loading_ result and implies nothing about storage behaviour on Linode — that is
  SPIKE-011.
