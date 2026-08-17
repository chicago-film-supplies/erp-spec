/**
 * Enumerate every live Firestore collection and every field path in it — erp-spec#8 / m6.
 *
 * ── Why this exists, in m6's own words ───────────────────────────────────────────────────────────
 *
 * `roadmap/milestones.yaml` marks m6's first exit criterion `prose_only: true` with this reason:
 *
 * > "Every current path" is defined by the LIVE database, which this repo cannot enumerate offline.
 * > **A checker would compare the map against itself and always pass.**
 *
 * That is exactly right, and it is this repo's own first rule — *a guard that can only consult its
 * own oracle is not a guard*. The answer is not to give up on checking it; it is to make the
 * external fact available offline, which is the same move `tb-field-budget_test.ts` makes against
 * `tigerbeetle-node`'s type declaration. This probe writes the inventory; `validate.ts` checks
 * `migration/field-map.yaml` against the written inventory; the probe is how the inventory is
 * refreshed. Neither half can pass by agreeing with itself.
 *
 * ⚠️ **The MCP `db_schema` enum is NOT the list.** It carries 35 collections and omits at least
 * `credit-notes` and `settlements`, both of which `migration/field-map.yaml` already maps. A
 * hand-maintained enum of the collections is the same defect class as everything else this repo has
 * paid for; the list comes from `db.listCollections()`.
 *
 * ── What a "path" is here ────────────────────────────────────────────────────────────────────────
 *
 * The `select` dialect the MCP tools use, so the inventory and the field map speak one language:
 * a path crossing an array carries `[]` — `items[].price.base_cents`. Leaf scalars only; a map is
 * not itself a path, its leaves are.
 *
 * ⚠️ **Paths are unioned across documents, so an optional field appears if ANY document has it** —
 * which is what a migration needs. A field nothing carries is invisible here and that is correct:
 * it is not a "current Firestore path".
 *
 * ── Read the header of `corpus.ts` for the auth path ─────────────────────────────────────────────
 *
 *   cd spikes/harness && deno task inventory        # print
 *   cd spikes/harness && deno task inventory --write # write migration/live-paths.measured.yaml
 */

import { listCollections, pathScan, PROJECT } from "./corpus.ts";
// ⚠️ Reaches OUT of the harness on purpose: `tools/dates.ts` is dependency-free, and the whole
// point of it is that this file must not carry its own copy of the reduction.
import { todayUTC } from "../../tools/dates.ts";

/**
 * A key that identifies a RECORD rather than naming a FIELD.
 *
 * ⚠️ Without this the inventory is nonsense on any map keyed by uid, and it is not a rare shape:
 * `tracking-categories.products` is a map keyed by product uid, and the first run of this probe
 * reported **1,123 paths across 20 documents** for that one collection — every product in the
 * corpus, counted as a schema field. A field map built against that would have 1,123 rows to
 * "cover" and none of them would be a field.
 */
