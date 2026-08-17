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

const steps: { name: string; cmd: string[] }[] = [
  { name: "Validate", cmd: ["deno", "task", "validate"] },
  { name: "Formatting", cmd: ["deno", "fmt", "--check"] },
  { name: "Regenerate", cmd: ["deno", "task", "gen"] },
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
console.log(`\n── Stale generated files ${"─".repeat(43)}`);
const diff = await new Deno.Command("git", {
  args: ["diff", "--quiet", "--", ":(glob)**/*.generated.*"],
}).output();
if (diff.code !== 0) {
  failures.push("Stale generated files");
  console.error("Generated files are stale. Run `deno task gen` and commit the result.\n");
  await new Deno.Command("git", {
    args: ["--no-pager", "diff", "--stat", "--", ":(glob)**/*.generated.*"],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
} else {
  console.log("clean");
}

console.log("\n" + "=".repeat(72));
if (failures.length === 0) {
  console.log("  ci: all four steps pass");
  console.log("=".repeat(72));
} else {
  console.log(`  ci: ${failures.length} of 4 steps FAILED — ${failures.join(", ")}`);
  console.log("=".repeat(72));
  Deno.exit(1);
}
