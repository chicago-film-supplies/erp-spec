---
kind: research
title: >-
  Seven years is the wrong retention figure — Chicago's own extension arm runs to EIGHT years, the
  clock starts at the end of the calendar year the RETURN was filed rather than at the transaction,
  and depreciable equipment records outlive all of it by more than a decade
contexts: [tax, fixed-assets, billing]
source: >-
  Primary text extracted 2026-08-22. Chicago MCC via Wayback raw HTML parsed locally (amlegal is
  behind Cloudflare and 403s every UA including the r.jina.ai proxy), edition "2021 S-55, current
  through Council Journal of September 20, 2021". Illinois from ilga.gov. IRC from
  uscode.house.gov; 26 CFR from ecfr.gov; IRS records guidance from irs.gov. Never a summarizing
  fetch.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

⚠️ **Statutory text, not legal advice.** And see _What is NOT verified_ — the Chicago figures are
high-confidence but come from a 2021 edition, which is exactly the check to run before an
irreversible lock.

## The answer: the CRITERION was right and the NUMBER that follows from it is not 7

The owner's instinct — _"7 years (i think limitation on how long you can be audited for)"_ — named
the correct criterion. **Worked through, that criterion yields 8, not 7**, and it yields a different
clock anchor.

Take a lease transaction on **2026-01-01**, annual return filed 2027:

| Regime                               | Rule                               | Bars at        | From txn    |
| ------------------------------------ | ---------------------------------- | -------------- | ----------- |
| IL ROT (35 ILCS 120/4)               | 3 yr, semiannual step              | 2029-07-01     | 3.50 yr     |
| IRS §6501(a)                         | 3 yr after filing                  | 2030-04-15     | 4.28 yr     |
| **Chicago §3-4-120(A)**              | **4 yr after END OF CY OF FILING** | **2031-12-31** | **6.00 yr** |
| IRS §6501(e)(1) — >25% omission      | 6 yr                               | 2033-04-15     | 7.29 yr     |
| Chicago §3-4-120(E) — amended return | 6 yr after original return filed   | 2033-08-15     | 7.62 yr     |
| **Chicago §3-4-120(D) — shortfall**  | **4 + 2 yr after end of CY**       | **2033-12-31** | **8.00 yr** |

A 7-year lock stamped 2026-01-01 expires 2033-01-01. It **covers** the ordinary Chicago case with
about a year to spare — and **misses three non-exotic ones**: the IRS 6-year substantial-omission
arm by 3.5 months, Chicago's amended-return arm by 7.6 months, and Chicago's shortfall extension by
**a full year**.

⭐ **Filing an amended return is routine business, not misconduct — and it alone breaks a 7-year
policy.**

## ⭐⭐ The clock anchor is a separate error, and a quieter one

**Chicago §3-4-120(A) runs four years from the end of the CALENDAR YEAR IN WHICH THE RETURN WAS
FILED** — not from the transaction. An annual return pushes filing into year+1, so the nominal four
years carries **two "free" years of drift** on top.

⇒ **retention keyed to the transaction date silently UNDER-RETAINS January records by up to a
year**, and does so invisibly: every object gets its stamp, nothing errors, and the shortfall is
only discovered when the record is asked for. **Key the policy to the end of the calendar year in
which the return was filed.**

## ⚠️ CFS is a TAX COLLECTOR, and that arm has no limitation at all

§3-32-070 makes a lessor responsible for collecting and remitting the lease tax. **§3-4-120(B)(2)
removes the statute of limitations entirely where a person "failed to remit collected taxes to the
department"** — alongside fraud, and alongside ROT non-filing (§120/5, where the clock starts at
_actual filing_, so a never-filed period is open forever) and §6501(c)(3).

⇒ **three regimes have no upper bound, which no finite retention can satisfy.** That is not an
argument for a longer number; it is the reason retention is a risk decision rather than a compliance
calculation.

## ⭐⭐ TWO CLASSES, and the second is the dominant one for a rental company

**26 CFR §1.6001-1(e)** states the real federal rule, and it is open-ended:

> The books or records required by this section … shall be **retained so long as the contents
> thereof may become material in the administration of any internal revenue law**.

