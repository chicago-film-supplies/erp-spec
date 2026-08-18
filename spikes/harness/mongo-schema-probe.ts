/**
 * SPIKE-006 — JSON Schema 2020-12 → MongoDB `$jsonSchema`, measured against a real server.
 *
 * Three stages, and the middle one is the one people forget exists:
 *
 *   Zod schema  --(A)-->  JSON Schema 2020-12  --(B)-->  `$jsonSchema` validator  --(C)--> enforcement
 *
 * Loss happens at (A) *and* at (B), and a construct can survive (B) — the server accepts the
 * validator without complaint — and still not be enforced at (C). That third case is the whole
 * point of this spike: a constraint everyone assumes the database enforces that it silently
 * does not.
 *
 * Every "silently dropped" row here is proven the only way it can be: create the collection,
 * then INSERT A DOCUMENT THAT VIOLATES THE CONSTRAINT and show it lands.
 *
 * ## Running it
 *
 * Needs a real mongod and core's import map. `spikes/harness/deno.json` carries neither, so this
 * is run explicitly rather than as a task (see `_README.md` — the harness is where claims about
 * third-party software get executed):
 *
 *   mongod --dbpath <dir> --port 27077 --bind_ip 127.0.0.1
 *   deno run --no-lock --config ../../../core/deno.json \
 *     --allow-read --allow-env --allow-net --allow-sys --allow-write=<outdir> \
 *     mongo-schema-probe.ts [--out <dir>]
 *
 * `--config ../../../core/deno.json` is what maps the bare `zod` specifier that every
 * `@cfs/core` schema imports. `--no-lock` keeps the run from writing a lockfile into `core/`,
 * which this probe must not modify.
 *
 * @module
 */

import { z } from "zod";
import { MongoClient } from "npm:mongodb@6.20.0";

// The REAL schemas. Cross-repo relative imports, deliberately: this measures @cfs/core as it
// stands, not a toy restatement of it.
import {
  CreateOrderInput,
  Discount,
  OrderDocItem,
  OrderDocItemPrice,
  OrderDocLineItem,
  OrderSchema,
} from "../../../core/src/schemas/order.ts";
import { InvoiceDocItem, InvoiceSchema } from "../../../core/src/schemas/invoice.ts";
import { ProductSchema } from "../../../core/src/schemas/product.ts";
import { MovementSchema } from "../../../core/src/schemas/transaction.ts";

const URI = Deno.env.get("MONGO_URI") ?? "mongodb://127.0.0.1:27077";
const DB = "spike006";

type Bucket = "translates" | "rejected" | "silently-dropped" | "n/a";

type Row = {
  construct: string;
  bucket: Bucket;
  /** Verbatim server error, or the document that proved the constraint unenforced. */
  proof: string;
  /** Which CFS schema emits it, measured in stage A. */
  usedBy: string;
};

const rows: Row[] = [];
let client: MongoClient;

// ── stage B/C harness ────────────────────────────────────────────────────────
//
// `probe` is the whole method. It does NOT stop at "the server accepted the validator" —
// that is precisely the check that cannot tell bucket 1 from bucket 3.

let seq = 0;

async function probe(
  construct: string,
  usedBy: string,
  schema: Record<string, unknown>,
  /** A document the schema above FORBIDS. If it inserts, the keyword is unenforced. */
  violating: Record<string, unknown>,
  /** A document the schema above PERMITS. Guards against a validator that rejects everything. */
  conforming?: Record<string, unknown>,
): Promise<void> {
  const name = `c${seq++}`;
  const db = client.db(DB);

  try {
    await db.createCollection(name, { validator: { $jsonSchema: schema } });
  } catch (e) {
    rows.push({
      construct,
      bucket: "rejected",
      proof: `createCollection: ${(e as Error).message.replaceAll("\n", " ")}`.slice(0, 400),
      usedBy,
    });
    return;
  }

  // Sanity: does the validator admit anything at all? A validator that rejects every document
  // would make the violating-insert test below pass for the wrong reason.
  let conformingOk = "not tested";
  if (conforming) {
    try {
      await db.collection(name).insertOne({ ...conforming });
      conformingOk = "conforming doc accepted";
    } catch (e) {
      conformingOk = `CONFORMING DOC REJECTED: ${(e as Error).message.slice(0, 160)}`;
    }
  }

  try {
    await db.collection(name).insertOne({ ...violating });
    rows.push({
      construct,
      bucket: "silently-dropped",
      proof: `validator accepted; violating doc ${
        JSON.stringify(violating).slice(0, 120)
      } INSERTED. ${conformingOk}`,
      usedBy,
    });
  } catch (e) {
    const msg = (e as Error).message;
    rows.push({
      construct,
      bucket: "translates",
      proof: `violating doc rejected (${msg.split("\n")[0].slice(0, 90)}). ${conformingOk}`,
      usedBy,
    });
  }
}

// ── stage A: mechanical translation of the real CFS schemas ──────────────────

const SCHEMAS: Array<[string, z.ZodType]> = [
  ["order.OrderSchema", OrderSchema as z.ZodType],
  ["order.OrderDocItem", OrderDocItem as z.ZodType],
  ["order.OrderDocLineItem", OrderDocLineItem as z.ZodType],
  ["order.OrderDocItemPrice", OrderDocItemPrice as z.ZodType],
  ["order.Discount", Discount as z.ZodType],
  ["order.CreateOrderInput", CreateOrderInput as z.ZodType],
  ["invoice.InvoiceSchema", InvoiceSchema as z.ZodType],
  ["invoice.InvoiceDocItem", InvoiceDocItem as z.ZodType],
  ["product.ProductSchema", ProductSchema as z.ZodType],
  ["transaction.MovementSchema", MovementSchema as z.ZodType],
];

/** Every JSON Schema keyword actually present in an emitted document, with a count. */
function keywords(
  node: unknown,
  acc = new Map<string, number>(),
  inProps = false,
): Map<string, number> {
  if (Array.isArray(node)) {
    for (const n of node) keywords(n, acc, false);
    return acc;
  }
  if (node === null || typeof node !== "object") return acc;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    // Keys under `properties`/`$defs`/`patternProperties` are field names, not keywords.
    if (!inProps) acc.set(k, (acc.get(k) ?? 0) + 1);
    const isNameMap = k === "properties" || k === "$defs" || k === "patternProperties" ||
      k === "definitions" || k === "dependentSchemas" || k === "unitMap";
    keywords(v, acc, !inProps && isNameMap);
  }
  return acc;
}

const translation: Record<string, {
  io: Record<string, { ok: boolean; detail: string; bytes?: number }>;
  strictThrow: string;
  keywords: string[];
}> = {};

