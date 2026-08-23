---
kind: decision-input
title: >-
  Design input — the Gmail evidence picker: store RAW MIME rather than a PDF, hash it, verify DKIM
  at capture, bind it to what it justifies, and keep it out of a store that has a reaper
contexts: [tax, billing]
source: >-
  Owner, 2026-08-22, in session — plan for the picker; the reason is obvious in both cases, the
  evidence is not; the picker should snapshot a file reproducible on demand. Constraints verified at
  `code:2026-08-22:core@7bcc2db:src/schemas/uploadcare-sweep.ts` and by grep across
  `api-cloudrun/src` (no Gmail integration, no inbound-email pipeline).
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

⚠️ **`verified: false` deliberately.** Nothing here is built or measured — it is a design input for
`OQ-056`, and the DKIM and retention claims are about third-party behaviour this repo has not
executed against. **Do not promote it into a requirement without a spike.**

## The simplification the owner made, and it is the right one

> _"the reason in both cases is obvious, its just the evidence thats not"_

⇒ **Do not over-build the reason.** An exemption's reason is that the customer is exempt; a
jurisdiction override's is that the gear is used exclusively there. **An enum over one obvious value
per case buys nothing.** What is missing is not a categorisation — it is a durable, checkable
artifact that the assertion was made.

## What to capture: RAW MIME, never a rendering

⭐ **A PDF of a thread is a RENDERING, and the verifiable facts are in the parts a rendering
discards.** The Gmail API's `format=raw` returns the full RFC 5322 message, which keeps:

- **`DKIM-Signature`** — cryptographically verifiable, and the single strongest available evidence
  that a message genuinely came from the customer's mail domain.
- **`Authentication-Results`** — Google's own verdict at delivery time (`dkim=pass header.i=@…`).
- **`Received:` chain**, `Message-ID`, `Date` — provenance and timing that no PDF preserves.

⇒ **Store the raw source; render the readable version ON DEMAND from it.** That is exactly the
owner's "snapshot a file so it can be reproduced" — the file is the source of truth and the PDF is a
view, so there is only one artifact to protect and one hash to check.

## Six strategies that make it verifiable rather than merely stored

**1. Hash at capture.** SHA-256 per message plus a manifest hash over the thread, stored in
Firestore beside the reference. **Firestore holds the proof; the blob store holds the bytes.**
Anyone can re-hash and confirm nothing changed. Cheapest and highest-value single measure.

**2. ⭐ Verify DKIM at capture and record the VERDICT.** This is what turns "someone saved an email"
into "a message signed by `customer.com`'s mail server". ⚠️ **And it must be done at capture,
because verification degrades**: DKIM selectors rotate and old public keys leave DNS, so a signature
that validates today may be unverifiable in three years through nobody's fault. **The capture-time
verdict — selector, signing domain, pass/fail, and the date checked — is the durable fact.** Record
it as a finding, not as a live check.

**3. Bind the evidence to what it justifies.** The record names the order or invoice uid, the
destination, **the jurisdiction value asserted**, and the document version at capture. ⇒ an auditor
goes from a tax line to its evidence and back. Without the binding there is an email and a tax
position with no proven relationship.

**4. ⭐ Record three dates and make their relationship computable**: the message's own `Date`, the
capture timestamp, and the order/invoice date. **Evidence that predates the billing is strong;
evidence captured two years later is weak but honest.** ⚠️ **Timing is as auditable as content**,
and a schema that stores only "captured_at" throws away the comparison an auditor actually makes.

**5. Per-user OAuth, never domain-wide delegation.** The operator who saw the email is the one
capturing it, so their own authorisation is the right scope. A service account able to read every
mailbox is a much larger blast radius bought for no gain — and it weakens the evidence, because "an
operator selected this from their own inbox" is a stronger provenance claim than "a robot found it".

**6. ⚠️ Keep it OUT of a store that has a reaper.** `uploadcare-sweep` deletes orphaned CDN files on
a weekly `write=true` cron, keyed per `${projectId}/${collection}`. A new reference source the
extractor does not know about **does not collapse — it is never counted**, so its files look
orphaned and are reaped. The delta canary cannot see this: it watches for a source going to zero,
not for one that was never registered.

⇒ ⭐ **Put audit evidence in its own GCS bucket with a RETENTION POLICY (bucket lock), not in
Uploadcare.** That is genuine WORM — objects cannot be deleted or overwritten until the retention
period expires, by anyone, including an administrator or a runaway cron. It is the one control that
makes "we could not have altered it" a property of the system rather than a promise. ⚠️ **A
retention policy is irreversible once locked**, so the period is a decision, not a default — and it
should be chosen against a statute of limitations rather than a hunch.

## The plan, in order

| step | what                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Operator sets the override in the manager and clicks **attach evidence**                                                                                                                                             |
| 2    | Per-user Google OAuth; the API searches that mailbox, **scoped to the customer's email domain and a date window around the order** — narrow by default, because a picker over an entire mailbox is a privacy surface |
| 3    | Operator selects a thread; the API fetches each message `format=raw`                                                                                                                                                 |
| 4    | Verify DKIM, hash each message and the manifest, write the blob to the retention-locked bucket                                                                                                                       |
| 5    | Write the evidence record: hashes, DKIM verdict, Gmail + RFC message ids, thread permalink, capturing user, three dates, and the binding to order/destination/jurisdiction                                           |
| 6    | Render on demand from the raw source — never store the rendering                                                                                                                                                     |

## ⚠️ What this does not solve, stated

- **PII.** A thread carries whatever is in it, and the workspace rule here is _record structure and
  aggregates, never rows_. **An email snapshot is the exact opposite**, so capture is deliberate and
  scoped, and the retention period applies to personal correspondence.
- **Whole-thread versus single-message.** A thread is context; the assertion is usually one message.
  Capturing the thread is more useful and stores more unrelated content. **Undecided.**
- **DKIM degradation**, above — mitigated by recording the verdict, not eliminated.
- **Nothing exists yet.** No Gmail integration in `api-cloudrun`, no inbound-email pipeline, no GCS
  bucket in the terraform. This is a greenfield build, and the estimate should say so.
- ⚠️ **The strongest control is the cheapest one.** If only one thing gets built, build **the hash**
  — it is a few lines, it needs no OAuth, and it is what makes every later claim checkable.
