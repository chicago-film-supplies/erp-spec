/**
 * Product line × revenue account, rebuilt with the product-master join — evidence for erp-spec#13
 * item 1.
 *
 * ── What this replaces, and why the rebuild is not just a refresh ────────────────────────────────
 *
 * `inbox/2026-08-09-product-line-by-revenue-account-matrix.md` is the matrix seven spec artifacts
 * read. It was measured off `items[].tracking_category` alone — a denorm the writer never populated
 * (api-cloudrun#473) — so it reported `Transport` at **0 lines / $0.00** and `Trash & Cleanup` at
 * **2 lines / $1,750.00**. `Transport` was deleted from `ledger/dimensions.yaml` on that reading and
 * `Trash & Cleanup` was reasoned about as a rounding error. Both conclusions were wrong; both were
 * reversed on 2026-08-16 (OQ-034, OQ-031).
 *
 * The defect was repaired at source on 2026-08-10, so the denorm is now expected to be right. **That
 * is exactly why this probe still performs the join.** Reading the repaired copy on its own is a
 * fixed-point check against the thing that was broken — the repo's own rule is that a guard which
 * can only consult its own oracle is not a guard. `products/{item.uid}.tracking_category_name` is
 * the independent property: it is what the line's value is derived FROM, it was correct throughout,
 * and it is the join that moved the headline by a factor of ~705 when nobody had run it.
 *
 * So this reports the matrix off the denorm (which is what a revenue report reads) **and** the
 * agreement between denorm and master beside it, and the second is the number that says whether the
 * first can be trusted.
 *
 * ── Read the header of `corpus.ts` for the auth path ─────────────────────────────────────────────
 *
 *   deno task matrix-lines
 *
 * Read-only, prod, under ADC. No token. Writes nothing.
 */

import {
  type Classification,
  GOODS_ACCOUNTS,
  GOODS_ITEM_TYPES,
  type Invoice,
  INVOICE_FIELDS,
  loadClassification,
  pageAll,
  pct,
  type Product,
  PRODUCT_FIELDS,
  STRUCTURAL,
  usd,
} from "./corpus.ts";

/**
 * The 2026-08-09 matrix, frozen, so the diff runs rather than being performed by eye.
 *
 * Source: `inbox/2026-08-09-product-line-by-revenue-account-matrix.md` — 999 invoices, 11,131 rows,
 * 9,194 revenue-bearing lines, $1,688,980.87. Cents, because dollars in a baseline are how a
 * comparison acquires a rounding error of its own.
 */
const BASELINE_2026_08_09: Record<string, { lines: number; cents: number }> = {
  "«none»": { lines: 390, cents: 48651699 },
  "Delivery": { lines: 473, cents: 21605025 },
  "Walkies & Hotspots": { lines: 699, cents: 17501510 },
  "Wardrobe": { lines: 1577, cents: 13934580 },
  "Hair & Makeup": { lines: 1076, cents: 11735795 },
  "Replacements": { lines: 290, cents: 9451115 },
  "Tents": { lines: 786, cents: 8700312 },
  "Tables & Chairs": { lines: 445, cents: 7987280 },
  "Power, Lights & Tools": { lines: 1190, cents: 6610862 },
  "Surface Protection": { lines: 230, cents: 5994703 },
  "Traffic, Safety & Signage": { lines: 641, cents: 5743214 },
  "Expendables": { lines: 410, cents: 3535565 },
  "Carts & Ramps": { lines: 328, cents: 3299183 },
  "Crafty": { lines: 127, cents: 1626560 },
  "Janitorial": { lines: 261, cents: 1061955 },
  "Fans & Heaters": { lines: 40, cents: 376840 },
  "Office Supplies": { lines: 25, cents: 350400 },
  "Crew": { lines: 7, cents: 262500 },
  "Transaction Fees": { lines: 72, cents: 258198 },
  "Trash & Cleanup": { lines: 2, cents: 175000 },
  "Other": { lines: 125, cents: 35791 },
  "Transport": { lines: 0, cents: 0 },
};
const BASELINE_TOTALS = { invoices: 999, rows: 11131, lines: 9194, cents: 168898087 };

