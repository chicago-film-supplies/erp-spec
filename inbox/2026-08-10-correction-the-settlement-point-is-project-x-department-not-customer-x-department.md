---
kind: correction
title: Correction — a settlement point is (project × department), not (customer × department); the org table is FLAT rather than duplicated, and consolidating it must not consolidate contacts
contexts: [billing, ordering]
source: repo owner, 2026-08-10 session + NetSuite subcustomer/project docs + SAP partner determination docs
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects the "two axes, not a tree" conclusion in
`inbox/2026-08-10-survey-a-department-is-a-settlement-point-and-a-production-is-a-project.md`, which
is append-only and stands as written. The survey's **criterion** survives; its **shape** and its
arithmetic do not.

## What the owner said

> These projects staff up entirely separately — the locations team on one project is different from
> the team on another project even if they're both 20th at the same time.
>
> Every project and/or dept will have its own set of contacts.

## What that breaks

The survey concluded the structure was **two axes on one customer** — customer × department, with
the project as a separate cost-object dimension — and computed that Netflix becomes "1 customer + 2
projects + 5 settlement points = 8 records that compose, instead of 10 that do not".

**That arithmetic is wrong, because the axes do not factor.** `Saturn Return: Locations` and
`Big Red: Locations` share a department _name_ and nothing else — different people, different
budget, different coordinator, different PO. There is no "Netflix Locations" that settles anything.

So a settlement point is **(project × department)**, and it is subordinate to the project rather
than to the customer.

## The corrected shape — and the references support it natively

```
Netflix Productions, LLC                      customer   — persists; credit exposure, history, concentration
├── Saturn Return                             project    — has a start and an END; carries production type
│   ├── Locations                             settlement — own AR balance, own statement, OWN CONTACTS
│   └── Office                                settlement
├── Big Red AKA Better than the Movies        project
│   ├── Office                                settlement
│   └── Locations                             settlement
└── (unattributed)                            — the 5 bare department records: Locations, Office,
                                                 SFX, Set Dec, Transportation
```

- **NetSuite** — the direct hit: **"Projects are tracked as subcustomers"**, and the customer
  hierarchy is "the top-level parent customer, all of its subcustomers, and all of THEIR
  subcustomers" (max 10,000). Customer → Job → Department is a native three-level subcustomer chain,
  and "any balances for projects and subcustomers can be paid through the parent customer or the
  subcustomer" — so both settlement modes work at every level.
- **SAP** — partner determination runs **per document**, at header _and_ item level, and an
  item-level assignment overrides the header. The bill-to/payer on an order can therefore be that
  project's locations coordinator without being a property of 20th Television at all. The customer
  master supplies a default, not the answer.

## The diagnosis changes: it is FLATNESS, not duplication

This is the part worth carrying, because it changes what the migration is for.

The measurement note called the 31 records "department clones" and implied redundancy. **They are
not copies.** Netflix's 10 records are ~9 genuinely distinct settling units — each with its own
receivable, its own coordinator, its own life. They are close to the correct _leaves_ already.

**What is missing is the root and the middle**, not the leaves. The tree is flat: nothing links the
nine, and there is no `Netflix Productions, LLC` node at all.

So consolidation is **not** the goal, and "10 records become 1" was the wrong target. The goal is
that the existing nine gain a parent and a project level. Record count barely falls; what appears is
the ability to ask a question at the top.

## ⚠️ The trap this creates for the migration

**Contacts are per settlement point, and a naive consolidation would pool them.**

`organizations.contacts[]` is embedded on the organization, with a `query_by_contacts` array.
Because each department clone _is_ an organization today, the current model **accidentally gets
contacts right** — the locations coordinator on Deli Boys S2 is attached to exactly the record that
owes the money.

Merge ten Netflix records into one customer and every contact pools onto it. That is precisely the
failure Xero's own users report of the contact-group workaround: _reminders go to all the email
addresses on the customer record, not the email each invoice went to._ A statement for
`Saturn Return: Locations` would then dun the Big Red office coordinator.

**The settlement point must remain the contact-bearing entity.** Any migration that moves contacts
up to the customer has destroyed a working property to fix a broken one.

## What survives from the survey, unchanged

- **The criterion**: separate settlement is an ADDRESSING concern, not an IDENTITY concern. One
  customer identity, N settlement points beneath it. Nothing here weakens that — it says the
  settlement points nest one level deeper than drawn.
- **A production is a project**, and that is where OQ-035's production type attaches. Strengthened,
  in fact: a project that staffs up and disperses is unambiguously a cost object with a life, not a
  customer attribute.
- **Both views must be available** — per-settlement-point aging and a consolidated customer balance.
- **The migration delta**, including that the mapping must be authored rather than parsed, and that
  AR balances must be proven not to move.

## What this means for the single-purpose LLCs

Worth checking before the ADR, and visible in the corpus: much of the customer list is
production-specific LLCs — `Enemies Movie, LLC`, `Big Time Movie LLC`, `Whale Shark Movie LLC`,
`GODSHOT MOVIE LLC`, `Freaky Monday LLC`, `First Snow LLC`. For those, **the customer and the
project are the same entity**, and `Enemies Movie, LLC - Locations` / `- Office` is a two-level tree
with a degenerate middle.

That is not a special case to code around — it is the general shape with one project — but it does
mean the hierarchy must tolerate a customer whose project count is exactly one, without forcing an
artificial project record. **And it raises a question the survey did not ask: who is legally
liable?** For a single-purpose LLC the credit risk sits on that LLC, not on the studio behind it, so
"roll up to the parent for credit exposure" may be exactly wrong for the indie half of the corpus.
OQ-036 should settle whether the hierarchy expresses _legal liability_ or _commercial relationship_
— they are not the same tree, and SAP models them as different partner functions for that reason.
