export type ProbeResult = {
  name: string;
  ok: boolean;
  /** A measured value on success, the verbatim error on failure. Never "confirmed". */
  detail: string;
  ms: number;
};

export const time = async (name: string, fn: () => Promise<string>): Promise<ProbeResult> => {
  const t0 = performance.now();
  try {
    return { name, ok: true, detail: await fn(), ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return {
      name,
      ok: false,
      detail: err.replaceAll("\n", " ⏎ "),
      ms: Math.round(performance.now() - t0),
    };
  }
};

/** Every entrypoint prints exactly this line, so matrix.ts parses a script and a compiled binary identically. */
export const emit = (results: ProbeResult[]) => {
  for (const r of results) {
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(28)} ${
        r.ms.toString().padStart(5)
      }ms  ${r.detail}`,
    );
  }
  console.log(`MATRIX_JSON ${JSON.stringify({ deno: Deno.version.deno, results })}`);
  if (results.some((r) => !r.ok)) Deno.exit(1);
};
