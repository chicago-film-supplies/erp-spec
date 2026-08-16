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
import { CHECKS, CLOCK_DEPENDENT, evaluateMilestones } from "./milestone-checks.ts";
import { CONTEXT_CODE_ALTERNATION, CONTEXT_DIRS } from "./contexts.ts";

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
const isTemplate = (p: string) =>
  basename(p).startsWith("_") || basename(p).includes(".generated.");
const rel = (p: string) => relative(ROOT, p);

/**
 * An unquoted YAML date (`decide_by: 2026-09-15`, `review_by: 2026-10-01`) parses to a JS Date, and
 * `String()` on one renders in the RUNNER's timezone — so gate 6 spent its whole life reporting
 * "ADR-0009: proposed past its review_by (Mon Sep 14 2026 19:00:00 GMT-0500)" for a date that IS
 * the 15th. Off by a day, and machine-dependent besides. `generate.ts` has carried this reduction
 * since the bug bit there; validate needs it for the same reason on the printing side, even though
 * it writes no files. **Comparing a Date is fine. Printing one is the bug.**
 */
const ymdUTC = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();

/**
 * Parsed once per path. Several gates read the same file — without the cache a single unparseable
 * vector reported its failure once per reader, which reads as several broken files.
 */
const yamlCache = new Map<string, unknown>();
async function readYaml<T = unknown>(path: string): Promise<T | null> {
  if (yamlCache.has(path)) return yamlCache.get(path) as T | null;
  let out: unknown = null;
  try {
    out = parseYaml(await Deno.readTextFile(path));
  } catch (e) {
    fail("parse", `${rel(path)}: ${e instanceof Error ? e.message : e}`);
  }
  yamlCache.set(path, out);
  return out as T | null;
}

/** Split `---\n...\n---\nbody` into front matter + body. */
function frontMatter(text: string): { fm: unknown; body: string } | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  try {
    return { fm: parseYaml(m[1]) ?? {}, body: m[2] ?? "" };
  } catch {
    return null;
  }
}

// ── front-matter decoding ───────────────────────────────────────────────────
/**
 * `parseYaml` returns `unknown` and that is the truth: a `.md` on disk can hold anything. The
 * loaders below therefore DECODE rather than assert. The previous form was
 * `{ ...parsed.fm as unknown as Adr }` — a double cast TypeScript demands precisely because the
 * two types do not overlap, which is the compiler saying the claim is unchecked.
 *
 * ⚠️ The cast was hiding a live lie. `Adr.date` and `Adr.review_by` were typed `string`, and YAML
 * parses an unquoted `date: 2026-08-08` into a **`Date`** — so every ADR's `date` was a `Date` while
 * the type said otherwise, and the call sites had grown `String(...)` and `ymdUTC(...)` wrappers to
 * cope. They are decoded to `Date` here, which is what they always were.
 */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * Elements are stringified rather than filtered, deliberately: a malformed entry must survive to
 * the gate that reports it. Dropping it would turn a bad value into a silently absent one — the
 * exact substitution `ledger/dimensions.yaml` warns about for dimensions.
 */
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x))) : [];

/** YAML gives a `Date` for an unquoted date and a `string` for a quoted one. Accept both. */
const dateVal = (v: unknown): Date | undefined => {
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  if (typeof v !== "string") return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T00:00:00Z` : v);
  return isNaN(d.getTime()) ? undefined : d;
};

/**
 * `.gitignore` is invisible to `walk()`. `spikes/harness/` installs a real node_modules tree
 * (Node-API addons need one on disk), and every package README in it is an unparseable `.md` —
 * 403 gate-1 failures the first time the harness was installed. Skip it here rather than teach
 * every gate about it.
 */
const SKIP = [/[\\/]node_modules[\\/]/, /[\\/]spikes[\\/]harness[\\/]\.(bin|data)[\\/]/];

async function filesIn(dir: string, ext: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const e of walk(`${ROOT}/${dir}`, { exts: [ext], includeDirs: false, skip: SKIP })) {
      if (!isTemplate(e.path)) out.push(e.path);
    }
  } catch { /* dir absent */ }
  return out.sort();
}

// ── load the world ──────────────────────────────────────────────────────────
// The registry lives in `tools/contexts.ts` — see the note there on why these were four
// hand-maintained lists and are now one.
const PATTERNS: Record<string, RegExp> = {
  REQ: new RegExp(`^REQ-(${CONTEXT_CODE_ALTERNATION})-\\d{3}$`),
  ADR: /^ADR-\d{4}$/,
  EVT: new RegExp(`^EVT-(${CONTEXT_CODE_ALTERNATION})-\\d{3}$`),
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
  date?: Date;
  review_by?: Date;
  contexts: string[];
  supersedes: string | null;
  superseded_by: string | null;
  relates_to: string[];
  frozen_sha256?: string;
  _file: string;
  /** Everything after the front matter. Gate 14 hashes this and nothing else. */
  _body: string;
}

function toAdr(fm: unknown, file: string, body: string): Adr | null {
  if (!isRecord(fm)) return null;
  const id = str(fm.id);
  if (id === undefined) return null;
  return {
    id,
    title: str(fm.title),
    status: str(fm.status),
    date: dateVal(fm.date),
    review_by: dateVal(fm.review_by),
    contexts: strList(fm.contexts),
    supersedes: str(fm.supersedes) ?? null,
    superseded_by: str(fm.superseded_by) ?? null,
    relates_to: strList(fm.relates_to),
    frozen_sha256: str(fm.frozen_sha256),
    _file: file,
    _body: body,
  };
}

interface Spike {
  id: string;
  closes_adr?: string;
  status?: string;
  exit_criteria: unknown[];
  _file: string;
}

function toSpike(fm: unknown, file: string): Spike | null {
  if (!isRecord(fm)) return null;
  const id = str(fm.id);
  if (id === undefined) return null;
  return {
    id,
    closes_adr: str(fm.closes_adr),
    status: str(fm.status),
    exit_criteria: Array.isArray(fm.exit_criteria) ? fm.exit_criteria : [],
    _file: file,
  };
}

/** The three keys any gate actually reads off an inbox note. */
interface InboxNote {
  file: string;
  title?: string;
  promotes_to: string[];
  contexts: string[];
}

function toInboxNote(fm: unknown, file: string): InboxNote {
  const r = isRecord(fm) ? fm : {};
  return {
    file,
    title: str(r.title),
    promotes_to: strList(r.promotes_to),
    contexts: strList(r.contexts),
  };
}

const reqs: Req[] = [];
const evts: Evt[] = [];
const adrs: Adr[] = [];
const hots: { id: string; status?: string; contexts?: string[]; blocks?: string[] }[] = [];
const oqs: { id: string; owner?: unknown; decide_by?: unknown; status?: string }[] = [];
const spikes: Spike[] = [];
const inbox: InboxNote[] = [];

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
  const adr = toAdr(parsed.fm, f, parsed.body);
  if (!adr) {
    fail("6", `${rel(f)}: front matter has no string \`id\``);
    continue;
  }
  adrs.push(adr);
}

for (const f of await filesIn("spikes", ".md")) {
  const parsed = frontMatter(await Deno.readTextFile(f));
  if (!parsed) {
    fail("1", `${rel(f)}: missing or unparseable front matter`);
    continue;
  }
  const spike = toSpike(parsed.fm, f);
  if (!spike) {
    fail("1", `${rel(f)}: front matter has no string \`id\``);
    continue;
  }
  spikes.push(spike);
}

for (const f of await filesIn("inbox", ".md")) {
  const parsed = frontMatter(await Deno.readTextFile(f));
  if (!parsed) {
    fail("9", `${rel(f)}: missing or unparseable front matter`);
    continue;
  }
  inbox.push(toInboxNote(parsed.fm, f));
}

// Parse-coverage sweep. Every structured YAML in the repo must at least PARSE, whether or not a
// gate below inspects its contents. roadmap/milestones.yaml shipped broken in the seed commit
// precisely because nothing read it — an unquoted `: ` inside a sequence scalar. A file no tool
// opens is a file with no guarantees.
for (
  const p of ["roadmap/milestones.yaml", "glossary.yaml", "hotspots.yaml", "open-questions.yaml"]
) {
  await readYaml(`${ROOT}/${p}`);
}
for await (const e of walk(`${ROOT}/ledger`, { exts: [".yaml"], includeDirs: false })) {
  if (!isTemplate(e.path)) await readYaml(e.path);
}

const hotY = await readYaml<{ hotspots?: typeof hots }>(`${ROOT}/hotspots.yaml`);
hots.push(...(hotY?.hotspots ?? []));
const oqY = await readYaml<{ open_questions?: typeof oqs }>(`${ROOT}/open-questions.yaml`);
oqs.push(...(oqY?.open_questions ?? []));
const glossY = await readYaml<
  { terms?: { term: string; aliases?: string[]; contexts?: string[]; definition?: string }[] }
