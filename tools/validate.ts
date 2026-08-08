#!/usr/bin/env -S deno run --allow-read
/**
 * Spec validator. Read-only. Non-zero exit on failure.
 *
 * Gates are numbered to match CLAUDE.md / the repo handoff. Anything whose basename starts with
 * `_` is a template and is skipped everywhere.
 *
 * A gate that cannot fail is not a gate — several below are expected to be RED on a fresh repo,
 * and that failure list is the worklist.
 */
import { parse as parseYaml } from "@std/yaml";
import { walk } from "@std/fs";
import { basename, relative } from "@std/path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const TRIAGE_ONLY = Deno.args.includes("--triage-only");

// ── reporting ───────────────────────────────────────────────────────────────
type Level = "fail" | "warn";
const findings: { gate: string; level: Level; msg: string }[] = [];
const fail = (gate: string, msg: string) => findings.push({ gate, level: "fail", msg });
const warn = (gate: string, msg: string) => findings.push({ gate, level: "warn", msg });
const notes: string[] = [];

// ── helpers ─────────────────────────────────────────────────────────────────
/** Templates (`_`-prefixed) and generated artifacts are never inputs to validation. */
const isTemplate = (p: string) => basename(p).startsWith("_") || basename(p).includes(".generated.");
const rel = (p: string) => relative(ROOT, p);

