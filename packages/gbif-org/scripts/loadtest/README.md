# Mock-backed load testing for gbif-org

Run the real gbif-org SSR server locally against a **static mock** of the GBIF
backend, then hammer it with the load script. No real GBIF services are touched,
so you can measure the SSR server's throughput in isolation and then dig into
what the costly part is.

## Pieces

| File                         | What it is                                                              |
| ---------------------------- | ---------------------------------------------------------------------- |
| `../mockApi.mjs`             | Static mock: GraphQL + translations + header. Returns the same payload for every key. |
| `taxonExample.json`          | A real `TaxonKey` GraphQL response (`Panthera leo`, pulled from graphql.gbif.org) the mock serves. |
| `env.loadtest`               | `.env` pointing the site at the mock (`:4000`) and itself (`:3000`).    |
| `start.sh`                   | Copies the env, builds if needed, starts mock + SSR server together.    |
| `../loadTest.mjs`            | The load generator (`npm run loadtest`).                                |

## Quick start

From `packages/gbif-org`:

```bash
# 1. Build + start the mock and the SSR server (Ctrl-C stops both)
bash scripts/loadtest/start.sh

# 2. In another shell, generate load against the taxon page
npm run loadtest -- --target=http://localhost:3000 --path='/taxon/{key}' --rate=30
```

To keep the load test fully offline, also build the key pool from the mock
instead of the real species API:

```bash
npm run loadtest -- \
  --target=http://localhost:3000 \
  --path='/taxon/{key}' \
  --species-api=http://localhost:4000/v1 \
  --rate=30
```

(The mock ignores the key and returns the same `Panthera leo` page for every
`/taxon/...` request, so the pool's exact keys don't matter — we're measuring
SSR throughput, not data.)

## Doing it by hand

```bash
cp scripts/loadtest/env.loadtest .env
npm run build                       # client + server bundles
PORT=4000 node scripts/mockApi.mjs &        # mock backend
NODE_ENV=production PORT=3000 node gbif/server.js &   # SSR server
curl -s http://localhost:3000/taxon/4CGXP | grep -o '<title>[^<]*</title>'
```

## Why the taxon page

`/taxon/:key` does exactly one GraphQL query at SSR time (`TaxonKey`); the
heavier `SlowTaxon` query is client-side only. That keeps the mock simple while
still exercising the full SSR pipeline: Express middleware, React
`renderToString` of the whole layout + page, Helmet head, and template
injection.

The legacy `/species/:key` page is also mocked (it renders the "unknown taxon"
view without redirecting), but it's a thinner page, so `/taxon/{key}` is the
better SSR target.

## Diagnosing the costly part

Once it's under load and you see where it strains (rising p99, climbing
inflight, `actual` rps dropping below target), narrow it down:

- **SSR render cost vs data fetch** — the mock responds instantly, so any
  latency you see is the SSR server itself (React render + Express). Compare
  `/taxon/{key}` against a trivial route to isolate render cost.
- **CPU profile the server** — start it with
  `NODE_ENV=production node --prof gbif/server.js`, run the load, stop, then
  `node --prof-process isolate-*.log` to see where CPU goes (almost always
  `renderToString`).
- **Add mock latency** — if you want to simulate a slow backend, add a
  `setTimeout` before the GraphQL response in `mockApi.mjs` to see how the SSR
  server behaves when upstream is slow (connection pile-up, event-loop lag).
