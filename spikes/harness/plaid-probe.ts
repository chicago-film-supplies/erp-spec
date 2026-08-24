/**
 * SPIKE-004 — what Plaid actually provides, against a real Plaid SANDBOX Item.
 *
 * ── Why sandbox and not the live Chase account ──────────────────────────────────────────────────
 *
 * The spike's `method:` says "connect the live Chase account read-only". The owner ruled on
 * 2026-08-23 that it closes against sandbox traffic instead, and placed `PLAID_CLIENT_ID` /
 * `PLAID_SECRET_SANDBOX` in `cfs-dev-3100`. That is the right trade for THIS spike's questions:
 * every one of them is about the SHAPE of the feed — the cursor model, the pending→posted
 * representation, what a `removed` entry carries — and the shape is Plaid's, not Chase's. What
 * sandbox cannot answer is anything about Chase specifically, and criterion 4's tie-out to a real
 * statement. Both are called out as unmet in the spike rather than approximated here.
 *
 * ── The fence ───────────────────────────────────────────────────────────────────────────────────
 *
 * `--allow-net=sandbox.plaid.com,secretmanager.googleapis.com,...` — the probe CANNOT reach
 * `production.plaid.com`. Same reasoning as `corpus.ts`: a harness that could touch a live tenant
 * is a hazard regardless of what its code says today. There is no env knob to point this at
 * production, deliberately.
 *
 * ── Every check asserts a VALUE ─────────────────────────────────────────────────────────────────
 *
 * A probe that only asserts "no throw" would pass against an empty feed. So each check below
 * reports a measured number and fails when the number contradicts the claim, not when the call
 * errors. Three checks are deliberately written to be able to report the OPPOSITE of what the docs
 * say, because the docs are what we are checking.
 */

// ── credentials ─────────────────────────────────────────────────────────────────────────────────

const secret = async (name: string): Promise<string> => {
  const env = Deno.env.get(name);
  if (env) return env.trim();
  const cmd = new Deno.Command("gcloud", {
    args: ["secrets", "versions", "access", "latest", `--secret=${name}`, "--project=cfs-dev-3100"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) {
    throw new Error(`gcloud could not read ${name}: ${new TextDecoder().decode(stderr).trim()}`);
  }
  return new TextDecoder().decode(stdout).trim();
};

const CLIENT_ID = await secret("PLAID_CLIENT_ID");
// ⚠️ The `_SANDBOX` suffix fights the house convention and renaming a secret is
// destroy-and-recreate. Flagged in the spike; the probe follows what exists.
const SECRET = await secret("PLAID_SECRET_SANDBOX");

// ── transport ───────────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE = "https://sandbox.plaid.com";
let calls = 0;

/**
 * ⚠️ `/transactions/refresh` is capped at **2 per minute PER ITEM** (120/hour, 2,880/day) — the
 * per-Item column of Plaid's rate-limit table, not the generous per-client one. The transition
 * this probe has to drive needs several refreshes on one Item, so a 429 is expected traffic here
 * rather than an error, and is waited out.
 */
// deno-lint-ignore no-explicit-any
const plaid = async (path: string, body: Record<string, unknown> = {}): Promise<any> => {
  for (let attempt = 0;; attempt++) {
    calls++;
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: CLIENT_ID, secret: SECRET, ...body }),
    });
    const json = await res.json();
    if (res.ok) return json;
    if (res.status === 429 && attempt < 4) {
      console.log(
        `        · 429 ${json.error_code} on ${path} — waiting 35s (attempt ${attempt + 1})`,
      );
      await sleep(35_000);
      continue;
    }
    throw new Error(
      `${path} ${res.status} ${json.error_code ?? "?"}: ${
        json.error_message ?? JSON.stringify(json)
      }`,
    );
  }
};

// ── reporting ───────────────────────────────────────────────────────────────────────────────────

type Verdict = "PASS" | "FAIL" | "N/A";
type Check = { id: string; claim: string; verdict: Verdict; measured: string };
const checks: Check[] = [];

