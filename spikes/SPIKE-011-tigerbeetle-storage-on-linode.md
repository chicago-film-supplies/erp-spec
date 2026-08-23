---
id: SPIKE-011
headline: TigerBeetle on Linode storage
question: >-
  Does TigerBeetle meet its durability and latency expectations on Linode block storage, or does it
  require local NVMe — and what does that imply for replica topology and cost?
timebox: 3 days
method: >-
  Run a single-replica TigerBeetle on a Linode instance with an attached Block Storage volume, and
  again on local instance storage if available. Drive a sustained transfer load. Compare latency
  distribution and throughput against TigerBeetle's published expectations, and confirm its direct
  I/O and fsync assumptions are actually honoured by the volume rather than silently buffered.
  Then price the replica topology each option implies.
exit_criteria:
  - Measured transfer throughput and latency percentiles on each storage option, as numbers.
  - A statement of whether block storage honours the durability assumptions TigerBeetle relies on.
  - The replica count and instance shape the chosen option implies, with monthly cost.
  - If block storage is unsuitable, the alternative is named and priced before ADR-0013 is accepted.
closes_adr: ADR-0013
status: open
---

## Notes

Gates ADR-0013, not ADR-0003 — TigerBeetle stays either way. What is at risk is the hosting choice
and the topology, not the ledger.

A silent failure mode matters more than the throughput number here: if the volume acknowledges a
write before it is durable, TigerBeetle's guarantees are weakened in a way no load test surfaces.
Verify the fsync path explicitly rather than inferring it from performance looking fine.

## Unblocked 2026-08-23 — a small Linode spend is authorized

Owner ruling: provision a short-lived Linode instance with block storage, take the measurements,
destroy it.

⚠️ **The spend does NOT resolve erp-spec#41, and that has to be handled in the same pass.** #41
records that this spike is **scoped narrower than the decision resting on it** — `ADR-0013` chose
self-hosting on Linode, and one exit criterion here gates an acceptance that has already happened. ⇒
**measuring the narrow scope would buy an answer to the wrong question with real money.** Widen the
scope to what `ADR-0013` actually depends on **before** provisioning, not after.
