/**
 * The pure half of `tools/formal.ts` — what a Quint run's output MEANS, and whether the declared
 * module list matches the modules on disk. No IO, so `deno test tools/` covers it with no
 * permission flags, the same split as `ci-predicates.ts`.
 *
 * ⚠️ **Exit code alone cannot tell a violation from a crash.** Measured against quint 0.32.0 on
 * 2026-10-09: `run` and `verify` exit 1 on a violation AND on an argument error (`--main=nope`
 * also exits 1). So a fail-closed companion "failing" on exit code alone would pass on a typo — the
 * exact green-while-matching-nothing defect this repo lands gates red to avoid. The outcome is read
 * from the marker line Quint prints, `[ok]` or `[violation]`, and exit code must agree with it.
 */

export type Outcome = "hold" | "fail" | "error";

/** Classify one `quint run` / `quint verify` invocation from its exit code and combined output. */
export function classifyCheck(code: number, output: string): Outcome {
  const ok = /^\[ok\] No violation found/m.test(output);
  const violation = /^\[violation\] Found an issue/m.test(output);
  if (code === 0 && ok && !violation) return "hold";
  if (code !== 0 && violation && !ok) return "fail";
  return "error";
}

/**
 * Count passing and failing tests in `quint test` output. A `quint test` whose `--match` selects
 * nothing exits 0 with zero tests (measured), which is why the caller compares against a declared
 * count rather than trusting the exit code.
 */
export function countTests(output: string): { passed: number; failed: number } {
  const passed = (output.match(/^\s+ok \S+ passed/gm) ?? []).length;
  // A failing test is printed `1) name failed after …` in the list, and AGAIN as `1) name:` in the
  // error detail below it — so the match requires `failed`, or every failure counts twice.
  const failed = (output.match(/^\s+\d+\) \S+ failed/gm) ?? []).length;
  return { passed, failed };
}

/** Top-level module names declared in one `.qnt` source. Comments are skipped. */
export function modulesIn(source: string): string[] {
  return [...source.matchAll(/^module\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm)].map((m) => m[1]);
}

export type Declared = { file: string; modules: { name: string; expect: string }[] };

/**
 * Every disagreement between what `formal/expectations.yaml` declares and what is on disk.
 * FAILS CLOSED: an undeclared module, a declared module that is missing, a spec file with no
 * `fail` companion, and a `.qnt` file not declared at all are each a problem.
 */
export function reconcile(
  declared: Declared[],
  onDisk: Record<string, string[]>,
): string[] {
  const problems: string[] = [];
  const declaredFiles = new Set(declared.map((d) => d.file));
  for (const file of Object.keys(onDisk).sort()) {
    if (!declaredFiles.has(file)) problems.push(`${file}: not declared in expectations.yaml`);
  }
  for (const d of declared) {
    const found = onDisk[d.file];
    if (!found) {
      problems.push(`${d.file}: declared but not in formal/`);
      continue;
    }
    const names = new Set(d.modules.map((m) => m.name));
    for (const m of found) {
      if (!names.has(m)) problems.push(`${d.file}: module ${m} is not declared`);
    }
    for (const m of d.modules) {
      if (!found.includes(m.name)) problems.push(`${d.file}: declared module ${m.name} not found`);
      if (m.expect !== "hold" && m.expect !== "fail") {
        problems.push(`${d.file}: ${m.name} has expect: ${m.expect} — must be hold or fail`);
      }
    }
    if (!d.modules.some((m) => m.expect === "fail")) {
      problems.push(`${d.file}: no fail-closed companion (no module declared expect: fail)`);
    }
    if (!d.modules.some((m) => m.expect === "hold")) {
      problems.push(`${d.file}: no module declared expect: hold`);
    }
  }
  return problems;
}