>(
  `${ROOT}/glossary.yaml`,
);
const terms = glossY?.terms ?? [];

// ── --triage-only short circuit ─────────────────────────────────────────────
if (TRIAGE_ONLY) {
  const unpromoted = inbox.filter((i) => i.promotes_to.length === 0);
  console.log(`\nUnpromoted inbox items: ${unpromoted.length} of ${inbox.length}\n`);
  // Age, not `triage_count` — the counter was written as 0 and incremented by nothing, so it
  // printed the same "(triaged 0x)" for a note dropped today and one ignored for a month
  // (erp-spec#7). The date in the filename is the one age signal every inbox file carries.
  for (const i of unpromoted) {
    const m = basename(i.file).match(/^(\d{4}-\d{2}-\d{2})-/);
    const days = m
      ? Math.floor((Date.now() - new Date(`${m[1]}T00:00:00Z`).getTime()) / 86_400_000)
      : null;
    console.log(`  ${rel(i.file)}${days === null ? "" : `  (${days}d)`}`);
    console.log(`      ${i.title ?? "(no title)"}`);
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
    if (!PATTERNS[kind].test(id)) {
      fail("1", `${where}: id "${id}" does not match ${PATTERNS[kind]}`);
    }
    if (seen.has(id)) fail("1", `id "${id}" reused: ${seen.get(id)} and ${where}`);
    else seen.set(id, where);
  };
  for (const r of reqs) check(r.id, "REQ", rel(r._file));
  for (const e of evts) check(e.id, "EVT", rel(e._file));
  for (const a of adrs) check(a.id, "ADR", rel(a._file));
  for (const h of hots) check(h.id, "HOT", "hotspots.yaml");
  for (const q of oqs) check(q.id, "OQ", "open-questions.yaml");
  for (const s of spikes) check(s.id, "SPIKE", rel(s._file));

  // A spike's id must match its filename for the same reason an ADR's must: STATUS and the spec
  // map link to spikes by path, and a renamed file silently breaks every link to it. ADRs have
  // had this check since the start; spikes never did.
  for (const s of spikes) {
    if (!basename(s._file).startsWith(s.id)) {
      fail("1", `${rel(s._file)}: filename does not start with its id "${s.id}"`);
    }
  }

  // an ADR's id must match its filename, or in-force.generated.md links break
  for (const a of adrs) {
    if (!basename(a._file).startsWith(a.id)) {
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
    for (
      const f of [
        "statement",
        "rationale",
        "source",
        "priority",
        "verification_method",
        "status",
      ] as const
    ) {
      if (!r[f]) fail("2", `${r.id}: missing \`${f}\``);
    }
    if (r.verification_method && !VM.includes(r.verification_method)) {
      fail(
        "2",
        `${r.id}: verification_method "${r.verification_method}" not one of ${VM.join(" | ")}`,
      );
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
  const openapi = (await filesIn("contexts", ".yaml")).filter((f) =>
    basename(f).includes("openapi")
  );
  const entityFiles = (await filesIn("contexts", ".yaml")).filter((f) => f.includes("/entities/"));
  if (openapi.length === 0) {
    notes.push(`gate 5: no OpenAPI documents yet — ${entityFiles.length} entity file(s) unchecked`);
  } else {
    const blob = (await Promise.all(openapi.map((f) => Deno.readTextFile(f)))).join("\n");
    for (const ef of entityFiles) {
      const name = basename(ef).replace(/\.yaml$/, "");
      if (!blob.includes(name)) {
        warn("5", `${rel(ef)}: entity is not referenced by any OpenAPI path`);
      }
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
      } else if (a.review_by < now) {
        fail("6", `${a.id}: proposed past its review_by (${ymdUTC(a.review_by)})`);
      }
    }

    for (
      const [k, inverse] of [["supersedes", "superseded_by"], [
        "superseded_by",
        "supersedes",
      ]] as const
    ) {
      const target = a[k];
      if (!target) continue;
      const other = byId.get(String(target));
      if (!other) {
        fail("6", `${a.id}: ${k} "${target}" does not resolve`);
      } else if (String(other[inverse] ?? "") !== a.id) {
        fail(
          "6",
          `${a.id}: ${k} "${target}" is not symmetric (${target}.${inverse} = ${
            other[inverse] ?? "unset"
          })`,
        );
      }
    }

    for (const c of a.contexts ?? []) {
      if (!CONTEXT_DIRS.has(c)) {
        fail("6", `${a.id}: context "${c}" does not resolve to a context directory`);
      }
    }
  }
}

// ── gate 14: an accepted ADR's body is frozen ───────────────────────────────
/**
 * ADR-0034 decides that an accepted ADR is a historical record of the decision as taken, and that
 * its body is never edited — corrections live in `inbox/` and `hotspots.yaml`, and superseding is
 * reserved for actually re-deciding. That was a convention, and this repo's standing rule is that
 * **a stated guarantee nothing executes is not a guarantee**.
 *
 * So: the body's SHA-256 is recorded in front matter when the ADR is accepted, and recomputed here.
 * Editing a frozen body turns CI red, and the only way to dismiss it is to update the hash in the
 * same commit — which makes the edit a deliberate, reviewable line in the diff rather than a silent
 * rewrite of the record.
 *
 * **Front matter is deliberately NOT hashed.** ADR-0034 permits `relates_to` to gain ids — it is
 * an index, not a claim, and it is where a later correction is linked from. `status` and
 * `superseded_by` must also be writable, or superseding an ADR would trip the gate that protects
 * it. Only the prose below the `---` is frozen.
 *
 * `superseded` counts as frozen: it was accepted once, and its body is the record of that.
 */
{
  const FROZEN = new Set(["accepted", "superseded"]);
  const enc = new TextEncoder();
  for (const a of adrs) {
    if (!FROZEN.has(a.status ?? "")) continue;
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(a._body));
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (!a.frozen_sha256) {
      fail(
        "14",
        `${a.id}: status "${a.status}" but no \`frozen_sha256\`. If the body is correct, add:  frozen_sha256: ${hash}`,
      );
    } else if (a.frozen_sha256 !== hash) {
      fail(
        "14",
        `${a.id}: body edited since acceptance — front matter says ${
          a.frozen_sha256.slice(0, 12)
        }…, body hashes to ${
          hash.slice(0, 12)
        }…. ADR-0034: an accepted body is never edited. Revert it, or supersede the ADR.`,
      );
    }
  }
}

// ── gate 7: open questions need an owner, a decide-by, and a status that means something ────
/**
 * erp-spec#7: this gate checked only that the two fields were PRESENT. It never read `status` and
 * never compared `decide_by` to today — so an open question could sail past its date forever with
 * CI green, and a question could claim `answered` while carrying no answer. Gate 6 has done the
 * date comparison for an ADR's `review_by` since the beginning, `SPEC_TODAY` and all; this is the
 * same mechanic on the other deadline.
 *
 * Time-dependent judgement lives HERE and not in `generate.ts`, which may read no clock — so
 * STATUS lists open questions soonest-first and says nothing about overdue, and this decides it.
 */
{
  const OQ_STATUS = ["open", "answered", "dropped"];
  const envToday = Deno.env.get("SPEC_TODAY");
  const now = envToday ? new Date(envToday) : new Date();
  const bad = (v: unknown) =>
    v === undefined || v === null || v === "" || String(v).trim() === "TBD";

  for (const q of oqs) {
    if (bad(q.owner)) fail("7", `${q.id}: no owner`);
    if (bad(q.decide_by)) fail("7", `${q.id}: no decide_by`);

    const status = String((q as { status?: unknown }).status ?? "open");
    if (!OQ_STATUS.includes(status)) {
      fail("7", `${q.id}: status "${status}" not one of ${OQ_STATUS.join(" | ")}`);
    }
    // An `answered` with no answer is the same defect class as a spike `closed` with
    // `closes_adr: new` — a status asserting a conclusion nobody wrote down.
    if (status === "answered" && bad((q as { answer?: unknown }).answer)) {
      fail(
        "7",
        `${q.id}: status answered but no \`answer\` — the status asserts a conclusion nobody wrote`,
      );
    }
    if (status === "dropped" && bad((q as { notes?: unknown }).notes)) {
      fail("7", `${q.id}: status dropped with no \`notes\` saying why it stopped mattering`);
    }
    if (status === "open" && !bad(q.decide_by) && new Date(String(q.decide_by)) < now) {
      fail(
        "7",
        `${q.id}: still open and past its decide_by (${
          ymdUTC(q.decide_by)
        }) — decide it, drop it, or move the date deliberately`,
      );
    }
  }
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
    for (const c of i.contexts) {
      if (!CONTEXT_DIRS.has(c)) {
        fail("8", `${rel(i.file)}: context "${c}" does not resolve`);
      }
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
          warn(
            "8",
            `${r.id}: uses "${v}" — glossary defines "${t.term}". Prefer the defined term.`,
          );
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

// ── gate 9: inbox items left unpromoted too long ────────────────────────────
/**
 * erp-spec#7: this gate warned when `triage_count >= 3`, and **`triage_count` is written as 0 by
 * `tools/ingest.ts` and incremented by nothing**. The condition could never be true, so 27
 * unpromoted notes generated exactly zero pressure while the gate reported green.
 *
 * Re-based on the note's AGE, taken from its filename — the one date every inbox file carries.
 * The alternative was to have `deno task triage` increment the counter, which would have cost the
 * property that makes validate trustworthy: it writes nothing, and therefore may read the real
 * clock. Age keeps that.
 *
 * ⚠️ **This cannot fire until 2026-08-22**, because the oldest note in the repo is dated
 * 2026-08-08. It is landed knowingly green rather than proven red on real data — the exception to
 * this repo's usual rule, and the reason is that a two-day-old corpus has nothing stale in it yet.
 * What IS proven is that it bites: `SPEC_TODAY=2026-09-01 deno task validate` warns on all 27.
 * A gate that cannot fire yet beats a gate that can never fire.
 */
{
  const STALE_DAYS = 14;
  const envToday = Deno.env.get("SPEC_TODAY");
  const now = envToday ? new Date(envToday) : new Date();
  for (const i of inbox) {
    if (i.promotes_to.length > 0) continue;
    const m = basename(i.file).match(/^(\d{4}-\d{2}-\d{2})-/);
    if (!m) {
      warn("9", `${rel(i.file)}: filename does not start with a date, so its age cannot be judged`);
      continue;
    }
    const days = Math.floor((now.getTime() - new Date(`${m[1]}T00:00:00Z`).getTime()) / 86_400_000);
    if (days >= STALE_DAYS) {
      warn("9", `${rel(i.file)}: unpromoted after ${days} days — promote it or write down why not`);
    }
  }
}

// ── spike hygiene (supports milestone m4) ───────────────────────────────────
{
  // The enum existed only as a comment in `spikes/_TEMPLATE.md`. A typo'd status passed CI and
  // then read as OPEN everywhere downstream, because generate.ts counts `(status ?? "open") !==
  // "closed"` — so `status: closd` silently kept a finished spike on the open list forever.
  const SPIKE_STATUS = ["open", "in_progress", "closed", "abandoned"];

  for (const s of spikes) {
    if (!s.status || !SPIKE_STATUS.includes(String(s.status))) {
      fail("1", `${s.id}: status "${s.status}" not one of ${SPIKE_STATUS.join(" | ")}`);
    }
    if (!s.closes_adr) {
      fail("1", `${s.id}: no closes_adr — every spike must close with an ADR`);
    } else if (s.closes_adr !== "new" && !adrs.some((a) => a.id === s.closes_adr)) {
      fail(
        "1",
        `${s.id}: closes_adr "${s.closes_adr}" does not resolve (use \`new\` if it mints one)`,
      );
    }
    // Milestone m4: "every SPIKE- has status closed and names the ADR it produced". `new` is a
    // placeholder for a spike still in flight; at close it must have been replaced by the real id,
    // or m4's criterion is satisfied by a spike that names nothing. Enforced by nothing until now.
    if (String(s.status) === "closed" && s.closes_adr === "new") {
      fail(
        "1",
        `${s.id}: closed with \`closes_adr: new\` — a closed spike must name the ADR it produced (m4)`,
      );
    }
    if (!Array.isArray(s.exit_criteria) || s.exit_criteria.length === 0) {
      fail("1", `${s.id}: no exit_criteria`);
    }
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
  // `blocked_by` on an event was covered by nothing — `blocked_by: [SPIKE-999]` passed. It is the
  // field that decides what the event storm is waiting on, so a typo there quietly detaches an
  // event from the spike or question that actually gates it.
  for (const e of evts) refCheck((e as { blocked_by?: unknown }).blocked_by, e.id);
  for (const q of oqs) refCheck((q as { blocks?: unknown }).blocks, q.id);
  for (const a of adrs) refCheck(a.relates_to, a.id);
  for (const r of reqs) refCheck((r as { relates_to?: unknown }).relates_to, r.id);
  for (const t of terms) {
    refCheck((t as { open_questions?: unknown }).open_questions, `glossary "${t.term}"`);
  }
}

// ── gate 10: ledger content ─────────────────────────────────────────────────
/**
 * `ledger/` was parse-checked only — nothing read the contents, which is why an invented account
 * code sat in collision with a live one, a deleted posting rule's account outlived it, and a file
 * blocked on a superseded ADR went unnoticed. Its own comment said "A file no tool opens is a file
 * with no guarantees"; the ledger was that file.
 */
{
  const G = "10";
  const CLASSES = ["asset", "liability", "equity", "revenue", "expense"];
  const DISPOSITIONS = ["adopt", "rename", "merge", "drop", "new", "undecided"];
  const RULE_STATUS = ["specified", "blocked", "unwritten"];

  interface Account {
    code?: number;
    name?: string;
    class?: string;
    normal_balance?: string;
    contra?: boolean;
    dimensions?: unknown;
    disposition?: string;
    status_live?: string;
    class_live?: string;
    merge_into?: number;
    reason?: string;
    blocked_by?: string[];
    source?: string;
    note?: string;
  }

  const coaY = await readYaml<{ accounts?: Account[] }>(`${ROOT}/ledger/chart-of-accounts.yaml`);
  const accounts = coaY?.accounts ?? [];
  const byCode = new Map<number, Account>();

  // Is a referenced blocker genuinely still open? A rule that stays "blocked" after its blocker
  // closes is the failure this exists to catch — and it cannot be caught by reading the rule alone.
  const isOpenBlocker = (id: string): boolean | null => {
    const q = oqs.find((x) => x.id === id);
    if (q) return String(q.status ?? "open") !== "answered";
    const s = spikes.find((x) => x.id === id);
    if (s) return !["closed", "abandoned"].includes(String(s.status ?? "open"));
    const h = hots.find((x) => x.id === id);
    if (h) return String(h.status ?? "open") !== "resolved";
    return null; // does not resolve at all
  };

  const checkBlockers = (ids: unknown, where: string) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      fail(G, `${where}: needs a non-empty \`blocked_by\``);
      return;
    }
    for (const raw of ids) {
      const id = String(raw);
      if (!/^(OQ|SPIKE|HOT)-\d{3}$/.test(id)) {
        fail(G, `${where}: blocker "${id}" is not an OQ-/SPIKE-/HOT- id`);
        continue;
      }
      const open = isOpenBlocker(id);
      if (open === null) fail(G, `${where}: blocker "${id}" does not resolve`);
      else if (!open) {
        fail(G, `${where}: blocker "${id}" is no longer open — the block has expired`);
      }
    }
  };

  // 10a — account well-formedness
  for (const [i, a] of accounts.entries()) {
    const where = `chart-of-accounts[${i}] (code ${a.code ?? "?"})`;
    for (const f of ["code", "name", "class", "normal_balance", "disposition", "source"] as const) {
      if (a[f] === undefined || a[f] === null || a[f] === "") fail(G, `${where}: missing \`${f}\``);
    }
    if (a.dimensions === undefined) fail(G, `${where}: missing \`dimensions\``);
    if (typeof a.code !== "number" || !Number.isInteger(a.code)) {
      fail(G, `${where}: \`code\` must be an integer`);
    } else if (byCode.has(a.code)) {
      fail(G, `chart-of-accounts: code ${a.code} is duplicated`);
    } else byCode.set(a.code, a);

    if (/^TODO$/i.test(String(a.name ?? "").trim())) {
      fail(G, `${where}: name is "TODO" — an account nobody has identified is not a chart entry`);
    }
    if (a.class && !CLASSES.includes(a.class)) {
      fail(G, `${where}: class "${a.class}" not one of ${CLASSES.join(" | ")}`);
    }
    if (a.normal_balance && !["debit", "credit"].includes(a.normal_balance)) {
      fail(G, `${where}: normal_balance "${a.normal_balance}" not debit | credit`);
    }
    if (a.disposition && !DISPOSITIONS.includes(a.disposition)) {
      fail(G, `${where}: disposition "${a.disposition}" not one of ${DISPOSITIONS.join(" | ")}`);
    }
    if (
      a.dimensions !== undefined && !Array.isArray(a.dimensions) && a.dimensions !== "undecided"
    ) {
      fail(G, `${where}: dimensions must be a list of dimension ids, or \`undecided\``);
    }

    // 10b — normal_balance follows class, inverted by `contra`. Both arms are exercised by the
    // live chart (6 accumulated-depreciation accounts + 5001 + 3200 are contra), so this is not
    // vacuous in either direction.
    if (a.class && a.normal_balance) {
      const natural = ["asset", "expense"].includes(a.class) ? "debit" : "credit";
      const expected = a.contra === true ? (natural === "debit" ? "credit" : "debit") : natural;
      if (a.normal_balance !== expected) {
        fail(
          G,
          `${where}: class "${a.class}"${
            a.contra ? " with contra: true" : ""
          } implies normal_balance ` +
            `"${expected}", found "${a.normal_balance}"`,
        );
      }
    }

    // 10c — a disposition that removes or defers an account must say why
    if (a.disposition === "drop" && !a.reason) fail(G, `${where}: \`drop\` requires a \`reason\``);
    if (a.disposition === "new" && !a.reason) fail(G, `${where}: \`new\` requires a \`reason\``);
    if (a.disposition === "merge") {
      if (!a.reason) fail(G, `${where}: \`merge\` requires a \`reason\``);
      if (a.merge_into === undefined) fail(G, `${where}: \`merge\` requires \`merge_into\``);
    }
    // `undecided` may sit on the disposition or on `dimensioned`; either way it owes a live blocker.
    if (a.disposition === "undecided" || a.dimensions === "undecided") {
      if (!a.reason) fail(G, `${where}: \`undecided\` requires a \`reason\``);
      checkBlockers(a.blocked_by, where);
    }
    // A reclassification against the live chart must be loud, or it is a silent restatement.
    if (a.class_live !== undefined) {
      if (String(a.class_live).toLowerCase() === String(a.class).toLowerCase()) {
        fail(G, `${where}: \`class_live\` equals \`class\` — drop it, it records no difference`);
      } else if (!a.note) {
        fail(
          G,
          `${where}: \`class_live\` differs from \`class\` and needs a \`note\` explaining the correction`,
        );
      }
    }
    // 10d — source form. An undated claim silently becomes a lie.
    if (
      a.source && !/^(api|code):\d{4}-\d{2}-\d{2}:/.test(a.source) && !/^ADR-\d{4}$/.test(a.source)
    ) {
      fail(
        G,
        `${where}: source "${a.source}" is not \`api:<date>:<query>\`, \`code:<date>:<pin>\` or an ADR id`,
      );
    }
  }
  for (const a of accounts) {
    if (a.disposition === "merge" && a.merge_into !== undefined && !byCode.has(a.merge_into)) {
      fail(
        G,
        `chart-of-accounts code ${a.code}: merge_into ${a.merge_into} does not resolve to an account`,
      );
    }
  }

  // ── posting rules ─────────────────────────────────────────────────────────
  interface Rule {
    id?: string;
    status?: string;
    trigger?: { event?: string; source_document?: string };
    accounting_date?: string;
    posting_timestamp?: string;
    postings?: {
      debit_account?: unknown;
      credit_account?: unknown;
      amount?: string;
      dimensions?: unknown;
    }[];
    no_postings_reason?: string;
    control_total?: string | null;
    blocked_by?: string[];
  }
  const prY = await readYaml<{
    rules?: Rule[];
    no_posting?: { event?: string; reason?: string }[];
    unwritten?: { event?: string; issue?: string; proposed_rule?: string }[];
  }>(`${ROOT}/ledger/posting-rules.yaml`);
  const rules = prY?.rules ?? [];
  const noPosting = prY?.no_posting ?? [];
  const unwritten = prY?.unwritten ?? [];
  const ruleById = new Map<string, Rule>();

  const CLOCK_WORDS = /\b(now|today|current_date|current_timestamp|sysdate)\b/i;

  for (const r of rules) {
    const where = `posting-rules "${r.id ?? "(no id)"}"`;
    if (!r.id || !/^[a-z][a-z0-9_]*$/.test(r.id)) fail(G, `${where}: id must be snake_case`);
    else if (ruleById.has(r.id)) fail(G, `posting-rules: rule id "${r.id}" is duplicated`);
    else ruleById.set(r.id, r);

    if (!r.status || !RULE_STATUS.includes(r.status)) {
      fail(G, `${where}: status "${r.status}" not one of ${RULE_STATUS.join(" | ")}`);
    }
    const ev = r.trigger?.event;
    if (!ev) fail(G, `${where}: no trigger.event`);
    else if (!evts.some((e) => e.id === ev)) {
      fail(G, `${where}: trigger.event "${ev}" does not resolve`);
    }
    if (!r.trigger?.source_document) fail(G, `${where}: no trigger.source_document`);

    // CLAUDE.md rule 8, executable for the first time.
    if (!r.accounting_date) fail(G, `${where}: no \`accounting_date\``);
    else if (CLOCK_WORDS.test(r.accounting_date)) {
      fail(
        G,
        `${where}: accounting_date "${r.accounting_date}" reads a clock — it must name a field of the source document`,
      );
    }
    if (r.posting_timestamp !== "assigned_by_ledger") {
      fail(G, `${where}: posting_timestamp must be the literal \`assigned_by_ledger\` (ADR-0010)`);
    }

    if (r.status === "blocked") {
      checkBlockers(r.blocked_by, where);
      if ((r.postings ?? []).length > 0) {
        fail(
          G,
          `${where}: blocked rules must have \`postings: []\` — a guessed posting will be believed`,
        );
      }
    }
    if (r.status === "specified" && (r.postings ?? []).length === 0 && !r.no_postings_reason) {
      fail(G, `${where}: specified with no postings and no \`no_postings_reason\``);
    }

    // 10e — no arithmetic in an amount. Every rounding decision stays upstream.
    for (const [j, p] of (r.postings ?? []).entries()) {
      const amt = String(p.amount ?? "");
      if (!amt) fail(G, `${where} posting[${j}]: no \`amount\``);
      else if (!/^[a-z_][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(amt)) {
        fail(G, `${where} posting[${j}]: amount "${amt}" must be a dotted path with no arithmetic`);
      }
      for (const side of ["debit_account", "credit_account"] as const) {
        const v = p[side];
        if (v === undefined) fail(G, `${where} posting[${j}]: no \`${side}\``);
        else if (typeof v === "number" && !byCode.has(v)) {
          fail(G, `${where} posting[${j}]: ${side} ${v} is not an account in the chart`);
        }
      }
    }
  }

  // 10f — coverage. Every event the ledger produces or consumes lands in exactly one bucket.
  // This is what makes m3's "posting rules for every source document type" falsifiable: the
  // previous revision named six rules in a comment against 24 real events.
  {
    const ledgerEvents = evts.filter((e) =>
      e.producer === "ledger" || (e.consumers ?? []).includes("ledger")
    );
    const seen = new Map<string, string[]>();
    const claim = (id: unknown, bucket: string) => {
      const s = String(id ?? "");
      if (!s) return;
      seen.set(s, [...(seen.get(s) ?? []), bucket]);
    };
    for (const r of rules) claim(r.trigger?.event, `rule "${r.id}"`);
    for (const n of noPosting) claim(n.event, "no_posting");
    for (const u of unwritten) claim(u.event, "unwritten");

    for (const e of ledgerEvents) {
      const buckets = seen.get(e.id) ?? [];
      if (buckets.length === 0) {
        fail(
          G,
          `${e.id} (${e.name}) reaches the ledger but has no posting rule, no_posting entry or unwritten entry`,
        );
      } else if (buckets.length > 1) {
        fail(G, `${e.id} appears in more than one bucket: ${buckets.join(", ")}`);
      }
    }
    for (const [id] of seen) {
      if (!evts.some((e) => e.id === id)) {
        fail(G, `posting-rules references event "${id}" which does not exist`);
      } else if (!ledgerEvents.some((e) => e.id === id)) {
        fail(
          G,
          `posting-rules covers "${id}", which neither produces to nor consumes from the ledger`,
        );
      }
    }
    for (const n of noPosting) {
      if (!n.reason) fail(G, `no_posting "${n.event}": needs a \`reason\``);
    }
    // `unwritten` is the honest bucket, not a dumping ground — each entry owes a tracked issue.
    for (const u of unwritten) {
      if (!u.issue || !/^[\w.-]+#\d+$/.test(String(u.issue))) {
        fail(G, `unwritten "${u.event}": needs an \`issue\` like \`erp-spec#5\``);
      }
    }
  }

  // ── golden vectors ────────────────────────────────────────────────────────
  interface Vector {
    name?: string;
    posting_rule?: string;
    kind?: string;
    source?: string;
    differs_from?: string;
    differs_in?: string[];
    given?: Record<string, unknown>;
    expect?: { transfers?: Record<string, unknown>[]; rejects?: unknown[] };
    _file: string;
  }
  const vectors: Vector[] = [];
  for (const f of await filesIn("ledger/vectors", ".yaml")) {
    const y = await readYaml<Vector>(f);
    if (y) vectors.push({ ...y, _file: f });
  }

  const dimY = await readYaml<
    { dimensions?: { id?: string; values?: string[]; required_on?: string[] }[] }
  >(
    `${ROOT}/ledger/dimensions.yaml`,
  );
  const dimValues = new Map<string, Set<string>>();
  for (const d of dimY?.dimensions ?? []) {
    if (d.id) dimValues.set(d.id, new Set(d.values ?? []));
  }

  // Every dimension an account demands must be a dimension that exists. Without this the chart
  // could require `cost_typ` forever and no vector would ever be asked for it.
  for (const a of accounts) {
    if (!Array.isArray(a.dimensions)) continue;
    for (const d of a.dimensions) {
      if (!dimValues.has(String(d))) {
        fail(
          G,
          `chart-of-accounts code ${a.code}: requires dimension "${d}", which ledger/dimensions.yaml does not define`,
        );
      }
    }
  }

  /** Resolve `a.b[0].c` inside a plain object. Returns `undefined` for any missing step. */
  const at = (obj: unknown, path: string): unknown => {
    let cur: unknown = obj;
    for (const seg of path.split(".")) {
      const m = seg.match(/^([^[\]]+)((\[\d+\])*)$/);
      if (!m) return undefined;
      if (cur === null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[m[1]];
      for (const idx of m[2].matchAll(/\[(\d+)\]/g)) {
        if (!Array.isArray(cur)) return undefined;
        cur = cur[Number(idx[1])];
      }
    }
    return cur;
  };

  const byRuleVectors = new Map<string, Vector[]>();
  for (const v of vectors) {
    const where = rel(v._file);
    const dir = basename(v._file.replace(/\/[^/]+$/, ""));

    if (!v.name) fail(G, `${where}: no \`name\``);
    if (!v.source) fail(G, `${where}: no \`source\` — a vector with no provenance is a fixture`);
    if (!v.kind || !["accept", "reject"].includes(v.kind)) {
      fail(G, `${where}: kind "${v.kind}" not accept | reject`);
    }
    const rid = v.posting_rule;
    if (!rid) fail(G, `${where}: no \`posting_rule\``);
    else if (!ruleById.has(rid)) fail(G, `${where}: posting_rule "${rid}" does not resolve`);
    else if (dir !== rid) {
      fail(G, `${where}: lives in ledger/vectors/${dir}/ but names rule "${rid}"`);
    }
    if (rid) byRuleVectors.set(rid, [...(byRuleVectors.get(rid) ?? []), v]);

    const transfers = v.expect?.transfers ?? [];
    const rejects = (v.expect?.rejects ?? []) as unknown[];
    if (v.kind === "accept" && rejects.length > 0) {
      fail(G, `${where}: an accept vector must expect no rejects`);
    }
    if (v.kind === "reject") {
      if (rejects.length === 0) {
        fail(G, `${where}: a reject vector must state at least one \`rejects\` reason`);
      }
      if (transfers.length > 0) {
        fail(G, `${where}: a reject vector must expect no transfers — refusal is all-or-nothing`);
      }
    }

    // 10g — every account a vector names must exist in the chart.
    for (const [j, t] of transfers.entries()) {
      // 10m — a transfer amount is never zero. A TigerBeetle transfer carries a non-zero amount, so
      // a zero-value leg is an ABSENCE and writing one is a different claim from omitting it: a
      // fully depreciated asset is disposed of with one relief leg, not two. Scoped to transfers on
      // purpose — 10l's walker must keep allowing a zero `control_total` or a zero
      // `capitalised_minor`, which is how `asset_basis_adjusted` says a §179 election posts nothing.
      // Landed red against a deliberately zero-amount leg in
      // `asset_disposed/fully-depreciated-scrap-writes-one-transfer`, which 10i could not see: a
      // zero adds nothing to the control total, so the sum still matched.
      if (t.amount_minor === 0) {
        fail(
          G,
          `${where} transfer[${j}]: amount_minor is 0 — a zero-value leg is an absence, not a transfer; omit it`,
        );
      }
      for (const side of ["debit_account", "credit_account"] as const) {
        const c = t[side];
        if (typeof c !== "number") fail(G, `${where} transfer[${j}]: ${side} must be a GL code`);
        else if (!byCode.has(c)) {
          fail(G, `${where} transfer[${j}]: ${side} ${c} is not an account in the chart`);
        }
      }
      // 10h — dimension obligation. The requirement is READ OFF each account's own `dimensions`
      // list, never inferred from its class: `cost_type` describes labour and applies to 5800
      // alone, so "is this COGS" is not a rule that can produce the right answer.
      const sides = [t.debit_account, t.credit_account].map((c) => byCode.get(Number(c))).filter(
        Boolean,
      ) as Account[];
      const undecided = sides.some((a) => a.dimensions === "undecided");
      if (!undecided) {
        const required = new Set<string>();
        for (const a of sides) {
          for (const d of Array.isArray(a.dimensions) ? a.dimensions : []) required.add(String(d));
        }
        for (const dim of dimValues.keys()) {
          // ABSENT vs NULL is the whole distinction, and it is not a nicety. The 28.7% of untracked
          // revenue came from postings where nobody decided; an explicit `null` IS a decision —
          // "no tracked value applies" — and is countable, reportable and auditable. So a missing
          // KEY is refused and a null VALUE is recorded. An empty string is neither: it satisfies
          // a naive NOT NULL check while meaning nothing, so it stays refused.
          const declared = Object.prototype.hasOwnProperty.call(t, dim);
          if (required.has(dim) && !declared) {
            fail(
              G,
              `${where} transfer[${j}]: posts to a dimensioned account but does not declare \`${dim}\` — absence is refused; an explicit null is not (REQ-LED-001)`,
            );
          }
          if (!required.has(dim) && declared) {
            fail(G, `${where} transfer[${j}]: declares \`${dim}\` but neither account requires it`);
          }
          if (declared && t[dim] !== null) {
            if (String(t[dim]) === "") {
              fail(
                G,
                `${where} transfer[${j}]: ${dim} is the empty string — write an explicit null to record that none applies`,
              );
            } else if (!dimValues.get(dim)!.has(String(t[dim]))) {
              fail(
                G,
                `${where} transfer[${j}]: ${dim} "${
                  t[dim]
                }" is not a declared value in ledger/dimensions.yaml`,
              );
            }
          }
        }
      }
    }

    // 10i — control total. THIS is the balance check, and unlike "Σ debits == Σ credits" it can
    // fail: the target is a field of the source document named by the RULE, not by this vector.
    // (Σ debits == Σ credits is vacuous here — every transfer is a {debit, credit, amount} triple,
    // so it contributes the same amount to both sides for any input whatsoever. Do not add it.)
    if (v.kind === "accept" && rid) {
      const ct = ruleById.get(rid)?.control_total;
      if (ct) {
        const target = at(v.given, ct);
        if (typeof target !== "number") {
          fail(
            G,
            `${where}: rule declares control_total "${ct}" but the vector's \`given\` has no number there`,
          );
        } else {
          const sum = transfers.reduce((n, t) => n + Number(t.amount_minor ?? 0), 0);
          if (sum !== target) {
            fail(G, `${where}: transfers sum to ${sum} but control_total ${ct} is ${target}`);
          }
        }
      } else if (transfers.length > 0) {
        warn(G, `${where}: rule "${rid}" declares no control_total, so the amounts are unchecked`);
      }
    }

    // 10j — reject vectors are minimal pairs. A reject sharing nothing with an accept proves only
    // that SOMETHING was refused, not that the rule discriminates on the field it claims to.
    if (v.kind === "reject") {
      const base = (byRuleVectors.get(rid ?? "") ?? vectors).find(
        (x) => x.name === v.differs_from && x.posting_rule === rid,
      ) ?? vectors.find((x) => x.name === v.differs_from && x.posting_rule === rid);
      if (!v.differs_from) fail(G, `${where}: a reject vector must name \`differs_from\``);
      else if (!base) {
        fail(G, `${where}: differs_from "${v.differs_from}" is not a vector of rule "${rid}"`);
      } else if (base.kind !== "accept") {
        fail(G, `${where}: differs_from "${v.differs_from}" is not an accept vector`);
      }
      if (!Array.isArray(v.differs_in) || v.differs_in.length === 0) {
        fail(G, `${where}: a reject vector must name \`differs_in\``);
      } else if (base) {
        for (const p of v.differs_in) {
          const a = JSON.stringify(at(base.given, p) ?? null);
          const b = JSON.stringify(at(v.given, p) ?? null);
          if (a === b) {
            fail(
              G,
              `${where}: declares it differs in "${p}", but that path is identical in "${v.differs_from}"`,
            );
          }
        }
      }
    }
  }

  // 10k — vector coverage per rule status.
  for (const r of rules) {
    const vs = byRuleVectors.get(r.id ?? "") ?? [];
    if (r.status === "specified") {
      if (!vs.some((v) => v.kind === "accept")) {
        fail(G, `posting-rules "${r.id}": specified with no accept vector`);
      }
      if (!vs.some((v) => v.kind === "reject")) {
        fail(
          G,
          `posting-rules "${r.id}": specified with no REJECT vector — the failure cases are the enforcement`,
        );
      }
    } else if (vs.length > 0) {
      fail(G, `posting-rules "${r.id}": status ${r.status} but has ${vs.length} vector(s)`);
    }
  }

  // 10l — money and dates, across every YAML under ledger/.
  // A `*_minor` that is a float or a string, or ANY parsed Date, is the bug class this repo has
  // already paid for: YAML turns an unquoted `2026-08-08` into a JS Date whose String() renders in
  // the runner's timezone.
  {
    const walkValue = (node: unknown, path: string, where: string) => {
      if (node instanceof Date) {
        fail(
          G,
          `${where}: ${path} parsed as a Date — quote it, or it renders in the runner's timezone`,
        );
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walkValue(v, `${path}[${i}]`, where));
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/_minor$/.test(k) && v !== null && v !== undefined) {
            if (typeof v !== "number" || !Number.isInteger(v)) {
              fail(
                G,
                `${where}: ${path}.${k} = ${
                  JSON.stringify(v)
                } — money is an integer count of minor units`,
              );
            } else if (v < 0) {
              fail(
                G,
                `${where}: ${path}.${k} is negative — use the opposite side, not a negative amount`,
              );
            }
          }
          walkValue(v, `${path}.${k}`, where);
        }
      }
    };
    for (const f of await filesIn("ledger", ".yaml")) {
      const y = await readYaml(f);
      if (y) walkValue(y, "$", rel(f));
    }
  }
}

// ── gate 11: repo paths cited in prose resolve ──────────────────────────────
/**
 * erp-spec#4: nothing verified that a path named from an ADR or a spike still exists, which is how
 * ADR-0003 kept pointing at `formal/two-store-commit.tla` through the Quint migration that deleted
 * it. Only repo-rooted paths are checked — a bare `matrix.ts` in prose is not a claim about a
 * location.
 */
{
  const G = "11";
  const TOP =
    /^(adr|contexts|formal|inbox|ledger|migration|reporting|research-drop|roadmap|spikes|tools|traceability)\//;

  /**
   * Each exemption states WHY the dead path is allowed to stand, and is itself checked: if the
   * path comes back, the exemption fails. An allowlist that cannot expire is how a gate rots into
   * decoration.
   */
  const EXEMPT: { file: string; path: string; why: string }[] = [
    {
      file: "adr/ADR-0003-mongodb-documents-tigerbeetle-ledger.md",
      path: "formal/two-store-commit.tla",
      why:
        "ADR-0003 is `accepted` and therefore immutable. erp-spec#4 — the m5 formal-methods ADR supersedes the clause.",
    },
    {
      file: "adr/ADR-0016-quint-over-tla.md",
      path: "formal/two-store-commit.tla",
      why:
        "ADR-0016 IS the decision that deleted these files; naming what it replaced is historically accurate. PERMANENT — ADR-0016 is accepted and therefore immutable, so unlike the ADR-0003 entry this one is never cleared by an edit.",
    },
    {
      file: "adr/ADR-0016-quint-over-tla.md",
      path: "formal/period-close.tla",
      why: "As above. Permanent for the same reason — the ADR is accepted.",
    },
  ];
  const used = new Set<string>();

  for (const f of [...(await filesIn("adr", ".md")), ...(await filesIn("spikes", ".md"))]) {
    const text = await Deno.readTextFile(f);
    const relFile = rel(f);
    for (const m of text.matchAll(/`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g)) {
      const p = m[1];
      if (!TOP.test(p)) continue;
      const key = `${relFile}::${p}`;
      let exists = true;
      try {
        await Deno.stat(`${ROOT}/${p}`);
      } catch {
        exists = false;
      }
      const ex = EXEMPT.find((e) => e.file === relFile && e.path === p);
      if (ex) used.add(key);
      if (exists) continue;
      if (ex) continue;
      fail(G, `${relFile}: cites \`${p}\`, which does not exist`);
    }
  }

  for (const e of EXEMPT) {
    const key = `${e.file}::${e.path}`;
    let exists = true;
    try {
      await Deno.stat(`${ROOT}/${e.path}`);
    } catch {
      exists = false;
    }
    if (exists) {
      fail(
        G,
        `exemption for ${e.file} -> \`${e.path}\` is obsolete: the path now resolves. Delete the exemption.`,
      );
    } else if (!used.has(key)) {
      fail(
        G,
        `exemption for ${e.file} -> \`${e.path}\` matched nothing: the citation is gone. Delete the exemption.`,
      );
    }
  }
}

// ── gate 12: milestone exit criteria are wired to something ─────────────────
/**
 * erp-spec#9. `roadmap/milestones.yaml` is the top-level assertion of the whole spec and nothing
 * read it beyond the parse sweep, so milestone state was assessed by a human reading prose — and
 * one such assessment was wrong.
 *
 * This gate does NOT fail on an unmet criterion. Unmet is the normal state of a spec in progress;
 * failing on it would make CI red until spec-v1 and the gate would be turned off. It fails on the
 * REGISTRY being incoherent: a criterion wired to nothing, or to a check that does not exist.
 *
 * `adr_review_by_current` reads the same fact as gate 6. That is one enforcer plus one reporter,
 * not two oracles: **gate 6 is what fails**, and the milestone entry reports the same number so
 * STATUS and the gate cannot tell different stories.
 */
{
  const G = "12";
  const raw = await readYaml<{ milestones?: Record<string, unknown>[] }>(
    `${ROOT}/roadmap/milestones.yaml`,
  );
  const ms = raw?.milestones ?? [];
  const ids = new Set(ms.map((m) => String(m.id)));

  for (const m of ms) {
    const where = `milestone "${m.id ?? "(no id)"}"`;
    if (!m.id) fail(G, `${where}: missing id`);
    for (const d of (m.depends_on as string[] | undefined) ?? []) {
      if (!ids.has(String(d))) fail(G, `${where}: depends_on "${d}" is not a milestone`);
    }
    const crit = (m.exit_criteria as Record<string, unknown>[] | undefined) ?? [];
    if (crit.length === 0) fail(G, `${where}: no exit criteria`);
    for (const [i, c] of crit.entries()) {
      const at = `${where} criterion[${i}]`;
      if (typeof c === "string") {
        fail(G, `${at}: is a bare string — it must declare \`check:\` or \`prose_only: true\``);
        continue;
      }
      if (!c.text) fail(G, `${at}: missing \`text\``);
      const hasCheck = typeof c.check === "string";
      const isProse = c.prose_only === true;
      if (hasCheck === isProse) {
        fail(
          G,
          `${at}: must declare exactly one of \`check:\` or \`prose_only: true\` (has ${
            hasCheck ? "both" : "neither"
          })`,
        );
      }
      if (isProse && !c.reason) {
        fail(G, `${at}: \`prose_only\` requires a \`reason\` — say why no tool can decide it`);
      }
      if (hasCheck && !CHECKS[String(c.check)]) {
        fail(G, `${at}: check "${c.check}" is not defined in tools/milestone-checks.ts`);
      }
    }
  }

  // A checker nobody names is a checker that silently rots.
  const named = new Set(
    ms.flatMap((m) =>
      ((m.exit_criteria as Record<string, unknown>[] | undefined) ?? []).map((c) =>
        String(c?.check)
      )
    ),
  );
  for (const name of Object.keys(CHECKS)) {
    if (!named.has(name)) warn(G, `check "${name}" is defined but no milestone criterion names it`);
  }

  // The load-bearing property: generate.ts writes a file, so it must read no clock. Evaluating with
  // no clock MUST leave every clock-dependent check undecided — if one ever returned a verdict from
  // a null clock, STATUS would change on its own and the stale-file gate would go red on unrelated
  // pushes. Asserted here rather than trusted, because it is invisible until it breaks.
  if (CLOCK_DEPENDENT.size === 0) {
    fail(
      G,
      "CLOCK_DEPENDENT is empty — either delete the mechanism or the clock rule is unenforced",
    );
  }
  const clockFree = await evaluateMilestones(ROOT, null);
  for (const m of clockFree) {
    for (const c of m.criteria) {
      if (c.check && CLOCK_DEPENDENT.has(c.check) && c.verdict !== "deferred") {
        fail(
          G,
          `${m.id}: clock-dependent check "${c.check}" returned "${c.verdict}" with no clock — generate.ts would read a clock`,
        );
      }
    }
  }
}

// ── gate 13: reporting content — bases, pools, classification, golden vectors ────
/**
 * erp-spec#11. ADR-0029 promised "exactly ONE official allocation" and `reporting/` held a stub
 * trial balance. ADR-0031 states the basis; this is what makes the statement fail when the spec
 * stops matching it.
 *
 * The shape deliberately mirrors gate 10, because the failure modes are the same ones:
 *
 * - **Coverage, as in 10f.** Every product line the ledger can post is classified as goods or
 *   activity exactly once, and every activity line lands in exactly one pool bucket. Adding a
 *   product line to `ledger/dimensions.yaml` without deciding whether delivery cost spreads onto
 *   it is then a build break, not a silent default.
 * - **A control total, as in 10i.** Shares + unallocated == pool. Unlike "the shares are
 *   proportional", this can fail — proportionality is defined in terms of the spreading rule and
 *   would only ever agree with it. **This is the independent property the repo's guard rule
 *   demands**, and the largest-remainder residual is exactly where an implementation drifts.
 * - **Live blockers, as in 10a.** A pool blocked on a closed question is a pool nobody re-decided.
 *
 * Money is walked by the same `*_minor` integer rule 10l applies to `ledger/`.
 */
{
  const G = "13";
  const CRITERIA = ["cause_and_effect", "benefits_received", "fairness", "ability_to_bear"];
  const POOL_STATUS = ["allocated", "not_allocated", "blocked"];
  const LINE_KINDS = ["goods", "activity"];

  interface Basis {
    id?: string;
    version?: number;
    criterion?: string;
    proxy_for?: string;
    scope?: string;
    base?: string;
    rounding?: string;
    zero_base?: string;
    status?: string;
    source?: string;
  }
  interface Pool {
    id?: string;
    product_line?: string;
    accounts?: number[];
    status?: string;
    basis?: string;
    basis_version?: number;
    reason?: string;
    blocked_by?: string[];
  }

  const basesY = await readYaml<{ bases?: Basis[] }>(`${ROOT}/reporting/allocation-bases.yaml`);
  const reportY = await readYaml<{
    report?: {
      id?: string;
      authority?: string;
      basis?: string;
      basis_version?: number;
      excludes?: unknown[];
      line_kinds?: Record<string, string>;
      pools?: Pool[];
      presentation?: Record<string, unknown>;
    };
  }>(`${ROOT}/reporting/product-line-pl.yaml`);

  const bases = basesY?.bases ?? [];
  const report = reportY?.report;

  // Resolve a basis by (id, version) — a basis is versioned precisely so a report pins one.
  const basisKey = (id: unknown, v: unknown) => `${id}@${v}`;
  const basisByKey = new Map<string, Basis>();

  // 13a — basis registry
  if (bases.length === 0) {
    fail(G, "reporting/allocation-bases.yaml defines no bases — ADR-0031 states one");
  }
  for (const b of bases) {
    const where = `allocation-bases "${b.id ?? "(no id)"}"`;
    for (
      const f of [
        "id",
        "version",
        "criterion",
        "scope",
        "base",
        "rounding",
        "zero_base",
        "status",
        "source",
      ] as const
    ) {
      if (b[f] === undefined || b[f] === null || b[f] === "") fail(G, `${where}: missing \`${f}\``);
    }
    if (typeof b.version !== "number" || !Number.isInteger(b.version)) {
      fail(G, `${where}: \`version\` must be an integer`);
    }
    if (b.criterion && !CRITERIA.includes(b.criterion)) {
      fail(G, `${where}: criterion "${b.criterion}" not one of ${CRITERIA.join(" | ")}`);
    }
    // The whole point of ADR-0031 is that the basis is a PROXY and says so. A basis that is not
    // cause-and-effect and does not name what it stands in for has quietly promoted itself.
    if (b.criterion && b.criterion !== "cause_and_effect" && !b.proxy_for) {
      fail(
        G,
        `${where}: criterion "${b.criterion}" is not cause_and_effect and declares no \`proxy_for\` — say what driver it stands in for (ADR-0031)`,
      );
    }
    if (
      b.source && !/^ADR-\d{4}$/.test(String(b.source)) &&
      !/^(api|code):\d{4}-\d{2}-\d{2}:/.test(String(b.source))
    ) {
      fail(
        G,
        `${where}: source "${b.source}" is not an ADR id, \`api:<date>:<query>\` or \`code:<date>:<pin>\``,
      );
    }
    const k = basisKey(b.id, b.version);
    if (basisByKey.has(k)) fail(G, `allocation-bases: "${k}" is duplicated`);
    else basisByKey.set(k, b);
  }

  // 13b — the report itself
  if (!report) {
    fail(
      G,
      "reporting/product-line-pl.yaml defines no `report` — ADR-0029 promises exactly one official allocation",
    );
  } else {
    for (const f of ["id", "authority", "basis", "basis_version"] as const) {
      if (report[f] === undefined || report[f] === null || report[f] === "") {
        fail(G, `product-line-pl: missing \`${f}\``);
      }
    }
    const rk = basisKey(report.basis, report.basis_version);
    if (report.basis && !basisByKey.has(rk)) {
      fail(G, `product-line-pl: basis "${rk}" does not resolve in reporting/allocation-bases.yaml`);
    }

    // 13c — every product line the ledger can post is classified exactly once.
    // Without this, adding a value to ledger/dimensions.yaml silently defaults it to goods and
    // starts absorbing delivery cost with nobody deciding.
    const dimY = await readYaml<{ dimensions?: { id?: string; values?: string[] }[] }>(
      `${ROOT}/ledger/dimensions.yaml`,
    );
    const plValues = (dimY?.dimensions ?? []).find((d) => d.id === "product_line")?.values ?? [];
    const kinds = report.line_kinds ?? {};
    for (const v of plValues) {
      const k = kinds[v];
      if (!k) {
        fail(
          G,
          `product-line-pl: product line "${v}" is not classified in \`line_kinds\` — say goods or activity`,
        );
      } else if (!LINE_KINDS.includes(k)) {
        fail(
          G,
          `product-line-pl: line_kinds["${v}"] = "${k}" not one of ${LINE_KINDS.join(" | ")}`,
        );
      }
    }
    for (const v of Object.keys(kinds)) {
      if (!plValues.includes(v)) {
        fail(
          G,
          `product-line-pl: \`line_kinds\` classifies "${v}", which ledger/dimensions.yaml does not define`,
        );
      }
    }

    // 13d — every ACTIVITY line lands in exactly one pool, and every pool is a real activity line.
    const activity = plValues.filter((v) => kinds[v] === "activity");
    const pools = report.pools ?? [];
    const claimed = new Map<string, string[]>();
    for (const p of pools) {
      const where = `product-line-pl pool "${p.id ?? "(no id)"}"`;
      if (!p.id || !/^[a-z][a-z0-9_]*$/.test(String(p.id))) {
        fail(G, `${where}: id must be snake_case`);
      }
      if (!p.product_line) fail(G, `${where}: no \`product_line\``);
      else {claimed.set(String(p.product_line), [
          ...(claimed.get(String(p.product_line)) ?? []),
          String(p.id),
        ]);}
      if (!p.status || !POOL_STATUS.includes(String(p.status))) {
        fail(G, `${where}: status "${p.status}" not one of ${POOL_STATUS.join(" | ")}`);
      }
      if (p.status === "allocated") {
        const pk = basisKey(p.basis ?? report.basis, p.basis_version ?? report.basis_version);
        if (!basisByKey.has(pk)) fail(G, `${where}: basis "${pk}" does not resolve`);
      }
      // A pool that does NOT allocate is a decision, and a decision owes a reason. This is the
      // same shape as `no_posting` in posting-rules.yaml.
      if (p.status === "not_allocated" && !p.reason) {
        fail(G, `${where}: \`not_allocated\` requires a \`reason\` — not allocating is a decision`);
      }
      if (p.status === "blocked") {
        checkReportingBlockers(p.blocked_by, where);
        if (p.basis) {
          fail(G, `${where}: a blocked pool must name no basis — a guessed basis will be believed`);
        }
      }
    }
    for (const a of activity) {
      const c = claimed.get(a) ?? [];
      if (c.length === 0) {
        fail(
          G,
          `product-line-pl: activity line "${a}" has no pool — say whether it allocates, does not, or is blocked`,
        );
      } else if (c.length > 1) {
        fail(
          G,
          `product-line-pl: activity line "${a}" is claimed by more than one pool: ${c.join(", ")}`,
        );
      }
    }
    for (const [pl, ids] of claimed) {
      if (kinds[pl] !== "activity") {
        fail(
          G,
          `product-line-pl: pool(s) ${ids.join(", ")} target "${pl}", which is classified "${
            kinds[pl] ?? "(unclassified)"
          }" — only an activity line has a pool`,
        );
      }
    }

    // 13d(ii) — the honest bucket. A pool that is deferred rather than decided owes a tracked
    // issue, the same terms `unwritten` carries in ledger/posting-rules.yaml. Without this it is a
    // dumping ground, and a deferral nobody holds reads exactly like an omission.
    const deferred =
      (report as { deferred_pools?: { id?: string; issue?: string; reason?: string }[] })
        .deferred_pools ?? [];
    for (const d of deferred) {
      const where = `product-line-pl deferred_pool "${d.id ?? "(no id)"}"`;
      if (!d.id || !/^[a-z][a-z0-9_]*$/.test(String(d.id))) {
        fail(G, `${where}: id must be snake_case`);
      }
      if (!d.reason) fail(G, `${where}: needs a \`reason\``);
      if (!d.issue || !/^[\w.-]+#\d+$/.test(String(d.issue))) {
        fail(G, `${where}: needs an \`issue\` like \`erp-spec#12\``);
      }
      if (claimed.has(String(d.id))) {
        fail(G, `${where}: also appears in \`pools\` — a pool is deferred or decided, not both`);
      }
    }
  }

  // Same predicate gate 10 uses: a blocker that has closed is a block that expired.
  function checkReportingBlockers(ids: unknown, where: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      fail(G, `${where}: needs a non-empty \`blocked_by\``);
      return;
    }
    for (const raw of ids) {
      const id = String(raw);
      if (!/^(OQ|SPIKE|HOT)-\d{3}$/.test(id)) {
        fail(G, `${where}: blocker "${id}" is not an OQ-/SPIKE-/HOT- id`);
        continue;
      }
      const q = oqs.find((x) => x.id === id);
      const s = spikes.find((x) => x.id === id);
      const h = hots.find((x) => x.id === id);
      const open = q
        ? String(q.status ?? "open") !== "answered"
        : s
        ? !["closed", "abandoned"].includes(String(s.status ?? "open"))
        : h
        ? String(h.status ?? "open") !== "resolved"
        : null;
      if (open === null) fail(G, `${where}: blocker "${id}" does not resolve`);
      else if (!open) {
        fail(G, `${where}: blocker "${id}" is no longer open — the block has expired`);
      }
    }
  }

  // ── 13e — golden allocation vectors ───────────────────────────────────────
  interface RVector {
    name?: string;
    report?: string;
    basis?: string;
    basis_version?: number;
    kind?: string;
    source?: string;
    given?: { pool_minor?: number; goods?: { product_line?: string; revenue_minor?: number }[] };
    expect?: { shares?: { product_line?: string; minor?: number }[]; unallocated_minor?: number };
    _file: string;
  }
  const rvectors: RVector[] = [];
  for (const f of await filesIn("reporting/vectors", ".yaml")) {
    const y = await readYaml<RVector>(f);
    if (y) rvectors.push({ ...y, _file: f });
  }

  const dimY2 = await readYaml<{ dimensions?: { id?: string; values?: string[] }[] }>(
    `${ROOT}/ledger/dimensions.yaml`,
  );
  const plSet = new Set(
    (dimY2?.dimensions ?? []).find((d) => d.id === "product_line")?.values ?? [],
  );

  const VKIND = ["accept", "unallocated"];
  let sawUnallocated = false;
  for (const v of rvectors) {
    const where = rel(v._file);
    if (!v.name) fail(G, `${where}: no \`name\``);
    if (!v.source) fail(G, `${where}: no \`source\` — a vector with no provenance is a fixture`);
    if (!v.kind || !VKIND.includes(String(v.kind))) {
      fail(G, `${where}: kind "${v.kind}" not ${VKIND.join(" | ")}`);
    }
    if (String(v.kind) === "unallocated") sawUnallocated = true;
    if (v.report !== report?.id) {
      fail(G, `${where}: report "${v.report}" is not the official report "${report?.id}"`);
    }
    const vk = basisKey(v.basis, v.basis_version);
    if (!basisByKey.has(vk)) fail(G, `${where}: basis "${vk}" does not resolve`);

    const pool = v.given?.pool_minor;
    const goods = v.given?.goods ?? [];
    const shares = v.expect?.shares ?? [];
    const unalloc = v.expect?.unallocated_minor;
    if (typeof pool !== "number") {
      fail(G, `${where}: \`given.pool_minor\` must be a number`);
      continue;
    }
    if (typeof unalloc !== "number") {
      fail(
        G,
        `${where}: \`expect.unallocated_minor\` must be a number — an omitted zero is not the same claim as a stated one`,
      );
      continue;
    }

    // THE control total. Independent of how the spread is computed, and it can fail.
    const sum = shares.reduce((n, s) => n + Number(s.minor ?? 0), 0);
    if (sum + unalloc !== pool) {
      fail(
        G,
        `${where}: shares sum to ${sum} plus unallocated ${unalloc} = ${
          sum + unalloc
        }, but the pool is ${pool} — an allocation neither creates nor destroys money`,
      );
    }

    /**
     * ABSENT vs NULL, the same distinction REQ-LED-001 draws on a posting and gate 10h enforces on
     * a transfer. A missing KEY is refused; an explicit `null` is a determination — "no tracked
     * product line applies" — and is a legal row on this report as well as a legal member of the
     * base. An empty string is neither: it satisfies a naive check and means nothing.
     *
     * This gate got it wrong on the share side first and the null vector is what caught it, which
     * is the argument for having written that vector.
     */
    const checkPl = (row: Record<string, unknown>, whereRow: string) => {
      if (!Object.prototype.hasOwnProperty.call(row, "product_line")) {
        fail(
          G,
          `${whereRow}: no \`product_line\` key — absence is refused; an explicit null is not (ADR-0025)`,
        );
        return;
      }
      const v = row.product_line;
      if (v === null) return;
      if (String(v) === "") {
        fail(
          G,
          `${whereRow}: product_line is the empty string — write an explicit null to record that none applies`,
        );
      } else if (!plSet.has(String(v))) {
        fail(
          G,
          `${whereRow}: product_line "${v}" is not a declared value in ledger/dimensions.yaml`,
        );
      }
    };
    for (const [i, s] of shares.entries()) {
      checkPl(s as Record<string, unknown>, `${where} share[${i}]`);
    }
    for (const [i, g] of goods.entries()) {
      checkPl(g as Record<string, unknown>, `${where} goods[${i}]`);
    }

    // A zero base is the degenerate population ADR-0031 refuses to let vanish: 5.16% of measured
    // delivery revenue. If a vector has no positive base it must leave the WHOLE pool unallocated.
    const denom = goods.reduce((n, g) => n + Number(g.revenue_minor ?? 0), 0);
    if (denom <= 0) {
      if (shares.length > 0) {
        fail(G, `${where}: the base sums to ${denom}, so nothing can be spread — expect no shares`);
      }
      if (unalloc !== pool) {
        fail(
          G,
          `${where}: the base is zero, so the whole pool (${pool}) must be unallocated, found ${unalloc}`,
        );
      }
    } else if (String(v.kind) === "unallocated") {
      fail(G, `${where}: kind "unallocated" but the base sums to ${denom} > 0 — it is allocable`);
    }
  }

  // 13f — coverage of the vectors themselves. The degenerate case is the one an implementation
  // gets wrong, so its absence is a failure rather than a gap in a nice-to-have.
  if (report) {
    if (rvectors.length === 0) {
      fail(G, "reporting/vectors: no allocation vectors — the spreading rule is unenforced");
    } else if (!sawUnallocated) {
      fail(
        G,
        "reporting/vectors: no `unallocated` vector — the zero-base case is 5.16% of measured delivery revenue and nothing pins it",
      );
    }
  }

  // 13g — money and dates across reporting/, the same walk 10l applies to ledger/.
  {
    const walkValue = (node: unknown, path: string, where: string) => {
      if (node instanceof Date) {
        fail(
          G,
          `${where}: ${path} parsed as a Date — quote it, or it renders in the runner's timezone`,
        );
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walkValue(v, `${path}[${i}]`, where));
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/_minor$/.test(k) && v !== null && v !== undefined) {
            if (typeof v !== "number" || !Number.isInteger(v)) {
              fail(
                G,
                `${where}: ${path}.${k} = ${
                  JSON.stringify(v)
                } — money is an integer count of minor units`,
              );
            } else if (v < 0) {
              fail(
                G,
                `${where}: ${path}.${k} is negative — use the opposite side, not a negative amount`,
              );
            }
          }
          walkValue(v, `${path}.${k}`, where);
        }
      }
    };
    for (const f of await filesIn("reporting", ".yaml")) {
      const y = await readYaml(f);
      if (y) walkValue(y, "$", rel(f));
    }
  }
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
  "10": "ledger content — chart, posting rules, golden vectors",
  "11": "repo paths cited in prose resolve",
  "12": "milestone exit criteria are wired to a check or declared prose",
  "13": "reporting content — allocation bases, pools, line classification, golden vectors",
  "14": "accepted ADR bodies are frozen",
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
