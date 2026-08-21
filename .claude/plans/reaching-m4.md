# Reaching m4 — the last milestone with unmet machine-checkable criteria

- **Date:** 2026-08-21 (replaces `open-issue-queue.md`, whose framing aged out — the work is no
  longer "clear the issue queue", it is m4)
- **Repo:** erp-spec
- **Status:** `main` is CI-green and **`deno task validate` is 0 failures / 0 warnings** — the first
  time this has been true. Everything is pushed (`origin/main` = `89724cf` +).
- **Origin:** the 2026-08-18→21 sessions closed two spikes, produced three rule 8a surveys, and
  fixed the dashboard that had been misreporting what was blocked.
- **Related:** open — #3, #4, #6, #12, #17, #32, #35, #36, #37, #38, **#40 (supersession gate)**,
  **#41 (SPIKE-011 rescope)** · closed this run: **#39** · HOT-017, HOT-018, **HOT-019**,
  **HOT-020** open · api-cloudrun#597 filed

## START HERE

**m0–m3 are met. m4 is the only milestone with unmet machine-checkable criteria**, and it needs
exactly two things:

| criterion                                  | measured               |
| ------------------------------------------ | ---------------------- |
| every spike closed, naming the ADR it made | **7 of 12 still open** |
| every hotspot resolved                     | **4 of 20 still open** |

Nothing is half-finished. Pick from _Then, in order_.

### ⭐ The hotspot half is now mostly WRITING, not research

Three of the four open hotspots have their six-reference evidence gathered and a concrete
recommendation written. **This is the cheapest m4 progress available and it needs no new decision
from the owner** — a `proposed` ADR may be amended freely (ADR-0034; ADR-0032 is the precedent for
substantial amendment while proposed), and the owner still rules at acceptance.

| HOT     | needs                                                      | evidence                                        |
| ------- | ---------------------------------------------------------- | ----------------------------------------------- |
| **018** | the `labor_variance` account, event, rule + golden vectors | ✅ survey landed `f0d44c1`; the park is **#38** |
| **019** | ADR-0025 redrafted onto its surviving question             | ✅ survey landed `89724cf`                      |
| **020** | ADR-0020 redrafted off its void premise                    | ✅ survey landed `89724cf`                      |
| 017     | **OQ-053** — is CFS principal or agent on a PSA            | ⛔ owner's, and it blocks a whole service line  |

Each hotspot's own `resolution_shape` in `hotspots.yaml` carries the route. Read that first.

### What changed 2026-08-18 → 21

**Two spikes closed, each producing a new narrow ADR, and both refuse the obvious mechanism on
measurement.**

- **SPIKE-003 → ADR-0039.** ADR-0010 **confirmed**. `TransferFlags.imported` is refused:
  `CreateTransferResult.timestamp` **echoes** the caller's value, so an imported load leaves no
  record of the real commit time anywhere in TigerBeetle. And the import window is
  `(last committed ts of that object type, cluster clock]` — **after go-live a backdated import is
  refused forever**, which binds ADR-0020.
- **SPIKE-006 → ADR-0040.** The spike's own premise inverted: **MongoDB silently ignores nothing**
  (63 keywords probed, 29 accepted, 34 rejected, **0 accepted-and-ignored**). The dangerous loss is
  upstream in Zod, which drops **35 refinements** with no output while `unrepresentable: "throw"`
  reports no throw. ⭐ **`$expr` enforces all five items invariants** — proven with
  conforming/violating pairs — and checks (1)(2)(3) **independently of `computeItemPaths`**, which
  is the first mechanism here to escape the fixed-point-guard problem.

**#39 fixed the dashboard.** The Blocked-on column read _any_ HOT/OQ/SPIKE id in `relates_to` with
no status check, so **6 of 8 proposed ADRs displayed an already-resolved blocker and three displayed
nothing else**. ⚠️ **Filtering alone would have replaced one wrong answer with another** — ADR-0020,
0025 and 0029 would have dropped to `—`, reading as _ready to accept_, when gate 19 meant they could
not be. They now name `rule 8a survey`, or the hotspot that actually blocks them.

**Three rule 8a surveys, and all three found something the ADR did not have.** See _The three
surveys_ below — the ADRs cite them and gate 19 is clean.

**The public client app is in scope** (owner, 2026-08-18) — real-time stock availability, quote
request, checkout for in-store orders. It gives **ADR-0005's already-named second client a purpose
it never had**.

### ⚠️ Five ADRs show `—` and only two are actually clean

The column can express "blocked on an id" and "needs a survey". **It cannot express _the body says
something now known false_.** That is what HOT-019 and HOT-020 exist for — and one more may be owed:

