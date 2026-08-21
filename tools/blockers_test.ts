/**
 * The input space for `isStillBlocking` and `adrBlockers`, enumerated rather than sampled.
 *
 * ⚠️ **The shape that produced erp-spec#39 was "nobody checked the status at all"** — a whole
 * dimension of the input missing from the decision, not a mishandled edge. So the table below is
 * `kind × status-class`: three kinds, and for each of them the terminal value, a non-terminal
 * value, another kind's terminal value (the plausible confusion), an absent status, and an id
 * missing from the index entirely. Rows nobody expects to reach are kept for the same reason
 * `ci-predicates_test.ts` keeps its five: nobody knew in advance which ones would matter.
 *
 * ⚠️ **`OQ-` with `status: closed` is the row that matters most** and it is not hypothetical — it
 * is what a deny-list implementation gets wrong. `closed` is terminal for a SPIKE and meaningless
 * for an OQ, and an OQ carrying it must stay blocking.
 */
import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  adrBlockers,
  type BlockerEntry,
  blockerKind,
  isStillBlocking,
  renderBlockers,
  TERMINAL_STATUS,
} from "./blockers.ts";

const idx = (rows: Record<string, BlockerEntry>) =>
  new Map<string, BlockerEntry>(Object.entries(rows));

Deno.test("blockerKind — only the three id kinds, and REQ/ADR/EVT are not blockers", () => {
  assertEquals(blockerKind("HOT-011"), "HOT");
  assertEquals(blockerKind("OQ-021"), "OQ");
  assertEquals(blockerKind("SPIKE-003"), "SPIKE");
  for (const other of ["ADR-0025", "REQ-LED-014", "EVT-FUL-002", "", "HOTFIX-1", "hot-011"]) {
    assertEquals(blockerKind(other), null, other);
  }
});

Deno.test("TERMINAL_STATUS — one value per kind, and they are all different", () => {
  assertEquals(TERMINAL_STATUS.HOT, "resolved");
  assertEquals(TERMINAL_STATUS.OQ, "answered");
  assertEquals(TERMINAL_STATUS.SPIKE, "closed");
  assertEquals(new Set(Object.values(TERMINAL_STATUS)).size, 3);
});

Deno.test("isStillBlocking — kind × status-class, exhaustively", async (t) => {
  // id, status ("ABSENT" = entry with no status, "MISSING" = not in the index), expected, note
  const rows: [string, string, boolean, string][] = [
    // ── HOT ────────────────────────────────────────────────────────────────────────────────────
    ["HOT-1", "resolved", false, "terminal — the erp-spec#39 case (HOT-011 on ADR-0025)"],
    ["HOT-2", "open", true, "the ordinary live blocker"],
    ["HOT-3", "answered", true, "⚠️ another kind's terminal value must NOT clear a HOT"],
    ["HOT-4", "closed", true, "⚠️ likewise"],
    ["HOT-5", "ABSENT", true, "no status defaults to open, as generate.ts already counts it"],
    ["HOT-6", "MISSING", true, "⚠️ dangling id fails OPEN — unknown is not resolved"],
    ["HOT-7", "Resolved", true, "⚠️ status match is exact; a case variant is not terminal"],
    // ── OQ ─────────────────────────────────────────────────────────────────────────────────────
    ["OQ-1", "answered", false, "terminal — OQ-012, OQ-021, OQ-022, OQ-025, OQ-006, OQ-018"],
    ["OQ-2", "open", true, "the ordinary live blocker"],
    ["OQ-3", "closed", true, "⚠️ THE deny-list trap: terminal for SPIKE, meaningless for OQ"],
    ["OQ-4", "resolved", true, "⚠️ likewise"],
    ["OQ-5", "ABSENT", true, "no status defaults to open"],
    ["OQ-6", "MISSING", true, "dangling id fails open"],
    // ── SPIKE ──────────────────────────────────────────────────────────────────────────────────
    ["SPIKE-1", "closed", false, "terminal — SPIKE-003 on ADR-0039, SPIKE-006 on ADR-0040"],
    ["SPIKE-2", "open", true, "SPIKE-002 and SPIKE-012 on ADR-0015 — genuinely blocking"],
    ["SPIKE-3", "resolved", true, "⚠️ another kind's terminal value"],
    ["SPIKE-4", "answered", true, "⚠️ likewise"],
    ["SPIKE-5", "ABSENT", true, "no status defaults to open"],
    ["SPIKE-6", "MISSING", true, "dangling id fails open"],
    // ── not a blocker kind at all ──────────────────────────────────────────────────────────────
    ["ADR-0025", "open", false, "an ADR in relates_to is a cross-reference, never a blocker"],
    ["REQ-LED-014", "open", false, "likewise"],
  ];

  for (const [id, status, expected, note] of rows) {
    await t.step(`${id} status=${status} -> ${expected ? "blocking" : "clear"}  (${note})`, () => {
      const index = status === "MISSING"
        ? idx({})
        : idx({ [id]: status === "ABSENT" ? {} : { status } });
      assertEquals(isStillBlocking(id, index), expected);
    });
  }
});

