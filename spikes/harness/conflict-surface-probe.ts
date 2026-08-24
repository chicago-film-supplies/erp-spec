/**
 * SPIKE-013 criterion 4 — the conflicts a same-field author/timestamp popover CANNOT arbitrate,
 * counted from the live corpus rather than imagined.
 *
 * ⚠️⚠️ **WHAT THIS PROBE IS A FIGURE OF, BEFORE ANY NUMBER IN IT IS USED.** Every count here is a
 * measurement of the **v1 migration corpus**. v1 is **UNFINISHED**, and this probe is not evidence
 * about what v2 must do. It was written once in the other direction and the owner caught it: an
 * earlier version reported "orders carry no author" as though it constrained v2's conflict UI.
 * **It does not.** `REQ-FUL-001` already requires v2 to record the acting crew member, and
 * `REQ-FUL-002` exists precisely to distinguish "no actor" from "an actor nobody wrote down".
 * ⇒ **v1's missing author is a v1 gap** (api-cloudrun#407 is the open issue to close it), not a
 * fact about the system being specified.
 *
 * ⭐ **What the probe IS for**, and it is worth more than the thing it was misread as: the conflict
 * classes a same-field author/timestamp popover cannot arbitrate are mostly **not actor-vs-actor**.
 * They are **actor vs STATE** — the invoice was paid while you were offline, the row your edit
 * addressed is gone, the rate moved, the field is derived, the posting is immutable. ⇒ **the second
 * party is the SYSTEM, not a second person.**
 *
 * ⚠️ **And that reframing is a DOMAIN argument, not a corpus one.** Invoices get paid, rows get
 * deleted, rates change, totals are derived and postings are immutable in **any** version — which
 * is exactly why the conclusion survives while the author finding did not. **The counts below size
 * the MIGRATION CORPUS for each class. They do not predict how often a v2 operator meets one.**
 *
 * ⛔ **Concurrency itself is unmeasurable here, twice over.** The corpus holds current state and no
 * edit history, so a collision leaves no trace; and prod has one operator account because v1 is a
 * single-operator app that is not finished. **Neither fact bounds v2**, whose actor model is a
 * requirement rather than an observation, and which is getting a public client app besides.
 *
 * Read-only prod Firestore under ADC. No writes, and `--allow-net` is narrowed so it cannot reach
 * Xero or CRMS.
 *
 *   deno task conflict-surface
 *
 * @module
 */

import { pageAll } from "./corpus.ts";

const DIVIDERS = new Set(["order", "destination", "group"]);
const pct = (n: number, d: number) => (d === 0 ? "n/a" : ((n / d) * 100).toFixed(1) + "%");
const pad = (n: number | string, w = 5) => String(n).padStart(w);

// ── the corpus ───────────────────────────────────────────────────────────────────────────────────

type ActorRef = { uid?: string; name?: string } | null;
type Item = {
  uid?: string;
  type?: string;
  path?: string[];
  quantity?: number | null;
  price?: Record<string, unknown> | null;
};
type Destination = {
  delivery?: { contact?: { uid?: string } | null } | null;
  collection?: { contact?: { uid?: string } | null } | null;
};
type Order = {
  uid: string;
  status?: string;
  created_at?: unknown;
  version?: number;
  items?: Item[];
  destinations?: Destination[];
  created_by?: ActorRef;
  totals?: Record<string, unknown> | null;
  bookings_breakdown?: Record<string, number> | null;
};
type Invoice = {
  uid: string;
  status?: string;
  version?: number;
  items?: Item[];
  created_by?: ActorRef;
  updated_by?: ActorRef;
};
type User = { uid: string; deleted_at?: unknown; roles?: string[] };
type Tax = { uid: string; name?: string; applied_from?: string; applied_to?: string };
type Product = { uid: string };
type Contact = { uid: string };
type Booking = { uid: string; uid_order?: string; breakdown?: Record<string, number> | null };
type DestinationDoc = {
  uid: string;
  contacts?: { uid?: string }[];
  organizations?: { uid?: string }[];
  products?: { uid?: string }[];
};
type Organization = { uid: string };

