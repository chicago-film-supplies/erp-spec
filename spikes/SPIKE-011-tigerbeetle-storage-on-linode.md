---
id: SPIKE-011
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
