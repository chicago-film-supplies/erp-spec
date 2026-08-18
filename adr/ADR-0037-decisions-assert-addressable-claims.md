---
id: ADR-0037
title: An id carries meaning where it is used — a headline on every id, and addressable claims inside a decision
headline: ids carry meaning where used
status: proposed
date: 2026-08-17
review_by: 2026-12-01
deciders: [repo owner]
contexts: [ledger]
relates_to: [ADR-0019, ADR-0030, ADR-0034, HOT-016]
accounting_shaped: false
not_accounting_reason: >-
  It names `5801`, `5900`, `5901`, `5902`, `6409` and `6302` **only as examples of the citation rule
  it is proposing** (`#### - Name` on first mention). It decides how a decision is WRITTEN — ids
  carrying meaning where used, premises typed apart from decisions — and nothing about where an
  amount posts. The tripwire is doing its job: the flag is now a claim someone can argue with
  instead of a silence.
supersedes:
supersedes_on_acceptance:
superseded_by:
---

> **In the context of** a spec whose authority is prose, **facing** a measured 22:1 mismatch between
> what is cited (a document) and what is claimed (about twenty statements inside it), **we decided**
> that an ADR additionally asserts individually addressable claims, typed as decision or premise,
> **to achieve** corrections that can be swept and premises that can go stale without touching a
> frozen decision, **accepting** a second surface on every ADR and a convention that only pays off
> as it is adopted.

## Context

- **Citations are document-grained and claims are not.** Measured 2026-08-17: ADR-0036 is cited
  **249** times, ADR-0019 **132**, ADR-0017 **114**, ADR-0018 **108**. ADR-0019 is 212 lines making
  roughly **22** distinct load-bearing claims. When one claim is refuted, all 132 citations become
  ambiguous and nothing identifies which depended on it.
- **The dominant defect class is a claim restated in N places where only some are updated.** It has
  produced HOT-011, HOT-015 and HOT-016. HOT-016 alone found **five** mutable artifacts repeating a
  refuted claim, two of them left behind by the amendment that discovered it, and a sixth stale
  citation inside the hotspot recording the pattern.
- **An accepted ADR freezes its supporting premises alongside its decision.** ADR-0030 was frozen
  2026-08-16 asserting "labor is costed at actual" as a contrast; the payroll exports refuted it on
  2026-08-17. The decision was unaffected and the premise could not go stale on its own, so the only
  available instrument was a hotspot — for a fact nobody had decided.
- **`relates_to` already carries ids and is deliberately outside the frozen hash** (ADR-0034), which
  establishes the pattern: front matter is the addressable surface, prose is the narrative one.
- The repo already applies this reasoning to one fact — _"a fact about a third-party API has ONE
  owner in the structured spec"_ — but only to that fact, not to claims in general.

## Decision

**An ADR carries an `asserts:` block in front matter**, naming each load-bearing claim with an id, a
kind and a one-line statement. The prose body is unchanged and remains the reasoning of record.

```yaml
asserts:
  - id: A1
    kind: decision
    claim: Labor costing is normal costing — wages actual, burden apportioned.
  - id: A3
    kind: premise
    claim: CFS pays actual per-person wages rather than standard rates.
    depends_on: [OQ-050]
```

**Claims are addressed as `ADR-0019/A1`.** Anything that depends on a specific claim cites the
claim; citing the bare ADR remains legal and means "this decision as a whole".

**`kind` is `decision` or `premise`, and they are frozen differently.**

- A **decision** is frozen at acceptance exactly as today.
- A **premise** is a fact the decision RESTED ON. It is not frozen. It may be marked
  `status: refuted` with a pointer to what refuted it, **without touching the decision and without a
  hotspot**, because nothing contradicts anything: the decision still stands and the fact it cited
  was wrong, which is ADR-0034's third row made structural instead of narrative.

**`asserts:` is adopted going forward, not back-migrated.** New and amended ADRs carry it; the
existing 36 gain it only when they are next touched for another reason.

### And every id-bearing entity carries a `headline:`

**Amended 2026-08-17, on the owner's observation, and the observation was a live demonstration:**
the session recommending next steps wrote "ADR-0037" three times without saying what it was, in the
message asking which work to do — and the owner had to ask.

