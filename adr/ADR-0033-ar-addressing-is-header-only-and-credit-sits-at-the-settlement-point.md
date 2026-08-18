---
id: ADR-0033
title: A document is addressed to exactly one node by a level-tagged reference, and unallocated credit sits at the settlement point
status: proposed
date: 2026-08-11
review_by: 2026-11-15
deciders: [repo owner]
contexts: [billing, ledger]
relates_to: [ADR-0014, ADR-0022, ADR-0029, ADR-0032, OQ-030, OQ-038, OQ-040]
accounting_shaped: true
survey:
  - inbox/2026-08-11-survey-unallocated-credit-sits-with-the-legal-party-and-crossing-departments-is-a-management-control.md
supersedes:
superseded_by:
---

> **In the context of** ADR-0032's three-level organization tree, **facing** a receivable that must
> be readable per department and per liable party at once, **we decided** that every order and
> invoice is addressed to exactly one node through a reference that records which level it names,
> and that unallocated credit sits at the settlement point with cross-node application recorded as
> an explicit event, **to achieve** an AR partition that holds structurally rather than by
> computation, **accepting** that a single delivery serving two departments is two documents until
> someone asks for otherwise.

## Context

- ADR-0032 established organization → project → settlement point, all three mandatory. It
  deliberately left **what a document points at** and **where credit sits** undecided, because both
  touch `ledger/posting-rules.yaml` and the `2050` account and therefore require the six-reference
  survey.
- **Surveyed 2026-08-11 against all six references**
  (`inbox/2026-08-11-survey-unallocated-credit-sits-with-the-legal-party-and-crossing-departments-is-a-management-control.md`).
