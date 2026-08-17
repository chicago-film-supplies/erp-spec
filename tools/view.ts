#!/usr/bin/env -S deno run --allow-read --allow-run --allow-net --allow-env=SPEC_TODAY
/**
 * tools/view.ts — local, read-only live viewer for the spec.
 *
 * Serves the spec as one browsable, cross-linked page. Every source file is re-read on each
 * request, so editing a YAML and refreshing the browser shows the change with no `deno task gen`
 * in between. That is the whole point of this tool versus opening the `.generated.` files.
 *
 * It is tooling in the `tools/` sense (CLAUDE.md): a view over the spec that ships nothing into
 * the target system and is imported by nothing that does. Two disciplines it inherits from the
 * repo:
 *
 *   1. It writes NOTHING. Like validate.ts, that frees it to read the real clock — overdue
 *      `decide_by` / `review_by` dates are flagged live here, exactly the "time-dependent
 *      judgement belongs to the tool that writes nothing" rule the generated files must obey.
 *   2. It reads only *source* files, never the `.generated.` artifacts. So what it shows is the
 *      spec's true current state, not a possibly-stale snapshot — a stale generated file cannot
 *      lie to you through this viewer because the viewer never opens one.
 *
 * The live worklist panel shells out to validate.ts and shows its exact stdout, so the viewer
 * never reimplements a gate and can never disagree with `deno task validate`.
 *
 * Permissions, kept as narrow as the other tools (deno.md → "narrow and deliberate"):
 *   --allow-read              read the spec source tree
 *   --allow-run               spawn `deno` once, on validate.ts, for the live worklist — nothing else
 *   --allow-net               bind the loopback HTTP server (127.0.0.1 only)
 *   --allow-env=SPEC_TODAY    same clock override validate.ts honours; no other env is read
 *
 *   deno task view                # http://localhost:8000
 *   deno task view --port 9000
 */
import { parse as parseYaml } from "@std/yaml";
import { walk } from "@std/fs";
import { basename, relative } from "@std/path";
import { CONTEXTS } from "./contexts.ts";
import { ymdUTC } from "./dates.ts";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const isTemplate = (p: string) =>
  basename(p).startsWith("_") || basename(p).includes(".generated.");
const rel = (p: string) => relative(ROOT, p);

// Same skip set validate.ts uses: the harness installs a node_modules tree of unparseable READMEs.
const SKIP = [/[\\/]node_modules[\\/]/, /[\\/]spikes[\\/]harness[\\/]\.(bin|data)[\\/]/];

// The registry is `tools/contexts.ts` and nothing else may hold a copy — see the note there.
// ⚠️ This file held a NINTH copy until 2026-08-16: a hardcoded eight-entry map, written before
// procurement existed and never updated (erp-spec#10 consolidated the four copies it knew about
// and missed this one, because `view.ts` runs no gate and so never went red). The viewer silently
// omitted every procurement requirement and event — the exact rot the registry exists to prevent,
// and a reminder that a hand-maintained list in a tool NOTHING VALIDATES rots invisibly.

// ── types (a superset of what validate.ts loads; only display fields added) ───
interface Req {
  id: string;
  statement?: string;
  rationale?: string;
  source?: string;
  priority?: string;
  verification_method?: string;
  status?: string;
  relates_to?: string[];
  _context: string;
}
interface Evt {
  id: string;
  name?: string;
  producer?: string;
  consumers?: string[];
  terminal?: boolean;
  blocked_by?: string[];
  _context: string;
}
interface Adr {
  id: string;
  title?: string;
  status?: string;
  date?: string;
  review_by?: string;
  contexts?: string[];
  supersedes?: string | null;
  supersedes_on_acceptance?: string | null;
  superseded_by?: string | null;
  relates_to?: string[];
  body: string;
  _file: string;
}
interface Hot {
  id: string;
  title?: string;
  statement?: string;
  summary?: string;
  status?: string;
  contexts?: string[];
  blocks?: string[];
}
interface Oq {
  id: string;
  question?: string;
  title?: string;
  owner?: unknown;
  decide_by?: unknown;
  status?: string;
  blocks?: string[];
}
interface Spike {
  id: string;
  question?: string;
  title?: string;
  status?: string;
  timebox?: string;
  closes_adr?: string;
  exit_criteria?: unknown[];
  body: string;
  _file: string;
}
interface Inbox {
  file: string;
  title?: string;
  contexts?: string[];
  promotes_to?: string[];
}
interface Term {
  term: string;
  aliases?: string[];
  contexts?: string[];
  definition?: string;
}
interface Milestone {
  id: string;
  title?: string;
  depends_on?: string[];
  exit_criteria?: unknown[];
  status?: string;
}

