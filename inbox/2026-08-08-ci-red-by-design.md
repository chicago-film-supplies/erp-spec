---
kind: decision
title: CI is red by design at seed time, so the spec check is not a required merge check yet
contexts: [ledger]
source: scaffolding session, 2026-08-08
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

`deno task validate` fails on day one — seeded open questions have no owner or decide-by date.
That failure is the worklist and is correct.

But a required status check that fails by design blocks every merge from day one, so branch
protection was NOT enabled at seed time. Enable it once validate is green. Tracked as OQ-016.

This is the "land the gate red and watch it bite" discipline from the workspace CLAUDE.md: the
gate is real, it executes, and it currently fails for a known reason.
