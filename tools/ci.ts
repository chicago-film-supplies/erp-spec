/**
 * The CI contract, in one place, runnable locally.
 *
 * ── why this exists ─────────────────────────────────────────────────────────────────────────────
 *
 * `.github/workflows/spec.yml` used to BE the definition of "what CI runs", and the only other copy
 * was whoever remembered to type four commands before pushing. Two owners for one fact, which is
 * the defect class this repo has paid for most often. **The workflow now calls this file**, so a
 * local run and a CI run are the same thing by construction rather than by agreement.
 *
 * It earned its keep immediately: GitHub Actions went billing-blocked on 2026-08-17 with the whole
 * org unable to run a job, and the only way to know a branch was clean was to run the steps by
 * hand and remember all four.
 *
 * ── the subtlety that makes this more than a shell one-liner ────────────────────────────────────
 *
 * ⚠️ **The steps do NOT short-circuit, and that is load-bearing.** The workflow carries `if:
 * always()` on every step after the first, with this reason:
 *
 * > Gating it behind validate's success would make it dead code for exactly as long as something
 * > else was broken — the "a guarantee nothing executes is not a guarantee" failure this repo
 * > exists to avoid.
 *
 * So `deno task validate && deno fmt --check && ...` would be WRONG: the stale-generated-file gate
 * would stop running the moment validate went red, which is precisely when a second failure is most
 * likely and least visible. Every step runs; every failure is reported; the exit code is the OR.
 *
 * ⚠️ **`deno fmt --check` writes nothing, and its position above `gen` is deliberate** — the stale
 * check diffs the whole working tree, so a formatter that edited files in place would make the two
 * gates report each other's failures.
 *
 * ── what this is NOT ────────────────────────────────────────────────────────────────────────────
 *
 * Not a replacement for CI. This runs on one machine, with that machine's Deno, against a working
 * tree that may hold anything. CI runs on a clean checkout on hardware nobody controls, and that
 * difference is the whole point of CI. Use this to know before you push; keep the workflow.
 *
 *   deno task ci
 */

import { classifyGenerated } from "./ci-predicates.ts";

const steps: { name: string; cmd: string[] }[] = [
  { name: "Validate", cmd: ["deno", "task", "validate"] },
  { name: "Formatting", cmd: ["deno", "fmt", "--check"] },
  { name: "Regenerate", cmd: ["deno", "task", "gen"] },
  // ⚠️ `tools/` had ZERO tests until 2026-08-17, which is why the staleness predicate below was
  // wrong three times. See `tools/ci-predicates_test.ts`.
  { name: "Tool tests", cmd: ["deno", "test", "tools/"] },
];

const failures: string[] = [];

for (const step of steps) {
  console.log(`\n── ${step.name} ${"─".repeat(Math.max(0, 60 - step.name.length))}`);
  const { code } = await new Deno.Command(step.cmd[0], {
    args: step.cmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (code !== 0) failures.push(step.name);
}

// The fourth step, and the one with a message rather than an exit code. `deno task gen` succeeds
// whether or not it CHANGED anything — a generated file is stale when the regeneration differs from
// what is committed, which only a diff can see.
//
// ⚠️ **THE ONE DELIBERATE DIVERGENCE FROM THE WORKFLOW, and it is what makes this usable at all.**
// CI diffs the WHOLE tree, which is exact there because the checkout is clean, so anything that
// moved was moved by `gen`. Locally the tree is almost never clean — the first run of this file
// failed on its own uncommitted `deno.json` edit — and a check that goes red whenever you have
// work in progress is a check nobody runs twice.
//
// So the diff is restricted to the generated files. **In CI the two are identical**, because a
// clean checkout makes "everything that changed" and "the generated files that changed" the same
// set. ⚠️ The residual risk is real and worth naming: if `generate.ts` ever wrote a file WITHOUT
// `.generated.` in its name, this would not see it and CI would. That is a second reason the naming
// convention is load-bearing, not just a readability habit.
//
// ⚠️ **AND THAT SCOPING ALONE WAS NOT ENOUGH — the first fix was incomplete in the same way the
// path probe's was.** Restricting to generated files stopped unrelated edits tripping it, and then
// editing a SOURCE file tripped it anyway, because `gen` correctly rewrites the generated files and
// the diff against HEAD is then non-empty. That is not staleness; it is work in progress.
//
// **Staleness is: the generated output moved while nothing that feeds it did.** So the source tree
// is checked too, and the two cases are reported differently. In CI both are clean, so the meaning
// is unchanged there — the extra condition only ever fires locally, which is exactly where the
// distinction exists.
console.log(`\n── Stale generated files ${"─".repeat(43)}`);
const generatedMoved = (await new Deno.Command("git", {
  args: ["diff", "--quiet", "--", ":(glob)**/*.generated.*"],
}).output()).code !== 0;
// Are any SOURCE files dirty? `:(exclude)` is git pathspec magic for "everything but".
//
// ⚠️ **`git diff` DOES NOT SEE UNTRACKED FILES, and that was the third wrong version of this
// check.** Adding a brand-new source file — a new ADR, say — left `sourceDirty` false, so the
// regeneration it legitimately caused was reported as staleness. The first version diffed the whole
// tree and fired on any work in progress; the second scoped to generated files and fired on source
// edits; this one missed untracked. **Each fix was incomplete in a way the previous test did not
// cover**, which is the defect class this repo keeps paying for, in the tool written to catch it.
const modified = (await new Deno.Command("git", {
  args: ["diff", "--quiet", "--", ".", ":(exclude,glob)**/*.generated.*"],
}).output()).code !== 0;
const untracked = (await new Deno.Command("git", {
  args: ["ls-files", "--others", "--exclude-standard"],
}).output()).stdout;
const sourceDirty = modified ||
  new TextDecoder().decode(untracked).split("\n").some((f) =>
    f.trim() !== "" && !f.includes(".generated.")
  );

const verdict = classifyGenerated(generatedMoved, modified, sourceDirty && !modified);
if (verdict === "stale") {
  // Generated output moved while nothing that feeds it did — the committed generated files did not
  // match the committed sources. This is the real defect, and it is what CI sees.
  failures.push("Stale generated files");
  console.error("Generated files are stale. Run `deno task gen` and commit the result.\n");
  await new Deno.Command("git", {
    args: ["--no-pager", "diff", "--stat", "--", ":(glob)**/*.generated.*"],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
} else if (verdict === "regenerated") {
  console.log("regenerated alongside your source edits — commit them together (not stale)");
} else {
  console.log("clean");
}

console.log("\n" + "=".repeat(72));
if (failures.length === 0) {
  console.log(`  ci: all ${steps.length + 1} steps pass`);
  console.log("=".repeat(72));
} else {
  console.log(
    `  ci: ${failures.length} of ${steps.length + 1} steps FAILED — ${failures.join(", ")}`,
  );
  console.log("=".repeat(72));
  Deno.exit(1);
}
