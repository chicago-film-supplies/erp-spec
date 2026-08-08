# Fixed Assets (`FA`)

## Responsibility

The asset register and depreciation. Owns asset identity, acquisition cost, in-service date,
class life, disposal, and the carrying basis under **both** the GAAP and tax books — plus the
deferred difference between them.

## Boundary

- Does **not** own the depreciation posting — it emits a run; Ledger posts it.
- Does **not** own tax filing — Tax owns the return position; Fixed Assets owns the tax basis.
- Does **not** own rental stock counts. An asset in the register and a rentable product are
  different things that may refer to the same physical object.

## Upstream / downstream

- **Consumes:** asset acquired (from a bill or purchase), asset disposed.
- **Produces:** depreciation run completed, asset disposed.

## Open

- SPIKE-005 — hand-rolled vs library, gated on building the rules corpus first.
- Hundreds of low-value assets means batch posting with a per-asset audit trail.
