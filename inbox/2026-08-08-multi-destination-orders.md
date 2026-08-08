---
kind: constraint
title: Multi-destination orders are newly possible and will start appearing
contexts: [ordering, fulfillment, billing]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

The legacy system never supported multiple destinations on one order. The new one must, and real
multi-destination orders will begin arriving.

Consequences to chase: whether `fulfillment_mode` is per-order or per-destination (OQ-003),
whether a trip may span orders (OQ-002), and how a chargeable field leg count is apportioned when
one trip serves several destinations.
