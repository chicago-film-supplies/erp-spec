---
kind: survey
title: >-
  Survey — can decision artifacts become typed booleans? The criterion is that something EXECUTES on
  the statement, not that its terms are enumerated; the vocabulary emerges from the statements in
  every tradition measured; and 23% of load-bearing content carries no proposition at all
contexts: [ledger, billing, fulfillment]
source: "EARS (Mavin et al., RE'09) · Arora/Sabetzadeh/Briand/Zimmer, IEEE TSE 2015, 1,760 industrial requirements · NASA FRET + the Lockheed Martin ten-challenge case study · Newcombe et al., Use of Formal Methods at AWS · Kuhn, Computational Linguistics 40(1) 2014 + Fuchs CNL 2018 on ACE comprehension · SBVR 1.5 (OMG, measured from the PDF) · Business Rules Manifesto · ASD-STE100 · MADR 4.0.0 · Noy & McGuinness, Ontology Development 101 · Daston's thin/thick rules via Lindeberg et al. arXiv:2402.13637 · W3C SHACL · IRS Topic 751 · and an empirical decomposition of ten artifacts of this repo"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Owner, 2026-08-17: _"contemplate feasability of boiling adrs, hots, oqs, and other decision
artifacts down to t/f statements (boolean bullet points w/ strict types/schemas) maybe thats v3/v4
maybe its now, i think wed need to nail domians tagging labeling type stuff"_.

Three independent investigations: an **empirical** decomposition attempt on ten real artifacts, a
**prior-art** survey of six traditions, and an **adversarial** cost/sequencing review. They were run
without sight of each other and they converge.

## The criterion

**A statement can be a typed boolean when (a) its terms denote things this repo has already minted
an identifier for, and (b) SOMETHING EXECUTES on it and someone acts on the red.**

**(b) is the binding half**, and the evidence is one-sided:

- **OASIS Test Assertions Model** (OASIS Standard 2012) is the closest formal model ever built of "a
  boolean bullet point with strict types" —
  `{id, NormativeSource, Target, Prerequisite, Predicate,
  Prescription}`. **GitHub code search: 13
  files in all of GitHub.**
- **Kruchten's decision ontology** (2004) — 12 typed relationships, 7 states, 4 well-formedness
  rules — is the most-cited typed-decision model in the field. **The checker was never built.**
- **SBVR** — business rules as typed statements over a defined vocabulary, i.e. literally this
  question — is **334 pages and 515 defined meta-terms**, v1.0 in 2008, **v1.5 in 2019 and nothing
  since**. OMG's own page names no implementations.
- **MADR 4.0.0**'s `Confirmation` section asks exactly for (b) — "is there any automated or manual
  fitness function?" — and after thirteen years of ADR practice it is **still optional and
  untooled**.
- **Modal typing is decoration**: RFC 3986 (URI) and RFC 8200 (IPv6) contain **zero** RFC 2119
  keywords. Where mechanisation happened it happened through a grammar, a schema or a test suite.

⇒ **This repo already runs on (b)**, and its own numbers say so: `formal/*.qnt` is **279 lines
carrying exactly four predicates**, each with a deliberately-wrong companion that must fail; and
**20 of 21 requirements are `verification_method: test`**. Testability was the de facto promotion
filter. The 21 requirements are not "the part that got formalised" — they are the statements that
could be tested.

## The second cut, and it decides how much of an ADR can move

**Type the CLAIM. Never type the REASON.** Every tradition that typed the claim and left the
argument in prose survived — RFC modal verbs, EARS, MADR, FRETish, Quint invariants. Every tradition
that tried to type the _rationale_ produced a standard nobody implemented: SBVR, Kruchten, and the
whole design-rationale/AKM line, whose own retrospective (Capilla et al., JSS 2016) reads _"despite…
the large number of research tools that had been built, we did not find systematic uptake"_, with
the named barrier being that capture cost is **immediate** and the benefit is not.

## Measured on this repo: what actually decomposes

Ten artifacts (ADR-0010/0019/0030/0036/0038, HOT-016/017, OQ-050/052/053), **13,329 words, 202
load-bearing claims**:

|                                     | claims | share |
| ----------------------------------- | -----: | ----: |
| **clean** — types already exist     | **80** |   40% |
| **need a type that does not exist** | **76** |   38% |
| **resist decomposition entirely**   | **46** |   23% |

