# Charter

**Status:** draft — `m0` is not complete until the non-goals list stops changing.

## Purpose

Rebuild the CFS inventory/order/invoice system as a full ERP with its own double-entry accounting
layer, retiring Xero and asset.accountant. Bring labor scheduling in-house so that crew cost can be
allocated to COGS against the job that caused it.

## In scope

- Order → fulfillment → invoice → posting → report, end to end.
- A double-entry general ledger owned by CFS, with period close and lock.
- Fixed asset register with **dual GAAP and tax basis** and a reportable deferred difference.
- Labor scheduling, shift recording, and **normal-cost** absorption into COGS — wages actual per
  person, employer burden apportioned from the payroll run — borne by the order that caused the hire
  (`ADR-0019`, but-for causation).
- **Purchase orders**, in two roles: the document labor scheduling generates and costs flow from,
  and inventory acquisition — retail stock, and fixed assets bought for rental or internal ops.
- Sales and Chicago Personal Property Lease Transaction Tax determination.
- Bank feed ingestion and reconciliation.
- 1099 / W-9 tracking for contractors.
- **Production service agreements.** Producing a client's project on their budget, including
  carrying their union payroll. A service CFS sells (`4130 - PSA Income`), not an accounting
  convenience — `erp-spec#35`.
- **The operational board and the comment threads attached to domain objects.** A version of each
  survives (`OQ-049`); the board's current form is a rough draft, and where the chat seam sits is
  open (`OQ-051`).