interface Spec {
  reqs: Req[];
  evts: Evt[];
  adrs: Adr[];
  hots: Hot[];
  oqs: Oq[];
  spikes: Spike[];
  inbox: Inbox[];
  terms: Term[];
  milestones: Milestone[];
  scenariosByReq: Map<string, string[]>;
}

async function readYaml<T = unknown>(path: string): Promise<T | null> {
  try {
    return parseYaml(await Deno.readTextFile(path)) as T;
  } catch {
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

async function mdFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (
      const e of walk(`${ROOT}/${dir}`, { exts: [".md"], includeDirs: false, skip: SKIP })
    ) {
      if (!isTemplate(e.path)) out.push(e.path);
    }
  } catch { /* dir absent */ }
  return out.sort();
}

/** Read the whole spec from source. Called on every request — the "live" in live viewer. */
async function loadSpec(): Promise<Spec> {
  const reqs: Req[] = [];
  const evts: Evt[] = [];
  for (const dir of CONTEXTS) {
    const ry = await readYaml<{ requirements?: Req[] }>(
      `${ROOT}/contexts/${dir}/requirements.yaml`,
    );
    for (const r of ry?.requirements ?? []) reqs.push({ ...r, _context: dir });
    const ey = await readYaml<{ events?: Evt[] }>(`${ROOT}/contexts/${dir}/events.yaml`);
    for (const e of ey?.events ?? []) evts.push({ ...e, _context: dir });
  }

  const adrs: Adr[] = [];
  for (const f of await mdFiles("adr")) {
    const parsed = frontMatter(await Deno.readTextFile(f));
    if (parsed) adrs.push({ ...(parsed.fm as unknown as Adr), body: parsed.body, _file: f });
  }

  const spikes: Spike[] = [];
  for (const f of await mdFiles("spikes")) {
    const parsed = frontMatter(await Deno.readTextFile(f));
    if (parsed) spikes.push({ ...(parsed.fm as unknown as Spike), body: parsed.body, _file: f });
  }

  const inbox: Inbox[] = [];
  for (const f of await mdFiles("inbox")) {
    const parsed = frontMatter(await Deno.readTextFile(f));
    if (parsed) {
      const fm = parsed.fm;
      inbox.push({
        file: rel(f),
        title: fm.title as string | undefined,
        contexts: fm.contexts as string[] | undefined,
        promotes_to: Array.isArray(fm.promotes_to) ? (fm.promotes_to as string[]) : [],
      });
    }
  }

  const hotY = await readYaml<{ hotspots?: Hot[] }>(`${ROOT}/hotspots.yaml`);
  const oqY = await readYaml<{ open_questions?: Oq[] }>(`${ROOT}/open-questions.yaml`);
  const glossY = await readYaml<{ terms?: Term[] }>(`${ROOT}/glossary.yaml`);
  const msY = await readYaml<{ milestones?: Milestone[] }>(`${ROOT}/roadmap/milestones.yaml`);

  // req -> scenario files, from @REQ- tags in .feature files (same source validate.ts gate 3 uses)
  const scenariosByReq = new Map<string, string[]>();
  try {
    for await (
      const e of walk(`${ROOT}/contexts`, { exts: [".feature"], includeDirs: false, skip: SKIP })
    ) {
      if (isTemplate(e.path)) continue;
      const text = await Deno.readTextFile(e.path);
      for (const m of text.matchAll(/@(REQ-[A-Z]{2,3}-\d{3})/g)) {
        const arr = scenariosByReq.get(m[1]) ?? [];
        if (!arr.includes(rel(e.path))) arr.push(rel(e.path));
        scenariosByReq.set(m[1], arr);
      }
    }
  } catch { /* none yet */ }

  return {
    reqs,
    evts,
    adrs,
    spikes,
    inbox,
    hots: hotY?.hotspots ?? [],
    oqs: oqY?.open_questions ?? [],
    terms: glossY?.terms ?? [],
    milestones: msY?.milestones ?? [],
    scenariosByReq,
  };
}