⚠️ **The claim-count fraction is not the content fraction.** Three worked decompositions: 1,019
words of source prose → 17 typed propositions of ~170 words. **~83% of the load-bearing prose is the
connective reasoning between propositions**, not the propositions.

✅ **Measurements are the exception and decompose ~95% cleanly** — every measured figure already has
a `source:` type from _Verification etiquette_.

⚠️ **The clean rate is inversely correlated with how BUSINESS-shaped the artifact is.** ADR-0036
(representation: fields, paths, counts, codes) is 46% clean. ADR-0030 and ADR-0038 (accounting
judgement) are 35% and 33%. OQ-053 (a decision nobody has made) is 27%. **What types cleanly are the
claims about the repo's own machinery, not the claims about the business.**

## What resists, characterised

Retraction and history claims (_"this read X until DATE"_ — 6 in ADR-0019, 6 in ADR-0030);
reasoning-about-reasoning (_"structurally the same defect as leaning on 5200: reasoning from a
source that is not the authority for the number needed"_); comparatives and counterfactuals; claims
about a reference SYSTEM's behaviour (11 in ADR-0019, 16 in ADR-0030 — typeable in shape, and
**nothing can execute against SAP**); claims conditional on an unstated premise; judgement-grounded
claims (materiality, which ADR-0030 records has **no GAAP threshold** — untypeable by design); and
warnings addressed to a future reader.

⚠️ **Two artifacts turn on the observation that an obvious enum was the WRONG TYPE.** OQ-050 asked
"per person, or aggregate?" — the measured answer is **neither**: wages are per person, burden is
per run. ADR-0019: _"'Actual vs standard' was a false binary."_ **Typing an answer space before the
measurement forecloses it**, and the prose had somewhere to put "neither, and here is why".

## The sequencing question: the vocabulary emerges from the statements

**"Nail the domains first" is a trap in the strong form.** Six independent lines of evidence:

- **EARS' own case study** achieved its fit by evolving the grammar: _"Those that could not [be
  written in a template] were either manipulated to fit the ruleset or **the ruleset was
  evolved**"_.
- **Arora et al., 1,760 industrial requirements**: the glossary produced **no accuracy gain**, and
  the highest-conformance corpus in the study — 890 nuclear regulatory requirements at **96%** — had
  **zero glossary terms**. ⚠️ And the typed distinctions collapse: of 297 conformant requirements in
  one case, **290 were the degenerate no-condition form**. The typed branches earned their keep on
  **1.8%** of statements.
- **SBVR is the controlled experiment for vocabulary-first** — it adopted _"rules build on facts,
  and facts build on concepts as expressed by terms"_ as its founding axiom and produced no
  ecosystem in 23 years.
- **ASD-STE100 is the controlled experiment for the weak form** — 53 rules and ~900 approved words,
  **domain vocabulary deliberately NOT enumerated** (technical nouns and verbs admitted by rule, per
  company) — and it is mandated across aerospace, 40 years on.
- **Ontology Development 101**: scope is a function of **competency questions**, i.e. of the
  statements you intend to make; _"there is no single correct ontology for any domain"_.
- ⚠️ **This repo is the local proof.** 142 chart accounts, 16 posting rules, 38 events, 14 vector
  directories, 27 gates — against a `glossary.yaml` of **28 terms, one still `definition: TODO`**.
  The typed surface grew to 142 accounts; the glossary did not move. **The ledger is the most
  enforceable part of the repo and nobody nailed a domain first.** The four Quint invariants range
  over **six constants minted inside the model**.

✅ **The weak form that IS real: local closure at the point of assertion.** Daston's condition for a
thin rule is that _"materials and measures must be standardised"_ — the **referents**, not the
labels. A predicate over `5801` worked because the chart existed. ⇒ **Write the claim; if a term in
it does not denote yet, mint that one term; if minting it turns out to be the hard part, that is not
a vocabulary gap — it is an undecided question and belongs in `open-questions.yaml`.**

## The cost side, and the two findings that changed the recommendation

