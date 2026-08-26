/**
 * SPIKE-013 criteria 1, 3 and 7 — the halves that cannot be honestly faked in Deno.
 *
 * ⚠️ **Why a real browser.** Three of this spike's criteria are claims about DURABILITY and about
 * BYTES, and an in-process fake would satisfy both by construction:
 *
 *   - criterion 1 says a queued write survives "a disconnect longer than the session". The session
 *     ends at a **reload**, and only a real browser can lose the in-memory half while keeping the
 *     persisted half. A Deno object that survives because nothing tore it down proves nothing.
 *   - criterion 3 says the failure lands somewhere a human sees it "with the operator absent". The
 *     operator's absence is the reload; a toast does not survive one and an inbox does.
 *   - criterion 7 says a 4 MB photo survives and uploads. **localStorage would refuse it** and a
 *     Deno `Uint8Array` would not care, so the storage decision only gets tested where the quota
 *     is real.
 *
 * ⭐ **The disconnect is Playwright's `context.setOffline(true)`, which fails the real network
 * stack** — `navigator.onLine` flips, the `offline` event fires, `fetch` rejects. A server-side
 * "wired to off" flag would have exercised the client's happy path with a different status code.
 *
 * ## Running it
 *
 *   deno task oq-server      # in another shell
 *   deno task oq-browser
 *
 * Reuses the Chromium already installed for `manager`'s Playwright suite, like `slice-browser`.
 *
 * @module
 */
/// <reference lib="dom" />
import { chromium } from "npm:playwright@1.62.1";
import { assert, assertEquals } from "jsr:@std/assert@1.0.19";

const URL_ = "http://127.0.0.1:8793/";

const reset = async () => {
  await fetch(`${URL_}api/_reset`);
};
const stats = async () =>
  await (await fetch(`${URL_}api/_stats`)).json() as {
    received: { doc: string; fields: string[]; version: number }[];
    blobs: { id: string; doc: string; bytes: number; mime: string }[];
    docs: { uid: string; subject: string; qty: number; version: number }[];
  };
