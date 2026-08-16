/**
 * Allocation-basis probe — evidence for ADR-0031.
 *
 * ADR-0029 left the allocation basis for the official product-line P&L undecided. This measures
 * which bases the corpus can actually support and how far they disagree, so the ADR cites numbers
 * rather than a preference.
 *
 *   deno task allocation
 *
 * READ-ONLY, prod, under Application Default Credentials. **No token.** See `corpus.ts` for the auth
 * path and why it changed (erp-spec#15): the old `CFS_API_TOKEN` header documented a shared bearer
 * against `/mcp/cfs`, that route moved to OAuth, and the documented invocation returned
 * `{"error":"unauthorized"}` — which is what left every figure below un-runnable and therefore
 * merely believed. The probe writes nothing and cannot reach Xero or CRMS.
 *
 * ── Three things this run does that the 2026-08-09 measurement did not ──────────────────────────
 *
 * 1. **The goods/activity split and the set of SPREADING pools are read from the spec**, not held
 *    here. The probe used to carry its own `ACTIVITY` set, and when OQ-034 restored `Transport` as an
 *    activity line it kept classifying it as **goods by omission** — silently putting $39,665 into
 *    the base. `tools/validate.ts` does not read `spikes/`, so no gate could have caught it. See
 *    `loadClassification` in `corpus.ts`.
 * 2. **The base follows the spec's own definition** — a goods line carrying `product_line: null` is
 *    IN the base, decided by the ACCOUNT (`reporting/queries/product-line-pl.sql`,
 *    `reporting/allocation-bases.yaml`). The 2026-08-09 run excluded every null line, which is
 *    exactly the mismatch
 *    `inbox/2026-08-09-correction-the-unallocable-population-is-smaller-and-is-one-customer.md`
 *    exists to record. Both definitions are reported here, so both recorded figures are comparable.
 * 3. **Voids are excluded**, per ADR-0031 clause 6. The 2026-08-09 headline included them. Both are
 *    reported, for the same reason.
 *
 * ── The spread is a faithful port of the spec's SQL, in integer cents ───────────────────────────
 *
 * Floor each share, hand the residual cents to the largest integer remainders, break ties on the
 * product line so the result is deterministic. `pool × base ÷ total` is staged as multiply-then-
 * divide in integer minor units so nothing rounds in between — quantizing the ratio first is the
 * defect class the workspace money rules exist to prevent, and its error is unbounded rather than
 * one cent. Headroom is asserted rather than assumed.
 */

import {
  type Classification,
  GOODS_ACCOUNTS,
  type Invoice,
  INVOICE_FIELDS,
  type Line,
  loadClassification,
  pageAll,
  pct,
  STRUCTURAL,
  usd,
} from "./corpus.ts";

/** The 2026-08-09 figures, so "a reading that moves the other way is a finding" is checkable here. */
const BASELINE = {
  poolCents: 21605025, // $216,050.25 Delivery revenue, voids INCLUDED
  overGroups: 115,
  overOfAllocable: 305,
  overCents: 8942500, // $89,425.00
  overShare: 0.414, // 41.4% of delivery revenue
  ratioMedian: 0.775,
  ratioP90: 3.13,
  ratioMax: 25.0,
  unallocableSpecExVoid: { groups: 11, cents: 1115000, share: 0.0516 }, // 5.16%
  unallocableNullExcluded: { groups: 15, cents: 1241025, share: 0.0574 }, // 5.74%
  divergence: { revenue_lines: 0.274, revenue_quantity: 0.315, lines_quantity: 0.335 },
  craftyOwn: 1173500, // $11,735.00
  craftyAllocated: 2195800, // $21,958.00
  /** The five orders that were 85.5% of the unallocable bucket. */
  netflixDuradeck: [1799, 1803, 1822, 1856, 1875],
};

type Basis = "revenue" | "lines" | "quantity";
const BASES: Basis[] = ["revenue", "lines", "quantity"];

