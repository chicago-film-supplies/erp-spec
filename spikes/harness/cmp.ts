import { pageAll, usd } from "./corpus.ts";
// deno-lint-ignore no-explicit-any
const toD = (v: any) => {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  if (typeof v?.toDate === "function") return v.toDate().toISOString().slice(0, 10);
  if (typeof v?._seconds === "number") {
    return new Date(v._seconds * 1000).toISOString().slice(0, 10);
  }
  return null;
};
const lawful = (s: string) => s < "2025-01-01" ? 9 : s < "2026-01-01" ? 11 : 15;
const score = (rows: { start: string; got: number; base: number }[]) => {
  const t = new Map<string, { n: number; base: number }>();
  for (const r of rows) {
    const k = r.got === lawful(r.start)
      ? "matches rate at charge_start"
      : `MISMATCH wants ${lawful(r.start)}% carries ${r.got}%`;
    const c = t.get(k) ?? { n: 0, base: 0 };
    c.n++;
    c.base += r.base;
    t.set(k, c);
  }
  return [...t].sort((a, b) => b[1].base - a[1].base);
};
// deno-lint-ignore no-explicit-any
const orders = await pageAll<any>("orders", ["uid", "number", "destinations", "items"]);
const startOf = new Map<string, string>();
const oRows: { start: string; got: number; base: number }[] = [];
for (const o of orders) {
  const st = (o.destinations ?? []).map((d: any) => toD(d.dates?.charge_start)).filter(Boolean)
    .sort() as string[];
  if (!st.length) continue;
  startOf.set(String(o.number), st[0]);
  for (const it of o.items ?? []) {
    if (it.type !== "rental") continue;
    const b = it.price?.subtotal_discounted_cents ?? 0;
    if (!b) continue;
    const chi = (it.price?.taxes ?? []).filter((t: any) =>
      String(t.name).includes("Chicago Rental")
    );
    if (!chi.length) continue;
    oRows.push({
      start: st[0],
      got: chi.reduce((a: number, t: any) => a + (t.rate ?? 0), 0),
      base: b,
    });
  }
}
// deno-lint-ignore no-explicit-any
const invs = await pageAll<any>("invoices", [
  "number",
  "status",
  "date",
  "number_orders",
  "destinations",
  "items",
]);
const iRows: { start: string; got: number; base: number }[] = [];
for (const i of invs) {
  if (i.status === "void" || i.status === "draft") continue;
  const st = (i.destinations ?? []).map((d: any) => toD(d.dates?.charge_start)).filter(Boolean)
    .sort() as string[];
  const start = st[0] ??
    (i.number_orders ?? []).map((n: any) => startOf.get(String(n))).filter(Boolean).sort()[0];
  if (!start) continue;
  for (const it of i.items ?? []) {
    if (it.type !== "rental") continue;
    const b = it.price?.subtotal_discounted_cents ?? 0;
    if (!b) continue;
    const chi = (it.price?.taxes ?? []).filter((t: any) =>
      String(t.name).includes("Chicago Rental")
    );
    if (!chi.length) continue;
    iRows.push({ start, got: chi.reduce((a: number, t: any) => a + (t.rate ?? 0), 0), base: b });
  }
}
console.log(`ORDER rental lines   (${oRows.length}):`);
for (const [k, c] of score(oRows)) {
  console.log(`   ${k.padEnd(44)} ${String(c.n).padStart(5)} ${usd(c.base).padStart(14)}`);
}
console.log(`\nINVOICE rental lines (${iRows.length}):`);
for (const [k, c] of score(iRows)) {
  console.log(`   ${k.padEnd(44)} ${String(c.n).padStart(5)} ${usd(c.base).padStart(14)}`);
}
