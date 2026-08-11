---
kind: finding
title: Company, production and department are all crammed into organizations.name — 31 of 286 orgs are department clones, Netflix is 10 records with no parent, and four delimiter conventions are in use
contexts: [billing, ordering, ledger]
source: "api:2026-08-10:db_organizations_query — all 286 organizations, name only, ordered by name"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Raised by the owner: invoices settle **by department**, and "locations doesn't want to see what
office or wardrobe owes". The current workaround is duplicating the organization and suffixing the
name. This measures the workaround.

## The corpus

**286 organizations.** Roughly **31 carry a department suffix**, spread across **11 parent
companies**. A further ~9 carry a _production_ rather than a department.

## Netflix Productions, LLC is 10 records, and there is no parent

```
Netflix Productions, LLC - Locations
Netflix Productions, LLC - Office
Netflix Productions, LLC - SFX
Netflix Productions, LLC - Set Dec
Netflix Productions, LLC - Transportation
Netflix Productions, LLC / Saturn Return: Locations
Netflix Productions, LLC / Saturn Return: Office
Netflix Productions, LLC: Office
Netflix Productions, LLC: Office // Big Red AKA Better than the Movies
Netflix Productions, LLC: Office // Big Red AKA Better than the Movies: Locations
```

⚠️ **There is no un-suffixed `Netflix Productions, LLC` record.** The customer, as an entity, does
not exist in the system. Nothing can answer "what is our total exposure to Netflix" without a string
match.

The same shape at 20th Television, which _does_ have a parent record and therefore splits its
history across it and five children:

```
20th Television
20th Television - Deli Boys - S2: Construction
20th Television - Deli Boys - S2: Locations
20th Television - Deli Boys - S2: Office
20th Television - Deli Boys - S2: Transpo
20th Television - The Chi
```

## Three concepts, one string

Read the Netflix and 20th rows and the structure is unambiguous:

| concept        | examples                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Company**    | Netflix Productions LLC · 20th Television · TPS Production Services · Pops, Puffs, Pebbles              |
| **Production** | Deli Boys S2 · The Chi · Saturn Return · Big Red / Better than the Movies · Cheesesteak · Insight, UKOP |
| **Department** | Office · Locations · SFX · Set Dec · Transportation · Transpo · Construction · Costumes · Production    |

**The owner asked for departments on orgs. The data says there are three levels, not two** — company
→ production → department. `20th Television - Deli Boys - S2: Locations` is all three at once, and
the production layer is where a _production type_ would actually attach (OQ-035).

## Four delimiter conventions, mixed within one customer

Space-hyphen-space, colon-space, space-slash-space, and space-double-slash-space — plus
combinations. Netflix alone uses all four. (Written out rather than shown as literals because the
surrounding whitespace is the distinguishing part and a formatter strips it inside code spans.)
There is no parse that recovers the structure reliably, which means the current shape is not
machine-readable even as a stopgap.

Two spellings of one department: **`Transportation`** (Netflix) and **`Transpo`** (20th Television).

## A separate defect the same query exposed

Exact-duplicate organization names, unrelated to the department workaround:

- `Enlace Chicago` ×2 · `Free Spirit Media` ×2 · `Full Spectrum Features` ×2 · `Omnicom` ×2 ·
  `Sound Off Films` ×2
- Three records named with a literal **`(copy)`** suffix: `Sound Off Films (copy)`,
  `Seamless Productions (copy)`, `Pops, Puffs, Pebbles Canada LTD - Locations (copy)`

`Sound Off Films` therefore exists three times. This is not the same problem as the department
clones — it is duplicate-entity drift — but it lands in the same place at migration and should be
measured before either is designed. It also means "match on name" is not a viable migration key.

## Why this is an accounting question and not a naming one

The clones exist because **settlement is per department**: each has its own AR balance, its own
statement, and its own aging. That is the requirement, and it is a real one. What the workaround
costs:

- **No customer-level credit exposure.** Netflix's total receivable is unobtainable without string
  matching across 10 records.
- **No customer-level history.** A repeat customer looks like eleven first-time customers.
- **`product_line` reporting is unaffected**, but any future **production-type** classification
  would be attached to a clone rather than a production — the wrong grain, and the same
  denormalization trap in a new costume.
- **Migration has no stable key.** ADR-0009 fences foreign ids out of domain models, so the mapping
  from 10 Netflix clones to one company + N productions + M departments has to be authored, not
  derived.

## What this needs before an ADR

Its own six-reference survey (CLAUDE.md → _Accounting decisions_). This is a **customer-master and
AR-settlement** question, distinct from the classification question surveyed in
`2026-08-10-survey-a-classification-is-snapshotted-at-posting-and-changed-by-a-named-realignment.md`,
and every reference has a documented answer for it:

- **SAP** — partner functions on the sold-to/bill-to/payer/ship-to axes, plus the SD customer
  hierarchy. The most direct precedent: **payer** is exactly "who settles this", held separately
  from "who bought".
- **NetSuite** — customer sub-entities / parent-child hierarchy with consolidated or separate AR.
- **Sage Intacct** — customer dimension plus entity/location structure.
- **Odoo** — `res.partner` child contacts with an `invoice` address type, which is the same idea.
- **Xero** — **has no answer**, which is precisely why CFS invented the suffix. The absence is the
  measurement.
- **GAAP** — receivable presentation and, at the 10% threshold, major-customer concentration
  disclosure (ASC 280-10-50-42). Worth checking whether splitting one customer into ten understates
  a concentration that should be disclosed.

Tracked as OQ-036.