const NONE = "«none»";

// ── read the corpus ──────────────────────────────────────────────────────────────────────────────

const classification: Classification = await loadClassification();
const invoices = await pageAll<Invoice>("invoices", INVOICE_FIELDS);
const products = await pageAll<Product>("products", PRODUCT_FIELDS);

const masterCategory = new Map<string, string | null>();
for (const p of products) masterCategory.set(p.uid ?? p.__id, p.tracking_category_name ?? null);

console.log(`# Product line × revenue account, rebuilt with the product-master join`);
console.log(`\ncorpus: ${invoices.length} invoices, ${products.length} products`);
console.log(
  `baseline 2026-08-09: ${BASELINE_TOTALS.invoices} invoices ` +
    `(+${invoices.length - BASELINE_TOTALS.invoices} since)`,
);

// ── aggregate ────────────────────────────────────────────────────────────────────────────────────

interface Row {
  lines: number;
  cents: number;
  accounts: Set<number>;
  /** Per-account split. The 2026-08-09 table listed the account SET and not the split, which is why
   *  "`Delivery` is four times more likely to be Service Income than Delivery Surcharges" had to be
   *  measured separately — and why the 79.8 / 20.0 ratio is quoted in `product-line-pl.yaml` without
   *  a re-run behind it. A matrix should be a matrix. */
  byAccount: Map<number, { lines: number; cents: number }>;
}
const row = (m: Map<string, Row>, k: string): Row => {
  let r = m.get(k);
  if (!r) m.set(k, r = { lines: 0, cents: 0, accounts: new Set(), byAccount: new Map() });
  return r;
};
const addAccount = (r: Row, coa: number | null, cents: number) => {
  if (coa == null) return;
  r.accounts.add(coa);
  const a = r.byAccount.get(coa) ?? { lines: 0, cents: 0 };
  a.lines++;
  a.cents += cents;
  r.byAccount.set(coa, a);
};

/** Off the invoice-line denorm — what a revenue report reads today. */
const byDenorm = new Map<string, Row>();
/** Off the product master, falling back to the line only where there is no product record. */
const byMaster = new Map<string, Row>();

/** Denorm-vs-master agreement. The independent property; see the header. */
const join = {
  agrees: { lines: 0, cents: 0 },
  /** The api-cloudrun#473 defect: line null, product categorised. Repaired 2026-08-10 — expect 0. */
  line_null_product_categorised: { lines: 0, cents: 0 },
  /** Line and product both set and DIFFERENT. Expected, and must never be repaired: an invoice is a
   *  point-in-time document, and a category renamed after issue leaves the issued line alone. */
  disagrees: { lines: 0, cents: 0 },
  /** Line set, product record carries no category. Drift the other way — a retirement at the master. */
  line_set_product_uncategorised: { lines: 0, cents: 0 },
  /** No product record at all — a custom line, nothing to inherit. */
  no_product: { lines: 0, cents: 0 },
  /** Product exists, uncategorised, line null. Nobody decided, at the master. */
  both_null: { lines: 0, cents: 0 },
};

/** A `tracking_category` in the corpus that `ledger/dimensions.yaml` does not declare. */
const undeclared = new Map<string, { lines: number; cents: number }>();
/** `coa_revenue` disagrees with `type` about whether the line is goods. See `GOODS_ACCOUNTS`. */
const goodsDisagreements = new Map<string, number>();

let rows = 0, revenueLines = 0, totalCents = 0;
let voidLines = 0, voidCents = 0;
const statuses = new Map<string, number>();
const disagreeSamples: string[] = [];

