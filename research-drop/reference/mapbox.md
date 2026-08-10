# Mapbox

Geocoding for destination addresses, behind a Firestore cache. **Adopted by [[ADR-0027]]**
(proposed, 2026-08-09) as a boundary service. Already in production in v1 — a retention.

## Canonical docs

- Geocoding API: <https://docs.mapbox.com/api/search/geocoding/>
- Matrix (durations/distances): <https://docs.mapbox.com/api/navigation/matrix/>
- **No `llms.txt`** as of 2026-08-09; this note is the curated substitute.
- **Reachable as an MCP server** (`mapbox`) with geocoding, directions, matrix, isochrone and
  turf-style geometry tools — use it rather than hand-rolling a request when exploring.

## CFS-specific gotchas

- **⚠️ Tests must never reach it.** `api-cloudrun/tests/helpers/forbiddenHosts.ts` denies Mapbox by
  default, alongside Xero and CRMS. The fence exists because these hosts _were_ being reached.
- **Geocoding is cached in Firestore** (`cache-geocodes`, one-year TTL), so an address is geocoded
  once. The dependency is off the hot path for every repeat destination, and a provider swap
  re-geocodes rather than losing history.
- **Retaining Mapbox does NOT fix the address defect.** Addresses are geocoded but **not
  normalized**, and region representation is inconsistent
  (`inbox/2026-08-08-addresses-unvalidated.md`, verified). Normalization is ours whatever the
  geocoder is. Do not read [[ADR-0027]] as having settled it.
- **A Mapbox place id is a foreign identifier** and [[ADR-0009]] fences those out of domain models —
  the same rule that keeps `xero_id` out of the chart of accounts.
- **Cost and rate limits are unmeasured for v2 scale** ([[ADR-0027]]). Recorded as unknown, not as
  benign; the Xero lesson is that a shared external limit becomes an incident before anyone measures
  it.

Cross-refs: [[ADR-0027]] · [[ADR-0009]] · [[ADR-0011]]
