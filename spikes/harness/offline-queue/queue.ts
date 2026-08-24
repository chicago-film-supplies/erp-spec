/**
 * SPIKE-013 — the offline queue and its three-way merge, as a PURE module.
 *
 * ⚠️ **Pure on purpose.** Everything here is a function of its arguments: no clock, no storage, no
 * network, no DOM. That is what lets the criteria be asserted in Deno rather than eyeballed in a
 * browser — and it is also the shape the real thing wants, because the hard part of an offline
 * queue is the merge algebra and the hard part of TESTING one is getting at that algebra past the
 * IO. The durable and browser halves live beside this file and depend on it, never the reverse.
 *
 * ## What the design owes, and where each obligation is discharged here
 *
 * The six obligations from SPIKE-013 Finding 2, plus the one Finding 4 added:
 *
 * | obligation                                | here                                                   |
 * | ----------------------------------------- | ------------------------------------------------------ |
 * | pin the base — AND PERSIST it (Finding 4) | `pinBase`, and `QueueState` is a plain serialisable value |
 * | exclude and recompute derived fields      | `MergePolicy.derived`, applied in `threeWayMerge`      |
 * | union semantics for concurrent adds       | `mergeItems`, which unions rather than choosing        |
 * | a terminal class that REFUSES the merge   | `MergePolicy.terminal` → `refused`                     |
 * | replay against theirs can FAIL, not conflict | `failed[]`, distinct from `conflicts[]`             |
 * | ledger postings do not merge at all       | out of scope BY CONSTRUCTION — this merges documents; see the spike |
 *
 * ⚠️ **`conflicts` and `failed` are different outcomes and are kept apart deliberately.** A
 * conflict has two candidate values and a human can choose. A failure has NO target — the row the
 * edit addressed is gone — so there is nothing to offer and nothing to choose between. Collapsing
 * them is how a queue silently drops work while looking like it asked.
 *
 * @module
 */

// ── values ───────────────────────────────────────────────────────────────────────────────────────

/** A JSON document. Deliberately loose — the queue is schema-agnostic. */
export type Json = Record<string, unknown>;

/** A queued field write. `seq` orders writes; `path` is a dot path into the document. */
export interface Op {
  doc: string;
  path: string;
  value: unknown;
  seq: number;
}

/** The frozen common ancestor. Pinned at disconnect and immutable until the merge completes. */
export interface Base {
  doc: Json;
  version: number;
  /** Set once. A second pin is refused rather than silently overwriting the ancestor. */
  pinnedAtSeq: number;
}

/** A durable failure a human has to see. `field` is named because a nameless failure is unactionable. */
export interface Failure {
  doc: string;
  field: string;
  reason: string;
  value: unknown;
}

/** A blob queued for upload. The bytes live elsewhere — this is the manifest entry only. */
export interface BlobRef {
  id: string;
  doc: string;
  field: string;
  bytes: number;
  mime: string;
}

/** The whole durable state. A plain value, so persisting it is `JSON.stringify`. */
export interface QueueState {
  bases: Record<string, Base>;
  ops: Op[];
  /** Offline creates, keyed by the CLIENT-MINTED uid. See `mintId`. */
  creates: Record<string, Json>;
  blobs: BlobRef[];
  failures: Failure[];
  nextSeq: number;
}

export const emptyState = (): QueueState => ({
  bases: {},
  ops: [],
  creates: {},
  blobs: [],
  failures: [],
  nextSeq: 0,
});

// ── identity ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Mint a document id on the CLIENT, so an offline create is addressable before the server sees it.
 *
 * ⭐ **This is not a new capability and that is the argument for it.** v1 already does exactly this:
 * `newDraft` calls `doc(collection(db, name))` with no id, which mints a Firestore auto-id locally
 * with no round-trip, seeds a draft under it and persists it to localStorage
 * (`code:2026-08-24:manager@9504a1e:src/primitives/createEntityCache.ts`). MongoDB's own convention
 * is the same shape — the driver assigns `_id` before the insert leaves the process.
 *
 * ⇒ the alternative (a server-assigned id with a client temp-id and a rewrite pass over every
 * queued op that references it) buys nothing and costs a rewrite that can half-apply.
 */