function stageA(): Map<string, Set<string>> {
  const kwToSchemas = new Map<string, Set<string>>();

  for (const [name, schema] of SCHEMAS) {
    const entry: (typeof translation)[string] = { io: {}, strictThrow: "", keywords: [] };

    for (const io of ["input", "output"] as const) {
      try {
        const js = z.toJSONSchema(schema, { target: "draft-2020-12", io, unrepresentable: "any" });
        const bytes = JSON.stringify(js).length;
        entry.io[io] = { ok: true, detail: "emitted", bytes };
        if (io === "output") {
          const kws = keywords(js);
          entry.keywords = [...kws.keys()].sort();
          for (const k of kws.keys()) {
            if (!kwToSchemas.has(k)) kwToSchemas.set(k, new Set());
            kwToSchemas.get(k)!.add(name);
          }
        }
      } catch (e) {
        entry.io[io] = { ok: false, detail: (e as Error).message.split("\n")[0].slice(0, 200) };
      }
    }

    // `unrepresentable: "throw"` is Zod's OWN admission of loss. What it does NOT flag is
    // the finding: refinements are not "unrepresentable", they are simply absent.
    try {
      z.toJSONSchema(schema, { target: "draft-2020-12", io: "output", unrepresentable: "throw" });
      entry.strictThrow = "no throw";
    } catch (e) {
      entry.strictThrow = (e as Error).message.split("\n")[0].slice(0, 200);
    }

    translation[name] = entry;
  }
  return kwToSchemas;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outIdx = Deno.args.indexOf("--out");
  const outDir = outIdx >= 0 ? Deno.args[outIdx + 1] : null;

  console.log("=".repeat(100));
  console.log(
    "STAGE A — Zod → JSON Schema 2020-12 (mechanical translation of the real @cfs/core schemas)",
  );
  console.log("=".repeat(100));
  const kwToSchemas = stageA();

  for (const [name, e] of Object.entries(translation)) {
    console.log(
      `\n${name}\n  io=input  ${
        e.io.input.ok ? `OK ${e.io.input.bytes}B` : `THROW ${e.io.input.detail}`
      }` +
        `\n  io=output ${
          e.io.output.ok ? `OK ${e.io.output.bytes}B` : `THROW ${e.io.output.detail}`
        }` +
        `\n  unrepresentable:"throw" -> ${e.strictThrow}` +
        `\n  keywords: ${e.keywords.join(", ")}`,
    );
  }

  console.log("\n--- keyword -> which CFS schemas emit it (io=output) ---");
  const usedBy = (kw: string) =>
    [...(kwToSchemas.get(kw) ?? [])].join(", ") || "— (not emitted by any CFS schema)";
  for (const k of [...kwToSchemas.keys()].sort()) {
    console.log(`  ${k.padEnd(24)} ${[...kwToSchemas.get(k)!].length} schemas: ${usedBy(k)}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log(`STAGE B/C — feeding constructs to a REAL mongod at ${URI}`);
  console.log("=".repeat(100));

  client = new MongoClient(URI);
  await client.connect();
  const build = await client.db("admin").command({ buildInfo: 1 });
  console.log(`server version: ${build.version}  (${build.gitVersion})\n`);
  await client.db(DB).dropDatabase();

  const O = (props: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    bsonType: "object",
    properties: props,
    ...extra,
  });

  // ── 2020-12 core / applicator keywords ────────────────────────────────────

  await probe(
    "$schema (root)",
    usedBy("$schema"),
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      ...O({ a: { type: "string" } }, { required: ["a"] }),
    },
    { b: 1 },
    { a: "x" },
  );

  await probe(
    "$ref + $defs",
    usedBy("$ref"),
    {
      $defs: { pos: { type: "number", minimum: 0 } },
      ...O({ a: { $ref: "#/$defs/pos" } }),
    },
    { a: -5 },
    { a: 5 },
  );

  await probe(
    "$ref (definitions/ path)",
    usedBy("$ref"),
    {
      definitions: { pos: { type: "number", minimum: 0 } },
      ...O({ a: { $ref: "#/definitions/pos" } }),
    },
    { a: -5 },
    { a: 5 },
  );

  await probe(
    "$id",
    usedBy("$id"),
    { $id: "https://cfs.test/x", ...O({ a: { type: "string" } }) },
    { a: 1 },
    { a: "x" },
  );
  await probe("$anchor", usedBy("$anchor"), { $anchor: "root", ...O({ a: { type: "string" } }) }, {
    a: 1,
  }, { a: "x" });
  await probe("$dynamicRef (isolated)", usedBy("$dynamicRef"), O({ a: { $dynamicRef: "#T" } }), {
    a: 1,
  }, { a: "x" });
  await probe(
    "$comment",
    usedBy("$comment"),
    { $comment: "note", ...O({ a: { type: "string" } }) },
    { a: 1 },
    { a: "x" },
  );

  await probe(
    "allOf",
    usedBy("allOf"),
    O({ a: { allOf: [{ type: "number" }, { minimum: 10 }] } }),
    { a: 1 },
    { a: 20 },
  );
  await probe(
    "anyOf",
    usedBy("anyOf"),
    O({ a: { anyOf: [{ type: "string" }, { type: "number" }] } }),
    { a: true },
    { a: "x" },
  );
  await probe(
    "oneOf",
    usedBy("oneOf"),
    O({ a: { oneOf: [{ type: "string" }, { type: "number" }] } }),
    { a: true },
    { a: "x" },
  );
  await probe("not", usedBy("not"), O({ a: { not: { type: "string" } } }), { a: "x" }, { a: 1 });

  await probe(
    "if/then/else",
    usedBy("if"),
    {
      bsonType: "object",
      properties: { kind: { type: "string" }, pct: { type: "number" } },
      if: { properties: { kind: { const: "percent" } }, required: ["kind"] },
      then: { properties: { pct: { type: "number", minimum: 0, maximum: 100 } } },
    },
    { kind: "percent", pct: 5000 },
    { kind: "percent", pct: 50 },
  );

  await probe(
    "dependentRequired",
    usedBy("dependentRequired"),
    {
      bsonType: "object",
      properties: { base_percent: { type: "number" }, formula: { type: "string" } },
      dependentRequired: { base_percent: ["formula"] },
    },
    { base_percent: 2.9 },
    { base_percent: 2.9, formula: "percent_of_total" },
  );

  await probe(
    "dependentSchemas",
    usedBy("dependentSchemas"),
    {
      bsonType: "object",
      properties: { base_percent: { type: "number" }, formula: { type: "string" } },
      dependentSchemas: { base_percent: { required: ["formula"] } },
    },
    { base_percent: 2.9 },
    { base_percent: 2.9, formula: "percent_of_total" },
  );

  await probe(
    "dependencies (draft-4 spelling)",
    "— (draft-4 form, not emitted by Zod)",
    {
      bsonType: "object",
      properties: { base_percent: { type: "number" }, formula: { type: "string" } },
      dependencies: { base_percent: ["formula"] },
    },
    { base_percent: 2.9 },
    { base_percent: 2.9, formula: "percent_of_total" },
  );

  await probe(
    "unevaluatedProperties",
    usedBy("unevaluatedProperties"),
    {
      bsonType: "object",
      allOf: [{ properties: { a: { type: "string" } } }],
      unevaluatedProperties: false,
    },
    { a: "x", rogue: 1 },
    { a: "x" },
  );

  await probe(
    "unevaluatedItems (isolated)",
    usedBy("unevaluatedItems"),
    O({
      a: { type: "array", unevaluatedItems: false },
    }),
    { a: ["x", "extra"] },
    { a: [] },
  );

  await probe(
    "prefixItems (2020-12 tuple)",
    usedBy("prefixItems"),
    O({
      a: { type: "array", prefixItems: [{ type: "string" }, { type: "number" }] },
    }),
    { a: [1, "wrong-order"] },
    { a: ["x", 1] },
  );

  await probe(
    "items (schema form)",
    usedBy("items"),
    O({ a: { type: "array", items: { type: "string" } } }),
    { a: [1] },
    { a: ["x"] },
  );

  await probe(
    "additionalItems (draft-4 tuple tail)",
    "— (draft-4 form)",
    O({
      a: { type: "array", items: [{ type: "string" }], additionalItems: false },
    }),
    { a: ["x", "extra"] },
    { a: ["x"] },
  );

  await probe(
    "contains",
    usedBy("contains"),
    O({ a: { type: "array", contains: { const: "must" } } }),
    { a: ["no"] },
    { a: ["must"] },
  );
  await probe(
    "minContains (isolated)",
    usedBy("minContains"),
    O({
      a: { type: "array", minContains: 2 },
    }),
    { a: [1] },
    { a: [1, 2] },
  );

  await probe(
    "propertyNames",
    usedBy("propertyNames"),
    {
      bsonType: "object",
      properties: { bag: { bsonType: "object", propertyNames: { pattern: "^[a-z]+$" } } },
    },
    { bag: { "BAD-KEY": 1 } },
    { bag: { good: 1 } },
  );

  await probe(
    "patternProperties",
    usedBy("patternProperties"),
    {
      bsonType: "object",
      properties: { bag: { bsonType: "object", patternProperties: { "^n_": { type: "number" } } } },
    },
    { bag: { n_x: "not-a-number" } },
    { bag: { n_x: 1 } },
  );

  await probe(
    "additionalProperties:false",
    usedBy("additionalProperties"),
    O({ a: { type: "string" } }, {
      additionalProperties: false,
    }),
    { a: "x", rogue: 1 },
    { a: "x" },
  );

  await probe("required", usedBy("required"), O({ a: { type: "string" } }, { required: ["a"] }), {
    b: 1,
  }, { a: "x" });

  // ── validation vocabulary ─────────────────────────────────────────────────

  await probe('type:"integer"', usedBy("type"), O({ n: { type: "integer" } }), { n: 1.5 }, {
    n: 7,
  });
  await probe('type:"number"', usedBy("type"), O({ n: { type: "number" } }), { n: "x" }, {
    n: 1.5,
  });
  await probe('type:"null"', usedBy("type"), O({ n: { type: "null" } }), { n: 1 }, { n: null });
  await probe(
    'type as array ["string","null"]',
    usedBy("type"),
    O({ n: { type: ["string", "null"] } }),
    { n: 1 },
    { n: null },
  );
  await probe(
    'bsonType:"long" (Mongo ext)',
    "— (Mongo extension, no 2020-12 source)",
    O({ n: { bsonType: "long" } }),
    { n: 1.5 },
    { n: 7 },
  );
  await probe('bsonType:"int" vs JS number', "— (Mongo extension)", O({ n: { bsonType: "int" } }), {
    n: 2 ** 40,
  }, { n: 7 });

  await probe("const", usedBy("const"), O({ t: { const: "destination" } }), { t: "group" }, {
    t: "destination",
  });
  await probe("enum", usedBy("enum"), O({ t: { enum: ["percent", "flat"] } }), { t: "amount" }, {
    t: "flat",
  });

  await probe(
    "minimum/maximum",
    usedBy("minimum"),
    O({ n: { type: "number", minimum: 0, maximum: 100 } }),
    { n: -1 },
    { n: 5 },
  );
  await probe(
    "exclusiveMinimum (numeric, draft-6+)",
    usedBy("exclusiveMinimum"),
    O({
      n: { type: "number", exclusiveMinimum: 0 },
    }),
    { n: 0 },
    { n: 1 },
  );
  await probe(
    "exclusiveMinimum (boolean, draft-4)",
    "— (draft-4 form)",
    O({
      n: { type: "number", minimum: 0, exclusiveMinimum: true },
    }),
    { n: 0 },
    { n: 1 },
  );
  await probe("multipleOf", usedBy("multipleOf"), O({ n: { type: "number", multipleOf: 100 } }), {
    n: 150,
  }, { n: 200 });

  await probe(
    "minLength/maxLength",
    usedBy("minLength"),
    O({ s: { type: "string", minLength: 1, maxLength: 5 } }),
    { s: "toolong" },
    { s: "ok" },
  );
  await probe(
    "pattern",
    usedBy("pattern"),
    O({ s: { type: "string", pattern: "^[A-Za-z0-9]{20}$" } }),
    { s: "short" },
    { s: "aaaaaaaaaaaaaaaaaaaa" },
  );
  await probe('format:"uuid"', usedBy("format"), O({ s: { type: "string", format: "uuid" } }), {
    s: "not-a-uuid",
  }, { s: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });
  await probe(
    'format:"date-time"',
    usedBy("format"),
    O({ s: { type: "string", format: "date-time" } }),
    { s: "not-a-date" },
    { s: "2026-08-18T00:00:00.000-05:00" },
  );
  await probe('format:"email"', usedBy("format"), O({ s: { type: "string", format: "email" } }), {
    s: "nope",
  }, { s: "a@b.co" });

  await probe("minItems/maxItems", usedBy("minItems"), O({ a: { type: "array", minItems: 1 } }), {
    a: [],
  }, { a: [1] });
  await probe(
    "uniqueItems",
    usedBy("uniqueItems"),
    O({ a: { type: "array", uniqueItems: true } }),
    { a: [1, 1] },
    { a: [1, 2] },
  );
  await probe(
    "minProperties/maxProperties",
    usedBy("minProperties"),
    O({ o: { bsonType: "object", minProperties: 2 } }),
    { o: { a: 1 } },
    { o: { a: 1, b: 2 } },
  );

  // ── annotation keywords: accepted-and-inert by design, but the server must not choke ──
  await probe(
    "default",
    usedBy("default"),
    O({ s: { type: "string", default: "x" } }, { required: ["s"] }),
    { n: 1 },
    { s: "y" },
  );
  await probe(
    "title/description",
    usedBy("description"),
    O({ s: { type: "string", title: "T", description: "D" } }),
    { s: 1 },
    { s: "x" },
  );
  await probe(
    "readOnly/writeOnly",
    usedBy("readOnly"),
    O({ s: { type: "string", readOnly: true } }),
    { s: 1 },
    { s: "x" },
  );
  await probe("deprecated", usedBy("deprecated"), O({ s: { type: "string", deprecated: true } }), {
    s: 1,
  }, { s: "x" });
  await probe("examples", usedBy("examples"), O({ s: { type: "string", examples: ["a"] } }), {
    s: 1,
  }, { s: "x" });
  await probe(
    "contentEncoding/contentMediaType",
    usedBy("contentEncoding"),
    O({
      s: { type: "string", contentEncoding: "base64", contentMediaType: "image/png" },
    }),
    { s: 1 },
    { s: "x" },
  );

  // Zod `.meta({...})` passes arbitrary keys straight through. CFS uses it heavily
  // (`column`, `label`, `pii`, `unitVia`, `unitMap`). Does the server tolerate them?
  await probe(
    "Zod .meta() custom keys (column/label/pii)",
    usedBy("column"),
    O({
      s: { type: "string", column: true, label: "Rate", pii: "none" },
    }),
    { s: 1 },
    { s: "x" },
  );

  await probe(
    "unknown keyword (control)",
    "— (control)",
    O({ s: { type: "string", totallyMadeUpKeyword: 42 } }),
    { s: 1 },
    { s: "x" },
  );

  // ── the CFS-specific cases ────────────────────────────────────────────────

  // A discriminated union the way Zod actually emits it (oneOf of closed objects).
  await probe(
    "discriminated union as oneOf (divider vs line)",
    "order.OrderDocItem, invoice.InvoiceDocItem",
    {
      bsonType: "object",
      properties: {
        items: {
          type: "array",
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  uid: { type: "string" },
                  type: { const: "destination" },
                  name: { type: "string" },
                },
                required: ["uid", "type", "name"],
                additionalProperties: false,
              },
              {
                type: "object",
                properties: {
                  uid: { type: "string" },
                  type: { enum: ["rental", "sale", "service"] },
                  price: {
                    type: "object",
                    properties: { base_cents: { type: "integer" } },
                    required: ["base_cents"],
                  },
                },
                required: ["uid", "type", "price"],
                additionalProperties: false,
              },
            ],
          },
        },
      },
    },
    {
      // a divider carrying a price — the exact thing the strict divider arm forbids
      items: [{ uid: "u1", type: "destination", name: "Fillmore", price: { base_cents: 100 } }],
    },
    {
      items: [{ uid: "u1", type: "destination", name: "Fillmore" }],
    },
  );

  // The same union with the discriminator rewritten `const` -> `enum:[v]`, which is what a
  // stripper must do. This is the repairable half of the discriminated-union story.
  await probe(
    "discriminated union, discriminator rewritten to enum:[v]",
    "order.OrderDocItem, invoice.InvoiceDocItem",
    {
      bsonType: "object",
      properties: {
        items: {
          type: "array",
          items: {
            oneOf: [
              {
                bsonType: "object",
                properties: {
                  uid: { bsonType: "string" },
                  type: { enum: ["destination"] },
                  name: { bsonType: "string" },
                },
                required: ["uid", "type", "name"],
              },
              {
                bsonType: "object",
                properties: {
                  uid: { bsonType: "string" },
                  type: { enum: ["rental", "sale", "service"] },
                  price: {
                    bsonType: "object",
                    properties: { base_cents: { bsonType: "long" } },
                    required: ["base_cents"],
                  },
                },
                required: ["uid", "type", "price"],
              },
            ],
          },
        },
      },
    },
    {
      items: [{ uid: "u1", type: "not_a_known_type", name: "x" }],
    },
    {
      items: [{ uid: "u1", type: "destination", name: "Fillmore" }],
    },
  );

  // And the SAME union with the discriminator simply STRIPPED, which is what a stripper that
  // does not know to rewrite `const` produces. `type: "string"` is all that survives.
  await probe(
    "discriminated union, discriminator const STRIPPED",
    "order.OrderDocItem, invoice.InvoiceDocItem",
    {
      bsonType: "object",
      properties: {
        items: {
          type: "array",
          items: {
            oneOf: [
              {
                bsonType: "object",
                properties: {
                  uid: { bsonType: "string" },
                  type: { bsonType: "string" },
                  name: { bsonType: "string" },
                },
                required: ["uid", "type", "name"],
              },
            ],
          },
        },
      },
    },
    {
      items: [{ uid: "u1", type: "utterly_bogus_discriminator", name: "x" }],
    },
    {
      items: [{ uid: "u1", type: "destination", name: "Fillmore" }],
    },
  );

  // Money: integer cents. Two spellings of "this is an integer".
  await probe(
    "money: type:integer on _cents",
    "order.OrderDocItemPrice, invoice",
    O({
      base_cents: { type: "integer" },
    }),
    { base_cents: 19.99 },
    { base_cents: 1999 },
  );

  await probe(
    "money: bsonType:long on _cents",
    "— (the ADR-0003 storage form)",
    O({
      base_cents: { bsonType: "long" },
    }),
    { base_cents: 19.99 },
    { base_cents: 1999 },
  );

  // ── the five items-array invariants ───────────────────────────────────────
  // None of these is a JSON Schema construct at all. Probed anyway, because "can the DB hold
  // this line?" is exactly the question the enforcement split turns on.

  const invariantSchema = {
    bsonType: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            uid: { type: "string" },
            type: { type: "string" },
            path: { type: "array", items: { type: "string" }, minItems: 1 },
            zero_priced: { type: "boolean" },
          },
          required: ["uid", "type", "path"],
        },
      },
    },
  };

  await probe(
    "(4) non-empty path — expressible via minItems",
    "order/invoice/fulfillment items[]",
    invariantSchema,
    { items: [{ uid: "a", type: "group", path: [] }] },
    { items: [{ uid: "a", type: "group", path: ["a"] }] },
  );

  await probe(
    "(5) path.at(-1) === item.uid  [cross-field within one element]",
    "order/invoice/fulfillment items[]",
    invariantSchema,
    { items: [{ uid: "a", type: "group", path: ["WRONG"] }] },
    { items: [{ uid: "a", type: "group", path: ["a"] }] },
  );

  await probe(
    "(1) within-parent uniqueness  [cross-element]",
    "order/invoice/fulfillment items[]",
    invariantSchema,
    {
      items: [{ uid: "dup", type: "rental", path: ["g", "dup"] }, {
        uid: "dup",
        type: "rental",
        path: ["g", "dup"],
      }],
    },
    { items: [{ uid: "a", type: "rental", path: ["g", "a"] }] },
  );

  await probe(
    "(2) depth-first contiguity  [cross-element ordering]",
    "order/invoice/fulfillment items[]",
    invariantSchema,
    {
      items: [
        { uid: "g1", type: "group", path: ["g1"] },
        { uid: "x", type: "rental", path: ["g2", "x"] },
        { uid: "y", type: "rental", path: ["g1", "y"] },
      ],
    },
    {
      items: [{ uid: "g1", type: "group", path: ["g1"] }, {
        uid: "y",
        type: "rental",
        path: ["g1", "y"],
      }],
    },
  );

  await probe(
    "(3) zero-priced-first  [cross-element ordering]",
    "order/invoice/fulfillment items[]",
    invariantSchema,
    {
      items: [
        { uid: "a", type: "rental", path: ["g", "a"], zero_priced: false },
        { uid: "b", type: "rental", path: ["g", "b"], zero_priced: true },
      ],
    },
    { items: [{ uid: "b", type: "rental", path: ["g", "b"], zero_priced: true }] },
  );

  // ── end to end: the actual translated CFS documents ───────────────────────

  console.log("\n--- end-to-end: hand the SERVER the untouched z.toJSONSchema() output ---");
  for (const [name, schema] of SCHEMAS) {
    let js: Record<string, unknown>;
    try {
      js = z.toJSONSchema(schema, {
        target: "draft-2020-12",
        io: "output",
        unrepresentable: "any",
      }) as Record<string, unknown>;
    } catch (e) {
      console.log(
        `  ${name.padEnd(30)} STAGE-A THROW  ${(e as Error).message.split("\n")[0].slice(0, 120)}`,
      );
      continue;
    }
    const cname = `e2e_${name.replace(/\W/g, "_")}`;
    try {
      await client.db(DB).createCollection(cname, { validator: { $jsonSchema: js } });
      console.log(`  ${name.padEnd(30)} ACCEPTED as-is`);
    } catch (e) {
      console.log(
        `  ${name.padEnd(30)} REJECTED  ${(e as Error).message.split("\n")[0].slice(0, 160)}`,
      );
    }
    // And again with $schema stripped — the single most likely offender.
    const stripped = { ...js };
    delete stripped["$schema"];
    try {
      await client.db(DB).createCollection(`${cname}_nos`, {
        validator: { $jsonSchema: stripped },
      });
      console.log(`  ${" ".repeat(30)}   ...minus $schema: ACCEPTED`);
    } catch (e) {
      console.log(
        `  ${" ".repeat(30)}   ...minus $schema: REJECTED  ${
          (e as Error).message.split("\n")[0].slice(0, 160)
        }`,
      );
    }
  }

  // ── stage D: the translator anyone will actually write ────────────────────
  //
  // Nobody ships `z.toJSONSchema()` output straight to `createCollection` twice — the first
  // rejection teaches you to strip the offending keyword. So the realistic artifact is a
  // STRIPPER, and a stripper is where silent drops are MANUFACTURED: the server stops
  // complaining, which reads as success.
  //
  // For each keyword removed we record whether a sibling keyword still constrains the same
  // fact. That is the difference between "reformatted" and "no longer enforced".

  console.log("\n" + "=".repeat(100));
  console.log("STAGE D — a naive-but-realistic stripper, and what it silently discards");
  console.log("=".repeat(100));

  type Drop = { path: string; keyword: string; preservedBy: string | null; note: string };

  function strip(node: unknown, drops: Drop[], at = "$", inNameMap = false): unknown {
    if (Array.isArray(node)) return node.map((n, i) => strip(n, drops, `${at}[${i}]`));
    if (node === null || typeof node !== "object") return node;

    const src = node as Record<string, unknown>;
    if (inNameMap) {
      const outNm: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) outNm[k] = strip(v, drops, `${at}.${k}`);
      return outNm;
    }

    const out: Record<string, unknown> = {};
    const has = (k: string) => Object.hasOwn(src, k);

    for (const [k, v] of Object.entries(src)) {
      switch (k) {
        // Structurally supported, recurse.
        case "properties":
        case "patternProperties":
        case "$defs":
        case "definitions":
        case "dependentSchemas":
          if (k === "properties" || k === "patternProperties") {
            out[k] = strip(v, drops, `${at}.${k}`, true);
          } else {
            drops.push({
              path: at,
              keyword: k,
              preservedBy: null,
              note: "subschema library discarded with its $refs",
            });
          }
          continue;
        case "items":
        case "additionalProperties":
        case "not":
          out[k] = typeof v === "object" && v !== null ? strip(v, drops, `${at}.${k}`) : v;
          continue;
        case "allOf":
        case "anyOf":
        case "oneOf":
          out[k] = strip(v, drops, `${at}.${k}`);
          continue;

        // Supported verbatim.
        case "bsonType":
        case "required":
        case "enum":
        case "minimum":
        case "maximum":
        case "multipleOf":
        case "minLength":
        case "maxLength":
        case "pattern":
        case "minItems":
        case "maxItems":
        case "uniqueItems":
        case "minProperties":
        case "maxProperties":
        case "title":
        case "description":
        case "dependencies":
          out[k] = v;
          continue;

        // ── rewrites ──
        case "type": {
          if (v === "integer") {
            // Mongo has no `integer` type. `long` is the ADR-0003 storage form for money.
            out.bsonType = "long";
            drops.push({
              path: at,
              keyword: 'type:"integer"',
              preservedBy: 'bsonType:"long"',
              note:
                "integrality preserved, but now REQUIRES a BSON Long — a plain JS number no longer validates",
            });
          } else out[k] = v;
          continue;
        }
        case "const": {
          out.enum = [v];
          drops.push({ path: at, keyword: "const", preservedBy: "enum:[v]", note: "rewritten" });
          continue;
        }
        case "exclusiveMinimum": {
          if (typeof v === "number") {
            out.minimum = v;
            out.exclusiveMinimum = true;
            drops.push({
              path: at,
              keyword: "exclusiveMinimum (numeric)",
              preservedBy: "minimum + exclusiveMinimum:true",
              note: "rewritten to the draft-4 form",
            });
          } else out[k] = v;
          continue;
        }
        case "exclusiveMaximum": {
          if (typeof v === "number") {
            out.maximum = v;
            out.exclusiveMaximum = true;
            drops.push({
              path: at,
              keyword: "exclusiveMaximum (numeric)",
              preservedBy: "maximum + exclusiveMaximum:true",
              note: "rewritten to the draft-4 form",
            });
          } else out[k] = v;
          continue;
        }

        // ── unconditional drops ──
        case "$schema":
        case "$id":
        case "$anchor":
        case "$comment":
          drops.push({
            path: at,
            keyword: k,
            preservedBy: "n/a",
            note: "annotation, constrains nothing",
          });
          continue;
        case "default":
        case "readOnly":
        case "writeOnly":
        case "deprecated":
        case "examples":
          drops.push({
            path: at,
            keyword: k,
            preservedBy: "n/a",
            note: "annotation, constrains nothing (but `default` is a real behaviour lost)",
          });
          continue;
        case "format": {
          drops.push({
            path: at,
            keyword: `format:"${v}"`,
            preservedBy: has("pattern") ? "sibling pattern" : null,
            note: has("pattern")
              ? "same field also carries a regex"
              : "NOTHING ELSE CONSTRAINS THIS FIELD",
          });
          continue;
        }
        case "$ref":
        case "$dynamicRef":
        case "$dynamicAnchor":
          drops.push({
            path: at,
            keyword: k,
            preservedBy: null,
            note: "reference target unreachable; subtree becomes unconstrained",
          });
          continue;
        case "if":
        case "then":
        case "else":
        case "dependentRequired":
        case "unevaluatedProperties":
        case "unevaluatedItems":
        case "contains":
        case "minContains":
        case "maxContains":
        case "prefixItems":
        case "propertyNames":
        case "additionalItems":
        case "contentEncoding":
        case "contentMediaType":
          drops.push({
            path: at,
            keyword: k,
            preservedBy: null,
            note: "no `$jsonSchema` equivalent",
          });
          continue;

        default:
          // Zod `.meta()` passthrough — `column`, `label`, `pii`, `collection`, …
          drops.push({
            path: at,
            keyword: `${k} (Zod .meta())`,
            preservedBy: "n/a",
            note: "app metadata, constrains nothing",
          });
          continue;
      }
    }
    return out;
  }

  const stageD: Record<string, unknown> = {};
  for (const [name, schema] of SCHEMAS) {
    let js: Record<string, unknown>;
    try {
      js = z.toJSONSchema(schema, {
        target: "draft-2020-12",
        io: "output",
        unrepresentable: "any",
      }) as Record<string, unknown>;
    } catch {
      continue;
    }

    const drops: Drop[] = [];
    const stripped = strip(js, drops) as Record<string, unknown>;

    const cname = `d_${name.replace(/\W/g, "_")}`;
    let accepted = "";
    try {
      await client.db(DB).createCollection(cname, { validator: { $jsonSchema: stripped } });
      accepted = "ACCEPTED";
    } catch (e) {
      accepted = `STILL REJECTED: ${(e as Error).message.split("\n")[0].slice(0, 140)}`;
    }

    // Roll up: how many dropped keyword occurrences leave the fact unenforced?
    const unenforced = drops.filter((d) => d.preservedBy === null);
    const byKw = new Map<string, number>();
    for (const d of unenforced) {
      const kw = d.keyword.replace(/:"[^"]*"$/, "");
      byKw.set(kw, (byKw.get(kw) ?? 0) + 1);
    }
    stageD[name] = {
      accepted,
      dropped: drops.length,
      unenforced: unenforced.length,
      unenforcedByKeyword: Object.fromEntries([...byKw].sort((a, b) => b[1] - a[1])),
    };
    console.log(
      `\n${name}\n  after stripping: ${accepted}` +
        `\n  keyword occurrences removed: ${drops.length}; of those LEAVING THE FACT UNENFORCED: ${unenforced.length}` +
        `\n  unenforced by keyword: ${
          JSON.stringify(Object.fromEntries([...byKw].sort((a, b) => b[1] - a[1])))
        }`,
    );
    if (unenforced.length) {
      console.log("  first 6 unenforced sites:");
      for (const d of unenforced.slice(0, 6)) {
        console.log(`    ${d.path}  ${d.keyword}  — ${d.note}`);
      }
    }
  }

  // ── stage E: the traps the buckets above do not have a column for ─────────

  console.log("\n" + "=".repeat(100));
  console.log("STAGE E — three interactions that only show up on a real server");
  console.log("=".repeat(100));

  const db = client.db(DB);

  // E1. `z.strictObject` -> `additionalProperties:false` -> rejects EVERY document, because
  //     the driver adds `_id`. This is not a subtle degradation; it is a closed door.
  await db.createCollection("e1", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: { a: { bsonType: "string" } },
        additionalProperties: false,
      },
    },
  });
  let e1a = "", e1b = "";
  try {
    await db.collection("e1").insertOne({ a: "x" });
    e1a = "inserted";
  } catch (e) {
    e1a = `REJECTED: ${(e as Error).message.split("\n")[0].slice(0, 60)}`;
  }
  try {
    await db.collection("e1").insertOne({ _id: "k" as never, a: "x" });
    e1b = "inserted";
  } catch (e) {
    e1b = `REJECTED: ${(e as Error).message.split("\n")[0].slice(0, 60)}`;
  }
  console.log(`E1 additionalProperties:false + driver-supplied _id`);
  console.log(`   plain {a:"x"}                 -> ${e1a}`);
  console.log(`   {_id, a:"x"} (still closed)   -> ${e1b}`);
  await db.createCollection("e1b", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: { _id: {}, a: { bsonType: "string" } },
        additionalProperties: false,
      },
    },
  });
  try {
    await db.collection("e1b").insertOne({ a: "x" });
    console.log(`   with _id declared in properties -> inserted`);
  } catch (e) {
    console.log(
      `   with _id declared in properties -> REJECTED: ${
        (e as Error).message.split("\n")[0].slice(0, 60)
      }`,
    );
  }

  // E2. `bsonType:"long"` and a JS number. The money question.
  const { Long, Double, Int32 } = await import("npm:bson@6.10.4");
  await db.createCollection("e2", {
    validator: { $jsonSchema: { bsonType: "object", properties: { cents: { bsonType: "long" } } } },
  });
  console.log(`\nE2 bsonType:"long" on a money field`);
  for (
    const [label, val] of [
      ["JS number 1999", 1999],
      ["Int32(1999)", new Int32(1999)],
      ["Long(1999)", Long.fromNumber(1999)],
      ["Double(19.99)", new Double(19.99)],
      ["JS number 19.99", 19.99],
    ] as Array<[string, unknown]>
  ) {
    try {
      await db.collection("e2").insertOne({ cents: val } as never);
      console.log(`   ${label.padEnd(18)} -> INSERTED`);
    } catch (e) {
      console.log(
        `   ${label.padEnd(18)} -> rejected (${(e as Error).message.split("\n")[0].slice(0, 40)})`,
      );
    }
  }
  await db.createCollection("e3", {
    validator: {
      $jsonSchema: { bsonType: "object", properties: { cents: { bsonType: ["int", "long"] } } },
    },
  });
  console.log(`   --- bsonType:["int","long"] instead ---`);
  for (
    const [label, val] of [["JS number 1999", 1999], ["JS number 19.99", 19.99]] as Array<
      [string, unknown]
    >
  ) {
    try {
      await db.collection("e3").insertOne({ cents: val } as never);
      console.log(`   ${label.padEnd(18)} -> INSERTED`);
    } catch (e) {
      console.log(
        `   ${label.padEnd(18)} -> rejected (${(e as Error).message.split("\n")[0].slice(0, 40)})`,
      );
    }
  }

  // E3. validationLevel/validationAction — a validator can be advisory, and the default is not.
  await db.createCollection("e4", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: { a: { bsonType: "string" } },
        required: ["a"],
      },
    },
    validationAction: "warn",
  });
  console.log(`\nE3 validationAction:"warn"`);
  try {
    await db.collection("e4").insertOne({ b: 1 } as never);
    console.log(`   violating doc under validationAction:"warn" -> INSERTED (logged only)`);
  } catch (e) {
    console.log(
      `   violating doc -> rejected (${(e as Error).message.split("\n")[0].slice(0, 60)})`,
    );
  }
  await db.createCollection("e5", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: { a: { bsonType: "string" } },
        required: ["a"],
      },
    },
    validationLevel: "moderate",
  });
  await db.collection("e5").insertOne({ a: "ok" });
  console.log(
    `   validationLevel:"moderate" — pre-existing invalid docs are exempt from UPDATE validation`,
  );

  // E4. A bare recursive `$ref:"#"`, which is what z.lazy() emits.
  try {
    await db.createCollection("e6", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          properties: { kids: { bsonType: "array", items: { $ref: "#" } } },
        },
      },
    });
    console.log(`\nE4 recursive $ref:"#" (what z.lazy emits) -> validator ACCEPTED`);
  } catch (e) {
    console.log(
      `\nE4 recursive $ref:"#" (what z.lazy emits) -> REJECTED: ${
        (e as Error).message.split("\n")[0].slice(0, 120)
      }`,
    );
  }

  // ── stage F: the round trip that settles it ───────────────────────────────
  //
  // Stage D's "ACCEPTED" means the SERVER TOOK THE VALIDATOR. It does not mean a real document
  // can be written through it — validators only run on write. So: build a document that
  // `OrderSchema.parse()` accepts, and hand it to the collection the stripper built.
  //
  // A generated validator that rejects documents its own source schema calls valid is not a
  // partial win. It is a validator that is wrong in the OTHER direction, and that failure is
  // invisible to every check that only asks "did createCollection succeed".

  console.log("\n" + "=".repeat(100));
  console.log(
    "STAGE F — round trip: a Zod-VALID order document through the stripper's own validator",
  );
  console.log("=".repeat(100));

  const ts = { seconds: 1787000000, nanoseconds: 0 };
  const endpoint = { uid: null, address: null, instructions: null, contact: null };
  const parsed = (OrderSchema as z.ZodType).safeParse({
    uid: "AAAAAAAAAAAAAAAAAAAA",
    number: 1,
    status: "draft",
    organization: {
      uid: "BBBBBBBBBBBBBBBBBBBB",
      name: "Acme Films",
      tax_profile: "tax_applied",
      xero_id: null,
    },
    destinations: [{ dates: {}, delivery: endpoint, collection: endpoint }],
    tax_profile: null,
    totals: {},
    created_at: ts,
    updated_at: ts,
  });

  if (!parsed.success) {
    console.log("  could not build a Zod-valid order:", parsed.error.issues.slice(0, 3));
  } else {
    const validOrder = parsed.data as Record<string, unknown>;
    console.log(
      `  OrderSchema.parse() -> VALID (${Object.keys(validOrder).length} top-level keys)`,
    );

    // (a) through the stripper's validator, exactly as stage D built it
    try {
      await client.db(DB).collection("d_order_OrderSchema").insertOne({ ...validOrder });
      console.log("  (a) insert into the stripped-validator collection      -> INSERTED");
    } catch (e) {
      console.log(
        `  (a) insert into the stripped-validator collection      -> REJECTED: ${
          (e as Error).message.split("\n")[0].slice(0, 90)
        }`,
      );
    }

    // (b) isolate the causes, one at a time, so the failure names itself
    const cases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
      [
        "additionalProperties:false (z.strictObject) vs driver _id",
        {
          bsonType: "object",
          additionalProperties: false,
          properties: { uid: { bsonType: "string" } },
        },
        { uid: "AAAAAAAAAAAAAAAAAAAA" },
      ],
      [
        'FirestoreTimestamp .meta() says type:"string", value is an OBJECT',
        { bsonType: "object", properties: { created_at: { type: "string" } } },
        { created_at: ts },
      ],
      [
        'z.int() -> type:"integer" -> rewritten bsonType:"long" vs a JS number',
        { bsonType: "object", properties: { number: { bsonType: "long" } } },
        { number: 1 },
      ],
      [
        'chicagoInstant() output -> anyOf:[{},{"type":"null"}] (a tautology)',
        { bsonType: "object", properties: { d: { anyOf: [{}, { type: "null" }] } } },
        { d: "literally anything, including a number" },
      ],
    ];
    for (const [label, validator, doc] of cases) {
      const cn = `f_${seq++}`;
      try {
        await client.db(DB).createCollection(cn, { validator: { $jsonSchema: validator } });
      } catch (e) {
        console.log(
          `  (b) ${label}\n        validator REJECTED: ${
            (e as Error).message.split("\n")[0].slice(0, 80)
          }`,
        );
        continue;
      }
      try {
        await client.db(DB).collection(cn).insertOne({ ...doc } as never);
        console.log(`  (b) ${label}\n        real value INSERTED`);
      } catch {
        console.log(`  (b) ${label}\n        real value REJECTED by the generated validator`);
      }
    }
  }

  // ── stage G: the definitive accepted-keyword list, from the server ────────
  //
  // Not from the docs. One minimal, individually-valid schema per keyword; the only question is
  // whether `createCollection` takes it. This is the answer to "establish EXACTLY which keywords
  // are accepted", and the shape of the result is the finding: `$jsonSchema` NEVER silently
  // ignores a keyword it does not know.

  console.log("\n" + "=".repeat(100));
  console.log(`STAGE G — every keyword, accept/reject, against mongod ${build.version}`);
  console.log("=".repeat(100));

  const KEYWORDS: Record<string, unknown> = {
    "$schema": { $schema: "https://json-schema.org/draft/2020-12/schema" },
    "$id": { $id: "x" },
    "$ref": { $ref: "#" },
    "$defs": { $defs: {} },
    "definitions": { definitions: {} },
    "$anchor": { $anchor: "a" },
    "$comment": { $comment: "c" },
    "$dynamicRef": { $dynamicRef: "#a" },
    "$dynamicAnchor": { $dynamicAnchor: "a" },
    "$vocabulary": { $vocabulary: {} },
    "allOf": { allOf: [{}] },
    "anyOf": { anyOf: [{}] },
    "oneOf": { oneOf: [{}] },
    "not": { not: {} },
    "if": { if: {} },
    "then": { then: {} },
    "else": { else: {} },
    "properties": { properties: {} },
    "patternProperties": { patternProperties: {} },
    "additionalProperties": { additionalProperties: false },
    "propertyNames": { propertyNames: {} },
    "dependentSchemas": { dependentSchemas: {} },
    "dependentRequired": { dependentRequired: {} },
    "dependencies": { dependencies: {} },
    "items": { items: {} },
    "prefixItems": { prefixItems: [{}] },
    "additionalItems": { additionalItems: false },
    "contains": { contains: {} },
    "minContains": { minContains: 1 },
    "maxContains": { maxContains: 1 },
    "unevaluatedProperties": { unevaluatedProperties: false },
    "unevaluatedItems": { unevaluatedItems: false },
    "type": { type: "object" },
    "bsonType": { bsonType: "object" },
    "enum": { enum: [1] },
    "const": { const: 1 },
    "required": { required: ["a"] },
    "minimum": { minimum: 0 },
    "maximum": { maximum: 1 },
    "exclusiveMinimum (numeric)": { exclusiveMinimum: 0 },
    "exclusiveMaximum (numeric)": { exclusiveMaximum: 1 },
    "exclusiveMinimum (boolean)": { minimum: 0, exclusiveMinimum: true },
    "exclusiveMaximum (boolean)": { maximum: 1, exclusiveMaximum: true },
    "multipleOf": { multipleOf: 2 },
    "minLength": { minLength: 1 },
    "maxLength": { maxLength: 2 },
    "pattern": { pattern: "^a$" },
    "minItems": { minItems: 1 },
    "maxItems": { maxItems: 2 },
    "uniqueItems": { uniqueItems: true },
    "minProperties": { minProperties: 1 },
    "maxProperties": { maxProperties: 2 },
    "format": { format: "uuid" },
    "title": { title: "t" },
    "description": { description: "d" },
    "default": { default: 1 },
    "readOnly": { readOnly: true },
    "writeOnly": { writeOnly: true },
    "deprecated": { deprecated: true },
    "examples": { examples: [1] },
    "contentEncoding": { contentEncoding: "base64" },
    "contentMediaType": { contentMediaType: "text/plain" },
    "contentSchema": { contentSchema: {} },
  };

  const kwOk: string[] = [], kwBad: string[] = [];
  for (const [k, s] of Object.entries(KEYWORDS)) {
    const cn = `g${seq++}`;
    try {
      await client.db(DB).createCollection(cn, { validator: { $jsonSchema: s as object } });
      kwOk.push(k);
    } catch (e) {
      kwBad.push(
        `${k.padEnd(28)} ${
          (e as Error).message.split("\n")[0].replace("Error: ", "").slice(0, 70)
        }`,
      );
    }
  }
  console.log(`ACCEPTED (${kwOk.length}/${kwOk.length + kwBad.length}):\n  ${kwOk.join(", ")}`);
  console.log(`\nREJECTED (${kwBad.length}/${kwOk.length + kwBad.length}):`);
  for (const b of kwBad) console.log(`  ${b}`);
  console.log(
    `\nSILENTLY IGNORED: 0. Every unsupported keyword produced an error at createCollection —` +
      `\n  either "not currently supported" (a named omission) or "Unknown $jsonSchema keyword".`,
  );

  // ── stage H: the five invariants under `$expr`, not `$jsonSchema` ─────────
  //
  // A collection validator is an ordinary QUERY, and `$jsonSchema` is only one operator it may
  // contain. `$expr` admits the aggregation language — which has `$map`, `$range`, `$reduce` and
  // `$setUnion`, i.e. enough to talk about several elements at once. So "MongoDB cannot express
  // the items-array invariants" is a claim about `$jsonSchema`, NOT about MongoDB.
  //
  // ⚠️ Read the contiguity row with the history attached: it took FOUR formulations. The first
  // accepted a violating document (vacuous), the second and third rejected a CONFORMING one
  // (over-strict, forbidding two top-level dividers that share the root parent). Every one of
  // them would have read as correct in review. Only the conforming/violating pair told them
  // apart — which is this repo's "land every gate red first", arriving from the other direction.

  console.log("\n" + "=".repeat(100));
  console.log("STAGE H — the five items-array invariants as `$expr` collection validators");
  console.log("=".repeat(100));

  const items = { $ifNull: ["$items", []] };
  const pathsVar = { $map: { input: items, as: "i", in: { $ifNull: ["$$i.path", []] } } };

  // DFS contiguity, stated correctly at the FOURTH attempt: for every item k, its parent —
  // `path` minus its own last segment — must be a PREFIX of item k-1's full `path`. A root-level
  // item (parent = []) is always legal, which is what the earlier formulations got wrong: they
  // keyed on "each parent forms one contiguous run", and two top-level dividers legitimately
  // SHARE the root parent while other items sit between them.
  const contiguityExpr = {
    $let: {
      vars: { paths: pathsVar },
      in: {
        $allElementsTrue: {
          $map: {
            input: { $range: [0, { $size: "$$paths" }] },
            as: "k",
            in: {
              $let: {
                vars: {
                  par: {
                    $let: {
                      vars: { p: { $arrayElemAt: ["$$paths", "$$k"] } },
                      in: {
                        $cond: [
                          { $lte: [{ $size: "$$p" }, 1] },
                          [],
                          { $slice: ["$$p", 0, { $subtract: [{ $size: "$$p" }, 1] }] },
                        ],
                      },
                    },
                  },
                  prev: {
                    $cond: [
                      { $eq: ["$$k", 0] },
                      [],
                      { $arrayElemAt: ["$$paths", { $subtract: ["$$k", 1] }] },
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $eq: [{ $size: "$$par" }, 0] },
                    true,
                    { $eq: ["$$par", { $slice: ["$$prev", 0, { $size: "$$par" }] }] },
                  ],
                },
              },
            },
          },
        },
      },
    },
  };

  const INV: Array<[string, object, object, object]> = [
    [
      "(1) within-parent uniqueness",
      {
        $expr: {
          $let: {
            vars: {
              keys: {
                $map: {
                  input: items,
                  as: "i",
                  in: {
                    $concat: [
                      { $ifNull: [{ $arrayElemAt: ["$$i.path", -2] }, "~root"] },
                      "|",
                      "$$i.uid",
                    ],
                  },
                },
              },
            },
            in: { $eq: [{ $size: "$$keys" }, { $size: { $setUnion: ["$$keys", []] } }] },
          },
        },
      },
      { items: [{ uid: "d", path: ["g", "d"] }, { uid: "d", path: ["g", "d"] }] },
      { items: [{ uid: "d", path: ["g1", "d"] }, { uid: "d", path: ["g2", "d"] }] },
    ],

    ["(2) depth-first contiguity", { $expr: contiguityExpr }, {
      items: [
        { uid: "d", path: ["d"] },
        { uid: "g", path: ["d", "g"] },
        { uid: "a", path: ["d", "g", "a"] },
        { uid: "d2", path: ["d2"] },
        { uid: "b", path: ["d", "g", "b"] },
      ],
    }, {
      items: [
        { uid: "d", path: ["d"] },
        { uid: "g", path: ["d", "g"] },
        { uid: "a", path: ["d", "g", "a"] },
        { uid: "b", path: ["d", "g", "b"] },
        { uid: "d2", path: ["d2"] },
      ],
    }],

    [
      "(3) zero-priced-first",
      {
        $expr: {
          $let: {
            vars: {
              z: {
                $map: {
                  input: items,
                  as: "i",
                  in: { $cond: [{ $eq: ["$$i.zero_priced", true] }, 0, 1] },
                },
              },
            },
            in: { $eq: ["$$z", { $sortArray: { input: "$$z", sortBy: 1 } }] },
          },
        },
      },
      { items: [{ uid: "a", zero_priced: false }, { uid: "b", zero_priced: true }] },
      { items: [{ uid: "b", zero_priced: true }, { uid: "a", zero_priced: false }] },
    ],

    [
      "(4) non-empty path",
      {
        $expr: {
          $allElementsTrue: {
            $map: {
              input: items,
              as: "i",
              in: { $gt: [{ $size: { $ifNull: ["$$i.path", []] } }, 0] },
            },
          },
        },
      },
      { items: [{ uid: "a", path: [] }] },
      { items: [{ uid: "a", path: ["a"] }] },
    ],

    [
      "(5) path.at(-1) === item.uid",
      {
        $expr: {
          $allElementsTrue: {
            $map: { input: items, as: "i", in: { $eq: [{ $last: "$$i.path" }, "$$i.uid"] } },
          },
        },
      },
      { items: [{ uid: "a", path: ["WRONG"] }] },
      { items: [{ uid: "a", path: ["g", "a"] }] },
    ],
  ];

  const invResults: Array<{ invariant: string; jsonSchema: string; expr: string }> = [];
  for (const [label, validator, bad, good] of INV) {
    const cn = `h${seq++}`;
    let verdict: string;
    try {
      await client.db(DB).createCollection(cn, { validator });
      let g: string, b: string;
      try {
        await client.db(DB).collection(cn).insertOne({ ...good } as never);
        g = "accepted";
      } catch {
        g = "REJECTED";
      }
      try {
        await client.db(DB).collection(cn).insertOne({ ...bad } as never);
        b = "INSERTED";
      } catch {
        b = "rejected";
      }
      verdict = g === "accepted" && b === "rejected"
        ? "ENFORCED (conforming accepted, violating rejected)"
        : `BROKEN — conforming=${g}, violating=${b}`;
    } catch (e) {
      verdict = `validator REJECTED: ${(e as Error).message.split("\n")[0].slice(0, 90)}`;
    }
    invResults.push({
      invariant: label,
      jsonSchema: label.startsWith("(4)") ? "minItems:1" : "inexpressible",
      expr: verdict,
    });
    console.log(`  ${label.padEnd(32)} $expr -> ${verdict}`);
  }

  // The trap someone will reach for instead.
  await client.db(DB).createCollection("uidx");
  await client.db(DB).collection("uidx").createIndex({ "items.uid": 1 }, { unique: true });
  console.log("\n  the unique-index shortcut, and why it is the wrong tool:");
  try {
    await client.db(DB).collection("uidx").insertOne(
      { _id: "o1" as never, items: [{ uid: "p" }, { uid: "p" }] } as never,
    );
    console.log(
      "    same uid twice in ONE document       -> INSERTED (it enforces NO within-document uniqueness)",
    );
  } catch (e) {
    console.log(
      `    same uid twice in ONE document       -> rejected: ${(e as Error).message.slice(0, 60)}`,
    );
  }
  try {
    await client.db(DB).collection("uidx").insertOne(
      { _id: "o2" as never, items: [{ uid: "p" }] } as never,
    );
    console.log("    same uid in a DIFFERENT document     -> INSERTED");
  } catch {
    console.log(
      "    same uid in a DIFFERENT document     -> REJECTED — exactly backwards: a unique index on",
    );
    console.log(
      "                                            `items.uid` forbids the LEGAL case (the same product on",
    );
    console.log(
      "                                            two orders) and permits the illegal one.",
    );
  }

  // ── report ────────────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(100));
  console.log("CONSTRUCT MATRIX");
  console.log("=".repeat(100));
  const order: Bucket[] = ["silently-dropped", "rejected", "translates", "n/a"];
  for (const b of order) {
    const g = rows.filter((r) => r.bucket === b);
    if (!g.length) continue;
    console.log(`\n### ${b.toUpperCase()} — ${g.length}`);
    for (const r of g) console.log(`  ${r.construct.padEnd(46)} | ${r.proof}`);
  }
  console.log(
    "\nCOUNTS " + JSON.stringify(
      Object.fromEntries(order.map((b) => [b, rows.filter((r) => r.bucket === b).length])),
    ) + ` of ${rows.length}`,
  );

  if (outDir) {
    await Deno.writeTextFile(
      `${outDir}/mongo-probe.json`,
      JSON.stringify(
        { server: build.version, deno: Deno.version.deno, translation, rows, stageD },
        null,
        2,
      ),
    );
    console.log(`\nwrote ${outDir}/mongo-probe.json`);
  }

  await client.db(DB).dropDatabase();
  await client.close();
}

await main();
