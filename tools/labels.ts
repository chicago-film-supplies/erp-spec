/**
 * Sync the GitHub issue labels FROM the repo, so the label set is derived rather than typed.
 *
 *   deno task labels          # print what would change
 *   deno task labels --apply  # create/update them
 *
 * ── Why this is a tool and not a one-off `gh label create` ───────────────────────────────────────
 *
 * A hand-typed label set is another hand-maintained list of the domains, and this repo has already
 * paid for three of those: `tools/contexts.ts` replaced FOUR copies of the context list and
 * `view.ts` still held a fifth; the allocation harness held a sixth copy of the goods/activity
 * taxonomy; `research-drop/reference/tigerbeetle.md` held a second copy of the transfer field
 * budget and was the one that was wrong. Adding a tenth context and then remembering to create its
 * label is the same defect wearing a different hat.
 *
 * So both halves are read off the repo:
 *
 *   · **contexts** — `CONTEXT_CODE_OF`, THE registry. A new context gets a label by existing.
 *   · **areas** — the top-level directories of the structured spec. A domain that has a directory
 *     has a label.
 *
 * ⚠️ `inbox/`, `research-drop/` and `adr/` are deliberately NOT areas. They are lifecycles, not
 * domains — every context's work passes through all three — so labelling by them would sort issues
 * by where evidence lives rather than by what the work touches.
 *
 * ── The second axis, and it is the one that actually drives the queue ────────────────────────────
 *
 * Domain says what an issue touches. It does not say whether anyone can start it, and on this queue
 * that is the question: the triage on 2026-08-16 split 8 open issues into "startable" and "waiting
 * on a decision only the owner can take". `blocked:owner-decision` carries that, and it is
 * deliberately the ONLY state label — a state taxonomy grows without limit and stops being read.
 */

import { CONTEXTS } from "./contexts.ts";

const ROOT = new URL("..", import.meta.url).pathname;

/** Top-level directories of the structured spec — the refactorable half, minus the lifecycles. */
const NOT_A_DOMAIN = new Set(["inbox", "research-drop", "adr", "contexts", "traceability"]);

const areas = async (): Promise<string[]> => {
  const out: string[] = [];
  for await (const e of Deno.readDir(ROOT)) {
    if (!e.isDirectory || e.name.startsWith(".") || e.name.startsWith("_")) continue;
    if (NOT_A_DOMAIN.has(e.name)) continue;
    out.push(e.name);
  }
  return out.sort();
};

/** Colour is cosmetic; it is derived so nobody has to pick one when a context is added. */
const colour = (name: string): string => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Mid-range channels only — a label has to stay readable against white text.
  const ch = () =>
    (0x40 + (h = (h * 1103515245 + 12345) >>> 0) % 0x80).toString(16).padStart(2, "0");
  return `${ch()}${ch()}${ch()}`;
};

const labels = new Map<string, string>();
for (const c of CONTEXTS) labels.set(c, `Bounded context: ${c}`);
for (const a of await areas()) {
  if (!labels.has(a)) labels.set(a, `Spec area: ${a}/`);
}
// ⚠️ Descriptions stay short and ASCII. `gh label create` rejected the first draft of this one
// silently enough that the label simply did not appear while 15 siblings did — so the failure is
// printed per-label below rather than inferred from the exit code of the run as a whole.
labels.set(
  "blocked:owner-decision",
  "Cannot start until the owner decides: an ADR acceptance, an OQ answer",
);

const apply = Deno.args.includes("--apply");
console.log(`${labels.size} labels derived (${CONTEXTS.length} contexts + areas + 1 state)\n`);

for (const [name, description] of labels) {
  console.log(`  ${apply ? "sync" : "would sync"}  ${name.padEnd(24)} ${description}`);
  if (!apply) continue;
  // `--force` makes this idempotent: create if absent, update colour/description if present.
  const cmd = new Deno.Command("gh", {
    args: [
      "label",
      "create",
      name,
      "--description",
      description,
      "--color",
      colour(name),
      "--force",
    ],
    stdout: "null",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  if (code !== 0) console.error(`    FAILED: ${new TextDecoder().decode(stderr).trim()}`);
}

if (!apply) console.log(`\nNothing changed. Re-run with --apply.`);
