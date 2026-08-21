---
kind: finding
title: >-
  Superseding ADR-0018 moved the ground under all three unsurveyed proposed ADRs — one mechanism is
  now refused by an executing gate, one Y-statement's premise no longer holds, one is reinforced —
  and nothing in validate detects a proposed ADR resting on a superseded one
contexts: [ledger, billing]
source: >-
  Repo state read 2026-08-20 at `code:2026-08-20:erp-spec@75b3f40`. Front matter of every
  `adr/ADR-*.md`; `ledger/chart-of-accounts.yaml`; `tools/validate.ts:947`.
confidence: high
promotes_to: []
verified: true
triage_count: 0
---

Found while preparing the three rule 8a surveys the Blocked-on column now names (erp-spec#39). **The
surveys were the task; this is what preparing them turned up**, and for two of the three it changes
what the ADR should say before any survey can be cited by it.

## The mechanism

`ADR-0018` is `status: superseded`, `superseded_by: ADR-0036` (accepted 2026-08-16). ADR-0036:

> "A posting records keys, not classifications… `product_line` and `cost_type` are **not** posting
> fields. The product-line view is derived at report time by joining the posting's line identity to
> the product master. `ledger/dimensions.yaml` describes a **reporting** taxonomy, not a ledger
> one."

**Three `proposed` ADRs still name ADR-0018 in `relates_to`: ADR-0020, ADR-0025, ADR-0029.** They
are the three oldest un-accepted accounting ADRs, all drafted 2026-08-09, all in the ADR-0018 world.
They are also — exactly — the three gate 19 warns on. That is not a coincidence: an ADR that has sat
`proposed` for eleven days is one whose foundations have had eleven days to move.

## What actually happened to each, which is different in all three cases

### ADR-0025 — the mechanism is not merely unused, it is REFUSED

Its Decision: _"Each entry in `ledger/chart-of-accounts.yaml` carries an explicit `dimensions:` list
— the dimensions a posting to it must carry."_

- **Zero `dimensions:` keys remain in the chart** (measured 2026-08-20).
- `tools/validate.ts:947` **fails** on an account carrying one: _"carries `dimensions` — the chart
  states no dimension obligation (ADR-0036, superseding ADR-0018). Which KEYS a posting owes is read
  off its rule in `ledger/posting-rules.yaml`."_

⇒ **Enacting ADR-0025 as written would turn CI red.** Of its four decision clauses:

| clause                                          | state                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| per-account `dimensions:` list on the chart     | **dead** — refused by the gate                                     |
| `Other` deleted from `product_line`             | **already enacted, by OQ-022** — not by this ADR                   |
| `product_line: null` vs `4800 Other Income`     | **alive in substance**, dead in phrasing ("a dimensioned account") |
| REQ-LED-001 amended to refuse absence, not null | **dead as stated** — postings carry no dimension to declare        |

The surviving question is real and worth surveying, and it is **not** the one the ADR asks. It is:
_when a reporting dimension does not apply, how is that recorded — and is "no value applies"
distinguished from "nobody classified it"?_ That is what the 2026-08-20 survey was pointed at.

### ADR-0020 — its Y-statement's premise no longer holds

> "**facing** a new ledger where that dimension **is not nullable**"

Under ADR-0036 the new ledger does not carry the dimension **at all**, nullable or otherwise. The
pressure that justified restating — a non-nullable column with nowhere to put an unknown — is gone.

⚠️ **This does not make the restatement unnecessary; it relocates it.** If product line is derived
at report time by joining line identity to the product master, then what must be categorised is the
**master**, not the invoice line — and that is precisely what api-cloudrun#473 repaired on
2026-08-10, which is why the population collapsed from 383 lines / $485,821.72 to roughly $688.00 of
genuine operator non-classification. What survives as a real gap is **128 custom lines with no
product master at all**, because they have nothing to join to.

⇒ **The ADR's question shifts from "restate the lines" to "what is derivable, and what has no master
to derive from".** Smaller, different, and still open.

### ADR-0029 — reinforced, not undermined

It cites ADR-0018 for _"keeps the chart plain expressly so it does not explode into reporting
axes"_, and ADR-0036 explicitly preserves that: _"ADR-0018's chosen option — a plain chart of
accounts, one account per GL code — survives unchanged and is re-affirmed here."_ ADR-0036 reversed
only the second half of ADR-0018's sentence.

⇒ ADR-0029's use of it is intact, and ADR-0036's derive-at-report-time principle is the same
principle one layer over. **Its survey question is unchanged**, and whether the two are the same
question or two different ones is worth the survey saying.

## ⚠️ Nothing detected any of this, and something could

`validate.ts` mentions supersession 36 times. It checks symmetry (gate 6), it checks that
`supersedes_on_acceptance` cannot be forgotten at acceptance (erp-spec#18), and it freezes bodies at
acceptance (gate 14). **It never asks whether a `proposed` ADR rests on a `superseded` one.**

That is a cheap check with a real population — three today — and it is the same defect class the
repo already names twice:

- **"A stated guarantee that nothing executes is not a guarantee."** "Supersede rather than edit" is
  stated everywhere and enforced only for the two ADRs directly involved. The _dependents_ are
  nobody's job.
- **"An unexercised branch of a rule is a claim, not a capability."** ADR-0036 was the **first**
  supersession declared from a `proposed` ADR (erp-spec#18 records that the machinery could not
  express one). Being first, it exercised the declare-and-enact path — and not the notify-the-
  dependents path, which still does not exist.

⚠️ **And a warning, not a failure.** A proposed ADR citing a superseded one is not automatically
wrong — ADR-0029 cites ADR-0018 correctly, for the half that survived. So the check must **surface
the pair for a human**, not fail the build; a gate that failed here would be wrong one time in
three, and a gate that cries wolf is one people route around (gate 19's own stated reasoning).

## What this owes

- **ADR-0025 needs redrafting or withdrawing before any survey can be cited by it.** It is
  `proposed`, so it may be amended freely (ADR-0034: immutability bites only at `accepted`). Whether
  it is redrafted to the surviving question, split, or withdrawn in favour of a new narrow ADR is
  the owner's call.
- **ADR-0020's Context and Y-statement need the same treatment** — the premise moved, the scope
  collapsed, and the ADR already flags the second but not the first.
- **A gate** — `proposed` ADR whose `relates_to` names a `superseded` ADR, reported as a warning
  with the superseding id alongside so the reader can check which half they relied on.
- ⚠️ **Land it warning-first against today's three and confirm it names ADR-0029 too** — a check
  that only flagged the two genuinely broken ones would be matching on something other than what it
  claims to match on.

## Not established

- Whether any **accepted** ADR rests on a superseded one in a way that matters. ADR-0017, ADR-0026
  and ADR-0034 also cite ADR-0018 and were not examined here; they are frozen, so the remedy would
  differ (a dated note, not an edit — ADR-0034).
- Whether `relates_to` is even the right field to check. It is an index, not a dependency
  declaration, so it will over-report — ADR-0034 cites ADR-0018 as an _example_, not a foundation.
  **A dependency the spec does not distinguish from a citation is the reason this check must warn
  rather than fail.**
