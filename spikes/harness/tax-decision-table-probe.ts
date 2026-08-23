/**
 * SPIKE-008 — the tax decision table, executed against the live invoice corpus.
 *
 * ── The table already exists as DATA, and that is the starting finding ──────────────────────────
 *
 * `taxes` carries `jurisdiction`, `item_types[]` and an `applied_from`/`applied_to` window per
 * record. **That IS a decision table**: (jurisdiction × item type × date) → rate. So the spike's
 * first exit criterion is less "design one" than "write down the one that is running, and check it
 * against the ordinance and against what was actually billed."
 *
 * ── ⚠️ TWO DATES, AND THE GAP BETWEEN THEM IS A MEASURED LIABILITY ─────────────────────────────
 *
 * Each record carries BOTH `effective_from` — when the law says the rate starts — and
 * `applied_from` — when CFS started charging it. **They are not always equal.** This probe scores
 * every line twice:
 *
 *   · against `applied_from`  → "did CFS bill what its own registry said?"  (a self-consistency check)
 *   · against `effective_from` → "did CFS bill what the LAW said?"           (the real question)
 *
 * The difference is api-cloudrun#600 with a number on it.
 *
 * Read-only by construction: holds `pageAll` and nothing with a write verb. `deno task tax-table`.
 */
import { type Doc, pageAll, PROJECT, usd } from "./corpus.ts";

interface Tax {
  uid?: string;
  name?: string;
  rate?: number;
  type?: string;
  active?: boolean;
  jurisdiction?: string | null;
  item_types?: string[];
  applied_from?: string;
  applied_to?: string | null;
  effective_from?: string;
}
interface Line {
  uid?: string;
  type?: string;
  taxed_as?: string;
  name?: string;
  uid_delivery?: string;
  path?: string[];
  price?: {
    subtotal_discounted_cents?: number;
    taxes?: { uid?: string; name?: string; rate?: number; type?: string; amount_cents?: number }[];
  };
}
interface Invoice {
  number?: number;
  status?: string;
  date?: string;
  tax_exempt?: boolean;
  organization?: { name?: string; tax_exempt?: boolean; jurisdiction_claim?: string };
  destinations?: { uid_order?: string; jurisdiction?: string; delivery?: { uid?: string } }[];
  items?: Line[];
}

const taxes = await pageAll<Tax>("taxes", [
  "uid",
  "name",
  "rate",
  "type",
  "active",
  "jurisdiction",
  "item_types",
  "applied_from",
  "applied_to",
  "effective_from",
]);
const invoices = await pageAll<Invoice>("invoices", [
  "number",
  "status",
  "date",
  "tax_exempt",
  "organization",
  "destinations",
  "items",
]);

// ⚠️ **`items[].taxed_as` IS NOT THE DISCRIMINATOR IN PRACTICE.** The schema names it as one —
// `rental|replacement|sale|service|surcharge|none`, distinct from `type` so a line could be taxed
// unlike its own kind — and it is present on **5 of 13,729 lines (0.04%)**, saying `none` or null
// on all five. **An unexercised branch is a claim, not a capability.** Production discriminates on
// `items[].type`, so this probe does too, and prefers `taxed_as` only where it actually exists.
const discriminator = (it: Line) =>
  it.taxed_as && it.taxed_as !== "none" ? it.taxed_as : (it.type ?? "");
// ⚠️ And `uid_delivery` sits on the DESTINATION DIVIDER, not on priced lines — 945 of 13,729, which
// is exactly the divider count. Jurisdiction is resolved by walking a line's path to its divider.
const STRUCTURAL = new Set(["order", "destination", "group"]);

console.log(`SPIKE-008 — tax decision table against ${PROJECT}`);
console.log(`${taxes.length} tax records · ${invoices.length} invoices\n`);

// ── the registry, as a decision table ──────────────────────────────────────────────────────────
console.log("── THE DECISION TABLE, as the registry already encodes it ─────────────────────────");
console.log("   (jurisdiction × item type × date) → rate\n");
const byJur = new Map<string, Tax[]>();
for (const t of taxes) {
  const k = t.jurisdiction ?? "(none)";
  byJur.set(k, [...(byJur.get(k) ?? []), t]);
}
for (const [jur, ts] of [...byJur].sort()) {
  console.log(`  ${jur}`);
  for (const t of ts.sort((a, b) => (a.applied_from ?? "").localeCompare(b.applied_from ?? ""))) {
    const win = `${(t.applied_from ?? "?").slice(0, 10)} → ${
      t.applied_to ? t.applied_to.slice(0, 10) : "open"
    }`;
    const eff = (t.effective_from ?? "").slice(0, 10);
    const lag = eff && t.applied_from && eff !== t.applied_from.slice(0, 10)
      ? `  ⚠️ effective ${eff}`
      : "";
    console.log(
      `      ${String(t.name).padEnd(20)} ${String(t.rate).padStart(6)}${
        t.type === "flat" ? " flat" : "%   "
      }` +
        ` [${(t.item_types ?? []).join(",") || "—"}]`.padEnd(30) + ` ${win}${lag}` +
        (t.active === false ? "  (inactive)" : ""),
    );
  }
}

