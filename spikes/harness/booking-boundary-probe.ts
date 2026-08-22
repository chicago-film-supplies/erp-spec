/**
 * SPIKE-012 — at which fulfillment moment does a booking become a TigerBeetle pending transfer,
 * and how much of order status is derivable once that boundary is fixed? (ADR-0015)
 *
 * ── What makes this measurable at all ───────────────────────────────────────────────────────────
 *
 * v1 already decomposes a booking's quantity across the lifecycle. `bookings.breakdown` carries
 * seven counters — `quoted, reserved, prepped, out, returned, damaged, lost` — and `orders`
 * carries the same seven rolled up as `bookings_breakdown`. **That decomposition IS a position**,
 * in the sense TigerBeetle means: a quantity split across states. So the candidate boundaries
 * ADR-0015 lists map onto counters that already exist and are already populated in prod, and the
 * two questions the spike asks can be answered against real data rather than modelled.
 *
 * ⚠️ **THIS IS A SNAPSHOT, NOT AN EVENT LOG, AND THAT BOUNDS WHAT "REPLAY" CAN MEAN.** Firestore
 * holds each booking's CURRENT state; there is no transition history, so a true step-by-step replay
 * of "what did the position look like when this booking was reserved" is not available from this
 * corpus at any cost. Two things are available and both bear on the question:
 *
 *   1. **The point-in-time census** — for bookings in each state right now, how many have a rental
 *      window that has not started. This answers "at boundary B, is a future-dated booking
 *      consuming balance" directly, today, on live data.
 *   2. **The lead-time distribution** — `dates.start - created_at` over every booking, which bounds
 *      how long a booking sits between creation and its window. A boundary at confirmation holds a
 *      transfer for that whole span.
 *
 * Anything this probe cannot see is printed under NOT MEASURED rather than omitted.
 *
 * ── The oracle problem, and the two independent checks ───────────────────────────────────────────
 *
 * Deriving a status from `breakdown` and comparing it to `orders.bookings_breakdown` would be a
 * fixed-point check — both sides come from the same writer, so they can only agree. This repo's own
 * rule is that a guard which consults only its own oracle is not a guard. So:
 *
 *   - **Check A (dependent):** does the order's rolled-up `bookings_breakdown` equal the sum of its
 *     own bookings' `breakdown`? A consistency check on v1's denorm, and nothing more.
 *   - **Check B (independent):** does `sum(breakdown) == quantity` on each booking? This holds or
 *     fails against the booking's OWN declared quantity, which no rollup authors. If it fails, the
 *     decomposition is not a partition and no position can be built from it.
 *
 * Read-only by construction: holds `pageAll` from `corpus.ts` and no reference to anything with a
 * write verb. Run: see `deno task boundary`.
 */
import { type Doc, pageAll, PROJECT } from "./corpus.ts";

/** The seven counters, in lifecycle order. `damaged`/`lost` are terminal exceptions, not a stage. */
const STATES = ["quoted", "reserved", "prepped", "out", "returned", "damaged", "lost"] as const;
type State = typeof STATES[number];
type Breakdown = Partial<Record<State, number>>;

interface Booking {
  uid_order?: string;
  uid_product?: string;
  status?: string;
  type?: string;
  quantity?: number;
  shortage?: number;
  breakdown?: Breakdown;
  dates?: { start?: string; end?: string };
  // deno-lint-ignore no-explicit-any
  created_at?: any;
}

interface Order {
  uid?: string;
  status?: string;
  bookings_breakdown?: Breakdown;
  crms_id?: number;
  crms_status?: string;
  // deno-lint-ignore no-explicit-any
  created_at?: any;
}

/**
 * The four boundaries ADR-0015 names, as the set of counters that would hold a TigerBeetle
 * transfer — pending or posted — if the boundary sat there.
 *
 * `out` is POSTED under every candidate (custody has transferred; that is not in question).
 * What each boundary decides is how much sits PENDING before it.
 */
const BOUNDARIES: { id: string; label: string; pending: State[] }[] = [
  { id: "B1", label: "at confirmation", pending: ["reserved", "prepped"] },
  { id: "B2", label: "at pick start", pending: ["prepped"] },
  { id: "B3", label: "at staged", pending: ["prepped"] },
  { id: "B4", label: "at check-out only (no pending)", pending: [] },
];

const asOf = Deno.args.includes("--as-of")
  ? new Date(Deno.args[Deno.args.indexOf("--as-of") + 1])
  : new Date();

