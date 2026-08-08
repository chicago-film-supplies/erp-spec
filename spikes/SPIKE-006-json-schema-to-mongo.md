---
id: SPIKE-006
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
closes_adr: new
status: open
---

## Notes

Expect lossiness around `$ref`, conditionals (`if`/`then`), `unevaluatedProperties`, and
discriminated unions — which the order items tree depends on heavily.

The failure to avoid: a constraint everyone assumes the database enforces that it silently does
not.
