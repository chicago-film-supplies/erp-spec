/**
 * SPIKE-009 criterion 1 — the DOM half, as a RE-RUNNABLE artifact.
 *
 * The owner confirmed the slice in a browser on 2026-08-23, which met the criterion. ⚠️ **An
 * observation is not a regression net**: the change-stream probe and the store test fail loudly on
 * a regression and a human looking once does not. This drives a real Chromium and asserts the two
 * things a screenshot cannot.
 *
 * ⭐ **The strong assertion is the browser's OWN network log.** The slice server counts the HTTP
 * requests it serves, but that is the server's word for it. Playwright observes every request the
 * page issues, so "the view updated without a refetch" becomes a statement about the client,
 * proven from outside it.
 *
 * ⭐ **The second is that the update is FINE-GRAINED.** Each row's cell is tagged with a JS marker
 * before the mutation; if Solid re-rendered the table wholesale the tagged nodes would be replaced
 * and the markers would be gone. An unchanged row keeping its marker is a whole-table re-render
 * ruled out from the DOM side, complementing `store_test.ts`'s effect count.
 *
 * ## Running it
 *
 *   # replica set on 27079 (see _README.md), then:
 *   deno task slice          # in another shell
 *   deno task slice-browser
 *
 * Reuses the Chromium already installed for `manager`'s Playwright suite via the shared
 * `~/Library/Caches/ms-playwright` cache — no second browser download. The version tracks
 * `manager/package.json` for the same reason the Solid pin does.
 *
 * @module
 */

// The `page.evaluate` callbacks below execute in the BROWSER, not in Deno, so they need the DOM
// lib. Referenced here rather than widened in deno.json: this is the only file in the harness that
// runs code in a browser context, and widening the whole project's lib would let a DOM global
// type-check in a probe that can never have one.
/// <reference lib="dom" />
import { chromium } from "npm:playwright@1.61.0";
import { assert, assertEquals } from "jsr:@std/assert@1.0.8";

const URL_ = "http://127.0.0.1:8791/";

const mutate = async (mode = "update") => {
  const p = new Deno.Command("deno", {
    args: ["task", "slice-mutate", mode],
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "null",
    stderr: "null",
  });
  await p.output();
};

Deno.test("a server-side change updates the view, and the page issues NO request to learn it", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Every request the PAGE issues, observed from outside it. This is the assertion the
  // server-side counter can only corroborate.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));

  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("strong")?.textContent === "live");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 3);

  const rowB = page.locator("tbody tr", { hasText: "Cooke S4 Set" });
  const before = (await rowB.innerText()).replace(/\s+/g, " ").trim();

  // Tag every qty cell. A wholesale re-render replaces these nodes and loses the markers.
  await page.evaluate(() => {
    document.querySelectorAll("tbody tr").forEach((tr, i) => {
      // deno-lint-ignore no-explicit-any
      (tr.querySelector("td.n") as any).__spike009 = "row" + i;
    });
  });

  const settled = requests.length;

  await mutate();
  await page.waitForFunction(
    (prev) => {
      const rows = [...document.querySelectorAll("tbody tr")];
      const b = rows.find((r) => r.textContent?.includes("Cooke S4 Set"));
      return b !== undefined && b.textContent?.replace(/\s+/g, " ").trim() !== prev;
    },
    before,
    { timeout: 10_000 },
  );

  const after = (await rowB.innerText()).replace(/\s+/g, " ").trim();
  assert(after !== before, `row did not change: ${before}`);

  // ⭐ THE POINT: no request was issued to learn about the change.
  const newRequests = requests.slice(settled);
  assertEquals(
    newRequests,
    [],
    `the page issued ${newRequests.length} request(s) after the change: ${newRequests.join(", ")}`,
  );

  // ⭐ And the update was fine-grained — the untouched rows kept their DOM nodes.
  const markers = await page.evaluate(() =>
    // deno-lint-ignore no-explicit-any
    [...document.querySelectorAll("tbody tr")].map((tr) =>
      (tr.querySelector("td.n") as any).__spike009 ?? null
    )
  );
  assertEquals(
    markers.filter((m) => m !== null).length,
    3,
    `a wholesale re-render replaced row nodes — markers surviving: ${JSON.stringify(markers)}`,
  );

  console.log(`  row: "${before}" -> "${after}"`);
  console.log(`  requests after load: ${newRequests.length}`);
  console.log(`  row nodes surviving the update: ${markers.filter((m) => m !== null).length}/3`);

  await browser.close();
});
