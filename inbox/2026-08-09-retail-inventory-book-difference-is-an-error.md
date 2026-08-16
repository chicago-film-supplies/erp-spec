---
kind: decision
title: Retail inventory costing is the same on both bases — the measured divergence is a mistake, not a book difference
contexts: [tax, ledger]
source: repo owner, 2026-08-09 session
confidence: high
promotes_to: [REQ-TAX-002]
verified: false
triage_count: 0
---

Ruling on the second half of what
`inbox/2026-08-09-book-to-tax-difference-is-exactly-two-accounts.md` measured:

> retail costing should be the same between them, that outage is a mistake we will correct

So the $259.13 cumulative difference between the two bases in **1400 Retail Inventory** / **5000
COGS: Retail Inventory** is an **error in the current books**, not a designed difference in basis.
It was never a costing-method choice, a §263A adjustment or a write-down treated two ways.

## What changes

- **ADR-0026's overlay has ONE source again**, the fixed-asset register. Depreciation is the only
  legitimate book difference, which is what the ADR said before the statements were measured and
  what it says again now.
- **OQ-029 is answered rather than open.** The question was "why do the two books cost retail
  inventory differently, and which basis does v2 carry" — the answer is that they should not differ
  and v2 carries one number.
- **The migration must not carry the divergence across.** One retail-inventory cost at cutover, on
  both bases. Whether the prior years are corrected in the existing books or the divergence is
  simply not imported is the owner's and the CPA's call.

## What does NOT change

The measurement stands and is worth keeping: **the two statements as filed differ in exactly two
accounts**, and that fact was what confirmed a derived tax book is what CFS already produces. One of
the two turning out to be a defect makes the confirmation stronger, not weaker — the only _intended_
difference between the books is depreciation, and it reconciles to the cent.

Also worth keeping: the divergence was **invisible until the two statements were diffed line by
line**. 0.6% of the inventory balance, growing across three years — 0.66 in 2023, 152.87 in 2024,
105.60 in 2025 — and nothing in either statement flagged it. A book-to-tax comparison that is
produced from one ledger by a stated derivation cannot drift this way silently, because a difference
in any account the derivation does not name is a difference nobody authored. **That is an argument
for ADR-0026 the ADR did not have**, and it comes from the defect rather than from the design.