const check = (id: string, claim: string, verdict: Verdict | boolean, measured: string) => {
  const v: Verdict = typeof verdict === "boolean" ? (verdict ? "PASS" : "FAIL") : verdict;
  checks.push({ id, claim, verdict: v, measured });
  console.log(`${v.padEnd(4)}  ${id.padEnd(5)} ${claim}\n        → ${measured}`);
};

/**
 * A check whose claim RANGES OVER a population, guarded by that population being non-empty.
 *
 * ⚠️ This exists because the probe's first run got it wrong in exactly the way this repo warns
 * about. The initial `/transactions/sync` came back with 0 transactions and `has_more: false`, and
 * five checks then reported PASS — "0/0 rows changed amount", "removed[] fields = {}", "overlap =
 * 0". Every one was true and none of them measured anything. A check that reads green while
 * matching nothing is indistinguishable from one that passes, so the population size is asserted
 * alongside the property rather than assumed by it.
 */
const checkOver = (id: string, claim: string, n: number, ok: boolean, measured: string) =>
  check(
    id,
    claim,
    n > 0 && ok,
    n > 0 ? measured : `EMPTY POPULATION (n=0) — nothing was measured. ${measured}`,
  );

const note = (s: string) => console.log(`        · ${s}`);
const head = (s: string) => console.log(`\n── ${s} ${"─".repeat(Math.max(0, 94 - s.length))}`);

// deno-lint-ignore no-explicit-any
type Txn = any;

/**
 * Decimal places as WRITTEN, not as computed.
 *
 * ⚠️ The obvious test — `Math.abs(v * 100 - Math.round(v * 100)) > ε` — cannot tell a genuine
 * third decimal from IEEE-754 noise, because `2835.8 * 100` is `283580.00000000006`. Ask the
 * decimal string instead. This mattered: the first version of this check reported 35 offenders and
 * could not say whether ANY of them were real.
 */
const decimals = (v: number) => {
  const s = String(v);
  if (s.includes("e") || s.includes("E")) return 99;
  return s.includes(".") ? s.split(".")[1].length : 0;
};

const cents = (amount: number) => Math.round(amount * 100);

// ── the Item ────────────────────────────────────────────────────────────────────────────────────

const INSTITUTION = "ins_109508"; // First Platypus Bank — non-OAuth, required by the dynamic user
const USER = "user_transactions_dynamic";

const link = async (label: string) => {
  const pub = await plaid("/sandbox/public_token/create", {
    institution_id: INSTITUTION,
    initial_products: ["transactions"],
    options: { override_username: USER, override_password: "pass_good" },
  });
  const ex = await plaid("/item/public_token/exchange", { public_token: pub.public_token });
  note(`${label}: item_id=${ex.item_id}`);
  return { access_token: ex.access_token as string, item_id: ex.item_id as string };
};

/** Drain /transactions/sync from `cursor` to has_more=false, restarting on a mid-pagination mutation. */
const sync = async (access_token: string, cursor: string | null) => {
  const added: Txn[] = [], modified: Txn[] = [], removed: Txn[] = [];
  let next = cursor, pages = 0;
  for (let attempt = 0;; attempt++) {
    try {
      for (;;) {
        const r = await plaid("/transactions/sync", {
          access_token,
          ...(next ? { cursor: next } : {}),
          count: 500,
        });
        pages++;
        added.push(...r.added);
        modified.push(...r.modified);
        removed.push(...r.removed);
        next = r.next_cursor;
        if (!r.has_more) return { added, modified, removed, cursor: next as string, pages };
      }
    } catch (e) {
      const msg = String(e);
      if (attempt < 20 && (msg.includes("PRODUCT_NOT_READY") || msg.includes("MUTATION_DURING"))) {
        next = cursor;
        added.length = modified.length = removed.length = 0;
        await sleep(2000);
        continue;
      }
      throw e;
    }
  }
};