/**
 * Spread `pool` over `weights` by largest remainder, so the shares sum EXACTLY to the pool.
 *
 * Integer minor units throughout — no float ever holds a money value. Returns null when the base has
 * no positive denominator: that is a real population here, not an error, and the caller must account
 * for it rather than silently drop it.
 */
function spread(pool: number, weights: number[], keys: string[]): number[] | null {
  const denom = weights.reduce((a, b) => a + b, 0);
  if (denom <= 0) return null;
  if (pool * denom > Number.MAX_SAFE_INTEGER) {
    throw new Error(`headroom: pool ${pool} × denom ${denom} exceeds 2^53`);
  }
  const shares = weights.map((w) => Math.floor((pool * w) / denom));
  const remainders = weights.map((w, i) => pool * w - shares[i] * denom);
  let residual = pool - shares.reduce((a, b) => a + b, 0);
  // Rank by integer remainder, ties broken on the key — the same ORDER BY the spec's SQL uses, and
  // for the same reason: a tie broken by scan order makes the report irreproducible.
  const order = remainders
    .map((r, i) => [r, keys[i], i] as const)
    .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  for (const [, , i] of order) {
    if (residual-- <= 0) break;
    shares[i] += 1;
  }
  return shares;
}

// ── read ─────────────────────────────────────────────────────────────────────────────────────────

const cls: Classification = await loadClassification();
const invoices = await pageAll<Invoice>("invoices", INVOICE_FIELDS);

console.log(`# Allocation basis, re-measured\n`);
console.log(`corpus: ${invoices.length} invoices (999 on 2026-08-09, +${invoices.length - 999})`);
console.log(
  `spreading pools: ${[...cls.spreads].join(", ") || "(none)"} · ` +
    `activity lines that do NOT spread: ${
      [...cls.kind].filter(([k, v]) => v === "activity" && !cls.spreads.has(k)).map(([k]) => k)
        .join(", ")
    }`,
);

// ── classify every revenue line, then group by causal order ──────────────────────────────────────

/** The spec's base test. `null` on a goods ACCOUNT is in; `null` elsewhere is neither pool nor base. */
function isSpecBase(it: Line): boolean {
  const tc = it.tracking_category ?? null;
  if (tc === null) return it.coa_revenue != null && GOODS_ACCOUNTS.has(it.coa_revenue);
  return cls.kind.get(tc) === "goods";
}
/** The 2026-08-09 probe's test — every null line excluded. Kept only to reproduce that figure. */
function isLegacyBase(it: Line): boolean {
  const tc = it.tracking_category ?? null;
  return tc !== null && cls.kind.get(tc) === "goods";
}

/**
 * The 2026-08-09 probe's ACTIVITY set, verbatim, so the failed prediction can be DECOMPOSED rather
 * than narrated.
 *
 * Judging "must FALL" needs a row measured under the same base rule AND the same classification as
 * the figure being compared to. Three things changed at once between the two runs — the corpus grew,
 * the denorm was repaired, and OQ-034/OQ-032 moved two values — and attributing a direction to one of
 * them while silently changing the other two is how a comparison becomes a story.
 *
 * ⚠️ The difference is not cosmetic: this set omits `Transport`, so $39,665 of activity revenue lands
 * in the BASE under it. That inflates the denominator on exactly the thin groups the prediction was
 * about, so it makes the pool-exceeds-base share look SMALLER than it is.
 */
const ACTIVITY_2026_08_09: ReadonlySet<string> = new Set([
  "Delivery",
  "Crew",
  "Trash & Cleanup",
  "Transaction Fees",
]);
function isLegacyClassBase(it: Line): boolean {
  const tc = it.tracking_category ?? null;
  return tc !== null && !ACTIVITY_2026_08_09.has(tc);
}

