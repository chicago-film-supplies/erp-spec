/**
 * SPIKE-013 — can a three-way merge key `items[]`, and how often would the obvious key be wrong?
 *
 * The owner's proposed architecture is a three-way merge: replay the offline queue against the
 * frozen base AND against the fresh server document, diff the two results, and raise only genuine
 * conflicts in the client. That is strictly stronger than the version gate it replaces, because the
 * version gate throws away the base and so cannot tell "both sides changed this" from "one did".
 *
 * ⚠️ A three-way merge over a DOCUMENT needs a stable identity for every mergeable node. Scalars
 * have one (their path). `items[]` does not, and this probe measures how badly:
 *
 *   - `items[].uid` is the PRODUCT uid and REPEATS within one document, so it cannot key a row.
 *   - `items[].path` is the row identity WITHIN one document — but divider uids are reused BY NAME
 *     (`reuseMemberUids`), so a group rename churns every descendant path. Across two versions of a
 *     document, which is exactly what a merge compares, a path is not a stable identity either.
 *
 * ⇒ the merge key has to be `(uid, k-th occurrence)` — the same key the API's carry-forwards use
 * (`carryForwardTaxedAs`, `preserveStoredCoaRevenue`), and for the same reason. This probe measures
 * the population that forces it, so the choice rests on a number rather than on the rule.
 *
 * Read-only prod Firestore under ADC. No writes, and `--allow-net` is narrowed so it cannot reach
 * Xero or CRMS.
 *
 *   deno task merge-key
 *
 * @module
 */

import { pageAll } from "./corpus.ts";

type Item = { uid?: string; type?: string; path?: string[] };
type Order = { uid: string; version?: number; items?: Item[] };

const orders = await pageAll<Order>("orders", ["uid", "version", "items"]);

const DIVIDERS = new Set(["destination", "group"]);

let withItems = 0;
let totalItems = 0;
let totalLeaves = 0;
let ordersWithRepeatedUid = 0;
let leavesInRepeatGroups = 0;
let maxRepeat = 0;
let maxRepeatOrder = "";
let ordersWithRepeatedDividerUid = 0;
const versions: number[] = [];
const repeatHist = new Map<number, number>();

for (const o of orders) {
  const items = o.items ?? [];
  versions.push(o.version ?? 0);
  if (items.length === 0) continue;
  withItems++;
  totalItems += items.length;

  const leaves = items.filter((i) => !DIVIDERS.has(String(i.type)));
  const dividers = items.filter((i) => DIVIDERS.has(String(i.type)));
  totalLeaves += leaves.length;

  const counts = new Map<string, number>();
  for (const i of leaves) counts.set(String(i.uid), (counts.get(String(i.uid)) ?? 0) + 1);
  const repeated = [...counts.values()].filter((n) => n > 1);
  if (repeated.length > 0) {
    ordersWithRepeatedUid++;
    leavesInRepeatGroups += repeated.reduce((a, b) => a + b, 0);
    const m = Math.max(...repeated);
    repeatHist.set(m, (repeatHist.get(m) ?? 0) + 1);
    if (m > maxRepeat) {
      maxRepeat = m;
      maxRepeatOrder = o.uid;
    }
  }

  const dCounts = new Map<string, number>();
  for (const i of dividers) dCounts.set(String(i.uid), (dCounts.get(String(i.uid)) ?? 0) + 1);
  if ([...dCounts.values()].some((n) => n > 1)) ordersWithRepeatedDividerUid++;
}

const pct = (n: number, d: number) => ((n / d) * 100).toFixed(1) + "%";
const atLeast = (n: number) => versions.filter((v) => v >= n).length;

console.log(`\n## SPIKE-013 — merge key feasibility over items[]\n`);
console.log(`orders read: ${orders.length}  ·  with items: ${withItems}`);
console.log(`items: ${totalItems} total, ${totalLeaves} leaves (non-divider)\n`);

console.log(`### Version — how heavily edited a document is\n`);
for (const n of [2, 5, 10, 20, 50, 100]) {
  console.log(
    `  version >= ${String(n).padStart(3)}: ${String(atLeast(n)).padStart(4)}  ${
      pct(atLeast(n), orders.length)
    }`,
  );
}
console.log(`  max version: ${Math.max(...versions)}\n`);

console.log(`### ⭐ Can items[] be keyed by uid? \n`);
console.log(
  `  orders where a LEAF uid repeats:    ${ordersWithRepeatedUid}  ${
    pct(ordersWithRepeatedUid, withItems)
  } of orders with items`,
);
console.log(
  `  leaves sitting in a repeated group: ${leavesInRepeatGroups}  ${
    pct(leavesInRepeatGroups, totalLeaves)
  } of all leaves`,
);
console.log(`  worst repetition of one uid:        ${maxRepeat}x  (order ${maxRepeatOrder})`);
console.log(
  `  orders where a DIVIDER uid repeats: ${ordersWithRepeatedDividerUid}  ${
    pct(ordersWithRepeatedDividerUid, withItems)
  }`,
);
console.log(`\n  repetition histogram (max repeat per order → orders):`);
for (const [k, v] of [...repeatHist].sort((a, b) => a[0] - b[0])) {
  console.log(`    ${String(k).padStart(2)}x → ${v}`);
}

console.log(`\n### Verdict\n`);
if (ordersWithRepeatedUid === 0) {
  console.log(`  uid IS a legal merge key on this corpus — but see the header: it is not a row`);
  console.log(`  identity by construction, so this is a fact about today's data, not a guarantee.`);
} else {
  console.log(`  ⚠️ uid is NOT a legal merge key: it repeats in ${ordersWithRepeatedUid} orders`);
  console.log(
    `  (${pct(ordersWithRepeatedUid, withItems)}). A merge keyed on uid alone would pair the`,
  );
  console.log(`  wrong rows in those documents, silently — the same failure mode the API's`);
  console.log(`  carry-forwards avoid by keying on (uid, k-th occurrence).`);
}