/**
 * ⭐ THE FIRST SYNC RETURNS AN EMPTY, FULLY-DRAINED PAGE — the finding, not a bug in this probe.
 *
 * The documented loop is "call /transactions/sync, page until has_more is false". Followed
 * literally on a fresh Item it terminates immediately on `added: [], has_more: false`, which is
 * byte-identical to a feed with nothing new. Plaid does NOT say PRODUCT_NOT_READY here — the Item
 * is ready and empty; the seeded history lands moments later, announced in production by the
 * SYNC_UPDATES_AVAILABLE webhook. This probe has no webhook receiver, so it polls and reports the
 * wait.
 */
const syncUntilSeeded = async (access_token: string) => {
  const t = performance.now();
  let r = await sync(access_token, null);
  const firstCall = r.added.length;
  let polls = 0;
  while (r.added.length === 0 && polls < 40) {
    polls++;
    await sleep(1500);
    r = await sync(access_token, null);
  }
  return { ...r, firstCall, polls, waitMs: Math.round(performance.now() - t) };
};

const t0 = performance.now();

// ════════════════════════════════════════════════════════════════════════════════════════════════

head("Link and first sync");
const A = await link("item A");
const first = await syncUntilSeeded(A.access_token);
const accounts = (await plaid("/accounts/get", { access_token: A.access_token })).accounts;
const itemStatus = (await plaid("/item/get", { access_token: A.access_token })).status;

check(
  "C0",
  "the FIRST sync on a fresh Item is EMPTY and fully drained — not PRODUCT_NOT_READY",
  first.firstCall === 0 && first.added.length > 0,
  `first call: added=${first.firstCall}, has_more=false. History appeared after ${first.polls} poll(s) / ` +
    `${first.waitMs}ms, then added=${first.added.length}. An ingester that trusts the first page ` +
    `reconciles against an empty feed and cannot tell that from a quiet account.`,
);
note(
  `item.status.transactions.last_successful_update = ${
    itemStatus?.transactions?.last_successful_update ?? "null"
  }`,
);

const byId = new Map<string, Txn>(first.added.map((t: Txn) => [t.transaction_id, t]));
const pendingFirst = first.added.filter((t: Txn) => t.pending);
const dates = first.added.map((t: Txn) => t.date as string).sort();

// ── C2: backfill window ─────────────────────────────────────────────────────────────────────────

head("Exit criterion 2 — backfill window on first link");
const spanDays = Math.round((Date.parse(dates.at(-1)!) - Date.parse(dates[0]!)) / 86_400_000);
checkOver(
  "C2",
  "the first sync returns history, and its span is measured rather than assumed",
  first.added.length,
  true,
  `${first.added.length} transactions over ${first.pages} page(s), ${dates[0]} … ${
    dates.at(-1)
  } = ${spanDays} days`,
);
note(`accounts: ${accounts.map((a: Txn) => `${a.subtype}/${a.mask}`).join(", ")}`);
note(
  `⚠️ the DEPTH is a sandbox fact. In production it is what /link/token/create asked for via ` +
    `transactions.days_requested (default 90, max 730) — a parameter we choose, not a limit we discover.`,
);

// ── C1: what a transaction carries ──────────────────────────────────────────────────────────────

head("Exit criterion 1 — pending vs posted, and what a row carries");
checkOver(
  "C1a",
  "the feed carries BOTH states, so `pending` is a real discriminator and not always false",
  first.added.length,
  pendingFirst.length > 0 && pendingFirst.length < first.added.length,
  `${pendingFirst.length} pending, ${
    first.added.length - pendingFirst.length
  } posted, of ${first.added.length}`,
);

const authDiffers = first.added.filter((t: Txn) => t.authorized_date !== t.date).length;
const noAuth = first.added.filter((t: Txn) => t.authorized_date == null).length;
checkOver(
  "C1b",
  "`date` and `authorized_date` are DIFFERENT fields — when it posted vs when it happened",
  first.added.length,
  true,
  `${authDiffers}/${first.added.length} rows where authorized_date !== date; ${noAuth} carry no ` +
    `authorized_date at all (nullable — so the accounting date cannot always be the authorized one)`,
);

