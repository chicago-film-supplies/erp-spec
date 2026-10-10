/**
 * Fixtures are quint 0.32.0's real output, captured 2026-10-09 against formal/period-close.qnt —
 * a hold, a violation, an argument error, a passing and a failing `quint test`. Trimmed, never
 * paraphrased: the predicates match marker lines, so a hand-written fixture would test the regex
 * against itself.
 */
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import { classifyCheck, countTests, modulesIn, reconcile } from "./formal-predicates.ts";

const RUN_HOLD = `[State 16]
[ok] No violation found (63ms at 31746 traces/second).
You may increase --max-samples and --max-steps.`;
const RUN_VIOLATION = `[State 4]
[violation] Found an issue (11ms at 182 traces/second).
Use --seed=0x15 --backend=rust to reproduce.
error: Invariant violated`;
const VERIFY_HOLD = `[ok] No violation found (3701ms).
You may increase --max-steps.`;
const VERIFY_VIOLATION = `{ closedPeriods: Set(0), landed: 1, landedWhileClosed: true, pending: -1 }

[violation] Found an issue (3829ms).
error: found a counterexample`;
const ARG_ERROR = `error: [QNT405] Main module nope not found
error: Argument error`;

Deno.test("classifyCheck — exit code and marker must agree", async (t) => {
  const rows: [number, string, string, string][] = [
    [0, RUN_HOLD, "hold", "run, no violation"],
    [1, RUN_VIOLATION, "fail", "run, violation"],
    [0, VERIFY_HOLD, "hold", "verify, no violation"],
    [1, VERIFY_VIOLATION, "fail", "verify, counterexample"],
    [
      1,
      ARG_ERROR,
      "error",
      "⚠️ exit 1 with no marker — a typo must not pass as a companion failing",
    ],
    [0, "", "error", "exit 0 with no marker — nothing was checked"],
    [0, RUN_VIOLATION, "error", "marker and exit code disagree"],
    [1, RUN_HOLD, "error", "marker and exit code disagree"],
    [1, `${RUN_HOLD}\n${RUN_VIOLATION}`, "error", "both markers — ambiguous"],
  ];
  for (const [code, out, want, note] of rows) {
    await t.step(note, () => assertEquals(classifyCheck(code, out), want));
  }
});

const TEST_PASS = `
  period_close
    ok backdatedPostingIntoOpenPeriodLandsTest passed 1 test(s)
    ok commitAfterCloseIsDisabledTest passed 1 test(s)
    ok postingWhosePeriodClosedIsRefusedTest passed 1 test(s)
    ok validateIntoClosedPeriodIsDisabledTest passed 1 test(s)

  4 passing (220ms)`;
const TEST_FAIL = `
  period_close
    1) backdatedPostingIntoOpenPeriodLandsTest failed after 1 test(s)
    ok commitAfterCloseIsDisabledTest passed 1 test(s)
    ok postingWhosePeriodClosedIsRefusedTest passed 1 test(s)
    ok validateIntoClosedPeriodIsDisabledTest passed 1 test(s)

  3 passing (34ms)
  1 failed

  1) backdatedPostingIntoOpenPeriodLandsTest:
       Error [QNT508]: Assertion failed
error: Tests failed`;
const TEST_NONE = `
  period_close
`;

Deno.test("countTests", async (t) => {
  await t.step("all pass", () => assertEquals(countTests(TEST_PASS), { passed: 4, failed: 0 }));
  await t.step(
    "⚠️ a failure is printed twice and counted once",
    () => assertEquals(countTests(TEST_FAIL), { passed: 3, failed: 1 }),
  );
  await t.step(
    "no test matched — exit 0, zero counted",
    () => assertEquals(countTests(TEST_NONE), { passed: 0, failed: 0 }),
  );
});

Deno.test("modulesIn skips commented-out modules", () => {
  const src = `// module ghost {
/// module alsoGhost {
module real_one {
  val x = 1
}

module second_one{
}`;
  assertEquals(modulesIn(src), ["real_one", "second_one"]);
});

Deno.test("reconcile fails closed", async (t) => {
  const ok = [{
    file: "a.qnt",
    modules: [{ name: "p", expect: "hold" }, { name: "c", expect: "fail" }],
  }];
  await t.step(
    "matching declaration",
    () => assertEquals(reconcile(ok, { "a.qnt": ["p", "c"] }), []),
  );
  await t.step(
    "undeclared module",
    () =>
      assertEquals(reconcile(ok, { "a.qnt": ["p", "c", "new"] }), [
        "a.qnt: module new is not declared",
      ]),
  );
  await t.step(
    "declared module missing",
    () => assertEquals(reconcile(ok, { "a.qnt": ["p"] }), ["a.qnt: declared module c not found"]),
  );
  await t.step(
    "undeclared file",
    () =>
      assertEquals(reconcile(ok, { "a.qnt": ["p", "c"], "b.qnt": ["q"] }), [
        "b.qnt: not declared in expectations.yaml",
      ]),
  );
  await t.step("no fail companion", () =>
    assertEquals(
      reconcile([{ file: "a.qnt", modules: [{ name: "p", expect: "hold" }] }], { "a.qnt": ["p"] }),
      ["a.qnt: no fail-closed companion (no module declared expect: fail)"],
    ));
  await t.step("bad expect value", () =>
    assertEquals(
      reconcile([{
        file: "a.qnt",
        modules: [{ name: "p", expect: "hold" }, { name: "c", expect: "fails" }],
      }], { "a.qnt": ["p", "c"] }),
      [
        "a.qnt: c has expect: fails — must be hold or fail",
        "a.qnt: no fail-closed companion (no module declared expect: fail)",
      ],
    ));
});
