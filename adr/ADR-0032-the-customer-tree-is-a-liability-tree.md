---
id: ADR-0032
title: The customer tree is a liability tree; projects and departments are addressing beneath it
status: proposed
date: 2026-08-10
review_by: 2026-11-15
deciders: [repo owner]
contexts: [billing, ordering, ledger]
relates_to: [ADR-0009, ADR-0020, OQ-035, OQ-036, HOT-006]
supersedes:
superseded_by:
---

> **In the context of** a customer master where 31 of 286 organizations are department clones and
> `Netflix Productions, LLC` is ten flat records with no parent, **facing** a requirement that
> invoices settle per department while credit exposure is a question about a company, **we decided**
> that the customer node is the **legal entity** and that projects and settlement points are
> addressing beneath it, **to achieve** a receivable that can be read both per department and per
> liable party, **accepting** that a separately-incorporated production is a separate customer and
> that the tree therefore cannot answer economic-concentration questions on its own.

## Context

- **The requirement is real**: invoices settle per department. Owner, 2026-08-10 — "locations
  doesn't want to see what office or wardrobe owes."
- **Projects staff up independently.** The locations team on one production is different people from
  the locations team on another, even for the same studio at the same time. **Every project and
  department has its own set of contacts.** So a settlement point is `(project × department)`,
  subordinate to the project, not `(customer × department)`
  (`inbox/2026-08-10-correction-the-settlement-point-is-project-x-department-not-customer-x-department.md`).
- **Measured 2026-08-10** (`api:2026-08-10:db_organizations_query`, all 286 organizations): 31
  department clones across 11 parent companies; `Netflix Productions, LLC` is **10 records with no
  un-suffixed parent**, so the customer as an entity does not exist; four delimiter conventions, all
  four inside Netflix alone; `Transportation` and `Transpo` are one department spelled two ways.
  Separately, 5 exact-duplicate name pairs and 3 records suffixed with a literal `(copy)`.
- **Surveyed against all six references**
  (`inbox/2026-08-10-survey-a-department-is-a-settlement-point-and-a-production-is-a-project.md`).
  **Separate settlement is an ADDRESSING concern, not an IDENTITY concern** — every reference but
  Xero keeps one customer identity and hangs N settlement points off it, and not one creates a
  second customer. NetSuite tracks projects as subcustomers and nests them, with balances payable at
  any level; SAP determines bill-to/payer **per document**, header and item, over a customer-master
  default.
- **Xero has no answer**, which is why the suffix exists. Its own community documents the two
  workarounds and the cost of each: contact groups filter but produce no consolidated statement, and
  duplicate contacts **double-count the receivable** while payments on one copy do not clear the
  other. CFS took the duplicate route.
- **The defect is FLATNESS, not duplication.** The 31 records are not copies — each is a genuinely
  distinct settling unit with its own receivable and coordinator, and they are close to the correct
  leaves already. What is missing is the root and the middle.

## Decision

**Three levels, and only the root carries liability.**

| Level                | Is                                                                            | Carries                                                           |
| -------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Customer**         | the **legal entity** — the party that owes the money and could be sued for it | credit exposure, credit limit, trading history, tax profile       |
| **Project**          | a production                                                                  | the cost object; **production type** (OQ-035); a start and an end |
| **Settlement point** | a department on a project                                                     | its own AR balance, statement, aging, **and its own contacts**    |

**The tree is determined by legal liability.** A node sits under a parent only where that parent is
legally liable for the child's debts. Projects and settlement points are internal divisions of the
liable entity — they partition the receivable for addressing and reporting, and they do **not**
change who owes it.

**Both roll-ups are required at every level**: aging per settlement point, and a consolidated
balance per customer. Neither is derived on demand from the other by string matching.

## Considered options

- **Keep the flat clone table.** Rejected: it is the status quo, it has no root, and it makes credit
  exposure a string-matching exercise across ten records.
- **One customer, departments as settlement points, no project level.** Rejected on the owner's
  measurement: departments are staffed per project, so `Saturn Return: Locations` and
  `Big Red: Locations` are different settling units. Without the project level they collide.
- **A commercial-relationship tree** — group by "who this really is" (all Netflix-adjacent entities
  under Netflix). Rejected as the _tree_, but see the first consequence: it is a real question and
  it needs a different mechanism.
- **A liability tree** (chosen).

## Consequences

- ⚠️ **A separately-incorporated production is its OWN customer, not a child.** This is the direct
  consequence of choosing liability, and it is the one that will surprise. The corpus already
  contains the case: `Pops, Puffs, Pebbles Canada LTD` and `Pops, Puffs, Pebbles, LLC` are one
  production and two legal entities, so they are **two customers** — and the ~15 single-purpose
  production LLCs (`Enemies Movie, LLC`, `Whale Shark Movie LLC`, `GODSHOT MOVIE LLC`,
  `Freaky Monday LLC`, `First Snow LLC`) are roots with no parent, however obvious the studio behind
  them.
