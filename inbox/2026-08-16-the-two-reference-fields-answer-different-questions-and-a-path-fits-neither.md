---
kind: finding
title: '`journal_entry_id` and `source_document_ref` are not redundant — they answer grouping and provenance, and neither derives the other; but line identity was never in the budget at all, and a path is 178 bytes against a 16-byte field, so ADR-0036''s "one key may serve all three" is an unmeasured economy that saves one field rather than two'
contexts: [ledger, billing]
source: "api:2026-08-16:spikes/harness/posting-key-width-probe.ts — all 1,010 prod invoices (14,410 items, 9,394 revenue-bearing) and all 987 orders (13,573 items); 30 order-less invoices / 87 lines / $87,839.76 · code:2026-08-16:erp-spec:ledger/posting-rules.yaml (13 specified rules) · code:2026-08-16:.claude/docs/tigerbeetle.txt"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Two questions asked of the transfer field budget (owner, 2026-08-16): **why do `journal_entry_id`
and `source_document_ref` need to be different fields, and is line identity (`item.path`) already
using one of them?** Both are answerable, and the second turns up a hole in ADR-0036.

## 1. The two fields answer different questions, and the repo had only proved it one way

`ledger/tigerbeetle-accounts.yaml` records `journal_entry_id_is_not_derivable:` — the grouping is
not a function of `source_document_ref`, because a journal entry may span several source documents.
**Measured across the 13 `specified` posting rules: 3 span** — `settlement_recorded` (one payment
across several invoices), `credit_note_allocated` (one session across several notes and invoices)
and `vendor_bill_received` (one EOR bill across a fortnight of accrued shifts). The other 10 do not.

**That proves one direction only.** The converse — is `source_document_ref` derivable from
`journal_entry_id`? — had never been asked, and the answer is what makes the pair non-redundant:

- **For the 3 spanning rules: no, not even in principle.** One entry, many source documents, one per
  transfer. The entry id cannot say which invoice a given transfer relieved.
- **For the other 10: only through the projection**, and that defeats the point. A
  `journal_entry_id` is an opaque uid; from TigerBeetle alone it identifies a group and says nothing
  about what the group was for. Deriving the document from it means asking Mongo — which is exactly
  the dependency the field is carried to avoid.

⇒ **Grouping and provenance are two facts.** TigerBeetle's `linked` flag gives a set atomicity but
not identity — atomic and anonymous — so the group needs an id; and a transfer needs to name its own
document or the ledger is not self-describing. Neither derives the other. **The pair is justified,
and now justified in both directions rather than one.**

## 2. Line identity is NOT using either field — it is not in the budget at all

`item.path` appears nowhere in `ledger/tigerbeetle-accounts.yaml`. It enters only through ADR-0036
(`proposed`), which makes it one of the keys a posting carries and offers an economy:

> **One key may serve all three.** … an invoice item's path is the order item's path prefixed by an
> order divider — `path[0]` **is** the causal order. Where the two agree, one stored path carries
> line identity, invoice link and causal order together, and TigerBeetle reference space is **freed
> rather than spent**.

That is three assertions and **the ADR measured none of them.** All three are now measured
(`spikes/harness/posting-key-width-probe.ts`, whole corpus, read-only under ADC).

### The corpus

|                                 |               invoices |                orders |
| ------------------------------- | ---------------------: | --------------------: |
| documents                       |              **1,010** |               **987** |
| items                           |                 14,410 |                13,573 |
| revenue-bearing (non-divider)   |              **9,394** |                 9,782 |
| path depth — median / p99 / max |          4 / 6 / **7** |         3 / 5 / **6** |
| path width — median / p99 / max | 115B / 157B / **178B** | 94B / 136B / **161B** |
| `path.at(-1) !== item.uid`      |                  **0** |                 **0** |
| empty paths                     |                  **0** |                 **0** |

uid flavours across invoice paths: 28,324 Firestore (20 char), 25,338 uuid (36 char), 123
`custom-`-prefixed uuid (43 char). **The width is not uniform and never will be.**

### ⚠️ Finding A — `path[0]` is not reliably the causal order, and the exception is a MIGRATION population

