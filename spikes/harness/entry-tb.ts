/**
 * Single-package compile entrypoint. It imports `probe-tb.ts` directly and never `napi-probe.ts`:
 * `deno compile` embeds every statically-reachable literal `import()`, so routing through the
 * combined file would drag DuckDB and BullMQ into this binary. Measured before the split: all
 * three binaries came out at an identical 364 MB and `--bundle` failed on BullMQ's optional `pg`
 * peer for all three, masking the DuckDB question entirely.
 */
import { probeTigerBeetle } from "./probe-tb.ts";
import { emit } from "./probe-util.ts";

emit([await probeTigerBeetle()]);
