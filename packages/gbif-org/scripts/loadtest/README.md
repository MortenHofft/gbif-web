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

## Isolating layout vs page cost (the `/loadtest-shell` route)

Set `PUBLIC_LOADTEST_SHELL=true` (already in `env.loadtest`) to enable a
`/loadtest-shell` route that renders **only the layout shell** - the real header
menu and footer - with a trivial `<div>` for page content and no page loader.
Compared against `/taxon/{key}`, it isolates the fixed layout render cost from
the per-page (query + content) cost.

```bash
npm run loadtest -- --target=http://localhost:3000 --path='/loadtest-shell' \
    --species-api=http://localhost:4000/v1 --max-inflight=8 --rate=1000 --duration=10
```

Measured on a 4-core box, single Node server process (closed-loop, concurrency 8):

| Route             | Throughput | Notes                                   |
| ----------------- | ---------- | --------------------------------------- |
| `/loadtest-shell` | ~82 req/s  | header menu + footer only               |
| `/taxon/{key}`    | ~42 req/s  | shell + taxon query + full content      |

And varying concurrency on the shell route (1 / 4 / 8) moved throughput only
~61 → 85 → 91 req/s - **not** 4-8x. Conclusions:

- The render is **single-threaded and CPU-serialised**: `renderToString` runs
  synchronously on one thread, so one Node process renders one page at a time
  and the other cores sit idle. That is why a single process tops out ~45/s
  however much concurrency you throw at it.
- The **layout shell is about half the per-request cost** - it caps ~82/s on its
  own. So the slowness isn't unique to the taxon page; rendering the header/footer
  tree (plus per-request route matching) is a fixed tax on every page, and the
  taxon content roughly doubles it. (See the measured breakdown below - the cost
  is `renderToString` + react-router matching, *not* react-intl.)

### Where the per-request time actually goes (measured)

Instrumenting `entry.server.tsx` (time `matchRoutes` and `renderToString`
separately) and CPU-profiling the shell route gave the synchronous-CPU split per
request - this is the part that serialises and caps throughput:

| Phase                    | Shell    | Taxon     |
| ------------------------ | -------- | --------- |
| `matchRoutes` (pure)     | ~1.8 ms  | ~1.3 ms   |
| `renderToString`         | ~5.2 ms  | ~10.5 ms  |

(The async `query` phase is mostly I/O wait + event-loop contention under load,
not CPU.) Bucketing JS self-time from `--prof`:

- `renderToString` machinery (jsx-runtime element creation + react-dom-server +
  react core) ≈ **the largest chunk**; the taxon content roughly doubles it.
- **react-router matching** (`matchRoutes` → `flattenRoutes` + `compilePath`
  regexes) ≈ **~a third of JS execution** and ~1.3-1.8 ms wall per request.
  `@remix-run/router@1.11` re-flattens the whole route tree and re-compiles every
  path regex on **every** request with **no cache**, over a ~116-route table that
  never changes (verified: `matchRoutes` calls `flattenRoutes`/`compilePath` per
  call). A micro-benchmark put cold matching at ~0.5 ms/call vs ~free memoised.
- **react-intl / FormatJS** ≈ only **~4%** of JS execution. It is *not* the
  bottleneck (despite the heavy `FormattedMessage` usage), so message-AST
  precompilation would be low ROI here.

What this points at, in ROI order:

- **Scale out across cores** - run ~one server process per core (cluster / PM2 /
  multiple containers). Biggest win; should ~4x throughput on this box.
- **Memoise route matching** - cache `matchRoutes` by pathname (routes are static
  at SSR). Removes the ~1.3-1.8 ms/request route-matching tax for free; the
  clearest code-level win.
- **Trim the rendered tree** - `renderToString` of the component tree is the
  dominant inherent cost; cache full HTML for hot pages (the server already emits
  `Cache-Control`) and/or reduce shell component count.
- react-intl is a red herring here - don't start with AST precompilation.

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