- **A public client app** (owner, 2026-08-18) — the second SolidJS client `ADR-0005` already names
  but never gave a purpose. **Six** capabilities: **real-time stock availability**, **quote
  request**, **checkout for in-store orders**, and — all added 2026-08-23 — **agreements and
  attestations** (a customer signs a rental agreement and attests to the jurisdiction of intended
  use: `ADR-0045`, `OQ-056`, erp-spec#48), **viewing their own orders and invoices**, and
  **delegated administration of their own project's contacts and access**. ⚠️ **The last two require
  ROW-SCOPED permissions that exist in no form today** — every permission is `<resource>.<verb>` and
  `orders.read` means every order. The scoping key is `ADR-0032`'s contact membership edges. It
  replaces the third-party webshop, which is itself out of scope and migrates nothing. ⚠️ Real-time
  to a _public_ audience is not the operator-UI problem `SPIKE-009` is scoped to, and checkout is a
  money path — both are named in
  `inbox/2026-08-18-owner-the-public-client-app-is-in-scope-real-time-availability-quote-request-and-in-store-checkout.md`.
- **Machine discoverability for the public app** (owner, 2026-08-24) — the **seventh** capability,
  and the first whose audience is not a person. Two halves that are not one problem: **syndication**
  (a product feed conforming to whatever Google Shopping requires, and the equivalent for Bing,
  DuckDuckGo and others) and **agentic commerce** (whatever OpenAI and Anthropic require or advise
  for LLM-friendly ecommerce, plus NEAR AI and any other open standard for agentic search and
  purchase). ⚠️ **Nothing about what any of them actually requires is established** — the owner's
  instruction is that research sessions look into all of these, and every name here is a candidate
  to read rather than a fact this repo holds. ⚠️ **Only the agentic half is a money path.** ⭐ **The
  catalog is TWO populations and a feed fits one natively**: **retail sale items**, which CFS sells
  today and is **expanding considerably** (owner, 2026-08-24), are the purchasable units every feed
  schema models; **rental equipment** is priced per pricing factor with availability that is an
  interval computation (`ADR-0015`) rather than a stock number, so "price" and "in stock" are
  commercial decisions before they are schema ones. ⚠️ **The retail population is UNMEASURED** —
  required-attribute coverage is where a catalog that "fits" turns out not to. Named in
  `inbox/2026-08-24-owner-the-public-app-must-be-syndicated-to-shopping-feeds-and-legible-to-buying-agents.md`
  and corrected by
  `inbox/2026-08-24-owner-cfs-sells-retail-too-and-is-expanding-it-so-the-feed-mismatch-is-narrower-than-recorded.md`.
- **Unattended online checkout for a RENTAL order where every item is in stock** (owner, 2026-08-24)
  — the **eighth** public-app capability, and a **third** reading of "checkout" distinct from the
  two the 2026-08-18 note flagged. ⚠️ **The availability gate is the whole difficulty and it is not
  a stock check**: "all items in stock" is a predicate over a requested **window**, and `ADR-0015`
  records that a per-day rollup **oversells** — so the gate must be the interval engine itself, or
  the app confirms and takes money for an order it cannot fill. ⚠️ It takes money for a
  **reservation**, which is a different obligation from retail checkout (`OQ-064`). ⭐ The owner
  notes it is _"prob something we want an agent to be able to do"_ — **which is where the
  syndication and agentic halves diverge in capability, not only in audience.**
- **Card acceptance on the public app** (owner, 2026-08-24, `confidence: medium`) — **most likely
  Authorize.Net, because CFS banks at Chase and the merchant account is there**, with other payment
  methods of interest. ⭐ **The criterion outlives the candidate**: whatever is chosen must settle
  into the existing Chase merchant account without a second banking relationship. Accounting-shaped
  — it reaches `4700 - Transaction Fee Income`, `5500 - Cost of Goods Sold: Merchant Fees`, and a
  settlement shape (one net batch deposit against many receipts) that `ADR-0048` does not cover.
  `OQ-064`, and
  `inbox/2026-08-24-owner-authorize-net-is-the-likely-card-processor-because-cfs-banks-at-chase.md`.
- Year-end close, retained earnings roll, and CPA read access.

## Out of scope — non-goals

Each of these is a deliberate decision, not an oversight. Reversing one is an ADR.

- **Payroll processing for CFS's OWN crew.** An external employer of record (Wrapbook) stays. CFS
  schedules labor and records shifts; it does not calculate withholding, file payroll tax, or move
  its own payroll money. ⚠️ **This does not extend to PSA**, where moving a client's payroll through
  `2800 - PSA Liability Clearing` is the service being sold — see In scope.
- **A general-purpose accounting product.** This ledger serves CFS's chart of accounts and CFS's
  posting rules. It is not built to be configurable for another business.
- **Multi-currency.** USD only. No FX translation, no revaluation.
- **Multi-entity / consolidation.** One legal entity.
- **Migrating Xero's historical detail.** See `HOT-006` — roughly 90% of historical Xero lines sit
  behind the 2025-12-31 lock and are unrepairable. The decision is import-as-is vs restate, not
  repair.
- **Preserving CRMS.** CRMS is being retired at the cutover. Do not design around it.
- **Rewriting into another language.** `ADR-0004` keeps Deno/TypeScript, with a narrow Go sidecar
  escape hatch for the ledger service only.
- **Replacing the external EOR's time-and-attendance system of record for payroll purposes.** CFS
  shift records drive _costing_; the EOR's records drive _pay_. They will disagree at the margin and
  that is tolerated. Reconciling them is not a goal.

## Fences

- **No hard deletes, ever.** Every domain object is soft-deleted or superseded. ⚠️ **The evidence
  originally cited for this fence does not reproduce.** The claim was 55 order uids referenced by
  invoices with no order document; measured against prod on 2026-08-09 across all five order↔invoice
  reference paths, the count is **0**
  (`inbox/2026-08-09-hard-deleted-order-uids-do-not-reproduce.md`, `OQ-013`). The fence is retained
  on its own merits — an accounting system whose charter is to be the record must not lose records,
  and `ADR-0021` already depends on a deactivated product's references still resolving — but it is
  retained _deliberately_, not on the strength of that number.
- **Money is integer minor units** in every schema, wire format, and stored document.
- **Accounting date and posting timestamp are distinct fields** on every posting.
- **Foreign-system identifiers never enter domain models** (`ADR-0009`). Translation happens at the
  boundary; an unresolvable ID is a hard error, never a null. ⚠️ **The 28.7% untracked revenue
  originally cited for this fence was measuring something else** — re-measured against the product
  master on 2026-08-10, 227 of those lines were a CFS-side derivation that never ran and only
  $688.00 (0.041% of line revenue) was an undecided dimension (api-cloudrun#473). Like the
  no-hard-deletes fence above, this one is **retained on its own merits**: Xero's drop-an-
  unresolvable-id-and-return-success behaviour is real independently of what it cost CFS, and a null
  meaning "could not translate" is indistinguishable from one meaning "no value applies" at any
  population size.

## Success criteria for `spec-v1`

See `roadmap/milestones.yaml`. Summarised: every milestone's exit criteria met, zero open questions
without an owner and a decide-by date, and a clean `deno task validate`.

## Context recommendation

Clear. This document is a fence, not a working state — nothing downstream needs the conversation
that produced it.
