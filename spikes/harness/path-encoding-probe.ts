/**
 * SPIKE-013 / erp-spec#3 — can a path be reversibly encoded small enough for a TigerBeetle field?
 *
 * Owner, 2026-08-23: *"isnt there something that can take each path string token and turn it into
 * an 8 byte token that can be reversed?"*
 *
 * Two mechanisms get confused here, and only one of them is real:
 *
 *   - **Compression** is bounded by the pigeonhole principle. A value carrying N bits of entropy
 *     cannot be reversibly encoded in fewer than N bits, whatever the algorithm.
 *   - **Interning** is not compression. A dictionary assigns each DISTINCT value a small integer,
 *     and it is reversible because the information lives in the dictionary rather than in the token.
 *
 * So the question is really "how big is the dictionary, and does the encoded path fit?" — which is
 * measurable. This probe measures it over the live corpus.
 *
 *   deno task path-encoding
 *
 * @module
 */

import { pageAll } from "./corpus.ts";

type Item = { uid?: string; type?: string; path?: string[] };
type Doc = { uid: string; items?: Item[] };

const DIVIDERS = new Set(["destination", "group", "order"]);

const leafUids = new Set<string>();
const dividerUids = new Set<string>();
let maxDepth = 0;
let maxBytes = 0;
const depths: number[] = [];
const byteLens: number[] = [];
let items = 0;

for (const coll of ["orders", "invoices"]) {
  const docs = await pageAll<Doc>(coll, ["uid", "items"]);
  for (const d of docs) {
    for (const it of d.items ?? []) {
      items++;
      const p = it.path ?? [];
      if (p.length === 0) continue;
      depths.push(p.length);
      const bytes = new TextEncoder().encode(p.join("/")).length;
      byteLens.push(bytes);
      if (p.length > maxDepth) maxDepth = p.length;
      if (bytes > maxBytes) maxBytes = bytes;
      for (let i = 0; i < p.length; i++) {
        const isLast = i === p.length - 1;
        if (isLast && !DIVIDERS.has(String(it.type))) leafUids.add(p[i]);
        else dividerUids.add(p[i]);
      }
    }
  }
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const bits = (n: number) => Math.ceil(Math.log2(Math.max(n, 2)));

console.log(`\n## Path encoding — is 8 bytes reachable?\n`);
console.log(`items with a path: ${depths.length} of ${items}`);
console.log(`depth:  max ${maxDepth}, median ${median(depths)}`);
console.log(`bytes:  max ${maxBytes}, median ${median(byteLens)}\n`);

console.log(`### The dictionary, if you intern each SEGMENT\n`);
console.log(
  `  distinct leaf (product) uids:   ${leafUids.size}  → ${bits(leafUids.size)} bits each`,
);
console.log(
  `  distinct divider uids:          ${dividerUids.size}  → ${bits(dividerUids.size)} bits each`,
);
console.log(
  `  ⚠️ divider uids are PER-DOCUMENT uuids — this set grows by ~1 per divider ever created,`,
);
console.log(`     forever, and every historical posting needs it to resolve.\n`);

const segBits = Math.max(bits(leafUids.size), bits(dividerUids.size));
const worst = Math.ceil((segBits * maxDepth) / 8);
const med = Math.ceil((segBits * median(depths)) / 8);
console.log(`  uniform segment width: ${segBits} bits`);
console.log(
  `  encoded path at max depth ${maxDepth}: ${worst} bytes  → u64(8B)? ${
    worst <= 8 ? "YES" : "NO"
  }   u128(16B)? ${worst <= 16 ? "YES" : "NO"}`,
);
console.log(`  encoded path at median depth ${median(depths)}: ${med} bytes\n`);

console.log(`### Compression, for contrast\n`);
const uuidEntropy = 122;
console.log(`  a single v4 uuid segment carries ~${uuidEntropy} bits of entropy.`);
console.log(`  ⇒ reversibly encoding ONE such segment in 8 bytes (64 bits) is impossible —`);
console.log(`    not "hard", impossible, by the pigeonhole principle. Interning dodges it only`);
console.log(`    because the bits move into the dictionary.\n`);

console.log(`### ⭐ The collapse\n`);
console.log(`  Interning the WHOLE PATH to one integer is the same mechanism with a dictionary of`);
console.log(
  `  ${depths.length} entries and ONE lookup instead of ${maxDepth}. That integer IS the minted`,
);
console.log(`  surrogate — so the two proposals converge, and the only remaining question is what`);
console.log(`  the dictionary is keyed BY: the path string (mutable, breaks on reparent) or the`);
console.log(`  row itself (stable).`);