export const mintId = (): string => crypto.randomUUID();

// ── paths ────────────────────────────────────────────────────────────────────────────────────────

export const getPath = (doc: Json, path: string): unknown => {
  let cur: unknown = doc;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Json)[seg];
  }
  return cur;
};

export const setPath = (doc: Json, path: string, value: unknown): Json => {
  const segs = path.split(".");
  const out = { ...doc };
  let cur: Json = out;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = cur[seg];
    cur[seg] = next && typeof next === "object" ? { ...(next as Json) } : {};
    cur = cur[seg] as Json;
  }
  cur[segs[segs.length - 1]] = value;
  return out;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ── the queue ────────────────────────────────────────────────────────────────────────────────────

/**
 * Pin the common ancestor for a document. **Idempotent by design**: the second call is a no-op.
 *
 * ⚠️ v1's baseline is mutated in place (`Object.assign(state.latestSnapshot, acceptedDiff)`), which
 * is exactly what a three-way merge cannot tolerate — the ancestor would drift toward `theirs` and
 * the merge would stop being able to tell "we both changed this" from "only one of us did".
 */
export const pinBase = (s: QueueState, doc: string, snapshot: Json, version: number): QueueState =>
  s.bases[doc] ? s : {
    ...s,
    bases: { ...s.bases, [doc]: { doc: snapshot, version, pinnedAtSeq: s.nextSeq } },
  };

/**
 * Queue a field write, COALESCING on `(doc, path)`.
 *
 * Three offline edits to one field become one op — the criterion's own wording. The coalesced op
 * keeps the ORIGINAL position so replay order reflects when the field was first touched, and takes
 * the LATEST value, which is the only one the server should ever see.
 */
export const enqueue = (s: QueueState, doc: string, path: string, value: unknown): QueueState => {
  const i = s.ops.findIndex((o) => o.doc === doc && o.path === path);
  const ops = [...s.ops];
  if (i >= 0) ops[i] = { ...ops[i], value };
  else ops.push({ doc, path, value, seq: s.nextSeq });
  return { ...s, ops, nextSeq: s.nextSeq + 1 };
};

/** Record an offline create under a client-minted id. Subsequent `enqueue`s address it normally. */
export const create = (s: QueueState, doc: string, seed: Json): QueueState => ({
  ...s,
  creates: { ...s.creates, [doc]: seed },
  bases: { ...s.bases, [doc]: { doc: seed, version: 0, pinnedAtSeq: s.nextSeq } },
  nextSeq: s.nextSeq + 1,
});

export const enqueueBlob = (s: QueueState, b: BlobRef): QueueState => ({
  ...s,
  blobs: [...s.blobs, b],
});

/** Apply the queue to the pinned base. This is `ours`. */
export const ours = (s: QueueState, doc: string): Json => {
  const base = s.bases[doc];
  if (!base) throw new Error(`no pinned base for ${doc} — replay would be a two-way diff`);
  let out = base.doc;
  for (const op of s.ops.filter((o) => o.doc === doc).sort((a, b) => a.seq - b.seq)) {
    out = setPath(out, op.path, op.value);
  }
  return out;
};

// ── the merge ────────────────────────────────────────────────────────────────────────────────────

export interface MergePolicy {
  /**
   * Paths that are DERIVED. Excluded from the merge and recomputed afterwards.
   *
   * ⚠️ SPIKE-013 measured that this partition exists in no schema — the list has to be supplied,
   * and that absence is a finding rather than a parameter.
   */
  derived: string[];
  /** Returns a reason when the fresh document refuses a merge outright (paid invoice, void order). */
  terminal?: (theirs: Json) => string | null;
  /** Recompute the derived closure. Injected so the merge never pretends to know the domain. */
  recompute?: (merged: Json) => Json;
}

export interface Conflict {
  doc: string;
  path: string;
  base: unknown;
  ours: unknown;
  theirs: unknown;
}

