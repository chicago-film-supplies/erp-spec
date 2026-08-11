---
kind: decision
title: Interview — the tree's root keeps the name `organization`, contacts are one person with N memberships, all three levels are mandatory and auto-minted, and OQ-037 collapses into OQ-035
contexts: [billing, ordering, ledger, tax]
source: repo owner, 2026-08-10 interview session, against ADR-0032 (proposed), OQ-035, OQ-036, OQ-037, HOT-006, glossary.yaml, migration/field-map.yaml; plus api:2026-08-10:db_contacts_query (165 contacts), api:2026-08-10:db_organizations_count (tax_profile), api:2026-08-10:db_schema (contacts, organizations, destinations)
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Seventeen decisions taken in one session, reviewing everything in the repo that touches the proposed
customer tree. ADR-0032 is `proposed` and therefore editable; nothing here has been written into it
yet.

## 0. The root node keeps the name `organization`

> **Owner:** "customer is organization, customer is too easily confused with contact for use."

`customer` is retired as the term for the root. The three levels are
**organization → project → settlement point**.

- Reverses the `glossary.yaml` entry for `customer`, whose note currently reads
  "⚠️ **Not a synonym for `organization`**". It now *is* the term.
- ⚠️ **The hazard this creates.** The v1 collection is already called `organizations`, so the name
  survives the migration unchanged while its **meaning narrows** — from a flat record conflating
  company + production + department into the legal-entity root alone. A field that keeps its name
  and changes its semantics is invisible in a migration diff. This is the same class of defect as
  the workspace rule **"rename, never retype in place"**, arriving from the opposite direction: here
  the rename is what is *missing*, so no named reader becomes a compile error.

## 1. A contact is one person with N memberships

> **Owner:** selected "One person, N memberships" over per-node contact records.

The person is global. The **membership edge** — person → node, carrying a role — is what belongs to
the settlement point. A statement or reminder addresses the edge, never the person, so a statement
for `Saturn Return: Locations` walks that node's memberships only.

**This resolves an apparent conflict rather than creating one.** OQ-008 already decided "the same
human is one record whether they are crew or a customer contact". Per-node contact records would
have contradicted it; memberships satisfy both.

### ⚠️ Correction: ADR-0032 and `migration/field-map.yaml` describe a model v1 does not have

Both say contacts are embedded — ADR-0032: "the current model gets this right _by accident_, because
each clone is an organization and `organizations.contacts[]` is embedded"; field-map:
`organizations.contacts[] → settlement_point.contacts[]`.

**Contacts are already first-class and already many-to-many.** `contacts` is a top-level collection
and each contact carries `organizations[]` (`api:2026-08-10:db_schema:contacts`).
`organizations.contacts[]` is the **reverse denorm**, not the authority.

The *placement* claim survives — the edge does land on the settling unit today. The *mechanism*
claim does not, and it matters: an embedded model would have made 26 people fragment on migration.

**Measured 2026-08-10** (`api:2026-08-10:db_contacts_query`, all 165 contacts):

| Fact                                 | Count                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| Contacts total                       | **165**                                                |
| On **2 or more** organizations       | **26 (15.8%)**                                         |
| On **5 or more**                     | 5 — Kristi Gescheidler 7, Erik Goserud 6, Yajaira Marie Quinto 6, Nick Rafferty 5, Patrick Richter 5 |
| On **zero** organizations            | 5                                                      |

The load-bearing example: **Nick Rafferty** is attached to `Netflix Productions, LLC - Locations`,
`Netflix Productions, LLC / Saturn Return: Locations`, `Enemies Movie, LLC - Locations`,
`Master Key Studios, Inc` and `Very Rare Productions` — two settlement points under one future
organization, plus a separate legal entity. A freelance locations manager is the norm in this
industry, not an edge case, and per-node contact records would have produced five copies of them.

## 2. Three levels, always — and the API mints what it is not given

> **Owner:** "can this be a progressive enhancement thing? or is it better to schema and db strict
> and consistent, then do some api/ui work for noise suppression … add project optional (if api
> doesnt get a project it mints project_default)". Then selected "Both mint — always exactly 3
> nodes".

**Strict in the schema, minted at the API, suppressed in the UI.** An optional level puts a branch
in every reader — the AR roll-up, the statement walk, the migration mapping, the reporting layer and
the UI. A mandatory level puts the degenerate case in exactly one place: the minting rule. This is
the repo's standing preference for **making a defect class unrepresentable over policing it**, and
it is what makes ADR-0032's "degenerate shapes must be legal, not special-cased" true in code rather
than only in prose.

Three conditions, two of them carried from rules already in force:

- **The minted project is NOT the settlement point.** Collapsing them removes the ability to add a
  second department later without a re-key — the exact defect being migrated away from. Enemies is
  `Enemies Movie, LLC` → project `Enemies` → settlement point `(default)`: three nodes, two derived.
