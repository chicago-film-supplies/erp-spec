---
kind: decision-input
title: >-
  Owner — evidence retention is 7 years, believed to be the audit limitation; I could not verify it
  from a primary source, and because a GCS retention lock is irreversible the lock should be
  sequenced AFTER the number is confirmed rather than before
contexts: [tax, billing]
source: >-
  Owner, 2026-08-22, in session: "retention should 7 years ( i think limittion on how long you can
  be audited for )". Verification attempted 2026-08-22 and FAILED — `codelibrary.amlegal.com`
  returns HTTP 403 to a default and a browser UA, and the two chicago.gov PDF paths tried return
  404. Chapter 3-4's limitations text was never read.
confidence: low
promotes_to: []
verified: false
triage_count: 0
---

## The figure, and the honest state of it

**7 years, on the owner's belief that it matches the audit limitation period.** ⚠️ **Not verified.**
The relevant authority here is **Chicago's Uniform Revenue Procedures Ordinance (Chapter 3-4)**,
because this is city lease transaction tax evidence — not the IRS, whose commonly-cited "7 years" is
a **records rule-of-thumb rather than a statutory limitation.** I could not reach the ordinance
text.

⚠️ **And a fixed period cannot cover every case anyway.** Limitation periods are ordinarily extended
or unlimited where no return was filed or a fraudulent one was, so **7 years bounds the ORDINARY
case only** — which is the right thing to design for, provided that is said rather than assumed.

## ⭐ Why this one deserves a source rather than a default: BOTH errors are one-way

|               | consequence                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **too short** | the evidence is gone when it is needed. Unrecoverable                                                                                                                 |
| **too long**  | personal correspondence is retained beyond need — **and it cannot be shortened**, because a locked GCS retention policy can be increased but never reduced or removed |

**Neither mistake is correctable after the fact.** That is unusual — most storage decisions are
reversible — and it is what makes a hunch the wrong basis here.

## ⭐ The way out: the LOCK is the irreversible act, not the retention period

A GCS bucket retention policy can be **set** and later changed; it is **locking** it that makes it
permanent, and the lock is also what makes the bucket genuine WORM. ⇒ the two can be sequenced:

1. **Build with the retention policy SET to 7 years and UNLOCKED.** Everything works; the period is
   adjustable.
2. **Confirm the Chicago limitation period** — a CPA question, and the ordinance text if someone can
   reach it. **This spike produces rules, not authority**, which the spike already says of itself.
3. **Lock, once the number is confirmed.**

⚠️ **The gap between 1 and 3 is a real weakness and should be named, not glossed**: an unlocked
policy can be reduced or removed, so during that window the bucket is durable-by-convention rather
than tamper-evident. **It is not yet evidence in the sense the design is for.** ⇒ keep the window
short, and treat locking as a step with an owner rather than a follow-up nobody holds.

⭐ **Meanwhile the hash carries the tamper-evidence on its own.** A SHA-256 recorded in Firestore at
capture proves the bytes did not change regardless of what the bucket permits — **which is the third
reason the hash is the thing to build first**, and it makes the unlocked window survivable.

## ⚠️ What 7 years of email actually is

Seven years of customer correspondence is a **personal-data footprint**, not just storage. The
workspace rule is _record structure and aggregates, never rows_, and an email snapshot is the
opposite of that by design. ⇒ **the retention period is a data-protection decision as much as a tax
one**, and the same lock that protects the evidence also forbids deleting it on request.
