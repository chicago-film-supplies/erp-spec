// SPIKE-009 criterion 1 — the SolidJS half of the slice.
//
// ⭐ THE POINT OF THIS FILE is the shape of `subscribeCollection`. The manager's
// `createAsyncState` accepts "a fetcher that returns a cleanup function"
// (manager/src/primitives/createAsyncState.ts), which is how it consumes `onSnapshot` today.
// `subscribeCollection` has exactly that shape, so the 52 subscription sites in the criterion-3
// inventory keep their call signature across the transport swap — the primitive does not change.
//
// ⚠️ What DOES have to change is what the fetcher does on failure. `createAsyncState`'s listener
// branch logs and stops — no retry, no backoff, no re-subscribe — because the Firestore SDK
// resumed transparently and nothing here ever had to. That is criterion 3's item 2, and this file
// reproduces the gap deliberately rather than papering over it: `onclose` records the state and
// does NOT reconnect.
//
// `reconcile` is load-bearing, not decoration: it diffs the incoming array into the existing
// store so only genuinely-changed fields notify. Without it every frame replaces every row object
// and the whole table re-renders, which would look identical in a screenshot and would have
// thrown away the property the criterion is about.
import { render } from "https://esm.sh/solid-js@1.9.12/web";
import html from "https://esm.sh/solid-js@1.9.12/html";
import { createSignal, For } from "https://esm.sh/solid-js@1.9.12";
import { createStore, reconcile } from "https://esm.sh/solid-js@1.9.12/store";

const [state, setState] = createStore({ rows: [] });
const [status, setStatus] = createSignal("connecting");
let frames = 0;

const subscribeCollection = (onData) => {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    frames++;
    document.getElementById("frames").textContent = String(frames);
    document.getElementById("reqs").textContent = String(m.httpRequests);
    onData(m);
  };
  ws.onopen = () => setStatus("live");
  ws.onclose = () => setStatus("closed — and nothing here reconnects, exactly as today");
  ws.onerror = () => setStatus("error");
  return () => ws.close(); // the cleanup function the existing contract expects
};

let current = [];
const apply = (m) => {
  if (m.type === "snapshot") current = m.docs;
  if (m.type === "change") {
    if (m.op === "delete") current = current.filter((d) => d._id !== m.id);
    else {
      const i = current.findIndex((d) => d._id === m.id);
      if (i === -1) current = m.doc ? [...current, m.doc] : current;
      else current = current.map((d, j) => (j === i ? (m.doc ?? d) : d));
    }
  }
  setState("rows", reconcile(current, { key: "_id" }));
};

const dispose = subscribeCollection(apply);
globalThis.addEventListener("beforeunload", dispose);

render(
  () =>
    html`
      <div>
        <p class="meta">socket: <strong>${status}</strong></p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Status</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
                ${html`<${For} each=${() => state.rows}>${(r) =>
                  html`
                    <tr>
                      <td>${() => r.name}</td>
                      <td>${() => r.status}</td>
                      <td class="n">${() => r.qty}</td>
                    </tr>
                  `}<//>`}
              </tbody>
        </table>
      </div>
    `,
  document.getElementById("app"),
);