const [orders, invoices, users, taxes, products, contacts, bookings, destinationDocs, orgs] =
  await Promise.all([
    pageAll<Order>("orders", [
      "uid",
      "status",
      "created_at",
      "version",
      "items",
      "destinations",
      "created_by",
      "totals",
      "bookings_breakdown",
    ]),
    pageAll<Invoice>("invoices", ["uid", "status", "version", "items", "created_by", "updated_by"]),
    pageAll<User>("users", ["uid", "deleted_at", "roles"]),
    pageAll<Tax>("taxes", ["uid", "name", "applied_from", "applied_to"]),
    pageAll<Product>("products", ["uid"]),
    pageAll<Contact>("contacts", ["uid"]),
    pageAll<Booking>("bookings", ["uid", "uid_order", "breakdown"]),
    pageAll<DestinationDoc>("destinations", ["uid", "contacts", "organizations", "products"]),
    pageAll<Organization>("organizations", ["uid"]),
  ]);

console.log(`\n## SPIKE-013 criterion 4 — the conflict surface a popover cannot arbitrate\n`);
console.log(
  `corpus: ${orders.length} orders · ${invoices.length} invoices · ${bookings.length} bookings · ` +
    `${products.length} products · ${contacts.length} contacts · ${taxes.length} taxes · ` +
    `${destinationDocs.length} destinations · ${orgs.length} organizations`,
);
console.log(
  `\n⚠️ THIS IS A MEASUREMENT OF THE v1 MIGRATION CORPUS. v1 is UNFINISHED and is not the model.`,
);
console.log(
  `   Every figure sizes a class within HISTORY. None of them says what v2 must do, and none`,
);
console.log(
  `   predicts how often a v2 operator meets one. The corpus also holds no edit history, so`,
);
console.log(`   concurrency leaves no trace to count even within v1.\n`);

// ── class 0 — what the popover has to show, and whether it exists ────────────────────────────────

const liveUsers = users.filter((u) => !u.deleted_at);
const humanUids = new Set(liveUsers.map((u) => u.uid));

const invWithUpdatedBy = invoices.filter((i) => i.updated_by?.uid);
const invUpdatedByHuman = invWithUpdatedBy.filter((i) => humanUids.has(String(i.updated_by!.uid)));
const ordWithCreatedBy = orders.filter((o) => o.created_by?.uid);
const ordCreatedByHuman = ordWithCreatedBy.filter((o) => humanUids.has(String(o.created_by!.uid)));

const actorNames = new Map<string, number>();
for (const i of invoices) {
  for (const a of [i.created_by, i.updated_by]) {
    if (a?.name) actorNames.set(a.name, (actorNames.get(a.name) ?? 0) + 1);
  }
}
for (const o of orders) {
  if (o.created_by?.name) {
    actorNames.set(o.created_by.name, (actorNames.get(o.created_by.name) ?? 0) + 1);
  }
}

console.log(`### Class 0 — authorship IN THE MIGRATION CORPUS (a v1 fact, not a v2 constraint)\n`);
console.log(`  live operator accounts in prod:      ${pad(liveUsers.length)}`);
console.log(
  `  orders carrying created_by:          ${pad(ordWithCreatedBy.length)}  ${
    pct(ordWithCreatedBy.length, orders.length)
  }`,
);
console.log(`    ...of which a LIVE HUMAN account:  ${pad(ordCreatedByHuman.length)}`);
console.log(`  orders carrying updated_by:          ${pad(0)}  — the field does not exist in v1`);
console.log(
  `  invoices carrying updated_by:        ${pad(invWithUpdatedBy.length)}  ${
    pct(invWithUpdatedBy.length, invoices.length)
  }`,
);
console.log(`    ...of which a LIVE HUMAN account:  ${pad(invUpdatedByHuman.length)}`);
console.log(`\n  distinct ActorRef names across orders + invoices, by occurrences:`);
for (const [n, c] of [...actorNames].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`    ${pad(c, 6)}  ${n}${humanUids.has(n) ? "" : "   (not a live user account)"}`);
}
console.log(
  `\n  ⛔ THIS SAYS NOTHING ABOUT v2's CONFLICT UI, and an earlier version of this probe said it`,
);
console.log(
  `     did. v2 RECORDS AN ACTOR — REQ-FUL-001 requires it, and REQ-FUL-002 exists to keep`,
);
console.log(
  `     "no actor" distinguishable from "an actor nobody wrote down". v1's missing author is a`,
);
console.log(`     v1 gap with an open issue against it (api-cloudrun#407).`);
console.log(
  `\n  ⇒ what it IS: the authorship a MIGRATION inherits. Historical documents arrive carrying`,
);
console.log(
  `     what is shown above, so a v2 surface that displays an author has to render that`,
);
console.log(`     honestly for imported rows rather than invent one.`);