- ⚠️ **On this repo's own recent defects, a typed-claim corpus prevents ZERO outright.** Three
  become "on a work list" (conditional on the whole migration); one — a gate arm counting a
  **blank** reason as coverage — is prevented by field-level strictness, which is not this proposal.
  Against that, **counting gates and enum-resolution gates prevented four to five in one week**
  (gates 10q, 16, 10r, 18). The repo's own doctrine points at more of the cheap thing.
- ⚠️ **The substrate cannot be migrated.** ~88 `inbox/` notes are append-only by lifecycle rule and
  28 ADR bodies are hash-frozen, so the best reachable end state is **a typed index over an untyped
  substrate whose coverage is permanently under 100%** — answering queries with a partial answer
  indistinguishable from a complete one. That is the `m3` misreading with the whole spec as its
  blast radius.
- ⚠️ **Vocabulary stability is the precondition, and this repo fails it by two orders of
  magnitude.** Measured over ~9 days: `cost_type` → `labor_line` (3 values → 7); ADR-0008 → ADR-0018
  → ADR-0036 (three taxonomies of one axis, the third deleting `dimensions:` from all 139 chart
  entries); `Transport` dropped then restored; `labor_line_kinds` written then collapsed; `5801`
  minted then deleted with 34 files moving. **≥6 revisions in 9 days.** And when `labor_line` grew 3
  → 7, the `transport` pool's `labor_line: delivery` **stayed type-valid while becoming wrong** — a
  type system does not migrate meaning, it makes stale meaning type-valid.

## ⚠️ The strongest pro-typing datum INVERTED on the owner's own ruling

The empirical attempt found a real defect — ADR-0019's burden arithmetic treats Social Security as
capping mid-season (HOT-018) — **by writing the components as a table with a cap-base column**, and
that was recorded as the case FOR typing. Owner, 2026-08-17: _"we dont run payroll direct, we dont
track futa or suta or any of that."_

⇒ **The type that would have caught it is a type this spec must not have.** Carrying
`BurdenComponent[]` would model a vendor's payroll engine as a side effect of wanting a rate. **The
root cause was not a missing column — it was reasoning two layers down into someone else's ledger.**
A component breakdown of a number you do not compute is a claim you cannot check.

## Recommendation

1. **NOW, and it has already paid: type the MEASUREMENTS.** ~95% clean, every one already carries a
   `source:`, and the first attempt found a defect in a frozen ADR that had survived acceptance, a
   six-reference survey, a correction to the very same bullet, and twenty gates.
2. **NOW, scoped: `asserts:` where ADR-0037 ruled it, concentrated on `kind: premise` over Context
   claims** — the factual, dated, provenanced half. That is what every working system types: the
   claim's **source**, not its **content**. It gives a frozen ADR the instrument it lacked when a
   fact it cited measured false.
3. **⚠️ RE-DECIDE the backfill scope (ADR-0037 ruling 3).** Two findings arrived after the ruling:
   the "afternoon" estimate was **a figure of a different population** (38 × one boolean derived
   from a written criterion, versus ~450 statements each needing three judgements); and
   back-migrating `asserts:` onto 28 frozen bodies **manufactures a historical record rather than
   recording one** — writing "what ADR-0030 rested on" today is a reconstruction by someone who was
   not there, which ADR-0034 exists to prevent, and freezing it makes the reconstruction permanent.
4. **NEVER: the domain-taxonomy-first program.** It would be built on top of OQ-046, OQ-052 and
   OQ-053 — all open, all vocabulary-defining, and one of them (OQ-053) pointing the opposite way to
   the charter.
5. **v3/v4 for the full corpus, gated on conditions someone can check**: vocabulary stable under one
   revision per quarter (currently ≥6 per 9 days); a claim-to-body check demonstrated RED on a real
   paraphrase before a single claim is written (the fixture exists — `charter.md`'s "actual-cost
   absorption" against "costed at actual"); and a **second consumer** of the spec, because every
   claim corpus that paid off had one and this repo has `deciders: [repo owner]` on all 38 ADRs.

## ⚠️ A process footgun found while doing this

One agent's first fetch of the EARS paper **returned a clean before/after defect table and a ">95%
of requirements fit" claim. The paper contains neither.** It was caught by pulling the PDF and
extracting the text locally. **A summarised fetch can fabricate exactly the artifact you went
looking for**, and the more the expected shape is stated in the prompt, the more likely it is to
come back. Extract the primary source before quoting a number from it.
