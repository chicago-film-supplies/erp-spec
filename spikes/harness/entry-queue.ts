/** Single-package compile entrypoint — see entry-tb.ts for why it bypasses napi-probe.ts. */
import { probeQueue } from "./probe-queue.ts";
import { emit } from "./probe-util.ts";

emit([await probeQueue()]);
