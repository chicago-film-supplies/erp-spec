/**
 * How wide is a posting key, and can one key really serve all three? — evidence for erp-spec#3 and
 * for ADR-0036's economy claim.
 *
 * ── The claim under test ─────────────────────────────────────────────────────────────────────────
 *
 * ADR-0036 (`proposed`) says a posting records keys, not classifications, and offers an economy:
 *
 * > **One key may serve all three.** … an invoice item's path is the order item's path prefixed by
 * > an order divider — `path[0]` **is** the causal order. Where the two agree, one stored path
 * > carries line identity, invoice link and causal order together, and TigerBeetle reference space
 * > is freed rather than spent.
 *
 * That is three assertions and the ADR measured none of them:
 *
 *   1. that `path[0]` is an ORDER on every invoice — if an invoice has no `order` divider, `path[0]`
 *      is a line and the causal order is simply absent;
 *   2. that a path FITS a TigerBeetle reference field — `user_data_128` is 16 bytes and a path is a
 *      list of uid strings, so this is an encoding question the ADR never asks;
 *   3. that reference space is FREED — which requires the path to displace something, not sit
 *      beside it.
 *
 * ⚠️ **This probe does not decide anything.** It measures the three, so that HOT-013's choice and
 * the `Transfer.code` allocation are made on numbers. The repo's rule that an unexercised branch is
 * a claim rather than a capability applies to an unmeasured economy too.
 *
 * ── Read the header of `corpus.ts` for the auth path ─────────────────────────────────────────────
 *
 * Read-only prod Firestore under ADC, `--allow-net` narrowed to Google hosts, no `--allow-write`.
 *
 *   cd spikes/harness && deno task posting-keys
 */

import { type Doc, pageAll, STRUCTURAL } from "./corpus.ts";

interface Item {
  uid?: string;
  type?: string;
  path?: string[];
  price?: { total_cents?: number };
}
interface WithItems {
  items?: Item[];
  /** Invoices only — the denormalised list of orders an invoice bills. */
  query_by_orders?: string[];
  /** Invoices only — set on the legacy CRMS-imported population. */
  crms_id?: number;
}

/** Percentile over a sorted numeric array, nearest-rank. */
const pct = (sorted: number[], p: number): number =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

/**
 * The uid flavours in play, because they decide the byte width of a path and they are not uniform.
 * Firestore auto-ids are 20 chars; the client mints uuids for dividers and custom lines, and a
 * custom line carries a literal `custom-` prefix on top of one.
 */
const flavour = (uid: string): string =>
  uid.startsWith("custom-")
    ? "custom-uuid"
    : uid.length === 36
    ? "uuid"
    : uid.length === 20
    ? "firestore"
    : `other(${uid.length})`;

/**
 * ⚠️ The `order`-divider count is a FINDING on invoices and a TAUTOLOGY on orders, so the probe is
 * told which it is looking at rather than reporting 100% as though it meant something.
 * `ORDER_ITEM_LEVELS` is `[destination, group]` and `INVOICE_ITEM_LEVELS` is
 * `[order, destination, group]` — an invoice can bill several orders and an order cannot bill
 * itself. So an order's items NEVER carry an order divider, by construction, and a probe that
 * reported that as "100% missing" would be manufacturing a defect out of the schema.
 */