const ID_KEY =
  /^(custom-)?([A-Za-z0-9_-]{20}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/;

/** Dynamic-map paths collapsed to `<key>`, reported so the collapse is auditable, never silent. */
const collapsed = new Set<string>();

/**
 * Leaf paths of one document, in the `select` dialect that the MCP tools and the field map use.
 *
 * A map is treated as dynamic — collapsed to `<key>` — when it has at least three entries and every
 * key is id-shaped. Three, not one: a two-key map of real field names whose names happen to look
 * like ids is implausible, and a genuine record map always has many. The alternative heuristic,
 * "the children are homogeneous", is deliberately NOT used — plenty of real field groups are
 * homogeneous (`address.city`/`.street`/`.postcode`), and it would collapse them.
 */
const paths = (node: unknown, prefix: string, out: Set<string>, depth = 0): void => {
  if (depth > 12) return; // pathological nesting; nothing in this corpus approaches it
  if (Array.isArray(node)) {
    // An array of scalars is a leaf (`query_by_orders[]`); an array of maps opens `[]`.
    if (node.length === 0) out.add(`${prefix}[]`);
    else if (node.some((v) => v !== null && typeof v === "object" && !(v instanceof Date))) {
      for (const v of node) paths(v, `${prefix}[]`, out, depth + 1);
    } else out.add(`${prefix}[]`);
    return;
  }
  if (node !== null && typeof node === "object" && !(node instanceof Date)) {
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length === 0) out.add(prefix);
    const dynamic = entries.length >= 3 && entries.every(([k]) => ID_KEY.test(k));
    if (dynamic) {
      if (prefix) collapsed.add(prefix);
      // One representative child is enough — they are the same record shape by construction.
      for (const [, v] of entries) paths(v, `${prefix}.<key>`, out, depth + 1);
      return;
    }
    for (const [k, v] of entries) paths(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    return;
  }
  if (prefix) out.add(prefix);
};

const collections = await listCollections();
console.log(`${PROJECT}: ${collections.length} collections\n`);

const inventory: {
  collection: string;
  documents: number;
  capped: boolean;
  paths: string[];
}[] = [];

for (const c of collections) {
  const { scanned, capped, docs } = await pathScan(c, 60000);
  const set = new Set<string>();
  for (const d of docs) paths(d, "", set);
  const sorted = [...set].sort();
  inventory.push({ collection: c, documents: scanned, capped, paths: sorted });
  console.log(
    `  ${c.padEnd(24)} ${String(scanned).padStart(6)} docs  ${
      String(sorted.length).padStart(4)
    } paths${capped ? "   ⚠️ CAPPED — inventory may be incomplete" : ""}`,
  );
}

const totalPaths = inventory.reduce((n, c) => n + c.paths.length, 0);
const cappedCollections = inventory.filter((c) => c.capped).map((c) => c.collection);
const empty = inventory.filter((c) => c.documents === 0).map((c) => c.collection);

console.log(`\n${totalPaths} paths across ${collections.length} collections`);
if (collapsed.size) {
  console.log(
    `\ndynamic maps collapsed to \`<key>\` (${collapsed.size}) — a key identifying a RECORD, not a field:`,
  );
  for (const p of [...collapsed].sort()) console.log(`  ${p}.<key>`);
}
// ⚠️ No silent caps. A partial sweep that reads as exhaustive is worse than no sweep.
if (cappedCollections.length) {
  console.log(`⚠️ CAPPED (raise the hardCap and re-run): ${cappedCollections.join(", ")}`);
}
if (empty.length) {
  console.log(
    `⚠️ EMPTY — zero documents, so zero paths. These are collections whose shape is UNKNOWN, not` +
      ` collections with no fields, and the field map must say which: ${empty.join(", ")}`,
  );
}

if (!Deno.args.includes("--write")) {
  console.log(`\nNothing written. Re-run with --write.`);
} else {
  // Hand-rolled rather than a YAML serialiser: the file is read by `validate.ts` and by people, and
  // a stable, diffable layout matters more than generality. Dates are QUOTED — an unquoted
  // `2026-08-16` parses to a JS Date whose String() renders in the runner's timezone, which this
  // repo has already paid for twice.
  // ⚠️ **UTC, from the one owner — and this probe had it wrong in BOTH directions first.**
  // Draft 1 inlined `toISOString().slice(0, 10)`, a fifth copy of a helper that already existed four
  // times. Draft 2 "fixed" the resulting `2026-08-17` stamp with an ad-hoc Chicago formatter, which
  // was worse: it made this the only file in the repo reducing a day in a different timezone from
  // every other, which is exactly how duplicated helpers drift.
  // The repo reduces to a **UTC calendar day** for machine-independence (`tools/dates.ts`, and the
  // two bugs behind it). A stamp taken on a Chicago evening therefore reads as tomorrow — which is
  // why the field is named `measured_at_utc` rather than being quietly shifted.
  const today = todayUTC();
  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const lines = [
    `# The live Firestore path inventory — MEASURED, not authored. Do not hand-edit.`,
    `#`,
    `# Refreshed by \`cd spikes/harness && deno task inventory --write\` (read-only, ADC, prod).`,
    `# ⚠️ NOT a \`.generated.\` file: CI cannot rebuild it, because it needs prod credentials. The`,
    `# stale-generated-files gate must never try. Its freshness is a \`validate\` warning instead.`,
    `#`,
    `# m6's first exit criterion — "every current Firestore path maps to a new field, an explicit`,
    `# drop, or a quarantine" — is checkable against THIS file and unfalsifiable without it.`,
    `measured_at_utc: ${q(today)}`,
    `project: ${q(PROJECT)}`,
    `collections: ${inventory.length}`,
    `total_paths: ${totalPaths}`,
    `inventory:`,
  ];
  for (const c of inventory) {
    lines.push(`  - collection: ${q(c.collection)}`);
    lines.push(`    documents: ${c.documents}`);
    if (c.capped) lines.push(`    capped: true # partial — raise hardCap and re-run`);
    lines.push(`    paths:`);
    for (const p of c.paths) lines.push(`      - ${q(p)}`);
    if (c.paths.length === 0) lines.push(`      [] # zero documents — shape UNKNOWN, not empty`);
  }
  await Deno.writeTextFile("../../migration/live-paths.measured.yaml", lines.join("\n") + "\n");
  console.log(`\nwrote migration/live-paths.measured.yaml`);
}