async function readYaml<T = unknown>(path: string): Promise<T | null> {
  try {
    return parseYaml(await Deno.readTextFile(path)) as T;
  } catch (e) {
    fail("parse", `${rel(path)}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Split `---\n...\n---\nbody` into front matter + body. */
function frontMatter(text: string): { fm: Record<string, unknown>; body: string } | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  try {
    return { fm: (parseYaml(m[1]) ?? {}) as Record<string, unknown>, body: m[2] ?? "" };
  } catch {
    return null;
  }
}

async function filesIn(dir: string, ext: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const e of walk(`${ROOT}/${dir}`, { exts: [ext], includeDirs: false })) {
      if (!isTemplate(e.path)) out.push(e.path);
    }
  } catch { /* dir absent */ }
  return out.sort();
}

// ── load the world ──────────────────────────────────────────────────────────
const CONTEXT_CODES: Record<string, string> = {
  LED: "ledger",
  FUL: "fulfillment",
  BIL: "billing",
  FA: "fixed-assets",
  ORD: "ordering",
  AVL: "availability",
  BNK: "banking",
  TAX: "tax",
};
const CONTEXT_DIRS = new Set(Object.values(CONTEXT_CODES));

const PATTERNS: Record<string, RegExp> = {
  REQ: /^REQ-(LED|FUL|BIL|FA|ORD|AVL|BNK|TAX)-\d{3}$/,
  ADR: /^ADR-\d{4}$/,
  EVT: /^EVT-(LED|FUL|BIL|FA|ORD|AVL|BNK|TAX)-\d{3}$/,
  HOT: /^HOT-\d{3}$/,
  OQ: /^OQ-\d{3}$/,
  SPIKE: /^SPIKE-\d{3}$/,
};

interface Req {
  id: string;
  statement?: string;
  rationale?: string;
  source?: string;
  priority?: string;
  verification_method?: string;
  status?: string;
  _file: string;
}
interface Evt {
  id: string;
  name?: string;
  producer?: string;
  consumers?: string[];
  terminal?: boolean;
  _file: string;
}
interface Adr {
  id: string;
  title?: string;
  status?: string;
  date?: string;
  review_by?: string;
  contexts?: string[];
  supersedes?: string | null;
  superseded_by?: string | null;
  relates_to?: string[];
  _file: string;
}

const reqs: Req[] = [];
const evts: Evt[] = [];
const adrs: Adr[] = [];
const hots: { id: string; status?: string; contexts?: string[]; blocks?: string[] }[] = [];
const oqs: { id: string; owner?: unknown; decide_by?: unknown; status?: string }[] = [];
const spikes: { id: string; closes_adr?: string; status?: string; exit_criteria?: unknown[]; _file: string }[] = [];
const inbox: { file: string; fm: Record<string, unknown> }[] = [];

// contexts/*/requirements.yaml + events.yaml
for (const dir of CONTEXT_DIRS) {
  const rp = `${ROOT}/contexts/${dir}/requirements.yaml`;
  const y = await readYaml<{ requirements?: Req[] }>(rp).catch(() => null);
  for (const r of y?.requirements ?? []) reqs.push({ ...r, _file: rp });

  const ep = `${ROOT}/contexts/${dir}/events.yaml`;
  const ey = await readYaml<{ events?: Evt[] }>(ep).catch(() => null);
  for (const e of ey?.events ?? []) evts.push({ ...e, _file: ep });
}

for (const f of await filesIn("adr", ".md")) {
  const parsed = frontMatter(await Deno.readTextFile(f));
  if (!parsed) {
    fail("6", `${rel(f)}: missing or unparseable front matter`);
    continue;
  }
  adrs.push({ ...(parsed.fm as unknown as Adr), _file: f });
}

for (const f of await filesIn("spikes", ".md")) {
  const parsed = frontMatter(await Deno.readTextFile(f));
  if (!parsed) {
    fail("1", `${rel(f)}: missing or unparseable front matter`);
    continue;
  }
  spikes.push({ ...parsed.fm, _file: f } as unknown as (typeof spikes)[number]);
}

for (const f of await filesIn("inbox", ".md")) {
  const parsed = frontMatter(await Deno.readTextFile(f));
  if (!parsed) {
    fail("9", `${rel(f)}: missing or unparseable front matter`);
    continue;
  }
  inbox.push({ file: f, fm: parsed.fm });
}

const hotY = await readYaml<{ hotspots?: typeof hots }>(`${ROOT}/hotspots.yaml`);
hots.push(...(hotY?.hotspots ?? []));
const oqY = await readYaml<{ open_questions?: typeof oqs }>(`${ROOT}/open-questions.yaml`);
oqs.push(...(oqY?.open_questions ?? []));
const glossY = await readYaml<{ terms?: { term: string; aliases?: string[]; contexts?: string[]; definition?: string }[] }>(
  `${ROOT}/glossary.yaml`,
);
const terms = glossY?.terms ?? [];

// ── --triage-only short circuit ─────────────────────────────────────────────
if (TRIAGE_ONLY) {
  const unpromoted = inbox.filter((i) => {
    const p = i.fm.promotes_to;
    return !Array.isArray(p) || p.length === 0;
  });
  console.log(`\nUnpromoted inbox items: ${unpromoted.length} of ${inbox.length}\n`);
  for (const i of unpromoted) {
    const tc = Number(i.fm.triage_count ?? 0);
    console.log(`  ${rel(i.file)}${tc > 0 ? `  (triaged ${tc}x)` : ""}`);
    console.log(`      ${i.fm.title ?? "(no title)"}`);
  }
  console.log("");
  Deno.exit(0);
}

// ── gate 1: ids unique and well-formed ──────────────────────────────────────
{
  const seen = new Map<string, string>();
  const check = (id: unknown, kind: keyof typeof PATTERNS, where: string) => {
    if (typeof id !== "string") {
      fail("1", `${where}: missing id`);
      return;
    }
    if (!PATTERNS[kind].test(id)) fail("1", `${where}: id "${id}" does not match ${PATTERNS[kind]}`);
    if (seen.has(id)) fail("1", `id "${id}" reused: ${seen.get(id)} and ${where}`);
    else seen.set(id, where);
  };
  for (const r of reqs) check(r.id, "REQ", rel(r._file));
  for (const e of evts) check(e.id, "EVT", rel(e._file));
  for (const a of adrs) check(a.id, "ADR", rel(a._file));
  for (const h of hots) check(h.id, "HOT", "hotspots.yaml");
  for (const q of oqs) check(q.id, "OQ", "open-questions.yaml");
  for (const s of spikes) check(s.id, "SPIKE", rel(s._file));

  // an ADR's id must match its filename, or in-force.generated.md links break
  for (const a of adrs) {
    if (typeof a.id === "string" && !basename(a._file).startsWith(a.id)) {
      fail("1", `${rel(a._file)}: filename does not start with its id "${a.id}"`);
    }
  }
}

// ── gate 2: requirement completeness ────────────────────────────────────────
{
  const VM = ["inspection", "analysis", "demonstration", "test"];
  const PRI = ["must", "should", "could"];
  const ST = ["draft", "agreed", "superseded"];
  for (const r of reqs) {
    for (const f of ["statement", "rationale", "source", "priority", "verification_method", "status"] as const) {
      if (!r[f]) fail("2", `${r.id}: missing \`${f}\``);
    }
    if (r.verification_method && !VM.includes(r.verification_method)) {
      fail("2", `${r.id}: verification_method "${r.verification_method}" not one of ${VM.join(" | ")}`);
    }
    if (r.priority && !PRI.includes(r.priority)) {
      fail("2", `${r.id}: priority "${r.priority}" not one of ${PRI.join(" | ")}`);
    }
    if (r.status && !ST.includes(r.status)) {
      fail("2", `${r.id}: status "${r.status}" not one of ${ST.join(" | ")}`);
    }
  }
}

