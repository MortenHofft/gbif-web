# Deploying gbif-org to Vercel

`gbif-org` is a **server-side-rendered (SSR) Express app**, not a static SPA. This
folder contains everything needed to run it on Vercel as a single serverless
function that serves SSR + proxies + auth + sitemaps, with the built client
assets served from Vercel's CDN.

## Files involved

- `gbif/createApp.mjs` — builds the Express app (middleware, routes, SSR handler).
  Shared by the local Node server and the serverless function so behaviour is
  identical.
- `gbif/server.js` — local/long-lived Node server (`npm run start`). Unchanged
  behaviour; now delegates app construction to `createApp.mjs`.
- `api/index.mjs` — the Vercel serverless entry. Pins the working directory to
  this package root and exports the Express app as the request handler.
- `vercel.json` — build command, output dir, function config and the catch-all
  rewrite to the SSR function.
- `env.vercel.example` — the environment variables you must provide.

## One-time Vercel project setup

1. **Import the repo** in Vercel and set **Root Directory** to
   `packages/gbif-org`.
2. **Framework preset:** "Other" (settings come from `vercel.json`).
3. **Node version:** Vercel currently maxes out at Node 22. The repo's `.nvmrc`
   pins 24.x; set the project's Node version to **22.x** in
   *Settings → General → Node.js Version* (or it will fail to build).
4. **Environment variables:** copy every value from the private config repo
   (`gbif/gbif-configuration → gbif-web/gbif-org/.env`) into
   *Settings → Environment Variables*. See `env.vercel.example` for the full list.
   - All `PUBLIC_*` vars must be present for **Production, Preview** *and* are
     read at **build time** (Vite inlines them into the client bundle). A missing
     required var makes the build throw (see `env.ts`).
   - Set `DOMAIN` to your Vercel domain so OAuth callback URLs are correct, and
     register that domain/callback with each OAuth provider you enable.
   - `NODE_ENV=production`.

## Build & run

- Build command (from `vercel.json`): `npm run build`
  - Produces `dist/gbif/client/**` (static client, served by CDN) and
    `dist/gbif/server/entry.server.js` (the SSR render function, bundled into the
    serverless function via `includeFiles`).
- All non-static requests are rewritten to `api/index.mjs`, which renders SSR and
  also serves `public/**` and handles `/api/*`, sitemaps, robots, redirects.

## Known caveats on serverless

- **File logging is auto-disabled** on Vercel (read-only FS). The logger detects
  the `VERCEL` env var and logs to stdout only; you can also force this anywhere
  with `DISABLE_FILE_LOGGING=true`.
- **In-memory caches** (proxy cache, `node-cache`) don't persist across function
  invocations — correct, just less effective. Consider an external cache if it
  matters.
- **Cold starts**: the SSR bundle is large, so first requests after idle can be
  slow. Bump `functions.api/index.mjs.maxDuration` in `vercel.json` if needed.
- OAuth login requires the secret credentials and a correct `DOMAIN`; without
  them, only anonymous browsing works.

## Local sanity check (mirrors production)

```bash
cd packages/gbif-org
npm install
# create .env / .env.local from the config repo first
npm run build
npm run start   # serves the production build on PORT (default 3000)
```
If `npm run start` works locally, the Vercel function (same `createApp.mjs`) will
behave the same.