const subCent = first.added.filter((t: Txn) => decimals(t.amount) > 2);
checkOver(
  "C1c",
  "⚠️ amounts are typed `double` with NO scale, and sandbox emits genuine SUB-CENT values",
  first.added.length,
  subCent.length > 0,
  `${subCent.length}/${first.added.length} amounts have >2 decimal places, up to ${
    Math.max(...first.added.map((t: Txn) => decimals(t.amount)))
  } dp — e.g. [${subCent.slice(0, 4).map((t: Txn) => t.amount).join(", ")}]. ` +
    `Measured on the decimal string, not by float arithmetic.`,
);

const outflow = first.added.filter((t: Txn) => t.amount > 0).length;
checkOver(
  "C1d",
  "the sign convention is Plaid's, not accounting's — POSITIVE means money LEAVING the account",
  first.added.length,
  true,
  `${outflow} positive, ${first.added.length - outflow} negative of ${first.added.length}. ` +
    `Documented: "positive when money moves out of the account".`,
);

// ── C4a / C1h: balances ─────────────────────────────────────────────────────────────────────────

head("Exit criterion 4 — balances against the feed");
const bal0 = (await plaid("/accounts/balance/get", { access_token: A.access_token })).accounts;
const dep = bal0.find((a: Txn) => a.type === "depository");
const balFigures = bal0
  .flatMap((a: Txn) => [a.balances.current, a.balances.available, a.balances.limit])
  .filter((v: number | null) => v != null) as number[];
const nonCents = balFigures.filter((v) => decimals(v) > 2);
checkOver(
  "C1h",
  "⚠️ BALANCES carry sub-cent precision too — rounding one to cents is LOSSY",
  balFigures.length,
  nonCents.length > 0,
  `${nonCents.length}/${balFigures.length} balance figures exceed 2dp: [${nonCents.join(", ")}]`,
);

const depTxns = first.added.filter((t: Txn) => t.account_id === dep.account_id);
const sumPosted = depTxns.filter((t: Txn) => !t.pending).reduce(
  (s: number, t: Txn) => s + cents(t.amount),
  0,
);
const sumAll = depTxns.reduce((s: number, t: Txn) => s + cents(t.amount), 0);
note(
  `depository ${dep.mask}: current=${dep.balances.current} available=${dep.balances.available} ` +
    `(current − available = ${cents(dep.balances.current) - cents(dep.balances.available)}c)`,
);
checkOver(
  "C4a",
  "the balance is NOT a running total of the feed — no opening balance is on offer anywhere",
  depTxns.length,
  true,
  `${depTxns.length} rows on that account, Σposted=${sumPosted}c Σall=${sumAll}c against ` +
    `current=${cents(dep.balances.current)}c. Residual −Σposted = ${
      cents(dep.balances.current) + sumPosted
    }c. ` +
    `Neither /accounts/balance/get nor /transactions/sync carries an opening balance, so a tie-out ` +
    `is a comparison against a figure WE carry forward, never a derivation.`,
);

const rbPresent = first.added.filter((t: Txn) => "running_balance" in t).length;
const rbNonNull = first.added.filter((t: Txn) => t.running_balance != null).length;
checkOver(
  "C4c",
  "⚠️ `running_balance` EXISTS on the wire and is NULL in every row — present-but-empty",
  first.added.length,
  rbPresent > 0 && rbNonNull === 0,
  `${rbPresent}/${first.added.length} rows carry the KEY, ${rbNonNull} carry a VALUE. ` +
    `It appears only in example payloads on Plaid's own transactions reference — no entry in the ` +
    `response-field list (read from the primary page 2026-08-24). ⇒ a per-row opening balance MIGHT ` +
    `exist in production and is UNMEASURED; an existence check on this field passes while it is empty.`,
);
note(
  `⚠️ it is on POSTED rows only: ${
    first.added.filter((t: Txn) => !t.pending && "running_balance" in t).length
  } of ` +
    `${first.added.filter((t: Txn) => !t.pending).length} posted, ${
      first.added.filter((t: Txn) => t.pending && "running_balance" in t).length
    } of ` +
    `${pendingFirst.length} pending — so even populated it would not cover the pending window.`,
);

// ── C1e–C1g / C3a–C3b: drive a pending→posted transition ────────────────────────────────────────