interface Group {
  key: string;
  number: number;
  status: string;
  year: string;
  poolCents: number;
  /** One entry per product-line bucket in the base. `null` reports under its own key. */
  base: Map<string, { cents: number; qty: number; lines: number }>;
  legacyBaseCents: number;
  legacyClassBaseCents: number;
  /**
   * What a group carries that is NEITHER pool nor base, described. A zero-base group is the whole
   * point of the `unallocated` row, so "base $0.00" is not an answer — it matters enormously whether
   * the group carries nothing else at all, or carries revenue the base definition declines to count.
   * ADR-0031 predicted five specific orders would leave this bucket; without this, a run can report
   * that they did not and be unable to say why.
   */
  other: string[];
}

const groups = new Map<string, Group>();
let rows = 0, revenueLines = 0;
let poolAll = 0, poolExVoid = 0;
const excluded = new Map<string, { lines: number; cents: number }>();
const ownRevenue = new Map<string, number>();
let noOrderDivider = 0, multiOrder = 0;

for (const inv of invoices) {
  const items = inv.items ?? [];
  const typeByUid = new Map(items.map((i) => [i.uid, i.type]));
  const orderUids = new Set(items.filter((i) => i.type === "order").map((i) => i.uid));
  if (orderUids.size === 0) noOrderDivider++;
  if (orderUids.size > 1) multiOrder++;

  for (const it of items) {
    rows++;
    if (STRUCTURAL.has(it.type)) continue;
    revenueLines++;
    const cents = it.price?.subtotal_discounted_cents ?? 0;
    const tc = it.tracking_category ?? null;
    const orderUid = (it.path ?? []).find((u) => typeByUid.get(u) === "order") ?? "-";
    const key = `${inv.uid}::${orderUid}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        number: inv.number,
        status: inv.status,
        year: (inv.date ?? "----").slice(0, 4),
        poolCents: 0,
        base: new Map(),
        legacyBaseCents: 0,
        legacyClassBaseCents: 0,
        other: [],
      };
      groups.set(key, g);
    }

    ownRevenue.set(tc ?? "«none»", (ownRevenue.get(tc ?? "«none»") ?? 0) + cents);

    // The two reproduction counters accumulate OUTSIDE the branch below, because a line the current
    // classification excludes from the base is exactly the line an older classification included.
    if (isLegacyBase(it)) g.legacyBaseCents += cents;
    if (isLegacyClassBase(it)) g.legacyClassBaseCents += cents;

    const isPool = tc !== null && cls.spreads.has(tc);
    if (isPool) {
      g.poolCents += cents;
      poolAll += cents;
      if (inv.status !== "void") poolExVoid += cents;
    } else if (isSpecBase(it)) {
      const bk = tc ?? "«none»";
      const b = g.base.get(bk) ?? { cents: 0, qty: 0, lines: 0 };
      b.cents += cents;
      b.qty += it.quantity ?? 0;
      b.lines += 1;
      g.base.set(bk, b);
    } else {
      // Neither pool nor base. Named rather than dropped: this is where a taxonomy change shows up.
      const why = tc === null
        ? `null product line on a non-goods account (${it.coa_revenue ?? "no account"})`
        : cls.kind.get(tc) === undefined
        ? `"${tc}" is not classified in \`line_kinds\``
        : `activity line "${tc}" whose pool does not spread (${cls.poolStatus.get(tc) ?? "?"})`;
      const e = excluded.get(why) ?? { lines: 0, cents: 0 };
      e.lines++;
      e.cents += cents;
      excluded.set(why, e);
      g.other.push(`${it.type}/${it.coa_revenue ?? "—"} ${tc ?? "«none»"} ${usd(cents)}`);
    }
  }
}

console.log(`rows: ${rows}, revenue-bearing: ${revenueLines}`);
console.log(`(invoice, causal order) groups: ${groups.size}`);
console.log(
  `invoices with no order divider: ${noOrderDivider} · billing more than one order: ${multiOrder} ` +
    `(0 of 999 on 2026-08-09 — the measurement that made order-scope free)`,
);
console.log(
  `\npool (${[...cls.spreads].join("+")}) revenue: ${usd(poolAll)} incl. void, ` +
    `**${usd(poolExVoid)} ex-void** · void carve-out ${usd(poolAll - poolExVoid)} = ${
      pct(poolAll - poolExVoid, poolAll)
    } of the pool`,
);
console.log(
  `baseline 2026-08-09: ${usd(BASELINE.poolCents)} incl. void ` +
    `(Δ ${poolAll >= BASELINE.poolCents ? "+" : "−"}${
      usd(Math.abs(poolAll - BASELINE.poolCents))
    })`,
);