for (const inv of invoices) {
  statuses.set(inv.status, (statuses.get(inv.status) ?? 0) + 1);
  for (const it of inv.items ?? []) {
    rows++;
    if (STRUCTURAL.has(it.type)) continue;
    revenueLines++;
    const cents = it.price?.subtotal_discounted_cents ?? 0;
    totalCents += cents;
    if (inv.status === "void") {
      voidLines++;
      voidCents += cents;
    }

    const line = it.tracking_category ?? null;
    const hasProduct = masterCategory.has(it.uid);
    const master = hasProduct ? masterCategory.get(it.uid)! : undefined;

    // ── the matrix, off the denorm ──
    const dk = line ?? NONE;
    const dr = row(byDenorm, dk);
    dr.lines++;
    dr.cents += cents;
    addAccount(dr, it.coa_revenue, cents);

    // ── the matrix, off the master ──
    const mk = (hasProduct ? master : line) ?? NONE;
    const mr = row(byMaster, mk);
    mr.lines++;
    mr.cents += cents;
    addAccount(mr, it.coa_revenue, cents);

    // ── the join ──
    if (!hasProduct) {
      join.no_product.lines++;
      join.no_product.cents += cents;
    } else if (line === null && master !== null) {
      join.line_null_product_categorised.lines++;
      join.line_null_product_categorised.cents += cents;
    } else if (line !== null && master === null) {
      join.line_set_product_uncategorised.lines++;
      join.line_set_product_uncategorised.cents += cents;
    } else if (line === null && master === null) {
      join.both_null.lines++;
      join.both_null.cents += cents;
    } else if (line !== master) {
      join.disagrees.lines++;
      join.disagrees.cents += cents;
      if (disagreeSamples.length < 8) {
        disagreeSamples.push(`inv ${inv.number}: line "${line}" vs master "${master}"`);
      }
    } else {
      join.agrees.lines++;
      join.agrees.cents += cents;
    }

    // ── two independent cross-checks ──
    if (line !== null && !classification.declared.has(line)) {
      const u = undeclared.get(line) ?? { lines: 0, cents: 0 };
      u.lines++;
      u.cents += cents;
      undeclared.set(line, u);
    }
    const byAccount = it.coa_revenue != null && GOODS_ACCOUNTS.has(it.coa_revenue);
    const byType = GOODS_ITEM_TYPES.has(it.type);
    if (it.coa_revenue != null && byAccount !== byType) {
      const k = `type=${it.type} coa=${it.coa_revenue} (account says ${
        byAccount ? "goods" : "not goods"
      })`;
      goodsDisagreements.set(k, (goodsDisagreements.get(k) ?? 0) + 1);
    }
  }
}

console.log(
  `rows: ${rows} total, ${revenueLines} revenue-bearing, ${usd(totalCents)} tax-exclusive ` +
    `(\`subtotal_discounted_cents\`)`,
);
console.log(
  `baseline: ${BASELINE_TOTALS.rows} rows, ${BASELINE_TOTALS.lines} revenue-bearing, ${
    usd(BASELINE_TOTALS.cents)
  }`,
);
console.log(`by status: ${[...statuses].map(([s, n]) => `${s} ${n}`).join(", ")}`);
console.log(
  `void lines: ${voidLines}, ${usd(voidCents)} = ${pct(voidCents, totalCents)} of revenue`,
);

// ── the matrix ───────────────────────────────────────────────────────────────────────────────────

function printMatrix(title: string, m: Map<string, Row>, declared: Set<string>) {
  console.log(`\n## ${title}\n`);
  console.log(
    "| product line | lines | revenue | share | kind | accounts |",
  );
  console.log("| --- | ---: | ---: | ---: | --- | --- |");
  const keys = [...m.keys()].sort((a, b) => m.get(b)!.cents - m.get(a)!.cents);
  for (const k of keys) {
    const r = m.get(k)!;
    const kind = k === NONE ? "—" : classification.kind.get(k) ?? "⚠️ unclassified";
    const flag = k !== NONE && !declared.has(k) ? " ⚠️ undeclared" : "";
    console.log(
      `| ${k}${flag} | ${r.lines} | ${usd(r.cents)} | ${pct(r.cents, totalCents)} | ${kind} | ${
        [...r.accounts].sort((a, b) => a - b).join(" ")
      } |`,
    );
  }
  // Every declared value, including the ones with no lines — an empty row is the finding that
  // deleted `Transport`, so it has to be visible rather than absent from the table.
  const missing = [...declared].filter((v) => !m.has(v));
  if (missing.length) console.log(`\n⚠️ declared with ZERO lines here: ${missing.join(", ")}`);
}

