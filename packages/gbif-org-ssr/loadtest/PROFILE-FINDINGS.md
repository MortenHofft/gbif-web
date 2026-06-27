# SSR profiling findings — gbif-org-ssr dataset page

Measured with the harness in this directory: a mock GraphQL upstream (fixtures, no real backend
latency) + autocannon firing at `/dataset/<random-uuid>` so every request forces a fresh render.
Single process, one shared box (the mock + driver also consume cores, so absolute throughput is
conservative). Profile: `node loadtest/analyze.mjs <cpuprofile> 5000`.

## Headline

- **~1,450–1,570 req/s** at 96% CPU on the dataset About page (full path: fetch upstream → JSON.parse
  → transform → Preact render → write). For comparison, the React `gbif-org` app measured **~190–200
  req/s** on its taxon page — this architecture is **~8× the throughput**.
- The win is structural: no react-router (was ~26% there), no hydration payload, no react-intl, and
  the render itself is cheap.

## Steady-state CPU breakdown (% of active CPU)

| Category | ~% | What it is |
|---|---:|---|
| node builtins / native | ~54% | **dominated by response writing** — `writev` ~12.6% + `_http_outgoing`/`writeHead`/`end` |
| **undici / fetch (upstream)** | **~17.5%** | the GraphQL fetch: whatwg `fetch()` + webstreams + `TextDecoder` + `parseJSONFromBytes` |
| GC | ~6.8% | allocation churn (fetch buffers, strings, vnodes) |
| express + middleware | ~5.8% | middleware dispatch / routing (not a bottleneck) |
| app code | ~5.4% | loader/transform/render orchestration |
| **preact-render-to-string** | **~3.8%** | the actual HTML render — **small** |
| **JSON.parse** | **~1.8%** | parsing the upstream response — **small** |

## What this confirms (and kills)

- **Rendering is not the bottleneck (3.8%).** Swapping the render engine (Eta is ~7× faster than
  Preact in isolation) would move <1% end-to-end. Not worth the lost typed/isomorphic components.
- **JSON.parse is not the bottleneck (1.8%).** A binary format (protobuf/msgpack) would *increase*
  CPU in Node (userland decode vs native `JSON.parse`) for no parse-cost win. Confirmed empirically.
- **Routing is not the bottleneck (~5.8%, and that's mostly middleware dispatch).** Express's
  precompiled matching is fine at this route count; the old ~26% was a react-router anti-pattern
  (22×-cloned i18n route tree, no `compilePath` cache), not "routing is expensive".

## Fixed

- **`express.static` stat-per-request (~4%).** Mounted at `/`, it ran `fs.stat` (ENOENT) on every
  dynamic `/dataset/:key` request before falling through. Now guarded to asset-looking paths (those
  with a file extension), so dynamic routes skip the filesystem. `stat` dropped out of the profile.

## Candidate next optimisations (measure each)

1. **Upstream fetch (~17.5%) is the top reducible lever.** The shared `GraphQLService` uses the
   global whatwg `fetch()`, which carries webstreams/`TextDecoder` overhead. Switching to undici's
   lighter `request` API (or a pooled keepalive client) could shave several %. This is the most
   promising single change.
2. **Response write (~15%) is mostly inherent** — proportional to body size. Keep HTML small (zero
   client JS already helps) and let the front proxy (Varnish) handle compression rather than burning
   origin CPU. Limited headroom.
3. **GC (~6.8%)** — would fall somewhat with #1 (fewer fetch/stream allocations).
4. **In-process GraphQL execution** (import graphql-api's schema/resolvers, skip the HTTP + JSON
   round-trip for SSR pages) — removes a hop + one serialize/parse, at the cost of coupling. Only
   worth it if the upstream hop dominates in production (where the backend call is real, not a mock).

## Reproduce

```bash
npm run build                                   # produces dist/server.mjs
npm run loadtest:mock &                          # mock GraphQL on :4010
npm run loadtest:profile &                       # SSR on :3100 under --cpu-prof, pointed at the mock
CONNECTIONS=50 DURATION=18 npm run loadtest:run  # autocannon
kill -TERM <profile-server-pid>                  # clean exit flushes the .cpuprofile
npm run loadtest:analyze loadtest/profiles/<file>.cpuprofile 5000
```
