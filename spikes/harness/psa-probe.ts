/**
 * PSA — where a production service agreement's money actually sits in the live books (erp-spec#35).
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────────────────────
 *
 * erp-spec#35 sizes PSA by `4130 PSA Income` at **$13,202.34** FY2025 and says the gross flow
 * through `2800`–`2803` is "unmeasured, and is the number that says how big this really is". A
 * survey cannot recommend a treatment without knowing which accounts the incumbent actually uses,
 * and **the chart of accounts cannot answer it**: the Firestore mirror carries no balances, and this
 * repo does not call the Xero API (single tenant, live, shared daily quota).
 *
 * What CAN answer it is the invoice corpus, where every line carries `coa_revenue` — the account the
 * line posts to. This probe reads it and nothing else.
 *
 * ⚠️ **It is a census of INVOICED lines, not of the general ledger.** A journal posted in Xero with
 * no CFS invoice behind it is invisible here, and PSA is exactly the shape where that can happen
 * (a client's payroll paid out through `Revolution Payroll`, which — measured 2026-08-17 — has zero
 * ACCPAY bills). So a zero on an account here means "no invoice line names it", never "no money
 * moved through it". Stated because the difference is the whole risk of this measurement.
 *
 * Read-only by construction: it holds `pageAll` from `corpus.ts` and no reference to anything with a
 * write verb. `deno task psa`.
 */
import { type Doc, pageAll, PROJECT, usd } from "./corpus.ts";

/** The five accounts erp-spec#35 names, plus the two a PSA line has been seen to use instead. */
const PSA_ACCOUNTS = new Set([2800, 2801, 2802, 2803, 4130]);

/**
 * A line whose NAME says production-service work. ⚠️ Deliberately separate from the account test:
 * the finding this probe exists to expose is that the two disagree, so a probe keyed on one of them
 * could not see it. Matched case-insensitively against the line name.
 *
 * ⚠️ **The first run of this pattern read `labor contract` and MISSED `Contract Labor`** — two more
 * invoices, `$56,570.00`, on two further accounts (4100 and 4120). **A count stated from one search
 * is a count of that search**, and this probe reproduced the footgun the repo recorded on
 * 2026-08-17 while being written to measure a different one. Both orders are matched now.
 *
 * ⚠️ **It also carried the British spelling as an alternative, and gate 17 refused the file.** The
 * gate is right twice over: the house spelling is `labor` (CLAUDE.md rule 9a), and the alternative
 * matched **nothing** — every line name in this corpus is American, because the corpus is CFS's own
 * invoices. An unexercised branch is a claim rather than a capability, so it is gone rather than
 * exempted. A real foreign spelling in the DATA would need the data quoted, not the pattern widened.
 */
const PSA_NAME = /\b(psa|production service|payroll|labor\s+contract|contract\s+labor)\b/i;

interface Line {
  uid?: string;
  type?: string;
  name?: string;
  coa_revenue?: number | null;
  price?: { total_cents?: number | null } | null;
}
interface Invoice {
  number?: number;
  date?: string;
  status?: string;
  organization?: { uid?: string; name?: string } | null;
  items?: Line[];
  totals?: { total_cents?: number | null } | null;
}

/** Calendar year off the stored Chicago-offset string, without constructing a Date. */
const yearOf = (iso?: string) => (iso ?? "").slice(0, 4) || "?";

const invoices = await pageAll<Invoice>("invoices", [
  "number",
  "date",
  "status",
  "organization",
  "items",
  "totals",
]);

// ── the whole revenue-account census, since we are paging anyway ────────────────────────────────
const byAccount = new Map<string, { lines: number; cents: number }>();
// ── PSA, by both tests, so their disagreement is visible ────────────────────────────────────────
interface Hit {
  number?: number;
  date?: string;
  org: string;
  name: string;
  account: number | null;
  cents: number;
  byAccount: boolean;
  byName: boolean;
}
const hits: Hit[] = [];

