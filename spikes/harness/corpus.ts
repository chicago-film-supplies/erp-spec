/**
 * Read-only paging of the PROD CFS corpus, for the measurement probes in this directory.
 *
 * ── Why this module exists (erp-spec#15) ────────────────────────────────────────────────────────
 *
 * `allocation-basis-probe.ts` used to talk to the prod API's `/mcp/cfs` endpoint with a shared
 * `CFS_API_TOKEN`. That route moved to OAuth — `requireMcpOAuth("mcp:cfs")`
 * (`code:2026-08-16:api-cloudrun@8ff32c4c:src/routes/mcp.ts`) — and the shared bearer is accepted
 * only while `MCP_LEGACY_BEARER_UNTIL` is set and in the future, which it is not. So the documented
 * invocation returned `{"error":"unauthorized"}` and every figure the probe had produced was back to
 * being believed rather than re-runnable.
 *
 * The replacement reads Firestore directly under **Application Default Credentials**, which is
 * already a workspace prerequisite (`gcloud auth application-default login`). Chosen over adding an
 * OAuth client-credentials flow to the probe (more moving parts for a read the probe could do
 * directly) and over re-setting `MCP_LEGACY_BEARER_UNTIL` (re-opening a path that was deliberately
 * closed). It also removes the shared-token dependency outright: there is no secret to recover.
 *
 * ── The read-only guarantee is STRUCTURAL, not asserted ─────────────────────────────────────────
 *
 * "READ-ONLY" in a header comment is a promise, and this repo's own rule is that a stated guarantee
 * nothing executes is not a guarantee. So the `Firestore` handle is created inside a closure and
 * never escapes it. The only capability this module exports is `pageAll`, which can issue a
 * projected `.get()` and nothing else — a caller cannot reach a write verb even by accident, because
 * it holds no reference to anything that has one.
 *
 * Two more fences, both in the `deno task` flags rather than here:
 *
 *   - `--allow-net` is narrowed to Google's auth and Firestore hosts, so the probe **cannot** reach
 *     `api.xero.com` or `api.current-rms.com`. Both are single-tenant and LIVE (workspace
 *     `CLAUDE.md` → External systems); a measurement harness that could touch them is a hazard
 *     regardless of what its code says today.
 *   - `--allow-write` is not granted at all.
 *
 * ── The project is hardcoded, deliberately ──────────────────────────────────────────────────────
 *
 * `cfs-3100` is prod, and there is no env knob to point this at `cfs-dev-3100`. Dev is a mirror
 * whose contents lag and whose test-owned documents are not real; a figure measured there and
 * reported as a corpus fact would be wrong in a way nothing downstream could detect. The corpus IS
 * prod, so the module says so once instead of trusting every caller to pass the right flag.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/** Prod. Not configurable — see the header. */
export const PROJECT = "cfs-3100";

/** A `pageAll` result: the document id alongside the projected fields. */
export type Doc<T> = T & { __id: string };

/**
 * Page a whole collection under ADC, projecting `fields`.
 *
 * `fields` is a Firestore field mask. It cannot reach INTO an array — `items` projects the whole
 * array of maps and `items.price` is not a thing — which is the one place this differs from the
 * `db_*` MCP tools' `items[].price.x` syntax. Projecting `items` whole costs bytes and nothing else;
 * the response is assembled locally and there is no 65 KB cap to respect here.
 */
export const pageAll: <T>(collection: string, fields: string[], pageSize?: number) => Promise<
  Doc<T>[]