- **One server-side writer, and the derived node records what it derived from** — OQ-035's snapshot
  rule, so a later realignment can find the population when someone names the real production.
- **A derived node is the same record type as a typed one**, distinguished only by provenance. A
  different kind of record is the optional level again, with extra steps.

**The 5 bare Netflix department records** (Locations, Office, SFX, Set Dec, Transportation) are not
a shape to support. Owner: "i can provide the project names" — they are resolved by hand in the
authored mapping.

## 3. Documents: header-only now, but the reference is level-tagged

> **Owner:** "this seems like a nice to have, but not if it adds complexity … if it's not a real
> complicator then we do it now, if it is, we let it possible need in the future inform architecture
> today." Then selected "Header-only now, level-tagged ref".

**Item-level payer determination is a real complicator, and it was assessed as one.** ADR-0032's own
independent AR check — "the sum of settlement-point balances equals the sum of open invoice amounts
addressed to them, **computed without traversing the tree at all**" — holds only while a document
has exactly one addressee. Item-level splitting turns that tree-free sum into a line-level walk, and
the check is the repo's required companion to the fixed-point one.

So: every order and every invoice addresses exactly one node, and the reference **records which
level it names**:

```
billed_to: { level: settlement_point, id: … }
```

Both future moves become additive value changes rather than an identity migration: `level: project`
gives project-level orders, and an optional `items[].billed_to` gives the SAP override. Cost today
is one enum on a reference.

## 4. Unallocated credit sits at the settlement point; crossing nodes is a recorded event

> **Owner:** selected "Held at settlement point, cross-node allocation is a recorded fact".

`2050 Customer Credit Balances` is `organization`-scoped today
(`ledger/chart-of-accounts.yaml:449`, `ledger/posting-rules.yaml:328`, OQ-030). Under the tree it
sits at the **leaf**, symmetric with AR: a credit is negative receivable and partitions the same way
the receivable does.

Applying `Saturn Return: Locations`' overpayment to `Saturn Return: Office`'s invoice is legal, but
it is an **explicit recorded event** with an actor and a reason, and it appears on the origin node's
statement. Consistent with ADR-0029 — the ledger records unallocated facts rather than inferring
them. The rejected alternative (one customer-level pool, auto-applied to the oldest open invoice
beneath) lets one department's debt silently absorb another's money, which is the same complaint
that produced the whole requirement: *locations doesn't want to see what office owes.*

## 5. `tax_profile` splits — exemption is the party's, jurisdiction is the destination's

> **Owner:** selected "Split it — exemption on the customer, rate by destination".

`migration/field-map.yaml` maps `organizations.tax_profile` **up** to the root on the grounds that
"tax status is a property of the party that owes". That is true of two of the five enum values and
false of three.

**Measured 2026-08-10** (`api:2026-08-10:db_organizations_count`, five queries):

| value           | orgs    |
| --------------- | ------- |
| `tax_applied`   | **273** |
| `tax_exempt`    | **11**  |
| `tax_rantoul`   | **1**   |
| `tax_frankfort` | **1**   |
| `tax_paxton`    | **0**   |

`tax_rantoul` / `tax_frankfort` / `tax_paxton` are Illinois municipalities — they describe **where it
was delivered**, not who owes. They cease to be attributes of the root and become jurisdiction
derived from the destination address. Exemption (with its certificate) stays on the organization.

Two live v1 issues are on the same seam and should be read with this: **api-cloudrun#486** (nothing
on the order path reads the org's `tax_profile`, so every exempt customer gets taxed at cutover) and
**manager#248** (order-level `tax_profile` selector).

## 6. Destinations attach to the organization

> **Owner:** selected "To the customer, usable by any node beneath".

`destinations` is a separate many-to-many collection linked to `organizations`, carrying its **own**
`contacts[]` (`api:2026-08-10:db_schema:destinations`). It appears nowhere in ADR-0032 or the field
map — a gap this session found rather than a decision it revisited.

One address book per legal entity, reusable by every project and settlement point beneath. A
studio's recurring stages are not re-entered per production.

## 7. A project carries wrap dates as facts; its state is derived

> **Owner:** selected "Both — dates recorded, state derived".

The glossary says a project "has a start and an end" and nothing said what ends one. Now: production
start and wrap are **recorded facts** — useful to OQ-035's production-type analysis, which needs
duration as a discriminator. `ACTIVE` / `DORMANT` is **derived** from open orders and open AR, per
ADR-0014. There is no close button, and open AR keeps a node alive regardless of its wrap date.

## 8. Credit limits and holds are aspirational — say so

> **Owner:** selected "Aspirational — no limits today, want them in v2".

ADR-0032 currently asserts that "credit limits and credit holds attach to the customer, never to a
project or department" and that "a hold applies to every project beneath". **There is no incumbent
behaviour behind either sentence.** The ADR should claim only that credit exposure is **readable**
at the organization — which is the real gain from adding a root, and the thing the flat table cannot
do.