head("Exit criteria 1 + 3 — driving a pending→posted transition");
let cursor = first.cursor;
const rounds: { added: number; modified: number; removed: number; noop: number }[] = [];
let transition: Awaited<ReturnType<typeof sync>> | null = null;
const store = new Map<string, Txn>(byId);

for (let round = 1; round <= 5 && !transition; round++) {
  if (round > 1) await sleep(32_000); // 2 refreshes per minute per Item
  await plaid("/transactions/refresh", { access_token: A.access_token });
  await sleep(5000);
  const d = await sync(A.access_token, cursor);
  const noop = d.modified.filter((t: Txn) => {
    const held = store.get(t.transaction_id);
    return held && JSON.stringify(held) === JSON.stringify(t);
  }).length;
  rounds.push({
    added: d.added.length,
    modified: d.modified.length,
    removed: d.removed.length,
    noop,
  });
  note(
    `refresh ${round}: added=${d.added.length} modified=${d.modified.length} ` +
      `(${noop} byte-identical to what we hold) removed=${d.removed.length}`,
  );
  if (d.removed.length > 0) {
    transition = d;
  } else {
    for (const t of [...d.added, ...d.modified]) store.set(t.transaction_id, t);
    cursor = d.cursor;
  }
}
if (!transition) throw new Error("no pending→posted transition after 5 refreshes");

const noopTotal = rounds.reduce((s, r) => s + r.noop, 0);
const modTotal = rounds.reduce((s, r) => s + r.modified, 0);
/**
 * ⚠️ **C1i is an EXISTENCE claim, and that is why it cannot be a plain assertion.**
 *
 * "A modified row CAN be byte-identical" is established by observing it once (SPIKE-004/M3:
 * 107 of 108) and is NOT refuted by a later run that happens not to see it. Whether the no-op batch
 * arrives before or after the transition is up to the sandbox, and this check went red on exactly
 * that — a run where the transition landed in the first refresh, so no modified rows were ever
 * emitted to inspect.
 *
 * ⇒ zero modified rows means UNMEASURABLE THIS RUN, not "refuted". A universal claim ("every
 * removed id was pending") is the opposite and stays a hard assertion — see C1e.
 * A check that goes red on the sandbox's scheduling teaches whoever re-runs it to ignore red.
 */
check(
  "C1i",
  "⚠️ a `modified` entry is NOT evidence that anything changed — it can be byte-identical",
  modTotal === 0 ? "N/A" : (noopTotal > 0 ? "PASS" : "FAIL"),
  modTotal === 0
    ? `UNMEASURABLE THIS RUN: 0 modified rows arrived across ${rounds.length} refresh(es), so there ` +
      `was nothing to compare. The claim is an EXISTENCE claim and rests on SPIKE-004/M3.`
    : `${noopTotal}/${modTotal} modified rows across ${rounds.length} refresh(es) were byte-identical to ` +
      `the copy we already held. Emitting a domain event per modified row would emit ${noopTotal} spurious ones.`,
);
checkOver(
  "C1j",
  "a /transactions/refresh does NOT guarantee a delta — an empty round is normal",
  rounds.length,
  true,
  `rounds: ${rounds.map((r) => `+${r.added}/~${r.modified}/−${r.removed}`).join("  ")}` +
    (rounds.some((r) => !r.added && !r.modified && !r.removed)
      ? " — one round was wholly empty"
      : ""),
);

const removedIds = new Set<string>(transition.removed.map((t: Txn) => t.transaction_id));
const removedWerePending = [...removedIds].filter((id) => store.get(id)?.pending === true).length;
checkOver(
  "C1e",
  "posting REMOVES the pending row — every removed id is one we held as pending",
  removedIds.size,
  removedWerePending === removedIds.size,
  `${removedIds.size} removed, ${removedWerePending} of them pending in our store, ` +
    `${[...removedIds].filter((id) => !store.has(id)).length} unknown to us`,
);

