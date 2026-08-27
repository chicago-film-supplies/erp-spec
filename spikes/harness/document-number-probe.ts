/**
 * What the LIVE order and invoice numbering actually is — gaps, duplicates, and sort agreement.
 *
 * ── why this exists ─────────────────────────────────────────────────────────────────────────────
 *
 * Owner, 2026-08-26: reconsider **sequential no-gap** order and invoice numbers, wanted **human
 * readable, short and sortable**. Three of those four words are testable against the incumbent, and
 * the fourth (readable) is not a measurement.
 *
 * ⚠️ **This probe answers WHAT IS, and nothing else.** It measures the migration corpus: the numbers
 * v2 inherits and the properties they do or do not already have. It cannot answer whether v2 should
 * be gapless — that is a design question, and `CLAUDE.md`'s fifth rule is that a v1 read used to
 * settle one is outside its competence. What it IS for: sizing the change. "Make it gapless" costs
 * nothing if the incumbent already is, and is a real break in a customer-facing identifier if it is
 * not.
 *
 * ── the three properties, and why each is checked the way it is ─────────────────────────────────
 *
 *   **gapless** — the absent numbers inside `[min, max]`, listed as runs rather than counted, because
 *     a run tells you what happened and a count does not. ⚠️ **An absent number is not proof a
 *     document never had it.** Xero frees an `InvoiceNumber` when its holder is VOIDED or DELETED
 *     (workspace `CLAUDE.md`), and this reads CFS only — so a hole here may be a void in Xero rather
 *     than a number nobody used. Reported as ABSENT-FROM-CFS, which is what was measured.
 *   **sortable** — whether ordering by `number` agrees with ordering by `date`. This is the one that
 *     is easy to assume: a monotonic counter sorts by ISSUE ORDER, and "sortable" usually means
 *     chronological. If a later number carries an earlier date, sorting by number is already not
 *     sorting by time, and no new scheme is needed to break it.
 *   **short** — the digit width today, which is the baseline any proposed scheme has to beat. A
 *     scheme is not "short" in the abstract; it is shorter or longer than `2395`.
 *
 * Read-only prod Firestore under ADC — `deno task doc-numbers` from `spikes/harness/`.
 */
import { type Doc, pageAll } from "./corpus.ts";

interface Numbered {
  number?: number;
  date?: string;
  status?: string;
}

/** Absent numbers inside [min,max], collapsed into runs. `[from,to]` inclusive. */
function runs(present: Set<number>, min: number, max: number): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let n = min; n <= max; n++) {
    if (!present.has(n)) {
      if (start === null) start = n;
    } else if (start !== null) {
      out.push([start, n - 1]);
      start = null;
    }
  }
  if (start !== null) out.push([start, max]);
  return out;
}