const n = (b: Breakdown | undefined, k: State) => Number(b?.[k] ?? 0);
const sumB = (b: Breakdown | undefined) => STATES.reduce((a, k) => a + n(b, k), 0);
const pct = (p: number, w: number) => (w === 0 ? "—" : `${((p / w) * 100).toFixed(2)}%`);
// deno-lint-ignore no-explicit-any
const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(+d) ? null : d;
  }
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?._seconds === "number") return new Date(v._seconds * 1000);
  return null;
};

console.log(`SPIKE-012 — booking→transfer boundary, measured against ${PROJECT}`);
console.log(`as-of ${asOf.toISOString()}\n`);

const bookings = await pageAll<Booking>("bookings", [
  "uid_order",
  "uid_product",
  "status",
  "type",
  "quantity",
  "shortage",
  "breakdown",
  "dates",
  "created_at",
]);
const orders = await pageAll<Order>("orders", [
  "uid",
  "status",
  "bookings_breakdown",
  "created_at",
  "crms_id",
  "crms_status",
]);
console.log(`${bookings.length} bookings · ${orders.length} orders\n`);

// ── Check B — is `breakdown` a partition of `quantity`? (independent of any rollup) ──────────────
console.log("── CHECK B: is breakdown a partition of the booking's own quantity? ────────────────");
let partOk = 0;
const partBad: Doc<Booking>[] = [];
for (const b of bookings) {
  if (sumB(b.breakdown) === Number(b.quantity ?? 0)) partOk++;
  else partBad.push(b);
}
console.log(
  `  sum(breakdown) === quantity : ${partOk} / ${bookings.length} (${
    pct(partOk, bookings.length)
  })`,
);
console.log(`  MISMATCHED                  : ${partBad.length}`);
if (partBad.length) {
  const byStatus = new Map<string, number>();
  for (const b of partBad) {
    byStatus.set(b.status ?? "(none)", (byStatus.get(b.status ?? "(none)") ?? 0) + 1);
  }
  for (const [s, c] of [...byStatus].sort((a, b2) => b2[1] - a[1])) {
    console.log(`      ${s.padEnd(14)} ${String(c).padStart(5)}`);
  }
  const ex = partBad.slice(0, 3);
  for (const b of ex) {
    console.log(
      `      e.g. ${b.__id.slice(0, 46)} qty=${b.quantity} sum=${sumB(b.breakdown)} shortage=${
        b.shortage ?? 0
      } ${JSON.stringify(b.breakdown ?? {})}`,
    );
  }
}

// ── census ──────────────────────────────────────────────────────────────────────────────────────
console.log(
  "\n── booking census by status ────────────────────────────────────────────────────────",
);
const byStatus = new Map<string, { rows: number; qty: number }>();
for (const b of bookings) {
  const k = b.status ?? "(none)";
  const c = byStatus.get(k) ?? { rows: 0, qty: 0 };
  c.rows++;
  c.qty += Number(b.quantity ?? 0);
  byStatus.set(k, c);
}
for (const [s, c] of [...byStatus].sort((a, b2) => b2[1].rows - a[1].rows)) {
  console.log(
    `  ${s.padEnd(14)} ${String(c.rows).padStart(5)} rows  ${String(c.qty).padStart(7)} units`,
  );
}

console.log(
  "\n── units by counter (the position, corpus-wide) ────────────────────────────────────",
);
for (const k of STATES) {
  const u = bookings.reduce((a, b) => a + n(b.breakdown, k), 0);
  const rows = bookings.filter((b) => n(b.breakdown, k) > 0).length;
  console.log(
    `  ${k.padEnd(10)} ${String(u).padStart(8)} units  on ${String(rows).padStart(5)} rows`,
  );
}

// ── EXIT CRITERION 2 — does a future-dated booking consume balance at each boundary? ────────────
console.log(
  "\n── EXIT CRITERION 2: future-dated bookings holding a transfer, per boundary ────────",
);
console.log("   'future-dated' = dates.start is after the as-of date, i.e. the rental window has");
console.log("   not begun. A unit in a boundary's `pending` set holds a transfer and consumes");
console.log("   balance; if any such unit is future-dated, that boundary oversells the present.\n");