let lineCount = 0;
for (const inv of invoices as Doc<Invoice>[]) {
  for (const line of inv.items ?? []) {
    lineCount++;
    const cents = Number(line.price?.total_cents ?? 0);
    const acct = line.coa_revenue ?? null;
    const key = acct === null ? "(none — divider or structural row)" : String(acct);
    const cell = byAccount.get(key) ?? { lines: 0, cents: 0 };
    cell.lines++;
    cell.cents += cents;
    byAccount.set(key, cell);

    const hitAccount = acct !== null && PSA_ACCOUNTS.has(acct);
    const hitName = PSA_NAME.test(line.name ?? "");
    if (hitAccount || hitName) {
      hits.push({
        number: inv.number,
        date: inv.date,
        org: inv.organization?.name ?? "(none)",
        name: line.name ?? "",
        account: acct,
        cents,
        byAccount: hitAccount,
        byName: hitName,
      });
    }
  }
}

console.log(`project ${PROJECT} · ${invoices.length} invoices · ${lineCount} lines\n`);

console.log("── every account an invoice line names ─────────────────────────────");
for (
  const [acct, cell] of [...byAccount.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  )
) {
  console.log(
    `  ${acct.padEnd(34)} ${String(cell.lines).padStart(6)} lines  ${usd(cell.cents).padStart(16)}`,
  );
}

console.log("\n── PSA lines, by ACCOUNT and by NAME ───────────────────────────────");
hits.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
for (const h of hits) {
  const how = h.byAccount && h.byName ? "both " : h.byAccount ? "acct " : "name ";
  console.log(
    `  ${how} ${(h.date ?? "").slice(0, 10)}  inv ${String(h.number ?? "?").padStart(5)}  ` +
      `acct ${String(h.account ?? "—").padStart(4)}  ${usd(h.cents).padStart(14)}  ` +
      `${h.org.slice(0, 28).padEnd(28)} ${h.name.slice(0, 40)}`,
  );
}

const sum = (f: (h: Hit) => boolean) => hits.filter(f).reduce((n, h) => n + h.cents, 0);
console.log("\n── the disagreement, which is the finding ──────────────────────────");
console.log(
  `  matched on ACCOUNT only : ${hits.filter((h) => h.byAccount && !h.byName).length} lines  ${
    usd(sum((h) => h.byAccount && !h.byName))
  }`,
);
console.log(
  `  matched on NAME only    : ${hits.filter((h) => !h.byAccount && h.byName).length} lines  ${
    usd(sum((h) => !h.byAccount && h.byName))
  }`,
);
console.log(
  `  matched on BOTH         : ${hits.filter((h) => h.byAccount && h.byName).length} lines  ${
    usd(sum((h) => h.byAccount && h.byName))
  }`,
);

console.log("\n── PSA-named lines by the account they actually use ────────────────");
const nameHitsByAcct = new Map<string, { lines: number; cents: number }>();
for (const h of hits.filter((x) => x.byName || x.byAccount)) {
  const k = h.account === null ? "(none)" : String(h.account);
  const c = nameHitsByAcct.get(k) ?? { lines: 0, cents: 0 };
  c.lines++;
  c.cents += h.cents;
  nameHitsByAcct.set(k, c);
}
for (const [k, c] of [...nameHitsByAcct.entries()].sort()) {
  console.log(
    `  ${k.padStart(8)}  ${String(c.lines).padStart(4)} lines  ${usd(c.cents).padStart(14)}`,
  );
}

console.log("\n── by year ─────────────────────────────────────────────────────────");
const byYear = new Map<string, number>();
for (const h of hits) byYear.set(yearOf(h.date), (byYear.get(yearOf(h.date)) ?? 0) + h.cents);
for (const [y, c] of [...byYear.entries()].sort()) console.log(`  ${y}  ${usd(c).padStart(14)}`);

console.log("\n── by organization ─────────────────────────────────────────────────");
const byOrg = new Map<string, number>();
for (const h of hits) byOrg.set(h.org, (byOrg.get(h.org) ?? 0) + h.cents);
for (const [o, c] of [...byOrg.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${o.slice(0, 40).padEnd(40)} ${usd(c).padStart(14)}`);
}
