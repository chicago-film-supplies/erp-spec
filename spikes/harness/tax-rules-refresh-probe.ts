/**
 * ADR-0043/D7 — the annual tax-rule refresh, as a check rather than a promise.
 *
 * ── What it does ────────────────────────────────────────────────────────────────────────────────
 *
 * Fetches the publication `depreciation-corpus.yaml` says its figures came from, extracts it
 * LOCALLY with `pdftotext`, and looks for every pinned figure. Each one is reported as found (with
 * the line number that proves it) or MISSING. Any miss is a non-zero exit.
 *
 * ── Why it is shaped this way ───────────────────────────────────────────────────────────────────
 *
 * ⚠️ **This repo has measured what happens when a research pass is trusted to state a number: four
 * fabricated sources across three surveys**, every one caught by demanding a verbatim quote with a
 * URL. "What is next year's §179 limit" is exactly the question a model answers confidently and
 * sometimes wrongly, and a wrong §179 limit has filing consequences.
 *
 * So the agent's job is never to SAY a figure. It is to propose a new `find:` string, and this
 * probe either locates it in a freshly extracted primary source or does not. **A line number cannot
 * be fabricated.**
 *
 * ⚠️ **A MISS IS NOT A FAILURE OF THE LAW, IT IS A PROMPT.** When the IRS publishes a new Pub 946,
 * figures move and this probe goes red — which is the entire point. Red means "a human and an agent
 * must reconcile the corpus against the new publication", not "something is broken".
 *
 * ── Its own limits, stated ──────────────────────────────────────────────────────────────────────
 *
 * · It proves a STRING is present, not that the corpus uses it correctly. `$2,500,000` appearing in
 *   Pub 946 does not prove it is the §179 limit — `depreciation-corpus_test.ts` and the worked
 *   examples are what tie a figure to its meaning.
 * · It cannot see a figure that CHANGED but whose old value still appears elsewhere in the document.
 *   That is why `verified_against` names the publication and edition, and why the pass is
 *   agent-reconciled rather than fully automatic.
 * · **It covers the TAX side only.** FASB's Codification returns HTTP 403 to a plain client and is
 *   licensed, so the GAAP cases (DEP-009, DEP-010) have no automatable source at all.
 *
 * `deno task dep-refresh`.
 */
import { parse } from "@std/yaml";

// deno-lint-ignore no-explicit-any
const corpus = parse(
  await Deno.readTextFile(
    new URL("./depreciation-corpus.yaml", import.meta.url),
  ),
) as any;

const v = corpus.verification;
if (!v?.source_url || !Array.isArray(v.figures)) {
  console.error("corpus has no `verification:` block — nothing to check against");
  Deno.exit(2);
}

console.log("ADR-0043/D7 — tax rule refresh check");
console.log(`  corpus pinned against : ${v.verified_against}`);
console.log(`  last verified on      : ${v.verified_on}`);
console.log(`  fetching              : ${v.source_url}\n`);

const tmp = await Deno.makeTempDir({ prefix: "taxrules-" });
const pdf = `${tmp}/source.pdf`, txt = `${tmp}/source.txt`;

const res = await fetch(v.source_url, { headers: { "user-agent": "Mozilla/5.0" } });
if (!res.ok) {
  console.error(`  FETCH FAILED — HTTP ${res.status}. Cannot verify; failing closed.`);
  Deno.exit(1);
}
await Deno.writeFile(pdf, new Uint8Array(await res.arrayBuffer()));

const pdftotext = new Deno.Command("pdftotext", { args: ["-layout", pdf, txt] });
const { code } = await pdftotext.output();
if (code !== 0) {
  console.error("  pdftotext failed — is poppler installed? Failing closed.");
  Deno.exit(1);
}
const lines = (await Deno.readTextFile(txt)).split("\n");
console.log(`  extracted ${lines.length} lines locally (never a summarizing fetch)\n`);

// ⚠️ The edition is checked FIRST. A figure found in last year's publication is not evidence
// about this year, and a silently-unchanged URL serving a new edition is the likely failure.
const edition = lines.findIndex((l) => /Publication 946 \(\d{4}\)/.test(l));
const editionYear = edition >= 0
  ? (lines[edition].match(/Publication 946 \((\d{4})\)/) ?? [])[1]
  : null;
console.log(`── edition ─────────────────────────────────────────────────────────────────────────`);
console.log(`  document reports  : Publication 946 (${editionYear ?? "UNKNOWN"})`);
console.log(`  corpus pinned to  : ${v.verified_against}`);
const editionMatches = editionYear !== null && v.verified_against.includes(`(${editionYear})`);
console.log(
  `  ⇒ ${
    editionMatches
      ? "same edition — figures below are a regression check"
      : "⚠️ DIFFERENT EDITION — every figure below must be RECONCILED, not merely matched"
  }\n`,
);

console.log("── pinned figures ──────────────────────────────────────────────────────────────────");
let missing = 0;
for (const f of v.figures) {
  const needle = String(f.find);
  const at = lines.findIndex((l) => l.includes(needle));
  if (at >= 0) {
    console.log(`  ✓ ${String(f.id).padEnd(34)} ${needle.padStart(12)}  line ${at + 1}`);
  } else {
    missing++;
    console.log(`  ✗ ${String(f.id).padEnd(34)} ${needle.padStart(12)}  NOT FOUND`);
  }
}

console.log(
  `\n── verdict ─────────────────────────────────────────────────────────────────────────`,
);
if (missing === 0 && editionMatches) {
  console.log(
    `  ${v.figures.length}/${v.figures.length} figures located. Corpus is current against the pinned edition.`,
  );
  Deno.exit(0);
}
console.log(
  `  ${missing} of ${v.figures.length} figures NOT FOUND${
    editionMatches ? "" : ", and the edition has changed"
  }.`,
);
console.log(`\n  ⇒ THIS IS A PROMPT, NOT A BREAKAGE. Next steps, in order:`);
console.log(`     1. Read the freshly extracted text at the reported lines — it is at ${txt}`);
console.log(`     2. For each miss, find the NEW figure and its line number in that extraction.`);
console.log(`     3. Propose a diff to \`verification.figures\` AND to the case that uses it —`);
console.log(
  `        every changed figure carrying its line number and the quoted surrounding text.`,
);
console.log(`     4. Re-run \`deno task dep-corpus\`; the worked examples must still reconcile.`);
console.log(`     5. Bump \`verified_on\` and \`verified_against\`. A human accepts the diff.`);
console.log(`\n  ⚠️ Do NOT write a figure you did not read at a line number in step 2.`);
Deno.exit(1);