export interface MergeResult {
  merged: Json | null;
  conflicts: Conflict[];
  /** No target for the edit — distinct from a conflict, because there is nothing to choose. */
  failed: Failure[];
  /** Set when the document class refuses a merge at any granularity. */
  refused: string | null;
  /** Paths taken from `ours` with no contest — the population the popover must NOT be shown. */
  clean: string[];
}

const isDerived = (path: string, derived: string[]) =>
  derived.some((d) => path === d || path.startsWith(d + "."));

/**
 * The three-way merge. `base` is the pinned ancestor, `theirs` the fresh server document.
 *
 * ⭐ **A conflict is only where BOTH sides moved the same node away from base.** That is the whole
 * reason for keeping the ancestor: the version gate knows only "something changed" and must reject
 * on both, so "two operators editing different fields do not collide" becomes true BY CONSTRUCTION
 * here rather than as an accident of listener freshness.
 */
export const threeWayMerge = (
  s: QueueState,
  doc: string,
  theirs: Json | null,
  policy: MergePolicy,
): MergeResult => {
  const base = s.bases[doc];
  if (!base) throw new Error(`no pinned base for ${doc}`);

  // The document itself is gone. Every queued op for it has no target — a FAILURE, not a conflict.
  if (theirs === null) {
    return {
      merged: null,
      conflicts: [],
      failed: s.ops.filter((o) => o.doc === doc).map((o) => ({
        doc,
        field: o.path,
        reason: "the document no longer exists",
        value: o.value,
      })),
      refused: null,
      clean: [],
    };
  }

  const refused = policy.terminal?.(theirs) ?? null;
  if (refused) {
    return { merged: null, conflicts: [], failed: [], refused, clean: [] };
  }

  const conflicts: Conflict[] = [];
  const failed: Failure[] = [];
  const clean: string[] = [];
  let merged = theirs;

  for (const op of s.ops.filter((o) => o.doc === doc).sort((a, b) => a.seq - b.seq)) {
    if (isDerived(op.path, policy.derived)) continue; // recomputed, never merged
    const b = getPath(base.doc, op.path);
    const t = getPath(theirs, op.path);
    const o = op.value;

    // The node the edit addressed is gone from theirs while it existed in base.
    if (t === undefined && b !== undefined) {
      failed.push({ doc, field: op.path, reason: "the target row no longer exists", value: o });
      continue;
    }
    if (same(o, t)) { // converged — both sides already agree
      clean.push(op.path);
      continue;
    }
    if (same(b, t)) { // only WE moved it — no contest
      merged = setPath(merged, op.path, o);
      clean.push(op.path);
      continue;
    }
    conflicts.push({ doc, path: op.path, base: b, ours: o, theirs: t });
  }

  if (policy.recompute) merged = policy.recompute(merged);
  return { merged, conflicts, failed, refused: null, clean };
};

// ── items[]: the measured merge key ──────────────────────────────────────────────────────────────

export interface Item {
  uid: string;
  type?: string;
  [k: string]: unknown;
}

/**
 * Key a row as `(uid, k-th occurrence)`.
 *
 * ⭐ **Measured, not chosen.** `deno task merge-key` found a LEAF uid repeating in **182 of 995
 * orders — 18.3%**, worst case 5×, so a merge keyed on `uid` alone pairs the wrong rows in nearly
 * a fifth of the corpus, silently. Divider uids collide in **0**, so only leaves need the counter.
 *
 * ⚠️ `path` is not the alternative: divider uids are reused BY NAME, so a group rename churns every
 * descendant path — and a merge compares exactly two document versions, across which a path is not
 * a stable identity.
 */
export const keyItems = (items: Item[]): Map<string, Item> => {
  const seen = new Map<string, number>();
  const out = new Map<string, Item>();
  for (const it of items) {
    const k = seen.get(it.uid) ?? 0;
    seen.set(it.uid, k + 1);
    out.set(`${it.uid}#${k}`, it);
  }
  return out;
};

