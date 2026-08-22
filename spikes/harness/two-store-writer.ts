/**
 * SPIKE-002 — the writer subprocess, which DIES FOR REAL.
 *
 * ⚠️ **It SIGKILLs itself rather than returning early**, and that difference is the whole point of
 * criterion 2. An in-process "pretend we stopped here" flag proves the recovery agrees with a
 * simulation; a real SIGKILL leaves real durable state in two real datastores with no unwinding, no
 * `finally`, and no client shutdown — which is what a crash actually is.
 *
 *   deno run ... two-store-writer.ts --op <id> --stop-after <step>
 *
 * Steps: intent | reserve | doc | post | done
 */
import {
  clearIntent,
  ensureAccounts,
  mongo,
  post,
  reserve,
  tb,
  writeDoc,
  writeIntent,
} from "./two-store-lib.ts";

const arg = (n: string) => {
  const i = Deno.args.indexOf(`--${n}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
};
const opId = arg("op")!;
const stopAfter = arg("stop-after") ?? "done";
const A = BigInt(arg("a") ?? "9001"), B = BigInt(arg("b") ?? "9002");

const { lib, client } = await tb();
const { intents, docs } = await mongo();
await ensureAccounts(client, A, B);

const die = (step: string) => {
  if (stopAfter !== step) return;
  console.log(`writer ${opId}: SIGKILL after ${step}`);
  // No flush, no close, no unwind. This is a crash, not a shutdown.
  Deno.kill(Deno.pid, "SIGKILL");
};

const transferId = lib.id();

await writeIntent(intents, opId, transferId);
die("intent");

const rStatus = await reserve(client, transferId, A, B, 1000n);
console.log(`writer ${opId}: reserve -> ${rStatus}`);
die("reserve");

await writeDoc(docs, opId);
die("doc");

const pStatus = await post(client, lib.id(), transferId, A, B);
console.log(`writer ${opId}: post -> ${pStatus}`);
die("post");

await clearIntent(intents, opId);
console.log(`writer ${opId}: completed cleanly`);
Deno.exit(0);