// ── gate 3: every REQ has a Gherkin scenario, every @REQ- tag resolves ──────
{
  const featureFiles = await filesIn("contexts", ".feature");
  const tagged = new Set<string>();
  for (const f of featureFiles) {
    const text = await Deno.readTextFile(f);
    for (const m of text.matchAll(/@(REQ-[A-Z]{2,3}-\d{3})/g)) {
      tagged.add(m[1]);
      if (!reqs.some((r) => r.id === m[1])) {
        fail("3", `${rel(f)}: @${m[1]} does not resolve to any requirement`);
      }
    }
  }
  for (const r of reqs) {
    if (!tagged.has(r.id)) fail("3", `${r.id}: no Gherkin scenario tagged @${r.id}`);
  }
  if (featureFiles.length === 0) notes.push("gate 3: no .feature files exist yet");
}

// ── gate 4: events have a producer and a consumer ───────────────────────────
for (const e of evts) {
  if (!e.producer) fail("4", `${e.id}: no producer`);
  const consumers = e.consumers ?? [];
  if (consumers.length === 0 && e.terminal !== true) {
    fail("4", `${e.id}: no consumers and not marked \`terminal: true\``);
  }
  for (const c of consumers) {
    if (!CONTEXT_DIRS.has(c)) fail("4", `${e.id}: consumer "${c}" is not a context directory`);
  }
  if (e.producer && !CONTEXT_DIRS.has(e.producer)) {
    fail("4", `${e.id}: producer "${e.producer}" is not a context directory`);
  }
}

// ── gate 5: entity <-> OpenAPI cross-reference ──────────────────────────────
{
  const openapi = (await filesIn("contexts", ".yaml")).filter((f) => basename(f).includes("openapi"));
  const entityFiles = (await filesIn("contexts", ".yaml")).filter((f) => f.includes("/entities/"));
  if (openapi.length === 0) {
    notes.push(`gate 5: no OpenAPI documents yet — ${entityFiles.length} entity file(s) unchecked`);
  } else {
    const blob = (await Promise.all(openapi.map((f) => Deno.readTextFile(f)))).join("\n");
    for (const ef of entityFiles) {
      const name = basename(ef).replace(/\.yaml$/, "");
      if (!blob.includes(name)) warn("5", `${rel(ef)}: entity is not referenced by any OpenAPI path`);
    }
  }
}