const successors = transition.added.filter((t: Txn) => t.pending_transaction_id != null);
const matched = successors.filter((t: Txn) => removedIds.has(t.pending_transaction_id));
checkOver(
  "C3a",
  "⭐ the pending id does NOT survive posting — the posted row is a NEW id, linked by pending_transaction_id",
  successors.length,
  matched.length === successors.length &&
    successors.every((t: Txn) => t.transaction_id !== t.pending_transaction_id),
  `${successors.length} added rows carry a pending_transaction_id; ${matched.length} name a row removed ` +
    `in the SAME delta; 0 reuse the pending id. Both id families share long prefixes ` +
    `(e.g. ${matched[0]?.pending_transaction_id?.slice(0, 23)}…) — never abbreviate one.`,
);
const orphans = [...removedIds].filter((id) =>
  !successors.some((t: Txn) => t.pending_transaction_id === id)
);
checkOver(
  "C3b",
  "removal alone does not mean 'posted' — a pending row can vanish with no successor",
  removedIds.size,
  true,
  `${orphans.length}/${removedIds.size} removed rows have NO successor in this delta. ` +
    `Plaid documents authorization holds vanishing outright, so 0 here is this run, not a guarantee.`,
);

const changed = matched.filter((t: Txn) =>
  cents(t.amount) !== cents(store.get(t.pending_transaction_id)!.amount)
);
checkOver(
  "C1f",
  "the posted amount MAY differ from the pending amount — the pending figure is never the fact",
  matched.length,
  true,
  `${changed.length}/${matched.length} matched successors changed amount in this run` +
    (changed.length
      ? `; e.g. ${cents(store.get(changed[0].pending_transaction_id)!.amount)}c → ${
        cents(changed[0].amount)
      }c`
      : ` — 0 is a SANDBOX fact, not a guarantee; Plaid documents the tip/hold case explicitly`),
);

const removedKeys = new Set<string>(transition.removed.flatMap((t: Txn) => Object.keys(t)));
checkOver(
  "C1g",
  "⭐ a `removed` entry carries an id AND NOTHING TO REVERSE — the amount is ours to have kept",
  transition.removed.length,
  !removedKeys.has("amount"),
  `removed[] fields = {${
    [...removedKeys].sort().join(", ")
  }}. Un-posting is impossible without our ` +
    `own copy of the row, so the boundary store is load-bearing, not a cache.`,
);

// ── C3c / C3d: cursor semantics ─────────────────────────────────────────────────────────────────

head("Exit criterion 3 — cursor semantics");
const replay = await sync(A.access_token, cursor);
const sameAdded = replay.added.length === transition.added.length &&
  replay.added.every((t: Txn, i: number) =>
    t.transaction_id === transition!.added[i].transaction_id
  );
checkOver(
  "C3c",
  "replaying the SAME cursor returns the SAME delta — a cursor is a position, not a receipt",
  transition.added.length + transition.removed.length,
  sameAdded && replay.removed.length === transition.removed.length,
  `replay: added=${replay.added.length} removed=${replay.removed.length} vs ` +
    `first pass added=${transition.added.length} removed=${transition.removed.length}; same order = ${sameAdded}. ` +
    `⇒ the ingester is free to crash mid-apply and re-read; ACKing is advancing the stored cursor.`,
);
const drained = await sync(A.access_token, transition.cursor);
check(
  "C3d",
  "the post-delta cursor is drained — advancing it is what acknowledges the batch",
  drained.added.length === 0 && drained.modified.length === 0 && drained.removed.length === 0,
  `added=${drained.added.length} modified=${drained.modified.length} removed=${drained.removed.length}`,
);
check(
  "C3h",
  "added and removed arrived in the SAME page here — but Plaid does not guarantee it",
  transition.pages === 1 ? "N/A" : "N/A",
  `this delta drained in ${transition.pages} page(s), so the split case did not occur and CANNOT be ` +
    `asserted from sandbox. Plaid states the pair "aren't guaranteed to be in the same page". ` +
    `⇒ a per-page apply that assumes pairing will double-count; apply per-DELTA, not per-page.`,
);

// ── C4b: does the balance move with the feed ────────────────────────────────────────────────────

