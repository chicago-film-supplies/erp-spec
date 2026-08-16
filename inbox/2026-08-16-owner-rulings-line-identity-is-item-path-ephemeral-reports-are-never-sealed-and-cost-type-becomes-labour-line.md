---
kind: decision-input
title: >-
  Seven owner rulings on the keys-not-classifications design — line identity is `item.path`, an
  aligned invoice path would carry the causal order for free, `sku` is a label and never the key,
  ephemeral BI reports are never sealed, per-product TigerBeetle accounts are set aside as overkill,
  and `cost_type` becomes `labour_line` with a seven-value enum
contexts: [ledger, billing, fulfillment, ordering]
source: "Repo owner, 2026-08-16, in session · workspace CLAUDE.md → Items array invariants · api-cloudrun#485 · api:2026-08-16:db_schema products · ADR-0017, ADR-0029, ADR-0031, ADR-0036"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Seven rulings, taken together, on the shape ADR-0036 proposes. Recorded before ADR-0036 is amended
to cite them.

## 1. Line identity is `item.path` — settled

Not `item.uid`, which identifies the **product** and repeats within one document (18% of prod
orders). `path` is authored by exactly one function, `computeItemPaths`, and is self-inclusive with
`path.at(-1) === item.uid`. It is already the row identity everywhere else in the workspace, so the
ledger inherits an invariant that is enforced at every writer rather than inventing one.

## 2. An aligned invoice path would carry the causal order for free

Owner: "if we align order and invoice paths that could also be used for causal order and free up
some tigerbeetle space."

The hierarchies already differ by exactly the right level: `ORDER_ITEM_LEVELS` is
`[destination, group]`, `INVOICE_ITEM_LEVELS` is `[order, destination, group]`. **An invoice item's
path is the order item's path prefixed by an order divider.** So `path[0]` on an invoice line *is*
the causal order, and one stored key does the work of three — line identity, invoice link and causal
order.

⚠️ **It requires the two paths to actually agree below the order divider, and today 10 do not.**
`api-cloudrun#485` — invoice lines sitting at a different path than their order line, a component
flattened out of its parent subtree. That is the measured obstacle, it is small, and it has to close
before this key can be trusted. **It is exactly the class of defect this design would otherwise
inherit into the ledger permanently**, because a posting keyed on a wrong path is wrong forever.

⚠️ **It does not cover labour.** `shift_recorded` postings key to a `causal_job` (an order) with no
invoice line at all, and the shift's `absorbed_allocations` rows need their own identity — the same
three-transfers-from-one-shift problem HOT-014 found. Line identity generalises; the invoice path
does not.

## 3. `sku` is a human-readable label. `products.uid` still governs

Owner: `product.crms_id` is replaced by `sku` within ~6 months; a human-readable product id is
useful; "actual uid still governs".

**So the ledger keys on `products.uid`, never on `sku`.** A human-readable identifier is by
construction one someone will want to change, and ADR-0036's whole argument is that a mutable value
must not be frozen onto an immutable posting. `sku` is a display and integration concern.
Verified 2026-08-16: the live product schema has no `sku` field today; identity is `uid`.

## 4. Ephemeral reports are never sealed — and this removes a problem rather than creating one

Owner: "theres no reason an ephemeral report would ever need to be sealed or locked. the balance
sheet and p&l can be derived without these mutable fields. **a p&l by product line or customer type
is driven by a need for business intelligence, not compliance.**"

This is the cleanest statement of the split in the repo so far, and it settles three loose ends:

- **ADR-0036's seal-time-pinning consequence is WRONG and is removed.** It worried that deriving a
  product line from a mutable master would let a re-categorisation restate a closed period. It
  cannot: the closed period's sealed artifact is the balance sheet and the account-level P&L, and
  neither carries a product line. Nothing to pin.
- **HOT-014's "(period, basis) rather than period" tension dissolves.** ADR-0017's "a closed period
  cannot drift" is a guarantee about the compliance statements. Re-running a BI report over a closed
  period produces a different number for a report that was never sealed, which is not drift.
