/**
 * What is actually stopping a `proposed` ADR from being accepted.
 *
 * ── why this file exists ────────────────────────────────────────────────────────────────────────
 *
 * The **Blocked on** column of `adr/in-force.generated.md` and `STATUS.generated.md` was computed
 * as *any* `HOT-`/`OQ-`/`SPIKE-` id appearing in an ADR's `relates_to`, with **no status check at
 * all**. But `relates_to` is an INDEX — CLAUDE.md says so, and calls it the correction index — so it
 * accumulates ids and never sheds them. Measured 2026-08-18: **6 of 8 proposed ADRs displayed at
 * least one already-resolved blocker, and three displayed nothing else** (erp-spec#39).
 *
 * These are the files a session reads to pick up work, and a resolved blocker is a reason not to
 * touch something.
 *
 * ⚠️ **The filter alone would have replaced one wrong answer with another.** ADR-0020, ADR-0025 and
 * ADR-0029 have nothing but resolved ids in `relates_to`, so filtering drops them to "—" — which
 * reads as *ready to accept*. All three are accounting-shaped, `proposed`, and cite no survey, so
 * gate 19 means they **cannot be accepted as they stand**. Filtering without surfacing that is this
 * repo's "an incomplete fix is invisible in a way a missing one is not", exactly.
 *
 * ⚠️ **erp-spec#39 also proposed excluding "the spike named by the ADR's own `closes_adr`", and
 * that is WRONG.** It was reasoned from ADR-0039/SPIKE-003, where the spike is closed — but a spike
 * that is still OPEN and names the ADR it will produce is precisely that ADR's blocker.
 * `SPIKE-012` (open) declares `closes_adr: ADR-0015`, so the exclusion would have deleted ADR-0015's
 * only real blocker while looking like a tidy-up. **Status alone is correct and sufficient**, and
 * the closed case is already covered by it.
 *
 * Kept separate from `generate.ts` for the same reason `ci-predicates.ts` is separate from `ci.ts`:
 * a decision that lives inside the IO can only be exercised by hitting it in production. This file
 * reads nothing and is tested by enumerating the input space.
 */

/** The three id kinds that can appear as a blocker. */
export type BlockerKind = "HOT" | "OQ" | "SPIKE";

/**
 * The ONE status per kind that means "this no longer blocks anything".
 *
 * ⚠️ Terminal is an allow-list, never a deny-list. An unrecognised status — a typo, or a value
 * somebody adds later — must keep the id visible as a blocker rather than silently drop it. The
 * failure mode of the opposite choice is a blocker that disappears because of a spelling mistake.
 */
export const TERMINAL_STATUS: Readonly<Record<BlockerKind, string>> = Object.freeze({
  HOT: "resolved",
  OQ: "answered",
  SPIKE: "closed",
});

/** What the blocker index knows about one `HOT-`/`OQ-`/`SPIKE-`. */
export type BlockerEntry = { status?: string };

/** The subset of an ADR's front matter this decision needs. */
export type BlockerAdr = {
  relates_to?: string[] | null;
  accounting_shaped?: boolean;
  survey?: string[];
  survey_exemption?: string;
};

/** What is genuinely outstanding, split by kind of obstacle. */
export type AdrBlockers = {
  /** Ids from `relates_to` that are still open/unanswered/unclosed, in declaration order. */
  ids: string[];
  /** Rule 8a: accounting-shaped, and no survey and no exemption. Gate 19 fails on acceptance. */
  needsSurvey: boolean;
};

/** `HOT-011` → `HOT`; anything else → null. */
export function blockerKind(id: string): BlockerKind | null {
  const m = /^(HOT|OQ|SPIKE)-/.exec(id);
  return m ? (m[1] as BlockerKind) : null;
}

/**
 * Is this id still blocking?
 *
 * ⚠️ **An id missing from the index counts as BLOCKING.** A dangling reference is not evidence that
 * something was resolved — it is evidence that nobody knows. Failing open keeps it on the dashboard
 * where it can be noticed; failing closed would make a broken id look like a completed one.
 * (`validate.ts`'s xref gate is what actually catches the dangle; this must not paper over it.)
 */
export function isStillBlocking(
  id: string,
  index: ReadonlyMap<string, BlockerEntry>,
): boolean {
  const kind = blockerKind(id);
  if (!kind) return false;
  const entry = index.get(id);
  if (!entry) return true;
  // Absent status defaults to open, matching how generate.ts counts open hotspots and spikes.
  const status = String(entry.status ?? "open");
  return status !== TERMINAL_STATUS[kind];
}

/** Everything genuinely standing between a `proposed` ADR and acceptance. */
export function adrBlockers(
  adr: BlockerAdr,
  index: ReadonlyMap<string, BlockerEntry>,
): AdrBlockers {
  const ids = (adr.relates_to ?? [])
    .filter((x) => blockerKind(x) !== null)
    .filter((x) => isStillBlocking(x, index));

  const needsSurvey = adr.accounting_shaped === true &&
    (adr.survey ?? []).length === 0 &&
    !adr.survey_exemption;

  return { ids, needsSurvey };
}

/**
 * One rendering, used by both generated files.
 *
 * The two tables previously formatted this column differently — `in-force.generated.md` joined bare
 * ids with commas, `STATUS.generated.md` backticked them and joined with spaces. Two renderings of
 * one fact is how the two drift; this is the single owner.
 */
export function renderBlockers(b: AdrBlockers): string {
  const parts = b.ids.map((id) => `\`${id}\``);
  if (b.needsSurvey) parts.push("**rule 8a survey**");
  return parts.join(" ") || "—";
}
