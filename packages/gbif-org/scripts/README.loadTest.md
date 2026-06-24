# Site load generator (`loadTest.mjs`)

A small, dependency-free Node script that imitates load on the gbif.org site (or
a hosted portal / staging / local instance) by repeatedly requesting taxon
(species) pages.

It works in two phases:

1. **Build a key pool** — pages the GBIF species _search_ API at random offsets
   to collect a varied set of taxon keys.
2. **Generate traffic** — requests `/<target>/species/{key}` for a random key
   from the pool at a steady, configurable rate (default **30 req/s**), and keeps
   going until you stop it with `Ctrl-C`.

It only issues `GET` requests and writes nothing. Live stats (throughput,
latency p50/p90/p99, status-code distribution, in-flight count) are printed every
few seconds so you can watch what happens.

## Run it

```bash
cd packages/gbif-org

# defaults: target https://www.gbif.org, 30 req/s, until stopped
node scripts/loadTest.mjs

# or via the npm script
npm run loadtest

# point at a staging / local build and change the rate
TARGET=http://localhost:3000 RATE=10 node scripts/loadTest.mjs
node scripts/loadTest.mjs --target=https://hp-staging.gbif.org --rate=50
```

> Note: `https://www.gbif.org` sits behind bot protection that may reject
> automated traffic with `403`. For real load testing point `--target` at an
> instance you control (local `npm run start`, a staging deployment, or a hosted
> portal), and coordinate with ops first.

## Options

Every option is a CLI flag or an env var (CLI wins):

| CLI flag         | Env var          | Default                     | Meaning                                                        |
| ---------------- | ---------------- | --------------------------- | -------------------------------------------------------------- |
| `--target`       | `TARGET`         | `https://www.gbif.org`      | Base URL of the site under test.                               |
| `--rate`         | `RATE`           | `30`                        | Requests per second.                                           |
| `--path`         | `PATH_TEMPLATE`  | `/species/{key}`            | Page path; `{key}` is replaced by a taxon key.                 |
| `--pool-size`    | `POOL_SIZE`      | `1000`                      | How many taxon keys to gather up front.                        |
| `--species-api`  | `SPECIES_API`    | `https://api.gbif.org/v1`   | GBIF species search API used to build the pool.                |
| `--search`       | `SEARCH_PARAMS`  | `status=ACCEPTED`           | Extra query string for the species search pool.               |
| `--timeout`      | `TIMEOUT_MS`     | `30000`                     | Per-request timeout (ms).                                      |
| `--max-inflight` | `MAX_INFLIGHT`   | `0` (unlimited)             | Cap on concurrent requests; extras are skipped and counted.    |
| `--report`       | `REPORT_MS`      | `5000`                      | Stats print interval (ms).                                     |
| `--duration`     | `DURATION_S`     | `0` (until stopped)         | Auto-stop after N seconds.                                     |

## Reading the output

```
[10s] target≈30/s actual≈28.4/s | sent=300 done=295 ok=295 fail=0 | inflight=5 (max 11) | latency ms p50=120 p90=310 p99=850 avg=160
      status: 200=295
```

- **actual vs target** — if `actual` drops well below `target`, the server can't
  keep up at the requested rate.
- **inflight** climbing steadily is the clearest backpressure signal: requests
  are arriving faster than they complete.
- **latency p99 / status** — rising p99, or `5xx` / `timeout` entries appearing,
  show where it starts to hurt.

## Diagnosing the costly part (next step)

Once the page route shows strain, narrow it down by re-pointing the same script
at narrower targets with `--path` / `--target`:

- Hit the GraphQL endpoint the page uses directly (e.g.
  `--target=https://graphql.gbif.org --path=/graphql?...`) to separate SSR cost
  from data-fetch cost.
- Try other detail pages (`/occurrence/{key}`, `/dataset/{key}`) to see whether
  the cost is species-specific or general SSR.
- Lower `--rate` and raise `--pool-size` to rule out cache effects from a small
  key set.