> = await (() => {
  const app = initializeApp({ projectId: PROJECT });
  const db = getFirestore(app);
  // REST rather than gRPC — required for Deno compatibility, the same setting `api-cloudrun/src/db.ts`
  // applies for the same reason (`code:2026-08-16:api-cloudrun@8ff32c4c:src/db.ts`).
  db.settings({ preferRest: true });

  return async function pageAll<T>(
    collection: string,
    fields: string[],
    pageSize = 300,
  ): Promise<Doc<T>[]> {
    const out: Doc<T>[] = [];
    // deno-lint-ignore no-explicit-any
    let cursor: any = null;
    while (true) {
      let q = db.collection(collection).select(...fields).orderBy("__name__").limit(pageSize);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;
      for (const d of snap.docs) out.push({ ...(d.data() as T), __id: d.id });
      // A short page is the end. Firestore has no "more remain" flag on a cursor query, and the
      // recorded trap on the MCP side — `next_cursor` echoed on the final page — has the same shape:
      // trust the page length, never the cursor's presence.
      if (snap.size < pageSize) break;
      cursor = snap.docs[snap.docs.length - 1];
    }
    return out;
  };
})();

// ── shared shapes ────────────────────────────────────────────────────────────────────────────────

/** Structural dividers. Not revenue-bearing; `ITEM_TYPES` in `@cfs/core` holds the vocabulary. */
export const STRUCTURAL: ReadonlySet<string> = new Set(["order", "destination", "group"]);

/**
 * Revenue accounts that carry GOODS.
 *
 * The spec decides goods-vs-activity by the ACCOUNT when the product line is null — 4000 Rental
 * Income, 4200 Retail Sales Income, 4210 Replacement Sales Income
 * (`reporting/queries/product-line-pl.sql` `line_kind = 'goods'`, and
 * `inbox/2026-08-09-correction-the-unallocable-population-is-smaller-and-is-one-customer.md`, which
 * exists because a measurement and the rule it justified were classifying by different rules).
 *
 * ⚠️ **This is the one classification here that the spec does not hold as data.** Every other
 * classification below is READ from `ledger/dimensions.yaml` and `reporting/product-line-pl.yaml`
 * rather than copied, because a sixth hand-maintained copy of the taxonomy is exactly what left
 * `Transport` classified as goods by omission after OQ-034 made it an activity line. This set is
 * prose in two artifacts and data in neither, so it is copied here under protest and cross-checked
 * against the line's own `type` at measurement time — see `goodsDisagreements` in the probes.
 */
export const GOODS_ACCOUNTS: ReadonlySet<number> = new Set([4000, 4200, 4210]);

/** Item types that supply a thing, as opposed to performing one. The independent check on the above. */
export const GOODS_ITEM_TYPES: ReadonlySet<string> = new Set(["rental", "sale", "replacement"]);

export interface Line {
  uid: string;
  type: string;
  tracking_category: string | null;
  coa_revenue: number | null;
  quantity: number | null;
  path?: string[];
  price?: { subtotal_discounted_cents?: number | null };
}

export interface Invoice {
  uid: string;
  number: number;
  status: string;
  date?: string;
  items: Line[];
}

export interface Product {
  uid: string;
  tracking_category_name?: string | null;
}

/** Field mask for the invoice corpus. `items` cannot be projected field-by-field — see `pageAll`. */
export const INVOICE_FIELDS = ["uid", "number", "status", "date", "items"];

/**
 * Field mask for the product master.
 *
 * `tracking_category_name` is the product's own denorm of `uid_tracking_category`
 * (`code:2026-08-16:core@dff0761:src/schemas/product.ts`). It is the field the invoice line's
 * `tracking_category` is supposed to be derived FROM — the derivation that did not exist until
 * api-cloudrun#473 — so reading both is what makes the line's value checkable against something
 * other than itself.
 */
export const PRODUCT_FIELDS = ["uid", "tracking_category_name"];

/** Money as it is stored: an integer count of cents. Never a float, never a decimal string. */
export function usd(cents: number): string {
  const neg = cents < 0;
  const n = Math.abs(cents);
  const s = `${Math.floor(n / 100).toLocaleString("en-US")}.${String(n % 100).padStart(2, "0")}`;
  return neg ? `-$${s}` : `$${s}`;
}