// ── the live validate worklist ────────────────────────────────────────────────
/** Run `validate.ts` in a child process and hand back its exact stdout. Never our own gate. */
async function runValidate(): Promise<{ ok: boolean; text: string }> {
  try {
    const cmd = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-read", "--allow-env=SPEC_TODAY", `${ROOT}/tools/validate.ts`],
      stdout: "piped",
      stderr: "piped",
      env: { SPEC_TODAY: Deno.env.get("SPEC_TODAY") ?? "" },
    });
    const { code, stdout, stderr } = await cmd.output();
    const text = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    return { ok: code === 0, text };
  } catch (e) {
    return { ok: false, text: `could not run validate.ts: ${e instanceof Error ? e.message : e}` };
  }
}

// ── html helpers ──────────────────────────────────────────────────────────────
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ID_RE =
  /\b(REQ-[A-Z]{2,3}-\d{3}|EVT-[A-Z]{2,3}-\d{3}|ADR-\d{4}|HOT-\d{3}|OQ-\d{3}|SPIKE-\d{3})\b/g;

/** Turn any spec id inside already-escaped text into an in-page anchor link. */
const linkIds = (escaped: string) =>
  escaped.replace(ID_RE, (id) => `<a class="idlink" href="#${id}" data-id="${id}">${id}</a>`);

/** One id as a chip link (input NOT yet escaped). */
const chip = (id: string) => linkIds(esc(id));
const chips = (
  ids?: string[],
) => (ids && ids.length ? ids.map(chip).join(" ") : "<span class='muted'>—</span>");

/** Minimal, safe markdown for ADR / spike bodies: headings, lists, blockquotes, code, bold,
 * [[wikilinks]], and any spec id. Soft-wrapped list items and blockquote lines are re-joined. */
function renderMarkdown(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let listItems: string[] = [];
  let quote: string[] = [];
  let inCode = false;
  const inline = (s: string) => {
    let t = esc(s);
    t = t.replace(
      /\[\[([A-Za-z0-9-]+)\]\]/g,
      (_m, p1) => `<a class="idlink" href="#${p1}" data-id="${p1}">${p1}</a>`,
    );
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return linkIds(t);
  };
  const flushList = () => {
    if (listItems.length) {
      out.push("<ul>" + listItems.map((li) => `<li>${inline(li)}</li>`).join("") + "</ul>");
    }
    listItems = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
    quote = [];
  };
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      flushList();
      flushQuote();
      inCode = !inCode;
      out.push(inCode ? "<pre class='code'>" : "</pre>");
      continue;
    }
    if (inCode) {
      out.push(esc(raw) + "\n");
      continue;
    }
    const q = raw.match(/^\s*>\s?(.*)$/);
    if (q) {
      flushList();
      quote.push(q[1]);
      continue;
    }
    const li = raw.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      flushQuote();
      listItems.push(li[1]);
      continue;
    }
    if (raw.trim() === "") {
      flushList();
      flushQuote();
      continue;
    }
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      flushQuote();
      out.push(
        `<h${Math.min(h[1].length + 2, 6)}>${inline(h[2])}</h${Math.min(h[1].length + 2, 6)}>`,
      );
      continue;
    }
    // plain line: continuation of a soft-wrapped list item, else a paragraph
    if (listItems.length) {
      listItems[listItems.length - 1] += " " + raw.trim();
      continue;
    }
    flushQuote();
    out.push(`<p>${inline(raw)}</p>`);
  }
  flushList();
  flushQuote();
  if (inCode) out.push("</pre>");
  return out.join("");
}

