# gbif-org-ssr

A lean, mostly **server-rendered** GBIF.org variant: **Express + Preact**, server-rendered detail
pages with **zero client JS**, and **islands** (Preact) only for the genuinely interactive parts.

See [`PLAN.md`](./PLAN.md) for the rationale, render benchmark, and roadmap.

## Quick start

```bash
npm install
npm run build      # island bundles (esbuild) + Tailwind CSS
npm run dev        # http://localhost:3100  (server + islands + css, all watched)
```

`npm start` runs it production-style. Point at a different GraphQL backend with
`PUBLIC_GRAPHQL_ENDPOINT` (defaults to the public `https://graphql.gbif.org/graphql`).

## Layout

```
src/
  server.tsx                  Express app: static, /api/graphql proxy, /dataset routes
  lib/
    config.ts                 endpoints / port / locale (env-overridable)
    graphql.ts                isomorphic GraphQL client (server + island)
    html.ts                   HTML document shell + island script wiring
  pages/dataset/
    query.ts                  GraphQL query + result types
    loader.ts                 DATA LOADING (no formatting)
    transform.ts              TRANSFORMATION + LOGIC (pure → view model)
    routes.tsx                wires loader → transform → presentation, one route per tab
    presentation/             Preact components (server-rendered)
  islands/
    mount.ts                  generic island bootstrapper (reads props, mounts Preact)
    dashboard-charts/         interactive charts island (fetches via /api/graphql, clickable)
scripts/build-islands.mjs     esbuild bundler for client islands (--watch for dev)
```

## Adding a page

1. `query.ts` (+ types) → `loader.ts` → `transform.ts` → `presentation/*.tsx`.
2. Wire a route in `routes.tsx` (or a new `pages/<entity>/routes.tsx` mounted in `server.tsx`).
3. Need interactivity? Add an island under `src/islands/<name>/`, register it in
   `scripts/build-islands.mjs`, render a `<div data-island="<name>">` placeholder, and pass it in
   the route's `islands: [{ name, props }]`.