| ADR                    | reads as | actually                                                                       |
| ---------------------- | -------- | ------------------------------------------------------------------------------ |
| **ADR-0039, ADR-0040** | ready    | ✅ genuinely clean — need a ruling and nothing else                            |
| **ADR-0029**           | ready    | ⚠️ its opening Context claim is **falsified by the survey it now cites**       |
| **ADR-0027**           | ready    | ⚠️ Resend enumeration predates the draft-quote use; measured figures not in it |
| **ADR-0028**           | ready    | ⚠️ still rests on SPIKE-011, scoped narrower than it needs (**#41**)           |

**Open question left deliberately unanswered: does ADR-0029 get a hotspot too?** Identical grounds
to 019 and 020. Stopped at two because a third in one session reads as inflation rather than signal.

## The three surveys, compressed — read the inbox notes before redrafting

**ADR-0029 (allocation).** Three of five systems post allocations, two have no engine, **none
derives at report time**. ⚠️ Its claim _"allocation is destructive"_ is **false as stated** — SAP
`distribution` keeps the grain, `overhead allocation` destroys it, and SAP forces the choice per
cycle. ⭐ **The option it never considers is the one they all implement: nobody keeps allocations
out of the LEDGER, they keep them out of the STATEMENTS.** The decision survives on a better
argument — a number resting on a basis ADR-0031 calls the weakest tier should not get a document
number — with **Deltek Vision** as production precedent. GAAP's hook is **ASC 280**, and it is a
bill: **50-30 requires reconciliation to consolidated totals, stated nowhere in the reporting
spec.**

**ADR-0025 (the dimension obligation).** ⚠️ **No surveyed system lets a POSTING declare "not
applicable"** — every escape hatch sits on the account or the scope. ⭐ **The criterion is not "was
this classified" but "can the book still be tied out if this is missing"**, which endorses ADR-0036
for `product_line` **and endorses moving the obligation to `causal_orders`** — a key that must tie
out, that ADR-0029 already requires on every posting, and where `posting-rules.yaml` already carries
~15 `causal_orders: null` declarations with vectors on both arms. **The rule is defensible and
pointed at the wrong field.**

**ADR-0020 (restate the history).** ⭐ **FASB already fixed the word** — ASU 2023-07 BC83 replaced
"restatement" with **"recast"** throughout Topic 280. ⭐ **The six criteria collapse into two** —
_was it published_ and _what would the write fail to reach_ — and **CFS fails neither**. ⚠️
Load-bearing premise needing the owner: **that a tracking category was on no externally filed
document.** The delta, previously "unmeasurable", is **$231,796.26** (106 lines, 15.66% of pre-lock
revenue, untracked in **both** systems). The recommendation is **neither** of the ADR's options:
derive from the product master, declare a null where there is nothing to derive from.

## Then, in order

|       |                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **HOT-020 → redraft ADR-0020.** Smallest, and its survey's recommendation is fully written                                                                                                                    |
| **2** | **HOT-019 → redraft ADR-0025.** Move the obligation to `causal_orders`; keep the `4800`/declared-null half                                                                                                    |
| **3** | **HOT-018 → #38**, the `labor_variance` rule. Account, event, rule, vectors — including the OVER-statement direction, which is CFS's measured one                                                             |
| **4** | **A spike.** SPIKE-005 and SPIKE-008 are self-contained desk research; **SPIKE-002 is the load-bearing one** (ADR-0003's two-store split, and a Quint spec exists); **SPIKE-011 needs rescoping first (#41)** |
| **5** | **#40** — the supersession-dependents gate. Small, and today's three are a ready-made red-first population                                                                                                    |
| **6** | **#6** — requirements. `ordering`, `availability`, `banking`, `procurement` still have **zero**, and the public client app now depends on the first two                                                       |

⚠️ **The decision backlog is not blocked on the owner's availability — it is blocked on nobody
having prepared the decisions.** Every survey this run changed the ADR it was written for. **One
prepared decision per session is probably worth more than the authoring it displaces.**

## Two capabilities every remaining unit should use

- `spikes/harness/corpus.ts` reads prod Firestore read-only under ADC — project hardcoded to
  `cfs-3100`, `--allow-net` narrowed so it cannot reach Xero or CRMS, write verbs unreachable by
  construction. **This retires "a full sweep needs a script rather than MCP paging".**
- ⚠️ **The MCP `db_schema` enum is not a list of the collections.** It carries 35; there are **50**,
  and it omits `credit-notes` and `settlements` — the second being 1,073 documents of cash
  application. Anything scoped from it is scoped short.
- ⚠️ **`--development` caps TigerBeetle's `createTransfers` at 253, not the documented 8189**
  (measured 2026-08-18 against a second cluster on production defaults). **Every TB measurement in
  this repo before that date was taken on `--development`.** `spikes/harness/_README.md` carries the
  caveat; SPIKE-011 owns the production numbers.

## Decisions worth not re-litigating

_Carried forward verbatim — all five still hold._

- **#18 fixed with a new field, not a status-aware gate 6.** Rejected: gating only the acceptance
  transition, which would have left ADR-0036's promise as a comment with nothing behind it.
- **Gate 10n was deliberately NOT widened to check applicability** — every value in the refuted
  scenarios was legally declared. Both halves landed later as gate 10p, against the posting RULE.
- **`ledger/dimensions.yaml` did NOT move to `reporting/`**, which #19 proposed: four IMMUTABLE ADRs
  cite the path in backticks and gate 11 checks citations resolve, so a move buys four PERMANENT
  exemptions. **Refused on measured cost.**
- **Gate 18 is scoped to minted accounts, not all 143.** Answering "what may post here" for the
  adopted ones is a where-does-it-post decision under rule 8a; bulk-typing 104 assignments is
  exactly the shape 8a exists to prevent. The limit is measured in the gate's own note (#37).
- **The vehicle absorption rate is NOT registered in `reporting/allocation-bases.yaml`.** Every
  field there (`base`, `zero_base`, `rounding`) describes spreading a pool proportionally over a
  base, and a rate applied to a quantity has none of them. ADR-0030 cites that file's
  **discipline**, not its registry.
- ⚠️ **NEW — the `closes_adr` exclusion proposed in #39 was wrong and is not implemented.** A spike
  that is still OPEN and names the ADR it will produce is precisely that ADR's blocker — `SPIKE-012`
  declares `closes_adr: ADR-0015`, so the exclusion would have deleted ADR-0015's only real blocker.
  **Status alone is correct and sufficient.** `tools/blockers_test.ts` asserts that exact row.

## Thirteen things to carry across the clear, because none is obvious from the artifacts

_The first ten are carried forward verbatim; this run earned three more._

- **Firing a gate red is not ceremony — it is the only thing that finds the defects.** Across three
  sessions ~forty arms were fired and twelve found real bugs, none surfaced by reading.
- ⚠️ **An INCLUSIVE declaration fails closed; an EXCLUSION list fails open.** "Any expense account
  except these" silently swallows the next minted COGS account; "these codes" goes red until someone
  writes the new one down. This decided gate 18's shape and it will decide #37's.
- ⚠️ **Scope a gate to what the spec is RESPONSIBLE for, then measure what it does not cover.** **A
  noisy reporter is one nobody reads twice, which is the same outcome as no reporter.**
- ⚠️ **A value one letter from a legal one, in a file no gate reads, is the cheapest way to be
  wrong.** **Ask which file the value you just typed is checked AGAINST**; if the answer is none,
  that is the next gate.
- ⚠️ **Two messages for one defect is how a gate teaches the wrong lesson at 2am.**
- **When a doc states a count, something must count it.** Three instances, three gates (10q, 16),
  one rule.
- ⚠️ **A rule that exists and is not applied blocks work silently.** ADR-0030 looked like it was
  waiting for the owner and was waiting for rule 8a.
- ⚠️ **A self-declared flag needs something that can falsify it, and the falsifier should demand a
  REASON rather than a verdict.**
- ⚠️ **A correct conclusion reached by wrong reasoning is not a checked conclusion.**
- **The `db_schema` enum is not the collection list** — 35 against 50.
- ⚠️ **NEW — an incomplete fix is invisible in a way a missing one is not, and #39 nearly shipped
  one.** Filtering the stale blockers would have dropped three ADRs to `—`, reading as _ready to
  accept_. **When you remove a wrong signal, ask what the absence will now be read as.**
- ⚠️ **NEW — a hand-written invariant is easy to get wrong in BOTH directions, and neither error is
  visible from the expression.** SPIKE-006's contiguity `$expr` took **four attempts** — one
  rejected conforming documents, one was vacuous, one rejected a legitimate case. **All three read
  correct.** Only a conforming/violating pair told them apart.
- ⚠️ **NEW — a delegated research pass will fabricate a quotable source, and it is not rare.** Four
  fabrications were caught and discarded across three surveys. **Every one was caught by demanding a
  verbatim quote with a URL**, and the surveys that extracted primary sources locally (`pdftotext`,
  a machine-readable OpenAPI contract, source code) produced the strongest evidence in the repo.
  **Treat a fetched summary as a pointer, never as evidence.**

## Context recommendation

**CLEAR CONTEXT.** Nothing needed is in anyone's head. The three surveys are committed `inbox/`
notes; each open hotspot's `resolution_shape` carries its route; `STATUS.generated.md` reports the
milestone state; and `deno task ci` reproduces the whole CI contract locally.

⚠️ **The one thing not written down anywhere durable** is the open question above — whether ADR-0029
earns a hotspot on the same grounds as 019 and 020. It is recorded here and nowhere else.
