# MongoDB

Documents + masterfiles ([[ADR-0003]]): orders and invoices are deeply nested with an items tree —
the shape that drove the Firestore design and still fits a document store.

## Canonical docs

- `llms.txt`: <https://www.mongodb.com/docs/llms.txt>
- Docs: <https://www.mongodb.com/docs/>
- Node driver: <https://www.mongodb.com/docs/drivers/node/current/>
- **Under Deno:** the official `mongodb` Node driver via an `npm:mongodb` specifier is the robust
  path. `denodrivers/mongo` (<https://github.com/denodrivers/mongo>) is a Deno-native alternative.

## Version (checked 2026-08-09)

- Server `8.x`; Node driver `6.x`.

## CFS-specific gotchas

- **`$jsonSchema` is an OLD JSON Schema draft (≈ draft 4), lossy vs 2020-12** ([[SPIKE-006]]).
  Expect `$ref`, `if`/`then`, `unevaluatedProperties`, and **discriminated unions** not to survive —
  and the order items tree leans on discriminated unions heavily. Catalogue every construct that
  does not translate, then state a split: what the DB enforces vs what the app (Zod) enforces, with
  **no construct unenforced in both.** The failure to avoid: a rule everyone assumes Mongo enforces
  that it silently does not.
- **Money: BSON has no unsigned 128-bit.** Store minor units as BSON **`Long`** (64-bit int), never
  `Double`. Match TB's u128 semantics at the app boundary and mind the `2^63` ceiling (TB's is
  `2^128`). Floats for money are banned everywhere (CLAUDE.md §7).
- **Change streams replace Firestore real-time listeners** ([[SPIKE-009]]) — but they do **not**
  re-implement Firestore security rules. A socket layer must enforce authorization itself; today the
  manager app reads Firestore directly under rules. Specify resume-token handling and what happens
  after a disconnect longer than the oplog window.
- **The Mongo write is step 2 of the two-store commit** ([[ADR-0003]] / [[SPIKE-002]]): TB pending →
  **Mongo write** → TB post/void. Invariant: a Mongo document must never exist without a pending or
  posted transfer (`formal/two-store-commit.qnt`).

Cross-refs: [[ADR-0003]] · [[SPIKE-006]] · [[SPIKE-009]] · [[SPIKE-002]] ·
`formal/two-store-commit.qnt`
