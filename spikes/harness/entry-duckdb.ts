/** Single-package compile entrypoint — see entry-tb.ts for why it bypasses napi-probe.ts. */
import { probeDuckDb } from "./probe-duckdb.ts";
import { emit } from "./probe-util.ts";

emit([await probeDuckDb()]);