console.log(`\n## Revenue that is neither pool nor base\n`);
console.log("| why | lines | revenue |");
console.log("| --- | ---: | ---: |");
for (const [why, e] of [...excluded].sort((a, b) => b[1].cents - a[1].cents)) {
  console.log(`| ${why} | ${e.lines} | ${usd(e.cents)} |`);
}

// ── the populations ADR-0031 names ───────────────────────────────────────────────────────────────

/** Every group that carries pool revenue. Voids excluded is the primary view (ADR-0031 clause 6). */
const withPool = [...groups.values()].filter((g) => g.poolCents !== 0);
const exVoid = withPool.filter((g) => g.status !== "void");

function baseTotal(g: Group): number {
  let n = 0;
  for (const b of g.base.values()) n += b.cents;
  return n;
}

interface Population {
  label: string;
  groups: Group[];
  poolCents: number;
  baseOf: (g: Group) => number;
}
const populations: Population[] = [
  {
    label: "spec base, ex-void (ADR-0031's own definition)",
    groups: exVoid,
    poolCents: poolExVoid,
    baseOf: baseTotal,
  },
  { label: "spec base, incl. void", groups: withPool, poolCents: poolAll, baseOf: baseTotal },
  {
    label: "2026-08-09 base rule (null excluded), CURRENT classification, incl. void",
    groups: withPool,
    poolCents: poolAll,
    baseOf: (g) => g.legacyBaseCents,
  },
  {
    label:
      "2026-08-09 base rule AND 2026-08-09 classification, incl. void — the true like-for-like",
    groups: withPool,
    poolCents: poolAll,
    baseOf: (g) => g.legacyClassBaseCents,
  },
];

console.log(`\n## Structurally unallocable — pool revenue with a zero base\n`);
console.log("| base definition | groups | pool revenue | share of pool |");
console.log("| --- | ---: | ---: | ---: |");
for (const p of populations) {
  const zero = p.groups.filter((g) => p.baseOf(g) <= 0);
  const cents = zero.reduce((n, g) => n + g.poolCents, 0);
  console.log(
    `| ${p.label} | ${zero.length} | ${usd(cents)} | ${pct(cents, p.poolCents)} |`,
  );
}
console.log(
  `\nbaseline: spec base ex-void **${BASELINE.unallocableSpecExVoid.groups} groups / ${
    usd(BASELINE.unallocableSpecExVoid.cents)
  } / ${(100 * BASELINE.unallocableSpecExVoid.share).toFixed(2)}%** · ` +
    `2026-08-09 definition ${BASELINE.unallocableNullExcluded.groups} / ${
      usd(BASELINE.unallocableNullExcluded.cents)
    } / ${(100 * BASELINE.unallocableNullExcluded.share).toFixed(2)}%`,
);
console.log(
  `⚠️ **predicted direction: must FALL, possibly to ~0.** A reading that rises is a finding.`,
);