- **The criterion the survey found: every reference draws its line at the LEGAL PARTY**, and they
  differ only on whether a sub-node bears its own balance. Where nodes are modelled as _separate
  customers_ (Xero contacts, Sage Intacct parent/child) credit cannot cross, because the system
  cannot prove they are one party. Where nodes are _internal divisions of one party_ (SAP head
  office/branch, Odoo's commercial entity) crossing is native and needs no ceremony.
- **ASC 210-20-45-1** makes that a rule rather than a convention: setoff is permitted "only when
  [the amounts] represent amounts due to and from the same party", and an entity cannot offset
  across different counterparties. ADR-0032 defines a settlement point as an internal division of
  one legal entity, so **GAAP permits credit to cross settlement points freely and forbids it
  crossing organizations** — an exact mapping, not an approximate one.
- **The references split on placement, so this is a real choice.** SAP holds the balance at the leaf
  (items post to the branch; a payment at the head office clears the branch's line items). Odoo
  pushes it to the root (`commercial_partner_id` bears the AR; child contacts are addressing only).
- **Sage Intacct draws the sharpest line, and it is between two different questions.** Credit: "you
  cannot apply credits from one customer to the invoices of another customer, **even if they are in
  a parent-child relationship**." Payment: a single payment may cover one customer, parent and
  child, **or unrelated multiple customers**. A credit is value pinned to the party that earned it;
  a payment is money arriving that may settle anything.
- **On header vs item addressing, five of six are header-only.** Only SAP determines partners per
  document at header _and_ item level.

## Decision

### 1. A document is addressed to exactly one node, by a level-tagged reference

Every order and every invoice carries a single `billed_to` that records **which level it names**:

```
billed_to: { level: settlement_point | project | organization, id: … }
```

Today the only value written is `level: settlement_point`. The tag exists so that the two plausible
future moves are **additive value changes rather than an identity migration**: `level: project`
yields project-level ordering, and an optional `items[].billed_to` yields SAP's item-level override.

### 2. Item-level payer determination is deferred, and the reason is a named invariant

ADR-0032 requires that the per-settlement-point aging be checkable by a property that **holds
independently of the tree**: the sum of settlement-point balances equals the sum of open invoice
amounts addressed to them, _computed without traversing the tree at all_.

**That property holds only while a document has exactly one addressee.** Item-level splitting turns
a one-hop sum into a line-level walk, and the walk shares its logic with the roll-up it is supposed
to check — which is exactly the "guard that can only consult its own oracle" this repo forbids.

Deferring it costs a single delivery serving two departments being two documents. Five of six
references already work that way.

### 3. Unallocated credit sits at the settlement point

A credit is negative receivable and partitions the same way the receivable does. Holding the balance
at the leaf is what makes the per-department aging the owner asked for computable in one hop, and it
follows SAP rather than Odoo — a choice the survey shows is genuinely open.

This narrows OQ-030's answer rather than reversing it: `2050 Customer Credit Balances` remains the
account, and the fact it records is unchanged. What changes is the node the fact is attached to,
from the pre-tree flat `organization` to the settlement point.

### 4. Credit may be applied across settlement points within one organization, and that crossing is a recorded event

Applying `Saturn Return: Locations`' overpayment to `Saturn Return: Office`'s invoice is legal. It
is recorded as an explicit event carrying an actor and a reason, and it appears on the **origin**
node's statement.

⚠️ **This is a MANAGEMENT control, not an accounting constraint, and the distinction is
load-bearing.** Nothing in GAAP requires it — there is one counterparty, so no setoff question
arises — and SAP, NetSuite and Odoo all cross internal nodes without ceremony. Its justification is
the owner's own requirement, _locations doesn't want to see what office owes_, and the inverse of
it: Locations must be able to see where its overpayment went. Recorded as an accounting requirement
this clause would be false; recorded as a deliberate control it is defensible and cheap.

### 5. Credit may never be applied across organizations

Forbidden, with no override. This is the GAAP boundary from ASC 210-20-45-1 and the one line all six
references agree on. Moving value between two legal entities requires a refund out and a payment in
— two real economic events, not an allocation.

## Considered options

- **Credit at the organization, auto-applied to the oldest open invoice beneath.** Rejected: one
  department's debt silently absorbs another's money, and the origin node's statement cannot explain
  where it went. That is the complaint that generated the whole requirement.
- **Credit at the settlement point, never crossing** (Sage Intacct's rule applied one level down).
  Rejected as needless friction: refund-and-repay to move value inside one legal entity is ceremony
  GAAP does not ask for, and four references cross internal nodes natively.
- **Item-level payer determination now** (SAP's shape). Rejected on §2 — it breaks ADR-0032's
  independent AR check on day one, and the level-tagged reference keeps it cheap to add later.
- **A plain `settlement_point_id`** with no level tag. Rejected: it saves one enum today and costs a
  backfill of every order and invoice the first time a project-level document is wanted.

## Consequences

- **The AR partition is structural, not computed.** "Which settlement points owe what" is a group-by
  on one field. This is the property §2 protects and the reason item-level addressing is deferred
  rather than merely unbuilt.
- **`billed_to` needs a resolver, and the resolver is the only tree-walk on the read path.** A
  document names one node; its organization is found by walking up. The consolidated balance is that
  walk, and the independent check is the group-by that does not walk — the two must be computed by
  different code or the check is vacuous.
- **A new event: credit applied across settlement points.** It belongs to billing, carries actor and
  reason, and must appear on the origin node's statement as well as the destination's. It is the
  first event in the spec whose justification is explicitly managerial rather than accounting, and
  the ADR says so on purpose.
- ⚠️ **The cross-node event has ZERO historical population, measured.** All 13 credit notes and all
  9 allocation rows in prod were read on 2026-08-11 (`api:2026-08-11:search_credit_notes`,
  `get_credit_notes_uid_allocations`). 8 of 9 allocations name the same organization as their credit
  note. The one that crosses — CN-1024, whose allocation names `AxDwNH8IFZEKJJrMqjQc` while its
  indexed organization is `CTFP195QqkTtEl4kyfc2` — crosses the **two duplicate `Free Spirit Media`
  records**, which ADR-0032's authored mapping collapses into one organization. **So the migration
  delta is nil: this machinery is for the future shape, not for history.** Same outcome as the
  2026-08-09 credit-note survey, reached independently.
  - Caveat stated rather than hidden: there is no `db_credit_notes_*` tool and `credit-notes` is
    absent from `db_schema`'s enum, so only the Typesense projection could be read. The allocation
    row and the settled invoice (#1981) both say `AxDw…`; the index says `CTFP…`. Either it is a
    genuine cross-organization allocation or the note's indexed organization is stale — **both
    readings resolve the same way**, but the record should be inspected when the mapping is
    authored.
- **Two `applied` credit notes have no allocation row at all** — `MKeNqa5Xc9yfQj5jqqbT` (CN-1016,
  `Yellow Film LLC`) and `zFXSXP1jLdtfyO9nVpYl` (CN-1013, `Juniper Productions`). This names the
  population in `api-cloudrun#469`, which the issue left unidentified. A v1 defect, not a v2 design
  input, but the migration must not import them as settled.
- **Payments are NOT constrained the way credits are, and that asymmetry is deliberate.** Sage
  Intacct permits a single payment across unrelated customers while forbidding credit to cross
  parent and child, and the reasoning transfers: money arriving may settle whatever it was sent for,
  whereas a credit is value pinned to the party that earned it. A payment covering several
  settlement points — a production office paying every department's invoice at once — must be
  expressible. **Payment-side addressing is not decided here**; it is named so that a future reader
  does not infer it from §5.
- **`ledger/posting-rules.yaml` and the `2050` account definition both need editing** — the
  credit-note and settlement rules currently say "organization" where they now mean settlement
  point.
- **Credit limits and holds remain undecided** and are OQ-038. ADR-0032 claims only that exposure is
  readable at the organization; nothing here adds a control.
