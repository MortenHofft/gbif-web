# gbif-org-ssr — a lean, mostly server-rendered GBIF.org variant

> Status: **proof-of-concept slice**. One vertical slice (dataset detail page) is built and
> verified end-to-end against the live GBIF API. This document captures the decisions and the
> evidence behind them so the approach can be reviewed before going wider.

## Motivation

The existing `gbif-org` app is React SSR and is comparatively heavy under load. The goal here is a
**leaner, simpler** variant: cheaper per request on the server, and far lighter on the client.

### What the profiling actually said (and why it shaped the design)

`packages/gbif-org/loadtest/PROFILE-FINDINGS.md` measured the current SSR under load (~190–200
req/s). The dominant costs were **not** the React render itself:

| Cost | ~% active CPU | Addressed here by |
|---|---:|---|
| react-router path matching (22× i18n route table) | ~26% | **Express routing** — no client router on detail pages |
| `react-dom` `renderToString` | 7.3% | **Preact** render (see benchmark below) |
| hydration payload + client bundle | large (client) | **No hydration**; islands only where needed |
| react-intl, helmet, response writes | ~13% | trimmed / native |

### Render benchmark (this repo, `scratchpad/bench/`, two stable samples each)

Identical component tree (~1,900 elements, **byte-identical 68 KB** output), per-core throughput:

| Engine | renders/sec | ms/render | vs React |
|---|---:|---:|---:|
| React 18 `renderToString` | ~180 | 5.5 | 1× |
| `hono/jsx` | ~620 | 1.6 | 3.4× |
| **`preact-render-to-string`** | **~1,970** | **0.5** | **10.9×** |

Preact is the fastest server-side renderer of the three **and** the lightest client runtime — so it
is used for both SSR and islands. (React `renderToString` really is slow on heavy pages; the
profile's 7.3% was an average over a lighter route mix.)

## Architecture

- **Server:** Express (already used across this monorepo; the original idea).
- **Render:** Preact — `preact-render-to-string` on the server, `preact` for client islands. One
  runtime, one mental model, isomorphic code.
- **Detail pages:** server-rendered, **zero client JS**. Navigation is plain links (a fresh render
  is ~0.5 ms, so no SPA router is needed).
- **Interactivity:** **islands** — a single shared Preact runtime, one bundle per island, loaded
  **only** on pages that use it. (No web components — those re-bundle the runtime per widget.)
  `htmx` is intentionally **not** a dependency yet; add it only if a server-driven partial swap is
  clearly simpler than an island.
- **Accessibility:** native-HTML-first (`<dialog>`, `<details>`, native form controls, `<label>`,
  `.sr-only`), Floating UI for positioning later, **Radix dropped** (≈40 of 59 current Radix sites
  are native-HTML/CSS replacements; the rest live only in search/filter islands).
- **Data:** an isomorphic `GraphQLService` (trimmed port of gbif-org's) + plain query strings.
  Client islands fetch via a **same-origin `/api/graphql` proxy** — no browser CORS, server-side
  cacheable. The `graphql-api` package is unchanged.

### The loading → transformation → presentation split (per page)

Each page is three decoupled layers (see `src/pages/dataset/`):

1. **`loader.ts`** — data loading only. Runs the GraphQL query, returns raw data or a
   `notFound`/`error` status. No formatting.
2. **`transform.ts`** — pure, testable logic. Raw GraphQL shape → view model (formatted dates,
   derived flags like `isChecklist`, label maps, light HTML sanitization). No presentation.
3. **`presentation/*.tsx`** — Preact components that render the view model verbatim. No fetching,
   no data massaging.

`routes.tsx` wires them: `loader → transform → presentation`, one handler per tab.

### Tabs as routes

Tabs are real URLs (`/dataset/:key`, `/dataset/:key/dashboard`), each a server-rendered page — same
model as the current site. The **Dashboard** tab's shell is server-rendered for instant paint; the
**charts** are a client island (`src/islands/dashboard-charts/`) that fetches facets in the browser
and is interactive (click a year bar → drill-down link). Charts are client-side precisely because
they need click interactivity.

## What's built & verified in this slice

- `/dataset/:key` (About) → **200**, real data, **0 `<script>`** (no client JS).
- `/dataset/:key/dashboard` → **200**, server shell + island (24 KB bundle, loaded only here).
- Nonexistent dataset → **404** (GBIF reports missing datasets as a 404 GraphQL error).
- Interactive island verified in headless Chromium: 12 bars from live data, "155,486,008
  occurrences total", clicking 2026 → "View 13,201,931 occurrences from 2026 →", `aria-pressed`
  toggles. Data flows through the same-origin `/api/graphql` proxy.

## Deliberately deferred (not yet done)

- **GraphQL GET-by-hash fast path** + fragment manager (port from gbif-org for edge caching).
- **Real sanitizer** (`isomorphic-dompurify`) in place of the regex stopgap in `transform.ts`.
- **i18n** (message loader is React-free in gbif-org and portable).
- **Theme**: lift gbif-org's Tailwind theme (colors/fonts) into `tailwind.config.js`.
- **codegen** types (currently hand-written in `query.ts`).
- The accessible-widget residue for search/filter islands (Floating UI / Zag, decided when we
  build occurrence search).
- Malformed (non-UUID) keys currently return 502; map to 400/404.

## Run it

```bash
cd packages/gbif-org-ssr
npm install
npm run build      # builds island bundles + Tailwind CSS
npm run dev        # server + island watch + css watch (http://localhost:3100)
# or: npm start    # production-style (NODE_ENV=production)
```

Defaults to the public `https://graphql.gbif.org/graphql`; override with `PUBLIC_GRAPHQL_ENDPOINT`.
