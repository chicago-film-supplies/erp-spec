# Spike harness

Measurement code. **Not spec, and not the target system.** It implements nothing that will ship; it
exists so a claim made elsewhere in this repo can be re-run instead of believed. Same category as
`tools/`.

Two kinds live here, and the second arrived later:

- **Stack probes** — SPIKE-001, SPIKE-007, SPIKE-010: does a native npm dependency load and keep
  working under Deno, across `deno run`, `deno test` and `deno compile`? Everything below about the
  matrix, the staging directory and the compile entrypoints is about these.
- **Corpus measurements** — `allocation-basis-probe.ts` (`deno task allocation`), evidence for
  ADR-0031. Read-only `db_*` queries against the prod CFS API, aggregated locally; the token comes
  from `CFS_API_TOKEN` and is never in this repo. These need no `node_modules` and no staging.

The underscore prefix on this file keeps it out of `validate.ts`, which walks `spikes/` recursively
and requires front matter on every `.md` it finds.

## Why it exists

Three spikes asked the same question in three costumes: _does a native npm dependency load and keep
working under Deno, across `deno run`, `deno test` and `deno compile`?_ Three packages × three modes
is nine cells and not one had ever been filled in. Every statement in this repo about native addons
under Deno was a prediction, including several that turned out to be wrong.

## Running it

```
cd spikes/harness
deno install          # exact pins, see deno.json
deno task matrix      # the whole grid, ~4 min — prints markdown
```

Individual probes:

```
deno task napi        # all three, one process
deno task napi-test   # the `deno test` leg
deno task tb          # SPIKE-001 — needs a local TigerBeetle, see below
deno task duckdb      # SPIKE-007 server-side leg
deno task valkey      # SPIKE-010 — needs a local Valkey, see below
```

## Two things about the design that are not obvious

**Every probe asserts a value, never an absence of throw.** A module that imports and then hands
back a truncated integer is the failure mode that matters, and it passes any "does it load" check.
So the TigerBeetle probe asserts a u128 does not fit in a u64, and the DuckDB probe asserts a
HUGEINT round-trips exactly rather than arriving as a float.

**Each package gets its own compile entrypoint** (`entry-*.ts`, importing `probe-*.ts` directly and
never `napi-probe.ts`). `deno compile` embeds every statically-reachable literal `import()`, so a
shared entrypoint puts all three dependency trees in every binary: measured before the split, all
three binaries came out at an identical 364 MB and every `--bundle` cell failed on BullMQ's optional
`pg` peer, masking the DuckDB question entirely.

## The staging directory, and the trap that forced it

`matrix.ts` copies its sources to a temp dir **outside `$HOME`** and runs everything from there.

Deno's node resolution walks up from the importing file. BullMQ v6 ships a Postgres backend that
lazily `require('pg')`; esbuild follows that eagerly under `--bundle` and, run from a path nested
under a home directory containing an unrelated `~/node_modules/pg`, resolved it there and failed
with `Import "pgpass" not a dependency and not in import map`. Staged under `/var/folders` the same
cell compiles and passes.

That was very nearly written down as "BullMQ cannot be bundled". It is a property of the machine,
not of BullMQ. A harness whose results depend on what else is installed in the home directory is not
a measurement, so the staging is load-bearing rather than tidiness.

## Versions this was measured against

|                       | version        | note                                                              |
| --------------------- | -------------- | ----------------------------------------------------------------- |
| Deno                  | 2.9.2          | `aarch64-apple-darwin`                                            |
| `tigerbeetle-node`    | 0.17.9         | client and server ship in lockstep — pin both                     |
| TigerBeetle server    | 0.17.9         | `tigerbeetle-universal-macos.zip` release asset, no container     |
| `@duckdb/node-api`    | 1.5.5-r.3      | DuckDB v1.5.5                                                     |
| `@duckdb/duckdb-wasm` | 1.33.1-dev57.0 |                                                                   |
| `bullmq`              | 6.0.9          |                                                                   |
| `ioredis`             | 6.0.0          |                                                                   |
| `msgpackr`            | 2.0.5          | transitive via bullmq; pinned so the probe can import it directly |
| `mongodb`             | 6.20.0         | SPIKE-006 and SPIKE-009; must track `core/deno.json`              |
| mongod                | 8.0.4          | macOS arm64 tarball; `--fork` is refused by 8.3.x                 |
| `solid-js`            | 1.9.12         | tracks `manager/package.json`; **browser build only** — see below |

`deno.lock` is gitignored repo-wide, so **`deno.json` is the lockfile** — every npm specifier is an
exact version, never a caret range.