And the IRS's own guidance carries a clause aimed squarely at this business:

> Generally, keep records relating to property **until the period of limitations expires for the
> year in which you dispose of the property**. You must keep these records to figure any
> depreciation, amortization, or depletion deduction and to figure the gain or loss when you sell or
> otherwise dispose of the property.

⇒ **a camera acquired 2026 and disposed 2040 needs its records until roughly 2047 — about 21
years.** For a company whose entire business is long-lived depreciable equipment this is the
dominant driver, and **7 years is not close.** ⭐ **This lands directly on `ADR-0043` (the
depreciation engine is built and packaged)**: the engine's inputs are exactly the records this
clause reaches.

**So the policy is two classes, not one:**

1. **Transactional tax evidence — 8 years minimum**, keyed to the end of the calendar year the
   return was filed. 8 covers §3-4-120(D), the binding _finite_ maximum.
2. **Fixed-asset and depreciation records — asset life + ~8 years, i.e. effectively indefinite.**

## ⚠️ "7 years" is a real IRS number for a case CFS is not in

The figure exists — but it is one line of a six-line list, and it is about **worthless securities
and bad-debt deductions**. It is not a general retention rule. The only _fixed_ federal number is
employment tax at **four** years (26 CFR §31.6001-1(e)(2)).

⭐ **Chicago does state a flat number, and it is five, not seven** — §3-32-110: lessors and lessees
_"shall **retain for at least five years** … including all original source documents."_ ⚠️ **And ch.
3-4 states none at all** — §3-4-170 imposes the duty to keep records with no duration, across all 47
sections. **The number everyone expects to be in the general ordinance is in the lease-tax chapter
instead**, and the City's own audit guidance tells you to retain for the §3-4-120 window rather than
the flat five.

## ⭐ The asymmetry that decides how to round

**§3-4-130 puts the burden on the TAXPAYER to disprove an assessment "with documentary evidence,
books and records."** ⇒ over-retention costs storage; under-retention forfeits the burden of proof
and **loses by default**. Round up.

## ⚠️ A METHOD FINDING: a search summary silently dropped the subsection that changes the answer

A WebSearch summary of §3-4-120 returned subsections **A, B and E — and omitted D**, the two-year
extension. **D is the arm that produces the 8-year maximum and breaks the 7-year policy.** The
omission was not flagged, not hedged, and left a clean, plausible, well-formed answer that was wrong
in its bottom line.

⇒ this is the repo's own warning caught in the act: **the more precisely you describe the shape you
expect, the more likely it comes back in that shape.** An enumeration returned by a summary is not
evidence of what the enumeration contains.

## What is NOT verified

- ⚠️ **CURRENCY of the Chicago text — the main gap.** The only Wayback capture is the **2021 S-55**
  edition; amendments 2021→2026 are unconfirmed. As of that edition §3-4-120 was last amended
  2016-11-16 and §3-32-110 never amended — but **ch. 3-32 is demonstrably live** (the rate is now
  15%, against the 9%/11% tiers in the archived text). **Have counsel check the current print
  edition before locking anything.**
- **Chicago lease-tax return FREQUENCY and due date** — unverified, and it swings the Chicago
  ordinary case between **5.00 and 6.00 years**. Monthly filing removes the annual-return drift.
- **§3-32-130** (application of the Uniform Revenue Procedures Ordinance to ch. 3-32) — **body not
  archived**; only its title was read. The claim "ch. 3-32 is administered under ch. 3-4" rests on
  that title plus Lease Tax Ruling #12's own citation of §§3-4-030 and 3-4-150.
- ⚠️ **Illinois P.A. 103-592 (2025) changed lease/rental taxation** and may newly subject CFS's
  rentals to ROT collection. **Not researched, and potentially material to whether ROT applies at
  all** — it deserves its own pass, not a footnote.
- 86 Ill. Adm. Code 130.8xx (ROT administrative rules); 35 ILCS 5/905 (income/replacement tax).
- CFS entity type — an April 15 due date was assumed. A March 15 date shortens the IRS rows by a
  month and changes no conclusion.
