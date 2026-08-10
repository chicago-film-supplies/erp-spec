# Zod

Runtime validation and the single source of TS types at the API boundary — and the **app-enforced
half** of the schema split that Mongo's `$jsonSchema` cannot cover ([[SPIKE-006]]).

## Canonical docs

- `llms.txt`: <https://zod.dev/llms.txt> · full `llms-full.txt`
- Docs: <https://zod.dev/>
- Packages: npm `zod` · JSR `@zod/zod`

## Version (checked 2026-08-09)

- Zod `v4`.

## CFS-specific gotchas

- **Money stays integer minor units.** Use `z.int()` (or `z.bigint()` where the value can exceed
  `2^53`), never a plain `z.number()` float. Consider a branded type —
  `z.number().int().brand<"MinorUnits">()` — so dollars can never be assigned where cents are
  expected. Mirrors the TB u128 / BSON Long story.
- **Zod is the enforcement layer Mongo can't be.** The constructs `$jsonSchema` drops —
  discriminated unions (the order items tree), `if`/`then`, `unevaluatedProperties` — get enforced
  here at the boundary. The [[SPIKE-006]] rule: no construct unenforced in both DB and app.
- **Zod ↔ JSON Schema is a generator candidate.** v4 ships `z.toJSONSchema()`. [[SPIKE-006]] must
  decide whether the app schema or the Mongo validator is generated from the other — pick one source
  of truth and generate the other; do not hand-maintain both.

Cross-refs: [[SPIKE-006]] · [[mongodb]] · [[hono]]
