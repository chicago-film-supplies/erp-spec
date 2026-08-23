---
kind: research
title: >-
  ESIGN and Illinois UETA read from statute — the teeth are Illinois §8(c), which makes a record
  UNENFORCEABLE if the sender inhibits printing or storing and cannot be varied by agreement;
  attribution is "in any manner"; and a B2B rental escapes the consumer regime entirely
contexts: [tax, billing, ordering]
source: >-
  Primary text extracted 2026-08-22 with curl + local tag-stripping — never a summarizing fetch.
  Federal text cross-checked verbatim between law.cornell.edu and govinfo.gov (USCODE-2023-title15).
  Illinois from ilga.gov, `815 ILCS 333/`, P.A. 102-38 eff. 2021-06-25.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

⚠️ **This is statutory text, not legal advice.** It settles what the statutes SAY; whether CFS's
arrangements satisfy them is a lawyer's call.

## ⭐⭐ THE FINDING THAT CHANGES THE DESIGN: Illinois §8(c)

> **815 ILCS 333/8(c)** — "If a sender inhibits the ability of a recipient to store or print an
> electronic record, the electronic record **is not enforceable against the recipient**."

with §8(a): a record "is not capable of retention by the recipient if the sender **or its
information processing system** inhibits the ability of the recipient to print or store" it — and
**§8(d): these requirements "may not be varied by agreement."**

⇒ **Serving a signed agreement in a form that blocks download or print makes it UNENFORCEABLE**, and
no contract term can cure that. This is stricter than the federal analogue, ESIGN §7001(e), which
says enforceability _"may be denied"_ in the same situation.

⭐⭐ **This promotes "send the customer a retainable copy" from the best evidence per dollar to
something close to an enforceability precondition.** It was already the only artifact held outside
CFS's control once a third-party vendor was declined (owner, 2026-08-22); it is now also the thing
standing between the agreement and §8(c). **Two independent reasons, same control.**

⚠️ **And it constrains the UI, not just the storage.** A view-only, screenshot-hostile, or
download-disabled attestation screen is the precise fact pattern §8(a) describes.

## Attribution — Illinois §9, and it is permissive

> **815 ILCS 333/9(a)** — "An electronic record or electronic signature is attributable to a person
> **if it was the act of the person. The act of the person may be shown in any manner**, including a
> showing of the efficacy of any security procedure applied to determine the person to which the
> electronic record or electronic signature was attributable."

- **"in any manner"** is an open evidentiary standard with no threshold. Security procedures are an
  **example** ("including"), not a requirement.
- ⭐ **§2(14) defines "security procedure" to expressly include "identifying words or numbers"** —
  so **an emailed magic-link token or a password IS a statutory security procedure.** Email-verified
  identity is not a compromise position; it is named in the statute.
- ⚠️ **ESIGN has NO general attribution provision at all** — the only occurrence of "attribut" in
  §§7001–7006 is §7001(h), about electronic agents. **Attribution is state law**, so Illinois §9 is
  what the evidentiary design aims at.

## ✅ A B2B rental escapes the consumer disclosure regime

**§7001(c)**'s regime — paper-copy right, withdrawal right, hardware/software statement,
reasonable-demonstration consent, re-consent on system change — attaches only where **both** hold: a
**consumer** is a party, **and** some other law independently requires information be given to that
consumer **in writing**.

> **§7006(1)** — "The term 'consumer' means **an individual** who obtains, through a transaction,
> products or services which are **used primarily for personal, family, or household purposes**…"

Three cumulative elements; a production company fails the first and the third. ⚠️ **But the test is
the PURPOSE OF USE, not who signs** — a sole proprietor renting for personal use would be a
consumer. **That is a data question about CFS's own customer book, not a design assumption**, and it
is the kind of assumption that is safe until the one counterparty who breaks it.

⚠️ **Illinois has its own gate, and it is NOT consumer-limited.** §5(b): the Act "applies only to
transactions between parties **each of which has agreed** to conduct transactions by electronic
means," determined "from the context and surrounding circumstances, **including the parties'
conduct**." Not a disclosure regime — but it applies to every transaction, and signing through the
app is itself conduct evidencing agreement.

## Retention, and a timing anchor worth catching

> **ESIGN §7001(d)(1)** — the retained record must "(A) **accurately reflect** the information set
> forth in the contract" and "(B) **remain accessible** … in a form **capable of being accurately
> reproduced** for later reference, whether by transmission, printing, or otherwise."

⚠️ **§7001(d) imposes no freestanding retention duty** — it is conditional on some _other_ law
requiring retention. And **§7001(d)(2) puts transport metadata expressly outside it**: information
"whose sole purpose is to enable the contract or other record to be sent, communicated, or
received."

⭐ **Illinois §12(a)(1) adds an anchor ESIGN lacks**: accuracy is measured against the record "after
it was **first generated in its final form**." ⇒ **hash the final rendered form**, which is what the
design already says — and now it has a statutory reason rather than only an engineering one.

## ✅ No third party is required — confirmed from the text, not asserted

The definitions name only a sound, symbol or process, association with the record, and **intent to
sign**. A grep of the full Illinois act for "third party", "certification authority" and
"certificate" returns **one** hit — §18(b)(2), which lets a _governmental agency_ set requirements
for its **own** filings. Nothing conditions validity on a third party in a private commercial
transaction. **Technology neutrality is affirmatively protected** by §7002(a)(2)(A)(ii) and
§7004(b)(2)(C)(iii), which forbid according greater legal effect to a specific technology.

⇒ **the owner's "no third-party vendor" decision is not a compromise against the statutes; it is
what they were written to permit.**

## ⭐ Equipment rental is expressly IN scope

Both exclusion lists carve out the UCC **"other than … Articles 2 and 2A"** — and **Article 2A is
leases of goods**, which is what an equipment rental is. ⇒ preserved in scope by both statutes.

⚠️ **And one trap worth naming**: ESIGN §7003(b)(2)(B) excludes notices under "a **rental agreement
for, a primary residence of an individual**." That is residential tenancy. **The word "rental"
appearing in an exclusion list is exactly the kind of thing that gets misread**, so the qualifier is
recorded here rather than left to be rediscovered.

## ⚠️ A method finding worth carrying beyond this topic

**ILGA's redesigned site fails SILENTLY on a stale ActID — it serves a DIFFERENT statute with HTTP
200.** `ActID=4181` returned the Coal Tar Sealant Disclosure Act rather than UETA. **A pass that
trusted the 200 and summarized would have produced confident nonsense**, correctly formatted and
entirely wrong.

⇒ this is the repo's own footgun with a new face: **an HTTP 200 is not evidence that you fetched
what you asked for.** Check that the body is the thing named, not merely that a body arrived.

## What was NOT verified

- ESIGN subchapter II §7021 and Illinois §16 (transferable records) — not needed here; relevant only
  if promissory notes or documents of title enter scope.
- Illinois §15 (time and place of sending/receipt) — heading only.
- **Illinois case law on §9 attribution** — the statute is permissive on its face; how courts weigh
  particular evidence is not answerable from statutory text.
- The interaction between 815 ILCS 333/20.5 and ESIGN §7003(b). Does not affect equipment rental.
- Whether any CFS counterparty meets §7006(1) — a data question, not a legal one.
