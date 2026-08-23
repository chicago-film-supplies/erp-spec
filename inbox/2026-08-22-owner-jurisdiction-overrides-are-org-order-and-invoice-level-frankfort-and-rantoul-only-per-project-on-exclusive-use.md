---
kind: decision
title: >-
  Owner — jurisdiction overrides exist at org, order and invoice level, are used only for Frankfort
  and Rantoul, are decided per project, and rest on the gear being used EXCLUSIVELY there; measured,
  the mechanism works on 13 of 14 and exactly one override was ignored
contexts: [tax, billing, ordering]
source: >-
  Owner, 2026-08-22, in session. Measurement `api:2026-08-22` over all 1,019 invoices — every
  destination whose `jurisdiction` differs from its delivery city, scored against the tax actually
  applied.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

## The policy

> _"generally we allow for org, order, invoice level overrides, in the case of kenwood it is picking
> up items from our shop but using them exclusively in frankfort so we collect frankfort sales tax,
> we only do this for frankfort and rantoul and its on a per project basis"_

|                 |                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **levels**      | org, order, invoice — three, and they need a precedence                                            |
| **targets**     | **Frankfort and Rantoul only.** Never Chicago, never Paxton                                        |
| **granularity** | **per project**, which is the order                                                                |
| **basis**       | the gear is used **exclusively** in that jurisdiction, despite being collected from a Chicago shop |

⭐ **THIS IS THE ORDINANCE'S OWN TEST, CORRECTLY APPLIED — and an earlier note here got it
backwards.** The Chicago Personal Property Lease Transaction Tax reaches property **used in
Chicago**. Gear collected in Chicago but used exclusively in Frankfort is **not used in Chicago**,
so Chicago's tax does not reach it and Frankfort's sales tax does. ⚠️ **The earlier framing called
this a tax POSITION needing a CPA to defend. That was too suspicious**: it is the sourcing rule
working, and the delivery address diverging from the tax is the expected consequence rather than a
symptom.

## ⭐ Measured: the mechanism works, and exactly one override was ignored

All 15 destinations whose `jurisdiction` differs from the delivery city:

| outcome                  |  count | note                                                                                         |
| ------------------------ | -----: | -------------------------------------------------------------------------------------------- |
| ✅ **override honoured** | **13** | 12 org-level (Kenwood) + 1 order/invoice-level (Chili Finger, 2025)                          |
| ✅ correctly untaxed     |      1 | inv 2328 — every line is `service` or `surcharge`, which appear in **no** tax's `item_types` |
| ❌ **override IGNORED**  |  **1** | **inv 2392**                                                                                 |

⇒ **13 of 14 taxed cases honoured. The mechanism is sound.**

### The one defect, and its shape is specific

**Invoice 2392 (2026-08-21)**: destination `jurisdiction: rantoul`, org claim **null** — so this is
an **order/invoice-level** override, not an org one — a single `replacement` line at $202.80, and
the tax applied is **Chicago Sales Tax 10.5%** instead of **Rantoul 9%**.

- **Both jurisdictions tax `replacement`**, so it is not a line-type miss.
- ⚠️ **The direction is an OVER-charge** — 1.5 points, **$3.04** — so it is a customer refund
  question rather than an under-remittance one.
- ⭐ **Both order/invoice-level overrides in the corpus are the interesting ones**: inv 1960 (2025)
  was honoured, inv 2392 (yesterday) was not. **Every org-level override works.** That is a testable
  hypothesis about where the bug lives — the order/invoice-level path, not the org one.

## What the spec must carry, and it is narrower than it looked

1. **Three override levels with a stated precedence.** Kenwood carries an org-level claim; Chili
   Finger and Imagination Colony carry order/invoice-level ones with no org claim. **Which wins when
   both exist is undecided and unexercised** — no invoice in the corpus has both.
2. ⚠️ **An override needs a REASON, not just a value.** The policy rests on a factual assertion —
   _used exclusively in Frankfort_ — and **nothing in the data records that assertion, who made it,
   or for which project.** This is the house pattern already: `EVT-TAX-002` carries a reason because
   "no tax" and "no tax BECAUSE" audit differently. A jurisdiction override is the same shape.
3. **The permitted target set is Frankfort and Rantoul.** That is a policy constraint an enum cannot
   express — `jurisdiction` admits `chicago` and `paxton` too, and nothing forbids overriding to
   them.
4. **Per project = per order.** So an order-level override is the operative grain, and an org-level
   claim is a default rather than the rule.

## ⚠️ What this does NOT settle

- **96.4% of destinations carry no jurisdiction at all** (34 of 946). An unstated default drives
  everything else, and writing that default down is still owed.
- **Whether exclusivity holds in fact.** If gear claimed for exclusive Frankfort use is used in
  Chicago, the position fails — and nothing records the assertion, so nothing could be checked
  against it. **That is the reason requirement above, not a doubt about the policy.**
