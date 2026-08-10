/**
 * The bounded contexts, and their ID codes. THE registry — nothing else may hold a copy.
 *
 * This existed as **four** hand-maintained lists before procurement was added (erp-spec#10):
 * `CONTEXT_CODES` and the `REQ`/`EVT` regex alternation in `validate.ts`, `CONTEXTS` + `CODE_OF` in
 * `generate.ts`, and `CONTEXTS` again in `milestone-checks.ts`. Adding a ninth context meant editing
 * all four, and getting five of the six edits right would have produced a repo where an id passes
 * one gate and fails another — with the failure reported as "id does not match pattern" rather than
 * "you forgot a list".
 *
 * The workspace rule this follows: *prefer a single source of truth over a parity assertion between
 * two hand-maintained lists.* Ratchet E in `api-cloudrun` is the precedent — it imports core's
 * `TEMPLATE_LIB_GLOBALS` rather than asserting against its own copy, so adding a name in one place
 * is the single act that permits it everywhere.
 *
 * ⚠️ The code is NOT derivable from the directory name — `fixed-assets` is `FA`, not `FIX` — so this
 * map is explicit on purpose. Codes are the infix of every `REQ-`/`EVT-` id and are therefore
 * **never renamed**: renaming one silently orphans every id that used it, and ids are never reused.
 */

/**
 * directory under `contexts/` → the code used in `REQ-<CODE>-<3d>` / `EVT-<CODE>-<3d>`.
 *
 * Deliberately typed as a wide `Record<string, string>` rather than `as const`: every consumer
 * indexes it with a directory name read from disk or from YAML, which is a `string`. A literal type
 * would make each of those an error and push callers into casts — trading one real guarantee (all
 * tools agree on the list) for a cosmetic one.
 */
export const CONTEXT_CODE_OF: Record<string, string> = {
  ledger: "LED",
  fulfillment: "FUL",
  billing: "BIL",
  "fixed-assets": "FA",
  ordering: "ORD",
  availability: "AVL",
  banking: "BNK",
  tax: "TAX",
  procurement: "PRO",
};

/** Context directory names, in the order STATUS and the spec map present them. */
export const CONTEXTS: string[] = Object.keys(CONTEXT_CODE_OF);

/** code → directory. The inverse, which `validate.ts` reads. */
export const CONTEXT_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(CONTEXT_CODE_OF).map(([dir, code]) => [code, dir]),
);

export const CONTEXT_DIRS: Set<string> = new Set(CONTEXTS);

/**
 * The alternation used inside the `REQ-`/`EVT-` id patterns, longest-first.
 *
 * Longest-first matters and is not cosmetic: JS alternation is ordered, so with `FA` before `FUL`
 * a pattern like `^REQ-(FA|FUL)-\d{3}$` still matches `REQ-FUL-001` only because the anchor forces
 * a full match — but any future unanchored or partial use would match `FA` and stop. Sorting here
 * makes the registry safe to reuse rather than safe only in its current two call sites.
 */
export const CONTEXT_CODE_ALTERNATION: string = Object.values(CONTEXT_CODE_OF)
  .slice()
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .join("|");