/**
 * Merge two item arrays against their common ancestor with UNION semantics.
 *
 * ⭐ Two operators adding DIFFERENT rows is not a choice between arrays — it is a union. A popover
 * asking "yours or theirs" on `items[]` discards one operator's adds outright, and the corpus says
 * the array is where the work is: median 8 rows per order, max 150.
 */
export const mergeItems = (
  base: Item[],
  ours_: Item[],
  theirs: Item[],
): { items: Item[]; added: string[]; removed: string[] } => {
  const B = keyItems(base), O = keyItems(ours_), T = keyItems(theirs);
  const out = new Map(T); // start from theirs — the server's state is the trunk
  const added: string[] = [];
  const removed: string[] = [];

  for (const [k, item] of O) {
    if (!B.has(k) && !T.has(k)) { // we added it and they did not — union it in
      out.set(k, item);
      added.push(k);
    }
  }
  for (const [k] of B) {
    if (!O.has(k) && T.has(k)) { // we removed it and they kept it — our removal wins
      out.delete(k);
      removed.push(k);
    }
  }
  return { items: [...out.values()], added, removed };
};

// ── replay ───────────────────────────────────────────────────────────────────────────────────────

/** What the caller must do with one document after a merge. */
export type Outcome =
  | { kind: "send"; doc: string; body: Json }
  | { kind: "conflict"; doc: string; conflicts: Conflict[] }
  | { kind: "refused"; doc: string; reason: string }
  | { kind: "failed"; doc: string; failures: Failure[] };

/**
 * Plan the replay for every document the queue touches.
 *
 * ⚠️ **This returns a PLAN and sends nothing.** SPIKE-013 Finding 1 established that replay is not
 * "send the queue": the first write bumps the version, so the second is stale by its own
 * predecessor. Each document is therefore merged against the state fetched for IT — the caller
 * fetches, plans, sends, and re-fetches for the next one. Making that the caller's loop rather than
 * a hidden one is deliberate: the ordering is the whole correctness argument.
 */
export const planReplay = (
  s: QueueState,
  fresh: Record<string, Json | null>,
  policy: MergePolicy,
): Outcome[] => {
  const docs = [...new Set(s.ops.map((o) => o.doc))];
  const out: Outcome[] = [];
  for (const doc of docs) {
    const r = threeWayMerge(s, doc, fresh[doc] ?? null, policy);
    if (r.refused) out.push({ kind: "refused", doc, reason: r.refused });
    else if (r.failed.length) out.push({ kind: "failed", doc, failures: r.failed });
    else if (r.conflicts.length) out.push({ kind: "conflict", doc, conflicts: r.conflicts });
    else out.push({ kind: "send", doc, body: r.merged! });
  }
  return out;
};

/** Drop a document's ops and its pinned base once the server has acknowledged the write. */
export const settle = (s: QueueState, doc: string): QueueState => {
  const bases = { ...s.bases };
  delete bases[doc];
  const creates = { ...s.creates };
  delete creates[doc];
  return { ...s, bases, creates, ops: s.ops.filter((o) => o.doc !== doc) };
};

/** Move a failure into the durable inbox, where it outlives the session that produced it. */
export const recordFailures = (s: QueueState, fs: Failure[]): QueueState => ({
  ...s,
  failures: [...s.failures, ...fs],
});

// ── per-field state, for criterion 6 ─────────────────────────────────────────────────────────────

export type FieldState = "synced" | "pending" | "conflicted" | "failed";

/**
 * Derive the state of one field from the queue alone.
 *
 * ⭐ The criterion asks whether this is DERIVABLE at every save-on-focusout site. It is, and this
 * function is the proof: it needs the queue and nothing else — no per-site wiring, no extra store,
 * no flag any of the 52 subscription sites has to remember to set.
 *
 * ⚠️ Today the absence of an error is the only feedback a site gives, which is why this is the
 * load-bearing half rather than a nicety.
 */
export const fieldState = (s: QueueState, doc: string, path: string): FieldState => {
  if (s.failures.some((f) => f.doc === doc && f.field === path)) return "failed";
  if (s.ops.some((o) => o.doc === doc && o.path === path)) return "pending";
  return "synced";
};
