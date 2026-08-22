/**
 * SPIKE-005 exit criterion 2 — score every candidate engine against the corpus.
 *
 * ── Why this is a PROBE and not a paragraph ─────────────────────────────────────────────────────
 *
 * The finding is an ABSENCE: no published package implements US tax depreciation. An absence is the
 * single most perishable kind of claim — it is true until the day someone publishes one, and
 * nothing announces that. So it is measured here rather than asserted in prose, and re-running it
 * is how the decision gets revisited instead of assumed.
 *
 * ⚠️ **A candidate fails this scorecard on CAPABILITY, not on quality.** Nothing below is a
 * judgement about how well these packages do what they do — `@classytic/assets` is a competent IFRS
 * engine. The question is only whether it computes the cases in `depreciation-corpus.yaml`, and
 * IFRS has no MACRS, no §179 and no §280F because those are US tax law rather than accounting.
 *
 * Failures are ITEMISED per the exit criterion, never summarised.
 *
 * `deno task dep-candidates`. Needs network to the two registries and nothing else.
 */

/** The facets the corpus requires. A candidate must reach them to be scoreable at all. */
const FACETS = [
  "MACRS",
  "mid-quarter",
  "mid-month",
  "half-year",
  "179",
  "280F",
  "bonus",
  "ADS",
  "GDS",
  "GAAP",
] as const;

const NPM = "https://registry.npmjs.org";
const JSR = "https://api.jsr.io";

async function jsonOf(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) return null;
  return await r.json();
}

console.log("SPIKE-005 criterion 2 — candidate engines, scored against depreciation-corpus.yaml\n");

// ── 1. Does a MACRS engine exist at all, on either registry the stack can consume? ─────────────
console.log("── registry sweep: is there anything to buy? ───────────────────────────────────────");
const terms = ["macrs", "section179", "depreciation", "fixed-asset", "irs depreciation"];
const found: Record<string, number> = {};
for (const t of terms) {
  const npm = await jsonOf(`${NPM}/-/v1/search?text=${encodeURIComponent(t)}&size=1`) as
    | { total?: number }
    | null;
  const jsr = await jsonOf(`${JSR}/packages?query=${encodeURIComponent(t)}&limit=1`) as
    | { total?: number }
    | null;
  const n = npm?.total ?? -1, j = jsr?.total ?? -1;
  found[t] = n;
  console.log(`  ${t.padEnd(18)} npm=${String(n).padStart(6)}   jsr=${String(j).padStart(6)}`);
}
console.log(
  `\n  ⇒ "macrs" on npm: ${found["macrs"]}.  "section179" on npm: ${found["section179"]}.`,
);
console.log("     A zero here is the whole finding — re-run before trusting it.\n");

// ── 2. Score the named candidates, facet by facet ──────────────────────────────────────────────
const CANDIDATES = [
  { reg: "npm", id: "asset-depreciation-calculator" },
  { reg: "npm", id: "@finprecise/depreciation" },
  { reg: "npm", id: "@classytic/assets" },
  { reg: "npm", id: "@simplifyingcalculation/irs-sec-179-calculator" },
];

console.log("── candidate scorecard ────────────────────────────────────────────────────────────");
console.log("   Scored on whether the package's own description and README EVIDENCE the facet.");
console.log("   ⚠️ Evidence of mention, not proof of correctness — a mention is the FLOOR. A");
console.log("   candidate that cannot even name a facet certainly does not implement it.\n");

for (const c of CANDIDATES) {
  const meta = await jsonOf(`${NPM}/${encodeURIComponent(c.id)}`) as
    | {
      description?: string;
      readme?: string;
      "dist-tags"?: Record<string, string>;
      time?: Record<string, string>;
    }
    | null;
  if (!meta) {
    console.log(`  ${c.id}: NOT RESOLVABLE`);
    continue;
  }
  const latest = meta["dist-tags"]?.latest ?? "?";
  const when = (meta.time?.[latest] ?? "").slice(0, 10);
  const text = `${meta.description ?? ""}\n${meta.readme ?? ""}`;
  const hit = (f: string) => new RegExp(f.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i").test(text);
  const missing = FACETS.filter((f) => !hit(f));
  console.log(`  ${c.id}  v${latest} (${when})`);
  console.log(`      ${(meta.description ?? "").slice(0, 120)}`);
  console.log(`      present : ${FACETS.filter(hit).join(", ") || "— none —"}`);
  console.log(`      MISSING : ${missing.join(", ")}`);
  console.log(
    `      ⇒ ${
      missing.length === 0
        ? "scoreable against the corpus"
        : `fails ${missing.length} of ${FACETS.length} facets — not scoreable`
    }\n`,
  );
}

console.log("── what this probe does NOT establish ─────────────────────────────────────────────");
console.log("  · That a candidate naming a facet IMPLEMENTS it correctly. Nothing here executes a");
console.log("    candidate; the corpus would, if one ever reached the floor.");
console.log("  · That no PRIVATE or non-registry engine exists. Only npm and JSR were swept —");
console.log("    the two registries this stack can actually consume.");
console.log("  · Anything about quality. Every failure above is a CAPABILITY gap.");