// ── date judgement (real clock; the viewer writes nothing so it may read it) ──
// A YAML date may arrive as a JS Date (unquoted `decide_by: 2026-08-08` — the exact trap
// CLAUDE.md documents) or as a string. Everything here reduces to a UTC calendar day so the
// display never renders in the runner's timezone and "overdue" is judged day-to-day, not to the
// millisecond (a decision due *today* is not yet late).
function dayNum(d: unknown): number | null {
  if (d == null || d === "") return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  if (isNaN(dt.getTime())) return null;
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}
/**
 * ⚠️ **This was the sixth copy of the calendar-day reduction, in the file that already held the
 * fifth copy of the context registry.** That is not a coincidence and CLAUDE.md names the cause:
 * `view.ts` **runs no gate and so can never go red**, which makes it the one place a stale copy
 * survives indefinitely. It is now the second documented instance in this same file — worth
 * remembering the next time something here looks like it could be its own little helper.
 */
function fmtDate(d: unknown): string {
  const n = dayNum(d);
  return n === null ? esc(d) : ymdUTC(new Date(n));
}
function todayNum(): number {
  const env = Deno.env.get("SPEC_TODAY");
  const dt = env ? new Date(env) : new Date();
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}
function overdue(d: unknown): boolean {
  const n = dayNum(d);
  return n !== null && n < todayNum();
}
const dateCell = (d: unknown) => {
  if (dayNum(d) === null) return "<span class='muted'>—</span>";
  const od = overdue(d);
  return `<span class="${od ? "overdue" : ""}">${fmtDate(d)}${od ? " ⚠" : ""}</span>`;
};

// ── section renderers ─────────────────────────────────────────────────────────
function card(id: string, kind: string, title: string, meta: string, bodyHtml: string): string {
  return `<article class="card" id="${esc(id)}">
    <header><span class="kind ${kind}">${kind}</span>
      <span class="cid">${esc(id)}</span>
      <span class="ctitle">${title}</span></header>
    <div class="meta">${meta}</div>
    ${bodyHtml ? `<div class="body">${bodyHtml}</div>` : ""}
  </article>`;
}

function renderDashboard(s: Spec, v: { ok: boolean; text: string }): string {
  const adrAccepted = s.adrs.filter((a) => a.status === "accepted").length;
  const adrProposed = s.adrs.filter((a) => a.status === "proposed").length;
  const spikesOpen =
    s.spikes.filter((sp) => (sp.status ?? "open") !== "closed" && sp.status !== "abandoned").length;
  const inboxUnpromoted =
    s.inbox.filter((i) => !i.promotes_to || i.promotes_to.length === 0).length;
  const oqUnowned =
    s.oqs.filter((q) =>
      !q.owner || String(q.owner).trim() === "" || String(q.owner).trim() === "TBD"
    ).length;
  const oqOverdue = s.oqs.filter((q) => overdue(q.decide_by)).length;
  const hotOpen = s.hots.filter((h) => (h.status ?? "open") === "open").length;

  const tiles = [
    ["Open questions", s.oqs.length, `${oqUnowned} unowned · ${oqOverdue} overdue`],
    ["Conflicts (HOT)", s.hots.length, `${hotOpen} open`],
    ["Decisions (ADR)", s.adrs.length, `${adrAccepted} in force · ${adrProposed} proposed`],
    ["Spikes", s.spikes.length, `${spikesOpen} open`],
    [
      "Requirements",
      s.reqs.length,
      `${
        s.reqs.filter((r) => (s.scenariosByReq.get(r.id) ?? []).length === 0).length
      } without a scenario`,
    ],
    ["Inbox", s.inbox.length, `${inboxUnpromoted} unpromoted`],
  ]
    .map(([label, n, sub]) =>
      `<div class="tile"><div class="n">${n}</div><div class="l">${label}</div><div class="s">${sub}</div></div>`
    )
    .join("");

  const worklist = `<div class="worklist ${v.ok ? "green" : "red"}">
      <div class="wl-head">${
    v.ok ? "✓ deno task validate is clean" : "● live worklist — deno task validate"
  }</div>
      <pre>${esc(v.text.trim())}</pre>
    </div>`;

  return `<section id="dashboard"><h2>Dashboard</h2>
    <div class="tiles">${tiles}</div>
    ${worklist}
  </section>`;
}