// ── ⚠️ active vs window ────────────────────────────────────────────────────────────────────────
const now = new Date();
const staleActive = taxes.filter((t) =>
  t.active === true && t.applied_to && new Date(t.applied_to) < now
);
console.log(
  "\n── ⚠️ `active` does NOT mean 'in force' ───────────────────────────────────────────",
);
console.log(`  ${staleActive.length} record(s) are active:true with a CLOSED window:`);
for (const t of staleActive) {
  console.log(`      ${t.name} ${t.rate}% — window closed ${t.applied_to?.slice(0, 10)}`);
}
console.log("  ⇒ the WINDOW is the authority, not the flag (api-cloudrun#613).");

// ── the lookup ─────────────────────────────────────────────────────────────────────────────────
const inWindow = (t: Tax, iso: string, useEffective: boolean) => {
  const from = useEffective ? (t.effective_from ?? t.applied_from) : t.applied_from;
  if (!from || iso < from) return false;
  if (t.applied_to && iso >= t.applied_to) return false;
  return true;
};
/**
 * ⚠️ **SUCCESSIVE VERSIONS OF ONE TAX MUST NOT BE SUMMED, AND NOTHING IN THE SCHEMA SAYS SO.**
 *
 * `taxes` has no field distinguishing "a new RATE for an existing tax" from "an ADDITIONAL tax that
 * applies alongside". Both are separate documents; the only thing linking a lineage is a shared
 * `name`. When scored against `effective_from` the windows genuinely OVERLAP — Frankfort's 8.25%
 * is effective 2026-08-01 while the 8% record runs to 2026-08-19 — so a naive filter returns both
 * and summing them yields 16.25%, which is not a rate anybody ever charged.
 *
 * ⇒ group by `name` and take the LATEST applicable version; sum only ACROSS names. **The first
 * version of this probe summed everything and reported 16.25% as an expectation.** Recorded rather
 * than quietly fixed, because the defect is in the data model and any engine will meet it.
 */
const expected = (jur: string, taxedAs: string, iso: string, useEffective: boolean) => {
  const candidates = taxes.filter((t) =>
    (t.jurisdiction ?? "") === jur &&
    (t.item_types ?? []).includes(taxedAs) &&
    inWindow(t, iso, useEffective)
  );
  const latestPerName = new Map<string, Tax>();
  for (const t of candidates) {
    const key = t.name ?? t.uid ?? "";
    const cur = latestPerName.get(key);
    const start = (x: Tax) =>
      (useEffective ? (x.effective_from ?? x.applied_from) : x.applied_from) ?? "";
    if (!cur || start(t) > start(cur)) latestPerName.set(key, t);
  }
  return [...latestPerName.values()];
};

// ── score every taxable line ───────────────────────────────────────────────────────────────────
type Row = {
  inv: number;
  jur: string;
  taxedAs: string;
  date: string;
  want: number | null;
  got: number | null;
  base: number;
};
const mismatchApplied: Row[] = [], mismatchLaw: Row[] = [];
let scored = 0, exempt = 0, noJur = 0, untaxedType = 0;
const untaxedByType = new Map<string, number>();

for (const inv of invoices) {
  if (inv.status === "void" || inv.status === "draft") continue;
  const iso = (inv.date ?? "").slice(0, 25);
  if (!iso) continue;
  if (inv.tax_exempt || inv.organization?.tax_exempt) {
    exempt++;
    continue;
  }
  // delivery uid → jurisdiction, from the invoice's own destinations
  const delJur = new Map<string, string>();
  for (const d of inv.destinations ?? []) {
    if (d.delivery?.uid && d.jurisdiction) delJur.set(d.delivery.uid, d.jurisdiction);
  }
  // destination-divider uid → jurisdiction, via that divider's own uid_delivery
  const divJur = new Map<string, string>();
  for (const it of inv.items ?? []) {
    if (it.type === "destination" && it.uid && it.uid_delivery) {
      const j = delJur.get(it.uid_delivery);
      if (j) divJur.set(it.uid, j);
    }
  }
  const soleJur = (inv.destinations ?? []).length === 1
    ? (inv.destinations ?? [])[0].jurisdiction ?? ""
    : "";
  const fallback = soleJur || inv.organization?.jurisdiction_claim || "";
  for (const it of inv.items ?? []) {
    if (STRUCTURAL.has(it.type ?? "")) continue;
    const taxedAs = discriminator(it);
    if (!taxedAs || taxedAs === "none") continue;
    const base = it.price?.subtotal_discounted_cents ?? 0;
    if (base === 0) continue;
    // path is [order, destination, group, item] — the destination divider is path[1]
    const divider = (it.path ?? [])[1];
    const jur = (divider && divJur.get(divider)) || fallback;
    if (!jur || jur === "no_nexus") {
      noJur++;
      continue;
    }
    scored++;
    const got = (it.price?.taxes ?? []).filter((x) => x.type !== "flat")
      .reduce((a, x) => a + (x.rate ?? 0), 0);
    for (const [useEff, sink] of [[false, mismatchApplied], [true, mismatchLaw]] as const) {
      const exp = expected(jur, taxedAs, iso, useEff).filter((t) => t.type !== "flat");
      const want = exp.reduce((a, t) => a + (t.rate ?? 0), 0);
      if (exp.length === 0) {
        if (!useEff) {
          untaxedType++;
          untaxedByType.set(`${jur}/${taxedAs}`, (untaxedByType.get(`${jur}/${taxedAs}`) ?? 0) + 1);
        }
        continue;
      }
      if (Math.abs(want - got) > 0.0001) {
        sink.push({ inv: inv.number ?? 0, jur, taxedAs, date: iso.slice(0, 10), want, got, base });
      }
    }
  }
}

