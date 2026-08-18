/**
 * The DECISIONS `tools/ci.ts` makes, separated from the git calls that feed them.
 *
 * ── why this file exists ────────────────────────────────────────────────────────────────────────
 *
 * The staleness check was wrong **three times** — each fix correct for the case just hit and blind
 * to a neighbouring one:
 *
 *   1. diffed the whole tree      → fired on any work in progress
 *   2. scoped to `*.generated.*`  → fired on source edits
 *   3. added a source-dirty guard → missed UNTRACKED source files (`git diff` cannot see them)
 *
 * ⚠️ **The cause was not git subtleties. It was that the decision lived inside the IO**, so the only
 * way to exercise a branch was to hit it in production — which is this repo's own rule about an
 * unexercised branch being a claim rather than a capability, occurring in the tool written to
 * enforce it.
 *
 * ⚠️ **The test enumerates the INPUT SPACE, not the bugs.** Three booleans is eight rows, and all
 * eight are asserted whether or not anyone can imagine reaching them. A regression test per bug
 * would give exactly the coverage that already failed three times.
 */

/** What the working tree is telling us about generated files. */
export type GeneratedVerdict =
  /** Generated output matches the committed sources. */
  | "clean"
  /** Generated output moved while nothing feeding it did — the committed pair disagree. */
  | "stale"
  /** Generated output moved because source changed too. Commit them together; not a defect. */
  | "regenerated";

/**
 * ⚠️ **`sourceUntracked` is separate from `sourceModified` on purpose** — `git diff` reports only
 * TRACKED changes, so a brand-new file is invisible to it. Collapsing the two into one "dirty" flag
 * is precisely the third bug.
 */
export function classifyGenerated(
  generatedMoved: boolean,
  sourceModified: boolean,
  sourceUntracked: boolean,
): GeneratedVerdict {
  if (!generatedMoved) return "clean";
  return sourceModified || sourceUntracked ? "regenerated" : "stale";
}

/**
 * A path whose *content* is produced by `deno task gen`.
 *
 * The `.generated.` infix is the repo's own convention and the gate depends on it: a generated file
 * without it would be invisible here and visible to CI, which is stated as a residual risk rather
 * than defended against.
 */
export function isGeneratedPath(path: string): boolean {
  return path.includes(".generated.");
}