const unallocableSpec = exVoid.filter((g) => baseTotal(g) <= 0);
{
  const cents = unallocableSpec.reduce((n, g) => n + g.poolCents, 0);
  const share = cents / poolExVoid;
  const b = BASELINE.unallocableSpecExVoid;
  // Three things move independently and only one of them is the prediction: the SHARE can fall
  // purely because the pool denominator grew. Judge all three, or a growing bucket reports as
  // progress.
  console.log(
    `\n**VERDICT** (spec base ex-void both sides): share ${(100 * b.share).toFixed(2)}% → ` +
      `**${(100 * share).toFixed(2)}%** ${share < b.share ? "(fell)" : "(ROSE)"} · ` +
      `amount ${usd(b.cents)} → **${usd(cents)}** ${cents < b.cents ? "(fell)" : "(ROSE)"} · ` +
      `groups ${b.groups} → **${unallocableSpec.length}** ${
        unallocableSpec.length < b.groups ? "(fell)" : "(ROSE)"
      }.`,
  );
  if (share < b.share && cents >= b.cents) {
    console.log(
      `⚠️⚠️ **The share fell only because the POOL grew.** Nothing became allocable — the amount and ` +
        `the group count both rose. Quoting the share alone would report this as the predicted ` +
        `improvement. This is the same base-mismatch failure the corpus has already produced three ` +
        `times, in its subtlest form: same base definition, different DENOMINATOR SIZE.`,
    );
  }
}
if (unallocableSpec.length) {
  const byYear = new Map<string, { groups: number; cents: number }>();
  for (const g of unallocableSpec) {
    const y = byYear.get(g.year) ?? { groups: 0, cents: 0 };
    y.groups++;
    y.cents += g.poolCents;
    byYear.set(g.year, y);
  }
  console.log(
    `\nby year: ${
      [...byYear].sort().map(([y, v]) => `${y} ${v.groups} groups ${usd(v.cents)}`).join(" · ")
    }`,
  );
  console.log(
    `largest: ${
      [...unallocableSpec].sort((a, b) => b.poolCents - a.poolCents).slice(0, 8)
        .map((g) => `inv ${g.number} ${usd(g.poolCents)}`).join(", ")
    }`,
  );
}

// The five Netflix Duradeck invoices were 85.5% of the recorded bucket, and ADR-0031 predicts they
// leave it once Duradeck reads `Surface Protection`. Named explicitly because "the share fell" and
// "the specific case predicted to move did move" are different claims.
console.log(`\n### The five Netflix Duradeck orders (85.5% of the recorded bucket)\n`);
for (const n of BASELINE.netflixDuradeck) {
  const gs = [...groups.values()].filter((g) => g.number === n);
  if (!gs.length) {
    console.log(`- inv ${n}: not in the corpus`);
    continue;
  }
  for (const g of gs) {
    const bt = baseTotal(g);
    console.log(
      `- inv ${n} (${g.status}, ${g.year}): pool ${usd(g.poolCents)}, base ${usd(bt)} across ` +
        `${[...g.base.keys()].join("+") || "nothing"} → ${
          bt > 0 ? "**allocable**" : "still unallocable"
        }`,
    );
    if (bt <= 0) {
      console.log(`    everything else on the order: ${g.other.join(" | ") || "(nothing)"}`);
    }
  }
}

// ── pool bigger than its own base ────────────────────────────────────────────────────────────────

console.log(`\n## Groups where the pool EXCEEDS the base it spreads over\n`);
console.log(
  "| base definition | over / allocable | pool held | share of pool | median | p90 | max |",
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const p of populations) {
  const allocable = p.groups.filter((g) => p.baseOf(g) > 0);
  const over = allocable.filter((g) => g.poolCents > p.baseOf(g));
  const held = over.reduce((n, g) => n + g.poolCents, 0);
  const ratios = allocable.map((g) => g.poolCents / p.baseOf(g)).sort((a, b) => a - b);
  const at = (q: number) => ratios.length ? ratios[Math.floor(q * ratios.length)] : NaN;
  console.log(
    `| ${p.label} | ${over.length} / ${allocable.length} | ${usd(held)} | ${
      pct(held, p.poolCents)
    } | ${at(0.5).toFixed(3)} | ${at(0.9).toFixed(2)} | ${
      (ratios[ratios.length - 1] ?? NaN).toFixed(2)
    } |`,
  );
}
console.log(
  `\nbaseline 2026-08-09: **${BASELINE.overGroups} of ${BASELINE.overOfAllocable} groups / ${
    usd(BASELINE.overCents)
  } / ${(100 * BASELINE.overShare).toFixed(1)}% of delivery revenue**, ` +
    `median ${BASELINE.ratioMedian}, p90 ${BASELINE.ratioP90}, max ${BASELINE.ratioMax}`,
);
console.log(
  `⚠️ **predicted direction: must FALL** — the base grows on exactly the thinnest groups.`,
);

