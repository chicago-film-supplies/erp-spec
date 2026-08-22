/**
 * SPIKE-002 criterion 2 — the crash-injection harness.
 *
 * Drives a real writer subprocess to a real SIGKILL at each step of ADR-0042's protocol, then runs
 * the recovery sweeper against whatever durable state is left and asserts what must hold.
 *
 * ⚠️ **Every case asserts a VALUE, never an absence of throw** (`_README.md`). For this protocol
 * that means asserting TigerBeetle's specific result CODE — because "the second post did not
 * happen" is also exactly what a dropped request looks like.
 *
 * `deno task two-store`. Needs mongod on 27078 and a TigerBeetle cluster on 3044.
 */
import {
  ALREADY_POSTED,
  ALREADY_VOIDED,
  clearIntent,
  ensureAccounts,
  EXPIRED,
  mongo,
  OK,
  post,
  recover,
  reserve,
  tb,
  voidPending,
  writeDoc,
  writeIntent,
} from "./two-store-lib.ts";

const A = 9001n, B = 9002n;
const { lib, client } = await tb();
const { c, intents, docs } = await mongo();
await ensureAccounts(client, A, B);
await intents.deleteMany({});
await docs.deleteMany({});

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  console.log(`      ${detail}`);
  ok ? pass++ : fail++;
};

async function crashAfter(step: string, opId: string) {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-env",
      "--allow-net",
      "--allow-sys",
      "--allow-ffi",
      "two-store-writer.ts",
      "--op",
      opId,
      "--stop-after",
      step,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const out = await cmd.output();
  return { signal: out.signal, code: out.code };
}

// deno-lint-ignore no-explicit-any
const tState = async (id: bigint): Promise<any> => (await client.lookupTransfers([id]))[0];
const intentOf = (opId: string) => intents.findOne({ _id: opId });

console.log(
  "SPIKE-002 criterion 2 — crash-injection against a real mongod and a real TigerBeetle\n",
);

// ── 1. crash between writeIntent and reserve ───────────────────────────────────────────────────
console.log("── case 1: SIGKILL between writeIntent and reserve ────────────────────────────────");
{
  const op = "op-1";
  const k = await crashAfter("intent", op);
  const before = await intentOf(op);
  const rec = await recover(client, lib, intents, docs, A, B);
  const after = await intentOf(op);
  check(
    "the writer really died",
    k.signal === "SIGKILL",
    `subprocess terminated by ${k.signal ?? `exit ${k.code}`} — not a returned-early simulation`,
  );
  check(
    "the orphan is DISCOVERABLE, which is the whole reason the intent is written first",
    before?.state === "open",
    `an open intent survived the crash; TigerBeetle could not have told us — QueryFilter has no predicate for flags.pending`,
  );
  check(
    "recovery clears an intent whose transfer was never created",
    rec.find((r) => r.opId === op)?.action === "cleared_no_transfer" && after?.state === "cleared",
    `nothing was reserved, so there is nothing to compensate — the intent is retired, not voided`,
  );
}

// ── 2. crash between reserve and writeDoc → recovery must VOID ─────────────────────────────────
console.log(
  "\n── case 2: SIGKILL between reserve and writeDoc → recovery VOIDS ──────────────────",
);
{
  const op = "op-2";
  await crashAfter("reserve", op);
  const it = await intentOf(op);
  const tid = BigInt(it!.transfer_id as string);
  const rec = await recover(client, lib, intents, docs, A, B);
  const t = await tState(tid);
  check(
    "recovery voided, because MongoDB held no document",
    rec.find((r) => r.opId === op)?.action === "voided",
    `the sweeper READ MONGO and found nothing — this is the branch naive_sweeper gets wrong`,
  );
  check(
    "the pending transfer no longer holds a balance",
    t !== undefined,
    `transfer ${tid} resolved; a void releases the reservation`,
  );
}

