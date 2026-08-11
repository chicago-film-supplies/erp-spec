---
id: ADR-0032
title: The organization tree is a liability tree; projects and settlement points are addressing beneath it
status: proposed
date: 2026-08-10
review_by: 2026-11-15
deciders: [repo owner]
contexts: [billing, ordering, ledger, tax]
relates_to: [ADR-0009, ADR-0014, ADR-0020, ADR-0033, OQ-035, OQ-036, OQ-038, OQ-039, HOT-006]
supersedes:
superseded_by:
---

> **In the context of** a customer master where 31 of 286 organizations are department clones and
> `Netflix Productions, LLC` is ten flat records with no parent, **facing** a requirement that
> invoices settle per department while credit exposure is a question about a company, **we decided**
> that the **organization** node is the legal entity and that projects and settlement points are
> addressing beneath it, **to achieve** a receivable that can be read both per department and per
> liable party, **accepting** that a separately-incorporated production is a separate organization
> and that the tree therefore cannot answer economic-concentration questions on its own.

**Amended 2026-08-10** after an owner interview reviewing every OQ, hotspot and ADR touching this
tree
(`inbox/2026-08-10-interview-the-org-tree-root-stays-organization-and-contacts-are-memberships.md`).
The amendment renames the root, fixes a factual error about how contacts are stored today, makes all
three levels mandatory, adds destinations and project dates, **retracts an unfounded claim about
credit limits**, and **withdraws the economic-concentration objection** that OQ-037 was opened for.
It deliberately decides **nothing** about tax (OQ-039). Permitted because this ADR is `proposed`; the
file name is left at its original slug so that append-only `inbox/` notes citing it do not go dead.

## Context

- **The requirement is real**: invoices settle per department. Owner, 2026-08-10 — "locations
  doesn't want to see what office or wardrobe owes."
- **Projects staff up independently.** The locations team on one production is different people from
  the locations team on another, even for the same studio at the same time. **Every project and
  department has its own set of contacts.** So a settlement point is `(project × department)`,
  subordinate to the project, not `(organization × department)`
  (`inbox/2026-08-10-correction-the-settlement-point-is-project-x-department-not-customer-x-department.md`).
- **Measured 2026-08-10** (`api:2026-08-10:db_organizations_query`, all 286 organizations): 31
  department clones across 11 parent companies; `Netflix Productions, LLC` is **10 records with no
  un-suffixed parent**, so the entity does not exist; four delimiter conventions, all four inside
  Netflix alone; `Transportation` and `Transpo` are one department spelled two ways. Separately, 5
  exact-duplicate name pairs and 3 records suffixed with a literal `(copy)`.
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

### 1. Three levels, and only the root carries liability

| Level                | Is                                                                            | Carries                                                            |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Organization**     | the **legal entity** — the party that owes the money and could be sued for it | credit exposure, trading history, destinations; tax **TBD** (OQ-039) |
| **Project**          | a production                                                                  | the cost object; **production type** (OQ-035); a start and a wrap   |
| **Settlement point** | a department on a project                                                     | its own AR balance, statement, aging, and its own contact edges     |

**The tree is determined by legal liability.** A node sits under a parent only where that parent is
legally liable for the child's debts. Projects and settlement points are internal divisions of the
liable entity — they partition the receivable for addressing and reporting, and they do **not**
change who owes it.

**Both roll-ups are required at every level**: aging per settlement point, and a consolidated
balance per organization. Neither is derived on demand from the other by string matching.

### 2. The root is called `organization`, not `customer`

Owner, 2026-08-10: *"customer is organization, customer is too easily confused with contact for
use."* `customer` is retired as a term. This is an operator-vocabulary decision, not a modelling one
— the level is unchanged.

⚠️ **It creates a silent-diff hazard and the migration must treat it as one.** The v1 collection is
already called `organizations`, so the name survives while its **meaning narrows** — from a flat
record conflating company + production + department into the legal-entity root alone. A field that
keeps its name and changes its semantics is invisible in a diff. This is the workspace's
*rename, never retype in place* rule arriving inverted: here the rename is what is **missing**, so
no named reader becomes a compile error and nothing catches a stale assumption automatically.

### 3. All three levels are mandatory; the API mints what it is not given

**Strict in the schema, minted at the API, suppressed in the UI.** An optional level puts a branch in
every reader — the AR roll-up, the statement walk, the migration mapping, the reporting layer and the
UI. A mandatory level puts the degenerate case in exactly one place: the minting rule. This is the
repo's standing preference for making a defect class unrepresentable over policing it, and it is what
makes "degenerate shapes must be legal, not special-cased" true in code rather than only in prose.

Three conditions:

- **The minted project is NOT the settlement point.** Collapsing them removes the ability to add a
  second department later without a re-key — the exact defect being migrated away from. Enemies is
  `Enemies Movie, LLC` → project `Enemies` → settlement point `(default)`: three nodes, two derived.
- **One server-side writer, and a derived node records what it derived from.** OQ-035's snapshot
  rule, so a later realignment can find the population when someone names the real production.
