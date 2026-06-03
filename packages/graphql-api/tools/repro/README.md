# Reproducing the "slow es-api" cascade locally

When es-api got slow in production, the whole GraphQL service slowed down —
including endpoints that don't touch es-api at all (e.g. dataset search). The
GraphQL API runs in a single Node process (one event loop, one heap/GC, one
libuv threadpool), so without a per-upstream concurrency cap a slow upstream
accumulates unbounded in-flight requests, and the resulting memory/GC pressure
stalls everything.

This harness lets you reproduce that cascade and verify that the per-upstream
**bulkhead** (`src/requestPools.ts`) fixes it.

## Pieces

- `delay-proxy.js` — a reverse proxy that forwards to the real es-api but adds a
  delay, simulating a slow upstream. Point `apiEs` at it.
- `load-test.js` — keeps many occurrence searches in flight (these hit the slow
  es-api) while probing dataset search (which hits the v1 API) and reporting its
  latency. Dataset latency is the canary: it should stay low if the bulkhead
  works.

## Steps

1. **Start the delay proxy** (forwards to your es-api, adds 5s delay):

   ```bash
   TARGET=https://hp-search.gbif-test.org DELAY_MS=5000 node tools/repro/delay-proxy.js
   ```

   Tip: add `MAX_INFLIGHT=5` to also simulate the es-api's own queue backing up.

2. **Point GraphQL at the proxy** in `.env`:

   ```yaml
   apiEs: http://localhost:8088/
   ```

3. **Make the cascade easy to trigger** by shrinking the resources the process
   has to play with (so you don't need production-scale load). In `.env`:

   ```yaml
   requestPools:
     occurrence:
       concurrency: unbounded   # BASELINE: reproduce the bug
       maxSockets: 50           # smaller pool surfaces socket starvation sooner
   ```

   and start the server with a small heap so memory pressure shows up fast:

   ```bash
   NODE_OPTIONS=--max-old-space-size=256 npm run develop
   ```

4. **Run the load test** and watch the dataset probe:

   ```bash
   node tools/repro/load-test.js          # defaults: 50 occ workers, 30s
   ```

   **Baseline:** dataset-search p95/max climbs (or requests fail) even though
   dataset never touches es-api — the cascade.

5. **Enable the bulkhead** and repeat step 4 without restarting anything else:

   ```yaml
   requestPools:
     occurrence:
       concurrency: 20          # FIXED: cap es-api in-flight work
       maxQueueDepth: 500       # shed beyond this with a fast 503 (backpressure)
       timeoutMs: 30000         # recycles stuck slots so the pool drains
   ```

   **Fixed:** occurrence searches back up (expected — es-api is slow), but
   dataset-search latency stays low. That is the bulkhead isolating the blast
   radius. The load test prints the occurrence outcome breakdown
   (`ok / timed out / shed / transport`) and live pool depth from `/health`.

## What to expect at extreme concurrency (e.g. OCC_CONC=50000)

A per-upstream **concurrency** cap bounds how many requests reach es-api, but it
does *not* bound how many GraphQL operations you accept and hold in memory while
they wait for a slot. Push tens of thousands of concurrent requests and that
in-process backlog (held operations + client sockets + GC pressure) becomes the
bottleneck *upstream of the bulkhead*, and everything slows — that is expected,
and it's a different failure domain (ingress overload, not upstream overload).

Two things keep it graceful:

- **`maxQueueDepth`** sheds excess requests immediately with a 503 instead of
  buffering them, so memory stays bounded and other pools keep their headroom.
  With it set, a 50k flood shows up as a large `shed (503)` count, not a slow
  death.
- **`timeoutMs`** means requests that do queue but wait too long abort *before*
  hitting es-api (they show up as `timed out`).

Also note the load test is a single Node process: tens of thousands of
concurrent `fetch` calls hit *client-side* limits (open file descriptors,
the client's own event loop) before the server does. A high `transport` count
in the summary means you're measuring the client, not the server — lower
`OCC_CONC`, raise `ulimit -n`, or drive load from multiple processes. The metric
that matters is **dataset latency relative to occurrence**, not absolute speed.

Inspect live state any time during a run:

```bash
curl -s localhost:4123/health | jq .requestPools
```

## Knobs summary

| Where | Var | Effect |
|---|---|---|
| proxy | `DELAY_MS`, `JITTER_MS` | how slow es-api is |
| proxy | `MAX_INFLIGHT` | simulate es-api's own queue capping |
| server | `NODE_OPTIONS=--max-old-space-size=N` | smaller heap → cascade triggers sooner |
| `.env` | `requestPools.occurrence.concurrency` | the fix: cap / uncap es-api in-flight work |
| `.env` | `requestPools.occurrence.maxQueueDepth` | shed (fast 503) beyond this backlog |
| `.env` | `requestPools.occurrence.maxSockets` | socket pool size |
| `.env` | `requestPools.occurrence.timeoutMs` | per-request total budget |
| load | `OCC_CONC`, `DURATION_MS`, `PROBE_MS` | load shape |
