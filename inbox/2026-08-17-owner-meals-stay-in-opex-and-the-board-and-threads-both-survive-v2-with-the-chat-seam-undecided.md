---
kind: decision
title: >-
  Owner — team meals stay in operating expense like tickets (decided, no ADR needed); the board and
  the comment threads BOTH survive into v2, the board's current form being a rough draft, and the
  only open part is where the chat seam sits
contexts: [ledger, ordering]
source: "Owner, 2026-08-17, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## 1. Team meals stay in operating expense — decided

> _"im fine with keeping meals where they are (like tickets) thats decided"_

`6005 - Meals & Entertainment: Team Meals` (**$17,777.88** FY2025) and
`6006 - Meals & Entertainment: Company Parties` stay in operating expense. They do not absorb into
COGS and they do not enter any product-line pool.

**It is the `6404 - Vehicle: Tickets` shape, and the account's own note already named the axis**:
_"split from 6006 because the two carry different **deductibility**, not because they differ
operationally."_ A cost whose deductibility is the reason it has its own account is a cost that must
stay separable for ADR-0026's dual-basis book — and an account absorbed into a product line is no
longer separable.

⚠️ **No ADR, and no survey, and both are correct here.** CLAUDE.md rule 8a requires a survey before
an accounting-shaped decision; this decision is **to change nothing**. The accounts, their
classification and their treatment are all already what they will be. A survey exists to prepare a
CHANGE, and there is none — so the disposition is recorded on the accounts and that is the whole
artifact. ⚠️ **If it is ever revisited as "should meals absorb", that IS a change and 8a applies in
full.**

## 2. The board survives — its current form does not

> _"a version of the current board/calendar/list def survives into v2, its current form is a very
> rough draft"_

`cards` (1,114 docs) and `lists` (4) are **in scope**. ⚠️ **But "the concept survives" and "the data
migrates" are different claims**, and only the first is settled: the v2 shape is a redesign, so
nothing can be mapped to it yet. The migration disposition stays `quarantine` and its REASON changes
— from _"might not survive"_ to _"survives, target shape undesigned"_.

## 3. The threads survive — the seam does not

> _"a version of comments/threads also survives, potentially integrating with matrix (or other open
> source slack type of company chat system) or thats separate hard to say where the best seam is"_ ·
> _"probably user and/or domain tagging"_

`threads` (4,153) and `comments` (44) are **in scope**. The undecided part is **where the boundary
between CFS and a chat system sits**:

- CFS implements threads itself, as today;
- or chat lives in **Matrix** or a comparable open-source system and CFS holds only the link;
- **candidate seam, owner's own: user and/or domain tagging** — a message tagged with a person
  and/or a domain object (an order, a card), with the conversation itself living outside.

⇒ **OQ-051.** ⚠️ The seam decides the migration, not the other way round: if chat moves out, the
4,153 thread records are a _link table_ at most, and if it stays in, they are the thing itself.

⚠️ **And the corpus is ~99% empty containers either way** — 4,153 threads against 44 comments, from
event-card delete/recreate churn (symptom-fixed in v1 2026-06-24, root deferred to
api-cloudrun#227). **Whether the concept survives and whether THAT DATA should be carried are
separate questions**, and answering the first does not answer the second.

## What this closes and what it opens

- **OQ-049 answered** — both surfaces survive. It asked whether the charter's silence meant they
  were out of scope; it did not.
- **OQ-051 opened** — the chat seam.
- ⚠️ **The charter still names neither**, which is the gap OQ-049 actually exposed. Its in-scope
  list runs order → fulfillment → invoice → posting → report and reaches no collaboration surface;
  its non-goals exclude payroll, multi-currency, multi-entity, CRMS and a general accounting
  product, and exclude neither of these. **A ruling in a session is not a charter amendment.**