const startOf = (b: Booking) => (b.dates?.start ? new Date(b.dates.start) : null);
for (const bd of BOUNDARIES) {
  let heldRows = 0, heldUnits = 0, futureRows = 0, futureUnits = 0, undated = 0;
  let maxLeadDays = 0;
  for (const b of bookings) {
    const units = bd.pending.reduce((a, k) => a + n(b.breakdown, k), 0);
    if (units <= 0) continue;
    heldRows++;
    heldUnits += units;
    const st = startOf(b);
    if (!st) {
      undated++;
      continue;
    }
    if (st > asOf) {
      futureRows++;
      futureUnits += units;
      const days = (+st - +asOf) / 86_400_000;
      if (days > maxLeadDays) maxLeadDays = days;
    }
  }
  const verdict = bd.pending.length === 0
    ? "VACUOUS — nothing pends, so nothing can be future-dated"
    : futureUnits === 0
    ? "PASSES — no future-dated unit holds a transfer"
    : `FAILS — ${futureUnits} future-dated units hold a transfer`;
  console.log(`  ${bd.id} ${bd.label.padEnd(32)} pending={${bd.pending.join(",") || "∅"}}`);
  console.log(
    `      holding a transfer : ${String(heldRows).padStart(5)} rows / ${
      String(heldUnits).padStart(6)
    } units`,
  );
  console.log(
    `      of which FUTURE    : ${String(futureRows).padStart(5)} rows / ${
      String(futureUnits).padStart(6)
    } units   (max lead ${maxLeadDays.toFixed(0)}d)`,
  );
  if (undated) console.log(`      undated            : ${undated} rows — counted as neither`);
  console.log(`      ⇒ ${verdict}\n`);
}

// ── lead time — how long a transfer would be held if the boundary were at confirmation ─────────
console.log("── lead time: dates.start − created_at ─────────────────────────────────────────────");
console.log("  ⚠️ UNUSABLE AS A BUSINESS FIGURE for the import cohort — `created_at` is the CRMS");
console.log("     import timestamp for 79.78% of orders, so the negative values below measure the");
console.log("     import, not how far ahead an order is placed. Printed only to show that.");
const leads: number[] = [];
for (const b of bookings) {
  const st = startOf(b), cr = toDate(b.created_at);
  if (st && cr) leads.push((+st - +cr) / 86_400_000);
}
leads.sort((a, b) => a - b);
const q = (p: number) =>
  leads.length ? leads[Math.min(leads.length - 1, Math.floor(leads.length * p))] : NaN;
console.log(
  `  n=${leads.length}   p50 ${q(0.5).toFixed(1)}d   p90 ${q(0.9).toFixed(1)}d   p99 ${
    q(0.99).toFixed(1)
  }d   max ${q(1).toFixed(1)}d`,
);
console.log(
  `  negative (window began before the row was created): ${leads.filter((d) => d < 0).length}`,
);

// ── CHECK A — order rollup against the sum of its own bookings ─────────────────────────────────
console.log(
  "\n── CHECK A: orders.bookings_breakdown vs the sum of that order's bookings ──────────",
);
const perOrder = new Map<string, Breakdown>();
for (const b of bookings) {
  const k = b.uid_order ?? "";
  if (!k) continue;
  const acc = perOrder.get(k) ?? {};
  for (const s of STATES) acc[s] = (acc[s] ?? 0) + n(b.breakdown, s);
  perOrder.set(k, acc);
}
let rollOk = 0, rollBad = 0, rollNoBookings = 0;
for (const o of orders) {
  const mine = perOrder.get(o.uid ?? o.__id);
  if (!mine) {
    rollNoBookings++;
    continue;
  }
  const same = STATES.every((s) => n(o.bookings_breakdown, s) === n(mine, s));
  same ? rollOk++ : rollBad++;
}
console.log(`  agree            : ${rollOk}`);
console.log(`  DISAGREE         : ${rollBad}`);
console.log(
  `  order has no booking rows: ${rollNoBookings}  (service-only / stock_method none / draft)`,
);

// ── EXIT CRITERION 4 — can order status be derived from the position alone? ────────────────────
console.log(
  "\n── EXIT CRITERION 4: order status derived from the position alone ─────────────────",
);
console.log("   Rule, stated before it is run — ADR-0014's boundary: a field is derivable exactly");
console.log("   when its transition has a ledger or inventory consequence.\n");
console.log("     out > 0                                  → active");
console.log("     returned+damaged+lost > 0, nothing else  → complete");
console.log("     reserved+prepped > 0                     → reserved");
console.log("     only quoted > 0                          → quoted");
console.log("     no units at all                          → NOT DERIVABLE from the position\n");

function derive(b: Breakdown | undefined): string | null {
  const g = (k: State) => n(b, k);
  const live = g("reserved") + g("prepped");
  const done = g("returned") + g("damaged") + g("lost");
  const total = sumB(b);
  if (total === 0) return null;
  if (g("out") > 0) return "active";
  if (done > 0 && live === 0 && g("quoted") === 0) return "complete";
  if (live > 0) return "reserved";
  if (g("quoted") > 0) return "quoted";
  return null;
}