// ── class A — terminal state: refuse the merge, do not resolve it ────────────────────────────────

const ORDER_TERMINAL = new Set(["complete", "canceled"]);
const INVOICE_TERMINAL = new Set(["paid", "void"]);
const byStatus = <T extends { status?: string }>(docs: T[]) => {
  const m = new Map<string, number>();
  for (const d of docs) m.set(String(d.status), (m.get(String(d.status)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};
const ordTerminal = orders.filter((o) => ORDER_TERMINAL.has(String(o.status))).length;
const invTerminal = invoices.filter((i) => INVOICE_TERMINAL.has(String(i.status))).length;

console.log(`\n### Class A — terminal state: the merge must be REFUSED, not resolved\n`);
console.log(`  orders by status:`);
for (const [s, c] of byStatus(orders)) {
  console.log(`    ${pad(c, 6)}  ${s}${ORDER_TERMINAL.has(s) ? "   ← terminal" : ""}`);
}
console.log(`  invoices by status:`);
for (const [s, c] of byStatus(invoices)) {
  console.log(`    ${pad(c, 6)}  ${s}${INVOICE_TERMINAL.has(s) ? "   ← terminal" : ""}`);
}
console.log(
  `\n  ⇒ terminal population: ${ordTerminal} orders (${pct(ordTerminal, orders.length)}) + ` +
    `${invTerminal} invoices (${pct(invTerminal, invoices.length)})`,
);

// ── class B — derived fields: recompute, never merge ─────────────────────────────────────────────

/**
 * Derived leaves on an order/invoice line. Every one is a function of the line's own authored
 * inputs plus the document's; a field-wise merge that picks one side for any of them produces a
 * document whose totals disagree with its own items.
 *
 * ⚠️ The authored/derived split does NOT exist in the schemas — this list is written here because
 * there is nowhere to read it from, and that absence is the finding, not the list.
 */
const DERIVED_LINE = [
  "subtotal_cents",
  "subtotal_discounted_cents",
  "total_cents",
  "chargeable_days",
];
const AUTHORED_LINE = ["base_cents", "base_percent", "formula"];

let derivedLeaves = 0;
let authoredLeaves = 0;
let linesWithDerived = 0;
let totalLines = 0;
let docsWithDerivedTotals = 0;
let linesWithPath = 0;

const countLine = (it: Item) => {
  totalLines++;
  const p = (it.price ?? {}) as Record<string, unknown>;
  let d = 0;
  for (const k of DERIVED_LINE) if (p[k] !== undefined && p[k] !== null) d++;
  for (const k of AUTHORED_LINE) if (p[k] !== undefined && p[k] !== null) authoredLeaves++;
  // discount.amount_cents is derived from discount.rate; the taxes[] amounts likewise.
  const disc = (p.discount ?? {}) as Record<string, unknown>;
  if (disc.amount_cents !== undefined && disc.amount_cents !== null) d++;
  if (disc.rate !== undefined && disc.rate !== null) authoredLeaves++;
  for (const t of (p.taxes ?? []) as Record<string, unknown>[]) {
    if (t?.amount_cents !== undefined && t?.amount_cents !== null) d++;
  }
  derivedLeaves += d;
  if (d > 0) linesWithDerived++;
  // `path` is derived too — computeItemPaths is its single author — but it is present on very
  // nearly every line, so counting it alongside the money fields would drive the share to 100%
  // and hide whether the MONEY fields are the ones at risk. Counted separately for that reason.
  if (Array.isArray(it.path) && it.path.length > 0) linesWithPath++;
};

for (const o of orders) {
  for (const it of o.items ?? []) countLine(it);
  if (o.totals && Object.keys(o.totals).length > 0) docsWithDerivedTotals++;
}
for (const i of invoices) for (const it of i.items ?? []) countLine(it);

console.log(`\n### Class B — derived fields: RECOMPUTE, never merge field-wise\n`);
console.log(`  lines across orders + invoices:      ${pad(totalLines, 6)}`);
console.log(
  `  lines carrying ≥1 derived MONEY leaf:${pad(linesWithDerived, 6)}  ${
    pct(linesWithDerived, totalLines)
  }`,
);
console.log(
  `  lines carrying a derived path[]:     ${pad(linesWithPath, 6)}  ${
    pct(linesWithPath, totalLines)
  }`,
);
console.log(`  derived leaves counted:              ${pad(derivedLeaves, 6)}`);
console.log(`  authored price leaves counted:       ${pad(authoredLeaves, 6)}`);
console.log(
  `  orders carrying a derived totals{}:  ${pad(docsWithDerivedTotals, 6)}  ${
    pct(docsWithDerivedTotals, orders.length)
  }`,
);
console.log(
  `\n  ⚠️ the authored/derived split is not a field in any schema. This list is hand-written`,
);
console.log(`     because there is nowhere to read it from — that absence is the finding.`);

// ── class C — union, not choice: two operators ADD different things ──────────────────────────────

const destPerOrder = new Map<number, number>();
for (const o of orders) {
  const n = (o.destinations ?? []).length;
  destPerOrder.set(n, (destPerOrder.get(n) ?? 0) + 1);
}
const ordMultiDest = orders.filter((o) => (o.destinations ?? []).length > 1).length;
const ordWithItems = orders.filter((o) => (o.items ?? []).length > 0).length;
const itemsPerOrder = orders.map((o) => (o.items ?? []).length).filter((n) => n > 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

console.log(`\n### Class C — union, not choice: concurrent ADDS are not a field collision\n`);
console.log(`  destinations per order (count → orders):`);
for (const [k, v] of [...destPerOrder].sort((a, b) => a[0] - b[0])) {
  console.log(`    ${pad(k, 4)} → ${v}`);
}
console.log(
  `  orders with >1 destination:          ${pad(ordMultiDest)}  ${
    pct(ordMultiDest, orders.length)
  }`,
);
console.log(`  orders with items:                   ${pad(ordWithItems)}`);
console.log(
  `  items per order: median ${median(itemsPerOrder)}  max ${Math.max(...itemsPerOrder, 0)}`,
);
console.log(
  `\n  ⚠️ THE ORDER-DESTINATION ARM IS VACUOUS AND IS REPORTED AS SUCH: every order carries`,
);
console.log(
  `     exactly one destination today, so "two operators add different destinations" has no`,
);
console.log(
  `     population to count. That is a fact about the CRMS-shaped corpus, not about the design —`,
);
console.log(`     the schema is an array and the v2 invoice model bills several orders.`);
console.log(
  `\n  ⇒ the union case that IS populated is items[]: a set of up to 150 independently addable`,
);
console.log(
  `     rows per order, with merge-on-add (mergeStagedIntoOrder) already a real v1 operation.`,
);
console.log(`     A popover asking "yours or theirs" on that array discards one operator's adds.`);

// ── class D — the target is gone: a queued edit with nothing to address ──────────────────────────

const productUids = new Set(products.map((p) => p.uid));
const contactUids = new Set(contacts.map((c) => c.uid));
const orgUids = new Set(orgs.map((o) => o.uid));

/** Count refs and dangling refs for one (holder, field) family. */
const refArm = (
  label: string,
  rows: { refs: string[] }[],
  targets: Set<string>,
) => {
  let total = 0, dangling = 0, holdersAffected = 0;
  for (const r of rows) {
    let bad = 0;
    for (const uid of r.refs) {
      total++;
      if (!targets.has(uid)) bad++;
    }
    dangling += bad;
    if (bad > 0) holdersAffected++;
  }
  return { label, total, dangling, holdersAffected };
};

const clean = (xs: (string | undefined)[]) =>
  xs.filter((x): x is string => typeof x === "string" && x.length > 0);

const arms = [
  refArm(
    "destinations.contacts[] → contacts",
    destinationDocs.map((d) => ({ refs: clean((d.contacts ?? []).map((c) => c.uid)) })),
    contactUids,
  ),
  refArm(
    "destinations.organizations[] → orgs",
    destinationDocs.map((d) => ({ refs: clean((d.organizations ?? []).map((o) => o.uid)) })),
    orgUids,
  ),
  refArm(
    "destinations.products[] → products",
    destinationDocs.map((d) => ({ refs: clean((d.products ?? []).map((p) => p.uid)) })),
    productUids,
  ),
  refArm(
    "orders.items[].uid → products",
    orders.map((o) => ({
      refs: clean(
        (o.items ?? [])
          .filter((it) => !DIVIDERS.has(String(it.type)))
          .map((it) => String(it.uid ?? ""))
          .filter((u) => u && !u.startsWith("custom-")),
      ),
    })),
    productUids,
  ),
  refArm(
    "orders.destinations[].*.contact.uid",
    orders.map((o) => ({
      refs: clean(
        (o.destinations ?? []).flatMap((
          d,
        ) => [d.delivery?.contact?.uid, d.collection?.contact?.uid]),
      ),
    })),
    contactUids,
  ),
];

console.log(
  `\n### Class D — the target is GONE: replay against theirs can FAIL, not merely conflict\n`,
);
console.log(
  `  ${"reference family".padEnd(38)} ${"refs".padStart(6)} ${"dangling".padStart(9)}  holders`,
);
for (const a of arms) {
  const vac = a.total === 0 ? "   ⚠️ VACUOUS ARM — matched nothing" : "";
  console.log(
    `  ${a.label.padEnd(38)} ${pad(a.total, 6)} ${pad(a.dangling, 9)}  ${
      pad(a.holdersAffected, 5)
    }${vac}`,
  );
}
const vacuous = arms.filter((a) => a.total === 0);
const live = arms.filter((a) => a.total > 0);
const totalDangling = live.reduce((n, a) => n + a.dangling, 0);
console.log(
  `\n  ⚠️ ${vacuous.length} of ${arms.length} arms matched NOTHING and are reported as vacuous rather`,
);
console.log(
  `     than as clean — a check that reads green while matching nothing is indistinguishable`,
);
console.log(`     from one that passes, and this repo has been bitten by exactly that.`);
console.log(
  `\n  ⇒ across the ${live.length} arms that DID match: ${totalDangling} dangling ref(s) with nobody`,
);
console.log(
  `     offline. A queued edit addressed at a vanished row has no target to merge INTO — it`,
);
console.log(`     FAILS rather than conflicts, and the popover has no question to ask.`);

// ── class E — the rate moved underneath the queued edit ──────────────────────────────────────────

const windowed = taxes.filter((t) => t.applied_from || t.applied_to);
const closed = taxes.filter((t) => t.applied_to);
const byName = new Map<string, number>();
for (const t of taxes) byName.set(String(t.name), (byName.get(String(t.name)) ?? 0) + 1);
const superseded = [...byName.values()].filter((n) => n > 1).length;

console.log(`\n### Class E — the RATE moved: an offline edit reprices against a different world\n`);
console.log(`  tax definitions:                     ${pad(taxes.length)}`);
console.log(`  carrying a validity window:          ${pad(windowed.length)}`);
console.log(`  with applied_to set (superseded):    ${pad(closed.length)}`);
console.log(
  `  names appearing more than once:      ${pad(superseded)}  (a rate that was reissued)`,
);
console.log(
  `\n  ⇒ repricing is a function of the rate AS AT the edit; the popover shows a field value`,
);
console.log(`     and cannot show that the function behind it changed.`);

// ── class F — postings do not merge at all ───────────────────────────────────────────────────────

/**
 * ⚠️ **Split by cohort, because the un-split number is a figure OF THE CRMS IMPORT.** SPIKE-012
 * measured that 793 orders share `created_at` 2026-01-24 — the CRMS import day — and that the
 * import wrote TERMINAL counters only (`out` and `returned`, zero quoted/reserved/prepped). It
 * found 177 orders stored `complete` with 23,409 units still sitting in `out`. So a bare "units
 * out" total is dominated by rows that describe an import rather than a van.
 */
const IMPORT_DAY = "2026-01-24";
const dayOf = (v: unknown): string => {
  if (!v) return "";
  // Firestore Timestamps arrive as objects with toDate(); ISO strings arrive as strings.
  const d = typeof v === "object" && v !== null && "toDate" in v
    ? (v as { toDate: () => Date }).toDate()
    : new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const importOrders = new Set(
  orders.filter((o) => dayOf(o.created_at) === IMPORT_DAY).map((o) => o.uid),
);

let bookingsOut = 0, unitsOut = 0;
let bookingsOutImport = 0, unitsOutImport = 0;
for (const b of bookings) {
  const out = Number(b.breakdown?.out ?? 0);
  if (out <= 0) continue;
  bookingsOut++;
  unitsOut += out;
  if (importOrders.has(String(b.uid_order))) {
    bookingsOutImport++;
    unitsOutImport += out;
  }
}
const bookingsOutLive = bookingsOut - bookingsOutImport;
const unitsOutLive = unitsOut - unitsOutImport;

console.log(`\n### Class F — physical and ledger facts do not merge\n`);
console.log(
  `  orders in the CRMS import cohort:    ${pad(importOrders.size)}  (created ${IMPORT_DAY})`,
);
console.log(
  `  bookings with units OUT:             ${pad(bookingsOut)}  ${
    pct(bookingsOut, bookings.length)
  }`,
);
console.log(`    ...from the import cohort:         ${pad(bookingsOutImport)}`);
console.log(`    ...NATIVELY booked out:            ${pad(bookingsOutLive)}`);
console.log(`  units currently out:                 ${pad(unitsOut, 6)}`);
console.log(`    ...from the import cohort:         ${pad(unitsOutImport, 6)}`);
console.log(`    ...NATIVELY booked out:            ${pad(unitsOutLive, 6)}`);
console.log(
  `\n  ⛔ NEITHER LINE IS USABLE, AND THE "NATIVE" ONE IS THE TRAP. The un-split total is a figure`,
);
console.log(
  `     of the IMPORT — it wrote terminal counters only, so \`out\` sits on rows whose orders are`,
);
console.log(
  `     stored \`complete\` (SPIKE-012). But the residue is a figure of a DORMANT SUBSYSTEM: the`,
);
console.log(
  `     manager's check-in/check-out process is not live, and \`prepped\` stood at 11 rows`,
);
console.log(
  `     corpus-wide when SPIKE-012 measured it. ⇒ class F's KIND is a domain fact and stands;`,
);
console.log(`     its COUNT is withdrawn. Printed here only so the withdrawal is visible.`);
console.log(
  `\n  ⇒ "undo reverses a ledger entry with a new entry; it does not recall a van that already`,
);
console.log(
  `     left." A posting is immutable and is reversed by a further posting — never merged.`,
);

// ── class G — the actor-vs-actor classes, and why they have no number ────────────────────────────

console.log(`\n### ⛔ Class G — actor vs actor: NOT MEASURABLE HERE, AND NOT THE QUESTION\n`);
console.log(`  live operator accounts in prod:      ${pad(liveUsers.length)}`);
console.log(
  `\n  Two independent reasons this class has no number, and the second matters more:`,
);
console.log(
  `\n  1. v1 keeps current state and no edit history, so a collision leaves no trace even where`,
);
console.log(`     one occurred.`);
console.log(
  `  2. ⛔ v1 IS A SINGLE-OPERATOR APP THAT IS NOT FINISHED. Counting collisions in it would`,
);
console.log(
  `     measure the staffing of an unfinished system, which is not a fact about v2 at all.`,
);
console.log(
  `\n  ⇒ v2's actor model is a REQUIREMENT, not an observation — and a public client app is in`,
);
console.log(
  `     scope besides, so the actor count is set by the design rather than read off v1.`,
);
console.log(
  `\n  ⚠️ Do NOT read a low number here as "concurrent editing is rare" or as "the popover is`,
);
console.log(
  `     unnecessary". That is the absence-to-absence error, and this probe has already made it`,
);
console.log(`     once (see the header).`);

// ── the verdict ──────────────────────────────────────────────────────────────────────────────────

console.log(`\n### Verdict\n`);
console.log(`  Classes A–F are DOMAIN kinds, not corpus artifacts: invoices get paid, rows get`);
console.log(`  deleted, rates move, totals are derived and postings are immutable in any version.`);
console.log(`  ⇒ a same-field author/timestamp popover cannot arbitrate ANY of them, whatever the`);
console.log(`    actor model is — which is why this conclusion survives while Class 0's did not.`);
console.log(`  ⇒ the counts beside each class size the MIGRATION CORPUS. They are not a forecast,`);
console.log(`    and they are not a design input.\n`);