function renderRoadmap(s: Spec): string {
  if (!s.milestones.length) return "";
  const rows = s.milestones
    .map(
      (m) =>
        `<tr><td>${chip(m.id)}</td><td>${esc(m.title)}</td><td>${
          chips(m.depends_on)
        }</td><td class="num">${
          Array.isArray(m.exit_criteria) ? m.exit_criteria.length : 0
        }</td><td>${esc(m.status ?? "")}</td></tr>`,
    )
    .join("");
  return `<section id="roadmap"><h2>Roadmap</h2>
    <table><thead><tr><th>Milestone</th><th>Title</th><th>Depends on</th><th>Exit</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`;
}

function renderOqs(s: Spec): string {
  if (!s.oqs.length) return "";
  const cards = s.oqs
    .map((q) => {
      const meta = `owner: <strong>${esc(q.owner ?? "—")}</strong> · decide by: ${
        dateCell(q.decide_by)
      } · status: ${esc(q.status ?? "open")}
        <div>blocks: ${chips(q.blocks)}</div>`;
      return card(q.id, "OQ", esc(q.question ?? q.title ?? ""), meta, "");
    })
    .join("");
  return `<section id="oqs"><h2>Open questions <span class="count">${s.oqs.length}</span></h2>${cards}</section>`;
}

function renderHots(s: Spec): string {
  if (!s.hots.length) return "";
  const cards = s.hots
    .map((h) => {
      const meta = `status: ${esc(h.status ?? "open")} · contexts: ${
        (h.contexts ?? []).map((c) => `<span class="tag">${esc(c)}</span>`).join(" ") || "—"
      }<div>blocks: ${chips(h.blocks)}</div>`;
      return card(h.id, "HOT", esc(h.title ?? h.statement ?? h.summary ?? ""), meta, "");
    })
    .join("");
  return `<section id="hots"><h2>Conflicts <span class="count">${s.hots.length}</span></h2>${cards}</section>`;
}

function renderAdrs(s: Spec): string {
  if (!s.adrs.length) return "";
  const spikesByAdr = new Map<string, string[]>();
  for (const sp of s.spikes) {
    if (sp.closes_adr && sp.closes_adr !== "new") {
      const a = spikesByAdr.get(sp.closes_adr) ?? [];
      a.push(sp.id);
      spikesByAdr.set(sp.closes_adr, a);
    }
  }
  const blockersFor = (adrId: string): string[] => {
    const out: string[] = [];
    for (const q of s.oqs) if ((q.blocks ?? []).includes(adrId)) out.push(q.id);
    for (const h of s.hots) if ((h.blocks ?? []).includes(adrId)) out.push(h.id);
    for (const sp of spikesByAdr.get(adrId) ?? []) out.push(sp);
    return out;
  };
  const order = { accepted: 0, proposed: 1, rejected: 2, superseded: 3 } as Record<string, number>;
  const cards = [...s.adrs]
    .sort((a, b) =>
      (order[a.status ?? ""] ?? 9) - (order[b.status ?? ""] ?? 9) || a.id.localeCompare(b.id)
    )
    .map((a) => {
      const meta = `status: <strong class="st-${esc(a.status)}">${esc(a.status ?? "?")}</strong>` +
        ` · date: ${a.date ? fmtDate(a.date) : "—"}` +
        (a.status === "proposed" ? ` · review by: ${dateCell(a.review_by)}` : "") +
        ` · contexts: ${
          (a.contexts ?? []).map((c) => `<span class="tag">${esc(c)}</span>`).join(" ") || "—"
        }` +
        `<div>supersedes: ${chips(a.supersedes ? [String(a.supersedes)] : [])} · superseded by: ${
          chips(a.superseded_by ? [String(a.superseded_by)] : [])
        } · relates to: ${chips(a.relates_to)}</div>` +
        // Pending supersession. This viewer runs no gate, so it is exactly the surface that
        // silently omitted procurement — a new front-matter field lands here in the same commit.
        (a.supersedes_on_acceptance
          ? `<div>supersedes on acceptance: ${chips([String(a.supersedes_on_acceptance)])}</div>`
          : "") +
        `<div>blocked on: ${chips(blockersFor(a.id))}</div>`;
      return card(a.id, "ADR", esc(a.title ?? ""), meta, renderMarkdown(a.body));
    })
    .join("");
  return `<section id="adrs"><h2>Decisions <span class="count">${s.adrs.length}</span></h2>${cards}</section>`;
}

