/**
 * Caches upstream LLM-facing docs for the target stack into `.claude/docs/` (gitignored).
 * Refetches only when the local copy is older than 24h. Run: `deno task fetch-llms-docs`.
 *
 * Companion to `research-drop/reference/*.md`: the curated note carries the CFS-specific traps,
 * this cache carries upstream's own reference material. `.claude/hooks/stack-digest.sh` reports
 * both at session start.
 *
 * Not a spec tool. Writes nothing outside `.claude/docs/`, and reads no spec file — so unlike
 * `generate.ts` it may read a clock (its output is gitignored and never gates CI).
 */

import { todayUTC } from "./dates.ts";

const CACHE_DIR = new URL("../.claude/docs/", import.meta.url);
const MANIFEST = new URL("MANIFEST.txt", CACHE_DIR);
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Source = {
  url: string;
  file: string;
  /** Optional post-fetch rewrite. Only needed where upstream publishes no plain-text dump. */
  transform?: (body: string) => string;
};

/**
 * Verified 2026-08-09 by HTTP probe; sizes are the measured response bodies.
 * Sources with no `llms.txt` at all (Valkey, Caddy) are absent by design — for those the
 * curated note in `research-drop/reference/` is the whole source.
 */
const SOURCES: Source[] = [
  // Full reference dumps.
  {
    url: "https://docs.tigerbeetle.com/single-page/",
    file: "tigerbeetle.txt",
    transform: htmlToText,
  },
  { url: "https://hono.dev/llms-full.txt", file: "hono-full.txt" },
  { url: "https://zod.dev/llms-full.txt", file: "zod.txt" },
  // Deno publishes an llms-full.txt too, but it is ~2.5 MB; the agent guide is the useful slice.
  { url: "https://docs.deno.com/llms-full-guide.txt", file: "deno.txt" },
  // Link indexes — upstream publishes no full-text dump (llms-full.txt 404s on all three).
  { url: "https://www.mongodb.com/docs/llms.txt", file: "mongodb.txt" },
  { url: "https://hono.dev/llms.txt", file: "hono-index.txt" },
  { url: "https://quint.sh/llms.txt", file: "quint.txt" },
  { url: "https://duckdb.org/llms.txt", file: "duckdb.txt" },
];

/**
 * TigerBeetle publishes no `llms.txt` (404 as of 2026-08-09); its single-page dump is HTML.
 * Reduce it to markdown-ish text, preserving the structure that makes it navigable — headings
 * to find a section, fenced blocks so client code survives readable.
 */
function htmlToText(html: string): string {
  let s = html
    .replace(/<(script|style|nav|header|footer|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_m, lvl: string, inner: string) => `\n\n${"#".repeat(Number(lvl))} ${strip(inner).trim()}\n`,
    )
    .replace(
      /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
      (_m, inner: string) => `\n\`\`\`\n${unescapeEntities(strip(inner)).trim()}\n\`\`\`\n`,
    )
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|tr|table|ul|ol)>/gi, "\n");

  s = unescapeEntities(strip(s));
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "");

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const unescapeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);

/**
 * Fail loudly on a missing --allow-net host instead of silently never fetching that file.
 * This is the arm: api-cloudrun's copy of this script has had `eta.js.org` in SOURCES and absent
 * from --allow-net since the day it was added, so `.claude/docs/eta.txt` has never existed while
 * its CLAUDE.md instructs the model to read it. A permission denial must be an error, not a gap.
 */
async function assertNetPermissions(): Promise<void> {
  const hosts = [...new Set(SOURCES.map(({ url }) => new URL(url).host))].sort();
  const denied: string[] = [];
  for (const host of hosts) {
    const { state } = await Deno.permissions.query({ name: "net", host });
    if (state !== "granted") denied.push(host);
  }
  if (denied.length === 0) return;
  console.error(
    `Net permission missing for: ${denied.join(", ")}\n` +
      `Every SOURCES host must be allowed. Update the deno.json task to:\n` +
      `  --allow-net=${hosts.join(",")}`,
  );
  Deno.exit(1);
}

async function isFresh(path: URL): Promise<boolean> {
  try {
    const { mtime } = await Deno.stat(path);
    return mtime ? Date.now() - mtime.getTime() < MAX_AGE_MS : false;
  } catch {
    return false;
  }
}

const today = todayUTC;

await assertNetPermissions();
await Deno.mkdir(CACHE_DIR, { recursive: true });

const results = await Promise.allSettled(
  SOURCES.map(async ({ url, file, transform }): Promise<string> => {
    const cachePath = new URL(file, CACHE_DIR);

    if (await isFresh(cachePath)) {
      const { size } = await Deno.stat(cachePath);
      console.log(`${file} is fresh (< 24h old), skipping.`);
      return `${file}\t${url}\t${size}\t${today()}`;
    }

    console.log(`Fetching ${url} ...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file}: ${res.status} ${res.statusText} from ${url}`);

    const body = transform ? transform(await res.text()) : await res.text();
    await Deno.writeTextFile(cachePath, body);
    const size = new TextEncoder().encode(body).length;
    console.log(`Saved ${file} (${(size / 1024).toFixed(1)} KB)`);
    return `${file}\t${url}\t${size}\t${today()}`;
  }),
);

/**
 * The manifest is what makes a fetch failure visible: the digest hook diffs it against what is
 * actually on disk, so a file that silently stopped being fetched shows up at session start.
 * Only fulfilled entries are listed — a failed source must not look accounted for.
 */
const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
await Deno.writeTextFile(
  MANIFEST,
  `# file\turl\tbytes\tfetched (UTC day). Written by tools/fetch-llms-docs.ts — do not edit.\n` +
    ok.sort().join("\n") + "\n",
);

const failed = results.filter((r) => r.status === "rejected");
for (const f of failed) console.error("Failed:", (f as PromiseRejectedResult).reason);
if (failed.length > 0) Deno.exit(1);
