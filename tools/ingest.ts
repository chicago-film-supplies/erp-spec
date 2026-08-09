#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * research-drop/*.md  ->  inbox/ + open-questions.yaml + hotspots.yaml
 *
 * See research-drop/_FORMAT.md for the contract. Three rules this implementation exists to keep:
 *
 *   1. The drop body is NEVER rewritten. Only `status:` and `ingested_at:` in its front matter
 *      are touched. The drop file is the provenance record.
 *   2. A [correction] never silently overwrites a structured file — it opens a HOT- for a human.
 *   3. Idempotent. Re-running produces no duplicates, even if `status` is reset by hand.
 */
import { parse as parseYaml } from "@std/yaml";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DROPS = `${ROOT}/research-drop`;
const INBOX = `${ROOT}/inbox`;

const KINDS = ["finding", "decision", "question", "correction", "research", "idea", "constraint"] as const;
type Kind = typeof KINDS[number];

const KIND_OF_SECTION: Record<string, Kind> = {
  findings: "finding",
  "decisions taken": "decision",
  "open questions raised": "question",
  "corrections to existing spec": "correction",
  "research notes": "research",
};

// ── helpers ─────────────────────────────────────────────────────────────────
function splitFrontMatter(text: string) {
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)([\s\S]*)$/);
  if (!m) return null;
  try {
    return {
      raw: m[2],
      open: m[1],
      close: m[3],
      fm: (parseYaml(m[2]) ?? {}) as Record<string, unknown>,
      body: m[4] ?? "",
    };
  } catch {
    return null;
  }
}

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/`[^`]*`/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-").filter(Boolean).slice(0, 8).join("-") || "untitled";

const yamlStr = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

async function exists(p: string) {
  try {
    await Deno.stat(p);
    return true;
  } catch {
    return false;
  }
}

function nextId(existing: string[], prefix: string, width: number): string {
  let max = 0;
  for (const id of existing) {
    const m = id.match(new RegExp(`^${prefix}-(\\d{${width}})$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

// ── load current state ──────────────────────────────────────────────────────
const drops: string[] = [];
try {
  for await (const e of Deno.readDir(DROPS)) {
    if (e.isFile && e.name.endsWith(".md") && !e.name.startsWith("_")) drops.push(e.name);
  }
} catch { /* absent */ }
drops.sort();

if (drops.length === 0) {
  console.log("research-drop/ has no drop files. Nothing to ingest.");
  Deno.exit(0);
}

// existing inbox sources, so re-ingestion cannot duplicate even if `status` was reset
const existingSources = new Set<string>();
for await (const e of Deno.readDir(INBOX)) {
  if (!e.isFile || !e.name.endsWith(".md") || e.name.startsWith("_")) continue;
  const p = splitFrontMatter(await Deno.readTextFile(`${INBOX}/${e.name}`));
  const src = p?.fm.source;
  if (typeof src === "string") existingSources.add(src);
}

const hotsPath = `${ROOT}/hotspots.yaml`;
const oqsPath = `${ROOT}/open-questions.yaml`;
const hotsText = await Deno.readTextFile(hotsPath);
const oqsText = await Deno.readTextFile(oqsPath);
const hotIds: string[] = ((parseYaml(hotsText) as { hotspots?: { id: string }[] })?.hotspots ?? []).map((h) => h.id);
const oqIds: string[] = ((parseYaml(oqsText) as { open_questions?: { id: string }[] })?.open_questions ?? []).map((q) =>
  q.id
);
const existingHotStatements = new Set(
  ((parseYaml(hotsText) as { hotspots?: { statement?: string }[] })?.hotspots ?? [])
    .map((h) => String(h.statement ?? "").replace(/\s+/g, " ").trim()),
);
const existingOqQuestions = new Set(
  ((parseYaml(oqsText) as { open_questions?: { question?: string }[] })?.open_questions ?? [])
    .map((q) => String(q.question ?? "").replace(/\s+/g, " ").trim()),
);

let newHotYaml = "";
let newOqYaml = "";
let created = 0, skipped = 0, hotAdded = 0, oqAdded = 0;
const touchedDrops: string[] = [];