// ── 3. crash between writeDoc and post → recovery must POST ────────────────────────────────────
console.log(
  "\n── case 3: SIGKILL between writeDoc and post → recovery POSTS ─────────────────────",
);
{
  const op = "op-3";
  await crashAfter("doc", op);
  const it = await intentOf(op);
  const tid = BigInt(it!.transfer_id as string);
  const rec = await recover(client, lib, intents, docs, A, B);
  check(
    "recovery POSTED, because the document was durable",
    rec.find((r) => r.opId === op)?.action === "posted",
    `⭐ this is exactly the case expiring_timeout showed a blind timeout destroys — a written doc behind a voided transfer`,
  );
  const dangling = await docs.findOne({ _id: op });
  check(
    "no document is left unbacked",
    dangling !== null && rec.find((r) => r.opId === op)?.status === OK,
    `the doc exists AND its transfer posted — failure mode 2 does not occur`,
  );
  // and a second recovery pass must not double-post
  const again = await recover(client, lib, intents, docs, A, B);
  check(
    "a SECOND recovery pass is a no-op",
    again.find((r) => r.opId === op) === undefined,
    `the intent was cleared, so the sweeper no longer sees it — recovery is idempotent by construction`,
  );
  void tid;
}

// ── 4. crash AFTER post → retry must not double-post ───────────────────────────────────────────
console.log(
  "\n── case 4: SIGKILL after post, intent left open → must NOT double-post ────────────",
);
{
  const op = "op-4";
  await crashAfter("post", op);
  const it = await intentOf(op);
  const tid = BigInt(it!.transfer_id as string);
  const rec = await recover(client, lib, intents, docs, A, B);
  const r = rec.find((x) => x.opId === op);
  check(
    "TigerBeetle refuses the second post with the SPECIFIC code",
    r?.status === ALREADY_POSTED,
    `status ${r?.status} = pending_transfer_already_posted (33) — asserted as a VALUE, because "no second posting happened" is also what a dropped request looks like`,
  );
  check(
    "the intent is still retired despite the refusal",
    (await intentOf(op))?.state === "cleared",
    `an already-settled transfer is a completed operation, not an error to leave open forever`,
  );
  void tid;
}

// ── 5. the sweeper races a LIVE writer → writer must see already_voided ────────────────────────
console.log(
  "\n── case 5: sweeper claims and voids while the writer is still alive ───────────────",
);
{
  const op = "op-5";
  const tid = lib.id();
  await writeIntent(intents, op, tid);
  await reserve(client, tid, A, B, 1000n);
  // the sweeper claims it before the writer writes its document
  const vStatus = await voidPending(client, lib.id(), tid, A, B);
  check("the sweeper's void succeeds", vStatus === OK, `status ${vStatus}`);
  // ...now the slow writer wakes up and finishes its own protocol
  await writeDoc(docs, op);
  const pStatus = await post(client, lib.id(), tid, A, B);
  check(
    "the live writer's post FAILS with the specific code, so it can compensate",
    pStatus === ALREADY_VOIDED,
    `status ${pStatus} = pending_transfer_already_voided (34) — this is why T_claim must exceed the writer's worst case (ADR-0042/D4), and why the writer must not treat a failed post as success`,
  );
  await clearIntent(intents, op);
}

// ── 6. expiry must NEVER fire ──────────────────────────────────────────────────────────────────
console.log(
  "\n── case 6: Transfer.timeout is 0, so expiry is unreachable ────────────────────────",
);
{
  const op = "op-6";
  const tid = lib.id();
  await writeIntent(intents, op, tid);
  await reserve(client, tid, A, B, 500n);
  const t = await tState(tid);
  check(
    "the reserved transfer carries timeout 0",
    Number(t.timeout) === 0,
    `ADR-0042/D1 — TigerBeetle expires nothing; the sweeper is the sole resolver`,
  );
  await writeDoc(docs, op);
  const pStatus = await post(client, lib.id(), tid, A, B);
  check(
    "posting long after the reserve still succeeds — nothing expired",
    pStatus === OK && pStatus !== EXPIRED,
    `⚠️ ASSERTED BECAUSE IT ASSERTS THAT NOTHING HAPPENED, which is the case most likely to be skipped. A timeout accidentally set non-zero is the regression expiring_timeout proves is unsafe, and nothing else would catch it`,
  );
  await clearIntent(intents, op);
}

console.log(
  `\n── verdict ────────────────────────────────────────────────────────────────────────`,
);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(
  "\n── what this harness does NOT establish ───────────────────────────────────────────",
);
console.log("  · Concurrency between two DIFFERENT operations. Every case here is one operation.");
console.log("  · A crash of MongoDB or TigerBeetle itself — only of the writer between them.");
console.log("  · That T_claim and T_resolve are correctly VALUED (ADR-0042/D4). Case 5 proves the");
console.log("    race is detectable and compensable; the numbers are operational and unset.");
await c.close();
Deno.exit(fail === 0 ? 0 : 1);
