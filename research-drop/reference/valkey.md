# Valkey

Candidate in-memory store (cache / pub-sub / streams) — the BSD-licensed, Linux-Foundation fork of
Redis, protocol-compatible with it. **Not yet decided** — no ADR references Valkey. The natural fit
is the socket / real-time layer that replaces Firestore listeners ([[SPIKE-009]]).

## Canonical docs

- Docs: <https://valkey.io/topics/>
- Commands: <https://valkey.io/commands/>
- Migration from Redis: <https://valkey.io/topics/migration/>
- Source: <https://github.com/valkey-io/valkey>
- **No `llms.txt`** as of 2026-08-09 (404); this note is the curated substitute. Because Valkey
  speaks the Redis wire protocol (RESP), Redis's own docs and client libraries apply almost verbatim.

## Version (checked 2026-08-09)

- Valkey `9.1.1` (released 2026-07-21). Prior lines `8.1.x`, `7.2.x` still supported.

## CFS-specific gotchas

- **In-memory, never a source of truth.** Anything in Valkey must be rebuildable from Mongo / TB /
  Parquet — same discipline as the `.duckdb` cache ([[ADR-0006]]). It may never hold the ledger or be
  treated as balance truth.
- **Socket layer fan-out** ([[SPIKE-009]]): to broadcast Mongo change-stream events across multiple
  API instances, prefer **Streams** (durable, consumer groups, resumable) over bare **pub/sub**
  (fire-and-forget, no persistence). Streams line up with SPIKE-009's requirement to specify
  resume-token handling and recovery after a disconnect longer than the oplog window; pub/sub drops
  anything published while a client was away.
- **Valkey does not re-implement authorization.** Same trap as change streams ([[SPIKE-009]]): a
  socket/broadcast layer over Valkey must enforce authz itself — nothing in the transport does it.
- **If caching money, keep it integer minor units** (CLAUDE.md §7). Valkey stores strings/bytes;
  serialise cents as an integer string, never round-trip through a float.
- **Deno access:** Redis clients work unchanged — `npm:redis` or `npm:ioredis` via specifier; a
  Deno-native RESP client also exists on JSR. This is a plain network client, not a native addon, so
  it does **not** carry the `deno compile`/napi risk that TigerBeetle and DuckDB do.

## Decision status

- **Not ADR'd.** Open an ADR before adopting Valkey, and decide the role explicitly (socket fan-out
  vs cache vs rate-limit/session store) — pub/sub vs Streams is the load-bearing choice for the
  socket layer. Until then it is candidate infrastructure, not part of the stack.

Cross-refs: [[SPIKE-009]] · [[ADR-0006]]