// ── ingest ──────────────────────────────────────────────────────────────────
for (const name of drops) {
  const path = `${DROPS}/${name}`;
  const parsed = splitFrontMatter(await Deno.readTextFile(path));
  if (!parsed) {
    console.warn(`  ! ${name}: no parseable front matter — skipped`);
    continue;
  }
  if (String(parsed.fm.status ?? "unprocessed") === "ingested") {
    continue;
  }

  // YAML parses an unquoted `date: 2026-08-08` into a JS Date, whose String() is
  // "Fri Aug 07 2026 19:00:00 GMT-0500 (...)" — and the local-time render can also roll the day
  // backwards off a UTC midnight. Always reduce to a UTC calendar day.
  const dropDate = (() => {
    const d = parsed.fm.date;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = String(d ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : name.slice(0, 10);
  })();
  const topics = Array.isArray(parsed.fm.topics) ? parsed.fm.topics.map(String) : [];
  // topics -> context dirs, only where they actually resolve
  const CONTEXT_DIRS = new Set([
    "ledger", "fulfillment", "billing", "fixed-assets", "ordering", "availability", "banking", "tax",
  ]);
  const contexts = topics.filter((t) => CONTEXT_DIRS.has(t));

  // body line numbers are offset by the front matter, so `#L<line>` points at the real line
  const fmLines = parsed.open.split("\n").length - 1 + parsed.raw.split("\n").length +
    parsed.close.split("\n").length - 1;
  const lines = parsed.body.split("\n");

  let section: Kind | null = null;
  let anyBullet = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = fmLines + i + 1;

    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      section = KIND_OF_SECTION[h[1].toLowerCase()] ?? null;
      continue;
    }

    const b = line.match(/^\s*[-*]\s+\[(\w+)\]\s*(.+?)\s*$/);
    if (!b) continue;

    const tag = b[1].toLowerCase() as Kind;
    const kind: Kind = (KINDS as readonly string[]).includes(tag) ? tag : (section ?? "finding");
    const text = b[2].trim();
    if (!text) continue;
    anyBullet = true;

    const source = `research-drop/${name}#L${lineNo}`;
    if (existingSources.has(source)) {
      skipped++;
      continue;
    }

    // ── [question] -> open-questions.yaml, owner/decide_by TBD (validator flags it) ──
    if (kind === "question") {
      const normalized = text.replace(/\s+/g, " ").trim();
      if (existingOqQuestions.has(normalized)) {
        skipped++;
        continue;
      }
      const id = nextId([...oqIds, ...newOqYaml.matchAll(/id: (OQ-\d{3})/g)].map((x) =>
        typeof x === "string" ? x : x[1]
      ), "OQ", 3);
      oqIds.push(id);
      existingOqQuestions.add(normalized);
      newOqYaml += `\n  - id: ${id}\n    question: ${yamlStr(normalized)}\n    owner: TBD\n` +
        `    decide_by: TBD\n    blocks: []\n    status: open\n    source: ${source}\n`;
      oqAdded++;
      continue;
    }

    // ── [correction] -> hotspots.yaml. NEVER edits the thing it corrects. ──
    if (kind === "correction") {
      const normalized = text.replace(/\s+/g, " ").trim();
      if (existingHotStatements.has(normalized)) {
        skipped++;
        continue;
      }
      const id = nextId([...hotIds], "HOT", 3);
      hotIds.push(id);
      existingHotStatements.add(normalized);
      const ctxYaml = contexts.length ? `[${contexts.join(", ")}]` : "[]";
      newHotYaml += `\n  - id: ${id}\n    statement: ${yamlStr(normalized)}\n` +
        `    contexts: ${ctxYaml}\n` +
        `    why_it_matters: >-\n      Ingested as a correction to existing spec. A correction never overwrites a\n` +
        `      structured file — resolve it deliberately, then supersede what it contradicts.\n` +
        `    blocks: []\n    status: open\n    source: ${source}\n`;
      hotAdded++;
      continue;
    }

    // ── everything else -> its own inbox file ──
    let slug = slugify(text);
    let file = `${INBOX}/${dropDate}-${slug}.md`;
    let n = 2;
    while (await exists(file)) file = `${INBOX}/${dropDate}-${slug}-${n++}.md`;

    const title = text.length > 100 ? text.slice(0, 97).trimEnd() + "..." : text;
    const md = `---
kind: ${kind}
title: ${yamlStr(title)}
contexts: [${contexts.join(", ")}]
source: ${source}
confidence: medium
promotes_to: []
verified: false
---

${text}
`;
    await Deno.writeTextFile(file, md);
    existingSources.add(source);
    created++;
  }

  if (!anyBullet) console.warn(`  ! ${name}: no tagged bullets found — check the format`);

  // stamp the drop: front matter only, body untouched
  let fmRaw = parsed.raw;
  fmRaw = /^status:/m.test(fmRaw)
    ? fmRaw.replace(/^status:.*$/m, "status: ingested")
    : fmRaw + "\nstatus: ingested";
  const stamp = new Date().toISOString();
  fmRaw = /^ingested_at:/m.test(fmRaw)
    ? fmRaw.replace(/^ingested_at:.*$/m, `ingested_at: ${stamp}`)
    : fmRaw + `\ningested_at: ${stamp}`;

  await Deno.writeTextFile(path, parsed.open + fmRaw + parsed.close + parsed.body);
  touchedDrops.push(name);
}

// ── append routed entries ───────────────────────────────────────────────────
if (newOqYaml) await Deno.writeTextFile(oqsPath, oqsText.replace(/\s*$/, "\n") + newOqYaml);
if (newHotYaml) await Deno.writeTextFile(hotsPath, hotsText.replace(/\s*$/, "\n") + newHotYaml);

console.log(
  `\ningested ${touchedDrops.length} drop file(s)\n` +
    `  inbox files created : ${created}\n` +
    `  open questions added: ${oqAdded}\n` +
    `  hotspots added      : ${hotAdded}\n` +
    `  already present     : ${skipped}\n`,
);
if (oqAdded) console.log("  note: new open questions have owner/decide_by TBD — `deno task validate` will flag them.\n");
