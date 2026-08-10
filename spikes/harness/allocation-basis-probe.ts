/**
 * Allocation-basis probe — evidence for ADR-0031.
 *
 * ADR-0029 left the allocation basis for the official product-line P&L undecided. This measures
 * which bases the corpus can actually support and how far they disagree, so the ADR cites numbers
 * rather than a preference.
 *
 * READ-ONLY. It calls the prod CFS API's `db_*` MCP tools, which is the sanctioned verification
 * path (`CLAUDE.md` -> Verification etiquette). It writes nothing, and it never touches Xero or
 * CRMS.
 *
 * The token is read from the environment and is NOT in this repo:
 *
 *   CFS_API_TOKEN=... deno task allocation
 *
 * Recover it from the local MCP client config (`~/.claude.json`, server `cfs-api-prod`) or from
 * Secret Manager. Results as of 2026-08-09 are recorded in
 * `inbox/2026-08-09-allocation-bases-measured-only-goods-revenue-survives.md`.
 */

const URL_ = "https://api.chicagofilmsupplies.com/mcp/cfs";
const TOKEN = Deno.env.get("CFS_API_TOKEN");
if (!TOKEN) {
  console.error("CFS_API_TOKEN is not set. See the header comment.");
  Deno.exit(2);
}

let sessionId: string | null = null;
let rpcId = 0;

async function post(payload: Record<string, unknown>, notify = false): Promise<unknown> {
  if (!notify) payload.id = ++rpcId;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Authorization": `Bearer ${TOKEN}`,
    // Cloudflare 1010-bans some default client UAs on this zone — the same trap the workspace
    // CLAUDE.md records for jsr.io ("jsr.io 403s python's default UA").
    "User-Agent": "cfs-erp-spec-harness/1.0",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(URL_, { method: "POST", headers, body: JSON.stringify(payload) });
  const sid = res.headers.get("Mcp-Session-Id");
  if (sid) sessionId = sid;
  const raw = await res.text();
  if (!raw.trim()) return null;
  // The endpoint may answer as SSE framing rather than a bare JSON body.
  if (raw.trimStart().startsWith("event:") || raw.trimStart().startsWith("data:")) {
    let out: unknown = null;
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) out = JSON.parse(line.slice(5).trim());
    }
    return out;
  }
  return JSON.parse(raw);
}

async function init() {
  await post({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "erp-spec-harness", version: "1.0" },
    },
  });
  await post({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }, true);
}

// deno-lint-ignore no-explicit-any
async function callTool(name: string, args: Record<string, string>): Promise<any> {
  const r = await post({ jsonrpc: "2.0", method: "tools/call", params: { name, arguments: args } });
  // deno-lint-ignore no-explicit-any
  const res = r as any;
  if (!res?.result) throw new Error(JSON.stringify(r).slice(0, 500));
  const text = (res.result.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return JSON.parse(text);
}

interface Line {
  uid: string;
  type: string;
  tracking_category: string | null;
  quantity: number | null;
  path?: string[];
  price?: { subtotal_discounted_cents?: number | null };
}
interface Invoice {
  uid: string;
  number: number;
  status: string;
  items: Line[];
}

/** `next_cursor` is echoed on the final page too, so a short page is the only end signal. */
async function pageInvoices(select: string, limit = 200): Promise<Invoice[]> {
  const out: Invoice[] = [];
  let cursor: string | undefined;
  while (true) {
    const args: Record<string, string> = { select, limit: String(limit) };
    if (cursor) args.start_after = cursor;
    const res = await callTool("db_invoices_query", args);
    const docs = res.docs ?? [];
    for (const d of docs) out.push(d.data ?? d);
    cursor = res.next_cursor;
    if (!cursor || docs.length < limit) break;
  }
  return out;
}

const STRUCTURAL = new Set(["order", "destination", "group"]);
/** Revenue that describes something DONE, not something supplied. */
const ACTIVITY = new Set(["Delivery", "Crew", "Trash & Cleanup", "Transaction Fees"]);

type Basis = "revenue" | "lines" | "quantity";
const BASES: Basis[] = ["revenue", "lines", "quantity"];

interface Group {
  number: number;
  status: string;
  delivery: number;
  goods: { line: string; cents: number; qty: number }[];
  goodsCents: number;
}

/**
 * Spread `pool` over `weights` by largest remainder, so the shares sum EXACTLY to the pool.
 * Integer minor units throughout — no float ever holds a money value (workspace CLAUDE.md).
 * Returns null when the basis has no positive denominator: that is a real population here, not an
 * error, and the caller must account for it rather than silently drop it.
 */
function spread(pool: number, weights: number[]): number[] | null {
  const denom = weights.reduce((a, b) => a + b, 0);
  if (denom <= 0) return null;
  const raw = weights.map((w) => (pool * w) / denom);
  const shares = raw.map((r) => Math.floor(r));
  let residual = pool - shares.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (residual-- <= 0) break;
    shares[i] += 1;
  }
  return shares;
}

await init();

const SELECT = "uid,number,status,items[].type,items[].tracking_category,items[].quantity," +
  "items[].price.subtotal_discounted_cents,items[].path";
const invoices = await pageInvoices(SELECT);
console.log(`invoices paged: ${invoices.length}`);

const byStatus = new Map<string, number>();
for (const i of invoices) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
console.log("by status:", Object.fromEntries(byStatus));

