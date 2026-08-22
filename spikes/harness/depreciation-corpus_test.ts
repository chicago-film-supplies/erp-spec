/**
 * SPIKE-005 — the grader for `depreciation-corpus.yaml`.
 *
 * Two jobs, and only the second is about candidates:
 *
 *   1. **Keep the corpus honest.** Where Pub 946 states BOTH a rate and a dollar amount, the two
 *      must reconcile. That is an INDEPENDENT property — it does not consult anything this repo
 *      computes, only the publication against itself — which is what stops the corpus from being a
 *      fixed-point check on its own transcription.
 *   2. **Assert COVERAGE against SPIKE-005's own exit criterion**, facet by facet. This arm is
 *      expected to be RED until the corpus is finished, and that is the point: a coverage claim
 *      nothing can fail is exactly the shape the repo has been burned by twice this week.
 *
 * `deno task dep-corpus`. Not in CI — CI runs `deno task validate`, which has no npm dependencies
 * by design, and this needs the harness's YAML parser.
 */
import { parse } from "@std/yaml";
import { assert, assertEquals } from "jsr:@std/assert@^1.0.8";

// deno-lint-ignore no-explicit-any
const corpus = parse(
  await Deno.readTextFile(
    new URL("./depreciation-corpus.yaml", import.meta.url),
  ),
) as any;

/** Pub 946's worked examples round to the whole DOLLAR. Measured, not assumed — see the test. */
const roundToDollarMinor = (minor: number) => Math.round(minor / 100) * 100;
const applyPct = (basisMinor: number, pct: number) => (basisMinor * pct) / 100;

Deno.test("the corpus parses and every case is addressable", () => {
  assert(Array.isArray(corpus.cases) && corpus.cases.length > 0, "no cases");
  const ids = new Set<string>();
  for (const c of corpus.cases) {
    assert(c.id, "a case has no id");
    assert(!ids.has(c.id), `duplicate case id ${c.id}`);
    ids.add(c.id);
    assert(c.source, `${c.id}: no source — an answer with no citation is not evidence`);
    assert(Array.isArray(c.exercises) && c.exercises.length, `${c.id}: exercises nothing`);
    assert(c.expect, `${c.id}: no expectation`);
  }
});

Deno.test("DEP-002: the IRS's stated dollars reconcile against the IRS's stated rates", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-002");
  assert(c, "DEP-002 missing");
  const basis = new Map<string, number>(
    c.given.assets.map((a: { ref: string; basis_minor: number }) => [a.ref, a.basis_minor]),
  );
  for (const row of c.expect.per_asset) {
    const b = basis.get(row.ref)!;
    for (const yr of [1, 2]) {
      const pct = row[`year_${yr}_pct`];
      const stated = row[`year_${yr}_minor`];
      if (pct === undefined || stated === undefined) continue;
      assertEquals(
        roundToDollarMinor(applyPct(b, pct)),
        stated,
        `${row.ref} year ${yr}: ${pct}% of ${b} rounds to ${
          roundToDollarMinor(applyPct(b, pct))
        }, but the publication states ${stated}`,
      );
    }
  }
});

Deno.test("DEP-002: the 40% test arithmetic is what makes the convention mid-quarter", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-002");
  const total = c.given.assets.reduce(
    (a: number, x: { basis_minor: number }) => a + x.basis_minor,
    0,
  );
  assertEquals(total, c.expect.total_bases_minor, "stated total bases disagree with the assets");
  // "the last 3 months of the tax year" — a calendar-year taxpayer, so Oct/Nov/Dec.
  const lastQuarter = c.given.assets
    .filter((x: { placed_in_service: string }) => Number(x.placed_in_service.slice(5, 7)) >= 10)
    .reduce((a: number, x: { basis_minor: number }) => a + x.basis_minor, 0);
  assertEquals(lastQuarter, c.expect.last_quarter_bases_minor);
  const share = (lastQuarter / total) * 100;
  assertEquals(share, c.expect.last_quarter_share_pct);
  assertEquals(
    share > 40,
    c.expect.trips_forty_percent_test,
    "the 40% test is STRICTLY greater than — 'more than 40%', not 'at least'",
  );
  assertEquals(c.expect.convention, "mid_quarter");
});

