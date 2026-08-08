# research-drop format

The boundary between a Claude chat session and this repo is a **file format**, not a tool. It
works whether the file arrives by desktop filesystem access, a synced Drive folder, or copy-paste.
It does not change when that automates.

Save a session's output here as `YYYY-MM-DD-<topic>.md`, then run `deno task ingest`.

## Shape

```markdown
---
kind: session
date: 2026-08-08
surface: claude-chat          # claude-chat | claude-code | manual
topics: [ledger, formal-methods]
status: unprocessed           # unprocessed | ingested
ingested_at:                  # set by tools/ingest.ts
---

## Findings
- [finding] One idea per bullet. Standalone — no reference to conversational context.

## Decisions taken
- [decision] Stated as a decision, with the reasoning on the same bullet.

## Open questions raised
- [question] Phrased so it has an answer.

## Corrections to existing spec
- [correction] REQ-LED-014 — what is wrong and what it should say.

## Research notes
- [research] Source-bearing material: standards, tool behaviour, external facts. Include the
  source inline.
```

## What ingestion does

- Reads every `research-drop/*.md` with `status: unprocessed`.
- Splits each tagged bullet into its own `inbox/` file, assigning the next free id, setting
  `source:` to `research-drop/<file>#L<line>`, and `verified: false`.
- Routes `[question]` bullets to `open-questions.yaml` with `owner: TBD` and `decide_by: TBD` —
  which `deno task validate` then flags until filled in.
- Routes `[correction]` bullets to `hotspots.yaml` rather than `inbox/`. **A correction never
  silently overwrites a structured file** — it opens a conflict for a human to resolve.
- Sets `status: ingested` and `ingested_at:` in the drop file. **Never deletes or rewrites the
  drop body** — that file is the provenance record.
- Is idempotent. Re-running does not duplicate inbox entries.

## Writing bullets that survive ingestion

Each bullet becomes a standalone file read months later by someone with no memory of the session.

- **Bad:** `[finding] This is worse than we thought.`
- **Good:** `[finding] 28.7% of invoice line revenue carries no product-line dimension, measured across all 999 prod invoices on 2026-08-08.`

Put the number in the bullet. A finding without a measurement is an opinion with a tag.
