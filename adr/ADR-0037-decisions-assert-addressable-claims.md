---
id: ADR-0037
title: An id carries meaning where it is used — a headline on every id, and addressable claims inside a decision
headline: ids carry meaning where used
status: accepted
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
frozen_sha256: 213b229029758384e10b71bbbcd4c1aa83a8105edba8e6737ce21e6ba75d22fe
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
- ⚠️ **RE-MEASURED BY LOCUS 2026-08-17 (evening), and the sweepable share is not the headline
  share.** Counting every occurrence and classifying the file it sits in
  (`code:2026-08-17:erp-spec`, all `.md`/`.yaml`/`.feature`/`.ts`/`.json`/`.opml`):

  | ADR      | occurrences | in MUTABLE spec | append-only + frozen ADR + generated |
  | -------- | ----------: | --------------: | -----------------------------------: |
  | ADR-0036 |         275 |   **231 (84%)** |                                   44 |
  | ADR-0019 |         178 |    **78 (44%)** |                                  100 |
  | ADR-0017 |         126 |    **61 (48%)** |                                   65 |
  | ADR-0018 |         118 |    **60 (51%)** |                                   58 |

  ⇒ **The argument survives and one of its numbers does not.** For ADR-0036 the citations really are
  overwhelmingly live and sweepable. For ADR-0019 **fewer than half are** — the rest sit in `inbox/`
  notes and frozen ADRs, where a citation meaning "as it stood then" is CORRECT and must never be
  rewritten. ⚠️ **This is the repo's own recorded lesson applied to this ADR's own evidence**: only
  live, mutable, authority-claiming copies count, and "the 17 a grep suggests" were three. The claim
  to make is about the mutable share.
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
  - ⚠️ **"Not frozen" must mean APPEND-ONLY, or the historical record leaks out through the unhashed
    door.** Gate 14 hashes the body and not the front matter, so a mutable `asserts:` block on an
    accepted ADR could be edited to say the decision rested on something it never claimed — and
    ADR-0034's whole point is that an accepted ADR records the decision **as taken**. ⇒ a premise's
    `claim:` text is frozen at acceptance exactly as the body is; only `status:` and a `refuted_by:`
    pointer may be added afterwards. **Nothing in this ADR says that yet, and a gate can enforce
    it** by hashing `asserts[].claim` alongside the body.

**`asserts:` IS BACK-MIGRATED — owner's ruling, 2026-08-17: _"backfill"_.** New and amended ADRs
carry it, and the **23 in-force ADRs are given one in a pass of their own**.

⚠️ **The draft said "adopted going forward… the existing 36 gain it when next touched", and that was
a hole rather than a preference.** An `accepted` ADR's body is immutable, so it is never touched
again for another reason — meaning the in-force ADRs would never have carried `asserts:` at all, and
they are precisely where the citations point (ADR-0036 is accepted and holds 231 live ones).
**Forward-only adoption excluded the entire population this ADR is written for.**

✅ **Back-migration is legal, and its MECHANICAL cost is measured rather than assumed.** Front
matter is not hashed (gate 14), which is exactly what let **38 ADRs gain `accounting_shaped:` and
six gain a `survey_exemption:` in one pass on 2026-08-17** for gate 19 — an afternoon, not a
project.

⚠️ **What it actually costs is JUDGEMENT.** Someone must read each frozen decision and say what its
load-bearing claims WERE, without the author present and without the right to amend the body. **A
claim added to a frozen ADR is a reading of it**, so the backfill inherits the body's freeze: once
written, an `asserts[].claim` on an accepted ADR is correctable only the way any other frozen text
is — by a later note saying so, never by an edit.

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
- ⚠️ **HOT-016 would not have needed to exist — OVERSTATED, corrected 2026-08-17 on its own
  record.** ADR-0030's contrast would have been `kind: premise`, marked refuted with its decision
  untouched, and that removes **one** of the instances. HOT-016's actual work was the other **six**:
  a golden vector, `glossary.yaml`'s `standard cost` term, `charter.md`'s in-scope bullet, and
  ADR-0019's own title and summary blockquote. Premise typing does not find those; **the sweep is
  the work and the hotspot is what tracked it**. What premise typing removes is the false position
  of a FROZEN document asserting a refuted fact with no legal instrument to say so. That is worth
  having and it is a smaller claim than "the hotspot would not have been needed".
- ⚠️ **AND THE STEP-2 GATE DOES NOT REACH THE DEFECT THAT MOTIVATES IT, because the defect is
  PARAPHRASE.** HOT-016's sweep missed the charter for a stated reason: _"the pattern was 'costed at
  actual' and the charter says 'actual-cost absorption'"_. A gate enforcing "an assertion's content
  may not be restated outside its owner" must therefore either detect a paraphrase — which the
  presence test explicitly is not — or be vacuous. ⇒ **Either it is downgraded to "catches exact
  restatement, and says so", or the editorial rule has to be the strong form**: a dependent artifact
  CITES `ADR-0019/A1` and does not re-say it, which is enforceable only as a convention with a crude
  gate, exactly like `headline:`. Neither is fatal; asserting the strong version unexamined would
  be.
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

## The four rulings, as taken

⚠️ **Four rulings, not one — separable on purpose**, which is the shape ADR-0030's first draft had
before its survey split it into four. **All four were taken on 2026-08-17**, each recorded below
against the recommendation it answered. ⚠️ **Ruling 3 REVERSED the drafted Decision**, which is why
the adoption paragraph above was corrected before this ADR was frozen.

1. **`asserts:` — claims get ids, typed `decision` or `premise`.** Rec was yes, on the premise half
   above all — it removes a frozen document's inability to say a fact it cited was wrong, which is a
   real position the repo was in for a day. ⇒ **RULED: yes to both.** It is taken with the
   append-only bound above: a premise's `claim:` text freezes with the body, and only `status:` and
   a `refuted_by:` pointer may be added afterwards. ⚠️ Take the addressability claim at its measured
   size — for ADR-0019 fewer than half the citations are sweepable at all.
2. **The step-2 gate — "an assertion's content may not be restated outside its owner".** ⇒ **RULED:
   build it.** ⚠️ **It ships labelled as an EXACT-restatement check, and its output has to say so**,
   because the defect that motivates it was a paraphrase ("costed at actual" versus "actual-cost
   absorption") and no presence test reaches that. A check sold as the answer to the restatement
   defect class while silent on paraphrase is the exact failure mode `m3` demonstrated this week.
3. **Forward-only versus back-migration.** ⇒ **RULED: backfill.** The 23 in-force ADRs are given
   `asserts:` in a pass of their own. **This reversed the draft**, which said forward-only — and the
   draft was wrong on a mechanism rather than on taste, because "when next touched" cannot happen to
   a frozen body.
4. **`headline:` on `ADR`/`OQ`/`HOT`/`SPIKE`, and `#### - Name` for GL accounts.** ⇒ **RULED: yes
   and yes** — both halves. It is cheap, back-migratable in one pass, and it stands independently of
   1–3.

⚠️ **What ruling 3 costs is JUDGEMENT, not typing.** Someone must read each frozen decision and say
what its load-bearing claims WERE — without the author present, and without the right to amend the
body. **A claim added to a frozen ADR is a reading of it**, so the backfill inherits the body's
freeze: once written, it is correctable only the way any other frozen text is.