function renderSpikes(s: Spec): string {
  if (!s.spikes.length) return "";
  const cards = s.spikes
    .map((sp) => {
      const meta = `status: <strong>${esc(sp.status ?? "open")}</strong> · timebox: ${
        esc(sp.timebox ?? "—")
      } · closes: ${chips(sp.closes_adr ? [String(sp.closes_adr)] : [])}`;
      return card(
        sp.id,
        "SPIKE",
        esc(sp.question ?? sp.title ?? ""),
        meta,
        renderMarkdown(sp.body),
      );
    })
    .join("");
  return `<section id="spikes"><h2>Spikes <span class="count">${s.spikes.length}</span></h2>${cards}</section>`;
}

function renderReqs(s: Spec): string {
  if (!s.reqs.length) return "";
  const cards = s.reqs
    .map((r) => {
      const scen = s.scenariosByReq.get(r.id) ?? [];
      const evtsHere = s.evts.filter((e) => e._context === r._context).map((e) => e.id);
      const meta =
        `priority: ${esc(r.priority)} · status: ${esc(r.status)} · verify: ${
          esc(r.verification_method)
        } · context: <span class="tag">${esc(r._context)}</span>` +
        `<div>source: ${r.source ? `<code>${esc(r.source)}</code>` : "—"}</div>` +
        `<div>scenarios: ${
          scen.length
            ? scen.map((f) => `<code>${esc(f)}</code>`).join(" ")
            : "<span class='overdue'>none ⚠</span>"
        }</div>` +
        `<div>events in context: ${chips(evtsHere)}</div>` +
        `<div>relates to: ${chips(r.relates_to)}</div>`;
      const body = r.rationale ? `<p><em>${esc(r.rationale)}</em></p>` : "";
      return card(r.id, "REQ", esc(r.statement ?? ""), meta, body);
    })
    .join("");
  return `<section id="reqs"><h2>Requirements <span class="count">${s.reqs.length}</span></h2>${cards}</section>`;
}

function renderEvents(s: Spec): string {
  if (!s.evts.length) return "";
  const rows = s.evts
    .map(
      (e) =>
        `<tr id="${esc(e.id)}"><td>${chip(e.id)}</td><td>${
          esc(e.name ?? "")
        }</td><td><span class="tag">${esc(e.producer ?? "—")}</span></td><td>${
          (e.consumers ?? []).map((c) => `<span class="tag">${esc(c)}</span>`).join(" ") ||
          (e.terminal ? "<em>terminal</em>" : "—")
        }</td><td>${chips(e.blocked_by)}</td></tr>`,
    )
    .join("");
  return `<section id="events"><h2>Events <span class="count">${s.evts.length}</span></h2>
    <table><thead><tr><th>Event</th><th>Name</th><th>Producer</th><th>Consumers</th><th>Blocked by</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`;
}

function renderInbox(s: Spec): string {
  if (!s.inbox.length) return "";
  const rows = s.inbox
    .map((i) => {
      const promoted = i.promotes_to && i.promotes_to.length;
      return `<tr class="${promoted ? "" : "unpromoted"}"><td><code>${esc(i.file)}</code></td><td>${
        esc(i.title ?? "")
      }</td><td>${
        (i.contexts ?? []).map((c) => `<span class="tag">${esc(c)}</span>`).join(" ")
      }</td><td>${
        promoted ? chips(i.promotes_to) : `<span class="pill">unpromoted</span>`
      }</td></tr>`;
    })
    .join("");
  return `<section id="inbox"><h2>Inbox <span class="count">${s.inbox.length}</span></h2>
    <table><thead><tr><th>File</th><th>Title</th><th>Contexts</th><th>Promotes to</th></tr></thead>
    <tbody>${rows}</tbody></table></section>`;
}

