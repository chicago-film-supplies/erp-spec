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

Deno.test("DEP-013: the Sankofa partial disposal chains, figure by figure", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-013");
  const g = c.given, e = c.expect;
  // the GAA's basis and reserve are each reduced by the removed machines' own share
  assertEquals(
    g.gaa_unadjusted_basis_minor - g.removed_basis_minor,
    e.gaa_basis_after_removal_minor,
  );
  assertEquals(
    g.reserve_at_2025_01_01_minor - g.dep_allowed_on_removed_through_2024_minor,
    e.reserve_after_removal_minor,
  );
  // the year's GAA depreciation is the rate applied to what is left
  assertEquals(
    applyPct(e.gaa_basis_after_removal_minor - e.reserve_after_removal_minor, g.annual_rate_pct),
    e.gaa_depreciation_2025_minor,
  );
  // and the removed machines KEEP depreciating in the disposal year, at half a year
  const perMachineAllowedThrough2024 = g.dep_allowed_on_removed_through_2024_minor /
    g.removed_count;
  assertEquals(
    applyPct(g.machine_cost_minor - perMachineAllowedThrough2024, g.annual_rate_pct) / 2,
    e.per_machine_dep_2025_minor,
    "the disposal-year half-year deduction on a removed asset",
  );
  assertEquals(
    (g.machine_cost_minor - perMachineAllowedThrough2024) - e.per_machine_dep_2025_minor,
    e.per_machine_adjusted_basis_minor,
  );
  assertEquals(
    e.per_machine_adjusted_basis_minor - g.proceeds_per_machine_minor,
    e.per_machine_loss_minor,
  );
});

Deno.test("DEP-011: the §280F first-year cap has TWO values and they differ by $8,000", () => {
  const e = corpus.cases.find((x: { id: string }) => x.id === "DEP-011").expect;
  assertEquals(
    e.year_1_with_bonus_minor - e.year_1_without_bonus_minor,
    800000,
    "the §168(k) first-year increase",
  );
  // the caps decline monotonically after year 1 — a shape property, independent of transcription
  const tail = [e.year_2_minor, e.year_3_minor, e.year_4_and_later_minor];
  for (let i = 1; i < tail.length; i++) {
    assert(tail[i] < tail[i - 1], `cap year ${i + 2} is not below year ${i + 1}`);
  }
  assert(e.exempt_above_gvwr_lb === 6000, "the GVWR threshold is what makes a van exempt");
});

Deno.test("DEP-012: ADS-required listed property is the link between three facets", () => {
  const e = corpus.cases.find((x: { id: string }) => x.id === "DEP-012").expect;
  assertEquals(e.method, "straight_line");
  assert(
    e.required_use_triggers.some((t: string) => /listed property used 50% or less/.test(t)),
    "the listed-property trigger is what ties §280F, ADS and bonus into one dependency",
  );
  assert(/ineligible/.test(e.side_effect), "ADS-required property also loses bonus");
});

Deno.test("DEP-014: the short-year proration reconciles", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-014");
  const g = c.given, e = c.expect;
  assertEquals(applyPct(g.basis_minor, g.declining_balance_rate_pct), e.full_year_minor);
  assertEquals(
    roundToDollarMinor((e.full_year_minor * e.months_allowed) / 12),
    e.short_year_minor,
    "a full year prorated by months-allowed over 12, rounded to the dollar",
  );
  // the deemed date is the first day of the sixth month of a 10-month short year
  assertEquals(g.short_tax_year_months, 10);
  assertEquals(e.deemed_placed_in_service.slice(5, 7), "08");
});

Deno.test("DEP-016: the §280F recapture refigure reconciles three ways", () => {
  const c = corpus.cases.find((x: { id: string }) => x.id === "DEP-016");
  const g = c.given, e = c.expect;
  // 1. total claimed is §179 plus the MACRS actually taken
  assertEquals(g.section_179_minor + e.depreciation_claimed_2021_2024_minor, e.total_claimed_minor);
  // 2. the ADS refigure is straight line, half-year: 10/20/20/20 of the FULL basis
  const refigured = e.ads_refigure_rates_pct.reduce(
    (a: number, pct: number) => a + applyPct(g.basis_minor, pct),
    0,
  );
  assertEquals(
    refigured,
    e.ads_refigured_minor,
    "ADS straight-line refigure over the first 4 years",
  );
  // 3. and the excess is the difference
  assertEquals(e.total_claimed_minor - e.ads_refigured_minor, e.excess_depreciation_minor);
  // the half-year first year is half of a full straight-line year over 5 years (20%)
  assertEquals(e.ads_refigure_rates_pct[0] * 2, e.ads_refigure_rates_pct[1]);
  // heavy vehicle: exempt from the CAPS but NOT from recapture — the two rules are independent
  assertEquals(g.gvwr_over_6000_lb, true);
  assertEquals(e.subject_to_280f_caps, false);
  assertEquals(e.recapture_triggered, true);
});

Deno.test("DEP-015: ADS periods are never shorter than their GDS counterparts", () => {
  const ads =
    corpus.cases.find((x: { id: string }) => x.id === "DEP-015").expect.recovery_periods_years;
  // An independent shape property: ADS is the SLOWER system, so where both are known it cannot be
  // shorter. GDS figures come from the tables in DEP-003/DEP-005, not from this case.
  const GDS: Record<string, number> = {
    nonresidential_real_property: 39,
    residential_rental_property: 27.5,
    automobiles_and_light_duty_trucks: 5,
    computers_and_peripheral_equipment: 5,
  };
  for (const [k, gds] of Object.entries(GDS)) {
    assert(ads[k] >= gds, `ADS ${k} is ${ads[k]}, shorter than GDS ${gds}`);
  }
  assert(ads.nonresidential_real_property > GDS.nonresidential_real_property, "39 vs 40");
});

Deno.test("DEP-017: §168(n) needs BOTH date tests, on two different events", () => {
  const e = corpus.cases.find((x: { id: string }) => x.id === "DEP-017").expect;
  assert(
    e.placed_in_service_after > e.construction_began_or_acquired_after,
    "the two dates differ",
  );
  assertEquals(e.allowance_pct, 100);
  assertEquals(e.elective, true);
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
    "listed property / §280F caps (OQ-054, HOT-023)": ["section_280f"],
    // ⚠️ Added 2026-08-22 by the owner's scope ruling — ALL valid GAAP and US tax cases, not only
    // the ones CFS uses today. Each was previously excluded on a measured population of zero.
    "short tax year": ["short_tax_year"],
    "ADS full class-life tables": ["ads_full_tables"],
    "§280F recapture": ["section_280f_recapture"],
    "§168(n) qualified production property": ["qualified_production_property"],
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