const report = (label: string, docs: Doc<WithItems>[], orderDividerIsExpected: boolean) => {
  const depths: number[] = [];
  const widths: number[] = [];
  const flavours = new Map<string, number>();

  let items = 0;
  let bearing = 0; // non-structural — the rows a posting would key on
  let selfInclusiveViolations = 0;
  let emptyPaths = 0;

  // The claim: `path[0]` is the causal order.
  let docsWithNoOrderDivider = 0;
  let bearingUnderNoOrderDivider = 0;
  // ⚠️ The discriminator that says whether a missing divider is a v1 DEFECT or a real order-less
  // invoice. Owner, 2026-08-16: v1 can change order paths to match invoice paths — which fixes the
  // first case and cannot touch the second.
  const noDividerWithOrders: string[] = [];
  const noDividerWithoutOrders: string[] = [];
  let orderlessRevenueCents = 0;
  let orderlessFromCrms = 0;

  for (const d of docs) {
    const its = d.items ?? [];
    const hasOrderDivider = its.some((i) => i.type === "order");
    if (!hasOrderDivider && its.length > 0) {
      docsWithNoOrderDivider++;
      if (orderDividerIsExpected) {
        ((d.query_by_orders ?? []).length > 0 ? noDividerWithOrders : noDividerWithoutOrders)
          .push(d.__id);
        if (d.crms_id !== undefined && d.crms_id !== null) orderlessFromCrms++;
      }
    }

    for (const i of its) {
      items++;
      const p = i.path ?? [];
      if (p.length === 0) {
        emptyPaths++;
        continue;
      }
      if (i.uid && p[p.length - 1] !== i.uid) selfInclusiveViolations++;

      const structural = STRUCTURAL.has(String(i.type));
      if (!structural) {
        bearing++;
        if (!hasOrderDivider) {
          bearingUnderNoOrderDivider++;
          orderlessRevenueCents += Number(i.price?.total_cents ?? 0);
        }
      }

      depths.push(p.length);
      // Width as stored: the uids plus a one-byte separator between them.
      widths.push(p.reduce((n, u) => n + u.length, 0) + (p.length - 1));
      for (const u of p) flavours.set(flavour(u), (flavours.get(flavour(u)) ?? 0) + 1);
    }
  }

  depths.sort((a, b) => a - b);
  widths.sort((a, b) => a - b);

  console.log(`\n── ${label} ───────────────────────────────────────────────`);
  console.log(`docs ${docs.length} · items ${items} · revenue-bearing (non-divider) ${bearing}`);
  console.log(`empty paths ${emptyPaths} · path.at(-1) !== item.uid: ${selfInclusiveViolations}`);
  console.log(
    `depth   min ${depths[0]} · median ${pct(depths, 50)} · p99 ${pct(depths, 99)} · MAX ${
      depths[depths.length - 1]
    }`,
  );
  console.log(
    `width   median ${pct(widths, 50)}B · p99 ${pct(widths, 99)}B · MAX ${
      widths[widths.length - 1]
    }B  (u128 holds 16B)`,
  );
  console.log(`uid flavours ${JSON.stringify(Object.fromEntries([...flavours].sort()))}`);
  if (orderDividerIsExpected) {
    console.log(
      `docs with NO \`order\` divider: ${docsWithNoOrderDivider} of ${docs.length}` +
        ` (${((docsWithNoOrderDivider / docs.length) * 100).toFixed(2)}%)` +
        ` — carrying ${bearingUnderNoOrderDivider} revenue-bearing lines whose \`path[0]\` is NOT an order`,
    );
    console.log(
      `  of those, ${noDividerWithOrders.length} DO reference an order (a v1 path defect, fixable)` +
        ` and ${noDividerWithoutOrders.length} reference none (genuinely order-less; no v1 change reaches them)`,
    );
    console.log(
      `  those ${bearingUnderNoOrderDivider} order-less revenue lines total ` +
        `$${(orderlessRevenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` +
        ` — the population ADR-0036 would REFUSE if a posting must carry a causal order`,
    );
    console.log(
      `  ${orderlessFromCrms} of the ${docsWithNoOrderDivider} are LEGACY CRMS IMPORTS (carry crms_id)` +
        ` — a migration population, not a live business pattern, if it is all of them`,
    );
    if (noDividerWithOrders.length) {
      console.log(`  defect: ${noDividerWithOrders.slice(0, 10).join(", ")}`);
    }
    if (noDividerWithoutOrders.length) {
      console.log(`  order-less: ${noDividerWithoutOrders.slice(0, 10).join(", ")}`);
    }
  } else {
    console.log(
      `order dividers: not applicable — an order's own items never carry one` +
        ` (ORDER_ITEM_LEVELS is [destination, group]). Measured ${docsWithNoOrderDivider} of ${docs.length},` +
        ` which is the schema rather than a finding.`,
    );
  }

  const overU128 = widths.filter((w) => w > 16).length;
  console.log(
    `paths that do NOT fit a u128 verbatim: ${overU128} of ${widths.length} (${
      ((overU128 / widths.length) * 100).toFixed(2)
    }%)`,
  );
  return { items, bearing, docsWithNoOrderDivider, maxWidth: widths[widths.length - 1] };
};

const invoices = await pageAll<WithItems>("invoices", ["items", "query_by_orders", "crms_id"]);
const orders = await pageAll<WithItems>("orders", ["items"]);

const inv = report("invoices", invoices, true);
const ord = report("orders", orders, false);