head("Exit criterion 4 — does the balance move by what the feed says moved");
const bal1 = (await plaid("/accounts/balance/get", { access_token: A.access_token })).accounts;
const dep1 = bal1.find((a: Txn) => a.account_id === dep.account_id);
const balDelta = cents(dep1.balances.current) - cents(dep.balances.current);
const feedNet = transition.added.filter((t: Txn) => t.account_id === dep.account_id)
  .reduce((s: number, t: Txn) => s + cents(t.amount), 0);
check(
  "C4b",
  "whether the balance moves by the feed's net — the sandbox analogue of the statement tie-out",
  balDelta === 0 && feedNet !== 0 ? "N/A" : (balDelta === -feedNet ? "PASS" : "FAIL"),
  balDelta === 0 && feedNet !== 0
    ? `UNMEASURABLE IN SANDBOX: current moved ${balDelta}c while the feed moved ${feedNet}c ` +
      `(outflow-positive). The sandbox balance is a SEEDED CONSTANT, not a running total — so this ` +
      `criterion needs the production link and is reported unmet rather than approximated.`
    : `balance moved ${balDelta}c, feed net ${-feedNet}c, residual ${balDelta + feedNet}c`,
);

// ── C3e / C3f: re-link ──────────────────────────────────────────────────────────────────────────

head("Exit criterion 3 — id stability across a RE-LINK");
const B = await link("item B (same institution, same credentials, second link)");
const second = await syncUntilSeeded(B.access_token);
const idsA = new Set<string>(first.added.map((t: Txn) => t.transaction_id));
const idsB = new Set<string>(second.added.map((t: Txn) => t.transaction_id));
const overlap = [...idsB].filter((id) => idsA.has(id)).length;
const acctA = new Set<string>(accounts.map((a: Txn) => a.account_id));
const acctB = new Set<string>(
  (await plaid("/accounts/get", { access_token: B.access_token })).accounts.map((a: Txn) =>
    a.account_id
  ),
);
checkOver(
  "C3e",
  "⭐ transaction ids do NOT survive a re-link — a new Item mints new ids for the same money",
  Math.min(idsA.size, idsB.size),
  overlap === 0,
  `item A: ${idsA.size} ids, item B: ${idsB.size} ids, overlap = ${overlap}. ` +
    `⇒ reconciliation state keyed on transaction_id is destroyed by a re-link, and a re-link is a ` +
    `ROUTINE event (expired credentials, MFA re-consent).`,
);
checkOver(
  "C3f",
  "account ids do not survive a re-link either — the account key is per-Item, not per-account",
  acctA.size,
  [...acctB].filter((id) => acctA.has(id)).length === 0,
  `A=[${[...acctA].join(", ")}] B=[${[...acctB].join(", ")}] — 0 shared`,
);

// ── C5: are statements importable at all ───────────────────────────────────────────────────────

head("Beyond the exit criteria — can a statement be imported from Plaid at all");

/**
 * ⚠️ Statements is a SEPARATE PRODUCT and its window is fixed at LINK TIME. `initial_products`
 * must contain `statements` AND `options.statements` must carry `{start_date, end_date}` — omit the
 * object and the token create fails outright with INVALID_FIELD. Plaid allows up to 2 years.
 * ⇒ **the statement window is chosen when the Item is created, not when a reconciliation asks.**
 */
const STMT_WINDOW = { start_date: "2026-05-01", end_date: "2026-08-01" };
const noObj = await fetch(`${BASE}/sandbox/public_token/create`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    secret: SECRET,
    institution_id: INSTITUTION,
    initial_products: ["statements"],
    options: { override_username: USER, override_password: "pass_good" },
  }),
}).then((r) => r.json());
check(
  "C5a",
  "the statement WINDOW is fixed at link time — omitting it is a hard failure, not a default",
  noObj.error_code === "INVALID_FIELD",
  `initial_products=["statements"] with no options.statements → ${
    noObj.error_code ?? "accepted?!"
  }: ` +
    `${String(noObj.error_message ?? "").slice(0, 90)}`,
);

