# Formal specs

Two protocols are specified in TLA+ because their failure modes are interleavings, and
interleavings are not reachable by testing.

| Spec | Question |
|---|---|
| `two-store-commit.tla` | Can a MongoDB write and a TigerBeetle posting disagree across crash and retry? |
| `period-close.tla` | Can a posting land in a closed period? |

## Status

Both are **stubs**. Init/Next/invariant skeletons only — they do not yet model anything real.
Filling them is `m5`, and `m5` is not met by writing them: the exit criterion is that they have
been **run**, with model-checker output recorded.

## Running

TLA+ tooling is not vendored here. Use the TLA+ Toolbox or `tla2tools.jar`:

```
java -cp tla2tools.jar tlc2.TLC -workers auto formal/two-store-commit.tla
```

A spec that has never been model-checked is prose with angle brackets.
