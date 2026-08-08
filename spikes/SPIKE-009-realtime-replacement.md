---
id: SPIKE-009
question: >-
  What replaces Firestore real-time listeners — MongoDB change streams plus a socket layer — and
  what does that actually cost on the client?
timebox: 1 week
method: >-
  Build a vertical slice: a change stream on one collection, a socket layer, and a SolidJS store
  that stays live. Then inventory every place the current manager app depends on listener
  semantics and cost each one.
exit_criteria:
  - A working slice where a server-side document change updates a SolidJS view without a refetch.
  - Resume-token handling specified, including what happens after a disconnect longer than the oplog window.
  - An honest inventory of manager-side listener dependencies, with per-site effort — not a single aggregate estimate.
  - Authorization model stated: Firestore rules enforced reads directly; a socket layer must re-implement that.
closes_adr: new
status: open
---

## Notes

**This is the largest hidden line item in the migration.** ADR-0005 keeps SolidJS, which makes it
tempting to treat the client as mostly done. The framework survives; the data layer does not.

The authorization point is easy to miss: today the manager reads Firestore directly under security
rules. A socket layer inherits that responsibility with nothing enforcing it by default.
