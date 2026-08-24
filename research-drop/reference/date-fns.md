# date-fns + @date-fns/tz

Datetime arithmetic and the timezone type for every business datetime. **Adopted by [[ADR-0046]]**
(proposed, 2026-08-24, owner instruction). `date-fns` supplies the arithmetic; `@date-fns/tz`
supplies `TZDate` and the `tz()` context option, which is what makes an operation happen **in a
named zone** rather than in the runner's.

⚠️ **This governs the TARGET SYSTEM only.** `tools/` in this repo has **zero** npm or jsr
dependencies by design — that is what lets CI run `deno task validate` with nothing installed — and
`tools/dates.ts` says so explicitly. A UTC calendar-day reduction is `toISOString().slice(0, 10)`,
which no library improves. **Do not pull date-fns into `tools/`.**

## Canonical docs

- Docs: <https://date-fns.org/docs/Getting-Started>
- `TZDate` / `tz()`: <https://github.com/date-fns/tz>
- **No `llms.txt`** as of 2026-08-24; this note is the curated substitute.

## Versions in the workspace (checked 2026-08-24)

| repo           | date-fns | @date-fns/tz |
| -------------- | -------- | ------------ |
| `core`         | `^4.1.0` | `^1.4.1`     |
| `api-cloudrun` | `^4.4.0` | `^1.5.0`     |
| `manager`      | `^4.4.0` | `^1.5.0`     |

⚠️ **`core` floats lower than its consumers.** Harmless on a caret today; worth knowing before
anyone pins exactly.

## Why it is here at all: a rental day is a Chicago day

The whole reason this is a decision and not a detail. A rental charges by the day, the day is a
**Chicago** day, and Chicago observes DST — so "the day an order starts" is not derivable from a UTC
instant without a zone. v1 canonicalizes every stored business datetime to Chicago offset form
(`YYYY-MM-DDTHH:MM:SS.sss-06:00` / `-05:00`) and enforces it at write time. See the workspace
`CLAUDE.md` → _Dates & Times_ for the full rule and the factory table.

## CFS-specific gotchas

- ⚠️ **`format(date, "yyyy-MM-dd")` without `{ in: tz("America/Chicago") }` is the bug**, not a
  style preference: it formats in the runner's zone, so a late-evening Chicago datetime becomes the
  next calendar day on a UTC server. Same defect class as `.toISOString().slice(0, 10)`.
- ⚠️ **`new Date().toISOString()` emits `Z` form**, which is not the stored form. It type-checks
  everywhere and is wrong everywhere.
- ⭐ **A `TZDate`'s own `toISOString()` already produces offset form**, so
  `parseISO(iso, { in: tz(…) })` followed by arithmetic yields a storable value without a second
  conversion step.
- ⚠️ **Not every date field is a business datetime.** v1 deliberately leaves pure calendar dates
  (`z.iso.date()`) and machine timestamps (`z.iso.datetime()`, `Z` is fine) alone. Applying the
  Chicago rule to a machine timestamp is as wrong as omitting it from a rental date — the
  distinction is the point.
- ⚠️ **The ledger's dates are NOT this library's problem.** [[ADR-0039]] stores a posting's
  accounting date as a packed `YYYYMMDD` in TigerBeetle's `user_data_32`, with the cluster assigning
  the posting timestamp. Formatting one for display is date work; deciding what it means is not.

## ⚠️ Temporal is native in the target runtime, and this note will not pretend otherwise

**Measured 2026-08-24 by execution, not from memory:**

- **Deno 2.9.2** (V8 14.9): `Temporal` present; `Temporal.Now.zonedDateTimeISO("America/Chicago")`
  returns `2026-08-23T23:01:42.326677002-05:00[America/Chicago]`.
- **Chromium 149** (the manager's own Playwright browser): present, same result.

⇒ **both halves of the target stack ship a native, zone-aware datetime type** that emits the exact
offset form v1 canonicalizes to. [[ADR-0046]] adopts date-fns anyway, on continuity grounds, and
records Temporal as a considered option with the argument against that decision stated rather than
buried. **Read that section before treating this adoption as settled** — the ADR is `proposed`.

Cross-refs: [[ADR-0046]] · [[ADR-0004]] · [[ADR-0039]] · workspace `CLAUDE.md` → _Dates & Times_
