---
kind: survey
title: >-
  Survey — PSA is an ASC 606 principal-versus-agent question, and the live books answer it four
  different ways across three accounts while the account the chart designates for it is named by
  ZERO invoice lines; every reference segregates client money in a LIABILITY and none of them mints
  a GL account per client
contexts: [ledger, billing, fulfillment]
source: "ASC 606-10-55-36/-37/-39 control principle and the three indicators, via RevenueHub · Xero incumbent MEASURED from the CFS invoice corpus, code:2026-08-17:erp-spec:spikes/harness/psa-probe.ts against cfs-3100, 1,013 invoices / 14,425 lines · SAP special G/L indicator + alternative reconciliation account for money received that is not revenue · NetSuite principal/agent gross-vs-net and the `Track Billable Expenses In` switch, netsuite.com + docs.oracle.com · Sage Intacct reimbursable-expense billing · Odoo `Re-invoice Costs` at cost versus sales price, odoo.com documentation"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Surveyed per CLAUDE.md → _Accounting decisions_, for **erp-spec#35**: PSA has five GL accounts and
no spec at all. Nothing can be specified until the gross-versus-net question is answered, because it
decides whether the client's budget is CFS revenue or a liability CFS holds.

## What was measured first, because the issue's own sizing is off by 7.7×

`spikes/harness/psa-probe.ts` (new, `deno task psa`) reads every invoice line's `coa_revenue` from
prod Firestore under ADC. **1,013 invoices, 14,425 lines.**

| line                                      |          amount | account                         |
| ----------------------------------------- | --------------: | ------------------------------- |
| `Contract Labor` — N2ition LLC, 2024-06   |      $25,070.00 | **4120** Contract Labor Income  |
| `Contract Labor` — 637 Films, 2024-09     |      $31,500.00 | **4100** Service Income         |
| `Part 1 Labor Contract` — DePaul, 2025-06 |      $13,600.00 | **4100**                        |
| `Part 2 Labor Contract` — DePaul, 2025-06 |       $5,000.00 | **4100**                        |
| `Part 3 Labor Contract` — DePaul, 2025-07 |      $15,000.00 | **4100**                        |
| `Part 4 Labor Contract` — DePaul, 2025-07 |       $4,550.00 | **4100**                        |
| `Sept Set Dec` — DePaul, 2025-09          |       $7,000.00 | **2800** PSA Liability Clearing |
| **total**                                 | **$101,720.00** | across THREE accounts           |

**Four findings, and each of them changes what can be specified.**

- ⚠️ **`4130 PSA Income` is named by ZERO invoice lines**, and so are `2801`, `2802` and `2803`. Yet
  the Xero P&L shows **$13,202.34** on 4130 for FY2025. ⇒ **PSA income is being recorded in Xero
  directly, outside CFS.** ADR-0001 replaces Xero, so a population that today lives only in the
  system being retired has to acquire a path into v2 or it becomes unrecordable at cutover. That is
  a migration finding of a kind this repo has not had before: not a restatement, an **absence**.
- ⚠️ **The same economic shape is billed to three different accounts, and the same line NAME to
  two.** `Contract Labor` is 4120 for one customer and 4100 for another. Nothing in the data
  distinguishes them; the discriminator is whoever wrote the invoice.
- ⚠️ **One line bills through a LIABILITY account** — `2800 PSA Liability Clearing`, $7,000. That is
  the agency treatment, live, for the same customer whose other $38,150 was billed as gross service
  income. **CFS's own books already contain both answers to this survey's question.**
- ⚠️ **Not one line matched both the name test and the account test.** A probe keyed on either alone
  would have reported a clean picture.

⚠️ **And the probe's own first pattern missed two of the seven.** It read `labor contract` and not
`Contract Labor` — $56,570.00, two customers, two accounts, invisible for the first run. **A count
stated from one search is a count of that search**, recorded in `CLAUDE.md` on 2026-08-17 and
reproduced here the same day by a probe written to measure something else.

## The question, stated precisely — three decisions

| #      | question                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------ |
| **D1** | Is CFS **principal or agent** on a PSA — is the client's budget revenue, or money held for them? |
| **D2** | Where does the client's money sit **while it is held**, and what relieves it?                    |
| **D3** | Do `2801`/`2802`/`2803` stay GL accounts, or become a **party key** on one clearing account?     |

## The six

