---
id: SPIKE-006
headline: JSON Schema into Mongo
question: >-
  How lossy is translating JSON Schema 2020-12 to MongoDB's `$jsonSchema`, and what is enforced
  where as a result?
timebox: 2 days
method: >-
  Take representative schemas — an order with its items tree, an invoice, a fixed asset with dual
  basis — and mechanically translate them. Catalogue every construct that does not survive.
exit_criteria:
  - Itemised list of 2020-12 constructs unsupported by `$jsonSchema`, with the CFS schemas that use them.
  - A stated split — what the database enforces vs what the application enforces — with no construct unenforced in both.
  - A decision on whether the application schema or the Mongo validator is generated from the other.
closes_adr: ADR-0040
status: closed
---

## Notes

Expect lossiness around `$ref`, conditionals (`if`/`then`), `unevaluatedProperties`, and
discriminated unions — which the order items tree depends on heavily.

The failure to avoid: a constraint everyone assumes the database enforces that it silently does not.

## Result — the premise inverted: MongoDB is honest, Zod is not

Measured 2026-08-18 against two real servers — `mongod 8.0.29` (gitVersion `559d67c6…`) and
`mongod 8.3.8` as cross-check — driven by `npm:mongodb@6.20.0`, translating the **real** `@cfs/core`
schemas (`code:2026-08-18:core@e9e78d6c:src/schemas/{order,invoice,product,transaction}.ts`). Probe:
`spikes/harness/mongo-schema-probe.ts` (`deno task mongo-schema`).

⚠️ **No container runtime existed on the machine** — Docker, Colima, Podman and OrbStack all absent,
no socket anywhere. Rather than fall back to documentation, the probe downloads the official
macOS-arm64 community tarballs and runs `mongod` directly. **Every row below is measured against a
live server; nothing is asserted from a doc.**

### 1. Unsupported constructs — MET, and the count depends on executing

**63 keywords probed individually: 29 accepted · 34 rejected · _0 accepted-and-ignored_.**

Every unsupported keyword produces an error at `createCollection` — either
`"…is not currently supported"` or `"Unknown $jsonSchema keyword: X"`. ⚠️ **So the spike's own
stated fear cannot arise from MongoDB's keyword handling.** `$jsonSchema` silently ignores nothing.

⚠️ **MongoDB's documentation lists only 6 omissions; the server rejects 34.** The other 28 fall
under one line, "Unknown keywords", because the page is written against draft 4. **Reading the docs
gets you 6; probing the server gets you 34** — the repo's "something executes" rule, measured.

Rejections that bite CFS directly:

- **`$jsonSchema type 'integer' is not currently supported`** — and `z.int()` emits `type:"integer"`
  on **every `_cents` field in the system**. `bsonType:"long"` is the working form.
- `keyword 'minimum' must be present if exclusiveMinimum is present` — the draft-6+ numeric form is
  rejected; only the draft-4 boolean form works. `ProductSchema` and `MovementSchema` emit the
  numeric form.
- `keyword 'format' is not currently supported` — 8 of 10 schemas emit `format`.
- Also rejected: `$ref`/`$defs`, `$id`, `if`/`then`/`else`, `dependentRequired`,
  `unevaluatedProperties`, `prefixItems`, `contains`, `propertyNames`, `const`, `default`, and Zod
  `.meta()` custom keys.

**Good news the spike did not expect:** `oneOf` survives, and Zod emits `oneOf` for
`z.discriminatedUnion`, so the _shape_ of a discriminated union translates. Only the discriminator
keyword needs rewriting.

### ⚠️ The 5 silent drops are all upstream of MongoDB

| # | Construct                                                        | Proven by                                                      |
| - | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1 | **discriminated union whose `const` discriminator was stripped** | inserted `type: "utterly_bogus_discriminator"` — landed        |
| 2 | items invariant **(5)** `path.at(-1) === uid`                    | inserted `path: ["WRONG"]` — landed                            |
| 3 | items invariant **(1)** within-parent uniqueness                 | inserted two items with identical `(parent, uid)` — landed     |
| 4 | items invariant **(2)** depth-first contiguity                   | inserted a split subtree — landed                              |
| 5 | items invariant **(3)** zero-priced-first                        | inserted a priced item before its zero-priced sibling — landed |

**Row 1 is the one that will bite.** `z.literal("destination")` emits
`{"type":"string","const":"destination"}`; MongoDB rejects `const`; a stripper leaves
`{"type":"string"}` — and the collection now accepts **any string** as the discriminator. The
repairable form is `enum: ["destination"]`, which is accepted **and was proven to reject** the bogus
value.

