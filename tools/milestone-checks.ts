/**
 * Milestone exit-criteria evaluation. Read-only. Imported by BOTH `generate.ts` and `validate.ts`.
 *
 * erp-spec#9. `roadmap/milestones.yaml` holds the top-level assertion of the whole spec — 8
 * milestones, ~3 falsifiable criteria each — and until this file existed nothing read it beyond the
 * parse sweep. Milestone state was assessed by a human reading prose, and one such assessment was
 * wrong (m5 was reported as "never executed" when `formal/README.md` recorded a full run).
 *
 * ── the two rules this file exists to respect ───────────────────────────────────────────────────
 *
 * 1. **One registry, not two.** `generate.ts` renders milestone state into STATUS and `validate.ts`
 *    gates on it. If each held its own list of checks they would drift, and the repo's own rule is
 *    to prefer a single source of truth over a parity assertion between two hand-maintained lists.
 *    So the registry lives here and both import it.
 *
 * 2. **`generate.ts` reads no clock.** A generated file that changes on its own turns the
 *    stale-file gate red on unrelated pushes. So a check that needs today's date is marked
 *    `clockDependent` and is evaluated ONLY when a `now` is passed — which `validate.ts` does,
 *    because it writes nothing, and `generate.ts` never does.
 *
 * ── what a `met: true` does and does not mean ───────────────────────────────────────────────────
 *
 * It means the named check passed. It does NOT mean the milestone is done, because most criteria in
 * this repo are prose and no tool can decide them. `prose_only` is reported as its own category and
 * **never counts toward met** — the number of criteria a machine cannot decide is itself the
 * interesting figure, and rolling it into "met" is how a milestone comes to look finished.
 */
import { parse as parseYaml } from "@std/yaml";
import { walk } from "@std/fs";
import { basename } from "@std/path";

export type Verdict = "met" | "unmet" | "prose" | "deferred";

export interface CriterionResult {
  text: string;
  check?: string;
  verdict: Verdict;
  detail: string;
}
export interface MilestoneResult {
  id: string;
  title: string;
  depends_on: string[];
  criteria: CriterionResult[];
  met: number;
  unmet: number;
  prose: number;
  deferred: number;
}

interface RawCriterion {
  text?: string;
  check?: string;
  prose_only?: boolean;
  reason?: string;
}
interface RawMilestone {
  id?: string;
  title?: string;
  depends_on?: string[];
  exit_criteria?: (RawCriterion | string)[];
}

/** What a check returns: whether it passed, and the number or list that decided it. */
type CheckResult = { ok: boolean; detail: string };
type Check = (w: World, now: Date | null) => CheckResult;

// ── the world a check consults ──────────────────────────────────────────────
interface World {
  root: string;
  events: { id: string; producer?: string; consumers?: string[]; terminal?: boolean }[];
  adrs: { id: string; status?: string; review_by?: unknown }[];
  spikes: { id: string; status?: string; closes_adr?: string }[];
  hots: { id: string; status?: string; resolved_by?: string }[];
  oqs: { id: string; owner?: unknown; decide_by?: unknown; status?: string }[];
  glossary: { term: string; definition?: string }[];
  contextDirs: string[];
  contextsWithDoc: string[];
  accounts: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  coveredEvents: Set<string>;
  vectorsByRule: Map<string, string[]>;
  dimensions: { id?: string; values?: unknown[] }[];
  formalSpecs: string[];
  formalReadme: string;
  milestones: RawMilestone[];
  /** Posting rules that are in scope, unblocked and simply not written yet (erp-spec#5). */
  unwrittenRules: number;
  /** `migration/live-paths.measured.yaml` — MEASURED against prod, not authored here. */
  liveInventory: LiveCollection[];
  /** `migration/field-map.yaml` → `collections:` — the collection-level disposition layer. */
  mappedCollections: MappedCollection[];
}

export interface LiveCollection {
  collection: string;
  documents?: number;
  paths: string[];
}
export interface MappedCollection {
  collection?: string;
  disposition?: string;
  paths_default?: string;
  paths?: { path?: string; disposition?: string }[];
}