const sPub = await plaid("/sandbox/public_token/create", {
  institution_id: INSTITUTION,
  initial_products: ["statements"],
  options: { override_username: USER, override_password: "pass_good", statements: STMT_WINDOW },
});
const S = await plaid("/item/public_token/exchange", { public_token: sPub.public_token });
const listed = await plaid("/statements/list", { access_token: S.access_token });
const sDep = listed.accounts.find((a: Txn) => a.account_type === "depository");
const stKeys = new Set<string>(sDep.statements.flatMap((x: Txn) => Object.keys(x)));
checkOver(
  "C5b",
  "⭐ /statements/list is a STRUCTURED INDEX — enough for a GAP check with no PDF parsing at all",
  sDep.statements.length,
  !stKeys.has("closing_balance") && stKeys.has("statement_id"),
  `${sDep.statements.length} statements over a ${STMT_WINDOW.start_date}…${STMT_WINDOW.end_date} window, ` +
    `fields = {${
      [...stKeys].sort().join(", ")
    }}. ⇒ a recurring job can prove every MONTH is present ` +
    `from this alone — but there is NO balance and NO amount here, so a dup/amount check needs the PDF.`,
);

const dl = await fetch(`${BASE}/statements/download`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    secret: SECRET,
    access_token: S.access_token,
    statement_id: sDep.statements[0].statement_id,
  }),
});
const pdf = new Uint8Array(await dl.arrayBuffer());
const magic = new TextDecoder().decode(pdf.slice(0, 5));
check(
  "C5c",
  "a statement is a PDF and nothing else — the closing balance is INSIDE it, not beside it",
  magic === "%PDF-",
  `content-type=${dl.headers.get("content-type")}, ${pdf.length} bytes, magic="${magic}", ` +
    `plaid-content-hash=${String(dl.headers.get("plaid-content-hash")).slice(0, 16)}… ` +
    `⇒ any tie-out is a PDF-extraction job (precedent: tax-rules-refresh-probe.ts + pdftotext).`,
);
check(
  "C5d",
  "the SANDBOX statement is a static sample and does not reconcile with the Item's own feed",
  "N/A",
  `UNMEASURABLE IN SANDBOX: the PDF renders dates as literal "XX/XX", its Balance column repeats ` +
    `values, and its lines are unrelated to the ${first.added.length} transactions this Item served. ` +
    `⇒ the MECHANISM is proven end to end; the tie-out itself still needs the production link. ` +
    `A second, independent reason exit criterion 4 cannot close here.`,
);
await plaid("/item/remove", { access_token: S.access_token });

// ── cleanup ─────────────────────────────────────────────────────────────────────────────────────

head("Cleanup");
for (const [label, it] of [["A", A], ["B", B]] as const) {
  await plaid("/item/remove", { access_token: it.access_token });
  note(`item ${label} removed`);
}
let revoked = "the removed access_token was STILL ACCEPTED";
try {
  await plaid("/accounts/get", { access_token: A.access_token });
} catch (e) {
  revoked = String(e).slice(0, 90);
}
check(
  "C3g",
  "/item/remove revokes the access_token immediately",
  revoked.includes("ITEM_NOT_FOUND"),
  revoked,
);

// ── summary ─────────────────────────────────────────────────────────────────────────────────────

head("Summary");
const failed = checks.filter((c) => c.verdict === "FAIL");
const na = checks.filter((c) => c.verdict === "N/A");
console.log(
  `${checks.length} checks — ${
    checks.length - failed.length - na.length
  } pass, ${failed.length} fail, ` +
    `${na.length} unmeasurable in sandbox. ${calls} Plaid calls in ${
      Math.round((performance.now() - t0) / 1000)
    }s.`,
);
console.log(`\n| | check | claim | measured |`);
console.log(`| - | ----- | ----- | -------- |`);
for (const c of checks) {
  const icon = c.verdict === "PASS" ? "✅" : c.verdict === "FAIL" ? "❌" : "⚪";
  console.log(`| ${icon} | ${c.id} | ${c.claim} | ${c.measured} |`);
}
if (failed.length) Deno.exit(1);
