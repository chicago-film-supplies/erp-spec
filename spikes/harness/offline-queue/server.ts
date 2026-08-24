/**
 * SPIKE-013 — the server half of the offline-queue slice.
 *
 * Deliberately small: the interesting behaviour is all on the client, and the server exists to be
 * **disconnected from** and to **reject a replayed write**. It also counts what it received, so the
 * browser test can assert "exactly one write arrived" from the far side rather than from the
 * client's own bookkeeping.
 *
 * ⚠️ **The disconnect is NOT simulated here.** `browser_test.ts` uses Playwright's
 * `context.setOffline(true)`, which fails the real network stack — so `navigator.onLine` flips, the
 * `offline` event fires and `fetch` rejects exactly as it would on a job site. A server-side "wired
 * to off" flag would have exercised the client's happy path with a different status code.
 *
 *   deno task oq-server        # then open http://127.0.0.1:8793/
 *
 * @module
 */

const PORT = 8793;

interface Doc {
  uid: string;
  subject: string;
  qty: number;
  status: string;
  version: number;
  photo?: string;
}

const docs = new Map<string, Doc>([
  ["order-1", { uid: "order-1", subject: "Stage 3", qty: 2, status: "reserved", version: 1 }],
]);

/** Field names the server will reject on write, with the reason. Drives criterion 3. */
const rejects = new Map<string, string>();

const received: { method: string; doc: string; fields: string[]; version: number }[] = [];
const blobs: { id: string; doc: string; bytes: number; mime: string }[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

const file = async (name: string, type: string) =>
  new Response(await Deno.readTextFile(new URL(name, import.meta.url)), {
    headers: { "content-type": type },
  });

Deno.serve({ port: PORT, hostname: "127.0.0.1" }, async (req) => {
  const url = new URL(req.url);
  const p = url.pathname;

  if (p === "/") return await file("index.html", "text/html; charset=utf-8");
  if (p === "/client.js") return await file("client.js", "text/javascript; charset=utf-8");

  // ── control surface, for the test only ──
  if (p === "/api/_reset") {
    docs.set("order-1", {
      uid: "order-1",
      subject: "Stage 3",
      qty: 2,
      status: "reserved",
      version: 1,
    });
    rejects.clear();
    received.length = 0;
    blobs.length = 0;
    return json({ ok: true });
  }
  if (p === "/api/_reject") {
    const { field, reason } = await req.json();
    rejects.set(field, reason);
    return json({ ok: true });
  }
  if (p === "/api/_stats") return json({ received, blobs, docs: [...docs.values()] });

  // ── the real API ──
  const m = p.match(/^\/api\/doc\/(.+)$/);
  if (m) {
    const id = m[1];
    if (req.method === "GET") {
      const d = docs.get(id);
      return d ? json(d) : json({ error: "not found" }, 404);
    }
    if (req.method === "PUT") {
      const body = await req.json() as Doc;
      const bad = Object.keys(body).find((f) => rejects.has(f));
      if (bad) {
        // 422 NAMING THE FIELD. A rejection that does not name the field cannot be shown to a
        // human as anything more useful than "something went wrong".
        return json({ error: "validation", field: bad, reason: rejects.get(bad) }, 422);
      }
      const prev = docs.get(id);
      const next = { ...(prev ?? {}), ...body, uid: id, version: (prev?.version ?? 0) + 1 } as Doc;
      docs.set(id, next);
      received.push({
        method: "PUT",
        doc: id,
        fields: Object.keys(body).filter((k) => k !== "uid" && k !== "version"),
        version: next.version,
      });
      return json(next);
    }
  }

  if (p === "/api/blob" && req.method === "POST") {
    const buf = new Uint8Array(await req.arrayBuffer());
    const id = url.searchParams.get("id") ?? "?";
    blobs.push({
      id,
      doc: url.searchParams.get("doc") ?? "?",
      bytes: buf.byteLength,
      mime: req.headers.get("content-type") ?? "?",
    });
    return json({ ok: true, id, bytes: buf.byteLength });
  }

  return new Response("not found", { status: 404 });
});

console.log(`offline-queue slice on http://127.0.0.1:${PORT}/`);