const outcome = new Map<string, number>();
const mismatchPairs = new Map<string, number>();
const undervable = new Map<string, number>();
for (const o of orders) {
  const stored = o.status ?? "(none)";
  const d = derive(o.bookings_breakdown);
  if (d === null) {
    outcome.set("NOT DERIVABLE", (outcome.get("NOT DERIVABLE") ?? 0) + 1);
    undervable.set(stored, (undervable.get(stored) ?? 0) + 1);
  } else if (d === stored) {
    outcome.set("derived == stored", (outcome.get("derived == stored") ?? 0) + 1);
  } else {
    outcome.set("DERIVED != STORED", (outcome.get("DERIVED != STORED") ?? 0) + 1);
    const k = `stored=${stored} derived=${d}`;
    mismatchPairs.set(k, (mismatchPairs.get(k) ?? 0) + 1);
  }
}
for (const [k, v] of [...outcome].sort((a, b2) => b2[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}  ${pct(v, orders.length)}`);
}
console.log("\n  NOT DERIVABLE — by the status v1 stores (this is the ASSIGNED set):");
for (const [k, v] of [...undervable].sort((a, b2) => b2[1] - a[1])) {
  console.log(`      ${k.padEnd(14)} ${String(v).padStart(5)}`);
}
console.log("\n  DERIVED != STORED — every disagreeing pair:");
for (const [k, v] of [...mismatchPairs].sort((a, b2) => b2[1] - a[1])) {
  console.log(`      ${k.padEnd(42)} ${String(v).padStart(5)}`);
}

// ── the anatomy of the disagreements — is it v1 drift, or is the derivation rule wrong? ────────
// ── ⚠️ is `created_at` the business event, or the IMPORT? ──────────────────────────────────────
console.log(
  "\n── created_at cohort test ─────────────────────────────────────────────────────────",
);
const oCreated = orders.map((o) => toDate(o.created_at)).filter(Boolean) as Date[];
const byDay = new Map<string, number>();
for (const d of oCreated) {
  const k = d.toISOString().slice(0, 10);
  byDay.set(k, (byDay.get(k) ?? 0) + 1);
}
const top = [...byDay].sort((a, b2) => b2[1] - a[1]).slice(0, 5);
console.log(`  distinct created_at days: ${byDay.size} across ${oCreated.length} orders`);
console.log("  busiest days:");
for (const [d, c] of top) {
  console.log(`      ${d}  ${String(c).padStart(4)} orders  ${pct(c, oCreated.length)}`);
}
const oldest = oCreated.reduce((a, b2) => (a < b2 ? a : b2));
console.log(`  oldest created_at in the whole corpus: ${oldest.toISOString().slice(0, 10)}`);
const onOldestDay = byDay.get(oldest.toISOString().slice(0, 10)) ?? 0;
console.log(
  `  orders sharing that exact day: ${onOldestDay} (${pct(onOldestDay, oCreated.length)})`,
);
console.log(
  "  ⇒ a single day holding a large share means created_at is the IMPORT, not the order.",
);

const importedAll = orders.filter((o) => o.crms_id != null).length;
console.log(
  `\n  BASELINE: ${importedAll} / ${orders.length} orders corpus-wide carry a crms_id (${
    pct(importedAll, orders.length)
  })`,
);
// ── ⚠️ IS THE LIFECYCLE ACTUALLY RUNNING? (owner, 2026-08-22: check-in/out is not live yet) ────
// A boundary that "passes" because its state is almost never written has not been tested. This
// repo's own rule: an unexercised branch is a claim, not a capability. So before any boundary
// verdict is believed, measure how much of the lifecycle the corpus has actually exercised.
const IMPORT_DAY = "2026-01-24";
const dayOf = (o: Order) => {
  const d = toDate(o.created_at);
  return d ? d.toISOString().slice(0, 10) : "(none)";
};
const postImport = new Set(
  orders.filter((o) => dayOf(o) !== IMPORT_DAY).map((o) => o.uid ?? o.__id),
);
console.log(
  "\n── LIFECYCLE EXERCISE: import cohort vs everything after it ───────────────────────",
);
console.log(
  `   import cohort (created_at ${IMPORT_DAY}): ${orders.length - postImport.size} orders`,
);
console.log(`   post-import                             : ${postImport.size} orders\n`);
for (
  const [label, pred] of [
    ["IMPORT   ", (b: Doc<Booking>) => !postImport.has(b.uid_order ?? "")],
    ["POST-IMP ", (b: Doc<Booking>) => postImport.has(b.uid_order ?? "")],
  ] as const
) {
  const set = bookings.filter(pred);
  const u = (k: State) => set.reduce((a, b) => a + n(b.breakdown, k), 0);
  const r = (k: State) => set.filter((b) => n(b.breakdown, k) > 0).length;
  console.log(`  ${label} ${String(set.length).padStart(5)} booking rows`);
  for (const k of STATES) {
    const uu = u(k), rr = r(k);
    if (uu === 0 && rr === 0) continue;
    console.log(
      `      ${k.padEnd(10)} ${String(uu).padStart(7)} units on ${String(rr).padStart(5)} rows`,
    );
  }
  const everMoved = set.filter((b) =>
    n(b.breakdown, "prepped") + n(b.breakdown, "out") + n(b.breakdown, "returned") > 0
  ).length;
  console.log(
    `      ⇒ rows that ever reached prepped/out/returned: ${everMoved} / ${set.length} (${
      pct(everMoved, set.length)
    })\n`,
  );
}

console.log(
  "\n── DISAGREEMENT ANATOMY ───────────────────────────────────────────────────────────",
);
console.log("   A count is not a diagnosis. For each disagreeing pair, what does the position");
console.log("   actually hold, and do the ORDER's own booking rows agree with the order?\n");

const bookingStatusByOrder = new Map<string, Map<string, number>>();
for (const b of bookings) {
  const k = b.uid_order ?? "";
  if (!k) continue;
  const m = bookingStatusByOrder.get(k) ?? new Map<string, number>();
  m.set(b.status ?? "(none)", (m.get(b.status ?? "(none)") ?? 0) + 1);
  bookingStatusByOrder.set(k, m);
}

for (const [pair] of [...mismatchPairs].sort((a, b2) => b2[1] - a[1])) {
  const storedWant = /stored=(\S+)/.exec(pair)![1];
  const derivedWant = /derived=(\S+)/.exec(pair)![1];
  const rows = orders.filter((o) =>
    (o.status ?? "(none)") === storedWant && derive(o.bookings_breakdown) === derivedWant
  );
  const units = (k: State) => rows.reduce((a, o) => a + n(o.bookings_breakdown, k), 0);
  const ages = rows.map((o) => toDate(o.created_at)).filter(Boolean)
    .map((d) => (+asOf - +(d as Date)) / 86_400_000).sort((a, b2) => a - b2);
  const med = ages.length ? ages[Math.floor(ages.length / 2)] : NaN;
  let rowsAgreeing = 0, rowsDisagreeing = 0;
  const rowStatuses = new Map<string, number>();
  for (const o of rows) {
    const m = bookingStatusByOrder.get(o.uid ?? o.__id);
    if (!m) continue;
    for (const [st, c] of m) {
      rowStatuses.set(st, (rowStatuses.get(st) ?? 0) + c);
      if (st === storedWant) rowsAgreeing += c;
      else rowsDisagreeing += c;
    }
  }
  console.log(`  ${pair}   (${rows.length} orders)`);
  console.log(
    `      position: ${
      STATES.map((k) => `${k}=${units(k)}`).filter((x) => !x.endsWith("=0")).join(" ")
    }`,
  );
  console.log(
    `      order age (days): median ${med.toFixed(0)}, oldest ${
      ages.at(-1)?.toFixed(0) ?? "-"
    }, newest ${ages[0]?.toFixed(0) ?? "-"}`,
  );
  console.log(
    `      their booking ROWS by status: ${
      [...rowStatuses].sort((a, b2) => b2[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")
    }`,
  );
  console.log(
    `      rows carrying the ORDER's status: ${rowsAgreeing} / ${rowsAgreeing + rowsDisagreeing}\n`,
  );
}

console.log(
  "\n── NOT MEASURED ───────────────────────────────────────────────────────────────────",
);
console.log("  · Transition HISTORY. Firestore holds current state only; no step-by-step replay");
console.log("    of the position over time is possible from this corpus at any cost.");
console.log("  · Serialized units. ADR-0015 scopes them out; `stock_method` lives on the ORDER");
console.log("    line, not on the booking row, so this probe cannot split them without the items");
console.log("    tree. Sized separately.");
console.log(
  "  · Held stock levels. Whether a boundary would actually OVERSELL needs stock counts;",
);
console.log("    this measures only whether a future-dated unit holds a transfer at all.");