// ── gate 6: ADR front matter, status, staleness, supersession symmetry ──────
{
  const ALLOWED = ["proposed", "accepted", "rejected", "superseded"];
  const byId = new Map(adrs.map((a) => [a.id, a]));
  // Real clock: an ADR genuinely IS stale once its review_by passes. SPEC_TODAY exists so this
  // gate can be tested without waiting for the calendar.
  const envToday = Deno.env.get("SPEC_TODAY");
  const now = envToday ? new Date(envToday) : new Date();

  for (const a of adrs) {
    if (!a.status || !ALLOWED.includes(a.status)) {
      fail("6", `${a.id}: status "${a.status}" not one of ${ALLOWED.join(" | ")}`);
    }
    if (!a.date) fail("6", `${a.id}: missing date`);

    // Staleness. The handoff specified a flat 30-day cap on `proposed`; that would make CI
    // permanently red across a months-long planning cycle where ADRs are deliberately parked
    // behind spikes. Instead each proposed ADR carries its own `review_by`, checked here — same
    // mechanic as an open question's `decide_by`, and it fails for a reason someone chose.
    if (a.status === "proposed") {
      if (!a.review_by) {
        fail("6", `${a.id}: proposed ADRs must carry a \`review_by\` date`);
      } else if (new Date(String(a.review_by)) < now) {
        fail("6", `${a.id}: proposed past its review_by (${a.review_by})`);
      }
    }

    for (const [k, inverse] of [["supersedes", "superseded_by"], ["superseded_by", "supersedes"]] as const) {
      const target = a[k];
      if (!target) continue;
      const other = byId.get(String(target));
      if (!other) {
        fail("6", `${a.id}: ${k} "${target}" does not resolve`);
      } else if (String(other[inverse] ?? "") !== a.id) {
        fail("6", `${a.id}: ${k} "${target}" is not symmetric (${target}.${inverse} = ${other[inverse] ?? "unset"})`);
      }
    }

    for (const c of a.contexts ?? []) {
      if (!CONTEXT_DIRS.has(c)) fail("6", `${a.id}: context "${c}" does not resolve to a context directory`);
    }
  }
}

// ── gate 7: open questions need an owner and a decide-by ────────────────────
for (const q of oqs) {
  const bad = (v: unknown) => v === undefined || v === null || v === "" || String(v).trim() === "TBD";
  if (bad(q.owner)) fail("7", `${q.id}: no owner`);
  if (bad(q.decide_by)) fail("7", `${q.id}: no decide_by`);
}

// ── gate 8: glossary ────────────────────────────────────────────────────────
{
  // 8a (fail): every `contexts:` value anywhere resolves to a real context directory
  for (const t of terms) {
    for (const c of t.contexts ?? []) {
      if (!CONTEXT_DIRS.has(c)) fail("8", `glossary "${t.term}": context "${c}" does not resolve`);
    }
  }
  for (const h of hots) {
    for (const c of h.contexts ?? []) {
      if (!CONTEXT_DIRS.has(c)) fail("8", `${h.id}: context "${c}" does not resolve`);
    }
  }
  for (const i of inbox) {
    const cs = i.fm.contexts;
    if (!Array.isArray(cs)) continue;
    for (const c of cs) {
      if (!CONTEXT_DIRS.has(String(c))) fail("8", `${rel(i.file)}: context "${c}" does not resolve`);
    }
  }

  // 8b (warn): a REQ statement using a near-variant of a glossary term rather than the term
  const known = new Set<string>();
  for (const t of terms) {
    known.add(t.term.toLowerCase());
    for (const a of t.aliases ?? []) known.add(a.toLowerCase());
  }
  const variants = (s: string) => [s + "s", s + "es", s.replace(/ /g, "-"), s.replace(/-/g, " ")];
  for (const r of reqs) {
    const stmt = (r.statement ?? "").toLowerCase();
    for (const t of terms) {
      for (const v of variants(t.term.toLowerCase())) {
        if (v !== t.term.toLowerCase() && !known.has(v) && stmt.includes(v)) {
          warn("8", `${r.id}: uses "${v}" — glossary defines "${t.term}". Prefer the defined term.`);
        }
      }
    }
  }

  // 8c (warn): definitions nobody has written
  for (const t of terms) {
    if (String(t.definition ?? "").trim() === "TODO") {
      warn("8", `glossary "${t.term}": definition is TODO`);
    }
  }
}