- ⚠️ **The tree therefore CANNOT answer economic concentration, and GAAP asks the other question.**
  ASC 280-10-50-42 defines one customer by **common control** — an economic test, not a liability
  test — so the two roll-ups genuinely differ. CFS is private and the disclosure does not bind it,
  but "what is our real exposure to Netflix" is a management question regardless. **If that question
  is wanted, it needs a second, non-hierarchical grouping** — a tag or a group, deliberately
  separate from the tree so neither corrupts the other. Not decided here; raised as the open
  question below.
- **Contacts belong to the settlement point.** The current model gets this right _by accident_,
  because each clone is an organization and `organizations.contacts[]` is embedded. **A migration
  that pools contacts onto the customer destroys a working property to fix a broken one** — and
  reproduces exactly the failure Xero users report, where reminders go to every address on the
  record rather than the one the invoice went to.
- **Credit limits and credit holds attach to the customer, never to a project or department.** That
  follows from liability: a department cannot be extended credit independently of the entity that
  would be sued for it. Conversely a hold applies to every project beneath.
- **Degenerate shapes must be legal, not special-cased.** A customer with exactly one project, and a
  project with exactly one settlement point, are the general shape with N=1 — most of the corpus.
  The model must not force an artificial project record onto `Sound Off Films`.
- **The migration is a RE-KEYING, not a re-dimensioning**, and it is the largest delta found so far.
  ADR-0020 governs restating dimensions; this changes identity.
  - The mapping from ten Netflix records to one customer + N projects + M settlement points must be
    **authored and committed**, not parsed. ADR-0009 fences foreign ids out of domain models; the
    four delimiter conventions make a parse unreliable; `Transportation`/`Transpo` needs a human.
  - **Match-on-name is not a viable key** independently: `Sound Off Films` occurs three times.
  - ⚠️ **AR balances must not move.** The consolidated customer balance must be proven equal to the
    sum of its settlement points, per invoice and per settlement — the same assertion ADR-0020 makes
    about amounts, on a different axis. Xero's warning about the duplicate-contact route is
    precisely that it double-counts, so this is a measured hazard rather than a theoretical one.
- ⚠️ **Two migrations now cross the same closed periods, and HOT-006 covers only one of them.**
  HOT-006 asked "import defective lines or restate?" and ADR-0020 answered it — on the **line
  dimension** axis. This ADR re-keys **document identity** on the same corpus, and ~90% of it sits
  behind the 2025-12-31 lock. The two are orthogonal in what they touch and identical in what they
  promise: ADR-0020 says the restatement must not alter any amount, this says AR balances must not
  move. **Neither assertion can be verified while the other is in flight**, so they need a stated
  order and each needs its own before/after proof. Not a contradiction, and not covered by HOT-006 —
  a sequencing obligation this ADR creates and m6 has to carry.
- **This unblocks OQ-035.** Production type attaches to the project, and the value-set measurement
  needs a stable key to group by — impossible today, when `20th Television` is spread across six
  records.
- ⚠️ **`contexts/ordering/entities/order.yaml` contradicts this and must change with it.** It
  carries `organization_ref: { type: organization_id, required: true }` — a single flat reference
  written under the pre-tree model. Under this ADR a document is addressed to a **settlement point**
  and its customer is derived by walking up, so the reference changes meaning as well as target. The
  same applies to `invoices.organization`. Not edited yet: this ADR is `proposed`, and rewriting
  entity files on the strength of an unaccepted decision is how a spec ends up describing a system
  nobody agreed to. **It becomes required work the moment this is accepted**, and it is recorded in
  `migration/field-map.yaml`.
- **Both roll-ups must be independently computable, and neither may be the other's oracle.** The
  consolidated customer balance and the per-settlement-point aging are the same money read two ways,
  so the natural implementation derives one from the other — and then a bug in the tree walk is
  invisible, because the check agrees with itself. This repo's standing rule applies: pair the
  fixed-point check with a property that holds independently. The independent property here is that
  the sum of settlement-point balances equals the sum of open invoice amounts addressed to them,
  computed without traversing the tree at all.

## Open question this leaves

**Does CFS want an economic grouping alongside the liability tree, and what is it keyed on?** The
liability tree deliberately splits `Pops, Puffs, Pebbles` into two customers and detaches every
single-purpose LLC from the studio behind it. That is correct for credit and collection. It is wrong
for "which studios do we actually depend on", which is a real management question and the one GAAP's
common-control test is aimed at.

Deliberately **not** decided here, because the mechanism differs by answer — a many-to-one tag, a
second tree, or a report-time grouping — and because it must not be allowed to contaminate the
liability tree, which is the thing collections depends on being exactly right.