/**
 * Percentage of a stated denominator. The denominator is a parameter because leaving it implicit is
 * how this corpus produced three base mismatches in three days
 * (`inbox/2026-08-10-correction-the-nobody-decided-share-is-quoted-against-two-different-bases.md`).
 */
export function pct(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${(100 * part / whole).toFixed(2)}%`;
}

// ── the classification, READ from the spec rather than copied into the probe ──────────────────────

const ROOT = new URL("../../", import.meta.url).pathname;

export type LineKind = "goods" | "activity";

export interface Classification {
  /** `product_line` values `ledger/dimensions.yaml` declares. */
  declared: Set<string>;
  /** `reporting/product-line-pl.yaml` → `line_kinds`. Gate 13 makes this total over `declared`. */
  kind: Map<string, LineKind>;
  /** Every activity line's pool status. Gate 13 makes this total over the activity lines. */
  poolStatus: Map<string, string>;
  /** The activity lines whose pool `status: allocated` — i.e. the ones that actually SPREAD. */
  spreads: Set<string>;
}

/**
 * Load the goods/activity split and the set of spreading pools from the spec.
 *
 * ⚠️ **This is the fix for the failure mode that made the last run wrong**, not a convenience. The
 * probe used to hold its own `ACTIVITY` set — `["Delivery", "Crew", "Trash & Cleanup", "Transaction
 * Fees"]` — a hand-maintained sixth copy of a taxonomy the spec already holds. When OQ-034 restored
 * `Transport` as an activity line on 2026-08-16 and `Transaction Fees` LEFT the dimension the same
 * day, the probe silently classified `Transport` as **goods by omission** and kept a value the
 * dimension no longer declares. Nothing could have gone red: `tools/validate.ts` does not read
 * `spikes/`, so the copy had no gate over it.
 *
 * This is the same shape as `view.ts` holding a fifth copy of the context registry — the erp-spec
 * `CLAUDE.md` records both, and the lesson it draws is the one applied here: a classification has
 * one home, and everything else reads it.
 *
 * ⚠️ `activity` does NOT imply `spreads`. Of five activity lines exactly one spreads (`Delivery`);
 * the other four are severable and keep their own margin (OQ-031, OQ-034). The two questions were
 * the same question when only `Delivery` had been decided, and conflating them now would spread
 * $144,975 of `Trash & Cleanup` onto goods that did not cause it.
 */
export async function loadClassification(): Promise<Classification> {
  const { parse } = await import("@std/yaml");

  const dims = parse(await Deno.readTextFile(`${ROOT}ledger/dimensions.yaml`)) as {
    dimensions?: { id?: string; values?: string[] }[];
  };
  const productLine = (dims.dimensions ?? []).find((d) => d.id === "product_line");
  if (!productLine?.values?.length) {
    throw new Error("ledger/dimensions.yaml declares no product_line values");
  }

  const pl = parse(await Deno.readTextFile(`${ROOT}reporting/product-line-pl.yaml`)) as {
    report?: {
      line_kinds?: Record<string, string>;
      pools?: { id?: string; product_line?: string; status?: string }[];
    };
  };
  const kinds = pl.report?.line_kinds ?? {};
  const pools = pl.report?.pools ?? [];

  const kind = new Map<string, LineKind>();
  for (const [v, k] of Object.entries(kinds)) {
    if (k !== "goods" && k !== "activity") {
      throw new Error(`reporting/product-line-pl.yaml: line_kinds["${v}"] = "${k}"`);
    }
    kind.set(v, k);
  }

  const poolStatus = new Map<string, string>();
  const spreads = new Set<string>();
  for (const p of pools) {
    if (!p.product_line) continue;
    poolStatus.set(p.product_line, p.status ?? "(none)");
    if (p.status === "allocated") spreads.add(p.product_line);
  }
  if (spreads.size === 0) {
    throw new Error("no pool carries `status: allocated` — there is nothing to allocate");
  }

  return { declared: new Set(productLine.values), kind, poolStatus, spreads };
}