⚠️ **`solid-js` is pinned as an esm.sh URL carrying `?target=es2022`, and that is not cosmetic.**
Solid ships a reactive browser build and a non-reactive SSR build, and there are two independent
ways to get the SSR one under Deno: `npm:solid-js` honours an explicit `deno` export condition
pointing at `dist/server.js`, and esm.sh serves Deno the same build unless a browser target is
forced. In the SSR build **`createEffect` never runs**, so a reactivity test written the obvious way
measures nothing and reports success. Full account in SPIKE-009 criterion 1.

## This will rot, and that is fine

It pins six npm packages against one Deno version on one platform. Its value is reproducibility at
the _next_ Deno upgrade, not perpetual green: when Deno 2.10 lands, re-run `deno task matrix` and
diff the table. Nothing in CI runs it, deliberately — a spike harness that gates the build would
make an upstream change break an unrelated push.

macOS results do not transfer to Linux. TigerBeetle upstream supports Linux ≥5.6 for production and
treats macOS as a development configuration; storage behaviour on the deployment target is
SPIKE-011's job, not this one's.

## Local servers

TigerBeetle (no container — a macOS universal binary is a release asset):

```
curl -Lo .data/tb.zip https://github.com/tigerbeetle/tigerbeetle/releases/download/0.17.9/tigerbeetle-universal-macos.zip
unzip -o .data/tb.zip -d .data
.data/tigerbeetle format --cluster=0 --replica=0 --replica-count=1 --development .data/0_0.tigerbeetle
.data/tigerbeetle start --addresses=3000 --development .data/0_0.tigerbeetle
```

⚠️ **`--development` changes a documented constant by 32×, and nothing here said so until
2026-08-18.** `createTransfers` caps at **253** events on a `--development` cluster, against the
**8189** the docs state for the default configuration — measured both ways by SPIKE-003, which
stands up a second cluster on production defaults precisely so the number is not reported as a
TigerBeetle fact. The ceiling throws **client-side** as `ERR_TOO_MUCH_DATA` rather than returning a
per-event status, so a batcher that catches per-event statuses sees an exception instead of a
rejection.

⇒ **Every TigerBeetle measurement in this repo before that date was taken on `--development`.**
SPIKE-001's checks all sit well under 253, so none is invalidated — but treat any throughput or
batch-size number from this harness as a dev-config number, and re-confirm on the deployment target
(SPIKE-011). `deno task tb-import` formats its own clusters and does not use the one above.

Valkey (`brew install valkey`):

```
valkey-server --port 6399 --dir .data --appendonly yes --appendfsync everysec
```

### SPIKE-009 — change streams need a REPLICA SET, not the standalone above

`deno task change-stream` (criterion 2) and `deno task slice` (criterion 1). Change streams read the
oplog and a standalone `mongod` has none, so `SPIKE-002`'s server cannot be reused — a separate
dbpath and port, left as a replica set:

```sh
mkdir -p .data/mongo-cs
.data/mongodb-macos-aarch64-8.0.4/bin/mongod --dbpath .data/mongo-cs --port 27079 \
  --bind_ip 127.0.0.1 --replSet rs0 --oplogSize 1 --fork --logpath .data/mongod-cs.log
```

Then initiate it once — the server tarball ships **no `mongosh`**, so it goes through the driver:
`db.admin().command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27079" }] } })`
against `mongodb://127.0.0.1:27079/?directConnection=true`, then poll `hello` until
`isWritablePrimary`.

⚠️ **`--oplogSize 1` does not produce a 1 MB oplog** — measured retention was **104x** the
configured cap, because WiredTiger truncates in markers with a large minimum size that a 1 MB oplog
cannot divide into. It is set small anyway because it makes the retention finding fast to reproduce,
not because it bounds anything. Full numbers in the spike.

⚠️ The probe **wipes and reseeds** `spike009.*` on every run and writes ~100 MB into the oplog. Run
it against this server only.

### SPIKE-002 — the two-store crash harness needs BOTH stores

`deno task two-store`. There is no container runtime on the dev machines, so both servers run
directly from `.data/`:

```sh
# mongod — 8.0.x, because --fork is refused by 8.3.x on macOS (see mongo-schema-probe.ts)
curl -Lo .data/mongo.tgz https://fastdl.mongodb.org/osx/mongodb-macos-arm64-8.0.4.tgz
tar xzf .data/mongo.tgz -C .data
mkdir -p .data/mongo-2sc
.data/mongodb-macos-aarch64-8.0.4/bin/mongod --dbpath .data/mongo-2sc --port 27078 --bind_ip 127.0.0.1

# a SEPARATE TigerBeetle cluster from `deno task tb`'s, so a crash case cannot corrupt SPIKE-001's
.data/tigerbeetle format --cluster=0 --replica=0 --replica-count=1 --development .data/2sc.tigerbeetle
.data/tigerbeetle start --addresses=3044 --development .data/2sc.tigerbeetle
```

`.bin/` (compiled binaries) and `.data/` (cluster files, RDB/AOF, downloaded archives) are
gitignored.
