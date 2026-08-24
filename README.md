# erp-spec

Planning repo for a greenfield rebuild of the CFS inventory/order/invoice system into a full ERP
with its own accounting layer. **No implementation code lives here.** The output is a `spec-v1` git
tag.

Replaces the Firestore-backed CFS API, **Xero**, and **asset.accountant**. Keeps an external
employer of record for payroll — labor _scheduling_ moves in-house, which is what makes COGS labor
allocation possible.

Target stack: Deno/Hono API · MongoDB (documents) · TigerBeetle (ledger) · DuckDB over Parquet (read
side) · SolidJS clients.

---

## Start here

| Open this                                                | To answer                                                |
| -------------------------------------------------------- | -------------------------------------------------------- |
| **[`STATUS.generated.md`](STATUS.generated.md)**         | Where does the project stand right now?                  |
| **`spec-map.generated.opml`**                            | What is the shape of the whole thing? (open in MindNode) |
| [`charter.md`](charter.md)                               | What is in scope, and what is deliberately not?          |
| [`CLAUDE.md`](CLAUDE.md)                                 | What are the rules for changing anything here?           |
| [`adr/in-force.generated.md`](adr/in-force.generated.md) | What has already been decided?                           |

## The five commands

```
deno task validate    # every gate. exits 1 on any failure
deno task triage      # just the inbox items not yet promoted into the spec
deno task ingest      # absorb research-drop/*.md into the spec
deno task gen         # rewrite the four generated files. run before every commit
deno task view        # local read-only viewer on localhost:8000 — reads source, not the generated files
```

**`validate` is green as of 2026-08-09, and a failure is now a real regression.** It was seeded red
on purpose and stayed red while the day-one worklist was open; that is finished. If it goes red,
something broke — read the failures rather than assuming they are expected.

The gates are meant to be _landed_ red, though, and that has not changed: a new gate goes in against
data that still violates it, is watched to fail, and only then is the data fixed. A gate first seen
passing has never been shown to be a gate.

---

## How to use it

### The three lifecycles

Everything is in exactly one. Mixing them is the main mistake to avoid.

| Directory                                                   | Lifecycle                     | In practice                                             |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| `inbox/`, `research-drop/`                                  | **append-only**               | Write once, never edit. A correction is a _new_ file.   |
| `contexts/`, `ledger/`, `migration/`, `roadmap/`, `spikes/` | **refactor freely**           | The real spec. Rewrite whenever understanding improves. |
| `adr/`                                                      | **immutable once `accepted`** | Never edited. Superseded by a new ADR.                  |

### How a thought becomes spec

```
chat session → research-drop/*.md → deno task ingest → inbox/
                                                         ↓  triage: you decide
                                        contexts/<ctx>/requirements.yaml
                                                         ↓
                                        contexts/<ctx>/features/*.feature
```

Nothing skips straight into `requirements.yaml`. Promotion is **bidirectional** — the inbox file
gets `promotes_to: [REQ-…]`, the requirement gets `source: inbox/…`. That is what makes the
traceability matrix work, and why "why does this requirement exist?" always has an answer.

`[question]` bullets route to `open-questions.yaml`. `[correction]` bullets route to `hotspots.yaml`
— never overwriting what they contradict.

### Know which of these four you are looking at

The single easiest thing to blur:

- **`OQ-`** — a **decision** someone must make. Has an owner and a date. → `open-questions.yaml`
- **`HOT-`** — a **contradiction** between two statements. Resolved by an ADR, never by quietly
  picking a side. → `hotspots.yaml`
- **`SPIKE-`** — an **investigation**. Timeboxed, must close by producing an ADR. → `spikes/`
- **GitHub issue** — **work** someone must do. Labeled per the org schema in the workspace
  `CLAUDE.md` (`kind:` + `area:` required); this repo's contexts and spec areas are its `area:`
  vocabulary.

### A working session

**Start** — two commands tell you the whole state:

```
deno task validate     # what is undecided or unbuilt
deno task triage       # what is captured but not yet promoted
```

**During** — capture into `research-drop/`, then `deno task ingest`.

**Before committing** — `deno task gen`, or CI fails on stale generated files.

---

## Depositing research from a Claude chat session

The boundary is a **file format**, not a tool, so it works whether the file arrives via desktop
filesystem access, a synced Drive folder, or copy-paste:

1. In the chat session, produce output in the shape documented in
   [`research-drop/_FORMAT.md`](research-drop/_FORMAT.md).
2. Save it as `research-drop/YYYY-MM-DD-<topic>.md`.
3. Run `deno task ingest`.

Ingestion splits each tagged bullet into its own append-only `inbox/` file, routes questions and
corrections to the right structured file, and stamps the drop `status: ingested`. It never rewrites
the drop body — that file is the provenance record. Re-running is idempotent.

`research-drop/_EXAMPLE.md` is a filled-in drop showing the shape. The `_` prefix makes it inert:
ingestion and validation both skip `_`-prefixed files, so the example can never pollute the spec.

**Put numbers in the bullets.** A finding without a measurement is an opinion with a tag.

---

## The mind map

`deno task gen` writes `spec-map.generated.opml` — the whole spec as a tree: roadmap, open questions
and what each blocks, conflicts, decisions in force vs proposed, spikes, contexts, and the
unpromoted capture backlog.

Open it in **MindNode** (File → Open, or drag it in). MindNode Next also imports FreeMind, Markdown
and Xmind; OPML was chosen because it is not locked to one app — OmniOutliner, Xmind, Freeplane and
most outliners read it too.

**It is a one-way view.** Rearranging the map in MindNode and re-running `deno task gen` discards
the rearrangement. Edit the YAML, regenerate the map.

---

## Where things live

| Directory                  | Holds                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| `inbox/`, `research-drop/` | Raw capture. Append-only.                                                    |
| `contexts/`                | Per-bounded-context requirements, events, entities, Gherkin features.        |
| `ledger/`                  | Chart of accounts, dimensions, posting rules, golden input→transfer vectors. |
| `adr/`                     | Decisions. Immutable once accepted.                                          |
| `spikes/`                  | Timeboxed investigations. Each closes with an ADR.                           |
| `formal/`                  | TLA+ specs for the two-store commit and period-close protocols.              |
| `migration/`               | Current Firestore path → new field map, including the defective paths.       |
| `roadmap/`                 | Milestones to `spec-v1`.                                                     |
| `traceability/`            | Generated only.                                                              |

Context codes: `LED` ledger · `FUL` fulfillment · `BIL` billing · `FA` fixed-assets · `ORD` ordering
· `AVL` availability · `BNK` banking · `TAX` tax.

## Generated files — never hand-edit

Anything with `.generated.` in the name is rewritten by `deno task gen`, and CI fails on a diff:

- `STATUS.generated.md` — the dashboard
- `spec-map.generated.opml` — the mind map
- `adr/in-force.generated.md` — accepted, not superseded
- `traceability/matrix.generated.json` — REQ ↔ ADR ↔ event ↔ scenario ↔ inbox source

All four are deterministic and **read no clock**, so they only change when the spec changes. Whether
a `decide_by` has actually passed is `validate`'s judgement — it writes nothing, so it is free to
read the real date.