**And the more dangerous losses happen inside Zod, before Mongo sees anything:**

- **35 refinements across `core/src/schemas/` produce zero JSON Schema output**, and
  `unrepresentable: "throw"` reports **no throw** — it flags types, never refinements.
- **`io: "output"` erases every transformed field to `{}`.** `chicagoInstant()` fields emit
  `anyOf: [{}, {"type":"null"}]` — a tautology that reads like a union.
- **`FirestoreTimestamp` emits `type:"string"` for an object value** — present but wrong.

### 2. The enforcement split — MET, but only because `$expr` exists

| Layer                  | Enforces                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DB — `$jsonSchema`** | presence, BSON type, enum membership, numeric bounds, string length + `pattern`, array length + `uniqueItems`, property counts, closed objects (**only with `_id` explicitly declared**), union shape via `oneOf`, discriminator via `enum:[v]` |
| **DB — `$expr`**       | **all five items-array invariants**, and any cross-field or cross-element predicate                                                                                                                                                             |
| **App — Zod**          | the 35 refinements, canonicalizing transforms, `.default()`, `z.custom` predicates, the true `FirestoreTimestamp` shape                                                                                                                         |
| **App — code**         | `computeItemPaths` as the single author of `path`; merge-on-add; the two-pass totals pipeline                                                                                                                                                   |

**With that split adopted, nothing is unenforced in both.** Without it, items invariants (1), (2),
(3) and (5) are — they live only in api-cloudrun's `validateBeforeWrite`. `path` **authorship** is
unenforceable by any schema of either kind: no schema expresses "this field has one author".

### ⭐ `$expr` escapes the fixed-point-guard problem

A collection validator is an ordinary query document, and `$expr` admits the aggregation language.
All five invariants were **proven enforced**, each with a conforming/violating pair, and
`{$and: [{$jsonSchema: …}, {$expr: …}]}` composes.

⚠️ Today (1), (2) and (3) are checked by `validatePathsAgainst` — **a fixed-point check defined in
terms of `computeItemPaths`**, which can only ever agree with its own normalizer, and is exactly why
(4) and (5) are asserted directly (workspace `CLAUDE.md`). **`$expr` is the first mechanism measured
here that checks (1), (2) and (3) independently of the normalizer**, because the expression is
written in terms of the stored data rather than the recompute. That is the strongest argument for
pushing them into the database.

### ⚠️ The contiguity expression took FOUR attempts, and that is the finding

| Attempt | Outcome                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------- |
| 1       | validator errored → **rejected the conforming document too**                                          |
| 2       | size-guarded → **accepted the violating document** (vacuous)                                          |
| 3       | deeper case → **rejected a conforming document** (two top-level dividers legitimately share the root) |
| 4       | parent(k) must be a **prefix** of path(k−1) → **ENFORCED** across four scenario pairs                 |

Attempts 1–3 all _read_ correct. Only holding a conforming document beside a violating one told them
apart. **A hand-written `$expr` invariant is easy to get wrong in both directions, and neither error
is visible from the expression** — "land every gate red first", arriving from the other side.

### ⚠️ The shortcut that is exactly backwards

A unique index on `items.uid` is what someone reaches for instead. Measured: the same `uid` **twice
in one document** → **inserted**; the same `uid` in a **different document** → **rejected**.
`item.uid` repeats across orders by design and repeats _within_ one doc in 18% of prod orders. **It
forbids the legal case and permits the illegal one.**

### 3. Generation direction — MET

**Zod → validator, one-way.** The criterion is _which direction loses information irrecoverably_:
validator→app is not lossy, it is **impossible** — 29 draft-4 keywords, no `const`, no conditionals,
no `$ref`, no `format`, no `default`. A third IDL would have to be as expressive as Zod to avoid the
same loss.

⚠️ **But it cannot be `toJSONSchema()` + a stripper as it stands.** A Zod-**valid** order document
was **rejected by the generated validator for three independent reasons**, while the date fields
accepted anything. Mandatory amendments: generate from `io: "input"` (the real fix being **no
transforms in the v2 storage schema**), declare `_id`, and give `z.custom` a truthful `bsonType`.

### What this did NOT measure

- **The drop counter structurally undercounts.** It can only count keywords that reached JSON
  Schema, so the 24 refinements in those files contribute **0** while being the largest real loss.
- Linux, replica sets, and any server older than 8.0.
- ⚠️ `--fork` is rejected by `mongod` 8.3.8 on macOS but accepted by 8.0.29 — background the process
  instead.
