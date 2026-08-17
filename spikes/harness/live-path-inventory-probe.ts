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

/**
 * ⚠️ **`ID_KEY` alone is too loose to accuse a single segment**, and firing it at one is how a
 * reporter becomes noise. `[A-Za-z0-9_-]{20}` matches a Firestore auto-id — and it also matches
 * `recurrence_overrides`, `crms_opportunity_ids`, `crms_stock_level_ids` and
 * `last_message_preview`, every one of them exactly 20 characters and every one a real field. The
 * first run of the leak reporter below returned all four and nothing else, which is a reporter
 * nobody would read twice.
 *
 * The looseness is SAFE in the collapse, because the collapse needs three or more SIBLINGS all
 * matching — three field names of exactly 20 characters side by side, with no other key, does not
 * happen. It is not safe on its own. So the accusation adds what an auto-id actually looks like:
 * no `_` or `-`, and mixed case.
 */
const LOOKS_GENERATED = (seg: string) =>
  ID_KEY.test(seg) && !/[_-]/.test(seg) && /[a-z]/.test(seg) && /[A-Z]/.test(seg);

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
const paths = (
  node: unknown,
  prefix: string,
  out: Set<string>,
  depth = 0,
  dyn?: Set<string>,
): void => {
  if (depth > 12) return; // pathological nesting; nothing in this corpus approaches it
  if (Array.isArray(node)) {
    // An array of scalars is a leaf (`query_by_orders[]`); an array of maps opens `[]`.
    if (node.length === 0) out.add(`${prefix}[]`);
    else if (node.some((v) => v !== null && typeof v === "object" && !(v instanceof Date))) {
      for (const v of node) paths(v, `${prefix}[]`, out, depth + 1, dyn);
    } else out.add(`${prefix}[]`);
    return;
  }
  if (node !== null && typeof node === "object" && !(node instanceof Date)) {
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length === 0) out.add(prefix);
    const dynamic = dyn ? dyn.has(prefix) : isDynamicMap(entries.map(([k]) => k));
    if (dynamic) {
      if (prefix) collapsed.add(prefix);
      // One representative child is enough — they are the same record shape by construction.
      for (const [, v] of entries) paths(v, `${prefix}.<key>`, out, depth + 1, dyn);
      return;
    }
    for (const [k, v] of entries) paths(v, prefix ? `${prefix}.${k}` : k, out, depth + 1, dyn);
    return;
  }
  if (prefix) out.add(prefix);
};

/**
 * At least three entries and every key id-shaped. Three, not one: a two-key map of real field names
 * whose names happen to look like ids is implausible, and a genuine record map always has many. The
 * alternative heuristic, "the children are homogeneous", is deliberately NOT used — plenty of real
 * field groups are homogeneous (`address.city`/`.street`/`.postcode`), and it would collapse them.
 */
const isDynamicMap = (keys: string[]) => keys.length >= 3 && keys.every((k) => ID_KEY.test(k));

/**
 * ⚠️ **The threshold has to be applied per COLLECTION, and applying it per DOCUMENT was a real
 * defect** — found 2026-08-16 while wiring m6's criterion, because 31 measured "paths" were doc ids.
 *
 * Paths are unioned across documents but the collapse decision was taken inside a single document,
 * so a `tracking-categories` record whose `products` map held **two** entries failed the `>= 3`
 * test, kept its literal uid keys, and put them in the union beside the `<key>` form contributed by
 * a record that held three. Both readings of the same map, in one inventory. `tracking-categories`
 * carried 14 such paths and `products.crms_stock_level_ids` 3.
 *
 * That is the same defect this file's own header describes fixing ("1,123 paths across 20
 * documents") — **the fix was incomplete and nothing could see it**, because the collapse reported
 * what it DID collapse and never looked at what it left behind. The pre-pass below decides
 * dynamic-ness from the union of keys seen at each prefix across every document, and the assertion
 * after it is what makes the incompleteness visible next time.
 *
 * ⚠️ It cannot catch every case, and the one it misses is named rather than left implicit:
 * `uploadcare-sweep.ref_counts` is keyed `<project>/<collection>`, which is a composite NAME and not
 * id-shaped. No heuristic over key spelling will find that; it is settled in the field map instead.
 */
const keysAtPrefix = (node: unknown, prefix: string, acc: Map<string, Set<string>>, depth = 0) => {
  if (depth > 12) return;
  if (Array.isArray(node)) {
    for (const v of node) {
      if (v !== null && typeof v === "object" && !(v instanceof Date)) {
        keysAtPrefix(v, `${prefix}[]`, acc, depth + 1);
      }
    }
    return;
  }
  if (node === null || typeof node !== "object" || node instanceof Date) return;
  const entries = Object.entries(node as Record<string, unknown>);
  if (prefix) {
    const set = acc.get(prefix) ?? new Set<string>();
    for (const [k] of entries) set.add(k);
    acc.set(prefix, set);
  }
  for (const [k, v] of entries) keysAtPrefix(v, prefix ? `${prefix}.${k}` : k, acc, depth + 1);
};

const collections = await listCollections();
console.log(`${PROJECT}: ${collections.length} collections\n`);

const inventory: {
  collection: string;
  documents: number;
  capped: boolean;
  paths: string[];
}[] = [];

/** Paths whose last segment is still an id — what the collapse missed. Reported, never swallowed. */
const leaked = new Set<string>();

for (const c of collections) {
  const { scanned, capped, docs } = await pathScan(c, 60000);
  // Pre-pass: which prefixes are dynamic maps, decided across the WHOLE collection.
  const keys = new Map<string, Set<string>>();
  for (const d of docs) keysAtPrefix(d, "", keys);
  const dyn = new Set<string>();
  for (const [prefix, ks] of keys) if (isDynamicMap([...ks])) dyn.add(prefix);

  const set = new Set<string>();
  for (const d of docs) paths(d, "", set, 0, dyn);
  for (const p of set) {
    if (p.includes("<key>")) continue; // already collapsed; the `<key>` IS the report
    if (p.split(".").some((seg) => LOOKS_GENERATED(seg.replace(/\[\]$/, "")))) {
      leaked.add(`${c}.${p}`);
    }
  }
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
// ⚠️ **The arm that would have caught the per-document collapse.** A path segment that is still
// id-shaped after the pre-pass is a record key being reported as a field — the exact defect this
// probe's header says it fixed and did not. Reported by name, because a count alone would not say
// which heuristic gave up.
if (leaked.size) {
  console.log(
    `\n⚠️ ${leaked.size} path(s) still carry an id-shaped segment — a RECORD key reported as a` +
      ` FIELD. Either the collapse threshold missed a map, or the key is a composite name no` +
      ` heuristic over spelling can detect (\`uploadcare-sweep.ref_counts.<project>/<collection>\`).` +
      ` Settle each in migration/field-map.yaml rather than leaving it in the denominator:`,
  );
  for (const p of [...leaked].sort()) console.log(`  ${p}`);
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