Limits and holds need their own open question and their own six-reference survey: what triggers a
hold, who overrides one, and what a held organization can still do.

## 9. OQ-037 collapses into OQ-035 and should be closed

> **Owner:** "Enemies is backed by A24, A24 has no legal libaility, enemies hodls its own insurance
> etc.. but from a financial reporting angle its a high budget feature." Then selected "Collapse it".

OQ-037 asked whether CFS wants an **economic** grouping alongside the liability tree — "which
studios do we actually depend on" — motivated by ASC 280-10-50-42, which defines one customer by
**common control**.

The A24 case defeats the premise. A24 carries no liability for Enemies *and does not control it* —
Enemies holds its own insurance and stands alone. So the studio behind a single-purpose LLC is not
an economic parent under ASC 280's own test either. The liability tree and the common-control
grouping do not diverge here, because there is nothing to group to.

**What the owner actually named as the reporting fact was "a high budget feature"** — which is
OQ-035's production type, attached to the project. Revenue by production type answers the question
that "which studios do we depend on" was a bad proxy for.

**Close OQ-037.** No second tree, no backer tag, no A24 node, and nothing that could contaminate the
liability tree. This also retires the sizing exercise's leftover: the ~45–50 single-purpose LLC
count was a name-pattern heuristic that was never evidence of anything, and it is no longer needed.

⚠️ **OQ-035's value set is now unblocked** and is the only thing standing between this and the
reporting question. Its measurement was blocked on OQ-036 "because grouping by customer today
measures the naming convention" — OQ-036 is answered, so the grouping key exists.

## 10. Migration: restate first, then re-key; duplicates die in the mapping

> **Owner:** selected "ADR-0020 restatement first, then the re-key", and "Resolve inside the
> authored mapping".

**Sequencing.** ADR-0032 flagged that its re-keying and ADR-0020's restatement cross the same closed
periods, that "neither assertion can be verified while the other is in flight", and that HOT-006
does not cover it — and nothing tracked the obligation. The order is now fixed:

1. **Restate dimensions** (ADR-0020) → prove no amount moved, against the familiar flat identity.
2. **Re-key identity** (ADR-0032) → prove no AR balance moved, against settled dimensions.

Each proof runs with exactly one moving part. The rejected single-pass alternative produces one
before/after report that names no culprit when it goes red.

**Duplicates.** Two source rows pointing at one target node is precisely what an authored mapping
expresses, so they are resolved there — no v1 merge tool, no live merges, and no exposure to the
`api-cloudrun#423` org/contact cascade deadlock. v1 is left untouched.

Duplicate populations to carry into the mapping, **including four organization pairs not previously
recorded** (surfaced by reading contact→organization edges, 2026-08-10):

- Previously known: 5 exact-duplicate name pairs, 3 records suffixed `(copy)`, `20th Television` vs
  `Twentieth Television`, `Sound Off Films` ×3.
- **New this session:** `Omnicom` ×2 (`ny7yRgfTh5tFBT7nouzu`, `YOgvPOYnUN4J18XgRilT`),
  `Enlace Chicago` ×2 (`K85dVseZECgedhFa75ln`, `hCdYsTi9NDWxq4ufvHhV`), `Free Spirit Media` ×2
  (`CTFP195QqkTtEl4kyfc2`, `AxDwNH8IFZEKJJrMqjQc`), `Sound Off Films` ×2 confirmed by uid
  (`MCh8UuepH05BGR3FDCEf`, `04KRDdsiQO6yXI6GXX7N`).
- **Duplicate humans in `contacts`, ≥8:** Katie Kincaid ×3; Kristi Gescheidler, Erik Goserud, Kevin
  McGrail, Iman Sharabash, Rob Roediger, Kyle Behling, Angie Gaffney ×2 each. In several pairs one
  copy holds every membership and the other holds none — Erik Goserud `GSEa…` has 6 and `wXBH…` has
  0; Kevin McGrail `U57Y…` has 2 and `Y4Up…` has 0.

## 11. Where these land

> **Owner:** selected "0032 amended; documents + credits get their own ADR".

- **ADR-0032, amended in place** (it is `proposed`, so this is permitted): the rename to
  `organization`, the three mandatory levels, auto-mint with provenance, contacts as memberships,
  destinations at the root, project dates + derived state, and the retraction of the credit-limit
  claim to "exposure is readable".
- **A new ADR — AR and credit addressing**: unallocated credit at the settlement point, the
  cross-node transfer event, and the level-tagged `billed_to`. It touches
  `ledger/posting-rules.yaml` and the `2050` account definition, so it **requires the six-reference
  survey** before a recommendation (CLAUDE.md → _Accounting decisions_) and cannot simply be
  written up from this session.
