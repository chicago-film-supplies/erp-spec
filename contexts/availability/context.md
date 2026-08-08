# Availability (`AVL`)

## Responsibility

What can be promised. Owns stock levels, bookings against date ranges, out-of-service records, and
the shortage signal.

## Boundary

- Does **not** own the order — Ordering does.
- Does **not** own physical location of goods — Fulfillment does.
- Does **not** own asset accounting — Fixed Assets does.

## Upstream / downstream

- **Consumes:** order confirmed/amended/cancelled (ORD), leg completed (FUL).
- **Produces:** availability confirmed, shortage detected.

## Open

- The current shortage signal is advisory, which suits an operator and not a customer. A public
  ordering surface needs an oversell policy decision before it ships.
