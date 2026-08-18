/**
 * The full truth table for `classifyGenerated`, enumerated from the INPUT SPACE.
 *
 * ⚠️ **Three booleans is eight rows and all eight are here**, including combinations nobody expects
 * to reach. That is the whole point: the staleness check was wrong three times, and each time the
 * hand-test covered exactly the state that had just broken. A regression test per bug reproduces
 * that coverage. Enumerating the space does not.
 *
 * The rows that each caught a real bug are marked. **Five did not catch anything**, and they are
 * kept for the same reason the other three are: nobody knew in advance which three those would be.
 */
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { classifyGenerated, isGeneratedPath } from "./ci-predicates.ts";

Deno.test("classifyGenerated — the full 2x2x2", async (t) => {
  const rows: [boolean, boolean, boolean, string, string][] = [
    // generatedMoved, sourceModified, sourceUntracked, expected, note
    [false, false, false, "clean", "nothing happening — the CI case"],
    [false, false, true, "clean", "a new file that feeds nothing generated"],
    [false, true, false, "clean", "source edited, generated output unaffected"],
    [false, true, true, "clean", "both kinds of source change, generated unaffected"],
    [true, false, false, "stale", "⚠️ BUG 1+2 — the real defect: committed pair disagree"],
    [
      true,
      false,
      true,
      "regenerated",
      "⚠️ BUG 3 — untracked source (a new ADR) is invisible to git diff",
    ],
    [
      true,
      true,
      false,
      "regenerated",
      "⚠️ BUG 2 — editing a tracked source legitimately moves output",
    ],
    [true, true, true, "regenerated", "both kinds of source change"],
  ];
  for (const [moved, mod, untracked, expected, note] of rows) {
    await t.step(
      `moved=${moved ? "Y" : "n"} mod=${mod ? "Y" : "n"} untracked=${
        untracked ? "Y" : "n"
      } -> ${expected}  (${note})`,
      () => assertEquals(classifyGenerated(moved, mod, untracked), expected),
    );
  }
});

Deno.test("classifyGenerated — only ONE of eight is a failure", () => {
  const all: [boolean, boolean, boolean][] = [];
  for (const a of [false, true]) {
    for (const b of [false, true]) for (const c of [false, true]) all.push([a, b, c]);
  }
  const stale = all.filter(([a, b, c]) => classifyGenerated(a, b, c) === "stale");
  // ⚠️ Asserted as a COUNT rather than row by row: a change that widens what fails would pass every
  // individual row above while quietly turning a green tree red, and this is the arm that catches it.
  assertEquals(stale.length, 1, "exactly one input combination may be a build failure");
  assertEquals(stale[0], [true, false, false]);
});

Deno.test("isGeneratedPath", async (t) => {
  const cases: [string, boolean][] = [
    ["STATUS.generated.md", true],
    ["adr/in-force.generated.md", true],
    ["traceability/matrix.generated.json", true],
    ["spec-map.generated.opml", true],
    ["ledger/chart-of-accounts.yaml", false],
    ["adr/ADR-0019-labor-costing-is-normal-costing.md", false],
    // ⚠️ The residual the convention rests on: a generated file that forgot the infix reads as
    // source here and as a diff in CI. Asserted so the assumption is visible rather than implied.
    ["STATUS.md", false],
  ];
  for (const [path, expected] of cases) {
    await t.step(`${path} -> ${expected}`, () => assertEquals(isGeneratedPath(path), expected));
  }
});
