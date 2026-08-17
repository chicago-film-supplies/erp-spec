/**
 * Calendar-day reduction. THE owner — nothing else may hold a copy.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────────────────────────
 *
 * The same five-line reduction was written **four** times: `validate.ts` (`ymdUTC`), `generate.ts`
 * (`ymd`), `ingest.ts` (inline, in a closure) and `fetch-llms-docs.ts` (`today`). A fifth was about
 * to be added to `spikes/harness/live-path-inventory-probe.ts` — **and that one used a different
 * timezone**, which is how a duplicated helper stops being harmless: the copies drift, and the
 * drift is invisible because each one looks correct on its own.
 *
 * That is the same defect `tools/contexts.ts` was created to end — four hand-maintained lists of
 * the contexts, and `view.ts` still holding a fifth.
 *
 * ── Why UTC, and why NOT date-fns ────────────────────────────────────────────────────────────────
 *
 * **UTC**, because the point is machine-independence. An unquoted YAML `date: 2026-08-08` parses to
 * a JS `Date` whose `String()` renders in the RUNNER's timezone: gate 6 spent its whole life
 * reporting an ADR "past its review_by (Mon Sep 14 2026 19:00:00 GMT-0500)" for a date that IS the
 * 15th, and `generate.ts` once wrote inbox filenames beginning `Fri Aug 07 2026 19:00:00 GMT-0500`.
 * Both are the same bug, and reducing to a UTC day is what fixed them.
 * **Comparing a Date is fine. Printing one is the bug.**
 *
 * ⚠️ **Not date-fns, and the reason is not laziness.** `tools/` has ZERO npm or jsr dependencies by
 * design — that is what lets CI run `deno task validate` with nothing installed — and a
 * `YYYY-MM-DD`-in-UTC reduction is `toISOString().slice(0, 10)`, which no library improves. The
 * workspace's date-fns / `TZDate` rule governs **business datetimes stored in Firestore** (an
 * order's delivery date, an invoice's date), where Chicago is load-bearing because a rental day is
 * a Chicago day. A tool stamping when it ran is not that, and conflating the two is what pulled a
 * Chicago formatter into a probe where it did not belong.
 *
 * ⚠️ **A stamp near midnight will read as "tomorrow" to a Chicago author, and that is the cost.**
 * It is paid deliberately, and paid ONCE here rather than argued at each call site. Where a stamp is
 * written into a file a human reads, name the field `*_utc` so nobody has to guess which day it is.
 */

/**
 * A value that may be a YAML-parsed `Date` reduced to its UTC calendar day; anything else trimmed.
 *
 * Callers keep their own EMPTY-value policy — `generate.ts` renders `—`, `ingest.ts` falls back to
 * the filename — because that is presentation, not date reduction, and folding it in here would
 * make one of the two callers wrong.
 */
export const ymdUTC = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();

/**
 * Today, as a UTC calendar day.
 *
 * ⚠️ **`generate.ts` may not call this.** A generated file that reads a clock changes on its own and
 * turns the stale-file gate red on unrelated pushes, at which point the gate stops meaning anything
 * (`CLAUDE.md` → _Generated files_). Time-dependent judgement belongs in `validate.ts`, which writes
 * nothing, and in the harness, which writes measurements that are supposed to be dated.
 */
export const todayUTC = (): string => new Date().toISOString().slice(0, 10);