|                  | how it decides                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GAAP**         | **ASC 606-10-55-37: "An entity is a principal if it controls the specified good or service before that good or service is transferred to a customer."** The indicators (55-39) are **primary responsibility for fulfilling the promise**, **inventory risk**, and **discretion in setting the price**. A principal reports gross; an agent reports its fee. **Net income is identical either way** — what moves is the top line and every margin computed from it. |
| **Xero**         | **The incumbent, and it does all of it at once** — measured above. 4100 for $69,650, 4120 for $25,070, 2800 for $7,000, and 4130 (the account named for the purpose) for nothing. There is no incumbent treatment to migrate; there is an incumbent inconsistency to resolve.                                                                                                                                                                                      |
| **SAP S/4HANA**  | **Money received that is not revenue posts to an ALTERNATIVE RECONCILIATION ACCOUNT under a special G/L indicator** — segregated from ordinary AR on the balance sheet, keyed to the customer rather than to a new GL account. That is D2 and D3 answered by one mechanism: **the party is a subledger key, the account is one.**                                                                                                                                  |
| **NetSuite**     | **States the rule outright**: gross when principal, net when agent, per ASC 606 / IFRS 15. Mechanically its `Track Billable Expenses In` switch decides whether a re-billed cost lands in an income account or credits back the expense — ⚠️ and practitioners record that the DEFAULT credits the expense, i.e. **net unless you configure gross**.                                                                                                               |
| **Sage Intacct** | Bills reimbursable expenses without project costing, itemised through Order Entry. The billing mechanism is indifferent to the classification; the account on the line is what decides it — which is exactly the surface where CFS's four answers came from.                                                                                                                                                                                                       |
| **Odoo**         | **Makes the choice explicit per expense category**: `Re-invoice Costs` is **at cost** or **at sales price**. At cost, revenue equals the cost and the margin is zero by construction; at sales price it is a marked-up sale. Informative because it refuses to guess — the shape is a configuration on the category, not an inference from the amount.                                                                                                             |

## Where they agree — and what it means for CFS

**Nobody decides this by looking at the money.** Every reference decides it by asking who is
obligated: ASC 606 by control and primary responsibility, NetSuite by the same rule restated, Odoo
by making it a declared property of the cost category, SAP by whether the receipt is revenue at all.

⇒ **Applied to a PSA, the indicators point at PRINCIPAL, and that is the opposite of what the spec
currently assumes.** Owner, 2026-08-17: overseas productions use a PSA because they **will not stand
up a US entity** and cannot hold union deals for a few days of filming. **The whole reason the
arrangement exists is that the client cannot be the employer** — so CFS is the contracting party,
CFS is primarily responsible for the crew being paid, and CFS carries what happens if the client's
money does not arrive. Two of the three ASC 606 indicators point one way and the third (inventory
risk) does not apply to a service.

⚠️ **`inbox/2026-08-17-survey-labor-costing...` and erp-spec#35 both call PSA "a pass-through, not a
cost CFS bears".** On the control test that framing is not established, and the live books
contradict it 93% by value. Not refuted here either — **it turns on facts only the owner has**,
which is why this survey ends in an OQ rather than a recommendation to book it gross.

✅ **AND TWO CLAIMS THAT LOOK LIKE ONE MUST BE SEPARATED.** "PSA labor is not CFS's cost" and "PSA
labor must not absorb into the rental and delivery pools" are different statements. **The second
holds under either answer** — a PSA is its own product line, and spreading its crew cost over
someone else's goods revenue would be wrong however the revenue is presented. The first is what D1
decides. ADR-0019's Decision table asserts both as one row.

## The migration delta

- **Under EITHER answer, history is inconsistent and stays that way.** $69,650 gross on 4100,
  $25,070 gross on 4120, $7,000 net through 2800: whichever v2 chooses, ~7% or ~93% of the history
  disagrees with it. ⚠️ **This is a third comparability break** beside ADR-0030's and ADR-0020's,
  and it is worse in kind: those are consistent histories presented differently, this is an
  inconsistent history.
- **The gross number is unmeasured and this probe cannot reach it.** What CFS billed is $101,720.
  The client's **payroll** — what flowed through Revolution Payroll — never touched a CFS invoice.
  If the answer is gross, that payroll is CFS revenue AND CFS cost, and neither is in the corpus
  this repo can read. **What would measure it: the Revolution Payroll remittances, or the 2800
  account's gross movement in Xero.** Named rather than skipped.
- ⚠️ **`4130`'s $13,202.34 does not reconcile to anything measured here**, and until it does, nobody
  should quote it as the size of PSA. It is 13% of the invoiced total and sits on an account no
  invoice names.

## Recommendation

1. **D1 — do not decide it in this session.** The ASC 606 indicators point at principal, and the
   facts they turn on are the owner's: who signs the crew's engagement, whose workers' comp and
   liability insurance answer for them, and who eats it if the client does not pay. **OQ-053.**
2. **D2 — the client's money sits in a LIABILITY while held, under both answers, and `2800` already
   is that account.** Money received before the work is performed is not revenue on anyone's
   reading; SAP's special G/L shape is the same instrument. This part needs no ruling.
3. **D3 — `2801`/`2802`/`2803` do not survive as GL accounts.** ⇒ ONE clearing account with the
   party as a subledger key, which is SAP's answer and ADR-0018's plain chart and ADR-0032's org
   tree already agreeing. The chart's own note calls the per-client accounts a smell; the
   measurement says they carry no invoice line at all.
4. **Write the exclusion rule regardless of D1**: PSA labor is its own product line and never enters
   the rental or delivery pools. It is true under both answers and it is what a faithful reading of
   ADR-0019 would otherwise get wrong.