// The verdict is computed, not eyeballed. The baseline was measured under the 2026-08-09 definition
// (all null lines excluded, voids included), so that is the row the prediction is judged against —
// comparing the spec-base row to it would fold a definitional change into a direction claim.
{
  const p = populations[3];
  const allocable = p.groups.filter((g) => p.baseOf(g) > 0);
  const over = allocable.filter((g) => g.poolCents > p.baseOf(g));
  const held = over.reduce((n, g) => n + g.poolCents, 0);
  const share = held / p.poolCents;
  const ratios = allocable.map((g) => g.poolCents / p.baseOf(g)).sort((a, b) => a - b);
  const median = ratios[Math.floor(0.5 * ratios.length)];
  const fell = share < BASELINE.overShare;
  console.log(
    `\n**LIKE-FOR-LIKE VERDICT** (2026-08-09 definition both sides): ` +
      `${(100 * BASELINE.overShare).toFixed(1)}% → **${(100 * share).toFixed(2)}%**, ` +
      `${BASELINE.overGroups}/${BASELINE.overOfAllocable} → ${over.length}/${allocable.length} groups, ` +
      `median ratio ${BASELINE.ratioMedian} → ${median.toFixed(3)}. ` +
      (fell
        ? `Prediction HELD — it fell.`
        : `⚠️⚠️ **THE PREDICTION FAILED — it ROSE.** The pool grew faster than the base on the ` +
          `typical group, which is the opposite of what "the base grows on exactly the thin groups" ` +
          `assumed. This is a finding, not a result.`),
  );
}

// ── allocate under each basis ────────────────────────────────────────────────────────────────────

const alloc: Record<Basis, Map<string, number>> = {
  revenue: new Map(),
  lines: new Map(),
  quantity: new Map(),
};
const unallocable: Record<Basis, number> = { revenue: 0, lines: 0, quantity: 0 };

for (const g of exVoid) {
  const keys = [...g.base.keys()];
  for (const basis of BASES) {
    const weights = keys.map((k) => {
      const b = g.base.get(k)!;
      return basis === "revenue" ? b.cents : basis === "lines" ? b.lines : b.qty;
    });
    const shares = spread(g.poolCents, weights, keys);
    if (!shares) {
      unallocable[basis] += g.poolCents;
      continue;
    }
    keys.forEach((k, i) => alloc[basis].set(k, (alloc[basis].get(k) ?? 0) + shares[i]));
  }
}

// The control total the spec's SQL names as the invariant that can actually fail.
for (const basis of BASES) {
  const allocated = [...alloc[basis].values()].reduce((a, b) => a + b, 0);
  const sum = allocated + unallocable[basis];
  const ok = sum === poolExVoid;
  console.log(
    `\ncontrol total (${basis}): allocated ${usd(allocated)} + unallocated ${
      usd(unallocable[basis])
    } = ${usd(sum)} ${ok ? "✅ equals the pool" : `❌ pool is ${usd(poolExVoid)}`}`,
  );
  if (!ok) throw new Error(`control total failed for basis ${basis}`);
}

