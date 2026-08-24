---
kind: decision
title: >-
  Owner scopes the image manager — a CDN re-evaluation where most of Uploadcare went unused, three
  jobs of which TWO are fulfillment evidence rather than decoration, and Quo arrives as a wholly new
  boundary carrying outbound messaging and a bidirectional contact sync
contexts: [fulfillment, ordering, billing]
source: "owner, 2026-08-23, in session"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-23:

> images will be stored in a cdn uploadcare will be re evaluated against imgx and any other suitable
> contender (most of what i thought i wanted out of uploadcare i ended up not using, we rolled our
> own image elemnt and will be rolling our own uploader, we rolled our bgremove, what we need is
> signed uploads, custom domain. needs will evolve, its an image manager for 2 things. 1) images for
> use in public webapp, manager can remove bg and preview light/dark mode, so im maybe interested in
> the smart focus stuff that uc does. 2) employees take photos of what is delivered and setup and
> text it to delivery contacts via quo 3) employees take pictures of trash pickups and text them to
> contacts via quo // totally unrelated contact crud should sync w/ quo

## ⭐ This is the case gate 23 exists for and CANNOT see

Gate 23 (added the same day) makes `OQ-058`'s prerequisite entity list inclusive, so a new
`contexts/<ctx>/entities/` file fails the build until it is registered. Its own note says: **"Green
here means 'every registered entity is named', never 'every entity that exists is registered'."**

⇒ **Here is a domain being discussed with no entity file at all.** The gate is green and the domain
is unregistered, exactly as documented. ⚠️ **The limit is real and it bit within hours** — which is
the argument for the note line rather than against the gate.

`OQ-058` already anticipated this in prose: _"if attachments become first-class they need their own
entity and an entry here"_. **They are becoming first-class.**

## 1. The CDN — what is actually needed is much smaller than what was bought

⭐ **The finding is a NEGATIVE one and it is the useful half**: _"most of what i thought i wanted
out of uploadcare i ended up not using."_ CFS rolled its own image element, is rolling its own
uploader, and rolled its own background removal
(`code:2026-08-23:api-cloudrun@bbb791af:src/lib/bgRemove.ts`).

| need                     | status                                                 |
| ------------------------ | ------------------------------------------------------ |
| **signed uploads**       | required                                               |
| **custom domain**        | required                                               |
| smart focus / crop       | _maybe_ — the one Uploadcare feature still of interest |
| background removal       | ❌ already rolled in-house                             |
| image element / uploader | ❌ already rolled / being rolled in-house              |

⇒ **Re-evaluate Uploadcare against imgix and any other suitable contender.** ⚠️ **And note the
shape**: a vendor was adopted for a bundle, the bundle was mostly unused, and the residual
requirement is two commodity features. **That is a migration-cost argument, not a loyalty one** —
switching cost is now low precisely because so little of it is used.

⚠️ **There is NO ADR adopting a CDN for v2.** `ADR-0027` adopted Mapbox and Resend at the boundary
and `ADR-0028` the self-hosted tier (Gotenberg, Victoria). **The CDN is a boundary service with no
decision**, and Uploadcare survives in the spec only as `migration/field-map.yaml` collections and a
warning inside `OQ-049`.

## 2. ⚠️⚠️ TWO OF THE THREE JOBS ARE EVIDENCE, NOT DECORATION — and they have opposite requirements

- **Job 1 — public webapp imagery.** Product/marketing pictures. Manager removes background and
  previews light/dark. **Master data**: authored, replaceable, no retention duty.
- **Job 2 — photos of what was delivered and set up**, texted to the delivery contact.
- **Job 3 — photos of trash pickups**, texted to contacts.

⇒ **Jobs 2 and 3 are proof of delivery and proof of condition.** Captured in the field by an
employee, attached to a leg or a trip, transmitted to a customer contact. **They are evidentiary,
and evidence has retention and immutability duties that a CDN with a reaper actively fights.**

⭐ **The repo already learned this exact lesson, one artifact over.**
`inbox/2026-08-22-design-input-the-gmail-evidence-picker-store-raw-mime-hash-it-verify-dkim-at-capture-and-keep-it-out-of-the-reaper.md`
says: _"Keep it OUT of a store that has a reaper. `uploadcare-sweep` deletes orphaned CDN files."_
**Second instance, same shape** — and it pulls through to erp-spec#49 (the evidence retention lock).

⇒ **A single "image manager" spanning all three jobs is a category error unless the evidence half is
separated at the storage layer.** One is a replaceable asset; the other is a record.

## 3. ⭐ It reaches SPIKE-013, and the queue has not considered blobs

Field photos are taken **where the signal is worst** — at a delivery, on location. That is precisely
`SPIKE-013`'s "manager out on location" case. ⚠️ **But the offline queue as designed carries FIELD
WRITES: small, coalescible by `(document, field path)`, replayed as diffs.** A photo is a **blob** —
megabytes, not coalescible, and its idempotency story is upload-level rather than field-level.

⇒ **`SPIKE-013`'s exit criteria do not cover blob capture, and should.** A queue that handles
`qty: 2` and a 4 MB JPEG identically has not been designed for the second.

## 4. Quo — a wholly new boundary, and the contact sync is the sharp end

**`Quo` appears NOWHERE in the spec or in v1** — verified 2026-08-23, the only matches for `quo` are
the phrase "status quo". It arrives carrying two obligations:

- **Outbound messaging** — texting photos to delivery contacts. ⚠️ **Overlaps `ADR-0027`'s Resend
  adoption**: CFS would then have two outbound channels to a customer contact, and whether there is
  one messaging abstraction or two is undecided.
- ⚠️⚠️ **"contact crud should sync w/ quo"** — and _sync_ is doing a lot of work in that sentence.
  **Which side is authoritative? Is it bidirectional? What happens when both change a contact?** ⭐
  **That is the three-way merge problem again, across a system boundary** — and unlike the
  in-document case there is no shared base to diff against unless one is kept deliberately.
- **`ADR-0009` governs it**: foreign identifiers never enter domain models, and an unresolvable id
  is a hard error rather than a null. A Quo contact id is a foreign identifier and needs boundary
  translation with an explicit unmapped path.
