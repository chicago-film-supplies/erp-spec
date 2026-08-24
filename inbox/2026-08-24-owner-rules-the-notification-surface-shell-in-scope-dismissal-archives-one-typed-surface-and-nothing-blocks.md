---
kind: decision
title: >-
  Owner rules the four open questions on the conflict-resolution surface — an offline app shell IS
  in scope, dismissal archives rather than discards, conflicts share ONE typed notification surface
  with operational alerts, and nothing ever blocks further editing
contexts: [ordering, billing, fulfillment]
source: "owner, 2026-08-24, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

The four questions `SPIKE-013` raised and did not answer
(`inbox/2026-08-24-owner-the-conflict-popover-is-the-wrong-shape-it-is-a-global-notifications-surface.md`),
put to the owner and answered in one sitting.

## The rulings

| # | question                                     | ruling                                                 |
| - | -------------------------------------------- | ------------------------------------------------------ |
| 1 | is an offline app shell in scope?            | **YES** — v2 ships a service worker; the ADR says so   |
| 2 | what does dismissing a notification do?      | **discards, but the edit is ARCHIVED and recoverable** |
| 3 | one surface with operational alerts, or two? | **ONE surface, typed by kind**                         |
| 4 | does an unresolved conflict block editing?   | **NO — a document may stay diverged indefinitely**     |

## ⭐⭐ Two of them are safe only because of a third decision, and that dependency must be written down

⚠️ **Ruling 4 ("nothing blocks") is survivable only because per-field state exists.** With nothing
blocking, an operator keeps typing into a document whose server copy has moved, and the office sees
a different version — the divergence window is unbounded by design. **What makes that acceptable is
`SPIKE-013` exit criterion 6**: offline / pending / conflicted / synced is derivable at every
save-on-focusout site from the queue alone, so the fields themselves say they are diverged while the
operator works. ⇒ **criterion 6 stops being a nicety and becomes load-bearing for ruling 4.** If the
per-field indicator were dropped, ruling 4 would have to be revisited.

⚠️ **Ruling 3 ("one surface, typed by kind") is safe only if the KIND is load-bearing in the UI.** A
personal, unresolved conflict and an FYI that a template publish failed have different audiences,
different lifetimes and different dismissal rules. Sharing a menu is fine — **sharing an
undifferentiated list is not**, and "typed by kind" is what the ADR has to hold the design to
(ordering, filtering, and a dismissal rule that differs by kind).

⇒ **Together, rulings 3 and 4 mean the ONLY thing making an operator resolve a conflict is noticing
it.** That is a deliberate choice of never-interrupting over never-missing, and the two mitigations
above are what carry it.

## What ruling 2 creates

⚠️ **An archive needs somewhere to live**, and it is adjacent to `OQ-061` (can a committed field
edit be undone) without being the same question. OQ-061 is about recovering a value that WAS
applied; this is about preserving one that never was. ⭐ **They may share a mechanism**, and if they
do the cheaper design is one store rather than two — worth establishing before either is built.

⚠️ **And ruling 2 plus ruling 4 give work two ways to become invisible**: dismissed-and-archived,
and never-looked-at. **Both make the archive's reachability the thing that matters**, rather than
its existence.

## What ruling 1 costs, stated rather than assumed

A service worker is its own cache-invalidation problem: **a stale shell serving old code against a
new API is a class of bug the app does not have today.** It is accepted because the alternative
measured worse — `SPIKE-013` demonstrated that without it the queue survives a disconnect and is
**unreachable**, so an operator who closes the laptop on a job site cannot see their own unsent
work. **Half a capability, and the half that fails is the one the feature exists for.**

⇒ All four feed the shared `SPIKE-009` + `SPIKE-013` ADR (erp-spec#51), which now has every decision
it needs.