console.log(
  "\n── coverage ───────────────────────────────────────────────────────────────────────",
);
console.log(`  taxable lines scored              : ${scored}`);
console.log(`  skipped — invoice/org tax_exempt  : ${exempt} invoices`);
console.log(`  skipped — no jurisdiction/no_nexus: ${noJur} lines`);
console.log(`  no tax rule for (jurisdiction, item type): ${untaxedType} lines`);
for (const [k, v] of [...untaxedByType].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`      ${k.padEnd(24)} ${v}`);
}

const report = (label: string, rows: Row[], why: string) => {
  console.log(`\n── ${label} ─────────────────────────────────────────`);
  console.log(`   ${why}`);
  console.log(`   ${rows.length} line(s) disagree`);
  const byPair = new Map<string, { n: number; base: number }>();
  for (const r of rows) {
    const k = `${r.jur}/${r.taxedAs}  want ${r.want}%  got ${r.got}%`;
    const c = byPair.get(k) ?? { n: 0, base: 0 };
    c.n++;
    c.base += r.base;
    byPair.set(k, c);
  }
  for (const [k, c] of [...byPair].sort((a, b) => b[1].base - a[1].base)) {
    console.log(
      `      ${k.padEnd(48)} ${String(c.n).padStart(4)} lines  ${usd(c.base).padStart(13)} base`,
    );
  }
  const dates = rows.map((r) => r.date).sort();
  if (dates.length) console.log(`      date range: ${dates[0]} → ${dates.at(-1)}`);
};

report(
  "A. against CFS's OWN registry (`applied_from`)",
  mismatchApplied,
  "Did CFS bill what its own tax records said to bill? A self-consistency check.",
);
report(
  "B. against the LAW (`effective_from`)",
  mismatchLaw,
  "Did CFS bill what the rate was legally effective at? This is the real question.",
);

const gap = mismatchLaw.length - mismatchApplied.length;
console.log(
  "\n── ⭐ THE GAP BETWEEN THEM ────────────────────────────────────────────────────────",
);
console.log(
  `  ${mismatchLaw.length} lines disagree with the LAW · ${mismatchApplied.length} with the REGISTRY · difference ${gap}`,
);
const lawOnly = mismatchLaw.filter((r) =>
  !mismatchApplied.some((a) => a.inv === r.inv && a.taxedAs === r.taxedAs && a.base === r.base)
);
const lawOnlyBase = lawOnly.reduce((a, r) => a + r.base, 0);
const lawOnlyShort = lawOnly.reduce(
  (a, r) => a + (r.base * ((r.want ?? 0) - (r.got ?? 0))) / 100,
  0,
);
console.log(`  Lines correct by the registry but WRONG by the law: ${lawOnly.length}`);
console.log(
  `      taxable base ${usd(lawOnlyBase)}   under/over-collected ${usd(Math.round(lawOnlyShort))}`,
);
console.log("  ⇒ these are the lines billed during the window between a rate becoming EFFECTIVE");
console.log("    and CFS beginning to APPLY it. api-cloudrun#600, with a number.");

console.log(
  "\n── NOT MEASURED ───────────────────────────────────────────────────────────────────",
);
console.log("  · The 50% exemption for property leased outside the city and primarily used there.");
console.log("    CFS models exemption as a BOOLEAN, so a partial exemption is unrepresentable and");
console.log("    this probe cannot detect whether one was owed.");
console.log("  · Whether `destinations[].jurisdiction` is the correct SOURCING rule at all — the");
console.log(
  "    ordinance sources on where property is USED, and Hertz v. Chicago (2017 IL 119945)",
);
console.log("    invalidated Ruling 11 on exactly that point.");
console.log("  · Flat taxes (the $0.05 bottled-water tax) — scored on percent rates only.");
