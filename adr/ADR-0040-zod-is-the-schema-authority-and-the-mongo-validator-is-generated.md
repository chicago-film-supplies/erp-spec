---
id: ADR-0040
headline: Zod is the schema authority
title: >-
  The Zod schema is the sole authority and the MongoDB validator is generated from it one-way, with
  every rule the validator cannot carry named in a registry CI walks
status: proposed
date: 2026-08-18
review_by: 2026-11-15
deciders: [repo owner]
contexts: [ordering, billing, ledger]
relates_to: [ADR-0003, ADR-0004, ADR-0009, SPIKE-006]
accounting_shaped: false
supersedes:
supersedes_on_acceptance:
superseded_by:
---

> **In the context of** ADR-0003 moving documents into MongoDB, **facing** a `$jsonSchema` dialect
> that accepts 29 of 63 probed keywords and a Zod translator that discards constraints silently,
> **we decided** that the Zod schema is the sole authority and the MongoDB validator is generated
> from it one-way as a deliberately narrower artifact — `$jsonSchema` for shape, `$expr` for the
> cross-element items invariants — with every rule the validator cannot carry named in a registry CI
> walks, **to achieve** no rule enforced in neither layer, **accepting** that the generator must be
> written and maintained rather than taken off the shelf.

## Context

SPIKE-006 measured this against real servers (`mongod` 8.0.29 and 8.3.8) using the real `@cfs/core`
schemas. Three findings drive the decision, and the first inverts the assumption everyone starts
with:

- **MongoDB is honest. `$jsonSchema` silently ignores nothing** — 63 keywords probed, 29 accepted,
  34 rejected, **0 accepted-and-ignored**. Every unsupported keyword errors at `createCollection`.
- **The silent loss is upstream, in Zod.** `z.toJSONSchema()` drops **35 refinements** across
  `core/src/schemas/` with no output and no warning — `unrepresentable: "throw"` reports no throw,
  because it flags types and never refinements. `io: "output"` erases transformed fields to `{}`.
- **`$expr` changes what "MongoDB cannot express" means.** A collection validator is an ordinary
  query document, so the aggregation language is available. All five items-array invariants were
  **proven enforced** with conforming/violating pairs, and `{$and: [{$jsonSchema}, {$expr}]}`
  composes. "MongoDB cannot express the items invariants" is a claim about `$jsonSchema`, and it is
  false about MongoDB.

## Decision

1. **The Zod schema is the sole authority.** The MongoDB validator is **generated from it,
   one-way.** Nothing is generated in the other direction and no third IDL is introduced.
2. **The validator is deliberately narrower**: `$jsonSchema` for shape and type, `$expr` for the
   cross-element items invariants.
3. **Every rule the validator cannot carry is named in a registry that CI walks**, so a rule
   enforced in neither layer is a build failure rather than a discovery.

## Consequences

- **The generation direction follows from which way loses information irrecoverably.** Validator→app
  is not lossy, it is impossible: 29 draft-4 keywords, no `const`, no conditionals, no `$ref`, no
  `format`, no `default`. A third IDL would have to be as expressive as Zod to avoid the same loss,
  so it would buy nothing.
- **⚠️ The generator is NOT `toJSONSchema()` plus a stripper.** A Zod-**valid** order document was
  **rejected by exactly that pipeline's output for three independent reasons**, while the date
  fields accepted anything. Three amendments are mandatory: generate from `io: "input"`, declare
  `_id` explicitly (or `additionalProperties: false` rejects every document), and give `z.custom` a
  truthful `bsonType`.
- **⚠️ A stripper is how the one dangerous silent drop happens.** `z.literal("x")` emits
  `{"type":"string","const":"x"}`; MongoDB rejects `const`; stripping it leaves `{"type":"string"}`
  and **any string then passes as the discriminator** — proven by inserting
  `type: "utterly_bogus_discriminator"`. The discriminator must be **rewritten to `enum: ["x"]`**,
  which is accepted and was proven to reject the bogus value. A generator that removes unsupported
  keywords rather than translating them is the defect, not the fix.
- **⚠️ `z.int()` emits `type:"integer"`, which MongoDB rejects — and every `_cents` field in the
  system is a `z.int()`.** `bsonType: "long"` is the working form, and the money fence ("money is
  integer minor units") therefore depends on the generator translating this correctly rather than
  dropping it.
- **The transforms should leave the storage schema.** `io: "output"` erasing transformed fields is a
  symptom: a canonicalizing transform in a _storage_ schema means the stored shape is not the
  declared shape. The real fix is **no transforms in the v2 storage schema** — canonicalize at the
  boundary, store the canonical form. Generating from `io: "input"` is the workaround if that is not
  done.
- **⭐ The items invariants move into the database, and the reason is not convenience.** Today (1),
  (2) and (3) are checked by a **fixed-point check defined in terms of `computeItemPaths`**, which
  can only ever agree with its own normalizer — the workspace `CLAUDE.md` names this as a
  load-bearing defect class, and it is why (4) and (5) are asserted directly. **`$expr` is the first
  measured mechanism that checks (1), (2) and (3) independently of the normalizer**, because the
  expression is written in terms of the stored data. That is the argument.
- **⚠️ A hand-written `$expr` invariant is easy to get wrong in BOTH directions.** The contiguity
  expression took **four attempts**: one rejected conforming documents, one was vacuous and accepted
  violating ones, one rejected a legitimate two-top-level-divider case. All three _read_ correct.
  **Every `$expr` invariant therefore ships with a conforming/violating pair as its test**, on the
  repo's own "land every gate red first" rule.
- **⚠️ Do not reach for a unique index on `items.uid`.** Measured: the same `uid` twice in one
  document is **inserted**; the same `uid` in a different document is **rejected**. `item.uid`
  repeats across orders by design and repeats within one document in 18% of prod orders. **It
  forbids the legal case and permits the illegal one.**
- **`path` authorship stays in application code and is named in the registry as such.** No schema of
  either kind can express "this field has exactly one author"; `computeItemPaths` remains that
  author (ADR-0009's boundary discipline, one layer in).
- **Rejections are found at deploy time, not at runtime**, because MongoDB errors at
  `createCollection`. That is a property worth keeping: it makes the generator's output falsifiable
  in CI against a real server.
- **⚠️ Read the server, not the docs.** MongoDB's documentation lists **6** omissions; the server
  rejects **34**, because the page is written against draft 4 and folds the rest into "Unknown
  keywords". Any future claim about `$jsonSchema` coverage in this spec must come from a probe.
- **⚠️ What this does NOT decide.** Which collections get validators, at what `validationLevel` and
  `validationAction`, and whether validation is enforced on the migration load itself. Those are
  migration decisions and none is measured yet.
