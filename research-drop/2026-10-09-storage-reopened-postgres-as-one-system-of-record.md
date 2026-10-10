---
kind: session
date: 2026-10-09
surface: claude-code
topics: [ledger, availability, fulfillment, ordering, billing]
status: ingested
ingested_at: 2026-10-09
---

<!--
Transcript record, not a bullet drop. Captured by hand into
inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md
rather than by `deno task ingest`, so status is set to ingested to keep ingest from splitting
this file's bullets into inbox notes. Exported from Claude Code session
0de887c4-2e6c-41cc-a036-5aad627af646: owner messages and Claude's replies verbatim; tool calls
reduced to one-line summaries; tool output, reasoning and system context omitted. Prod figures
quoted were read the same day from VictoriaMetrics / VictoriaTraces (prod) and the erp-spec ADRs.
-->

# Session transcript — storage model reopened (2026-10-09)

### Owner

speculative convo about erp-spec v2, dont write anything. consider for a moment for reopening most
past decisions, look at the api and core today. consider a storage model for a linode setup. what do
you recommend? live/real time data streaming to clients remains a requirement. as does real time
accurate stock availability. im vaguely interested in celld. i think i like duckdb. i want a
replayable (ideally immutable) event store anything inventory, custody or money related. i liked
tigerbeetle and am afraid were forcing it. im a little concerned about the multiple storage sites. i
prefer open source to vendor lock in

> _tool — Bash: List erp-spec ADRs and their headlines_

> _tool — Bash: Read storage and client-transport ADRs_

> _tool — Bash: Read reservations, duckdb and sweeper ADRs_

> _tool — Bash: Skim more ADRs and spike list_

> _tool — Bash: Skim realtime, TB storage, two-store spikes_

> _tool — Bash: Read realtime spike header and API size_

### Claude

I read through the erp-spec ADRs (0003, 0012, 0015, 0024, 0042, 0047), the realtime spike and the
scale figures. Here's my view.

## Recommendation: PostgreSQL as the one system of record, DuckDB as a derived read side, and drop TigerBeetle, MongoDB and Valkey

### The fact that drives it: CFS is small

ADR-0024 measured 999 invoices and about 15k ledger postings for all of CFS history. Every argument
for specialised stores is about throughput, and you don't have that problem. What you do have is the
cost of running several stores and keeping them consistent. The spec already shows that cost:

- **Writes span two stores.** ADR-0003 says itself that it accepts a mandatory two-store commit.
  That one choice led to SPIKE-002, a formal model, ADR-0042 (a sweeper process, intent records, a
  T_claim/T_resolve time limit with an alert), and orphaned pending transfers as a failure mode you
  have to monitor.
- **The ledger schema keeps getting re-decided.** ADR-0008 and ADR-0018 were superseded and ADR-0035
  was rejected before ADR-0036 settled. That's TigerBeetle's fixed 128-byte transfer format fighting
  your need for dimensions.
- **HOT-005:** TigerBeetle's timestamp is when a transfer was posted, not the accounting date.
- **TigerBeetle doesn't answer the hard stock question.** ADR-0015 says it can't prevent
  double-booking a future date. Interval maths does that, and it still lives in the app.

So yes, I think you're forcing TigerBeetle. What you like about it is that history can't be changed,
double-entry is enforced, partial writes can't happen, and "can't go negative" holds. You can get
all of that in Postgres **inside the same transaction as the document write**, and that's the real
gain.

### What Postgres would hold

