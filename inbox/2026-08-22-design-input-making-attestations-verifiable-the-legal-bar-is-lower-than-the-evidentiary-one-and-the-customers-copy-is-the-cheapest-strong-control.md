---
kind: decision-input
title: >-
  Design input — making attestations auditable: the legal bar is lower than the evidentiary one,
  the artifact to hash is the RENDERED INSTANCE rather than the clause version, and sending the
  customer a copy is the cheapest strong control anyone can buy
contexts: [tax, billing, ordering]
source: >-
  Owner question, 2026-08-22. Pattern reuse from `adr/ADR-0006` and `adr/ADR-0017`. ⚠️ The ESIGN /
  UETA characterisations below are from general knowledge and were NOT read from primary statute in
  this session.
confidence: low
promotes_to: []
verified: false
triage_count: 0
---

⚠️ **`verified: false` and `confidence: low` deliberately.** The statutory framing is stated from
general knowledge and no primary source was extracted. **A lawyer confirms this, not a spec.** What
is solid here is the engineering, not the legal characterisation.

## The framing that decides how much to build: two different bars

**The LEGAL bar is low, and technology-neutral.** ESIGN and UETA define a signature as a symbol or
process _executed or adopted with the intent to sign_ — **cryptography is not required.** A checkbox
with intent is a signature. What the statutes do care about is **intent**, **attribution**, and a
record **capable of accurate reproduction**.

**The EVIDENTIARY bar is higher**, and it is the only one that matters in a dispute: can CFS show
_who_ did _what_, _when_, and _to which exact text_ — and show that the record was not made up
afterwards.

⇒ **Everything below buys evidentiary strength, not legal validity.** Build to the value at risk.

## What to build, ranked by what it actually buys

**1. ⭐⭐ Capture the ACT, not the outcome.** The commonest failure is storing `accepted: true` and
losing everything that made it meaningful. The record needs: authenticated identity, the **exact
rendered text**, the timestamp, the client's IP and user-agent, and **what the affirmative act was**
— a ticked box, a typed name, a click on a specific control.

**2. ⭐⭐ Hash the RENDERED INSTANCE, not the clause version.** A version id points at text that can
change; a hash of the exact bytes that user saw is what makes _"capable of accurate reproduction"_
checkable rather than asserted. ⚠️ **And the subtlety that gets missed**: an attestation page
interpolates their name, the order number, the jurisdiction. **Hashing the TEMPLATE lets you
reproduce a template — not what they saw.** The hash must cover the instance. ⭐ **This is
`ADR-0006`'s existing pattern, not a new one**: _"the Parquet file is the audit artifact, and its
hash goes into the close record."_ Same shape, different artifact — **reuse the discipline rather
than inventing a second one.**

**3. ⭐⭐ Send the customer a copy at the moment of signing.** Underrated, and nearly free — Resend
is already in the stack. It places a copy **outside CFS's control**, so CFS could not have
fabricated or altered the record later without the counterparty's copy disagreeing. **Per dollar
this is the strongest attribution evidence available**, and it costs one email.

**4. Hash-chain the audit entries.** Each entry includes the previous entry's hash, so a retroactive
edit breaks the chain from that point forward. No external dependency, and strictly stronger than
isolated per-record hashes — **isolated hashes prove a record was not altered; a chain proves none
were, and that none were removed.**

**5. Append-only by construction, and an attestation is an EVENT.** It fits the `EVT-` discipline
already in this spec — events are appended, never updated — so the append-only property comes from
the existing model rather than from a new rule someone must remember.

**6. State the identity strength rather than leaving it implicit.** Email-verified identity is
typical for B2B and is probably sufficient here; what matters is that the spec **says which**, so
attribution strength is a known quantity rather than an assumption.

**7. ⭐ Actually exercise the reproduction path.** The statutory requirement is that the record can
be accurately reproduced. **A reproduction path nobody has run is this repo's own footgun** — an
unexercised branch is a claim, not a capability. Land it red: prove a stored attestation re-renders
byte-identically to its hash.

## What to skip, and why

- **RFC 3161 trusted timestamping.** Proves a record existed at time T without trusting CFS's clock.
  ⚠️ Adds an external dependency for something **the customer's own copy plus a hash chain already
  covers most of**. Revisit only if disputes become real.
- **A third-party signing vendor (DocuSign and similar).** Their genuine value is **third-party
  attestation** — a certificate of completion from someone with no stake. That is worth money when
  the value at risk is high. ⭐ **And that is the question to ask rather than answer generically: a
  jurisdiction attestation protects roughly seven points of tax on one order; a rental agreement
  protects the replacement value of the equipment.** Those may deserve **different answers**, and
  treating them as one decision is how a spec either over-builds the small case or under-builds the
  large one.

## ⚠️ One thing that is genuinely hard and should not be hidden

**Clock trust.** Every timestamp here is CFS's own. The hash chain proves ordering and
non-alteration; it does not prove _when_. The customer's copy carries an independent mail timestamp,
which is the practical mitigation. **Say so rather than implying the timestamp is authoritative on
its own.**
