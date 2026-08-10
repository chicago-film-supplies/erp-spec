---
id: SPIKE-002
question: >-
  What commit protocol keeps a MongoDB document write and a TigerBeetle posting consistent across
  crash and retry at every step?
timebox: 1 week
method: >-
  Specify the protocol as TB pending transfer -> Mongo write -> post/void. Enumerate every
  interleaving of crash and retry. Model-check it in `formal/two-store-commit.qnt`. Then build a
  harness that kills the process at each step and asserts the invariants hold on recovery.
exit_criteria:
  - "Quint model checks clean for the three failure questions: can a pending transfer be orphaned; can a Mongo doc exist with no posted transfer; can a retry double-post."
  - A crash-injection harness reproduces each interleaving and the recovery path restores consistency.
  - Orphan detection and resolution is specified, including its time bound.
closes_adr: new
status: open
---

## Notes

This is the load-bearing consequence of ADR-0003. If the protocol cannot be made safe, the two-store
split is wrong and ADR-0003 needs superseding rather than patching.

If SPIKE-001 forces a Go sidecar, the extra network hop belongs in this model.
