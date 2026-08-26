/**
 * SPIKE-009 criterion 1 — the vertical slice: MongoDB change stream → socket → live SolidJS view.
 *
 * The criterion is "a server-side document change updates a SolidJS view without a refetch", and
 * the load-bearing word is WITHOUT A REFETCH. So the server counts every HTTP request it serves
 * and exposes the count to the page: if the number is unchanged across a mutation that the view
 * visibly reflects, the update did not come from a poll.
 *
 * ⭐ The client deliberately reuses the manager's OWN listener contract — `createAsyncState`
 * accepts "a fetcher that returns a cleanup function" (`manager/src/primitives/createAsyncState.ts`)
 * — so this slice answers the question that actually matters for the migration: does the existing
 * primitive survive the transport swap, or does the contract have to change? See the note in
 * `client.js`.
 *
 * ⚠️ Not the target system. Measurement code, per `spikes/harness/_README.md`. No auth, one
 * collection, one process; the authorization obligation is criterion 4's and is NOT modelled here.
 *
 *   deno task slice          # then open http://127.0.0.1:8791
 *   deno task slice-mutate   # a SERVER-SIDE write, with no browser involved
 *
 * @module
 */

import { Hono } from "jsr:@hono/hono@4.13.4";
import { MongoClient } from "mongodb";

const URI = "mongodb://127.0.0.1:27079/?directConnection=true";
const client = new MongoClient(URI);
await client.connect();
const col = client.db("spike009").collection("slice");

// Seed deterministically, so a reload shows the same three rows.
await col.deleteMany({});
await col.insertMany([
  { _id: "a" as any, name: "Arri Alexa 35", status: "available", qty: 3 },
  { _id: "b" as any, name: "Cooke S4 Set", status: "on hire", qty: 1 },
  { _id: "c" as any, name: "O'Connor 2575", status: "available", qty: 2 },
]);

let httpRequests = 0;
const sockets = new Set<WebSocket>();

const app = new Hono();
app.use("*", async (c, next) => {
  if (new URL(c.req.url).pathname !== "/ws") httpRequests++;
  await next();
});

app.get(
  "/",
  async (c) => c.html(await Deno.readTextFile(new URL("./index.html", import.meta.url))),
);
app.get(
  "/client.js",
  async (c) =>
    new Response(await Deno.readTextFile(new URL("./client.js", import.meta.url)), {
      headers: { "content-type": "text/javascript" },
    }),
);

app.get("/ws", (c) => {
  const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
  socket.onopen = async () => {
    sockets.add(socket);
    const docs = await col.find({}).toArray();
    // The snapshot rides the SOCKET, not a second HTTP call — otherwise "no refetch" would be
    // true only of updates and false of the initial load, which is not what the criterion asks.
    socket.send(JSON.stringify({ type: "snapshot", docs, httpRequests }));
  };
  socket.onclose = () => sockets.delete(socket);
  return response;
});

// One change stream for the whole process, fanned out to every socket. ⚠️ This is the shape that
// does NOT survive contact with criterion 3's finding: a real server must re-evaluate each
// subscriber's query predicate per event, which this slice does not do — every socket gets
// every event. The fan-out is where that work would live.
(async () => {
  const stream = col.watch([], { fullDocument: "updateLookup" });
  await stream.tryNext(); // ⚠️ watch() is lazy — establish the cursor before announcing readiness
  console.log("change stream established");
  for await (const ev of stream) {
    const frame = JSON.stringify({
      type: "change",
      op: ev.operationType,
      id: (ev as any).documentKey?._id,
      doc: (ev as any).fullDocument ?? null,
      httpRequests,
    });
    for (const s of sockets) {
      if (s.readyState === WebSocket.OPEN) s.send(frame);
    }
  }
})();

Deno.serve({ port: 8791, hostname: "127.0.0.1" }, app.fetch);
