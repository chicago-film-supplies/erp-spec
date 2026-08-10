---
kind: finding # finding | idea | question | constraint | research | decision
title:
contexts: [] # LED FUL BIL FA ORD AVL BNK TAX -> directory names under contexts/
source: # where this came from: a person, a session, a verification query
confidence: medium # high | medium | low
promotes_to: [] # filled at triage: the REQ/ADR/HOT/OQ ids this became
verified: false # true only if checked against the live CFS API
triage_count: 0 # incremented each triage pass that leaves it unpromoted
---

Two to four lines. One idea per file. Standalone — no reference to conversational context. Never
rewritten after it lands; corrections go in a new file that supersedes this one.
