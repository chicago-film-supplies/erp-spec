/**
 * Run every Quint module in `formal/` and fail unless each does what `formal/expectations.yaml`
 * says it must (erp-spec#69, ADR-0054 D3).
 *
 *   deno task formal            # typecheck, test, simulate and model-check everything
 *   deno task formal --no-verify  # skip Apalache (needs Java 21); simulation and tests still run
 *
 * ── why this is not in `deno task ci` ───────────────────────────────────────────────────────────
 *
 * `validate` is npm-free and network-free BY DESIGN, and `ci` is what `spec.yml` runs. Quint is an
 * npm package and Apalache a JVM download, so this is its own task and its own workflow
 * (`.github/workflows/formal.yml`), the same split `tax-rules-refresh.yml` makes.
 *
 * ── what "must FAIL" means here ─────────────────────────────────────────────────────────────────
 *
 * A fail-closed companion passes this runner only when Quint prints `[violation]` AND exits
 * non-zero. Exit code alone also fires on an argument error (see `formal-predicates.ts`), and a
 * companion that "fails" because its `--main` was misspelt is the gate that reads green while
 * matching nothing. Every check is classified hold / fail / error, and `error` is never accepted.
 *
 * ── what this does NOT check ────────────────────────────────────────────────────────────────────
 *
 * - **Coverage per action** (ADR-0054 D3's second half). A random run that never fires an action
 *   still reports `[ok]`. Not measured yet.
 * - **Beyond the step bound.** `verify` is bounded model checking; a violation longer than
 *   `--max-steps` (default 10) is not found.
 * - **That the model matches the implementation.** There is no implementation. ITF trace replay is
 *   ADR-0054's layer 4 and is unbuilt.
 */

import { parse as parseYaml } from "@std/yaml";
import {
  classifyCheck,
  countTests,
  type Declared,
  modulesIn,
  type Outcome,
  reconcile,
} from "./formal-predicates.ts";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const FORMAL = `${ROOT}/formal`;

type Module = { name: string; invariant: string; expect: Outcome; tests: number };
type Expectations = { quint: string; specs: { file: string; modules: Module[] }[] };

const exp = parseYaml(await Deno.readTextFile(`${FORMAL}/expectations.yaml`)) as Expectations;
const verify = !Deno.args.includes("--no-verify");
// The pin's one owner is expectations.yaml. `npx -y` with an exact version runs that version or
// nothing — no range, no lockfile drift.
const QUINT = ["-y", `@informalsystems/quint@${String(exp.quint)}`];

const onDisk: Record<string, string[]> = {};
for await (const e of Deno.readDir(FORMAL)) {
  if (e.isFile && e.name.endsWith(".qnt")) {
    onDisk[e.name] = modulesIn(await Deno.readTextFile(`${FORMAL}/${e.name}`));
  }
}

const failures: string[] = [];
for (const p of reconcile(exp.specs as Declared[], onDisk)) failures.push(p);

async function quint(args: string[]): Promise<{ code: number; out: string }> {
  const { code, stdout, stderr } = await new Deno.Command("npx", {
    args: [...QUINT, ...args],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const dec = new TextDecoder();
  return { code, out: dec.decode(stdout) + dec.decode(stderr) };
}

/** Print the tail of a check's output so a CI failure is diagnosable from the log alone. */
const tail = (out: string, n = 12) =>
  out.trimEnd().split("\n").slice(-n).map((l) => `      ${l}`).join("\n");

console.log(`quint ${exp.quint}${verify ? "" : " (--no-verify: Apalache skipped)"}\n`);

for (const spec of exp.specs) {
  const path = `formal/${spec.file}`;
  if (!onDisk[spec.file]) continue; // already reported by reconcile

  const tc = await quint(["typecheck", path]);
  console.log(`${spec.file}  typecheck ${tc.code === 0 ? "ok" : "FAILED"}`);
  if (tc.code !== 0) {
    failures.push(`${spec.file}: typecheck`);
    console.log(tail(tc.out));
    continue;
  }

  for (const m of spec.modules) {
    const main = `--main=${m.name}`;
    const inv = `--invariant=${m.invariant}`;
    const line: string[] = [];

    const t = await quint(["test", path, main]);
    const { passed, failed } = countTests(t.out);
    const testsOk = t.code === 0 && failed === 0 && passed === m.tests;
    line.push(`test ${passed}/${m.tests}${testsOk ? "" : " ✗"}`);
    if (!testsOk) {
      failures.push(
        `${m.name}: quint test — ${passed} passed, ${failed} failed, ${m.tests} declared`,
      );
    }

    // 20,000 × 20 is the recorded configuration (formal/README.md). No fixed seed: Quint prints
    // the one it used, so a failure is reproducible from the log.
    const r = await quint(["run", path, main, inv, "--max-samples=20000", "--max-steps=20"]);
    const rOut = classifyCheck(r.code, r.out);
    line.push(`run ${rOut}${rOut === m.expect ? "" : " ✗"}`);
    if (rOut !== m.expect) failures.push(`${m.name}: run gave ${rOut}, must ${m.expect}`);

    let vOut: Outcome | "skipped" = "skipped";
    let v = { code: 0, out: "" };
    if (verify) {
      v = await quint(["verify", path, main, inv]);
      vOut = classifyCheck(v.code, v.out);
      if (vOut !== m.expect) failures.push(`${m.name}: verify gave ${vOut}, must ${m.expect}`);
    }
    line.push(`verify ${vOut}${vOut === m.expect || vOut === "skipped" ? "" : " ✗"}`);

    console.log(`  ${m.name.padEnd(24)} must ${m.expect.padEnd(4)}  ${line.join("  ")}`);
    if (!testsOk) console.log(tail(t.out));
    if (rOut !== m.expect) console.log(tail(r.out));
    if (verify && vOut !== m.expect) console.log(tail(v.out));
  }
}

console.log("\n" + "=".repeat(72));
if (failures.length === 0) {
  console.log("  formal: every module did what expectations.yaml says");
  console.log("=".repeat(72));
} else {
  console.log(`  formal: ${failures.length} problem(s)`);
  for (const f of failures) console.log(`    - ${f}`);
  console.log("=".repeat(72));
  Deno.exit(1);
}
