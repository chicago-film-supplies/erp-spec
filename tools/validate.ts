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
import {
  CHECKS,
  CLOCK_DEPENDENT,
  evaluateMilestones,
  TERMINAL_DISPOSITIONS,
} from "./milestone-checks.ts";
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
import { ymdUTC } from "./dates.ts";

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
  /**
   * A supersession DECLARED but not yet in effect, because the superseder is still `proposed`.
   * One-way on purpose — see gate 6 (erp-spec#18).
   */
  supersedes_on_acceptance: string | null;
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
    supersedes_on_acceptance: str(fm.supersedes_on_acceptance) ?? null,
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

    /**
     * A supersession a `proposed` ADR has DECLARED but cannot yet enact (erp-spec#18).
     *
     * Symmetry above is checked unconditionally on status, and `generate.ts`'s in-force filter
     * drops a target on `superseded_by` ALONE, without reading its status. Together those made the
     * proposed branch unreachable: satisfying the symmetry gate meant writing `superseded_by` onto
     * the target, which removed it from in-force while nothing had replaced it. ADR-0036 hit this
     * against ADR-0018 and the repo would have held no in-force decision on the chart of accounts.
     *
     * So the intent gets its own field, and it is deliberately ONE-WAY: nothing is written onto the
     * target until acceptance, so in-force needs no change and cannot drop it early. What is
     * checked here is that the promise resolves and that it is eventually KEPT — CLAUDE.md's rule
     * is that a stated guarantee nothing executes is not a guarantee, and the previous shape of
     * this was a comment in ADR-0036's front matter.
     */
    if (a.supersedes_on_acceptance) {
      const target = a.supersedes_on_acceptance;
      if (!byId.has(String(target))) {
        fail("6", `${a.id}: supersedes_on_acceptance "${target}" does not resolve`);
      }
      if (a.supersedes === target) {
        fail(
          "6",
          `${a.id}: names "${target}" in BOTH supersedes and supersedes_on_acceptance — the second is the promise, the first is the act`,
        );
      }
      // The promotion is the whole point. An accepted ADR still carrying the promise means
      // acceptance happened and the two-file edit did not.
      if (a.status === "accepted") {
        fail(
          "6",
          `${a.id}: is \`accepted\` but still carries supersedes_on_acceptance "${target}" — promote it to \`supersedes\`, and set ${target}.superseded_by + \`status: superseded\``,
        );
      }
    }

    /**
     * `superseded_by` and `status: superseded` are one fact written in two places, and nothing
     * required them to agree. Gate 6 checked symmetry only; `generate.ts` drops from in-force on
     * `superseded_by` regardless of status. So a target could sit at `status: accepted`, absent
     * from in-force, still labelled accepted, with CI green. ADR-0006 and ADR-0008 held the
     * convention by hand.
     */
    if (a.superseded_by && a.status !== "superseded") {
      fail(
        "6",
        `${a.id}: superseded_by "${a.superseded_by}" is set but status is "${a.status}" — a superseded ADR must say so, or it leaves in-force while still reading as ${a.status}`,
      );
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
    dimensions?: unknown; // ⚠️ read ONLY so 10a can refuse it — see the check below
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
    /**
     * ⚠️ **INVERTED 2026-08-16 (ADR-0036, erp-spec#19). This check demanded `dimensions` on every
     * account until today; it now REFUSES it.** ADR-0036 supersedes ADR-0018: the chart is plain
     * and a posting carries keys, not classifications, so a per-account dimension obligation has
     * nothing left to state. The key was DELETED from all 139 entries rather than emptied to `[]`
     * — a field that can only hold `[]` carries no information and invites the next author to fill
     * one in, and this repo prefers making a defect class unrepresentable over policing it.
     *
     * ⚠️ ADR-0036's own Consequences say "`5800`'s `dimensions: [product_line, cost_type]` becomes
     * `dimensions: []`", which reads the other way. That sentence states the effect on the one
     * account that owed two; the bullet after it says the lists are **obsoleted in their current
     * form**, and deletion is the stronger reading. This check is what makes it enforced rather
     * than asserted, and it was fired red against a re-added `dimensions: []` before landing.
     */
    if (a.dimensions !== undefined) {
      fail(
        G,
        `${where}: carries \`dimensions\` — the chart states no dimension obligation (ADR-0036, superseding ADR-0018). Which KEYS a posting owes is read off its rule in ledger/posting-rules.yaml`,
      );
    }
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
    // An `undecided` disposition owes a live blocker. (It could also sit on `dimensions` until
    // 2026-08-16; ADR-0036 removed that field, so `disposition` is the only bearer left.)
    if (a.disposition === "undecided") {
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
      per?: string;
      keys?: unknown;
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

    /**
     * ── 10q — the header's own bucket counts ────────────────────────────────────────────────────
     *
     * **When a doc states a count, something must count it.** `posting-rules.yaml` opens with a
     * four-row table of how many rules sit in each bucket, and nothing checked it: on 2026-08-17 it
     * read `no_posting[] 11` against **13** entries, and it had been wrong for as long as two
     * entries had been there. It is the same defect the chart header carried ("138 entries, four
     * minted", wrong in both halves for weeks) until gate 16 counted it.
     *
     * The rows are matched by shape rather than by position, and a MISSING row fails: a header that
     * drops the number is a header nothing can check, which is how the count went stale in the
     * first place.
     */
    const headerText = await Deno.readTextFile(`${ROOT}/ledger/posting-rules.yaml`);
    const stated: [RegExp, number, string][] = [
      [
        /^#\s+rules\[\] status: specified\s+(\d+)/m,
        rules.filter((r) => r.status === "specified").length,
        "rules[] status: specified",
      ],
      [
        /^#\s+rules\[\] status: blocked\s+(\d+)/m,
        rules.filter((r) => r.status === "blocked").length,
        "rules[] status: blocked",
      ],
      [/^#\s+no_posting\[\]\s+(\d+)/m, noPosting.length, "no_posting[]"],
      [/^#\s+unwritten\[\]\s+(\d+)/m, unwritten.length, "unwritten[]"],
    ];
    for (const [re, actual, label] of stated) {
      const m = headerText.match(re);
      if (!m) {
        fail(
          G,
          `posting-rules header: no line stating the \`${label}\` count — a count nothing states is a count nothing can check`,
        );
      } else if (Number(m[1]) !== actual) {
        fail(
          G,
          `posting-rules header: says \`${label}\` is ${m[1]}, the file holds ${actual}`,
        );
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

  /**
   * ── the KEY vocabulary, derived from the posting rules (ADR-0036) ──────────────────────────
   *
   * ⚠️ **This block read `ledger/dimensions.yaml` and the chart's per-account `dimensions:` lists
   * until 2026-08-16.** ADR-0036 supersedes ADR-0018: a posting carries KEYS — causal order(s),
   * invoice link, line identity — and never a classification, so there is no per-account
   * obligation left to check and `ledger/dimensions.yaml` became a REPORTING taxonomy. It is still
   * checked, by gate 13 against `reporting/product-line-pl.yaml`; it is no longer checked here,
   * and that is the whole of what moved.
   *
   * Which keys a posting owes is now read off its RULE. `keys:` is a map of key -> dotted path,
   * the literal `null` where the rule always declares that none applies, or one of the two mirror
   * markers for a reversal.
   */
  const KEY_NAMES = new Set(["causal_orders", "invoice", "line"]);
  const MIRROR = new Set(["mirrors_original_transfer", "mirrors_retracted_transfer"]);

  /** The `keys:` map of one posting, or null where the posting uses a mirror marker. */
  const postingKeys = (
    posting: { keys?: unknown },
  ): Record<string, unknown> | null =>
    typeof posting.keys === "string" && MIRROR.has(posting.keys)
      ? null
      : (posting.keys && typeof posting.keys === "object" && !Array.isArray(posting.keys))
      ? posting.keys as Record<string, unknown>
      : {};

  /** Every key ANY posting of a rule declares — what a transfer of it MAY carry. */
  const ruleKeys = (id: string): Set<string> => {
    const out = new Set<string>();
    for (const p of ruleById.get(id)?.postings ?? []) {
      const k = postingKeys(p);
      if (k === null) {
        // A mirror copies whatever it reverses, so every key is reachable through it.
        for (const n of KEY_NAMES) out.add(n);
        continue;
      }
      for (const n of Object.keys(k)) out.add(n);
    }
    return out;
  };

  /** Keys EVERY posting of a rule declares — what a transfer of it MUST carry. */
  const ruleMandatoryKeys = (id: string): Set<string> => {
    const postings = ruleById.get(id)?.postings ?? [];
    if (postings.length === 0) return new Set<string>();
    let acc: Set<string> | null = null;
    for (const p of postings) {
      const k = postingKeys(p);
      // A mirror guarantees only the universal arm; it cannot promise a key set.
      const names: Set<string> = k === null
        ? new Set<string>(["causal_orders"])
        : new Set<string>(Object.keys(k));
      const prev: Set<string> = acc ?? names;
      acc = new Set<string>([...prev].filter((n: string) => names.has(n)));
    }
    return acc ?? new Set<string>();
  };

  /**
   * Resolve a vector transfer to the ONE posting that produced it — possible only where exactly one
   * posting of the rule states BOTH accounts as literal GL codes and both match. That is a strict
   * condition and it is met by `shift_recorded` (5800/2010 against 5801/2010), by
   * `vendor_bill_received`'s reclassification leg (2010/2000) and by `credit_note_issued`'s
   * write-off leg (6900/2050). Everything else falls back to the union/intersection arms above,
   * and 10h says so rather than pretending otherwise.
   */
  const resolvePosting = (
    id: string,
    debit: unknown,
    credit: unknown,
  ): { keys?: unknown } | null => {
    const hits = (ruleById.get(id)?.postings ?? []).filter((p) =>
      typeof p.debit_account === "number" && typeof p.credit_account === "number" &&
      p.debit_account === Number(debit) && p.credit_account === Number(credit)
    );
    return hits.length === 1 ? hits[0] : null;
  };

  /**
   * ── 10n + 10p — the `.feature` scenarios are joined to the posting rules ───────────────────
   *
   * ⚠️ **REPLACED 2026-08-16 (ADR-0036, erp-spec#19 + #20).** 10n used to check that a dimension
   * VALUE named in a scenario step was one `ledger/dimensions.yaml` declared (erp-spec#16). That
   * hole was real — `dimensional-postings.feature:25` asserted a posting carrying `"Transport"` is
   * RECORDED for eleven days while the value was undeclared — but the check is now moot: no
   * posting carries a dimension, and the file it guarded is a reporting taxonomy.
   *
   * Its own comment said what it could not do:
   *
   *   > Scope is VOCABULARY, not applicability. Whether a `cost_type` belongs on the account a
   *   > scenario posts to is HOT-015, and this check cannot see it: the scenarios do not name an
   *   > account. Do not read a green 10n as "the scenarios agree with the chart".
   *
   * **erp-spec#20 is that missing half, and this is it.** #20 proposed joining scenarios to the
   * chart's per-account `dimensions:` lists — the lists ADR-0036 deletes — so building it before
   * this sweep would have been a guard over machinery the sweep removes. The join target moved to
   * `ledger/posting-rules.yaml`, which is the better one: which keys a posting owes is a property
   * of WHAT HAPPENED, not of where it landed.
   *
   * **10n — resolution.** A rule or account named in a step must exist. This alone catches a
   * renamed or deleted rule silently drifting out of the Gherkin, which is #20's third arm.
   * **10p — applicability.** A key a scenario asserts must be one the rule it names carries. A
   * scenario asserting rejection for a MISSING key must name a rule that carries it — otherwise it
   * asserts a refusal that could never fire.
   *
   * ⚠️ **STEP LINES ONLY**, and the restriction is inherited from 10n because it is load-bearing
   * rather than tidiness. A first cut of 10n matched anywhere in the file and fired on the
   * Feature's own description paragraph, which named `"Transport"` while explaining that the value
   * had been dropped. Retraction annotations quote the retracted thing on purpose, all over
   * `ledger/` and `adr/` — a gate that read prose would turn CI red on exactly the notes this repo
   * asks people to write. A scenario STEP is the executable claim; the paragraph above it is
   * documentation.
   *
   * ⚠️ **Both land GREEN**, which is a fact about the data and not about the gate. Four arms, each
   * fired deliberately against a mutated file before landing:
   *
   *   · 10n rule      — a step naming `invoice_issed` → "does not define"
   *   · 10n account   — an Examples row naming 5899 → "not in ledger/chart-of-accounts.yaml"
   *   · 10p positive  — a `credit_note_issued` scenario carrying an `invoice` key, the exact
   *                     combination the rule refuses on ADR-0033 grounds
   *   · 10p negative  — the same scenario re-pointed at `invoice_issued`, which DOES carry it
   *   · 10p refusal   — "carries no line" under `settlement_recorded`, which has no line key
   *
   * ⚠️ **The account arm did nothing until it was fired, and that is why firing is the rule.** It
   * scanned STEP lines only, and the one scenario that names accounts is a Scenario Outline whose
   * `Given` says `<account>` — a placeholder. Every real code lives in the Examples table below it.
   * A check that reads green while matching nothing is indistinguishable from a check that passes.
   */
  {
    const STEP = /^\s*(Given|When|Then|And|But|\*)\s/;
    /** "the causal order", "the invoice", "the line" -> the key a rule declares. */
    const KEY_OF: Record<string, string> = {
      "causal order": "causal_orders",
      invoice: "invoice",
      line: "line",
    };
    for (const f of await filesIn("contexts", ".feature")) {
      const text = await Deno.readTextFile(f);
      const lines = text.split("\n");
      /** The rule a scenario is under, carried forward from its `Given` to its later steps. */
      let currentRule: string | null = null;
      lines.forEach((line, i) => {
        if (/^\s*(Scenario|Scenario Outline|Feature):/.test(line)) currentRule = null;
        const where = `${rel(f)}:${i + 1}`;

        /**
         * 10n — account codes in an Examples table. ⚠️ **Steps alone are not enough and this was
         * found by firing the check red**: a Scenario Outline's `Given` names `<account>`, a
         * placeholder, and the real codes only ever appear in the table below it. Scanning steps
         * only, the account arm silently matched nothing on the one scenario that names accounts.
         * A table ROW is as executable as a step — it is the input the outline runs on.
         */
        if (/^\s*\|/.test(line)) {
          for (const am of line.matchAll(/\b(\d{4}) [A-Z]/g)) {
            if (!byCode.has(Number(am[1]))) {
              fail(
                G,
                `${where}: Examples row names account ${
                  am[1]
                }, which is not in ledger/chart-of-accounts.yaml`,
              );
            }
          }
        }

        if (!STEP.test(line)) return;

        // 10n — a rule named in a step resolves.
        const rm = line.match(/\bunder the rule ([a-z][a-z0-9_]*)/);
        if (rm) {
          if (!ruleById.has(rm[1])) {
            fail(
              G,
              `${where}: names posting rule "${
                rm[1]
              }", which ledger/posting-rules.yaml does not define`,
            );
            currentRule = null;
          } else currentRule = rm[1];
        }

        // 10n — an account code named in a step resolves.
        for (const am of line.matchAll(/\bto (\d{4}) [A-Z]/g)) {
          if (!byCode.has(Number(am[1]))) {
            fail(
              G,
              `${where}: names account ${am[1]}, which is not in ledger/chart-of-accounts.yaml`,
            );
          }
        }

        // 10p — a key a scenario asserts must be one its rule carries.
        for (const km of line.matchAll(/\bthe (causal order|invoice|line) "([^"]*)"/g)) {
          const key = KEY_OF[km[1]];
          if (!currentRule) {
            fail(
              G,
              `${where}: asserts the key \`${key}\` but no step above it named a posting rule — a key assertion with no rule to join to cannot be checked`,
            );
            continue;
          }
          if (!ruleKeys(currentRule).has(key)) {
            fail(
              G,
              `${where}: asserts \`${key}\`, which no posting of rule "${currentRule}" carries`,
            );
          }
        }

        /**
         * 10p — the NEGATIVE arm. A scenario that exists to refuse an unowed key writes it as
         * `the unowed <key> "…"`, and this checks the claim rather than exempting it: the rule
         * really must not carry that key. ⚠️ **Without the marker the positive arm above would
         * fire on exactly the scenario written to demonstrate the refusal** — which is how a gate
         * ends up with an exemption list instead of a check. This is the same shape as gate 11's
         * self-expiring exemptions: state the negative claim, then verify it.
         */
        for (const um of line.matchAll(/\bthe unowed (causal order|invoice|line) "([^"]*)"/g)) {
          const key = KEY_OF[um[1]];
          if (!currentRule) continue;
          if (ruleKeys(currentRule).has(key)) {
            fail(
              G,
              `${where}: calls \`${key}\` unowed, but rule "${currentRule}" does carry it — the scenario demonstrates a refusal that would not happen`,
            );
          }
        }

        // 10p — a scenario refusing a MISSING key must name a rule that carries it.
        for (const nm of line.matchAll(/\bcarries no (causal order|invoice|line)\b/g)) {
          const key = KEY_OF[nm[1]];
          if (!currentRule) continue;
          if (!ruleKeys(currentRule).has(key)) {
            fail(
              G,
              `${where}: asserts a missing \`${key}\` is refused, but rule "${currentRule}" carries no such key — the refusal could never fire`,
            );
          }
        }
      });
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

    /**
     * 10o — a vector's `name` equals its filename stem.
     *
     * ⚠️ **Added 2026-08-16 (erp-spec#19) because the sweep broke it and nothing noticed.** Five
     * vectors were renamed; `overhead-accrual-carries-no-causal-order.yaml` kept
     * `name: overhead-accrual-carries-no-product-line` inside it, and every gate stayed green — the
     * `name` was present, the rule resolved, the directory matched. A vector whose stated identity
     * disagrees with its location is one a `differs_from` can never find.
     *
     * ⚠️ **The BROADER check — vector-to-vector cross-references in prose — is deliberately NOT
     * built, and the measurement is the reason.** Vectors cite each other by bare name constantly
     * ("contrast `overhead-accrual-carries-no-causal-order`"), those names are not repo paths so
     * gate 11 cannot see them, and the same sweep left four dead ones. But of 36 distinct
     * hyphenated backticked tokens under `ledger/`, **10 do not resolve to a vector and 8 of those
     * are correct**: seven are old names quoted inside deliberate "renamed from `X`" annotations —
     * the repo's retraction convention — and one is a uuid. A gate here would turn CI red on
     * exactly the notes this repo asks people to write, which is the trap that forced 10n to read
     * step lines only. **The 10th was a real defect and was found by hand**: a citation of
     * `allocations-short-of-the-money-received-rejected`, a vector that has never existed.
     */
    if (!v.name) fail(G, `${where}: no \`name\``);
    else {
      const stem = basename(v._file).replace(/\.yaml$/, "");
      if (v.name !== stem) {
        fail(
          G,
          `${where}: \`name: ${v.name}\` does not match its filename \`${stem}\` — a vector whose stated identity disagrees with its location is one a \`differs_from\` can never find`,
        );
      }
    }
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
      /**
       * ── 10h — KEY obligation (ADR-0036, superseding ADR-0018) ──────────────────────────────
       *
       * ⚠️ **This check read the CHART until 2026-08-16** — "the requirement is READ OFF each
       * account's own `dimensions:` list, never inferred from its class" (ADR-0025). ADR-0036
       * deleted those lists: a posting carries KEYS, not classifications. The obligation is now
       * read off the POSTING RULE, which is the better authority — which keys a posting owes is a
       * property of what happened, not of where it landed. The vector and the rule remain two
       * files neither of which controls the other, so the check stays independent of the thing it
       * is checking.
       *
       * ⚠️ **Fired red on every arm before landing, and two arms were WRONG when first fired.**
       * (a) a transfer with `causal_orders` removed, and again with `[]`, and again with `""`;
       * (b) an unowed `invoice` on `credit_note_issued`'s write-off leg; (c) an `invoice_issued`
       * transfer with the mandatory `invoice` removed; (d) a `line` key added to
       * `settlement_recorded` that no accept vector supplies; (e) a causal order on 5801's idle leg,
       * and an explicit null on 5800's absorbed leg.
       *   · **(a) double-reported.** `String([]) === ""`, so the empty-LIST case also tripped the
       *     empty-STRING arm — two messages for one defect, which is how a gate teaches the wrong
       *     lesson at 2am. The empty-string arm is now guarded against arrays.
       *   · **(c) did not fire at all, and the bug was in the SPEC rather than the gate.**
       *     `invoice_issued`'s tax posting declared only `causal_orders` while every vector's tax
       *     transfer carried `invoice: …` — so `invoice` was not in the rule's mandatory set and
       *     removing it from a transfer was legal. The rule was corrected; a tax component does
       *     arise from the invoice. **Nothing but firing this arm would have found it**: arm (b)
       *     checks the UNION, which already contained `invoice`, so the vectors and the rule
       *     disagreed while every gate stayed green.
       *
       * ⚠️ **A STATED LIMIT, so a green 10h is not over-read.** A vector states transfers; a rule
       * states postings; nothing links a transfer to the posting that produced it except its
       * accounts. Where BOTH accounts of exactly one posting are literal GL codes, `resolvePosting`
       * gets an exact answer and arm (e) checks that posting's key set precisely. Where they are
       * dotted paths — `invoice_issued`'s two legs both debit 1200 and credit a path — it cannot,
       * and arms (b)/(c) degrade to a union/intersection check. **Arm (d) is what stops that being
       * vacuous**: a key no accept vector ever supplies is a key the implementation can quietly
       * ignore, which is this repo's own definition of a claim rather than a capability.
       */
      const rk = rid ? ruleKeys(rid) : new Set<string>();
      const mandatory = rid ? ruleMandatoryKeys(rid) : new Set<string>();
      const exact = rid ? resolvePosting(rid, t.debit_account, t.credit_account) : null;

      // (a) UNIVERSAL — every posting declares its causal order. ABSENT vs NULL is the whole
      // distinction and it is not a nicety: an explicit null IS a decision — "no causal order
      // applies" — and is countable, reportable and auditable, while a missing key is
      // indistinguishable from an oversight. An empty LIST is neither: it satisfies a naive
      // presence check while stating nothing, exactly as `""` did for a dimension, so it stays
      // refused (REQ-LED-001).
      if (!Object.prototype.hasOwnProperty.call(t, "causal_orders")) {
        fail(
          G,
          `${where} transfer[${j}]: does not declare \`causal_orders\` — every posting declares its causal order; absence is refused, an explicit null is not (REQ-LED-001, ADR-0036)`,
        );
      } else if (Array.isArray(t.causal_orders) && t.causal_orders.length === 0) {
        fail(
          G,
          `${where} transfer[${j}]: causal_orders is the empty list — write an explicit null to record that none applies (REQ-LED-001)`,
        );
      }

      for (const key of KEY_NAMES) {
        const declared = Object.prototype.hasOwnProperty.call(t, key);
        // (b) a key the rule does not name is refused as firmly as a missing one.
        if (declared && !rk.has(key)) {
          fail(
            G,
            `${where} transfer[${j}]: declares \`${key}\`, which no posting of rule "${rid}" carries`,
          );
        }
        // (c) a key EVERY posting of the rule names must be on every transfer.
        if (!declared && mandatory.has(key)) {
          fail(
            G,
            `${where} transfer[${j}]: does not declare \`${key}\`, which every posting of rule "${rid}" carries`,
          );
        }
        // An empty string is neither a reference nor a determination. ⚠️ **Guarded against arrays
        // on purpose**: `String([]) === ""`, so an unguarded check fires a second, misleading
        // "empty string" failure on the empty-LIST case the arm above already names precisely.
        // Found by firing that arm red — two messages for one defect is how a gate teaches the
        // wrong lesson at 2am.
        if (declared && t[key] !== null && !Array.isArray(t[key]) && String(t[key]) === "") {
          fail(
            G,
            `${where} transfer[${j}]: ${key} is the empty string — write an explicit null to record that none applies`,
          );
        }
      }

      // (e) EXACT — where the transfer resolves to one posting, its key set must match that
      // posting's exactly, and a rule that pins `causal_orders: null` admits no other value. This
      // is what gives 5800-vs-5801 teeth: an absorbed allocation has no legal null (hours
      // belonging to no job are unabsorbed by definition), while 5801's posting IS the null arm.
      const exactKeys = exact ? postingKeys(exact) : null;
      if (exactKeys) {
        const want = new Set(Object.keys(exactKeys));
        for (const key of KEY_NAMES) {
          const declared = Object.prototype.hasOwnProperty.call(t, key);
          if (declared !== want.has(key)) {
            fail(
              G,
              `${where} transfer[${j}]: posts ${t.debit_account}/${t.credit_account}, which resolves to one posting of "${rid}" carrying [${
                [...want].join(", ")
              }] — it ${declared ? "declares" : "omits"} \`${key}\``,
            );
          }
        }
        if (exactKeys.causal_orders === null && t.causal_orders !== null) {
          fail(
            G,
            `${where} transfer[${j}]: rule "${rid}" pins \`causal_orders: null\` on the ${t.debit_account}/${t.credit_account} posting, and this transfer declares a value`,
          );
        }
        if (
          exactKeys.causal_orders !== undefined && exactKeys.causal_orders !== null &&
          t.causal_orders === null
        ) {
          fail(
            G,
            `${where} transfer[${j}]: rule "${rid}" reads \`causal_orders\` from \`${exactKeys.causal_orders}\` on the ${t.debit_account}/${t.credit_account} posting, so an explicit null is not one of its outcomes`,
          );
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

    /**
     * ── 10h arm (d) — KEY COVERAGE, and this is the arm that stops the rest being vacuous ──────
     *
     * Every key a rule declares must be supplied by at least one transfer across its ACCEPT
     * vectors. Arms (b) and (c) degrade to a union/intersection check wherever a transfer cannot
     * be resolved to one posting, and a union check alone would let a rule declare a key that no
     * vector ever carries — **an unexercised branch of a rule is a claim, not a capability**
     * (CLAUDE.md), and this repo has been bitten by exactly that three times.
     *
     * ⚠️ **It is scoped to ACCEPT vectors deliberately.** A reject vector expects no transfers at
     * all, so it can supply nothing, and counting it would make the check pass on rules whose only
     * evidence is a refusal. Mirror rules (`invoice_voided`, `settlement_reversed`) declare every
     * key by construction and are exempt from the union half; their accept vectors still carry
     * whatever the entry they reverse carried, which is what makes their coverage real.
     */
    if (r.status === "specified" && r.id) {
      const mirrors = (r.postings ?? []).some((p) =>
        typeof p.keys === "string" && MIRROR.has(p.keys)
      );
      if (!mirrors) {
        const supplied = new Set<string>();
        for (const v of vs) {
          if (v.kind !== "accept") continue;
          for (const t of v.expect?.transfers ?? []) {
            for (const key of KEY_NAMES) {
              if (Object.prototype.hasOwnProperty.call(t, key)) supplied.add(key);
            }
          }
        }
        for (const key of ruleKeys(r.id)) {
          if (!supplied.has(key)) {
            fail(
              G,
              `posting-rules "${r.id}": declares the key \`${key}\` and no accept vector supplies it — an unexercised branch of a rule is a claim, not a capability`,
            );
          }
        }
      }
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
 *
 * ⚠️ **Widened 2026-08-16 (erp-spec#14) from `adr/` + `spikes/` to the whole refactorable half.**
 * The gate was scoped to where the original defect happened, and by then the structured spec cited
 * far more paths than the ADRs did: `ledger/posting-rules.yaml` and the golden vectors point at
 * each other and at `inbox/` surveys constantly, and none of it was checked. It lands GREEN — 0 of
 * 189 files held an unresolved citation when the scope was widened — which is a fact about the data
 * and not about the gate; it was fired red against a deliberately dead path first.
 *
 * ⚠️ **`inbox/` and `research-drop/` are deliberately OUT, and the reason is the lifecycle.** Both
 * are append-only: a note is raw capture and is never rewritten. A note that cited a path since
 * deleted would turn CI red with no legal edit available, so the only fix would be an exemption per
 * note — an allowlist that grows forever, which is what this gate's own exemption rule exists to
 * prevent. `adr/` is immutable too, but its exemptions are three, self-expiring, and about one
 * migration; inbox notes number 72 and climb every session.
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

  const SCANNED_DIRS = ["adr", "spikes", "contexts", "ledger", "reporting", "migration", "roadmap"];
  /**
   * ⚠️ **Widened again 2026-08-16 (erp-spec#19) to the REPO-ROOT files.** The 2026-08-16 widening
   * took the gate from `adr/` + `spikes/` to the whole refactorable half — and missed the root,
   * where `hotspots.yaml`, `open-questions.yaml`, `glossary.yaml`, `charter.md` and `README.md`
   * between them cite **114 repo paths**. It was found the way these things are: the ADR-0036 sweep
   * renamed `dimensional-postings.feature` and hotspots.yaml's HOT-015 kept pointing at the old
   * name, with nothing able to go red on it. Two dead citations existed at the moment of widening,
   * both created by that rename and both fixed in the same commit.
   * `CLAUDE.md` is included: it is refactored freely and its instructions are exactly the kind of
   * thing that outlives the file they point at.
   */
  const SCANNED_ROOT_FILES = [
    "hotspots.yaml",
    "open-questions.yaml",
    "glossary.yaml",
    "charter.md",
    "README.md",
    "CLAUDE.md",
  ];
  const scanned: string[] = [];
  for (const d of SCANNED_DIRS) {
    for (const ext of [".md", ".yaml", ".feature"]) scanned.push(...await filesIn(d, ext));
  }
  for (const f of SCANNED_ROOT_FILES) {
    try {
      await Deno.stat(`${ROOT}/${f}`);
      scanned.push(`${ROOT}/${f}`);
    } catch {
      fail(G, `gate 11 is configured to scan \`${f}\`, which does not exist — fix the list`);
    }
  }
  for (const f of scanned) {
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
  const POOL_KINDS = ["activity_line", "cost_only"];
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
    /** ADR-0036 / owner 2026-08-16 — which labour this pool's cost side selects. */
    cost_sources?: { labor_line?: string };
    /** `activity_line` = revenue and cost; `cost_only` = cost with no revenue to categorise. */
    kind?: string;
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
      /**
       * ⚠️ **Two pool shapes, added 2026-08-16 on the owner's ruling** that "counter and warehouse
       * can bill goods too (just like delivery does)". An `activity_line` pool has revenue AND
       * cost, and its question is whether that cost lands on the goods. A `cost_only` pool has
       * cost and **no revenue to categorise**, so the question does not arise — it has nowhere
       * else to go, and it must therefore be `allocated`. A cost-only pool that did not spread
       * would be a cost reaching no report at all, which is the "vanishes" default in its purest
       * form.
       */
      if (!p.kind || !POOL_KINDS.includes(String(p.kind))) {
        fail(G, `${where}: kind "${p.kind}" not one of ${POOL_KINDS.join(" | ")}`);
      }
      if (p.kind === "cost_only") {
        if (p.product_line !== undefined) {
          fail(
            G,
            `${where}: a \`cost_only\` pool has no revenue to categorise, so it names no \`product_line\``,
          );
        }
        if ((p.accounts ?? []).length > 0) {
          fail(G, `${where}: a \`cost_only\` pool names no revenue \`accounts\``);
        }
        if (p.status !== "allocated") {
          fail(
            G,
            `${where}: a \`cost_only\` pool must be \`allocated\` — its cost has nowhere else to go, so not spreading it means it reaches no report at all`,
          );
        }
      } else if (!p.product_line) fail(G, `${where}: no \`product_line\``);
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

    /**
     * ── 13h — every `labor_line` is selected by exactly one pool ───────────────────────────────
     *
     * ⚠️ **`labor_line` is the pool's COST SELECTOR** (owner, 2026-08-16: "the p&l by product line
     * will distribute labor costs with labor_line delivery across product lines, the same mechanism
     * will allow other combos for future reporting"). This is the arm that makes that executable,
     * and it answers OQ-046 — which was opened claiming nothing exercises the taxonomy. Nothing in
     * `ledger/` does and nothing ever will: ADR-0036 makes it derived, so it reaches no transfer.
     * **The REPORT is its consumer**, and until this landed the selection was written in a pool's
     * prose rather than declared.
     *
     * ⚠️ **A prose selector is how the `transport` pool came to select `labor_line: delivery`** —
     * correct when the enum had three values and trucking labour had nowhere else to point, wrong
     * from the moment it had seven, and carried through the erp-spec#19 sweep because renaming
     * `cost_type` → `labor_line` in a sentence does not re-read what the sentence claims. Built as
     * written, a long-haul crew-day would have spread across goods lines while Transport reported a
     * near-100% margin.
     *
     * ⚠️ **COVERAGE IS TOTAL — there is no "bills nobody" branch.** This check briefly carried one,
     * with `counter` and `warehouse` in it and an honest-bucket beside it; the owner's ruling the
     * same day ("counter and warehouse can bill goods too, just like delivery does") emptied it,
     * and **a branch with no members is a claim rather than a capability**, so it went.
     * ✅ **The collapse is structural rather than a coincidence, which is what makes totality safe
     * to assert.** `labor_line` is read off the shift's ABSORBED ALLOCATION row, and an absorbed
     * allocation names a causal job by definition — hours belonging to no job are UNABSORBED, post
     * to 5801, and carry no allocation row and therefore no `labor_line` at all. So every value the
     * taxonomy can hold is, by construction, attributable to a job whose goods can bear it.
     *
     * The silent default this prevents is **"vanishes"**, not "goes to the wrong pool": an
     * unselected `labor_line` is absorbed labour that no report reaches, so goods COGS is
     * understated on every line it should have touched and nothing anywhere disagrees.
     */
    {
      const llValues = (dimY?.dimensions ?? []).find((d) => d.id === "labor_line")?.values ?? [];
      const selectedBy = new Map<string, string[]>();
      for (const p of pools) {
        const sel = p.cost_sources?.labor_line;
        const where = `product-line-pl pool "${p.id ?? "(no id)"}"`;
        if (sel === undefined) {
          fail(
            G,
            `${where}: no \`cost_sources.labor_line\` — a pool whose cost side is undeclared selects nothing, and its margin reads as pure revenue`,
          );
          continue;
        }
        if (!llValues.includes(String(sel))) {
          fail(
            G,
            `${where}: selects labor_line "${sel}", which ledger/dimensions.yaml does not declare`,
          );
          continue;
        }
        selectedBy.set(String(sel), [...(selectedBy.get(String(sel)) ?? []), String(p.id)]);
      }
      for (const v of llValues) {
        const by = selectedBy.get(v) ?? [];
        if (by.length === 0) {
          fail(
            G,
            `product-line-pl: no pool selects labor_line "${v}" — its cost would reach no report at all. Every declared value is absorbed labour with a causal job, so every one has a pool`,
          );
        } else if (by.length > 1) {
          fail(
            G,
            `product-line-pl: labor_line "${v}" is selected by more than one pool: ${
              by.join(", ")
            } — the same cost would be counted twice`,
          );
        }
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

// ── gate 15: the migration field map against the MEASURED live inventory ────
/**
 * erp-spec#8. `migration/field-map.yaml` is authored; `migration/live-paths.measured.yaml` is
 * measured against prod by `spikes/harness/live-path-inventory-probe.ts`. m6's first exit criterion
 * counts one against the other (`live_paths_dispositioned`); this gate checks the map is INTERNALLY
 * coherent with the measurement, which is the other direction and a different failure.
 *
 * ⚠️ **Only one direction belongs here.** "Every measured collection has an entry" is m6's
 * criterion, and asserting it here too would be two oracles for one property. This gate asserts the
 * converse — **the map may not name something prod does not have** — which no other check makes.
 *
 * ⚠️ **`live-paths.measured.yaml` is NOT a `.generated.` file** and the stale-generated gate must
 * never try to rebuild it: it needs prod credentials, which CI does not have. Its freshness is a
 * WARNING here instead, which is legal because `validate.ts` writes nothing and may read the clock.
 */
{
  const G = "15";
  const inv = await readYaml<{
    measured_at_utc?: unknown;
    collections?: unknown;
    total_paths?: unknown;
    inventory?: { collection?: string; paths?: string[] }[];
  }>(`${ROOT}/migration/live-paths.measured.yaml`);
  const fm = await readYaml<{
    collections?: {
      collection?: string;
      disposition?: string;
      reason?: unknown;
      paths_default?: string;
      paths_default_reason?: unknown;
      paths_default_to?: unknown;
      paths?: { path?: string; disposition?: string; reason?: unknown; to?: unknown }[];
    }[];
    mappings?: { from?: string }[];
  }>(`${ROOT}/migration/field-map.yaml`);

  if (!inv?.inventory) {
    fail(
      G,
      "migration/live-paths.measured.yaml: no `inventory` — nothing can be checked against it",
    );
  } else {
    const live = new Map(inv.inventory.map((c) => [String(c.collection), new Set(c.paths ?? [])]));

    // The counters in the file header. When a doc states a count, something must count it — the
    // chart header carried "138 entries, four minted" wrong in both halves for weeks.
    const realPaths = inv.inventory.reduce((n, c) => n + (c.paths ?? []).length, 0);
    if (Number(inv.collections) !== inv.inventory.length) {
      fail(
        G,
        `live-paths.measured.yaml: header says collections: ${inv.collections}, inventory holds ${inv.inventory.length}`,
      );
    }
    if (Number(inv.total_paths) !== realPaths) {
      fail(
        G,
        `live-paths.measured.yaml: header says total_paths: ${inv.total_paths}, inventory holds ${realPaths}`,
      );
    }

    // Freshness. A warning, never a failure: the refresh needs prod ADC and a stale measurement is
    // still a measurement — what it must not be is silently stale.
    const stamp = inv.measured_at_utc ? new Date(String(inv.measured_at_utc)) : null;
    if (!stamp || Number.isNaN(stamp.getTime())) {
      fail(G, "live-paths.measured.yaml: `measured_at_utc` missing or unparseable");
    } else {
      // Same clock convention as gates 6 and 9 — real by default, `SPEC_TODAY` so the arm can be
      // fired without waiting for the calendar.
      const envToday = Deno.env.get("SPEC_TODAY");
      const now = envToday ? new Date(envToday) : new Date();
      const days = Math.floor((now.getTime() - stamp.getTime()) / 86_400_000);
      if (days > 45) {
        warn(
          G,
          `live-paths.measured.yaml was measured ${days} days ago — re-run \`cd spikes/harness && deno task inventory --write\``,
        );
      }
    }

    const LEGAL = new Set(["map", "drop", "quarantine", "defective"]);
    const seen = new Set<string>();
    for (const c of fm?.collections ?? []) {
      const name = String(c.collection ?? "");
      const at = `field-map.yaml collections[${name || "(no name)"}]`;
      if (!name) {
        fail(G, `${at}: missing \`collection\``);
        continue;
      }
      if (seen.has(name)) fail(G, `${at}: named twice — one disposition per collection`);
      seen.add(name);
      if (!live.has(name)) {
        fail(
          G,
          `${at}: names a collection prod does not have — it is not in live-paths.measured.yaml`,
        );
        continue;
      }
      if (!LEGAL.has(String(c.disposition))) {
        fail(G, `${at}: disposition "${c.disposition}" is not one of ${[...LEGAL].join(" | ")}`);
      }
      // A stated reason, in whichever of the two fields carries it. A survivor whose collection
      // disposition and `paths_default` say the same thing would otherwise have to write the same
      // sentence twice, and this repo's standing complaint about scatter applies to its own gates.
      // A terminal collection cannot declare `paths_default` at all (below), so it still needs
      // `reason` — the relaxation reaches only the case where something else already explains it.
      const reasoned = [c.reason, c.paths_default_reason].some((r) =>
        String(r ?? "").trim() !== ""
      );
      if (!reasoned) {
        fail(G, `${at}: every disposition carries a \`reason\` — a bare verdict is not a decision`);
      }
      // A blanket over every unnamed path is a deliberate act and says so out loud.
      if (c.paths_default !== undefined) {
        if (!LEGAL.has(String(c.paths_default))) {
          fail(
            G,
            `${at}: paths_default "${c.paths_default}" is not one of ${[...LEGAL].join(" | ")}`,
          );
        }
        if (!c.paths_default_reason || String(c.paths_default_reason).trim() === "") {
          fail(
            G,
            `${at}: \`paths_default\` covers every unnamed path at once and requires \`paths_default_reason\``,
          );
        }
        // ⚠️ The arm that stops m6's criterion from being satisfied by a promise. The criterion says
        // a path "maps to a NEW FIELD"; `paths_default: map` on its own says only "these map", which
        // is an intention wearing a disposition's clothes. A `map` names where it lands.
        if (String(c.paths_default) === "map" && String(c.paths_default_to ?? "").trim() === "") {
          fail(
            G,
            `${at}: \`paths_default: map\` requires \`paths_default_to\` — "these map" is not a mapping, name what they map ONTO`,
          );
        }
        if (TERMINAL_DISPOSITIONS.has(String(c.disposition))) {
          fail(
            G,
            `${at}: \`paths_default\` on a \`${c.disposition}\` collection — a terminal disposition already settles every path, so the default decides nothing`,
          );
        }
      }
      const paths = live.get(name)!;
      const named = new Set<string>();
      for (const p of c.paths ?? []) {
        const path = String(p.path ?? "");
        if (!path) {
          fail(G, `${at}: a paths[] entry with no \`path\``);
          continue;
        }
        if (named.has(path)) fail(G, `${at}: path "${path}" named twice`);
        named.add(path);
        if (!paths.has(path)) {
          fail(G, `${at}: path "${path}" is not a measured path of \`${name}\``);
        }
        if (!LEGAL.has(String(p.disposition))) {
          fail(
            G,
            `${at}.${path}: disposition "${p.disposition}" is not one of ${[...LEGAL].join(" | ")}`,
          );
        }
        if (!p.reason || String(p.reason).trim() === "") {
          fail(G, `${at}.${path}: an exception to the collection's disposition needs a \`reason\``);
        }
        if (String(p.disposition) === "map" && String(p.to ?? "").trim() === "") {
          fail(G, `${at}.${path}: a \`map\` names its target — add \`to:\``);
        }
      }
    }

    /**
     * The prose `mappings:` block predates the collection layer and its `from:` is deliberately
     * expressive — `*.{_cents fields}`, `organizations (the record)`, `invoices.status == "void"`.
     * Those are patterns and this gate does not parse them. A `from:` whose head segment IS a live
     * collection and which carries no pattern syntax is a CONCRETE path, and must resolve.
     *
     * ⚠️ The head is also checked for `[]`. `destinations[].customer_collecting` reads as if the
     * collection were an array; the measured form is `destinations` → `customer_collecting`, and
     * without this arm the entry would be silently classified as a pattern and never checked.
     */
    for (const m of fm?.mappings ?? []) {
      const from = String(m.from ?? "");
      if (!from) continue;
      const dot = from.indexOf(".");
      if (dot < 0) continue;
      const head = from.slice(0, dot);
      const rest = from.slice(dot + 1);
      if (head.endsWith("[]") && live.has(head.slice(0, -2))) {
        fail(
          G,
          `field-map.yaml mappings.from "${from}": the collection is written as an array — it is \`${
            head.slice(0, -2)
          }.${rest}\``,
        );
        continue;
      }
      if (!live.has(head)) continue; // a pattern, or a concept rather than a collection
      if (/[{}*\s=]/.test(rest)) continue; // a pattern over paths, not one path
      if (!live.get(head)!.has(rest)) {
        fail(
          G,
          `field-map.yaml mappings.from "${from}": \`${rest}\` is not a measured path of \`${head}\``,
        );
      }
    }
  }
}

// ── gate 16: the spec chart against the MEASURED live chart ─────────────────
/**
 * erp-spec#8 step 4 — "the live→target GL account correspondence".
 *
 * ⚠️ **The issue says it "exists nowhere". It exists, and it is `ledger/chart-of-accounts.yaml`
 * itself** — every entry already carries `disposition:` and `status_live:`. Measured 2026-08-16 it
 * is also exact: 139 spec entries against 134 live plus 5 minted, with 0 live codes missing, 0
 * `status_live` disagreements and 0 name disagreements.
 *
 * **So what was missing is an EXECUTION, not an artifact.** Nothing counted 139 against 134 + 5,
 * nothing compared `status_live` to the live `status`, and the chart's own header read "138
 * entries, four minted" — wrong in both halves from the day 5150 was added. A correspondence
 * nothing can falsify is the class of claim this repo keeps paying for.
 *
 * `spikes/harness/live-chart-probe.ts` writes the live half from CFS's Firestore mirror (never the
 * Xero API — single tenant, live, shared quota). Neither side can pass by agreeing with itself.
 *
 * ⚠️ **A NAME divergence fails only under `adopt`.** `adopt` means "keep as is", so a rename there
 * is a defect; under `merge`, `drop` or `undecided` a different name is the decision being recorded,
 * and failing on it would punish the spec for doing its job.
 */
{
  const G = "16";
  const liveChart = await readYaml<{
    measured_at_utc?: unknown;
    accounts_total?: unknown;
    accounts?: { code?: number; name?: string; status?: string }[];
  }>(`${ROOT}/migration/live-chart.measured.yaml`);
  const specChart = await readYaml<{
    accounts?: { code?: unknown; name?: unknown; disposition?: unknown; status_live?: unknown }[];
  }>(`${ROOT}/ledger/chart-of-accounts.yaml`);

  if (!liveChart?.accounts) {
    fail(
      G,
      "migration/live-chart.measured.yaml is missing or has no `accounts` — run `cd spikes/harness && deno task chart --write`",
    );
  } else if (!specChart?.accounts) {
    fail(G, "ledger/chart-of-accounts.yaml has no `accounts`");
  } else {
    const live = new Map(liveChart.accounts.map((a) => [Number(a.code), a]));
    const spec = new Map(specChart.accounts.map((a) => [Number(a.code), a]));

    if (Number(liveChart.accounts_total) !== liveChart.accounts.length) {
      fail(
        G,
        `live-chart.measured.yaml: header says accounts_total: ${liveChart.accounts_total}, file holds ${liveChart.accounts.length}`,
      );
    }

    const envToday = Deno.env.get("SPEC_TODAY");
    const stamp = liveChart.measured_at_utc ? new Date(String(liveChart.measured_at_utc)) : null;
    if (!stamp || Number.isNaN(stamp.getTime())) {
      fail(G, "live-chart.measured.yaml: `measured_at_utc` missing or unparseable");
    } else {
      const days = Math.floor(
        ((envToday ? new Date(envToday) : new Date()).getTime() - stamp.getTime()) / 86_400_000,
      );
      if (days > 45) {
        warn(
          G,
          `live-chart.measured.yaml was measured ${days} days ago — re-run \`cd spikes/harness && deno task chart --write\``,
        );
      }
    }

    // 16a — every live account is accounted for. A live code the spec does not name is an account
    // the migration would silently lose, and it is the direction nobody checks by reading.
    for (const [code, a] of live) {
      if (!spec.has(code)) {
        fail(
          G,
          `live account ${code} "${a.name}" appears in no \`ledger/chart-of-accounts.yaml\` entry — every live account is adopted, merged or explicitly dropped, never omitted`,
        );
      }
    }

    // 16b — the spec's claims about the live world are true.
    let minted = 0;
    for (const [code, s] of spec) {
      const l = live.get(code);
      const disp = String(s.disposition ?? "");
      const claimed = String(s.status_live ?? "");
      if (!l) {
        minted++;
        if (disp !== "new") {
          fail(
            G,
            `${code}: \`disposition: ${disp}\` but no live account has that code — only a \`new\` account may be absent`,
          );
        }
        if (claimed !== "absent") {
          fail(
            G,
            `${code}: \`status_live: ${claimed}\` but the account is not in the live chart — a minted account reads \`absent\``,
          );
        }
        continue;
      }
      if (disp === "new") {
        fail(
          G,
          `${code}: \`disposition: new\` but live account ${code} "${l.name}" already exists — minting a code the live chart occupies is how 5800's first revision landed on 5100`,
        );
      }
      if (claimed !== String(l.status)) {
        fail(
          G,
          `${code}: \`status_live: ${claimed}\` but the live chart says "${l.status}"`,
        );
      }
      if (disp === "adopt" && String(s.name ?? "") !== String(l.name)) {
        fail(
          G,
          `${code}: \`adopt\` keeps the live name — spec "${s.name}" vs live "${l.name}". Use \`merge\` or \`drop\` if the rename is the decision`,
        );
      }
    }

    // 16c — the arithmetic the chart header states in prose. Something counts it now.
    if (spec.size !== live.size + minted) {
      fail(
        G,
        `chart arithmetic: ${spec.size} spec entries against ${live.size} live + ${minted} minted`,
      );
    }
    notes.push(
      `gate 16: ${spec.size} spec accounts = ${live.size} live + ${minted} minted; ` +
        `measured ${String(liveChart.measured_at_utc)}`,
    );
  }
}

// ── gate 17: house spelling in the refactorable spec ────────────────────────
/**
 * Owner, 2026-08-16: _"labor does not have a u, adopt this."_
 *
 * ⚠️ **A spelling convention with nothing executing it is the class of claim this repo has paid for
 * most often.** The identifiers already used `labor` (`labor_line`, `labor_line_kinds`) while the
 * prose said "labour", and nothing could see the split. Written down and unenforced it drifts back
 * the first time somebody types the other one.
 *
 * ── THREE exemptions, each on a LIFECYCLE ground rather than a taste one ────────────────────────
 *
 * - **`inbox/` and `research-drop/`** are append-only. A dated capture note records what was written
 *   when it was written; rewriting one to match a later convention is what the append-only rule
 *   exists to prevent.
 * - **An `accepted` or `superseded` ADR** is immutable and gate 14 hashes its body. ADR-0001,
 *   ADR-0011 and ADR-0036 carry "labour" permanently, and that is CORRECT — an accepted ADR is a
 *   historical record of the decision as taken (ADR-0034), spelling included.
 * - **A CITATION of an append-only filename.** Three inbox files carry "labour" in their names and
 *   are never renamed, so prose citing one must keep it. ⚠️ Not hypothetical: the sweep rewrote
 *   twelve such citations and **gate 11 caught every one**. The two gates compose rather than
 *   overlap — 11 says the path resolves, 17 says the prose spells it the house way — and this
 *   exemption is what stops them contradicting each other.
 */
{
  const G = "17";
  /** House spelling. One entry today; it has a member, which is the bar. */
  const SPELLINGS: [RegExp, string][] = [[/labour/gi, "labor"]];
  const immutableAdrFiles = new Set(
    adrs.filter((a) => a.status === "accepted" || a.status === "superseded").map((a) => a._file),
  );
  /** A path into an append-only directory keeps that directory's spelling. */
  const APPEND_ONLY_CITATION = /(?:inbox|research-drop)\/[^\s`"'),\]]+/g;

  const dirs = [
    "adr",
    "spikes",
    "contexts",
    "ledger",
    "reporting",
    "migration",
    "roadmap",
    "tools",
  ];
  const targets: string[] = [];
  for (const d of dirs) {
    for (const ext of [".md", ".yaml", ".feature", ".ts"]) targets.push(...await filesIn(d, ext));
  }
  for (
    const f of [
      "charter.md",
      "README.md",
      "CLAUDE.md",
      "glossary.yaml",
      "hotspots.yaml",
      "open-questions.yaml",
    ]
  ) {
    targets.push(`${ROOT}/${f}`);
  }

  // ⚠️ **The file that DEFINES the table is exempt, and it has to be.** A check that bans a word
  // cannot name the word it bans — gate 17's first run failed on its own doc comment, four times.
  // The exemption is by identity and covers this file only, so the convention still holds across
  // the rest of `tools/`. The alternative was writing the rule without ever spelling out what it
  // replaces, which makes the one place a reader goes to understand it the one place that cannot
  // say it.
  const SELF = `${ROOT}/tools/validate.ts`;

  for (const f of targets) {
    if (immutableAdrFiles.has(f) || f === SELF) continue;
    let text: string;
    try {
      text = await Deno.readTextFile(f);
    } catch {
      continue;
    }
    // Blank the citations before looking, so an append-only filename cannot be accused of a
    // spelling it is not allowed to change.
    text = text.replace(APPEND_ONLY_CITATION, (m) => " ".repeat(m.length));
    for (const [bad, good] of SPELLINGS) {
      const hits = [...text.matchAll(bad)];
      if (hits.length === 0) continue;
      const line = text.slice(0, hits[0].index).split("\n").length;
      fail(
        G,
        `${rel(f)}:${line}: "${
          hits[0][0]
        }" — house spelling is "${good}" (${hits.length} occurrence${
          hits.length === 1 ? "" : "s"
        })`,
      );
    }
  }
}

// ── gate 18: a minted account is reachable from a posting rule ──────────────
/**
 * ⚠️ **Minting an account creates no posting rule, and nothing noticed until 2026-08-17.** ADR-0030
 * (vehicle cost into COGS) was ACCEPTED with `5900`, `5901`, `5902` and `6409` named in its
 * Consequences, and not one of them appeared anywhere in `ledger/posting-rules.yaml`. `m3 Ledger
 * core` read **4 met / 0 unmet** through all of it: its criteria ask whether every EVENT is covered
 * and whether every RULE has vectors, and **nothing asked whether every ACCOUNT is reachable**.
 * `coa_complete` verifies accounts EXIST; existence is not reachability.
 *
 * ── the scope is MINTED accounts, and the bar is the chart's own ────────────────────────────────
 *
 * `ledger/chart-of-accounts.yaml` states it: _"an account enters this file because a posting rule
 * has no legal account for one of its legs, not because a chart 'should have' one."_ That is a
 * claim about every `disposition: new` entry, and nothing executed it.
 *
 * ⚠️ **An ADOPTED account is a different question and this gate does NOT answer it.** It exists in
 * the live chart whatever this spec decides, and settling what may post to each of the 108 is a
 * where-does-it-post decision under CLAUDE.md rule 8a — six references at a time, not a bulk
 * classification typed in one sitting. The note this gate pushes COUNTS them so the silence is a
 * measured number rather than an assumption, and **erp-spec#37** holds the work. Do not read a
 * green gate 18 as "every account has a home".
 *
 * ── a path-typed side reaches accounts this gate cannot see, so the reach is DECLARED ───────────
 *
 * Fourteen of the account references in the posting rules are dotted paths — `line.debit_account`,
 * `session.deposit_account` — whose value is chosen per document. Treating a path as reaching
 * EVERYTHING would make this gate green on any mint whatsoever, which is the defect class this repo
 * keeps paying for; treating it as reaching NOTHING would fail on `5902`, which ADR-0030 routes
 * through `vendor_bill_received`'s direct line deliberately ("it needs nothing new"). So a posting
 * declares which minted accounts its path may resolve to, one reason per account, and the
 * declaration is refused wherever it would not be doing work:
 *
 *   · on a posting whose two sides are both literal codes — a literal already names its account;
 *   · naming a code that is not `disposition: new` — this gate does not check adopted accounts, so
 *     a claim about one would read as coverage it does not have.
 *
 * **It is an INCLUSIVE declaration and that is deliberate.** An exclusion list ("any expense
 * account except these") fails OPEN: the next minted COGS account silently falls inside the domain
 * and is reported reachable by a rule that must never touch it. An inclusive one fails CLOSED — a
 * new mint is unreachable until somebody writes down what reaches it.
 */
{
  const G = "18";
  interface ChartEntry {
    code?: unknown;
    name?: unknown;
    disposition?: unknown;
    source?: unknown;
  }
  interface RulePosting {
    debit_account?: unknown;
    credit_account?: unknown;
    reaches_minted_accounts?: unknown;
  }
  const coaY = await readYaml<{ accounts?: ChartEntry[] }>(
    `${ROOT}/ledger/chart-of-accounts.yaml`,
  );
  const prY = await readYaml<
    { rules?: { id?: string; status?: string; postings?: RulePosting[] }[] }
  >(
    `${ROOT}/ledger/posting-rules.yaml`,
  );
  const chart = new Map<number, ChartEntry>();
  for (const a of coaY?.accounts ?? []) {
    if (typeof a.code === "number") chart.set(a.code, a);
  }

  /** account code -> every place a specified rule can put a posting into it. */
  const reachedBy = new Map<number, string[]>();
  const mark = (code: number, how: string) =>
    reachedBy.set(code, [...(reachedBy.get(code) ?? []), how]);
  /**
   * Codes whose only claim to a reach is a MALFORMED declaration. They are not reachable — a claim
   * with no reason grants no coverage, and the note below must not count one — but they are already
   * named by their own failure, so 18a stays quiet about them. ⚠️ **Two messages for one defect is
   * how a gate teaches the wrong lesson at 2am**: the empty-string arm of gate 10h double-reported
   * the empty-LIST case for exactly this reason, and this arm was written the same way until it was
   * fired with a blank reason and reported the account twice.
   */
  const claimedButMalformed = new Set<number>();

  for (const r of prY?.rules ?? []) {
    if (r.status !== "specified") continue;
    for (const [j, p] of (r.postings ?? []).entries()) {
      const where = `posting-rules "${r.id}" posting[${j}]`;
      const sides = [p.debit_account, p.credit_account];
      for (const v of sides) if (typeof v === "number") mark(v, `${r.id}[${j}]`);

      const decl = p.reaches_minted_accounts;
      if (decl === undefined) continue;
      if (!decl || typeof decl !== "object" || Array.isArray(decl)) {
        fail(
          G,
          `${where}: \`reaches_minted_accounts\` must be a map of account code -> the reason that path can resolve to it`,
        );
        continue;
      }
      if (sides.every((v) => typeof v === "number")) {
        fail(
          G,
          `${where}: declares \`reaches_minted_accounts\` while both sides are literal codes — a literal already names its account, so the declaration claims a reach nothing needs`,
        );
      }
      for (const [k, reason] of Object.entries(decl as Record<string, unknown>)) {
        const code = Number(k);
        if (!Number.isInteger(code)) {
          fail(G, `${where}: \`reaches_minted_accounts\` key "${k}" is not an account code`);
          continue;
        }
        const a = chart.get(code);
        if (!a) {
          fail(
            G,
            `${where}: \`reaches_minted_accounts\` names ${code}, which is not an account in ledger/chart-of-accounts.yaml`,
          );
          continue;
        }
        if (a.disposition !== "new") {
          fail(
            G,
            `${where}: \`reaches_minted_accounts\` names ${code} "${a.name}", whose disposition is \`${a.disposition}\` — this gate checks minted accounts only, so a claim about an adopted one reads as coverage it does not have`,
          );
          continue;
        }
        if (typeof reason !== "string" || reason.trim().length === 0) {
          fail(
            G,
            `${where}: \`reaches_minted_accounts\`[${code}] needs a reason — which field of the source document supplies that account, and what decided it`,
          );
          claimedButMalformed.add(code);
          continue;
        }
        mark(code, `${r.id}[${j}] (declared)`);
      }
    }
  }

  // 18a — the reachability check itself. A mint with nothing posting to it is an account that
  // exists for a rule nobody wrote.
  const minted = [...chart.values()].filter((a) => a.disposition === "new");
  const mintedUnreached = minted.filter((a) =>
    !reachedBy.has(Number(a.code)) && !claimedButMalformed.has(Number(a.code))
  );
  for (const a of mintedUnreached) {
    fail(
      G,
      `${a.code} "${a.name}" is minted (\`disposition: new\`, source ${a.source}) and NO specified posting rule posts to it. ` +
        `Write the rule, park its event in \`unwritten:\` with an issue, or — where a path already reaches it — declare that path's \`reaches_minted_accounts\``,
    );
  }

  // 18b — a rule may not post into an account the migration removes. Nothing does today; the arm
  // was fired by flipping 5800 to `drop` and watching `shift_recorded` name it.
  for (const [code, hows] of reachedBy) {
    const a = chart.get(code);
    if (!a) continue; // gate 10e already fails on a literal that is not in the chart
    if (a.disposition === "drop" || a.disposition === "merge") {
      fail(
        G,
        `${code} "${a.name}" is \`disposition: ${a.disposition}\` and ${
          hows.join(", ")
        } posts to it — a posting rule cannot target an account the migration removes`,
      );
    }
  }

  const adopted = [...chart.values()].filter((a) => a.disposition === "adopt");
  const adoptedUnreached = adopted.filter((a) => !reachedBy.has(Number(a.code)));
  // ⚠️ Counted off `reachedBy`, NOT off `minted.length - mintedUnreached.length`. The second form
  // counts a malformed claim as coverage — it reported "5 of 9" with a blank reason, which is the
  // number a reader would have taken away from a run whose only real reach was four.
  const mintedReachable = minted.filter((a) => reachedBy.has(Number(a.code))).length;
  notes.push(
    `gate 18: ${mintedReachable} of ${minted.length} minted accounts are ` +
      `reachable from a specified posting rule; NOT CHECKED — ${adoptedUnreached.length} of ` +
      `${adopted.length} adopted accounts are named by no rule (erp-spec#37)`,
  );
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
  "15": "the migration field map against the measured live inventory",
  "16": "the spec chart of accounts against the measured live chart",
  "17": "house spelling in the refactorable spec",
  "18": "every minted account is reachable from a posting rule",
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
