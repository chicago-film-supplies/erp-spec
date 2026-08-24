// SPIKE-013 — the durable half of the offline queue, in the browser.
//
// ⚠️ THE STORAGE SPLIT IS THE POINT, NOT AN IMPLEMENTATION DETAIL.
//
//   - the queue, the PINNED BASE and the failure inbox → IndexedDB, as one JSON value
//   - blob bytes                                       → IndexedDB, as Blobs, in their own store
//
// v1 puts its stash in localStorage, which is (a) string-only and (b) ~5 MB for the whole origin.
// A 4 MB JPEG base64s to ~5.5 MB and takes the whole budget with it, so "the queue carries blobs"
// is a storage decision before it is a queue decision. SPIKE-013's exit criterion 7 exists because
// `qty: 2` and a 4 MB photo are the same object to a queue that was designed for the first.
//
// ⚠️ And the BASE is here at all because v1's is not: `latestSnapshot` lives in an in-memory Map,
// so a reload during a disconnect loses the common ancestor and the three-way merge silently
// degrades to the two-way version gate it was chosen to replace (SPIKE-013 Finding 4).

const DB = "spike013";
const API = "";

// ── IndexedDB, minimally ─────────────────────────────────────────────────────
const idb = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const put = async (store, key, val) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
};
const get = async (store, key) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const rq = tx.objectStore(store).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
};
const del = async (store, key) => {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => res();
  });
};

// ── the queue state ──────────────────────────────────────────────────────────
// Mirrors `queue.ts`'s QueueState. Kept as a plain value so persisting it is JSON.stringify —
// which is the property that makes "survives a disconnect longer than the session" achievable.
let S = { bases: {}, ops: [], creates: {}, blobs: [], failures: [], nextSeq: 0 };

const save = () => put("kv", "state", JSON.parse(JSON.stringify(S)));

const setPath = (doc, path, value) => {
  const segs = path.split(".");
  const out = { ...doc };
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) {
    cur[segs[i]] = { ...(cur[segs[i]] ?? {}) };
    cur = cur[segs[i]];
  }
  cur[segs.at(-1)] = value;
  return out;
};
const getP = (doc, path) => path.split(".").reduce((c, s) => (c == null ? undefined : c[s]), doc);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ⚠️ AUTOMATIC. v1's stash is written only when a human clicks a button — two onClick call sites
// and nothing else (Finding 4). An operator who drives out of signal and closes the laptop has
// clicked nothing, which is precisely the case the criterion says to measure.
async function enqueue(docId, path, value) {
  const i = S.ops.findIndex((o) => o.doc === docId && o.path === path);
  if (i >= 0) S.ops[i].value = value;
  else S.ops.push({ doc: docId, path, value, seq: S.nextSeq });
  S.nextSeq++;
  await save();
  render();
  if (navigator.onLine) await flush();
}

async function pinBase(docId, snapshot, version) {
  if (S.bases[docId]) return; // idempotent — the ancestor must not drift toward theirs
  S.bases[docId] = { doc: snapshot, version, pinnedAtSeq: S.nextSeq };
  await save();
}

async function capture(docId, field, bytes, mime) {
  const id = crypto.randomUUID();
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  await put("blobs", id, blob); // the BYTES — never in the JSON state, never in localStorage
  S.blobs.push({ id, doc: docId, field, bytes, mime });
  await save();
  render();
  if (navigator.onLine) await flush();
  return id;
}

// ── replay ───────────────────────────────────────────────────────────────────
// Per document: re-READ, re-BASE, re-DIFF. Not "send the queue" — the first write bumps the
// version, so the second would be stale by its own predecessor (Finding 1).
let flushing = false;