// ── ADR-0036's precondition, measured rather than inherited ─────────────────────────────────────
//
// The economy needs an invoice item's path to be its order item's path prefixed by an order
// divider. `api-cloudrun#485` reported 10 lines where it is not — and was closed **NOT_PLANNED** on
// 2026-08-16, so the divergence was never repaired. ADR-0036 says that issue "must close first";
// an issue closed as won't-do satisfies the letter of that and none of the intent, which is exactly
// the false green this repo keeps paying for. So: measure the property, not the issue.
//
// The comparison is EXACT and does not rely on uid uniqueness (a uid repeats within one document —
// 18% of prod orders). For an invoice item at path P under an order divider, the tail P.slice(1)
// must appear verbatim as a path in the order P[0].
{
  const orderPaths = new Map<string, Set<string>>();
  const orderUids = new Map<string, Set<string>>();
  for (const o of orders) {
    orderPaths.set(o.__id, new Set((o.items ?? []).map((i) => (i.path ?? []).join("/"))));
    orderUids.set(o.__id, new Set((o.items ?? []).map((i) => String(i.uid))));
  }

  let comparable = 0;
  let aligned = 0;
  const misaligned: string[] = [];
  let invoiceOnly = 0; // the line exists on no order — added at invoice time, not a defect
  let orderNotPresent = 0;

  for (const d of invoices) {
    for (const i of d.items ?? []) {
      const p = i.path ?? [];
      if (p.length < 2) continue; // no order divider above it, or the divider itself
      if (STRUCTURAL.has(String(i.type))) continue;
      const orderUid = p[0];
      const paths = orderPaths.get(orderUid);
      if (!paths) {
        orderNotPresent++;
        continue;
      }
      comparable++;
      if (paths.has(p.slice(1).join("/"))) {
        aligned++;
        continue;
      }
      // ⚠️ Two very different populations share "the tail is not in the order", and reporting them
      // together would manufacture a defect out of ordinary invoicing. The discriminator is whether
      // the LINE exists on the order at all:
      //   · uid present, path differs  → api-cloudrun#485's defect: the same line, re-parented.
      //   · uid absent                 → an invoice-only line (a custom charge, a surcharge added at
      //                                   billing). It never had an order path to agree with.
      if (!orderUids.get(orderUid)?.has(String(i.uid))) {
        invoiceOnly++;
        continue;
      }
      if (misaligned.length < 12) misaligned.push(`${d.__id}:${p.slice(1).join("/")}`);
    }
  }

  const bad = comparable - aligned - invoiceOnly;
  console.log(`
── ADR-0036's shared-key precondition ──────────────────────────────────────────
comparable invoice lines (order divider present AND the order still exists): ${comparable}
aligned — tail appears verbatim in the order:                                ${aligned}
invoice-only — the line is on no order, so it never had a path to agree with: ${invoiceOnly}
MISALIGNED — same line uid, DIFFERENT path (api-cloudrun#485's defect):       ${bad} (${
    comparable ? ((bad / comparable) * 100).toFixed(3) : "0"
  }%)
invoice lines whose order divider names an order not in the corpus:          ${orderNotPresent}`);
  if (bad) console.log(`sample: ${misaligned.slice(0, 12).join("\n        ")}`);
}

console.log(`
── what this settles ───────────────────────────────────────────────────────────

1. \`path[0]\` is NOT reliably the causal order. ${inv.docsWithNoOrderDivider} of ${invoices.length}
   invoices carry no \`order\` divider at all, so ADR-0036's "one key may serve all three" holds
   only where an order divider exists and must state the exception rather than assume it away.
   ⚠️ Read this on INVOICES only. Orders structurally have no order divider and that is the schema.

2. A path does NOT fit any TigerBeetle reference field verbatim — max ${inv.maxWidth} bytes against
   a 16-byte u128. Storing line identity means storing a HASH or a minted surrogate, and that is an
   encoding decision the ADR does not currently make.

3. Reference space is therefore not "freed" by the economy: a hashed path can REPLACE
   \`source_document_ref\` (a path names the document and the row, so it strictly subsumes a document
   ref) but it cannot be free. The saving is one field, not two.

Total revenue-bearing lines across both collections: ${inv.bearing + ord.bearing} — the birthday
bound on a 64-bit hash at that population is ~1e-11, so a u64 hash is not the risk here. Opacity is:
TigerBeetle would hold a fingerprint that VERIFIES against the projection rather than a reference
that resolves without it.
`);
