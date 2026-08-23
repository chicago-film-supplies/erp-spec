---
kind: decision-input
title: >-
  Evidence storage belongs on Linode rather than GCS — a retention lock IS platform lock-in, which
  is the thing ADR-0013 exists to prevent — and the lock collides with erasure in a way redaction
  cannot fix, because redacting breaks the signature that makes it evidence
contexts: [tax, billing]
source: >-
  Owner questions, 2026-08-22. Linode Object Lock and versioning confirmed present from
  `techdocs.akamai.com/cloud-computing/docs/object-storage` (fetched 2026-08-22); ⚠️ the Object Lock
  detail page is a JS shell and the supported MODES were NOT confirmed. ADR-0013 quoted from the
  repo.
confidence: medium
promotes_to: []
verified: false
triage_count: 0
---

## GCS or Linode — Linode, and the accepted ADR already decided it

⭐⭐ **`ADR-0013`'s own summary says the decision was taken to achieve "predictable cost and **no
platform lock-in**."** A locked object-retention policy **is** platform lock-in, in the most literal
available sense: for the retention period the objects cannot be deleted, and they cannot be moved
either — **moving means copying and then deleting the source, and deletion is exactly what the lock
forbids.**

⇒ **Locking seven years of evidence into GCS means paying GCP until 2033 for a bucket that cannot be
emptied, chosen in the middle of a migration off GCP.** That is not a mild preference against; it is
the specific failure ADR-0013 exists to prevent, and unlike most such mistakes it is **irreversible
by construction.**

**And the capability exists on Linode.** Object Storage is S3-compatible and the docs carry a
dedicated _"Use Object Lock to protect data"_ page alongside versioning.

⚠️ **One thing to confirm before committing, and it is decisive**: whether Linode exposes Object
Lock's **COMPLIANCE** mode or only **GOVERNANCE**. Only COMPLIANCE is genuine WORM; GOVERNANCE can
be bypassed by a principal holding `s3:BypassGovernanceRetention`, which makes it a policy control
rather than a physical one. The doc page is a JS shell and did not yield the answer. **Do not assume
it from S3 compatibility** — this is a fact about someone else's software and this repo's rule is
that such facts get executed against, not inferred.

⭐ **The hash makes the mode question survivable rather than blocking.** With the SHA-256 held in
the document store and the bytes in object storage, even GOVERNANCE mode is **tamper-EVIDENT**: a
privileged user could destroy an object but could not alter one undetectably. That is weaker than
WORM and it is not nothing — **a fourth reason the hash is the first thing to build.**

## PII — the lock and erasure collide, and redaction cannot resolve it

**1. ⭐⭐ The retention lock forbids deletion, which is the headline.** A locked bucket means an
erasure request **cannot be honoured** for seven years. Retention for a tax obligation is a
recognised lawful basis for refusing erasure — **but that defence covers only what is NECESSARY for
the purpose.** A whole thread carrying unrelated conversation is more than necessary, and that is
precisely where a defensible retention becomes an indefensible one.

**2. ⭐⭐ THE SHARPEST TENSION: verifiability and minimisation are in DIRECT CONFLICT, and it cannot
be resolved by redacting.**

- Verifiability needs the message **raw and unmodified** — DKIM signature, full headers, complete
  MIME.
- **Redacting anything breaks the DKIM signature and changes the hash.**

⇒ **You cannot minimise after capture.** The only lever is **choosing what to capture**, and that
choice is made once, irreversibly, at the moment of selection. **This is not a trade-off that can be
deferred to a later cleanup.**

**3. ⇒ Capture the single MESSAGE, not the thread**, wherever the assertion sits in one message. A
thread is context, and context is other people's words about other things. **The picker's default
should be one message with the thread available**, not the reverse.

**4. ⚠️ Attachments are the highest-risk part and deserve their own decision.** A production
company's thread may carry call sheets, contracts and **crew lists** — and a crew list is exactly
the payroll-adjacent personal data the workspace rule warns about. **Capturing attachments blindly
is the one part of this design that could store something genuinely sensitive for seven years
without anyone choosing to.**

**5. This is a deliberate exception to the workspace rule, and should be recorded as one.** The
standing rule is _"record structure and aggregates, never rows"_ — an email snapshot is rows. **The
exception is justified (the artifact IS the evidence; an aggregate cannot corroborate an assertion),
but a reasoned exception that nobody wrote down becomes a precedent nobody intended.**

**6. B2B mitigates and does not exempt.** These are business contacts at production companies rather
than consumers, which lowers the risk profile — it does not remove the data from scope.

**7. Two smaller obligations worth naming**: retention periods generally have to be **disclosed** in
a privacy notice, and production companies are frequently California entities; and the evidence
store becomes **the most sensitive store in the system**, so its access control is a first-class
question rather than an operational detail.

## What this changes about the plan

- **Target Linode Object Storage**, not GCS — and confirm COMPLIANCE mode before locking.
- **Default the picker to one message**; make whole-thread capture a deliberate act.
- **Decide attachments explicitly** — probably exclude by default.
- **Write the exception down** against the workspace's PII rule rather than drifting past it.
