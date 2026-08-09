/**
 * The `deno test` leg of SPIKE-001. Needs a running cluster — see _README.md.
 * Same `runTbProbe()` the script and the compiled binary call, so the three modes are comparable.
 */
import { runTbProbe } from "./tb-probe.ts";

const results = await runTbProbe();
for (const r of results) {
  Deno.test(`tigerbeetle under deno test: ${r.name}`, () => {
    if (!r.ok) throw new Error(r.detail);
    console.log(`  → ${r.detail} (${r.ms}ms)`);
  });
}