- ⚠️ **ADR-0031 §4 and `reporting/allocation-bases.yaml` both overstate their case and need
  amending.** Each justifies `basis_version` by "a report over a sealed period must be reproducible
  byte-for-byte… would break ADR-0017's guarantee". That premise is false — the product-line P&L is
  not a sealed report. **`basis_version` survives on its own merits**: knowing which basis produced
  a number is worth having regardless, and ADR-0031's own "run both over a period and compare"
  requires it. Only the ADR-0017 justification goes.

## 5. Per-product accounts married to a product-line account — raised and set aside

Owner: "should we consider product account(s) married to a product line account that could record
transfers? thats probably overkill and/or trying to force something into tiger beetle that doesnt
naturally fit there."

**Agreed, and recorded so it is not re-argued a third time.** It is ADR-0008's dimension-exploded
model in a new costume, and it fails for the same reasons plus one new one:

- **The marriage is the mutable part.** A per-product account is stable — product identity does not
  move. The **product → product-line link** is what changes, and a TigerBeetle account tree cannot be
  re-parented, so the marriage freezes exactly the value ADR-0036 exists to keep unfrozen.
- **The chart stops being legible.** The charter gives the CPA read access; ~60 accounts plus a
  derived column hands over cleanly, 549 product accounts do not (ADR-0018, re-affirmed).
- **The one place this shape IS natural already exists.** Per-item balances that must not go negative
  are the **inventory-custody ledger** (ADR-0015), a separate TigerBeetle ledger where
  `credits_must_not_exceed_debits` makes overselling unrepresentable. Per-product *money* balances
  are a reporting roll-up, not a balance-integrity concern — which is the test for what belongs in
  TigerBeetle at all.

## 6. `cost_type` → `labour_line`, and the enum grows to seven

Owner: "cost_type is too broad, i think it should change to labor_line or _class or _category (same
for product, no reason for them not to match). delivery, counter, warehouse, trash & cleanup,
shipping & handling, trucking, crew should probably all be part of the enum."

- **Name — recommend `labour_line`**, pairing with `product_line`, which is the "no reason for them
  not to match" the owner asked for. ⚠️ **Spelling:** the repo is consistently British — ADR-0019
  "Labour costing is actual", `labour_cogs`, `5800 COGS-Labour Absorbed`, `5801 Unabsorbed Labour`.
  Written `labour_line` for that consistency; a one-token change if `labor_line` is preferred, and
  worth settling before the sweep rather than after.
- **Values — seven**: `delivery`, `counter`, `warehouse`, `trash_&_cleanup`, `shipping_&_handling`,
  `trucking`, `crew`. Up from three.
- **Five of the seven mirror an activity product line** — Delivery, Trash & Cleanup, Shipping,
  Transport/Trucking, Crew — and two (`counter`, `warehouse`) are internal functions that bill
  nobody. That is coherent rather than duplicative: the taxonomy is "what kind of work", and most
  kinds of work are the ones customers are charged for.

⚠️ **Open, and it follows from the owner's own principle rather than contradicting it: does
`labour_line` belong on the POSTING at all?** The case for keeping it is that it is an **observation
recorded at the time** — this person did delivery work — not a classification looked up from a
mutable master, which is the exact criterion ADR-0036 draws. The case against is that the shift
record already holds it per allocation row, so the posting could carry the row's identity and derive
`labour_line` the same way it derives `product_line`. **The criterion that decides it: could this
value be revised later without anyone having observed something new?** If yes it is a
classification; if no it is a fact. Needs answering before the sweep.

## 7. Event history on products and organizations — an idea the owner likes

Owner: "i like the idea of maintaining an event history on products and organizations."

Not a decision. Worth noting what it would buy in this design specifically: with a categorisation
history on the product master, **a historical product-line P&L can be re-derived "as classified
then" as well as "as classified now"** — which is the strongest possible form of the re-runnability
in ruling 4, and it needs no ledger field at all. Raised as an open question rather than folded in.