Deno.test("DEP-004: the disposal case reconciles end to end", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-004");
  const b = c.given.basis_minor;
  assertEquals(roundToDollarMinor(applyPct(b, 5.00)), c.expect.year_2022_minor);
  assertEquals(roundToDollarMinor(applyPct(b, 38.00)), c.expect.year_2023_minor);
  assertEquals(roundToDollarMinor(applyPct(b, 22.80)), c.expect.year_2024_minor);
  assertEquals(roundToDollarMinor(applyPct(b, 13.68)), c.expect.year_2025_full_minor);
  // and the disposal factor, applied to a FULL year
  assertEquals(
    roundToDollarMinor(applyPct(c.expect.year_2025_full_minor, c.expect.disposal_factor_pct)),
    c.expect.year_2025_allowed_minor,
  );
  // the factor must be the one the corpus lists for that quarter, not a number retyped here
  assertEquals(
    corpus.disposal_factors.mid_quarter[`q${c.expect.disposal_quarter}_pct`],
    c.expect.disposal_factor_pct,
  );
});

Deno.test("mid-quarter first-year rates sum consistently across the four tables", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-003");
  const t = c.expect.first_year_rates_pct;
  // A property class's first-year rate must DECREASE as the placement quarter gets later —
  // an independent shape property that no transcription error preserves by accident.
  for (const cls of ["3_year", "5_year", "7_year", "10_year", "15_year"]) {
    const seq = [t.q1_table_A2[cls], t.q2_table_A3[cls], t.q3_table_A4[cls], t.q4_table_A5[cls]];
    for (let i = 1; i < seq.length; i++) {
      assert(
        seq[i] < seq[i - 1],
        `${cls}: Q${i + 1} rate ${seq[i]} is not below Q${i} rate ${seq[i - 1]}`,
      );
    }
  }
});

Deno.test("convention selection is a precedence, and half-year is the FALLBACK", () => {
  const order = corpus.convention_precedence.map((p: { id: string }) => p.id);
  assertEquals(order, ["mid_month", "mid_quarter", "half_year"]);
});

// ── ⚠️ THE COVERAGE ARM. Expected RED until the corpus is finished. ───────────────────────────
Deno.test("COVERAGE: every facet SPIKE-005's exit criterion names is exercised", () => {
  // Verbatim from `spikes/SPIKE-005-depreciation-hand-rolled-vs-library.md`, exit criterion 1.
  const REQUIRED: Record<string, string[]> = {
    "mid-month convention": ["mid_month"],
    "half-year convention": ["half_year"],
    "GDS class lives": ["gds"],
    "ADS class lives": ["ads"],
    "§179 effects on basis": ["section_179"],
    "bonus effects on basis": ["bonus_depreciation"],
    "partial disposals": ["partial_disposal"],
    "prospective useful-life revisions": ["prospective_revision"],
    "the deferred GAAP/tax difference": ["deferred_difference"],
    // ⚠️ NOT in the exit criterion, and REQ-FA-002 says it should be. Asserted deliberately.
    "mid-quarter convention (REQ-FA-002)": ["mid_quarter"],
  };
  const exercised = new Set<string>(
    corpus.cases.flatMap((c: { exercises: string[] }) => c.exercises),
  );
  const missing = Object.entries(REQUIRED)
    .filter(([, tags]) => !tags.some((t) => exercised.has(t)))
    .map(([facet]) => facet);
  assertEquals(
    missing,
    [],
    `corpus does not yet exercise: ${missing.join(", ")}. ` +
      `SPIKE-005 exit criterion 1 is a COVERAGE claim, so this arm is the criterion.`,
  );
});
