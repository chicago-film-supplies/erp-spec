---
kind: correction
title: >-
  Correction — the causal_orders declare-or-be-rejected obligation is ADR-0036's decision and
  REQ-LED-001's statement, not ADR-0029's; two artifacts named the wrong owner and it changed
  which route ADR-0025 could take
contexts: [ledger, billing]
source: "code:2026-08-22:erp-spec@29c7850:adr/ADR-0029-the-ledger-records-unallocated-facts.md — the string `causal_order` occurs 0 times in the body; `adr/ADR-0036-...:177`, `contexts/ledger/requirements.yaml:9-34`, 24 `causal_orders:` declarations in `ledger/posting-rules.yaml`"
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Corrects an attribution in two places. Both are append-only or were, and both stand as written:

- `inbox/2026-08-20-survey-every-system-puts-not-applicable-on-the-account-never-on-the-posting-and-the-criterion-is-tie-out-not-classification.md`
  — _"it endorses moving the obligation to `causal_orders` … which **ADR-0029 already requires on
  every posting**"_.
- `hotspots.yaml` **HOT-019** — _"a key that must tie out and that **ADR-0029** already requires on
  every posting"_. Mutable, and corrected in the same commit as this note.

## The measurement

**`ADR-0029`'s body contains the string `causal_order` zero times.** It decides that the ledger
records un-allocated facts and that allocation is a specified reporting act. It never mentions the
key.

The obligation has two real owners, and both are already in force:

| Artifact                             | What it holds                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ADR-0036`** (accepted 2026-08-16) | Absorbs HOT-014 and says so in terms: _"That requirement is now this ADR's decision rather than an unmet obligation."_                      |
| **`REQ-LED-001`**                    | Restated 2026-08-16 per ADR-0036 — _"Every posting shall DECLARE its causal order … a posting that does not declare it shall be rejected."_ |

And it **executes**: 24 `causal_orders:` declarations in `ledger/posting-rules.yaml`, with golden
vectors on all three arms — `missing-causal-order-rejected`, `empty-causal-order-list-rejected`,
`declared-null-causal-order-recorded`.

## Why the wrong owner mattered

⚠️ **It made a decided question look open, and pointed a hotspot's recommended route at it.**
HOT-019's `resolution_shape` and `.claude/plans/reaching-m4.md` step 2 both read _"move the
obligation to `causal_orders`"_ — an instruction to have a `proposed` ADR decide something an
`accepted` ADR had already decided and enacted five days earlier.

⇒ **What the survey actually delivered there is CONFIRMATION of a rule already in force, not a
proposal.** That is worth as much and reads completely differently: six references independently
converging on the criterion CFS already runs on is evidence the existing rule is right, and there is
nothing to move.

⚠️ **And it hid ADR-0025's only surviving clause.** With the `causal_orders` route removed, three of
ADR-0025's four decision clauses turn out to be dead or already-enacted, and the
**`4800 - Other
Income` vs `4100 - Service Income` account boundary is the one live, undecided thing
it holds** — already leaned on in five places in `ledger/chart-of-accounts.yaml` and decided in no
other ADR. A route that redrafted ADR-0025 onto `causal_orders` would have left it unhoused.

## How ADR-0034's traceability let it through

Both artifacts trace back to **ADR-0036 line 177**, which is itself accurate — _"It said ADR-0029
requires every posting to carry its causal order"_ describes **HOT-014's** claim, correctly, in the
past tense, in order to absorb it. The survey and HOT-019 read that sentence and carried the subject
forward as if it were current.

⭐ **A sentence that accurately quotes a superseded claim is indistinguishable, out of context, from
one asserting it.** ADR-0036 was doing exactly the right thing — restating what it was absorbing
before absorbing it — and that is precisely the sentence shape most likely to be re-cited as fact.
**When citing "X requires Y", check X, not the artifact that says X requires Y.**

## The rule that already covers this, and did not fire

The repo's footgun list says **"Cite the ADR that DECIDED it, not the one that mentions it."** This
is that failure, twice, and nothing could catch it: gate 11 checks that a cited id **resolves**,
never that the cited artifact **says the thing**. That gap is real and probably not closable in
general — but the narrow case is: **a claim of the form "ADR-NNNN requires/decides <field>" where
`<field>` does not appear in ADR-NNNN's body** is grep-checkable. Filed as deferred work.
