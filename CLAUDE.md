# CLAUDE.md

> **Branch `claude/gbif-server-rendered-plan-*`** — this file describes an in-progress
> **architecture migration**. It is specific to this branch and may not apply to `main`.

## What this branch is

An experiment to migrate GBIF.org to a **leaner, mostly server-rendered architecture**. The current
production app (`packages/gbif-org`) is a React SSR app that is comparatively heavy under load. This
branch builds a new sibling package, **`packages/gbif-org-ssr`**, that aims to be cheaper per request
on the server and far lighter on the client, while reusing the existing GraphQL data layer.

**Goal:** prove the new architecture page-by-page, then migrate onto it.

## The architecture (and why)

Decided from the existing load profile (`packages/gbif-org/loadtest/PROFILE-FINDINGS.md`) plus a
render benchmark on this branch. Full rationale + numbers: **`packages/gbif-org-ssr/PLAN.md`**.

- **Express** server (already used across this monorepo).
- **Preact** for rendering — `preact-render-to-string` on the server (benchmarked ~11× faster than
  React `renderToString`, ~3× faster than `hono/jsx`), `preact` for client islands. One runtime,
  isomorphic.
- **Detail pages: server-rendered, zero client JS.** Navigation is plain links (a fresh render is
  ~0.5 ms; no SPA router).
- **Islands** for interactivity only — one Preact bundle per island, loaded only on pages that use
  it. No whole-page hydration. (No web components — they re-bundle the runtime per widget.)
- **Tabs are real routes**, each a server-rendered page. A tab that needs rich interactivity (e.g.
  the dataset dashboard charts) renders a server shell + a client island that fetches its own data.
- **Accessibility: native-HTML-first** (`<dialog>`, `<details>`, native form controls); Radix
  dropped. Floating UI / a small accessible-widget lib reserved for the few rich search/filter
  widgets, decided when occurrence search is built.
- **Data:** an isomorphic `GraphQLService` (trimmed from `gbif-org`) + plain query strings. Client
  islands fetch through a **same-origin `/api/graphql` proxy** (no browser CORS; server-cacheable).
- **`htmx` is intentionally not a dependency yet** — add only if a server-driven partial swap is
  clearly simpler than an island.

## Repo layout

Monorepo (lerna). Relevant packages:

| Package | Role |
|---|---|
| `packages/gbif-org` | **Current** production app (React SSR). Reference + source of reusable, React-free pieces (GraphQLService, queries, i18n loader, Tailwind theme). Don't break it. |
| `packages/gbif-org-ssr` | **New** architecture (this branch's work). Express + Preact. |
| `packages/graphql-api` | GraphQL backend composing GBIF REST/Elasticsearch. Unchanged. |
| `packages/es-api` | Elasticsearch wrapper upstream of graphql-api. Unchanged. |
| `packages/react-components` | Legacy shared React components. Not used by the new package. |

## Working on `packages/gbif-org-ssr`

```bash
cd packages/gbif-org-ssr
npm install
npm run dev        # http://localhost:3100  (server + island watch + css watch)
npm run typecheck  # tsc --noEmit
npm run build      # island bundles + Tailwind CSS + dist/server.mjs (Vercel bundle)
npm start          # production-style long-running server
```

**Per-page structure** (the required split — keep these separated):

1. `pages/<entity>/loader.ts` — data loading only (GraphQL → raw / notFound / error).
2. `pages/<entity>/transform.ts` — pure logic, raw → view model (formatting, derived flags,
   sanitization). Unit-testable, no presentation.
3. `pages/<entity>/presentation/*.tsx` — Preact components that render the view model verbatim.
4. `pages/<entity>/routes.tsx` — wires loader → transform → presentation, one handler per route/tab.

**Adding an island:** create `src/islands/<name>/`, register it in `scripts/build-islands.mjs`,
render a `<div data-island="<name>">` placeholder in presentation, and pass
`islands: [{ name, props }]` from the route. The island fetches via `window.__GBIF__.graphqlEndpoint`
(the same-origin proxy) using the shared `lib/graphql.ts`.

## Deploy

- **Vercel** (serverless, for previews): app is exported via `api/index.js`; `vercel.json` rewrites
  all routes to it. Set Root Directory = `packages/gbif-org-ssr`. CI: `.github/workflows/gbif-org-ssr.yml`.
- **Node host** (Render/Fly/Railway, closer to production): `npm run build && npm start`.

## Status / next

Built & verified end-to-end against the live API: dataset detail page (About + Dashboard tabs),
client charts island, 404 handling, Vercel-bundle handler. See `PLAN.md` for the deferred list
(GET-by-hash GraphQL caching, dompurify, i18n, theme lift, codegen types, search/filter widgets).
Natural next steps: lift the gbif-org Tailwind theme, add a second detail entity to confirm the
pattern generalizes, then tackle occurrence search (the first Radix-free interactive island).