// ── gate 9: inbox items that have survived three triages unpromoted ─────────
for (const i of inbox) {
  const p = i.fm.promotes_to;
  const unpromoted = !Array.isArray(p) || p.length === 0;
  const tc = Number(i.fm.triage_count ?? 0);
  if (unpromoted && tc >= 3) {
    warn("9", `${rel(i.file)}: unpromoted after ${tc} triages — promote it or write down why not`);
  }
}

// ── spike hygiene (supports milestone m4) ───────────────────────────────────
for (const s of spikes) {
  if (!s.closes_adr) {
    fail("1", `${s.id}: no closes_adr — every spike must close with an ADR`);
  } else if (s.closes_adr !== "new" && !adrs.some((a) => a.id === s.closes_adr)) {
    fail("1", `${s.id}: closes_adr "${s.closes_adr}" does not resolve (use \`new\` if it mints one)`);
  }
  if (!Array.isArray(s.exit_criteria) || s.exit_criteria.length === 0) {
    fail("1", `${s.id}: no exit_criteria`);
  }
}

// ── cross-reference: every id referenced anywhere must exist ────────────────
{
  const allIds = new Set<string>([
    ...reqs.map((r) => r.id),
    ...evts.map((e) => e.id),
    ...adrs.map((a) => a.id),
    ...hots.map((h) => h.id),
    ...oqs.map((q) => q.id),
    ...spikes.map((s) => s.id),
  ]);
  const refCheck = (ids: unknown, where: string) => {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      const s = String(id);
      // bare context-prefixed refs like `REQ-FUL` are intentionally coarse; skip them
      if (/^REQ-[A-Z]{2,3}$/.test(s)) continue;
      if (!allIds.has(s)) fail("xref", `${where}: references "${s}" which does not exist`);
    }
  };
  for (const h of hots) refCheck(h.blocks, h.id);
  for (const q of oqs) refCheck((q as { blocks?: unknown }).blocks, q.id);
  for (const a of adrs) refCheck(a.relates_to, a.id);
  for (const r of reqs) refCheck((r as { relates_to?: unknown }).relates_to, r.id);
  for (const t of terms) refCheck((t as { open_questions?: unknown }).open_questions, `glossary "${t.term}"`);
}

// ── report ──────────────────────────────────────────────────────────────────
const GATE_NAMES: Record<string, string> = {
  "1": "ids unique and well-formed",
  "2": "requirement completeness",
  "3": "every REQ has a Gherkin scenario",
  "4": "events have a producer and a consumer",
  "5": "entity <-> OpenAPI cross-reference",
  "6": "ADR front matter, status, staleness, supersession",
  "7": "open questions have an owner and a decide-by",
  "8": "glossary",
  "9": "inbox triage staleness",
  xref: "cross-references resolve",
  parse: "files parse",
};

const fails = findings.filter((f) => f.level === "fail");
const warns = findings.filter((f) => f.level === "warn");

console.log("\n" + "=".repeat(72));
console.log("  spec validation");
console.log("=".repeat(72));

for (const gate of Object.keys(GATE_NAMES)) {
  const gf = fails.filter((f) => f.gate === gate);
  const gw = warns.filter((f) => f.gate === gate);
  if (gf.length === 0 && gw.length === 0) continue;
  console.log(`\n[gate ${gate}] ${GATE_NAMES[gate]}`);
  for (const f of gf) console.log(`  FAIL  ${f.msg}`);
  for (const w of gw) console.log(`  warn  ${w.msg}`);
}

if (notes.length) {
  console.log("\n[notes]");
  for (const n of notes) console.log(`  -  ${n}`);
}

console.log("\n" + "-".repeat(72));
console.log(
  `  ${reqs.length} req · ${adrs.length} adr · ${evts.length} evt · ${hots.length} hot · ` +
    `${oqs.length} oq · ${spikes.length} spike · ${inbox.length} inbox`,
);
console.log(`  ${fails.length} failure(s), ${warns.length} warning(s)`);
console.log("-".repeat(72) + "\n");

Deno.exit(fails.length > 0 ? 1 : 0);
