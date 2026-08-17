/**
 * Read the LIVE chart of accounts, so the spec chart's correspondence to it executes — erp-spec#8.
 *
 * ── The finding that made this the right shape ───────────────────────────────────────────────────
 *
 * erp-spec#8's fourth item asks for "the live→target GL account correspondence, which belongs here
 * and **exists nowhere**". Measured 2026-08-16, that second clause is wrong: the correspondence
 * already exists and it is `ledger/chart-of-accounts.yaml` itself, which carries `disposition:` and
 * `status_live:` on every entry. It is also **exact** — 139 spec entries against 134 live accounts
 * plus 5 minted, 0 live codes missing from the spec, 0 `status_live` disagreements, 0 name
 * disagreements.
 *
 * ⚠️ **So what was missing is not an artifact. It is an EXECUTION.** Nothing counted 139 against
 * 134 + 5, nothing compared `status_live` to the live `status`, and the chart's own header carried
 * "138 entries, four minted" — wrong in both halves, from the day 5150 was added until 2026-08-16,
 * because nothing counted those numbers either. A correspondence nothing can falsify is exactly the
 * class of claim this repo has paid for repeatedly.
 *
 * This probe writes the live half; gate 16 in `tools/validate.ts` checks the spec chart against the
 * written file. Neither side can pass by agreeing with itself — the same construction the path
 * inventory uses, and the same reason.
 *
 * ⚠️ **Read from CFS's own Firestore mirror, NOT from the Xero API.** `chart-of-accounts` is synced
 * into Firestore, and this repo does not call Xero at all: the tenant is single and live, and its
 * daily quota is a shared exhaustible resource (`CLAUDE.md` → _Accounting decisions_, and the
 * workspace `CLAUDE.md`). The mirror is where a claim about the live books comes from.
 *
 * ⚠️ **It carries codes, names, types and statuses — never balances.** No balance is mirrored into
 * Firestore, which is why ADR-0030's `$21,844.77` cannot be re-derived in this repo. That is a
 * stated limit rather than an oversight, and it is why this probe cannot size an account either.
 *
 *   cd spikes/harness && deno task chart          # print
 *   cd spikes/harness && deno task chart --write  # write migration/live-chart.measured.yaml
 */

import { pageAll, PROJECT } from "./corpus.ts";
// ⚠️ Reaches OUT of the harness on purpose, exactly as the inventory probe does: `tools/dates.ts` is
// dependency-free and owns the calendar-day reduction. Six copies of it existed once.
import { todayUTC } from "../../tools/dates.ts";

interface LiveAccount {
  code: number;
  name: string;
  type: string;
  class: string;
  status: string;
}

const rows = await pageAll<LiveAccount>("chart-of-accounts", [
  "code",
  "name",
  "type",
  "class",
  "status",
]);

const accounts = rows
  .map((r) => ({
    code: Number(r.code),
    name: String(r.name ?? ""),
    type: String(r.type ?? ""),
    class: String(r.class ?? ""),
    status: String(r.status ?? ""),
  }))
  .sort((a, b) => a.code - b.code);

console.log(`${PROJECT}: ${accounts.length} live accounts\n`);

// ⚠️ Duplicate codes would break the correspondence silently — a spec entry would match whichever
// row happened to be read last. Reported here rather than discovered by a confusing gate failure.
const seen = new Map<number, number>();
for (const a of accounts) seen.set(a.code, (seen.get(a.code) ?? 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1).map(([c]) => c);
if (dupes.length) console.log(`⚠️ DUPLICATE CODES in the live chart: ${dupes.join(", ")}\n`);

const byStatus: Record<string, number> = {};
const byType: Record<string, number> = {};
for (const a of accounts) {
  byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  byType[a.type] = (byType[a.type] ?? 0) + 1;
}
console.log("by status:", byStatus);
console.log("by type:  ", byType);

if (!Deno.args.includes("--write")) {
  console.log(`\nNothing written. Re-run with --write.`);
} else {
  const today = todayUTC();
  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const lines = [
    `# The live chart of accounts — MEASURED, not authored. Do not hand-edit.`,
    `#`,
    `# Refreshed by \`cd spikes/harness && deno task chart --write\` (read-only, ADC, prod Firestore).`,
    `# ⚠️ NOT a \`.generated.\` file: CI cannot rebuild it, because it needs prod credentials. Its`,
    `# freshness is a \`validate\` warning, never a build break.`,
    `#`,
    `# ⚠️ Read from CFS's Firestore MIRROR of Xero's chart, never from the Xero API — single tenant,`,
    `# live, shared daily quota. **No balances are mirrored**, so nothing here can size an account.`,
    `#`,
    `# gate 16 checks \`ledger/chart-of-accounts.yaml\` against this file: every live code adopted or`,
    `# explicitly disposed, every \`status_live\` true, every minted account genuinely absent.`,
    `measured_at_utc: ${q(today)}`,
    `project: ${q(PROJECT)}`,
    `accounts_total: ${accounts.length}`,
    `accounts:`,
  ];
  for (const a of accounts) {
    lines.push(`  - code: ${a.code}`);
    lines.push(`    name: ${q(a.name)}`);
    lines.push(`    type: ${q(a.type)}`);
    lines.push(`    class: ${q(a.class)}`);
    lines.push(`    status: ${q(a.status)}`);
  }
  await Deno.writeTextFile("../../migration/live-chart.measured.yaml", lines.join("\n") + "\n");
  console.log(`\nwrote migration/live-chart.measured.yaml`);
}