// ── bucket every revenue line under (invoice, causal order) ──────────────────────────────────────
const groups = new Map<string, Group>();
let lineTotal = 0, revenueLines = 0;
for (const inv of invoices) {
  const items = inv.items ?? [];
  const typeByUid = new Map(items.map((i) => [i.uid, i.type]));
  for (const it of items) {
    lineTotal++;
    if (STRUCTURAL.has(it.type)) continue;
    revenueLines++;
    const orderUid = (it.path ?? []).find((u) => typeByUid.get(u) === "order") ?? "-";
    const key = `${inv.uid}::${orderUid}`;
    let g = groups.get(key);
    if (!g) {
      g = { number: inv.number, status: inv.status, delivery: 0, goods: [], goodsCents: 0 };
      groups.set(key, g);
    }
    const tc = it.tracking_category;
    const cents = it.price?.subtotal_discounted_cents ?? 0;
    if (tc === "Delivery") g.delivery += cents;
    else if (tc !== null && !ACTIVITY.has(tc)) {
      g.goods.push({ line: tc, cents, qty: it.quantity ?? 0 });
      g.goodsCents += cents;
    }
  }
}
console.log(`lines: ${lineTotal} total, ${revenueLines} revenue-bearing`);
console.log(`(invoice, order) groups: ${groups.size}`);

const withDelivery = [...groups.values()].filter((g) => g.delivery !== 0);
const totalDelivery = withDelivery.reduce((n, g) => n + g.delivery, 0);
const noGoods = withDelivery.filter((g) => g.goods.length === 0);
console.log(
  `\ngroups carrying Delivery: ${withDelivery.length}, ` +
    `$${(totalDelivery / 100).toLocaleString()}`,
);
console.log(
  `  DEGENERATE — no goods line at all: ${noGoods.length} groups, ` +
    `$${(noGoods.reduce((n, g) => n + g.delivery, 0) / 100).toLocaleString()}`,
);

// ── allocate under each basis ────────────────────────────────────────────────────────────────────
const alloc: Record<Basis, Map<string, number>> = {
  revenue: new Map(),
  lines: new Map(),
  quantity: new Map(),
};
const unallocable: Record<Basis, number> = { revenue: 0, lines: 0, quantity: 0 };

for (const g of withDelivery) {
  for (const basis of BASES) {
    const weights = g.goods.map((x) =>
      basis === "revenue" ? x.cents : basis === "lines" ? 1 : x.qty
    );
    const shares = spread(g.delivery, weights);
    if (!shares) {
      unallocable[basis] += g.delivery;
      continue;
    }
    g.goods.forEach((x, i) => {
      alloc[basis].set(x.line, (alloc[basis].get(x.line) ?? 0) + shares[i]);
    });
  }
}

console.log("\nunallocable delivery revenue (no positive denominator):");
for (const b of BASES) {
  console.log(
    `  ${b.padEnd(9)}: $${(unallocable[b] / 100).toLocaleString()} ` +
      `(${(100 * unallocable[b] / totalDelivery).toFixed(1)}%)`,
  );
}

const own = new Map<string, number>();
const ownQty = new Map<string, number>();
for (const g of groups.values()) {
  for (const x of g.goods) {
    own.set(x.line, (own.get(x.line) ?? 0) + x.cents);
    ownQty.set(x.line, (ownQty.get(x.line) ?? 0) + x.qty);
  }
}

console.log("\n=== allocated delivery revenue per product line, by basis ===");
console.log(
  "product line".padEnd(28) + "own rev".padStart(12) + "by revenue".padStart(13) +
    "by lines".padStart(12) + "by qty".padStart(12) + "units/$100".padStart(12),
);
for (const line of [...own.keys()].sort((a, b) => own.get(b)! - own.get(a)!)) {
  const rev = own.get(line)! / 100;
  const ratio = rev > 0 ? ownQty.get(line)! / (rev / 100) : NaN;
  console.log(
    line.padEnd(28) + rev.toFixed(0).padStart(12) +
      ((alloc.revenue.get(line) ?? 0) / 100).toFixed(0).padStart(13) +
      ((alloc.lines.get(line) ?? 0) / 100).toFixed(0).padStart(12) +
      ((alloc.quantity.get(line) ?? 0) / 100).toFixed(0).padStart(12) +
      ratio.toFixed(2).padStart(12),
  );
}

console.log("\n=== divergence between bases (sum of absolute per-line differences) ===");
for (let i = 0; i < BASES.length; i++) {
  for (let j = i + 1; j < BASES.length; j++) {
    const a = alloc[BASES[i]], b = alloc[BASES[j]];
    let d = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
    }
    console.log(
      `  ${BASES[i].padEnd(9)} vs ${BASES[j].padEnd(9)}: $${(d / 100).toLocaleString()} = ` +
        `${(100 * d / totalDelivery).toFixed(1)}% of delivery revenue reassigned`,
    );
  }
}

// ── is the pool bigger than its own base? ────────────────────────────────────────────────────────
const allocable = withDelivery.filter((g) => g.goodsCents > 0);
const over = allocable.filter((g) => g.delivery > g.goodsCents);
const ratios = allocable.map((g) => g.delivery / g.goodsCents).sort((a, b) => a - b);
console.log(
  `\ngroups where delivery revenue EXCEEDS the goods it spreads over: ` +
    `${over.length} of ${allocable.length}, holding ` +
    `$${(over.reduce((n, g) => n + g.delivery, 0) / 100).toLocaleString()} ` +
    `(${(100 * over.reduce((n, g) => n + g.delivery, 0) / totalDelivery).toFixed(1)}%)`,
);
console.log(
  `  delivery/goods ratio: median ${ratios[Math.floor(ratios.length / 2)].toFixed(3)}, ` +
    `p90 ${ratios[Math.floor(0.9 * ratios.length)].toFixed(3)}, ` +
    `max ${ratios[ratios.length - 1].toFixed(2)}`,
);