Deno.test("adrBlockers — preserves declaration order and drops only the terminal ones", () => {
  const index = idx({
    "OQ-035": { status: "open" },
    "OQ-036": { status: "answered" },
    "OQ-038": { status: "open" },
    "OQ-039": { status: "open" },
    "HOT-006": { status: "resolved" },
  });
  // ADR-0032's real relates_to, in its real order.
  const b = adrBlockers({
    relates_to: ["OQ-035", "OQ-036", "OQ-038", "OQ-039", "HOT-006"],
    accounting_shaped: false,
  }, index);
  assertEquals(b.ids, ["OQ-035", "OQ-038", "OQ-039"]);
  assertEquals(b.needsSurvey, false);
});

Deno.test("adrBlockers — a spike that will CLOSE this ADR still blocks it while open", () => {
  // ⚠️ erp-spec#39 proposed excluding "the spike named by the ADR's own closes_adr". SPIKE-012 is
  // open and declares `closes_adr: ADR-0015`; excluding it would delete ADR-0015's only blocker.
  const index = idx({ "SPIKE-002": { status: "open" }, "SPIKE-012": { status: "open" } });
  const b = adrBlockers({ relates_to: ["SPIKE-002", "SPIKE-012"] }, index);
  assertEquals(b.ids, ["SPIKE-002", "SPIKE-012"]);
});

Deno.test("adrBlockers — rule 8a, the four-way truth table", async (t) => {
  // accounting_shaped, survey, survey_exemption, expected needsSurvey, note
  const rows: [boolean | undefined, string[], string | undefined, boolean, string][] = [
    [true, [], undefined, true, "⚠️ ADR-0020/0025/0029 — nothing else would show they are stuck"],
    [true, ["inbox/x.md"], undefined, false, "surveyed — ADR-0038's shape"],
    [true, [], "legacy, accepted before rule 8a", false, "exempt by identity — ADR-0007's shape"],
    [true, ["inbox/x.md"], "both", false, "either one clears it"],
    [false, [], undefined, false, "not accounting-shaped — ADR-0039, ADR-0040"],
    [undefined, [], undefined, false, "absent flag is not `true`; gate 19 owns that complaint"],
  ];
  for (const [shaped, survey, exemption, expected, note] of rows) {
    await t.step(
      `shaped=${shaped} survey=${survey.length} exempt=${!!exemption}  (${note})`,
      () => {
        const b = adrBlockers(
          { accounting_shaped: shaped, survey, survey_exemption: exemption },
          idx({}),
        );
        assertEquals(b.needsSurvey, expected);
      },
    );
  }
});

Deno.test("adrBlockers — no relates_to at all", () => {
  assertEquals(adrBlockers({}, idx({})), { ids: [], needsSurvey: false });
  assertEquals(adrBlockers({ relates_to: null }, idx({})), { ids: [], needsSurvey: false });
});

Deno.test("renderBlockers — one rendering for both tables", () => {
  assertEquals(renderBlockers({ ids: [], needsSurvey: false }), "—");
  assertEquals(renderBlockers({ ids: ["SPIKE-002"], needsSurvey: false }), "`SPIKE-002`");
  assertEquals(
    renderBlockers({ ids: ["OQ-035", "OQ-038"], needsSurvey: false }),
    "`OQ-035` `OQ-038`",
  );
  // ⚠️ The row the fix exists for: no ids left, and still not acceptable.
  assertEquals(renderBlockers({ ids: [], needsSurvey: true }), "**rule 8a survey**");
  assertEquals(
    renderBlockers({ ids: ["HOT-006"], needsSurvey: true }),
    "`HOT-006` **rule 8a survey**",
  );
});
