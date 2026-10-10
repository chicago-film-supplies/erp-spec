---
kind: finding
title: >-
  A bill whose payee is a person and whose lines span several vendors is an expense claim, not a
  vendor bill — v1 met the first one in the purchases backfill, and the procurement model has no
  place for it
contexts: [procurement, ledger]
source: >-
  Owner ruling, 2026-10-06, in an api-cloudrun session on api-cloudrun#1225 (comment on the issue
  records it). Document read from the live Xero tenant by an api-cloudrun session the same day;
  v2 model gaps read from this repo's `contexts/procurement/` and `ledger/` that day.
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

## What v1 hit

The v1 purchases backfill (api-cloudrun#1210) moves each historic Xero document onto one purchase
plus one linked bill. It refused exactly one of 299: an ACCPAY bill, PAID, $7,234.10, whose
**contact is a person** (a personal reimbursement), not a vendor.

- Two historic receipts name it, for two different vendors ($4,415.46 and $628.66).
- About $5,044 of the bill touches a purchase. About $2,190 is **product-less opex** across six
  other vendors and subscriptions. It carries nine attachments, one receipt per vendor.
- It is the only ACCPAY bill under that contact. Recurrence beyond it is **unmeasured**: other
  contacts and Xero expense claims were not queried.

## The owner's v1 ruling

Do not model it natively in v1. Split the two receipts into one purchase per vendor, link the
receipts, link **no bill**, and leave the reimbursement in Xero. A native fix would be a schema
break (a bill with one purchase and the supplier's own contact is baked into v1's bill model).

## What v2 does not say

- A bill has one party, `vendor_ref` (`contexts/procurement/events.yaml`, EVT-PRO-003). There is no
  payee, reimbursee or "paid via" party on a procurement document.
- Account 2300 "Unpaid Expense Claims" is in the chart, adopted from the live one. **No event or
  posting rule touches it.**
- Two bills, one per vendor, credited to 2000 would say CFS owes the vendors, which is false: CFS
  owes the person. One bill with `vendor_ref` set to the person loses the real suppliers.
- N obligations on one bill is already allowed (`vendor_bill_received`), and nothing forbids mixed
  vendors among them. That is accidental coverage, not a decision.
- An expense claim also carries lines with no purchase at all, so it cannot be a purchase-bill
  variant without a no-obligation path (the `direct_lines` form covers it only for the vendor's own
  bill).

## Why it matters beyond one document

An earlier note
(`inbox/2026-08-17-owner-cfs-is-non-union-and-average-payroll-fringe-is-23-percent-which-refutes-adr-0019s-central-claim.md`,
§7) already found that bill-centric rules cover a minority of actual spend, with the rest arriving
as bank transactions. The FY2025 split of bill-versus-bank expense that would size this was never
run. A reimbursed-by-person path is the third route into the same gap, next to card spend and direct
pay.

## Suggested handling at triage

- Ask first whether it recurs: count ACCPAY bills whose contact is a person, and Xero expense
  claims, in the prod tenant (read-only).
- If it does, an expense-claim document with its own payee, a liability in 2300 and per-line vendor
  and receipt is the shape the common ERPs use (**general knowledge, not verified here** — no survey
  was run). Rule 8a applies: survey before deciding where it posts.
- If it does not, record the gap as an open question and leave the single case to migration.