function renderGlossary(s: Spec): string {
  if (!s.terms.length) return "";
  const rows = s.terms
    .map(
      (t) =>
        `<tr><td><strong>${esc(t.term)}</strong></td><td>${
          (t.aliases ?? []).map((a) => `<span class="tag">${esc(a)}</span>`).join(" ")
        }</td><td>${esc(t.definition ?? "")}</td></tr>`,
    )
    .join("");
  return `<section id="glossary"><h2>Glossary <span class="count">${s.terms.length}</span></h2>
    <table><thead><tr><th>Term</th><th>Aliases</th><th>Definition</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

const NAV = [
  ["dashboard", "Dashboard"],
  ["roadmap", "Roadmap"],
  ["oqs", "Open questions"],
  ["hots", "Conflicts"],
  ["adrs", "Decisions"],
  ["spikes", "Spikes"],
  ["reqs", "Requirements"],
  ["events", "Events"],
  ["inbox", "Inbox"],
  ["glossary", "Glossary"],
];

function page(s: Spec, v: { ok: boolean; text: string }): string {
  const nav = NAV.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");
  const main = [
    renderDashboard(s, v),
    renderRoadmap(s),
    renderOqs(s),
    renderHots(s),
    renderAdrs(s),
    renderSpikes(s),
    renderReqs(s),
    renderEvents(s),
    renderInbox(s),
    renderGlossary(s),
  ].join("\n");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>erp-spec — live viewer</title>
<style>
:root{--bg:#0f1115;--panel:#171a21;--panel2:#1e222b;--line:#2a2f3a;--fg:#e6e8ec;--muted:#8b93a1;
--accent:#6ea8fe;--red:#ff6b6b;--green:#4ec98a;--amber:#f2b84b;
--REQ:#6ea8fe;--ADR:#b58cff;--EVT:#4ec98a;--HOT:#ff6b6b;--OQ:#f2b84b;--SPIKE:#57c7d4;}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
background:var(--bg);color:var(--fg)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:grid;grid-template-columns:210px 1fr;min-height:100vh}
nav{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:18px 14px;background:var(--panel);border-right:1px solid var(--line)}
nav .brand{font-weight:700;font-size:15px;margin-bottom:4px}
nav .sub{color:var(--muted);font-size:11px;margin-bottom:16px}
nav a{display:block;padding:6px 10px;border-radius:7px;color:var(--fg)}
nav a:hover{background:var(--panel2);text-decoration:none}
main{padding:26px 34px;max-width:1080px}
h2{font-size:18px;margin:34px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--line)}
h2 .count{color:var(--muted);font-weight:400;font-size:13px}
.searchbar{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0 12px}
.searchbar input{width:100%;padding:9px 12px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--fg);font-size:14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.tile .n{font-size:26px;font-weight:700}.tile .l{color:var(--fg);margin-top:2px}.tile .s{color:var(--muted);font-size:12px;margin-top:4px}
.worklist{margin-top:16px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.worklist.red{border-color:#5a2b2b}.worklist.green{border-color:#2b5a3f}
.wl-head{padding:10px 14px;font-weight:600;background:var(--panel)}
.worklist.red .wl-head{color:var(--red)}.worklist.green .wl-head{color:var(--green)}
.worklist pre{margin:0;padding:14px;background:var(--panel2);overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfd3da;max-height:420px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:10px 0}
.card header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.kind{font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:6px;color:#0f1115}
.kind.REQ{background:var(--REQ)}.kind.ADR{background:var(--ADR)}.kind.EVT{background:var(--EVT)}
.kind.HOT{background:var(--HOT)}.kind.OQ{background:var(--OQ)}.kind.SPIKE{background:var(--SPIKE)}
.cid{font:12px ui-monospace,monospace;color:var(--muted)}
.ctitle{font-weight:600}
.meta{color:var(--muted);font-size:12.5px;margin-top:8px}
.meta strong{color:var(--fg)}
.meta div{margin-top:3px}
.body{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
.body h3,.body h4,.body h5{margin:12px 0 6px;font-size:14px}
.body p{margin:6px 0}.body ul{margin:6px 0 6px 18px}.body code{background:var(--panel2);padding:1px 5px;border-radius:5px;font-size:12px}
.body pre.code{background:var(--panel2);padding:10px;border-radius:8px;overflow:auto;font-size:12px}
.body blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--accent);background:var(--panel2);border-radius:0 6px 6px 0}
.idlink{font:12px ui-monospace,monospace;background:var(--panel2);padding:1px 6px;border-radius:6px;border:1px solid var(--line)}
.tag{display:inline-block;font-size:11px;background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:1px 9px;color:var(--fg)}
.pill{font-size:11px;background:#3a2f1c;color:var(--amber);border-radius:20px;padding:1px 9px}
.muted{color:var(--muted)}
.overdue{color:var(--red);font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:12px}
td.num,td .num{text-align:right}
tr.unpromoted td{background:rgba(242,184,75,.05)}
.st-accepted{color:var(--green)}.st-proposed{color:var(--amber)}.st-rejected{color:var(--muted)}.st-superseded{color:var(--muted)}
.flash{animation:flash 1.4s ease-out}
@keyframes flash{0%{background:rgba(110,168,254,.28)}100%{background:transparent}}
.footer{color:var(--muted);font-size:12px;margin:40px 0 20px;padding-top:14px;border-top:1px solid var(--line)}
.hidden{display:none !important}
</style></head>
<body><div class="layout">
<nav><div class="brand">erp-spec</div><div class="sub">live spec viewer · reads source, not generated</div>${nav}
<div style="margin-top:18px"><a href="/" onclick="location.reload();return false" title="re-read all source files">↻ refresh</a></div></nav>
<main>
<div class="searchbar"><input id="q" type="search" placeholder="Filter cards & rows by id or text…  (press / to focus)"></div>
${main}
<div class="footer">Read-only. Re-reads every source file on each request; never opens a <code>.generated.</code> file.
Overdue <code>decide_by</code> / <code>review_by</code> dates are judged against the real date${
    Deno.env.get("SPEC_TODAY") ? ` (SPEC_TODAY=${esc(Deno.env.get("SPEC_TODAY"))})` : ""
  }.</div>
</main></div>
<script>
// click any id chip -> smooth-scroll + flash its card
document.addEventListener('click',e=>{const a=e.target.closest('.idlink');if(!a)return;
 const el=document.getElementById(a.dataset.id);if(el){e.preventDefault();history.replaceState(null,'','#'+a.dataset.id);
 el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}});
// filter
const q=document.getElementById('q');
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();
 document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hidden',t&&!c.textContent.toLowerCase().includes(t)));
 document.querySelectorAll('tbody tr').forEach(r=>r.classList.toggle('hidden',t&&!r.textContent.toLowerCase().includes(t)));});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==q){e.preventDefault();q.focus();}});
// flash target on load if hash present
if(location.hash){const el=document.getElementById(location.hash.slice(1));if(el){el.classList.add('flash');}}
</script>
</body></html>`;
}

// ── server ────────────────────────────────────────────────────────────────────
const portArg = Deno.args.indexOf("--port");
const PORT = portArg >= 0 ? Number(Deno.args[portArg + 1]) : 8000;

// Bind loopback only — this is a local dev viewer, never something to expose on a network.
Deno.serve({
  port: PORT,
  hostname: "127.0.0.1",
  onListen: ({ port }) =>
    console.log(
      `\n  erp-spec live viewer → http://localhost:${port}\n  (reads source on every request; Ctrl-C to stop)\n`,
    ),
}, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok");
  if (url.pathname !== "/") return new Response("not found", { status: 404 });
  const [spec, validate] = await Promise.all([loadSpec(), runValidate()]);
  return new Response(page(spec, validate), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});