**30 of 1,010 invoices (2.97%) carry no `order` divider at all.** They hold **87 revenue-bearing
lines totalling $87,839.76** whose `path[0]` is a line rather than an order. Invoice
`077rd6h7pVPIX13U31nj` (#1702) is a single $2,480.00 custom venue-rental line at depth 1;
`0tf4c3HTgygKB8GSz7L7` is six replacement/service lines all at depth 1.

**✅ The discriminator, and it is decisive: 0 of the 30 reference an order, and 30 of the 30 carry a
`crms_id`.** They are legacy CRMS imports, not a live business pattern. So this is a **migration**
population — every one of them predates the order→invoice flow.

⚠️ **Owner ruling, 2026-08-16: "we can change order path to match invoice path in v1."** That makes
`ORDER_ITEM_LEVELS` match `INVOICE_ITEM_LEVELS` so an order's own items carry an order divider at
`path[0]` too — and it is a genuine improvement, because it turns ADR-0036's _"where the two agree"_
from a conditional into an invariant for everything the live system produces. **It cannot reach
these 30**: they reference no order, so there is nothing for a divider to name. The change fixes the
rule going forward; the 30 need a migration answer, not a path answer.

⇒ ADR-0036's economy **holds for the live corpus once order paths are re-based, and must still state
the legacy exception.** A posting keyed on `path[0]` for one of those 87 lines would record a line
uid in a field the spec says holds a causal order — wrong forever, in an immutable store.

⚠️ **Read the divider count on invoices only.** All 987 orders lack an order divider and that is the
schema, not a defect: `ORDER_ITEM_LEVELS` is `[destination, group]` against `INVOICE_ITEM_LEVELS`'s
`[order, destination, group]`, because an invoice can bill several orders and an order cannot bill
itself. The probe is told which collection it is looking at for exactly this reason — reporting 987
of 987 as a gap would have manufactured a defect out of the schema.

### ⚠️ Finding A2 — ADR-0036 says there is "no defensible null" for a causal order. There are 87 of them.

ADR-0036's Consequences state, of the restated REQ-LED-001:

> a posting with no causal order is unallocatable and should be refused, and **unlike a category
> there is no defensible null**.

**Measured: $87,839.76 of real, issued, revenue-bearing lines have no causal order.** Refusing them
outright would make 30 historical invoices unpostable, which ADR-0020's "the restatement must not
alter any amount" forbids. The sentence needs one of three amendments, and the choice is the
owner's:

1. the rule binds **new** postings only, and migrated history carries an explicit null;
2. the migration mints a synthetic order per legacy invoice — inventing a document that never
   existed;
3. the causal-order key is nullable outright, which weakens it to exactly the classification-shaped
   thing ADR-0036 refuses.

Option 1 is the only one that does not either fabricate a record or dissolve the rule.

### ⚠️ Finding A3 — ADR-0036's precondition is a FALSE GREEN, and the defect is 6× its reported size

ADR-0036 names `api-cloudrun#485` — _"10 invoice lines sit at a different path than their order
line"_ — and says **"it must close first — a posting keyed on a wrong path is wrong forever."**

**It closed on 2026-08-16 as `NOT_PLANNED`.** So the stated precondition is satisfied in letter and
in nothing else: the issue is shut and the divergence stands. That is the exact false green this
repo keeps paying for — a guarantee discharged by a status change rather than by the property
becoming true.

**So the property was measured instead of the issue.** For every invoice line under an order divider
whose order still exists, does the tail `path.slice(1)` appear verbatim as a path in that order? The
comparison is exact and does not rely on uid uniqueness (a uid repeats within one document — 18% of
prod orders).

|                                                                              |           lines |
| ---------------------------------------------------------------------------- | --------------: |
| comparable (order divider present, order still exists)                       |       **9,307** |
| aligned — tail appears verbatim in the order                                 |       **8,981** |
| invoice-only — the line is on no order, so it never had a path to agree with |             267 |
| ⚠️ **MISALIGNED — same line uid, different path**                            | **59 (0.634%)** |
| order divider naming an order not in the corpus                              |               1 |

⚠️ **The 267 must not be counted as defects**, and separating them is the whole reason the number is
credible: a custom charge or a surcharge added at billing never had an order path to agree with.
Reporting all 326 as misalignment would have manufactured a defect out of ordinary invoicing — the
same trap as reporting 987 of 987 orders as missing an order divider.

**The 59 are one defect class, and it is #485's.** Worked example, invoice `0ptxu8O2zE21YkKSTWdC`
against order `EfNNWdma2faDtje4Z9Ck`:

| line                   | on the ORDER                                      | on the INVOICE         |
| ---------------------- | ------------------------------------------------- | ---------------------- |
| `AXKYoGO0iysVuQcWlT4q` | `dest / group / **x5c2CRlOqdzL3T3f7DVE** / AXKY…` | `dest / group / AXKY…` |
| `6jDjBeeNedv996NatdiV` | `dest / group / **qpMtx5QZsOBkU3ovA9J6** / 6jDj…` | `dest / group / 6jDj…` |
| `custom-2268c014-…`    | `dest / **group** / custom-2268…`                 | `dest / custom-2268…`  |

Two components **flattened out of their parent rental**, and a custom line **lifted out of its
group**. The invoice omits both parent rentals entirely — unbilled zero-priced parents whose
children were re-parented upward. Exactly what #485 described, at six times the count it reported.

⇒ **ADR-0036 cannot inherit this precondition from a closed issue.** Either the alignment becomes a
property something can fail on — `scripts/audit-item-paths.ts` already walks both collections and
#485's own last comment proposed exactly that guard — or the shared key is keyed on a path that is
wrong for 59 lines, permanently, in an immutable store.

### ⚠️ Finding B — a path does not fit any TigerBeetle field, and it is not close

**14,410 of 14,410 invoice paths exceed a u128 (100%)**, max **178 bytes against 16**. The median is
115 bytes — seven times over. There is no packing, no trimming and no depth limit that rescues this:
a single 36-char uuid already overflows a u128 on its own.

⇒ **Storing line identity means storing a HASH or a minted surrogate**, and that is an encoding
decision ADR-0036 does not currently make. Collision is not the risk — 19,176 revenue-bearing lines
across both collections gives a birthday bound of ~1e-11 on a 64-bit hash. **Opacity is the risk**:
TigerBeetle would hold a fingerprint that _verifies_ against the projection rather than a reference
that _resolves_ without it, which is a weaker form of self-describing than the one
`journal_entry_id` and `source_document_ref` were justified by.

### ⚠️ Finding C — the economy saves one field, not two

Because a path names the document **and** the row within it, a stored line identity **strictly
subsumes `source_document_ref`** — it can replace that field rather than sit beside it. That is a
real saving and it is the answer to "is line identity using one of these fields": **it should use
`user_data_64`, displacing the document ref.**

But it cannot also absorb `journal_entry_id` (finding 1 above), and it does not reliably carry the
causal order (finding A). So the honest count is:

| ADR-0036 implies                                                             | measured                                                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| one path serves line identity + invoice link + causal order, space **freed** | one hashed path serves line identity + invoice link, **replacing** `source_document_ref`; the causal order needs its own home on 2.97% of invoices |

## What this changes

- **erp-spec#3's pair is vindicated** and the justification is now two-directional.
- **ADR-0036 needs an encoding sentence and an exception sentence** before acceptance. It is
  `proposed`, so both are still writable; after acceptance neither is.
- **The budget is tighter than the corrected table suggests.** After the `Transfer.code` discovery
  the count read four fields, three claimed. With line identity replacing the document ref it is
  still four fields and three claimed — but the spare u16 now has **three** contenders, not two: the
  dimensions HOT-013 argues about, the actor ref, and the causal order on the invoices where
  `path[0]` cannot supply it.

## Two things measured on the way that were not the question

**1. Invariants 4 and 5 hold corpus-wide.** `path.at(-1) === item.uid` holds on **all 27,983 items
across both collections**, and **no path is empty**. The first independent confirmation since the
2026-07-28 repair, and it is the property that makes a path usable as a key at all.

⚠️ **That contradicts a standing caveat in the live API's own schema documentation**, which says:
"28 legacy CRMS-imported invoices predate that rule and carry `path: []` on their items." **It does
not reproduce — 0 of 14,410.** Either the repair swept them or the caveat was always wrong; either
way it is now telling readers to expect a population that does not exist. Worth a note against
`api-cloudrun`. (The count is suggestive — 28 against the 30 order-less invoices found here — so the
likeliest story is that these ARE that population, repaired to carry depth-1 paths.)

**2. A trap this probe walked into, recorded because the fix is structural.** The first two runs
reported the order-less revenue as **$0.00**. That was not a measurement: a string-replace patch had
silently no-op'd against a line it did not match, so the accumulator was never wired. The wrong
field name (`items[].totals.total_cents` for `items[].price.total_cents`) was a second, independent
error found by checking the schema rather than by the number moving. **A signal that does not flip
is a finding — and the first thing to check is whether it was ever connected.** $0.00 was reported
by code that could not have produced any other answer.
