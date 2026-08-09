# Hono

The HTTP framework on Deno ([[ADR-0004]]). Small, typed, multi-runtime.

## Canonical docs

- `llms.txt`: <https://hono.dev/llms.txt> — links `llms-full.txt` (full, no examples) and
  `llms-small.txt` (core only).
- Docs: <https://hono.dev/docs/>
- Deno getting-started: <https://hono.dev/docs/getting-started/deno>

## Version (checked 2026-08-09)

- Hono `v4`.

## CFS-specific gotchas

- **Hono RPC + `@hono/zod-validator` gives end-to-end typed client↔server** — this is the concrete
  mechanism behind the "shared types with the SolidJS clients" that [[ADR-0004]] rests on. Define
  request/response with Zod, export the app type, consume it typed on the client. See [[zod]].
- **Keep handlers thin.** The two-store commit orchestration (TB pending → Mongo write → TB
  post/void) is domain logic, not middleware. A handler validates, delegates, and serialises.
- Zod validator under Deno has had specifier/type friction historically — pull `hono`,
  `@hono/zod-validator`, and `zod` through consistent `npm:`/JSR specifiers and matching versions.

Cross-refs: [[ADR-0004]] · [[zod]]