async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (const docId of [...new Set(S.ops.map((o) => o.doc))]) {
      let theirs = null;
      try {
        const r = await fetch(`${API}/api/doc/${docId}`);
        theirs = r.ok ? await r.json() : null;
      } catch {
        return; // still offline — leave the queue exactly as it is
      }
      const base = S.bases[docId];
      if (!base) continue;

      let merged = theirs ?? {};
      const conflicts = [];
      const failed = [];
      for (const op of S.ops.filter((o) => o.doc === docId).sort((a, b) => a.seq - b.seq)) {
        const b = getP(base.doc, op.path), t = getP(theirs, op.path);
        if (theirs === null) {
          failed.push({
            doc: docId,
            field: op.path,
            reason: "the document no longer exists",
            value: op.value,
          });
        } else if (same(op.value, t)) { /* converged */ }
        else if (same(b, t)) merged = setPath(merged, op.path, op.value);
        else conflicts.push({ doc: docId, path: op.path, base: b, ours: op.value, theirs: t });
      }
      if (failed.length) {
        S.failures.push(...failed);
        S.ops = S.ops.filter((o) => o.doc !== docId);
        await save();
        continue;
      }
      if (conflicts.length) {
        S.conflicts = conflicts;
        await save();
        continue;
      }

      const res = await fetch(`${API}/api/doc/${docId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (res.status === 422) {
        // A deferred validation failure. It lands in the DURABLE inbox with the field named —
        // not a toast, because the operator is not here to see one.
        const e = await res.json();
        S.failures.push({
          doc: docId,
          field: e.field,
          reason: e.reason,
          value: getP(merged, e.field),
        });
        S.ops = S.ops.filter((o) => o.doc !== docId);
        await save();
        continue;
      }
      if (res.ok) {
        S.ops = S.ops.filter((o) => o.doc !== docId);
        delete S.bases[docId];
        await save();
      }
    }

    for (const b of [...S.blobs]) {
      const bytes = await get("blobs", b.id);
      if (!bytes) {
        S.blobs = S.blobs.filter((x) => x.id !== b.id);
        continue;
      }
      try {
        const res = await fetch(`${API}/api/blob?id=${b.id}&doc=${b.doc}`, {
          method: "POST",
          headers: { "content-type": b.mime },
          body: bytes,
        });
        if (res.ok) {
          await del("blobs", b.id);
          S.blobs = S.blobs.filter((x) => x.id !== b.id);
          await save();
        }
      } catch {
        return; // still offline
      }
    }
  } finally {
    flushing = false;
    render();
  }
}

// ── per-field state, derived from the queue alone ────────────────────────────
const fieldState = (docId, path) =>
  S.failures.some((f) => f.doc === docId && f.field === path)
    ? "failed"
    : S.ops.some((o) => o.doc === docId && o.path === path)
    ? "pending"
    : "synced";

// ── UI ───────────────────────────────────────────────────────────────────────
function render() {
  document.getElementById("net").textContent = navigator.onLine ? "online" : "OFFLINE";
  document.getElementById("net").className = navigator.onLine ? "on" : "off";
  document.getElementById("queued").textContent = String(S.ops.length);
  document.getElementById("blobq").textContent = String(S.blobs.length);
  for (const f of ["subject", "qty"]) {
    const el = document.getElementById(`state-${f}`);
    if (el) {
      el.textContent = fieldState("order-1", f);
      el.className = fieldState("order-1", f);
    }
  }
  const inbox = document.getElementById("inbox");
  inbox.innerHTML = "";
  for (const f of S.failures) {
    const li = document.createElement("li");
    li.className = "failure";
    li.textContent = `${f.doc} · ${f.field} — ${f.reason}`;
    inbox.appendChild(li);
  }
}

// ── boot ─────────────────────────────────────────────────────────────────────
(async () => {
  S = (await get("kv", "state")) ?? S;
  addEventListener("online", () => {
    render();
    flush();
  });
  addEventListener("offline", render);

  if (navigator.onLine) {
    try {
      const r = await fetch(`${API}/api/doc/order-1`);
      if (r.ok) {
        const d = await r.json();
        document.getElementById("subject").value = d.subject;
        document.getElementById("qty").value = String(d.qty);
        await pinBase("order-1", d, d.version);
      }
    } catch { /* offline at boot — the persisted base is what we have */ }
  }

  document.getElementById("subject").addEventListener(
    "blur",
    (e) => enqueue("order-1", "subject", e.target.value),
  );
  document.getElementById("qty").addEventListener(
    "blur",
    (e) => enqueue("order-1", "qty", Number(e.target.value)),
  );

  render();
  await flush();
  document.body.dataset.ready = "1";
})();

// Test surface. Everything the browser test drives goes through here rather than through the DOM,
// so a UI change cannot silently turn an assertion into a no-op.
globalThis.__spike013 = {
  enqueue,
  capture,
  flush,
  state: () => JSON.parse(JSON.stringify(S)),
  fieldState,
  blobBytes: (id) => get("blobs", id).then((b) => (b ? b.size : null)),
  localStorageBytes: () => JSON.stringify(localStorage).length,
};
