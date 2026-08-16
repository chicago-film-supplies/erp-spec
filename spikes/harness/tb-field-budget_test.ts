/**
 * The spec's transfer field budget, checked against TigerBeetle's OWN type declaration.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────────────────────
 *
 * `research-drop/reference/tigerbeetle.md` asserted that `user_data_128/64/32` are **the only**
 * per-transfer reference fields. That is an EXHAUSTIVENESS claim about a third-party API, and
 * nothing in this repo could falsify it — so it was believed, and it propagated into erp-spec#3's
 * title ("three fields, four claimants"), HOT-013's "three slots, six live claimants", and
 * ADR-0026's "fifth claimant" aside. All four were wrong together, for as long as the note stood.
 *
 * `Transfer.code` is a fourth discretionary field. It was found by reading the cached upstream dump
 * by hand, twice — ADR-0035 found it and was rejected, then the 2026-08-16 correction note found it
 * again. **A fact that has to be re-discovered is not recorded anywhere that counts.**
 *
 * ── What this checks, and why it FAILS CLOSED ────────────────────────────────────────────────────
 *
 * The ground truth is `tigerbeetle-node`'s own `bindings.d.ts` — the library's declaration of what a
 * `Transfer` is, not a note about it. Every field on that type is either:
 *
 *   · **protocol-assigned** — TigerBeetle decides it (`id`, the account ids, `amount`, `ledger`,
 *     `flags`, `timestamp`, `pending_id`, `timeout`). Listed below, and that list is the ONLY
 *     hand-maintained thing here.
 *   · **discretionary** — anything else. Ours to spend, so the spec must account for it.
 *
 * A field the library grows that this test does not recognise lands in *discretionary* by default
 * and turns the test RED until someone assigns it or declares it unclaimed. That polarity is the
 * whole point: the previous failure was a new field being invisible, so the default must be
 * "unaccounted for", never "ignored".
 *
 * ⚠️ **NOT in CI, and that is a stated limit rather than an oversight.** CI runs
 * `deno task validate`, which has no npm dependencies by design; the ground truth here is an npm
 * package the repo does not vendor, so no repo-only gate can reach it. This is the harness's job —
 * the place where claims about third-party APIs get executed rather than believed.
 *
 *   cd spikes/harness && deno task tb-budget
 */

import { assert, assertEquals } from "jsr:@std/assert@^1.0.8";
import { parse } from "@std/yaml";

/**
 * Fields TigerBeetle assigns or interprets itself. Everything else on a `Transfer` is ours.
 *
 * This is the one hand-maintained list in this file, and it is safe to hand-maintain **because
 * getting it wrong fails closed**: forgetting an entry moves a protocol field into `discretionary`
 * and the test goes red asking for it to be assigned. The dangerous direction — a discretionary
 * field silently classified as protocol — requires someone to add a name here deliberately.
 */
const PROTOCOL_ASSIGNED = new Set([
  "id",
  "debit_account_id",
  "credit_account_id",
  "amount",
  "pending_id",
  "timeout",
  "ledger",
  "flags",
  "timestamp",
]);

const DTS =
  "node_modules/.deno/tigerbeetle-node@0.17.9/node_modules/tigerbeetle-node/dist/bindings.d.ts";
const BUDGET = "../../ledger/tigerbeetle-accounts.yaml";

/** The `Transfer` field names, read off the library's own declaration. */
const transferFields = (dts: string): string[] => {
  const m = dts.match(/export type Transfer = \{([\s\S]*?)\};/);
  if (!m) throw new Error("could not find `export type Transfer` — the library's shape changed");
  return [...m[1].matchAll(/^\s*(\w+)\s*:/gm)].map((x) => x[1]);
};

interface Budget {
  transfer_field_budget?: {
    assignment?: Record<string, string>;
    unassigned_claimants?: string[];
  };
}

Deno.test("every discretionary Transfer field is accounted for in the spec's budget", async () => {
  const fields = transferFields(await Deno.readTextFile(DTS));
  assert(fields.length > 0, "parsed no fields from the Transfer type");

  const spec = parse(await Deno.readTextFile(BUDGET)) as Budget;
  const assignment = spec.transfer_field_budget?.assignment ?? {};
  const assigned = Object.keys(assignment);

  const discretionary = fields.filter((f) => !PROTOCOL_ASSIGNED.has(f));

  // ⚠️ THE CHECK THAT WOULD HAVE CAUGHT THE MISCOUNT. `Transfer.code` existed in the library the
  // whole time; the spec's table named three fields and nothing compared the two.
  const unaccounted = discretionary.filter((f) => !assigned.includes(f));
  assertEquals(
    unaccounted,
    [],
    `TigerBeetle exposes discretionary Transfer field(s) the spec's budget does not name: ` +
      `${
        unaccounted.join(", ")
      }. Assign them in ledger/tigerbeetle-accounts.yaml, or record them ` +
      `as \`unclaimed\` — an unnamed field is one nobody knows they have.`,
  );

  // The converse: the spec must not budget a field the library does not have.
  const phantom = assigned.filter((f) => !fields.includes(f));
  assertEquals(
    phantom,
    [],
    `the spec's budget assigns field(s) that are not on a TigerBeetle Transfer: ${
      phantom.join(", ")
    }`,
  );
});

Deno.test("the budget's own arithmetic matches the field count it implies", async () => {
  const fields = transferFields(await Deno.readTextFile(DTS));
  const discretionary = fields.filter((f) => !PROTOCOL_ASSIGNED.has(f));

  // Pinned as a NUMBER, not as "confirmed" — a count that does not move is itself a finding, and
  // this is the number every downstream claim (erp-spec#3, HOT-013, ADR-0026) got wrong.
  assertEquals(
    discretionary.length,
    4,
    `discretionary Transfer fields moved from 4 to ${discretionary.length} ` +
      `(${discretionary.join(", ")}). Every claim about the budget needs re-reading.`,
  );
  assertEquals(discretionary.sort(), ["code", "user_data_128", "user_data_32", "user_data_64"]);
});
