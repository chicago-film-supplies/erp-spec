# Ordering (`ORD`)

## Responsibility

What the customer asked for. Owns orders, destinations, the items tree, quotes, pricing at time of
order, and the order lifecycle.

## Boundary

- Does **not** own physical movement — Fulfillment does.
- Does **not** own the invoice — Billing does. An order may produce several invoices, and an invoice
  may span several orders.
- Does **not** own stock reservation — Availability does.

## Upstream / downstream

- **Consumes:** availability confirmed (AVL).
- **Produces:** order confirmed, order amended, order cancelled.

## Open

- Multi-destination orders are newly possible — OQ-003 (is fulfillment_mode per-order or
  per-destination) and OQ-002 (may a trip span orders).
- The items-tree invariants from the current system carry forward: path is the row identity, and it
  has exactly one author. See the workspace CLAUDE.md.