- **A derived node is the same record type as a typed one**, distinguished only by provenance. A
  different kind of record is the optional level again, with extra steps.

### 4. A contact is one person with N memberships

The person is global. The **membership edge** — person → node, carrying a role — is what belongs to
the settlement point. A statement or reminder addresses the edge, never the person.

This is consistent with OQ-008's "the same human is one record whether they are crew or a customer
contact". Per-node contact records would have contradicted it.

### 5. Destinations attach to the organization

One address book per legal entity, usable by every project and settlement point beneath. A studio's
recurring stages are not re-entered per production.

### 6. A project carries wrap dates as facts; its state is derived

Production start and wrap are **recorded facts** — OQ-035's production-type analysis needs duration
as a discriminator. `ACTIVE` / `DORMANT` is **derived** from open orders and open AR, per ADR-0014.
There is no close operation, and open AR keeps a node alive regardless of its wrap date.

### 7. Where tax attaches is NOT decided here

The level table above lists tax exemption against the organization because that is where the current
`organizations.tax_profile` field sits, **not because this ADR has decided it belongs there**. See
the consequence below: the field is doing two jobs and untangling it is OQ-039.

## Considered options

- **Keep the flat clone table.** Rejected: it is the status quo, it has no root, and it makes credit
  exposure a string-matching exercise across ten records.
- **One organization, departments as settlement points, no project level.** Rejected on the owner's
  measurement: departments are staffed per project, so `Saturn Return: Locations` and
  `Big Red: Locations` are different settling units. Without the project level they collide.
- **An optional project level** (a "progressive enhancement"). Rejected in the 2026-08-10 interview
  in favour of §3 above — the branch it saves at write time is paid for at every read.
- **A commercial-relationship tree** — group by "who this really is" (all Netflix-adjacent entities
  under Netflix). Rejected as the _tree_. It was carried as an open question (OQ-037) and has since
  been **closed**: see the consequences below.
- **A liability tree** (chosen).

## Consequences

- ⚠️ **A separately-incorporated production is its OWN organization, not a child.** This is the direct
  consequence of choosing liability, and it is the one that will surprise.
  `Pops, Puffs, Pebbles Canada LTD` and `Pops, Puffs, Pebbles, LLC` are one production and two legal
  entities, so they are **two organizations** — and the single-purpose production LLCs
  (`Enemies Movie, LLC`, `Whale Shark Movie LLC`, `GODSHOT MOVIE LLC`, `Freaky Monday LLC`,
  `First Snow LLC`) are roots with no parent, however obvious the studio behind them.
- **The economic-concentration objection is withdrawn, and OQ-037 is closed.** The original text of
  this ADR raised the worry that the liability tree cannot answer "which studios do we actually
  depend on", because ASC 280-10-50-42 defines one customer by **common control**. The worked case
  defeats the premise: A24 backs `Enemies Movie, LLC`, but A24 carries no liability for it *and does
  not control it* — Enemies holds its own insurance and stands alone (owner, 2026-08-10). So the
  studio behind a single-purpose LLC is not an economic parent under ASC 280's own test either, and
  the two roll-ups do not diverge. **What the owner wants from that question — "from a financial
  reporting angle it's a high budget feature" — is OQ-035's production type on the project.** No
  second tree, no tag, and nothing that can contaminate the liability tree.
- ⚠️ **Contact membership edges belong to the settlement point, and the reason given in the first
  draft was factually wrong.** That draft said contacts are right "by accident, because each clone is
  an organization and `organizations.contacts[]` is embedded." **Contacts are not embedded.**
  `contacts` is a top-level collection and each contact carries `organizations[]` — an explicit
  many-to-many (`api:2026-08-10:db_schema:contacts`). `organizations.contacts[]` is the reverse
  denorm, not the authority. The placement claim survives; the mechanism claim does not, and it
  matters: **26 of 165 contacts (15.8%) are attached to two or more organizations**
  (`api:2026-08-10:db_contacts_query`), so a per-node contact model would have fragmented them.
  `Nick Rafferty` is on five — two future Netflix settlement points, `Enemies Movie, LLC`, and two
  unrelated entities. A freelance locations manager is the norm in this industry, not an edge case.
  A migration that pools edges onto the organization still reproduces the failure Xero users report
  of contact groups: reminders going to every address on the record rather than the one the invoice
  went to.
- ⚠️ **Credit LIMITS and HOLDS are not decided here, and the first draft overreached.** That draft
  asserted that "credit limits and credit holds attach to the customer, never to a project or
  department" and that "a hold applies to every project beneath". **There is no incumbent behaviour
  behind either sentence** — CFS operates no credit limits today (owner, 2026-08-10). This ADR
  therefore claims only that **credit exposure is READABLE at the organization**, which is the real
  gain from adding a root and the thing the flat table cannot do. Limits, holds, triggers and
  overrides are **OQ-038**, and need their own six-reference survey.