printMatrix(
  "Off the invoice-line denorm (what a revenue report reads)",
  byDenorm,
  classification.declared,
);
printMatrix("Off the product master (the independent property)", byMaster, classification.declared);

// ── the actual matrix: product line × revenue account ────────────────────────────────────────────
//
// Finding 3 of the 2026-08-09 note is what this section re-measures: "the revenue account CANNOT
// stand in for the product line, in either direction". It is also where two pending restatements are
// now measurable rather than asserted — OQ-032's `Card Fee` 4110 → 4700 and OQ-034's `Transport` /
// `Shipping` split, which the spec performed on 2026-08-16 and the corpus has not.

console.log(`\n## Product line × revenue account (denorm view, multi-account lines only)\n`);
const multi = [...byDenorm.entries()]
  .filter(([, r]) => r.byAccount.size > 1)
  .sort((a, b) => b[1].cents - a[1].cents);
for (const [k, r] of multi) {
  const parts = [...r.byAccount.entries()]
    .sort((a, b) => b[1].cents - a[1].cents)
    .map(([coa, a]) => `${coa} ${usd(a.cents)} (${pct(a.cents, r.cents)}, ${a.lines} lines)`);
  console.log(
    `- **${k}** — ${usd(r.cents)} across ${r.byAccount.size} accounts: ${parts.join(" · ")}`,
  );
}
const singles = [...byDenorm.entries()].filter(([, r]) => r.byAccount.size <= 1).length;
console.log(`\n(${singles} product lines sit on a single account.)`);

