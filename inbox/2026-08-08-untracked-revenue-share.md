---
kind: finding
title: 28.7% of historical line revenue carries no product-line dimension
contexts: [ledger, billing]
source: "verified:2026-08-08:db_invoices_query, 999 invoices / 9,197 revenue lines"
confidence: high
promotes_to: [REQ-LED-001]
verified: true
triage_count: 0
---

Measured across the entire prod invoice corpus: $485,821.72 of $1,689,895.68 in line revenue
(28.7%) has `tracking_category: null`. The seeded estimate was "roughly a fifth" — the real
figure is materially worse.

Live in the current year, but improving sharply: 2023 42.0%, 2024 48.3%, 2025 16.2%, 2026 11.4%.
Not a legacy-only problem, and not a fixed one.

Caveat: these totals include void invoices (477 lines / $69,769.66), which is itself
[[2026-08-08-void-invoices-not-filtered]] biting inside this very measurement.