/** The dispositions that settle a whole collection at once — nothing of it survives to v2. */
export const TERMINAL_DISPOSITIONS = new Set(["drop", "quarantine"]);

import { CONTEXTS } from "./contexts.ts";

async function readYaml<T>(p: string): Promise<T | null> {
  try {
    return parseYaml(await Deno.readTextFile(p)) as T;
  } catch {
    return null;
  }
}
function frontMatter(text: string): Record<string, unknown> | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  try {
    return (parseYaml(m[1]) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function loadWorld(root: string): Promise<World> {
  const events: World["events"] = [];
  const contextsWithDoc: string[] = [];
  for (const c of CONTEXTS) {
    const ey = await readYaml<{ events?: World["events"] }>(`${root}/contexts/${c}/events.yaml`);
    for (const e of ey?.events ?? []) events.push(e);
    try {
      const s = await Deno.stat(`${root}/contexts/${c}/context.md`);
      if (
        s.isFile && (await Deno.readTextFile(`${root}/contexts/${c}/context.md`)).trim().length > 0
      ) {
        contextsWithDoc.push(c);
      }
    } catch { /* absent */ }
  }

  const adrs: World["adrs"] = [];
  const spikes: World["spikes"] = [];
  for (const [dir, sink] of [["adr", adrs], ["spikes", spikes]] as const) {
    try {
      for await (
        const e of walk(`${root}/${dir}`, {
          exts: [".md"],
          includeDirs: false,
          skip: [/node_modules/],
        })
      ) {
        if (basename(e.path).startsWith("_") || basename(e.path).includes(".generated.")) continue;
        const fm = frontMatter(await Deno.readTextFile(e.path));
        if (fm) (sink as Record<string, unknown>[]).push(fm);
      }
    } catch { /* absent */ }
  }

  const hots = (await readYaml<{ hotspots?: World["hots"] }>(`${root}/hotspots.yaml`))?.hotspots ??
    [];
  const oqs = (await readYaml<{ open_questions?: World["oqs"] }>(`${root}/open-questions.yaml`))
    ?.open_questions ?? [];
  const glossary =
    (await readYaml<{ terms?: World["glossary"] }>(`${root}/glossary.yaml`))?.terms ?? [];
  const coa = await readYaml<{ accounts?: Record<string, unknown>[] }>(
    `${root}/ledger/chart-of-accounts.yaml`,
  );
  const pr = await readYaml<{
    rules?: Record<string, unknown>[];
    no_posting?: { event?: string }[];
    unwritten?: { event?: string }[];
  }>(`${root}/ledger/posting-rules.yaml`);
  const dims =
    (await readYaml<{ dimensions?: World["dimensions"] }>(`${root}/ledger/dimensions.yaml`))
      ?.dimensions ?? [];

  const coveredEvents = new Set<string>();
  for (const r of pr?.rules ?? []) {
    const ev = (r.trigger as { event?: string } | undefined)?.event;
    if (ev) coveredEvents.add(String(ev));
  }
  for (const n of pr?.no_posting ?? []) if (n.event) coveredEvents.add(String(n.event));
  for (const u of pr?.unwritten ?? []) if (u.event) coveredEvents.add(String(u.event));

  const vectorsByRule = new Map<string, string[]>();
  try {
    for await (const e of walk(`${root}/ledger/vectors`, { exts: [".yaml"], includeDirs: false })) {
      if (basename(e.path).startsWith("_")) continue;
      const v = await readYaml<{ posting_rule?: string; kind?: string }>(e.path);
      if (!v?.posting_rule) continue;
      vectorsByRule.set(v.posting_rule, [
        ...(vectorsByRule.get(v.posting_rule) ?? []),
        String(v.kind),
      ]);
    }
  } catch { /* absent */ }

  const formalSpecs: string[] = [];
  try {
    for await (const e of walk(`${root}/formal`, { exts: [".qnt"], includeDirs: false })) {
      formalSpecs.push(basename(e.path));
    }
  } catch { /* absent */ }
  let formalReadme = "";
  try {
    formalReadme = await Deno.readTextFile(`${root}/formal/README.md`);
  } catch { /* absent */ }

  const milestones =
    (await readYaml<{ milestones?: RawMilestone[] }>(`${root}/roadmap/milestones.yaml`))
      ?.milestones ?? [];

  const liveInventory =
    (await readYaml<{ inventory?: LiveCollection[] }>(`${root}/migration/live-paths.measured.yaml`))
      ?.inventory ?? [];
  const mappedCollections =
    (await readYaml<{ collections?: MappedCollection[] }>(`${root}/migration/field-map.yaml`))
      ?.collections ?? [];

  return {
    root,
    events,
    adrs,
    spikes,
    hots,
    oqs,
    glossary,
    contextDirs: CONTEXTS,
    contextsWithDoc,
    accounts: coa?.accounts ?? [],
    rules: pr?.rules ?? [],
    coveredEvents,
    vectorsByRule,
    dimensions: dims,
    formalSpecs,
    formalReadme,
    milestones,
    unwrittenRules: (pr?.unwritten ?? []).length,
    liveInventory,
    mappedCollections,
  };
}

const unset = (v: unknown) =>
  v === undefined || v === null || v === "" || String(v).trim() === "TBD";

/**
 * The registry. A criterion names one of these, or declares itself `prose_only`.
 *
 * Every `detail` returns a NUMBER or a list, never "confirmed" — a signal that does not flip is
 * itself a finding, and "ok" tells a later reader nothing about what moved.
 */
export const CHECKS: Record<string, Check> = {
  // ── m1 ──
  events_have_producer_and_consumer: (w) => {
    const bad = w.events.filter((e) =>
      !e.producer || ((e.consumers ?? []).length === 0 && e.terminal !== true)
    );
    return {
      ok: bad.length === 0,
      detail: `${w.events.length} events, ${bad.length} without a producer or consumer`,
    };
  },

  // ── m2 ──
  contexts_have_context_md: (w) => {
    const missing = w.contextDirs.filter((c) => !w.contextsWithDoc.includes(c));
    return {
      ok: missing.length === 0,
      detail:
        `${w.contextsWithDoc.length} of ${w.contextDirs.length} contexts have a non-empty context.md`,
    };
  },
  glossary_no_todo: (w) => {
    const todo = w.glossary.filter((t) => String(t.definition ?? "").trim() === "TODO");
    return {
      ok: todo.length === 0,
      detail: `${todo.length} of ${w.glossary.length} terms still TODO`,
    };
  },

  // ── m3 ──
  coa_complete: (w) => {
    const todo = w.accounts.filter((a) => /^TODO$/i.test(String(a.name ?? "").trim()));
    const codes = new Set(w.accounts.map((a) => Number(a.code)));
    // ADR-0019 requires the absorbed/unabsorbed pair to exist; the chart mints them at 5800/5801.
    const labour = w.accounts.filter((a) =>
      /Wages \((Absorbed|Unabsorbed)\)/.test(String(a.name ?? ""))
    );
    const ok = todo.length === 0 && labour.length === 2 && codes.size === w.accounts.length;
    return {
      ok,
      detail:
        `${w.accounts.length} accounts, ${todo.length} named TODO, ${labour.length} of 2 labour accounts present`,
    };
  },
  /**
   * m3: "Reporting dimensions defined with their full value sets, and every posting rule declaring
   * its keys."
   *
   * ⚠️ **The criterion read "…and their DECLARATION RULE" until 2026-08-16, and this check has
   * never verified that half.** It counted value sets and stopped, so a criterion naming two things
   * was reported met on one — the exact shape of a gate that reads green while covering less than
   * it claims. ADR-0036 then removed the thing the missing half named: no posting declares a
   * dimension, so there is no declaration rule to verify.
   *
   * **The rule did not disappear, it moved to the KEYS** (REQ-LED-001), so the second arm is now
   * written rather than dropped: every `specified` posting rule must declare `causal_orders` on
   * every posting. That is the universal arm gate 10h enforces on vectors; here it is enforced on
   * the RULES, which is what makes the milestone criterion mean something a vector cannot supply —
   * a rule with no vectors at all would slip past 10h entirely.
   *
   * A mirror marker (`mirrors_original_transfer` / `mirrors_retracted_transfer`) satisfies it: a
   * reversal copies the keys of what it reverses, `causal_orders` included.
   */
  dimensions_defined: (w) => {
    const withValues = w.dimensions.filter((d) => Array.isArray(d.values) && d.values.length > 0);
    const MIRROR = ["mirrors_original_transfer", "mirrors_retracted_transfer"];
    const undeclared: string[] = [];
    for (const r of w.rules) {
      if (r.status !== "specified") continue;
      const postings = (r.postings ?? []) as { keys?: unknown }[];
      postings.forEach((post, i) => {
        const k = post.keys;
        if (typeof k === "string" && MIRROR.includes(k)) return;
        if (
          !k || typeof k !== "object" || Array.isArray(k) ||
          !Object.prototype.hasOwnProperty.call(k, "causal_orders")
        ) {
          undeclared.push(`${r.id}[${i}]`);
        }
      });
    }
    const specified = w.rules.filter((r) => r.status === "specified").length;
    return {
      ok: w.dimensions.length > 0 && withValues.length === w.dimensions.length &&
        undeclared.length === 0,
      detail:
        `${w.dimensions.length} reporting dimensions, ${withValues.length} with a non-empty ` +
        `value set; ${specified} specified rules, ${undeclared.length} posting(s) not declaring ` +
        `\`causal_orders\`${undeclared.length ? ` — ${undeclared.join(", ")}` : ""}`,
    };
  },
  posting_rules_cover_events: (w) => {
    const ledgerEvents = w.events.filter((e) =>
      e.producer === "ledger" || (e.consumers ?? []).includes("ledger")
    );
    const uncovered = ledgerEvents.filter((e) => !w.coveredEvents.has(e.id));
    const specified = w.rules.filter((r) => String(r.status) === "specified").length;
    // ⚠️ Coverage is necessary and NOT sufficient. Every ledger event appearing in some bucket is
    // what gate 10 enforces; this criterion asks for RULES. An event parked in `unwritten` is
    // covered and unspecified, so it must count against the criterion or m3 reads as done while
    // seven rules are missing — which is exactly how this milestone was mis-assessed before.
    return {
      ok: uncovered.length === 0 && w.unwrittenRules === 0,
      detail:
        `${ledgerEvents.length} ledger events, ${uncovered.length} in no bucket, ${specified} specified, ${w.unwrittenRules} unwritten`,
    };
  },
  vectors_cover_rules: (w) => {
    const specified = w.rules.filter((r) => String(r.status) === "specified");
    const short = specified.filter((r) => {
      const vs = w.vectorsByRule.get(String(r.id)) ?? [];
      return !vs.includes("accept") || !vs.includes("reject");
    });
    const total = [...w.vectorsByRule.values()].reduce((n, v) => n + v.length, 0);
    return {
      ok: specified.length > 0 && short.length === 0 && w.unwrittenRules === 0,
      detail:
        `${total} vectors over ${specified.length} specified rules; ${short.length} lack an accept or a reject; ${w.unwrittenRules} rules unwritten`,
    };
  },

  // ── m6 ──
  /**
   * m6: "Every current Firestore path maps to a new field, an explicit drop, or a quarantine."
   *
   * ⚠️ **This criterion was `prose_only` until 2026-08-16, and its stated reason was
   * _"a checker would compare the map against itself and always pass"_ — which was TRUE and stopped
   * being true.** `spikes/harness/live-path-inventory-probe.ts` now writes
   * `migration/live-paths.measured.yaml` from `db.listCollections()` plus an unprojected scan, so
   * the denominator is MEASURED against prod and the map cannot supply it. Same shape as
   * `tb-field-budget_test.ts` against `tigerbeetle-node`: the check is only worth anything because
   * one side of it is produced by something the spec does not control.
   *
   * ⚠️ **The measurement is what found the issue's scope wrong.** erp-spec#8 says "~30 collections",
   * taken from the MCP `db_schema` enum, which carries 35 and omits `credit-notes` and
   * `settlements` — both of which the field map already maps. Prod holds **50 collections and 1,537
   * paths**. Anything scoped from that enum is scoped short.
   *
   * **What counts as dispositioned**, and the second clause is the one that makes the shape
   * tractable without making the check vacuous:
   *
   * - a collection whose disposition is TERMINAL (`drop` / `quarantine`) settles every path it
   *   holds at once — nothing of it reaches v2, so there is nothing left to say path by path;
   * - a collection that survives (`map` / `defective`) settles a path only if the path is NAMED, or
   *   if the collection declares an explicit `paths_default:`. A `paths_default` is a deliberate
   *   act that has to carry its own reason — it is not a silent blanket, and gate 15 refuses one
   *   without a reason.
   *
   * ⇒ **A collection carrying `disposition: map` and nothing else covers ZERO of its paths**, which
   * is the point: "we will map this collection" is an intention, not a disposition. 1,537 rows
   * hand-authored one by one is neither tractable nor useful; a survivor that names no default and
   * no exceptions is not a decision at all. The check separates those two claims.
   *
   * Reports three numbers, none of them "ok" — paths, collections, and the collections still
   * carrying no entry — because which of the three moved is the whole signal.
   */
  live_paths_dispositioned: (w) => {
    const byName = new Map(w.mappedCollections.map((c) => [String(c.collection), c]));
    let dispositioned = 0;
    const undecided: string[] = [];
    const unmapped: string[] = [];
    for (const live of w.liveInventory) {
      const entry = byName.get(live.collection);
      if (!entry?.disposition) {
        unmapped.push(live.collection);
        continue;
      }
      if (TERMINAL_DISPOSITIONS.has(String(entry.disposition))) {
        dispositioned += live.paths.length;
        continue;
      }
      if (entry.paths_default) {
        dispositioned += live.paths.length;
        continue;
      }
      const named = new Set((entry.paths ?? []).map((p) => String(p.path)));
      const hit = live.paths.filter((p) => named.has(p)).length;
      dispositioned += hit;
      if (hit < live.paths.length) {
        undecided.push(`${live.collection} (${live.paths.length - hit})`);
      }
    }
    const totalPaths = w.liveInventory.reduce((n, c) => n + c.paths.length, 0);
    // Named, never silently truncated: this detail lands in a STATUS table cell, and a list of 50
    // collections makes the row unreadable. The COUNT is always stated, so an elision can never be
    // mistaken for coverage.
    const some = (xs: string[], n = 6) =>
      xs.length <= n ? xs.join(", ") : `${xs.slice(0, n).join(", ")} +${xs.length - n} more`;
    return {
      ok: w.liveInventory.length > 0 && unmapped.length === 0 && undecided.length === 0 &&
        dispositioned === totalPaths,
      detail: `${dispositioned} of ${totalPaths} live paths dispositioned across ${
        w.liveInventory.length - unmapped.length
      } of ${w.liveInventory.length} collections; ${unmapped.length} with no entry${
        unmapped.length ? ` (${some(unmapped)})` : ""
      }${
        undecided.length
          ? `; ${undecided.length} survivor(s) with paths undecided (${some(undecided)})`
          : ""
      }`,
    };
  },

  // ── m4 ──
  spikes_closed_with_adr: (w) => {
    const open = w.spikes.filter((s) =>
      !["closed", "abandoned"].includes(String(s.status ?? "open"))
    );
    const unnamed = w.spikes.filter((s) =>
      String(s.status) === "closed" && (!s.closes_adr || s.closes_adr === "new")
    );
    return {
      ok: open.length === 0 && unnamed.length === 0,
      detail:
        `${w.spikes.length} spikes, ${open.length} open, ${unnamed.length} closed without naming an ADR`,
    };
  },
  adr_review_by_current: (w, now) => {
    if (!now) return { ok: false, detail: "needs a clock" };
    const stale = w.adrs.filter((a) =>
      String(a.status) === "proposed" && a.review_by && new Date(String(a.review_by)) < now
    );
    const proposed = w.adrs.filter((a) => String(a.status) === "proposed");
    return {
      ok: stale.length === 0,
      detail: `${proposed.length} proposed, ${stale.length} past review_by`,
    };
  },
  hotspots_resolved: (w) => {
    const open = w.hots.filter((h) => String(h.status ?? "open") !== "resolved");
    return {
      ok: open.length === 0,
      detail: `${w.hots.length} hotspots, ${open.length} unresolved`,
    };
  },

  // ── m5 ──
  // ⚠️ This does NOT run a model checker. It asserts each `.qnt` exists and that `formal/README.md`
  // records an outcome for it — so a deleted spec, a renamed one, or a run nobody wrote down all
  // fail. Whether the model actually checks clean is decided by running Apalache, and the README's
  // table is that record. Named for what it verifies, not for what the criterion says.
  formal_specs_present_and_recorded: (w) => {
    const missing = w.formalSpecs.filter((f) => !w.formalReadme.includes(f));
    const hasOutcome = /NoError|no violation/.test(w.formalReadme);
    return {
      ok: w.formalSpecs.length > 0 && missing.length === 0 && hasOutcome,
      detail:
        `${w.formalSpecs.length} .qnt specs, ${missing.length} unrecorded in formal/README.md`,
    };
  },

  // ── spec-v1 ──
  oq_all_owned: (w) => {
    const bad = w.oqs.filter((q) => unset(q.owner) || unset(q.decide_by));
    return {
      ok: bad.length === 0,
      detail: `${w.oqs.length} open questions, ${bad.length} with no owner or decide_by`,
    };
  },
  requirements_all_have_scenarios: () => {
    // Deliberately delegated. Gate 3 already decides this, and a second implementation here could
    // disagree with it — two oracles for one property is worse than one.
    return { ok: false, detail: "decided by gate 3" };
  },
};

/** Checks that need today's date. `generate.ts` must never evaluate these. */
export const CLOCK_DEPENDENT = new Set(["adr_review_by_current"]);

/** Checks whose verdict is owned by another gate; reported, never counted as met here. */
export const DELEGATED = new Set(["requirements_all_have_scenarios"]);

/**
 * Evaluate every milestone. Pass `now` ONLY from a tool that writes nothing — `validate.ts`.
 * With `now === null`, clock-dependent checks return `deferred` rather than a verdict.
 */
export async function evaluateMilestones(
  root: string,
  now: Date | null = null,
): Promise<MilestoneResult[]> {
  const w = await loadWorld(root);
  const out: MilestoneResult[] = [];
  for (const m of w.milestones) {
    const criteria: CriterionResult[] = [];
    for (const raw of m.exit_criteria ?? []) {
      const c: RawCriterion = typeof raw === "string" ? { text: raw } : raw;
      const text = String(c.text ?? "");
      if (c.prose_only) {
        criteria.push({ text, verdict: "prose", detail: c.reason ?? "no tool can decide this" });
        continue;
      }
      const fn = c.check ? CHECKS[c.check] : undefined;
      if (!c.check || !fn) {
        criteria.push({
          text,
          check: c.check,
          verdict: "prose",
          detail: `unknown check "${c.check}"`,
        });
        continue;
      }
      if (DELEGATED.has(c.check)) {
        criteria.push({ text, check: c.check, verdict: "deferred", detail: fn(w, now).detail });
        continue;
      }
      if (CLOCK_DEPENDENT.has(c.check) && !now) {
        criteria.push({
          text,
          check: c.check,
          verdict: "deferred",
          detail: "clock-dependent — decided by validate",
        });
        continue;
      }
      const r = fn(w, now);
      criteria.push({ text, check: c.check, verdict: r.ok ? "met" : "unmet", detail: r.detail });
    }
    out.push({
      id: String(m.id ?? "?"),
      title: String(m.title ?? ""),
      depends_on: (m.depends_on ?? []).map(String),
      criteria,
      met: criteria.filter((c) => c.verdict === "met").length,
      unmet: criteria.filter((c) => c.verdict === "unmet").length,
      prose: criteria.filter((c) => c.verdict === "prose").length,
      deferred: criteria.filter((c) => c.verdict === "deferred").length,
    });
  }
  return out;
}
