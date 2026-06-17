# Client error telemetry

Captures uncaught errors in users' browsers and forwards them into the existing
ECS winston logging pipeline (`gbif/config/logger.mjs`) so they show up in
Elasticsearch / Kibana next to the server logs. No third-party service is
involved — all data stays on GBIF infrastructure.

```
browser error
  → src/utils/errorReporting.ts   (capture, dedupe, sample, scrub)
  → POST /api/telemetry/error      (validate, rate-limit, sample, scrub)
  → winston (ECS format)           (class: "client")
  → Elasticsearch → Kibana
```

## What gets captured

On the client (`src/utils/errorReporting.ts`):

- Uncaught exceptions (`window.onerror` / the `error` event).
- Unhandled promise rejections (`unhandledrejection`).
- React render errors caught by `ErrorBoundary`.
- React hydration "recoverable" errors.
- Anything you report manually via `reportClientError(error, { context })`.

Each event is deduped within the page session, capped at
`MAX_EVENTS_PER_SESSION` (25), and known browser noise (e.g.
`ResizeObserver loop limit exceeded`, cross-origin `Script error.`) is dropped.

## Configuration

Client (Vite, must be prefixed `PUBLIC_` to reach the browser):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_TELEMETRY_ENDPOINT` | `/api/telemetry/error` | Where reports are POSTed. Set to `""` or `false` to disable. Set it explicitly to also enable reporting in dev. |
| `PUBLIC_TELEMETRY_SAMPLE_RATE` | `1` | Fraction of events (0..1) sent by the browser. |
| `PUBLIC_RELEASE` | `unknown` | Build/release id, tagged on every event for "errors since deploy X" dashboards. |

> By default reporting is **active in production only**. In dev it stays quiet
> unless `PUBLIC_TELEMETRY_ENDPOINT` is set, so HMR/hot-reload noise is not logged.

Server:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TELEMETRY_SAMPLE_RATE` | `1` | Server-side sampling, applied on top of client sampling. |

Built-in server limits (constants in `endpoints.mjs`): 30 events/min per IP,
600 events/min globally, max 1000-char message, 8000-char stack, 4000-char
context. Emails and long token-like strings are redacted before logging.

## Log document shape (ECS)

Every client error is logged with `class: "client"` and these fields:

| Field | Example | Notes |
| --- | --- | --- |
| `message` | `client error: Cannot read properties of undefined` | |
| `event.kind` | `client-error` | filter for client telemetry |
| `error.type` | `TypeError` | |
| `error.message` | `Cannot read properties of undefined (reading 'x')` | |
| `error.stack_trace` | `TypeError: ...` | minified in prod — see source maps below |
| `url.full` | `https://www.gbif.org/occurrence/search?...` | |
| `url.path` | `/occurrence/search` | best field to group by route |
| `http.request.referrer` | | |
| `user_agent.original` | `Mozilla/5.0 ...` | |
| `client.ip` | | |
| `labels.telemetry_kind` | `react` \| `window.onerror` \| `unhandledrejection` \| `recoverable` \| `manual` | |
| `labels.release` | `2026.06.17-abc123` | from `PUBLIC_RELEASE` |
| `labels.language` | `en` | |
| `source`, `lineno`, `colno` | | for `window.onerror` |
| `context.*` | `{ componentStack: ... }` | extra per-call info |

## Building Kibana dashboards

Filter to client errors with:

```
class: "client" and event.kind: "client-error"
```

Useful starting visualisations:

- **Errors over time** — date histogram of the above filter. Add a breakdown by
  `labels.release` to spot regressions after a deploy.
- **Top error messages** — terms aggregation on `error.message` (or
  `error.type`).
- **Most affected routes** — terms aggregation on `url.path`.
- **Browser breakdown** — terms on `user_agent.original` (or parse it with an
  ingest pipeline / `user_agent` processor for clean browser + OS fields).
- **Alert** — Kibana alerting rule on the count of the filter exceeding a
  threshold per 5 minutes.

## Readable stack traces (source maps)

In production the bundle is minified, so `error.stack_trace` will reference
minified files (`index-abc123.js:1:2345`). To get readable traces you need the
Vite-generated `.map` files. Options, cheapest first:

1. Keep the `dist/**/*.map` files from each build as a build artdefact and
   symbolicate on demand when investigating an error.
2. Add an Elasticsearch ingest pipeline / small post-processor that resolves
   frames against the uploaded source maps.

This is the main feature you trade away versus a turnkey tool like Sentry, which
uploads source maps and symbolicates automatically.
