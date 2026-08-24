---
id: SPIKE-011
headline: sizing the Linode host
question: >-
  Does TigerBeetle meet its durability and latency expectations on Linode block storage, or does it
  require local NVMe — and what instance shape, replica topology and monthly cost does the WHOLE
  tier on that host imply, not TigerBeetle alone?
timebox: 3 days
method: >-
  Run a single-replica TigerBeetle on a Linode instance with an attached Block Storage volume, and
  again on local instance storage if available. Drive a sustained transfer load on a
  PRODUCTION-DEFAULT cluster. Compare latency distribution and throughput against TigerBeetle's
  published expectations, and confirm its direct I/O and fsync assumptions are actually honoured by
  the volume rather than silently buffered. Then size every other process ADR-0013 and ADR-0028 put
  on that host — measured where a v1 twin exists, cited where it does not — and price the instance
  shape and replica topology the sum implies.
exit_criteria:
  - Measured transfer throughput and latency percentiles on each storage option, as numbers, taken on a production-default cluster — NOT `--development`, which caps createTransfers at 253 against 8189.
  - A statement of whether block storage honours the durability assumptions TigerBeetle relies on, from the direct-I/O and fsync path verified explicitly rather than inferred from throughput looking fine.
  - The whole tier sized together as a table, one row per process — the nine Victoria-stack containers, the OpenTelemetry collector, Gotenberg, Caddy, the Deno application, MongoDB, Valkey and TigerBeetle — each carrying a memory and CPU figure that is measured or cited, never estimated.
  - The replica count and instance shape that sum implies, with monthly cost.
  - If block storage is unsuitable, the alternative is named and priced — and what that does to ADR-0013, which is accepted and frozen and can therefore no longer be gated by this spike.
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

## ✅ Rescoped 2026-08-24 — the widening #41 asked for, which had not landed

⚠️ **erp-spec#41 was closed 2026-08-23 in the unblock pass, and the rescope it existed to force was
never written.** The note above says the widening must happen _before provisioning_; the exit
criteria underneath it stayed entirely TigerBeetle-storage. With the spend now authorized, that is a
spending risk rather than a paperwork one — **the guard against buying an answer to the wrong
question was untracked from the moment the issue closed.** Recorded here rather than reopened,
because the fix belongs in the artifact and not in the queue.

Four things changed, following #41's own suggested shape and the `SPIKE-007` rescope precedent
(`8921cfa`):

- **Criterion 3 is new — the whole tier, not TigerBeetle alone.** `ADR-0028` (the self-hosted
  service tier) says so in its own Consequences: _"nine containers before the application, the
  database or the ledger… it should size for this tier too, or the answer is about the wrong
  machine."_ ⚠️ **Gotenberg is Chromium**, which is not a rounding error on a Linode instance, and
  the corroborating datapoint next door is api-cloudrun#552 — the prod API container at **p95 0.822
  of its 512Mi just serving traffic**, ~91 MiB of headroom.
- **Criterion 1 now pins the cluster configuration.** `SPIKE-003` measured 2026-08-18 that
  `--development` caps `createTransfers` at **253 events against the documented 8189**, confirmed by
  standing up a second cluster on production defaults. ⭐ **Every TigerBeetle measurement in this
  repo predating that finding was taken on `--development`**, so this spike owns the deployment
  target and has to produce the production numbers rather than inherit dev ones.
- **Criterion 5 no longer gates an event that already happened.** It read _"before ADR-0013 is
  accepted"_; ADR-0013 is `accepted`, dated 2026-08-09, and frozen under gate 14. ⇒ that criterion
  could never be met as written. ⚠️ **This is the second instance of one pattern, not a one-off** —
  `SPIKE-003` was written to gate `ADR-0010`, which was accepted without it, and its job had
  silently changed from _decide_ to _confirm or contradict_ with nothing saying so until close.
- **The question and headline widened to match.** A spike whose criteria size a host while its
  headline says "storage" mis-glosses itself at every citation.

⚠️ **`closes_adr` is deliberately UNCHANGED, and that is a live question rather than an oversight.**
The spike now gates `ADR-0028`'s acceptance — which is `proposed` and cannot be accepted until this
lands — while merely confirming-or-contradicting `ADR-0013`, which is frozen. `closes_adr` holds one
id, so it cannot say both. **`SPIKE-003`'s precedent is to retarget at close**, and the reason it is
recorded here is that SPIKE-003's retarget went unremarked until the close itself.

⚠️ **What the rescope does NOT do.** It widens what must be measured; it does not widen the spend
already authorized. Sizing thirteen-plus processes may need more than the short-lived instance the
owner approved — **establish that before provisioning, since a half-sized measurement is exactly the
wrong-question purchase this rescope exists to prevent.**