// Accounts that carry more than one product line — the other direction of the same finding.
const linesPerAccount = new Map<number, Map<string, number>>();
for (const [k, r] of byDenorm) {
  for (const [coa, a] of r.byAccount) {
    const m = linesPerAccount.get(coa) ?? new Map<string, number>();
    m.set(k, a.cents);
    linesPerAccount.set(coa, m);
  }
}
console.log(`\n## Revenue account × product line (accounts carrying more than one line)\n`);
for (const [coa, m] of [...linesPerAccount].sort((a, b) => a[0] - b[0])) {
  if (m.size <= 1) continue;
  const total = [...m.values()].reduce((x, y) => x + y, 0);
  const parts = [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${k} ${pct(c, total)}`);
  console.log(`- **${coa}** — ${usd(total)} across ${m.size} lines: ${parts.join(" · ")}`);
}

// ── the diff against 2026-08-09 ──────────────────────────────────────────────────────────────────

console.log(`\n## Diff against the 2026-08-09 matrix (denorm view)\n`);
console.log(
  "| product line | lines then | lines now | Δ lines | revenue then | revenue now | Δ revenue |",
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
const allKeys = [...new Set([...Object.keys(BASELINE_2026_08_09), ...byDenorm.keys()])]
  .sort((a, b) => (byDenorm.get(b)?.cents ?? 0) - (byDenorm.get(a)?.cents ?? 0));
for (const k of allKeys) {
  const then = BASELINE_2026_08_09[k];
  const now = byDenorm.get(k);
  const dLines = (now?.lines ?? 0) - (then?.lines ?? 0);
  const dCents = (now?.cents ?? 0) - (then?.cents ?? 0);
  const mark = !then ? " 🆕" : !now ? " ✂️" : "";
  console.log(
    `| ${k}${mark} | ${then ? then.lines : "—"} | ${now ? now.lines : "—"} | ${
      dLines >= 0 ? "+" : ""
    }${dLines} | ${then ? usd(then.cents) : "—"} | ${now ? usd(now.cents) : "—"} | ${
      dCents >= 0 ? "+" : "-"
    }${usd(Math.abs(dCents)).slice(1)} |`,
  );
}
console.log(
  `\ntotals: lines ${BASELINE_TOTALS.lines} → ${revenueLines} ` +
    `(${revenueLines - BASELINE_TOTALS.lines >= 0 ? "+" : ""}${
      revenueLines - BASELINE_TOTALS.lines
    }), ` +
    `revenue ${usd(BASELINE_TOTALS.cents)} → ${usd(totalCents)}`,
);

// ── the join ─────────────────────────────────────────────────────────────────────────────────────

console.log(`\n## Denorm vs product master\n`);
console.log("| population | lines | revenue | share of line revenue |");
console.log("| --- | ---: | ---: | ---: |");
for (const [k, v] of Object.entries(join)) {
  console.log(`| ${k} | ${v.lines} | ${usd(v.cents)} | ${pct(v.cents, totalCents)} |`);
}
if (join.line_null_product_categorised.lines > 0) {
  console.log(
    `\n⚠️⚠️ **FINDING — the api-cloudrun#473 defect has REOPENED**: ` +
      `${join.line_null_product_categorised.lines} lines, ` +
      `${
        usd(join.line_null_product_categorised.cents)
      }. It measured 227 lines / $252,161.36 when ` +
      `filed and 0 after the 2026-08-10 repair. A non-zero reading here means the derivation stopped ` +
      `running again, and every figure below is a lower bound of unknown tightness.`,
  );
} else {
  console.log(
    `\n✅ \`line_null_product_categorised\` is **0** — the api-cloudrun#473 repair is holding ` +
      `(227 lines / $252,161.36 when filed).`,
  );
}
if (disagreeSamples.length) {
  console.log(`\npoint-in-time drift samples (EXPECTED — never repair these):`);
  for (const s of disagreeSamples) console.log(`  - ${s}`);
}

// ── the two cross-checks ─────────────────────────────────────────────────────────────────────────

console.log(`\n## Cross-checks\n`);
if (undeclared.size === 0) {
  console.log(
    `✅ every \`tracking_category\` in the corpus is declared in \`ledger/dimensions.yaml\` ` +
      `(${classification.declared.size} values).`,
  );
} else {
  console.log(
    `⚠️ **FINDING — values in the corpus that \`ledger/dimensions.yaml\` does not declare.**\n` +
      `   Two readings, and the number does not distinguish them — check each value against the OQ ` +
      `that dropped it:\n` +
      `   · the spec never carried a value the business uses (the \`Transport\` failure, OQ-034); or\n` +
      `   · the spec RETIRED it deliberately and the historical restatement has not run yet, which is ` +
      `an ADR-0020 obligation rather than a spec error.`,
  );
  for (const [v, n] of [...undeclared].sort((a, b) => b[1].cents - a[1].cents)) {
    console.log(`  - "${v}": ${n.lines} lines, ${usd(n.cents)} (${pct(n.cents, totalCents)})`);
  }
}
if (goodsDisagreements.size === 0) {
  console.log(
    `✅ \`coa_revenue\` and \`type\` agree on goods-vs-not on every line — the hardcoded ` +
      `\`GOODS_ACCOUNTS\` set has an independent second opinion.`,
  );
} else {
  console.log(
    `\n⚠️ \`coa_revenue\` and \`type\` disagree about goods-vs-not. The allocation base is defined ` +
      `by the ACCOUNT (\`reporting/queries/product-line-pl.sql\`), so the account wins; this is a ` +
      `note on how tight the two definitions are, not a defect on its own:`,
  );
  for (const [k, n] of [...goodsDisagreements].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${k}: ${n} lines`);
  }
}
