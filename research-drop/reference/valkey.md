# Valkey

In-memory store (queues / cache / pub-sub / streams) — the BSD-licensed, Linux-Foundation fork of
Redis, protocol-compatible with it. **Adopted for job queues by [[ADR-0012]]** (proposed,
2026-08-09). Its other roles, including the socket / real-time layer that replaces Firestore
listeners ([[SPIKE-009]]), are still undecided — see _Decision status_.

## Canonical docs

- Docs: <https://valkey.io/topics/>
- Commands: <https://valkey.io/commands/>
- Migration from Redis: <https://valkey.io/topics/migration/>
- Source: <https://github.com/valkey-io/valkey>
- **No `llms.txt`** as of 2026-08-09 (404); this note is the curated substitute. Because Valkey
  speaks the Redis wire protocol (RESP), Redis's own docs and client libraries apply almost
  verbatim.

## Version (checked 2026-08-09)

- Valkey `9.1.1` (released 2026-07-21). Prior lines `8.1.x`, `7.2.x` still supported.

## CFS-specific gotchas

- **In-memory, never a source of truth.** Anything in Valkey must be rebuildable from Mongo / TB /
  Parquet — same discipline as the `.duckdb` cache ([[ADR-0017]]). It may never hold the ledger or
  be treated as balance truth.
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

Roles are adopted **one at a time**, each by its own decision:

| Role                               | Status                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Job queues, replacing Cloud Tasks  | [[ADR-0012]] (proposed, 2026-08-09) · client risk **settled** by [[SPIKE-010]] |
| Socket / real-time fan-out         | **undecided** — [[SPIKE-009]]; pub/sub vs Streams is the load-bearing choice   |
| Cache · rate-limit · session store | **undecided**                                                                  |

An adopted role does not adopt the others. ADR-0012 deliberately does not settle pub/sub vs Streams,
because that choice belongs to the socket layer.

## Queue client — settled 2026-08-09

[[SPIKE-010]] is closed. `bullmq@6.0.9` + `ioredis@6.0.0` drive a real Valkey 9.1.1 from Deno under
`deno run` and `deno compile --self-extracting`, and the queue path is the **only** one of the three
npm dependencies that also survives `--bundle`, because it carries no native code.

- **Use ioredis, not `@valkey/valkey-glide`.** glide is a Rust N-API addon; it would re-import the
  `deno compile` native-addon problem ([[ADR-0023]]) into the queue path for no benefit.
- **Per-entity serialization needs no paid tier.** `SET NX PX` plus a compare-and-delete release is
  the whole mechanism, and it is measured allowing cross-entity concurrency rather than acting as a
  global cap. BullMQ **Pro** Groups (<https://docs.bullmq.io/bullmq-pro/groups/>) is the paid
  alternative and is not needed. GroupMQ was evaluated and rejected — last published 2025-11-26, 255
  days stale as of 2026-08-09.
- **BullMQ v6 ships a Postgres backend** with a lazy `require('pg')` behind an optional peer
  dependency. Nothing here uses it, but it is why a `--bundle` build resolves `pg` from whatever
  `node_modules` sits above the build directory.
- **A repeatable whose worker is down fires nothing and backfills nothing**, silently, while the
  scheduler record survives. Monitoring cannot be a queue-depth check — the queue is empty and
  healthy throughout. It has to be worker liveness plus a last-fired-at freshness check.
- **State the AOF setting**: `appendonly yes`, `appendfsync everysec`, `save ''`. Measured, Valkey
  accepted 150k–335k writes/s pipelined, so **order 10^5 acknowledged writes** can sit inside one
  unflushed fsync window. "About a second" is tens of thousands of jobs — which is the argument for
  ADR-0012's reconciliation sweeper, not against `everysec`.

Cross-refs: [[ADR-0012]] · [[ADR-0023]] · [[SPIKE-009]] · [[SPIKE-010]]