console.log(`\n## Allocated pool revenue per product line, by basis (ex-void)\n`);
console.log("| product line | own revenue | by revenue | by lines | by quantity | units / $100 |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
const baseOwn = new Map<string, { cents: number; qty: number }>();
for (const g of exVoid) {
  for (const [k, b] of g.base) {
    const o = baseOwn.get(k) ?? { cents: 0, qty: 0 };
    o.cents += b.cents;
    o.qty += b.qty;
    baseOwn.set(k, o);
  }
}
for (const k of [...baseOwn.keys()].sort((a, b) => baseOwn.get(b)!.cents - baseOwn.get(a)!.cents)) {
  const o = baseOwn.get(k)!;
  const per100 = o.cents > 0 ? (o.qty / (o.cents / 10000)).toFixed(2) : "n/a";
  console.log(
    `| ${k} | ${usd(o.cents)} | ${usd(alloc.revenue.get(k) ?? 0)} | ${
      usd(alloc.lines.get(k) ?? 0)
    } | ${usd(alloc.quantity.get(k) ?? 0)} | ${per100} |`,
  );
}

console.log(`\n## Divergence between bases (sum of absolute per-line differences, ex-void)\n`);
console.log("| pair | reassigned | share of pool | 2026-08-09 |");
console.log("| --- | ---: | ---: | ---: |");
const baselineDiv: Record<string, number> = {
  "revenue vs lines": BASELINE.divergence.revenue_lines,
  "revenue vs quantity": BASELINE.divergence.revenue_quantity,
  "lines vs quantity": BASELINE.divergence.lines_quantity,
};
for (let i = 0; i < BASES.length; i++) {
  for (let j = i + 1; j < BASES.length; j++) {
    const a = alloc[BASES[i]], b = alloc[BASES[j]];
    let d = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
    }
    const label = `${BASES[i]} vs ${BASES[j]}`;
    console.log(
      `| ${label} | ${usd(d)} | ${pct(d, poolExVoid)} | ${
        (100 * baselineDiv[label]).toFixed(1)
      }% |`,
    );
  }
}
console.log(`\n⚠️ **predicted direction: unknown.** More lines in the base cuts both ways.`);

// ── the Crafty case ADR-0031 uses as its illustration ────────────────────────────────────────────

const craftyOwn = baseOwn.get("Crafty")?.cents ?? 0;
const craftyAlloc = alloc.revenue.get("Crafty") ?? 0;
console.log(`\n## The \`Crafty\` illustration\n`);
console.log(
  `own revenue on pool-bearing groups **${usd(craftyOwn)}** (was ${usd(BASELINE.craftyOwn)}); ` +
    `allocated by revenue **${usd(craftyAlloc)}** (was ${usd(BASELINE.craftyAllocated)}) = ` +
    `**${pct(craftyAlloc, craftyOwn)} of its own** (was ${
      pct(BASELINE.craftyAllocated, BASELINE.craftyOwn)
    }).`,
);

// ── every activity pool's own revenue, spreading or not ──────────────────────────────────────────

console.log(`\n## Activity pools — own revenue and whether it spreads (all invoices)\n`);
console.log("| product line | pool status | own revenue | share of line revenue |");
console.log("| --- | --- | ---: | ---: |");
const lineRevenue = [...ownRevenue.values()].reduce((a, b) => a + b, 0);
for (const [k, kind] of [...cls.kind].filter(([, v]) => v === "activity")) {
  console.log(
    `| ${k} | ${cls.poolStatus.get(k) ?? "⚠️ no pool"} | ${usd(ownRevenue.get(k) ?? 0)} | ${
      pct(ownRevenue.get(k) ?? 0, lineRevenue)
    } |`,
  );
  void kind;
}
console.log(`\nline revenue (all invoices, tax-exclusive): ${usd(lineRevenue)}`);
if ((ownRevenue.get("Shipping") ?? 0) === 0 && cls.declared.has("Shipping")) {
  console.log(
    `\n⚠️ **\`Shipping\` reads $0.00 and is NOT a repeat of the \`Transport\` failure.** OQ-034 split ` +
      `the two values in the spec on 2026-08-16; the corpus still carries one value \`Transport\` ` +
      `spanning both accounts. The split is derivable by account and reproduces the spec's stated ` +
      `figures exactly — see \`deno task matrix-lines\`, which measures 4100 (trucking) and 4150 ` +
      `(shipping) separately. What is outstanding is the historical restatement, an ADR-0020 ` +
      `obligation, not a re-declaration.`,
  );
}