| Concern                                                                            | How                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders, invoices, fulfillments                                                     | JSONB holding the whole items tree, with generated columns for the fields you index. ADR-0003 rejected Postgres because "the document shape fights relational modelling", but JSONB means you never normalise the items. Zod stays the schema authority.                                                                                                                                                                  |
| Immutable event store (inventory, custody, money)                                  | Append-only tables. Writes are granted INSERT only, and a trigger rejects UPDATE/DELETE. Each stream gets a sequence number and an optional hash chain. Corrections are reversing events, never edits.                                                                                                                                                                                                                    |
| Double-entry                                                                       | A deferred constraint trigger checks that each journal entry sums to zero at commit.                                                                                                                                                                                                                                                                                                                                      |
| "Can't go negative" (what TigerBeetle's `debits_must_not_exceed_credits` gave you) | A balance row per account, updated in the same transaction, with `CHECK (balance >= 0)` on custody accounts only. Leave stock _availability_ unconstrained, because negatives there are the operator's shortage signal.                                                                                                                                                                                                   |
| Two-phase reservations                                                             | Pending/posted/voided are just event types. There's no timeout, so the ADR-0042 sweeper has nothing to resolve.                                                                                                                                                                                                                                                                                                           |
| Real-time stock availability                                                       | Keep the v1 engine (`core/src/utils/stock.ts`) and the `stock/{product}` projection contract as they are. Update the projection in the same transaction as the booking event. Lock the product's stock row (`SELECT … FOR UPDATE`) to serialise writes per product, as the `stock-locks` token does today. The oversell gate becomes a check inside that transaction, which also closes api-cloudrun#521 by construction. |
| Queues                                                                             | `SKIP LOCKED` job tables plus advisory locks keyed by entity, enqueued in the same transaction as the write, which gives you a transactional outbox for free. ADR-0012's reasoning (the hazards are artifacts of HTTP delivery, and the real need is per-entity serialisation) holds. It just doesn't need Valkey.                                                                                                        |
| Search                                                                             | `pg_trgm` and full-text search are probably enough at this size, so Typesense becomes optional.                                                                                                                                                                                                                                                                                                                           |

You'd go from Mongo + TigerBeetle + Valkey + Parquet (+ Typesense) to **Postgres plus Parquet files
you can rebuild from it.**

### Live streaming to clients

- **Feed:** logical decoding (pgoutput/wal2json) drives your WebSocket/SSE fanout. The WAL position
  is the resume token, so ADR-0047's D1 (client keeps the resume token) and D2 (silent full resync)
  carry over almost unchanged.
- **Trap:** don't use a `bigserial` column as the resume cursor. Sequence values are handed out
  before commit, so a reader can skip a row that commits late. Use logical decoding, or a cursor
  ordered by commit.
- **Something to evaluate:** ElectricSQL (Apache-2.0) does Postgres → client partial sync ("shapes")
  and might replace a hand-rolled layer. Its auth sits in a proxy you write, which is the same
  re-implementation of Firestore rules that SPIKE-009 already costed.

### DuckDB

I'd keep it, but only for reporting. It has a single writer and no change feed, so it can't be the
system of record or the live source. Good fits:

- sealed-period Parquet (ADR-0017/0024 hold unchanged);
- ad-hoc analytics, where DuckDB's `postgres` extension can scan the live database directly at your
  size.

### Running it on Linode

- One primary on a dedicated NVMe Linode, plus a streaming replica on another host (ideally another
  region).
- pgBackRest writing WAL archives to Linode Object Storage, so you can restore to any point in time.
- Run a scheduled audit that replays the events and diffs the result against the projections. You
  already want that (api-cloudrun#1255, `foldJournal`), and it's your defence against the cases
  below.
- Linode/Akamai also sells managed Postgres. Lock-in is low because it's plain Postgres, and it
  removes a lot of the self-hosting work. That's a real option for a small team.

### Costs and objections

- **The constraints aren't absolute.** A superuser or a careless migration can bypass Postgres
  constraints; nobody can bypass TigerBeetle's. Mitigations: separate database roles, no `UPDATE`
  grant on the event tables, the replay audit, and the hash chain. That's a weaker guarantee than
  TigerBeetle's, and in exchange the cross-store consistency problem goes away completely.
- **Per-product write locks** are fine at your write rate. They'd be a bottleneck at a scale you're
  not near.
- **Accepted ADRs have to be superseded.** ADR-0003, 0012, 0015 and 0042 would all be re-decided,
  and the Quint two-store-commit spec becomes moot. Of everything here, that's the cheapest thing to
  throw away.
- **Only three domains should be event-sourced.** Keep it to inventory, custody and money.
  Event-sourcing the order documents too would fight the three-way merge rule that keeps operator
  overrides. That rule fits better as a plain read-modify-write inside one transaction.
- **Event schemas will change.** Old events need versioned Zod schemas and upcasters to keep
  replaying. That's a cost of any event store.

### Alternatives I'd rule out

- **MongoDB on its own:** multi-document transactions exist, but you can't enforce a balance or
  zero-sum rule in the database, so the ledger rules end up in app code. That's the thing ADR-0003
  rightly refused to allow.
- **EventStoreDB/KurrentDB:** check the current licence before considering it, because I believe it
  moved away from OSI open source. It would also add a store rather than remove one.
- **Kafka/Redpanda:** far more than you need.

### celld

I don't know what that is. If you send a link, I'll look at whether it fits.

### If you want to test this before re-opening anything

A small spike would do it: port `stock.ts`, a posting table with the zero-sum and non-negative
constraints, and one logical-decoding feed into a SolidJS store. Then run the SPIKE-002 failure
cases against it and check they can't happen. A week or less would tell you whether the simpler
shape holds up.

### Owner

i kind of do have a throughput problem weve got some hefty transactions that take multiple seconds
to settle

> _tool — ToolSearch: select:mcp__victoriametrics-prod__query_

> _tool — query: topk(15, histogram_quantile(0.95, sum by (le, "http.route", "http.request.method")
> (rate({**name**="http.server.request.duration_bucket", "http.request.method"!="GET"}[30d]))))_

> _tool — query: sort_desc(histogram_quantile(0.95, sum by (le, "http.route", "http.request.method")
> (rate({**name**="http.server.request.duration_bucket",
> "http.request.method"=~"PUT|PATCH|POST|DELETE", "http.route"=_

> _tool — query: sum(increase({**name**="http.server.request.duration_count",
> "http.request.method"=~~"PUT|PATCH|POST|DELETE", "http.route"!~~"/tasks/._|/webhooks/._"}[30d]))_

> _tool — query: topk(8, sum by ("http.route","http.request.method")
> (increase({**name**="http.server.request.duration_count",
> "http.request.method"=~~"PUT|PATCH|POST|DELETE", "http.route"!~~"/tasks/._|/webhooks/._"}[30_

### Claude

Pulled 30 days of prod write latency. Checking one slow trace to see where the seconds actually go.

> _tool — ToolSearch: select:mcp__victoriatraces-prod__traces,mcp__victoriatraces-prod__trace_

> _tool — Bash: Find the API's trace service name_

> _tool — Bash: Read service name value and current time_

> _tool — traces: POST /orders_

> _tool — Bash: Summarize slow POST /orders trace spans_

### Claude

You do have a problem, but the prod numbers say it's latency rather than throughput, and that
difference decides which storage helps.

**Volume (prod, last 30 days)**

- `PUT /orders/:uid` was called about 1,078 times, roughly 36 a day. The other operator writes
  (fulfillments, transactions, invoices, products) are in the same range.
- Throughput is the number of transactions per second a store can absorb. Yours is a handful per
  minute at peak, so it isn't the constraint.

**Latency (p95, prod, last 30 days)**

| Route                             | p95   |
| --------------------------------- | ----- |
| `POST /orders`                    | ~4.1s |
| `PUT /fulfillments/bookings`      | ~3.3s |
| `PUT /fulfillments/:uid/bookings` | ~3.0s |
| `POST /transactions`              | ~2.4s |
| `PUT /orders/:uid`                | ~2.2s |
| `PUT /invoices/:uid`              | ~2.1s |

PDF, template and Xero routes sit at the 10s top bucket, but that's Gotenberg and Xero, not storage.

**Where the time goes: two slow `POST /orders` traces (3.3s each)**

- Each request made about 30–50 separate round trips to Firestore and other services:
  - `BatchGetDocuments` / `DocumentReference.Get` / `Query.Get`: about 1–2.3s
  - outbound `POST`s (14–20 of them): about 1–1.8s, some of which run inside the transaction
  - transaction reads and commit: a few hundred ms
- Each call costs 50–200ms because Firestore is a remote RPC from Cloud Run. Twenty sequential reads
  add up to seconds without any heavy work happening.
- `Transaction.Run` spans 1.8–2.7s while its own reads and commit account for only about 300–450ms.
  Overlapping outbound `POST`s explain part of the gap but not all of it. The rest is in-transaction
  CPU work (the stock engine, path computation) or a contention retry. I couldn't tell which from
  these two traces.

**What that means for the storage choice**

- **Postgres on the same Linode host or private network** brings a round trip down from about 100ms
  to about 0.1–0.5ms. The same 40-call shape takes tens of milliseconds, before any refactoring. Of
  the options on the table, this is the change that fixes "multiple seconds to settle".
- **TigerBeetle wouldn't fix it.** Its speed comes from batching thousands of transfers per request.
  A single operator save is maybe 5–20 postings, and the slow part is the document reads and writes
  around them, which would still go to Mongo. The two-store commit also adds a round trip and a
  failure mode to every money write.
- **Mongo on the same host** would also remove the network latency. It still leaves the two-store
  commit and the ledger rules in app code, so it doesn't change the earlier recommendation.

**Postgres doesn't fix everything**

- Per-product row locks serialise saves that touch the same product. A 3s transaction would hold
  those locks for 3s. Once round trips are sub-millisecond that's a non-issue. If the time is
  actually CPU (rebuilding a big stock interval set inside the transaction), it needs fixing
  whatever the store, for example by doing the computation before the transaction opens.
- The background trigger traffic is large. `/eventarc/mirror` handled about 9.0M requests in 30 days
  and `/eventarc/firestore` about 2.4M. That's the prod→dev mirror plus the trigger fan-out from
  writes. It doesn't slow operator saves directly, but in v2 that work should be in-transaction
  projections or a feed off the change log, not one HTTP call per document write.

**What I'd check next**

1. Pull 20–50 slow traces across those six routes and split them into network time, CPU time and
   retries. That tells you how much co-location alone buys.
2. Run the spike I suggested earlier with one real heavy order replayed through it, and measure the
   time for the whole save.

Both are read-only. I can do the trace breakdown now if you want; it takes one subagent.

### Owner

upside downside postgres vs mongo for my priorities? what is sqlite?

### Claude

## Postgres vs MongoDB, against your priorities

| Priority                                 | Postgres                                                                                                                                                                                                                                                  | MongoDB                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Immutable, replayable event store**    | Strong. Grant INSERT only on event tables, and a trigger rejects UPDATE/DELETE.                                                                                                                                                                           | Partial. A custom role can be limited to insert and find, but nothing can check across documents.                                                                             |
| **Double-entry and "can't go negative"** | Strong. Deferred constraint triggers enforce zero-sum at commit, `CHECK (balance >= 0)` covers custody, and SERIALIZABLE isolation is available.                                                                                                          | Weak. Validation is per document only, and the community edition has no triggers, so these rules live in app code. That was the reason ADR-0003 kept the ledger out of Mongo. |
| **Real-time accurate stock**             | Same transaction as the booking, with a per-product row lock, and the oversell check runs in the database.                                                                                                                                                | Possible with multi-document transactions, but you build the locking yourself, e.g. a version field plus retry, like Firestore today.                                         |
| **Live streaming to clients**            | Weaker out of the box. Logical decoding is lower-level: you run a replication slot and an output plugin. If the consumer stalls, the slot keeps WAL (the write-ahead log) and the disk fills. Debezium, ElectricSQL or a small custom consumer covers it. | **Mongo's clear win.** Change streams are per collection, filterable, come with resume tokens and pre/post images, and are already prototyped (SPIKE-009, ADR-0047).          |
| **Nested order/invoice documents**       | Fine with JSONB. Updating part of one is clumsier, and a write rewrites the whole row, which doesn't matter at your document sizes.                                                                                                                       | Native, and the most natural fit.                                                                                                                                             |
| **Fewer storage sites**                  | One store can hold documents, events, ledger, queues and basic search.                                                                                                                                                                                    | Still needs a separate ledger store (TigerBeetle or equivalent), so you keep the two-store commit.                                                                            |
| **Open source, no vendor lock-in**       | PostgreSQL licence (permissive, community-governed). Many compatible hosts and forks.                                                                                                                                                                     | SSPL, which isn't OSI-approved open source. Self-hosting is free, but one company controls it and there's no compatible fork ecosystem.                                       |
| **DuckDB reporting**                     | DuckDB's `postgres` extension reads it directly.                                                                                                                                                                                                          | No first-class path. You export to Parquet first.                                                                                                                             |
| **Ops on Linode**                        | Primary plus streaming replica, pgBackRest to object storage. A well-known setup.                                                                                                                                                                         | Transactions and change streams need a replica set: one node works, three for real failover. Also well known.                                                                 |

**Net:** Mongo wins on live streaming and on document fit. Postgres wins on everything else on your
list, especially the event store and money rules, which are the ones you said you care about most.
Live streaming is the one place Postgres costs you real engineering, and it's a one-time build.

## What SQLite is

SQLite is a database engine that runs as a library inside your application process. There's no
server, and the whole database is one file on disk. It's public domain and very widely deployed:
it's in every phone and browser. Deno ships it through `node:sqlite`.

**How it would fit CFS:**

- **Upsides**
  - **No network hop.** Queries are function calls taking microseconds, so the 40-round-trip saves
    from the traces cost nothing. That's lower latency than co-located Postgres.
  - **Simplest operationally.** It's just a file, and you back it up with Litestream, which streams
    the WAL to Linode Object Storage.
  - **Same constraint tools as Postgres:** CHECK constraints, triggers, transactions and JSON
    functions, so the event-store and ledger rules all work.
  - **Its main limit doesn't bite you.** SQLite allows one writer at a time. At about 36 order edits
    a day, that's fine.
  - **DuckDB can attach a SQLite file directly.**
- **Downsides**
  - **One machine, one process.** The API has to run on the box that holds the file. Several API
    instances or a separate worker host means LiteFS, rqlite or libSQL, which brings back moving
    parts.
  - **Weaker availability.** If the box dies, recovery is a restore from Litestream, which means
    minutes of downtime and possibly the last second or so of writes. Postgres with a hot standby
    fails over faster.
  - **No external change feed.** Its update hooks only fire inside the process. Since your app would
    be the only writer, the app can publish events after commit itself, which works. Anything that
    writes around the app, like a migration script or a manual fix, wouldn't be streamed.
  - **Thinner tooling** for roles, grants, online schema changes and monitoring. It has no user
    permissions at all, so "INSERT only" on event tables can only be enforced by triggers and code
    discipline, not grants.

**My take:** SQLite is a credible choice at your size, and it's the absolute minimum of moving
parts. I'd still pick Postgres for three reasons:

- a standby you can fail over to quickly,
- grants that actually enforce the immutability you want,
- room to run a second process (workers, a separate realtime fanout) without re-architecting.

If you'd accept a few minutes of downtime on a box failure and one process is fine, SQLite plus
Litestream would be the simpler of the two to run.

### Owner

tell me more about live streaming architecture for postgres and client side reads, take a look at
/manager read its data layer skill, most routes are live streaming one firestore doc that was
aseembled at write time (not read time)

> _tool — Bash: List manager skills_

> _tool — Bash: Read manager data-layer skill_

### Claude

I read manager's data-layer skill. The fact you pointed to makes Postgres streaming a lot easier
than my earlier answer implied.

## Why write-time assembly matters here

- The hard part of live queries is joins: knowing which subscriptions a change to row X affects when
  X feeds a view built from five tables. You've already removed that.
- Each `orders/{id}`, `stock/{product}` or fulfillment document is pre-assembled by the API in the
  write transaction. A client subscription is "this document" or "documents in this collection
  matching this simple filter".
- At about 36 order edits a day, brute force is correct and cheap. You don't need incremental view
  maintenance or a query engine in the gateway.
- **You probably don't need logical decoding at all.** Firestore never gave you ordering across
  documents, only per-document versions plus a full snapshot on resubscribe. Postgres can match that
  contract with `LISTEN/NOTIFY` plus a `version` column.

## The shape

```
API write tx ──► canonical rows / events (inventory, custody, money)
             └─► read_models (collection, id, version, body jsonb, …)   ← assembled here, same tx
             └─► NOTIFY 'rm', '{collection,id,version}'                 ← delivered only on commit

each API instance: one LISTEN connection ──► in-memory subscription index ──► WebSocket/SSE ──► client caches
```

**1. Read-model table**

- Either one `read_models` table (or one per collection) with `version` incremented on every write,
  or keep orders and invoices as their own JSONB tables. Either works.
- Keep the split: events for money, inventory and custody; mutable JSONB documents for orders,
  invoices and fulfillments (the three-way merge stays a read-modify-write); derived read models
  (`stock`, bookings, pick sheets) rebuilt in the same transaction.

**2. Doorbell: `NOTIFY` inside the transaction**

- Postgres delivers it only if the transaction commits, and in commit order. No outbox table or
  sweeper.
- Send only `{collection, id, version}`. The payload limit is 8KB, and the gateway reads the current
  body anyway.
- It isn't durable: a listener that's disconnected misses notifications. That's fine, because
  durability comes from the resume protocol (point 5), not the transport.

**3. Gateway, inside the API process**

- Keeps an index of document subscriptions keyed by `(collection, id)`, and query subscriptions
  keyed by `collection`.
- On a notification:
  - **Document subscriptions:** read the body once and push it to every subscriber.
  - **Query subscriptions:** re-run every query on that collection and diff against the set of ids
    last sent to each subscriber, giving enters, updates and leaves. Re-running is brute force, and
    at your write rate it costs nothing. It also handles paginated windows shifting and documents
    leaving a filter, which incremental approaches get wrong.
- With two or more API instances, each one LISTENs and fans out to its own sockets. You don't need
  Valkey pub/sub.

**4. Authorisation is server code now**

- Check permissions when a client subscribes, and on every push, since roles change and a document
  can move out of a user's scope.
- The gateway can also **project fields**, which Firestore rules couldn't (api-cloudrun#698).

**5. Resume**

- On reconnect the client sends the `(collection, id, version)` of each document it holds, and the
  server sends only newer ones. Query subscriptions re-run and diff.
- That's ADR-0047 D1 and D2, keyed per document instead of on a stream resume token. You can't fall
  off the end of an oplog because there isn't one.

**6. Client side: keep the primitives, swap the transport**

- `createEntityCache`, `createEntityListCache` and `createPaginatedFirestoreList` keep their API.
  Only the `onSnapshot` call underneath changes.
- `docRow`'s envelope-id rule is still worth keeping: the server sends `{id, version, body}` with
  the id kept separate from the body.
- `version` plus a 409 on conflict stays your optimistic lock, compared against the same number.
- `populateFromSnapshot`, peek-vs-`getEntity` and the listener ratchet all carry over. The listener
  ratchet would watch the transport call instead of `onSnapshot`.
- Peek gets cheaper. One socket multiplexes every subscription, so a per-row subscription costs one
  index entry rather than a Firestore listener.

## What you gain

- **Reports can be live.** The `/reports` exception exists because an aggregate isn't a document and
  Firestore has no `GROUP BY`. With a SQL gateway, a report becomes a server-side subscription: when
  an `invoices` notification arrives, recompute AR aging and push it. That's the same
  re-run-and-diff mechanism with the field-level permission check applied. The skill's ruling stays
  right for Firestore. It just stops being forced.
- **Pagination is exact.** `LIMIT/OFFSET` or keyset pages re-run on change, instead of Firestore's
  cursor rules.
- **Typesense may not be needed.** `pg_trgm` covers fuzzy lookup by name and number, and search
  results could become live subscriptions too, removing the sync-pulse machinery.

## Costs and pitfalls

- **You own the gateway.** Expect a few hundred lines: subscription index, query diffing, auth,
  resume and backpressure. Firestore did all of that for you, and reconnect storms and slow sockets
  become your bugs.
- **The LISTEN connection is special.** It can't go through PgBouncer in transaction mode, and it
  needs its own reconnect logic. A gateway that reconnects must treat every subscription as dirty
  and resync. A missed notification during the gap is the one real way to serve stale data, so that
  path needs a test.
- **`NOTIFY` doesn't scale far.** At commit it takes a global lock, which hurts at thousands of
  commits a second. Not a concern at your rate, but it's why bigger systems use logical decoding.
- **Query subscriptions have to be a closed vocabulary.** Allow equality, `in`, range, order-by and
  limit on declared fields, matching what Firestore allowed. Accepting arbitrary SQL from clients is
  how this goes wrong.

## Off-the-shelf alternatives, if you don't want to own the gateway

|                                    | Fit                                                                                                                                                | Catch                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **ElectricSQL** (Apache-2.0)       | "Shapes" are a table plus a WHERE clause, served over HTTP and fed from a replication slot. One pre-assembled document per shape is a natural fit. | It's another service holding its own state. Auth goes through a proxy you write. It has no aggregates, so reports stay outside it. |
| **Supabase Realtime** (Apache-2.0) | Pushes row changes and enforces Postgres RLS (row-level security) rules on them.                                                                   | It's an Elixir service plus Supabase's conventions, so you'd adopt a platform to get one feature.                                  |
| **Zero (Rocicorp)**                | Rich live queries with joins.                                                                                                                      | Maintains its own SQLite replica, which adds a storage site to solve a problem write-time assembly already removed.                |
| **Debezium → somewhere**           | A durable ordered change feed.                                                                                                                     | Usually needs Kafka. Far too much for this.                                                                                        |

**My recommendation: build it yourself.** Write-time assembly took away the problem these tools
exist to solve. What's left is auth and resume, and you'd write the auth part anyway, since every
one of these tools needs a proxy or an RLS policy you author.

## When to add logical decoding

Add a replication slot later only if you need a durable, ordered change feed for consumers other
than browsers, for example continuous Parquet export for DuckDB or an audit stream. Don't put it in
the client path. The client path's durability comes from per-document versions.

If you want to test this, a spike would be: port `createEntityCache` onto a WebSocket transport
against one `read_models` table, with `NOTIFY` and the version-based resume. Then deliberately kill
the LISTEN connection mid-write and check that the client converges.

### Owner

typesense stays. how does this: durable, ordered change feed for consumers other than browsers, for
example continuous Parquet export for DuckDB or an audit strea. differ from an event store? change
feed / audit stream seams useful. i also still need a live replica for staging environment

> _tool — Bash: Read how today's prod-to-dev mirror resolves conflicts_

### Claude

Noted: Typesense stays. It's actually one of the consumers that motivates the change feed (below).

## Event store vs change feed

They sound similar but answer different questions.

|                        | **Event store**                                                                                 | **Change feed (CDC: change data capture, read from the WAL, Postgres's write-ahead log)**      |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| What it records        | **Why** something happened, in business terms: `UnitsCheckedOut{product, qty, fulfillment, by}` | **What** changed physically: "row `orders/123` went from A to B"                               |
| Who writes it          | Your code, deliberately, in the transaction                                                     | Postgres, automatically, for every committed write to the tables you publish                   |
| Role                   | **The source of truth.** State is derived by replaying it.                                      | **A derived output.** It reports changes to state that's stored elsewhere.                     |
| Coverage               | Only the domains you chose to event-source (inventory, custody, money)                          | Everything, including mutable orders and invoices, read models, masterfiles                    |
| Schema                 | Your versioned business vocabulary, stable for years                                            | Follows the table schema, so a migration changes its shape                                     |
| Retention              | Forever, by design                                                                              | However long the consumer keeps it. Postgres holds it only until the consumer acknowledges it. |
| Replaying it gives you | The same balances and stock, rebuilt from the facts                                             | A copy of the database's rows, not an explanation of them                                      |

**How they fit together:**

- The event tables are ordinary tables, so their inserts show up in the change feed too.
- The **event store** is what you **trust**.
- The **change feed** is how every change, events included, **reaches other systems** reliably and
  in commit order, without polling or a sweeper.

## The change feed in practice

```
Postgres (prod)
  └─ publication: chosen tables
       └─ replication slot ──► one feed consumer (Deno) ──┬─► Typesense upserts/deletes
                                                          ├─► Parquet appender → DuckDB
                                                          ├─► audit sink
                                                          └─► staging applier
```

**Durable and ordered**

- A replication slot holds WAL until the consumer confirms its position (the LSN), and changes
  arrive in commit order, grouped by transaction.
- If the consumer crashes, it resumes where it left off. Nothing is lost and nothing has to be
  reconciled.

**One consumer or several**

- Either one slot with a single process fanning out to every sink, or one slot per sink so a slow
  Parquet writer can't hold up Typesense.
- Either way, set `max_slot_wal_keep_size`. A dead consumer otherwise retains WAL until the disk
  fills and takes the primary down. That's the main operational risk of this design, and it needs an
  alert on slot lag.

**What each sink replaces**

- **Typesense:** about 2.4M `/eventarc/firestore` calls a month and the `/tasks/sync-typesense` task
  path become one ordered stream of upserts and deletes. The current sync-pulse becomes "the
  consumer has applied changes up to position N".
- **Parquet / DuckDB:** an always-current copy for reporting. Sealed-period Parquet (ADR-0017) can
  still be cut from it.

**The audit stream, and the gap it covers**

- Your mutable documents aren't event-sourced, so today nothing records who changed an order and
  from what to what. The change feed can, if you add one ingredient: **the actor**.
- In each API transaction, call
  `pg_logical_emit_message(true, 'ctx', '{actor, request_id, route}')`. It travels in the WAL inside
  the same transaction, so every row change arrives tagged with who made it and which request it
  came from (which you can join to your traces).
- Turn on `REPLICA IDENTITY FULL` for the audited tables so the before-image (the old row) is
  included. That gives you a complete before/after history of every document, without event-sourcing
  them.

**Not for browsers.** Browsers stay on `NOTIFY` plus per-document versions. Their contract is
"converge to current", not "see every change in order", and putting them on the change feed would
make the browser path depend on a slot being healthy.

## Live staging replica

Today `devReplica.ts` makes dev a writable copy where prod wins:

- prod writes overwrite dev's documents,
- deletes are mirrored,
- a newer-wins guard stops an out-of-order event overwriting a fresher dev document,
- a skip list excludes some collections.

Of Postgres's built-in options, neither matches that:

- **A physical streaming replica** is an exact, live copy, but read-only, so staging can't write to
  it.
- **Native logical replication** (publish/subscribe) gives a writable subscriber, but it **stops
  replicating when a write conflicts**, e.g. staging inserted a row with the same key. DDL and
  sequences aren't replicated either. So a staging environment that writes would break the stream
  regularly.

**What I'd do instead: staging is another change-feed sink.** It's the current `devReplica`
behaviour, fed from the ordered stream instead of Eventarc:

1. **Seed:** restore staging from a prod pgBackRest backup, nightly or on demand. That gives you a
   consistent base, which the Firestore mirror never had.
2. **Tail:** the staging applier upserts prod's row images with prod-wins rules, applies deletes,
   keeps a skip list for secrets and sessions, and records the last position it applied. Ordering
   comes from the stream, so the newer-wins guard and its CAS-retry logic (`casReplaceDoc`) aren't
   needed.
3. **Event tables:** use **UUIDv7 ids**, so events written on staging can never collide with prod's.
   Insert with `ON CONFLICT DO NOTHING`.

**The one problem neither design can avoid:**

- Once staging writes its own events, its derived balances and `stock` drift from prod's, and the
  next prod upsert of a balance row overwrites them. A copy that's both live and writable is
  inconsistent by definition.
- Two ways to handle it:
  - **Replicate events only, and have staging rebuild its own projections.** Correct, but staging's
    rebuild code is then under test the whole time, which may be a feature.
  - **Accept prod-wins drift and re-seed whenever it matters.**
- Today's mirror has the same issue and silently picks the second option. In v2 you'd choose
  explicitly.

**Guards still matter.** Staging holds real data, so outbound email (Resend), Plaid and webhook
sends need the same project-level guard the Xero transport has today. That's an existing rule, not a
new one.

## Count of storage sites

- **Postgres** is the source of truth.
- **Typesense** and **Parquet** are derived sinks, rebuildable from the feed or a backfill.
- **Staging Postgres** is a seeded copy kept current by the feed.

That's one store you have to keep correct, plus three sinks you can rebuild. You don't need
TigerBeetle, Mongo or Valkey for this.

### Owner

is duck db still useful?

> _tool — Bash: Read ADR-0017 context for why DuckDB/Parquet_

### Claude

Not as the reporting engine. It was there to work around TigerBeetle, and that reason goes away with
TigerBeetle.

## Why DuckDB is in the spec

ADR-0017 gives the reason:

- TigerBeetle can't answer "the July trial balance". Its timestamps are posting time, and it can
  only filter by exact match, so it can't query a range of accounting dates.
- So some copy of the ledger in another engine was unavoidable. Sealed Parquet files queried by
  DuckDB were that copy.
- ADR-0017 also had to make **open periods report from the document store** while **closed periods
  report from Parquet**. That's two sources of truth for the same numbers, split by whether the
  period is closed.
- It says performance doesn't decide anything: about 15k postings in all history.

With the ledger in Postgres, both problems go away:

- `accounting_date` is an ordinary indexed column, so a trial balance for any period, open or
  closed, is one `GROUP BY` that runs in milliseconds against the same rows the ledger rules
  protect.
- One store answers every period, and the split authority disappears.

## Where DuckDB still helps

1. **Ad-hoc analysis away from prod.** The change-feed Parquet sink gives you, or a Claude session,
   a local copy to explore: margins, utilisation, cohort questions. That needs no prod credentials
   and puts no load on prod. This is the best remaining case, and it works with DuckDB as a CLI on a
   laptop, not part of the API.
2. **Joining outside data.** Xero history (ADR-0020's recast), Plaid exports and supplier CSVs can
   be queried in place alongside your data, without loading them into Postgres.
3. **Sealed-period artifacts.** A hashed Parquet snapshot of a closed period is a good thing to
   archive or hand to an accountant. But it's an export, not the reporting authority. "Figures for a
   closed period can't drift" can be enforced in Postgres: reject any posting dated in a closed
   period, and store a closing hash per period. The replay audit catches drift either way.

## What it costs if it stays in the API

- A native addon under Deno, which is why ADR-0023 (the self-extracting binary) exists.
- A second SQL dialect.
- A Parquet pipeline to maintain.
- A copy that lags the live ledger. The lag doesn't change the totals, but a report and a live
  screen can briefly disagree, and someone has to explain it.

## My recommendation

- **API reporting runs on Postgres.** If reports ever compete with operator writes, point them at
  the staging-style read replica or a dedicated physical replica.
- **DuckDB moves out of the runtime** and becomes a tool for analysis, reading the change-feed
  Parquet sink.
- **Sealed-period Parquet becomes an optional archive export**, not an authority.

**Spec impact:** ADR-0006 is already superseded. ADR-0017, ADR-0023 and ADR-0024 would need
re-deciding. The useful idea in ADR-0017, that a closed period can't change, survives as a database
rule.

### Owner

drop duck db keep parquets as change feed sinks

### Claude

Agreed: drop DuckDB and keep Parquet as change-feed sinks. If nothing in the runtime queries the
files, it's worth deciding what shape they take and what they're for.

## What shape the Parquet sink should be

The best fit is an **append-only change log**: one row per committed row change, with these columns:

- `lsn` (position in the WAL)
- `commit_ts`
- `table`
- `op` (insert, update or delete)
- `pk`
- `before` and `after` row images
- `actor` and `request_id`, taken from the logical message

Keep it as a change log rather than a mirror of current table state:

- Parquet files can't be updated in place. A sink that tries to keep "current state" ends up
  rewriting files and needs a table format such as Iceberg or Delta on top.
- A log is append-only, which suits Parquet.
- The log is also your **audit stream**. One sink does both jobs.

Layout:

- **Partitioning:** `table=orders/date=2026-10-09/part-<first_lsn>.parquet` in Linode Object
  Storage.
- **Rolling:** write a new file every N minutes or N rows.
- **Compaction:** a nightly job merges a day's small files into one.
- **Sealing:** once a day is compacted, hash it and record the hash. That gives you tamper evidence
  without an engine.

## Optional extra: periodic full snapshots

Add these only if someone wants "the state of the database at month-end" without replaying the log:

- a full dump of the chosen tables at month-end or at a period close;
- it gives you the sealed-period artifact for an accountant or archive.

## Who reads the files

Nothing in CFS will, so be clear about the purpose:

- **Archive, audit and recovery evidence:** history that doesn't depend on Postgres backups.
- **Analysis on demand:** Polars, pandas/pyarrow, DataFusion, ClickHouse-local, or DuckDB as a
  laptop CLI if you ever want it back. Choosing Parquet keeps all of those open without committing
  to any.

## Spec impact (not writing anything)

- **ADR-0017:** re-decide it. Postgres is the reporting authority for every period, and the rule
  that a closed period can't change is enforced in the database.
- **ADR-0023:** re-decide it, at least for the DuckDB half. TigerBeetle was the other native addon,
  so with both gone the reason for the self-extracting binary may go too.
- **ADR-0024:** superseded. The "no client-side reporting" half still holds, now as "reports are an
  API or gateway subscription".
- **Hotspots and contexts:** the reporting context and HOT-005 should be checked against the new
  authority.

These sit alongside the larger supersessions from earlier: ADR-0003, 0012, 0015 and 0042.

### Owner

you put an inbox note in erp-spec about this

> _tool — Bash: Read erp-spec inbox conventions and status_

> _tool — Bash: Read inbox template and an owner-note example_

> _tool — Bash: Check allowed inbox kinds and validate task_

> _tool — Write:
> erp-spec/inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md_

> _tool — Bash: Run erp-spec validation gates_

### Claude

Validation ran. Checking whether any warnings point at the new note.

> _tool — Bash: Check warnings for the new note and repo status_

### Claude

I've added the note:
[inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md](inbox/2026-10-09-owner-reopens-storage-postgres-as-the-one-system-of-record-and-duckdb-is-dropped.md).

It's `kind: owner` and keeps your statements separate from my analysis:

- **Your statements:** reopen storage, the requirements that still stand, the worry that TigerBeetle
  is being forced, Typesense stays, drop DuckDB but keep Parquet as change-feed sinks, a live
  staging replica is required, and celld left as an open question.
- **Analysis (labelled as not decided):** the case for Postgres with the prod latency figures and
  traces, the `NOTIFY` live-transport shape, the change feed and its sinks, the staging approach,
  and the ADRs that would need re-deciding.

`deno task validate` adds no warnings or failures for the new note. It does fail on one existing
problem: ADR-0028 is past its `review_by` date (2026-10-01).

**Choices for you:**

- **Commit:** the note is uncommitted and I haven't pushed anything. There's also an untracked inbox
  file from another session (`2026-10-06-finding-a-reimbursed-expense-claim…`). I'd leave that out
  of any commit unless you say otherwise. Want me to commit only mine?
- **Split:** the repo rule is one idea per file. I kept it as one note because everything follows
  from "Postgres as the one system of record". If triage would rather have separate notes (DuckDB
  drop, staging replica, live transport, change feed), I can add them as new files; the existing
  note can't be rewritten.

### Owner

one is fine, you can commit

> _tool — Bash: Commit only the new inbox note_

### Claude

I committed the note on `main` as `3fb3a23`. The commit contains only that file; the other session's
untracked inbox note is still uncommitted and untouched. I haven't pushed. Tell me when you want it
pushed.

### Owner

does it link to a record of this convo?

### Claude

No, it doesn't. Its `source:` only says it came from a speculative workspace session on 2026-10-09.
The trace and metric figures are dated, but there's no link to this conversation.

The transcript only exists locally, at
`~/.claude/projects/-Users-alexhughes312-cfs/0de887c4-2e6c-41cc-a036-5aad627af646.jsonl`. I didn't
cite that path on purpose: the workspace rule bans citing `~/.claude/...` paths from commits because
no other machine or cloud agent can open them.

To make it linkable, you could:

1. **Commit an export to `research-drop/`** and cite it from the note.
   - I'd export the transcript as markdown, strip tool noise, and check for PII or secrets (there
     shouldn't be any).
   - The note is committed but not pushed, so I could amend it to add the citation. That bends the
     append-only rule only in the sense that nobody else has seen the note yet.
   - If you'd rather not amend, the transcript can cite the note instead.
2. **Record only the session id** in the note's `source:`. It means something on this machine and
   nothing anywhere else, so I wouldn't bother.
3. **Leave it.** The note was written to stand alone, which is the inbox rule, and the figures can
   be re-measured.

I'd go with option 1, amending before the push. Want me to?

### Owner

yes

> _tool — Bash: Read research-drop conventions_

> _tool — Bash: Read research-drop format spec_

> _tool — Bash: Check how ingest treats research-drop files_

> _tool — Bash: Inspect transcript structure_

> _tool — Bash: Export transcript to markdown in scratchpad_