const rejectField = async (field: string, reason: string) => {
  await fetch(`${URL_}api/_reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ field, reason }),
  });
};

/** A fresh browser with a fresh origin — no IndexedDB carried between tests. */
const fresh = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForSelector("body[data-ready='1']");
  return { browser, ctx, page };
};

Deno.test("criterion 1: three offline edits to one field survive the SESSION and replay as ONE write", async () => {
  await reset();
  const { browser, ctx, page } = await fresh();
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);

    // deno-lint-ignore no-explicit-any
    const api = () => (globalThis as any).__spike013;
    await page.evaluate(async () => {
      const q = (globalThis as unknown as {
        __spike013: { enqueue: (a: string, b: string, c: unknown) => Promise<void> };
      }).__spike013;
      await q.enqueue("order-1", "subject", "Stage 4");
      await q.enqueue("order-1", "subject", "Stage 5");
      await q.enqueue("order-1", "subject", "Stage 6");
    });
    assertEquals(
      await page.textContent("#queued"),
      "1",
      "three edits to one field are ONE queued op",
    );

    // ── THE SESSION ENDS HERE, and it ends the way it really ends: the page is DESTROYED. ──
    // ⚠️ A `reload()` would not do — see the "the app shell does not load offline" test below.
    // Closing the page discards every in-memory structure while leaving origin storage intact,
    // which is exactly the boundary v1's in-memory `latestSnapshot` fails to cross.
    assertEquals((await stats()).received.length, 0, "nothing reached the server while offline");
    await page.close();

    await ctx.setOffline(false);
    const page2 = await ctx.newPage();
    await page2.goto(URL_);
    await page2.waitForSelector("body[data-ready='1']");
    await page2.waitForFunction(
      () => document.getElementById("queued")?.textContent === "0",
      null,
      {
        timeout: 10_000,
      },
    );

    const s = await stats();
    assertEquals(s.received.length, 1, "EXACTLY ONE write — not three, and not zero");
    assertEquals(s.docs[0].subject, "Stage 6", "the last value is what landed");
    assert(api === api); // keep the helper referenced; the real assertions are above
  } finally {
    await browser.close();
  }
});

Deno.test("criterion 1: an edit made offline does not collide with a different field changed on the server", async () => {
  await reset();
  const { browser, ctx, page } = await fresh();
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.evaluate(async () => {
      await (globalThis as unknown as {
        __spike013: { enqueue: (a: string, b: string, c: unknown) => Promise<void> };
      })
        .__spike013.enqueue("order-1", "subject", "edited offline");
    });

    // Meanwhile, someone else moves a DIFFERENT field on the server.
    await fetch(`${URL_}api/doc/order-1`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qty: 42 }),
    });

    await ctx.setOffline(false);
    await page.waitForFunction(() => document.getElementById("queued")?.textContent === "0", null, {
      timeout: 10_000,
    });

    const s = await stats();
    const d = s.docs[0];
    assertEquals(d.subject, "edited offline", "our field survives");
    assertEquals(d.qty, 42, "their field survives — different fields do not collide");
  } finally {
    await browser.close();
  }
});

Deno.test("criterion 3: a replay REJECTED on validation lands in a durable inbox, naming the field, with the operator absent", async () => {
  await reset();
  await rejectField("qty", "quantity exceeds available stock");
  const { browser, ctx, page } = await fresh();
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.evaluate(async () => {
      await (globalThis as unknown as {
        __spike013: { enqueue: (a: string, b: string, c: unknown) => Promise<void> };
      })
        .__spike013.enqueue("order-1", "qty", 9999);
    });

    await ctx.setOffline(false);
    await page.waitForFunction(() => document.getElementById("queued")?.textContent === "0", null, {
      timeout: 10_000,
    });

    // ⭐ THE OPERATOR IS ABSENT: the failure has to still be here after the session ends.
    // The reload is legal here only because the network is already back — see the shell test below.
    await page.reload();
    await page.waitForSelector("body[data-ready='1']");

    const inbox = await page.textContent("#inbox");
    assert(inbox!.includes("qty"), `the failure must NAME the field — got: ${inbox}`);
    assert(
      inbox!.includes("quantity exceeds available stock"),
      `and carry the server's reason — got: ${inbox}`,
    );
    assertEquals(
      await page.textContent("#state-qty"),
      "failed",
      "and the field itself must read failed, not synced",
    );
  } finally {
    await browser.close();
  }
});

Deno.test("criterion 7: a 4 MB photo captured offline survives the session and uploads on reconnect", async () => {
  await reset();
  const { browser, ctx, page } = await fresh();
  const FOUR_MB = 4 * 1024 * 1024;
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);

    const id = await page.evaluate(async (n) => {
      return await (globalThis as unknown as {
        __spike013: { capture: (a: string, b: string, c: number, d: string) => Promise<string> };
      }).__spike013.capture("order-1", "photo", n, "image/jpeg");
    }, FOUR_MB);

    assertEquals(await page.textContent("#blobq"), "1");

    // ⚠️ THE ASSERTION THAT MAKES THE STORAGE DECISION REAL: the bytes are NOT in localStorage.
    // 4 MB of base64 is ~5.5 MB and would blow the ~5 MB origin quota that v1's stash lives in.
    const lsBytes = await page.evaluate(() =>
      (globalThis as unknown as { __spike013: { localStorageBytes: () => number } }).__spike013
        .localStorageBytes()
    );
    assert(lsBytes < 10_000, `blob bytes must not be in localStorage — it holds ${lsBytes} bytes`);

    // Byte-exactness is asserted HERE, while still offline: nothing can flush, so there is no race
    // between the assertion and the upload it is about.
    const size = await page.evaluate(
      async (i) =>
        await (globalThis as unknown as {
          __spike013: { blobBytes: (id: string) => Promise<number | null> };
        })
          .__spike013.blobBytes(i),
      id,
    );
    assertEquals(size, FOUR_MB, "stored BYTE-EXACT, not as a truncated or re-encoded string");

    // ── End the session while still offline, then come back on a FRESH page. ──
    // ⭐ That freshness is the durability proof: page2 was never told about this blob, so if it
    // uploads four megabytes the bytes can only have come from storage that outlived page1.
    await page.close();
    await ctx.setOffline(false);
    const page2 = await ctx.newPage();
    await page2.goto(URL_);
    await page2.waitForSelector("body[data-ready='1']");
    await page2.waitForFunction(() => document.getElementById("blobq")?.textContent === "0", null, {
      timeout: 30_000,
    });

    const s = await stats();
    assertEquals(s.blobs.length, 1);
    assertEquals(s.blobs[0].bytes, FOUR_MB, "the server received all four megabytes");
    assertEquals(s.blobs[0].mime, "image/jpeg");
  } finally {
    await browser.close();
  }
});

