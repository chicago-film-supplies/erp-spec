/**
 * SPIKE-009 criterion 1 — the SERVER-SIDE change. No browser, no client, no HTTP request to the
 * slice server: this connects to mongod directly, which is the whole point. The criterion is
 * about a change the client did not make and cannot invalidate against — 79% of the inventory.
 *
 *   deno task slice-mutate            # flips one row's status and bumps its qty
 *   deno task slice-mutate insert     # adds a row
 *   deno task slice-mutate delete     # removes it again
 */
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://127.0.0.1:27079/?directConnection=true");
await client.connect();
const col = client.db("spike009").collection("slice");
const mode = Deno.args[0] ?? "update";

if (mode === "insert") {
  await col.insertOne({ _id: "d" as any, name: "Ronin 4D", status: "available", qty: 1 });
  console.log("inserted d");
} else if (mode === "delete") {
  await col.deleteOne({ _id: "d" as any });
  console.log("deleted d");
} else {
  const doc = await col.findOne({ _id: "b" as any });
  const next = doc?.status === "on hire" ? "available" : "on hire";
  await col.updateOne({ _id: "b" as any }, { $set: { status: next }, $inc: { qty: 1 } });
  console.log(`b.status -> ${next}, qty +1`);
}
await client.close();