⚠️ **Measured: none of the four id-bearing kinds has a short form.** `ADR.title` runs **11 to 23
words** (ADR-0019's is 23); `OQ.question` and `SPIKE.question` are full sentences; `HOT.statement`
is a paragraph. Nothing is inlineable, so every citation in prose is a bare id.

⇒ **`headline:` — at most 12 words, ideally under 5** — on `ADR`, `OQ`, `HOT` and `SPIKE`. It is
**distinct from** `title` / `question` / `statement`, which are unchanged: those say what the thing
IS, and a headline is what it is CALLED when referred to elsewhere.

```yaml
id: ADR-0030
headline: vehicle cost into COGS
title: Vehicle cost moves from operating expense into COGS, absorbed and unabsorbed
```

**Prose citing an id carries the headline on FIRST mention in a file** —
`ADR-0030 (vehicle cost
into COGS)` — and bare ids thereafter. First-mention only, because that is
where a reader needs it and repeating it everywhere is the noise that gets conventions abandoned.

### GL accounts are the third scale, and they need NO new field

Owner, 2026-08-17: the same rule for ledger accounts — `#### - Name`. ⚠️ Another live demonstration:
the same session wrote `5801`, `5900/5901/5902/6409`, `6302` and `5200` throughout without once
saying what any of them were.

✅ **Convention only, no schema change** — `ledger/chart-of-accounts.yaml` already carries `name` on
every entry, which is what `ADR`, `OQ`, `HOT` and `SPIKE` lack. So accounts get the citation rule
and nothing else. **Cite `5801 - Cost of Goods Sold: Wages (Unabsorbed)` on first mention in a
file**, bare after.

⚠️ **A trap for whoever writes the gate, measured so it is not re-discovered:** a naive `\b\d{4}\b`
matcher fires on **616 instances of `2026`** — the year — across `ledger/`, `reporting/` and
`contexts/`. The pattern must be **the set of codes actually in the chart**, not four digits.
Current bare-reference counts: `5800` 71, `2010` 79, `2000` 63, `5801` 40, `2050` 37.

⚠️ **This is the same insight as `asserts:` at a different scale.** `asserts:` makes a claim
addressable INSIDE a document; `headline:` makes the document meaningful AT the point of citation;
the account rule does the same for a number that already has a name nobody writes. Both exist
because an id that carries no meaning where it is used forces the reader to go and look — and the
reader usually does not.

## Considered options

- **A separate facts registry** — one file owning every measured fact, with prose citing ids.
  Rejected as the primary instrument: it separates a claim from the reasoning that produced it,
  which is the thing this repo's ADRs are unusually good at. It also demands back-migration to be
  useful at all, where `asserts:` pays off from the first ADR that carries it.
- **A hard fork or greenfield spec.** Rejected. The defects are representational, not accumulated —
  a new repo reproduces all of them on day one, and it would discard machinery that demonstrably
  works: gates 11 and 14–17 caught four defects on 2026-08-17 within minutes of existing.
- **Prose discipline alone** — a rule saying "sweep every restatement". Rejected on evidence: that
  rule exists, in several forms, and was violated five times in one day by the session that wrote
  the latest version of it. ⚠️ A guarantee nothing executes is not a guarantee.

## Consequences

- **A gate becomes possible that is not possible today: an assertion's content may not be restated
  outside its owner.** That is the direct attack on the dominant defect class, and it can only be
  written once claims have identity.
- **Correcting a claim becomes a sweep with a work list.** "What cites `ADR-0019/A1`" is answerable;
  "what restates the idea in ADR-0019" is not.
- ⚠️ **HOT-016 would not have needed to exist.** ADR-0030's contrast would have been
  `kind: premise`, marked refuted against the payroll measurement, with its decision untouched. The
  hotspot mechanism stays for genuine contradictions between live statements.
- ⚠️ **The `resolved_by` gap HOT-016 exposed is adjacent and NOT fixed here.** That field's implicit
  contract is "the DECISION that settled it" where the real contract is "the AUTHORITY", which may
  be a measurement. One instance is not a pattern; recorded, not widened.
- **Two surfaces per ADR to keep in step**, and the failure mode is a stated claim the body does not
  make. ⚠️ **Mitigation is a gate, not care** — every `asserts[].claim` must appear in substance in
  the body, checked as a presence test rather than a similarity score, which is the weakest useful
  form and is stated as weak rather than sold as strong.
- **Adoption is gradual, so the gate cannot be universal for a long time.** It fails only on ADRs
  that carry `asserts:`. ⚠️ That is a check whose silence means "not adopted here" rather than
  "nothing wrong here", and it must say so in its own output or it will be misread exactly the way
  `m3` is misread today.
- **`headline:` is cheap to add and cheap to check**, and unlike `asserts:` it CAN be back-migrated
  in one pass — 36 ADRs, ~50 OQs, 16 hotspots, 12 spikes. ⚠️ Its gate is the harder half: detecting
  a bare id that owes a gloss means detecting the ABSENCE of a phrase, so the workable form is "the
  first mention of an id in a file is followed by a parenthetical", which is crude and will need an
  exemption list. **State it as crude rather than selling it as precise.**
- ⚠️ **A headline is a claim too, and it will rot.** `ADR-0019`'s own title asserted something false
  for a day before anyone noticed. A short form is easier to leave stale than a long one, precisely
  because it is glanced at rather than read.
- **Nothing about the three lifecycles changes.** `inbox/` stays append-only, `adr/` bodies stay
  immutable at acceptance, and `contexts/` stays refactorable.
