---
kind: decision
title: v1 is adopting a per-product serialization token for the oversell gate
contexts: [availability]
source: "code:2026-08-14:api-cloudrun@7cc0df8b:src/lib/stockClaim.ts+src/lib/stockSummary.ts+core@10.0.0-beta.166:src/utils/stock.ts — stock-locks/{P} written only by stageStockClaim, pinned by tests/unit/stockClaimCoverage.test.ts in deno task gate"
confidence: high
promotes_to: [] # filled at triage: the REQ/ADR/HOT/OQ ids this became
verified: true
triage_count: 0
---

`contexts/availability/context.md` **Open** asks for an oversell policy decision before a public
ordering surface ships. v1 has now answered the mechanical half of it, and the answer is worth
carrying into v2 because it was arrived at by measurement rather than by preference.

## The shape

Availability stays a **query-rebuilt projection** of the live rows — `stock/{productUid}` holding
pre-reduced anonymous intervals `{start, end, quantity, kind}` — and the hard gate comes from a
**separate one-field document per product**, `stock-locks/{productUid} = { seq }`. A claim reads the
sources outside any transaction, computes availability, and commits its booking together with a
blind `seq += 1` under a `lastUpdateTime` precondition. Anyone who claimed that product in between
bumped `seq`, so the precondition fails and the claimer retries against fresh state.

The projection is deliberately **not** a claims ledger. Under query-rebuild the **absence of a row
is the release**, and an absence cannot be forgotten; under any delta or journal shape a claim
leaves only when a writer removes it, and a missed removal consumes stock forever. v1 has the
receipt for that tax in the other direction — 39 of 268 prod inventory ledgers do not reconcile
against their movement journal and never did.

## Why it is a separate document

Firestore preconditions are only `exists` and `lastUpdateTime` — there is no field-value
precondition — so the token has to be a document nothing else writes. Preconditioning on the
projection itself would be invalidated by every rebuild.

Measured on `cfs-dev-3100`, and each number is why an obvious-looking alternative was rejected:

| shape                                                      | result                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| read-modify-write of one hot document inside a transaction | **60–87 s per contender**, ~1 sustained write/sec ceiling                |
| the same claim as CAS on a separate token                  | **1.3–1.5 s**; a loser is refused in **~266 ms**                         |
| transactional range read over the source rows              | 15,003 ms, 1 of 2 committed                                              |
| range→point conversion of that read                        | **15,121 ms** — narrowing lock _granularity_ leaves the _overlap_ intact |

The deadlock is **mutual**: it requires each transaction's write to land inside the other's held
read-lock set. Only a shape that holds no read lock on what it writes escapes, which is what makes
"read entirely outside, write blind under a precondition" the load-bearing property rather than an
optimization.

## The policy is per-path, and a blanket gate is wrong

A uniform `available >= qty` refusal is a regression, not a tightening — v1 records
`quantity_available` going negative as _the intended oversell signal_ for operators, and the CRMS
ingest path pushes orders CFS did not author, where a refusal is a 400 to a webhook that retries
forever.

| path                                            | policy                                              |
| ----------------------------------------------- | --------------------------------------------------- |
| public booking                                  | **hard refuse**, 409 carrying the real availability |
| operator (orders, bookings, fulfillment picker) | advisory — record the shortage, never block         |
| external ingest                                 | advisory, always — a refusal is unrecoverable       |
| out-of-service create                           | hard cap; a physical invariant, not demand          |

So "advisory vs hard" is not a single decision about the shortage signal — it is a property of the
**actor**, and the same product in the same window answers differently depending on who asked.

## What this does and does not settle for v2

- It settles that **per-entity serialization for the availability claim is cheap** when the token is
  its own document, and it is the same requirement
  `2026-08-09-per-entity-serialization-is-the-requirement.md` raises for the queue layer, arriving
  from the other side. Two contexts now want "serialize per entity uid" and neither gets it from a
  global concurrency knob.
- It does **not** settle SPIKE-012's boundary question. The token serializes whatever the claim
  decides; it does not decide _when_ a booking begins consuming. If v2 draws the boundary early
  enough that a forward booking consumes balance, this mechanism will serialize an answer that is
  already wrong.
- One question is open in v1 and transfers verbatim: **does a supply change serialize against a
  claim?** Receipts and reversals move `quantity_held` without bumping the token today, so a supply
  change landing between a claimer's read and its write is invisible to the precondition. The gate
  decides from held quantity _and_ claims, so the token's meaning has to be settled before the gate
  ships — not discovered afterwards.