Deno.test("⚠️ THE APP SHELL DOES NOT LOAD OFFLINE — the queue survives and is unreachable", async () => {
  await reset();
  const { browser, ctx, page } = await fresh();
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.evaluate(async () => {
      await (globalThis as unknown as {
        __spike013: { enqueue: (a: string, b: string, c: unknown) => Promise<void> };
      }).__spike013.enqueue("order-1", "subject", "typed on a job site");
    });
    await page.close();

    // Still offline. The operator reopens the app — and cannot.
    const page2 = await ctx.newPage();
    let err = "";
    try {
      await page2.goto(URL_);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    assert(
      err.includes("ERR_INTERNET_DISCONNECTED"),
      `expected the shell fetch to fail offline; got: ${
        err || "it LOADED, which would mean a cache exists"
      }`,
    );

    // ⇒ the queued write is intact in IndexedDB and there is no way to reach it. An offline queue
    // without an offline app shell is half a capability, and `manager` has NO service worker: no
    // `serviceWorker` registration, no PWA plugin, and public/ holds only a favicon
    // (code:2026-08-24:manager@9504a1e).
    await ctx.setOffline(false);
    const page3 = await ctx.newPage();
    await page3.goto(URL_);
    await page3.waitForSelector("body[data-ready='1']");
    await page3.waitForFunction(
      () => document.getElementById("queued")?.textContent === "0",
      null,
      {
        timeout: 10_000,
      },
    );
    const st = await stats();
    assertEquals(
      st.docs[0].subject,
      "typed on a job site",
      "the work was never lost — only unreachable",
    );
  } finally {
    await browser.close();
  }
});

Deno.test("the PERSISTED base does not drift — a re-pin on boot would silently lose their edit", async () => {
  await reset();
  const { browser, ctx, page } = await fresh(); // boots online and pins base: subject "Stage 3"
  try {
    await ctx.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.evaluate(async () => {
      await (globalThis as unknown as {
        __spike013: { enqueue: (a: string, b: string, c: unknown) => Promise<void> };
      }).__spike013.enqueue("order-1", "subject", "ours, typed offline");
    });
    await page.close();

    // Someone else moves the SAME field while we are away.
    await fetch(`${URL_}api/doc/order-1`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: "theirs, typed in the office" }),
    });

    // Count what the server has seen BEFORE reconnecting — the simulated other-operator write
    // above is one of them, and counting it as ours is how this assertion first went wrong.
    const before = (await stats()).received.length;

    await ctx.setOffline(false);
    const page2 = await ctx.newPage();
    await page2.goto(URL_);
    await page2.waitForSelector("body[data-ready='1']");
    // Give the flush a chance to do the wrong thing, rather than asserting before it could.
    await page2.waitForTimeout(500);

    // ⭐ THE ASSERTION IS ABOUT A NON-EVENT: our write must NOT have landed. Both sides moved
    // `subject` away from the pinned ancestor, so this is a genuine conflict and the only correct
    // outcome is to hold the write back.
    const s = await stats();
    assertEquals(
      s.docs[0].subject,
      "theirs, typed in the office",
      "a re-pinned base makes base === theirs, so our edit applies 'cleanly' and LOSES their work",
    );
    assertEquals(
      s.received.length - before,
      0,
      "and the reconnecting client should have sent nothing at all",
    );
  } finally {
    await browser.close();
  }
});