function report(label: string, docs: Doc<Numbered>[], withDates: boolean) {
  const nums = docs.map((d) => d.number).filter((n): n is number => typeof n === "number");
  const missingField = docs.length - nums.length;
  const present = new Set(nums);
  const dupes = new Map<number, number>();
  for (const n of nums) dupes.set(n, (dupes.get(n) ?? 0) + 1);
  const duplicated = [...dupes.entries()].filter(([, c]) => c > 1);
  const min = Math.min(...nums), max = Math.max(...nums);
  const span = max - min + 1;
  const holes = runs(present, min, max);
  const absent = holes.reduce((a, [f, t]) => a + (t - f + 1), 0);

  console.log(`\n── ${label} ─────────────────────────────────────────────`);
  console.log(`  documents            ${docs.length}`);
  if (missingField) console.log(`  ⚠️ no \`number\` field  ${missingField}`);
  console.log(`  range                ${min} … ${max}  (span ${span})`);
  console.log(`  distinct numbers     ${present.size}`);
  console.log(
    `  ABSENT from CFS      ${absent}  (${
      (absent / span * 100).toFixed(2)
    }% of the span) in ${holes.length} run(s)`,
  );
  console.log(`  duplicated numbers   ${duplicated.length}`);
  if (duplicated.length) {
    console.log(`     ${duplicated.map(([n, c]) => `${n}×${c}`).join(", ")}`);
  }
  console.log(`  digit width          ${String(min).length}–${String(max).length}`);
  // The ten longest runs — the shape of the holes, not just their number.
  const longest = [...holes].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 10);
  console.log(
    `  longest runs         ${
      longest.map(([f, t]) => (f === t ? `${f}` : `${f}-${t} (${t - f + 1})`)).join(", ")
    }`,
  );

  // ── WHERE the holes are, which is the decision-relevant cut ──
  // A count says "15% of the span is missing". It does not say whether that is inherited mess or
  // ongoing behaviour, and those two answers cost completely different amounts. If the holes stopped
  // years ago, gaplessness is nearly free; if they are still being made, it is a change to how
  // documents get issued.
  const BUCKET = 100;
  const buckets = new Map<number, { absent: number; span: number }>();
  for (let n = min; n <= max; n++) {
    const b = Math.floor(n / BUCKET) * BUCKET;
    const e = buckets.get(b) ?? { absent: 0, span: 0 };
    e.span++;
    if (!present.has(n)) e.absent++;
    buckets.set(b, e);
  }
  console.log(`  absence by ${BUCKET}s:`);
  for (const [b, e] of [...buckets.entries()].sort((a, x) => a[0] - x[0])) {
    const pctv = e.absent / e.span * 100;
    const bar = "#".repeat(Math.round(pctv / 2));
    console.log(
      `    ${String(b).padStart(5)}  ${String(e.absent).padStart(3)}/${
        String(e.span).padStart(3)
      }  ${pctv.toFixed(1).padStart(5)}%  ${bar}`,
    );
  }

  if (!withDates) return;

  // ── sortable: does number order agree with date order? ──
  const dated = docs
    .filter((d): d is Doc<Numbered> & { number: number; date: string } =>
      typeof d.number === "number" && typeof d.date === "string"
    )
    .sort((a, b) => a.number - b.number);
  let inversions = 0;
  let worstDays = 0;
  for (let i = 1; i < dated.length; i++) {
    const prev = Date.parse(dated[i - 1].date), cur = Date.parse(dated[i].date);
    if (cur < prev) {
      inversions++;
      worstDays = Math.max(worstDays, (prev - cur) / 86_400_000);
    }
  }
  console.log(
    `  sort agreement       ${
      dated.length - inversions
    }/${dated.length} adjacent pairs in date order`,
  );
  console.log(
    `  ⚠️ INVERSIONS        ${inversions} (${
      (inversions / Math.max(1, dated.length - 1) * 100).toFixed(2)
    }%) — a higher number carrying an EARLIER date; worst gap ${worstDays.toFixed(0)} day(s)`,
  );

  // Status of the documents on either side of an inversion is not asked here; the population is.
  const byYear = new Map<string, number>();
  for (const d of dated) byYear.set(d.date.slice(0, 4), (byYear.get(d.date.slice(0, 4)) ?? 0) + 1);
  console.log(
    `  by year              ${
      [...byYear.entries()].sort().map(([y, c]) => `${y}:${c}`).join("  ")
    }`,
  );
}

const orders = await pageAll<Numbered>("orders", ["number", "status"]);
const invoices = await pageAll<Numbered>("invoices", ["number", "date", "status"]);

// ⚠️ UTC, and labelled as such deliberately. This repo canonicalizes business datetimes to Chicago
// offset form, so an unlabelled `toISOString()` day disagrees with the local day for six hours every
// night — the same footgun `generate.ts` is banned from touching a clock over.
console.log(
  `\nDocument numbering, live prod corpus — read ${new Date().toISOString().slice(0, 10)} (UTC)`,
);
report("orders", orders, false);
report("invoices", invoices, true);

console.log(`
⚠️ ABSENT-FROM-CFS is not "never issued". Xero frees an InvoiceNumber when its holder is VOIDED or
   DELETED, and this probe reads CFS's own store only. A hole is a number CFS does not hold today.
⚠️ These are figures OF the pre-CRMS-cutover corpus. 100% of prod orders still carry a crms_id, and
   that share only falls from cutover onward.
`);