- ⚠️ **`tax_profile` is carrying two different concepts, and this ADR deliberately does NOT resolve
  it — OQ-039.** Measured 2026-08-11 (`api:2026-08-11:db_organizations_count`, five queries): of 286
  organizations, **273 `tax_applied`, 11 `tax_exempt`, 1 `tax_rantoul`, 1 `tax_frankfort`, 0
  `tax_paxton`**. Two enum members describe **who owes** (applied / exempt) and three name Illinois
  municipalities, which describe **where the goods went**. Under a three-level tree those two answers
  would attach at different places — but tax has substantial unresolved design ahead of it (ADR-0026's
  dual-basis book, the `tax` context, `api-cloudrun#486`, `manager#248`), and settling an attachment
  point as a side effect of a customer-structure ADR is the wrong order. **The field maps forward
  unchanged and unsplit until OQ-039 is answered**; `migration/field-map.yaml` records it as blocked
  rather than mapped.
- **AR addressing and unallocated credit are ADR-0033's, not this ADR's.** Where a document's
  `billed_to` points, at what level, and where an unallocated credit sits are decided there — they
  touch `ledger/posting-rules.yaml` and the 2050 account, so they required their own survey
  (`inbox/2026-08-11-survey-unallocated-credit-sits-with-the-legal-party-and-crossing-departments-is-a-management-control.md`).
- **Degenerate shapes are the general shape with N=1** — and §3 makes that operational rather than
  aspirational. The model must not force an operator to invent a project for `Sound Off Films`; the
  API invents it, records that it did, and the UI hides it.
- **The migration is a RE-KEYING, not a re-dimensioning**, and it is the largest delta found so far.
  ADR-0020 governs restating dimensions; this changes identity.
  - The mapping from ten Netflix records to one organization + N projects + M settlement points must
    be **authored and committed**, not parsed. ADR-0009 fences foreign ids out of domain models; the
    four delimiter conventions make a parse unreliable; `Transportation`/`Transpo` needs a human.
  - **Match-on-name is not a viable key** independently: `Sound Off Films` occurs three times.
  - **Duplicate identities are resolved inside the authored mapping**, not by merging in v1 (owner,
    2026-08-10). Two source rows pointing at one target node is exactly what an authored mapping
    expresses; it needs no v1 merge tool and takes no exposure to the `api-cloudrun#423` org/contact
    cascade deadlock. Populations to carry: 5 exact-duplicate name pairs, 3 `(copy)` records,
    `20th Television` / `Twentieth Television`, and — found 2026-08-10 by reading contact→organization
    edges — `Omnicom` ×2, `Enlace Chicago` ×2, `Free Spirit Media` ×2, `Sound Off Films` ×2 by uid,
    plus **≥8 duplicated humans in `contacts`** (Katie Kincaid ×3; Kristi Gescheidler, Erik Goserud,
    Kevin McGrail, Iman Sharabash, Rob Roediger, Kyle Behling, Angie Gaffney ×2 each), several of
    which are a fully-populated record beside an empty twin.
  - ⚠️ **AR balances must not move.** The consolidated organization balance must be proven equal to
    the sum of its settlement points, per invoice and per settlement — the same assertion ADR-0020
    makes about amounts, on a different axis. Xero's warning about the duplicate-contact route is
    precisely that it double-counts, so this is a measured hazard rather than a theoretical one.
- **The sequence against ADR-0020 is now fixed: RESTATE FIRST, then re-key.** The first draft flagged
  that both migrations cross the same closed periods, that "neither assertion can be verified while
  the other is in flight", and that HOT-006 covers only one of them — but left the order open.
  Owner, 2026-08-10:
  1. **Restate dimensions** (ADR-0020) → prove no amount moved, against the familiar flat identity.
  2. **Re-key identity** (this ADR) → prove no AR balance moved, against settled dimensions.

  Each proof runs with exactly one moving part. The rejected single-pass alternative produces one
  before/after report that names no culprit when it goes red. This obligation is carried by
  `roadmap/milestones.yaml` → m6.
- **This unblocks OQ-035 twice over.** Production type attaches to the project, and the value-set
  measurement needs a stable key to group by — impossible today, when `20th Television` is spread
  across six records. With OQ-037 closed, that measurement is also the only thing standing between
  the spec and the reporting question OQ-037 was a bad proxy for.
- ⚠️ **`contexts/ordering/entities/order.yaml`, `contexts/ordering/events.yaml` and
  `contexts/billing/events.yaml` all carry `organization_ref` under the pre-tree meaning and must
  change with this.** Under this ADR a document is addressed to a **settlement point** and its
  organization is derived by walking up, so the reference changes meaning as well as target. The same
  applies to `invoices.organization`. Recorded in `migration/field-map.yaml`; the shape of the
  replacement reference is ADR-0033's.
- **Both roll-ups must be independently computable, and neither may be the other's oracle.** The
  consolidated organization balance and the per-settlement-point aging are the same money read two
  ways, so the natural implementation derives one from the other — and then a bug in the tree walk is
  invisible, because the check agrees with itself. This repo's standing rule applies: pair the
  fixed-point check with a property that holds independently. **The independent property here is that
  the sum of settlement-point balances equals the sum of open invoice amounts addressed to them,
  computed without traversing the tree at all** — and it is the reason ADR-0033 keeps document
  addressing at the header.
