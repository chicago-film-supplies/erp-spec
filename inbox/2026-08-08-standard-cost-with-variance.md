---
kind: decision
title: Standard cost with a variance line, not pro-rata; residual is the idle-capacity KPI
contexts: [ledger]
source: prior-session design work, 2026-08
confidence: high
promotes_to: []
verified: false
triage_count: 0
---

Jobs absorb labour at a standard cost. The difference between standard absorbed and actual
incurred posts as its own variance line — never spread pro-rata across jobs.

The residual goes to an untracked `COGS – Unabsorbed Labour` account. That account **is** the
idle-capacity KPI, not a plug: a number that grows when the crew is paid and not earning. Rate
setting and revision cadence are undecided (OQ-008).
